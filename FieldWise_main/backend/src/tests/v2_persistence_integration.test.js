/**
 * FieldWise Phase 3C.6.4.2.3: V2 Persistence & Security Integration Tests
 * ======================================================================
 * Tests:
 *   1. Invalid Token Rejection: Malformed token is rejected by authMiddleware.
 *   2. Valid Authenticated Prediction: Valid token is parsed and engine succeeds.
 *   3. Client-Supplied Farmer ID Ignored: Server enforces token identity, ignoring body farmer_id.
 *   4. Unknown Farmer Mapping Rejection: Unresolvable farmer identity rejects persistence.
 *   5. Cross-Farmer Isolation: Farmer A cannot query or collide with Farmer B's records.
 *   6. Service-Role Isolation: Service-role credentials absent from frontend build assets.
 *   7. Idempotency Same-Key Same-Hash Retry: Returns cached result with 200 OK.
 *   8. Idempotency Same-Key Different-Hash Conflict: Returns HTTP 409 Conflict.
 *   9. Concurrent Duplicate Submission: Exactly one record persisted during concurrent race.
 *   10. Different Farmers Same Key: Independent persistence without collision.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');

const app = require('../server');
const { setSupabaseClient, resetSupabaseClient } = require('../config/supabaseClient');
const {
    checkCachedRecommendation,
    persistRecommendation,
    IdempotencyConflictError,
    UnauthenticatedPersistenceError,
} = require('../services/v2/recommendationPersistenceService');

const JWT_SECRET = process.env.JWT_SECRET || 'fieldwise-test-only-deterministic-jwt-secret-do-not-use-in-production-2026';

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
            if (chunk) {
                resBody += chunk.toString();
            }
            return originalWrite.call(res, chunk, encoding, callback);
        };

        const originalEnd = res.end;
        res.end = function (chunk, encoding, callback) {
            if (chunk) {
                resBody += chunk.toString();
            }
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

function createMockSupabaseClient() {
    const tableData = [];
    const farmersData = [];
    return {
        _tableData: tableData,
        _farmersData: farmersData,
        from(tableName) {
            if (tableName === 'farmers') {
                return {
                    upsert(farmerRecord, opts = {}) {
                        const existingIdx = farmersData.findIndex((f) => f.id === farmerRecord.id);
                        if (existingIdx >= 0) {
                            if (opts.ignoreDuplicates) {
                                return Promise.resolve({ data: [farmersData[existingIdx]], error: null });
                            }
                            farmersData[existingIdx] = Object.assign({}, farmersData[existingIdx], farmerRecord);
                        } else {
                            farmersData.push(Object.assign({}, farmerRecord));
                        }
                        return Promise.resolve({ data: [farmerRecord], error: null });
                    },
                    select() {
                        const filters = [];
                        const queryObj = {
                            eq(col, val) {
                                filters.push({ col, val });
                                return queryObj;
                            },
                            limit(n) {
                                let results = farmersData.filter((row) =>
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
            return {
                select() {
                    const filters = [];
                    const queryObj = {
                        eq(col, val) {
                            filters.push({ col, val });
                            return queryObj;
                        },
                        limit(n) {
                            let results = tableData.filter((row) =>
                                filters.every((f) => row[f.col] === f.val)
                            );
                            if (n) results = results.slice(0, n);
                            return Promise.resolve({ data: results, error: null });
                        },
                        then(resolve, reject) {
                            return this.limit().then(resolve, reject);
                        },
                    };
                    function valForCol(row, col, expected) {
                        return row[col] === expected;
                    }
                    return queryObj;
                },
                insert(record) {
                    return {
                        select() {
                            const collision = tableData.find(
                                (r) =>
                                    r.farmer_id === record.farmer_id &&
                                    r.idempotency_key === record.idempotency_key
                            );
                            if (collision) {
                                return Promise.resolve({
                                    data: null,
                                    error: {
                                        code: '23505',
                                        message: 'duplicate key value violates unique constraint "uq_v2_rec_farmer_idempotency"',
                                    },
                                });
                            }
                            const saved = Object.assign({ id: crypto.randomUUID() }, record);
                            tableData.push(saved);
                            return Promise.resolve({ data: [saved], error: null });
                        },
                    };
                },
            };
        },
    };
}

describe('Phase 3C.6.4.2.3: Comprehensive V2 Persistence & Security Tests', () => {
    const farmer1 = { id: 'farmer_sec_01', email: 'f1@fieldwise.agri', name: 'Farmer 1' };
    const farmer2 = { id: 'farmer_sec_02', email: 'f2@fieldwise.agri', name: 'Farmer 2' };

    const tokenFarmer1 = generateTestToken(farmer1);
    const tokenFarmer2 = generateTestToken(farmer2);

    const mockGlobalClient = createMockSupabaseClient();
    setSupabaseClient(mockGlobalClient);

    const validPayload = {
        state: 'Punjab',
        district: 'Ludhiana',
        sowing_month: 10,
        irrigation_access: 'Tubewell_Borewell',
        irrigation_water_quantity_mm: 350.0,
        seasonal_rainfall_amount: 100.0,
        temperature: 24.0,
        humidity: 65.0,
        soil_texture: 'Sandy Loam',
        soil_ph: 7.2,
        has_soil_test: true,
        nitrogen: 120.0,
        phosphorus: 45.0,
        potassium: 150.0,
    };

    test('1. Missing / Invalid Token Rejection on Protected Endpoint', async () => {
        // Test protected route /api/auth/me rejects missing/invalid token
        const resMissing = await invokeExpress('GET', '/api/auth/me', null, {});
        assert.equal(resMissing.status, 401);

        const resInvalid = await invokeExpress('GET', '/api/auth/me', null, {
            authorization: 'Bearer bad.token.value',
        });
        assert.equal(resInvalid.status, 401);
    });

    test('2. Valid Authenticated Prediction', async () => {
        const res = await invokeExpress('POST', '/api/v2/predict', validPayload, {
            authorization: `Bearer ${tokenFarmer1}`,
        });
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.status, 'SUCCESS');
    });

    test('3. Client-Supplied Farmer ID is Ignored (Server Enforces Token Identity)', async () => {
        const idempotencyKey = crypto.randomUUID();
        const forgedPayload = Object.assign({}, validPayload, {
            farmer_id: 'attacker_target_farmer',
        });

        const res = await invokeExpress('POST', '/api/v2/predict', forgedPayload, {
            authorization: `Bearer ${tokenFarmer1}`,
            'idempotency-key': idempotencyKey,
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.persisted_record_id);
        const persisted = mockGlobalClient._tableData.find((r) => r.id === res.body.persisted_record_id);
        assert.ok(persisted, 'Record should be persisted in database');
        assert.equal(persisted.farmer_id, farmer1.id, 'Persisted record MUST use server-verified token farmer_id');
        assert.notEqual(persisted.farmer_id, 'attacker_target_farmer', 'Persisted record MUST NOT use forged client farmer_id');
    });

    test('4. Unknown Farmer Mapping Rejection: Missing identity rejects persistence', async () => {
        const client = createMockSupabaseClient();
        await assert.rejects(
            async () => {
                await persistRecommendation({
                    verifiedFarmerId: null, // Unknown/unmapped
                    idempotencyKey: crypto.randomUUID(),
                    requestPayload: validPayload,
                    engineResult: { status: 'SUCCESS', recommendations: [] },
                    supabaseClient: client,
                });
            },
            (err) => {
                assert.ok(err instanceof UnauthenticatedPersistenceError);
                assert.equal(err.statusCode, 401);
                return true;
            }
        );
    });

    test('5. Cross-Farmer Isolation: Farmer A cannot query or overwrite Farmer B records', async () => {
        const client = createMockSupabaseClient();
        const sharedKey = crypto.randomUUID();
        const engineResult = { status: 'SUCCESS', recommendations: [{ crop: 'rice', suitability_score: 95 }] };

        // Farmer 1 saves record
        const res1 = await persistRecommendation({
            verifiedFarmerId: farmer1.id,
            farmerEmail: farmer1.email,
            idempotencyKey: sharedKey,
            requestPayload: validPayload,
            engineResult,
            supabaseClient: client,
        });

        // Farmer 2 attempts to query or save with same key
        const cachedForFarmer2 = await checkCachedRecommendation({
            verifiedFarmerId: farmer2.id,
            idempotencyKey: sharedKey,
            requestPayload: validPayload,
            supabaseClient: client,
        });
        assert.equal(cachedForFarmer2, null, 'Farmer 2 must not see Farmer 1 cached record');

        // Farmer 2 saves independent record
        const res2 = await persistRecommendation({
            verifiedFarmerId: farmer2.id,
            farmerEmail: farmer2.email,
            idempotencyKey: sharedKey,
            requestPayload: validPayload,
            engineResult,
            supabaseClient: client,
        });

        assert.notEqual(res1.record.id, res2.record.id);
        assert.equal(client._tableData.length, 2);
    });

    test('6. Service-Role Credentials Absent from Frontend Build Assets', async () => {
        const distDir = path.resolve(__dirname, '../../../dist');
        if (fs.existsSync(distDir)) {
            const files = fs.readdirSync(path.join(distDir, 'assets'));
            for (const file of files) {
                if (file.endsWith('.js')) {
                    const content = fs.readFileSync(path.join(distDir, 'assets', file), 'utf8');
                    assert.ok(!content.includes('SUPABASE_SERVICE_ROLE_KEY'), `Found SUPABASE_SERVICE_ROLE_KEY in ${file}`);
                    assert.ok(!content.includes('service_role'), `Found service_role in ${file}`);
                }
            }
        }
    });

    test('7. Same-Key / Same-Hash Retry Returns Existing Stored Result (200 OK, Replay)', async () => {
        const client = createMockSupabaseClient();
        const key = crypto.randomUUID();
        const engineResult = { status: 'SUCCESS', recommendations: [{ crop: 'rice', suitability_score: 95 }] };

        const first = await persistRecommendation({
            verifiedFarmerId: farmer1.id,
            farmerEmail: farmer1.email,
            idempotencyKey: key,
            requestPayload: validPayload,
            engineResult,
            supabaseClient: client,
        });
        assert.equal(first.isReplay, false);

        const cached = await checkCachedRecommendation({
            verifiedFarmerId: farmer1.id,
            idempotencyKey: key,
            requestPayload: validPayload,
            supabaseClient: client,
        });
        assert.ok(cached);
        assert.equal(cached.isReplay, true);
        assert.equal(cached.record.id, first.record.id);
    });

    test('8. Same-Key / Different-Hash Conflict Returns HTTP 409 Conflict', async () => {
        const client = createMockSupabaseClient();
        const key = crypto.randomUUID();
        const engineResult = { status: 'SUCCESS', recommendations: [{ crop: 'rice', suitability_score: 95 }] };

        await persistRecommendation({
            verifiedFarmerId: farmer1.id,
            farmerEmail: farmer1.email,
            idempotencyKey: key,
            requestPayload: validPayload,
            engineResult,
            supabaseClient: client,
        });

        const alteredPayload = Object.assign({}, validPayload, { nitrogen: 300.0 });

        await assert.rejects(
            async () => {
                await checkCachedRecommendation({
                    verifiedFarmerId: farmer1.id,
                    idempotencyKey: key,
                    requestPayload: alteredPayload,
                    supabaseClient: client,
                });
            },
            (err) => {
                assert.ok(err instanceof IdempotencyConflictError);
                assert.equal(err.code, 'IDEMPOTENCY_KEY_MUTATION');
                return true;
            }
        );
    });

    test('9. Concurrent Duplicate Submission: Exactly One Persisted Record', async () => {
        const client = createMockSupabaseClient();
        const key = crypto.randomUUID();
        const engineResult = { status: 'SUCCESS', recommendations: [{ crop: 'rice', suitability_score: 95 }] };

        // 10 concurrent insertion attempts
        const promises = Array.from({ length: 10 }, () =>
            persistRecommendation({
                verifiedFarmerId: farmer1.id,
                farmerEmail: farmer1.email,
                idempotencyKey: key,
                requestPayload: validPayload,
                engineResult,
                supabaseClient: client,
            })
        );

        const results = await Promise.all(promises);
        for (const r of results) {
            assert.ok(r.record);
        }

        const matches = client._tableData.filter(
            (r) => r.farmer_id === farmer1.id && r.idempotency_key === key
        );
        assert.equal(matches.length, 1, 'Exactly one record persisted in database');
    });

    test('10. Different Farmers Using Same Key Persist Independently', async () => {
        const client = createMockSupabaseClient();
        const key = crypto.randomUUID();
        const engineResult = { status: 'SUCCESS', recommendations: [{ crop: 'rice', suitability_score: 95 }] };

        const r1 = await persistRecommendation({
            verifiedFarmerId: 'farmer_A',
            farmerEmail: 'farmer_a@fieldwise.agri',
            idempotencyKey: key,
            requestPayload: validPayload,
            engineResult,
            supabaseClient: client,
        });

        const r2 = await persistRecommendation({
            verifiedFarmerId: 'farmer_B',
            farmerEmail: 'farmer_b@fieldwise.agri',
            idempotencyKey: key, // Same key!
            requestPayload: validPayload,
            engineResult,
            supabaseClient: client,
        });

        assert.equal(r1.isReplay, false);
        assert.equal(r2.isReplay, false);
        assert.notEqual(r1.record.id, r2.record.id);
        assert.equal(client._tableData.length, 2);
    });

    test('11. Guest V2 Prediction: Valid prediction without farmer-owned persistence', async () => {
        const preCount = mockGlobalClient._tableData.length;
        const res = await invokeExpress('POST', '/api/v2/predict', validPayload, {}); // No token!

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.status, 'SUCCESS');
        assert.equal(res.body.persisted_record_id, undefined, 'Guest prediction MUST NOT return persisted_record_id');
        assert.equal(mockGlobalClient._tableData.length, preCount, 'Guest prediction MUST NOT insert any record');
    });

    test('12. Ambiguous Identity Token Rejection (HTTP 401 AMBIGUOUS_FARMER_IDENTITY)', async () => {
        const ambiguousToken = jwt.sign(
            {
                farmer_id: 'farmer_alice',
                sub: 'farmer_bob', // Conflicting claims!
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const res = await invokeExpress('POST', '/api/v2/predict', validPayload, {
            authorization: `Bearer ${ambiguousToken}`,
        });

        assert.equal(res.status, 401);
        assert.equal(res.body.success, false);
        assert.equal(res.body.error.code, 'AMBIGUOUS_FARMER_IDENTITY');
    });

    test('13. Unknown Identity Token Rejection (HTTP 401 UNKNOWN_FARMER_IDENTITY)', async () => {
        const unknownToken = jwt.sign(
            {
                email: 'ghost@fieldwise.agri',
                role: 'visitor', // No farmer_id, sub, id, or uid
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const res = await invokeExpress('POST', '/api/v2/predict', validPayload, {
            authorization: `Bearer ${unknownToken}`,
        });

        assert.equal(res.status, 401);
        assert.equal(res.body.success, false);
        assert.equal(res.body.error.code, 'UNKNOWN_FARMER_IDENTITY');
    });

    test('14. Expired Token Rejection (HTTP 401 Invalid or expired authentication token)', async () => {
        const expiredToken = jwt.sign(
            {
                farmer_id: farmer1.id,
                email: farmer1.email,
            },
            JWT_SECRET,
            { expiresIn: -10 } // Expired 10 seconds ago
        );

        const res = await invokeExpress('POST', '/api/v2/predict', validPayload, {
            authorization: `Bearer ${expiredToken}`,
        });

        assert.equal(res.status, 401);
        assert.equal(res.body.success, false);
    });

    test('15. Authentication-provider UID without farmer mapping is rejected (HTTP 401 UNMAPPED_PROVIDER_UID)', async () => {
        const rawProviderToken = jwt.sign(
            {
                uid: 'firebase_unmapped_provider_uid_12345',
                email: 'external@google.com',
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const res = await invokeExpress('POST', '/api/v2/predict', validPayload, {
            authorization: `Bearer ${rawProviderToken}`,
        });

        assert.equal(res.status, 401);
        assert.equal(res.body.success, false);
        assert.equal(res.body.error.code, 'UNMAPPED_PROVIDER_UID');
    });

    test('16. Unrelated Provider Token Rejection at Express Boundary', async () => {
        // An unrelated provider token (e.g. Firebase ID token or Supabase anon token)
        // passed to the backend without backend HMAC signature is rejected with 401
        const res = await invokeExpress('POST', '/api/v2/predict', validPayload, {
            authorization: 'Bearer unrelated.provider.token.value',
        });

        assert.equal(res.status, 401);
        assert.equal(res.body.success, false);
    });

    test('17. Server-Side Parent Farmer Synchronization on Prediction Persistence', async () => {
        const syncFarmer = { id: 'farmer_sync_verified_01', email: 'verified@fieldwise.agri', name: 'Verified Partner' };
        const syncToken = generateTestToken(syncFarmer);
        const idempotencyKey = crypto.randomUUID();

        // Prediction via Express route
        const res = await invokeExpress('POST', '/api/v2/predict', validPayload, {
            authorization: `Bearer ${syncToken}`,
            'idempotency-key': idempotencyKey,
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.persisted_record_id);

        // Verify parent farmer row was automatically upserted into public.farmers
        const parentFarmer = mockGlobalClient._farmersData.find(f => f.id === syncFarmer.id);
        assert.ok(parentFarmer, 'Parent farmer record must exist in public.farmers');
        assert.equal(parentFarmer.email, syncFarmer.email);
        assert.equal(parentFarmer.full_name, syncFarmer.name);

        // Verify recommendation record references this farmer
        const rec = mockGlobalClient._tableData.find(r => r.id === res.body.persisted_record_id);
        assert.ok(rec);
        assert.equal(rec.farmer_id, syncFarmer.id);
    });
});
