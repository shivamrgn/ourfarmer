# FieldWise — Phase 3C.5.1: API Compatibility Adapter Design Specification
## Non-Destructive Integration Architecture & Epistemic Safety Rules

**Document Identifier**: `SPEC-3C-5-1-ADAPTER-v1.1.0`  
**Phase**: 3C.5.1 (Engine Safety and Evidence Integrity Corrections)  
**Status**: **DESIGN ONLY — STRICTLY INACTIVE**  
**Governing Principle**: Zero modifications to live production code (`model/predictor.js`, `model/cropDatabase.js`, `model/fertilizerDatabase.js`, `src/lib/predictorEngine.ts`, `src/lib/api.ts`).

---

## 1. Executive Summary & Purpose

The **FieldWise Phase 3C.5.1 Crop Recommendation Engine** operates with an evidence-conscious, six-domain input schema (`RecommendationQuery`) and produces a multidimensional output tuple:
`[Suitability Index (0-100), Evidence Confidence Tier, DCI Metric, Liebig Subscores, Agronomic Advisory, Stoichiometric Fertilizer Prescription]`.

In contrast, the legacy FieldWise production application (`src/lib/predictorEngine.ts`, `model/predictor.js`) historically accepted a flat eight-field input payload without provenance or uncertainty metadata:
```typescript
interface PredictionInputs {
  rainfall: number;
  temperature: number;
  humidity: number;
  soilType: string;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
}
```
and returned a naive scalar result with uncalibrated "confidence" claims:
```typescript
interface CropPredictionResult {
  crop: CropData;
  confidence: number;
  yieldPrediction: number;
  scoreBreakdown: { ... };
  fertilizers: FertilizerRec[];
}
```

This specification establishes the **API Compatibility Adapter Layer** designed to bridge between the new rule-based engine and client interfaces during future migration (Phase 3C.6+), **without modifying production files or activating the adapter during Phase 3C.5.1**.

Crucially, per Phase 3C.5.1 Finding 7, the adapter **strictly prohibits unverified inferences**: it must never invent or assume location, season, planting window, water regime, or laboratory soil test accreditation without explicit user confirmation.

---

## 2. Strict Boundary & Non-Activation Invariants

1. **Zero Production Mutation**:
   - `FieldWise_main/model/predictor.js` remains unmodified.
   - `FieldWise_main/model/cropDatabase.js` remains unmodified.
   - `FieldWise_main/model/fertilizerDatabase.js` remains unmodified.
   - `FieldWise_main/src/lib/predictorEngine.ts` remains unmodified.
   - `FieldWise_main/src/lib/api.ts` remains unmodified.
2. **Adapter Inactivity**: This adapter specification is purely architectural. No adapter middleware, proxy route, or monkey-patch is active in the live runtime.
3. **Execution Environment**: The new engine runs exclusively in its isolated Python environment under `model/ml_pipeline/recommendation_engine/`.

---

## 3. Strict Input Transformation Layer (Client → Canonical Engine)

### 3.1 Prohibition of Silent Inferences (Mandatory Safety Gates)

In earlier draft designs, convenient fallbacks were considered (such as inferring state from user profile, sowing month from system clock, rainfed cultivation from unstated irrigation, or soil-test authenticity from non-zero NPK numbers). **These heuristics violate agronomic safety and are strictly forbidden**:

| Input Dimension | Forbidden Heuristic | Required Safe Behavior | Failure Response if Missing |
| :--- | :--- | :--- | :--- |
| **Location (State & District)** | Inferring state from IP, profile, or defaulting to "All_India" | User must explicitly select State and District from verified administrative dropdown | Return `INSUFFICIENT_DATA` with field prompt: `"Select state and district"` |
| **Temporal (Month & Window)** | Inferring sowing month or season from current server clock / timestamp | User must explicitly specify planned sowing month (1–12) and broad season or planting system | Return `INSUFFICIENT_DATA` with field prompt: `"Specify intended sowing month"` |
| **Water Access Regime** | Silently assuming `"None_Rainfed"` or defaulting to full irrigation | User must explicitly select water access (`"Rainfed"`, `"Canal_Surface"`, `"Borewell"`, `"Drip"`, etc.) | Set water access to `UNKNOWN` or return `INSUFFICIENT_DATA` |
| **Rainfall Period & Volume** | Treating annual or regional rain as seasonal delivered water | User must specify measurement period (`Crop_Season_Measured` vs `Monthly_Measured` vs `Annual_Estimated`) | Return provisional status with downgraded DCI confidence |
| **Soil Test Accreditation** | Inferring `has_soil_test: true` because numbers exist in form inputs | User must explicitly assert possession of a certified Laboratory Soil Health Card (`SHC_Available_kg_ha`) | Treat NPK as unverified / provisional; withhold physical commercial fertilizer bags |
| **Extreme Temperatures** | Substituting mean temperature for missing diurnal extremes ($T_{\min}$, $T_{\max}$) | Retain extremes as `None` (unmeasured); evaluate thermal gate on mean only with unmeasured flag | Evaluate mean only; log warning that diurnal extremes are unmeasured |

