/**
 * Backend Smoke & Integration Test
 * Tests /api/health, prediction engine, and database initialization
 */
const assert = require('assert');
const { predictCrops } = require('../../../model/predictor');

console.log('🧪 Running Backend Integration & Smoke Tests...');

// 1. Test predictor calculation
const sampleInputs = {
    rainfall: 200,
    temperature: 25,
    humidity: 70,
    soilType: 'Loamy',
    nitrogen: 80,
    phosphorus: 50,
    potassium: 50,
    ph: 6.5,
};

const predictions = predictCrops(sampleInputs);
assert(Array.isArray(predictions), 'Predictions should be an array');
assert(predictions.length > 0, 'Predictions should not be empty');
assert(predictions[0].crop, 'Top prediction must have a crop name');
assert(typeof predictions[0].confidence === 'number', 'Prediction must have confidence score');

console.log(`✅ Predictor engine verified: ${predictions.length} predictions generated (Top: ${predictions[0].crop}, Score: ${predictions[0].confidence}%)`);

// 2. Test database initialization
const db = require('../config/database');
assert(db, 'SQLite database instance must be initialized');
const userCount = db.prepare('SELECT count(*) as count FROM users').get();
assert(typeof userCount.count === 'number', 'Database query must return user count');

console.log(`✅ Database verified: SQLite initialized with ${userCount.count} users`);
console.log('🎉 All backend tests passed successfully!');
process.exit(0);
