# FieldWise — Phase 3C.4.2: Final Specification Closure Report

**Document Version**: 1.0.0-FINAL-CLOSURE  
**Phase**: Phase 3C.4.2 (Recommendation Engine Final Specification Closure)  
**Date**: November 19, 2026  
**Status**: DESIGN-ONLY SPECIFICATION (Read-Only Application Preservation Enforced)  
**Governing Authority**: FieldWise ML Pipeline Architecture & Agronomic Validation Team  

---

## 1. Executive Summary & Purpose

Phase 3C.3 revealed critical biological and structural failures in FieldWise's legacy recommendation engines (`model/predictor.js` and `src/lib/predictorEngine.ts`):
- Additive scoring allowed high soil fertility to override lethal temperatures or moisture stress (recommending Lentil in 38°C summer heat and Wheat in 1450 mm monsoonal flooding).
- Single-scalar rainfall conflated monthly, seasonal, and annual values.
- Soil Health Card nutrient availability was conflated with fertilizer application rates.
- Disjoint catalogs created an architectural split-brain between the online backend and offline client.

Phase 3C.4 designed the Two-Tier Hybrid Architecture, and Phase 3C.4.1 corrected water multipliers and fertilizer stoichiometry. **Phase 3C.4.2 definitively resolves the final three implementation blockers** identified in the independent review:
1. **Season and Planting-Window Compatibility**: Decoupled broad cultivation season from specific planting systems, accommodating Boro rice, Aus rice, Aman rice, Adsali sugarcane, Timely/Late wheat, and perennial fruit trees.
2. **Hard-Exclusion Evidence Audit**: Individually audited all 61 hard exclusions with exact ICAR document titles, stable URLs, publication years, and page/table sections. Retained 45 rigorously verified physiological survival bounds and downgraded 16 rules with schema incompatibilities or non-lethal growth-stage effects.
3. **Minimum Seasonal Water Semantics**: Classified all 19 crop water values into Crop Evapotranspiration ($ET_c$) versus Rainfed Production Screening Thresholds. Enforced a strict ban on comparing raw rainfall to $ET_c$ under irrigated management.

In strict compliance with governance rules, **zero application code was modified**. All artifacts represent technical specifications, data contracts, rule matrices, and test suites prepared for independent review before Phase 3C.5 implementation.

---

## 2. Master Specification Deliverables Inventory

| Deliverable File | Description | Records / Rows | Status |
| :--- | :--- | :---: | :---: |
| `reports/phase_3c_4_input_contract.md` | Canonical Input Contract Specification | 24 Fields | **Updated** |
| `reports/phase_3c_4_scoring_architecture.md` | Two-Tier Hybrid Scoring Architecture | 2 Tiers | **Updated** |
| `reports/phase_3c_4_fallback_and_uncertainty_spec.md` | Fallback & Edge-Case Policy Spec | 8 Scenarios | **Updated** |
| `reports/phase_3c_4_redesign_decision.md` | Architectural Decision Record | 4 Sections | **Updated** |
| `reports/phase_3c_4_canonical_crop_catalogue.csv` | Canonical 19-Crop Master Catalogue | 19 Crops | **Updated** |
| `reports/phase_3c_4_eligibility_rules.csv` | Harmonized Eligibility Rules Matrix | 100 Rules | **Updated** |
| `reports/phase_3c_4_acceptance_test_matrix.csv` | Mandatory Acceptance Test Matrix | 15 Tests | **Updated** |
| `reports/phase_3c_4_source_evidence_gaps.csv` | Source Evidence & Gaps Registry | 10 Gaps | **Preserved** |
| `reports/phase_3c_4_2_hard_exclusion_evidence_audit.csv` | Hard Exclusion Evidence Audit Matrix | 61 Rules | **New (3C.4.2)** |
| `reports/phase_3c_4_2_water_semantics_audit.csv` | Water Semantics Audit Matrix | 19 Crops | **New (3C.4.2)** |
| `reports/phase_3c_4_2_closure_report.md` | Final Specification Closure Report | Comprehensive | **New (3C.4.2)** |
| `reports/phase_3c_4_2_metrics.json` | Final Closure Metrics Manifest | JSON Summary | **New (3C.4.2)** |
| `reports/phase_3c_4_2_checksums.txt` | Master Cryptographic Checksum Manifest | SHA-256 Hashes | **New (3C.4.2)** |
| `scripts/generate_phase_3c_4_artifacts.py` | Specification Generator Engine | Python Script | **Updated** |
| `scripts/validate_phase_3c_4_spec.py` | Specification Validation Engine | Python Script | **Updated** |

