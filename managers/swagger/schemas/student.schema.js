module.exports = {
    // ─── Request Body Schemas ────────────────────────────────────────────────────

    StudentCreate: {
        type: 'object',
        required: ['schoolId', 'classroomId', 'admissionNumber', 'personalInfo', 'contactInfo', 'parentInfo'],
        properties: {
            schoolId: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d1' },
            classroomId: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d2' },
            admissionNumber: { type: 'string', pattern: '^[A-Z0-9-]+$', example: 'ADM-2024-001', description: 'Uppercase letters, digits, and hyphens only' },
            personalInfo: {
                type: 'object',
                required: ['firstName', 'lastName', 'dateOfBirth', 'gender'],
                properties: {
                    firstName: { type: 'string', minLength: 2, maxLength: 50, example: 'Jane' },
                    lastName: { type: 'string', minLength: 2, maxLength: 50, example: 'Doe' },
                    dateOfBirth: { type: 'string', format: 'date', example: '2010-05-14' },
                    gender: { type: 'string', enum: ['male', 'female', 'other'] },
                    bloodGroup: { type: 'string', enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
                    nationality: { type: 'string', example: 'American' }
                }
            },
            contactInfo: {
                type: 'object',
                required: ['address', 'phone'],
                properties: {
                    address: { type: 'string', example: '123 Elm Street, Springfield' },
                    phone: { type: 'string', example: '+1-555-123-4567' },
                    email: { type: 'string', format: 'email', example: 'jane.doe@email.com' },
                    emergencyContact: {
                        type: 'object',
                        required: ['name', 'relationship', 'phone'],
                        properties: {
                            name: { type: 'string', example: 'John Doe' },
                            relationship: { type: 'string', example: 'Father' },
                            phone: { type: 'string', example: '+1-555-987-6543' }
                        }
                    }
                }
            },
            parentInfo: {
                type: 'array',
                minItems: 1,
                items: {
                    type: 'object',
                    required: ['name', 'relationship', 'phone'],
                    properties: {
                        name: { type: 'string', example: 'John Doe' },
                        relationship: { type: 'string', example: 'Father' },
                        phone: { type: 'string', example: '+1-555-987-6543' },
                        email: { type: 'string', format: 'email' },
                        isPrimary: { type: 'boolean', default: false }
                    }
                }
            },
            academicInfo: {
                type: 'object',
                properties: {
                    rollNumber: { type: 'string', example: 'R-042' },
                    stream: { type: 'string', enum: ['science', 'commerce', 'arts'] },
                    electives: { type: 'array', items: { type: 'string' }, example: ['Music', 'Drama'] }
                }
            }
        }
    },

    StudentUpdateStudent: {
        type: 'object',
        minProperties: 1,
        properties: {
            classroomId: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d3' },
            personalInfo: {
                type: 'object',
                properties: {
                    firstName: { type: 'string', minLength: 2, maxLength: 50 },
                    lastName: { type: 'string', minLength: 2, maxLength: 50 },
                    bloodGroup: { type: 'string', enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
                    nationality: { type: 'string' }
                }
            },
            contactInfo: {
                type: 'object',
                properties: {
                    address: { type: 'string' },
                    phone: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    emergencyContact: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            relationship: { type: 'string' },
                            phone: { type: 'string' }
                        }
                    }
                }
            },
            parentInfo: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        relationship: { type: 'string' },
                        phone: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        isPrimary: { type: 'boolean' }
                    }
                }
            },
            academicInfo: {
                type: 'object',
                properties: {
                    rollNumber: { type: 'string' },
                    stream: { type: 'string', enum: ['science', 'commerce', 'arts'] },
                    electives: { type: 'array', items: { type: 'string' } }
                }
            },
            enrollment: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['enrolled', 'transferred', 'graduated', 'suspended'] }
                }
            }
        }
    },

    StudentTransfer: {
        type: 'object',
        required: ['toSchoolId', 'toClassroomId', 'reason'],
        properties: {
            toSchoolId: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d4', description: 'Destination school ID' },
            toClassroomId: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d5', description: 'Destination classroom ID — must belong to toSchoolId' },
            reason: { type: 'string', example: 'Family relocation' }
        }
    },

    // ─── Response Schemas ────────────────────────────────────────────────────────

    StudentEnrollment: {
        type: 'object',
        properties: {
            date: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['enrolled', 'transferred', 'graduated', 'suspended'] },
            previousSchool: { type: 'string', description: 'School ID of previous school if transferred' },
            notes: { type: 'string', example: 'Transferred from SES-001 to SES-002' }
        }
    },

    StudentObject: {
        type: 'object',
        properties: {
            _id: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d6' },
            admissionNumber: { type: 'string', example: 'ADM-2024-001' },
            schoolId: { $ref: '#/components/schemas/SchoolRef' },
            classroomId: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    name: { type: 'string', example: 'Grade 5 - Section A' },
                    code: { type: 'string', example: 'G5A' },
                    grade: { type: 'string', example: '5' }
                }
            },
            personalInfo: {
                type: 'object',
                properties: {
                    firstName: { type: 'string', example: 'Jane' },
                    lastName: { type: 'string', example: 'Doe' },
                    dateOfBirth: { type: 'string', format: 'date' },
                    gender: { type: 'string', enum: ['male', 'female', 'other'] },
                    bloodGroup: { type: 'string', example: 'O+' },
                    nationality: { type: 'string', example: 'American' }
                }
            },
            contactInfo: {
                type: 'object',
                properties: {
                    address: { type: 'string' },
                    phone: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    emergencyContact: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            relationship: { type: 'string' },
                            phone: { type: 'string' }
                        }
                    }
                }
            },
            parentInfo: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        relationship: { type: 'string' },
                        phone: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        isPrimary: { type: 'boolean' }
                    }
                }
            },
            academicInfo: {
                type: 'object',
                properties: {
                    rollNumber: { type: 'string' },
                    stream: { type: 'string', enum: ['science', 'commerce', 'arts'] },
                    electives: { type: 'array', items: { type: 'string' } }
                }
            },
            enrollment: { $ref: '#/components/schemas/StudentEnrollment' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
        }
    },

    TransferRecord: {
        type: 'object',
        properties: {
            _id: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d7' },
            studentId: { type: 'string', example: '64a1f2b3c4d5e6f7a8b9c0d6' },
            fromSchoolId: { $ref: '#/components/schemas/SchoolRef' },
            toSchoolId: { $ref: '#/components/schemas/SchoolRef' },
            fromClassroomId: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    name: { type: 'string' },
                    code: { type: 'string' }
                }
            },
            toClassroomId: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    name: { type: 'string' },
                    code: { type: 'string' }
                }
            },
            approvedBy: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    profile: {
                        type: 'object',
                        properties: {
                            firstName: { type: 'string' },
                            lastName: { type: 'string' }
                        }
                    }
                }
            },
            transferDate: { type: 'string', format: 'date-time' },
            reason: { type: 'string', example: 'Family relocation' },
            status: { type: 'string', enum: ['completed', 'pending', 'rejected'], example: 'completed' }
        }
    },

    TransferResponse: {
        type: 'object',
        properties: {
            message: { type: 'string', example: 'Student transferred successfully' },
            transfer: { $ref: '#/components/schemas/TransferRecord' }
        }
    },

    PaginatedStudents: {
        type: 'object',
        properties: {
            data: {
                type: 'array',
                items: { $ref: '#/components/schemas/StudentObject' }
            },
            pagination: {
                type: 'object',
                properties: {
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 20 },
                    total: { type: 'integer', example: 200 },
                    pages: { type: 'integer', example: 10 }
                }
            }
        }
    }
};