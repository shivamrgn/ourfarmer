# FieldWise — Phase 3C.6.1.3: Integration Risks, Provenance Audit, and Modification Inventory

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_1_risks_and_open_questions.md`  
**Phase**: 3C.6.1.3 Final Safety Amendment (Read-Only)  
**Execution Mode**: READ-ONLY Architectural Analysis  
**Date**: November 2026  
**Status**: APPROVED RECONCILED RISK & INVENTORY SPECIFICATION  

---

## 1. Verified Source Findings vs. Assumptions

In accordance with Phase 3C.6.1.3 directives, the table below explicitly delineates which findings are verified from actual inspected source code and which represent operational assumptions.

| Finding / Architectural Element | Status | Supporting Source Reference | Details / Verification Notes |
| :--- | :--- | :--- | :--- |
| **V1 Express Route & Validator Rules** | **VERIFIED** | `FieldWise_main/backend/src/routes/predict.js`, L13–27 | Validates 8 numeric fields with `express-validator`. Does not validate `state` or `sowing_month`. |
| **V1 Controller & Predictor Invocation** | **VERIFIED** | `FieldWise_main/backend/src/controllers/predictController.js`, L7, 32–48 | Extracts 9 fields, directly invokes legacy `predictCrops()`, returns 4-field JSON response. |
| **Legacy Gaussian Scoring & 35% Cut-off** | **VERIFIED** | `FieldWise_main/model/predictor.js`, L77–146 | Normalizes raw score to 0–100, computes synthetic yield multiplier, filters `confidence > 35`. |
| **Legacy Crop Database (16 Crops)** | **VERIFIED** | `FieldWise_main/model/cropDatabase.js`, L1–261 | Static database of 16 crops with baseline ranges and single yield constants. |
| **Legacy Fertilizer Recipes** | **VERIFIED** | `FieldWise_main/model/fertilizerDatabase.js`, L1–92 | Static string arrays per crop with fixed doses (e.g. Rice -> Urea 100–120 kg/ha). |
| **Silent Offline Fallback on 5xx Errors** | **VERIFIED** | `FieldWise_main/src/lib/api.ts`, L68–81 | Catches 5xx / connection failures and silently runs client-side `predictCropsEngine`. |
| **Client-Side Predictor Clone** | **VERIFIED** | `FieldWise_main/src/lib/predictorEngine.ts`, L1–490 | Complete in-browser TypeScript clone of the legacy Gaussian predictor. |
| **Frontend Form State & Slider Defaults** | **VERIFIED** | `FieldWise_main/src/components/modules/CropRecommendation.tsx`, L48–125 | Captures 9 inputs. Pre-fills default values (NPK 80-50-50, pH 6.5, rain 150) if storage empty. |
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

## 2. Technical and Architectural Risks

### 2.1 Sowing Month Dropdown Unselected by Default
- **Risk Level**: HIGH
- **Description**: Sowing month must start unselected and require explicit farmer input. If a user attempts to submit without making a selection, form submission must be prevented.
- **Mitigation**:
  - Add clear validation styling to the Sowing Month dropdown (red border + descriptive helper text when submission is attempted without selection).
  - Provide a clear helper tooltip: *"Planned sowing month is required to match your local agricultural season and crop planting windows."*

### 2.2 Reconciled Fallback Behavior (Surfacing 5xx Errors)
- **Risk Level**: MEDIUM
- **Description**: In the legacy client (`src/lib/api.ts`), backend 5xx errors were silently swallowed by executing `predictCropsEngine` client-side. Surfacing 5xx errors directly will make backend service disruptions visible to users.
- **Mitigation**:
  - The backend bridge service will be thoroughly tested against malformed JSON and timeouts to prevent 5xx crashes.
  - When a genuine 5xx error occurs, the UI will display a constructive error message prompting the user to retry, rather than silently serving misleading local estimates.

### 2.3 User Declaration vs. Laboratory Verification Perception
- **Risk Level**: MEDIUM
- **Description**: Farmers checking `[ ] I have an official Soil Health Card / Lab Report` might expect `INDEPENDENTLY_VERIFIED` status. However, under the frozen engine's DCI evaluator, user checkboxes remain `USER_DECLARED` (granting `HIGH_CONFIDENCE_ESTIMATED_FERTILITY` or `MODERATE_ESTIMATED`).
- **Mitigation**:
  - The UI and API contract explicitly explain: *"Fertilizer calculations are based on farmer-declared soil-test information and entered values."*
  - It clearly notes that independent laboratory verification requires an official digital verification token.

### 2.4 Annual vs. Seasonal Rainfall Mismatch Risk
- **Risk Level**: HIGH
- **Description**: `farmProfile.conditions.rainfall` records annual average precipitation (typically 800–2500 mm). Mapping annual rainfall directly into `seasonal_rainfall_amount` corrupts water balance calculations by inflating seasonal moisture 2–4x, leading to false water-sufficiency gates and inaccurate suitability scoring. Furthermore, applying monthly empirical equations (such as USDA-SCS) to annual totals produces invalid mathematical results.
- **Mitigation**:
  - Prohibit direct mapping of `farmProfile.conditions.rainfall` into `seasonal_rainfall_amount`.
  - Preserve annual rainfall strictly as annual-period contextual data (`Annual_Estimated`).
  - Set `seasonal_rainfall_amount` to Unknown (`None`) unless a verified crop-season measurement or explicit seasonal forecast is supplied.
  - Mandate documented adapter tests verifying that annual rainfall is never passed as seasonal rainfall.

### 2.5 Frozen Engine Constructor Default Override Safety
- **Risk Level**: HIGH
- **Description**: In the frozen engine's `schemas.py`, `ClimateWaterInput(irrigation_access: Optional[str] = "None_Rainfed")` defines a constructor default of `"None_Rainfed"`. If the adapter instantiates `ClimateWaterInput` without explicitly supplying `irrigation_access`, Python automatically applies the default, silently converting omitted farmer inputs into rainfed status and violating the invariant that unselected irrigation must be treated as `UNKNOWN`.
- **Mitigation**:
  - The adapter must explicitly pass `irrigation_access=payload.get("irrigation_access", None)` during instantiation.
  - Implement and verify test case `test_adapter_omitted_irrigation_does_not_default_to_rainfed` to ensure omitted or null selections are never converted to rainfed.

### 2.6 Local Storage Durability & Client Persistence Limitations
- **Risk Level**: LOW
- **Description**: Under the approved Phase 3C.6 design, V2 recommendations are cached in browser `localStorage` while Supabase database schema migrations are deferred. Describing this mechanism as "zero data loss" creates false expectations, as browser local storage is subject to user cache clearing, device resets, or private-browsing evictions.
- **Mitigation**:
  - Accurately document that latest V2 results are stored in browser `localStorage` as an ephemeral client-side cache.
  - Explicitly state across all architecture and contract documents that browser-local storage is not cloud backup or guaranteed durable storage.

---

## 3. Open Questions for Reviewers and Stakeholders

### Question 1: Sowing Month Dropdown Presentation
- **Options**:
  - Option A: 12-month dropdown with agricultural season annotations: e.g. `"October (Rabi)"`, `"June (Kharif)"`, `"March (Zaid)"`.
  - Option B: Plain 12-month dropdown (`"January"`, `"February"`, ...).
- **Recommendation**: Option A. Adding season annotations assists farmers in choosing their planned sowing window accurately.

### Question 2: Cloud Database Schema Decision for V2 Persistence
- **Options**:
  - Option A: Defer V2 cloud persistence entirely during Phase 3C.6 (storing the latest V2 result in browser `localStorage` as an ephemeral client-side cache; not cloud backup or guaranteed durable storage), and schedule a formal database migration in Phase 4 to introduce a dedicated `crop_recommendations_v2` table.
  - Option B: Introduce an unapproved schema migration now to add JSONB or new columns to `crop_predictions`.
- **Recommendation**: Option A. Respects the read-only / zero-unapproved-migration mandate, prevents schema corruption, and preserves legacy V1 persistence intact.

---

## 4. Exact Inventory of Files Planned for Modification

The following files are strictly scheduled for creation or modification in subsequent phases. **No modifications are made in the current read-only Phase 3C.6.1.3.**

### Phase 3C.6.2: Backend Adapter and Pipeline Bridge

| File Path | Action | Planned Scope of Change |
| :--- | :--- | :--- |
| `FieldWise_main/backend/src/routes/predict.js` | **NO CHANGE** | **Untouched**. Preserves V1 route and legacy semantics 100% intact. |
| `FieldWise_main/backend/src/controllers/predictController.js` | **NO CHANGE** | **Untouched**. Preserves legacy controller and predictor invocation 100% intact. |
| `FieldWise_main/model/predictor.js` | **NO CHANGE** | **Untouched**. Preserves legacy Gaussian predictor 100% intact. |
| `FieldWise_main/model/ml_pipeline/recommendation_engine/adapter_cli.py` | **Create** | Standalone Python CLI runner script. Reads JSON query from `stdin`, executes `CropRecommendationEngine.recommend()`, serializes `RecommendationResult` to `stdout`. Completely external to frozen engine core. |
| `FieldWise_main/backend/src/services/recommendationEngineBridge.js` | **Create** | Node.js bridge service. Handles `child_process.spawn('python3', ...)`, marshals Express request into 20-field query, handles timeouts and exit codes, formats response. |
| `FieldWise_main/backend/src/routes/predictV2.js` | **Create** | Dedicated V2 Express route for `POST /api/v2/predict`. Validates V2 input contract (`sowing_month` integer 1–12, optional `irrigation_access`, `has_soil_test`). |
| `FieldWise_main/backend/src/controllers/predictV2Controller.js` | **Create** | Dedicated V2 controller invoking `recommendationEngineBridge` and returning pure V2 response contract. |
| `FieldWise_main/backend/src/server.js` | **Modify** | Mount dedicated V2 router: `app.use('/api/v2/predict', predictV2Routes)`. Preserves `/api/predict` intact. |
| `FieldWise_main/backend/.env.example` | **Modify** | Add environment configuration documentation: `USE_PHASE3C_RECOMMENDATION_ENGINE=true`, `PYTHON_EXECUTABLE_PATH=python3`. Note: `FieldWise_main/backend/.env` is strictly excluded from modification; secrets are neither read, printed, copied, nor modified. |
| `FieldWise_main/backend/src/tests/predictV2.test.js` | **Create** | Automated backend integration test suite verifying `POST /api/v2/predict` end-to-end against the Phase 3C.5 engine and verifying V1 remains intact. |

### Phase 3C.6.3: Frontend and End-to-End Integration

| File Path | Action | Planned Scope of Change |
| :--- | :--- | :--- |
| `FieldWise_main/src/components/PredictionForm.tsx` | **Modify** | Add Planned Sowing Month selector (starts unselected, 1–12); add explicit Irrigation Water Source selector (starts unselected); add Soil Health Card user declaration toggle. |
| `FieldWise_main/src/components/modules/CropRecommendation.tsx` | **Modify** | Manage new form states; enforce unselected sowing month validation; invoke V2 API (`predictApi.predictV2`); handle `NO_RECOMMENDATION_SUITABLE` reclamation advisories; save V2 to `localStorage`; defer Supabase V2 cloud sync. |
| `FieldWise_main/src/components/PredictionResults.tsx` | **Modify** | Refactor "Confidence %" to "Agronomic Suitability: XX / 100"; add Evidence Quality Badges; render neutral Reference Yield Range `[min, max] t/ha` (no midpoint point estimates); render DAP Nitrogen credit notice; add expandable "Why other crops were not recommended" accordion. |
| `FieldWise_main/src/lib/api.ts` | **Modify** | Add `predictApi.predictV2` endpoint; update TypeScript interfaces for 20-field payload and V2 response contract; stop silently catching 5xx errors; restrict offline fallback strictly to browser network disconnection (`!navigator.onLine`). |
| `FieldWise_main/src/services/farmIntelligenceService.ts` | **Modify** | Enhance `StoredCropRecommendation` parser to handle suitability score, evidence tiers, and reclamation advisories without breaking legacy widgets. |
| `FieldWise_main/src/test/integration/recommendationIntegration.test.ts` | **Create** | Frontend integration test suite verifying form submission, V2 API interaction, offline fallback, and result rendering. |
