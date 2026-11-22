# FieldWise — Phase 3C.3: Agronomic Validation of the 19-Crop Recommendation Engine

**Audit Date**: 2026-11-19T13:30:00Z  
**Phase**: Phase 3C.3 (Agronomic Validation of the 19-Crop Recommendation Engine)  
**Scope**: Model / ML Pipeline (`FieldWise_main/model/ml_pipeline/`)  
**Status**: Completed  
**Application Preservation Status**: Complete Isolation. Live frontend, backend APIs, Supabase database, `model/predictor.js`, `model/cropDatabase.js`, `model/fertilizerDatabase.js`, and `src/lib/predictorEngine.ts` strictly **UNTOUCHED / READ-ONLY**.

---

## 1. Executive Summary & Audit Background

Following the dataset provenance audit in Phase 3C.1 (which proved that the 2,200-row Kaggle crop recommendation benchmark was synthetically sampled and omitted 12 major Indian staples) and the 7-class algorithmic benchmark in Phase 3C.2, **Phase 3C.3 conducts a source-backed agronomic validation of FieldWise's authoritative 19-crop canonical taxonomy and recommendation rules**.

The primary objective is to evaluate whether FieldWise's crop requirements, suitability ranges, and recommendation scoring mechanisms are:
1. Supported by peer-reviewed, authoritative agricultural science sources from India (ICAR institutes, State Agricultural Universities, Department of Agriculture & Farmers Welfare) and international bodies (FAO).
2. Correctly represented with unambiguous physical units, physiological contexts, and environmental constraints.
3. Appropriate and representative for real-world Indian agro-climatic zones and farming practices.
4. Consistent across the backend crop database (`model/cropDatabase.js`), the frontend fallback engine (`src/lib/predictorEngine.ts`), and the canonical taxonomy (`reports/canonical_crop_taxonomy.json`).
5. Safe enough to prevent catastrophic recommendations (e.g., advising winter crops in monsoon heat, or water-intensive crops in rainfed deserts).

### Core Audit Findings

```
========================================================================================
                          PHASE 3C.3 AUDIT SCORECARD
========================================================================================
Canonical Crop Taxonomy:              19 Crops (Full coverage of major Indian staples)
Backend Database Crops:               16 Crops (3 missing: sunflower, barley, millets)
Frontend Engine Crops:                16 Crops (3 missing: banana, mango, jowar)
Shared Crops Across Both Engines:     13 Crops
Total Discrepancies Cataloged:        102 parameter/catalog/fertilizer differences
Evaluated Parameter Instances:        190 parameter evaluations (19 crops × 10 parameters)
Evidence Classification Distribution:
  - Class A (Directly Supported):     133 parameters (70.0%) [Temp, Soil, pH, RDF]
  - Class B (Partially Supported):     10 parameters  (5.3%) [Sowing temp, Orchard units]
  - Class C (Conflicting Evidence):     1 parameter   (0.5%) [Sugarcane season]
  - Class D (Unsupported / Defective): 46 parameters (24.2%) [Rainfall brackets & Irrigation]
  - Class E (Not Applicable):           0 parameters  (0.0%)
========================================================================================
```

### Primary Governance Verdicts

