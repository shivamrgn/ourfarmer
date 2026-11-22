/**
 * FieldWise Phase 3A.2.2: Hardened Backend Plant Disease Detection Controller
 * ===========================================================================
 * Secure server-side proxy for Gemini multimodal plant pathology analysis.
 *
 * Security & Operational Invariants:
 *   1. Key Protection: GEMINI_API_KEY is held exclusively in backend server config.
 *      Never exposed to browser clients or logged to console/files.
 *   2. Privacy & Data Minimization: Full base64 image data and API keys are NEVER logged.
 *      Only metadata (size, MIME type, requestId, farmerId, timestamp) is recorded.
 *   3. Strict Input & Image Validation:
 *      - Rejects missing, malformed base64, or non-whitelisted MIME payloads.
 *      - Strictly validates decoded byte length (50 bytes to 10MB).
 *      - Validates magic bytes / image header signatures (JPEG, PNG, WEBP).
 *   4. Bounded Upstream Timeouts:
 *      - 10-second per-model socket timeout with explicit abort.
 *      - 25-second overall cumulative request timeout budget across model fallbacks.
 *   5. Model Configuration:
 *      - Configured via backend GEMINI_MODEL (defaulting to verified 'gemini-1.5-flash').
 *      - Does not assume availability of unverified model names.
 *   6. Advisory Safeguards:
 *      - Every diagnosis returns an explicit agronomic advisory disclaimer.
 */

const https = require('https');

const ALLOWED_MIME_TYPES = Object.freeze([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
]);

const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';

// Timeout budgets
const PER_MODEL_TIMEOUT_MS = 10000; // 10 seconds per model attempt
const OVERALL_TIMEOUT_MS = 25000;   // 25 seconds cumulative budget

const PATHOLOGY_PROMPT = `You are an expert plant pathologist and botanical vision diagnostic assistant.
Inspect the attached image carefully and provide an honest, evidence-based agronomic evaluation.

DIAGNOSTIC GUIDELINES:
1. Plant Identification: Identify the crop species or botanical genus if a plant is present.
2. Pathology Assessment:
   - If the leaf is completely healthy, report diseaseName as "Healthy".
   - If a disease or pest infestation is observed, report the specific pathology name (e.g. "Early Blight", "Powdery Mildew").
   - If the image is blurry, ambiguous, or inconclusive, report diseaseName as "Uncertain".
   - If the image does NOT contain a plant leaf, report diseaseName as "Invalid Image".
3. Treatment & Cultural Management:
   - Provide practical curative treatments (organic options and standard chemical interventions).
   - Provide preventative cultural practices for future crop cycles.

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this structure with NO extra markdown or conversational text:
{
  "plant": "Plant name or Unknown",
  "diseaseName": "Disease name, Healthy, Uncertain, or Invalid Image",
  "description": "Visual explanation of observed botanical features",
  "confidenceScore": 90,
  "severityLevel": "low, medium, high, or unknown",
  "actionRequired": "Recommended next step",
  "symptomsObserved": ["Symptom 1", "Symptom 2"],
  "treatment": ["Treatment option 1", "Treatment option 2"],
  "preventionTips": ["Prevention practice 1", "Prevention practice 2"]
}`;

let customDispatcher = null; // For unit test mocking

function setCustomDispatcher(dispatcher) {
    customDispatcher = dispatcher;
}

function resetCustomDispatcher() {
    customDispatcher = null;
}

/**
 * Extracts and sanitizes clean Base64 data and MIME type from a data URL or raw Base64 string.
 */
function extractBase64AndMime(input, fallbackMime = 'image/jpeg') {
    if (!input || typeof input !== 'string') {
        return { base64Data: '', mimeType: fallbackMime, isValidBase64: false };
    }
    const trimmed = input.trim();
    if (trimmed.startsWith('data:')) {
        const matches = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
        if (matches) {
            const rawData = matches[2].replace(/\s+/g, '');
            const isValidBase64 = /^[A-Za-z0-9+/=]+$/.test(rawData);
            return {
                mimeType: matches[1].toLowerCase().trim(),
                base64Data: rawData,
                isValidBase64,
            };
        }
        return { base64Data: '', mimeType: 'invalid', isValidBase64: false };
    }

    const cleanBase64 = trimmed.replace(/\s+/g, '');
    const isValidBase64 = /^[A-Za-z0-9+/=]+$/.test(cleanBase64);
    return {
        base64Data: cleanBase64,
        mimeType: fallbackMime.toLowerCase().trim(),
        isValidBase64,
    };
}

