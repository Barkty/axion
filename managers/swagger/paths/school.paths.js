module.exports = {
    '/api/school/create': {
        post: {
            tags: ['Schools'],
            summary: 'Create a new school',
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/SchoolCreate' }
                    }
                }
            },
            responses: {
                200: {
                    description: 'School created successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    ok: { type: 'boolean', example: true },
                                    data: { $ref: '#/components/schemas/School' }
                                }
                            }
                        }
                    }
                },
                400: { $ref: '#/components/responses/ValidationError' },
                401: { $ref: '#/components/responses/UnauthorizedError' },
                403: { $ref: '#/components/responses/ForbiddenError' }
            }
        }
    },
    '/api/school/list': {
        get: {
            tags: ['Schools'],
            summary: 'List all schools',
            security: [{ bearerAuth: [] }],
            parameters: [
                { $ref: '#/components/parameters/pageParam' },
                { $ref: '#/components/parameters/limitParam' },
                { $ref: '#/components/parameters/searchParam' },
                {
                    in: 'query',
                    name: 'status',
                    schema: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
                    description: 'Filter by status'
                }
            ],
            responses: {
                200: {
                    description: 'List of schools',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    ok: { type: 'boolean', example: true },
                                    data: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/School' }
                                    },
                                    pagination: {
                                        type: 'object',
                                        properties: {
                                            page: { type: 'integer', example: 1 },
                                            limit: { type: 'integer', example: 20 },
                                            total: { type: 'integer', example: 100 },
                                            pages: { type: 'integer', example: 5 }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                401: { $ref: '#/components/responses/UnauthorizedError' },
                403: { $ref: '#/components/responses/ForbiddenError' }
            }
        }
    },
    '/api/school/get/{id}': {
        get: {
            tags: ['Schools'],
            summary: 'Get school by ID',
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    in: 'path',
                    name: 'id',
                    required: true,
                    schema: { type: 'string' },
                    description: 'School ID'
                }
            ],
            responses: {
                200: {
                    description: 'School details',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    ok: { type: 'boolean', example: true },
                                    data: { $ref: '#/components/schemas/School' }
                                }
                            }
                        }
                    }
                },
                404: { description: 'School not found' },
                401: { $ref: '#/components/responses/UnauthorizedError' },
                403: { $ref: '#/components/responses/ForbiddenError' }
            }
        }
    },
    '/api/school/update/{id}': {
        put: {
            tags: ['Schools'],
            summary: 'Update school',
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    in: 'path',
                    name: 'id',
                    required: true,
                    schema: { type: 'string' },
                    description: 'School ID'
                }
            ],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/SchoolUpdate' }
                    }
                }
            },
            responses: {
                200: {
                    description: 'School updated successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    ok: { type: 'boolean', example: true },
                                    data: { $ref: '#/components/schemas/School' }
                                }
                            }
                        }
                    }
                },
                400: { $ref: '#/components/responses/ValidationError' },
                401: { $ref: '#/components/responses/UnauthorizedError' },
                403: { $ref: '#/components/responses/ForbiddenError' },
                404: { description: 'School not found' }
            }
        }
    },
    '/api/school/delete/{id}': {
        delete: {
            tags: ['Schools'],
            summary: 'Delete school',
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    in: 'path',
                    name: 'id',
                    required: true,
                    schema: { type: 'string' },
                    description: 'School ID'
                }
            ],
            responses: {
                200: {
                    description: 'School deleted successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    ok: { type: 'boolean', example: true },
                                    message: { type: 'string', example: 'School deleted successfully' }
                                }
                            }
                        }
                    }
                },
                401: { $ref: '#/components/responses/UnauthorizedError' },
                403: { $ref: '#/components/responses/ForbiddenError' },
                404: { description: 'School not found' }
            }
        }
    },
    '/api/school/getStats/{id}': {
        get: {
            tags: ['Schools'],
            summary: 'Get school statistics',
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    in: 'path',
                    name: 'id',
                    required: true,
                    schema: { type: 'string' },
                    description: 'School ID'
                }
            ],
            responses: {
                200: {
                    description: 'School statistics',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    ok: { type: 'boolean', example: true },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            totalClassrooms: { type: 'integer', example: 25 },
                                            activeClassrooms: { type: 'integer', example: 20 },
                                            totalStudents: { type: 'integer', example: 450 },
                                            enrolledStudents: { type: 'integer', example: 440 },
                                            totalStaff: { type: 'integer', example: 35 },
                                            classroomUtilization: { type: 'number', example: 85.5 }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                401: { $ref: '#/components/responses/UnauthorizedError' },
                403: { $ref: '#/components/responses/ForbiddenError' },
                404: { description: 'School not found' }
            }
        }
    }
};