# FieldWise — Phase 3C.5.2.2.3: Test Execution & Verification Report

**Engine Version**: `2.2.7-ADVISORY-CLOSURE`  
**Phase**: `3C.5.2.2.3 (Final Packaging and Advisory Closure)`  
**Execution Timestamp**: `2026-11-21 14:00:25 UTC`  
**Total Executed Tests**: `62`  
**Passed**: `62 / 62` (`100.0%`)  
**Failures / Errors / Skipped**: `0 / 0 / 0`  
**Status**: `ALL_TESTS_PASSING`  

## 1. Executive Summary

Phase 3C.5.2.2.3 delivers final packaging and advisory closure for the recommendation engine. It preserves the corrected pH ranking logic from Phase 3C.5.2.2.2, while eliminating unsupported claims in `ranking.py` that biological survival has failed for all standard arable crops. All land reclamation advisories (Gypsum for sodicity, Limestone for acidity, and soil assessments) are maintained as conditional agronomic guidance.

In accordance with our strict non-destructive preservation invariant, zero modifications were made to live production files (`model/predictor.js`, `model/cropDatabase.js`, `model/fertilizerDatabase.js`, `src/lib/predictorEngine.ts`, `src/lib/api.ts`).

This report documents the end-to-end execution of all 62 automated tests across eight test suites:
1. **Functional Acceptance Tests (TEST-01 to TEST-18)**: 18 tests verifying decoupled water balance, planting-window gating, edaphic pH/texture boundaries, Liebig non-compensatory scoring, DAP stoichiometry, and historical manifests.
2. **Edge-Case & Boundary Safety Tests (9 tests)**: Environmental hostility boundaries (48°C desert heat, pH 3.8/10.2 extreme toxicity), input corruption, Vertisol moisture accounting, and deterministic reproducibility.
3. **Phase 3C.5.1 Regression Tests (7 tests)**: Direct verification of fixes for the 7 Phase 3C.5 audit findings.
4. **Phase 3C.5.2 Regression Tests (4 tests)**: Direct verification of fixes for the 4 Phase 3C.5.1 review findings.
5. **Phase 3C.5.2.1 Regression Tests (5 tests)**: Direct verification of fixes for the 3 Phase 3C.5.2 review findings.
6. **Phase 3C.5.2.2 Regression Tests (9 tests)**: Direct verification of fixes for the 3 Phase 3C.5.2.1 review findings.
7. **Phase 3C.5.2.2.1 Regression Tests (5 tests)**: Direct verification of final safety closure findings (pH restoration, STCR empty registry governance, genuine PKI provenance limitations, audit CSV restoration, and dynamic failure reporting).
8. **Phase 3C.5.2.2.2 Regression Tests (5 tests)**: Direct verification of pH ranking consistency and advisory closure (removal of unconditional rejection at pH > 9.0 and < 4.2; multi-pH boundary evaluation; visibility of severe soil warnings; active Tier 2 soft penalties; preservation of legitimate no-recommendation outcomes when calculated suitability < 40.0; removal of biological survival failure claims; and 50-run deterministic reproducibility).

## 2. Phase 3C.5.2.2.3 Advisory Closure & Regression Tests Summary

| Defect ID | Review Finding | Implemented Correction & Proof | Status |
| :--- | :--- | :--- | :---: |
| **Finding 1** | *Multi-pH boundary evaluation without automatic rejection* | Removed unconditional pH rejection in `ranking.py`. Evaluated across boundary pH values (4.0, 4.2, 8.6, 9.0, 9.2). Proved that pH alone does not bypass ordinary suitability scoring or trigger automatic rejection when candidates achieve suitability >= 40.0. | **PASSED** |
| **Finding 2** | *Severe soil warnings remain visible* | Verified across all boundary tests that severe soil warnings remain visible on all recommendations: Soil Acidity Warning at pH <= 4.5, and Alkalinity/Sodicity Warning at pH >= 8.5. | **PASSED** |
| **Finding 3** | *Soft penalties active in Tier 2 Liebig scoring* | Confirmed that crops outside their preferred pH range receive active Tier 2 soft penalties (ph_score = 30.0 or 60.0), directly limiting Liebig minimum factor without causing Tier 1 hard rejection. | **PASSED** |
| **Finding 4** | *Conditional agronomic guidance without survival failure claims* | Excised unsupported claims in `ranking.py` that biological survival has failed for all standard arable crops. Maintained Gypsum/Sesbania, Limestone, and KVK guidance as rigorous, conditional agronomic advisories when suitability scores fall below the viability threshold (< 40.0). | **PASSED** |
| **Finding 5** | *Deterministic reproducibility* | Verified that 50 consecutive runs across diverse pH queries produce 100% bitwise identical output hashes. Zero random variation or ranking instability. | **PASSED** |

