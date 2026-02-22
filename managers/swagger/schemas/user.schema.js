module.exports = {
    UserRegister: {
        type: 'object',
        required: ['email', 'password', 'confirmPassword', 'profile'],
        properties: {
            email: { type: 'string', format: 'email', example: 'admin@school.com' },
            password: { type: 'string', format: 'password', example: 'Test@1234' },
            confirmPassword: { type: 'string', format: 'password', example: 'Test@1234' },
            role: { type: 'string', enum: ['superadmin', 'school_admin', 'teacher', 'student'], default: 'school_admin' },
            schoolCode: { type: 'string', example: 'SES-001' },
            profile: {
                type: 'object',
                required: ['firstName', 'lastName'],
                properties: {
                    firstName: { type: 'string', example: 'John' },
                    lastName: { type: 'string', example: 'Doe' },
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
            rememberMe: { type: 'boolean', default: false }
        }
    },
    UserProfileUpdate: {
        type: 'object',
        properties: {
            email: { type: 'string', format: 'email' },
            profile: {
                type: 'object',
                properties: {
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
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
            newPassword: { type: 'string', format: 'password' },
            confirmPassword: { type: 'string', format: 'password' }
        }
    },
    AssignRole: {
        type: 'object',
        required: ['role'],
        properties: {
            role: { type: 'string', enum: ['school_admin', 'teacher', 'student'] },
            schoolId: { type: 'string' }
        }
    }
};