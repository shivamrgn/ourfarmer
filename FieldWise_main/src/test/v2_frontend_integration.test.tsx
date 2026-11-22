import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { api, predictApi, V2ApiError, V2NetworkError } from '../lib/api';
import PredictionFormV2, {
  buildV2PredictRequest,
  serializeOptionalNumeric,
  serializeOptionalString,
  serializeOptionalBoolean,
} from '../components/v2/PredictionFormV2';
import PredictionResultsV2 from '../components/v2/PredictionResultsV2';
import CropRecommendation from '../components/modules/CropRecommendation';
import type { V2PredictRequest, V2PredictResponse } from '../types/v2Prediction';
import { farmProfileService, CompleteFarmProfile } from '../services/farmProfileService';

// ── 1. Stabilize Authentication & Context Mocks ──────────────────────────────
const { MOCK_USER } = vi.hoisted(() => ({
  MOCK_USER: {
    id: 'test_farmer_1',
    username: 'farmer1',
    email: 'farmer@test.com',
    full_name: 'Test Farmer',
    location: 'Punjab',
    farm_size: '10 Acres',
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: MOCK_USER }),
}));

vi.mock('@/components/dashboard/WeatherContext', () => ({
  useWeather: () => ({
    weatherData: null,
    loading: false,
    error: null,
    refreshWeather: vi.fn(),
  }),
}));

// ── 2. Authoritative V2 Response Envelope Fixtures ───────────────────────────
const sampleSuccessResponse: V2PredictResponse = {
  success: true,
  version: '2.2.0-CLOSURE',
  status: 'SUCCESS',
  data: {
    status: 'SUCCESS',
    engine_version: '3.6.2.2',
    execution_timestamp: '2026-11-21T12:00:00Z',
    query_summary: {
      location: 'Punjab',
      season: 'Rabi',
      planting_system_evaluated: 'Sole_Crop',
      water_regime_evaluated: 'Irrigated',
      data_completeness_index: 85,
      evidence_confidence_tier: 'FARMER_DECLARED',
    },
    recommendations: [
      {
        crop_id: 'wheat',
        canonical_name: 'Wheat',
        suitability_score: 88.5,
        rank: 1,
        tier1_status: 'PASS',
        yield_range: [3.5, 5.0],
        water_assessment: {
          crop_water_demand_mm: 450,
          effective_water_available_mm: 300,
          water_balance_ratio: 0.67,
          irrigation_requirement_net_mm: 150,
          irrigation_access_considered: 'Canal',
        },
        fertilizer_prescription: {
          status: 'BASELINE_RDF_ARITHMETIC',
          evidence_level: 'USER_DECLARED',
          nitrogen_kg_ha: 120,
          phosphorus_kg_ha: 60,
          potassium_kg_ha: 40,
        },
        risk_warnings: ['Monitor soil moisture during flowering stage.'],
      },
    ],
    excluded_candidates: [
      {
        crop_id: 'rice',
        canonical_name: 'Rice',
        tier1_status: 'FAIL',
        failing_rules: [
          {
            rule: 'WATER_BALANCE_GATE',
            reason: 'Water requirement (1200 mm) exceeds available water (300 mm)',
          },
        ],
      },
    ],
  },
};

const sampleInsufficientDataResponse: V2PredictResponse = {
  success: true,
  version: '2.2.0-CLOSURE',
  status: 'INSUFFICIENT_DATA',
  data: {
    status: 'INSUFFICIENT_DATA',
    engine_version: '3.6.2.2',
    execution_timestamp: '2026-11-21T12:00:00Z',
    query_summary: {
      location: 'Punjab',
      season: 'Unknown',
      planting_system_evaluated: 'Sole_Crop',
      water_regime_evaluated: 'Unknown',
      data_completeness_index: 25,
      evidence_confidence_tier: 'INSUFFICIENT_DATA',
    },
    recommendations: [],
    excluded_candidates: [],
    diagnostics: {
      reason: 'Sowing month and regional climate context are required to assess seasonal viability.',
      missing_critical_parameters: ['sowing_month', 'temperature_celsius'],
      recommendation_suggestions: [
        'Select the planned sowing month.',
        'Provide temperature or location coordinates.',
      ],
    },
  },
};

const sampleNoRecommendationResponse: V2PredictResponse = {
  success: true,
  version: '2.2.0-CLOSURE',
  status: 'NO_RECOMMENDATION_SUITABLE',
  data: {
    status: 'NO_RECOMMENDATION_SUITABLE',
    engine_version: '3.6.2.2',
    execution_timestamp: '2026-11-21T12:00:00Z',
    query_summary: {
      location: 'Punjab',
      season: 'Rabi',
      planting_system_evaluated: 'Sole_Crop',
      water_regime_evaluated: 'Irrigated',
      data_completeness_index: 80,
      evidence_confidence_tier: 'FARMER_DECLARED',
    },
    recommendations: [],
    excluded_candidates: [],
    land_reclamation_advisory:
      'Severe soil acidity (pH 4.0) inhibits nutrient uptake across all regional crops. Apply agricultural lime (calcium carbonate) at 2.5 t/ha before next cultivation.',
  },
};