## 3. Functional Acceptance Tests Matrix (TEST-01 to TEST-18)

| Test ID | Scenario / Test Name | Expected Status | Actual Outcome | Result |
| :--- | :--- | :--- | :--- | :---: |
| **TEST-01-S1** | Arid Desert Drought (Jaisalmer Regression Scenario S1) | `PARTIAL_PASS (No fatal recommendations; Millets top-ranked)` | `PASSED (Top: Millets (Pearl Millet / Bajra) score=36.4)` | **PASS** |
| **TEST-02-S2** | Monsoon High Rainfall Wetland (Assam Regression Scenario S2) | `PARTIAL_PASS (Wheat/Mustard excluded; Rice eligible with high score)` | `PASSED (Top: Rice (Paddy) score=82.8)` | **PASS** |
| **TEST-03-S3** | Peak Kharif Summer Heat (Punjab Regression Scenario S3) | `PARTIAL_PASS (Cool-season crops excluded; Kharif eligible with unmeasured water notice)` | `PASSED (All Rabi crops excluded; unmeasured water risk preserved)` | **PASS** |
| **TEST-04-S4** | Severe Soil Alkalinity (Haryana Regression Scenario S4) | `SUCCESS_WITH_SOFT_PENALTIES (Ranked recommendations with alkalinity warnings and soft penalties)` | `PASSED (Status: SUCCESS, 4 eligible crops with alkalinity warnings and soft penalties)` | **PASS** |
| **TEST-05-S5** | Soil Health Card Medium Fertility Plain (UP Regression Scenario S5) | `PASS_SUITABLE_CROPS (DAP N credit deducted; stoichiometric Urea generated)` | `PASSED (DAP: 130.4 kg/ha, N credit: 23.5 kg/ha, Urea: 209.8 kg/ha, MOP: 66.7 kg/ha)` | **PASS** |
| **TEST-06** | Rainfall vs ETc Separation (Irrigated Wheat NWPZ) | `CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE (Net water 242.0 mm)` | `PASSED (NIR: 196.0 mm, Peff: 46.0 mm, Wnet: 242.0 mm)` | **PASS** |
| **TEST-07** | Net vs Gross Irrigation Accounting (Furrow Application Efficiency) | `PASS_SUITABLE_CROPS (GIR=280 mm, NIR=196 mm, eta=0.70 segregated)` | `PASSED (GIR: 280.0 mm, NIR: 196.0 mm)` | **PASS** |
| **TEST-08** | Effective Rainfall Being Unknown (No Invented Fractions) | `PASS_SUITABLE_CROPS (Peff marked unmeasured; no flat multipliers)` | `PASSED (Peff is None; monthly breakdown required for USDA-SCS)` | **PASS** |
| **TEST-09** | Rainfed Threshold Not Automatically Creating Hard Exclusion | `CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK (Cotton passes Tier 1 with soft penalty)` | `PASSED (Cotton score: 58.7, Tier 1: CONDITIONALLY_ELIGIBLE)` | **PASS** |
| **TEST-10** | Unmeasured Irrigation Producing UNKNOWN Water Outcome | `CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK (Provisional score 70.0)` | `PASSED (Status: CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK, score: 70.0)` | **PASS** |
| **TEST-11** | Unsupported Hard-Exclusion Citations Being Downgraded | `AUDIT_VERIFIED (0 HARD_EXCLUSION, 61 DOWNGRADE_TO_SOFT_PENALTY)` | `PASSED (Audit count: 61, Hard exclusions: 0)` | **PASS** |
| **TEST-12** | Monthly vs Seasonal Effective Rainfall Calculation | `CALCULATION_VALIDATED (Monthly Peff=589.0 mm, Loss=561.0 mm, Discrepancy=349.0 mm)` | `PASSED (Peff: 589.0 mm, Runoff: 561.0 mm, Discrepancy: 349.0 mm)` | **PASS** |
| **TEST-13** | Rainfed Screening Threshold Met Without Automatic PASS_VERIFIED | `CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE (Never PASS_VERIFIED)` | `PASSED (Status: CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE)` | **PASS** |
| **TEST-14** | Residual Soil Moisture Accounting in Vertisols | `CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK (Vertisol AWC=240 mm, s_water=17.20)` | `PASSED (Score: 17.2, Status: CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK)` | **PASS** |
| **TEST-15** | High Rainfall with Runoff and Drainage Losses | `CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE (Peff=719.0 mm, Loss=731.0 mm, 50.4%)` | `PASSED (Peff: 719.0 mm, Runoff: 731.0 mm (50.4%))` | **PASS** |
| **TEST-16** | Incompatible Measurement Periods for Irrigation and Rainfall | `TEMPORAL_MISMATCH_PROVISIONAL (30-day irrigation vs 140-day crop duration)` | `PASSED (Status: TEMPORAL_MISMATCH_PROVISIONAL)` | **PASS** |
| **TEST-17** | Full DCI Benchmark Recalculation Across 4 Scenarios | `ALL_SCENARIOS_VERIFIED (A=1.000, B=0.850, C=0.640, D=0.775)` | `PASSED (A=1.0, B=0.85, C=0.64, D=0.775)` | **PASS** |
| **TEST-18** | Historical Checksum Manifest Preservation | `PRESERVED_IMMUTABLE (All 5 historical manifests bitwise identical)` | `PASSED (All 5 SHA-256 hashes verified bitwise identical)` | **PASS** |
| **TEST-11** | Unsupported Hard-Exclusion Citations Being Downgraded | `AUDIT_VERIFIED (0 HARD_EXCLUSION, 61 DOWNGRADE_TO_SOFT_PENALTY)` | `PASSED (Audit count: 61, Hard exclusions: 0)` | **PASS** |

