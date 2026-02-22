
require('dotenv').config()
const os                               = require('os');
const pjson                            = require('../package.json');
const utils                            = require('../libs/utils');
const SERVICE_NAME                     = (process.env.SERVICE_NAME)? utils.slugify(process.env.SERVICE_NAME):pjson.name;
const USER_PORT                        = process.env.USER_PORT || 5111;
const ADMIN_PORT                       = process.env.ADMIN_PORT || 5222;
const ADMIN_URL                        = process.env.ADMIN_URL || `http://localhost:${ADMIN_PORT}`;
const ENV                              = process.env.NODE_ENV || "development";
const REDIS_URI                        = process.env.REDIS_URI || "redis://127.0.0.1:6379";

const CORTEX_REDIS                     = process.env.CORTEX_REDIS || REDIS_URI;
const CORTEX_PREFIX                    = process.env.CORTEX_PREFIX || 'none';
const CORTEX_TYPE                      = process.env.CORTEX_TYPE || SERVICE_NAME;
const OYSTER_REDIS                     = process.env.OYSTER_REDIS || REDIS_URI;
const OYSTER_PREFIX                    = process.env.OYSTER_PREFIX || 'none';

const CACHE_REDIS                      = process.env.CACHE_REDIS || REDIS_URI;
const CACHE_PREFIX                     = process.env.CACHE_PREFIX || `${SERVICE_NAME}:ch`;

const MONGO_URI                        = process.env.MONGO_URI;
const MONGO_DB_NAME                        = process.env.MONGO_DB_NAME;
const config                           = require(`./envs/${ENV}.js`);
const LONG_TOKEN_SECRET                = process.env.LONG_TOKEN_SECRET || null;
const SHORT_TOKEN_SECRET               = process.env.SHORT_TOKEN_SECRET || null;
const NACL_SECRET                      = process.env.NACL_SECRET || null;
const CORS_ORIGIN                      = process.env.CORS_ORIGIN || null;
const BCRYPT_ROUNDS                    = process.env.BCRYPT_ROUNDS || null;
const JWT_EXPIRES_IN                    = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN                    = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const JWT_SECRET                    = process.env.JWT_SECRET;

const LOG_LEVEL                        = process.env.LOG_LEVEL;
const LOG_BUFFER_SIZE                        = process.env.LOG_BUFFER_SIZE;
const LOG_FLUSH_INTERVAL                        = process.env.LOG_FLUSH_INTERVAL;
const LOG_CONSOLE_COLORS                        = process.env.LOG_CONSOLE_COLORS;
const LOG_FILE_ENABLED                        = process.env.LOG_FILE_ENABLED;
const LOG_FILE_PATH                        = process.env.LOG_FILE_PATH;
const LOG_FILE_MAX_SIZE                        = process.env.LOG_FILE_MAX_SIZE;
const LOG_FILE_MAX_FILES                        = process.env.LOG_FILE_MAX_FILES;
const LOG_CORTEX_ENABLED                        = process.env.LOG_CORTEX_ENABLED || true;
const LOG_CORTEX_TOPIC                        = process.env.LOG_CORTEX_TOPIC || 'system.logs';

if(!LONG_TOKEN_SECRET || !SHORT_TOKEN_SECRET || !NACL_SECRET) {
    throw Error('missing .env variables check index.config');
}

config.dotEnv = {
    SERVICE_NAME,
    ENV,
    CORTEX_REDIS,
    CORTEX_PREFIX,
    CORTEX_TYPE,
    OYSTER_REDIS,
    OYSTER_PREFIX,
    CACHE_REDIS,
    CACHE_PREFIX,
    MONGO_URI,
    MONGO_DB_NAME,
    USER_PORT,
    ADMIN_PORT,
    ADMIN_URL,
    LONG_TOKEN_SECRET,
    SHORT_TOKEN_SECRET,
    CORS_ORIGIN,
    BCRYPT_ROUNDS,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    JWT_REFRESH_EXPIRES_IN,
    LOG_LEVEL,
    LOG_BUFFER_SIZE,
    LOG_CONSOLE_COLORS,
    LOG_FLUSH_INTERVAL,
    LOG_FILE_ENABLED,
    LOG_FILE_PATH,
    LOG_FILE_MAX_SIZE,
    LOG_FILE_MAX_FILES,
    LOG_CORTEX_ENABLED,
    LOG_CORTEX_TOPIC
};



module.exports = config;
