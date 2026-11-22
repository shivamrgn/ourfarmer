/**
 * FieldWise Phase 3C.6.2.2.1: V2 Crop Recommendation Routes
 * ==========================================================
 * POST /api/v2/predict  (Versioned recommendation engine endpoint)
 *
 * Route Invariants:
 *   - Outer request shape validation rejecting malformed bodies before child process spawning.
 *   - Strict JSON numeric type validation: only actual JSON numbers accepted; strings, booleans,
 *     arrays, objects, NaN, and +/- Infinity are rejected with 400 Bad Request.
 *   - Preserves null and omitted-value behavior where contract permits them.
 *   - Preserves valid zero values (0, 0.0) and negative finite values without silent coercion.
 *   - Inspects both top-level and nested contract objects (climate_and_water, edaphic, etc.).
 *   - Uses optionalAuth middleware for authenticated / guest execution.
 */

const express = require('express');
const { predictV2 } = require('../../controllers/v2/predictController');
const { optionalAuth } = require('../../middleware/auth');

const router = express.Router();

// ─── Documented Numeric Fields Catalog ───────────────────────────────────────
// Fields supported across top-level payload and nested contract sections
const DOCUMENTED_NUMERIC_FIELDS = Object.freeze([
    // Rainfall & water parameters
    'rainfall',
    'seasonal_rainfall_amount',
    'seasonal_rainfall_mm',
    'annual_rainfall',
    'annual_rainfall_amount',
    'annual_rainfall_mm',
    'irrigation_water_quantity_mm',
    'soil_moisture_mm',
    'awc_mm_m',
    'rooting_depth_m',

    // Climate & temperature parameters
    'temperature',
    'temperature_mean',
    'temperature_min_night',
    'temperature_max_day',
    'humidity',
    'relative_humidity',

    // Edaphic & soil parameters
    'ph',
    'soil_ph',
    'nitrogen',
    'soil_nitrogen',
    'phosphorus',
    'soil_phosphorus',
    'potassium',
    'soil_potassium',
    'organic_carbon',
    'organic_carbon_pct',
    'organicCarbon',

    // STCR target yield
    'target_yield_t_ha',
]);

/**
 * Validates that a value is a strict, finite JSON number.
 * Explicitly rejects booleans (typeof true === 'boolean'), strings, arrays, objects,
 * NaN, and +/- Infinity.
 *
 * @param {*} val - Value to check
 * @returns {boolean} True if strictly a finite number
 */
function isStrictJsonNumber(val) {
    return typeof val === 'number' && Number.isFinite(val);
}

/**
 * Helper to describe the type of an invalid value for error messaging.
 */
function describeType(val) {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    if (typeof val === 'number') {
        if (Number.isNaN(val)) return 'NaN';
        if (!Number.isFinite(val)) return 'non-finite number (Infinity)';
    }
    return typeof val;
}

/**
 * Middleware: Outer Request Validation for V2 Prediction Request
 */