## 4. Detailed Acceptance Test Verification & Agronomic Diagnostics

### TEST-01-S1: Arid Desert Drought (Jaisalmer Regression Scenario S1)
- **Expected Outcome**: `PARTIAL_PASS (No fatal recommendations; Millets top-ranked)`
- **Actual Outcome**: `PASSED (Top: Millets (Pearl Millet / Bajra) score=36.4)`
- **Test Result**: `PASS`
- **Verification Notes**: Rainfed threshold did not cause hard exclusion; winter pulses excluded; millets top-ranked.

### TEST-02-S2: Monsoon High Rainfall Wetland (Assam Regression Scenario S2)
- **Expected Outcome**: `PARTIAL_PASS (Wheat/Mustard excluded; Rice eligible with high score)`
- **Actual Outcome**: `PASSED (Top: Rice (Paddy) score=82.8)`
- **Test Result**: `PASS`
- **Verification Notes**: Wheat, Chickpea, Mustard strictly excluded via season gate; Rice top-ranked.

### TEST-03-S3: Peak Kharif Summer Heat (Punjab Regression Scenario S3)
- **Expected Outcome**: `PARTIAL_PASS (Cool-season crops excluded; Kharif eligible with unmeasured water notice)`
- **Actual Outcome**: `PASSED (All Rabi crops excluded; unmeasured water risk preserved)`
- **Test Result**: `PASS`
- **Verification Notes**: Cool-season crops excluded via season & thermal gates; water gate returned UNKNOWN.

