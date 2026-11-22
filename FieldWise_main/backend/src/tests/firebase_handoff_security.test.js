/**
 * FieldWise Final Authentication Closure — Backend Regression Tests
 * =================================================================
 * Tests:
 * 1. Firebase Admin unavailable (503 fail closed)
 * 2. Firebase token verification failure (401 INVALID_TOKEN / TOKEN_EXPIRED)
 * 3. Firebase project mismatch (403 PROJECT_ID_MISMATCH fail closed)
 * 4. Single-use handoff code generation
 * 5. Single-use handoff code exchange (valid consumption + JWT issuance)
 * 6. Reuse of an already-consumed handoff code (400 CODE_ALREADY_USED)
 * 7. Invalid handoff code (400 INVALID_HANDOFF_CODE)
 * 8. Expired handoff code (400 CODE_EXPIRED)
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');

const app = require('../server');
const {
    _setAdminForTesting,
    _resetHandoffStore,
    _insertHandoffForTesting,
    getExpectedProjectId,
} = require('../controllers/firebaseVerifyController');

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
                statusCode: res.statusCode,
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

describe('FieldWise Firebase Authentication & Handoff Security Suite', () => {
    const EXPECTED_PROJECT = getExpectedProjectId(); // 'fieldwise-6db7b'

    beforeEach(() => {
        _resetHandoffStore();
        _setAdminForTesting(null);
    });

    afterEach(() => {
        _resetHandoffStore();
        _setAdminForTesting(null);
    });

    // ── Test 1: Firebase Admin Unavailable ──────────────────────────────────
    test('1. Firebase Admin unavailable returns 503 FIREBASE_ADMIN_UNAVAILABLE', async () => {
        _setAdminForTesting('UNAVAILABLE');

        const resCreate = await invokeExpress('POST', '/api/auth/handoff/create', {
            idToken: 'mock-sample-token',
        });
        assert.equal(resCreate.statusCode, 503);
        assert.equal(resCreate.body.success, false);
        assert.equal(resCreate.body.code, 'FIREBASE_ADMIN_UNAVAILABLE');

        const resVerify = await invokeExpress('POST', '/api/auth/firebase-verify', {
            idToken: 'mock-sample-token',
        });
        assert.equal(resVerify.statusCode, 503);
        assert.equal(resVerify.body.success, false);
        assert.equal(resVerify.body.code, 'FIREBASE_ADMIN_UNAVAILABLE');
    });

    // ── Test 2: Firebase Token Verification Failure ─────────────────────────
    test('2. Token verification failure returns 401 INVALID_TOKEN', async () => {
        const mockAdminFailing = {
            auth: () => ({
                verifyIdToken: async () => {
                    const err = new Error('Firebase token is invalid');
                    err.code = 'auth/argument-error';
                    throw err;
                },
            }),
        };
        _setAdminForTesting(mockAdminFailing);

        const res = await invokeExpress('POST', '/api/auth/handoff/create', {
            idToken: 'malformed.or.invalid.token',
        });
        assert.equal(res.statusCode, 401);
        assert.equal(res.body.success, false);
        assert.equal(res.body.code, 'INVALID_TOKEN');
    });

    test('2b. Expired Firebase token returns 401 TOKEN_EXPIRED', async () => {
        const mockAdminExpired = {
            auth: () => ({
                verifyIdToken: async () => {
                    const err = new Error('Firebase token has expired');
                    err.code = 'auth/id-token-expired';
                    throw err;
                },
            }),
        };
        _setAdminForTesting(mockAdminExpired);

        const res = await invokeExpress('POST', '/api/auth/handoff/create', {
            idToken: 'expired.token',
        });
        assert.equal(res.statusCode, 401);
        assert.equal(res.body.success, false);
        assert.equal(res.body.code, 'TOKEN_EXPIRED');
    });

    // ── Test 3: Firebase Project Mismatch (Fail Closed) ─────────────────────
    test('3. Firebase project mismatch (aud mismatch) returns 403 PROJECT_ID_MISMATCH', async () => {
        const mockAdminWrongAud = {
            auth: () => ({
                verifyIdToken: async () => ({
                    uid: 'farmer_attacker_123',
                    email: 'attacker@evil.com',
                    aud: 'different-malicious-project', // Mismatch!
                    iss: `https://securetoken.google.com/different-malicious-project`,
                }),
            }),
        };
        _setAdminForTesting(mockAdminWrongAud);

        const res = await invokeExpress('POST', '/api/auth/handoff/create', {
            idToken: 'token.from.foreign.project',
        });
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.success, false);
        assert.equal(res.body.code, 'PROJECT_ID_MISMATCH');
    });

    test('3b. Firebase project mismatch (iss mismatch) returns 403 PROJECT_ID_MISMATCH', async () => {
        const mockAdminWrongIss = {
            auth: () => ({
                verifyIdToken: async () => ({
                    uid: 'farmer_attacker_456',
                    email: 'attacker@evil.com',
                    aud: EXPECTED_PROJECT,
                    iss: 'https://securetoken.google.com/fake-project', // Mismatch!
                }),
            }),
        };
        _setAdminForTesting(mockAdminWrongIss);

        const res = await invokeExpress('POST', '/api/auth/handoff/create', {
            idToken: 'token.with.spoofed.issuer',
        });
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.success, false);
        assert.equal(res.body.code, 'PROJECT_ID_MISMATCH');
    });

    // ── Test 4: Single-Use Handoff Code Creation ────────────────────────────
    test('4. Valid Firebase ID token generates a secure 64-char single-use handoff code', async () => {
        const mockAdminValid = {
            auth: () => ({
                verifyIdToken: async () => ({
                    uid: 'farmer_verified_789',
                    email: 'farmer@fieldwise.agri',
                    name: 'Ramesh Patel',
                    aud: EXPECTED_PROJECT,
                    iss: `https://securetoken.google.com/${EXPECTED_PROJECT}`,
                }),
            }),
        };
        _setAdminForTesting(mockAdminValid);

        const res = await invokeExpress('POST', '/api/auth/handoff/create', {
            idToken: 'valid.firebase.id.token',
        });
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.handoffCode);
        assert.equal(typeof res.body.handoffCode, 'string');
        assert.equal(res.body.handoffCode.length, 64); // 32 bytes hex = 64 chars
        assert.equal(res.body.expiresInSeconds, 60);
    });

    // ── Test 5: Single-Use Handoff Code Exchange ────────────────────────────
    test('5. Handoff code exchange returns valid session JWT and verified farmer identity', async () => {
        const code = 'abc123def4567890123456789012345678901234567890123456789012345678';
        _insertHandoffForTesting(code, {
            uid: 'farmer_valid_111',
            email: 'farmer111@fieldwise.agri',
            displayName: 'Ramesh Patel',
            createdAt: Date.now(),
            expiresAt: Date.now() + 60000,
            used: false,
        });

        const res = await invokeExpress('POST', '/api/auth/handoff/exchange', {
            handoffCode: code,
        });

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.token);
        assert.equal(res.body.user.uid, 'farmer_valid_111');
        assert.equal(res.body.user.email, 'farmer111@fieldwise.agri');
        assert.equal(res.body.user.full_name, 'Ramesh Patel');

        // Verify the issued JWT signature
        const secret = process.env.JWT_SECRET || 'fieldwise-backend-session-fallback-secret';
        const decoded = jwt.verify(res.body.token, secret);
        assert.equal(decoded.id, 'farmer_valid_111');
        assert.equal(decoded.farmer_id, 'farmer_valid_111');
        assert.equal(decoded.email, 'farmer111@fieldwise.agri');
    });

    // ── Test 6: Reuse of an Already-Consumed Handoff Code (Replay Attack) ───
    test('6. Reuse of an already-consumed handoff code returns 400 CODE_ALREADY_USED', async () => {
        const code = 'reusable_test_code_123456789012345678901234567890123456789012345678';
        _insertHandoffForTesting(code, {
            uid: 'farmer_valid_222',
            email: 'farmer222@fieldwise.agri',
            displayName: 'Suresh Patel',
            createdAt: Date.now(),
            expiresAt: Date.now() + 60000,
            used: false,
        });

        // 1st consumption: Succeeds
        const res1 = await invokeExpress('POST', '/api/auth/handoff/exchange', {
            handoffCode: code,
        });
        assert.equal(res1.statusCode, 200);
        assert.equal(res1.body.success, true);

        // 2nd consumption (Replay Attack): Rejection!
        const res2 = await invokeExpress('POST', '/api/auth/handoff/exchange', {
            handoffCode: code,
        });
        assert.equal(res2.statusCode, 400);
        assert.equal(res2.body.success, false);
        assert.equal(res2.body.code, 'CODE_ALREADY_USED');
    });

    // ── Test 7: Invalid or Unknown Handoff Code ─────────────────────────────
    test('7. Unknown handoff code returns 400 INVALID_HANDOFF_CODE', async () => {
        const res = await invokeExpress('POST', '/api/auth/handoff/exchange', {
            handoffCode: 'unknown_non_existent_code_9999999999999999999999999999999999999999',
        });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.equal(res.body.code, 'INVALID_HANDOFF_CODE');
    });

    // ── Test 8: Expired Handoff Code ────────────────────────────────────────
    test('8. Expired handoff code returns 400 CODE_EXPIRED', async () => {
        const expiredCode = 'expired_code_000000000000000000000000000000000000000000000000000000';
        _insertHandoffForTesting(expiredCode, {
            uid: 'farmer_expired_333',
            email: 'expired@fieldwise.agri',
            displayName: 'Expired Farmer',
            createdAt: Date.now() - 120000,
            expiresAt: Date.now() - 60000, // Expired 1 minute ago!
            used: false,
        });

        const res = await invokeExpress('POST', '/api/auth/handoff/exchange', {
            handoffCode: expiredCode,
        });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.equal(res.body.code, 'CODE_EXPIRED');
    });

    // ── Test 9: Google Sign-In Provider Flow (End-to-End Handoff) ───────────
    test('9. Google Sign-In token (sign_in_provider: google.com) generates secure handoff code and exchanges for farmer JWT session', async () => {
        const googleUid = 'google_farmer_uid_987654';
        const googleEmail = 'googlefarmer@fieldwise.agri';
        const googleName = 'Ramesh Google Patel';
        const googlePhoto = 'https://lh3.googleusercontent.com/a/ACg8ocIj6-test';

        const mockGoogleAdmin = {
            auth: () => ({
                verifyIdToken: async (token) => {
                    if (token === 'valid_google_firebase_id_token') {
                        return {
                            uid: googleUid,
                            sub: googleUid,
                            email: googleEmail,
                            name: googleName,
                            picture: googlePhoto,
                            aud: EXPECTED_PROJECT,
                            iss: `https://securetoken.google.com/${EXPECTED_PROJECT}`,
                            firebase: {
                                sign_in_provider: 'google.com',
                            },
                        };
                    }
                    const err = new Error('INVALID_TOKEN');
                    err.code = 'INVALID_TOKEN';
                    throw err;
                },
            }),
        };

        _setAdminForTesting(mockGoogleAdmin);

        // 1. Landing creates handoff code via POST body
        const createRes = await invokeExpress('POST', '/api/auth/handoff/create', {
            idToken: 'valid_google_firebase_id_token',
        });

        assert.equal(createRes.statusCode, 200);
        assert.equal(createRes.body.success, true);
        assert.ok(createRes.body.handoffCode);
        const handoffCode = createRes.body.handoffCode;

        // 2. Main exchanges handoff code with backend
        const exchangeRes = await invokeExpress('POST', '/api/auth/handoff/exchange', {
            handoffCode,
        });

        assert.equal(exchangeRes.statusCode, 200);
        assert.equal(exchangeRes.body.success, true);
        assert.ok(exchangeRes.body.token);
        assert.equal(exchangeRes.body.user.uid, googleUid);
        assert.equal(exchangeRes.body.user.id, googleUid);
        assert.equal(exchangeRes.body.user.email, googleEmail);
        assert.equal(exchangeRes.body.user.full_name, googleName);
        assert.equal(exchangeRes.body.user.photoURL, googlePhoto);

        // 3. Verify JWT payload
        const secret = process.env.JWT_SECRET || 'fieldwise-backend-session-fallback-secret';
        const decoded = jwt.verify(exchangeRes.body.token, secret);
        assert.equal(decoded.id, googleUid);
        assert.equal(decoded.farmer_id, googleUid);
        assert.equal(decoded.email, googleEmail);
    });

    // ── Test 10: Google Sign-In Single-Use Replay Protection ─────────────────
    test('10. Google Sign-In handoff code cannot be replayed after initial consumption', async () => {
        const mockGoogleAdmin = {
            auth: () => ({
                verifyIdToken: async () => ({
                    uid: 'google_uid_replay_test',
                    sub: 'google_uid_replay_test',
                    email: 'replay@fieldwise.agri',
                    name: 'Replay Tester',
                    picture: 'https://lh3.googleusercontent.com/test',
                    aud: EXPECTED_PROJECT,
                    iss: `https://securetoken.google.com/${EXPECTED_PROJECT}`,
                    firebase: { sign_in_provider: 'google.com' },
                }),
            }),
        };

        _setAdminForTesting(mockGoogleAdmin);

        const createRes = await invokeExpress('POST', '/api/auth/handoff/create', {
            idToken: 'token_for_replay_test',
        });
        const handoffCode = createRes.body.handoffCode;

        // 1st consumption: Succeeds
        const res1 = await invokeExpress('POST', '/api/auth/handoff/exchange', { handoffCode });
        assert.equal(res1.statusCode, 200);

        // 2nd consumption: Fails with CODE_ALREADY_USED
        const res2 = await invokeExpress('POST', '/api/auth/handoff/exchange', { handoffCode });
        assert.equal(res2.statusCode, 400);
        assert.equal(res2.body.code, 'CODE_ALREADY_USED');
    });

    // ── Test 11: Google Sign-In Project Mismatch Rejection ───────────────────
    test('11. Google Sign-In token from mismatched Firebase project is rejected with 403', async () => {
        const mockForeignAdmin = {
            auth: () => ({
                verifyIdToken: async () => ({
                    uid: 'foreign_google_user',
                    sub: 'foreign_google_user',
                    email: 'foreign@other-project.com',
                    aud: 'wrong-foreign-project-id',
                    iss: 'https://securetoken.google.com/wrong-foreign-project-id',
                }),
            }),
        };

        _setAdminForTesting(mockForeignAdmin);

        const res = await invokeExpress('POST', '/api/auth/handoff/create', {
            idToken: 'foreign_google_token',
        });
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.code, 'PROJECT_ID_MISMATCH');
    });
});
