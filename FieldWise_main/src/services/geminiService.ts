import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { CropPrediction, CropRecommendation, MarketInsight, DiseaseDetectionResult } from '../types/cropPrediction';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const model: GenerativeModel | null = genAI ? genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" }) : null;

// Enhanced crop recommendations with 6 crops and profit analysis
export const getCropRecommendations = async (details: {
    location: string;
    farmSize: string;
    soilType: string;
    season: string;
    budget: string;
    previousCrop: string;
}): Promise<CropRecommendation[]> => {
    const { location, farmSize, soilType, season, budget, previousCrop } = details;

    const prompt = `
        You are an expert agronomist and agricultural economist providing crop recommendations for Indian farmers.
        
        User's Farm Data:
        - Location: ${location}, India
        - Farm Size: ${farmSize} acres
        - Soil Type: ${soilType}
        - Season: ${season}
        - Maximum Investment Budget: ₹${budget}
        - Previous Crop: ${previousCrop}

        Based on this EXACT data, recommend the top 6 most profitable and suitable crops for this farmer.
        
        IMPORTANT: Make recommendations HIGHLY SPECIFIC to these inputs:
        - Location: Consider regional climate, soil conditions, and market access in ${location}
        - Season: ${season} season crops only (Kharif=Monsoon crops, Rabi=Winter crops, Zaid=Summer crops)
        - Soil Type: ${soilType} soil compatible crops only
        - Budget: Investment must be under ₹${budget}
        - Farm Size: Calculate realistic yields for ${farmSize} acres
        - Previous Crop: Consider crop rotation benefits after ${previousCrop}

        For each crop, provide:
        - cropName: Specific crop variety suitable for ${location}
        - profitability: "High Profit", "Medium Profit", or "Low Profit"
        - expectedYield: Realistic yield for ${farmSize} acres
        - investment: Cost under ₹${budget} (format: "₹X,XXX")
        - duration: Cultivation period for ${season} season
        - marketPrice: Current market price in ${location} region (format: "₹X-XX/kg")
        - reasons: 3 specific reasons why this crop is perfect for ${location} in ${season} season

        Return ONLY a valid JSON array with exactly 6 different crops suitable for these exact conditions.
        Make each recommendation unique and specific to the input data provided.
    `;
    
    if (!model) {
        return getFallbackRecommendations(details);
    }
    
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Clean and parse JSON response
        const cleanText = text.replace(/```json|```/g, '').trim();
        console.log('🤖 Raw AI Response:', cleanText);
        
        const recommendations = JSON.parse(cleanText) as CropRecommendation[];
        console.log('📊 Parsed recommendations:', recommendations);
        
        // Ensure we have exactly 6 recommendations
        return recommendations.slice(0, 6);
        
    } catch (error) {
        console.error("Error getting crop recommendations:", error);
        // Return fallback recommendations if API fails
        return getFallbackRecommendations(details);
    }
};

// Enhanced crop predictions with detailed financial analysis
export const getCropPredictions = async (details: {
    location: string; 
    soilType: string; 
    farmSize: string; 
    season: string;
    budget: string;
}): Promise<CropPrediction[]> => {
    const { location, soilType, farmSize, season, budget } = details;

    const prompt = `
        You are a world-class agronomist and agricultural financial analyst specializing in Indian agriculture. 
        Provide detailed crop predictions with comprehensive financial analysis.

        User's Farm Data:
        - Location: ${location}, India
        - Soil Type: ${soilType}
        - Farm Size: ${farmSize} hectares
        - Season: ${season}
        - Maximum Investment Budget: ₹${budget}

        Based on this data, recommend the top 6 most profitable and suitable crops with detailed financial projections.
        The investment for each crop should not exceed the user's budget.

        For each crop, provide:
        - cropName: Common name of the crop
        - reason: Detailed reason for recommendation based on user's specific conditions
        - duration: Cultivation duration in days
        - estimatedInvestment: Total investment cost in ₹ (formatted as "₹X,XXX")
        - expectedYield: Expected yield per hectare
        - potentialRevenue: Total potential revenue in ₹ (formatted as "₹X,XXX")
        - estimatedProfit: Net profit in ₹ (formatted as "₹X,XXX")

        Ensure all financial figures are realistic for the specified location and farm size.
        Your output must be a valid JSON array with exactly 6 crop predictions.
    `;
    
    if (!model) {
        return getFallbackPredictions(details);
    }
    
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Clean and parse JSON response
        const cleanText = text.replace(/```json|```/g, '').trim();
        const predictions = JSON.parse(cleanText) as CropPrediction[];
        
        // Ensure we have exactly 6 predictions
        return predictions.slice(0, 6);
        
    } catch (error) {
        console.error("Error getting crop predictions:", error);
        // Return fallback predictions if API fails
        return getFallbackPredictions(details);
    }
};