---

## 3. Resolution of Blocker 1: Season & Planting-Window Compatibility

### 3.1 The Architectural Disconnect in Broad Seasons
Prior iterations categorized cultivation exclusively into three broad seasons: `Kharif`, `Rabi`, and `Zaid` (plus a vague `Annual` bucket). This created direct agronomic contradictions:
- **Boro Rice**: Sown in nursery beds in November–December, transplanted into puddled fields in December–January, and harvested in April–May in West Bengal, Assam, and Bihar. Classifying Boro as `Kharif` fails because Kharif begins in June; classifying it as `Rabi` fails standard rice thermal checks; classifying it as `Zaid` fails because Zaid begins in March.
- **Adsali Sugarcane**: Planted in July–August in Maharashtra and Karnataka and grown for 15–18 months. Classifying it as an annual crop conflates it with 10–12 month `Eksali` or Spring canes.
- **Tomato & Vegetable Crops**: Cultivated across three overlapping cycles (Autumn-Winter, Spring-Summer, Rainy season) depending on altitude, pest pressures, and frost risks.
- **Perennial Fruit Trees (Mango, Banana)**: Mango is a permanent orchard tree taking 4–7 years to first commercial bearing with phenological cycles (flowering in Feb–Mar, fruiting in May–Jul), while Banana is an 11–13 month giant herbaceous crop planted year-round under assured irrigation.

### 3.2 Formal Six-Field Temporal & Cultivation Data Model
To resolve this without breaking simple interfaces, the temporal contract is factored into six distinct architectural dimensions:
1. `broad_season` (`Kharif`, `Rabi`, `Zaid`, `Boro_Special`, `Annual_Special`, `Perennial_Orchard`)
2. `planting_system` (`Aman`, `Boro`, `Aus`, `Adsali`, `Eksali`, `Timely_Sown`, `Late_Sown`, `Spring`, `Summer`, `Main_Crop`, `Standard_Orchard`)
3. `region_or_agro_climatic_zone` (`state`, `district`, `agro_climatic_zone`)
4. `sowing_date_or_month_range` (`sowing_month`, `sowing_date`, `planting_window_range`)
5. `crop_life_cycle` (`Annual_Seasonal`, `Long_Duration_Annual`, `Perennial_Orchard`)
6. `window_evidence_status` (`VERIFIED`, `PROVISIONAL`, `UNKNOWN`)

### 3.3 Crop Life Cycle Categories
- **`Annual_Seasonal`** (17 crops: Wheat, Rice, Maize, Mustard, Chickpea, Lentil, Soybean, Cotton, Groundnut, Potato, Barley, Millets, Jowar, Sunflower, Onion, Tomato).
- **`Long_Duration_Annual`** (1 crop: Sugarcane — spans 10 to 18 months).
- **`Perennial_Orchard`** (1 crop: Mango; Banana treated as long-duration semi-perennial).

