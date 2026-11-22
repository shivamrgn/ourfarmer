/**
 * CropPredict AI — Improved Prediction Engine
 *
 * Uses Gaussian distance scoring for continuous variables (rainfall, temp, humidity)
 * so scores decay smoothly instead of cliff-edge binary match/miss.
 *
 * Factor Weights:
 *   Rainfall     22%
 *   Temperature  22%
 *   Humidity     16%
 *   Soil Type    20%
 *   Nitrogen      8%
 *   Phosphorus    6%
 *   Potassium     6%
 *   pH (bonus)    up to +10 bonus pts
 */

const { crops } = require('./cropDatabase');
const { fertilizers } = require('./fertilizerDatabase');

/**
 * Gaussian score for continuous range variables.
 * Returns score 0–maxScore:
 *   - If value is within [min, max]: full score
 *   - Outside: score decays using a Gaussian curve (sigma = half range width)
 */
function gaussianRangeScore(value, min, max, maxScore) {
    if (value >= min && value <= max) return maxScore;
    const rangeWidth = max - min;
    const sigma = Math.max(rangeWidth / 2, 1); // avoid division by zero
    const delta = value < min ? min - value : value - max;
    const gaussScore = maxScore * Math.exp(-(delta * delta) / (2 * sigma * sigma));
    return Math.max(0, gaussScore);
}

/**
 * Partial credit score for NPK values.
 * Within range → full score. Within 25% of range boundary → partial. Outside → 0.
 */
function npkScore(value, min, max, maxScore) {
    if (value >= min && value <= max) return maxScore;
    const tolerance = (max - min) * 0.25 + 10; // 25% tolerance + flat 10 kg/ha buffer
    if (value >= min - tolerance && value <= max + tolerance) {
        const dist = value < min ? min - value : value - max;
        return maxScore * (1 - dist / tolerance) * 0.6; // max 60% partial credit
    }
    return 0;
}

/**
 * pH bonus points: +10 if in range, +5 if within 0.5 units, 0 otherwise
 */
function pHBonus(ph, phRange) {
    if (ph >= phRange[0] && ph <= phRange[1]) return 10;
    const dist = ph < phRange[0] ? phRange[0] - ph : ph - phRange[1];
    if (dist <= 0.5) return 5;
    return 0;
}

/**
 * Main prediction function.
 */
function predictCrops(inputs) {
    const {
        rainfall,
        temperature,
        humidity,
        soilType,
        nitrogen,
        phosphorus,
        potassium,
        ph,
    } = inputs;

    const results = [];

    for (const crop of crops) {
        // ── Continuous variable scores (Gaussian) ──────────────────────
        const rainfallScore = gaussianRangeScore(rainfall, crop.minRainfall, crop.maxRainfall, 22);
        const temperatureScore = gaussianRangeScore(temperature, crop.minTemperature, crop.maxTemperature, 22);
        const humidityScore = gaussianRangeScore(humidity, crop.minHumidity, crop.maxHumidity, 16);

        // ── Soil type match ─────────────────────────────────────────────
        const soilScore = crop.soilTypes.includes(soilType) ? 20 : 0;

        // ── NPK partial-credit scoring ──────────────────────────────────
        const nScore = npkScore(nitrogen, crop.nitrogenRange[0], crop.nitrogenRange[1], 8);
        const pScore = npkScore(phosphorus, crop.phosphorusRange[0], crop.phosphorusRange[1], 6);
        const kScore = npkScore(potassium, crop.potassiumRange[0], crop.potassiumRange[1], 6);

        // ── pH bonus ────────────────────────────────────────────────────
        const phBonus = pHBonus(ph, crop.phRange);

        // ── Total raw score (max = 22+22+16+20+8+6+6+10 = 110) ─────────
        const rawScore = rainfallScore + temperatureScore + humidityScore
            + soilScore + nScore + pScore + kScore + phBonus;

        // Normalize to 0–100 confidence
        const maxPossible = 110;
        const confidence = Math.min(99, Math.max(5, (rawScore / maxPossible) * 100));

        // Yield varies with confidence: worst case 65%, best case 110% of base yield
        const yieldMultiplier = 0.65 + (confidence / 100) * 0.45;
        const yieldPrediction = Math.round(crop.yieldPerHectare * yieldMultiplier * 10) / 10;

        // Only include if confidence > 35%
        if (confidence > 35) {
            results.push({
                crop: {
                    id: crop.id,
                    name: crop.name,
                    season: crop.season,
                    icon: crop.icon,
                    description: crop.description,
                    minRainfall: crop.minRainfall,
                    maxRainfall: crop.maxRainfall,
                    minTemperature: crop.minTemperature,
                    maxTemperature: crop.maxTemperature,
                    minHumidity: crop.minHumidity,
                    maxHumidity: crop.maxHumidity,
                    soilTypes: crop.soilTypes,
                    nitrogenRange: crop.nitrogenRange,
                    phosphorusRange: crop.phosphorusRange,
                    potassiumRange: crop.potassiumRange,
                    phRange: crop.phRange,
                    yieldPerHectare: crop.yieldPerHectare,
                },
                confidence: Math.round(confidence * 10) / 10,
                yieldPrediction,
                scoreBreakdown: {
                    rainfall: Math.round(rainfallScore * 10) / 10,
                    temperature: Math.round(temperatureScore * 10) / 10,
                    humidity: Math.round(humidityScore * 10) / 10,
                    soil: soilScore,
                    nitrogen: Math.round(nScore * 10) / 10,
                    phosphorus: Math.round(pScore * 10) / 10,
                    potassium: Math.round(kScore * 10) / 10,
                    phBonus,
                },
                fertilizers: fertilizers[crop.id] || [],
            });
        }
    }

    // Sort descending by confidence, return top 6
    return results.sort((a, b) => b.confidence - a.confidence).slice(0, 6);
}

module.exports = { predictCrops };


