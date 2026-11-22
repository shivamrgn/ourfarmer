/**
 * FieldWise Phase 3A.2: Disease Detection Routes
 * ===============================================
 * POST /api/disease/diagnose  (Protected multimodal plant pathology diagnosis)
 */

const express = require('express');
const authMiddleware = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { diagnoseDisease } = require('../controllers/diseaseDetectionController');

const router = express.Router();

const diseaseLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'disease_diag',
    message: 'Diagnostic rate limit reached. Please wait a moment before analyzing another image.',
});

// @route  POST /api/disease/diagnose
// @desc   Analyze plant leaf image with Gemini Vision
// @access Private (JWT required)
router.post('/diagnose', authMiddleware, diseaseLimiter, diagnoseDisease);

module.exports = router;
module.exports.diseaseLimiter = diseaseLimiter;
