# FieldWise — Phase 3C.6.1.3: Output Contract Compatibility Mapping

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_1_output_contract_mapping.md`  
**Phase**: 3C.6.1.3 Final Safety Amendment (Read-Only)  
**Execution Mode**: READ-ONLY Specification & Compatibility Analysis  
**Date**: November 2026  
**Status**: APPROVED RECONCILED CONTRACT MAPPING  

---

## 1. Executive Summary & Core Safety Invariants

This document establishes the definitive output compatibility mapping between the legacy FieldWise prediction service (`POST /api/predict`) and the frozen Phase 3C.5 rule-based crop recommendation engine (`POST /api/v2/predict`).

### Reconciled Safety Invariants
1. **Preservation of V1 Route & Response Semantics**:
   - `POST /api/predict` remains **100% unchanged** as the V1 route. It executes `model/predictor.js` and returns the legacy 4-field response shape (`{ success, count, state, predictions }`).
   - `POST /api/v2/predict` is the dedicated route for the frozen Phase 3C.5 engine, returning pure V2 semantics.
2. **Strict Separation of Suitability and Confidence**:
   - `suitabilityScore` is the **Agronomic Suitability Index (0–100)**, derived from non-compensatory Liebig limiting factors and biophysical scoring.
   - `evidenceConfidenceTier` is an independent epistemic quality tier (`HIGH_CONFIDENCE`, `PROVISIONAL_EVALUATION`, etc.).
   - The new engine's suitability score will **never** be mapped into the legacy `confidence` field or presented as a probability or model confidence percentage.
3. **Neutral Yield Provenance Labeling (No Fabricated Point Estimates)**:
   - The Phase 3C.5 engine outputs published reference yield ranges (`expected_yield_range_t_ha: [min, max]`).
   - The contract uses a neutral label: **"Reference Yield Range: [min, max] t/ha"**. Specific citations (such as `"ICAR-IIWBR Bull. 55/2022"`) are displayed **only when explicitly present in the active planting window metadata**.
   - The integration layer will **never** calculate an arithmetic midpoint `(min + max) / 2` to create a fabricated point estimate.
4. **Soil-Test Provenance & Fertilizer Safety**:
   - The UI checkbox is strictly a **`USER_DECLARED`** input. The UI and API contract explicitly state: *"Fertilizer calculations are based on farmer-declared soil-test information and entered values."*
   - The system will **never** claim or display independently verified laboratory status without a cryptographically or administratively signed `TrustedVerificationRecord`.
   - When `has_soil_test=False`, chemical fertilizer doses are **withheld for safety**, accompanied by state baseline RDF reference figures.
5. **Water Accounting & Irrigation Default Safety**:
   - **Annual vs. Seasonal Rainfall**: Never map `farmProfile.conditions.rainfall (annual mm)` directly into `seasonal_rainfall_amount`. Preserve annual estimated rainfall as annual-period information only (`Annual_Estimated`). Set `seasonal_rainfall_amount` to Unknown (`None`) unless a genuine crop-season measurement or valid seasonal estimate is supplied. Monthly USDA-SCS equation is never applied to annual totals.
   - **Irrigation Default Override**: The frozen `ClimateWaterInput` constructor defaults `irrigation_access` to `"None_Rainfed"`. The adapter must explicitly override that default by passing `irrigation_access=None` (or `"UNKNOWN"`) when the farmer has not selected irrigation access. Missing selection = `UNKNOWN`, never rainfed.
6. **Reconciled Supabase Cloud Persistence**:
   - The legacy `confidence` field in Supabase table `crop_predictions` will **NOT** be overloaded with formatted suitability strings. V1 persistence semantics are preserved intact.
   - For V2, because `crop_predictions` lacks compatible unassigned fields for suitability score, evidence tiers, and diagnostics, cloud persistence is **formally deferred** until a dedicated, approved schema decision/migration is scheduled.
   - The latest V2 result is stored in browser `localStorage['cropswild_crop_recommendation_last']` (browser-local storage provides ephemeral client-side caching for the user's latest session; it is not cloud backup or guaranteed durable storage).

---

## 2. Dual Independent API Contracts

### 2.1 Version 1 Contract (`POST /api/predict` — Untouched)
Preserved for legacy consumers and legacy fallback execution:
```json
{
  "success": true,
  "count": 6,
  "state": "Punjab",
  "predictions": [
    {
      "crop": {
        "id": "wheat",
        "name": "Wheat",
        "season": "Rabi",
        "icon": "🌿",
        "yieldPerHectare": 3.5
      },
      "confidence": 88.5,
      "yieldPrediction": 3.7,
      "scoreBreakdown": {
        "rainfall": 22.0,
        "temperature": 22.0,
        "humidity": 16.0,
        "soil": 20.0,
        "nitrogen": 8.0,
        "phosphorus": 6.0,
        "potassium": 6.0,
        "phBonus": 10.0
      },
      "fertilizers": [
        { "name": "Urea", "dosage": "130–150 kg/ha", "applicationTime": "Split: 50% basal...", "nutrients": "Nitrogen (46%)" }
      ]
    }
  ]
}
```

### 2.2 Version 2 Contract (`POST /api/v2/predict` — Dedicated New Route)
Strictly enforces new-engine semantics:
```json
{
  "success": true,
  "api_version": "2.0",
  "engine": "phase_3c_5",
  "engine_version": "2.2.0-CLOSURE",
  "execution_status": "SUCCESS",
  "query_summary": {
    "location": "Punjab",
    "season": "Rabi",
    "planting_system_evaluated": "Timely_Sown",
    "water_regime_evaluated": "Irrigated_Canal",
    "data_completeness_index": 0.85,
    "evidence_confidence_tier": "HIGH_CONFIDENCE_ESTIMATED_FERTILITY"
  },
  "recommendations": [
    {
      "rank": 1,
      "crop_id": "wheat",
      "canonical_name": "Wheat",
      "crop_life_cycle": "Annual_Seasonal",
      "suitabilityScore": 88.5,
      "evidenceConfidenceTier": "HIGH_CONFIDENCE_ESTIMATED_FERTILITY",
      "tier1Status": "ELIGIBLE",
      "tier2Components": {
        "climate_score": 92.0,
        "water_score": 85.0,
        "soil_score": 90.0,
        "nutrient_score": 80.0,
        "ph_score": 95.0,
        "core_suitability": 88.4,
        "liebig_penalty_factor": 0.80
      },
      "activePlantingWindow": {
        "window_id": "WHEAT_NW_PLAINS_TIMELY",
        "planting_system": "Timely_Sown",
        "broad_season": "Rabi",
        "sowing_month_start": 10,
        "sowing_month_end": 11,
        "crop_duration_days": 140,
        "window_evidence_status": "VERIFIED",
        "source_reference": "ICAR-IIWBR Bull. 55/2022"
      },
      "waterAssessment": {
        "water_gating_status": "PASS_VERIFIED",
        "effective_rainfall_mm": 65.0,
        "net_irrigation_delivered_mm": 280.0,
        "gross_irrigation_applied_mm": 350.0,
        "total_net_water_mm": 345.0,
        "deficit_against_optimal_mm": 0.0,
        "deficit_against_min_mm": 0.0,
        "irrigation_efficiency": 0.80,
        "warnings": []
      },
      "expectedYieldRange": [4.2, 5.5],
      "yieldProvenance": {
        "label": "Reference Yield Range",
        "unit": "t/ha",
        "citation": "ICAR-IIWBR Bull. 55/2022"
      },
      "agronomicAdvisory": [
        "Crown root initiation (CRI) stage irrigation at 21 DAS is critical."
      ],
      "riskWarnings": [],
      "fertilizerPrescription": {
        "status": "BASELINE_RDF_ARITHMETIC",
        "provenance_statement": "Fertilizer calculations are based on farmer-declared soil-test information and entered values.",
        "rdf_n_p2o5_k2o_kg_ha": [120.0, 60.0, 40.0],
        "adjusted_dose_kg_ha": [120.0, 60.0, 40.0],
        "commercial_products": {
          "DAP_kg_ha": 130.4,
          "Urea_kg_ha": 209.8,
          "MOP_kg_ha": 66.7
        },
        "stoichiometric_notes": "Urea adjusted by deducting 23.5 kg N supplied by 130.4 kg DAP.",
        "disclaimers": []
      }
    }
  ],
  "excluded_candidates": [],
  "diagnostics": {
    "total_evaluated_crops": 19,
    "eligible_crops_count": 4,
    "disqualified_crops_count": 15
  },
  "land_reclamation_advisory": null
}
```

---

## 3. Crop Identity and Taxonomy Reconciliation

The legacy system recognises 16 crops in `FieldWise_main/model/cropDatabase.js`. The frozen Phase 3C.5 engine implements the ICAR/DES-aligned 19-crop canonical taxonomy in `recommendation_engine/catalogue.py`.

| Legacy Crop ID | Legacy Display Name | Canonical Crop ID | Canonical Display Name | Crop Category | Life Cycle | Taxonomy Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `rice` | Rice | `rice` | Rice (Paddy) | Cereal | Annual_Seasonal | Exact ID match; refined display name |
| `wheat` | Wheat | `wheat` | Wheat | Cereal | Annual_Seasonal | Exact ID and name match |
| `maize` | Maize | `maize` | Maize (Corn) | Cereal | Annual_Seasonal | Exact ID match; refined display name |
| `cotton` | Cotton | `cotton` | Cotton | Fiber | Annual_Seasonal | Exact ID and name match |
| `sugarcane` | Sugarcane | `sugarcane` | Sugarcane | Commercial | Long_Duration_Annual | Exact ID and name match |
| `soybean` | Soybean | `soybean` | Soybean | Oilseed | Annual_Seasonal | Exact ID and name match |
| `groundnut` | Groundnut | `groundnut` | Groundnut | Oilseed | Annual_Seasonal | Exact ID and name match |
| `potato` | Potato | `potato` | Potato | Tuber | Annual_Seasonal | Exact ID and name match |
| `chickpea` | Chickpea | `chickpea` | Chickpea | Pulse | Annual_Seasonal | Exact ID and name match |
| `lentil` | Lentil | `lentil` | Lentil | Pulse | Annual_Seasonal | Exact ID and name match |
| `mustard` | Mustard | `mustard` | Mustard | Oilseed | Annual_Seasonal | Exact ID and name match |
| `tomato` | Tomato | `tomato` | Tomato | Vegetable | Multi_Season_Arable | Exact ID and name match |
| `onion` | Onion | `onion` | Onion | Vegetable | Annual_Seasonal | Exact ID and name match |
| `banana` | Banana | `banana` | Banana | Fruit | Long_Duration_Annual | Exact ID and name match |
| `mango` | Mango | `mango` | Mango | Fruit | Perennial_Orchard | Exact ID and name match |
| `jowar` | Jowar | `jowar` | Jowar (Sorghum) | Millets | Annual_Seasonal | Exact ID match; refined display name |
| *None* | *Not supported* | `sunflower` | Sunflower | Oilseed | Multi_Season_Arable | **New canonical crop** |
| *None* | *Not supported* | `barley` | Barley | Cereal | Annual_Seasonal | **New canonical crop** |
| *None* | *Not supported* | `millets` | Millets (Pearl Millet / Bajra) | Millets | Annual_Seasonal | **New canonical crop** |

---

## 4. Environmental Hostility (`NO_RECOMMENDATION_SUITABLE`)

When all 19 crops fail Tier 1 gates OR the top crop's ASI fails the 40.0 / 100 threshold, the V2 endpoint returns:
- `execution_status`: `"NO_RECOMMENDATION_SUITABLE"`
- `recommendations`: `[]`
- `excluded_candidates`: List of crops with specific failing rules.
- `land_reclamation_advisory`: Actionable soil remediation guidance (e.g. Gypsum for sodic soils, agricultural lime for acid soils).

---

## 5. Reconciled Persistence Strategy

### 5.1 Local Storage Contract (`cropswild_crop_recommendation_last`)
Preserves full V2 fidelity in browser storage:
```typescript
interface StoredCropRecommendationV2 {
  engine: 'phase_3c_5' | 'legacy_v1_fallback' | 'offline_legacy_engine';
  apiVersion: '2.0';
  executionStatus: string;
  analyzedAt: string;
  topCrop: string;
  cropName: string;
  suitabilityScore: number | null;
  evidenceConfidenceTier: string | null;
  expectedYieldRange: [number, number] | null;
  recommendations: Version2CropRecommendation[];
  inputs: Record<string, any>;
  landReclamationAdvisory?: string | null;
}
```

### 5.2 Supabase Persistence Policy
- **V1 Queries**: Executed against `/api/predict`. Synced to `crop_predictions` with legacy semantics (`recommended_crop`, `confidence: "88.5%"`).
- **V2 Queries**: Executed against `/api/v2/predict`. Cloud persistence to `crop_predictions` is **formally deferred** until a dedicated schema migration is approved. The existing `confidence` column will **not** be overloaded.
- **Client Cache**: The latest V2 result is stored in browser `localStorage` (browser-local storage provides ephemeral client-side caching; it is not cloud backup or guaranteed durable storage).
