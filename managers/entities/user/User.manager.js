const Joi = require('joi');

module.exports = class UserManager {
    
    // Expose HTTP endpoints
    static httpExposed = [
        'register=post',
        'login=post',
        'logout=post',
        'refreshToken=post',
        'getProfile=get',
        'updateProfile=put',
        'changePassword=put',
        'list=get',
        'getUser=get',
        'updateUser=put',
        'deleteUser=delete',
        'assignRole=post'
    ];

    static NAME_REGEX = /^[A-Za-z]+([ '-][A-Za-z]+)*$/;
    static REPEATED_CHAR_REGEX = /(.)\1{3,}/;
    static BLOOD_GROUP = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

    static nameSchema = Joi.string()
      .trim()
      .min(2)
      .max(50)
      .pattern(this.NAME_REGEX)
      .custom((value, helpers) => {
        if (this.REPEATED_CHAR_REGEX.test(value)) {
          return helpers.error('string.repeated');
        }
        return value;
      })
      .messages({
        'string.base': '{{#label}} must be a string',
        'string.empty': '{{#label}} is required',
        'string.min': '{{#label}} must be at least {#limit} characters',
        'string.max': '{{#label}} must not exceed {#limit} characters',
        'string.pattern.base': '{{#label}} contains invalid characters',
        'string.repeated': '{{#label}} contains unrealistic repeated characters',
      });
    
    static phoneNumberSchema = Joi.string()
      .trim()
      .custom((value, helpers) => {
        const normalized = value.replace(/[\s\-()]/g, '');
    
        if (!/^\+?\d+$/.test(normalized)) {
          return helpers.error('string.invalidPhone');
        }
    
        const digitsOnly = normalized.replace(/^\+/, '');
    
        if (digitsOnly.length < 7 || digitsOnly.length > 15) {
          return helpers.error('string.phoneLength');
        }
    
        if (this.REPEATED_CHAR_REGEX.test(digitsOnly)) {
          return helpers.error('string.phoneRepeated');
        }
    
        return value;
      })
      .messages({
        'string.base': '{{#label}} must be a string',
        'string.empty': '{{#label}} is required',
        'string.invalidPhone': '{{#label}} must contain digits only',
        'string.phoneLength': '{{#label}} must be between 7 and 15 digits',
        'string.phoneRepeated': '{{#label}} contains unrealistic repeated digits',
      });
    
    static passwordSchema = Joi.string()
        .regex(
            new RegExp(
            '^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[ !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~]).{8,}$',
            ),
        )
        .messages({ 'string.pattern.base': 'Invalid password combination' })
        .required()
        .min(8)
        .max(50);

    // Validation schemas
    static validationSchemas = {
        register: Joi.object({
            email: Joi.string().email().required(),
            password: this.passwordSchema,
            confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
            profile: Joi.object({
                firstName: this.nameSchema.required(),
                lastName: this.nameSchema.required(50),
                phone: this.phoneNumberSchema
            }).required(),
            schoolCode: Joi.string().when('role', { 
                is: 'school_admin', 
                then: Joi.required(),
                otherwise: Joi.optional() 
            }),
            role: Joi.string().valid('superadmin', 'school_admin', 'teacher', 'student').default('school_admin')
        }),
        
        login: Joi.object({
            email: Joi.string().email().required(),
            password: this.passwordSchema,
            rememberMe: Joi.boolean().default(false)
        }),

        changePassword: Joi.object({
            currentPassword: this.passwordSchema,
            newPassword: this.passwordSchema,
            confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
        }),

        updateProfile: Joi.object({
            profile: Joi.object({
                firstName: this.nameSchema.required(),
                lastName: this.nameSchema.required(),
                phone: this.phoneNumberSchema,
                avatar: Joi.string().uri()
            }),
            email: Joi.string().email()
        }).min(1),

        updateUser: Joi.object({
            role: Joi.string().valid('superadmin', 'school_admin', 'teacher', 'student'),
            profile: Joi.object({
                firstName: this.nameSchema.required(),
                lastName: this.nameSchema.required(),
                phone: this.phoneNumberSchema,
                avatar: Joi.string().uri()
            }),
            status: Joi.string().valid('active', 'inactive', 'locked'),
            permissions: Joi.array().items(Joi.string())
        }).min(1),

        assignRole: Joi.object({
            role: Joi.string().valid('school_admin', 'teacher', 'student').required(),
            schoolId: Joi.string().when('role', { 
                is: 'superadmin', 
                then: Joi.forbidden(),
                otherwise: Joi.required() 
            })
        })
    };

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels, shark } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.tokenManager = managers.token;
        this.permissions = managers.permissions;
        this.cache = cache;
        this.utils = utils;
        this.logger = managers.logger;

        // Collection reference
        this.User = mongomodels.User;

        this.httpExposed = UserManager.httpExposed;
        
        this.tokenBlacklist = new Set();


        this.eventHandlers = {
            registered: async ({ userId, email, role, timestamp }) => {
                this.logger.info(`[user.registered] userId=${userId} role=${role} at ${timestamp}`);
                // e.g. trigger welcome email, analytics, onboarding workflow
            },

            loggedin: async ({ userId, timestamp }) => {
                this.logger.info(`[user.loggedin] userId=${userId} at ${timestamp}`);
                // e.g. update last-seen, session tracking
            },

            loggedout: async ({ userId, timestamp }) => {
                this.logger.info(`[user.loggedout] userId=${userId} at ${timestamp}`);
                // e.g. clean up session data
            },

            profileUpdated: async ({ userId, timestamp }) => {
                this.logger.info(`[user.profileUpdated] userId=${userId} at ${timestamp}`);
                // e.g. re-index search, sync to external system
            },

            passwordChanged: async ({ userId, timestamp }) => {
                this.logger.info(`[user.passwordChanged] userId=${userId} at ${timestamp}`);
                // e.g. send security alert email
            },

            updated: async ({ userId, updatedBy, changes, timestamp }) => {
                this.logger.info(`[user.updated] userId=${userId} by=${updatedBy} changes=${changes} at ${timestamp}`);
                // e.g. audit log
            },

            deleted: async ({ userId, deletedBy, timestamp }) => {
                this.logger.info(`[user.deleted] userId=${userId} by=${deletedBy} at ${timestamp}`);
                // e.g. revoke all sessions, cascade soft-deletes
            },

            roleChanged: async ({ userId, newRole, updatedBy, timestamp }) => {
                this.logger.info(`[user.roleChanged] userId=${userId} newRole=${newRole} by=${updatedBy} at ${timestamp}`);
                // e.g. update permissions cache, notify user
            }
        };
    }

    async _emit(fnName, args) {
        try {
            await this.cortex.AsyncEmitToOneOf({
                type: this.config.dotEnv.CORTEX_TYPE,
                call: `user.${fnName}`,
                args
            });
        } catch (err) {
            // Events are non-critical — log but never crash the caller
            this.logger.error(`[cortex._emit] Failed to emit user.${fnName}:`, err.message);
        }
    }

    /**
     * User Registration
     */
    async register({__shark, __user, params, data: value }) {
        try {
            const { error } = UserManager.validationSchemas.register.validate(value);
            if (error) {
                throw new Error(`Validation error: ${error.message}`);
            }

            const existingUser = await this.User.findOne({ 
                email: value.email.toLowerCase() 
            });
            
            if (existingUser) {
                throw new Error('User with this email already exists');
            }

            let schoolId = null;
            if (value.role === 'school_admin' && value.schoolCode) {
                const school = await this.mongomodels.School.findOne({ 
                    code: value.schoolCode.toUpperCase() 
                });
                
                if (!school) {
                    throw new Error('Invalid school code');
                }
                schoolId = school._id;
            }

            const user = await this.User.create({
                email: value.email.toLowerCase(),
                password: value.password,
                role: value.role,
                schoolId: schoolId,
                profile: {
                    firstName: value.profile.firstName,
                    lastName: value.profile.lastName,
                    phone: value.profile.phone
                },
                status: 'active',
                permissions: this._getDefaultPermissions(value.role)
            });

            const tokens = await this._generateTokens(user, value.rememberMe);

            user.password = undefined;

            await this._emit('registered', {
                userId: user._id,
                email: user.email,
                role: user.role,
                timestamp: new Date()
            });

            return { user, ...tokens };

        } catch (error) {
            throw error;
        }
    }

    /**
     * User Login
     */
    async login({__shark, __user, data }) {
        try {
            const { error } = UserManager.validationSchemas.login.validate(data);
            
            if (error) {
                this.logger.error('Validation error:', error.details[0].message);
                throw new Error(`Validation error: ${error.details[0].message}`);
            }

            const user = await this.User.findOne({ 
                email: data.email.toLowerCase() 
            }).select('+password');

            if (!user) {
                throw new Error('Invalid email or password');
            }

            if (user.isLocked()) {
                throw new Error('Account is temporarily locked. Please try again later.');
            }

            const isPasswordValid = await user.comparePassword(data.password);
            
            if (!isPasswordValid) {
                await user.incrementLoginAttempts();
                throw new Error('Invalid email or password');
            }

            if (user.status !== 'active') {
                throw new Error('Account is not active. Please contact administrator.');
            }

            user.loginAttempts = 0;
            user.lockUntil = null;
            user.lastLogin = new Date();
            await user.save();

            const tokens = await this._generateTokens(user, data.rememberMe);

            user.password = undefined;

            await this._emit('loggedin', {
                userId: user._id,
                timestamp: new Date()
            });

            return { user, ...tokens };

        } catch (error) {
            throw error;
        }
    }

    /**
     * User Logout
     */
    async logout({__shark, __user, __token}) {
        try {
            const tokenKey = `blacklist:${__token}`;
            await this.cache.key.set({ key: tokenKey, ttl: 24 * 60 * 60, data: 'blacklisted'});

            await this._emit('loggedout', {
                userId: __user.id,
                timestamp: new Date()
            });

            return { message: 'Logged out successfully' };

        } catch (error) {
            throw error;
        }
    }

    /**
     * Refresh Access Token
     */
    async refreshToken({__shark, __user, data }) {
        try {
            const { refreshToken } = data;
            
            if (!refreshToken) {
                throw new Error('Refresh token is required');
            }

            const decoded = this.tokenManager.verifyLongToken(refreshToken);
            
            if (!decoded || !decoded.userId) {
                throw new Error('Invalid refresh token');
            }

            const user = await this.User.findById(decoded.userId);
            
            if (!user || user.status !== 'active') {
                throw new Error('User not found or inactive');
            }

            const tokens = await this._generateTokens(user, true);

            return tokens;

        } catch (error) {
            throw new Error('Invalid or expired refresh token');
        }
    }

    /**
     * Get User Profile
     */
    async getProfile({__shark, __user}) {
        try {
            const user = await this.User.findById(__user.id)
                .populate('schoolId', 'name code address');

            if (!user) {
                throw new Error('User not found');
            }

            return user;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Update User Profile
     */
    async updateProfile({__shark, __user, data: value }) {
        try {
            const { error } = UserManager.validationSchemas.updateProfile.validate(value);
            if (error) {
                throw new Error(`Validation error: ${error.message}`);
            }

            if (value.email) {
                const existingUser = await this.User.findOne({
                    email: value.email.toLowerCase(),
                    _id: { $ne: __user.id }
                });
                
                if (existingUser) {
                    throw new Error('Email already in use');
                }
            }

            const user = await this.User.findByIdAndUpdate(
                __user.id,
                {
                    ...(value.email && { email: value.email.toLowerCase() }),
                    ...(value.profile && { profile: value.profile })
                },
                { new: true, runValidators: true }
            );

            if (!user) {
                throw new Error('User not found');
            }

            await this.cache.key.delete({key: `user:${__user.id}`});

            await this._emit('profileUpdated', {
                userId: user._id,
                timestamp: new Date()
            });

            return user;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Change Password
     */
    async changePassword({__shark, __user, data: value }) {
        try {
            const { error } = UserManager.validationSchemas.changePassword.validate(value);
            if (error) {
                throw new Error(`Validation error: ${error.message}`);
            }

            const user = await this.User.findById(__user.id).select('+password');
            
            if (!user) {
                throw new Error('User not found');
            }

            const isPasswordValid = await user.comparePassword(value.currentPassword);
            
            if (!isPasswordValid) {
                throw new Error('Current password is incorrect');
            }

            user.password = value.newPassword;
            user.passwordChangedAt = new Date();
            await user.save();

            await this._emit('passwordChanged', {
                userId: user._id,
                timestamp: new Date()
            });

            return { message: 'Password changed successfully' };

        } catch (error) {
            throw error;
        }
    }

    /**
     * List Users (Admin only)
     */
    async list({ __shark, __user, query}) {

        try {
            this.permissions.check(__user, 'users', 'list')

            const page = parseInt(query.page) || 1;
            const limit = parseInt(query.limit) || 20;
            const skip = (page - 1) * limit;

            const filter = { deletedAt: null };
            
            if (__user.role !== 'superadmin') {
                filter.schoolId = __user.schoolId;
            }

            if (query.role) filter.role = query.role;
            if (query.status) filter.status = query.status;
            if (query.schoolId && __user.role === 'superadmin') {
                filter.schoolId = query.schoolId;
            }

            if (query.search) {
                filter.$or = [
                    { email: new RegExp(query.search, 'i') },
                    { 'profile.firstName': new RegExp(query.search, 'i') },
                    { 'profile.lastName': new RegExp(query.search, 'i') }
                ];
            }

            const cacheKey = `users:list:${JSON.stringify(filter)}:${page}:${limit}`;
            const cached = await this.cache.key.get({key: cacheKey});
            if (cached) return JSON.parse(cached);

            const [users, total] = await Promise.all([
                this.User.find(filter)
                    .select('-password')
                    .populate('schoolId', 'name code')
                    .skip(skip)
                    .limit(limit)
                    .sort({ createdAt: -1 }),
                this.User.countDocuments(filter)
            ]);

            const result = {
                data: users,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };

            await this.cache.key.set({key: cacheKey, ttl: 120, data: JSON.stringify(result)});

            return result;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Get User by ID (Admin only)
     */
    async getUser({__shark, __user, params}) {
        try {
            const userId = params.id;

            this.permissions.check(__user, 'users', 'view')

            const cacheKey = `user:${userId}`;
            const cached = await this.cache.key.get({key: cacheKey});
            if (cached) return JSON.parse(cached);

            const user = await this.User.findById(userId)
                .select('-password')
                .populate('schoolId', 'name code');

            if (!user) {
                throw new Error('User not found');
            }

            if (__user.role !== 'superadmin' && 
                user.schoolId?._id.toString() !== __user.schoolId?.toString()) {
                throw new Error('Access denied');
            }

            await this.cache.key.set({ key: cacheKey, ttl: 300, data: JSON.stringify(user)});

            return user;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Update User (Admin only)
     */
    async updateUser({__shark, __user, params, data: value }) {
        try {
            const userId = params.id;

            const { error } = UserManager.validationSchemas.updateUser.validate(value);
            if (error) {
                throw new Error(`Validation error: ${error.message}`);
            }
            
            const user = await this.User.findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }
            this.permissions.checkWithScope(__user, 'users', 'update', user.schoolId)

            if (__user.role !== 'superadmin' && 
                user.schoolId?.toString() !== __user.schoolId?.toString()) {
                throw new Error('Access denied');
            }

            if (value.role) user.role = value.role;
            if (value.profile) user.profile = { ...user.profile, ...value.profile };
            if (value.status) user.status = value.status;
            if (value.permissions) user.permissions = value.permissions;

            await user.save();

            await this.cache.key.delete({key: `user:${userId}`});
            await this.cache.key.delete({key: 'users:list:*'});

            await this._emit('updated', {
                userId: user._id,
                updatedBy: __user.id,
                changes: Object.keys(value),
                timestamp: new Date()
            });

            user.password = undefined;

            return user;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Delete User (Soft delete - Admin only)
     */
    async deleteUser({__shark, __user, params}) {
        try {
            const userId = params.id;

            this.permissions.check(__user, 'users', 'delete')

            const user = await this.User.findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            if (__user.role !== 'superadmin' && 
                user.schoolId?.toString() !== __user.schoolId?.toString()) {
                throw new Error('Access denied');
            }

            if (user._id.toString() === __user.id) {
                throw new Error('Cannot delete your own account');
            }

            user.deletedAt = new Date();
            user.status = 'inactive';
            await user.save();

            await this.cache.key.delete({ key: `user:${userId}`});
            await this.cache.key.delete({ key: 'users:list:*'});

            await this._emit('deleted', {
                userId: user._id,
                deletedBy: __user.id,
                timestamp: new Date()
            });

            return { message: 'User deleted successfully' };

        } catch (error) {
            throw error;
        }
    }

    /**
     * Assign Role to User
     */
    async assignRole({__shark, __user, params, data: value }) {
        try {
            const userId = params.id;

            this.permissions.check(__user, 'users', 'assign_role')

            const { error } = UserManager.validationSchemas.assignRole.validate(value);
            if (error) {
                throw new Error(`Validation error: ${error.message}`);
            }

            const user = await this.User.findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            if (__user.role !== 'superadmin' && 
                user.schoolId?.toString() !== __user.schoolId?.toString()) {
                throw new Error('Access denied');
            }

            user.role = value.role;
            
            if (value.schoolId) {
                const school = await this.mongomodels.School.findById(value.schoolId);
                if (!school) {
                    throw new Error('School not found');
                }
                user.schoolId = value.schoolId;
            }

            user.permissions = this._getDefaultPermissions(value.role);

            await user.save();

            await this.cache.key.delete({ key: `user:${userId}`});

            await this._emit('roleChanged', {
                userId: user._id,
                newRole: value.role,
                updatedBy: __user.id,
                timestamp: new Date()
            });

            user.password = undefined;

            return user;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Helper: Generate tokens
     */
    async _generateTokens(user, rememberMe = false) {
        const tokenExpiry = rememberMe ? '30d' : '24h';
        const refreshTokenExpiry = rememberMe ? '60d' : '7d';

        const accessToken = this.tokenManager.genShortToken({
            userId: user._id,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId,
            tokenType: 'short'
        }, tokenExpiry);

        const refreshToken = this.tokenManager.genLongToken({
            userId: user._id,
            tokenType: 'long'
        }, refreshTokenExpiry);

        return {
            accessToken,
            refreshToken,
            expiresIn: rememberMe ? 2592000 : 86400
        };
    }

    /**
     * Helper: Get default permissions for role
     */
    _getDefaultPermissions(role) {
        const permissions = {
            superadmin: [
                'manage_schools',
                'manage_users',
                'manage_classrooms',
                'manage_students',
                'manage_teachers',
                'view_reports',
                'system_config',
                'assign_role'
            ],
            school_admin: [
                'manage_classrooms',
                'manage_students',
                'manage_teachers',
                'view_reports',
                'assign_role'
            ],
            teacher: [
                'view_students',
                'manage_attendance',
                'manage_grades',
                'view_reports'
            ],
            student: [
                'view_profile',
                'view_grades'
            ]
        };

        return permissions[role] || [];
    }

    /**
     * Legacy method for backward compatibility
     */
    async createUser({ username, email, password }) {
        return this.register(null, null, {
            profile: {
                firstName: username || email.split('@')[0],
                lastName: ''
            },
            email,
            password,
            confirmPassword: password,
            role: 'school_admin'
        });
    }
}