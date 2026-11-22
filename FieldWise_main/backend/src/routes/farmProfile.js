/**
 * FieldWise Phase 3A.2: Farm Profile Routes
 * ==========================================
 * POST /api/farm-profile  (Upsert authenticated farmer profile)
 * GET  /api/farm-profile  (Fetch authenticated farmer profile)
 *
 * Security:
 *   - Protected by authMiddleware (rejects unauthenticated requests).
 *   - Farmer identity is strictly bound to req.user.id. Caller cannot override.
 */

const express = require('express');
const authMiddleware = require('../middleware/auth');
const { v1PersistenceService } = require('../services/v1/v1PersistenceService');

const router = express.Router();

// @route  POST /api/farm-profile
// @desc   Save or update authenticated farmer profile in Supabase
// @access Private (JWT required)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const saved = await v1PersistenceService.saveFarmProfile(req.user, req.body);
        return res.status(200).json({
            success: true,
            message: 'Farm profile saved successfully.',
            profile: saved,
        });
    } catch (err) {
        console.error('[FarmProfile Error]', err.message);
        const statusCode = err.name === 'UnauthenticatedPersistenceError' ? 401 :
                           err.name === 'FarmerIdentityError' ? 401 :
                           err.name === 'FarmerIdentityConflictError' ? 409 : 500;

        return res.status(statusCode).json({
            success: false,
            message: err.message || 'Failed to save farm profile.',
            error: {
                code: err.code || 'FARM_PROFILE_PERSISTENCE_FAILED',
                message: err.message,
            },
        });
    }
});

// @route  GET /api/farm-profile
// @desc   Fetch authenticated farmer profile from Supabase
// @access Private (JWT required)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const profile = await v1PersistenceService.getFarmProfile(req.user);
        return res.status(200).json({
            success: true,
            profile,
        });
    } catch (err) {
        console.error('[FarmProfile Fetch Error]', err.message);
        const statusCode = err.name === 'UnauthenticatedPersistenceError' ? 401 : 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || 'Failed to retrieve farm profile.',
            error: {
                code: err.code || 'FARM_PROFILE_FETCH_FAILED',
                message: err.message,
            },
        });
    }
});

module.exports = router;
