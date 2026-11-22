/**
 * CropPredict AI — Predict Routes
 * POST /api/predict  (JWT protected)
 */

const express = require('express');
const { body } = require('express-validator');
const { predict } = require('../controllers/predictController');
const { optionalAuth } = require('../middleware/auth');

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

module.exports = router;
