const { generateRequestId } = require('../managers/_common/logger.utils');

module.exports = (injectable) => {
    const { managers } = injectable;
    const logger = managers.logger;

    return (req, res, next) => {
        // Generate request ID if not exists
        req.id = req?.id ? req.id : generateRequestId();

        // Set request context
        logger.setRequestContext(req.id, {
            method: req.method,
            url: req.url,
            ip: req?.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            userId: req?.user?.id,
            startTime: Date.now()
        });

        // Add request ID to response headers
        res.setHeader('X-Request-ID', req.id);

        // Log request
        logger.info(`${req.method} ${req.url}`, {
            requestId: req.id,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Log response when finished
        res.on('finish', () => {
            const context = logger.getRequestContext(req.id);
            const duration = Date.now() - (context?.startTime || Date.now());
            
            const logLevel = res.statusCode >= 500 ? 'error' :
                           res.statusCode >= 400 ? 'warn' : 'info';

            logger[logLevel](`${req.method} ${req.url} ${res.statusCode} ${duration}ms`, {
                requestId: req.id,
                statusCode: res.statusCode,
                duration,
                contentLength: res.get('Content-Length')
            });

            logger.clearRequestContext(req.id);
        });

        next();
    };
};