/**
 * FieldWise Phase 3A.2.2: Hardened Gemini Disease Detection Security & Functional Tests
 * ======================================================================================
 * Tests:
 *   1. Unauthenticated rejection (401)
 *   2. Missing image payload rejection (400 IMAGE_REQUIRED)
 *   3. Invalid MIME type declaration rejection (400 INVALID_IMAGE_TYPE)
 *   4. Undersized (<50 bytes) image payload rejection (400 IMAGE_CORRUPTED)
 *   5. Malformed base64 encoding rejection (400 IMAGE_CORRUPTED)
 *   6. Non-image binary content (>50B but invalid magic bytes) rejection (400 INVALID_IMAGE_TYPE)
 *   7. Missing GEMINI_API_KEY returns 503 GEMINI_NOT_CONFIGURED (ignores VITE_GEMINI_API_KEY)
 *   8. Successful multimodal diagnosis via mock dispatcher returns 200 with advisory disclaimer
 *   9. Upstream failure handling returns 502 UPSTREAM_AI_ERROR
 *   10. Dedicated disease detection rate limiter enforces sliding window (429)
 */

if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'fieldwise-test-only-deterministic-jwt-secret-do-not-use-in-production-2026';
}

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const http = require('http');

const app = require('../server');
const {
    setCustomDispatcher,
    resetCustomDispatcher,
    isCanonicalBase64,
} = require('../controllers/diseaseDetectionController');

const JWT_SECRET = process.env.JWT_SECRET || 'fieldwise-test-only-deterministic-jwt-secret-do-not-use-in-production-2026';

