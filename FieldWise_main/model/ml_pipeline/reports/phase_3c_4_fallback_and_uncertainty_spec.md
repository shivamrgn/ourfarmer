# FieldWise — Phase 3C.4: Fallback & Uncertainty Handling Specification

**Specification Version**: 1.5.0-FINAL-WATER-RECONCILIATION (Phase 3C.4.2.2.1)  
**Phase**: Phase 3C.4 / Phase 3C.4.2.2.1 (Effective Rainfall and Rainfed Water Reconciliation)  
**Status**: DESIGN-ONLY SPECIFICATION (Read-Only Application Preservation Enforced)  
**Target Integration**: Future Phase 3C.5 Implementation  

---

## 1. Executive Summary

A major vulnerability uncovered in Phase 3C.3 was the **Architectural Split-Brain** between the online backend engine (`model/predictor.js`) and the client-side offline fallback engine (`src/lib/predictorEngine.ts`):
- The backend catalog had 16 crops (including Banana, Mango, Jowar; omitting Sunflower, Barley, Millets).
- The frontend catalog had 16 crops (including Sunflower, Barley, Millets; omitting Banana, Mango, Jowar).
- When a user's network connection drops, `src/lib/api.ts` silently switched to the client engine, altering available crops, shifting base yields by up to +75% (Tomato), and changing fertilizer prescriptions.
- Furthermore, neither engine defined explicit policies for missing inputs, silently treating absent data as neutral or allowing undefined variables to propagate as `NaN`.

This document establishes the **Fallback & Uncertainty Handling Specification** for FieldWise, updated in Phase 3C.4.2 to resolve all edge-case scenarios:
1. Unknown region or agro-climatic zone fallback.
2. Missing sowing date vs missing cultivation season resolution.
3. Unverified water semantics and unmeasured irrigation handling.
4. Deterministic behavior when all eligible crops have provisional status.
5. Strict separation of `NO_RECOMMENDATION_SUITABLE` from `INSUFFICIENT_DATA`.
6. Preserving 100% Single Source of Truth Parity between server and browser.

---

## 2. Dual-Engine Parity Architecture (Eliminating the Split-Brain)

To permanently resolve catalog asymmetry and divergent scoring behavior, the redesign establishes a **Single Source of Truth (SSOT)**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 SINGLE SOURCE OF TRUTH (SSOT) CONFIGURATION                 │
│                 canonical_crop_catalogue.json (All 19 Crops)                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
                    ▼                                     ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────────┐
