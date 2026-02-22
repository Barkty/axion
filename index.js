const config                = require('./config/index.config.js');
const Cortex                = require('ion-cortex');
const ManagersLoader        = require('./loaders/ManagersLoader.js');
const Aeon                  = require('aeon-machine');
const connectDB             = require('./connect/mongo.js');

process.on('uncaughtException', err => {
    console.log(`Uncaught Exception:`)
    console.log(err, err.stack);
    process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled rejection at ', promise, `reason:`, reason);
    process.exit(1)
})

const startServer = async () => {
    try {
        // Connect to MongoDB
        const database = connectDB({
            uri: `${config.dotEnv.MONGO_URI}/${config.dotEnv.MONGO_DB_NAME}`,
        });

        const cache = require('./cache/cache.dbh')({
            prefix: config.dotEnv.CACHE_PREFIX,
            url: config.dotEnv.CACHE_REDIS
        });

        const Oyster = require('oyster-db');
        const oyster = new Oyster({ 
            url: config.dotEnv.OYSTER_REDIS, 
            prefix: config.dotEnv.OYSTER_PREFIX 
        });

        const cortex = new Cortex({
            prefix: config.dotEnv.CORTEX_PREFIX,
            url: config.dotEnv.CORTEX_REDIS,
            type: config.dotEnv.CORTEX_TYPE,
            state: () => {
                return {
                    uptime: process.uptime(),
                    startTime: new Date().toISOString(),
                    activeRequests: 0
                };
            },
            activeDelay: 50,
            idlDelay: 200,
        });
        cortex.stream = { url: config.dotEnv.CORTEX_REDIS };

        const aeon = new Aeon({ 
            cortex, 
            timestampFrom: Date.now(), 
            segmantDuration: 500 
        });

        const injectable = {
            config,
            cache,
            cortex,
            oyster,
            aeon,
            database
        };

        const managersLoader = new ManagersLoader(injectable);
        const managers = managersLoader.load();

        managers.userServer.start();
        
        console.log(`Server startup complete`);
        console.log(`Environment: ${config.dotEnv.ENV}`);
        console.log(`API endpoint: http://localhost:${config.dotEnv.USER_PORT}/api/:moduleName/:fnName`);

        // Handle graceful shutdown
        const gracefulShutdown = async () => {
            console.log('\nvReceived shutdown signal, closing connections...');
            
            // Close database connections
            if (database && database.connection) {
                await database.connection.close();
                console.log('MongoDB connection closed');
            }

            // Close Redis connections
            if (cache && cache.quit) {
                await cache.quit();
                console.log('Redis cache closed');
            }

            if (cortex && cortex.quit) {
                await cortex.quit();
                console.log('Cortex connection closed');
            }

            console.log('Graceful shutdown complete');
            process.exit(0);
        };

        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        console.error(error.stack);
        process.exit(1);
    }
};

startServer();