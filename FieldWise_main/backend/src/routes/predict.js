/**
 * CropPredict AI — Predict Routes
 * POST /api/predict  (JWT protected)
 */

const express = require('express');
const { body } = require('express-validator');
const { predict } = require('../controllers/predictController');
const { optionalAuth } = require('../middleware/auth');
const authMiddleware = require('../middleware/auth');
const { v1PersistenceService } = require('../services/v1/v1PersistenceService');

const router = express.Router();

const predictValidation = [
    body('rainfall').isFloat({ min: 0, max: 1000 }).withMessage('Rainfall must be 0–1000 mm.'),
    body('temperature').isFloat({ min: 0, max: 50 }).withMessage('Temperature must be 0–50°C.'),
    body('humidity').isFloat({ min: 0, max: 100 }).withMessage('Humidity must be 0–100%.'),
    body('soilType').notEmpty().withMessage('Soil type is required.'),
    body('nitrogen').isFloat({ min: 0, max: 300 }).withMessage('Nitrogen must be 0–300 kg/ha.'),
    body('phosphorus').isFloat({ min: 0, max: 200 }).withMessage('Phosphorus must be 0–200 kg/ha.'),
    body('potassium').isFloat({ min: 0, max: 300 }).withMessage('Potassium must be 0–300 kg/ha.'),
    body('ph').isFloat({ min: 3, max: 10 }).withMessage('pH must be 3–10.'),
];

// @route  POST /api/predict
// @desc   Get crop predictions for given inputs
// @access Public / Authenticated
router.post('/', optionalAuth, predictValidation, predict);

// @route  POST /api/predict/save
// @desc   Persist a V1 prediction to public.crop_predictions
// @access Private (JWT required)
router.post('/save', authMiddleware, async (req, res) => {
    try {
        const saved = await v1PersistenceService.saveCropPrediction(req.user, req.body);
        return res.status(200).json({
            success: true,
            message: 'Crop prediction saved successfully.',
            prediction: saved,
        });
    } catch (err) {
        console.error('[Predict Save Error]', err.message);
        const statusCode = err.name === 'UnauthenticatedPersistenceError' ? 401 : 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || 'Failed to persist crop prediction.',
            error: {
                code: err.code || 'PREDICTION_PERSISTENCE_FAILED',
                message: err.message,
            },
        });
    }
});

// @route  GET /api/predict/history
// @desc   Fetch historical V1 predictions for authenticated farmer
// @access Private (JWT required)
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const history = await v1PersistenceService.getCropPredictionHistory(req.user, req.query.limit);
        return res.status(200).json({
            success: true,
            count: history.length,
            history,
        });
    } catch (err) {
        console.error('[Predict History Error]', err.message);
        const statusCode = err.name === 'UnauthenticatedPersistenceError' ? 401 : 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || 'Failed to fetch prediction history.',
            error: {
                code: err.code || 'PREDICTION_HISTORY_FAILED',
                message: err.message,
            },
        });
    }
});

module.exports = router;