/**
 * Validates actual image binary magic bytes (JPEG, PNG, WEBP).
 */
function detectImageFormat(buffer) {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) {
        return null;
    }
    // JPEG magic bytes: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return 'image/jpeg';
    }
    // PNG magic bytes: 89 50 4E 47 (\x89PNG)
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return 'image/png';
    }
    // WEBP magic bytes: RIFF....WEBP
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
        return 'image/webp';
    }
    return null;
}

async function dispatchToGeminiRest(apiKey, model, base64Data, mimeType, requestId, timeoutMs = PER_MODEL_TIMEOUT_MS) {
    if (customDispatcher) {
        return customDispatcher({ apiKey, model, base64Data, mimeType, requestId });
    }

    const payload = JSON.stringify({
        contents: [
            {
                parts: [
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data,
                        },
                    },
                    {
                        text: PATHOLOGY_PROMPT,
                    },
                ],
            },
        ],
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
        },
    });

    return new Promise((resolve, reject) => {
        const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`);
        const req = https.request(
            url,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                },
                timeout: timeoutMs,
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        return reject(new Error(`Upstream Gemini API error (${res.statusCode}): ${data.substring(0, 200)}`));
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (!text) {
                            return reject(new Error('Gemini response contained no candidate text parts.'));
                        }
                        const cleanJson = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                        const result = JSON.parse(cleanJson);
                        resolve(result);
                    } catch (parseErr) {
                        reject(new Error(`Failed to parse Gemini response JSON: ${parseErr.message}`));
                    }
                });
            }
        );

        req.on('timeout', () => {
            req.destroy(new Error(`Gemini API request timed out for model ${model}.`));
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(payload);
        req.end();
    });
}

async function diagnoseDisease(req, res) {
    const requestId = `diag_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const startTime = Date.now();

    // 1. Check server API key configuration (accepts strictly GEMINI_API_KEY)
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
        return res.status(503).json({
            success: false,
            error: {
                code: 'GEMINI_NOT_CONFIGURED',
                message: 'Gemini Vision diagnostic service is not configured on the server.',
            },
        });
    }

    // 2. Validate request body presence
    if (!req.body || !req.body.image) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'IMAGE_REQUIRED',
                message: 'Mandatory field "image" containing image data or data URL is missing.',
            },
        });
    }

    // 3. Extract and sanitize base64 and MIME
    const { base64Data, mimeType, isValidBase64 } = extractBase64AndMime(req.body.image, req.body.mimeType || 'image/jpeg');

    if (!base64Data || !isValidBase64) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'IMAGE_CORRUPTED',
                message: 'Uploaded image file contains invalid base64 encoding or corrupted data.',
            },
        });
    }

    // 4. Validate MIME type declaration
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_IMAGE_TYPE',
                message: `Invalid image type '${mimeType}'. Allowed formats: JPEG, PNG, WEBP.`,
            },
        });
    }

    // 5. Decode buffer and validate decoded byte length
    let decodedBuffer;
    try {
        decodedBuffer = Buffer.from(base64Data, 'base64');
    } catch {
        return res.status(400).json({
            success: false,
            error: {
                code: 'IMAGE_CORRUPTED',
                message: 'Failed to decode base64 image data.',
            },
        });
    }

    if (decodedBuffer.length < 50) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'IMAGE_CORRUPTED',
                message: 'Uploaded image file is empty or corrupted (under 50 bytes).',
            },
        });
    }

    if (decodedBuffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'IMAGE_TOO_LARGE',
                message: 'Image size exceeds the 10MB limit. Please upload a smaller image.',
            },
        });
    }

    // 6. Magic bytes binary validation (ensure actual image content matches permitted formats)
    const detectedFormat = detectImageFormat(decodedBuffer);
    if (!detectedFormat) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_IMAGE_TYPE',
                message: 'Uploaded file is not a valid JPEG, PNG, or WEBP image format.',
            },
        });
    }

    // 7. Metadata-only logging (NEVER log API key or image data!)
    console.log(`[DiseaseDiagnosis] Diagnostic request ${requestId}:`, {
        requestId,
        mimeType: detectedFormat,
        byteLength: decodedBuffer.length,
        farmerId: req.user ? req.user.id : 'unauthenticated',
        timestamp: new Date().toISOString(),
    });

    // 8. Model Selection & Fallback Loop with Cumulative Timeout Guard
    const configuredModel = (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();
    const candidateFallbackModels = ['gemini-1.5-flash', 'gemini-2.0-flash'];
    const modelsToTry = [
        configuredModel,
        ...candidateFallbackModels,
    ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

    let lastError = null;

    for (const model of modelsToTry) {
        // Enforce cumulative timeout budget
        const elapsed = Date.now() - startTime;
        if (elapsed >= OVERALL_TIMEOUT_MS) {
            console.warn(`[DiseaseDiagnosis] Cumulative timeout budget (${OVERALL_TIMEOUT_MS}ms) reached for ${requestId}. Aborting further model attempts.`);
            break;
        }

        const remainingMs = Math.max(1000, OVERALL_TIMEOUT_MS - elapsed);
        const perAttemptTimeout = Math.min(PER_MODEL_TIMEOUT_MS, remainingMs);

        try {
            const rawResult = await dispatchToGeminiRest(apiKey, model, base64Data, detectedFormat, requestId, perAttemptTimeout);

            const confidence = typeof rawResult.confidenceScore === 'number'
                ? rawResult.confidenceScore
                : (typeof rawResult.confidence === 'number' ? rawResult.confidence : 85);

            const standardized = {
                plant: rawResult.plant || 'Unknown Crop',
                plantName: rawResult.plant || 'Unknown Crop',
                cropName: rawResult.plant || 'Unknown Crop',
                diseaseName: rawResult.diseaseName || 'Uncertain',
                description: rawResult.description || 'Diagnosis completed.',
                confidence,
                confidenceScore: confidence,
                severity: rawResult.severityLevel || 'unknown',
                severityLevel: rawResult.severityLevel || 'unknown',
                action: rawResult.actionRequired || 'Monitor crop regularly.',
                actionRequired: rawResult.actionRequired || 'Monitor crop regularly.',
                symptoms: Array.isArray(rawResult.symptomsObserved) ? rawResult.symptomsObserved : [],
                symptomsObserved: Array.isArray(rawResult.symptomsObserved) ? rawResult.symptomsObserved : [],
                treatment: Array.isArray(rawResult.treatment) ? rawResult.treatment : [],
                prevention: Array.isArray(rawResult.preventionTips) ? rawResult.preventionTips : [],
                preventionTips: Array.isArray(rawResult.preventionTips) ? rawResult.preventionTips : [],
                analyzedAt: new Date().toISOString(),
                requestId,
                advisoryDisclaimer: 'FieldWise AI diagnostics are advisory recommendations based on visual pattern matching. Always consult a certified local agronomist before applying chemical treatments.',
            };

            return res.status(200).json({
                success: true,
                diagnosis: standardized,
            });
        } catch (err) {
            lastError = err;
            console.warn(`[DiseaseDiagnosis] Model ${model} failed for ${requestId}: ${err.message}`);
        }
    }

    console.error(`[DiseaseDiagnosis] All candidate models failed for ${requestId}:`, lastError?.message);
    return res.status(502).json({
        success: false,
        error: {
            code: 'UPSTREAM_AI_ERROR',
            message: 'Unable to analyze the image using AI service at this time. Please try again shortly.',
        },
    });
}

module.exports = {
    diagnoseDisease,
    setCustomDispatcher,
    resetCustomDispatcher,
    extractBase64AndMime,
    detectImageFormat,
    ALLOWED_MIME_TYPES,
    DEFAULT_GEMINI_MODEL,
    PER_MODEL_TIMEOUT_MS,
    OVERALL_TIMEOUT_MS,
};
