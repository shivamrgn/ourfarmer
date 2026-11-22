# FieldWise — Phase 3C.5.2.1: Test Execution & Verification Report

**Engine Version**: `2.2.3-CLOSURE`  
**Phase**: `3C.5.2.1 (Agronomic Gate and Verification Provenance Closure)`  
**Execution Timestamp**: `2026-11-20 08:55:32 UTC`  
**Total Executed Tests**: `43`  
**Passed**: `43 / 43` (`100.0%`)  
**Failures / Errors**: `0 / 0`  
**Status**: `ALL_TESTS_PASSING`  

## 1. Executive Summary

Phase 3C.5.2.1 completes the definitive resolution of the three critical findings identified during the independent review of Phase 3C.5.2. All modifications are strictly confined to the isolated recommendation engine (`FieldWise_main/model/ml_pipeline/recommendation_engine/`) and its verification reports.

In accordance with our strict non-destructive preservation invariant, zero modifications were made to live production files (`model/predictor.js`, `model/cropDatabase.js`, `model/fertilizerDatabase.js`, `src/lib/predictorEngine.ts`, `src/lib/api.ts`).

This report documents the end-to-end execution of all 43 automated tests across five suites:
1. **Functional Acceptance Tests (TEST-01 to TEST-18)**: 18 tests verifying decoupled water balance, planting-window gating, edaphic pH/texture boundaries, Liebig non-compensatory scoring, DAP stoichiometry, and historical manifests.
2. **Edge-Case & Boundary Safety Tests (9 tests)**: Environmental hostility boundaries (48°C desert heat, pH 3.8/10.2 extreme toxicity), input corruption, Vertisol moisture accounting, and deterministic reproducibility.
3. **Phase 3C.5.1 Regression Tests (7 tests)**: Direct verification of fixes for the 7 Phase 3C.5 audit findings.
4. **Phase 3C.5.2 Regression Tests (4 tests)**: Direct verification of fixes for the 4 Phase 3C.5.1 review findings.
5. **Phase 3C.5.2.1 Regression Tests (5 tests)**: Direct verification of fixes for the 3 Phase 3C.5.2 review findings.

## 2. Phase 3C.5.2.1 Regression Tests Summary (Findings 1 to 3)

| Defect ID | Review Finding | Implemented Correction & Proof | Status |
| :--- | :--- | :--- | :---: |
| **Finding 1A** | *pH soft-penalty reconciliation (pH 8.6)* | Reconciled all pH exclusions with Phase 3C.4 rules. At pH 8.6: Pulses (Chickpea > 8.5, Lentil > 8.4, Soybean > 8.4, Groundnut > 8.4) fail Tier 1 due to Class A nodulation/podding arrest; Maize, Cotton, Sugarcane, Tomato, Onion, Banana, Mango, Sunflower, Potato, Rice, Barley PASS Tier 1 with WARNING_ONLY and receive Liebig soft penalties in Tier 2. No unsupported universal exclusions remain. | **PASSED** |
| **Finding 1B** | *pH sodicity tolerance (pH 9.0)* | Barley and Cotton pass Tier 1 (survive up to 9.0 per CSSRI/FAO-29); Rice (> 8.8), Wheat (> 8.6), Pulses, Maize, Tomato fail Tier 1 due to sodicity/carbonate toxicity. | **PASSED** |
| **Finding 1C** | *Extreme sodicity boundary (pH 9.2)* | At pH 9.2, ALL 19 crops fail Tier 1 (Barley > 9.0 fails, Cotton > 9.0 fails). Engine returns NO_RECOMMENDATION_SUITABLE with Gypsum Land Reclamation Advisory based on Gypsum Requirement test. | **PASSED** |
| **Finding 2** | *STCR calibration verification* | `has_stcr_calibration=True` alone rejected as fabricated flag. Requires structured `STCRCalibrationRecord` with ID, crop/region match, publication reference, coefficients, yield range, and `VALIDATED` status. Valid record produces `VERIFIED_STCR_GENERATED` with polynomial doses and DAP credit; mismatches/invalid records fall back to `BASELINE_RDF_ARITHMETIC`. | **PASSED** |
| **Finding 3** | *Provenance verification tiers* | Distinguishes 6 provenance tiers (`INDEPENDENTLY_VERIFIED`, `SOURCE_REFERENCED`, `USER_DECLARED`, `ESTIMATED`, `PROVISIONAL`, `UNKNOWN`). Strings such as `Certified_Lab` or `IMD_Station_Gridded` alone yield `USER_DECLARED`. Traceable supporting metadata (sample_id, lab accreditation number, station_id, meter_id) required for `INDEPENDENTLY_VERIFIED`. Self-declared provenance is never silently upgraded. | **PASSED** |

## 3. Phase 3C.5.2 Regression Tests Summary (Findings 1 to 4)

