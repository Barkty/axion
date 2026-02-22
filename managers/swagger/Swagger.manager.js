const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const fs = require('fs');

module.exports = class SwaggerManager {
    
    static httpExposed = [
        'getJson=get',
        'getUi=get',
        'json=get',
        'ui=get'
    ];

    constructor(injectable) {
        this.config = injectable.config;
        this.cache = injectable.cache;
        this.cortex = injectable.cortex;
        this.managers = injectable.managers;
        this.logger = injectable.managers.logger;
        
        this.specs = null;
        
        this.logger.info('📚 SwaggerManager initialized');
        this.httpExposed = SwaggerManager.httpExposed;
    }

    /**
     * Build Swagger specification from all managers
     */
    buildSpecs() {
        this.logger.info('🔨 Building Swagger specs...');
        
        const swaggerDefinition = {
            openapi: '3.0.0',
            info: {
                title: this.config.dotEnv.SERVICE_NAME || 'School Management API',
                version: process.env.npm_package_version || '1.0.0',
                description: 'RESTful API for School Management System',
                contact: {
                    name: 'API Support',
                    email: this.config.dotEnv.SUPPORT_EMAIL || 'support@school.com'
                },
                license: {
                    name: 'MIT',
                    url: 'https://opensource.org/licenses/MIT'
                }
            },
            servers: [
                {
                    url: `http://localhost:${this.config.dotEnv.USER_PORT || 3000}`,
                    description: 'Development server'
                },
                {
                    url: this.config.dotEnv.PROD_URL,
                    description: 'Production server'
                }
            ],
            tags: this._generateTags(),
            paths: this._generatePaths(),
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                        description: 'Enter JWT token'
                    }
                },
                schemas: this._loadSchemas(),
                parameters: {
                    pageParam: {
                        in: 'query',
                        name: 'page',
                        schema: { type: 'integer', default: 1, minimum: 1 },
                        description: 'Page number'
                    },
                    limitParam: {
                        in: 'query',
                        name: 'limit',
                        schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
                        description: 'Items per page'
                    },
                    searchParam: {
                        in: 'query',
                        name: 'search',
                        schema: { type: 'string' },
                        description: 'Search term'
                    }
                },
                responses: {
                    UnauthorizedError: {
                        description: 'Access token is missing or invalid',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        ok: { type: 'boolean', example: false },
                                        message: { type: 'string', example: 'Authentication required' }
                                    }
                                }
                            }
                        }
                    },
                    ForbiddenError: {
                        description: 'Insufficient permissions',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        ok: { type: 'boolean', example: false },
                                        message: { type: 'string', example: 'Access denied' }
                                    }
                                }
                            }
                        }
                    },
                    ValidationError: {
                        description: 'Validation failed',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        ok: { type: 'boolean', example: false },
                                        message: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    NotFoundError: {
                        description: 'Resource not found',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        ok: { type: 'boolean', example: false },
                                        message: { type: 'string', example: 'Resource not found' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        const options = {
            swaggerDefinition,
            apis: []
        };

        try {
            this.specs = swaggerDefinition;
        } catch (error) {
            this.logger.error('Failed to build Swagger specs:', error);
            // Fallback to a minimal valid spec
            this.specs = {
                openapi: '3.1.0',
                info: {
                    title: 'School Management API',
                    version: '1.0.0'
                },
                paths: {}
            };
        }
        
        return this.specs;
    }

    /**
     * Generate tags from available managers
     */
    _generateTags() {
        const tags = [];
        const tagMap = {
            school: { name: 'Schools', description: 'School management operations' },
            classroom: { name: 'Classrooms', description: 'Classroom management operations' },
            student: { name: 'Students', description: 'Student management operations' },
            user: { name: 'Users', description: 'User authentication and management' },
            logger: { name: 'Logs', description: 'Log management operations' }
        };

        Object.keys(tagMap).forEach(key => {
            if (this.managers[key]) {
                tags.push(tagMap[key]);
            }
        });

        return tags;
    }

    /**
     * Load all schemas from schema files
     */
    _loadSchemas() {
        const schemas = {};
        const schemaDir = path.join(__dirname, 'schemas');
        
        try {
            if (fs.existsSync(schemaDir)) {
                const files = fs.readdirSync(schemaDir);
                files.forEach(file => {
                    if (file.endsWith('.schema.js')) {
                        try {
                            const schemaModule = require(path.join(schemaDir, file));
                            Object.assign(schemas, schemaModule);
                            this.logger.info(`Loaded schema: ${file}`);
                        } catch (err) {
                            this.logger.error(`Failed to load schema ${file}:`, err.message);
                        }
                    }
                });
            }
        } catch (error) {
            this.logger.error('Error loading schemas:', error);
        }
        
        return schemas;
    }

    /**
     * Generate paths from all managers' httpExposed
     */
    _generatePaths() {
        const paths = {};
        
        Object.keys(this.managers).forEach(managerName => {
            const manager = this.managers[managerName];
            const exposed = manager.httpExposed || manager.constructor?.httpExposed;
            
            if (exposed && Array.isArray(exposed) && managerName !== 'swagger') {
                
                exposed.forEach(endpoint => {
                    try {
                        const [pathPattern, method] = endpoint.split('=');
                        
                        if (!method || !pathPattern) {
                            this.logger.warn(`Invalid endpoint format: ${endpoint}`);
                            return;
                        }
                        
                        // Handle path parameters
                        let fullPath = `/api/${managerName}/${pathPattern}`;
                        // Convert :param to {param} for OpenAPI
                        fullPath = fullPath.replace(/:([^/]+)/g, '{$1}');
                        
                        if (!paths[fullPath]) {
                            paths[fullPath] = {};
                        }
                        
                        paths[fullPath][method] = this._generateOperation(managerName, pathPattern);
                    } catch (err) {
                        this.logger.error(`Failed to generate path for ${endpoint}:`, err.message);
                    }
                });
            }
        });

        return paths;
    }

    /**
     * Generate operation details for an endpoint
     */
    _generateOperation(manager, fnName) {
        const [baseFn, param] = fnName.split('/');
        const requiresAuth = this._requiresAuth(manager, baseFn);
        const hasParams = param === ':id' || param === '{id}';
        
        const operation = {
            tags: [this._getTagForManager(manager)],
            summary: this._getSummaryForEndpoint(manager, baseFn),
            description: this._getDescriptionForEndpoint(manager, baseFn),
            parameters: this._getParametersForEndpoint(manager, baseFn, hasParams),
            responses: this._getResponsesForEndpoint(manager, baseFn),
            ...(requiresAuth && { security: [{ bearerAuth: [] }] })
        };

        // Add request body for create/update operations
        const requestBody = this._getRequestBodyForEndpoint(manager, baseFn);
        if (requestBody) {
            operation.requestBody = requestBody;
        }

        return operation;
    }

    /**
     * Get tag for manager
     */
    _getTagForManager(manager) {
        const tagMap = {
            school: 'Schools',
            classroom: 'Classrooms',
            student: 'Students',
            user: 'Users',
            logger: 'Logs'
        };
        return tagMap[manager] || manager.charAt(0).toUpperCase() + manager.slice(1);
    }

    /**
     * Get summary for endpoint
     */
    _getSummaryForEndpoint(manager, fnName) {
        const summaries = {
            school: {
                create: 'Create a new school',
                list: 'List all schools',
                get: 'Get school by ID',
                update: 'Update school',
                delete: 'Delete school',
                getStats: 'Get school statistics'
            },
            classroom: {
                create: 'Create a new classroom',
                list: 'List all classrooms',
                get: 'Get classroom by ID',
                update: 'Update classroom',
                delete: 'Delete classroom',
                assignTeacher: 'Assign teacher to classroom',
                getStudents: 'Get students in classroom'
            },
            student: {
                create: 'Create a new student',
                list: 'List all students',
                get: 'Get student by ID',
                update: 'Update student',
                delete: 'Delete student',
                transfer: 'Transfer student',
                getHistory: 'Get student transfer history'
            },
            user: {
                register: 'Register new user',
                login: 'User login',
                logout: 'User logout',
                refreshToken: 'Refresh access token',
                getProfile: 'Get user profile',
                updateProfile: 'Update user profile',
                changePassword: 'Change password',
                listUsers: 'List all users',
                getUser: 'Get user by ID',
                updateUser: 'Update user',
                deleteUser: 'Delete user',
                assignRole: 'Assign role to user'
            }
        };
        
        return summaries[manager]?.[fnName] || `${fnName} operation`;
    }

    /**
     * Get description for endpoint
     */
    _getDescriptionForEndpoint(manager, fnName) {
        const descriptions = {
            school: {
                create: 'Creates a new school. Requires superadmin privileges.',
                list: 'Returns a paginated list of schools. Filterable by status and search term.',
                get: 'Returns detailed information about a specific school.',
                update: 'Updates school information. Access depends on user role.',
                delete: 'Soft deletes a school. Cannot delete schools with active classrooms or students.',
                getStats: 'Returns statistical information about a school including classroom and student counts.'
            },
            user: {
                register: 'Registers a new user account. Public endpoint.',
                login: 'Authenticates a user and returns access tokens.',
                logout: 'Invalidates the current session token.',
                getProfile: 'Returns the profile of the currently authenticated user.'
            }
        };
        
        return descriptions[manager]?.[fnName] || `${manager} ${fnName} endpoint`;
    }

    /**
     * Get parameters for endpoint
     */
    _getParametersForEndpoint(manager, fnName, hasParams) {
        const params = [];
        
        // Add path parameters
        if (hasParams) {
            params.push({
                in: 'path',
                name: 'id',
                required: true,
                schema: { type: 'string' },
                description: 'Resource ID'
            });
        }

        // Add query parameters for list endpoints
        if (fnName === 'list') {
            params.push({ $ref: '#/components/parameters/pageParam' });
            params.push({ $ref: '#/components/parameters/limitParam' });
            params.push({ $ref: '#/components/parameters/searchParam' });
            
            // Add role-specific filters
            if (manager === 'classroom') {
                params.push({
                    in: 'query',
                    name: 'grade',
                    schema: { type: 'integer', minimum: 1, maximum: 12 },
                    description: 'Filter by grade'
                });
                params.push({
                    in: 'query',
                    name: 'status',
                    schema: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
                    description: 'Filter by status'
                });
            }
            
            if (manager === 'student') {
                params.push({
                    in: 'query',
                    name: 'status',
                    schema: { type: 'string', enum: ['enrolled', 'transferred', 'graduated', 'suspended'] },
                    description: 'Filter by enrollment status'
                });
            }
        }

        return params.length > 0 ? params : undefined;
    }

    /**
     * Get request body for endpoint
     */
    _getRequestBodyForEndpoint(manager, fnName) {
        const methodsWithBody = ['create', 'update', 'register', 'login', 'changePassword', 'assignRole', 'transfer', 'updateProfile', 'refreshToken', 'assignTeacher'];
        
        if (methodsWithBody.includes(fnName)) {
            const schemaName = this._getSchemaName(manager, fnName);
            
            return {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: `#/components/schemas/${schemaName}` }
                    }
                }
            };
        }
        
        return undefined;
    }

    /**
     * Get schema name
     */
    _getSchemaName(manager, fnName) {
        const schemaMap = {
            school: {
                create: 'SchoolCreate',
                update: 'SchoolUpdate'
            },
            classroom: {
                create: 'ClassroomCreate',
                update: 'ClassroomUpdate',
                assignTeacher: 'AssignTeacher'
            },
            student: {
                create: 'StudentCreate',
                update: 'StudentUpdate',
                transfer: 'StudentTransfer'
            },
            user: {
                register: 'UserRegister',
                login: 'UserLogin',
                updateProfile: 'UserProfileUpdate',
                changePassword: 'ChangePassword',
                assignRole: 'AssignRole'
            }
        };
        
        return schemaMap[manager]?.[fnName] || `${manager.charAt(0).toUpperCase() + manager.slice(1)}${fnName.charAt(0).toUpperCase() + fnName.slice(1)}`;
    }

    /**
     * Get responses for endpoint
     */
    _getResponsesForEndpoint(manager, fnName) {
        const responses = {
            200: {
                description: 'Successful operation',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                ok: { type: 'boolean', example: true },
                                data: this._getResponseSchema(manager, fnName)
                            }
                        }
                    }
                }
            },
            400: { $ref: '#/components/responses/ValidationError' },
            401: { $ref: '#/components/responses/UnauthorizedError' },
            403: { $ref: '#/components/responses/ForbiddenError' },
            404: { $ref: '#/components/responses/NotFoundError' }
        };

        // Remove 404 if not applicable
        if (fnName === 'create' || fnName === 'list' || fnName === 'login' || fnName === 'register') {
            delete responses[404];
        }

        return responses;
    }

    /**
     * Get response schema
     */
    _getResponseSchema(manager, fnName) {
        if (fnName === 'list') {
            return {
                type: 'object',
                properties: {
                    data: {
                        type: 'array',
                        items: { type: 'object' }
                    },
                    pagination: {
                        type: 'object',
                        properties: {
                            page: { type: 'integer' },
                            limit: { type: 'integer' },
                            total: { type: 'integer' },
                            pages: { type: 'integer' }
                        }
                    }
                }
            };
        }
        
        return { type: 'object' };
    }

    /**
     * Check if endpoint requires authentication
     */
    _requiresAuth(manager, fnName) {
        const publicEndpoints = {
            user: ['register', 'login', 'refreshToken']
        };
        
        return !publicEndpoints[manager]?.includes(fnName);
    }

    /**
     * GET /api/swagger/json - Get Swagger JSON spec
     */
    async getJson({ __shark, __user, data, res }) {
        this.logger.info('📚 Serving Swagger JSON');

        if (!this.specs) {
            this.buildSpecs();
        }

        if (!res) {
            this.logger.error('❌ Response object not found');
            return { error: 'Response object not available' };
        }

        res.setHeader('Content-Type', 'application/json');
        res.send(this.specs);

        return { selfHandleResponse: true };
    }

    /**
     * GET /api/swagger/ui - Serve Swagger UI
     */
    async getUi({__shark, __user, data, res }) {
        this.logger.info('📚 Serving Swagger UI');
        
        if (!this.specs) {
            this.buildSpecs();
        }
        
        if (!res) {
            this.logger.error('❌ Response object not found in data');
            return { error: 'Response object not available' };
        }
        
        const html = this._generateSwaggerUI();
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
        
        return { selfHandleResponse: true };
    }

    /**
     * Generate Swagger UI HTML
     */
    _generateSwaggerUI() {
        const apiUrl = `/api/swagger/json`;
        
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${this.config.dotEnv.SERVICE_NAME || 'School Management'} API Documentation</title>
                <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
                <style>
                    body { margin: 0; padding: 0; }
                    #swagger-ui { max-width: 1400px; margin: 0 auto; }
                    .topbar { display: none; }
                    .information-container { padding-top: 20px; }
                    .scheme-container { background: #f7f7f7; padding: 10px 0; }
                </style>
            </head>
            <body>
                <div id="swagger-ui"></div>
                
                <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
                <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
                
                <script>
                    window.onload = function() {
                        const ui = SwaggerUIBundle({
                            url: '${apiUrl}',
                            dom_id: '#swagger-ui',
                            presets: [
                                SwaggerUIBundle.presets.apis,
                                SwaggerUIStandalonePreset
                            ],
                            layout: "BaseLayout",
                            deepLinking: true,
                            persistAuthorization: true,
                            displayRequestDuration: true,
                            filter: true,
                            tryItOutEnabled: true,
                            syntaxHighlight: {
                                activated: true,
                                theme: "agate"
                            },
                            defaultModelsExpandDepth: -1,
                            defaultModelExpandDepth: 3,
                            docExpansion: 'list'
                        });
                        window.ui = ui;
                    };
                </script>
            </body>
            </html>`;
    }

    /**
     * Alias methods
     */
    async json({__shark, __user, data, res}) {
        return this.getJson({__shark, __user, data, res});
    }

    async ui({__shark, __user, data, res}) {
        return this.getUi({__shark, __user, data, res});
    }
};