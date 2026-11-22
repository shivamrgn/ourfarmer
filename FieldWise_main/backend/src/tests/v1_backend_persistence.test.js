/**
 * FieldWise Phase 3A.2: V1 Backend Persistence Integration Tests
 * ================================================================
 * Validates backend-mediated persistence endpoints for V1:
 *   - /api/farm-profile (POST/GET)
 *   - /api/farmer/sync (POST) and /api/farmer/profile (GET)
 *   - /api/predict/save (POST) and /api/predict/history (GET)
 *
 * Invariants Verified:
 *   1. Authentication Gate: Unauthenticated requests return HTTP 401.
 *   2. Identity Ownership: Farmer identity derived strictly from verified JWT token.
 *      Caller-supplied IDs in body or params are ignored.
 *   3. Cross-Tenant Isolation: Farmer A cannot query or mutate Farmer B's data.
 *   4. Cloud Service-Role Mediation: Mock service-role client persists data accurately.
 *   5. Backward-Compatible Calculation: POST /api/predict computation remains operational.
 */

if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'fieldwise-test-only-deterministic-jwt-secret-do-not-use-in-production-2026';
}

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const http = require('http');

const app = require('../server');
const { setSupabaseClient, resetSupabaseClient } = require('../config/supabaseClient');

const JWT_SECRET = process.env.JWT_SECRET;

