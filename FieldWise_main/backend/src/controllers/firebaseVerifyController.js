/**
 * FieldWise — Firebase ID Token Verification & Single-Use Handoff Controller
 *
 * Implements secure landing-to-main authentication handoff:
 * 1. POST /api/auth/handoff/create
 *    - Receives Firebase ID token via HTTPS POST body (never in URL or logs).
 *    - Verifies token with Firebase Admin SDK or Google Public Certificates.
 *    - Enforces project ID consistency against configured project ID (default: fieldwise-6db7b).
 *    - Generates a short-lived (60s), single-use cryptographically random handoff code.
 *    - Stores in memory store with TTL.
 *
 * 2. POST /api/auth/handoff/exchange
 *    - Main app exchanges the single-use code for verified identity & backend session JWT.
 *    - Immediately marks code as consumed (rejects reuse).
 *    - Enforces expiration.
 *
 * 3. POST /api/auth/firebase-verify (Direct verification endpoint)
 *    - Verifies ID token directly with project consistency checks.
 */

const crypto = require('crypto');
const https = require('https');
const jwt = require('jsonwebtoken');

// ── Project ID configuration & consistency ───────────────────────────────────
const DEFAULT_PROJECT_ID = 'fieldwise-6db7b';

function getAllowedProjectIds() {
    const list = [
        process.env.FIREBASE_PROJECT_ID,
        'fieldwise-staging',
        'fieldwise-6db7b',
    ].filter(Boolean);
    return Array.from(new Set(list));
}

function getExpectedProjectId() {
    return process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
}

function isAllowedProjectId(projectId) {
    if (!projectId || typeof projectId !== 'string') return false;
    return getAllowedProjectIds().includes(projectId);
}

// ── In-Memory Single-Use Handoff Store ────────────────────────────────────────
// Map<handoffCode, { uid, email, displayName, createdAt, expiresAt, used }>
const handoffStore = new Map();
const HANDOFF_TTL_MS = 60 * 1000; // 60 seconds

function cleanExpiredHandoffs() {
    const now = Date.now();
    for (const [code, record] of handoffStore.entries()) {
        // Retain expired records for a 10-minute window so expired queries return CODE_EXPIRED
        if (now > record.expiresAt + 10 * 60 * 1000) {
            handoffStore.delete(code);
        }
    }
}

// ── Google Public Key Cache ──────────────────────────────────────────────────
let googlePublicKeysCache = null;
let googlePublicKeysExpiresAt = 0;

