 /**
 * CropPredict AI — JWT Authentication Middleware
 * Verifies Bearer token on protected routes
 */

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.',
        });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim().length === 0) {
        return res.status(500).json({
            success: false,
            message: 'Server authentication configuration is missing.',
            error: { code: 'AUTH_CONFIG_ERROR', message: 'JWT_SECRET is not configured on the server.' },
        });
    }

    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded; // { id, email, name, iat, exp }
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please log in again.',
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid token.',
        });
    }
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim().length === 0) {
        return res.status(500).json({
            success: false,
            message: 'Server authentication configuration is missing.',
            error: { code: 'AUTH_CONFIG_ERROR', message: 'JWT_SECRET is not configured on the server.' },
        });
    }

    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please log in again.',
                error: { code: 'TOKEN_EXPIRED', message: 'Token expired. Please log in again.' },
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid authentication token.',
            error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token.' },
        });
    }
}

module.exports = authMiddleware;
module.exports.optionalAuth = optionalAuth;
