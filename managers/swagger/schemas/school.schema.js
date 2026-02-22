module.exports = {
    SchoolCreate: {
        type: 'object',
        required: ['name', 'code', 'address'],
        properties: {
            name: { type: 'string', example: 'Springfield Elementary School' },
            code: { type: 'string', example: 'SES-001' },
            address: {
                type: 'object',
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
                    maxClassrooms: { type: 'integer', example: 50 },
                    maxStudentsPerClass: { type: 'integer', example: 30 },
                    academicYear: { type: 'string', example: '2024-2025' }
                }
            }
        }
    },
    SchoolUpdate: {
        type: 'object',
        properties: {
            name: { type: 'string', example: 'Updated School Name' },
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
                    phone: { type: 'string' }
                }
            },
            status: { type: 'string', enum: ['active', 'inactive', 'suspended'] }
        }
    }
};