function generateTestToken(farmer) {
    return jwt.sign(
        {
            id: farmer.id,
            farmer_id: farmer.id,
            email: farmer.email,
            name: farmer.name,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

function invokeExpress(method, url, body, headers = {}) {
    return new Promise((resolve) => {
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

        const bodyStr = typeof body === 'string'
            ? body
            : (body !== null && body !== undefined ? JSON.stringify(body) : null);

        if (bodyStr) {
            req.headers['content-length'] = Buffer.byteLength(bodyStr);
        }

        app(req, res);
        if (bodyStr) {
            req.push(bodyStr);
        }
        req.push(null);
    });
}

function createMockV1SupabaseClient() {
    const farmers = [];
    const farmProfiles = [];
    const cropPredictions = [];

    return {
        _farmers: farmers,
        _farmProfiles: farmProfiles,
        _cropPredictions: cropPredictions,
        from(tableName) {
            if (tableName === 'farmers') {
                return {
                    upsert(record, opts = {}) {
                        const existingIdx = farmers.findIndex((f) => f.id === record.id);
                        if (existingIdx >= 0) {
                            if (!opts.ignoreDuplicates) {
                                farmers[existingIdx] = Object.assign({}, farmers[existingIdx], record);
                            }
                        } else {
                            farmers.push(Object.assign({}, record));
                        }
                        return Promise.resolve({ data: [record], error: null });
                    },
                    update(updatePayload) {
                        const filters = [];
                        const updateObj = {
                            eq(col, val) {
                                filters.push({ col, val });
                                return updateObj;
                            },
                            select() {
                                const matching = farmers.filter((f) => filters.every((filter) => f[filter.col] === filter.val));
                                matching.forEach((f) => Object.assign(f, updatePayload));
                                return Promise.resolve({ data: matching, error: null });
                            },
                        };
                        return updateObj;
                    },
                    select() {
                        const filters = [];
                        const queryObj = {
                            eq(col, val) {
                                filters.push({ col, val });
                                return queryObj;
                            },
                            limit(n) {
                                let results = farmers.filter((row) =>
                                    filters.every((f) => row[f.col] === f.val)
                                );
                                if (n) results = results.slice(0, n);
                                return Promise.resolve({ data: results, error: null });
                            },
                            maybeSingle() {
                                const found = farmers.find((f) => filters.every((filter) => f[filter.col] === filter.val));
                                return Promise.resolve({ data: found || null, error: null });
                            },
                            then(resolve, reject) {
                                return this.limit().then(resolve, reject);
                            },
                        };
                        return queryObj;
                    },
                };
            }

            if (tableName === 'farm_profiles') {
                return {
                    insert(record) {
                        const id = record.id || `fp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                        const persisted = Object.assign({ id }, record);
                        farmProfiles.push(persisted);
                        return {
                            select() {
                                return Promise.resolve({ data: [persisted], error: null });
                            },
                        };
                    },
                    update(updatePayload) {
                        const filters = [];
                        const updateObj = {
                            eq(col, val) {
                                filters.push({ col, val });
                                return updateObj;
                            },
                            select() {
                                const matching = farmProfiles.filter((fp) => filters.every((filter) => fp[filter.col] === filter.val));
                                matching.forEach((fp) => Object.assign(fp, updatePayload));
                                return Promise.resolve({ data: matching, error: null });
                            },
                        };
                        return updateObj;
                    },
                    upsert(record, opts = {}) {
                        const existingIdx = farmProfiles.findIndex((fp) => fp.farmer_id === record.farmer_id);
                        if (existingIdx >= 0) {
                            farmProfiles[existingIdx] = Object.assign({}, farmProfiles[existingIdx], record);
                        } else {
                            farmProfiles.push(Object.assign({ id: `fp_${Date.now()}` }, record));
                        }
                        const saved = farmProfiles.find((fp) => fp.farmer_id === record.farmer_id);
                        return {
                            select() {
                                return Promise.resolve({ data: saved ? [saved] : [record], error: null });
                            },
                        };
                    },
                    select() {
                        const filters = [];
                        const queryObj = {
                            eq(col, val) {
                                filters.push({ col, val });
                                return queryObj;
                            },
                            order(col, opts = {}) {
                                return queryObj;
                            },
                            maybeSingle() {
                                const found = farmProfiles.find((fp) => filters.every((filter) => fp[filter.col] === filter.val));
                                return Promise.resolve({ data: found || null, error: null });
                            },
                            limit(n) {
                                let results = farmProfiles.filter((row) =>
                                    filters.every((f) => row[f.col] === f.val)
                                );
                                if (n) results = results.slice(0, n);
                                return Promise.resolve({ data: results, error: null });
                            },
                            then(resolve, reject) {
                                return this.limit().then(resolve, reject);
                            },
                        };
                        return queryObj;
                    },
                };
            }

            if (tableName === 'crop_predictions') {
                return {
                    insert(record) {
                        const persisted = Object.assign(
                            { id: `pred_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, created_at: new Date().toISOString() },
                            record
                        );
                        cropPredictions.push(persisted);
                        return {
                            select() {
                                return Promise.resolve({ data: [persisted], error: null });
                            },
                        };
                    },
                    select() {
                        const filters = [];
                        let sortAsc = false;
                        const queryObj = {
                            eq(col, val) {
                                filters.push({ col, val });
                                return queryObj;
                            },
                            order(col, opts = {}) {
                                sortAsc = opts.ascending === true;
                                return queryObj;
                            },
                            limit(n) {
                                const matched = cropPredictions.filter((cp) => filters.every((f) => cp[f.col] === f.val));
                                return Promise.resolve({ data: matched.slice(0, n), error: null });
                            },
                            then(resolve, reject) {
                                return this.limit(50).then(resolve, reject);
                            },
                        };
                        return queryObj;
                    },
                };
            }

            throw new Error(`Unexpected table in mock: ${tableName}`);
        },
    };
}

describe('FieldWise Phase 3A.2: V1 Backend-Mediated Persistence Tests', () => {
    let mockClient;

    const farmerA = {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'farmer.a@fieldwise.org',
        name: 'Ramesh Patel',
    };

    const farmerB = {
        id: '22222222-2222-4222-8222-222222222222',
        email: 'farmer.b@fieldwise.org',
        name: 'Suresh Kumar',
    };

    beforeEach(() => {
        mockClient = createMockV1SupabaseClient();
        setSupabaseClient(mockClient);
    });

    afterEach(() => {
        resetSupabaseClient();
    });

    // ── 1. Unauthenticated Requests Rejected (401) ───────────────────────────
    test('1. Unauthenticated requests to V1 persistence endpoints are rejected with 401', async () => {
        const endpoints = [
            { method: 'POST', url: '/api/farm-profile', body: { farmSize: 5 } },
            { method: 'GET', url: '/api/farm-profile', body: null },
            { method: 'POST', url: '/api/farmer/sync', body: { name: 'Unauthorized' } },
            { method: 'GET', url: '/api/farmer/profile', body: null },
            { method: 'POST', url: '/api/predict/save', body: { predicted_crop: 'Wheat' } },
            { method: 'GET', url: '/api/predict/history', body: null },
        ];

        for (const ep of endpoints) {
            const res = await invokeExpress(ep.method, ep.url, ep.body);
            assert.strictEqual(res.status, 401, `Expected 401 for ${ep.method} ${ep.url}, got ${res.status}`);
        }
    });

    // ── 2. Farmer Registration & Sync ─────────────────────────────────────────
    test('2. Farmer sync successfully anchors record in public.farmers', async () => {
        const tokenA = generateTestToken(farmerA);

        const res = await invokeExpress('POST', '/api/farmer/sync', {
            phone: '+919876543210',
            location: 'Nashik, Maharashtra',
            farm_size: 12.5,
        }, { authorization: `Bearer ${tokenA}` });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.farmer.id, farmerA.id);

        // Verify stored in mock database
        const storedFarmer = mockClient._farmers.find((f) => f.id === farmerA.id);
        assert.ok(storedFarmer, 'Farmer A must be saved in database');
        assert.strictEqual(storedFarmer.email, farmerA.email);
        assert.strictEqual(storedFarmer.location, 'Nashik, Maharashtra');
    });

    // ── 3. Farm Profile Save and Fetch ────────────────────────────────────────
    test('3. Farm profile save and fetch correctly persists under authenticated farmer identity', async () => {
        const tokenA = generateTestToken(farmerA);

        const saveRes = await invokeExpress('POST', '/api/farm-profile', {
            state: 'Maharashtra',
            district: 'Nagpur',
            soilType: 'Black Soil',
            irrigationType: 'Drip',
            farmName: 'Patel Organic Farm',
        }, { authorization: `Bearer ${tokenA}` });

        assert.strictEqual(saveRes.status, 200);
        assert.strictEqual(saveRes.body.success, true);
        assert.strictEqual(saveRes.body.profile.farmer_id, farmerA.id);
        assert.strictEqual(saveRes.body.profile.state, 'Maharashtra');
        assert.strictEqual(saveRes.body.profile.soil_type, 'Black Soil');
        assert.strictEqual(saveRes.body.profile.farm_name, 'Patel Organic Farm');

        // Fetch back
        const fetchRes = await invokeExpress('GET', '/api/farm-profile', null, {
            authorization: `Bearer ${tokenA}`,
        });

        assert.strictEqual(fetchRes.status, 200);
        assert.strictEqual(fetchRes.body.success, true);
        assert.strictEqual(fetchRes.body.profile.farmer_id, farmerA.id);
        assert.strictEqual(fetchRes.body.profile.district, 'Nagpur');
    });

    // ── 4. Client-Supplied Farmer ID is Ignored ──────────────────────────────
    test('4. Client-supplied farmer_id in body is completely ignored and overridden by JWT', async () => {
        const tokenA = generateTestToken(farmerA);

        const res = await invokeExpress('POST', '/api/farm-profile', {
            farmer_id: farmerB.id, // Attacker trying to overwrite Farmer B's profile
            farmSize: 999,
            soilType: 'Injected Soil',
        }, { authorization: `Bearer ${tokenA}` });

        assert.strictEqual(res.status, 200);
        // Stored under Farmer A, NEVER Farmer B
        assert.strictEqual(res.body.profile.farmer_id, farmerA.id);
        const attackerRecord = mockClient._farmProfiles.find((fp) => fp.farmer_id === farmerB.id);
        assert.strictEqual(attackerRecord, undefined, 'Farmer B profile must not be touched by Farmer A');
    });

    // ── 5. Cross-Tenant Isolation ─────────────────────────────────────────────
    test('5. Cross-tenant isolation: Farmer A cannot view Farmer B farm profile or prediction history', async () => {
        const tokenA = generateTestToken(farmerA);
        const tokenB = generateTestToken(farmerB);

        // Farmer B saves a profile and prediction
        await invokeExpress('POST', '/api/farm-profile', {
            farmSize: 20,
            soilType: 'Alluvial',
            location: 'Punjab',
        }, { authorization: `Bearer ${tokenB}` });

        await invokeExpress('POST', '/api/predict/save', {
            predicted_crop: 'Wheat',
            confidence_score: 95,
        }, { authorization: `Bearer ${tokenB}` });

        // Farmer A queries farm profile
        const profileResA = await invokeExpress('GET', '/api/farm-profile', null, {
            authorization: `Bearer ${tokenA}`,
        });
        assert.strictEqual(profileResA.body.profile, null, 'Farmer A must not see Farmer B profile');

        // Farmer A queries prediction history
        const historyResA = await invokeExpress('GET', '/api/predict/history', null, {
            authorization: `Bearer ${tokenA}`,
        });
        assert.strictEqual(historyResA.body.count, 0, 'Farmer A must see 0 predictions');

        // Farmer B queries prediction history
        const historyResB = await invokeExpress('GET', '/api/predict/history', null, {
            authorization: `Bearer ${tokenB}`,
        });
        assert.strictEqual(historyResB.body.count, 1, 'Farmer B must see their own prediction');
        assert.strictEqual(historyResB.body.history[0].recommended_crop, 'Wheat');
    });

    // ── 6. Crop Prediction Ledger Persistence ────────────────────────────────
    test('6. POST /api/predict/save records prediction to ledger with parent anchoring', async () => {
        const tokenA = generateTestToken(farmerA);

        const saveRes = await invokeExpress('POST', '/api/predict/save', {
            predicted_crop: 'Chickpea',
            confidence_score: 88,
            confidence: 88,
            input_features: { N: 40, P: 50, K: 40, temperature: 24, humidity: 60, ph: 6.8, rainfall: 120 },
            nitrogen: 40,
            phosphorus: 50,
            potassium: 40,
            temperature: 24,
            humidity: 60,
            ph: 6.8,
            rainfall: 120,
        }, { authorization: `Bearer ${tokenA}` });

        assert.strictEqual(saveRes.status, 200);
        assert.strictEqual(saveRes.body.success, true);
        assert.strictEqual(saveRes.body.prediction.farmer_id, farmerA.id);
        assert.strictEqual(saveRes.body.prediction.recommended_crop, 'Chickpea');

        // Parent farmer record must have been anchored
        const farmerExists = mockClient._farmers.some((f) => f.id === farmerA.id);
        assert.strictEqual(farmerExists, true, 'Parent farmer record must exist');
    });

    // ── 7. Backward Compatibility: POST /api/predict Computation ─────────────
    test('7. Backward compatibility: POST /api/predict computes crop recommendation without breaking', async () => {
        const res = await invokeExpress('POST', '/api/predict', {
            nitrogen: 50,
            phosphorus: 50,
            potassium: 50,
            temperature: 25,
            humidity: 70,
            ph: 6.5,
            rainfall: 150,
            soilType: 'Loamy',
        });

        assert.strictEqual(res.status, 200);
        assert.ok(res.body.predictions && res.body.predictions.length > 0, 'Must return predictions array');
        assert.strictEqual(res.body.success, true);
    });
});