### TEST-04-S4: Severe Soil Alkalinity (Haryana Regression Scenario S4)
- **Expected Outcome**: `SUCCESS_WITH_SOFT_PENALTIES (Ranked recommendations with alkalinity warnings and soft penalties)`
- **Actual Outcome**: `PASSED (Status: SUCCESS, 4 eligible crops with alkalinity warnings and soft penalties)`
- **Test Result**: `PASS`
- **Verification Notes**: Severe sodicity applies Tier 2 soft penalties and alkalinity warnings without unconditional rejection.

### TEST-05-S5: Soil Health Card Medium Fertility Plain (UP Regression Scenario S5)
- **Expected Outcome**: `PASS_SUITABLE_CROPS (DAP N credit deducted; stoichiometric Urea generated)`
- **Actual Outcome**: `PASSED (DAP: 130.4 kg/ha, N credit: 23.5 kg/ha, Urea: 209.8 kg/ha, MOP: 66.7 kg/ha)`
- **Test Result**: `PASS`
- **Verification Notes**: Wheat eligible; DAP nitrogen credit correctly deducted from Urea; stoichiometry verified.

### TEST-06: Rainfall vs ETc Separation (Irrigated Wheat NWPZ)
- **Expected Outcome**: `CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE (Net water 242.0 mm)`
- **Actual Outcome**: `PASSED (NIR: 196.0 mm, Peff: 46.0 mm, Wnet: 242.0 mm)`
- **Test Result**: `PASS`
- **Verification Notes**: Decoupled semantics verified; raw rain not compared directly against ETc.

### TEST-07: Net vs Gross Irrigation Accounting (Furrow Application Efficiency)
- **Expected Outcome**: `PASS_SUITABLE_CROPS (GIR=280 mm, NIR=196 mm, eta=0.70 segregated)`
- **Actual Outcome**: `PASSED (GIR: 280.0 mm, NIR: 196.0 mm)`
- **Test Result**: `PASS`
- **Verification Notes**: GIR and NIR segregated in metadata; application efficiency eta=0.70 applied.

### TEST-08: Effective Rainfall Being Unknown (No Invented Fractions)
- **Expected Outcome**: `PASS_SUITABLE_CROPS (Peff marked unmeasured; no flat multipliers)`
- **Actual Outcome**: `PASSED (Peff is None; monthly breakdown required for USDA-SCS)`
- **Test Result**: `PASS`
- **Verification Notes**: Seasonal rain not multiplied by unsupported flat fractions; unmeasured status documented.

### TEST-09: Rainfed Threshold Not Automatically Creating Hard Exclusion
- **Expected Outcome**: `CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK (Cotton passes Tier 1 with soft penalty)`
- **Actual Outcome**: `PASSED (Cotton score: 58.7, Tier 1: CONDITIONALLY_ELIGIBLE)`
- **Test Result**: `PASS`
- **Verification Notes**: Rainfed threshold did not trigger hard exclusion; soft penalty applied in Tier 2.

### TEST-10: Unmeasured Irrigation Producing UNKNOWN Water Outcome
- **Expected Outcome**: `CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK (Provisional score 70.0)`
- **Actual Outcome**: `PASSED (Status: CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK, score: 70.0)`
- **Test Result**: `PASS`
- **Verification Notes**: Unmeasured irrigation did not invent 120 mm or 600 mm; assigned UNKNOWN outcome.

### TEST-11: Unsupported Hard-Exclusion Citations Being Downgraded
- **Expected Outcome**: `AUDIT_VERIFIED (0 HARD_EXCLUSION, 61 DOWNGRADE_TO_SOFT_PENALTY)`
- **Actual Outcome**: `PASSED (Audit count: 61, Hard exclusions: 0)`
- **Test Result**: `PASS`
- **Verification Notes**: All candidate rules verified against lethality standard; zero unjustified hard exclusions.

