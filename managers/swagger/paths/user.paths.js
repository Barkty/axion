module.exports = {
    '/api/user/register': {
        post: {
            tags: ['Users'],
            summary: 'Register a new user',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/UserRegister' }
                    }
                }
            },
            responses: {
                200: {
                    description: 'User registered successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    ok: { type: 'boolean', example: true },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            user: { $ref: '#/components/schemas/User' },
                                            accessToken: { type: 'string' },
                                            refreshToken: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                400: { $ref: '#/components/responses/ValidationError' }
            }
        }
    },
    '/api/user/login': {
        post: {
            tags: ['Users'],
            summary: 'User login',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/UserLogin' }
                    }
                }
            },
            responses: {
                200: {
                    description: 'Login successful',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    ok: { type: 'boolean', example: true },
                                    data: {
                                        type: 'object',
                                        properties: {
                                            user: { $ref: '#/components/schemas/User' },
                                            accessToken: { type: 'string' },
                                            refreshToken: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                400: { $ref: '#/components/responses/ValidationError' },
                401: { description: 'Invalid credentials' }
            }
        }
    },
    '/api/user/getProfile': {
        get: {
            tags: ['Users'],
            summary: 'Get current user profile',
            security: [{ bearerAuth: [] }],
            responses: {
                200: {
                    description: 'User profile',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    ok: { type: 'boolean', example: true },
                                    data: { $ref: '#/components/schemas/User' }
                                }
                            }
                        }
                    }
                },
                401: { $ref: '#/components/responses/UnauthorizedError' }
            }
        }
    }
    // Add other user endpoints similarly...
};