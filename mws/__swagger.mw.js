module.exports = (injectable) => {
    const { managers } = injectable;
    const swaggerManager = managers.swagger;
    const logger = managers.logger;

    return async (req, res, next) => {
        // This middleware can be used to inject Swagger UI into the response
        // or to handle Swagger-specific requests
        if (req.path === '/api-docs' || req.path === '/swagger') {
            try {
                const html = swaggerManager._generateSwaggerUI();
                res.setHeader('Content-Type', 'text/html');
                res.send(html);
                return;
            } catch (error) {
                logger.error('Swagger middleware error:', error);
            }
        }
        next();
    };
};