### 3.4 User Input Resolution Matrix
- **Season Only**: Maps `broad_season` to default regional planting system; adopts midpoint calendar month with `PROVISIONAL` status.
- **Sowing Date Only**: Extracts month ($m$); derives `broad_season` from state agricultural calendar; matches verified regional windows (`VERIFIED`).
- **Both Season & Sowing Date**: Cross-validates compatibility; halts with validation error if mutually contradictory (e.g. "Kharif" with "December 15").
- **Unknown Planting Window**: Evaluates generic physiological thermal limits; outputs recommendation with `PROVISIONAL` badge.
- **Region with No Verified Window**: Falls back to state/macro-climatic zone default; marks status `UNKNOWN` ($DCI \le 0.70$).

### 3.5 Worked Examples for Key Crops
1. **Rice (*Oryza sativa*)**:
   - *Aman (Main Kharif)*: Sown Jun 15–Jul 10; transplanted Jul 15–Aug 10; monsoon dependent ($ET_c \approx 1100\text{–}1350\text{ mm}$).
   - *Boro (Winter Rice)*: Sown Nov 15–Dec 15; transplanted Dec 20–Jan 20; harvest Apr–May; cold-tolerant varieties in Eastern India (ICAR-IIRR Tech. Bull. 92/2021).
   - *Aus (Pre-monsoon Rice)*: Sown Mar 15–Apr 30; harvest Jul–Aug in Assam/Bengal.
2. **Wheat (*Triticum aestivum*)**:
   - *NWPZ Timely Sown*: Nov 1 – Nov 15 (Optimum vernalization).
   - *NWPZ Late Sown*: Nov 20 – Dec 15 (Late varieties; yield potential penalized past Nov 20).
   - *Central Zone (CZ)*: Oct 25 – Nov 15 (Shorter winter; avoids severe February terminal heat).
3. **Sugarcane (*Saccharum officinarum*)**:
   - *Adsali (Maharashtra)*: Planted Jul 15 – Aug 31 (15–18 months duration; 20–30% higher cane tonnage).
   - *Autumn (UP/Bihar)*: Planted Oct 1 – Oct 31 (12–13 months duration).
   - *Spring (All India)*: Planted Feb 15 – Mar 25 (10–12 months duration).
4. **Tomato (*Solanum lycopersicum*)**:
   - *Autumn-Winter*: Sown Jun–Jul; transplanted Jul–Aug; harvest Nov–Jan.
   - *Spring-Summer*: Sown Nov–Dec; transplanted Jan–Feb; harvest Apr–May.
5. **Banana (*Musa acuminata*)**:
   - 11–14 month crop life cycle; planted Jun–Jul or Sep–Oct under assured micro-irrigation; lethal frost < 8°C.
6. **Mango (*Mangifera indica*)**:
   - `RESTRICTED_ORCHARD_PROVISIONAL`. Multi-year establishment (4–7 years to bearing); vegetative rest in Oct–Dec; flowering in Jan–Mar.

---

## 4. Resolution of Blocker 2: Hard-Exclusion Evidence Audit

### 4.1 Audit Methodology & Criteria
All 61 rules carrying `HARD_EXCLUSION` status in Phase 3C.4.1 were audited individually against:
1. Exact source ID, institution, document title, stable URL, publication year, and exact page/table/section.
2. Physiological lethality (absolute biological mortality vs growth reduction).
3. Growth-stage specificity (sowing-stage germination bounds vs reproductive/flowering stress).
4. Schema compatibility with the Canonical Input Contract (only standard USDA/ICAR texture enums allowed).

### 4.2 Summary Audit Statistics
- **Total Hard Exclusions Audited**: 61
- **Retained as `HARD_EXCLUSION`**: **45 rules**
- **Downgraded to `SOFT_PENALTY`**: **16 rules**
- **Marked as `UNKNOWN`**: **0 rules**