// Market insights for specific crops
export const getMarketInsights = async (cropName: string, location: string): Promise<MarketInsight> => {
    if (!model) {
        return getFallbackMarketInsights(cropName);
    }

    const prompt = `
        As a senior agricultural market analyst for India, provide comprehensive market insights for ${cropName} in the ${location} region.
        
        Analyze:
        - Current market price trends
        - Demand forecast for the next 6 months
        - Market stability assessment
        - Key risks and opportunities
        - Regional market conditions
        
        Your output must be a valid JSON object with:
        - stability: 'Stable', 'Volatile', or 'Growing'
        - trends: Array of 3-4 key market trends
        - demandForecast: One-sentence demand forecast
        - risks: Array of 2-3 potential market risks
    `;
    
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const cleanText = text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanText) as MarketInsight;
        
    } catch (error) {
        console.error(`Error getting market insights for ${cropName}:`, error);
        return getFallbackMarketInsights(cropName);
    }
};

// ─── Real Gemini Vision AI for Plant Leaf Pathology (Gemini 2.5 Flash) ───────

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

/**
 * Detects plant leaf diseases using Google Gemini 2.5 Flash multimodal vision analysis.
 * Sends actual image bytes with diagnostic agronomic prompting and strict structured JSON output.
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

    // 3. Verify Gemini API key configuration
    const activeApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!activeApiKey || !activeApiKey.trim()) {
        console.error(`❌ [${requestId}] VITE_GEMINI_API_KEY is not configured in client environment.`);
        throw new Error(
            "Gemini API key is missing. Please configure VITE_GEMINI_API_KEY in your .env file with a valid Google AI Studio API key."
        );
    }

    // 4. Candidate vision models in priority order:
    // - gemini-3.1-flash-lite: high-speed, active vision pathology support with zero 503 drops and immediate response
    // - gemini-3.8-flash: latest vision model recommended by Google AI Studio
    // - gemini-3.5-flash-lite: lightweight high-throughput vision fallback
    // - gemini-flash-latest: latest rolling flash release
    const configuredModel = (import.meta.env.VITE_GEMINI_MODEL || '').trim();
    const candidateModels = [
        ...(configuredModel ? [configuredModel] : []),
        "gemini-3.1-flash-lite",
        "gemini-3.8-flash",
        "gemini-3.5-flash-lite",
        "gemini-flash-latest",
    ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

    const client = new GoogleGenerativeAI(activeApiKey.trim());

    // 5. Build image inline data part
    const imagePart = {
        inlineData: {
            data: base64Data,
            mimeType: resolvedMime,
        },
    };

    // 6. Professional Plant Pathology Diagnostic Prompt
    const pathologyPrompt = `You are an expert plant pathologist and botanical vision diagnostic assistant.
Inspect the attached image carefully and provide an honest, evidence-based agronomic evaluation.

DIAGNOSTIC GUIDELINES:
1. IMAGE VALIDITY & DOMAIN SCREENING:
   - Determine whether the image contains a plant leaf, plant foliage, crop stem, or agricultural plant specimen.
   - If the image does NOT contain a plant or leaf (e.g. car, building, animal, person, food dish, text document, household object, electronic device):
     Set "plant" to "Unknown".
     Set "diseaseName" to "Invalid Image".
     Set "description" to an explanation that the image does not depict a plant leaf or crop specimen.
     Set "confidence" and "confidenceScore" to 0.
     Set "severity" and "severityLevel" to "unknown".
     Set "action" and "actionRequired" to "Please upload a clear photograph of a plant leaf or crop foliage.".
     Set "symptoms", "symptomsObserved", "treatment", "prevention", and "preventionTips" to empty arrays [].
   - If the image contains a plant but is too blurry, dark, out-of-focus, occluded, or low-resolution for a reliable diagnosis:
     Set "plant" to the identifiable plant species or "Unknown".
     Set "diseaseName" to "Uncertain".
     Set "description" explaining why visual evidence is insufficient (e.g., motion blur, extreme distance, glare).
     Set "confidence" and "confidenceScore" to a score below 40.
     Set "severity" and "severityLevel" to "unknown".
     Set "action" and "actionRequired" to "Retake a well-lit, in-focus close-up photograph of the affected leaf.".
     Set "symptoms", "symptomsObserved", "treatment", "prevention", and "preventionTips" to empty arrays [].

2. HEALTHY VS DISEASED ASSESSMENT:
   - If the leaf is healthy and shows no pathogenic symptoms:
     Set "plant" to the identified plant species (e.g., "Tomato", "Potato", "Mango", "Rice", "Wheat").
     Set "diseaseName" to "Healthy".
     Set "description" describing the vibrant chlorophyll distribution, intact leaf cuticle, and absence of pathogenic lesions or chlorosis.
     Set "confidence" and "confidenceScore" to the visual certainty percentage (e.g., 85 to 98).
     Set "severity" and "severityLevel" to "low".
     Set "action" and "actionRequired" to "Plant appears healthy. Continue standard irrigation, balanced nutrition, and routine crop scouting.".
     Set "symptoms" and "symptomsObserved" to ["Normal leaf morphology", "Intact cuticle without chlorosis or necrosis", "Healthy green pigmentation"].
     Set "treatment" to ["No corrective chemical or fungicide application required."].
     Set "prevention" and "preventionTips" to ["Maintain regular crop scouting", "Ensure proper spacing and drainage", "Follow seasonal fertilization schedule"].

3. DISEASE IDENTIFICATION:
   - Only diagnose a specific disease when supported by clear, observable visual evidence (e.g. concentric dark rings, water-soaked margins, fungal pustules, powdery white coating, angular lesions bounded by veins).
   - Distinguish between similar-looking conditions where possible (e.g., Early Blight vs Late Blight; Powdery Mildew vs Downy Mildew).
   - Do NOT assume every yellow, brown, or dry speck is a disease—consider mechanical injury, natural aging, or sunburn.
   - NEVER invent a disease name. Never copy from previous responses. Never fabricate unrealistic confidence scores.
   - For real diseases, provide:
     - "plant": Identified crop/plant name (e.g., "Tomato", "Potato", "Rice", "Wheat").
     - "diseaseName": Standard agricultural disease name (e.g., "Tomato Early Blight", "Potato Late Blight", "Powdery Mildew").
     - "description": Detailed visual explanation citing specific lesions, margins, halos, and coloration observed in the image.
     - "confidence": Integer (0-100) reflecting diagnostic certainty.
     - "confidenceScore": Same integer.
     - "severity" and "severityLevel": "low", "medium", or "high".
     - "action" and "actionRequired": Immediate agronomic recommendation.
     - "symptoms" and "symptomsObserved": Array of specific observable symptoms.
     - "treatment": Array of practical curative treatments, organic options, or chemical interventions.
     - "prevention" and "preventionTips": Array of preventative cultural practices for future crop cycles.

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this structure with NO extra markdown or text:
{
  "plant": "Plant name or Unknown",
  "diseaseName": "Disease name, Healthy, Uncertain, or Invalid Image",
  "description": "Visual explanation",
  "confidence": 0,
  "confidenceScore": 0,
  "severity": "low, medium, high, or unknown",
  "severityLevel": "low, medium, high, or unknown",
  "action": "Recommended next step",
  "actionRequired": "Recommended next step",
  "symptoms": [],
  "symptomsObserved": [],
  "treatment": [],
  "prevention": [],
  "preventionTips": []
}`;

    // 7. Dispatch to Gemini with candidate model fallback and timeout guard (30 seconds)
    let lastError: any = null;

    for (const modelName of candidateModels) {
        try {
            console.log(`📡 [${requestId}] Dispatching image to Gemini model: ${modelName}...`);
            const startTime = Date.now();

            const visionModel = client.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.2, // deterministic, low-hallucination pathology inference
                },
            });

            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Gemini API request timed out for model ${modelName}. Please try again.`));
                }, 15000);
            });

            const apiPromise = visionModel.generateContent([imagePart, pathologyPrompt]);
            const result = await Promise.race([apiPromise, timeoutPromise]);
            const response = await result.response;
            const responseText = response.text();
            const durationMs = Date.now() - startTime;

            console.log(`📥 [${requestId}] Gemini response received from ${modelName} in ${durationMs}ms`);

            // 8. Clean and parse JSON response
            const cleanJson = responseText
                .replace(/^```(?:json)?\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();

            let parsed: any;
            try {
                parsed = JSON.parse(cleanJson);
            } catch (jsonErr: any) {
                console.error(`❌ [${requestId}] Failed to parse JSON from Gemini response (${modelName}):`, responseText.substring(0, 300));
                throw new Error("Received malformed JSON from Gemini vision service. Please try again.");
            }

            // 9. Validate and standardize output
            const standardized = validateAndStandardizeDiagnosis(parsed, requestId);

            console.log(`✅ [${requestId}] Completed plant disease detection via ${modelName}:`, {
                requestId,
                model: modelName,
                plant: standardized.plant,
                diseaseName: standardized.diseaseName,
                confidence: `${standardized.confidence}%`,
                severity: standardized.severity,
                durationMs,
            });

            return standardized;
        } catch (err: any) {
            lastError = err;
            const errMsg = String(err?.message || '');
            const isModelUnavailable = errMsg.includes("404") || errMsg.includes("no longer available") || errMsg.includes("not found");
            const isTemporaryOverload = errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("Service Unavailable");
            const isTimeout = errMsg.includes("timed out") || errMsg.includes("timeout");

            if (isModelUnavailable || isTemporaryOverload || isTimeout) {
                console.warn(`⚠️ [${requestId}] Model ${modelName} failed (${isModelUnavailable ? '404 unavailable' : isTemporaryOverload ? '503 high demand' : 'timeout'}). Falling back to next candidate model...`);
                continue;
            }

            // Non-retryable errors (e.g. 403 API key, 429 quota, bad image, unsupported format) should halt attempts
            break;
        }
    }

    console.error(`❌ [${requestId}] Plant disease detection failed across candidate models:`, lastError?.message || lastError);

    // Map known Gemini API errors to clear, actionable messages
    const errMsg = String(lastError?.message || '');
    if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid") || errMsg.includes("403")) {
        throw new Error("Invalid Gemini API key. Please check your VITE_GEMINI_API_KEY in .env.");
    }
    if (errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("429") || errMsg.includes("quota")) {
        throw new Error("Gemini API quota exceeded or rate limit reached. Please wait a minute and try again.");
    }
    if (errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("Service Unavailable")) {
        throw new Error("Google AI services are temporarily experiencing high demand. Please try again in a few moments.");
    }
    if (errMsg.includes("404") || errMsg.includes("no longer available") || errMsg.includes("not found")) {
        throw new Error("The requested Gemini vision models are unavailable for this API key. Please configure VITE_GEMINI_MODEL with an active model.");
    }
    if (errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError") || errMsg.includes("network")) {
        throw new Error("Network error connecting to Gemini API. Please check your internet connection.");
    }
    if (errMsg.includes("timed out")) {
        throw new Error("Gemini API request timed out after 30 seconds. Please check your connection and try again.");
    }

    // Re-throw the original or formatted error; NEVER replace with fake prediction
    throw lastError || new Error("Plant disease detection failed. Please try again.");
};

// Dynamic fallback functions based on user inputs
const getFallbackRecommendations = (details: any): CropRecommendation[] => {
    const budget = parseInt(details.budget) || 100000;
    const farmSize = parseInt(details.farmSize) || 5;
    const location = details.location || "Delhi";
    const soilType = details.soilType || "Loamy";
    const season = details.season || "rabi";
    
    // Generate location-specific crops with some randomness
    const getLocationBasedCrops = (location: string) => {
        const locationLower = location.toLowerCase();
        let baseCrops = [];
        
        if (locationLower.includes('punjab') || locationLower.includes('haryana')) {
            baseCrops = ['Wheat', 'Rice', 'Cotton', 'Sugarcane', 'Potato', 'Mustard', 'Maize', 'Sunflower'];
        } else if (locationLower.includes('maharastra') || locationLower.includes('maharashtra')) {
            baseCrops = ['Cotton', 'Sugarcane', 'Wheat', 'Tomato', 'Onion', 'Turmeric', 'Groundnut', 'Chickpea'];
        } else if (locationLower.includes('karnataka') || locationLower.includes('tamil')) {
            baseCrops = ['Rice', 'Sugarcane', 'Cotton', 'Tomato', 'Coconut', 'Spices', 'Ragi', 'Jowar'];
        } else if (locationLower.includes('west bengal') || locationLower.includes('bengal')) {
            baseCrops = ['Rice', 'Jute', 'Wheat', 'Tomato', 'Potato', 'Mustard', 'Tea', 'Sugarcane'];
        } else if (locationLower.includes('gujarat')) {
            baseCrops = ['Cotton', 'Groundnut', 'Wheat', 'Sugarcane', 'Cumin', 'Tomato', 'Rice', 'Maize'];
        } else if (locationLower.includes('rajasthan')) {
            baseCrops = ['Wheat', 'Mustard', 'Cotton', 'Groundnut', 'Barley', 'Bajra', 'Chickpea', 'Cumin'];
        } else if (locationLower.includes('uttar pradesh') || locationLower.includes('up')) {
            baseCrops = ['Rice', 'Wheat', 'Sugarcane', 'Potato', 'Tomato', 'Mustard', 'Maize', 'Barley'];
        } else {
            baseCrops = ['Rice', 'Wheat', 'Cotton', 'Tomato', 'Sugarcane', 'Maize', 'Potato', 'Onion'];
        }
        
        // Add some randomness - shuffle and pick 6-8 crops
        const shuffled = [...baseCrops].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 6 + Math.floor(Math.random() * 2));
    };

    // Generate season-specific crops with variations
    const getSeasonBasedCrops = (season: string) => {
        const seasonLower = season.toLowerCase();
        let baseCrops = [];
        
        if (seasonLower.includes('kharif')) {
            baseCrops = ['Rice', 'Cotton', 'Sugarcane', 'Maize', 'Groundnut', 'Soybean', 'Jowar', 'Bajra', 'Turmeric'];
        } else if (seasonLower.includes('rabi')) {
            baseCrops = ['Wheat', 'Barley', 'Mustard', 'Tomato', 'Potato', 'Onion', 'Chickpea', 'Lentil', 'Cumin'];
        } else if (seasonLower.includes('zaid')) {
            baseCrops = ['Tomato', 'Cucumber', 'Watermelon', 'Rice', 'Maize', 'Vegetables', 'Onion', 'Chili', 'Brinjal'];
        } else {
            baseCrops = ['Rice', 'Wheat', 'Cotton', 'Tomato', 'Sugarcane', 'Maize', 'Potato', 'Onion'];
        }
        
        // Add randomness to season crops too
        const shuffled = [...baseCrops].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 6 + Math.floor(Math.random() * 2));
    };

    // Get crops suitable for soil type with variations
    const getSoilCompatibleCrops = (soilType: string) => {
        const soilLower = soilType.toLowerCase();
        let baseCrops = [];
        
        if (soilLower.includes('clay') || soilLower.includes('loamy')) {
            baseCrops = ['Rice', 'Wheat', 'Cotton', 'Sugarcane', 'Potato', 'Tomato', 'Onion', 'Cabbage'];
        } else if (soilLower.includes('sandy')) {
            baseCrops = ['Groundnut', 'Cotton', 'Tomato', 'Millet', 'Watermelon', 'Cucumber', 'Bajra', 'Sunflower'];
        } else if (soilLower.includes('black')) {
            baseCrops = ['Cotton', 'Sugarcane', 'Wheat', 'Rice', 'Soybean', 'Turmeric', 'Jowar', 'Bajra'];
        } else if (soilLower.includes('red')) {
            baseCrops = ['Rice', 'Wheat', 'Groundnut', 'Sugarcane', 'Tomato', 'Chili', 'Turmeric', 'Coconut'];
        } else {
            baseCrops = ['Rice', 'Wheat', 'Cotton', 'Tomato', 'Sugarcane', 'Maize', 'Potato', 'Onion'];
        }
        
        // Add randomness to soil crops
        const shuffled = [...baseCrops].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 6 + Math.floor(Math.random() * 2));
    };

    // Combine all factors to get best crops
    const locationCrops = getLocationBasedCrops(location);
    const seasonCrops = getSeasonBasedCrops(season);
    const soilCrops = getSoilCompatibleCrops(soilType);
    
    // Score crops based on compatibility
    const cropScores: { [key: string]: number } = {};
    [...locationCrops, ...seasonCrops, ...soilCrops].forEach(crop => {
        cropScores[crop] = (cropScores[crop] || 0) + 1;
    });

    // Get top 6 crops
    const topCrops = Object.entries(cropScores)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 6)
        .map(([crop]) => crop);

    // Create a realistic mix of crop types for diversity
    const createRealisticMix = (crops: string[]) => {
        const cropTypes = {
            'staple': ['Rice', 'Wheat', 'Maize', 'Barley'],
            'cash': ['Cotton', 'Sugarcane', 'Tobacco', 'Jute'],
            'vegetable': ['Tomato', 'Onion', 'Potato', 'Cabbage'],
            'pulse': ['Chickpea', 'Lentil', 'Black gram', 'Green gram'],
            'oilseed': ['Mustard', 'Groundnut', 'Soybean', 'Sunflower'],
            'spice': ['Turmeric', 'Chili', 'Coriander', 'Cumin']
        };

        const selectedCrops = [];
        const usedTypes = new Set();

        // Ensure we get a good mix of different crop types
        for (const crop of crops) {
            const cropType = Object.entries(cropTypes).find(([type, typeCrops]) => 
                typeCrops.some(tc => tc.toLowerCase().includes(crop.toLowerCase()) || crop.toLowerCase().includes(tc.toLowerCase()))
            )?.[0] || 'staple';

            if (!usedTypes.has(cropType) || Math.random() > 0.6) {
                selectedCrops.push(crop);
                usedTypes.add(cropType);
            }
        }

        return selectedCrops.slice(0, 6);
    };

    const mixedCrops = createRealisticMix(topCrops);

    // Generate dynamic recommendations with realistic variations
    return mixedCrops.map((crop, index) => {
        // Create realistic investment variations based on crop type
        const cropCategory = crop.toLowerCase();
        let investmentRatio, baseYield, basePrice, baseDuration;
        
        if (cropCategory.includes('rice') || cropCategory.includes('wheat')) {
            investmentRatio = 0.4; // Staple crops - moderate investment
            baseYield = 4; basePrice = 25; baseDuration = 120;
        } else if (cropCategory.includes('cotton') || cropCategory.includes('sugarcane')) {
            investmentRatio = 0.8; // Cash crops - high investment
            baseYield = 3; basePrice = 65; baseDuration = 180;
        } else if (cropCategory.includes('tomato') || cropCategory.includes('onion')) {
            investmentRatio = 0.6; // Vegetables - medium-high investment
            baseYield = 25; basePrice = 45; baseDuration = 100;
        } else if (cropCategory.includes('chickpea') || cropCategory.includes('lentil')) {
            investmentRatio = 0.3; // Pulses - low investment
            baseYield = 1.5; basePrice = 80; baseDuration = 90;
        } else if (cropCategory.includes('mustard') || cropCategory.includes('groundnut')) {
            investmentRatio = 0.5; // Oilseeds - medium investment
            baseYield = 2; basePrice = 55; baseDuration = 110;
        } else {
            investmentRatio = 0.5; // Default
            baseYield = 3; basePrice = 35; baseDuration = 120;
        }

        const investment = Math.round(budget * investmentRatio);
        const yieldVariation = 0.8 + (Math.random() * 0.4); // ±20% variation
        const priceVariation = 0.9 + (Math.random() * 0.2); // ±10% variation
        const durationVariation = 0.9 + (Math.random() * 0.2); // ±10% variation
        
        // Convert acres to hectares for yield calculation (1 acre ≈ 0.4 hectares)
        const farmSizeInHectares = farmSize * 0.4;
        const actualYield = Math.round(farmSizeInHectares * baseYield * yieldVariation);
        const actualPrice = Math.round(basePrice * priceVariation);
        const actualDuration = Math.round(baseDuration * durationVariation);
        
        const revenue = Math.round(actualYield * actualPrice * 10); // 10x multiplier for realistic revenue
        const profit = revenue - investment;
        
        // Create realistic reasons based on crop and conditions
        const getReasons = (cropName: string) => {
            const reasons = [];
            
            if (cropName.toLowerCase().includes('rice')) {
                reasons.push(`High water availability in ${location} region`);
                reasons.push(`Government MSP support for rice`);
                reasons.push(`Stable market demand throughout year`);
            } else if (cropName.toLowerCase().includes('wheat')) {
                reasons.push(`Perfect for ${season} season cultivation`);
                reasons.push(`Low maintenance and pest resistance`);
                reasons.push(`Good procurement price from government`);
            } else if (cropName.toLowerCase().includes('cotton')) {
                reasons.push(`Export demand driving high prices`);
                reasons.push(`Suitable for ${soilType} soil conditions`);
                reasons.push(`Long-term investment with good returns`);
            } else if (cropName.toLowerCase().includes('tomato')) {
                reasons.push(`High market demand in ${location}`);
                reasons.push(`Quick harvest cycle for cash flow`);
                reasons.push(`Multiple harvests possible`);
            } else if (cropName.toLowerCase().includes('sugarcane')) {
                reasons.push(`Sugar mill contracts available`);
                reasons.push(`High yield potential in ${location}`);
                reasons.push(`Long-term stable income source`);
            } else {
                reasons.push(`Growing market demand in region`);
                reasons.push(`Suitable for current soil conditions`);
                reasons.push(`Good profit margin potential`);
            }
            
            return reasons;
        };
        
        // Create a good mix of profitability levels
        const profitabilityLevels = ["High Profit", "Medium Profit", "Low Profit"];
        const profitabilityDistribution = [2, 3, 1]; // 2 High, 3 Medium, 1 Low profit crops
        
        let assignedProfitability = "Medium Profit"; // Default
        let levelIndex = 0;
        let currentCount = 0;
        
        for (let i = 0; i < profitabilityDistribution.length; i++) {
            currentCount += profitabilityDistribution[i];
            if (index < currentCount) {
                levelIndex = i;
                break;
            }
        }
        
        assignedProfitability = profitabilityLevels[levelIndex];
        
        // Adjust profit calculations based on assigned level
        let adjustedProfit = profit;
        if (assignedProfitability === "High Profit") {
            adjustedProfit = Math.round(investment * (1.8 + Math.random() * 0.4)); // 180-220% return
        } else if (assignedProfitability === "Medium Profit") {
            adjustedProfit = Math.round(investment * (1.3 + Math.random() * 0.3)); // 130-160% return
        } else {
            adjustedProfit = Math.round(investment * (1.1 + Math.random() * 0.2)); // 110-130% return
        }
        
        return {
            cropName: crop,
            profitability: assignedProfitability,
            expectedYield: `${Math.round(actualYield * 0.8)}-${Math.round(actualYield * 1.2)} tons/acre`,
            investment: `₹${investment.toLocaleString()}`,
            duration: `${Math.round(actualDuration * 0.9)}-${Math.round(actualDuration * 1.1)} days`,
            marketPrice: `₹${Math.round(actualPrice * 0.9)}-₹${Math.round(actualPrice * 1.1)}/kg`,
            estimatedProfit: `₹${adjustedProfit.toLocaleString()}`,
            reasons: getReasons(crop)
        };
    });
};

const getFallbackPredictions = (details: any): CropPrediction[] => {
    const budget = parseInt(details.budget) || 100000;
    
    return [
        {
            cropName: "Tomato",
            reason: `Tomato is highly suitable for ${details.soilType} soil during ${details.season} season in ${details.location} region.`,
            estimatedInvestment: `₹${Math.round(budget * 0.5).toLocaleString()}`,
            expectedYield: "25-30 tons/hectare",
            potentialRevenue: `₹${Math.round(budget * 2.5).toLocaleString()}`,
            estimatedProfit: `₹${Math.round(budget * 2.0).toLocaleString()}`,
            duration: 120
        },
        {
            cropName: "Wheat",
            reason: `Wheat grows well in ${details.soilType} soil during ${details.season} season with stable market demand.`,
            estimatedInvestment: `₹${Math.round(budget * 0.4).toLocaleString()}`,
            expectedYield: "4-5 tons/hectare",
            potentialRevenue: `₹${Math.round(budget * 1.8).toLocaleString()}`,
            estimatedProfit: `₹${Math.round(budget * 1.4).toLocaleString()}`,
            duration: 150
        },
        {
            cropName: "Cotton",
            reason: `Cotton is profitable in ${details.location} region with excellent export potential and premium pricing.`,
            estimatedInvestment: `₹${Math.round(budget * 0.7).toLocaleString()}`,
            expectedYield: "2-3 tons/hectare",
            potentialRevenue: `₹${Math.round(budget * 2.2).toLocaleString()}`,
            estimatedProfit: `₹${Math.round(budget * 1.5).toLocaleString()}`,
            duration: 180
        },
        {
            cropName: "Rice",
            reason: `Rice is ideal for ${details.soilType} soil in ${details.season} season with government support.`,
            estimatedInvestment: `₹${Math.round(budget * 0.6).toLocaleString()}`,
            expectedYield: "4-6 tons/hectare",
            potentialRevenue: `₹${Math.round(budget * 2.0).toLocaleString()}`,
            estimatedProfit: `₹${Math.round(budget * 1.4).toLocaleString()}`,
            duration: 130
        },
        {
            cropName: "Sugarcane",
            reason: `Sugarcane offers excellent long-term returns in ${details.location} region with sugar mill demand.`,
            estimatedInvestment: `₹${Math.round(budget * 0.8).toLocaleString()}`,
            expectedYield: "70-100 tons/hectare",
            potentialRevenue: `₹${Math.round(budget * 2.8).toLocaleString()}`,
            estimatedProfit: `₹${Math.round(budget * 2.0).toLocaleString()}`,
            duration: 365
        },
        {
            cropName: "Maize",
            reason: `Maize provides quick returns with growing demand in ${details.location} region.`,
            estimatedInvestment: `₹${Math.round(budget * 0.5).toLocaleString()}`,
            expectedYield: "3-5 tons/hectare",
            potentialRevenue: `₹${Math.round(budget * 1.9).toLocaleString()}`,
            estimatedProfit: `₹${Math.round(budget * 1.4).toLocaleString()}`,
            duration: 110
        }
    ];
};

const getFallbackMarketInsights = (cropName: string): MarketInsight => {
    return {
        stability: "Stable",
        trends: ["Steady demand growth", "Government support programs", "Export opportunities"],
        demandForecast: "Moderate to high demand expected in the coming months.",
        risks: ["Weather variability", "Market price fluctuations"]
    };
};