describe('Phase 3C.6.3: Frontend V2 Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. API Client (`predictApi.predictV2`)
  // ─────────────────────────────────────────────────────────────
  describe('predictApi.predictV2 API Client', () => {
    it('successfully calls POST /api/v2/predict and returns V2PredictResponse', async () => {
      const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
        status: 200,
        data: sampleSuccessResponse,
      } as any);

      const payload: V2PredictRequest = {
        state: 'Punjab',
        soil_texture: 'Loam',
        nitrogen: 100,
        phosphorus: 50,
        potassium: 40,
        soil_ph: 6.8,
        temperature: 22,
        humidity: 65,
        sowing_month: 11,
      };

      const result = await predictApi.predictV2(payload);
      expect(postSpy).toHaveBeenCalledWith(
        '/api/v2/predict',
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );
      expect(result.status).toBe('SUCCESS');
      expect(result.data.recommendations).toHaveLength(1);
    });

    it('throws V2ApiError with status 400 on HTTP 400 Bad Request without V1 fallback', async () => {
      vi.spyOn(api, 'post').mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            error: 'Validation failed',
            details: [{ field: 'soil_ph', message: 'pH must be between 2.0 and 12.0' }],
          },
        },
      });

      await expect(
        predictApi.predictV2({
          state: 'Punjab',
          soil_texture: 'Loam',
          nitrogen: 100,
          phosphorus: 50,
          potassium: 40,
          soil_ph: 1.5,
          temperature: 22,
          humidity: 65,
          sowing_month: 11,
        })
      ).rejects.toThrow(V2ApiError);
    });

    it('throws V2ApiError with status 422 on HTTP 422 Unprocessable Entity', async () => {
      vi.spyOn(api, 'post').mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 422,
          data: {
            error: 'Agronomically impossible combination',
            message: 'Temperature exceeds absolute physiological bounds',
          },
        },
      });

      await expect(
        predictApi.predictV2({
          state: 'Rajasthan',
          soil_texture: 'Sandy',
          nitrogen: 10,
          phosphorus: 10,
          potassium: 10,
          soil_ph: 7.0,
          temperature: 65,
          humidity: 10,
          sowing_month: 5,
        })
      ).rejects.toThrow(V2ApiError);
    });

    it('throws V2ApiError with status 502/503/504 on gateway/service errors without silent fallback', async () => {
      vi.spyOn(api, 'post').mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 502,
          data: { error: 'Recommendation engine subprocess exited with code 1' },
        },
      });

      try {
        await predictApi.predictV2({
          state: 'Punjab',
          soil_texture: 'Loam',
          nitrogen: 100,
          phosphorus: 50,
          potassium: 40,
          soil_ph: 6.8,
          temperature: 22,
          humidity: 65,
          sowing_month: 11,
        });
        expect.unreachable('Should have thrown V2ApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(V2ApiError);
        expect((err as V2ApiError).status).toBe(502);
      }
    });

    it('throws V2NetworkError on connection failure without silent fallback', async () => {
      vi.spyOn(api, 'post').mockRejectedValueOnce({
        isAxiosError: true,
        request: {},
        message: 'Network Error',
      });

      await expect(
        predictApi.predictV2({
          state: 'Punjab',
          soil_texture: 'Loam',
          nitrogen: 100,
          phosphorus: 50,
          potassium: 40,
          soil_ph: 6.8,
          temperature: 22,
          humidity: 65,
          sowing_month: 11,
        })
      ).rejects.toThrow(V2NetworkError);
    });

    it('preserves V1 predictApi.predict method and fallback behavior intact', async () => {
      // Mock axios post failure for V1 to test local Gaussian engine fallback
      vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Network error'));

      const v1Result = await predictApi.predict({
        rainfall: 800,
        temperature: 25,
        humidity: 60,
        soilType: 'Loamy',
        nitrogen: 100,
        phosphorus: 50,
        potassium: 40,
        ph: 6.5,
        state: 'Punjab',
      });

      expect(v1Result.data).toBeDefined();
      expect(v1Result.data.mode).toBe('offline_ml_engine');
      expect(v1Result.data.predictions.length).toBeGreaterThan(0);
    });

    it('provenance: predictV2 forwards backend JWT when croppredict_token is present', async () => {
      localStorage.setItem('croppredict_token', 'valid_backend_jwt_token_123');
      const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
        status: 200,
        data: sampleSuccessResponse,
      } as any);

      await predictApi.predictV2({
        state: 'Punjab',
        soil_texture: 'Loam',
        sowing_month: 11,
      });

      expect(postSpy).toHaveBeenCalledWith(
        '/api/v2/predict',
        expect.anything(),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid_backend_jwt_token_123',
          },
        }
      );
      localStorage.removeItem('croppredict_token');
    });

    it('provenance: guest mode does not forward unrelated provider tokens', async () => {
      localStorage.removeItem('croppredict_token');
      // Set unrelated provider token / session
      localStorage.setItem('fieldwise_active_user', JSON.stringify({ uid: 'firebase_xyz', email: 'test@demo.com' }));
      localStorage.setItem('smartfarm_token', 'arbitrary_smartfarm_token');

      const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
        status: 200,
        data: sampleSuccessResponse,
      } as any);

      await predictApi.predictV2({
        state: 'Punjab',
        soil_texture: 'Loam',
        sowing_month: 11,
      });

      expect(postSpy).toHaveBeenCalledWith(
        '/api/v2/predict',
        expect.anything(),
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      localStorage.removeItem('fieldwise_active_user');
      localStorage.removeItem('smartfarm_token');
    });

    it('handles HTTP 401 cleanly with V2ApiError', async () => {
      vi.spyOn(api, 'post').mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 401,
          data: {
            error: { code: 'UNAUTHORIZED', message: 'Token expired. Please log in again.' },
          },
        },
      });

      try {
        await predictApi.predictV2({ state: 'Punjab' });
        expect.unreachable('Should have thrown 401');
      } catch (err) {
        expect(err).toBeInstanceOf(V2ApiError);
        expect((err as V2ApiError).status).toBe(401);
        expect((err as V2ApiError).code).toBe('UNAUTHORIZED');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Form Payload Construction & Validation (`PredictionFormV2`)
  // ─────────────────────────────────────────────────────────────
  describe('PredictionFormV2 Component', () => {
    it('renders initial state with unselected sowing month and unknown irrigation', () => {
      render(<PredictionFormV2 onSubmit={vi.fn()} isLoading={false} />);

      // Sowing month select shows placeholder & unselected warning
      expect(screen.getByText(/Select sowing month\.\.\./i)).toBeInTheDocument();
      expect(screen.getByText(/Unselected by default/i)).toBeInTheDocument();

      // Submit button is disabled because sowing_month is null
      const submitBtn = screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i });
      expect(submitBtn).toBeDisabled();

      // Soil test checkbox should be unchecked
      const soilTestCheckbox = screen.getByRole('checkbox', {
        name: /Farmer-Declared Soil Health Card/i,
      });
      expect(soilTestCheckbox).not.toBeChecked();
    });

    it('validates numeric bounds for negative nitrogen and shows error', async () => {
      render(
        <PredictionFormV2
          onSubmit={vi.fn()}
          isLoading={false}
          initialValues={{ state: 'Punjab', sowing_month: 11, nitrogen: -10 }}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i });
      expect(submitBtn).not.toBeDisabled();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Nitrogen cannot be negative\./i)).toBeInTheDocument();
      });
    });

    it('validates whole-day integers for irrigation period days and rejects non-positive/zero', async () => {
      render(
        <PredictionFormV2
          onSubmit={vi.fn()}
          isLoading={false}
          initialValues={{ state: 'Punjab', sowing_month: 11, irrigation_period_days: 0 }}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Irrigation period must be an integer greater than 0\./i)).toBeInTheDocument();
      });
    });

    it('correctly constructs V2 payload with seasonal rainfall separate from annual rainfall', async () => {
      const mockSubmit = vi.fn();
      render(
        <PredictionFormV2
          onSubmit={mockSubmit}
          isLoading={false}
          initialValues={{
            state: 'Punjab',
            sowing_month: 11,
            irrigation_access: 'None_Rainfed',
            seasonal_rainfall_amount: 450,
            annual_rainfall: 950,
            has_soil_test: true,
          }}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i });
      expect(submitBtn).not.toBeDisabled();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedPayload: V2PredictRequest = mockSubmit.mock.calls[0][0];
      expect(submittedPayload.state).toBe('Punjab');
      expect(submittedPayload.sowing_month).toBe(11);
      expect(submittedPayload.has_soil_test).toBe(true);
      expect(submittedPayload.seasonal_rainfall_amount).toBe(450);
      expect(submittedPayload.annual_rainfall).toBe(950);
      expect(submittedPayload.irrigation_access).toBe('None_Rainfed');
    });

    it('omits seasonal rainfall when empty and leaves irrigation null when unknown', async () => {
      const mockSubmit = vi.fn();
      render(
        <PredictionFormV2
          onSubmit={mockSubmit}
          isLoading={false}
          initialValues={{
            state: 'Haryana',
            sowing_month: 6,
            irrigation_access: null,
            seasonal_rainfall_amount: null,
            has_soil_test: false,
          }}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedPayload: V2PredictRequest = mockSubmit.mock.calls[0][0];
      expect(submittedPayload.sowing_month).toBe(6);
      expect(submittedPayload.has_soil_test).toBe(false);
      expect(submittedPayload.seasonal_rainfall_amount).toBeNull();
      expect(submittedPayload.irrigation_access).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Results Presentation (`PredictionResultsV2`)
  // ─────────────────────────────────────────────────────────────
  describe('PredictionResultsV2 Component', () => {
    it('renders SUCCESS state with suitability score, explicit notice, yield range, and water/fertilizer guidance', () => {
      render(<PredictionResultsV2 response={sampleSuccessResponse} error={null} />);

      // Engine status banner
      expect(screen.getByText(/Agronomic Recommendations/i)).toBeInTheDocument();

      // Recommended crop and score
      expect(screen.getByText('Wheat')).toBeInTheDocument();
      expect(screen.getByText('88.5')).toBeInTheDocument();

      // Suitability notice (explicit: NOT statistical probability)
      expect(
        screen.getByText(/Suitability Score Meaning:/i)
      ).toBeInTheDocument();

      // Yield range as [min, max] t/ha (not a single point)
      expect(screen.getByText(/3\.5 – 5 t\/ha/i)).toBeInTheDocument();

      // Water assessment
      expect(screen.getByText(/Crop Water Balance Assessment/i)).toBeInTheDocument();
      expect(screen.getByText('450 mm')).toBeInTheDocument(); // Demand
      expect(screen.getByText('150 mm')).toBeInTheDocument(); // Deficit

      // Fertilizer prescription with farmer-declared warning
      expect(screen.getByText(/Nutrient Requirements & Fertilizer Guidance/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Status: BASELINE_RDF_ARITHMETIC \(Farmer-Declared\)/i)
      ).toBeInTheDocument();

      // Excluded candidates accordion
      expect(screen.getByText(/Why Other Crops Were Not Recommended/i)).toBeInTheDocument();
      fireEvent.click(screen.getByText(/Why Other Crops Were Not Recommended/i));
      expect(screen.getByText('Rice')).toBeInTheDocument();
      expect(screen.getByText(/Water requirement \(1200 mm\) exceeds available water/i)).toBeInTheDocument();
    });

    it('renders INSUFFICIENT_DATA state with missing parameters, suggestions, and zero crops', () => {
      render(<PredictionResultsV2 response={sampleInsufficientDataResponse} error={null} />);

      expect(screen.getByText(/Insufficient Data for Reliable Agronomic Evaluation/i)).toBeInTheDocument();
      expect(screen.getByText(/Diagnostic Reason/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Sowing month and regional climate context are required to assess seasonal viability\./i)
      ).toBeInTheDocument();

      // Verify zero recommended crops
      expect(screen.queryByText(/Reference Expected Yield Range/i)).not.toBeInTheDocument();
    });

    it('renders NO_RECOMMENDATION_SUITABLE state with land reclamation advisory and zero invented crops', () => {
      render(<PredictionResultsV2 response={sampleNoRecommendationResponse} error={null} />);

      expect(
        screen.getByText(/No Crops Met Agronomic Viability Threshold Under Current Conditions/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Authoritative Land Reclamation & Management Advisory/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Severe soil acidity \(pH 4\.0\) inhibits nutrient uptake across all regional crops/i)
      ).toBeInTheDocument();

      // Zero recommended crops
      expect(screen.queryByText(/Reference Expected Yield Range/i)).not.toBeInTheDocument();
    });

    it('renders error banner with retry button on error', () => {
      const mockRetry = vi.fn();
      const testError = new V2ApiError('Process timeout after 10000ms', 504, 'TIMEOUT', {
        message: 'The recommendation engine exceeded its maximum execution time window (10,000 ms) and was terminated.',
      });

      render(<PredictionResultsV2 response={null} error={testError} onRetry={mockRetry} />);

      expect(screen.getByText(/Execution Timeout \(HTTP 504\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Process timeout after 10000ms/i)).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /Retry Analysis/i });
      fireEvent.click(retryBtn);
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Switcher & V1 Compatibility (`CropRecommendation`)
  // ─────────────────────────────────────────────────────────────
  describe('CropRecommendation Module Integration', () => {
    it('renders Engine V2 by default with Engine Switcher buttons', () => {
      render(
        <MemoryRouter>
          <CropRecommendation user={MOCK_USER} onNavigate={vi.fn()} />
        </MemoryRouter>
      );

      // Switcher buttons
      const v2Btn = screen.getByRole('button', { name: /Engine V2 \(Recommended\)/i });
      const v1Btn = screen.getByRole('button', { name: /Engine V1 \(Legacy\)/i });
      expect(v2Btn).toBeInTheDocument();
      expect(v1Btn).toBeInTheDocument();

      // V2 Form is active
      expect(screen.getByLabelText(/Planned Sowing Month/i)).toBeInTheDocument();
      expect(screen.getByText(/Farmer-Declared Soil Health Card/i)).toBeInTheDocument();
    });

    it('switches to Engine V1 on toggle and preserves V1 form and farm profile', () => {
      render(
        <MemoryRouter>
          <CropRecommendation user={MOCK_USER} onNavigate={vi.fn()} />
        </MemoryRouter>
      );

      const v1Btn = screen.getByRole('button', { name: /Engine V1 \(Legacy\)/i });
      fireEvent.click(v1Btn);

      // V1 sections should now be visible
      expect(screen.getByRole('heading', { name: /Your Farm/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Available Farm Conditions/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Soil Characteristics & NPK Nutrients/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Environmental & Climate Conditions/i })).toBeInTheDocument();

      // Switch back to V2
      const v2Btn = screen.getByRole('button', { name: /Engine V2 \(Recommended\)/i });
      fireEvent.click(v2Btn);
      expect(screen.getByLabelText(/Planned Sowing Month/i)).toBeInTheDocument();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Phase 3C.6.3.1: V2 Input Defaults & Provenance Closure
  // ─────────────────────────────────────────────────────────────
  describe('Phase 3C.6.3.1: V2 Input Defaults & Provenance Closure', () => {
    it('1. fresh form has no fabricated state, climate, soil, or nutrient values', () => {
      render(<PredictionFormV2 onSubmit={vi.fn()} isLoading={false} />);

      // State is unselected (placeholder displayed)
      expect(screen.getByText(/Select Indian State/i)).toBeInTheDocument();

      // Sowing month is unselected
      expect(screen.getByText(/Select sowing month\.\.\./i)).toBeInTheDocument();

      // Climate fields are empty (no fabricated 25°C or 65%)
      const tempInput = screen.getByLabelText(/Mean Temperature/i) as HTMLInputElement;
      expect(tempInput.value).toBe('');

      const humidityInput = screen.getByLabelText(/Relative Humidity/i) as HTMLInputElement;
      expect(humidityInput.value).toBe('');

      // Soil texture is unselected (no fabricated Loam)
      expect(screen.getByText(/Select Texture/i)).toBeInTheDocument();

      // Soil pH is empty (no fabricated 6.8)
      const phInput = screen.getByLabelText(/Soil pH Level/i) as HTMLInputElement;
      expect(phInput.value).toBe('');

      // NPK are empty (no fabricated 80, 40, 40)
      const nInput = screen.getByLabelText(/Available Nitrogen \(N\)/i) as HTMLInputElement;
      expect(nInput.value).toBe('');

      const pInput = screen.getByLabelText(/Available Phosphorus \(P\)/i) as HTMLInputElement;
      expect(pInput.value).toBe('');

      const kInput = screen.getByLabelText(/Available Potassium \(K\)/i) as HTMLInputElement;
      expect(kInput.value).toBe('');

      // Organic carbon is empty (no fabricated 0.65)
      const ocInput = screen.getByLabelText(/Organic Carbon \(OC %\)/i) as HTMLInputElement;
      expect(ocInput.value).toBe('');

      // Nutrient basis is unselected (no fabricated SHC_Available_kg_ha)
      expect(screen.getByText('Reporting Basis')).toBeInTheDocument();

      // Soil test checkbox is unchecked
      const soilTestCheckbox = screen.getByRole('checkbox', {
        name: /Farmer-Declared Soil Health Card/i,
      });
      expect(soilTestCheckbox).not.toBeChecked();
    });

    it('2. submission is disabled until state and sowing month are explicitly supplied', () => {
      // Case A: neither supplied
      const { unmount: unmountA } = render(
        <PredictionFormV2 onSubmit={vi.fn()} isLoading={false} />
      );
      expect(screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i })).toBeDisabled();
      unmountA();

      // Case B: only state supplied (sowing_month is null)
      const { unmount: unmountB } = render(
        <PredictionFormV2
          onSubmit={vi.fn()}
          isLoading={false}
          initialValues={{ state: 'Punjab', sowing_month: null }}
        />
      );
      expect(screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i })).toBeDisabled();
      unmountB();

      // Case C: only sowing month supplied (state is empty)
      const { unmount: unmountC } = render(
        <PredictionFormV2
          onSubmit={vi.fn()}
          isLoading={false}
          initialValues={{ state: '', sowing_month: 11 }}
        />
      );
      expect(screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i })).toBeDisabled();
      unmountC();

      // Case D: both supplied
      const { unmount: unmountD } = render(
        <PredictionFormV2
          onSubmit={vi.fn()}
          isLoading={false}
          initialValues={{ state: 'Punjab', sowing_month: 11 }}
        />
      );
      expect(screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i })).not.toBeDisabled();
      unmountD();
    });

    it('3. missing NPK values remain null in the submitted payload', async () => {
      const mockSubmit = vi.fn();
      render(
        <PredictionFormV2
          onSubmit={mockSubmit}
          isLoading={false}
          initialValues={{ state: 'Punjab', sowing_month: 11 }}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });

      const payload: V2PredictRequest = mockSubmit.mock.calls[0][0];
      expect(payload.nitrogen).toBeNull();
      expect(payload.phosphorus).toBeNull();
      expect(payload.potassium).toBeNull();
    });

    it('4. missing nutrient basis remains null', async () => {
      const mockSubmit = vi.fn();
      render(
        <PredictionFormV2
          onSubmit={mockSubmit}
          isLoading={false}
          initialValues={{ state: 'Punjab', sowing_month: 11 }}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });

      const payload: V2PredictRequest = mockSubmit.mock.calls[0][0];
      expect(payload.nutrient_basis).toBeNull();
    });

    it('5. missing pH and soil texture remain null', async () => {
      const mockSubmit = vi.fn();
      render(
        <PredictionFormV2
          onSubmit={mockSubmit}
          isLoading={false}
          initialValues={{ state: 'Punjab', sowing_month: 11 }}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });

      const payload: V2PredictRequest = mockSubmit.mock.calls[0][0];
      expect(payload.soil_ph).toBeNull();
      expect(payload.soil_texture).toBeNull();
    });

    it('6. missing temperature and humidity remain null', async () => {
      const mockSubmit = vi.fn();
      render(
        <PredictionFormV2
          onSubmit={mockSubmit}
          isLoading={false}
          initialValues={{ state: 'Punjab', sowing_month: 11 }}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });

      const payload: V2PredictRequest = mockSubmit.mock.calls[0][0];
      expect(payload.temperature).toBeNull();
      expect(payload.humidity).toBeNull();
      expect(payload.temperature_min_night).toBeNull();
      expect(payload.temperature_max_day).toBeNull();
    });

    it('7. explicit profile prefill retains valid supplied values', async () => {
      const mockProfile: CompleteFarmProfile = {
        farmer: {
          fullName: 'Test Farmer',
          phone: '+91 9999999999',
          email: 'test@farm.com',
          state: 'Haryana',
          district: 'Karnal',
          experienceYears: '10',
        },
        farm: {
          farmName: 'Test Farm',
          farmSize: 5,
          farmSizeUnit: 'Acres',
          farmingMethod: 'Conventional',
          irrigationType: 'Drip',
          currentCrops: 'Wheat',
          previousCrops: 'Mustard',
        },
        conditions: {
          agroZone: 'Western Plain',
          waterAvailability: 'Moderate',
          rainfall: 720,
          temperature: 24.5,
          humidity: 58,
          topography: 'Plains / Flatlands',
          sunlightHours: 8,
        },
        soil: {
          soilType: 'Clay Loam',
          ph: 7.2,
          nitrogen: 110,
          phosphorus: 35,
          potassium: 60,
          organicCarbon: 0.55,
        },
        updatedAt: '2026-11-21T00:00:00Z',
      };

      vi.spyOn(farmProfileService, 'getFarmProfile').mockReturnValueOnce(mockProfile);

      render(<PredictionFormV2 onSubmit={vi.fn()} isLoading={false} />);

      const prefillBtn = screen.getByRole('button', { name: /Prefill Compatible Farm Profile/i });
      fireEvent.click(prefillBtn);

      // Verify prefilled values
      expect(screen.getAllByText('Haryana')[0]).toBeInTheDocument();
      expect((screen.getByLabelText(/District/i) as HTMLInputElement).value).toBe('Karnal');
      expect((screen.getByLabelText(/Mean Temperature/i) as HTMLInputElement).value).toBe('24.5');
      expect((screen.getByLabelText(/Relative Humidity/i) as HTMLInputElement).value).toBe('58');
      expect(screen.getAllByText('Clay Loam')[0]).toBeInTheDocument();
      expect((screen.getByLabelText(/Soil pH Level/i) as HTMLInputElement).value).toBe('7.2');
      expect((screen.getByLabelText(/Available Nitrogen \(N\)/i) as HTMLInputElement).value).toBe('110');
      expect((screen.getByLabelText(/Available Phosphorus \(P\)/i) as HTMLInputElement).value).toBe('35');
      expect((screen.getByLabelText(/Available Potassium \(K\)/i) as HTMLInputElement).value).toBe('60');
      expect((screen.getByLabelText(/Organic Carbon \(OC %\)/i) as HTMLInputElement).value).toBe('0.55');
      expect((screen.getByLabelText(/Annual Rainfall/i) as HTMLInputElement).value).toBe('720');

      // Sowing month remains null
      expect(screen.getByText(/Select sowing month\.\.\./i)).toBeInTheDocument();
    });

    it('8. missing profile values remain null', async () => {
      const sparseProfile: CompleteFarmProfile = {
        farmer: {
          fullName: 'Sparse Farmer',
          phone: '',
          email: '',
          state: '',
          district: '',
          experienceYears: '',
        },
        farm: {
          farmName: '',
          farmSize: 0,
          farmSizeUnit: 'Acres',
          farmingMethod: 'Conventional',
          irrigationType: 'Unknown' as any,
          currentCrops: '',
          previousCrops: '',
        },
        conditions: {
          agroZone: '',
          waterAvailability: 'Low / Rainfed',
          rainfall: undefined as any,
          temperature: undefined as any,
          humidity: undefined as any,
          topography: 'Plains / Flatlands',
          sunlightHours: 0,
        },
        soil: {
          soilType: '',
          ph: undefined as any,
          nitrogen: undefined as any,
          phosphorus: undefined as any,
          potassium: undefined as any,
          organicCarbon: undefined as any,
        },
        updatedAt: '2026-11-21T00:00:00Z',
      };

      vi.spyOn(farmProfileService, 'getFarmProfile').mockReturnValueOnce(sparseProfile);

      render(<PredictionFormV2 onSubmit={vi.fn()} isLoading={false} />);

      const prefillBtn = screen.getByRole('button', { name: /Prefill Compatible Farm Profile/i });
      fireEvent.click(prefillBtn);

      // Verify fields remain null/empty
      expect((screen.getByLabelText(/Mean Temperature/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/Relative Humidity/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/Soil pH Level/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/Available Nitrogen \(N\)/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/Available Phosphorus \(P\)/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/Available Potassium \(K\)/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/Organic Carbon \(OC %\)/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/Annual Rainfall/i) as HTMLInputElement).value).toBe('');
      expect(screen.getByText(/Select Indian State/i)).toBeInTheDocument();
      expect(screen.getByText(/Select Texture/i)).toBeInTheDocument();
      expect(screen.getByText('Reporting Basis')).toBeInTheDocument();
    });

    it('9. legitimate zero values are not discarded by profile prefill', async () => {
      const zeroProfile: CompleteFarmProfile = {
        farmer: {
          fullName: 'Zero Farmer',
          phone: '',
          email: '',
          state: 'Punjab',
          district: 'Amritsar',
          experienceYears: '',
        },
        farm: {
          farmName: 'Zero Farm',
          farmSize: 1,
          farmSizeUnit: 'Acres',
          farmingMethod: 'Conventional',
          irrigationType: 'Rainfed',
          currentCrops: '',
          previousCrops: '',
        },
        conditions: {
          agroZone: 'Plains',
          waterAvailability: 'Low / Rainfed',
          rainfall: 0,
          temperature: 0,
          humidity: 0,
          topography: 'Plains / Flatlands',
          sunlightHours: 0,
        },
        soil: {
          soilType: 'Loam',
          ph: 7.0,
          nitrogen: 0,
          phosphorus: 0,
          potassium: 0,
          organicCarbon: 0,
        },
        updatedAt: '2026-11-21T00:00:00Z',
      };

      vi.spyOn(farmProfileService, 'getFarmProfile').mockReturnValueOnce(zeroProfile);

      render(<PredictionFormV2 onSubmit={vi.fn()} isLoading={false} />);

      const prefillBtn = screen.getByRole('button', { name: /Prefill Compatible Farm Profile/i });
      fireEvent.click(prefillBtn);

      // Verify legitimate 0s are preserved
      expect((screen.getByLabelText(/Mean Temperature/i) as HTMLInputElement).value).toBe('0');
      expect((screen.getByLabelText(/Relative Humidity/i) as HTMLInputElement).value).toBe('0');
      expect((screen.getByLabelText(/Available Nitrogen \(N\)/i) as HTMLInputElement).value).toBe('0');
      expect((screen.getByLabelText(/Available Phosphorus \(P\)/i) as HTMLInputElement).value).toBe('0');
      expect((screen.getByLabelText(/Available Potassium \(K\)/i) as HTMLInputElement).value).toBe('0');
      expect((screen.getByLabelText(/Organic Carbon \(OC %\)/i) as HTMLInputElement).value).toBe('0');
      expect((screen.getByLabelText(/Annual Rainfall/i) as HTMLInputElement).value).toBe('0');
    });

    it('10. reset restores the safe unselected state', async () => {
      render(
        <PredictionFormV2
          onSubmit={vi.fn()}
          isLoading={false}
          initialValues={{
            state: 'Punjab',
            sowing_month: 11,
            temperature: 30,
            humidity: 80,
            soil_texture: 'Clay',
            soil_ph: 7.5,
            nitrogen: 100,
            phosphorus: 50,
            potassium: 50,
            organic_carbon: 1.2,
            nutrient_basis: 'Elemental_kg_ha',
            has_soil_test: true,
          }}
        />
      );

      // Confirm initial values populated
      expect(screen.getAllByText('Punjab')[0]).toBeInTheDocument();
      expect((screen.getByLabelText(/Mean Temperature/i) as HTMLInputElement).value).toBe('30');

      // Click Reset
      const resetBtn = screen.getByRole('button', { name: /Reset/i });
      fireEvent.click(resetBtn);

      // Verify all restored to safe empty/null
      expect(screen.getByText(/Select Indian State/i)).toBeInTheDocument();
      expect(screen.getByText(/Select sowing month\.\.\./i)).toBeInTheDocument();
      expect((screen.getByLabelText(/Mean Temperature/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/Relative Humidity/i) as HTMLInputElement).value).toBe('');
      expect(screen.getByText(/Select Texture/i)).toBeInTheDocument();
      expect((screen.getByLabelText(/Soil pH Level/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/Available Nitrogen \(N\)/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/Available Phosphorus \(P\)/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/Available Potassium \(K\)/i) as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText(/Organic Carbon \(OC %\)/i) as HTMLInputElement).value).toBe('');
      expect(screen.getByText('Reporting Basis')).toBeInTheDocument();

      const soilTestCheckbox = screen.getByRole('checkbox', {
        name: /Farmer-Declared Soil Health Card/i,
      });
      expect(soilTestCheckbox).not.toBeChecked();

      // Submit is disabled
      const submitBtn = screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i });
      expect(submitBtn).toBeDisabled();
    });

    it('11. soil-test declaration remains false after profile prefill', async () => {
      const profileWithSoilTest: CompleteFarmProfile = {
        farmer: {
          fullName: 'Farmer with Soil Test History',
          phone: '',
          email: '',
          state: 'Punjab',
          district: 'Ludhiana',
          experienceYears: '15',
        },
        farm: {
          farmName: 'Tested Land',
          farmSize: 10,
          farmSizeUnit: 'Acres',
          farmingMethod: 'Conventional',
          irrigationType: 'Canal',
          currentCrops: '',
          previousCrops: '',
        },
        conditions: {
          agroZone: '',
          waterAvailability: 'High',
          rainfall: 600,
          temperature: 26,
          humidity: 60,
          topography: 'Plains / Flatlands',
          sunlightHours: 8,
        },
        soil: {
          soilType: 'Loam',
          ph: 6.8,
          nitrogen: 90,
          phosphorus: 45,
          potassium: 45,
          organicCarbon: 0.7,
          lastTestedDate: '2024-03-15', // Profile has testing history
        },
        updatedAt: '2026-11-21T00:00:00Z',
      };

      vi.spyOn(farmProfileService, 'getFarmProfile').mockReturnValueOnce(profileWithSoilTest);

      render(<PredictionFormV2 onSubmit={vi.fn()} isLoading={false} />);

      const prefillBtn = screen.getByRole('button', { name: /Prefill Compatible Farm Profile/i });
      fireEvent.click(prefillBtn);

      // Checkbox MUST remain unchecked (USER_DECLARED provenance safety)
      const soilTestCheckbox = screen.getByRole('checkbox', {
        name: /Farmer-Declared Soil Health Card/i,
      });
      expect(soilTestCheckbox).not.toBeChecked();
    });

    it('12. unknown irrigation remains null after profile prefill unless an explicit supported irrigation type exists', async () => {
      const mockSubmit = vi.fn();

      // Case A: Unsupported / Unknown irrigation in profile
      const unknownIrrProfile: CompleteFarmProfile = {
        farmer: { fullName: '', phone: '', email: '', state: 'Punjab', district: '', experienceYears: '' },
        farm: {
          farmName: '',
          farmSize: 1,
          farmSizeUnit: 'Acres',
          farmingMethod: 'Mixed',
          irrigationType: 'Other / Flooding' as any,
          currentCrops: '',
          previousCrops: '',
        },
        conditions: {
          agroZone: '',
          waterAvailability: 'Moderate',
          rainfall: 500,
          temperature: 25,
          humidity: 60,
          topography: 'Plains / Flatlands',
          sunlightHours: 8,
        },
        soil: { soilType: 'Loam', ph: 7.0, nitrogen: 50, phosphorus: 20, potassium: 20, organicCarbon: 0.5 },
        updatedAt: '2026-11-21T00:00:00Z',
      };

      vi.spyOn(farmProfileService, 'getFarmProfile').mockReturnValueOnce(unknownIrrProfile);

      const { unmount } = render(
        <PredictionFormV2
          onSubmit={mockSubmit}
          isLoading={false}
          initialValues={{ sowing_month: 11 }}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Prefill Compatible Farm Profile/i }));

      // Submit and verify payload irrigation is null
      fireEvent.click(screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i }));
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });
      expect(mockSubmit.mock.calls[0][0].irrigation_access).toBeNull();

      unmount();
      mockSubmit.mockClear();

      // Case B: Supported irrigation in profile (Rainfed -> None_Rainfed)
      const rainfedProfile: CompleteFarmProfile = {
        ...unknownIrrProfile,
        farm: { ...unknownIrrProfile.farm, irrigationType: 'Rainfed' },
      };
      vi.spyOn(farmProfileService, 'getFarmProfile').mockReturnValueOnce(rainfedProfile);

      render(
        <PredictionFormV2
          onSubmit={mockSubmit}
          isLoading={false}
          initialValues={{ sowing_month: 11 }}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Prefill Compatible Farm Profile/i }));
      fireEvent.click(screen.getByRole('button', { name: /Evaluate Crops with Engine V2/i }));
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });
      expect(mockSubmit.mock.calls[0][0].irrigation_access).toBe('None_Rainfed');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Phase 3C.6.6.2: V2 Optional-Value Serialization & Request Builder
  // ─────────────────────────────────────────────────────────────
  describe('Phase 3C.6.6.2: V2 Optional-Value Serialization & Pure Request Builder', () => {
    it('1. serializeOptionalNumeric handles null, empty, legitimate zero, negatives, and invalid inputs', () => {
      // Empty / omitted -> strictly null
      expect(serializeOptionalNumeric(null)).toBeNull();
      expect(serializeOptionalNumeric(undefined)).toBeNull();
      expect(serializeOptionalNumeric('')).toBeNull();
      expect(serializeOptionalNumeric('   ')).toBeNull();

      // Legitimate zero is preserved as 0
      expect(serializeOptionalNumeric(0)).toBe(0);
      expect(serializeOptionalNumeric('0')).toBe(0);
      expect(serializeOptionalNumeric('  0  ')).toBe(0);

      // Negative finite numbers are preserved
      expect(serializeOptionalNumeric(-15)).toBe(-15);
      expect(serializeOptionalNumeric('-15')).toBe(-15);
      expect(serializeOptionalNumeric('-12.45')).toBe(-12.45);

      // Positive finite numbers are preserved
      expect(serializeOptionalNumeric(120)).toBe(120);
      expect(serializeOptionalNumeric('120.75')).toBe(120.75);

      // Invalid nonblank strings serialize to NaN (caught by bounds validation)
      expect(Number.isNaN(serializeOptionalNumeric('invalid'))).toBe(true);
      expect(Number.isNaN(serializeOptionalNumeric('abc'))).toBe(true);
      expect(Number.isNaN(serializeOptionalNumeric('NaN'))).toBe(true);

      // Non-finite numbers serialize to NaN
      expect(Number.isNaN(serializeOptionalNumeric(Infinity))).toBe(true);
      expect(Number.isNaN(serializeOptionalNumeric(-Infinity))).toBe(true);
      expect(Number.isNaN(serializeOptionalNumeric(NaN))).toBe(true);
    });

    it('2. serializeOptionalString trims and converts empty/whitespace to null', () => {
      expect(serializeOptionalString(null)).toBeNull();
      expect(serializeOptionalString(undefined)).toBeNull();
      expect(serializeOptionalString('')).toBeNull();
      expect(serializeOptionalString('   ')).toBeNull();
      expect(serializeOptionalString('Punjab')).toBe('Punjab');
      expect(serializeOptionalString('  Haryana  ')).toBe('Haryana');
    });

    it('3. serializeOptionalBoolean preserves tri-state boolean semantics (true, false, null)', () => {
      expect(serializeOptionalBoolean(true)).toBe(true);
      expect(serializeOptionalBoolean(false)).toBe(false);
      expect(serializeOptionalBoolean(null)).toBeNull();
      expect(serializeOptionalBoolean(undefined)).toBeNull();
      expect(serializeOptionalBoolean('true')).toBeNull();
      expect(serializeOptionalBoolean(0)).toBeNull();
      expect(serializeOptionalBoolean(1)).toBeNull();
    });

    it('4. buildV2PredictRequest preserves null for unselected optional fields without fabricated defaults', () => {
      const sparseFormData = {
        state: 'Punjab',
        sowing_month: null,
        district: '',
        irrigation_access: null,
        soil_texture: '',
        has_soil_test: null,
        nitrogen: '',
        phosphorus: undefined,
        potassium: null,
        soil_ph: '',
        seasonal_rainfall_amount: '',
        annual_rainfall: '',
        irrigation_water_quantity_mm: '',
        temperature: '',
        humidity: '',
      };

      const request = buildV2PredictRequest(sparseFormData as any);

      expect(request.state).toBe('Punjab');
      expect(request.sowing_month).toBeNull();
      expect(request.district).toBeNull();
      expect(request.irrigation_access).toBeNull();
      expect(request.soil_texture).toBeNull();
      expect(request.has_soil_test).toBeNull();
      expect(request.nitrogen).toBeNull();
      expect(request.phosphorus).toBeNull();
      expect(request.potassium).toBeNull();
      expect(request.soil_ph).toBeNull();
      expect(request.seasonal_rainfall_amount).toBeNull();
      expect(request.annual_rainfall).toBeNull();
      expect(request.irrigation_water_quantity_mm).toBeNull();
      expect(request.temperature).toBeNull();
      expect(request.humidity).toBeNull();
    });

    it('5. buildV2PredictRequest preserves legitimate 0 values without converting to null', () => {
      const zeroFormData = {
        state: 'Punjab',
        sowing_month: 6,
        nitrogen: 0,
        phosphorus: 0,
        potassium: 0,
        seasonal_rainfall_amount: 0,
        annual_rainfall: 0,
        irrigation_water_quantity_mm: 0,
        temperature: 0,
        humidity: 0,
      };

      const request = buildV2PredictRequest(zeroFormData as any);

      expect(request.state).toBe('Punjab');
      expect(request.sowing_month).toBe(6);
      expect(request.nitrogen).toBe(0);
      expect(request.phosphorus).toBe(0);
      expect(request.potassium).toBe(0);
      expect(request.seasonal_rainfall_amount).toBe(0);
      expect(request.annual_rainfall).toBe(0);
      expect(request.irrigation_water_quantity_mm).toBe(0);
      expect(request.temperature).toBe(0);
      expect(request.humidity).toBe(0);
    });

    it('6. buildV2PredictRequest correctly preserves tri-state has_soil_test', () => {
      // True
      const reqTrue = buildV2PredictRequest({ state: 'Punjab', sowing_month: 6, has_soil_test: true });
      expect(reqTrue.has_soil_test).toBe(true);

      // False
      const reqFalse = buildV2PredictRequest({ state: 'Punjab', sowing_month: 6, has_soil_test: false });
      expect(reqFalse.has_soil_test).toBe(false);

      // Null / unspecified
      const reqNull = buildV2PredictRequest({ state: 'Punjab', sowing_month: 6, has_soil_test: null });
      expect(reqNull.has_soil_test).toBeNull();
    });
  });
});