│ ONLINE BACKEND ENGINE                 │ │ OFFLINE CLIENT-SIDE FALLBACK      │
│ (Node.js / Express Backend)           │ │ (Browser TypeScript / React)      │
│                                       │ │                                   │
│  - Imports canonical JSON             │ │  - Imports canonical JSON         │
│  - Executes Tier 1 Eligibility Gates  │ │  - Executes Tier 1 Eligibility    │
│  - Computes Tier 2 Liebig Scores      │ │  - Computes Tier 2 Liebig Scores  │
│  - Returns standardized JSON payload  │ │  - Returns identical JSON payload │
└───────────────────────────────────────┘ └───────────────────────────────────┘
```

### Parity Invariant
For any valid input payload $\mathbf{x}$:

$$\text{Backend}(\mathbf{x}) \equiv \text{FrontendFallback}(\mathbf{x})$$

The ranked list of recommended crops, suitability scores, exclusion explanations, yield projections, and fertilizer prescriptions MUST BE BITWISE IDENTICAL between the online server and offline fallback.

---

## 3. Comprehensive Missing-Data & Fallback Policies (Phase 3C.4.2)

The engine enforces explicit, non-compensatory deterministic policies for every data gap scenario:

| Data Gap Scenario | Engine Handling Behavior | Output Confidence & Status | User-Facing Warning / Advisory Banner |
| :--- | :--- | :---: | :--- |
| **1. Unknown Region or Agro-Climatic Zone** | 1. If `district` is unknown but `state` is recognized, falls back to state macro-climatic baseline windows.<br>2. If `state` is unrecognized or outside India, halts with validation error.<br>3. Reduces $DCI$ by $0.10$. | `PROVISIONAL` | *"District not recognized; state agro-climatic zone defaults applied. Local micro-climates may vary."* |
| **2. Season Provided, Sowing Date Missing** | 1. Automatically resolves sowing date to mid-month (15th) of season's primary planting month.<br>2. Evaluates timely vs late planting window boundaries.<br>3. Does not halt. | `VERIFIED_MID_MONTH` | *"Sowing date resolved to mid-month for regional window evaluation."* |
| **3. Sowing Date Provided, Season Missing** | 1. Automatically derives `broad_season` from state agricultural calendar based on date.<br>2. Evaluates specific regional planting system. | `VERIFIED` | *"Cultivation season automatically derived from intended sowing date."* |
| **4. Both Sowing Date and Season Missing** | 1. System cannot evaluate phenological timing or thermal emergence.<br>2. **HALTS IMMEDIATELY** before scoring.<br>3. Returns `INSUFFICIENT_DATA`. | `INSUFFICIENT_DATA` | *"Validation Error: Intended sowing month or cultivation season is required to evaluate biological feasibility."* |
| **5. Unverified Water Semantics / Unmeasured Irrigation** | 1. **Zero flat water numbers assumed** (no flat 120 mm, no flat 600 mm; no invented effective rainfall).<br>2. Rainfed screening thresholds NEVER cause Tier 1 FAIL; seasonal rain $\ge$ threshold sets `SCREENING_THRESHOLD_MET` (never automatic `PASS_VERIFIED`); seasonal rain $<$ threshold produces `WATER_DEFICIT_WARNING` and triggers Tier 2 Liebig `SOFT_PENALTY`.<br>3. If natural rain $<$ threshold, but irrigation present and unmeasured ($I = \text{null}$): evaluated as `UNKNOWN` / `CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK`.<br>4. When $P_{\text{eff}}$ is estimated via monthly USDA-SCS aggregation, status is `CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE`.<br>5. Universal water hard exclusions strictly prohibited. | `CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK` | *"Irrigation infrastructure indicated, but delivered volume is unmeasured. Water sufficiency is estimated; verify local discharge before sowing."* |
| **6. Missing Monthly Rainfall Distribution (Seasonal Only)** | 1. If user supplies only seasonal rainfall aggregate without monthly breakdown, USDA-SCS formula CANNOT be evaluated.<br>2. Direct application of USDA-SCS to seasonal total is prohibited.<br>3. Effective rainfall marked `UNKNOWN`; status assigned `CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK`. | `CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK` | *"Monthly rainfall distribution not provided. Effective root-zone rainfall cannot be calculated; water balance is provisional. Enter monthly rainfall for precision advisory."* |
| **7. Unmeasured Residual Soil Moisture** | 1. For post-monsoon rainfed crops (e.g. Chickpea, Rabi Sorghum), engine does NOT invent soil storage.<br>2. Low rainfall produces `WATER_DEFICIT_WARNING` on rainfall alone, resulting in `CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK`.<br>3. Does NOT cause Tier 1 FAIL. | `CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK` | *"In-season rainfall is below screening benchmark. Crop depends on deep soil profile moisture; test root-zone moisture or apply protective irrigation."* |
| **8. Annual Rainfall Entered Instead of Seasonal** | 1. If `rainfall_period_type = 'Annual_Normal'`, engine does NOT apply flat 75% multiplier.<br>2. Flags temporal period uncertainty.<br>3. Prompts user to supply season-specific precipitation. | `PROVISIONAL_PERIOD` | *"Rainfall entered as Annual Normal. Seasonal water availability estimated with reduced confidence; enter crop-season rainfall for precision advisory."* |
| **9. Missing Soil Health Card NPK** | 1. Assigns neutral Medium rating ($s_{\text{nutrients}} = 70.0$).<br>2. Decrements Data Completeness Index ($c_6 = 0.00 \implies DCI \le 0.850$).<br>3. Restricts fertilizer output to general extension package (no fabricated commercial bag prescriptions). | `ESTIMATED_FERTILITY` | *"No soil test provided. Nutrient suitability estimated using regional baseline. Perform a Soil Health Card test for precision advisory."* |
| **10. Physical Out-of-Bounds Inputs** | 1. Gateway schema validator halts execution before recommendation engine runs.<br>2. Returns HTTP 422 with descriptive validation error. | `INVALID_INPUT_HALT` | *"Validation Error: Input values fall outside physically possible agricultural limits."* |

---

## 4. Candidate Sets Where All Eligible Crops Are Provisional

When the user query lacks critical precision (e.g. unmeasured irrigation quantity, state-level regional fallback, or crops whose local planting windows have not been confirmed in ICAR trials):
1. **Tier 2 Ranking Proceeding**: The engine ranks all candidates meeting Tier 1 survival gates using the non-compensatory Liebig geometric formula.
2. **Provisional Set Flagging**: The entire recommendation set is flagged with status:
   $$\textbf{recommendation\_status: 'PROVISIONAL\_EVALUATION'}$$
3. **Certainty Restrictions**:
   - No crop in the result set may display a `HIGH_CONFIDENCE` or `PRODUCTION_READY` badge.
   - All recommendation cards are styled with an orange provisional border.
4. **Mandatory Advisory Banner**:
   The response payload and UI must render a prominent advisory:
   > ⚠️ **Provisional Candidate Set Notice**: All recommended crops have provisional status because one or more critical inputs (e.g. volumetric irrigation water or verified district planting window) are unmeasured or estimated. Verify local borewell discharge and consult your district Krishi Vigyan Kendra (KVK) before investment.

---

## 5. Deterministic Boundary: NO_RECOMMENDATION_SUITABLE vs INSUFFICIENT_DATA

The redesign establishes a sharp, unambiguous separation between environmental hostility and input data inadequacy:

### 5.1 Boundary Matrix

```
┌──────────────────────────────────────┬──────────────────────────────────────┐
│ STATUS: NO_RECOMMENDATION_SUITABLE   │ STATUS: INSUFFICIENT_DATA            │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 1. All required inputs are VALID     │ 1. Essential inputs are MISSING,     │
│    and complete.                     │    contradictory, or uncalibrated.   │
│ 2. The physical environment is       │ 2. The biological viability of crops │
│    genuinely hostile:                │    CANNOT be determined.             │
│    - Extreme heat (48°C)             │ 3. Sowing timing unknown; or         │
│    - Severe sodicity (pH > 8.8)      │    rainfall low and irrigation access│
│    - Toxic soil acidity (pH < 4.5)   │    completely omitted.               │
│    - Hyper-arid rainfed drought      │ 4. System halts before scoring;      │
│ 3. All 19 crops disqualified by      │    prompts the farmer for missing    │
│    Tier 1 biological gating or score │    agricultural parameters.          │
│    < 40.0.                           │                                      │
│ 4. System protects farmer from       │                                      │
│    catastrophic investment loss;     │                                      │
│    outputs land reclamation advice.  │                                      │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### 5.2 Standard Rejection Payload Contract (`NO_RECOMMENDATION_SUITABLE`)