### 4.3 Detailed Downgrade Breakdown (16 Rules)
1. **Soil Texture Schema Incompatibilities & Drainage Defects (8 rules)**:
   - `RULE-CHK-SOIL-01` (Chickpea), `RULE-BAR-SOIL-01` (Barley), `RULE-SOY-SOIL-01` (Soybean), `RULE-LEN-SOIL-01` (Lentil): Originally checked string `Waterlogged Clay`. Downgraded because waterlogging is a drainage defect, not a soil texture enum. Chickpea and Soybean are heavily cultivated on deep black vertisols (40–60% clay) across MP and Maharashtra. Downgraded to `SOFT_PENALTY` with drainage advisories.
   - `RULE-MNG-SOIL-01` (Mango): Originally checked string `Hard Pan Clay`. Downgraded because hardpan is a structural defect, not an input enum. Downgraded to `SOFT_PENALTY`.
   - `RULE-JOW-SOIL-01` (Jowar), `RULE-SUN-SOIL-01` (Sunflower): Originally checked string `Coarse Desert Sand`. Downgraded to `SOFT_PENALTY` on valid `Sandy` enum.
   - `RULE-POT-SOIL-01` (Potato): Checked `Clay`. Heavy clay deforms tubers and reduces market grade, but does not cause 100% biological crop death. Downgraded to `SOFT_PENALTY`.
2. **Broad Season Tautologies & Multiseason Flexibility (8 rules)**:
   - `RULE-RICE-SEAS-01` (Rice): Originally excluded `Rabi`. Downgraded to `SOFT_PENALTY` to accommodate winter-sown Boro rice in Eastern India.
   - `RULE-TOM-SEAS-01` (Tomato): Listed all seasons as exclusion. Tomato is grown across Kharif, Rabi, and Zaid in different agro-ecologies. Downgraded to `SOFT_PENALTY`.
   - `RULE-SUN-SEAS-01` (Sunflower): Sunflower is photo-insensitive and grown across Kharif, Rabi, and Spring. Downgraded to `SOFT_PENALTY`.
   - `RULE-MAZ-SEAS-01` (Maize): Maize is cultivated in Kharif (all India), Rabi (Bihar, AP), and Spring (Punjab). Downgraded to `SOFT_PENALTY`.
   - `RULE-GNT-SEAS-01` (Groundnut): Grown in Kharif (Gujarat) and Summer/Zaid (Gujarat/AP). Downgraded to `SOFT_PENALTY`.
   - `RULE-ONI-SEAS-01` (Onion): Cultivated across Kharif, Late-Kharif, and Rabi. Downgraded to `SOFT_PENALTY`.
   - `RULE-SUG-SEAS-01` (Sugarcane): Accommodates Adsali, Autumn, and Spring planting systems. Downgraded to `SOFT_PENALTY`.
   - `RULE-COT-SEAS-01` (Cotton): Cotton in northern irrigated zones is sown in April–May (Zaid onset). Downgraded to `SOFT_PENALTY`.

### 4.4 Resulting Harmonized Rules Breakdown (100 Rules)
- `HARD_EXCLUSION`: **45**
- `SOFT_PENALTY`: **42**
- `WARNING_ONLY`: **8**
- `UNKNOWN`: **4**
- `NOT_APPLICABLE`: **1**
- **Total Rules**: **100**

---

## 5. Resolution of Blocker 3: Minimum Seasonal Water Semantics

### 5.1 The Fundamental Water Semantics Fallacy
In legacy engines, seasonal crop water requirements were compressed into monthly rainfall brackets (e.g. 50–200 mm), or total crop evapotranspiration ($ET_c$) was directly compared against raw natural rainfall. This created fatal agronomic errors:
- Wheat in Punjab receives only 40–80 mm of winter rain, but requires 250–450 mm of total water, which is supplied via tubewell irrigation. Comparing raw rainfall to Wheat $ET_c$ would disqualify Wheat from India's most productive wheat belt!
- Sugarcane in Western Maharashtra receives 400 mm of rain, but requires 1500–2200 mm of water, supplied via canal/drip irrigation. Disqualifying it based on raw rainfall is agronomic nonsense.

