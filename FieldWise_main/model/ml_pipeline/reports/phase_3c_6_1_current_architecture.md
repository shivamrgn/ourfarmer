# FieldWise — Phase 3C.6.1.3: Current Application Architecture and Baseline Audit

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_1_current_architecture.md`  
**Phase**: 3C.6.1.3 Final Safety Amendment (Read-Only)  
**Execution Mode**: READ-ONLY Audit & Architectural Specification  
**Date**: November 2026  
**Status**: APPROVED RECONCILED BASELINE AUDIT  

---

## 1. Executive Summary & Verification Provenance

This document establishes the verified architectural baseline of the FieldWise application and the frozen Phase 3C.5 rule-based crop recommendation engine. In accordance with the Phase 3C.6.1.3 mandate, this audit explicitly distinguishes between **verified source code facts** and **operational assumptions**.

### 1.1 Verification Provenance Table

| Architectural Element | Status | Supporting Source Reference | Details / Verification Notes |
| :--- | :--- | :--- | :--- |
| **V1 Express Route & Validator Rules** | **VERIFIED** | `FieldWise_main/backend/src/routes/predict.js`, L13–27 | Validates 8 numeric fields with `express-validator`. Does not validate `state` or `sowing_month`. |
| **V1 Controller & Predictor Invocation** | **VERIFIED** | `FieldWise_main/backend/src/controllers/predictController.js`, L7, 32–48 | Extracts 9 fields, directly invokes legacy `predictCrops()`, returns 4-field JSON response. |
| **Legacy Gaussian Scoring & 35% Cut-off** | **VERIFIED** | `FieldWise_main/model/predictor.js`, L77–146 | Normalizes raw score to 0–100, computes synthetic yield multiplier, filters `confidence > 35`. |
| **Legacy Crop Database (16 Crops)** | **VERIFIED** | `FieldWise_main/model/cropDatabase.js`, L1–261 | Static database of 16 crops with baseline ranges and single yield constants. |
| **Legacy Fertilizer Recipes** | **VERIFIED** | `FieldWise_main/model/fertilizerDatabase.js`, L1–92 | Static string arrays per crop with fixed doses (e.g. Rice -> Urea 100–120 kg/ha). |
| **Silent Offline Fallback on 5xx Errors** | **VERIFIED** | `FieldWise_main/src/lib/api.ts`, L68–81 | Catches 5xx / connection failures and silently runs client-side `predictCropsEngine`. |
| **Client-Side Predictor Clone** | **VERIFIED** | `FieldWise_main/src/lib/predictorEngine.ts`, L1–490 | Complete in-browser TypeScript clone of the legacy Gaussian predictor. |
| **Frontend Form State & Arbitrary Defaults** | **VERIFIED** | `FieldWise_main/src/components/modules/CropRecommendation.tsx`, L48–125 | Captures 9 inputs. Pre-fills default values (NPK 80-50-50, pH 6.5, rain 150) if storage empty. |
| **Confidence % Display & Progress Bar** | **VERIFIED** | `FieldWise_main/src/components/PredictionResults.tsx`, L142–153 | Renders `${result.confidence.toFixed(1)}%` with horizontal progress bar. |
| **Supabase `crop_predictions` Schema** | **VERIFIED** | `FieldWise_main/src/lib/supabase.ts`, L201–222 | Writes row to `crop_predictions` with string `confidence` and numeric NPK/pH/climate fields. |
| **Frozen `RecommendationQuery` Dataclasses** | **VERIFIED** | `FieldWise_main/model/ml_pipeline/recommendation_engine/schemas.py`, L105–218 | Exact dataclasses: `LocationInput`, `TemporalInput`, `ClimateWaterInput`, `EdaphicInput`. |
| **Frozen Mandatory `sowing_month` Validation** | **VERIFIED** | `FieldWise_main/model/ml_pipeline/recommendation_engine/input_validator.py`, L105–108, 172–174 | Rejects missing/invalid `sowing_month` with `InputValidationError` / `INSUFFICIENT_DATA`. |
| **Frozen Zero STCR Approved Calibrations** | **VERIFIED** | `FieldWise_main/model/ml_pipeline/recommendation_engine/stcr_registry.py`, L30–33 | `_APPROVED_CALIBRATIONS = {}`. Engine purges unverified calibrations; returns baseline RDF. |
| **Frozen Trusted Verification Requirement** | **VERIFIED** | `FieldWise_main/model/ml_pipeline/recommendation_engine/dci_confidence.py`, L14–24 | User strings alone remain `USER_DECLARED`. Verified tier strictly requires signed `TrustedVerificationRecord`. |
| **Python Module Execution Path** | **VERIFIED** | Operational Shell / CLI verification | `python3 -m FieldWise_main.model.ml_pipeline.recommendation_engine.adapter_cli` succeeds. |
| **Host Python 3 Availability** | **ASSUMPTION** | Operational deployment environment | Assumed that standard host/container has `python3` ($\ge$ 3.9) installed and on `$PATH`. |
| **Farmer Sowing Month Interaction** | **ASSUMPTION** | User experience behavior | Assumed that farmers are willing to explicitly select their planned sowing month before submission. |

---

## 2. Component Topology and System Context

```mermaid
flowchart TD
    subgraph Client["Frontend Client (Browser / Vite + React + TypeScript)"]
        Form["PredictionForm.tsx / CropRecommendation.tsx\n(Captures Inputs)"]
        ProfServ["farmProfileService.ts\n(Profile Data)"]
        WeathCtx["WeatherContext.tsx\n(Live Weather Data)"]
        ApiTS["lib/api.ts\nAxios Client"]
        OfflineEngine["lib/predictorEngine.ts\n(Client-side TS Legacy Predictor)"]
        ResComp["PredictionResults.tsx\n(Renders Results)"]
        FarmIntel["FarmIntelligence.tsx\n(Reads localStorage Cache)"]
        LocStor[("localStorage:\ncropswild_crop_recommendation_last")]
    end

    subgraph Backend["Express.js Backend (Node.js / Port 3001)"]
        ServerJS["server.js\nCORS, Routing, Port 3001"]
        RouteV1["routes/predict.js\nPOST /api/predict (UNTOUCHED V1)"]
        CtrlV1["controllers/predictController.js\nLegacy Controller (UNTOUCHED)"]
        RouteV2["routes/predictV2.js\nPOST /api/v2/predict (NEW V2 ROUTE)"]
        CtrlV2["controllers/predictV2Controller.js\nV2 Controller"]
        BridgeNode["services/recommendationEngineBridge.js\nNode.js Child Process Bridge"]
        LegacyModel["model/predictor.js\npredictCrops(inputs)"]
        CropDB["model/cropDatabase.js\n(16 Crops)"]
        FertDB["model/fertilizerDatabase.js\n(Static Recipes)"]
    end

    subgraph Database["Cloud Persistence (Supabase)"]
        SupaClient["lib/supabase.ts\nsavePredictionToSupabase()"]
        SupaTable[("Supabase DB:\ncrop_predictions (V1 ONLY)")]
    end

    subgraph Phase3C5["Frozen Python Recommendation Engine (model/ml_pipeline/)"]
        AdapterCLI["recommendation_engine/adapter_cli.py\n(CLI Runner)"]
        EnginePy["recommendation_engine/engine.py\nCropRecommendationEngine.recommend()"]
        SchemasPy["recommendation_engine/schemas.py\nRecommendationQuery"]
        ValidatorPy["recommendation_engine/input_validator.py\nValidation & Adequacy Gating"]
        CatPy["recommendation_engine/catalogue.py\n(19 Canonical Crops)"]
        WaterPy["recommendation_engine/water_assessment.py\nUSDA-SCS Effective Rainfall"]
        Tier1Py["recommendation_engine/tier1_eligibility.py\nHard Exclusion Gating"]
        Tier2Py["recommendation_engine/tier2_scoring.py\nLiebig Non-Compensatory Scoring"]
        DCIPy["recommendation_engine/dci_confidence.py\n6-Domain Provenance & DCI"]
        RankPy["recommendation_engine/ranking.py\nDeterministic Viability (>= 40.0)"]
        ExplPy["recommendation_engine/explanations.py\nStoichiometric DAP Prescriptions"]
    end

    Form -->|1. Submit Inputs| ApiTS
    ProfServ -.->|User Data| Form
    WeathCtx -.->|Live Data| Form
    ApiTS -->|2a. POST /api/predict (Legacy)| RouteV1
    ApiTS -->|2b. POST /api/v2/predict (New)| RouteV2
    ApiTS -.->|2c. Offline Disconnection ONLY| OfflineEngine
    OfflineEngine -.->|Return Local Predictions| ApiTS
    RouteV1 --> CtrlV1
    CtrlV1 --> LegacyModel
    LegacyModel --> CropDB
    LegacyModel --> FertDB
    RouteV2 --> CtrlV2
    CtrlV2 --> BridgeNode
    BridgeNode -->|stdin/stdout JSON| AdapterCLI
    AdapterCLI --> EnginePy
    CtrlV1 -->|3a. V1 JSON| ApiTS
    CtrlV2 -->|3b. V2 JSON| ApiTS
    ApiTS -->|4. Update State| ResComp
    Form -->|5. Write V2 Cache| LocStor
    Form -->|6. V1 Only Async Sync| SupaClient
    SupaClient --> SupaTable
    LocStor -.->|Read Cache| FarmIntel
