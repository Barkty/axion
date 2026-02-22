const UserManager = require('../../managers/entities/user/User.manager');
const { makeModel, makeCache, makeCortex, makeConfig, makeLogger, makeShark, makeUser } = require('../_mocks');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_REGISTER_DATA = {
    email:           'john.doe@school.com',
    password:        'Test@1234',
    confirmPassword: 'Test@1234',
    profile: {
        firstName: 'John',
        lastName:  'Doe',
        phone:     '+2348012345678',
    },
    role: 'superadmin',
};

const USER_RECORD = (overrides = {}) => ({
    _id:                'user-123',
    email:              'john.doe@school.com',
    role:               'superadmin',
    schoolId:           null,
    status:             'active',
    loginAttempts:      0,
    lockUntil:          null,
    permissions:        ['manage_schools'],
    profile:            { firstName: 'John', lastName: 'Doe' },
    isLocked:           jest.fn().mockReturnValue(false),
    comparePassword:    jest.fn().mockResolvedValue(true),
    incrementLoginAttempts: jest.fn().mockResolvedValue(true),
    save:               jest.fn().mockResolvedValue(true),
    ...overrides,
});

// ─── Factory ──────────────────────────────────────────────────────────────────

const makeManager = (overrides = {}) => {
    const userModel   = makeModel(overrides.User   || {});
    const schoolModel = makeModel(overrides.School || {});
    const cortex      = makeCortex();
    const cache       = makeCache();
    const shark       = makeShark();
    const logger      = makeLogger();
    const config      = makeConfig();

    const tokenManager = {
        genShortToken:  jest.fn().mockReturnValue('mock-access-token'),
        genLongToken:   jest.fn().mockReturnValue('mock-refresh-token'),
        verifyShortToken: jest.fn().mockReturnValue({ userId: 'user-123' }),
        verifyLongToken:  jest.fn().mockReturnValue({ userId: 'user-123' }),
    };

    const manager = new UserManager({
        mongomodels: { User: userModel, School: schoolModel },
        cache,
        cortex,
        config,
        managers: { logger, shark, token: tokenManager },
        validators: {},
        utils:      {},
    });

    return { manager, userModel, schoolModel, cortex, cache, shark, logger, tokenManager };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserManager', () => {

    // ── register ────────────────────────────────────────────────────────────

    describe('register', () => {
        it('registers a superadmin user with valid data', async () => {
            const { manager, userModel } = makeManager();
            userModel.findOne.mockResolvedValue(null);
            userModel.create.mockResolvedValue(USER_RECORD());

            const result = await manager.register({ data: VALID_REGISTER_DATA });

            expect(result.user).toBeDefined();
            expect(result.accessToken).toBe('mock-access-token');
            expect(result.refreshToken).toBe('mock-refresh-token');
        });

        it('does not expose password in response', async () => {
            const userWithPassword = USER_RECORD({ password: 'hashed-secret' });
            const { manager, userModel } = makeManager();
            userModel.findOne.mockResolvedValue(null);
            userModel.create.mockResolvedValue(userWithPassword);

            const result = await manager.register({ data: VALID_REGISTER_DATA });

            expect(result.user.password).toBeUndefined();
        });

        it('throws if email already exists', async () => {
            const { manager, userModel } = makeManager();
            userModel.findOne.mockResolvedValue(USER_RECORD());

            await expect(
                manager.register({ data: VALID_REGISTER_DATA })
            ).rejects.toThrow('User with this email already exists');
        });

        it('throws validation error for invalid email', async () => {
            const { manager } = makeManager();

            await expect(
                manager.register({ data: { ...VALID_REGISTER_DATA, email: 'not-an-email' } })
            ).rejects.toThrow('Validation error');
        });

        it('throws validation error for weak password', async () => {
            const { manager } = makeManager();

            await expect(
                manager.register({
                    data: { ...VALID_REGISTER_DATA, password: 'weak', confirmPassword: 'weak' },
                })
            ).rejects.toThrow('Validation error');
        });

        it('throws validation error when passwords do not match', async () => {
            const { manager } = makeManager();

            await expect(
                manager.register({
                    data: { ...VALID_REGISTER_DATA, confirmPassword: 'DifferentPass@1' },
                })
            ).rejects.toThrow('Validation error');
        });

        it('validates school code for school_admin role', async () => {
            const { manager, userModel, schoolModel } = makeManager();
            userModel.findOne.mockResolvedValue(null);
            schoolModel.findOne.mockResolvedValue(null); // invalid school code

            await expect(
                manager.register({
                    data: {
                        ...VALID_REGISTER_DATA,
                        role:       'school_admin',
                        schoolCode: 'INVALID-CODE',
                    },
                })
            ).rejects.toThrow('Invalid school code');
        });

        it('assigns schoolId when school_admin provides valid school code', async () => {
            const { manager, userModel, schoolModel } = makeManager();
            const school = { _id: 'school-123', code: 'GFA-001' };
            userModel.findOne.mockResolvedValue(null);
            schoolModel.findOne.mockResolvedValue(school);
            userModel.create.mockResolvedValue(USER_RECORD({ role: 'school_admin', schoolId: 'school-123' }));

            const result = await manager.register({
                data: {
                    ...VALID_REGISTER_DATA,
                    role:       'school_admin',
                    schoolCode: 'GFA-001',
                },
            });

            expect(userModel.create).toHaveBeenCalledWith(
                expect.objectContaining({ schoolId: 'school-123' })
            );
        });

        it('emits user.registered event', async () => {
            const { manager, userModel, cortex } = makeManager();
            userModel.findOne.mockResolvedValue(null);
            userModel.create.mockResolvedValue(USER_RECORD());

            await manager.register({ data: VALID_REGISTER_DATA });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'user.registered' })
            );
        });

        it('assigns correct default permissions per role', async () => {
            const { manager, userModel } = makeManager();
            userModel.findOne.mockResolvedValue(null);
            userModel.create.mockResolvedValue(USER_RECORD());

            await manager.register({ data: VALID_REGISTER_DATA });

            const createCall = userModel.create.mock.calls[0][0];
            expect(createCall.permissions).toContain('manage_schools');
            expect(createCall.permissions).toContain('manage_users');
        });
    });

    // ── login ────────────────────────────────────────────────────────────────

    describe('login', () => {
        const LOGIN_DATA = { email: 'john.doe@school.com', password: 'Test@1234' };

        it('returns tokens on successful login', async () => {
            const user = USER_RECORD();
            const { manager, userModel } = makeManager();
            userModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

            const result = await manager.login({ data: LOGIN_DATA });

            expect(result.accessToken).toBe('mock-access-token');
            expect(result.refreshToken).toBe('mock-refresh-token');
        });

        it('updates lastLogin on successful login', async () => {
            const user = USER_RECORD();
            const { manager, userModel } = makeManager();
            userModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

            await manager.login({ data: LOGIN_DATA });

            expect(user.lastLogin).toBeDefined();
            expect(user.save).toHaveBeenCalled();
        });

        it('does not expose password in response', async () => {
            const user = USER_RECORD({ password: 'hashed-secret' });
            const { manager, userModel } = makeManager();
            userModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

            const result = await manager.login({ data: LOGIN_DATA });

            expect(result.user.password).toBeUndefined();
        });

        it('throws for non-existent email', async () => {
            const { manager, userModel } = makeManager();
            userModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

            await expect(
                manager.login({ data: LOGIN_DATA })
            ).rejects.toThrow('Invalid email or password');
        });

        it('throws for incorrect password', async () => {
            const user = USER_RECORD({ comparePassword: jest.fn().mockResolvedValue(false) });
            const { manager, userModel } = makeManager();
            userModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

            await expect(
                manager.login({ data: LOGIN_DATA })
            ).rejects.toThrow('Invalid email or password');
        });

        it('increments loginAttempts on wrong password', async () => {
            const user = USER_RECORD({ comparePassword: jest.fn().mockResolvedValue(false) });
            const { manager, userModel } = makeManager();
            userModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

            try { await manager.login({ data: LOGIN_DATA }); } catch (_) {}

            expect(user.incrementLoginAttempts).toHaveBeenCalled();
        });

        it('throws for locked account', async () => {
            const user = USER_RECORD({ isLocked: jest.fn().mockReturnValue(true) });
            const { manager, userModel } = makeManager();
            userModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

            await expect(
                manager.login({ data: LOGIN_DATA })
            ).rejects.toThrow('Account is temporarily locked');
        });

        it('throws for inactive account', async () => {
            const user = USER_RECORD({ status: 'inactive' });
            const { manager, userModel } = makeManager();
            userModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

            await expect(
                manager.login({ data: LOGIN_DATA })
            ).rejects.toThrow('Account is not active');
        });

        it('emits user.loggedin event', async () => {
            const user = USER_RECORD();
            const { manager, userModel, cortex } = makeManager();
            userModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

            await manager.login({ data: LOGIN_DATA });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'user.loggedin' })
            );
        });
    });

    // ── logout ───────────────────────────────────────────────────────────────

    describe('logout', () => {
        it('blacklists token in cache', async () => {
            const { manager, cache } = makeManager();

            await manager.logout({ __user: makeUser(), __token: 'my-token' });

            expect(cache.key.set).toHaveBeenCalledWith(
                'blacklist:my-token',
                86400,
                'blacklisted'
            );
        });

        it('returns success message', async () => {
            const { manager } = makeManager();

            const result = await manager.logout({ __user: makeUser(), __token: 'my-token' });

            expect(result.message).toBe('Logged out successfully');
        });

        it('emits user.loggedout event', async () => {
            const { manager, cortex } = makeManager();

            await manager.logout({ __user: makeUser(), __token: 'my-token' });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'user.loggedout' })
            );
        });
    });

    // ── getProfile ───────────────────────────────────────────────────────────

    describe('getProfile', () => {
        it('returns user profile with populated school', async () => {
            const user = USER_RECORD();
            const { manager, userModel } = makeManager();
            userModel.findById.mockReturnValue({
                populate: jest.fn().mockResolvedValue(user),
            });

            const result = await manager.getProfile({ __user: makeUser() });

            expect(result._id).toBe('user-123');
        });

        it('throws if user not found', async () => {
            const { manager, userModel } = makeManager();
            userModel.findById.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null),
            });

            await expect(
                manager.getProfile({ __user: makeUser() })
            ).rejects.toThrow('User not found');
        });
    });

    // ── changePassword ───────────────────────────────────────────────────────

    describe('changePassword', () => {
        const CHANGE_DATA = {
            currentPassword: 'Test@1234',
            newPassword:     'NewPass@5678',
            confirmPassword: 'NewPass@5678',
        };

        it('changes password successfully', async () => {
            const user = USER_RECORD();
            const { manager, userModel } = makeManager();
            userModel.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

            const result = await manager.changePassword({ __user: makeUser(), data: CHANGE_DATA });

            expect(result.message).toBe('Password changed successfully');
            expect(user.password).toBe('NewPass@5678');
            expect(user.save).toHaveBeenCalled();
        });

        it('throws if current password is wrong', async () => {
            const user = USER_RECORD({ comparePassword: jest.fn().mockResolvedValue(false) });
            const { manager, userModel } = makeManager();
            userModel.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

            await expect(
                manager.changePassword({ __user: makeUser(), data: CHANGE_DATA })
            ).rejects.toThrow('Current password is incorrect');
        });

        it('emits user.passwordChanged event', async () => {
            const user = USER_RECORD();
            const { manager, userModel, cortex } = makeManager();
            userModel.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

            await manager.changePassword({ __user: makeUser(), data: CHANGE_DATA });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'user.passwordChanged' })
            );
        });
    });

    // ── _getDefaultPermissions ───────────────────────────────────────────────

    describe('_getDefaultPermissions', () => {
        it('returns full permissions for superadmin', () => {
            const { manager } = makeManager();
            const perms = manager._getDefaultPermissions('superadmin');
            expect(perms).toContain('manage_schools');
            expect(perms).toContain('system_config');
            expect(perms).toContain('assign_role');
        });

        it('returns school_admin permissions without system_config', () => {
            const { manager } = makeManager();
            const perms = manager._getDefaultPermissions('school_admin');
            expect(perms).toContain('manage_classrooms');
            expect(perms).not.toContain('system_config');
            expect(perms).not.toContain('manage_schools');
        });

        it('returns limited permissions for student role', () => {
            const { manager } = makeManager();
            const perms = manager._getDefaultPermissions('student');
            expect(perms).toEqual(['view_profile', 'view_grades']);
        });

        it('returns empty array for unknown role', () => {
            const { manager } = makeManager();
            expect(manager._getDefaultPermissions('unknown-role')).toEqual([]);
        });
    });
});