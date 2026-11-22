/**
 * CropPredict AI — Predict Controller
 * Calls the model/predictor.js and returns JSON predictions
 */

const { validationResult } = require('express-validator');
const { predictCrops } = require('../../../model/predictor');

async function predict(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Invalid prediction inputs',
            errors: errors.array(),
        });
    }

    const {
        rainfall,
        temperature,
        humidity,
        soilType,
        nitrogen,
        phosphorus,
        potassium,
        ph,
        state,
    } = req.body;

    try {
        const results = predictCrops({
            rainfall: Number(rainfall),
            temperature: Number(temperature),
            humidity: Number(humidity),
            soilType: String(soilType),
            nitrogen: Number(nitrogen),
            phosphorus: Number(phosphorus),
            potassium: Number(potassium),
            ph: Number(ph),
        });

        return res.status(200).json({
            success: true,
            count: results.length,
            state: state || 'Not specified',
            predictions: results,
        });
    } catch (err) {
        console.error('[Predict Error]', err);
        return res.status(500).json({ success: false, message: 'Prediction failed. Please try again.' });
    }
}

module.exports = { predict };
