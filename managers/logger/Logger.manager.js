const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = class LoggerManager {
    
    static httpExposed = [
        'getLogs=get',
        'getLogLevel=get',
        'setLogLevel=post',
        'clearLogs=delete'
    ];

    constructor({ config, cache, cortex, managers } = {}) {
        this.config = config;
        this.cache = cache;
        this.cortex = cortex;
        this.managers = managers;
        this.permissions = managers.permissions;
        
        // Log levels
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };

        // Current log level (from config or default to 'info')
        this.currentLevel = config.dotEnv.LOG_LEVEL || 'info';
        
        // Log transports
        this.transports = [];
        
        // Initialize transports
        this._initTransports();
        
        // Buffer for batch processing
        this.buffer = [];
        this.bufferSize = parseInt(config.dotEnv.LOG_BUFFER_SIZE) || 100;
        this.flushInterval = parseInt(config.dotEnv.LOG_FLUSH_INTERVAL) || 5000; // 5 seconds
        
        // Start flush interval
        this._startFlushInterval();
        
        // Request ID storage (using AsyncLocalStorage if available)
        this.requestContext = new Map();
    }

    /**
     * Initialize log transports based on config
     */
    _initTransports() {
        // Always add console transport in development
        if (this.config.dotEnv.ENV === 'development') {
            this.addTransport('console');
        }

        // Add file transport if enabled
        if (this.config.dotEnv.LOG_FILE_ENABLED === 'true') {
            this.addTransport('file', {
                filename: this.config.dotEnv.LOG_FILE_PATH || 'logs/app.log',
                maxSize: this.config.dotEnv.LOG_FILE_MAX_SIZE || '10m',
                maxFiles: this.config.dotEnv.LOG_FILE_MAX_FILES || 5
            });
        }

        // Add cortex transport for distributed logging
        if (this.config.dotEnv.LOG_CORTEX_ENABLED === 'true') {
            this.addTransport('cortex', {
                topic: this.config.dotEnv.LOG_CORTEX_TOPIC || 'system.logs'
            });
        }
    }

    /**
     * Add a transport
     */
    addTransport(type, options = {}) {
        try {
            const transportPath = `./transports/${type}.transport.js`;
            
            try {
                require.resolve(transportPath);
            } catch (e) {
                console.log(`⚠️ Transport ${type} not found, skipping`);
                return;
            }
            
            const Transport = require(`./transports/${type}.transport.js`);
            const transport = new Transport({ 
                logger: this, 
                config: this.config,
                ...options 
            });
            this.transports.push(transport);
        } catch (error) {
            console.error(`Failed to add transport ${type}:`, error);
        }
    }

    /**
     * Start interval to flush log buffer
     */
    _startFlushInterval() {
        setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }

    /**
     * Set request context (for request tracking)
     */
    setRequestContext(requestId, context = {}) {
        this.requestContext.set(requestId, {
            ...context,
            timestamp: Date.now()
        });
    }

    /**
     * Get request context
     */
    getRequestContext(requestId) {
        return this.requestContext.get(requestId);
    }

    /**
     * Clear request context
     */
    clearRequestContext(requestId) {
        this.requestContext.delete(requestId);
    }

    /**
     * Main log method
     */
    log(level, message, meta = {}) {
        // Check if level should be logged
        if (this.levels[level] > this.levels[this.currentLevel]) {
            return;
        }

        // Create log entry
        const entry = this._createLogEntry(level, message, meta);

        // Add to buffer
        this.buffer.push(entry);

        // Flush if buffer is full
        if (this.buffer.length >= this.bufferSize) {
            this.flush();
        }

        // Also log to cortex for real-time if it's an error
        if (level === 'error' && this.cortex) {
            this._publishToCortex(entry);
        }

        return entry;
    }

    /**
     * Create log entry
     */
    _createLogEntry(level, message, meta = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            meta: {
                ...meta,
                pid: process.pid,
                hostname: os.hostname(),
                service: this.config.dotEnv.SERVICE_NAME || 'school-management'
            }
        };

        // Add request context if available
        if (meta.requestId && this.requestContext.has(meta.requestId)) {
            entry.context = this.requestContext.get(meta.requestId);
        }

        // Add stack trace for errors
        if (level === 'error' && !meta.stack) {
            const stack = new Error().stack;
            entry.meta.stack = stack.split('\n').slice(2).join('\n');
        }

        return entry;
    }

    /**
     * Publish log to cortex (for distributed systems)
     */
    _publishToCortex(entry) {
        try {
            this.cortex.AsyncEmitToOneOf({
                ...entry,
                type: 'log.entered',
                source: this.config.dotEnv.SERVICE_NAME,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Failed to publish log to cortex:', error);
        }
    }

    /**
     * Flush buffer to transports
     */
    async flush() {
        if (this.buffer.length === 0) return;

        const entries = [...this.buffer];
        this.buffer = [];

        // Send to all transports
        for (const transport of this.transports) {
            try {
                await transport.log(entries);
            } catch (error) {
                console.error(`Transport error:`, error);
            }
        }

        // Also cache recent logs for API access
        await this._cacheRecentLogs(entries);
    }

    /**
     * Cache recent logs for API access
     */
    async _cacheRecentLogs(entries) {
        try {
            const recentLogs = await this.cache.key.get({ key: 'logs:recent'}) || [];
            const updated = [...entries, ...recentLogs].slice(0, 1000); // Keep last 1000 logs
            await this.cache.key.set({ key: 'logs:recent', ttl: 3600, data: JSON.stringify(updated)}); // 1 hour TTL
        } catch (error) {
            // Silently fail - cache is optional for logs
        }
    }

    /**
     * Log levels shortcuts
     */
    error(message, meta = {}) {
        return this.log('error', message, meta);
    }

    warn(message, meta = {}) {
        return this.log('warn', message, meta);
    }

    info(message, meta = {}) {
        return this.log('info', message, meta);
    }

    debug(message, meta = {}) {
        return this.log('debug', message, meta);
    }

    trace(message, meta = {}) {
        return this.log('trace', message, meta);
    }

    /**
     * HTTP request logger middleware
     */
    httpMiddleware() {
        return (req, res, next) => {
            const startTime = Date.now();
            const requestId = req.id || require('crypto').randomBytes(16).toString('hex');

            // Set request context
            this.setRequestContext(requestId, {
                method: req.method,
                url: req.url,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent'),
                userId: req.user?.id
            });

            // Add request ID to response headers
            res.setHeader('X-Request-ID', requestId);

            // Log request
            this.info(`Incoming request: ${req.method} ${req.url}`, {
                requestId,
                method: req.method,
                url: req.url,
                ip: req.ip
            });

            // Log response when finished
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                const level = res.statusCode >= 400 ? 'warn' : 'info';
                
                this[level](`Request completed: ${req.method} ${req.url} ${res.statusCode}`, {
                    requestId,
                    statusCode: res.statusCode,
                    duration,
                    durationMs: duration
                });

                this.clearRequestContext(requestId);
            });

            next();
        };
    }

    /**
     * API Methods
     */

    /**
     * Get recent logs (API endpoint)
     */
    async getLogs(__shark, __user, query) {
        // Check permission (only admins)
        this.permissions.check(__user, 'logs', 'list')

        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 100;
        const level = query.level;
        const search = query.search;

        try {
            // Get from cache first
            let logs = await this.cache.key.get({key: 'logs:recent'}) || [];
            logs = JSON.parse(logs);

            // Filter by level
            if (level) {
                logs = logs.filter(log => log.level === level);
            }

            // Search in messages
            if (search) {
                const regex = new RegExp(search, 'i');
                logs = logs.filter(log => 
                    regex.test(log.message) || 
                    regex.test(JSON.stringify(log.meta))
                );
            }

            // Paginate
            const start = (page - 1) * limit;
            const paginatedLogs = logs.slice(start, start + limit);

            return {
                data: paginatedLogs,
                pagination: {
                    page,
                    limit,
                    total: logs.length,
                    pages: Math.ceil(logs.length / limit)
                },
                stats: await this._getLogStats(logs)
            };
        } catch (error) {
            this.error('Failed to get logs', { error: error.message });
            throw new Error('Failed to retrieve logs');
        }
    }

    /**
     * Get current log level
     */
    async getLogLevel(__shark, __user) {
        this.permissions.check(__user, 'logs', 'view')
        return { level: this.currentLevel };
    }

    /**
     * Set log level (admin only)
     */
    async setLogLevel(__shark, __user, data) {
        this.permissions.check(__user, 'logs', 'configure')
        
        const { level } = data;
        if (!this.levels[level]) {
            throw new Error(`Invalid log level. Must be one of: ${Object.keys(this.levels).join(', ')}`);
        }

        this.currentLevel = level;
        
        // Store in config (you might want to persist this)
        this.config.dotEnv.LOG_LEVEL = level;

        this.info(`Log level changed to ${level}`, { changedBy: __user.id });

        return { 
            message: `Log level set to ${level}`,
            level 
        };
    }

    /**
     * Clear logs (admin only)
     */
    async clearLogs(__shark, __user) {
        this.permissions.check(__user, 'logs', 'delete')
        
        await this.cache.key.delete({ key: 'logs:recent'});
        
        // Also clear file logs if using file transport
        if (this.config.dotEnv.LOG_FILE_ENABLED === 'true') {
            const logFile = this.config.dotEnv.LOG_FILE_PATH || 'logs/app.log';
            try {
                fs.writeFileSync(logFile, '');
            } catch (error) {
                this.error('Failed to clear log file', { error: error.message });
            }
        }

        this.info('Logs cleared', { clearedBy: __user.id });

        return { message: 'Logs cleared successfully' };
    }

    /**
     * Get log statistics
     */
    async _getLogStats(logs) {
        const stats = {
            total: logs.length,
            byLevel: {},
            timeRange: {
                oldest: null,
                newest: null
            }
        };

        logs.forEach(log => {
            // Count by level
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;

            // Track time range
            const time = new Date(log.timestamp).getTime();
            if (!stats.timeRange.oldest || time < stats.timeRange.oldest) {
                stats.timeRange.oldest = time;
            }
            if (!stats.timeRange.newest || time > stats.timeRange.newest) {
                stats.timeRange.newest = time;
            }
        });

        return stats;
    }

    /**
     * Gracefully shutdown logger
     */
    async shutdown() {
        this.info('Logger shutting down...');
        await this.flush();
    }
};