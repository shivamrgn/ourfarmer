# FieldWise — Phase 3C.4: Recommendation Engine Redesign Decision & Technical Report

**Specification Version**: 1.5.0-FINAL-WATER-RECONCILIATION (Phase 3C.4.2.2.1)  
**Phase**: Phase 3C.4 / Phase 3C.4.2.2.1 (Effective Rainfall and Rainfed Water Reconciliation)  
**Status**: DESIGN-ONLY SPECIFICATION (Read-Only Application Preservation Enforced)  
**Target Integration**: Future Phase 3C.5 Implementation  
**Governing Authority**: FieldWise ML Pipeline Architecture & Agronomic Validation Team  

---

## 1. Executive Summary & Purpose

Phase 3C.3 identified profound vulnerabilities in FieldWise's legacy recommendation engines (`model/predictor.js` and `src/lib/predictorEngine.ts`):
- **Additive Scoring Failure**: Overriding fatal constraints with unrelated positive scores, resulting in lethal recommendations (winter pulses recommended in 38°C desert summer; wheat recommended in 1200 mm submerged wetland).
- **Omission of Cultivation Season**: Zero checking of sowing season or calendar timing.
- **Water Semantics Distortion**: Compressing seasonal water requirements (350–2500 mm) into 30–300 mm monthly brackets.
- **NPK Measurement Confusion**: Conflating Soil Health Card soil test availability with fertilizer application rates.
- **Architectural Split-Brain**: Disjoint catalogs between online backend (16 crops) and offline frontend (16 crops) with divergent yields (+75% delta) and conflicting fertilizer prescriptions.

Phase 3C.4 converted these audit findings into a two-tier hybrid architecture. Following independent reviews, **Phase 3C.4.2.2.1 definitively resolves all remaining water calculation and rainfed semantics defects**:
1. **Effective Rainfall Formulation Correction**: Resolved the discrepancy in Example A (1,150 mm seasonal rain producing 240 mm under direct seasonal formula vs 589 mm under monthly aggregation). Established that the USDA-SCS method (FAO-24 / CROPWAT) is strictly an empirical monthly equation ($P_m \le 250 \implies P_m(125 - 0.2P_m)/125$; $P_m > 250 \implies 125 + 0.1P_m$). Prohibited direct seasonal application. Defined seasonal effective rain as $\sum P_{\text{eff},m}$. Missing monthly distribution returns `UNKNOWN` effective rain and provisional status.
2. **Rebuilt Example A (West Bengal Aman Rice)**: Rebuilt with 4-month monsoon breakdown ($350, 350, 300, 150\text{ mm} = 1150\text{ mm}$), generating monthly effective rainfall of $160, 160, 155, 114\text{ mm}$ (sum $= 589.0\text{ mm}$), runoff/drainage loss of $561.0\text{ mm}$ ($48.8\%$), and meeting $ET_{c,\min} = 450\text{ mm}$. Assigned status `CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE` (NEVER `PASS_VERIFIED`).
3. **Corrected Rainfed Status Semantics**: Established that rainfall exceeding screening threshold sets `SCREENING_THRESHOLD_MET`, NOT `PASS_VERIFIED`. Defined 5 distinct outcomes: `SCREENING_THRESHOLD_MET`, `WATER_DEFICIT_WARNING`, `CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK`, `CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE`, and `UNKNOWN`. Rainfed screening thresholds NEVER cause Tier 1 FAIL.
4. **Clarified Residual Soil Moisture**: Defined 4 epistemic categories (`MEASURED`, `SOURCE_BACKED_ESTIMATED`, `PROVISIONAL`, `UNKNOWN`). Documented Deep Vertisol $AWC = 200\text{ mm/m} \times 1.2\text{ m} = 240.0\text{ mm}$. Prohibited inventing unmeasured soil storage or assuming rainfall represents all available water.
5. **Expanded Acceptance Test Suite**: Expanded acceptance tests to 18 cases covering all 8 review requirements.
6. **Non-Destructive Historical Preservation**: Verified read-only immutability across all 5 historical checksum manifests (`phase_3c_4`, `phase_3c_4_1`, `phase_3c_4_2`, `phase_3c_4_2_1`, `phase_3c_4_2_2`).


In strict compliance with governance rules, **zero application code was modified**. All artifacts represent technical specifications, data contracts, rule matrices, and test suites prepared for independent review before Phase 3C.5 implementation.

---

## 2. Master Specification Deliverables Inventory

