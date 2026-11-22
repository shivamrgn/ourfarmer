/**
 * FieldWise Phase 3C.6.2.2.1: Node.js Backend Bridge Integration Tests
 * ===================================================================
 * Integration tests connecting the Express application directly to the
 * actual Python recommendation engine CLI (adapter_cli.py).
 *
 * Test Scenarios:
 *   1. POST /api/v2/predict succeeds with status: SUCCESS on valid agronomic inputs.
 *   2. POST /api/v2/predict handles valid zero values (0, 0.0) without coercion or rejection.
 *   3. POST /api/v2/predict preserves null and omitted optional values.
 *   4. POST /api/v2/predict returns 400 Bad Request on strict JSON numeric violations:
 *      - Numeric strings ("24.0", "120", "7.2")
 *      - Booleans in numeric fields (true, false)
 *      - Objects in numeric fields ({ value: 120 })
 *      - Arrays in numeric fields ([150])
 *      - Non-finite numbers (NaN, +/- Infinity)
 *      - Nested numeric locations (climate_and_water.temperature, edaphic.soil_ph, monthly_rainfall)
 *   5. POST /api/v2/predict returns status: INSUFFICIENT_DATA when seasonal moisture is missing.
 *   6. POST /api/v2/predict returns status: NO_RECOMMENDATION_SUITABLE under severe sodicity + drought.
 *   7. POST /api/v2/predict returns 422 Unprocessable Entity on engine-level validation rejection.
 *   8. Provenance & STCR safety: checkbox declaration remains baseline RDF arithmetic.
 *   9. V1 Route Regression: POST /api/predict preserves legacy behavior completely.
 *   10. GET /api/health remains operational.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const app = require('../server');

describe('Phase 3C.6.2.2.1 Backend Bridge Integration Tests', () => {

    /**
     * Programmatic Express invocation helper running in-memory without TCP socket binding
     */
    function invokeExpress(method, url, body) {
        return new Promise((resolve, reject) => {
            const req = new http.IncomingMessage(null);
            req.method = method;
            req.url = url;
            req.headers = {
                'content-type': 'application/json',
                host: 'localhost',
            };

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
                    headers: res.getHeaders(),
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

    const postJson = (endpoint, body) => invokeExpress('POST', endpoint, body);
    const getJson = (endpoint) => invokeExpress('GET', endpoint, null);

    test('1. POST /api/v2/predict succeeds with status: SUCCESS on valid agronomic inputs', async () => {
        const payload = {
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

        const res = await postJson('/api/v2/predict', payload);
        assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
        assert.equal(res.body.success, true);
        assert.equal(res.body.version, '2.2.0-CLOSURE');
        assert.equal(res.body.status, 'SUCCESS');

        const data = res.body.data;
        assert(Array.isArray(data.recommendations));
        assert.equal(data.recommendations.length, 5);

        // Verify top recommendation integrity
        const topRec = data.recommendations[0];
        assert(topRec.canonical_name);
        assert(typeof topRec.suitability_score === 'number');
        assert(topRec.suitability_score >= 0 && topRec.suitability_score <= 100);

        // Verification: scores must NOT be converted to legacy confidence or probabilities
        assert.equal(topRec.confidence, undefined, 'suitability_score must NOT be mapped to legacy confidence');
        assert.equal(topRec.probability, undefined, 'suitability_score must NOT be mapped to probability');
    });

    test('2. POST /api/v2/predict accepts valid zero values (0, 0.0) without silent coercion or rejection', async () => {
        const payloadWithZeros = {
            state: 'Punjab',
            district: 'Ludhiana',
            sowing_month: 10,
            irrigation_access: 'None_Rainfed',
            irrigation_water_quantity_mm: 0.0,
            seasonal_rainfall_amount: 0.0,
            nitrogen: 0,
            phosphorus: 0,
            potassium: 0,
            soil_texture: 'Sandy Loam',
            soil_ph: 7.2,
        };

        const res = await postJson('/api/v2/predict', payloadWithZeros);
        assert.equal(res.status, 200, `Expected 200 for valid numeric zero inputs, got ${res.status}`);
        assert.equal(res.body.success, true);
        // Under zero water, the engine returns a legitimate result (INSUFFICIENT_DATA or NO_RECOMMENDATION_SUITABLE)
        assert(['INSUFFICIENT_DATA', 'NO_RECOMMENDATION_SUITABLE', 'SUCCESS'].includes(res.body.status));
    });

    test('3. POST /api/v2/predict preserves null and omitted optional values', async () => {
        const payloadWithNulls = {
            state: 'Punjab',
            sowing_month: 10,
            soil_ph: null,
            nitrogen: null,
            phosphorus: null,
            potassium: null,
            irrigation_access: 'Tubewell_Borewell',
            irrigation_water_quantity_mm: 350.0,
            seasonal_rainfall_amount: 100.0,
        };

        const res = await postJson('/api/v2/predict', payloadWithNulls);
        assert.equal(res.status, 200, `Expected 200 for null/omitted optional parameters, got ${res.status}`);
        assert.equal(res.body.success, true);
    });

    describe('4. Strict JSON Numeric Type Enforcement (HTTP 400 Bad Request)', () => {

        test('4.1 Rejects numeric strings in numeric fields', async () => {
            // String temperature "24.0"
            const res1 = await postJson('/api/v2/predict', {
                state: 'Punjab',
                sowing_month: 10,
                temperature: '24.0',
            });
            assert.equal(res1.status, 400);
            assert.equal(res1.body.error.code, 'INVALID_REQUEST');
            assert(res1.body.error.message.includes("'temperature'"));
            assert(res1.body.error.message.includes('expected a finite JSON number'));

            // String nitrogen "120"
            const res2 = await postJson('/api/v2/predict', {
                state: 'Punjab',
                sowing_month: 10,
                nitrogen: '120',
            });
            assert.equal(res2.status, 400);
            assert(res2.body.error.message.includes("'nitrogen'"));

            // String seasonal_rainfall_amount "100.0"
            const res3 = await postJson('/api/v2/predict', {
                state: 'Punjab',
                sowing_month: 10,
                seasonal_rainfall_amount: '100.0',
            });
            assert.equal(res3.status, 400);
            assert(res3.body.error.message.includes("'seasonal_rainfall_amount'"));
        });

        test('4.2 Rejects booleans in numeric fields', async () => {
            // Boolean in temperature (true)
            const res1 = await postJson('/api/v2/predict', {
                state: 'Punjab',
                sowing_month: 10,
                temperature: true,
            });
            assert.equal(res1.status, 400);
            assert(res1.body.error.message.includes("'temperature'"));

            // Boolean in soil_ph (false)
            const res2 = await postJson('/api/v2/predict', {
                state: 'Punjab',
                sowing_month: 10,
                soil_ph: false,
            });
            assert.equal(res2.status, 400);
            assert(res2.body.error.message.includes("'soil_ph'"));
        });

        test('4.3 Rejects objects and arrays in numeric fields', async () => {
            // Object in phosphorus ({ value: 45 })
            const res1 = await postJson('/api/v2/predict', {
                state: 'Punjab',
                sowing_month: 10,
                phosphorus: { value: 45 },
            });
            assert.equal(res1.status, 400);
            assert(res1.body.error.message.includes("'phosphorus'"));

            // Array in potassium ([150])
            const res2 = await postJson('/api/v2/predict', {
                state: 'Punjab',
                sowing_month: 10,
                potassium: [150],
            });
            assert.equal(res2.status, 400);
            assert(res2.body.error.message.includes("'potassium'"));
        });

        test('4.4 Rejects non-finite numbers (NaN, Infinity, -Infinity)', async () => {
            const { validateV2PredictRequest } = require('../routes/v2/predict');

            // 4.4.1 Direct middleware verification with representable NaN
            let code1 = null;
            let body1 = null;
            validateV2PredictRequest(
                { body: { state: 'Punjab', sowing_month: 10, temperature: NaN } },
                { status(c) { code1 = c; return this; }, json(d) { body1 = d; return this; } },
                () => {}
            );
            assert.equal(code1, 400);
            assert.equal(body1.error.code, 'INVALID_REQUEST');
            assert(body1.error.message.includes("'temperature'"));
            assert(body1.error.message.includes('NaN'));

            // 4.4.2 Direct middleware verification with Infinity
            let code2 = null;
            let body2 = null;
            validateV2PredictRequest(
                { body: { state: 'Punjab', sowing_month: 10, seasonal_rainfall_amount: Infinity } },
                { status(c) { code2 = c; return this; }, json(d) { body2 = d; return this; } },
                () => {}
            );
            assert.equal(code2, 400);
            assert.equal(body2.error.code, 'INVALID_REQUEST');
            assert(body2.error.message.includes("'seasonal_rainfall_amount'"));
            assert(body2.error.message.includes('Infinity'));

            // 4.4.3 Direct middleware verification with -Infinity
            let code3 = null;
            let body3 = null;
            validateV2PredictRequest(
                { body: { state: 'Punjab', sowing_month: 10, humidity: -Infinity } },
                { status(c) { code3 = c; return this; }, json(d) { body3 = d; return this; } },
                () => {}
            );
            assert.equal(code3, 400);
            assert(body3.error.message.includes("'humidity'"));

            // 4.4.4 Wire-level rejection of non-finite literals in JSON stream
            const resRaw = await postJson('/api/v2/predict', '{"state": "Punjab", "sowing_month": 10, "temperature": NaN}');
            assert.equal(resRaw.status, 400);
        });

        test('4.5 Rejects invalid types in nested contract locations', async () => {
            // In climate_and_water.temperature
            const res1 = await postJson('/api/v2/predict', {
                state: 'Punjab',
                sowing_month: 10,
                climate_and_water: {
                    temperature: 'invalid_string',
                },
            });
            assert.equal(res1.status, 400);
            assert(res1.body.error.message.includes("'climate_and_water.temperature'"));

            // In edaphic.soil_ph
            const res2 = await postJson('/api/v2/predict', {
                state: 'Punjab',
                sowing_month: 10,
                edaphic: {
                    soil_ph: true,
                },
            });
            assert.equal(res2.status, 400);
            assert(res2.body.error.message.includes("'edaphic.soil_ph'"));

            // In monthly_rainfall elements
            const res3 = await postJson('/api/v2/predict', {
                state: 'Punjab',
                sowing_month: 10,
                climate_and_water: {
                    monthly_rainfall: [100.0, '200.0'],
                },
            });
            assert.equal(res3.status, 400);
            assert(res3.body.error.message.includes("'monthly_rainfall[1]'"));
        });

        test('4.6 Rejects non-integer and out-of-bound sowing_month', async () => {
            // Missing sowing_month
            const res1 = await postJson('/api/v2/predict', { state: 'Punjab' });
            assert.equal(res1.status, 400);
            assert(res1.body.error.message.includes("'sowing_month' is mandatory"));

            // Float sowing_month (10.5)
            const res2 = await postJson('/api/v2/predict', { state: 'Punjab', sowing_month: 10.5 });
            assert.equal(res2.status, 400);
            assert(res2.body.error.message.includes('actual integer'));

            // Out-of-bounds sowing_month (13)
            const res3 = await postJson('/api/v2/predict', { state: 'Punjab', sowing_month: 13 });
            assert.equal(res3.status, 400);
        });

        test('4.7 Rejects non-boolean flags and non-integer period days', async () => {
            // String boolean "true"
            const res1 = await postJson('/api/v2/predict', { state: 'Punjab', sowing_month: 10, has_soil_test: 'true' });
            assert.equal(res1.status, 400);
            assert(res1.body.error.message.includes('actual JSON boolean'));

            // Float irrigation_period_days (15.5)
            const res2 = await postJson('/api/v2/predict', { state: 'Punjab', sowing_month: 10, irrigation_period_days: 15.5 });
            assert.equal(res2.status, 400);
            assert(res2.body.error.message.includes('positive integer'));
        });
    });

    test('5. POST /api/v2/predict returns status: INSUFFICIENT_DATA when seasonal moisture is missing', async () => {
        const payload = {
            state: 'Punjab',
            sowing_month: 10,
            irrigation_access: 'None_Rainfed',
            seasonal_rainfall_amount: null,
            soil_texture: 'Sandy Loam',
            soil_ph: 7.2,
        };

        const res = await postJson('/api/v2/predict', payload);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.status, 'INSUFFICIENT_DATA');
        assert.equal(res.body.data.status, 'INSUFFICIENT_DATA');
    });

    test('6. POST /api/v2/predict returns status: NO_RECOMMENDATION_SUITABLE under severe sodicity + drought stress', async () => {
        const payload = {
            state: 'Haryana',
            sowing_month: 11,
            irrigation_access: 'None_Rainfed',
            seasonal_rainfall_amount: 40.0,
            temperature: 19.0,
            humidity: 50.0,
            soil_texture: 'Clay Loam',
            soil_ph: 9.2,
            has_soil_test: true,
            nitrogen: 280.0,
            phosphorus: 25.0,
            potassium: 150.0,
        };

        const res = await postJson('/api/v2/predict', payload);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.status, 'NO_RECOMMENDATION_SUITABLE');
        assert.equal(res.body.data.status, 'NO_RECOMMENDATION_SUITABLE');
        assert(Array.isArray(res.body.data.recommendations));
        for (const cand of res.body.data.recommendations) {
            assert(cand.suitability_score < 40.0);
        }
        assert(res.body.data.land_reclamation_advisory);
        assert(res.body.data.land_reclamation_advisory.includes('Gypsum'));
    });

    test('7. POST /api/v2/predict returns 422 Unprocessable Entity on engine-level validation rejection', async () => {
        // Conflicting seasonal rainfall aliases (300 vs 400)
        const conflictPayload = {
            state: 'Punjab',
            sowing_month: 10,
            seasonal_rainfall_amount: 300.0,
            seasonal_rainfall_mm: 400.0,
        };

        const res = await postJson('/api/v2/predict', conflictPayload);
        assert.equal(res.status, 422, `Expected 422 for engine validation failure, got ${res.status}`);
        assert.equal(res.body.success, false);
        assert.equal(res.body.error.code, 'ENGINE_VALIDATION_ERROR');
        assert(res.body.error.message.includes('Conflicting values'));
    });

    test('8. Provenance & STCR safety: checkbox declaration remains baseline RDF arithmetic', async () => {
        const payload = {
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
            nutrient_basis: 'SHC_Available_kg_ha',
        };

        const res = await postJson('/api/v2/predict', payload);
        assert.equal(res.status, 200);

        const data = res.body.data;
        assert.notEqual(
            data.query_summary.evidence_confidence_tier,
            'INDEPENDENTLY_VERIFIED',
            'Form checkbox must not grant INDEPENDENTLY_VERIFIED tier.'
        );

        for (const rec of data.recommendations) {
            if (rec.fertilizer_prescription) {
                assert.equal(
                    rec.fertilizer_prescription.status,
                    'BASELINE_RDF_ARITHMETIC',
                    'Fertilizer prescription must remain BASELINE_RDF_ARITHMETIC.'
                );
                assert.notEqual(
                    rec.fertilizer_prescription.status,
                    'VERIFIED_STCR_GENERATED',
                    'Fertilizer prescription must NOT be VERIFIED_STCR_GENERATED.'
                );
            }
        }
    });

    test('9. V1 Route Regression: POST /api/predict preserves legacy behavior completely', async () => {
        const legacyPayload = {
            rainfall: 200,
            temperature: 25,
            humidity: 70,
            soilType: 'Loamy',
            nitrogen: 80,
            phosphorus: 50,
            potassium: 50,
            ph: 6.5,
            state: 'Punjab',
        };

        const res = await postJson('/api/predict', legacyPayload);
        assert.equal(res.status, 200, `V1 predict route must return 200 OK, got ${res.status}`);
        assert.equal(res.body.success, true);
        assert.equal(res.body.state, 'Punjab');
        assert(Array.isArray(res.body.predictions));
        assert.equal(res.body.count, res.body.predictions.length);
        assert(res.body.predictions.length > 0);

        // V1 predictions format check
        const topV1 = res.body.predictions[0];
        assert(topV1.crop);
        assert(typeof topV1.confidence === 'number');
    });

    test('10. GET /api/health remains operational', async () => {
        const res = await getJson('/api/health');
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert(res.body.message.includes('CropPredict API is running'));
    });
});