function validateV2PredictRequest(req, res, next) {
    const payload = req.body;

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_REQUEST',
                message: 'Request body must be a valid JSON object dictionary.',
            },
        });
    }

    // 1. Mandatory 'state' validation
    const state = payload.location?.state !== undefined ? payload.location.state : payload.state;
    if (state === undefined || state === null || typeof state !== 'string' || !state.trim()) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_REQUEST',
                message: "Missing required input: 'state' is mandatory and must be a non-empty string.",
            },
        });
    }

    // 2. Mandatory strict integer 'sowing_month' validation (1-12)
    const sowingMonth = payload.temporal?.sowing_month !== undefined ? payload.temporal.sowing_month : payload.sowing_month;
    if (sowingMonth === undefined || sowingMonth === null) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_REQUEST',
                message: "Missing required input: 'sowing_month' is mandatory.",
            },
        });
    }

    if (typeof sowingMonth !== 'number' || !Number.isInteger(sowingMonth) || sowingMonth < 1 || sowingMonth > 12) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_REQUEST',
                message: `Invalid 'sowing_month': ${JSON.stringify(sowingMonth)}. Must be an actual integer between 1 and 12.`,
            },
        });
    }

    // 3. Strict boolean checks
    if (payload.has_soil_test !== undefined && payload.has_soil_test !== null && typeof payload.has_soil_test !== 'boolean') {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_REQUEST',
                message: `Invalid 'has_soil_test': ${JSON.stringify(payload.has_soil_test)}. Must be an actual JSON boolean (true or false).`,
            },
        });
    }

    if (payload.has_stcr_calibration !== undefined && payload.has_stcr_calibration !== null && typeof payload.has_stcr_calibration !== 'boolean') {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_REQUEST',
                message: `Invalid 'has_stcr_calibration': ${JSON.stringify(payload.has_stcr_calibration)}. Must be an actual JSON boolean (true or false).`,
            },
        });
    }

    // 4. Strict whole-day positive integer checks
    const iDays = payload.climate_and_water?.irrigation_period_days !== undefined
        ? payload.climate_and_water.irrigation_period_days
        : payload.irrigation_period_days;
    if (iDays !== undefined && iDays !== null) {
        if (typeof iDays !== 'number' || !Number.isInteger(iDays) || iDays <= 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: `Invalid 'irrigation_period_days': ${JSON.stringify(iDays)}. Must be a positive integer greater than zero.`,
                },
            });
        }
    }

    const rDays = payload.climate_and_water?.rainfall_period_days !== undefined
        ? payload.climate_and_water.rainfall_period_days
        : payload.rainfall_period_days;
    if (rDays !== undefined && rDays !== null) {
        if (typeof rDays !== 'number' || !Number.isInteger(rDays) || rDays <= 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: `Invalid 'rainfall_period_days': ${JSON.stringify(rDays)}. Must be a positive integer greater than zero.`,
                },
            });
        }
    }

    // 5. Strict numeric validation across all documented numeric fields
    // Inspect both top-level and nested contract objects
    const objectsToInspect = [
        { scope: 'top-level', obj: payload },
        { scope: 'climate_and_water', obj: payload.climate_and_water },
        { scope: 'edaphic', obj: payload.edaphic },
    ];

    for (const { scope, obj } of objectsToInspect) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
            continue;
        }

        for (const field of DOCUMENTED_NUMERIC_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(obj, field)) {
                const val = obj[field];
                // Preserve omitted and null values where the contract permits them
                if (val !== undefined && val !== null) {
                    if (!isStrictJsonNumber(val)) {
                        const pathDesc = scope === 'top-level' ? `'${field}'` : `'${scope}.${field}'`;
                        return res.status(400).json({
                            success: false,
                            error: {
                                code: 'INVALID_REQUEST',
                                message: `Invalid numeric value for ${pathDesc}: expected a finite JSON number, received ${describeType(val)} (${JSON.stringify(val)}).`,
                            },
                        });
                    }
                }
            }
        }
    }

    // 6. Validate monthly_rainfall array (top-level or in climate_and_water)
    const mrfRaw = payload.climate_and_water?.monthly_rainfall !== undefined
        ? payload.climate_and_water.monthly_rainfall
        : payload.monthly_rainfall;
    if (mrfRaw !== undefined && mrfRaw !== null) {
        if (!Array.isArray(mrfRaw)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: `Invalid 'monthly_rainfall': expected an array of numeric values, received ${describeType(mrfRaw)}.`,
                },
            });
        }
        for (let idx = 0; idx < mrfRaw.length; idx++) {
            const elem = mrfRaw[idx];
            if (!isStrictJsonNumber(elem)) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_REQUEST',
                        message: `Invalid numeric value for 'monthly_rainfall[${idx}]': expected a finite JSON number, received ${describeType(elem)} (${JSON.stringify(elem)}).`,
                    },
                });
            }
        }
    }

    next();
}

// ─── Route Definition ───────────────────────────────────────────────────────

router.post('/', optionalAuth, validateV2PredictRequest, predictV2);

router.validateV2PredictRequest = validateV2PredictRequest;
router.isStrictJsonNumber = isStrictJsonNumber;
router.DOCUMENTED_NUMERIC_FIELDS = DOCUMENTED_NUMERIC_FIELDS;

module.exports = router;