| Deliverable Path | Document Title | Primary Contribution |
| :--- | :--- | :--- |
| `reports/phase_3c_4_input_contract.md` | Canonical Input Contract Specification | Structured contract for location, decoupled planting windows, 6 water concepts, and 6-domain DCI. |
| `reports/phase_3c_4_eligibility_rules.csv` | Agronomic Eligibility Rules Matrix | 100 evidence-backed rules (0 HARD_EXCLUSION, 87 SOFT_PENALTY, 8 WARNING_ONLY, 4 UNKNOWN, 1 NA). |
| `reports/phase_3c_4_scoring_architecture.md` | Scoring Architecture Specification | Two-Tier Hybrid Architecture (Boolean Gating $\to$ Liebig Geometric Ranking), non-comparability, and DCI. |
| `reports/phase_3c_4_canonical_crop_catalogue.csv` | Canonical 19-Crop Master Catalogue | Single Source of Truth (SSOT) defining all 19 crops with explicit recommendation-readiness and life cycles. |
| `reports/phase_3c_4_fertilizer_safety_spec.md` | Fertilizer & Soil-Nutrient Safety Spec | Decouples soil test from RDF, eliminates blanket multipliers, enforces DAP nitrogen credits, and limits bag advice. |
| `reports/phase_3c_4_fallback_and_uncertainty_spec.md` | Fallback & Uncertainty Handling Spec | Establishes 100% dual-engine parity, unmeasured water policies, and `NO_RECOMMENDATION` vs `INSUFFICIENT_DATA`. |
| `reports/phase_3c_4_acceptance_test_matrix.csv` | Mandatory Acceptance Test Matrix | 18 deterministic test cases (covering Phase 3C.4.2.2.1 scenarios) with verified agronomic expectations. |
| `reports/phase_3c_3_source_registry.csv` | Verified Source Registry | 21 research citations updated with evidence status (4 verified benchmarks, 17 unverified independent access). |
| `reports/phase_3c_4_2_hard_exclusion_evidence_audit.csv` | Hard Exclusion Evidence Audit Matrix | 61 candidate rules audited individually (0 retained, 61 downgraded, 0 unknown) against biological lethality. |
| `reports/phase_3c_4_2_water_semantics_audit.csv` | Water Semantics Audit Matrix | 19 crops audited for decoupled water measurement definitions and ban on comparing raw rain to $ET_c$. |
| `reports/phase_3c_4_2_2_1_closure_report.md` | Phase 3C.4.2.2.1 Technical Closure Report | Comprehensive technical audit report detailing resolution of all review findings and implementation readiness. |
| `reports/phase_3c_4_2_2_1_metrics.json` | Final Closure Metrics Manifest | Dynamically generated inventory of all rules, contract fields, catalogue entries, and test definitions. |
| `reports/phase_3c_4_2_2_1_checksums.txt` | Master Cryptographic Checksum Manifest | SHA-256 integrity hashes for all Phase 3C.4.2.2 specification deliverables. |
| `scripts/generate_phase_3c_4_artifacts.py` | Specification Generator Engine | Portable Python builder generating all CSV specification matrices dynamically. |
| `scripts/validate_phase_3c_4_spec.py` | Specification Validation Engine | Non-destructive portable Python validator verifying contracts, metrics, arithmetic, and test assertions. |

---

## 3. Detailed Engineering Decisions (Phase 3C.4.2 Final Closure)

### 3.1 Resolution of Blocker 1: Season & Planting-Window Compatibility
- **Decoupled 6-Field Model**:
  - `broad_season` (`Kharif`, `Rabi`, `Zaid`, `Boro_Special`, `Annual_Special`, `Perennial_Orchard`)
  - `planting_system` (`Aman`, `Boro`, `Aus`, `Adsali`, `Eksali`, `Timely_Sown`, `Late_Sown`, `Spring`, `Summer`, `Main_Crop`, `Standard_Orchard`)
  - `region_or_agro_climatic_zone` (`state`, `district`, `agro_climatic_zone`)
  - `sowing_date_or_month_range` (`sowing_month`, `sowing_date`, `planting_window_range`)
  - `crop_life_cycle` (`Annual_Seasonal`, `Long_Duration_Annual`, `Perennial_Orchard`)
  - `window_evidence_status` (`VERIFIED`, `PROVISIONAL`, `UNKNOWN`)
