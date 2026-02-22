const SchoolManager = require('../../managers/entities/school/School.manager');
const { makeModel, makeCache, makeCortex, makeConfig, makeLogger, makeShark, makeUser } = require('../_mocks');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_SCHOOL_DATA = {
    name: 'Greenfield Academy',
    code: 'GFA-001',
    address: {
        street: '10 Education Lane',
        city:    'Testville',
        state:   'Lagos',
        zipCode: '100001',
        country: 'Nigeria',
    },
    contact: {
        email:   'admin@greenfield.edu',
        phone:   '+2348012345678',
        website: 'https://greenfield.edu',
    },
    settings: {
        maxClassrooms:      20,
        maxStudentsPerClass: 40,
        academicYear:       '2025-2026',
    },
};

const SCHOOL_RECORD = {
    _id:    'school-123',
    name:   'Greenfield Academy',
    code:   'GFA-001',
    status: 'active',
    save:   jest.fn().mockResolvedValue(true),
};

// ─── Factory ──────────────────────────────────────────────────────────────────

const makeManager = (mongomodelOverrides = {}) => {
    const schoolModel    = makeModel(mongomodelOverrides.School    || {});
    const classroomModel = makeModel(mongomodelOverrides.Classroom || {});
    const studentModel   = makeModel(mongomodelOverrides.Student   || {});
    const cortex         = makeCortex();
    const cache          = makeCache();
    const shark          = makeShark();
    const logger         = makeLogger();
    const config         = makeConfig();

    const manager = new SchoolManager({
        database:    {},
        mongomodels: {
            School:    schoolModel,
            Classroom: classroomModel,
            Student:   studentModel,
        },
        cache,
        cortex,
        config,
        managers: { logger, shark },
    });

    return { manager, schoolModel, classroomModel, studentModel, cortex, cache, shark, logger };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SchoolManager', () => {

    // ── create ──────────────────────────────────────────────────────────────

    describe('create', () => {
        it('creates a school with valid data', async () => {
            const { manager, schoolModel } = makeManager();
            schoolModel.findOne.mockResolvedValue(null);
            schoolModel.create.mockResolvedValue({ _id: 'school-123', ...VALID_SCHOOL_DATA, status: 'active' });

            const result = await manager.create({
                __user: makeUser(),
                data:   VALID_SCHOOL_DATA,
            });

            expect(result.name).toBe(VALID_SCHOOL_DATA.name);
            expect(result.code).toBe(VALID_SCHOOL_DATA.code);
            expect(schoolModel.create).toHaveBeenCalledTimes(1);
        });

        it('emits school.created event on success', async () => {
            const { manager, schoolModel, cortex } = makeManager();
            schoolModel.create.mockResolvedValue({ _id: 'school-123', ...VALID_SCHOOL_DATA });

            await manager.create({ __user: makeUser(), data: VALID_SCHOOL_DATA });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'school.created' })
            );
        });

        it('throws if school code already exists', async () => {
            const { manager, schoolModel } = makeManager();
            schoolModel.findOne.mockResolvedValue({ _id: 'existing-school' });

            await expect(
                manager.create({ __user: makeUser(), data: VALID_SCHOOL_DATA })
            ).rejects.toThrow('School code already exists');
        });

        it('throws validation error for missing required fields', async () => {
            const { manager } = makeManager();

            await expect(
                manager.create({ __user: makeUser(), data: { name: 'Incomplete' } })
            ).rejects.toThrow('Validation error');
        });

        it('throws validation error for invalid code format', async () => {
            const { manager } = makeManager();

            await expect(
                manager.create({
                    __user: makeUser(),
                    data: { ...VALID_SCHOOL_DATA, code: 'invalid code!' },
                })
            ).rejects.toThrow('Validation error');
        });

        it('checks permissions via sharkFin', async () => {
            const { manager, shark, schoolModel } = makeManager();
            schoolModel.create.mockResolvedValue({ _id: 'school-123', ...VALID_SCHOOL_DATA });

            await manager.create({ __user: makeUser(), data: VALID_SCHOOL_DATA });

            expect(shark.isGranted).toHaveBeenCalledWith(
                makeUser().id, 'schools', 'create'
            );
        });

        it('clears schools list cache after creation', async () => {
            const { manager, schoolModel, cache } = makeManager();
            schoolModel.create.mockResolvedValue({ _id: 'school-123', ...VALID_SCHOOL_DATA });

            await manager.create({ __user: makeUser(), data: VALID_SCHOOL_DATA });

            expect(cache.del).toHaveBeenCalledWith('schools:list:*');
        });
    });

    // ── get ─────────────────────────────────────────────────────────────────

    describe('get', () => {
        it('returns school for valid ID', async () => {
            const { manager, schoolModel } = makeManager();
            schoolModel.findById.mockResolvedValue(SCHOOL_RECORD);

            const result = await manager.get({
                __user:  makeUser(),
                params:  { id: 'school-123' },
            });

            expect(result._id).toBe('school-123');
            expect(result.name).toBe('Greenfield Academy');
        });

        it('returns cached data without hitting the database', async () => {
            const { manager, schoolModel, cache } = makeManager();
            cache.get.mockResolvedValue(JSON.stringify({ _id: 'school-123', name: 'Cached School' }));

            const result = await manager.get({
                __user: makeUser(),
                params: { id: 'school-123' },
            });

            expect(result.name).toBe('Cached School');
            expect(schoolModel.findById).not.toHaveBeenCalled();
        });

        it('caches the result after a database hit', async () => {
            const { manager, schoolModel, cache } = makeManager();
            schoolModel.findById.mockResolvedValue(SCHOOL_RECORD);

            await manager.get({ __user: makeUser(), params: { id: 'school-123' } });

            expect(cache.key.set).toHaveBeenCalledWith(
                'school:school-123',
                300,
                expect.any(String)
            );
        });

        it('throws if school not found', async () => {
            const { manager } = makeManager();

            await expect(
                manager.get({ __user: makeUser(), params: { id: 'ghost' } })
            ).rejects.toThrow('School not found');
        });

        it('throws access denied for non-admin accessing another school', async () => {
            const { manager, schoolModel } = makeManager();
            schoolModel.findById.mockResolvedValue(SCHOOL_RECORD);

            await expect(
                manager.get({
                    __user:  makeUser({ role: 'school_admin', schoolId: 'other-school' }),
                    params:  { id: 'school-123' },
                })
            ).rejects.toThrow('Access denied');
        });
    });

    // ── update ──────────────────────────────────────────────────────────────

    describe('update', () => {
        it('updates school fields', async () => {
            const school = { ...SCHOOL_RECORD, save: jest.fn().mockResolvedValue(true) };
            const { manager, schoolModel, cortex } = makeManager();
            schoolModel.findById.mockResolvedValue(school);

            await manager.update({
                __user:  makeUser(),
                params:  { id: 'school-123' },
                data:    { name: 'Updated Name' },
            });

            expect(school.name).toBe('Updated Name');
            expect(school.save).toHaveBeenCalled();
        });

        it('emits school.updated event', async () => {
            const school = { ...SCHOOL_RECORD, save: jest.fn().mockResolvedValue(true) };
            const { manager, schoolModel, cortex } = makeManager();
            schoolModel.findById.mockResolvedValue(school);

            await manager.update({
                __user: makeUser(),
                params: { id: 'school-123' },
                data:   { name: 'Updated Name' },
            });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'school.updated' })
            );
        });

        it('throws if school not found', async () => {
            const { manager } = makeManager();

            await expect(
                manager.update({ __user: makeUser(), params: { id: 'ghost' }, data: { name: 'Xar' } })
            ).rejects.toThrow('School not found');
        });

        it('clears school and list cache after update', async () => {
            const school = { ...SCHOOL_RECORD, save: jest.fn().mockResolvedValue(true) };
            const { manager, schoolModel, cache } = makeManager();
            schoolModel.findById.mockResolvedValue(school);

            await manager.update({
                __user: makeUser(),
                params: { id: 'school-123' },
                data:   { name: 'Updated' },
            });

            expect(cache.del).toHaveBeenCalledWith('school:school-123');
            expect(cache.del).toHaveBeenCalledWith('schools:list:*');
        });
    });

    // ── delete ──────────────────────────────────────────────────────────────

    describe('delete', () => {
        it('soft-deletes a school with no active classrooms or students', async () => {
            const school = { ...SCHOOL_RECORD, save: jest.fn().mockResolvedValue(true) };
            const { manager, schoolModel, classroomModel, studentModel } = makeManager();
            schoolModel.findById.mockResolvedValue(school);
            classroomModel.countDocuments.mockResolvedValue(0);
            studentModel.countDocuments.mockResolvedValue(0);

            const result = await manager.delete({ __user: makeUser(), params: { id: 'school-123' } });

            expect(result.message).toBe('School deleted successfully');
            expect(school.deletedAt).toBeDefined();
            expect(school.save).toHaveBeenCalled();
        });

        it('blocks deletion if active classrooms exist', async () => {
            const { manager, schoolModel, classroomModel, studentModel } = makeManager();
            schoolModel.findById.mockResolvedValue(SCHOOL_RECORD);
            classroomModel.countDocuments.mockResolvedValue(3);
            studentModel.countDocuments.mockResolvedValue(0);

            await expect(
                manager.delete({ __user: makeUser(), params: { id: 'school-123' } })
            ).rejects.toThrow('Cannot delete school with active classrooms or students');
        });

        it('blocks deletion if enrolled students exist', async () => {
            const { manager, schoolModel, classroomModel, studentModel } = makeManager();
            schoolModel.findById.mockResolvedValue(SCHOOL_RECORD);
            classroomModel.countDocuments.mockResolvedValue(0);
            studentModel.countDocuments.mockResolvedValue(10);

            await expect(
                manager.delete({ __user: makeUser(), params: { id: 'school-123' } })
            ).rejects.toThrow('Cannot delete school with active classrooms or students');
        });

        it('emits school.deleted event', async () => {
            const school = { ...SCHOOL_RECORD, save: jest.fn().mockResolvedValue(true) };
            const { manager, schoolModel, classroomModel, studentModel, cortex } = makeManager();
            schoolModel.findById.mockResolvedValue(school);
            classroomModel.countDocuments.mockResolvedValue(0);
            studentModel.countDocuments.mockResolvedValue(0);

            await manager.delete({ __user: makeUser(), params: { id: 'school-123' } });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'school.deleted' })
            );
        });
    });

    // ── list ────────────────────────────────────────────────────────────────

    describe('list', () => {
        it('returns paginated list of schools', async () => {
            const { manager, schoolModel } = makeManager();
            schoolModel.find.mockReturnValue({
                skip:  jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                sort:  jest.fn().mockResolvedValue([SCHOOL_RECORD]),
            });
            schoolModel.countDocuments.mockResolvedValue(1);

            const result = await manager.list({
                __user: makeUser(),
                query:  { page: '1', limit: '10' },
            });

            expect(result.data).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
        });

        it('returns cached list without hitting database', async () => {
            const cached = { data: [SCHOOL_RECORD], pagination: { total: 1 } };
            const { manager, schoolModel, cache } = makeManager();
            cache.get.mockResolvedValue(JSON.stringify(cached));

            const result = await manager.list({ __user: makeUser(), query: {} });

            expect(result.data[0]._id).toBe('school-123');
            expect(schoolModel.find).not.toHaveBeenCalled();
        });

        it('restricts non-superadmin to their own school', async () => {
            const { manager, schoolModel } = makeManager();
            schoolModel.find.mockReturnValue({
                skip:  jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                sort:  jest.fn().mockResolvedValue([]),
            });
            schoolModel.countDocuments.mockResolvedValue(0);

            await manager.list({
                __user: makeUser({ role: 'school_admin', schoolId: 'school-123' }),
                query:  {},
            });

            const filterArg = schoolModel.find.mock.calls[0][0];
            expect(filterArg._id).toBe('school-123');
        });
    });
});