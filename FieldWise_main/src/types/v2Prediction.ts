/**
 * FieldWise Phase 3C.6.3: V2 Recommendation Engine TypeScript Type Definitions
 * ============================================================================
 * Strictly adheres to the Phase 3C.6.2.2.1 backend bridge request/response contract.
 * Preserves the three canonical engine statuses: SUCCESS, INSUFFICIENT_DATA, NO_RECOMMENDATION_SUITABLE.
 */

export type V2EngineStatus = 'SUCCESS' | 'INSUFFICIENT_DATA' | 'NO_RECOMMENDATION_SUITABLE';

export type V2IrrigationAccess =
  | 'None_Rainfed'
  | 'Canal'
  | 'Tubewell_Borewell'
  | 'Drip'
  | 'Sprinkler';

export type V2RainfallPeriodType =
  | 'Crop_Season_Measured'
  | 'Seasonal_Estimated'
  | 'Annual_Historical';

export type V2EvidenceLevel = 'USER_DECLARED' | 'OFFICIAL_SURVEY' | 'INDEPENDENTLY_VERIFIED';

/**
 * Strict V2 API Request Schema
 */
export interface V2PredictRequest {
  // Location (state is mandatory)
  state: string;
  district?: string | null;
  agro_climatic_zone?: string | null;

  // Temporal (sowing_month is mandatory, 1 to 12)
  sowing_month: number | null;
  cultivation_season?: string | null;

  // Edaphic / Soil
  soil_ph?: number | null;
  soil_texture?: string | null;
  has_soil_test?: boolean | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  organic_carbon?: number | null;
  nutrient_basis?: string | null;

  // Climate and Water
  irrigation_access?: V2IrrigationAccess | null;
  irrigation_water_quantity_mm?: number | null;
  irrigation_period_days?: number | null;
  seasonal_rainfall_amount?: number | null;
  seasonal_rainfall_mm?: number | null;
  annual_rainfall?: number | null;
  rainfall?: number | null;
  rainfall_period_type?: V2RainfallPeriodType | null;
  rainfall_period_days?: number | null;
  monthly_rainfall?: number[] | null;

  temperature?: number | null;
  temperature_min_night?: number | null;
  temperature_max_day?: number | null;
  humidity?: number | null;

  soil_moisture_mm?: number | null;
  awc_mm_m?: number | null;
  rooting_depth_m?: number | null;

  // Optional target yield / calibration metadata
  target_yield_t_ha?: number | null;
  has_stcr_calibration?: boolean;
  verification_records?: any[];
}

/**
 * Water Assessment Details
 */
export interface V2WaterAssessment {
  crop_water_demand_mm?: number | null;
  effective_water_available_mm?: number | null;
  water_balance_ratio?: number | null;
  deficit_surplus_mm?: number | null;
  irrigation_requirement_net_mm?: number | null;
  assessment_notes?: string[];
  [key: string]: any;
}

/**
 * Fertilizer Guidance Details
 */
export interface V2FertilizerPrescription {
  status: string; // e.g., 'BASELINE_RDF_ARITHMETIC'
  evidence_level: string; // e.g., 'USER_DECLARED'
  nitrogen_kg_ha?: number | null;
  phosphorus_kg_ha?: number | null;
  potassium_kg_ha?: number | null;
  advisory_notes?: string[];
  calculation_basis?: string;
  [key: string]: any;
}

/**
 * Recommended Crop Item
 */
export interface V2CropRecommendation {
  crop_id: string;
  canonical_name: string;
  suitability_score: number; // 0.0 to 100.0 (Agronomic suitability, NOT statistical confidence)
  rank: number;
  tier1_status?: string;
  tier2_components?: {
    climate_suitability?: number;
    soil_suitability?: number;
    water_suitability?: number;
    penalty_deductions?: number;
    [key: string]: any;
  };
  water_assessment?: V2WaterAssessment;
  fertilizer_prescription?: V2FertilizerPrescription;
  agronomic_advisory?: string[];
  risk_warnings?: string[];
  yield_range?: [number, number] | null; // Reference yield range in t/ha (NEVER a single point estimate)
}

/**
 * Excluded Candidate Crop
 */
export interface V2ExcludedCandidate {
  crop_id: string;
  canonical_name: string;
  tier1_status: string;
  failing_rules: Array<{ rule: string; reason: string }>;
}

/**
 * Query Summary Metadata
 */
export interface V2QuerySummary {
  location: string;
  season: string;
  planting_system_evaluated: string;
  water_regime_evaluated: string;
  data_completeness_index: number; // 0.0 to 100.0
  evidence_confidence_tier: string; // e.g. 'FARMER_DECLARED', 'INSUFFICIENT_DATA'
}

/**
 * Diagnostics & Missing Information
 */
export interface V2Diagnostics {
  reason?: string;
  missing_critical_parameters?: string[];
  recommendation_suggestions?: string[];
  [key: string]: any;
}

/**
 * V2 Engine Output Payload
 */
export interface V2EngineData {
  status: V2EngineStatus;
  engine_version: string;
  execution_timestamp: string;
  query_summary: V2QuerySummary;
  recommendations: V2CropRecommendation[];
  excluded_candidates: V2ExcludedCandidate[];
  diagnostics?: V2Diagnostics;
  land_reclamation_advisory?: string | null;
}

/**
 * Standard V2 API Response Envelope
 */
export interface V2PredictResponse {
  success: boolean;
  version: string;
  status: V2EngineStatus;
  data: V2EngineData;
}

/**
 * Form Model for V2 Input UI
 */
export interface V2FormValues {
  state: string;
  district: string;
  agro_climatic_zone: string;
  sowing_month: number | null; // Starts unselected (null)
  cultivation_season: string;

  // Water & Irrigation
  irrigation_access: V2IrrigationAccess | '' | null; // Missing selection is null (UNKNOWN)
  irrigation_water_quantity_mm: number | null;
  irrigation_period_days: number | null;

  // Rainfall
  seasonal_rainfall_amount: number | null; // Seasonal only
  annual_rainfall: number | null; // Macro context only
  rainfall_period_type: V2RainfallPeriodType | '' | null;
  rainfall_period_days: number | null;

  // Climate
  temperature: number | null;
  temperature_min_night: number | null;
  temperature_max_day: number | null;
  humidity: number | null;

  // Edaphic
  soil_texture: string;
  soil_ph: number | null;
  has_soil_test: boolean | null; // Three-state boolean (true, false, null)
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
  organic_carbon: number | null;
  nutrient_basis: string;
}
