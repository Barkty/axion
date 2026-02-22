module.exports = class CortexTransport {
    constructor({ logger, config, topic }) {
        this.logger = logger;
        this.config = config;
        this.topic = topic;
        this.cortex = logger.cortex;
    }

    /**
     * Log entries to cortex (distributed)
     */
    async log(entries) {
        if (!this.cortex) return;

        try {
            // Group entries by level for efficient publishing
            const grouped = entries.reduce((acc, entry) => {
                if (!acc[entry.level]) acc[entry.level] = [];
                acc[entry.level].push(entry);
                return acc;
            }, {});

            // Publish to cortex
            for (const [level, logs] of Object.entries(grouped)) {
                await this.cortex.AsyncEmitToOneOf({
                    type: 'batch_log',
                    call: this.topic,
                    args: {
                        level,
                        count: logs.length,
                        logs: logs.map(this._formatForCortex),
                        source: this.config.dotEnv.SERVICE_NAME,
                        timestamp: Date.now()
                    }
                });
            }
        } catch (error) {
            console.error('Failed to publish logs to cortex:', error);
        }
    }

    /**
     * Format entry for cortex
     */
    _formatForCortex(entry) {
        return {
            timestamp: entry.timestamp,
            level: entry.level,
            message: entry.message,
            meta: entry.meta,
            context: entry.context
        };
    }
};