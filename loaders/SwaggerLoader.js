const path = require('path');
const fs = require('fs');

module.exports = class SwaggerLoader {
    constructor(injectable) {
        this.injectable = injectable;
        this.logger = injectable.managers?.logger || console;
    }

    load() {
        this.logger.info('📚 Loading Swagger documentation...');
        
        try {
            const SwaggerManager = require('../managers/swagger/Swagger.manager');
            const swaggerManager = new SwaggerManager(this.injectable);
            
            // Build specs
            swaggerManager.buildSpecs();
            
            this.logger.info('✅ Swagger documentation loaded successfully');
            
            return swaggerManager;
        } catch (error) {
            this.logger.error('❌ Failed to load Swagger:', error.message);
            return null;
        }
    }
};