```

---

## 3. Inspected Source Code Evidence

### 3.1 Frozen Python Engine Schema & Constructors (`schemas.py`)
Direct source extract from `FieldWise_main/model/ml_pipeline/recommendation_engine/schemas.py` lines 105–218:

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any, Tuple

@dataclass
class LocationInput:
    state: str
    district: Optional[str] = None
    agro_climatic_zone: Optional[str] = None

@dataclass
class TemporalInput:
    sowing_month: int  # 1 - 12 (MANDATORY)
    sowing_date: Optional[str] = None  # YYYY-MM-DD
    cultivation_season: Optional[str] = None  # Broad season (Kharif, Rabi, Zaid, etc.)
    planting_system: Optional[str] = None  # Specific system (Timely_Sown, Late_Sown, etc.)

@dataclass
class ClimateWaterInput:
    seasonal_rainfall_amount: Optional[float] = None  # Gross mm (required for rainfed)
    rainfall_period_type: Optional[str] = None
    rainfall_source: Optional[str] = None
    monthly_rainfall: Optional[List[float]] = None
    irrigation_access: Optional[str] = "None_Rainfed"  # NOTE: Frozen default; adapter overrides to None if omitted
    irrigation_water_quantity_mm: Optional[float] = None
    irrigation_quantity_basis: Optional[str] = None
    irrigation_type: Optional[str] = None
    irrigation_period_days: Optional[int] = None
    rainfall_period_days: Optional[int] = None
    temperature_mean: Optional[float] = None
    temperature_min_night: Optional[float] = None
    temperature_max_day: Optional[float] = None
    relative_humidity: Optional[float] = None
    soil_moisture_tier: Optional[str] = "UNKNOWN"
    soil_moisture_mm: Optional[float] = None
    awc_mm_m: Optional[float] = None
    rooting_depth_m: Optional[float] = None
    station_id: Optional[str] = None
    measurement_date_start: Optional[str] = None
    measurement_date_end: Optional[str] = None
    irrigation_meter_id: Optional[str] = None
    source_reference: Optional[str] = None

@dataclass
class EdaphicInput:
    soil_texture: Optional[str] = None
    texture_measurement_method: Optional[str] = None
    soil_ph: Optional[float] = None
    ph_measurement_method: Optional[str] = None
    has_soil_test: bool = False
    soil_test_source: Optional[str] = None
    nutrient_basis: Optional[str] = None
    soil_nitrogen: Optional[float] = None
    soil_phosphorus: Optional[float] = None
    soil_potassium: Optional[float] = None
    organic_carbon_pct: Optional[float] = None
    lab_accreditation_number: Optional[str] = None
    sample_id: Optional[str] = None
    test_date: Optional[str] = None
    source_reference: Optional[str] = None

@dataclass
class RecommendationQuery:
    location: LocationInput
    temporal: TemporalInput
    climate_and_water: ClimateWaterInput
    edaphic: EdaphicInput
    stcr_calibration_id: Optional[str] = None
    stcr_calibration: Optional[STCRCalibrationRecord] = None
    target_yield_t_ha: Optional[float] = None
    has_stcr_calibration: bool = False
    verification_records: List[TrustedVerificationRecord] = field(default_factory=list)
```