### 5.2 Formal Classification of the 19 Crop Water Values
Every `min_seasonal_water_mm` entry was audited and classified:
1. **Total Crop Evapotranspiration ($ET_c$) under Optimal Management (13 crops)**:
   - Wheat (250 mm), Maize (400 mm), Sugarcane (1200 mm), Potato (300 mm), Chickpea (200 mm), Mustard (200 mm), Soybean (450 mm), Lentil (200 mm), Tomato (400 mm), Onion (350 mm), Banana (1400 mm), Barley (200 mm), Sunflower (350 mm).
   - *Usage*: Evaluated strictly in Tier 2 geometric water scoring. **Strictly prohibited from being used as a Tier 1 hard exclusion against raw rainfall**.
2. **Rainfed Production Screening Threshold (5 crops)**:
   - Rice (800 mm), Cotton (500 mm), Groundnut (400 mm), Jowar (350 mm), Millets / Bajra (200 mm).
   - *Usage*: Applies **ONLY** when `irrigation_access = 'None_Rainfed'`. Represents the physical limit below which commercial rainfed cultivation suffers catastrophic wilting.
3. **Provisional Metadata (1 crop)**:
   - Mango (300 mm). Applies to young graft establishment; mature trees tap deep groundwater.

### 5.3 Universal Water Rules
- **No Raw Rain Comparison**: Direct comparison of raw rainfall to $ET_c$ is strictly forbidden.
- **No Universal Hard Exclusions**: There are **zero universal hard exclusions on water alone** for crops with indicated irrigation infrastructure.
- **Unmeasured Water Protocol**: If rainfall is low and irrigation access is indicated but unmeasured, water sufficiency evaluates to **`UNKNOWN`** / **`PROVISIONAL`**, never an assumed pass or fail.

---

## 6. Scoring & Uncertainty Consistency

### 6.1 Principles
1. **UNKNOWN Eligibility Never Confirmed Pass**: An `UNKNOWN` rule outcome prevents a candidate from receiving `HIGH_CONFIDENCE` or `PRODUCTION_READY` badges.
2. **Data Completeness Index ($DCI$)**: Formally computed from measured inputs ($DCI \in (0, 1.00]$). Missing soil tests or unmeasured irrigation reduce $DCI$.
3. **Score Non-Comparability**: Suitability scores generated with different missing inputs ($DCI$) cannot be sorted on a single naive leaderboard. Recommendations must display the tuple `[Suitability Index, Confidence Tier]`.
4. **All-Provisional Candidate Sets**: Evaluated deterministically with non-compensatory Liebig ranking, but presented with a mandatory, non-dismissible `PROVISIONAL_EVALUATION` advisory banner.
5. **Deterministic Rejection Boundaries**:
   - `NO_RECOMMENDATION_SUITABLE`: Complete valid data provided; hostile agricultural conditions disqualify all 19 crops.
   - `INSUFFICIENT_DATA`: Critical inputs missing; biological viability cannot be evaluated.
6. **Prohibition of Calibrated Probability Claims**: Scores must strictly be labeled **Agronomic Suitability Index (0–100)**, never "probabilities" or "confidence percentages".

---

## 7. Acceptance Test Matrix Coverage (15 Tests)

