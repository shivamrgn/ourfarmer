# FieldWise — Phase 3C.4.1: Consolidated Safety Specification Correction Log

**Specification Version**: 1.1.0-CONSOLIDATED-CORRECTIONS  
**Phase**: Phase 3C.4.1 (Consolidated Safety Specification Corrections)  
**Status**: APPROVED DESIGN CORRECTION LOG (Read-Only Application Preservation Enforced)  
**Governing Authority**: FieldWise ML Pipeline Architecture & Independent Agronomic Review  

---

## 1. Executive Summary

Following the completion of the initial Phase 3C.4 redesign specification, an independent expert agronomic and architectural review identified critical vulnerabilities across 8 core dimensions:
1. Unsupported fixed water availability assumptions (120 mm partial irrigation, 600–1800 mm assured irrigation, 75% monsoon fraction).
2. Conflation of reproductive flowering heat stress with sowing-temperature hard exclusions, universal rainfall exclusions on irrigated crops, and indiscriminate Class A evidence grading.
3. Blanket fertilizer multipliers (+25% / -25%), omission of DAP Nitrogen deduction when calculating Urea, and unverified automatic commercial bag prescriptions.
4. Universal crop-season assumptions ignoring regional planting windows (timely vs late-sown wheat, Aus/Aman/Boro rice).
5. False assumption of uniform recommendation readiness across all 19 crops, taxonomic ambiguity between generic Millets and Jowar, and treating perennial orchard Mango as an annual field crop.
6. Ambiguity regarding UNKNOWN rule evaluation, score comparability with missing inputs, and the distinction between `NO_RECOMMENDATION_SUITABLE` and `INSUFFICIENT_DATA`.
7. Acceptance tests reflecting unsupported water and nutrient assumptions.
8. Hardcoded host-specific absolute paths in Python generator and validator scripts.

This document serves as the **official item-by-item correction log** demonstrating how each identified defect has been resolved in Phase 3C.4.1 without modifying any application code.

---

## 2. Item-by-Item Correction Audit Log

### Dimension 1: Water Availability Model

| Item ID | Review Finding & Defect | Root Cause in Phase 3C.4 | Phase 3C.4.1 Correction Implemented | Verification & Audit Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **CORR-WAT-01** | Unsupported fixed quantity for partial irrigation (`120 mm`). | Heuristic assumption that 2 life-saving irrigations equal 120 mm. | Completely eliminated fixed 120 mm number. If irrigation volume is unmeasured, actual depth is recorded as `null` / unmeasured. | `reports/phase_3c_4_input_contract.md` (Sec. 4.1); `scripts/generate_phase_3c_4_artifacts.py`. |
| **CORR-WAT-02** | Unsupported fixed range for assured irrigation (`600–1800 mm`). | Treating tubewell/canal infrastructure presence as guaranteed volume delivered. | Decoupled qualitative infrastructure access from measured volumetric delivery depth. | `reports/phase_3c_4_input_contract.md` (Sec. 4.2); `reports/phase_3c_4_acceptance_test_matrix.csv`. |
| **CORR-WAT-03** | Fixed annual-to-seasonal conversion fraction ($75\%$ monsoon, $15\%$ rabi). | Over-generalization of All-India summer monsoon statistics. | Removed flat conversion fractions. Engine prompts for measured seasonal rainfall; if annual provided, flags `ASSUMED_PERIOD_PROVISIONAL`. | `reports/phase_3c_4_input_contract.md` (Sec. 4.3); `reports/phase_3c_4_fallback_and_uncertainty_spec.md`. |
| **CORR-WAT-04** | Calculating effective water $W_{\text{eff}} = R + I$ when data is missing. | Aggressive imputation formula. | Mandated: Do NOT calculate effective water availability when essential data is missing. | `reports/phase_3c_4_scoring_architecture.md` (Sec. 3.1 & 4.1). |
| **CORR-WAT-05** | Universal flat rainfall exclusions on irrigated crops (e.g. Rice $\ge 800$ mm, Cotton $\ge 500$ mm). | Ignoring irrigated management reality in Punjab/Haryana/Rajasthan. | Removed universal rainfall exclusions. Low rainfall evaluated as `SOFT_PENALTY` under rainfed regime or `UNKNOWN` if irrigation is unmeasured. | `reports/phase_3c_4_eligibility_rules.csv` (RULE-RICE-WAT-01, RULE-COTTON-WAT-01). |

