/**
 * CropPredict AI — Express Server Entry Point
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Startup validation (fail-fast on missing mandatory configuration)
const { validateStartupConfig } = require('./config/validateEnv');
const { createRateLimiter } = require('./middleware/rateLimiter');

// Initialize DB (creates file + tables if they don't exist)
require('./config/database');

const authRoutes = require('./routes/auth');
const predictRoutes = require('./routes/predict');
const predictV2Routes = require('./routes/v2/predict');
const schemesRoutes = require('./routes/schemes');
const expertSupportRoutes = require('./routes/expertSupport');

const app = express();

// ─── CORS Policy ─────────────────────────────────────────────────────────────

function isDevMode() {
    return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

function getAllowedOrigins() {
    const raw = process.env.FRONTEND_URL || '';
    const configured = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (configured.length > 0) return configured;
    // Default development origins if none specified and in development mode
    return isDevMode() ? ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8080'] : [];
}

const corsOptions = {
    origin: (origin, callback) => {
        // Deliberate Policy for Non-Browser Requests:
        // Requests without an Origin header (e.g. server-to-server, curl, health probes)
        // are allowed execution, but do not receive browser CORS credential reflection.
        if (!origin) {
            return callback(null, true);
        }

        const allowedOrigins = getAllowedOrigins();

        // Check if origin is explicitly in the configured allowlist
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Localhost origins are permitted ONLY in development mode
        if (isDevMode() && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }

        // Reject untrusted or malformed origins
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));

// ─── Rate Limiting ───────────────────────────────────────────────────────────

const authLoginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'auth_login',
    message: 'Too many login attempts. Please try again after 15 minutes.',
});

const authRegisterLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'auth_register',
    message: 'Too many account registration attempts. Please try again after 15 minutes.',
});

const predictV2Limiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 60,
    keyPrefix: 'predict_v2',
    message: 'Prediction request limit exceeded. Please wait a minute before requesting another recommendation.',
});

const predictV1Limiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 60,
    keyPrefix: 'predict_v1',
    message: 'Prediction request limit exceeded. Please wait a minute before requesting another recommendation.',
});

app.post('/api/auth/login', authLoginLimiter);
app.post('/api/auth/register', authRegisterLimiter);
app.post('/api/v2/predict', predictV2Limiter);
app.post('/api/predict', predictV1Limiter);

// ─── Routes ─────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'CropPredict API is running 🌾', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/v2/predict', predictV2Routes);
app.use('/api/schemes', schemesRoutes);
app.use('/api/expert-support', expertSupportRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err, req, res, next) => {
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            success: false,
            error: {
                code: 'CORS_FORBIDDEN',
                message: 'Origin not allowed by CORS policy.',
            },
        });
    }
    if (err.status === 400 || err.statusCode === 400) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_REQUEST',
                message: err.message || 'Malformed JSON payload.',
            },
        });
    }
    console.error('[Unhandled Error]', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ─── Start ───────────────────────────────────────────────────────────────────

if (require.main === module) {
    try {
        validateStartupConfig();
    } catch (valErr) {
        console.error(valErr.message);
        process.exit(1);
    }

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`🚀 CropPredict API running at http://localhost:${PORT}`);
        console.log(`   Health check: http://localhost:${PORT}/api/health`);
    });
}

module.exports = app;
module.exports.validateStartupConfig = validateStartupConfig;
module.exports.rateLimiters = {
    authLoginLimiter,
    authRegisterLimiter,
    predictV2Limiter,
    predictV1Limiter,
};
