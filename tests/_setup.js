/**
 * Supertest server bootstrap
 *
 * Starts the REAL Express app (full middleware stack, real managers, real Mongoose)
 * but points it at an in-memory MongoDB so tests are isolated and fast.
 *
 * Auth note: __token.mw.js reads req.headers.token (not Authorization).
 * All supertest requests that need auth must call .set('token', accessToken).
 *
 * Usage:
 *   const { startServer, stopServer, clearDatabase } = require('./server.setup');
 *   let app;
 *   beforeAll(async () => { app = await startServer(); });
 *   afterAll(async () => { await stopServer(); });
 *   afterEach(async () => { await clearDatabase(); });
 */

const mongoose = require('mongoose');
const ManagersLoader = require('../loaders/ManagersLoader'); 
const config = require('../config/index.config');
const { makeCortex } = require('./_mocks');

// ─── In-memory cache (Redis substitute) ──────────────────────────────────────

class MemoryCache {
    constructor() { this._store = new Map(); }
    async get(key)              { return this._store.get(key) ?? null; }
    async set(key, value)       { this._store.set(key, value); return 'OK'; }
    async setex(key, _ttl, val) { this._store.set(key, val);  return 'OK'; }
    async del(key)              { this._store.delete(key);    return 1; }
    async exists(key)           { return this._store.has(key) ? 1 : 0; }
    flush()                     { this._store.clear(); }
}

// ─── Module-level singletons shared across test files ────────────────────────

let mongod;
const cache = new MemoryCache();

/**
 * Clear every collection between tests for full isolation.
 */
async function clearDatabase() {
    if (mongoose.connection.readyState !== 1) return;
    const cols = mongoose.connection.collections;
    await Promise.all(Object.values(cols).map(c => c.deleteMany({})));
    cache.flush();
}

/**
 * Teardown — disconnect and stop the in-memory server.
 */
async function stopServer() {
    if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    }
    if (mongod) await mongod.stop();
    app = null;
}

const createTestApp = async () => {
    process.env.NODE_ENV = 'test';

    config.dotEnv.ENV = 'test';

    const managersLoader = new ManagersLoader({
        config,
        cortex: makeCortex(),
        cache: cache,
        oyster: {},
        aeon: {}
    });

    const managers = managersLoader.load();

    const server = managers.userServer;

    server.configure();

    return {
        app: server.getApp(),
        managers,
        config,
        server
    };
}

module.exports = { stopServer, clearDatabase, cache, createTestApp };