import { DiseaseDetectionResult } from '../types/cropPrediction';

// ─── Backend-Mediated Gemini Vision AI for Plant Leaf Pathology ──────────────

export interface StandardizedDiseaseResult extends DiseaseDetectionResult {
    plant: string;
    plantName: string;
    cropName: string;
    diseaseName: string;
    description: string;
    confidence: number;
    confidenceScore: number;
    severity: 'low' | 'medium' | 'high' | 'unknown';
    severityLevel: 'low' | 'medium' | 'high' | 'unknown';
    action: string;
    actionRequired: string;
    symptoms: string[];
    symptomsObserved: string[];
    treatment: string[];
    prevention: string[];
    preventionTips: string[];
}

/**
 * Normalizes input MIME types to standard image MIME types supported by Gemini.
 */
export function normalizeMimeType(rawMime?: string): string {
    const clean = (rawMime || '').toLowerCase().trim();
    if (clean === 'image/jpg' || clean === 'image/pjpeg') return 'image/jpeg';
    if (clean === 'image/jpeg' || clean === 'image/png' || clean === 'image/webp') return clean;
    return 'image/jpeg';
}

/**
 * Extracts clean Base64 data and MIME type from a data URL or raw Base64 string.
 */
export function extractBase64AndMime(dataOrBase64: string, fallbackMime: string = 'image/jpeg'): { base64Data: string; mimeType: string } {
    if (!dataOrBase64 || typeof dataOrBase64 !== 'string') {
        throw new Error("Invalid image input: Image data is empty or corrupted.");
    }

    const trimmed = dataOrBase64.trim();

    // Check for standard data URL format: data:<mime>;base64,<data>
    const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
    if (dataUrlMatch) {
        return {
            mimeType: normalizeMimeType(dataUrlMatch[1]),
            base64Data: dataUrlMatch[2].replace(/\s+/g, ''),
        };
    }

    // Check for comma separation without standard data URL prefix
    const commaIndex = trimmed.indexOf(',');
    if (commaIndex !== -1 && trimmed.startsWith('data:')) {
        const header = trimmed.substring(0, commaIndex);
        const data = trimmed.substring(commaIndex + 1).replace(/\s+/g, '');
        const mimeMatch = header.match(/data:([^;]+)/);
        const mime = mimeMatch ? mimeMatch[1] : fallbackMime;
        return {
            mimeType: normalizeMimeType(mime),
            base64Data: data,
        };
    }

    // Raw base64 string
    return {
        mimeType: normalizeMimeType(fallbackMime),
        base64Data: trimmed.replace(/\s+/g, ''),
    };
}

/**
 * Validates the image data format, size, and integrity before API dispatch.
 */
export function validateImageInput(base64Data: string, mimeType: string): void {
    if (!base64Data || base64Data.length === 0) {
        throw new Error("Image data is empty. Please select a valid plant image.");
    }

    const supportedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!supportedMimes.includes(mimeType)) {
        throw new Error(`Unsupported image format: ${mimeType}. Please upload a JPEG, PNG, or WebP image.`);
    }

    // Estimate file size from base64 string length: (len * 3/4)
    const estimatedSizeBytes = Math.round(base64Data.length * 0.75);
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB limit

    if (estimatedSizeBytes > maxSizeBytes) {
        throw new Error("Image file size exceeds the 10MB limit. Please upload a smaller image.");
    }

    if (estimatedSizeBytes < 50) {
        throw new Error("Image file is too small or corrupted. Please upload a valid plant leaf photo.");
    }
}

/**
 * Strict validator for Gemini structured JSON diagnosis output.
 */
