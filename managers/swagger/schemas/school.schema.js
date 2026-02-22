module.exports = {
    // ─── Request Body Schemas ────────────────────────────────────────────────────

    SchoolCreate: {
        type: 'object',
        required: ['name', 'code', 'address'],
        properties: {
            name: { type: 'string', minLength: 3, maxLength: 100, example: 'Springfield Elementary School' },
            code: { type: 'string', pattern: '^[A-Z0-9-]+$', example: 'SES-001', description: 'Uppercase letters, digits, and hyphens only' },
            address: {
                type: 'object',
                required: ['street', 'city', 'state', 'zipCode', 'country'],
                properties: {
                    street: { type: 'string', example: '123 Main St' },
                    city: { type: 'string', example: 'Springfield' },
                    state: { type: 'string', example: 'IL' },
                    zipCode: { type: 'string', example: '62701' },
                    country: { type: 'string', example: 'USA' }
                }
            },
            contact: {
                type: 'object',
                properties: {
                    email: { type: 'string', format: 'email', example: 'info@school.edu' },
                    phone: { type: 'string', example: '+1-555-123-4567' },
                    website: { type: 'string', format: 'uri', example: 'https://school.edu' }
                }
            },
            settings: {
                type: 'object',
                properties: {
                    maxClassrooms: { type: 'integer', minimum: 1, maximum: 1000, example: 50 },
                    maxStudentsPerClass: { type: 'integer', minimum: 1, maximum: 100, example: 30 },
                    academicYear: { type: 'string', pattern: '^\\d{4}-\\d{4}$', example: '2024-2025' }
                }
            }
        }
    },

    SchoolUpdate: {
        type: 'object',
        minProperties: 1,
        properties: {
            name: { type: 'string', minLength: 3, maxLength: 100, example: 'Updated School Name' },
            address: {
                type: 'object',
                properties: {
                    street: { type: 'string' },
                    city: { type: 'string' },
                    state: { type: 'string' },
                    zipCode: { type: 'string' },
                    country: { type: 'string' }
                }
            },
            contact: {
                type: 'object',
                properties: {
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    website: { type: 'string', format: 'uri' }
                }
            },
            settings: {
                type: 'object',
                properties: {
                    maxClassrooms: { type: 'integer', minimum: 1, maximum: 1000 },
                    maxStudentsPerClass: { type: 'integer', minimum: 1, maximum: 100 },
                    academicYear: { type: 'string', pattern: '^\\d{4}-\\d{4}$', example: '2025-2026' }
                }
            },
            status: { type: 'string', enum: ['active', 'inactive', 'suspended'] }
        }
    },

    // ─── Response Schemas ────────────────────────────────────────────────────────

    SchoolAddress: {
        type: 'object',
        properties: {
            street: { type: 'string', example: '123 Main St' },
            city: { type: 'string', example: 'Springfield' },
            state: { type: 'string', example: 'IL' },
            zipCode: { type: 'string', example: '62701' },
            country: { type: 'string', example: 'USA' }
        }
    },

    SchoolContact: {
        type: 'object',
        properties: {
            email: { type: 'string', format: 'email', example: 'info@school.edu' },
            phone: { type: 'string', example: '+1-555-123-4567' },
            website: { type: 'string', format: 'uri', example: 'https://school.edu' }
        }
    },

    SchoolSettings: {
        type: 'object',
        properties: {
            maxClassrooms: { type: 'integer', example: 50 },
            maxStudentsPerClass: { type: 'integer', example: 30 },
            academicYear: { type: 'string', example: '2024-2025' }
        }
    },

    SchoolObject: {
        type: 'object',
        properties: {
            _id: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d1' },
            name: { type: 'string', example: 'Springfield Elementary School' },
            code: { type: 'string', example: 'SES-001' },
            status: { type: 'string', enum: ['active', 'inactive', 'suspended'], example: 'active' },
            address: { $ref: '#/components/schemas/SchoolAddress' },
            contact: { $ref: '#/components/schemas/SchoolContact' },
            settings: { $ref: '#/components/schemas/SchoolSettings' },
            createdBy: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d2', description: 'User ID of creator' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
        }
    },

    SchoolStats: {
        type: 'object',
        properties: {
            totalClassrooms: { type: 'integer', example: 24 },
            activeClassrooms: { type: 'integer', example: 20 },
            totalStudents: { type: 'integer', example: 480 },
            enrolledStudents: { type: 'integer', example: 455 },
            totalStaff: { type: 'integer', example: 35 },
            classroomUtilization: { type: 'number', format: 'float', example: 78.5, description: 'Average classroom fill rate as a percentage' }
        }
    },

    PaginatedSchools: {
        type: 'object',
        properties: {
            data: {
                type: 'array',
                items: { $ref: '#/components/schemas/SchoolObject' }
            },
            pagination: {
                type: 'object',
                properties: {
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 20 },
                    total: { type: 'integer', example: 42 },
                    pages: { type: 'integer', example: 3 }
                }
            }
        }
    }
};