---

### 3.2 Canonical Ingestion Flow

```
┌────────────────────────────────────────────────────────┐
│ Client Submission (Explicit Farmer Input)              │
│  - state: "Punjab", district: "Ludhiana"               │
│  - sowing_month: 11 (November), season: "Rabi"         │
│  - irrigation_access: "Canal_Surface"                  │
│  - rainfall: 85 mm (Crop_Season_Measured)              │
│  - temperature_mean: 19.0°C                            │
│  - temperature_min_night: 6.5°C                        │
│  - temperature_max_day: 24.0°C                         │
│  - soil_texture: "Loam" (Field_Feel_Method)            │
│  - soil_ph: 7.4 (Field_Colorimetric_Strip)             │
│  - has_soil_test: false (no lab card)                  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼  [Strict Validation & Schema Mapping]
┌────────────────────────────────────────────────────────────────────────┐
│ Canonical RecommendationQuery (v1.5.1)                                 │
│                                                                        │
│  location:                                                             │
│    state: "Punjab", district: "Ludhiana"                               │
│  temporal:                                                             │
│    sowing_month: 11, cultivation_season: "Rabi"                        │
│  climate_and_water:                                                    │
│    seasonal_rainfall_amount: 85.0                                      │
│    rainfall_period_type: "Crop_Season_Measured"                        │
│    rainfall_source: "Farmer_Estimated"                                 │
│    irrigation_access: "Canal_Surface"                                  │
│    irrigation_quantity_basis: "Estimated_Hours"                        │
│    temperature_mean: 19.0                                              │
│    temperature_min_night: 6.5                                          │
│    temperature_max_day: 24.0                                           │
│  edaphic:                                                              │
│    soil_texture: "Loam", texture_measurement_method: "Field_Feel"      │
│    soil_ph: 7.4, ph_measurement_method: "Field_Colorimetric_Strip"    │
│    has_soil_test: false                                                │
│    nutrient_basis: "Unstated"                                          │
│    soil_nitrogen: None, soil_phosphorus: None, soil_potassium: None     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Preservation of Epistemic & Execution Statuses

The adapter MUST preserve engine statuses without collapsing them into artificial certainty or generic success/failure flags:

### 4.1 Preserving Execution Statuses

1. **`SUCCESS`**: Sufficient verified or provisional data available; one or more crops pass Tier 1 and are ranked in Tier 2.
2. **`NO_RECOMMENDATION_SUITABLE`**: All candidate crops failed Tier 1 physiological gates (e.g., pH 9.2 sodicity, 48°C extreme desert heat, severe drought).
   - *Adapter Action*: Returns empty predictions array, emits explicit land reclamation or risk advisory, and alerts user that no crop can biologically succeed.
3. **`INSUFFICIENT_DATA`**: Essential primary parameters (e.g. state, sowing month, water access) are missing.
   - *Adapter Action*: Emits detailed missing field list with actionable guidance; never runs inference on invented inputs.
4. **`VALIDATION_ERROR`**: Physical impossibilities (e.g. pH -1.0, rainfall -50 mm, humidity 150%).
   - *Adapter Action*: Returns HTTP 422 with input validation error details.

### 4.2 Preserving Epistemic Confidence Tiers

The adapter maps the six-domain Data Completeness Index (DCI) directly to evidence tiers:
- **`HIGH_CONFIDENCE`** ($DCI \ge 0.850$): Complete verified lab soil test, measured water delivery, gauged rainfall.
- **`HIGH_CONFIDENCE_ESTIMATED_FERTILITY`** ($0.700 \le DCI < 0.850$): Complete climatic and edaphic data, but fertility unmeasured or regional.
- **`MODERATE_ESTIMATED`** ($0.550 \le DCI < 0.700$): Field-feel texture, colorimetric pH, estimated water.
- **`PROVISIONAL_EVALUATION`** ($0.400 \le DCI < 0.550$): Low data completeness; recommendations are provisional.

**Mandatory UI Rule**: The UI MUST present the DCI Confidence Tier alongside the Suitability Index. The Suitability Index must NEVER be described as a probability of success.

---

## 5. Output Transformation Layer (Engine → Client)

| Client Field | Canonical Source | Agronomic & Safety Safeguard |
| :--- | :--- | :--- |
| `crop_id` | `crop_id` | Direct lowercase canonical string. |
| `display_name` | `canonical_name` | Official canonical name from catalogue. |
| `suitability_index` | `suitability_score` | Range $[0, 100]$. Explicitly labeled as an Agronomic Index, NOT a statistical probability. |
| `confidence_tier` | `dci_tier` | Epistemic confidence tier (`HIGH_CONFIDENCE`, `MODERATE_ESTIMATED`, etc.). |
| `dci_score` | `dci_score` | Quantitative completeness index $[0.0, 1.0]$. |
| `tier1_status` | `tier1_status` | `ELIGIBLE`, `CONDITIONALLY_ELIGIBLE`, or `DISQUALIFIED`. |
| `water_gating_status` | `water_gating_status` | Explicit water state (e.g. `CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK`). |
| `limiting_factor` | `primary_limiting_factor` | Liebig minimum factor (e.g., `"Water Adequacy"`, `"Soil Reaction"`). |
| `fertilizer_advisory` | `fertilizer_prescription` | **Safety Guard**: If `has_soil_test=False` or incomplete NPK, physical bag quantities are WITHHELD (`status: WITHHELD_INCOMPLETE_SOIL_TEST`). Only general Pop/KVK guidelines are emitted. If verified SHC is present, stoichiometric DAP (with 18% N credit deduction) is provided. |
| `expected_yield_range` | `expected_yield_range_t_ha` | Realistic verified ICAR yield range $[Y_{\min}, Y_{\max}]$, NOT a single point prediction. |

---

## 6. Safe Missing-Input Behavior Specification

| Parameter | If Present | If Missing (Safe Fallback) | Epistemic Consequence |
| :--- | :--- | :--- | :--- |
| **State** | Validated against 28 States & 8 UTs | **HALT**: Return `INSUFFICIENT_DATA` | Engine cannot execute without administrative boundary |
| **Sowing Month** | Validated integer (1–12) | **HALT**: Return `INSUFFICIENT_DATA` | Engine cannot execute without temporal calendar |
| **Water Access** | Validated access mode | **HALT**: Return `INSUFFICIENT_DATA` | G_water cannot evaluate without access regime |
| **Rainfall** | Gross mm + period | Evaluate water balance | If rainfed and rainfall missing: `INSUFFICIENT_DATA`. If irrigated: flag rain as unmeasured ($c_3=0.0$). |
| **Irrigation Quantity** | Measured mm or m3 | If access confirmed but unmeasured, flag `CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK` | DCI irrigation confidence $c_3=0.0$; provisional score penalized |
| **Soil Texture** | Mapped texture class | Flag as `UNKNOWN`; G_soil = UNKNOWN | Texture subscore defaults to unmeasured baseline (50.0); DCI $c_4=0.0$ |
| **Soil pH** | Potentiometric value | Flag as `UNKNOWN`; G_ph = UNKNOWN | pH subscore defaults to unmeasured baseline (50.0); DCI $c_5=0.0$ |
| **NPK Soil Test** | Quantitative kg/ha | Flag as `UNKNOWN`; nutrient score defaults to baseline (50.0) | DCI $c_6=0.0$; **Physical fertilizer bags withheld** |
| **Diurnal Extremes** | $T_{\min}$, $T_{\max}$ | Evaluate thermal gate on mean temperature only | Retain extremes as `None`; log unmeasured diurnal note |

---

## 7. Migration Roadmap (Phase 3C.6 Verification Criteria)

When implementation transitions to Phase 3C.6 (Live Application Integration), the adapter must fulfill:
1. Full TypeScript typing matching `RecommendationQuery` and `RecommendationResult`.
2. Automated integration tests verifying that incomplete inputs return `INSUFFICIENT_DATA` rather than hallucinated recommendations.
3. Automated tests verifying that omitting soil test data prevents emission of commercial fertilizer bag quantities.
4. End-to-end user verification where the frontend form explicitly prompts the user for State, Sowing Month, and Water Regime before calling the backend.
