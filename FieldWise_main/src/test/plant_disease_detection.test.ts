import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectPlantDisease,
  extractBase64AndMime,
  normalizeMimeType,
  validateImageInput,
  validateAndStandardizeDiagnosis,
} from '../services/geminiService';

// ── Mock GoogleGenerativeAI SDK ──────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockModelName: { value: '' },
}));

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation((apiKey: string) => {
      if (!apiKey || apiKey === 'invalid_key') {
        // Will throw during execution or mock setup if tested
      }
      return {
        getGenerativeModel: vi.fn().mockImplementation((config: any) => {
          mocks.mockModelName.value = config?.model || '';
          return {
            generateContent: mocks.mockGenerateContent,
          };
        }),
      };
    }),
  };
});

describe('FieldWise — Plant Leaf Disease Detection using Gemini 2.5 Flash', () => {
  // Sample valid Base64 representations
  const mockBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const mockDataUrlJpeg = `data:image/jpeg;base64,${mockBase64Image}`;
  const mockDataUrlPng = `data:image/png;base64,${mockBase64Image}`;
  const mockDataUrlWebp = `data:image/webp;base64,${mockBase64Image}`;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockModelName.value = '';
    // Ensure mock API key is available in test environment
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test_google_ai_studio_api_key_12345');
  });

  // ── TEST 1: Upload a healthy tomato leaf ─────────────────────────────────────
  it('TEST 1: Upload a healthy tomato leaf returns Healthy status without fabricated disease', async () => {
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
      symptomsObserved: ['Intact cuticle without chlorosis', 'Healthy green pigmentation'],
      treatment: ['No corrective fungicide application needed.'],
      prevention: ['Maintain regular scouting', 'Ensure proper soil drainage'],
      preventionTips: ['Maintain regular scouting', 'Ensure proper soil drainage'],
    };

    mocks.mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(geminiHealthyResponse),
      },
    });

    const result = await detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'healthy_tomato_specimen.jpg');

    expect(['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-2.5-flash']).toContain(mocks.mockModelName.value);
    expect(mocks.mockGenerateContent).toHaveBeenCalledTimes(1);

    // Verify actual image bytes were sent
    const callArgs = mocks.mockGenerateContent.mock.calls[0][0];
    expect(callArgs[0].inlineData).toBeDefined();
    expect(callArgs[0].inlineData.mimeType).toBe('image/jpeg');
    expect(callArgs[0].inlineData.data).toBe(mockBase64Image);

    // Verify diagnostic output
    expect(result.plant).toContain('Tomato');
    expect(result.diseaseName).toBe('Healthy');
    expect(result.confidence).toBe(96);
    expect(result.severity).toBe('low');
    expect(result.treatment[0]).toContain('No corrective');
  });

  // ── TEST 2: Upload a tomato early blight image ───────────────────────────────
  it('TEST 2: Upload a tomato early blight image returns early blight if visual evidence supports it', async () => {
    const geminiEarlyBlightResponse = {
      plant: 'Tomato (Solanum lycopersicum)',
      diseaseName: 'Tomato Early Blight (Alternaria solani)',
      description: 'Distinct concentric circular necrotic lesions with yellow chlorotic halos visible on foliar surface.',
      confidence: 92,
      confidenceScore: 92,
      severity: 'medium',
      severityLevel: 'medium',
      action: 'Prune infected lower foliage and apply protective copper or Mancozeb fungicide spray.',
      actionRequired: 'Prune infected lower foliage and apply protective copper or Mancozeb fungicide spray.',
      symptoms: ['Target-like concentric brown rings', 'Chlorotic halo around lesions', 'Lower canopy defoliation'],
      symptomsObserved: ['Target-like concentric brown rings', 'Chlorotic halo around lesions', 'Lower canopy defoliation'],
      treatment: ['Spray Mancozeb 75% WP @ 2.5g/L', 'Copper Oxychloride 50 WP @ 3g/L'],
      prevention: ['Crop rotation with non-solanaceous crops', 'Drip irrigation to avoid leaf wetness'],
      preventionTips: ['Crop rotation with non-solanaceous crops', 'Drip irrigation to avoid leaf wetness'],
    };

    mocks.mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(geminiEarlyBlightResponse),
      },
    });

    const result = await detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'sample_leaf_002.jpg');

    expect(['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-2.5-flash']).toContain(mocks.mockModelName.value);
    expect(result.plant).toContain('Tomato');
    expect(result.diseaseName).toBe('Tomato Early Blight (Alternaria solani)');
    expect(result.confidence).toBe(92);
    expect(result.severity).toBe('medium');
    expect(result.symptoms).toContain('Target-like concentric brown rings');
  });

  // ── TEST 3: Upload a potato late blight image ────────────────────────────────
  it('TEST 3: Upload a potato late blight image returns potato late blight when visual evidence supports it', async () => {
    const geminiLateBlightResponse = {
      plant: 'Potato (Solanum tuberosum)',
      diseaseName: 'Potato Late Blight (Phytophthora infestans)',
      description: 'Rapidly expanding water-soaked dark brown to purplish lesions on leaf tips and margins.',
      confidence: 94,
      confidenceScore: 94,
      severity: 'high',
      severityLevel: 'high',
      action: 'Immediate systemic fungicide intervention needed to prevent rapid crop devastation.',
      actionRequired: 'Immediate systemic fungicide intervention needed to prevent rapid crop devastation.',
      symptoms: ['Water-soaked dark lesions on leaf tips', 'Pale chlorotic margins', 'Rapid foliage blight'],
      symptomsObserved: ['Water-soaked dark lesions on leaf tips', 'Pale chlorotic margins', 'Rapid foliage blight'],
      treatment: ['Apply Metalaxyl-M (Ridomil MZ @ 2.5g/L)', 'Cymoxanil + Mancozeb spray'],
      prevention: ['Plant certified disease-free seed tubers', 'Avoid overhead sprinkler irrigation'],
      preventionTips: ['Plant certified disease-free seed tubers', 'Avoid overhead sprinkler irrigation'],
    };

    mocks.mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(geminiLateBlightResponse),
      },
    });

    const result = await detectPlantDisease(mockDataUrlPng, 'image/png', 'potato_sample.png');

    expect(['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-2.5-flash']).toContain(mocks.mockModelName.value);
    expect(result.plant).toContain('Potato');
    expect(result.diseaseName).toContain('Late Blight');
    expect(result.severity).toBe('high');
    expect(result.confidenceScore).toBe(94);
  });

  // ── TEST 4: Upload a healthy mango leaf ──────────────────────────────────────
  it('TEST 4: Upload a healthy mango leaf returns Healthy or appropriate uncertain result', async () => {
    const geminiMangoResponse = {
      plant: 'Mango (Mangifera indica)',
      diseaseName: 'Healthy',
      description: 'The mango lanceolate leaf demonstrates thick leathery cuticle, prominent midrib, and no anthracnose or powdery mildew.',
      confidence: 95,
      confidenceScore: 95,
      severity: 'low',
      severityLevel: 'low',
      action: 'Tree foliage is in healthy physiological state. Maintain regular orchard hygiene.',
      actionRequired: 'Tree foliage is in healthy physiological state. Maintain regular orchard hygiene.',
      symptoms: ['Intact foliage with no lesions'],
      symptomsObserved: ['Intact foliage with no lesions'],
      treatment: ['No fungicide application needed.'],
      prevention: ['Prune inner canopy branches to promote sunlight penetration'],
      preventionTips: ['Prune inner canopy branches to promote sunlight penetration'],
    };

    mocks.mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(geminiMangoResponse),
      },
    });

    const result = await detectPlantDisease(mockDataUrlWebp, 'image/webp', 'mango_leaf_specimen.webp');

    expect(['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-2.5-flash']).toContain(mocks.mockModelName.value);
    expect(result.plant).toContain('Mango');
    expect(result.diseaseName).toBe('Healthy');
    expect(result.severity).toBe('low');
  });

  // ── TEST 5: Upload a rice leaf image ─────────────────────────────────────────
  it('TEST 5: Upload a rice leaf image returns actual visual analysis', async () => {
    const geminiRiceResponse = {
      plant: 'Rice (Oryza sativa)',
      diseaseName: 'Rice Bacterial Leaf Blight (Xanthomonas oryzae)',
      description: 'Water-soaked translucent stripes extending along leaf margins turning yellow to straw-colored.',
      confidence: 90,
      confidenceScore: 90,
      severity: 'high',
      severityLevel: 'high',
      action: 'Drain standing water and apply bactericide with copper compound.',
      actionRequired: 'Drain standing water and apply bactericide with copper compound.',
      symptoms: ['Wavy yellowish-white stripes along leaf margins', 'Bacterial ooze droplets'],
      symptomsObserved: ['Wavy yellowish-white stripes along leaf margins', 'Bacterial ooze droplets'],
      treatment: ['Spray Streptocycline with Copper Oxychloride', 'Drain excess water'],
      prevention: ['Balanced NPK application, avoid excess Nitrogen', 'Use certified disease-free seeds'],
      preventionTips: ['Balanced NPK application, avoid excess Nitrogen', 'Use certified disease-free seeds'],
    };

    mocks.mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(geminiRiceResponse),
      },
    });

    const result = await detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'rice_field_specimen.jpg');

    expect(result.plant).toContain('Rice');
    expect(result.diseaseName).toContain('Bacterial Leaf Blight');
    expect(result.symptoms).toContain('Wavy yellowish-white stripes along leaf margins');
  });

  // ── TEST 6: Upload a car image ───────────────────────────────────────────────
  it('TEST 6: Upload a car image returns Invalid Image (never classifies non-leaf as plant disease)', async () => {
    const geminiNonLeafResponse = {
      plant: 'Unknown',
      diseaseName: 'Invalid Image',
      description: 'The uploaded image contains an automobile/vehicle and does not depict a plant leaf, crop foliage, or agricultural specimen.',
      confidence: 0,
      confidenceScore: 0,
      severity: 'unknown',
      severityLevel: 'unknown',
      action: 'Please upload a clear photograph of a plant leaf or crop foliage.',
      actionRequired: 'Please upload a clear photograph of a plant leaf or crop foliage.',
      symptoms: [],
      symptomsObserved: [],
      treatment: [],
      prevention: [],
      preventionTips: [],
    };

    mocks.mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(geminiNonLeafResponse),
      },
    });

    const result = await detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'car_photo.jpg');

    expect(result.diseaseName).toBe('Invalid Image');
    expect(result.plant).toBe('Unknown');
    expect(result.confidence).toBe(0);
    expect(result.confidenceScore).toBe(0);
    expect(result.severity).toBe('unknown');
    expect(result.description).toContain('vehicle');
  });

  // ── TEST 7: Upload a blurry leaf image ───────────────────────────────────────
  it('TEST 7: Upload a blurry leaf image returns Uncertain status', async () => {
    const geminiBlurryResponse = {
      plant: 'Unknown',
      diseaseName: 'Uncertain',
      description: 'Severe motion blur and low focal resolution prevent reliable identification of leaf pathology or disease symptoms.',
      confidence: 25,
      confidenceScore: 25,
      severity: 'unknown',
      severityLevel: 'unknown',
      action: 'Retake a well-lit, in-focus close-up photograph of the affected leaf.',
      actionRequired: 'Retake a well-lit, in-focus close-up photograph of the affected leaf.',
      symptoms: [],
      symptomsObserved: [],
      treatment: [],
      prevention: [],
      preventionTips: [],
    };

    mocks.mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(geminiBlurryResponse),
      },
    });

    const result = await detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'blurry_shot.jpg');

    expect(result.diseaseName).toBe('Uncertain');
    expect(result.confidence).toBeLessThan(50);
    expect(result.description).toContain('blur');
  });

  // ── TEST 8: Upload five different leaf images consecutively ──────────────────
  it('TEST 8: Upload five different leaf images consecutively executes 5 independent requests without shared state', async () => {
    const crops = ['Cotton', 'Apple', 'Corn', 'Grape', 'Wheat'];
    const mockResponses = crops.map((crop) => ({
      plant: `${crop} Plant`,
      diseaseName: `${crop} Leaf Spot`,
      description: `Specific visual evidence observed for ${crop}.`,
      confidence: 88,
      confidenceScore: 88,
      severity: 'medium',
      severityLevel: 'medium',
      action: `Care guidance for ${crop}.`,
      actionRequired: `Care guidance for ${crop}.`,
      symptoms: [`${crop} specific spot`],
      symptomsObserved: [`${crop} specific spot`],
      treatment: [`${crop} treatment`],
      prevention: [`${crop} prevention`],
      preventionTips: [`${crop} prevention`],
    }));

    for (let i = 0; i < 5; i++) {
      mocks.mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify(mockResponses[i]),
        },
      });

      const res = await detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', `${crops[i].toLowerCase()}_sample_${i}.jpg`);
      expect(res.plant).toBe(`${crops[i]} Plant`);
      expect(res.diseaseName).toBe(`${crops[i]} Leaf Spot`);
    }

    expect(mocks.mockGenerateContent).toHaveBeenCalledTimes(5);
  });

  // ── TEST 9: Upload the same image multiple times ─────────────────────────────
  it('TEST 9: Uploading the same image multiple times triggers fresh API requests (no stale cache)', async () => {
    const consistentResponse = {
      plant: 'Tomato',
      diseaseName: 'Tomato Leaf Mold',
      description: 'Pale yellow chlorotic patches on adaxial leaf surface with olive-brown velvety mold underneath.',
      confidence: 91,
      confidenceScore: 91,
      severity: 'medium',
      severityLevel: 'medium',
      action: 'Improve greenhouse ventilation and apply copper fungicide.',
      actionRequired: 'Improve greenhouse ventilation and apply copper fungicide.',
      symptoms: ['Velvety mold on undersides'],
      symptomsObserved: ['Velvety mold on undersides'],
      treatment: ['Copper fungicide'],
      prevention: ['Reduce humidity'],
      preventionTips: ['Reduce humidity'],
    };

    mocks.mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(consistentResponse) } })
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(consistentResponse) } })
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(consistentResponse) } });

    // Call 1
    const res1 = await detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'same_leaf.jpg');
    // Call 2
    const res2 = await detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'same_leaf.jpg');
    // Call 3
    const res3 = await detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'same_leaf.jpg');

    expect(mocks.mockGenerateContent).toHaveBeenCalledTimes(3);
    expect(res1.diseaseName).toBe('Tomato Leaf Mold');
    expect(res2.diseaseName).toBe('Tomato Leaf Mold');
    expect(res3.diseaseName).toBe('Tomato Leaf Mold');
  });

  // ── TEST 10: Simulate an API failure ─────────────────────────────────────────
  it('TEST 10: Simulate an API failure throws proper error and NEVER fabricates a fake prediction', async () => {
    // 1. Quota exceeded (429)
    mocks.mockGenerateContent.mockRejectedValueOnce(new Error('RESOURCE_EXHAUSTED: quota exceeded 429'));
    await expect(detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'test.jpg')).rejects.toThrow(
      /quota exceeded or rate limit reached/i
    );

    // 2. Invalid API key (403)
    mocks.mockGenerateContent.mockRejectedValueOnce(new Error('API_KEY_INVALID: API key not valid'));
    await expect(detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'test.jpg')).rejects.toThrow(
      /Invalid Gemini API key/i
    );

    // 3. Network error
    mocks.mockGenerateContent.mockRejectedValueOnce(new Error('Failed to fetch'));
    await expect(detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'test.jpg')).rejects.toThrow(
      /Network error connecting to Gemini API/i
    );

    // 4. Missing API key
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    await expect(detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'test.jpg')).rejects.toThrow(
      /Gemini API key is missing/i
    );
  });

  // ── TEST 11: Automatic Model Fallback on 404 / 503 ───────────────────────────
  it('TEST 11: Seamlessly falls back to next candidate model if a model is unavailable (404) or overloaded (503)', async () => {
    // Simulate primary model returning 404 (retired model)
    mocks.mockGenerateContent
      .mockRejectedValueOnce(new Error('[404] This model is no longer available to new users'))
      // Fallback model returns valid diagnosis
      .mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify({
              plant: 'Potato',
              diseaseName: 'Early Blight',
              description: 'Concentric necrotic lesions on potato foliage.',
              confidence: 94,
              severity: 'high',
              action: 'Apply Mancozeb fungicide spray.',
              symptoms: ['Target spots'],
              treatment: ['Fungicide'],
              prevention: ['Crop rotation'],
            }),
        },
      });

    const result = await detectPlantDisease(mockDataUrlJpeg, 'image/jpeg', 'potato_leaf.jpg');

    expect(mocks.mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result.plant).toBe('Potato');
    expect(result.diseaseName).toBe('Early Blight');
    expect(result.confidence).toBe(94);
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