function generateTestToken(userId = '11111111-1111-4111-8111-111111111111') {
    return jwt.sign(
        { id: userId, email: 'farmer@fieldwise.org' },
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

// Sample valid Base64 representations with authentic magic bytes
const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const validJpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

describe('FieldWise Phase 3A.2.2: Hardened Gemini Disease Detection Tests', () => {
    const originalEnvKey = process.env.GEMINI_API_KEY;
    const originalViteKey = process.env.VITE_GEMINI_API_KEY;

    beforeEach(() => {
        resetCustomDispatcher();
        process.env.GEMINI_API_KEY = 'test_backend_gemini_api_key_valid';
        delete process.env.VITE_GEMINI_API_KEY;
    });

    afterEach(() => {
        resetCustomDispatcher();
        if (originalEnvKey !== undefined) {
            process.env.GEMINI_API_KEY = originalEnvKey;
        } else {
            delete process.env.GEMINI_API_KEY;
        }
        if (originalViteKey !== undefined) {
            process.env.VITE_GEMINI_API_KEY = originalViteKey;
        } else {
            delete process.env.VITE_GEMINI_API_KEY;
        }
    });

    // ── 1. Unauthenticated Request Rejected ───────────────────────────────────
    test('1. Unauthenticated request to /api/disease/diagnose returns 401', async () => {
        const res = await invokeExpress('POST', '/api/disease/diagnose', {
            image: validJpegBase64,
            mimeType: 'image/jpeg',
        });

        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.success, false);
    });

    // ── 2. Missing Image Payload ──────────────────────────────────────────────
    test('2. Missing image payload returns 400 IMAGE_REQUIRED', async () => {
        const token = generateTestToken();
        const res = await invokeExpress('POST', '/api/disease/diagnose', {
            mimeType: 'image/jpeg',
        }, { authorization: `Bearer ${token}` });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error.code, 'IMAGE_REQUIRED');
    });

    // ── 3. Invalid MIME Type ──────────────────────────────────────────────────
    test('3. Unsupported MIME type returns 400 INVALID_IMAGE_TYPE', async () => {
        const token = generateTestToken();
        const res = await invokeExpress('POST', '/api/disease/diagnose', {
            image: validJpegBase64,
            mimeType: 'image/gif',
        }, { authorization: `Bearer ${token}` });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error.code, 'INVALID_IMAGE_TYPE');
    });

    // ── 4. Undersized / Corrupted Image ───────────────────────────────────────
    test('4. Undersized (<50 bytes) image returns 400 IMAGE_CORRUPTED', async () => {
        const token = generateTestToken();
        const res = await invokeExpress('POST', '/api/disease/diagnose', {
            image: 'AAAA',
            mimeType: 'image/jpeg',
        }, { authorization: `Bearer ${token}` });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error.code, 'IMAGE_CORRUPTED');
    });

    // ── 5. Malformed Base64 Characters ────────────────────────────────────────
    test('5. Malformed base64 characters returns 400 IMAGE_CORRUPTED', async () => {
        const token = generateTestToken();
        const res = await invokeExpress('POST', '/api/disease/diagnose', {
            image: '!!!not-valid-base64-content@@@###$$$',
            mimeType: 'image/jpeg',
        }, { authorization: `Bearer ${token}` });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error.code, 'IMAGE_CORRUPTED');
    });

    // ── 6. Non-Image Binary Content (Invalid Magic Bytes) ─────────────────────
    test('6. Non-image binary payload (>50B but invalid magic bytes) returns 400 INVALID_IMAGE_TYPE', async () => {
        const token = generateTestToken();
        // 60 bytes of ASCII text, which does not start with JPEG/PNG/WEBP magic bytes
        const fakeImageBase64 = Buffer.from('This is a plain text file pretending to be an image and is over 50 bytes long!').toString('base64');

        const res = await invokeExpress('POST', '/api/disease/diagnose', {
            image: fakeImageBase64,
            mimeType: 'image/jpeg',
        }, { authorization: `Bearer ${token}` });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error.code, 'INVALID_IMAGE_TYPE');
    });

    // ── 7. Missing GEMINI_API_KEY (Ignores VITE_GEMINI_API_KEY) ───────────────
    test('7. Missing GEMINI_API_KEY on server returns 503 even if VITE_GEMINI_API_KEY exists', async () => {
        delete process.env.GEMINI_API_KEY;
        process.env.VITE_GEMINI_API_KEY = 'should_be_completely_ignored_by_backend';

        const token = generateTestToken();
        const res = await invokeExpress('POST', '/api/disease/diagnose', {
            image: validJpegBase64,
            mimeType: 'image/jpeg',
        }, { authorization: `Bearer ${token}` });

        assert.strictEqual(res.status, 503);
        assert.strictEqual(res.body.error.code, 'GEMINI_NOT_CONFIGURED');
    });

    // ── 8. Successful Diagnosis via Mock Dispatcher ───────────────────────────
    test('8. Successful diagnosis returns 200 with standardized diagnosis and advisory disclaimer', async () => {
        const mockDiagnosis = {
            plant: 'Tomato (Solanum lycopersicum)',
            diseaseName: 'Tomato Early Blight',
            description: 'Concentric brown necrotic rings on lower foliage.',
            confidenceScore: 92,
            severityLevel: 'medium',
            actionRequired: 'Apply copper-based fungicide and remove affected lower leaves.',
            symptomsObserved: ['Concentric brown spots', 'Yellow halos'],
            treatment: ['Spray Mancozeb 75% WP @ 2g/L'],
            preventionTips: ['Ensure good air circulation', 'Avoid overhead watering'],
        };

        setCustomDispatcher(async ({ apiKey, model, base64Data, mimeType }) => {
            assert.strictEqual(apiKey, 'test_backend_gemini_api_key_valid');
            assert.ok(model, 'Model name must be provided');
            assert.strictEqual(mimeType, 'image/jpeg');
            return mockDiagnosis;
        });

        const token = generateTestToken();
        const res = await invokeExpress('POST', '/api/disease/diagnose', {
            image: `data:image/jpeg;base64,${validJpegBase64}`,
            fileName: 'sample_tomato.jpg',
        }, { authorization: `Bearer ${token}` });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.diagnosis.plant, 'Tomato (Solanum lycopersicum)');
        assert.strictEqual(res.body.diagnosis.diseaseName, 'Tomato Early Blight');
        assert.strictEqual(res.body.diagnosis.confidence, 92);
        assert.strictEqual(res.body.diagnosis.severity, 'medium');
        assert.ok(res.body.diagnosis.advisoryDisclaimer.includes('advisory recommendations'));
        assert.ok(res.body.diagnosis.requestId.startsWith('diag_'));
    });

    // ── 9. Upstream Failure Handling ──────────────────────────────────────────
    test('9. Upstream AI failure returns 502 UPSTREAM_AI_ERROR', async () => {
        setCustomDispatcher(async () => {
            throw new Error('Gemini API timeout');
        });

        const token = generateTestToken();
        const res = await invokeExpress('POST', '/api/disease/diagnose', {
            image: validJpegBase64,
            mimeType: 'image/jpeg',
        }, { authorization: `Bearer ${token}` });

        assert.strictEqual(res.status, 502);
        assert.strictEqual(res.body.error.code, 'UPSTREAM_AI_ERROR');
    });

    // ── 10. Dedicated Disease Detection Rate Limiter ──────────────────────────
    test('10. Rate limiter restricts excessive rapid diagnostic requests', async () => {
        setCustomDispatcher(async () => ({
            plant: 'Wheat',
            diseaseName: 'Healthy',
            description: 'Healthy specimen',
            confidenceScore: 99,
            severityLevel: 'low',
            actionRequired: 'Maintain good practices',
            symptomsObserved: [],
            treatment: [],
            preventionTips: [],
        }));

        const heavyUserId = '99999999-9999-4999-8999-999999999999';
        const token = generateTestToken(heavyUserId);

        let hitRateLimit = false;
        // The limit is 20 requests per minute
        for (let i = 0; i < 25; i++) {
            const res = await invokeExpress('POST', '/api/disease/diagnose', {
                image: validJpegBase64,
                mimeType: 'image/jpeg',
            }, {
                authorization: `Bearer ${token}`,
                'x-forwarded-for': '192.168.1.100',
            });

            if (res.status === 429) {
                hitRateLimit = true;
                assert.strictEqual(res.body.success, false);
                break;
            }
        }

        assert.strictEqual(hitRateLimit, true, 'Rate limiter must enforce HTTP 429 after 20 requests');
    });

    // ── 11. Non-Canonical Base64 Rejection ───────────────────────────────────
    test('11. Non-canonical base64 payloads (middle padding, wrong length, non-zero padding bits) return 400 IMAGE_CORRUPTED', async () => {
        const token = generateTestToken();

        // 11.1 Non-multiple of 4 length
        const res1 = await invokeExpress('POST', '/api/disease/diagnose', {
            image: 'AAAAA', // 5 chars
            mimeType: 'image/jpeg',
        }, { authorization: `Bearer ${token}` });
        assert.strictEqual(res1.status, 400);
        assert.strictEqual(res1.body.error.code, 'IMAGE_CORRUPTED');

        // 11.2 Padding in the middle
        const res2 = await invokeExpress('POST', '/api/disease/diagnose', {
            image: 'abc=def=',
            mimeType: 'image/jpeg',
        }, { authorization: `Bearer ${token}` });
        assert.strictEqual(res2.status, 400);
        assert.strictEqual(res2.body.error.code, 'IMAGE_CORRUPTED');

        // 11.3 Non-zero trailing bits before padding (ZE==)
        const res3 = await invokeExpress('POST', '/api/disease/diagnose', {
            image: 'ZE==',
            mimeType: 'image/jpeg',
        }, { authorization: `Bearer ${token}` });
        assert.strictEqual(res3.status, 400);
        assert.strictEqual(res3.body.error.code, 'IMAGE_CORRUPTED');
    });

    // ── 12. MIME Type Mismatch Rejection ─────────────────────────────────────
    test('12. Declared MIME type mismatch with detected binary format returns 400 MIME_TYPE_MISMATCH', async () => {
        const token = generateTestToken();

        // Declared PNG but sent valid JPEG magic bytes
        const res1 = await invokeExpress('POST', '/api/disease/diagnose', {
            image: validJpegBase64,
            mimeType: 'image/png',
        }, { authorization: `Bearer ${token}` });

        assert.strictEqual(res1.status, 400);
        assert.strictEqual(res1.body.error.code, 'MIME_TYPE_MISMATCH');
        assert.ok(res1.body.error.message.includes("Declared image MIME type 'image/png' does not match detected binary format 'image/jpeg'"));

        // Declared JPEG but sent valid PNG magic bytes
        const res2 = await invokeExpress('POST', '/api/disease/diagnose', {
            image: validPngBase64,
            mimeType: 'image/jpeg',
        }, { authorization: `Bearer ${token}` });

        assert.strictEqual(res2.status, 400);
        assert.strictEqual(res2.body.error.code, 'MIME_TYPE_MISMATCH');
        assert.ok(res2.body.error.message.includes("Declared image MIME type 'image/jpeg' does not match detected binary format 'image/png'"));
    });

    // ── 13. isCanonicalBase64 Helper Verification ────────────────────────────
    test('13. isCanonicalBase64 helper strictly verifies RFC 4648 canonical encoding', () => {
        assert.strictEqual(isCanonicalBase64(''), false);
        assert.strictEqual(isCanonicalBase64(null), false);
        assert.strictEqual(isCanonicalBase64(undefined), false);
        assert.strictEqual(isCanonicalBase64('A'), false);
        assert.strictEqual(isCanonicalBase64('AA'), false);
        assert.strictEqual(isCanonicalBase64('AAA'), false);
        assert.strictEqual(isCanonicalBase64('abc=def='), false);
        assert.strictEqual(isCanonicalBase64('ZE=='), false); // Non-zero padding bits
        assert.strictEqual(isCanonicalBase64('ZA=='), true);  // Canonical 1-byte
        assert.strictEqual(isCanonicalBase64('ZWE='), true);  // Canonical 2-byte
        assert.strictEqual(isCanonicalBase64(validJpegBase64), true);
        assert.strictEqual(isCanonicalBase64(validPngBase64), true);
    });
});