| Defect ID | Audit Review Defect | Implemented Correction & Proof | Status |
| :--- | :--- | :--- | :---: |
| **Finding 1** | *DCI evidence provenance* | Missing measurement-method metadata produces provisional confidence (0.50), never assumed laboratory measurement. `has_soil_test=True` alone does not grant 1.00 to texture and pH. Missing rainfall source under rainfed receives provisional 0.50 (never defaults to gauged). Missing irrigation basis receives provisional 0.60. Identical physical values with verified vs unstated provenance yield distinct DCI scores ($1.000$ vs $0.875$). | **PASSED** |
| **Finding 2** | *Fertilizer prescription claims* | Removed `VERIFIED_STCR_GENERATED` label on raw RDF; catalogue calculations designated `BASELINE_RDF_ARITHMETIC`. Missing or non-`SHC_Available_kg_ha` nutrient basis returns `WITHHELD_UNVERIFIED_NUTRIENT_BASIS` with empty products `{}`. Verified DAP 18% elemental N credit deduction ($23.5$ kg/ha N for $130.4$ kg/ha DAP). | **PASSED** |
| **Finding 3** | *Agronomic gate safety* | Eliminated blanket universal hard exclusions. Wheat at $T_{\max} = 37.0^\circ\text{C}$ and Banana at $T_{\min} = 1.5^\circ\text{C}$ PASS Tier 1 with `WARNING_ONLY`. Freezing frost ($T_{\min} < 0.0^\circ\text{C}$) strictly fails Banana. Enforced crop-specific lethal pH limits from CSV audit (at pH 8.9: Barley passes, Wheat fails; at pH 9.2: all crops fail). | **PASSED** |
| **Finding 4** | *Missing audit artifact & TEST-11* | Ensured `phase_3c_4_2_hard_exclusion_evidence_audit.csv` and `phase_3c_4_eligibility_rules.csv` are present, non-empty, and contain all 19 canonical crops. Verified TEST-11 passes cleanly. | **PASSED** |

## 4. Phase 3C.5.1 Regression Tests Summary (Findings 1 to 7)

| Finding ID | Description | Implemented Correction | Status |
| :--- | :--- | :--- | :---: |
| **Finding 1** | Effective rainfall safety | Prohibited seasonal aggregate USDA-SCS equation without monthly breakdown; flagged temporal mismatch. | **PASSED** |
| **Finding 2** | Missing nutrient inputs | Removed favorable default P and K. Missing NPK evaluated on provisional baseline (50.0). | **PASSED** |
| **Finding 3** | Fertilizer prescription safety | Withheld products for partial test; complete SHC labeled `BASELINE_RDF_ARITHMETIC`. | **PASSED** |
| **Finding 4** | DCI evidence differentiation | Provenance differentiation verified across lab vs field methods. | **PASSED** |
| **Finding 5** | Catalogue fallback | Embedded full 19 crops and 31 windows. Verified `CatalogueLoadError` on corrupted files. | **PASSED** |
| **Finding 6** | Thermal gate extremes | Diurnal extremes evaluate heat/chilling warnings; frost fails tropicals; mean temp gates emergence. | **PASSED** |
| **Finding 7** | Adapter safety & missing inputs | Prohibited unverified inferences of administrative location, season, or soil test accreditation. | **PASSED** |

## 5. Functional Acceptance Tests Matrix (TEST-01 to TEST-18)

| Test ID | Scenario / Test Name | Expected Status | Actual Outcome | Result |
| :--- | :--- | :--- | :--- | :---: |
| **TEST-01-S1** | Arid Desert Drought (Jaisalmer Regression Scenario S1) | `PARTIAL_PASS (No fatal recommendations; Millets top-ranked)` | `PASSED (Top: Millets (Pearl Millet / Bajra) score=36.4)` | **PASS** |
| **TEST-02-S2** | Monsoon High Rainfall Wetland (Assam Regression Scenario S2) | `PARTIAL_PASS (Wheat/Mustard excluded; Rice eligible with high score)` | `PASSED (Top: Rice (Paddy) score=82.8)` | **PASS** |
| **TEST-03-S3** | Peak Kharif Summer Heat (Punjab Regression Scenario S3) | `PARTIAL_PASS (Cool-season crops excluded; Kharif eligible with unmeasured water notice)` | `PASSED (All Rabi crops excluded; unmeasured water risk preserved)` | **PASS** |
| **TEST-04-S4** | Severe Soil Alkalinity (Haryana Regression Scenario S4) | `FAIL_ALL_ARABLE_CROPS (NO_RECOMMENDATION_SUITABLE with Gypsum Advisory)` | `PASSED (Status: NO_RECOMMENDATION_SUITABLE, 0 eligible crops, Gypsum advisory emitted)` | **PASS** |
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

