# FieldWise — Phase 3C.6.4.1: V2 Storage-Field Mapping & Semantic Safeguards

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_4_1_v2_storage_mapping.md`  
**Phase**: 3C.6.4.1 Persistence and Storage Mapping (Read-Only)  
**Execution Timestamp**: November 2026  
**Status**: APPROVED RECONCILED V2 MAPPING  

---

## 1. Executive Summary

The Phase 3C.6.2/3C.6.3 Engine V2 generates rich, multi-dimensional agronomic decision support outputs across three mutually exclusive engine statuses (`SUCCESS`, `INSUFFICIENT_DATA`, `NO_RECOMMENDATION_SUITABLE`). 

Unlike legacy V1's single Gaussian score, V2 produces Liebig-calibrated non-compensatory suitability scores, USDA-SCS effective rainfall water balance accounting, stoichiometric DAP/Urea/MOP fertilizer formulations with baseline RDF provenance warnings, physiologic candidate exclusions, and bounded yield ranges (`[min, max] t/ha`).

This document defines the comprehensive field-by-field storage mapping required to preserve the complete V2 contract without data degradation, and establishes eight mandatory semantic safeguards to protect data integrity.

---

## 2. Complete V2 Contract Storage Mapping

### 2.1 Top-Level Query & Execution Metadata

| Parameter / Field | Source in V2 Engine Contract | Target Storage Attribute | Target Representation & Invariant |
| :--- | :--- | :--- | :--- |
| **Prediction Run ID** | System Generated | `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| **Farmer Association** | Context / Active User | `farmer_id` | `TEXT NOT NULL REFERENCES public.farmers(id)` |
| **Engine Status** | `res.data.status` | `engine_status` | `TEXT NOT NULL CHECK (engine_status IN ('SUCCESS', 'INSUFFICIENT_DATA', 'NO_RECOMMENDATION_SUITABLE'))` |
| **Engine Version** | `res.data.engine_version` | `engine_version` | `TEXT NOT NULL` (e.g. `'v2.0.0'`) |
| **Execution Timestamp**| `res.data.timestamp` | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` |
| **Execution Duration** | `res.data.timing_ms` | `execution_time_ms`| `INTEGER NULL` (Execution telemetry) |

---

### 2.2 Original User Inputs & Provenance Metadata (20 Parameters)

All 20 input parameters from the V2 contract are captured losslessly into a structured, queryable schema:

| Domain | Request Field | Target Storage Column | Data Type | Constraint / Safeguard |
| :--- | :--- | :--- | :---: | :--- |
| **Location** | `state` | `state` | `TEXT` | **Mandatory**. Non-empty string. |
| **Location** | `district` | `district` | `TEXT` | Optional. Nullable. |
| **Temporal** | `sowing_month` | `sowing_month` | `INTEGER` | **Mandatory**. Bounded `1`–`12`. Never defaults to calendar month. |
| **Temporal** | `season` | `season` | `TEXT` | Optional user override or auto-derived season. |
| **Climate & Water**| `irrigation_access` | `irrigation_access` | `TEXT` | Supported enum or `null` (UNKNOWN). Never defaults to rainfed. |
| **Climate & Water**| `irrigation_depth_mm` | `irrigation_depth_mm` | `NUMERIC` | Positive finite number or `null`. |
| **Climate & Water**| `irrigation_period_days`| `irrigation_period_days`| `INTEGER` | **Whole days (`> 0`)** or `null`. |
| **Climate & Water**| `seasonal_rainfall_amount`| `seasonal_rainfall_amount`| `NUMERIC` | **Lifecycle moisture**. Strictly separated from annual rainfall. |
| **Climate & Water**| `annual_rainfall` | `annual_rainfall` | `NUMERIC` | **Macro-climatic annual**. Never conflated with seasonal rainfall. |
| **Climate & Water**| `temperature` | `temperature` | `NUMERIC` | Mean temperature (°C) or `null`. Zero preserved. |
| **Climate & Water**| `humidity` | `humidity` | `NUMERIC` | Relative humidity (%) or `null`. Zero preserved. |
| **Climate & Water**| `temperature_min_night`| `temperature_min_night`| `NUMERIC` | Thermal night stress (°C) or `null`. |
| **Climate & Water**| `temperature_max_day` | `temperature_max_day` | `NUMERIC` | Thermal day stress (°C) or `null`. |
| **Edaphic** | `has_soil_test` | `has_soil_test` | `BOOLEAN` | **Farmer-Declared SHC**. Conveys `USER_DECLARED` only; does not infer lab certification. |
| **Edaphic** | `soil_texture` | `soil_texture` | `TEXT` | Texture enum or `null`. No fabricated default. |
| **Edaphic** | `soil_ph` | `soil_ph` | `NUMERIC` | Bounded `2.0`–`12.0` or `null`. |
| **Edaphic** | `nitrogen` | `nitrogen` | `NUMERIC` | Non-negative number (`kg/ha`) or `null`. Zero preserved. |
| **Edaphic** | `phosphorus` | `phosphorus` | `NUMERIC` | Non-negative number (`kg/ha`) or `null`. Zero preserved. |
| **Edaphic** | `potassium` | `potassium` | `NUMERIC` | Non-negative number (`kg/ha`) or `null`. Zero preserved. |
| **Edaphic** | `organic_carbon` | `organic_carbon` | `NUMERIC` | Bounded `0.0`–`10.0%` or `null`. Zero preserved. |
| **Edaphic** | `nutrient_basis` | `nutrient_basis` | `TEXT` | Explicitly selected basis or `null`. Never defaulted to SHC. |

---

### 2.3 Comprehensive Recommendation & Agronomic Diagnostics

| Engine Output Domain | Contract JSON Field | Target Column / Document | Storage Semantics & Invariants |
| :--- | :--- | :--- | :--- |
| **Top Recommended Crop** | `recommendations[0].crop` | `top_crop` | Relational string column (`TEXT NULL`). Fast indexing. `NULL` if status $\ne$ `SUCCESS`. |
| **Top Suitability Score** | `recommendations[0].suitability_score` | `top_suitability_score` | Relational numeric column (`NUMERIC(5,2) NULL`). Fast indexing. Liebig score `0.0`–`100.0`. |
| **Top Confidence Tier** | `recommendations[0].confidence_tier` | `top_confidence_tier` | Relational text column (`TEXT NULL`). E.g. `'MODERATE_ESTIMATED'`. |
| **Full Recommendation List** | `recommendations` | `recommendations` | Full array stored in `JSONB NOT NULL`. Preserves rank, limiting factors, yield ranges, and rationales for all evaluated crops. |
| **Yield Range** | `crop.yield_range_tonnes_per_ha` | Stored in `recommendations` JSONB | **Preserved strictly as `[min, max]` tuple in tonnes/ha**. Never collapsed into a single point yield. |
| **Water Assessment** | `crop.water_assessment` | Stored in `recommendations` JSONB | Stores gross irrigation, USDA-SCS effective rainfall, crop water requirement ($ET_c$), moisture surplus/deficit, and stress flags. |
| **Nutrient Prescription** | `crop.nutrient_prescription` | Stored in `recommendations` JSONB | Stores baseline RDF (N, $P_2O_5$, $K_2O$), stoichiometric commercial fertilizer quantities (Urea, DAP, MOP), application timing, and warning banner. |
| **Excluded Candidates** | `excluded_candidates` | `excluded_candidates` | Array stored in `JSONB NOT NULL`. Preserves all eliminated crops with physiological failure reasons (thermal, moisture, pH, or temporal window). |
| **Agronomic Diagnostics** | `diagnostics` | `diagnostics` | Object stored in `JSONB NOT NULL`. Contains missing parameters list, severe soil alkalinity/acidity warnings, and land reclamation guidance. |

---

## 3. Mandatory Semantic Safeguards (8 Rules)

To prevent data corruption and maintain strict agronomic rigor, every storage implementation must adhere to the following eight rules:

### Safeguard 1: Never Store V2 Suitability Score in the V1 Confidence Field
- **Rationale**: V1 confidence represents a heuristic Gaussian statistical probability (`35%`–`100%`). V2 suitability score represents a Liebig-calibrated multi-factorial agronomic compatibility rating (`0`–`100`). Overloading the V1 confidence column corrupts historical statistics, breaks legacy machine learning models, and creates false perceptions of statistical certainty.
- **Enforcement**: V2 suitability score must be stored in a dedicated `top_suitability_score` column and within `recommendations` JSONB. The V1 `confidence` column in `crop_predictions` remains untouched.

### Safeguard 2: Never Convert a Yield Range into a Point Yield
- **Rationale**: Biological crop yields vary widely based on micro-climate, management practices, and seasonal weather. The frozen V2 engine deliberately returns conservative yield ranges `[min, max] t/ha` based on ICAR/DES benchmark datasets. Collapsing a range into an arithmetic mean (e.g. `[3.0, 5.0]` into `4.0 t/ha`) creates a false promise of production to the farmer.
- **Enforcement**: Storage schemas must persist yield ranges as a 2-element numeric array `[min, max]`. Single numeric yield columns are prohibited.

### Safeguard 3: Never Store V2 Results as if They Were V1 Predictions
- **Rationale**: V1 records have different schemas, different assumptions, and different downstream consumers. Mixing V1 and V2 records in the same unversioned table causes downstream consumers (like `farmIntelligenceService`) to misparse payloads or crash.
- **Enforcement**: V2 results must be isolated in a dedicated storage entity (`v2_crop_recommendations`) and client storage key (`cropswild_v2_recommendation_last`).

### Safeguard 4: Never Label User-Declared Soil Tests as Independently Verified
- **Rationale**: A farmer checking `"I have a Soil Health Card / Soil Test Report"` provides farmer-declared data (`USER_DECLARED`). Under the frozen engine's DCI provenance framework, independent laboratory verification requires a cryptographically signed verification record.
- **Enforcement**: The database must persist `has_soil_test` as a boolean flag, and provenance metadata must record `USER_DECLARED`. It must never write `INDEPENDENTLY_VERIFIED` to the confidence tier.

### Safeguard 5: Never Claim Verified STCR Calibration
- **Rationale**: The frozen engine currently operates with zero approved STCR field calibrations (`_APPROVED_CALIBRATIONS = {}`). Fertilizer prescriptions are calculated via baseline RDF arithmetic.
- **Enforcement**: Fertilizer storage records must explicitly label prescriptions as `Baseline RDF (Farmer-Declared)` and must never persist claims of verified STCR fertilizer calibration.

### Safeguard 6: Never Replace Unknown Values with Defaults
- **Rationale**: If a user does not provide soil texture, pH, or nutrients, inserting arbitrary defaults (e.g. Loam, pH 6.8, N 80) corrupts the historical agronomic record and prevents future audits from identifying data quality gaps.
- **Enforcement**: Unsupplied parameters must be stored strictly as SQL `NULL`.

### Safeguard 7: Never Infer Annual Rainfall to be Seasonal Rainfall
- **Rationale**: `farmProfile.conditions.rainfall` represents annual precipitation (typically 800–2500 mm). A single crop lifecycle occurs over 3–5 months. Storing annual rainfall in place of seasonal moisture inflates water availability 2–4x, distorting water balance accounting.
- **Enforcement**: The schema defines independent columns `seasonal_rainfall_amount` and `annual_rainfall`. If seasonal rainfall was not measured, it must remain `NULL`.

### Safeguard 8: Never Overwrite Existing V1 Prediction History
- **Rationale**: Historical farm data has legal and operational value for tracking past farm decisions and comparing recommendations over time.
- **Enforcement**: V2 persistence operates as an append-only log in a dedicated table, with zero updates or deletions targeting `crop_predictions`.
