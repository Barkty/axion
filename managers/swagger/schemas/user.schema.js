module.exports = {
    // ─── Request Body Schemas ────────────────────────────────────────────────────

    UserRegister: {
        type: 'object',
        required: ['email', 'password', 'confirmPassword', 'profile'],
        properties: {
            email: { type: 'string', format: 'email', example: 'admin@school.com' },
            password: { type: 'string', format: 'password', example: 'Test@1234', minLength: 8, maxLength: 50, description: 'Must contain uppercase, lowercase, digit, and special character' },
            confirmPassword: { type: 'string', format: 'password', example: 'Test@1234' },
            role: { type: 'string', enum: ['superadmin', 'school_admin', 'teacher', 'student'], default: 'school_admin' },
            schoolCode: { type: 'string', example: 'SES-001', description: 'Required when role is school_admin' },
            profile: {
                type: 'object',
                required: ['firstName', 'lastName'],
                properties: {
                    firstName: { type: 'string', example: 'John', minLength: 2, maxLength: 50 },
                    lastName: { type: 'string', example: 'Doe', minLength: 2, maxLength: 50 },
                    phone: { type: 'string', example: '+1-555-123-4567' }
                }
            }
        }
    },

    UserLogin: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
            email: { type: 'string', format: 'email', example: 'admin@school.com' },
            password: { type: 'string', format: 'password', example: 'Test@1234' },
            rememberMe: { type: 'boolean', default: false, description: 'Extends token expiry to 30d access / 60d refresh' }
        }
    },

    UserRefreshToken: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
            refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
        }
    },

    UserProfileUpdate: {
        type: 'object',
        minProperties: 1,
        properties: {
            email: { type: 'string', format: 'email' },
            profile: {
                type: 'object',
                properties: {
                    firstName: { type: 'string', minLength: 2, maxLength: 50 },
                    lastName: { type: 'string', minLength: 2, maxLength: 50 },
                    phone: { type: 'string' },
                    avatar: { type: 'string', format: 'uri' }
                }
            }
        }
    },

    ChangePassword: {
        type: 'object',
        required: ['currentPassword', 'newPassword', 'confirmPassword'],
        properties: {
            currentPassword: { type: 'string', format: 'password' },
            newPassword: { type: 'string', format: 'password', minLength: 8, maxLength: 50 },
            confirmPassword: { type: 'string', format: 'password' }
        }
    },

    UserUpdateUser: {
        type: 'object',
        minProperties: 1,
        properties: {
            role: { type: 'string', enum: ['superadmin', 'school_admin', 'teacher', 'student'] },
            status: { type: 'string', enum: ['active', 'inactive', 'locked'] },
            permissions: { type: 'array', items: { type: 'string' }, example: ['view_students', 'manage_grades'] },
            profile: {
                type: 'object',
                properties: {
                    firstName: { type: 'string', minLength: 2, maxLength: 50 },
                    lastName: { type: 'string', minLength: 2, maxLength: 50 },
                    phone: { type: 'string' },
                    avatar: { type: 'string', format: 'uri' }
                }
            }
        }
    },

    AssignRole: {
        type: 'object',
        required: ['role', 'schoolId'],
        properties: {
            role: { type: 'string', enum: ['school_admin', 'teacher', 'student'] },
            schoolId: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d1', description: 'Required for all roles' }
        }
    },

    // ─── Response Schemas ────────────────────────────────────────────────────────

    UserProfile: {
        type: 'object',
        properties: {
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            phone: { type: 'string', example: '+1-555-123-4567' },
            avatar: { type: 'string', format: 'uri', example: 'https://cdn.example.com/avatar.jpg' }
        }
    },

    SchoolRef: {
        type: 'object',
        properties: {
            _id: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d1' },
            name: { type: 'string', example: 'Sunrise Elementary School' },
            code: { type: 'string', example: 'SES-001' }
        }
    },

    UserObject: {
        type: 'object',
        properties: {
            _id: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d1' },
            email: { type: 'string', format: 'email', example: 'admin@school.com' },
            role: { type: 'string', enum: ['superadmin', 'school_admin', 'teacher', 'student'] },
            status: { type: 'string', enum: ['active', 'inactive', 'locked'] },
            profile: { $ref: '#/components/schemas/UserProfile' },
            schoolId: { $ref: '#/components/schemas/SchoolRef' },
            permissions: { type: 'array', items: { type: 'string' }, example: ['manage_classrooms', 'view_reports'] },
            lastLogin: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
        }
    },

    AuthTokens: {
        type: 'object',
        properties: {
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            expiresIn: { type: 'integer', example: 86400, description: 'Seconds until access token expiry (86400 = 24h, 2592000 = 30d)' }
        }
    },

    AuthResponse: {
        type: 'object',
        properties: {
            user: { $ref: '#/components/schemas/UserObject' },
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            expiresIn: { type: 'integer', example: 86400 }
        }
    },

    PaginatedUsers: {
        type: 'object',
        properties: {
            data: {
                type: 'array',
                items: { $ref: '#/components/schemas/UserObject' }
            },
            pagination: {
                type: 'object',
                properties: {
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 20 },
                    total: { type: 'integer', example: 150 },
                    pages: { type: 'integer', example: 8 }
                }
            }
        }
    },

    MessageResponse: {
        type: 'object',
        properties: {
            message: { type: 'string', example: 'Operation completed successfully' }
        }
    },

    ErrorResponse: {
        type: 'object',
        properties: {
            error: { type: 'string', example: 'Validation error: email is required' }
        }
    }
};