```json
{
  "status": "NO_RECOMMENDATION_SUITABLE",
  "data_completeness_index": 0.95,
  "message": "Current agro-climatic and soil conditions do not support commercial cultivation for any of the 19 canonical field crops.",
  "primary_limiting_constraints": [
    {
      "factor": "Soil Reaction (pH)",
      "observed_value": 9.2,
      "tolerable_range": [5.0, 8.5],
      "agronomic_advisory": "Severe alkalinity prevents nutrient uptake and root nodulation. Apply agricultural gypsum and organic green manure before cropping."
    },
    {
      "factor": "Water Availability",
      "observed_value": "40 mm (Rainfed)",
      "tolerable_range": [250, 2000],
      "agronomic_advisory": "Rainfall is inadequate for commercial cropping without assured irrigation access."
    }
  ],
  "recommendations": []
}
```

### 5.3 Standard Data Inadequacy Contract (`INSUFFICIENT_DATA`)

```json
{
  "status": "INSUFFICIENT_DATA",
  "data_completeness_index": 0.45,
  "message": "Critical agronomic parameters are missing. A reliable recommendation cannot be generated without essential crop-timing and water context.",
  "missing_parameters": [
    {
      "field": "sowing_month",
      "reason": "Crop suitability cannot be evaluated without knowing the intended planting season."
    },
    {
      "field": "irrigation_access",
      "reason": "Rainfall (120 mm) is below rainfed threshold; irrigation status is required to determine feasibility."
    }
  ],
  "recommendations": []
}
```

---

## 6. UI Uncertainty & Transparency Display Guidelines

1. **Precision Rule**: Suitability scores are rounded to one decimal place ($84.2$, never $84.218492\%$).
2. **Naming Rule**: Suitability scores are labeled strictly as **Agronomic Suitability Index (0–100)**, never "probabilities" or "confidence percentages".
3. **Two-Dimensional Display**: Every card displays both the numerical Suitability Index and the Data Completeness Tier badge (`High Certainty`, `Moderate / Soil Estimated`, `Provisional`).
4. **Irrigation Notice**: When irrigation depth is unmeasured, display an explicit banner prompting the user to verify local borewell/canal water discharge before purchasing seed.
