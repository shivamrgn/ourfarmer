/**
 * CropPredict AI — Auth Controller
 * Handles register, login, and me (profile) endpoints
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../config/database');

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateToken(user) {
    const farmerId = String(user.id);
    return jwt.sign(
        {
            id: user.id,
            farmer_id: farmerId,
            email: user.email,
            name: user.name,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

// ─── Register ────────────────────────────────────────────────────────────────

async function register(req, res) {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array(),
        });
    }

    const { name, email, password } = req.body;

    try {
        // Check if email already exists
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists.',
            });
        }

        // Hash password (bcrypt, 12 salt rounds)
        const passwordHash = await bcrypt.hash(password, 12);

        // Insert user
        const stmt = db.prepare(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)'
        );
        const result = stmt.run(name.trim(), email.toLowerCase(), passwordHash);

        const newUser = { id: result.lastInsertRowid, email: email.toLowerCase(), name: name.trim() };
        const token = generateToken(newUser);

        return res.status(201).json({
            success: true,
            message: 'Account created successfully.',
            token,
            user: { id: newUser.id, name: newUser.name, email: newUser.email },
        });
    } catch (err) {
        console.error('[Register Error]', err);
        return res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
}

// ─── Login ───────────────────────────────────────────────────────────────────

async function login(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array(),
        });
    }

    const { email, password } = req.body;

    try {
        // Find user by email
        const user = db
            .prepare('SELECT id, name, email, password FROM users WHERE email = ?')
            .get(email.toLowerCase());

        if (!user) {
            // Deliberate vague message to prevent user enumeration
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // Compare password with bcrypt
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const token = generateToken(user);

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            user: { id: user.id, name: user.name, email: user.email },
        });
    } catch (err) {
        console.error('[Login Error]', err);
        return res.status(500).json({ success: false, message: 'Server error during login.' });
    }
}

// ─── Me (protected) ──────────────────────────────────────────────────────────

function getMe(req, res) {
    // req.user is set by the auth middleware
    const user = db
        .prepare('SELECT id, name, email, created_at FROM users WHERE id = ?')
        .get(req.user.id);

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({ success: true, user });
}

module.exports = { register, login, getMe };
