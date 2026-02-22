const chalk = require('chalk'); // Optional: for colored output

module.exports = class ConsoleTransport {
    constructor({ logger, config }) {
        this.logger = logger;
        this.config = config;
        this.useColors = config.dotEnv.LOG_CONSOLE_COLORS !== 'false';
    }

    /**
     * Log entries to console
     */
    async log(entries) {
        entries.forEach(entry => {
            const formatted = this._formatEntry(entry);
            
            // Use appropriate console method based on level
            switch (entry.level) {
                case 'error':
                    console.error(formatted);
                    break;
                case 'warn':
                    console.warn(formatted);
                    break;
                case 'info':
                    console.info(formatted);
                    break;
                case 'debug':
                case 'trace':
                    console.debug(formatted);
                    break;
                default:
                    console.log(formatted);
            }
        });
    }

    /**
     * Format log entry for console
     */
    _formatEntry(entry) {
        const { timestamp, level, message, meta, context } = entry;
        
        let formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

        // Add context if available
        if (context) {
            formatted += ` [${context.method} ${context.url}]`;
            if (context.userId) {
                formatted += ` [User:${context.userId}]`;
            }
        }

        // Add metadata if not empty
        if (meta && Object.keys(meta).length > 0) {
            // Remove internal fields
            const { pid, hostname, service, ...userMeta } = meta;
            if (Object.keys(userMeta).length > 0) {
                formatted += ` ${JSON.stringify(userMeta)}`;
            }
        }

        // Add colors if enabled
        if (this.useColors) {
            return this._colorize(level, formatted);
        }

        return formatted;
    }

    /**
     * Add colors based on log level
     */
    _colorize(level, text) {
        switch (level) {
            case 'error':
                return chalk.red(text);
            case 'warn':
                return chalk.yellow(text);
            case 'info':
                return chalk.green(text);
            case 'debug':
                return chalk.blue(text);
            case 'trace':
                return chalk.gray(text);
            default:
                return text;
        }
    }
};