---

### Dimension 2: Eligibility Rules Matrix

| Item ID | Review Finding & Defect | Root Cause in Phase 3C.4 | Phase 3C.4.1 Correction Implemented | Verification & Audit Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **CORR-RUL-01** | Non-standard status strings (`Hard Exclusion`, `Soft Penalty`). | Inconsistent vocabulary in Phase 3C.4 CSV. | Strictly restricted all 100 rules to: `HARD_EXCLUSION`, `SOFT_PENALTY`, `WARNING_ONLY`, `UNKNOWN`, `NOT_APPLICABLE`. | `reports/phase_3c_4_eligibility_rules.csv`; checked by validator. |
| **CORR-RUL-02** | Growth-stage conflation: Flowering heat stress treated as sowing-temperature exclusion (e.g. Maize $>40°C$, Rice $>38°C$, Chickpea $>32°C$). | Gating sowing queries with reproductive-stage phenological limits. | Converted reproductive thermal stress rules to `WARNING_ONLY` or `SOFT_PENALTY` scoped to `Flowering / Anthesis`; restricted sowing exclusions to germination/emergence limits. | `reports/phase_3c_4_eligibility_rules.csv` (RULE-MAIZE-TEMP-01, RULE-RICE-TEMP-02, RULE-CHK-TEMP-01). |
| **CORR-RUL-03** | Indiscriminate Class A evidence grading. | Assigning Class A merely because an institutional name was cited. | Differentiated evidence: Class A reserved for verified primary physiological survival limits; Class B for secondary package of practices; Class C for unmeasured regimes. | `reports/phase_3c_4_eligibility_rules.csv` (Column `evidence_strength`). |
| **CORR-RUL-04** | Individual review of all 100 rules. | Batch categorization in earlier draft. | Individually reviewed and reclassified all 100 rules across all 19 crops with growth stage, geographic context, and required measurement. | `reports/phase_3c_4_eligibility_rules.csv` (100 distinct rows). |

---

### Dimension 3: Fertilizer Safety & Stoichiometry

| Item ID | Review Finding & Defect | Root Cause in Phase 3C.4 | Phase 3C.4.1 Correction Implemented | Verification & Audit Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **CORR-FERT-01** | Blanket fertilizer multipliers (Low = 125% RDF, High = 75% RDF). | Heuristic rule of thumb. | Completely removed blanket $+25\% / -25\%$ multipliers. Replaced with calibrated regional STCR target yield equations. | `reports/phase_3c_4_fertilizer_safety_spec.md` (Sec. 4.1). |
| **CORR-FERT-02** | Automatic commercial bag prescriptions generated without regional STCR backing. | Uncalibrated commercial bag calculator. | Mandated: Where verified STCR target yield equations are unavailable, output is restricted to advisory-only guidance. | `reports/phase_3c_4_fertilizer_safety_spec.md` (Sec. 4.3). |
| **CORR-FERT-03** | Conflating soil test, crop uptake, RDF, and commercial product quantities. | Semantic ambiguity. | Explicitly decoupled 4 separate concepts with distinct definitions and physical units. | `reports/phase_3c_4_fertilizer_safety_spec.md` (Sec. 2). |
| **CORR-FERT-04** | Omission of DAP Nitrogen credit when calculating Urea. | Calculating Urea and DAP independently, resulting in double-counting of Nitrogen ($20–35\text{ kg/ha excess N}$). | Enforced mathematical deduction of DAP nitrogen: $N_{\text{from\_DAP}} = \text{DAP applied} \times 0.18$; $\text{Urea} = \max(0, \text{Target } N - N_{\text{from\_DAP}}) / 0.46$. | `reports/phase_3c_4_fertilizer_safety_spec.md` (Sec. 6.1 & 6.2). |
| **CORR-FERT-05** | Lack of elemental vs oxide stoichiometric conversions. | Unspecified P and K basis. | Formulated exact atomic conversions: $P = P_2O_5 \times 0.4364$; $K = K_2O \times 0.8302$. | `reports/phase_3c_4_fertilizer_safety_spec.md` (Sec. 5.2). |

---

### Dimension 4: Regional Cultivation Windows