- **Resolved Specific Systems**:
  - *Boro Rice*: Accommodated as a winter/spring planting system in Eastern India without forcing it into Kharif.
  - *Wheat*: Differentiated timely vs late sown windows in NWPZ and Central Zone.
  - *Sugarcane*: Differentiated 15–18 month Adsali from 12-month Autumn and Spring crops.
  - *Tomato*: Structured multi-season production across autumn, spring, and rainy cycles.
  - *Perennial Fruits*: Mango classified as `RESTRICTED_ORCHARD_PROVISIONAL` to prevent conflating orchard trees with annual arable crops.

### 3.2 Resolution of Blocker 2: Hard-Exclusion Evidence Audit
- All 61 rules were audited individually:
  - **45 Rules Retained as `HARD_EXCLUSION`**: Primary ICAR/CSSRI/FAO publications confirm absolute physiological lethality (e.g. soil pH < 4.5 or > 8.5; sowing temperature < 10°C or > 38°C; coarse unpuddled sand for wetland rice).
  - **16 Rules Downgraded to `SOFT_PENALTY`**:
    - *Schema Incompatibilities*: Rules checking non-schema values (e.g. `Waterlogged Clay`, `Hard Pan Clay`, `Coarse Desert Sand`) were downgraded because waterlogging and hardpans are drainage/soil management defects rather than standard textural classes.
    - *Season Tautologies*: Broad season checks that excluded valid regional planting systems (e.g. Boro rice in winter; multi-season tomato and sunflower) were downgraded to soft penalties.
  - **0 Rules Left in Speculative / Unsupported Status**.

### 3.3 Resolution of Blocker 3: Minimum Seasonal Water Semantics
- Every `min_seasonal_water_mm` value across all 19 crops was classified:
  - **13 Crops Classified as Total Crop Evapotranspiration ($ET_c$)**: Wheat (250 mm), Maize (400 mm), Sugarcane (1200 mm), Potato (300 mm), Chickpea (200 mm), Mustard (200 mm), Soybean (450 mm), Lentil (200 mm), Tomato (400 mm), Onion (350 mm), Banana (1400 mm), Barley (200 mm), Sunflower (350 mm).
  - **5 Crops Classified as Rainfed Production Screening Threshold**: Rice (800 mm), Cotton (500 mm), Groundnut (400 mm), Jowar (350 mm), Millets (200 mm).
  - **1 Crop Classified as Provisional Metadata**: Mango (300 mm).
- **Universal Rule**: Comparing raw rainfall to $ET_c$ under irrigated management is strictly prohibited. $ET_c$ is evaluated exclusively in Tier 2 geometric scoring.

### 3.4 Acceptance Test Suite Closure
- All 15 acceptance tests now verify Phase 3C.4.2 scenarios:
  - TEST-01 to TEST-05: Regress Phase 3C.3 failure scenarios S1–S5.
  - TEST-06: Verifies Boro rice compatibility.
  - TEST-07: Verifies Wheat timely vs late regional windows.
  - TEST-08: Verifies Sugarcane Adsali vs Autumn vs Spring cycles.
  - TEST-09: Verifies Unknown region fallback behavior.
  - TEST-10: Verifies Downgraded hard-exclusion rules.
  - TEST-11: Verifies Growth-stage stress vs sowing-stage survival limits.
  - TEST-12: Verifies Water semantics ($ET_c$ vs rainfall).
  - TEST-13: Verifies Annual rainfall entered where seasonal water required.
  - TEST-14: Verifies Behavior when all candidates are provisional.
  - TEST-15: Verifies Deterministic halt on missing critical inputs (`INSUFFICIENT_DATA`).

---

## 4. Phase 3C.5 Implementation Sequence

Upon formal approval of this Phase 3C.4.2 specification closure, implementation in Phase 3C.5 will proceed in four isolated steps:
1. **Step 1: Single Source of Truth Asset**: Export `canonical_crop_catalogue.json` containing all 19 crops, region-aware planting windows, readiness flags, and 100 eligibility rules.
2. **Step 2: Backend Engine Migration**: Replace `model/predictor.js` scoring logic with Tier 1 Gating and Tier 2 Liebig geometric scoring importing the SSOT asset.
3. **Step 3: Frontend Fallback Migration**: Update `src/lib/predictorEngine.ts` to mirror the exact backend implementation using the shared SSOT asset.
4. **Step 4: Acceptance Test Suite Execution**: Execute the 15 acceptance tests against both backend and frontend engines to assert 100% parity and zero defects.