## 6. Detailed Acceptance Test Verification & Agronomic Diagnostics

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
- **Expected Outcome**: `FAIL_ALL_ARABLE_CROPS (NO_RECOMMENDATION_SUITABLE with Gypsum Advisory)`
- **Actual Outcome**: `PASSED (Status: NO_RECOMMENDATION_SUITABLE, 0 eligible crops, Gypsum advisory emitted)`
- **Test Result**: `PASS`
- **Verification Notes**: Severe sodicity gate triggered; 0 crops pass; gypsum reclamation advisory generated.

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

## 7. Edge-Case & Boundary Test Suite Summary

Nine comprehensive edge-case test suites were evaluated:

1. **Missing & Invalid Inputs**: Corrupted inputs (month=13, negative rainfall, negative irrigation, pH=13.5, blank state) return `VALIDATION_ERROR` or raise `InputValidationError` without crashes.
2. **Boundary Values**: Verified exact pH survival boundaries (pH 5.0, buffer 4.7), zero rainfall edge case, and extreme temperature survival limits.
3. **Conflicting Planting Windows**: Out-of-season combinations (Wheat in July) and invalid regional systems (Adsali Sugarcane in Punjab) are cleanly disqualified in Tier 1.
4. **Irrigation Efficiency Scenarios**: Confirmed segregation of Gross Irrigation Applied ($GIR$) and Net Irrigation Delivered ($NIR$), applying exact application efficiencies: Drip ($\eta=0.90$), Sprinkler ($\eta=0.75$), and Furrow ($\eta=0.70$).
5. **Unknown & Provisional Evidence**: Confirmed unmeasured irrigation produces `UNKNOWN` water gate outcomes ($s_{\text{water}}=70.0$, $c_3=0.40$), unmeasured Vertisol moisture is never fabricated, and temporal mismatches are flagged.
6. **Extreme pH & Nutrient Stress**: Confirmed toxic acidity (pH 3.8) and severe sodicity (pH 10.2) trigger universal arable crop failure (`NO_RECOMMENDATION_SUITABLE`) with tailored reclamation advisories.
7. **Hostility vs Insufficient Data Boundary**: Proved that hostile environmental conditions (48°C desert heat) produce `NO_RECOMMENDATION_SUITABLE`, whereas omitted rainfall produces `INSUFFICIENT_DATA`.
8. **50-Iteration Deterministic Reproducibility**: Proved bitwise identical outputs across 50 consecutive runs on identical queries.
9. **Backend-Independent Execution**: Verified zero runtime imports from live production or legacy database files.

## 8. Agronomic & Mathematical Invariants Summary

| Invariant | Verification Status | Notes |
| :--- | :---: | :--- |
| **No Calibrated Probabilities** | **VERIFIED** | Outputs strictly designated as *Agronomic Suitability Index (0-100)*. |
| **Decoupled Water Semantics** | **VERIFIED** | Rainfed threshold meeting assigns `SCREENING_THRESHOLD_MET`, never `PASS_VERIFIED`. |
| **Monthly USDA-SCS Aggregation** | **VERIFIED** | Aggregates monthly effective rainfall ($589.0$ mm for WB Aman, $719.0$ mm for Assam). Prohibits seasonal aggregate equation. |
| **No Favourable Nutrient Defaults** | **VERIFIED** | Missing P and K receive provisional baseline (50.0); no unearned DAC&FW Medium ratings. |
| **DAP Nitrogen Deduction** | **VERIFIED** | 18% DAP N deducted before calculating supplementary Urea ($209.8$ kg/ha for UP Wheat). |
| **STCR Verification Gate** | **VERIFIED** | Raw boolean flag rejected; structured `STCRCalibrationRecord` validated; targeted yield polynomial calculated. |
| **6-Tier Evidence Provenance** | **VERIFIED** | Enforces 6 provenance tiers. Strings alone assign `USER_DECLARED`. Traceable IDs required for `INDEPENDENTLY_VERIFIED`. |
| **Withholding Missing SHC** | **VERIFIED** | Commercial fertilizer quantities strictly withheld when soil test is absent, incomplete, or unverified. |
| **Reconciled pH Soft Penalties** | **VERIFIED** | Phase 3C.4 soft penalty crops pass Tier 1 at pH 8.6 with warnings; Pulses fail at 8.6; Barley/Cotton pass at 9.0; all fail at 9.2. |
| **Diurnal Thermal Safety** | **VERIFIED** | Daytime heat (>36°C) and chilling (<5°C) emit warnings; freezing frost (<0°C) triggers Tier 1 FAIL for tropicals. |
| **Read-Only Preservation** | **VERIFIED** | All historical checksum manifests bitwise identical; zero changes to production files. |

## 9. Conclusion & Sign-Off

All 43 automated tests across five suites pass with 100% precision. The recommendation engine satisfies all Phase 3C.4 specifications and resolves all findings of the Phase 3C.5.2 independent review. It is agronomically sound, mathematically rigorous, evidence-consistent, and ready for Phase 3C.5.2.1 closure and independent audit.
