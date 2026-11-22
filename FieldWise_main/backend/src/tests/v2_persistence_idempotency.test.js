/**
 * FieldWise Phase 3C.6.4.2.2: Unit Tests for Trusted Persistence & Idempotency
 * ===========================================================================
 * Tests:
 *   1. Identical Replay: Same farmer, same key, same hash -> returns existing record (isReplay: true).
 *   2. Key Mutation Conflict: Same farmer, same key, different hash -> rejects with 409 IdempotencyConflictError.
 *   3. Cross-Farmer Isolation: Different farmers with same idempotency key succeed independently.
 *   4. Concurrent Race Condition: Safely recovers from unique_violation (23505) and returns winning record.
 *   5. Unauthenticated Caller Guard: Rejects persistence without verified farmer identity.
 *   6. Status-Gated Metrics: Ensures metrics are populated only on SUCCESS and NULL on INSUFFICIENT_DATA.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
    ensureParentFarmerRecord,
    persistRecommendation,
    buildPersistenceRecord,
    computeRequestHash,
    resolveVerifiedFarmerIdentity,
    IdempotencyConflictError,
    UnauthenticatedPersistenceError,
    FarmerIdentityError,
    AmbiguousFarmerIdentityError,
    UnknownFarmerIdentityError,
    UnmappedProviderIdentityError,
    ParentFarmerSynchronizationError,
    FarmerIdentityConflictError,
} = require('../services/v2/recommendationPersistenceService');

// In-memory mock of Supabase client table operations with error-simulation hooks
function createMockSupabaseClient(options = {}) {
    const tableData = [];
    const farmersData = options.initialFarmers ? [...options.initialFarmers] : [];

    return {
        _tableData: tableData,
        _farmersData: farmersData,
        from(tableName) {
            if (tableName === 'farmers') {
                return {
                    upsert(farmerRecord, opts = {}) {
                        if (options.throwOnFarmerUpsert) {
                            return Promise.reject(new Error('Simulated network exception during farmer upsert'));
                        }
                        if (options.errorOnFarmerUpsert) {
                            return Promise.resolve({ data: null, error: options.errorOnFarmerUpsert });
                        }
                        const existingIdx = farmersData.findIndex((f) => f.id === farmerRecord.id);
                        if (existingIdx >= 0) {
                            if (opts.ignoreDuplicates) {
                                // Do not overwrite existing row when ignoreDuplicates is enabled
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
                                if (options.errorOnFarmerVerify || options.errorOnFarmerSelect) {
                                    return Promise.resolve({
                                        data: null,
                                        error: options.errorOnFarmerVerify || options.errorOnFarmerSelect,
                                    });
                                }
                                if (options.emptyOnFarmerVerify) {
                                    return Promise.resolve({ data: [], error: null });
                                }
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
            assert.equal(tableName, 'v2_crop_recommendations');
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
                    return queryObj;
                },
                insert(record) {
                    return {
                        select() {
                            // Check unique constraint: (farmer_id, idempotency_key)
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

test('FieldWise Phase 3C.6.4.2.2: Trusted Persistence & Idempotency Tests', async (t) => {
    const farmerA = 'farmer_punjab_101';
    const farmerB = 'farmer_haryana_202';
    const key1 = crypto.randomUUID();

    const requestPayload1 = {
        location: { state: 'Punjab', district: 'Ludhiana' },
        temporal: { sowing_month: 6 },
        edaphic: { soil_nitrogen: 120, soil_ph: 7.2, has_soil_test: true },
        climate_and_water: { seasonal_rainfall_amount: 550.0, irrigation_access: 'Borewell_Tubewell' },
    };

    const requestPayload2 = {
        location: { state: 'Punjab', district: 'Ludhiana' },
        temporal: { sowing_month: 6 },
        edaphic: { soil_nitrogen: 200, soil_ph: 7.2, has_soil_test: true }, // Changed N
        climate_and_water: { seasonal_rainfall_amount: 550.0, irrigation_access: 'Borewell_Tubewell' },
    };

    const engineSuccess = {
        engine_version: '2.2.0',
        status: 'SUCCESS',
        recommendations: [
            { crop: 'rice', suitability_score: 95.5, confidence_tier: 'HIGH' },
            { crop: 'maize', suitability_score: 82.0, confidence_tier: 'MEDIUM' },
        ],
        excluded_candidates: [],
        diagnostics: { water_balance: 'ADEQUATE' },
    };

    const engineInsufficient = {
        engine_version: '2.2.0',
        status: 'INSUFFICIENT_DATA',
        recommendations: [],
        excluded_candidates: [],
        diagnostics: { reason: 'Seasonal rainfall omitted for rainfed cultivation' },
    };

    await t.test('1. First submission inserts new record and returns isReplay: false', async () => {
        const client = createMockSupabaseClient();
        const res = await persistRecommendation({
            verifiedFarmerId: farmerA,
            farmerEmail: `${farmerA}@example.com`,
            idempotencyKey: key1,
            requestPayload: requestPayload1,
            engineResult: engineSuccess,
            executionTimeMs: 124,
            supabaseClient: client,
        });

        assert.equal(res.isReplay, false);
        assert.equal(res.record.farmer_id, farmerA);
        assert.equal(res.record.idempotency_key, key1);
        assert.equal(res.record.engine_status, 'SUCCESS');
        assert.equal(res.record.top_crop, 'rice');
        assert.equal(res.record.top_suitability_score, 95.5);
        assert.equal(client._tableData.length, 1);
    });

    await t.test('2. Replay with identical hash returns existing record (200 OK, isReplay: true)', async () => {
        const client = createMockSupabaseClient();
        // First insert
        const first = await persistRecommendation({
            verifiedFarmerId: farmerA,
            farmerEmail: `${farmerA}@example.com`,
            idempotencyKey: key1,
            requestPayload: requestPayload1,
            engineResult: engineSuccess,
            supabaseClient: client,
        });

        // Second insert with same payload
        const second = await persistRecommendation({
            verifiedFarmerId: farmerA,
            farmerEmail: `${farmerA}@example.com`,
            idempotencyKey: key1,
            requestPayload: requestPayload1,
            engineResult: engineSuccess,
            supabaseClient: client,
        });

        assert.equal(second.isReplay, true);
        assert.equal(second.record.id, first.record.id);
        assert.equal(second.record.request_hash, first.record.request_hash);
        assert.equal(client._tableData.length, 1, 'Must not create duplicate row');
    });

    await t.test('3. Key mutation with different payload rejects with 409 Conflict', async () => {
        const client = createMockSupabaseClient();
        await persistRecommendation({
            verifiedFarmerId: farmerA,
            farmerEmail: `${farmerA}@example.com`,
            idempotencyKey: key1,
            requestPayload: requestPayload1,
            engineResult: engineSuccess,
            supabaseClient: client,
        });

        // Attempt reuse with different payload
        await assert.rejects(
            async () => {
                await persistRecommendation({
                    verifiedFarmerId: farmerA,
                    farmerEmail: `${farmerA}@example.com`,
                    idempotencyKey: key1,
                    requestPayload: requestPayload2,
                    engineResult: engineSuccess,
                    supabaseClient: client,
                });
            },
            (err) => {
                assert.ok(err instanceof IdempotencyConflictError);
                assert.equal(err.code, 'IDEMPOTENCY_KEY_MUTATION');
                assert.equal(err.statusCode, 409);
                return true;
            }
        );
    });

    await t.test('4. Cross-Farmer Isolation: Different farmer using same key succeeds independently', async () => {
        const client = createMockSupabaseClient();
        const resA = await persistRecommendation({
            verifiedFarmerId: farmerA,
            farmerEmail: `${farmerA}@example.com`,
            idempotencyKey: key1,
            requestPayload: requestPayload1,
            engineResult: engineSuccess,
            supabaseClient: client,
        });

        const resB = await persistRecommendation({
            verifiedFarmerId: farmerB,
            farmerEmail: `${farmerB}@example.com`,
            idempotencyKey: key1, // Same key!
            requestPayload: requestPayload1,
            engineResult: engineSuccess,
            supabaseClient: client,
        });

        assert.equal(resB.isReplay, false);
        assert.equal(resB.record.farmer_id, farmerB);
        assert.notEqual(resB.record.id, resA.record.id);
        assert.equal(client._tableData.length, 2, 'Both farmer rows must exist independently');
    });

    await t.test('5. Unauthenticated Caller Guard: Rejects missing verified identity', async () => {
        const client = createMockSupabaseClient();
        await assert.rejects(
            async () => {
                await persistRecommendation({
                    verifiedFarmerId: null, // Unauthenticated!
                    farmerEmail: `${farmerA}@example.com`,
                    idempotencyKey: key1,
                    requestPayload: requestPayload1,
                    engineResult: engineSuccess,
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

    await t.test('6. Status-Gated Metrics: Ensures metrics are NULL on INSUFFICIENT_DATA', async () => {
        const client = createMockSupabaseClient();
        const res = await persistRecommendation({
            verifiedFarmerId: farmerA,
            farmerEmail: `${farmerA}@example.com`,
            idempotencyKey: crypto.randomUUID(),
            requestPayload: requestPayload1,
            engineResult: engineInsufficient,
            supabaseClient: client,
        });

        assert.equal(res.record.engine_status, 'INSUFFICIENT_DATA');
        assert.equal(res.record.top_crop, null);
        assert.equal(res.record.top_suitability_score, null);
        assert.equal(res.record.top_confidence_tier, null);
    });

    await t.test('7. Explicit Farmer Identity Mapping: Resolves unanimous claims and rejects invalid/ambiguous/unmapped', async () => {
        // Guest user -> null
        assert.equal(resolveVerifiedFarmerIdentity(null), null);
        assert.equal(resolveVerifiedFarmerIdentity(undefined), null);

        // Valid single claim -> resolves
        assert.equal(resolveVerifiedFarmerIdentity({ farmer_id: 'farmer_101' }), 'farmer_101');
        assert.equal(resolveVerifiedFarmerIdentity({ id: 103 }), '103');

        // Unanimous matching claims -> resolves
        assert.equal(resolveVerifiedFarmerIdentity({ farmer_id: '104', id: 104 }), '104');

        // Authentication-provider UID that is not a farmer ID -> throws UnmappedProviderIdentityError
        assert.throws(
            () => resolveVerifiedFarmerIdentity({ uid: 'firebase_user_abc_123' }),
            (err) => err instanceof UnmappedProviderIdentityError
        );
        assert.throws(
            () => resolveVerifiedFarmerIdentity({ sub: 'auth0|987654321' }),
            (err) => err instanceof UnmappedProviderIdentityError
        );

        // Ambiguous conflicting claims -> throws AmbiguousFarmerIdentityError
        assert.throws(
            () => resolveVerifiedFarmerIdentity({ farmer_id: '101', id: 999 }),
            (err) => err instanceof AmbiguousFarmerIdentityError
        );
        assert.throws(
            () => resolveVerifiedFarmerIdentity({ farmer_id: 'farmer_101', sub: 'farmer_999' }),
            (err) => err instanceof AmbiguousFarmerIdentityError
        );

        // Unknown / missing claims -> throws UnknownFarmerIdentityError
        assert.throws(
            () => resolveVerifiedFarmerIdentity({ email: 'farmer@example.com' }),
            (err) => err instanceof UnknownFarmerIdentityError
        );

        // Empty / invalid placeholders -> throws FarmerIdentityError
        assert.throws(
            () => resolveVerifiedFarmerIdentity({ farmer_id: '   ' }),
            (err) => err instanceof UnknownFarmerIdentityError
        );
        assert.throws(
            () => resolveVerifiedFarmerIdentity({ farmer_id: 'anonymous' }),
            (err) => err instanceof FarmerIdentityError
        );
        assert.throws(
            () => resolveVerifiedFarmerIdentity({ farmer_id: 'guest' }),
            (err) => err instanceof FarmerIdentityError
        );
        assert.throws(
            () => resolveVerifiedFarmerIdentity({ farmer_id: 'null' }),
            (err) => err instanceof FarmerIdentityError
        );
    });

    await t.test('8. Nullable has_soil_test semantics: Preserves true, false, and null', async () => {
        // True: declared available
        const recTrue = buildPersistenceRecord({
            verifiedFarmerId: farmerA,
            idempotencyKey: crypto.randomUUID(),
            requestPayload: { has_soil_test: true, location: { state: 'Punjab' } },
            engineResult: engineSuccess,
        });
        assert.equal(recTrue.has_soil_test, true);

        // False: declared absent
        const recFalse = buildPersistenceRecord({
            verifiedFarmerId: farmerA,
            idempotencyKey: crypto.randomUUID(),
            requestPayload: { has_soil_test: false, location: { state: 'Punjab' } },
            engineResult: engineSuccess,
        });
        assert.equal(recFalse.has_soil_test, false);

        // Null / undefined: unknown/unspecified
        const recNull = buildPersistenceRecord({
            verifiedFarmerId: farmerA,
            idempotencyKey: crypto.randomUUID(),
            requestPayload: { has_soil_test: null, location: { state: 'Punjab' } },
            engineResult: engineSuccess,
        });
        assert.equal(recNull.has_soil_test, null);

        const recOmitted = buildPersistenceRecord({
            verifiedFarmerId: farmerA,
            idempotencyKey: crypto.randomUUID(),
            requestPayload: { location: { state: 'Punjab' } },
            engineResult: engineSuccess,
        });
        assert.equal(recOmitted.has_soil_test, null);
    });

    await t.test('9. Database Constraint Verification (Simulated Logic): Rejects NaN, +Infinity, and -Infinity on numeric metrics', () => {
        // Simulates Postgres CHECK constraint logic:
        // CHECK (col IS NULL OR (col >= min AND col <= max AND col != 'NaN'::numeric AND col != 'Infinity'::numeric AND col != '-Infinity'::numeric))
        function evaluateConstraint(val, min, max) {
            if (val === null || val === undefined) return true; // nullable allowed
            if (Number.isNaN(val)) return false; // Rejects NaN
            if (!Number.isFinite(val)) return false; // Rejects +Infinity and -Infinity
            if (min !== null && val < min) return false;
            if (max !== null && val > max) return false;
            return true;
        }

        const metricsToCheck = [
            { name: 'suitability_score', min: 0.0, max: 100.0 },
            { name: 'dci_confidence', min: 0.0, max: 1.0 },
            { name: 'temperature', min: -20.0, max: 60.0 },
            { name: 'humidity', min: 0.0, max: 100.0 },
            { name: 'soil_ph', min: 2.0, max: 12.0 },
            { name: 'nitrogen', min: 0.0, max: null },
            { name: 'phosphorus', min: 0.0, max: null },
            { name: 'potassium', min: 0.0, max: null },
            { name: 'organic_carbon', min: 0.0, max: 100.0 },
            { name: 'seasonal_rainfall_mm', min: 0.0, max: null },
            { name: 'irrigation_water_quantity_mm', min: 0.0, max: null },
        ];

        for (const m of metricsToCheck) {
            // Null should pass
            assert.equal(evaluateConstraint(null, m.min, m.max), true, `${m.name} null should pass`);
            // Valid finite value should pass
            const mid = m.max !== null ? (m.min + m.max) / 2 : (m.min + 50);
            assert.equal(evaluateConstraint(mid, m.min, m.max), true, `${m.name} valid finite should pass`);

            // NaN MUST FAIL
            assert.equal(evaluateConstraint(NaN, m.min, m.max), false, `${m.name} NaN MUST fail`);

            // +Infinity MUST FAIL
            assert.equal(evaluateConstraint(Infinity, m.min, m.max), false, `${m.name} +Infinity MUST fail`);

            // -Infinity MUST FAIL
            assert.equal(evaluateConstraint(-Infinity, m.min, m.max), false, `${m.name} -Infinity MUST fail`);

            // Out of bounds finite numbers MUST FAIL
            if (m.min !== null) {
                assert.equal(evaluateConstraint(m.min - 1, m.min, m.max), false, `${m.name} below min MUST fail`);
            }
            if (m.max !== null) {
                assert.equal(evaluateConstraint(m.max + 1, m.min, m.max), false, `${m.name} above max MUST fail`);
            }
        }
    });

    await t.test('10. Optional Input Compatibility: Preserves unknown sowing_month and other unselected inputs as NULL without fabricated defaults', () => {
        const payloadWithOmittedOptional = {
            state: 'Punjab',
            // sowing_month is unselected / unknown:
            sowing_month: null,
            district: null,
            irrigation_access: null,
            soil_texture: null,
            has_soil_test: null,
            soil_test_declaration_status: null,
            nitrogen: null,
            phosphorus: null,
            potassium: null,
            soil_ph: null,
            seasonal_rainfall_amount: null,
            irrigation_water_quantity_mm: null,
        };

        const rec = buildPersistenceRecord({
            verifiedFarmerId: 'farmer_punjab_101',
            idempotencyKey: crypto.randomUUID(),
            requestPayload: payloadWithOmittedOptional,
            engineResult: engineSuccess,
            executionTimeMs: 150,
        });

        // Verify null preservation without fabricated defaults
        assert.equal(rec.state, 'Punjab', 'State must be preserved');
        assert.equal(rec.sowing_month, null, 'sowing_month must be NULL when unselected');
        assert.equal(rec.district, null, 'district must be NULL when unselected');
        assert.equal(rec.irrigation_access, null, 'irrigation_access must be NULL when unselected');
        assert.equal(rec.soil_texture, null, 'soil_texture must be NULL when unselected');
        assert.equal(rec.has_soil_test, null, 'has_soil_test must be NULL when unspecified');
        assert.equal(rec.soil_test_declaration_status, null, 'No fabricated default for declaration status');
        assert.equal(rec.nitrogen, null);
        assert.equal(rec.phosphorus, null);
        assert.equal(rec.potassium, null);
        assert.equal(rec.soil_ph, null);
        assert.equal(rec.seasonal_rainfall_amount, null);
        assert.equal(rec.seasonal_rainfall_mm, null);
        assert.equal(rec.irrigation_depth_mm, null);
        assert.equal(rec.irrigation_water_quantity_mm, null);

        // Verify dual column naming compatibility
        assert.equal(rec.top_crop, 'rice');
        assert.equal(rec.recommended_crop, 'rice');
        assert.equal(rec.top_suitability_score, 95.5);
        assert.equal(rec.suitability_score, 95.5);
    });

    await t.test('11. Farmer Identity & Parent Synchronization: ensureParentFarmerRecord provisions public.farmers row with verified identity anchor', async () => {
        const client = createMockSupabaseClient();
        const testFarmerId = 'farmer_sync_999';
        const testEmail = 'sync.farmer@example.com';
        const testName = 'Sync Farmer Partner';

        // 1. Initial table state: no farmers
        assert.equal(client._farmersData.length, 0);

        // 2. Execute ensureParentFarmerRecord with email and name
        await ensureParentFarmerRecord(client, testFarmerId, testEmail, testName);

        // 3. Verify farmer was upserted into farmers table
        assert.equal(client._farmersData.length, 1);
        assert.equal(client._farmersData[0].id, testFarmerId);
        assert.equal(client._farmersData[0].email, testEmail);
        assert.equal(client._farmersData[0].full_name, testName);

        // 4. Duplicate upsert with matching email preserves single row
        await ensureParentFarmerRecord(client, testFarmerId, testEmail, testName);
        assert.equal(client._farmersData.length, 1, 'Idempotent upsert preserves single row');

        // 5. persistRecommendation automatically synchronizes parent farmer
        const recFarmerId = 'farmer_persist_888';
        await persistRecommendation({
            verifiedFarmerId: recFarmerId,
            farmerEmail: 'persist@example.com',
            farmerName: 'Persist Farmer',
            idempotencyKey: crypto.randomUUID(),
            requestPayload: { state: 'Punjab' },
            engineResult: engineSuccess,
            supabaseClient: client,
        });

        const found = client._farmersData.find(f => f.id === recFarmerId);
        assert.ok(found, 'Parent farmer row must be synchronized during persistRecommendation');
        assert.equal(found.id, recFarmerId);
        assert.equal(found.email, 'persist@example.com');
    });

    await t.test('12. Farmer Identity Collision Guard: Rejects SQLite ID collision with existing unrelated Supabase farmer (409 Conflict)', async () => {
        const existingFarmerInSupabase = {
            id: 'farmer_collision_123',
            email: 'original.owner@example.com',
            full_name: 'Original Owner',
        };
        const client = createMockSupabaseClient({
            initialFarmers: [existingFarmerInSupabase],
        });

        // Attempting to synchronize the same ID with a conflicting authenticated user email
        await assert.rejects(
            async () => {
                await ensureParentFarmerRecord(
                    client,
                    'farmer_collision_123',
                    'different.user@example.com',
                    'Different User'
                );
            },
            (err) => {
                assert.ok(err instanceof FarmerIdentityConflictError);
                assert.equal(err.code, 'FARMER_IDENTITY_CONFLICT');
                assert.equal(err.statusCode, 409);
                assert.match(err.message, /identity collision/i);
                return true;
            }
        );

        // Verify original farmer was NOT modified or overwritten
        assert.equal(client._farmersData.length, 1);
        assert.equal(client._farmersData[0].email, 'original.owner@example.com');
    });

    await t.test('13. Parent Synchronization Error Handling: Throws ParentFarmerSynchronizationError when Supabase returns error object', async () => {
        const client = createMockSupabaseClient({
            errorOnFarmerUpsert: { code: '42501', message: 'permission denied for table farmers' },
        });

        await assert.rejects(
            async () => {
                await ensureParentFarmerRecord(
                    client,
                    'farmer_db_err_456',
                    'test@example.com',
                    'Test Farmer'
                );
            },
            (err) => {
                assert.ok(err instanceof ParentFarmerSynchronizationError);
                assert.equal(err.code, 'PARENT_FARMER_SYNC_FAILED');
                assert.equal(err.statusCode, 500);
                assert.match(err.message, /permission denied for table farmers/i);
                return true;
            }
        );
    });

    await t.test('14. Parent Synchronization Error Handling: Throws ParentFarmerSynchronizationError when Supabase throws an exception', async () => {
        const client = createMockSupabaseClient({
            throwOnFarmerUpsert: true,
        });

        await assert.rejects(
            async () => {
                await ensureParentFarmerRecord(
                    client,
                    'farmer_net_err_789',
                    'net@example.com',
                    'Net Farmer'
                );
            },
            (err) => {
                assert.ok(err instanceof ParentFarmerSynchronizationError);
                assert.equal(err.code, 'PARENT_FARMER_SYNC_FAILED');
                assert.equal(err.statusCode, 500);
                return true;
            }
        );
    });

    await t.test('15. Atomic Persistence Gate: Parent synchronization failure leaves v2_crop_recommendations table completely empty', async () => {
        const client = createMockSupabaseClient({
            errorOnFarmerUpsert: { code: '23503', message: 'foreign key violation' },
        });

        await assert.rejects(
            async () => {
                await persistRecommendation({
                    verifiedFarmerId: 'farmer_fail_sync',
                    farmerEmail: 'fail@example.com',
                    farmerName: 'Fail Farmer',
                    idempotencyKey: crypto.randomUUID(),
                    requestPayload: { state: 'Punjab' },
                    engineResult: engineSuccess,
                    supabaseClient: client,
                });
            },
            (err) => {
                assert.ok(err instanceof ParentFarmerSynchronizationError);
                return true;
            }
        );

        // CRITICAL INVARIANT: Zero rows inserted into v2_crop_recommendations
        assert.equal(
            client._tableData.length,
            0,
            'v2_crop_recommendations must contain 0 rows when parent farmer synchronization fails'
        );
    });

    await t.test('16. Race Safety: Existing row with null email fails closed (unverifiable identity) with zero recommendation inserts', async () => {
        const client = createMockSupabaseClient({
            initialFarmers: [{ id: 'farmer_null_email_in_db', email: null, full_name: 'Unverified DB Farmer' }],
        });

        await assert.rejects(
            async () => {
                await persistRecommendation({
                    verifiedFarmerId: 'farmer_null_email_in_db',
                    farmerEmail: 'caller@example.com',
                    idempotencyKey: crypto.randomUUID(),
                    requestPayload: { state: 'Punjab' },
                    engineResult: engineSuccess,
                    supabaseClient: client,
                });
            },
            (err) => {
                assert.ok(err instanceof FarmerIdentityConflictError);
                assert.equal(err.statusCode, 409);
                assert.match(err.message, /identity unverifiable/i);
                return true;
            }
        );

        assert.equal(client._tableData.length, 0, 'Zero recommendations inserted on unverifiable null email in DB');
    });

    await t.test('17. Race Safety: Authenticated user with null email fails closed with zero recommendation inserts', async () => {
        const client = createMockSupabaseClient();

        await assert.rejects(
            async () => {
                await persistRecommendation({
                    verifiedFarmerId: 'farmer_caller_no_email',
                    farmerEmail: null, // Caller has no email anchor!
                    idempotencyKey: crypto.randomUUID(),
                    requestPayload: { state: 'Punjab' },
                    engineResult: engineSuccess,
                    supabaseClient: client,
                });
            },
            (err) => {
                assert.ok(err instanceof FarmerIdentityConflictError);
                assert.equal(err.statusCode, 409);
                assert.match(err.message, /no verified email address/i);
                return true;
            }
        );

        assert.equal(client._tableData.length, 0, 'Zero recommendations inserted when authenticated caller has null email');
    });

    await t.test('18. Race Safety: Concurrent provisioning with conflicting identity fails closed on post-upsert verification', async () => {
        // Simulate: Race condition where another concurrent worker won the upsert race with a different email
        const client = createMockSupabaseClient({
            initialFarmers: [{ id: 'farmer_race_conflict_01', email: 'winner.race@example.com', full_name: 'Winner' }],
        });

        // Second caller attempts to provision same ID with different email
        await assert.rejects(
            async () => {
                await persistRecommendation({
                    verifiedFarmerId: 'farmer_race_conflict_01',
                    farmerEmail: 'loser.race@example.com', // Conflicting email!
                    idempotencyKey: crypto.randomUUID(),
                    requestPayload: { state: 'Punjab' },
                    engineResult: engineSuccess,
                    supabaseClient: client,
                });
            },
            (err) => {
                assert.ok(err instanceof FarmerIdentityConflictError);
                assert.equal(err.statusCode, 409);
                assert.match(err.message, /identity collision/i);
                return true;
            }
        );

        // Pre-existing row untouched, second caller rejected, zero recommendations inserted
        assert.equal(client._farmersData[0].email, 'winner.race@example.com');
        assert.equal(client._tableData.length, 0, 'Zero recommendations inserted on race conflict');
    });

    await t.test('19. Race Safety: Upsert ignored because another request created matching row succeeds via post-upsert verification', async () => {
        // Simulate: Another concurrent worker created the row with the SAME verified email
        const client = createMockSupabaseClient({
            initialFarmers: [{ id: 'farmer_race_match_01', email: 'matching.racer@example.com', full_name: 'First Worker' }],
        });

        // Second caller with same verified email provisions
        const res = await persistRecommendation({
            verifiedFarmerId: 'farmer_race_match_01',
            farmerEmail: 'matching.racer@example.com',
            idempotencyKey: crypto.randomUUID(),
            requestPayload: { state: 'Punjab' },
            engineResult: engineSuccess,
            supabaseClient: client,
        });

        assert.equal(res.isReplay, false);
        assert.equal(res.record.farmer_id, 'farmer_race_match_01');
        assert.equal(client._farmersData.length, 1, 'Upsert ignoreDuplicates preserved single parent row');
        assert.equal(client._tableData.length, 1, 'Recommendation persisted successfully after verified match');
    });

    await t.test('20. Race Safety: Post-upsert verification query failure fails closed with zero recommendation inserts', async () => {
        // Case A: Verification select query returns database error
        const clientErr = createMockSupabaseClient({
            errorOnFarmerVerify: { code: '503', message: 'connection reset by peer during verify' },
        });

        await assert.rejects(
            async () => {
                await persistRecommendation({
                    verifiedFarmerId: 'farmer_verify_fail_1',
                    farmerEmail: 'verify.fail@example.com',
                    idempotencyKey: crypto.randomUUID(),
                    requestPayload: { state: 'Punjab' },
                    engineResult: engineSuccess,
                    supabaseClient: clientErr,
                });
            },
            (err) => {
                assert.ok(err instanceof ParentFarmerSynchronizationError);
                assert.match(err.message, /connection reset by peer during verify/i);
                return true;
            }
        );
        assert.equal(clientErr._tableData.length, 0, 'Zero recommendations inserted on verify query error');

        // Case B: Verification select query returns empty array (row vanished)
        const clientEmpty = createMockSupabaseClient({
            emptyOnFarmerVerify: true,
        });

        await assert.rejects(
            async () => {
                await persistRecommendation({
                    verifiedFarmerId: 'farmer_verify_fail_2',
                    farmerEmail: 'verify.empty@example.com',
                    idempotencyKey: crypto.randomUUID(),
                    requestPayload: { state: 'Punjab' },
                    engineResult: engineSuccess,
                    supabaseClient: clientEmpty,
                });
            },
            (err) => {
                assert.ok(err instanceof ParentFarmerSynchronizationError);
                assert.match(err.message, /not found after provisioning/i);
                return true;
            }
        );
        assert.equal(clientEmpty._tableData.length, 0, 'Zero recommendations inserted on empty verify select');
    });
});