| Item ID | Review Finding & Defect | Root Cause in Phase 3C.4 | Phase 3C.4.1 Correction Implemented | Verification & Audit Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **CORR-REG-01** | Universal crop season assumptions ignoring regional planting dates. | Monolithic season categories. | Implemented region-aware planting windows (timely vs late NW plains wheat, Aus/Aman/Boro rice, Adsali sugarcane, Kharif/Zaid groundnut). | `reports/phase_3c_4_canonical_crop_catalogue.csv` (Column `supported_planting_windows`); `reports/phase_3c_4_input_contract.md`. |
| **CORR-REG-02** | Speculative window generation in unverified regions. | Over-imputation. | Mandated: If regional evidence is missing, assign `UNKNOWN` rather than inventing a planting window. | `reports/phase_3c_4_input_contract.md` (Sec. 5). |

---

### Dimension 5: Canonical Crop Catalogue & Taxonomy

| Item ID | Review Finding & Defect | Root Cause in Phase 3C.4 | Phase 3C.4.1 Correction Implemented | Verification & Audit Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **CORR-CAT-01** | False assumption that all 19 crops are equally supported / recommendable. | Universal "Recommendable" classification. | Implemented explicit readiness tiers: `PRODUCTION_READY` (9 crops), `CONDITIONALLY_RECOMMENDABLE` (9 crops), `RESTRICTED_ORCHARD_PROVISIONAL` (1 crop). | `reports/phase_3c_4_canonical_crop_catalogue.csv` (Column `recommendation_eligibility_status`). |
| **CORR-CAT-02** | Taxonomic ambiguity between generic Millets and Jowar. | FieldWise historically used vague "millets" category. | Explicitly standardized `millets` to Pearl Millet / Bajra (*Pennisetum glaucum*); standardized `jowar` to Sorghum (*Sorghum bicolor*); excluded minor millets from this profile. | `reports/phase_3c_4_canonical_crop_catalogue.csv` (Columns `taxonomy_status`, `accepted_aliases`). |
| **CORR-CAT-03** | Treating perennial orchard tree Mango as an annual rotational crop. | Single-season arable framework applied to orchard crop. | Classified Mango as `RESTRICTED_ORCHARD_PROVISIONAL`; engine advises multi-year orchard protocol rather than seasonal crop replacement. | `reports/phase_3c_4_canonical_crop_catalogue.csv`; `reports/phase_3c_4_acceptance_test_matrix.csv` (TEST-15). |
| **CORR-CAT-04** | Missing mandatory evidence fields in catalogue CSV. | Omission in Phase 3C.4 headers. | Added all 7 required fields: `taxonomy_status`, `agronomic_evidence_status`, `supported_regions`, `supported_planting_windows`, `water_evidence_status`, `soil_evidence_status`, `recommendation_eligibility_status`. | `reports/phase_3c_4_canonical_crop_catalogue.csv`. |

---

### Dimension 6: Scoring Architecture Clarifications

| Item ID | Review Finding & Defect | Root Cause in Phase 3C.4 | Phase 3C.4.1 Correction Implemented | Verification & Audit Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **CORR-SCO-01** | Unclear handling of UNKNOWN eligibility outcomes. | Binary pass/fail assumption. | Mandated: UNKNOWN rules assign status `CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_RISK`, block `HIGH_CONFIDENCE`, and surface parameter uncertainty. | `reports/phase_3c_4_scoring_architecture.md` (Sec. 4.1). |
| **CORR-SCO-02** | Missing components propping up geometric scores. | Unpenalized neutral score assignment (70.0). | Implemented Data Completeness Index ($DCI \in (0, 1]$) tracking proportion of measured weight; neutral default decrements $DCI$. | `reports/phase_3c_4_scoring_architecture.md` (Sec. 4.2). |
| **CORR-SCO-03** | Incomparability of scores with different missing inputs. | Single sorted leaderboard. | Mandated: Scores with different missing inputs are NOT directly comparable; UI must display 2D tuple `[Suitability Score, Evidence Confidence Tier]`. | `reports/phase_3c_4_scoring_architecture.md` (Sec. 4.3 & 4.4). |
| **CORR-SCO-04** | Ambiguity between `NO_RECOMMENDATION_SUITABLE` and `INSUFFICIENT_DATA`. | Conflating hostile environment with missing inputs. | Deterministic separation: `NO_RECOMMENDATION_SUITABLE` = complete valid data, hostile conditions; `INSUFFICIENT_DATA` = critical missing/uncalibrated inputs. | `reports/phase_3c_4_scoring_architecture.md` (Sec. 4.5); `reports/phase_3c_4_fallback_and_uncertainty_spec.md`. |
| **CORR-SCO-05** | Risk of describing heuristic suitability scores as calibrated probabilities. | Terminology leakage. | Strictly prohibited probability claims; mandated designation: **Agronomic Suitability Index (0–100)**. | `reports/phase_3c_4_scoring_architecture.md` (Sec. 4.6). |

