module.exports = {
    /**
     * Create a request ID
     */
    generateRequestId() {
        return require('crypto').randomBytes(16).toString('hex');
    },

    /**
     * Format error for logging
     */
    formatError(error) {
        return {
            message: error.message,
            name: error.name,
            code: error.code,
            stack: error.stack,
            ...(error.response && {
                response: {
                    status: error.response.status,
                    data: error.response.data
                }
            })
        };
    },

    /**
     * Mask sensitive data in logs
     */
    maskSensitiveData(data, fields = ['password', 'token', 'authorization']) {
        if (!data) return data;
        
        const masked = { ...data };
        
        const maskValue = (obj, key) => {
            if (obj[key]) {
                obj[key] = '***MASKED***';
            }
        };

        const traverse = (obj) => {
            if (!obj || typeof obj !== 'object') return;

            Object.keys(obj).forEach(key => {
                if (fields.includes(key.toLowerCase())) {
                    maskValue(obj, key);
                } else if (typeof obj[key] === 'object') {
                    traverse(obj[key]);
                }
            });
        };

        traverse(masked);
        return masked;
    },

    /**
     * Truncate long strings in logs
     */
    truncateStrings(obj, maxLength = 1000) {
        if (!obj || typeof obj !== 'object') return obj;

        const truncated = Array.isArray(obj) ? [] : {};

        Object.keys(obj).forEach(key => {
            const value = obj[key];
            
            if (typeof value === 'string' && value.length > maxLength) {
                truncated[key] = value.substring(0, maxLength) + '... [truncated]';
            } else if (typeof value === 'object' && value !== null) {
                truncated[key] = this.truncateStrings(value, maxLength);
            } else {
                truncated[key] = value;
            }
        });

        return truncated;
    },

    /**
     * Get log level from status code
     */
    getLevelFromStatus(statusCode) {
        if (statusCode >= 500) return 'error';
        if (statusCode >= 400) return 'warn';
        if (statusCode >= 300) return 'info';
        return 'debug';
    },

    /**
     * Calculate log statistics
     */
    calculateStats(logs) {
        const stats = {
            total: logs.length,
            byLevel: {},
            byHour: {},
            errorRate: 0,
            avgResponseTime: 0
        };

        let totalResponseTime = 0;
        let errorCount = 0;

        logs.forEach(log => {
            // Count by level
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;

            // Count by hour
            const hour = new Date(log.timestamp).getHours();
            stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;

            // Track errors
            if (log.level === 'error') errorCount++;

            // Track response time
            if (log.meta?.durationMs) {
                totalResponseTime += log.meta.durationMs;
            }
        });

        stats.errorRate = (errorCount / logs.length) * 100;
        stats.avgResponseTime = totalResponseTime / logs.length || 0;

        return stats;
    }
};