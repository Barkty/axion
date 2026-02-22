const http              = require('http');
const express           = require('express');
const cors              = require('cors');
const helmet            = require('helmet');
const compression       = require('compression');
const morgan            = require('morgan');
const rateLimit         = require('express-rate-limit');

module.exports = class UserServer {
    constructor({config, managers}){
        this.config        = config;
        this.userApi       = managers.userApi;
        this.tokenManager  = managers.token;
        this.sharkFin      = managers.shark;
        this.mwsExec       = managers.mwsExec;
        this.logger       = managers.logger;
        
        // Store managers for use in middleware
        this.managers      = managers;
        this.app = express();
        this.configure();
    }
    
    /** for injecting middlewares */
    use(args){
        this.app.use(args);
    }

    /** server configs */
    configure() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false
        }));
        this.app.use(morgan("dev"))
        
        // Compression
        this.app.use(compression());
        
        // CORS configuration
        this.app.use(cors({
            origin: this.config.dotEnv.CORS_ORIGIN || '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));
        
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Static files
        this.app.use('/static', express.static('public'));

        const requestLogger = require('../../mws/__requestLogger.mw')({
            managers: this.managers
        });
        this.app.use(requestLogger);

        const globalLimiter = rateLimit({
          windowMs : 15 * 60 * 1000, // 15 min
          max      : 200,
          message  : { success: false, error: 'Too many requests, please try again later.' },
          standardHeaders: true,
          legacyHeaders  : false,
        });
        this.app.use(globalLimiter);
        
        this.app.use((req, res, next) => {
            this.logger.info(`\n📨 Incoming ${req.method} request to ${req.url}`);
            this.logger.info(`${new Date().toISOString()} - ${req.method} ${req.url}`);
            next();
        });

        this.app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                service: this.config.dotEnv.SERVICE_NAME,
                version: process.env.npm_package_version || '1.0.0'
            });
        });

        this.app.get('/', (req, res) => {
            res.redirect('/api-docs');
        });

        // API documentation route
        this.app.get('/api-docs', (req, res) => {
            res.redirect('/api/swagger/ui');
        });
        this.app.get('/docs', (req, res) => {
            res.redirect('/api/swagger/ui');
        });

        this.app.get('/api/swagger/ui', (req, res, next) => {
            req.url = '/api/swagger/getUi';
            this.logger.info('📚 Serving Swagger UI');
            req.params.moduleName = 'swagger'
            req.params.fnName = 'getUi'
            req.params.method = 'get'
            this.userApi.mw(req, res, next);
        });

        this.app.get('/api/swagger/json', (req, res, next) => {
            req.url = '/api/swagger/getJson';
            req.params.moduleName = 'swagger'
            req.params.fnName = 'getJson'
            req.params.method = 'get'
            this.logger.info('📚 Serving Swagger JSON');
            this.userApi.mw(req, res, next);
        });

        this.app.get('/api/swagger/getUi', (req, res, next) => {
            req.params.moduleName = 'swagger'
            req.params.fnName = 'getUi'
            req.params.method = 'get'
            this.userApi.mw(req, res, next);
        });

        this.app.get('/debug/matrix', (req, res) => {
            const matrix = this.userApi.methodMatrix;
            const managers = Object.keys(this.managers);
            res.json({
                methodMatrix: matrix,
                managers: managers,
                swaggerInMatrix: !!matrix?.swagger,
                swaggerManager: !!this.managers.swagger
            });
        });

        this.app.get('/api/redoc', (req, res) => {
            const redocHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>School Management - API Documentation</title>
                    <meta charset="utf-8"/>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
                    <style>
                        body { margin: 0; padding: 0; }
                        .loading {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            font-family: sans-serif;
                            font-size: 1.5rem;
                            color: #666;
                        }
                        .error {
                            color: #EA157F;
                            text-align: center;
                            padding: 2rem;
                        }
                    </style>
                </head>
                <body>
                    <div id="loading" class="loading">Loading API documentation...</div>
                    <div id="error" style="display: none;"></div>
                    <div id="redoc-container" style="display: none;"></div>
                    
                    <script>
                        // First check if the Swagger JSON is accessible
                        fetch('/api/swagger/json')
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error(\`Failed to load API spec: \${response.status} \${response.statusText}\`);
                                }
                                return response.json();
                            })
                            .then(spec => {
                                // Hide loading, show redoc
                                document.getElementById('loading').style.display = 'none';
                                const container = document.getElementById('redoc-container');
                                container.style.display = 'block';
                                
                                // Initialize ReDoc
                                Redoc.init(
                                    spec,
                                    {
                                        theme: {
                                            colors: {
                                                primary: { main: '#EA157F' }
                                            }
                                        },
                                        scrollYOffset: 50,
                                        hideHostname: false,
                                        expandResponses: "200,201",
                                        requiredPropsFirst: true,
                                        sortPropsAlphabetically: true,
                                        hideDownloadButton: false,
                                        hideLoading: false,
                                        nativeScrollbars: true
                                    },
                                    container
                                );
                            })
                            .catch(error => {
                                // Show error
                                document.getElementById('loading').style.display = 'none';
                                const errorDiv = document.getElementById('error');
                                errorDiv.style.display = 'block';
                                errorDiv.className = 'error';
                                errorDiv.innerHTML = \`
                                    <h2>Error Loading API Documentation</h2>
                                    <p>\${error.message}</p>
                                    <p>Please check that the Swagger JSON endpoint is accessible at <code>/api/swagger/json</code></p>
                                    <button onclick="window.location.reload()">Retry</button>
                                \`;
                            });
                    </script>
                    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
                </body>
                </html>
            `;
            
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Content-Type', 'text/html');
            res.send(redocHtml);
        });

        this.app.all('/api/:moduleName/:fnName', (req, res, next) => {
            // Add request ID for tracking
            req.id = require('crypto').randomBytes(16).toString('hex');
            
            // Add start time for performance monitoring
            req.startTime = Date.now();
            
            this.logger.info(`🔄 Routing to ${req.params.moduleName}.${req.params.fnName}`);

            // Pass to API handler
            this.userApi.mw(req, res, next);
        });

        /** 
         * Catch-all for undefined routes
         */
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Route not found',
                message: `Cannot ${req.method} ${req.originalUrl}`,
                timestamp: new Date().toISOString()
            });
        });

        /** 
         * Global error handler 
         */
        this.app.use((err, req, res, next) => {
            console.error(`❌ Error [${req.id}]:`, err.stack);
            
            // Determine error type and status code
            let statusCode = err.statusCode || 500;
            let errorMessage = err.message || 'Internal server error';
            
            // Handle specific error types
            if (err.name === 'ValidationError') {
                statusCode = 400;
                errorMessage = err.message;
            } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
                statusCode = 401;
                errorMessage = 'Authentication failed: ' + err.message;
            } else if (err.name === 'MongoError' || err.name === 'MongoServerError') {
                if (err.code === 11000) {
                    statusCode = 409;
                    errorMessage = 'Duplicate entry: ' + JSON.stringify(err.keyValue);
                }
            }
            
            // Log performance for slow requests
            const responseTime = Date.now() - req.startTime;
            if (responseTime > 1000) {
                console.warn(`⚠️ Slow request [${req.id}]: ${responseTime}ms`);
            }
            
            // Send error response
            res.status(statusCode).json({
                error: errorMessage,
                code: err.code || statusCode,
                requestId: req.id,
                timestamp: new Date().toISOString(),
                ...(this.config.dotEnv.ENV === 'development' && { stack: err.stack })
            });
        });

        // Create HTTP server
        const server = http.createServer(this.app);

        // Store server instance for graceful shutdown
        this.server = server;
    }

    getApp() {
        return this.app;
    }

    start() {
        // Start server
        const PORT = this.config.dotEnv.USER_PORT || 3000;
        this.server.listen(PORT, () => {
            this.logger.info(`${(this.config.dotEnv.SERVICE_NAME || 'SCHOOL-MANAGEMENT').toUpperCase()} is running`);
            this.logger.info(`Environment: ${this.config.dotEnv.ENV}`);
            this.logger.info(`API Base: http://localhost:${PORT}/api/:moduleName/:fnName`);
            this.logger.info(`Health check: http://localhost:${PORT}/health\n`);
        });

        // Handle server errors
        this.server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                this.logger.error(`❌ Port ${PORT} is already in use`);
                process.exit(1);
            } else {
                this.logger.error('❌ Server error:', error);
            }
        });
    }

    // Method to gracefully stop the server
    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    this.logger.info('✅ HTTP server closed');
                    resolve();
                });
            });
        }
    }
}