---

### Dimension 7: Acceptance Test Matrix Corrections

| Item ID | Review Finding & Defect | Root Cause in Phase 3C.4 | Phase 3C.4.1 Correction Implemented | Verification & Audit Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **CORR-TST-01** | Acceptance tests relying on unsupported 75% rainfall or 120 mm water assumptions. | Legacy test assertions in TEST-07 and TEST-08. | Removed flat assumptions; TEST-07 tests unmeasured irrigation handling; TEST-08 tests annual rainfall duration ambiguity. | `reports/phase_3c_4_acceptance_test_matrix.csv`. |
| **CORR-TST-02** | Forcing unsupported crop rankings in regression tests. | Arbitrary single-crop top rank assertions. | Reframed assertions on biological exclusion (e.g. zero winter pulses in desert summer, zero wheat in wetland) rather than forcing unverified rankings. | `reports/phase_3c_4_acceptance_test_matrix.csv` (TEST-01 to TEST-05). |
| **CORR-TST-03** | Missing required test specification fields. | Schema gap in test CSV. | Ensured every test specifies: `input_values_and_units`, `evidence_or_rule_tested`, `expected_eligibility_status`, `expected_exclusions_and_warnings`, `expected_missing_data_behavior`, `regression_baseline_notes`, `pass_criteria`. | `reports/phase_3c_4_acceptance_test_matrix.csv`. |

---

### Dimension 8: Validator Portability & Robustness

| Item ID | Review Finding & Defect | Root Cause in Phase 3C.4 | Phase 3C.4.1 Correction Implemented | Verification & Audit Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **CORR-VAL-01** | Hardcoded absolute project paths (`/Users/shivamkumar/...`). | Machine-specific string constants in generator and validator. | Implemented dynamic portable path resolution using `Path(__file__).resolve().parent` and parents. Runs cleanly from `/tmp` or any directory. | `scripts/generate_phase_3c_4_artifacts.py`; `scripts/validate_phase_3c_4_spec.py`. |
| **CORR-VAL-02** | Validator omitted checks for Phase 3C.4.1 corrections. | Initial validator only checked Phase 3C.4 basic metrics. | Upgraded validator to assert: directly traceable evidence for hard exclusions, explicit unknown marking, absence of 120 mm / 75% conversions, absence of blanket multipliers, DAP nitrogen deduction, and recommendation-readiness. | `scripts/validate_phase_3c_4_spec.py`. |

---

## 3. Summary of Specification Files Modified & Added

### Existing Files Updated in Place
1. `reports/phase_3c_4_input_contract.md`
2. `reports/phase_3c_4_eligibility_rules.csv`
3. `reports/phase_3c_4_scoring_architecture.md`
4. `reports/phase_3c_4_canonical_crop_catalogue.csv`
5. `reports/phase_3c_4_fertilizer_safety_spec.md`
6. `reports/phase_3c_4_fallback_and_uncertainty_spec.md`
7. `reports/phase_3c_4_acceptance_test_matrix.csv`
8. `reports/phase_3c_4_source_evidence_gaps.csv`
9. `reports/phase_3c_4_redesign_decision.md`
10. `scripts/generate_phase_3c_4_artifacts.py`
11. `scripts/validate_phase_3c_4_spec.py`
12. `data/processed/recommendation/phase_3c_4_README.md`

### New Deliverables Added for Phase 3C.4.1
1. `reports/phase_3c_4_1_correction_log.md` (This document)
2. `reports/phase_3c_4_1_final_decision.md` (Executive Decision Report)
3. `reports/phase_3c_4_1_metrics.json` (Machine-readable Phase 3C.4.1 metrics)
4. `reports/phase_3c_4_1_checksums.txt` (SHA-256 manifest of all deliverables)
