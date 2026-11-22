import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectPlantDisease,
  extractBase64AndMime,
  normalizeMimeType,
  validateImageInput,
  validateAndStandardizeDiagnosis,
} from '../services/geminiService';

describe('FieldWise — Plant Leaf Disease Detection via Backend Diagnostic API', () => {
  // Sample valid Base64 representations
  const mockBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const mockDataUrlJpeg = `data:image/jpeg;base64,${mockBase64Image}`;
  const mockDataUrlPng = `data:image/png;base64,${mockBase64Image}`;
  const mockDataUrlWebp = `data:image/webp;base64,${mockBase64Image}`;

  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default valid auth token in storage
    localStorage.setItem('fieldwise_auth_token', 'mock_jwt_token_farmer_123');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ── TEST 1: Requires authentication ─────────────────────────────────────────
  it('TEST 1: Throws error when unauthenticated (no token in localStorage)', async () => {
    localStorage.clear();
    await expect(
      detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'healthy_leaf.jpg')
    ).rejects.toThrow(/Authentication required: Please log in to perform plant disease diagnosis/i);
  });

  // ── TEST 2: Upload a healthy tomato leaf ─────────────────────────────────────
  it('TEST 2: Upload a healthy tomato leaf returns Healthy status without fabricated disease', async () => {
    const geminiHealthyResponse = {
      plant: 'Tomato (Solanum lycopersicum)',
      diseaseName: 'Healthy',
      description: 'The leaf displays uniform dark green chlorophyll pigmentation, smooth intact cuticle, and zero visible chlorotic or necrotic spots.',
      confidence: 96,
      confidenceScore: 96,
      severity: 'low',
      severityLevel: 'low',
      action: 'Leaf is in optimal health. Continue standard irrigation and balanced fertilization.',
      actionRequired: 'Leaf is in optimal health. Continue standard irrigation and balanced fertilization.',
      symptoms: ['Intact cuticle without chlorosis', 'Healthy green pigmentation'],
      treatment: ['No corrective fungicide application needed.'],
      prevention: ['Maintain regular scouting', 'Ensure proper soil drainage'],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        diagnosis: geminiHealthyResponse,
      }),
    } as any);

    const result = await detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'healthy_tomato_specimen.jpg');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = (global.fetch as any).mock.calls[0];
    expect(fetchUrl).toContain('/api/disease/diagnose');
    expect(fetchOptions.headers['Authorization']).toBe('Bearer mock_jwt_token_farmer_123');

    const parsedBody = JSON.parse(fetchOptions.body);
    expect(parsedBody.mimeType).toBe('image/jpeg');
    expect(parsedBody.fileName).toBe('healthy_tomato_specimen.jpg');
    expect(parsedBody.image).toBe(mockDataUrlJpeg);

    // Verify diagnostic output
    expect(result.plant).toContain('Tomato');
    expect(result.diseaseName).toBe('Healthy');
    expect(result.confidence).toBe(96);
    expect(result.severity).toBe('low');
    expect(result.treatment[0]).toContain('No corrective');
  });

  // ── TEST 3: Upload a tomato early blight image ───────────────────────────────
  it('TEST 3: Upload a tomato early blight image returns early blight when visual evidence supports it', async () => {
    const geminiEarlyBlightResponse = {
      plant: 'Tomato (Solanum lycopersicum)',
      diseaseName: 'Tomato Early Blight (Alternaria solani)',
      description: 'Distinct concentric circular necrotic lesions with yellow chlorotic halos visible on foliar surface.',
      confidence: 92,
      severity: 'medium',
      action: 'Prune infected lower foliage and apply protective copper or Mancozeb fungicide spray.',
      symptoms: ['Target-like concentric brown rings', 'Chlorotic halo around lesions'],
      treatment: ['Spray Mancozeb 75% WP @ 2.5g/L', 'Copper Oxychloride 50 WP @ 3g/L'],
      prevention: ['Crop rotation with non-solanaceous crops'],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        diagnosis: geminiEarlyBlightResponse,
      }),
    } as any);

    const result = await detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'sample_leaf_002.jpg');

    expect(result.plant).toContain('Tomato');
    expect(result.diseaseName).toBe('Tomato Early Blight (Alternaria solani)');
    expect(result.confidence).toBe(92);
    expect(result.severity).toBe('medium');
    expect(result.symptoms).toContain('Target-like concentric brown rings');
  });

  // ── TEST 4: Upload a potato late blight image ────────────────────────────────
  it('TEST 4: Upload a potato late blight image returns potato late blight', async () => {
    const geminiLateBlightResponse = {
      plant: 'Potato (Solanum tuberosum)',
      diseaseName: 'Potato Late Blight (Phytophthora infestans)',
      description: 'Rapidly expanding water-soaked dark brown to purplish lesions on leaf tips and margins.',
      confidence: 94,
      severity: 'high',
      action: 'Immediate systemic fungicide intervention needed to prevent rapid crop devastation.',
      symptoms: ['Water-soaked dark lesions on leaf tips', 'Pale chlorotic margins'],
      treatment: ['Apply Metalaxyl-M (Ridomil MZ @ 2.5g/L)'],
      prevention: ['Plant certified disease-free seed tubers'],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        diagnosis: geminiLateBlightResponse,
      }),
    } as any);

    const result = await detectPlantDisease(mockDataUrlPng, 'image/png', 'potato_sample.png');

    expect(result.plant).toContain('Potato');
    expect(result.diseaseName).toContain('Late Blight');
    expect(result.severity).toBe('high');
    expect(result.confidenceScore).toBe(94);
  });

  // ── TEST 5: Upload a car image ───────────────────────────────────────────────
  it('TEST 5: Upload a non-plant image returns Invalid Image result', async () => {
    const geminiNonLeafResponse = {
      plant: 'Unknown',
      diseaseName: 'Invalid Image',
      description: 'The uploaded image contains an automobile and does not depict a plant leaf.',
      confidence: 0,
      severity: 'unknown',
      action: 'Please upload a clear photograph of a plant leaf or crop foliage.',
      symptoms: [],
      treatment: [],
      prevention: [],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        diagnosis: geminiNonLeafResponse,
      }),
    } as any);

    const result = await detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'car_photo.jpg');

    expect(result.diseaseName).toBe('Invalid Image');
    expect(result.plant).toBe('Unknown');
    expect(result.confidence).toBe(0);
    expect(result.severity).toBe('unknown');
    expect(result.description).toContain('automobile');
  });

  // ── TEST 6: Upload a blurry leaf image ───────────────────────────────────────
  it('TEST 6: Upload a blurry leaf image returns Uncertain status', async () => {
    const geminiBlurryResponse = {
      plant: 'Unknown',
      diseaseName: 'Uncertain',
      description: 'Severe motion blur and low focal resolution prevent reliable identification.',
      confidence: 25,
      severity: 'unknown',
      action: 'Retake a well-lit, in-focus close-up photograph of the affected leaf.',
      symptoms: [],
      treatment: [],
      prevention: [],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        diagnosis: geminiBlurryResponse,
      }),
    } as any);

    const result = await detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'blurry_shot.jpg');

    expect(result.diseaseName).toBe('Uncertain');
    expect(result.confidence).toBeLessThan(50);
    expect(result.description).toContain('blur');
  });

  // ── TEST 7: Handle 401 Session Expired ───────────────────────────────────────
  it('TEST 7: Handles 401 Unauthorized by reporting session expiration', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Unauthorized' } }),
    } as any);

    await expect(detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'test.jpg')).rejects.toThrow(
      /Authentication session expired or invalid/i
    );
  });

  // ── TEST 8: Handle 429 Rate Limiting ─────────────────────────────────────────
  it('TEST 8: Handles 429 Rate Limit error gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    } as any);

    await expect(detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'test.jpg')).rejects.toThrow(
      /Too many diagnostic requests/i
    );
  });

  // ── TEST 9: Handle 503 Service Unconfigured ──────────────────────────────────
  it('TEST 9: Handles 503 Service Unavailable (e.g. missing server GEMINI_API_KEY)', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'Gemini service unconfigured' } }),
    } as any);

    await expect(detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'test.jpg')).rejects.toThrow(
      /service is currently unconfigured or unavailable/i
    );
  });

  // ── TEST 10: Handle Network Error ────────────────────────────────────────────
  it('TEST 10: Handles network connection failure cleanly', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Failed to fetch'));

    await expect(detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'test.jpg')).rejects.toThrow(
      /Network error connecting to diagnostic server/i
    );
  });

  // ── Helper & Validation Unit Tests ───────────────────────────────────────────
  describe('Input Validation & Normalization Helpers', () => {
    it('extractBase64AndMime correctly parses data URLs and normalizes MIME types', () => {
      const parsedJpeg = extractBase64AndMime('data:image/jpeg;base64,AAAA');
      expect(parsedJpeg.mimeType).toBe('image/jpeg');
      expect(parsedJpeg.base64Data).toBe('AAAA');

      const parsedJpg = extractBase64AndMime('data:image/jpg;base64,BBBB');
      expect(parsedJpg.mimeType).toBe('image/jpeg');
      expect(parsedJpg.base64Data).toBe('BBBB');

      const parsedWebp = extractBase64AndMime('data:image/webp;base64,CCCC');
      expect(parsedWebp.mimeType).toBe('image/webp');
      expect(parsedWebp.base64Data).toBe('CCCC');

      const parsedRaw = extractBase64AndMime('DDDD', 'image/png');
      expect(parsedRaw.mimeType).toBe('image/png');
      expect(parsedRaw.base64Data).toBe('DDDD');
    });

    it('validateImageInput rejects unsupported formats and empty data', () => {
      expect(() => validateImageInput('', 'image/jpeg')).toThrow(/empty/i);
      expect(() => validateImageInput('AAA', 'image/gif')).toThrow(/unsupported/i);
      expect(() => validateImageInput('A'.repeat(20), 'image/jpeg')).toThrow(/too small/i);
      // Valid input does not throw
      expect(() => validateImageInput('A'.repeat(200), 'image/jpeg')).not.toThrow();
    });

    it('validateAndStandardizeDiagnosis ensures all reciprocal aliases exist', () => {
      const standardized = validateAndStandardizeDiagnosis(
        {
          plant: 'Wheat',
          diseaseName: 'Wheat Rust',
          description: 'Rust pustules on leaves',
          confidence: '91%',
          severity: 'HIGH',
          action: 'Spray fungicide',
          symptoms: ['Pustules'],
          treatment: ['Propiconazole'],
          prevention: ['Resistant seed'],
        },
        'req_test_01'
      );

      expect(standardized.plant).toBe('Wheat');
      expect(standardized.plantName).toBe('Wheat');
      expect(standardized.cropName).toBe('Wheat');
      expect(standardized.diseaseName).toBe('Wheat Rust');
      expect(standardized.confidence).toBe(91);
      expect(standardized.confidenceScore).toBe(91);
      expect(standardized.severity).toBe('high');
      expect(standardized.severityLevel).toBe('high');
      expect(standardized.action).toBe('Spray fungicide');
      expect(standardized.actionRequired).toBe('Spray fungicide');
      expect(standardized.symptomsObserved).toEqual(['Pustules']);
      expect(standardized.preventionTips).toEqual(['Resistant seed']);
    });
  });
});