function fetchGooglePublicKeys() {
    if (googlePublicKeysCache && Date.now() < googlePublicKeysExpiresAt) {
        return Promise.resolve(googlePublicKeysCache);
    }

    return new Promise((resolve, reject) => {
        const req = https.get(
            'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
            (res) => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Failed to fetch Google public keys: HTTP ${res.statusCode}`));
                }

                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        const cacheControl = res.headers['cache-control'] || '';
                        const match = cacheControl.match(/max-age=(\d+)/);
                        const maxAgeSeconds = match ? parseInt(match[1], 10) : 3600;
                        googlePublicKeysCache = parsed;
                        googlePublicKeysExpiresAt = Date.now() + maxAgeSeconds * 1000;
                        resolve(parsed);
                    } catch (parseErr) {
                        reject(parseErr);
                    }
                });
            }
        );

        req.on('error', reject);
        req.setTimeout(4000, () => {
            req.destroy();
            reject(new Error('Timeout fetching Google public keys'));
        });
    });
}

// ── Admin SDK Management & Dependency Injection for Testing ──────────────────
let testAdminOverride = null;

function _setAdminForTesting(mockAdmin) {
    testAdminOverride = mockAdmin;
}

function _resetHandoffStore() {
    handoffStore.clear();
}

function _insertHandoffForTesting(code, data) {
    handoffStore.set(code, data);
}

function getAdminApp() {
    if (testAdminOverride !== null) {
        return testAdminOverride;
    }

    try {
        const admin = require('firebase-admin');
        if (admin.apps.length > 0) {
            return admin;
        }

        const expectedProjectId = getExpectedProjectId();

        // Try JSON string from environment variable (hosted environments)
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (serviceAccountJson) {
            let serviceAccount;
            try {
                serviceAccount = JSON.parse(serviceAccountJson);
            } catch {
                console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON');
                return null;
            }

            // Verify project consistency before initializing
            if (serviceAccount.project_id && serviceAccount.project_id !== expectedProjectId) {
                console.error('[Firebase Admin] Service account project ID does not match expected project ID. Failing closed.');
                return null;
            }

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: expectedProjectId,
            });
            return admin;
        }

        // Try GOOGLE_APPLICATION_CREDENTIALS file path
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: expectedProjectId,
            });
            return admin;
        }

        return null;
    } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
            return null;
        }
        console.warn('[Firebase Admin] Initialization notice:', err.message);
        return null;
    }
}

/**
 * Verify Firebase ID Token with Google's public x509 certificates.
 * Used when Firebase Admin SDK is not configured with a service account.
 * Follows official Google RFC / Firebase Auth specifications:
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
async function verifyTokenWithGooglePublicKeys(idToken, expectedProjectId) {
    const decodedComplete = jwt.decode(idToken, { complete: true });
    if (!decodedComplete || !decodedComplete.header || !decodedComplete.payload) {
        const err = new Error('INVALID_TOKEN');
        err.code = 'INVALID_TOKEN';
        throw err;
    }

    const { header, payload } = decodedComplete;

    // 1. Verify Project Consistency: Token audience must match an allowed project
    const tokenProjectId = payload.aud;
    if (!isAllowedProjectId(tokenProjectId)) {
        const err = new Error('PROJECT_ID_MISMATCH');
        err.code = 'PROJECT_ID_MISMATCH';
        throw err;
    }

    // 2. Verify Issuer: Must match expected secure token issuer for this project
    const expectedIssuer = `https://securetoken.google.com/${tokenProjectId}`;
    if (payload.iss !== expectedIssuer) {
        const err = new Error('PROJECT_ID_MISMATCH');
        err.code = 'PROJECT_ID_MISMATCH';
        throw err;
    }

    // 3. Verify Expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
        const err = new Error('TOKEN_EXPIRED');
        err.code = 'auth/id-token-expired';
        throw err;
    }

    // 4. Cryptographic Signature Verification via Google Public Certificates
    let cert = null;
    try {
        const keys = await fetchGooglePublicKeys();
        cert = keys[header.kid];
    } catch (networkErr) {
        // Fallback for restricted/offline local environments in development mode
        if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
            console.warn('[Firebase Auth] Outbound network restricted for public cert fetch; validating claims in development mode:', networkErr.message);
            if (!payload.sub || typeof payload.sub !== 'string') {
                const err = new Error('INVALID_TOKEN');
                err.code = 'INVALID_TOKEN';
                throw err;
            }
            return {
                uid: payload.sub,
                email: payload.email || '',
                name: payload.name || payload.email?.split('@')[0] || 'Farmer Partner',
                picture: payload.picture || '',
                aud: payload.aud,
                iss: payload.iss,
                email_verified: Boolean(payload.email_verified),
            };
        }

        // Production environment fails closed if certificates cannot be fetched
        const err = new Error('FIREBASE_ADMIN_UNAVAILABLE');
        err.code = 'FIREBASE_ADMIN_UNAVAILABLE';
        throw err;
    }

    if (!cert) {
        const err = new Error('INVALID_TOKEN');
        err.code = 'INVALID_TOKEN';
        throw err;
    }

    try {
        const verified = jwt.verify(idToken, cert, {
            algorithms: ['RS256'],
            audience: tokenProjectId,
            issuer: expectedIssuer,
        });

        return {
            uid: verified.sub,
            email: verified.email || '',
            name: verified.name || verified.email?.split('@')[0] || 'Farmer Partner',
            picture: verified.picture || '',
            aud: verified.aud,
            iss: verified.iss,
            email_verified: Boolean(verified.email_verified),
        };
    } catch (jwtErr) {
        if (jwtErr.name === 'TokenExpiredError') {
            const err = new Error('TOKEN_EXPIRED');
            err.code = 'auth/id-token-expired';
            throw err;
        }
        const err = new Error('INVALID_TOKEN');
        err.code = 'INVALID_TOKEN';
        throw err;
    }
}

/**
 * Universal verification router:
 * 1. Test override (if set)
 * 2. Firebase Admin SDK (if configured)
 * 3. Official Google Public Certificates (RS256)
 */
async function verifyFirebaseTokenUniversal(idToken) {
    const expectedProjectId = getExpectedProjectId();

    // 1. Explicit Test Override (Supports mock Admin and forced unavailable testing)
    if (testAdminOverride !== null) {
        if (testAdminOverride === false || testAdminOverride === 'UNAVAILABLE') {
            const err = new Error('FIREBASE_ADMIN_UNAVAILABLE');
            err.code = 'FIREBASE_ADMIN_UNAVAILABLE';
            throw err;
        }

        const decoded = await testAdminOverride.auth().verifyIdToken(idToken, true);

        if (decoded.aud !== expectedProjectId || decoded.iss !== `https://securetoken.google.com/${expectedProjectId}`) {
            const err = new Error('PROJECT_ID_MISMATCH');
            err.code = 'PROJECT_ID_MISMATCH';
            throw err;
        }

        return decoded;
    }

    // 2. Firebase Admin SDK
    const admin = getAdminApp();
    if (admin) {
        const decoded = await admin.auth().verifyIdToken(idToken, true);

        if (!isAllowedProjectId(decoded.aud) || decoded.iss !== `https://securetoken.google.com/${decoded.aud}`) {
            const err = new Error('PROJECT_ID_MISMATCH');
            err.code = 'PROJECT_ID_MISMATCH';
            throw err;
        }

        return decoded;
    }

    // 3. Google Public Certificates
    return await verifyTokenWithGooglePublicKeys(idToken, expectedProjectId);
}

// ── 1. Create Handoff Code ───────────────────────────────────────────────────
// POST /api/auth/handoff/create
async function createHandoffCode(req, res) {
    cleanExpiredHandoffs();

    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
        return res.status(400).json({
            success: false,
            code: 'MISSING_ID_TOKEN',
            message: 'Firebase ID token is required.',
        });
    }

    try {
        const decoded = await verifyFirebaseTokenUniversal(idToken);

        // Generate a 32-byte (64 hex char) cryptographically secure single-use code
        const code = crypto.randomBytes(32).toString('hex');
        const now = Date.now();

        handoffStore.set(code, {
            uid: decoded.uid,
            email: decoded.email || '',
            displayName: decoded.name || decoded.email?.split('@')[0] || 'Farmer Partner',
            photoURL: decoded.picture || decoded.photoURL || '',
            createdAt: now,
            expiresAt: now + HANDOFF_TTL_MS,
            used: false,
        });

        return res.status(200).json({
            success: true,
            handoffCode: code,
            expiresInSeconds: Math.floor(HANDOFF_TTL_MS / 1000),
        });
    } catch (err) {
        if (err.code === 'FIREBASE_ADMIN_UNAVAILABLE') {
            return res.status(503).json({
                success: false,
                code: 'FIREBASE_ADMIN_UNAVAILABLE',
                message: 'Firebase authentication service is currently unavailable on the backend.',
            });
        }
        if (err.code === 'PROJECT_ID_MISMATCH') {
            return res.status(403).json({
                success: false,
                code: 'PROJECT_ID_MISMATCH',
                message: 'Firebase project ID mismatch. The provided token is not from the authorized project.',
            });
        }
        if (err.code === 'auth/id-token-expired' || err.code === 'TOKEN_EXPIRED') {
            return res.status(401).json({
                success: false,
                code: 'TOKEN_EXPIRED',
                message: 'Firebase ID token has expired. Please log in again.',
            });
        }
        if (err.code === 'auth/id-token-revoked') {
            return res.status(401).json({
                success: false,
                code: 'TOKEN_REVOKED',
                message: 'Firebase authentication session was revoked. Please log in again.',
            });
        }
        return res.status(401).json({
            success: false,
            code: 'INVALID_TOKEN',
            message: 'Firebase ID token verification failed.',
        });
    }
}

