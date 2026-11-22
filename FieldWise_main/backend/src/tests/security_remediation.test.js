/**
 * FieldWise Phase 2: Security Remediation & Regression Test Suite
 * ===============================================================
 * Validates CORS allowlist enforcement, JWT secret hardening, fail-fast
 * environment validation, and rate limiter enforcement.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');

const app = require('../server');
const { validateStartupConfig } = require('../config/validateEnv');
const { createRateLimiter, InMemoryRateLimitStore } = require('../middleware/rateLimiter');
const authMiddleware = require('../middleware/auth');
const { optionalAuth } = authMiddleware;

function invokeExpress(method, url, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = new http.IncomingMessage(null);
        req.method = method;
        req.url = url;
        req.headers = Object.assign(
            {
                'content-type': 'application/json',
                host: 'localhost',
            },
            headers
        );

        const res = new http.ServerResponse(req);
        let resBody = '';

        const originalWrite = res.write;
        res.write = function (chunk, encoding, callback) {
            if (chunk) resBody += chunk.toString();
            return originalWrite.call(res, chunk, encoding, callback);
        };

        const originalEnd = res.end;
        res.end = function (chunk, encoding, callback) {
            if (chunk) resBody += chunk.toString();
            const result = originalEnd.call(res, chunk, encoding, callback);
            let parsed = null;
            try {
                parsed = JSON.parse(resBody);
            } catch (_) {
                parsed = resBody;
            }
            resolve({
                status: res.statusCode,
                headers: res.getHeaders ? res.getHeaders() : {},
                body: parsed,
            });
            return result;
        };

        app(req, res, (err) => {
            if (err) reject(err);
        });

        if (body) {
            req.emit('data', Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
        }
        req.emit('end');
    });
}

describe('FieldWise Phase 2: Security Remediation Test Suite', () => {

    // ── 1. CORS Hardening ────────────────────────────────────────────────────
    describe('1. CORS Origin Allowlist Hardening', () => {
        const originalEnv = { ...process.env };

        afterEach(() => {
            process.env = { ...originalEnv };
        });

        test('1.1 Configured trusted origin receives CORS approval headers', async () => {
            process.env.NODE_ENV = 'production';
            process.env.FRONTEND_URL = 'https://app.fieldwise.agri,https://landing.fieldwise.agri';

            const res = await invokeExpress('OPTIONS', '/api/health', null, {
                origin: 'https://app.fieldwise.agri',
                'access-control-request-method': 'GET',
            });

            assert.equal(res.status, 204);
            assert.equal(res.headers['access-control-allow-origin'], 'https://app.fieldwise.agri');
            assert.equal(res.headers['access-control-allow-credentials'], 'true');
        });

        test('1.2 Untrusted external origin is rejected with 403 CORS_FORBIDDEN', async () => {
            process.env.NODE_ENV = 'production';
            process.env.FRONTEND_URL = 'https://app.fieldwise.agri';

            const res = await invokeExpress('GET', '/api/health', null, {
                origin: 'https://malicious-attacker.com',
            });

            assert.equal(res.status, 403);
            assert.equal(res.body.error.code, 'CORS_FORBIDDEN');
        });

        test('1.3 Non-browser request without Origin header (server-to-server/curl) succeeds', async () => {
            process.env.NODE_ENV = 'production';
            process.env.FRONTEND_URL = 'https://app.fieldwise.agri';

            const res = await invokeExpress('GET', '/api/health', null, {});
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            // No Origin header sent -> no Access-Control-Allow-Origin header reflected
            assert.equal(res.headers['access-control-allow-origin'], undefined);
        });

        test('1.4 Localhost origin is accepted in development mode', async () => {
            process.env.NODE_ENV = 'development';
            delete process.env.FRONTEND_URL;

            const res = await invokeExpress('OPTIONS', '/api/health', null, {
                origin: 'http://localhost:5174',
                'access-control-request-method': 'GET',
            });

            assert.equal(res.status, 204);
            assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5174');
        });

        test('1.5 Localhost origin is rejected in production unless explicitly in FRONTEND_URL', async () => {
            process.env.NODE_ENV = 'production';
            process.env.FRONTEND_URL = 'https://production.fieldwise.agri';

            const res = await invokeExpress('GET', '/api/health', null, {
                origin: 'http://localhost:5174',
            });

            assert.equal(res.status, 403);
            assert.equal(res.body.error.code, 'CORS_FORBIDDEN');
        });
    });

    // ── 2. JWT & Startup Validation ──────────────────────────────────────────
    describe('2. JWT Secret & Startup Validation Hardening', () => {
        test('2.1 Startup validation fails when JWT_SECRET is missing', () => {
            assert.throws(() => {
                validateStartupConfig({ NODE_ENV: 'production', JWT_SECRET: '' });
            }, /Mandatory environment variable JWT_SECRET is missing/);
        });

        test('2.2 Startup validation fails in production if JWT_SECRET < 32 characters', () => {
            assert.throws(() => {
                validateStartupConfig({
                    NODE_ENV: 'production',
                    JWT_SECRET: 'short-16-char-sec',
                });
            }, /JWT_SECRET must be at least 32 characters long/);
        });

        test('2.3 Startup validation fails in production for known placeholder secret', () => {
            assert.throws(() => {
                validateStartupConfig({
                    NODE_ENV: 'production',
                    JWT_SECRET: 'your-super-secret-key-change-in-production',
                });
            }, /Insecure placeholder detected in JWT_SECRET/);
        });

        test('2.4 Startup validation passes with a secure 256-bit secret in production', () => {
            const strongSecret = 'a'.repeat(32);
            const isValid = validateStartupConfig({
                NODE_ENV: 'production',
                JWT_SECRET: strongSecret,
                ENABLE_V2_CLOUD_PERSISTENCE: 'false',
            });
            assert.equal(isValid, true);
        });

        test('2.5 authMiddleware rejects with 500 AUTH_CONFIG_ERROR when JWT_SECRET is unset', () => {
            const orig = process.env.JWT_SECRET;
            delete process.env.JWT_SECRET;

            const req = { headers: { authorization: 'Bearer some.test.token' } };
            let statusCalled = null;
            let jsonCalled = null;
            const res = {
                status(code) { statusCalled = code; return this; },
                json(payload) { jsonCalled = payload; return this; },
            };

            authMiddleware(req, res, () => {});

            process.env.JWT_SECRET = orig;
            assert.equal(statusCalled, 500);
            assert.equal(jsonCalled.error.code, 'AUTH_CONFIG_ERROR');
        });

        test('2.6 optionalAuth rejects with 500 AUTH_CONFIG_ERROR when JWT_SECRET is unset (zero fallback)', () => {
            const orig = process.env.JWT_SECRET;
            delete process.env.JWT_SECRET;

            const req = { headers: { authorization: 'Bearer some.test.token' } };
            let statusCalled = null;
            let jsonCalled = null;
            const res = {
                status(code) { statusCalled = code; return this; },
                json(payload) { jsonCalled = payload; return this; },
            };

            optionalAuth(req, res, () => {});

            process.env.JWT_SECRET = orig;
            assert.equal(statusCalled, 500);
            assert.equal(jsonCalled.error.code, 'AUTH_CONFIG_ERROR');
        });

        test('2.7 Valid token signed with configured secret authenticates cleanly', () => {
            const secret = 'valid-test-secret-key-for-test-32chars';
            const orig = process.env.JWT_SECRET;
            process.env.JWT_SECRET = secret;

            const token = jwt.sign({ id: 42, email: 'farmer@fieldwise.agri', name: 'Farmer' }, secret);
            const req = { headers: { authorization: `Bearer ${token}` } };
            let nextCalled = false;
            const res = {};

            authMiddleware(req, res, () => {
                nextCalled = true;
            });

            process.env.JWT_SECRET = orig;
            assert.equal(nextCalled, true);
            assert.equal(req.user.id, 42);
        });
    });

    // ── 3. Rate Limiter Middleware ───────────────────────────────────────────
    describe('3. Rate Limiting Middleware Enforcement', () => {
        test('3.1 Enforces rate limit and emits HTTP 429 when max requests exceeded', () => {
            const store = new InMemoryRateLimitStore();
            const limiter = createRateLimiter({
                windowMs: 60000,
                maxRequests: 2,
                keyPrefix: 'test_limit',
                store,
            });

            const req = { ip: '127.0.0.1', headers: {}, socket: { remoteAddress: '127.0.0.1' } };
            const headers = {};
            let statusCalled = null;
            let jsonCalled = null;

            const res = {
                setHeader(k, v) { headers[k] = v; },
                status(s) { statusCalled = s; return this; },
                json(j) { jsonCalled = j; return this; },
            };

            // Request 1: Allowed
            let next1 = false;
            limiter(req, res, () => { next1 = true; });
            assert.equal(next1, true);
            assert.equal(headers['X-RateLimit-Remaining'], 1);

            // Request 2: Allowed
            let next2 = false;
            limiter(req, res, () => { next2 = true; });
            assert.equal(next2, true);
            assert.equal(headers['X-RateLimit-Remaining'], 0);

            // Request 3: Blocked (Limit 2 exceeded)
            let next3 = false;
            limiter(req, res, () => { next3 = true; });
            assert.equal(next3, false);
            assert.equal(statusCalled, 429);
            assert.equal(jsonCalled.error.code, 'RATE_LIMIT_EXCEEDED');
            assert.ok(headers['Retry-After'] >= 1);

            store.destroy();
        });

        test('3.2 Unaffected requests below limit proceed normally', () => {
            const store = new InMemoryRateLimitStore();
            const limiter = createRateLimiter({
                windowMs: 60000,
                maxRequests: 5,
                keyPrefix: 'test_normal',
                store,
            });

            const req = { ip: '192.168.1.100', headers: {}, socket: { remoteAddress: '192.168.1.100' } };
            const headers = {};
            const res = { setHeader(k, v) { headers[k] = v; } };

            let count = 0;
            for (let i = 0; i < 4; i++) {
                limiter(req, res, () => { count++; });
            }

            assert.equal(count, 4);
            assert.equal(headers['X-RateLimit-Remaining'], 1);
            store.destroy();
        });
    });
});
