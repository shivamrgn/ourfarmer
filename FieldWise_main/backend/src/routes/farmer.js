/**
 * FieldWise Phase 3A.2: Farmer Identity & Profile Routes
 * ========================================================
 * POST /api/farmer/sync     (Synchronize farmer record in public.farmers)
 * GET  /api/farmer/profile  (Fetch authenticated farmer record)
 *
 * Security:
 *   - Protected by authMiddleware.
 *   - Identity anchored strictly to req.user.id.
 */

const express = require('express');
const authMiddleware = require('../middleware/auth');
const { v1PersistenceService } = require('../services/v1/v1PersistenceService');

const router = express.Router();

// @route  POST /api/farmer/sync
// @desc   Sync or update authenticated farmer profile
// @access Private (JWT required)
router.post('/sync', authMiddleware, async (req, res) => {
    try {
        const synced = await v1PersistenceService.syncFarmer(req.user, req.body);
        return res.status(200).json({
            success: true,
            message: 'Farmer synchronized successfully.',
            farmer: synced,
        });
    } catch (err) {
        console.error('[FarmerSync Error]', err.message);
        const statusCode = err.name === 'UnauthenticatedPersistenceError' ? 401 : 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || 'Failed to synchronize farmer.',
            error: {
                code: err.code || 'FARMER_SYNC_FAILED',
                message: err.message,
            },
        });
    }
});

// @route  GET /api/farmer/profile
// @desc   Fetch authenticated farmer profile
// @access Private (JWT required)
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const farmer = await v1PersistenceService.getFarmer(req.user);
        return res.status(200).json({
            success: true,
            farmer,
        });
    } catch (err) {
        console.error('[FarmerProfile Error]', err.message);
        const statusCode = err.name === 'UnauthenticatedPersistenceError' ? 401 : 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || 'Failed to fetch farmer profile.',
            error: {
                code: err.code || 'FARMER_FETCH_FAILED',
                message: err.message,
            },
        });
    }
});

module.exports = router;