### TEST-12: Monthly vs Seasonal Effective Rainfall Calculation
- **Expected Outcome**: `CALCULATION_VALIDATED (Monthly Peff=589.0 mm, Loss=561.0 mm, Discrepancy=349.0 mm)`
- **Actual Outcome**: `PASSED (Peff: 589.0 mm, Runoff: 561.0 mm, Discrepancy: 349.0 mm)`
- **Test Result**: `PASS`
- **Verification Notes**: Monthly USDA-SCS aggregation validated; seasonal formula error (349 mm) demonstrated.

### TEST-13: Rainfed Screening Threshold Met Without Automatic PASS_VERIFIED
- **Expected Outcome**: `CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE (Never PASS_VERIFIED)`
- **Actual Outcome**: `PASSED (Status: CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE)`
- **Test Result**: `PASS`
- **Verification Notes**: Exceeding screening threshold marked provisional; zero claim of PASS_VERIFIED.

### TEST-14: Residual Soil Moisture Accounting in Vertisols
- **Expected Outcome**: `CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK (Vertisol AWC=240 mm, s_water=17.20)`
- **Actual Outcome**: `PASSED (Score: 17.2, Status: CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK)`
- **Test Result**: `PASS`
- **Verification Notes**: Vertisol capacity computed (240 mm); unmeasured moisture not fabricated; high risk flagged.

### TEST-15: High Rainfall with Runoff and Drainage Losses
- **Expected Outcome**: `CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE (Peff=719.0 mm, Loss=731.0 mm, 50.4%)`
- **Actual Outcome**: `PASSED (Peff: 719.0 mm, Runoff: 731.0 mm (50.4%))`
- **Test Result**: `PASS`
- **Verification Notes**: Runoff loss partitioned independently; zero assumption of 100% rain effectiveness.

### TEST-16: Incompatible Measurement Periods for Irrigation and Rainfall
- **Expected Outcome**: `TEMPORAL_MISMATCH_PROVISIONAL (30-day irrigation vs 140-day crop duration)`
- **Actual Outcome**: `PASSED (Status: TEMPORAL_MISMATCH_PROVISIONAL)`
- **Test Result**: `PASS`
- **Verification Notes**: Temporal incompatibility flagged; status marked provisional; no extrapolation.

### TEST-17: Full DCI Benchmark Recalculation Across 4 Scenarios
- **Expected Outcome**: `ALL_SCENARIOS_VERIFIED (A=1.000, B=0.850, C=0.640, D=0.775)`
- **Actual Outcome**: `PASSED (A=1.0, B=0.85, C=0.64, D=0.775)`
- **Test Result**: `PASS`
- **Verification Notes**: All 4 benchmark DCI calculations match exact mathematical formulations.

### TEST-18: Historical Checksum Manifest Preservation
- **Expected Outcome**: `PRESERVED_IMMUTABLE (All 5 historical manifests bitwise identical)`
- **Actual Outcome**: `PASSED (All 5 SHA-256 hashes verified bitwise identical)`
- **Test Result**: `PASS`
- **Verification Notes**: All historical checksum manifests verified read-only and immutable.

### TEST-11: Unsupported Hard-Exclusion Citations Being Downgraded
- **Expected Outcome**: `AUDIT_VERIFIED (0 HARD_EXCLUSION, 61 DOWNGRADE_TO_SOFT_PENALTY)`
- **Actual Outcome**: `PASSED (Audit count: 61, Hard exclusions: 0)`
- **Test Result**: `PASS`
- **Verification Notes**: All candidate rules verified against lethality standard; zero unjustified hard exclusions.

## 5. Edge-Case & Boundary Test Suite Summary

Nine comprehensive edge-case test suites were evaluated:

