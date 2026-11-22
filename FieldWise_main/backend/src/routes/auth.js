/**
 * CropPredict AI — Auth Routes
 * POST /api/auth/register
 * POST /api/auth/login
 * GET  /api/auth/me  (protected)
 */

const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe } = require('../controllers/authController');
const {
    createHandoffCode,
    exchangeHandoffCode,
    verifyFirebaseToken,
} = require('../controllers/firebaseVerifyController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── Validation rules ─────────────────────────────────────────────────────────

const registerValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters.'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address.'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters.')
        .matches(/[A-Z]/)
        .withMessage('Password must contain at least one uppercase letter.')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number.'),
];

const loginValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
];

// ── Routes ────────────────────────────────────────────────────────────────────

// @route  POST /api/auth/register
// @desc   Register a new user
// @access Public
router.post('/register', registerValidation, register);

// @route  POST /api/auth/login
// @desc   Login user, return JWT token
// @access Public
router.post('/login', loginValidation, login);

// @route  GET /api/auth/me
// @desc   Get current logged-in user profile
// @access Private (JWT required)
router.get('/me', authMiddleware, getMe);

// @route  POST /api/auth/firebase-verify
// @desc   Verify a Firebase ID token from FieldWise_landing and return confirmed identity.
// @access Public (token is self-contained proof; no prior session required)
router.post('/firebase-verify', verifyFirebaseToken);

// @route  POST /api/auth/handoff/create
// @desc   Verify Firebase ID token and issue a short-lived, single-use handoff code.
// @access Public
router.post('/handoff/create', createHandoffCode);

// @route  POST /api/auth/handoff/exchange
// @desc   Exchange a single-use handoff code for verified user identity and session token.
// @access Public
router.post('/handoff/exchange', exchangeHandoffCode);

module.exports = router;
