const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);
const appendFile = promisify(fs.appendFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

module.exports = class FileTransport {
    constructor({ logger, config, filename, maxSize, maxFiles }) {
        this.logger = logger;
        this.config = config;
        this.filename = filename;
        this.maxSize = this._parseSize(maxSize);
        this.maxFiles = maxFiles || 5;
        
        // Ensure log directory exists
        this._ensureLogDirectory();
        
        // Current file size
        this.currentSize = this._getCurrentSize();
    }

    /**
     * Ensure log directory exists
     */
    async _ensureLogDirectory() {
        const dir = path.dirname(this.filename);
        try {
            if (!await exists(dir)) {
                await mkdir(dir, { recursive: true });
            }
        } catch (error) {
            console.error('Failed to create log directory:', error.message);
        }
    }

    /**
     * Parse size string (e.g., '10m', '100k', '1g')
     */
    _parseSize(sizeStr) {
        if (!sizeStr) return 10 * 1024 * 1024; // Default 10MB
        
        const units = {
            'b': 1,
            'k': 1024,
            'm': 1024 * 1024,
            'g': 1024 * 1024 * 1024
        };

        const match = sizeStr.toString().match(/^(\d+)([bkmg])$/i);
        if (!match) return 10 * 1024 * 1024; // Default 10MB

        const [, num, unit] = match;
        return parseInt(num) * (units[unit.toLowerCase()] || 1);
    }

    /**
     * Get current file size
     */
    _getCurrentSize() {
        try {
            const stats = fs.statSync(this.filename);
            return stats.size;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Rotate log files
     */
    async _rotate() {
        for (let i = this.maxFiles - 1; i > 0; i--) {
            const oldFile = `${this.filename}.${i}`;
            const newFile = `${this.filename}.${i + 1}`;
            
            try {
                if (fs.existsSync(oldFile)) {
                    await promisify(fs.rename)(oldFile, newFile);
                }
            } catch (error) {
                console.error('Failed to rotate log file:', error.message);
            }
        }

        // Rename current file
        try {
            if (fs.existsSync(this.filename)) {
                await promisify(fs.rename)(this.filename, `${this.filename}.1`);
            }
        } catch (error) {
            console.error('Failed to rename current log file:', error.message);
        }

        this.currentSize = 0;
    }

    /**
     * Log entries to file
     */
    async log(entries) {
        try {
            const logLines = entries.map(entry => 
                JSON.stringify(this._formatEntry(entry))
            ).join('\n') + '\n';

            const logSize = Buffer.byteLength(logLines, 'utf8');

            // Check if rotation is needed
            if (this.currentSize + logSize > this.maxSize) {
                await this._rotate();
            }

            await appendFile(this.filename, logLines);
            this.currentSize += logSize;
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }

    /**
     * Format entry for file storage
     */
    _formatEntry(entry) {
        return {
            ...entry,
            environment: this.config.dotEnv.NODE_ENV,
            version: process.env.npm_package_version || '1.0.0'
        };
    }
};