All 15 acceptance tests were updated to verify Phase 3C.4.2 specifications:
- **TEST-01-S1**: Arid Desert Drought (Jaisalmer S1 Regression). Zero winter pulses, zero wetland crops; Millets eligible under dryland threshold with drought warning.
- **TEST-02-S2**: Monsoon High Rainfall Wetland (Assam S2 Regression). Wheat/Mustard/Pulses excluded via season gate; Rice eligible with high water score.
- **TEST-03-S3**: Peak Kharif Summer Heat (Punjab S3 Regression). Potato/Wheat excluded via season and temperature gates; Kharif crops eligible with unmeasured water provisional flag.
- **TEST-04-S4**: Severe Soil Alkalinity (Haryana S4 Regression). Complete inputs, pH 9.2; all arable crops fail Tier 1 gating; returns `NO_RECOMMENDATION_SUITABLE` with gypsum advisory.
- **TEST-05-S5**: Soil Health Card Medium Fertility Plain (UP S5 Regression). Verified STCR fertilizer prescription; DAP nitrogen credited ($N_{\text{from\_DAP}} = \text{DAP} \times 0.18$).
- **TEST-06**: Boro Rice Compatibility. Evaluates winter-sown cold-tolerant Boro rice in Assam/Bengal; successfully eligible under `Boro_Special` without broad season collision.
- **TEST-07**: Wheat Regional Windows. Distinguishes timely (Nov 1–15) vs late (Nov 20–Dec 10) in NWPZ; rejects late sowing in Central Zone due to terminal heat.
- **TEST-08**: Sugarcane Systems. Differentiates 15–18 month Adsali (Jul–Aug) in Maharashtra from 12-month Spring/Autumn canes.
- **TEST-09**: Unknown Region Fallback. Unknown district falls back to state agro-climatic zone normals; reduces $DCI$ to $0.70$ with provisional banner.
- **TEST-10**: Downgraded Hard Exclusion Verification. Verified that clay soil for Chickpea or Mango does not cause hard exclusion; applies soft penalty with drainage warning.
- **TEST-11**: Growth-Stage Stress vs Sowing Temperature. Rice at 39°C sowing temperature fails Tier 1 emergence gate; Rice at 28°C sowing with forecasted 39°C flowering heat passes Tier 1 with floret sterility warning.
- **TEST-12**: Water Semantics ($ET_c$ vs Rain). Irrigated wheat with 40 mm rain and 250 mm tubewell water passes water gate; raw rain is not compared directly to $ET_c$.
- **TEST-13**: Annual Rainfall Handling. When user enters annual rainfall instead of seasonal, engine flags period uncertainty without applying arbitrary 75% multipliers.
- **TEST-14**: All-Provisional Candidate Set. When all eligible crops have unmeasured irrigation, engine outputs ranked candidates under prominent `PROVISIONAL_EVALUATION` advisory.
- **TEST-15**: Missing Critical Inputs. When sowing month and irrigation access are omitted, engine deterministically halts with `INSUFFICIENT_DATA`.

---

## 8. Validation Script Execution & Portability

The specification validation script (`validate_phase_3c_4_spec.py`) was updated to enforce all six Phase 3C.4.2 criteria:
1. Consistent planting-window schema across all 19 crops (`planting_windows_json`, `crop_life_cycle`, `planting_systems`).
2. No unsupported source citation can retain `HARD_EXCLUSION` status.
3. All hard exclusions have compatible measurements and growth-stage definitions.
4. All minimum-water values have defined semantics or are explicitly UNKNOWN.
5. No raw rainfall is compared directly with total crop water requirement without an evidence-backed method.
6. All acceptance tests have explicit expected outcomes.

The script runs 100% portably from both the project root and external directories (e.g. `/tmp`).

---

## 9. Preservation & Security Confirmation

In strict adherence to governing rules:
- **Zero production application files were modified, moved, or deleted**:
  - `model/predictor.js` (UNTOUCHED)
  - `model/cropDatabase.js` (UNTOUCHED)
  - `model/fertilizerDatabase.js` (UNTOUCHED)
  - `src/lib/predictorEngine.ts` (UNTOUCHED)
  - `src/lib/api.ts` (UNTOUCHED)
- **Zero ML models were trained**; zero mock implementations were deployed.
- All Phase 3A, Phase 3B, and Phase 3C artifacts remain fully intact.
- **Phase 3C.5 Readiness**: With the completion of Phase 3C.4.2, all three architectural blockers are closed. The project is fully prepared for Phase 3C.5 implementation.