### 3.2 Verified CLI Runner Invocation Command
Verified on macOS/Linux shell from repository root (`/Users/shivamkumar/farmingFinal`):
```bash
python3 -m FieldWise_main.model.ml_pipeline.recommendation_engine.adapter_cli
```
Or with `PYTHONPATH`:
```bash
PYTHONPATH=FieldWise_main python3 -m model.ml_pipeline.recommendation_engine.adapter_cli
```
This invocation loads all dependencies purely from Python standard library (`dataclasses`, `enum`, `typing`, `math`, `datetime`, `json`, `pathlib`, `re`).

---

## 4. Reconciled Routing & Persistence Architecture

### 4.1 Route Separation (V1 Intact vs. V2 Dedicated)
- `POST /api/predict`: Preserved **100% unchanged**. Invokes legacy `model/predictor.js`. Returns legacy V1 JSON shape (`{ success, count, state, predictions }`). Zero modifications to `routes/predict.js` or `controllers/predictController.js`.
- `POST /api/v2/predict`: Dedicated new route (`routes/predictV2.js` and `controllers/predictV2Controller.js`). Invokes `recommendationEngineBridge.js`, executing the frozen Phase 3C.5 engine. Returns pure V2 JSON shape (`{ success, api_version: "2.0", execution_status, recommendations, diagnostics }`).

