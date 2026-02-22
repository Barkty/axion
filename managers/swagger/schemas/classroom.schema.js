module.exports = {
    // ─── Request Body Schemas ────────────────────────────────────────────────────

    ClassroomCreate: {
        type: 'object',
        required: ['schoolId', 'name', 'code', 'grade', 'capacity'],
        properties: {
            schoolId: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d1' },
            name: { type: 'string', minLength: 2, maxLength: 50, example: 'Grade 5 - Section A' },
            code: { type: 'string', pattern: '^[A-Z0-9-]+$', example: 'G5A', description: 'Uppercase letters, digits, and hyphens only. Must be unique within the school.' },
            grade: { type: 'integer', minimum: 1, maximum: 12, example: 5 },
            section: { type: 'string', maxLength: 5, example: 'A' },
            capacity: { type: 'integer', minimum: 1, maximum: 100, example: 30 },
            resources: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['type'],
                    properties: {
                        type: { type: 'string', example: 'Projector' },
                        quantity: { type: 'integer', minimum: 1, default: 1, example: 2 }
                    }
                }
            },
            academicYear: { type: 'string', pattern: '^\\d{4}-\\d{4}$', example: '2024-2025', description: 'Defaults to current academic year if omitted' }
        }
    },

    ClassroomUpdate: {
        type: 'object',
        minProperties: 1,
        properties: {
            name: { type: 'string', minLength: 2, maxLength: 50, example: 'Grade 5 - Section B' },
            capacity: { type: 'integer', minimum: 1, maximum: 100, example: 35, description: 'Cannot be reduced below current enrollment count' },
            resources: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', example: 'Whiteboard' },
                        quantity: { type: 'integer', minimum: 1, example: 1 }
                    }
                }
            },
            status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] }
        }
    },

    AssignTeacher: {
        type: 'object',
        required: ['teacherId'],
        properties: {
            teacherId: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d9', description: 'Must be an active teacher belonging to the same school as the classroom' }
        }
    },

    // ─── Response Schemas ────────────────────────────────────────────────────────

    ClassroomResource: {
        type: 'object',
        properties: {
            type: { type: 'string', example: 'Projector' },
            quantity: { type: 'integer', example: 2 }
        }
    },

    TeacherRef: {
        type: 'object',
        properties: {
            _id: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d9' },
            email: { type: 'string', format: 'email', example: 'teacher@school.edu' },
            profile: {
                type: 'object',
                properties: {
                    firstName: { type: 'string', example: 'Alice' },
                    lastName: { type: 'string', example: 'Smith' }
                }
            }
        }
    },

    ClassroomObject: {
        type: 'object',
        properties: {
            _id: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d2' },
            name: { type: 'string', example: 'Grade 5 - Section A' },
            code: { type: 'string', example: 'G5A' },
            grade: { type: 'integer', example: 5 },
            section: { type: 'string', example: 'A' },
            capacity: { type: 'integer', example: 30 },
            currentEnrollment: { type: 'integer', example: 24, description: 'Live count of enrolled students' },
            status: { type: 'string', enum: ['active', 'inactive', 'maintenance'], example: 'active' },
            academicYear: { type: 'string', example: '2024-2025' },
            schoolId: { $ref: '#/components/schemas/SchoolRef' },
            teacherId: { $ref: '#/components/schemas/TeacherRef' },
            resources: {
                type: 'array',
                items: { $ref: '#/components/schemas/ClassroomResource' }
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
        }
    },

    AssignTeacherResponse: {
        type: 'object',
        properties: {
            message: { type: 'string', example: 'Teacher assigned successfully' },
            classroom: { $ref: '#/components/schemas/ClassroomObject' }
        }
    },

    ClassroomStudentItem: {
        type: 'object',
        description: 'Lightweight student projection returned by getStudents — only identity, contact, and enrollment fields',
        properties: {
            _id: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d6' },
            admissionNumber: { type: 'string', example: 'ADM-2024-001' },
            personalInfo: {
                type: 'object',
                properties: {
                    firstName: { type: 'string', example: 'Jane' },
                    lastName: { type: 'string', example: 'Doe' },
                    dateOfBirth: { type: 'string', format: 'date' },
                    gender: { type: 'string', enum: ['male', 'female', 'other'] }
                }
            },
            contactInfo: {
                type: 'object',
                properties: {
                    address: { type: 'string' },
                    phone: { type: 'string' },
                    email: { type: 'string', format: 'email' }
                }
            },
            enrollment: { $ref: '#/components/schemas/StudentEnrollment' }
        }
    },

    PaginatedClassrooms: {
        type: 'object',
        properties: {
            data: {
                type: 'array',
                items: { $ref: '#/components/schemas/ClassroomObject' }
            },
            pagination: {
                type: 'object',
                properties: {
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 20 },
                    total: { type: 'integer', example: 48 },
                    pages: { type: 'integer', example: 3 }
                }
            }
        }
    },

    PaginatedClassroomStudents: {
        type: 'object',
        properties: {
            data: {
                type: 'array',
                items: { $ref: '#/components/schemas/ClassroomStudentItem' }
            },
            pagination: {
                type: 'object',
                properties: {
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 20 },
                    total: { type: 'integer', example: 24 },
                    pages: { type: 'integer', example: 2 }
                }
            }
        }
    }
};