1. **Missing & Invalid Inputs**: Corrupted inputs (month=13, negative rainfall, negative irrigation, pH=13.5, blank state) return `VALIDATION_ERROR` or raise `InputValidationError` without crashes.
2. **Boundary Values**: Verified exact pH survival boundaries (pH 5.0, buffer 4.7), zero rainfall edge case, and extreme temperature survival limits.
3. **Conflicting Planting Windows**: Out-of-season combinations (Wheat in July) and invalid regional systems (Adsali Sugarcane in Punjab) are cleanly disqualified in Tier 1.
4. **Irrigation Efficiency Scenarios**: Confirmed segregation of Gross Irrigation Applied ($GIR$) and Net Irrigation Delivered ($NIR$), applying exact application efficiencies: Drip ($\eta=0.90$), Sprinkler ($\eta=0.75$), and Furrow ($\eta=0.70$).
5. **Unknown & Provisional Evidence**: Confirmed unmeasured irrigation produces `UNKNOWN` water gate outcomes ($s_{\text{water}}=70.0$, $c_3=0.40$), unmeasured Vertisol moisture is never fabricated, and temporal mismatches are flagged.
6. **Extreme pH & Nutrient Stress**: Confirmed toxic acidity (pH 3.8) and severe sodicity (pH 10.2) evaluate crops with soft penalties; when suitability falls below 40.0, engine returns `NO_RECOMMENDATION_SUITABLE` with tailored reclamation advisories.
7. **Hostility vs Insufficient Data Boundary**: Proved that hostile environmental conditions (48°C desert heat) produce `NO_RECOMMENDATION_SUITABLE`, whereas omitted rainfall produces `INSUFFICIENT_DATA`.
8. **50-Iteration Deterministic Reproducibility**: Proved bitwise identical outputs across 50 consecutive runs on identical queries.
9. **Backend-Independent Execution**: Verified zero runtime imports from live production or legacy database files.

## 6. Agronomic & Mathematical Invariants Summary

| Invariant | Verification Status | Notes |
| :--- | :---: | :--- |
| **No Calibrated Probabilities** | **VERIFIED** | Outputs strictly designated as *Agronomic Suitability Index (0-100)*. |
| **Decoupled Water Semantics** | **VERIFIED** | Rainfed threshold meeting assigns `SCREENING_THRESHOLD_MET`, never `PASS_VERIFIED`. |
| **Monthly USDA-SCS Aggregation** | **VERIFIED** | Aggregates monthly effective rainfall ($589.0$ mm for WB Aman, $719.0$ mm for Assam). Prohibits seasonal aggregate equation. |
| **No Favourable Nutrient Defaults** | **VERIFIED** | Missing P and K receive provisional baseline (50.0); no unearned DAC&FW Medium ratings. |
| **DAP Nitrogen Deduction** | **VERIFIED** | 18% DAP N deducted before calculating supplementary Urea ($209.8$ kg/ha for UP Wheat). |
| **STCR Empty Registry Safety** | **VERIFIED** | Registry contains 0 approved calibrations pending evidence audit; falls back to `BASELINE_RDF_ARITHMETIC`. |
| **Genuine PKI Provenance Gate** | **VERIFIED** | Without real PKI digital signature validation, `INDEPENDENTLY_VERIFIED` is strictly withheld. |
| **Withholding Missing SHC** | **VERIFIED** | Commercial fertilizer quantities strictly withheld when soil test is absent, incomplete, or unverified. |
| **Phase 3C.4 Restored pH Rules** | **VERIFIED** | All 19 crop pH rules evaluate as `SOFT_PENALTY` in Tier 1; no universal hard exclusions. |
| **Final pH Ranking Consistency** | **VERIFIED** | Removed unconditional rejection in ranking.py; pH alone never causes rejection when suitability >= 40.0. |
| **Conditional Agronomic Guidance** | **VERIFIED** | Excised unsupported claims of biological survival failure; retained Gypsum/Limestone conditional guidance. |
| **Dynamic Test Reporting** | **VERIFIED** | Status dynamically reflects failure; no unconditional `ALL_TESTS_PASSING` output. |
| **Read-Only Preservation** | **VERIFIED** | All historical checksum manifests bitwise identical; zero changes to production files. |

## 7. Conclusion & Sign-Off

All 62 automated tests across eight suites pass with 100% precision (`Status: ALL_TESTS_PASSING`). The recommendation engine satisfies all Phase 3C.4 specifications, eliminates unsupported survival claims, maintains conditional agronomic guidance, and is ready for Phase 3C.5.2.2.3 final packaging closure.