export function validateAndStandardizeDiagnosis(rawObj: any, requestId: string): StandardizedDiseaseResult {
    if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
        throw new Error("Received malformed diagnostic output from Gemini vision service.");
    }

    const plantStr = String(rawObj.plant || rawObj.plantName || rawObj.cropName || 'Unknown').trim();
    const diseaseStr = String(rawObj.diseaseName || rawObj.disease || 'Uncertain').trim();
    const descStr = String(rawObj.description || '').trim();

    // Standardize confidence to integer 0-100
    let parsedConfidence = 0;
    if (typeof rawObj.confidence === 'number' && !isNaN(rawObj.confidence)) {
        parsedConfidence = Math.round(rawObj.confidence);
    } else if (typeof rawObj.confidenceScore === 'number' && !isNaN(rawObj.confidenceScore)) {
        parsedConfidence = Math.round(rawObj.confidenceScore);
    } else if (typeof rawObj.confidence === 'string') {
        const num = parseFloat(rawObj.confidence.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) parsedConfidence = Math.round(num);
    }

    if (parsedConfidence < 0) parsedConfidence = 0;
    if (parsedConfidence > 100) parsedConfidence = 100;

    // Standardize severity
    let rawSeverity = String(rawObj.severity || rawObj.severityLevel || 'unknown').toLowerCase().trim();
    if (!['low', 'medium', 'high', 'unknown'].includes(rawSeverity)) {
        rawSeverity = 'unknown';
    }
    const severity = rawSeverity as 'low' | 'medium' | 'high' | 'unknown';

    // Standardize action
    const action = String(rawObj.action || rawObj.actionRequired || '').trim();

    // Standardize arrays
    const toArray = (val: any): string[] => {
        if (Array.isArray(val)) return val.map((item) => String(item).trim()).filter(Boolean);
        if (typeof val === 'string' && val.trim()) return [val.trim()];
        return [];
    };

    const symptoms = toArray(rawObj.symptoms || rawObj.symptomsObserved);
    const treatment = toArray(rawObj.treatment);
    const prevention = toArray(rawObj.prevention || rawObj.preventionTips);

    return {
        plant: plantStr,
        plantName: plantStr,
        cropName: plantStr,
        diseaseName: diseaseStr,
        description: descStr,
        confidence: parsedConfidence,
        confidenceScore: parsedConfidence,
        severity,
        severityLevel: severity,
        action,
        actionRequired: action,
        symptoms,
        symptomsObserved: symptoms,
        treatment,
        prevention,
        preventionTips: prevention,
    };
}

const resolveApiBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    const isLocal = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
    if (!isLocal || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) {
      return envUrl.trim().replace(/\/+$/, '');
    }
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || '';
    if (hostname.includes('pages.dev') || hostname.includes('onrender.com') || hostname.includes('fieldwise.agri')) {
      return 'https://fieldwise-backend-staging.onrender.com';
    }
  }
  return 'https://fieldwise-backend-staging.onrender.com';
};

const API_BASE_URL = resolveApiBaseUrl();

function getAuthTokenFromStorage(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('fieldwise_auth_token') ||
         localStorage.getItem('croppredict_token') ||
         localStorage.getItem('token') ||
         null;
}

/**
 * Detects plant leaf diseases using backend-mediated Google Gemini Vision analysis.
 * Sends image bytes to the authenticated Express backend, keeping the API key private.
 * NEVER returns fake predictions, hardcoded catalogue fallbacks, or filename-based guesses.
 */
export const detectPlantDisease = async (
    imageDataBase64: string,
    mimeType: string = 'image/jpeg',
    fileName?: string
): Promise<DiseaseDetectionResult> => {
    // 1. Generate unique request ID for independent tracing
    const requestId = `diag_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 2. Extract and validate clean Base64 data and MIME type
    const { base64Data, mimeType: resolvedMime } = extractBase64AndMime(imageDataBase64, mimeType);
    validateImageInput(base64Data, resolvedMime);

    const approxSizeBytes = Math.round(base64Data.length * 0.75);

    // Metadata-only logging: NEVER log API key or complete base64 image data
    console.log(`🌿 [${requestId}] Plant disease diagnostic request started:`, {
        requestId,
        fileName: fileName ? fileName.replace(/[^\w.-]/g, '_') : 'unnamed_image',
        mimeType: resolvedMime,
        approxSizeBytes,
        timestamp: new Date().toISOString()
    });

    const token = getAuthTokenFromStorage();
    if (!token) {
        throw new Error("Authentication required: Please log in to perform plant disease diagnosis.");
    }

    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}/api/disease/diagnose`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                image: imageDataBase64,
                mimeType: resolvedMime,
                fileName: fileName ? fileName.replace(/[^\w.-]/g, '_') : 'unnamed_image'
            })
        });
    } catch (networkErr: any) {
        throw new Error("Network error connecting to diagnostic server. Please check your internet connection.");
    }

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("Authentication session expired or invalid. Please log in again.");
        }
        if (response.status === 429) {
            throw new Error("Too many diagnostic requests. Please wait a moment before trying again.");
        }
        if (response.status === 503) {
            throw new Error("Plant disease diagnostic service is currently unconfigured or unavailable on the server.");
        }
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || errJson?.message || `Diagnostic request failed with status ${response.status}.`);
    }

    const data = await response.json();
    if (!data.success || !data.diagnosis) {
        throw new Error("Invalid diagnostic response received from server.");
    }

    const standardized = validateAndStandardizeDiagnosis(data.diagnosis, requestId);

    console.log(`✅ [${requestId}] Completed plant disease detection via backend:`, {
        requestId,
        plant: standardized.plant,
        diseaseName: standardized.diseaseName,
        confidence: `${standardized.confidence}%`,
        severity: standardized.severity,
    });

    return standardized;
};