### 4.2 Reconciled Persistence Strategy
- **V1 Persistence (Supabase Intact)**: When executing V1 predictions, `savePredictionToSupabase` writes into the existing `crop_predictions` table (`farmer_id`, `recommended_crop`, `confidence: "88.5%"`, NPK/climate).
- **V2 Persistence (Client-Side Cached, Cloud Deferred)**:
  - The latest V2 result is stored in browser `localStorage['cropswild_crop_recommendation_last']` with complete V2 fields (`suitabilityScore`, `evidenceConfidenceTier`, `expectedYieldRange`, `diagnostics`, `landReclamationAdvisory`).
  - **Durable Storage Notice**: Browser-local storage provides ephemeral client-side caching for the user's latest session; it is **not cloud backup or guaranteed durable storage** and may be cleared by browser storage pressure or user cache clearing.
  - In Supabase, because `crop_predictions` lacks compatible fields for suitability index, evidence tiers, and diagnostics, cloud persistence for V2 is **formally deferred** until a dedicated, approved schema decision/migration is scheduled.
  - The legacy `confidence` string column will **NEVER be overloaded** with formatted suitability strings.

---

## 5. Water Accounting & Irrigation Default Safety Invariants

### 5.1 Annual vs. Seasonal Rainfall Safety
- `farmProfile.conditions.rainfall` records annual average rainfall in mm. It must **NEVER** be mapped directly into `seasonal_rainfall_amount`.
- Annual estimated rainfall is preserved strictly as annual-period information (`rainfall_period_type: "Annual_Estimated"`).
- `seasonal_rainfall_amount` is set to Unknown (`None`) unless a genuine crop-season measurement or valid seasonal estimate is supplied.
- Monthly USDA-SCS effective rainfall calculations are **never applied to annual totals**.

### 5.2 Irrigation Default Override Safety
- The frozen `ClimateWaterInput` constructor defaults `irrigation_access` to `"None_Rainfed"`.
- The adapter must **explicitly override that default** by passing `irrigation_access=None` (or `"UNKNOWN"`) when the farmer has not selected irrigation access.
- Missing irrigation selection must remain **`UNKNOWN`**, never rainfed.
- **Documented Adapter Test Case**:
  `test_adapter_omitted_irrigation_does_not_default_to_rainfed`:
  Verifies that when `irrigation_access` is omitted in the request payload, the adapter explicitly passes `irrigation_access=None`, ensuring the engine treats it as `UNKNOWN` rather than silently adopting the dataclass default `"None_Rainfed"`.