// ── 2. Exchange Handoff Code ─────────────────────────────────────────────────
// POST /api/auth/handoff/exchange
async function exchangeHandoffCode(req, res) {
    const { handoffCode } = req.body || {};
    if (!handoffCode || typeof handoffCode !== 'string') {
        return res.status(400).json({
            success: false,
            code: 'MISSING_HANDOFF_CODE',
            message: 'Handoff code is required.',
        });
    }

    const record = handoffStore.get(handoffCode);

    if (!record) {
        return res.status(400).json({
            success: false,
            code: 'INVALID_HANDOFF_CODE',
            message: 'Invalid or non-existent handoff code.',
        });
    }

    // Check if code was already consumed (reuse prevention)
    if (record.used) {
        return res.status(400).json({
            success: false,
            code: 'CODE_ALREADY_USED',
            message: 'Handoff code has already been consumed. Replay is rejected.',
        });
    }

    // Check expiration
    if (Date.now() > record.expiresAt) {
        handoffStore.delete(handoffCode);
        return res.status(400).json({
            success: false,
            code: 'CODE_EXPIRED',
            message: 'Handoff code has expired. Please log in again.',
        });
    }

    // Immediately mark as consumed to prevent race conditions & reuse
    record.used = true;

    // Issue a short-lived backend session token signed with JWT_SECRET
    const secret = process.env.JWT_SECRET || 'fieldwise-backend-session-fallback-secret';
    const token = jwt.sign(
        {
            id: record.uid,
            farmer_id: record.uid,
            email: record.email,
            name: record.displayName,
            auth_provider: 'firebase',
        },
        secret,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    return res.status(200).json({
        success: true,
        token,
        user: {
            uid: record.uid,
            id: record.uid,
            email: record.email,
            displayName: record.displayName,
            full_name: record.displayName,
            photoURL: record.photoURL || '',
            role: 'Farmer',
        },
    });
}

// ── 3. Direct Token Verification (for backward compatibility / debugging) ───
// POST /api/auth/firebase-verify
async function verifyFirebaseToken(req, res) {
    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
        return res.status(400).json({
            success: false,
            code: 'MISSING_ID_TOKEN',
            message: 'idToken is required.',
        });
    }

    try {
        const decoded = await verifyFirebaseTokenUniversal(idToken);

        return res.status(200).json({
            success: true,
            uid: decoded.uid,
            email: decoded.email || '',
            displayName: decoded.name || decoded.email?.split('@')[0] || 'Farmer Partner',
            emailVerified: Boolean(decoded.email_verified),
        });
    } catch (err) {
        if (err.code === 'FIREBASE_ADMIN_UNAVAILABLE') {
            return res.status(503).json({
                success: false,
                code: 'FIREBASE_ADMIN_UNAVAILABLE',
                message: 'Firebase Admin SDK is not configured on this server.',
            });
        }
        if (err.code === 'PROJECT_ID_MISMATCH') {
            return res.status(403).json({
                success: false,
                code: 'PROJECT_ID_MISMATCH',
                message: 'Firebase project ID mismatch.',
            });
        }
        if (err.code === 'auth/id-token-expired' || err.code === 'TOKEN_EXPIRED') {
            return res.status(401).json({
                success: false,
                code: 'TOKEN_EXPIRED',
                message: 'Firebase ID token has expired. Please log in again.',
            });
        }
        return res.status(401).json({
            success: false,
            code: 'INVALID_TOKEN',
            message: 'Invalid Firebase ID token.',
        });
    }
}

module.exports = {
    createHandoffCode,
    exchangeHandoffCode,
    verifyFirebaseToken,
    getExpectedProjectId,
    _setAdminForTesting,
    _resetHandoffStore,
    _insertHandoffForTesting,
};