| Evaluation Dimension | Final Verdict | Core Rationale |
| :--- | :---: | :--- |
| **1. Canonical Crop Taxonomy Quality** | **Approved with limitations** | Well-structured 19-crop taxonomy covering cereals, pulses, oilseeds, commercial crops, and vegetables. Requires explicit separation of fertilizer dose (RDF) from soil test ratings, and recalibration of rainfall semantics. |
| **2. Agronomic Parameter Evidence** | **Requires correction** | Thermal limits, soil texture lists, and pH bounds are strongly backed by ICAR/SAU research. However, rainfall ranges (30–300 mm) understate true seasonal water requirements by 5x–10x, and NPK parameters misrepresent fertilizer applications as soil tests. |
| **3. Backend Rule Engine Defensibility** | **Requires correction** | Additive scoring without hard limiting factors (violating Liebig's Law of the Minimum) allows severely incompatible or out-of-season crops to achieve >70% confidence. |
| **4. Frontend Fallback Consistency** | **Requires correction** | Split-brain catalog (16 vs 16 with 3 disjoint crops each), divergent yields (up to +75% delta), and conflicting fertilizer recipes cause predictions to shift when internet connection drops. |
| **5. Suitability for Controlled Code Changes** | **Approved with limitations** | The audit evidence matrix and discrepancy inventory provide an exact, mathematically sound specification for refactoring the heuristic engine in Phase 3C.4. |
| **6. Production Readiness** | **Rejected** | The engine is not safe for live farm advisory deployment in its current state. |

---

## 2. The Authoritative 19-Crop Inventory

The 19 crops established in `reports/canonical_crop_taxonomy.json` represent the authoritative scope of FieldWise. The inventory spans major cereal staples, high-protein pulses, oilseeds, commercial cash crops, and high-value vegetables and fruits.

```
+----+-------------+-------------------------+-----------------------+-------------------+-----------+---------+----------+
| #  | Crop ID     | Canonical Common Name   | Botanical Latin Name  | Family            | Category  | Season  | Benchmark|
+----+-------------+-------------------------+-----------------------+-------------------+-----------+---------+----------+
| 1  | rice        | Rice (Paddy)            | Oryza sativa          | Poaceae           | Cereal    | Kharif  | Yes      |
| 2  | wheat       | Wheat                   | Triticum aestivum     | Poaceae           | Cereal    | Rabi    | No       |
| 3  | maize       | Maize (Corn)            | Zea mays              | Poaceae           | Cereal    | Kharif  | Yes      |
| 4  | cotton      | Cotton                  | Gossypium hirsutum    | Malvaceae         | Fiber     | Kharif  | Yes      |
| 5  | sugarcane   | Sugarcane               | Saccharum officinarum | Poaceae           | Sugar     | Annual  | No       |
| 6  | soybean     | Soybean                 | Glycine max           | Fabaceae          | Oilseed   | Kharif  | No       |
| 7  | groundnut   | Groundnut (Peanut)      | Arachis hypogaea      | Fabaceae          | Oilseed   | Kharif  | No       |
| 8  | potato      | Potato                  | Solanum tuberosum     | Solanaceae        | Tuber     | Rabi    | No       |
| 9  | chickpea    | Chickpea (Gram)         | Cicer arietinum       | Fabaceae          | Pulse     | Rabi    | Yes      |
| 10 | lentil      | Lentil (Masoor)         | Lens culinaris        | Fabaceae          | Pulse     | Rabi    | Yes      |
| 11 | mustard     | Mustard (Rapeseed)      | Brassica juncea       | Brassicaceae      | Oilseed   | Rabi    | No       |
| 12 | tomato      | Tomato                  | Solanum lycopersicum  | Solanaceae        | Vegetable | Rabi    | No       |
| 13 | onion       | Onion                   | Allium cepa           | Amaryllidaceae    | Bulb Veg  | Rabi    | No       |
| 14 | banana      | Banana                  | Musa acuminata        | Musaceae          | Fruit     | Annual  | Yes      |
| 15 | mango       | Mango                   | Mangifera indica      | Anacardiaceae     | Fruit     | Summer  | Yes      |
| 16 | jowar       | Jowar (Sorghum)         | Sorghum bicolor       | Poaceae           | Millet    | Kharif  | No       |
| 17 | sunflower   | Sunflower               | Helianthus annuus     | Asteraceae        | Oilseed   | Zaid    | No       |
| 18 | barley      | Barley                  | Hordeum vulgare       | Poaceae           | Cereal    | Rabi    | No       |
| 19 | millets     | Bajra / Pearl Millet    | Pennisetum glaucum    | Poaceae           | Millet    | Kharif  | No       |
+----+-------------+-------------------------+-----------------------+-------------------+-----------+---------+----------+
```

Full machine-readable extraction of all 19 crops, including original parameter boundaries, soil textures, and state whitelists, is archived in `reports/phase_3c_3_crop_inventory.csv`.

---

## 3. Agronomic Evidence Hierarchy & Source Methodology

All parameters were evaluated against a strict five-tier hierarchy of authoritative agricultural science sources:

1. **Tier 1: National Commodity Institutes of the Indian Council of Agricultural Research (ICAR)**:
   - ICAR-IIRR (Rice), ICAR-IIWBR (Wheat & Barley), ICAR-IIMR (Maize), ICAR-CICR (Cotton), ICAR-IISR (Sugarcane), ICAR-IISR (Soybean), ICAR-DGR (Groundnut), ICAR-CPRI (Potato), ICAR-IIPR (Pulses: Chickpea & Lentil), ICAR-DRMR (Mustard), ICAR-IIHR (Horticulture: Tomato & Onion), ICAR-NRCB (Banana), ICAR-CISH (Mango), ICAR-IIMR (Millets: Sorghum & Pearl Millet), ICAR-IIOR (Sunflower).
2. **Tier 2: State Agricultural Universities (SAUs) & Packages of Practices**:
   - TNAU Agritech Portal (Tamil Nadu Agricultural University).
   - PAU Ludhiana (Punjab Agricultural University).
   - MPKV Rahuri (Mahatma Phule Krishi Vidyapeeth, Maharashtra).
3. **Tier 3: National Government Standards & Regulatory Guidelines**:
   - Ministry of Agriculture & Farmers Welfare (MoA&FW) Soil Health Card Scheme Standard Operational Guidelines (2015).
   - National Food Security Mission (NFSM) crop development guidelines.
4. **Tier 4: International Agricultural Organizations**:
   - Food and Agriculture Organization (FAO): Irrigation & Drainage Paper No. 56 (*Crop Evapotranspiration*) and Paper No. 33 (*Yield Response to Water*).
   - FAO EcoCrop Database.
   - International Rice Research Institute (IRRI) & ICRISAT.

Every cited document, webpage, URL, publication year, section, and table is indexed in `reports/phase_3c_3_source_registry.csv`.

---

## 4. Foundational Agronomic Distinctions

A primary contribution of this audit is resolving five widespread agronomic conflations present in FieldWise's implementation:

### 4.1 Recommended Dose of Fertilizers (RDF) vs. Soil Test Nutrient Availability
- **Conflation**: FieldWise prompts the user for "Soil Nitrogen, Phosphorus, Potassium" but evaluates inputs against ranges like Rice: N 80–120, P 40–60, K 40–60.
- **Agronomic Fact**: In Indian agronomy, 80–120 kg/ha N represents the **Recommended Dose of Fertilizers (RDF)** applied to the crop as Urea. In contrast, **Soil Test Available Nitrogen** (measured via alkaline permanganate) ranges from $<280$ kg/ha (Low) to $280–560$ kg/ha (Medium) to $>560$ kg/ha (High).
- **Impact**: When a farmer enters actual Soil Health Card test values (e.g. Medium soil N = 320 kg/ha), FieldWise treats it as extreme excess and awards 0 points!

### 4.2 Monthly Rainfall vs. Total Growing Season Water Requirement
- **Conflation**: FieldWise sets Rice rainfall to 150–300 mm, Wheat to 50–100 mm, and Sugarcane to 120–250 mm.
- **Agronomic Fact**: Rice requires **1200–2000 mm** of water across its life cycle; Sugarcane requires **1500–2500 mm**; Wheat requires **350–500 mm** (FAO Paper 56). 150–300 mm represents the rainfall of a *single monsoon month* in Eastern India, or 2 flood irrigations.
- **Impact**: Farmers with 1000 mm annual rainfall have Rice penalized to zero rainfall score. Arid farmers with 200 mm rain and no irrigation are given full rainfall points for Rice and Sugarcane.

### 4.3 Sowing Temperature vs. Growing Season Thermal Optima
- **Conflation**: A single scalar temperature is checked against $[T_{\min}, T_{\max}]$.
- **Agronomic Fact**: Crops have distinct thermal limits at different phenological stages:
  - *Potato*: Vegetative growth thrives at 20–25°C, but tuberization requires night temperatures strictly between 12–16°C. Tuber formation is severely inhibited $>20°C$ and completely stops at $>25°C$ (ICAR-CPRI).
  - *Wheat*: Requires cool temperatures (10–15°C) during germination and tillering. Sowing in hot weather ($>28°C$) causes seed mortality and absence of vernalization.
  - *Tomato*: Pollen viability and fruit set collapse at day temperatures $>32°C$ or night temperatures $<13°C$ (ICAR-IIHR).

### 4.4 Rainfed Dryland vs. Irrigated Cultivation
- **Conflation**: The engine assumes that rainfall alone dictates water feasibility.
- **Agronomic Fact**: Over 50% of Indian net sown area is irrigated (e.g. Punjab/Haryana wheat is 98% irrigated; Tamil Nadu sugarcane is 100% irrigated). In irrigated tracts, rainfall of 50 mm is completely irrelevant because crop water is supplied via canal/tubewell. In dryland tracts (Rajasthan, Marathwada), rainfall of 50 mm without irrigation will cause 100% crop death for anything other than Pearl Millet, Sorghum, or Moth Bean.

### 4.5 Soil Nutrient Availability vs. Soil Texture Physics
- **Conflation**: Soil is scored as an optional 20-point bonus.
- **Agronomic Fact**: Soil physical texture is an absolute biological gate:
  - *Groundnut*: Gynophores (pegs) must physically penetrate the soil surface to develop pods. Heavy sticky clays cause peg breakage and harvest losses $>50\%$. Loose friable sandy loam is mandatory.
  - *Potato*: Heavy clay causes compaction, poor aeration, and misshapen, unmarketable tubers.
  - *Maize & Pulses*: Water stagnation in poorly drained heavy clay causes root asphyxiation and seedling death within 24–48 hours.

---

## 5. Comprehensive Crop-by-Crop Agronomic Audit

Each of the 19 crops was audited across 10 parameters (190 evaluations total). The complete evidence matrix is archived in `reports/phase_3c_3_agronomic_evidence_matrix.csv`. Below is the synthesis across commodity groups:

### 5.1 Cereal Crops (Rice, Wheat, Maize, Barley)
- **Rice**: Thermal range [20, 35]°C, humidity [70, 95]%, and clay/alluvial soils are strongly supported (Class A). Rainfall [150, 300] mm is **Class D (Defective)**; seasonal requirement is 1200–1800 mm. Backend soil list erroneously omits Clay Loam.
- **Wheat**: Rabi thermal range [10, 25]°C and loamy/alluvial soils are Class A. Winter rainfall [50, 100] mm is Class B (requires explicit qualifier that 4–6 irrigations are mandatory). Season constraint is completely missing from prediction execution.
- **Maize**: Temperature [18, 32]°C and well-drained soils are Class A. Rainfall [80, 150] mm is Class D (seasonal water is 500–750 mm).
- **Barley**: Missing from backend database (Class High Inconsistency). Highly tolerant of alkaline soils (pH up to 8.5) and drought (200–350 mm water). Class A on thermal and soil parameters.

### 5.2 Pulse Crops (Chickpea, Lentil)
- **Chickpea**: Sowing temp [15, 28]°C and loamy/black soils are Class A. Legume fixes nitrogen; starter N is 20–30 kg/ha. Rainfall [40, 70] mm is Class D (seasonal water is 250–350 mm). Must be hard-gated against Kharif sowing.
- **Lentil**: Cold-hardy Rabi pulse. Backend minimum temperature of 5°C conflicts with canonical 12°C. Low humidity tolerance (45–70%) is Class A. Highly sensitive to waterlogging.

### 5.3 Oilseed Crops (Soybean, Groundnut, Mustard, Sunflower)
- **Soybean**: Kharif season, black Vertisols, and [20, 32]°C are Class A. Fixes atmospheric N; starter N 20–30 kg/ha. Rainfall [65, 100] mm is Class D (seasonal water 450–650 mm).
- **Groundnut**: Requires loose sandy loam for peg penetration (Class A). Calcium (Gypsum 200–400 kg/ha) is critical for pod filling. Alkaline soils (pH > 8.0) induce severe iron chlorosis.
- **Mustard**: Sowing window Sept 25 – Oct 20 (Class A). Sulphur (20–40 kg/ha) is essential for oil synthesis. Rainfall [30, 60] mm is Class D (needs 250–400 mm).
- **Sunflower**: Missing from backend database. Day-neutral; multi-season (Class B). Boron is mandatory at ray floret stage.

### 5.4 Commercial Cash Crops (Cotton, Sugarcane)
- **Cotton**: Black cotton soils (Vertisols), temperature [21, 35]°C, and dry weather during boll opening are Class A. Rainfall [60, 110] mm is Class D (needs 650–1000 mm).
- **Sugarcane**: 10–18 month duration. Backend labels it "Kharif" (**Class C Conflict**; frontend correctly labels "Annual"). True water requirement is 1500–2500 mm (15–25 irrigations). FieldWise's 120–250 mm bracket is understated by 10x (Class D).

### 5.5 Vegetable & Tuber Crops (Potato, Tomato, Onion)
- **Potato**: Tuberization night temperature must be 12–16°C; tuberization ceases $>25°C$ (Class B). Loose sandy loam and slightly acidic pH (5.0–6.5) are Class A (pH > 7.0 promotes common scab).
- **Tomato**: Fruit set collapses $>32°C$ and $<13°C$ (Class A). Backend base yield (20 t/ha) conflicts with frontend (35 t/ha) (**+75% delta**). Calcium is critical to prevent blossom-end rot.
- **Onion**: Bulbing requires warm sunny days (20–30°C) following cool vegetative growth (Class A). Heavy clay soils cause deformed bulbs and rot.

### 5.6 Horticultural Fruit Crops (Banana, Mango)
- **Banana**: Missing from frontend fallback engine. High potassium feeder (180–300 kg/ha K2O) and massive water consumer (1500–2200 mm). 11–14 months duration (Annual/Perennial).
- **Mango**: Missing from frontend fallback engine. Perennial orchard fruit. Dry weather during flowering is mandatory; rain triggers powdery mildew and anthracnose leading to 100% blossom drop.

### 5.7 Millets & Nutri-Cereals (Jowar, Millets / Bajra)
- **Jowar (Sorghum)**: Missing from frontend fallback engine. Drought-hardy, deep black soil adapted, dual-season (Kharif/Rabi).
- **Millets (Pearl Millet / Bajra)**: Missing from backend database. Exceptional heat tolerance (up to 42°C) and arid sandy soil adaptation. Low water requirement (300–450 mm).

---

## 6. Backend vs. Frontend Engine Consistency & Split-Brain Risks

A comprehensive programmatic audit comparing `model/cropDatabase.js`, `model/fertilizerDatabase.js`, and `src/lib/predictorEngine.ts` cataloged **102 specific discrepancy records** (archived in `reports/phase_3c_3_backend_frontend_consistency.csv`).

```
                              FIELDWISE ARCHITECTURAL SPLIT-BRAIN
                              
         ONLINE BACKEND DATABASE                           OFFLINE FRONTEND ENGINE
        (model/cropDatabase.js)                           (src/lib/predictorEngine.ts)
      ┌───────────────────────────┐                     ┌───────────────────────────┐
      │ Total Crops: 16           │                     │ Total Crops: 16           │
      │ Unique: Banana, Mango,    │                     │ Unique: Sunflower, Barley,│
      │         Jowar             │                     │         Millets           │
      │ Sugarcane: Season=Kharif  │                     │ Sugarcane: Season=Annual  │
      │ Tomato Yield: 20.0 t/ha   │                     │ Tomato Yield: 35.0 t/ha   │
      │ Sugarcane Yield: 80 t/ha  │                     │ Sugarcane Yield: 70 t/ha  │
      │ Mustard Fert: +Boron 1.5kg│                     │ Mustard Fert: +Gypsum 25kg│
      └─────────────┬─────────────┘                     └─────────────┬─────────────┘
                    │                                                 │
                    │               SHARED (13 CROPS)                 │
                    └────────────► Parameter Deltas ◄─────────────────┘
                                   - NPK boundaries divergent
                                   - Soil whitelists divergent
                                   - Temp & rain limits divergent
```

### 6.1 Catalog Asymmetry
- When the backend API is online, users can receive recommendations for `banana`, `mango`, and `jowar`, but **never for `sunflower`, `barley`, or `millets`**.
- When the user's internet drops and `api.ts` invokes the offline fallback engine, `banana`, `mango`, and `jowar` **vanish completely from the application**, replaced by `sunflower`, `barley`, and `millets`.

### 6.2 Base Yield & Fertilizer Formulation Divergences
- Tomato yield projection jumps by **+75.0%** (20 t/ha to 35 t/ha) simply by disconnecting from the network.
- Sugarcane yield drops by **-12.5%** (80 t/ha to 70 t/ha).
- For Tomato, the backend prescribes 200–250 kg/ha Urea, whereas the frontend prescribes 120–150 kg/ha (a 67% dosage delta).
- For Mustard, the backend prescribes a Boron foliar spray, while the frontend prescribes a basal Gypsum application.

---

## 7. Empirical Stress-Testing Scenarios

Five edge-case test scenarios were executed across both engines. Full details are presented in Section 4 of `reports/phase_3c_3_engine_safety_audit.md`.

```
========================================================================================
                          SCENARIO STRESS-TEST RESULTS
========================================================================================
Scenario S1 (Arid Drought: 40mm Rain, 38°C, Sandy Soil):
  - Backend:  Lentil (55.2%), Jowar (53.8%), Chickpea (50.0%), Cotton (46.1%), Mango (40.1%)
  - Frontend: Millets (61.8%), Chickpea (46.3%), Cotton (46.1%), Barley (45.0%)
  -> HAZARD: Cool-season winter pulses (Lentil, Chickpea) recommended in 38°C desert summer.

Scenario S2 (Monsoon High Rain: 1200mm Rain, Clay Soil, 29°C):
  - Backend:  Rice (80.0%), Mango (59.9%), Cotton (54.4%), Onion (54.2%), Wheat (51.7%)
  - Frontend: Rice (80.0%), Cotton (72.5%), Wheat (51.7%), Maize (49.1%)
  -> HAZARD: Wheat, Onion, and Cotton recommended in waterlogged submerged wetland.

Scenario S3 (Peak Kharif Heat: July, 35°C, 180mm Rain, Loam Soil):
  - Backend:  Rice (99.0%), Maize (92.1%), Sugarcane (87.9%), Onion (72.2% [Rabi])
  - Frontend: Rice (99.0%), Maize (92.1%), Sugarcane (89.9%), Wheat (67.6% [Rabi])
  -> HAZARD: Winter crops (Wheat, Onion) recommended during scorching July monsoon heat.

Scenario S4 (Severe Soil Alkalinity: pH 9.2, Sandy Loam):
  - Backend:  Mango (87.3%), Groundnut (83.6%), Chickpea (80.6%), Wheat (78.5%)
  - Frontend: Sunflower (86.9%), Barley (83.3%), Maize (78.2%), Groundnut (75.4%)
  -> HAZARD: Highly sensitive legumes (Chickpea, Groundnut) recommended with >80% conf.

Scenario S5 (Real-World Soil Health Card: N=320 kg/ha, K=210 kg/ha):
  - Backend:  Banana (85.8%), Sugarcane (81.8%), Rice (64.3%)
  -> HAZARD: Primary nutrients (N, K) penalized to 0.0/20 points due to unit confusion.
========================================================================================
```

---

## 8. Severity Classifications & Audit Finding Log

All findings are classified according to practical agricultural risk:

### Critical Severity (Materially unsafe; guarantees severe financial/crop loss)
1. **Additive Scoring without Limiting Factors**: Allows crops with lethal heat, drought, or soil incompatibilities to achieve high confidence scores ($C > 60\%$).
2. **Absence of Sowing Season Filtering**: Recommends winter Rabi crops in summer Kharif conditions, leading to complete germination failure.
3. **Rainfall Semantic Distortion**: Understates crop water requirements by 5x–10x, misadvising arid farmers to plant wetland crops and penalizing high-rainfall paddy farmers.

### High Severity (Major crop requirement or regional-context mismatch)
1. **Catalog Asymmetry**: 6 disjoint crops between backend and frontend engines (3 backend-only, 3 frontend-only).
2. **Soil Health Card Conflation**: Treats fertilizer application rates (RDF) as soil test ceilings, penalizing fertile soils.
3. **Toxicity Blindness for Soil pH**: Treats pH as an optional bonus (+10), failing to penalize alkaline/sodic soils (pH > 8.5) or acid sulfate soils (pH < 4.5).
4. **Base Yield Discrepancies**: Tomato yield diverges by +75% between backend (20 t/ha) and frontend (35 t/ha).
5. **Sugarcane Season Conflict**: Backend labels Sugarcane as a 4-month "Kharif" crop instead of a 12–18 month "Annual" crop.

### Medium Severity (Incomplete evidence, unit ambiguity, or formulation differences)
1. **Fertilizer Prescription Divergences**: Conflicting fertilizer dosages and carrier nutrients for Mustard, Tomato, and Onion.
2. **Soil Whitelist Inconsistencies**: Rice backend lacks Clay Loam; Wheat backend lacks Alluvial; Cotton backend lacks Clay.
3. **Thermal Stage Ambiguity**: Lacks explicit distinction between daytime vegetative temperature and night tuberization/vernalization temperatures.

### Low Severity (Non-material naming and display differences)
1. **Display Name Discrepancies**: 'Rice' vs. 'Rice (Paddy)'; 'Maize' vs. 'Maize (Corn)'; 'Groundnut' vs. 'Groundnut (Peanut)'.

---

## 9. Final Governance Verdicts

```
========================================================================================
                               FINAL AUDIT VERDICTS
========================================================================================
1. Canonical Crop Taxonomy Quality:           APPROVED WITH LIMITATIONS
2. Agronomic Parameter Evidence Quality:       REQUIRES CORRECTION
3. Backend Rule Engine Defensibility:          REQUIRES CORRECTION
4. Frontend Fallback Consistency:             REQUIRES CORRECTION
5. Suitability for Controlled Code Changes:   APPROVED WITH LIMITATIONS
6. Production Readiness:                      REJECTED
========================================================================================
```

### Detailed Rationale for Verdicts:
1. **Canonical Taxonomy (Approved with limitations)**: The 19 crops represent an excellent agronomic scope for Indian agriculture. It is approved as a reference catalog, provided NPK is explicitly labeled as RDF and rainfall is recalibrated.
2. **Parameter Evidence (Requires correction)**: While thermal and soil parameters are well-supported, the rainfall brackets (30–300 mm) are defective and must be updated to seasonal water requirements.
3. **Backend Engine (Requires correction)**: Additive scoring cannot be defended agronomically. It must be refactored to enforce hard Liebig limiting factors.
4. **Frontend Fallback (Requires correction)**: Split-brain catalogs and divergent yields make offline fallback inconsistent with online behavior.
5. **Suitability for Controlled Code Changes (Approved with limitations)**: The evidence matrix and discrepancy log provide an exact, objective specification for refactoring the heuristic engine in future phases.
6. **Production Readiness (Rejected)**: In strict adherence to Phase 3C.3 scope, production deployment is rejected until hard gating and catalog synchronization are implemented and verified.

---

## 10. Prescriptive Remediation Plan for Phase 3C.4

To resolve these defects in future implementation phases:

1. **Implement Tier 1 Hard Agronomic Gating**:
   - Filter candidate crops through boolean gates before calculating suitability scores:
     - $\text{Season} \in \text{Crop.seasons}$
     - $\text{Available Water} \ge \text{Crop.minimum\_water\_threshold}$
     - $\text{Soil Texture} \in \text{Crop.soil\_types}$
     - $(\text{Crop.ph}_{\min} - 0.5) \le \text{Soil.pH} \le (\text{Crop.ph}_{\max} + 0.5)$
2. **Synchronize Backend & Frontend Catalogs (Single Source of Truth)**:
   - Establish `canonical_crop_taxonomy.json` as the sole configuration source.
   - Ensure all 19 crops exist in both `cropDatabase.js` and `predictorEngine.ts`.
   - Harmonize yields and fertilizer prescriptions.
3. **Calibrate Soil Health Card Nutrient Scoring**:
   - Convert farmer NPK inputs to Soil Fertility Status (Low / Medium / High) based on DAC&FW rating limits, and score alignment with crop nutrient demand.
4. **Recalibrate Water Requirements**:
   - Explicitly query the user for **Irrigation Availability** (Unirrigated/Rainfed, 1–2 Protective Irrigations, Canal/Tubewell Fully Irrigated).
   - Evaluate seasonal crop water requirement ($ET_c$) against Total Effective Water ($\text{Rainfall} + \text{Irrigation Capacity}$).

---

*Report authored by FieldWise Agronomic Validation Authority*,  
*Model / ML Pipeline Engineering Team*
