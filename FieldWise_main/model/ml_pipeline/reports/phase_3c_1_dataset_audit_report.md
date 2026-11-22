# FieldWise — Phase 3C.1: Crop Recommendation Dataset Audit Report

**Date**: 2026-11-19T12:45:00Z  
**Phase**: Phase 3C.1 (Dataset Discovery, Provenance Assessment, Quality Auditing, and Preparation Planning)  
**Scope**: Model / ML Pipeline (`FieldWise_main/model/ml_pipeline/`)  
**Status**: Completed  
**Model Training / Evaluation Status**: Strictly **NONE** (Zero models trained, fitted, or evaluated)  
**Application Preservation Status**: Complete Isolation. Existing frontend, backend APIs, Supabase database, `model/predictor.js`, `model/cropDatabase.js`, `model/fertilizerDatabase.js`, and `src/lib/predictorEngine.ts` strictly **UNTOUCHED / PRESERVED**.

---

## 1. Executive Summary & Audit Verdict

This report presents a comprehensive, reproducible mathematical, statistical, and agronomic audit of candidate datasets available for developing a machine learning-based crop recommendation engine for FieldWise, specifically focusing on Indian agricultural conditions.

### Primary Audit Verdicts

| Dimension / Context | Audit Verdict | Formal Classification | Key Rationale |
| :--- | :---: | :---: | :--- |
| **Algorithmic Benchmark Experiments** | ✅ **APPROVED** | **Verdict A (Suitable for controlled benchmark experiments)** | Well-conditioned, 2,200-row tabular benchmark with zero missing values and balanced 100 rows/class across 22 crops. Excellent for verifying training pipelines, baseline classifiers (Random Forest, Gradient Boosting, MLP), and API orchestration. |
| **Production Farm-Level Agronomic Deployment** | ❌ **REJECTED** | **Verdict C (Insufficient provenance & agronomic fidelity for modeling)** | Synthetically sampled uniform hyper-rectangles in 7D space; lacks soil type, state, district, season, and irrigation; omits 12 major Indian staples (including Wheat, Sugarcane, Potato, Mustard, Onion); exhibits 98.3% artificial linear separability that inflates benchmark accuracy to ~99% while failing under real field conditions. |

```
                       ┌────────────────────────────────────────────────────────┐
                       │   Available Crop Recommendation Dataset (2,200 Rows)   │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                        ┌──────────────────────────┴──────────────────────────┐
                        ▼                                                     ▼
        ┌───────────────────────────────┐                     ┌───────────────────────────────┐
        │   Controlled ML Benchmark     │                     │   Production Farm Advice      │
        │   Track (7 Overlapping Crops) │                     │   Track (19 Canonical Crops)  │
        ├───────────────────────────────┤                     ├───────────────────────────────┤
        │ • Rice, Maize, Cotton, etc.   │                     │ • All 19 FieldWise Staples    │
        │ • Algorithmic scaffolding     │                     │ • ICAR / TNAU Physiological   │
        │ • Feature importance analysis │                     │   Envelopes & Soil Filters    │
        │ • Verdict A: APPROVED         │                     │ • Verdict C: REJECTED FOR ML  │
        └───────────────────────────────┘                     └───────────────────────────────┘
```

---

## 2. Dataset Discovery & Repository Inventory

An exhaustive audit of the `FieldWise_main` repository identified all potential recommendation and agronomic datasets:

| Dataset / Asset Name | File Location | Format / Size | Rows / Cols | Provenance Category | Summary Description |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`kaggle_crop_recommendation_benchmark.csv`** | `data/raw/` | CSV (150 KB) | 2,200 × 8 | **Category C: Augmented Benchmark** | The primary 7-feature crop recommendation dataset published on Kaggle by Atharva Ingle (Apache 2.0). Contains 22 crop classes with exactly 100 observations each. |
| **`cleaned_crop_recommendation_benchmark.csv`** | `data/processed/` | CSV (266 KB) | 2,200 × 10 | **Category C: Augmented Benchmark** | Normalized version of the Kaggle benchmark with lowercase labels and explicit provenance tags (`provenance`, `data_category`). |
| **`canonical_crop_taxonomy.json` / `.csv`** | `reports/` | JSON (19 KB) / CSV (4.5 KB) | 19 crops | **Category B: Agronomic Ranges** | Expert-curated agronomic requirements compiled from ICAR, State Agricultural Universities (SAUs), and TNAU Agritech Portal across all 19 FieldWise canonical crops. |
| **`cropDatabase.js`** | `model/` | JS (8.7 KB) | 16 crops | **Category B: Agronomic Ranges** | Backend agronomic database with min/max rainfall, temperature, humidity, soil types, NPK ranges, and pH ranges. |
| **`predictorEngine.ts`** | `src/lib/` | TS (15 KB) | 16 crops | **Category B: Agronomic Ranges** | Frontend client-side rule scoring engine combining agronomic bounds with soil and fertilizer recommendations. |
| **`agriculture_in_india.csv`** | `data/raw/` | CSV (25 MB) | 246,091 × 7 | **Historical Production Statistics** | Ministry of Agriculture & Farmers Welfare (1997–2015). Production and yield only; contains no soil NPK or weather features; cannot support recommendation directly. |
| **`district_rainfall_normal.csv`** | `data/raw/` | CSV (164 KB) | 641 × 20 | **Historical Meteorological Normals** | IMD 30-year normal rainfall by district. Useful as an agronomic prior, but lacks soil test attributes and crop ground truth. |

---

## 3. Provenance and Reliability Audit

Every claim in this section explicitly distinguishes **Verified Facts**, **Source-Reported Information**, and **Assumptions**.

### Detailed Provenance Assessment

| Dimension | Audit Finding | Verification Basis |
| :--- | :--- | :--- |
| **Dataset Name** | Crop Recommendation Dataset (`kaggle_crop_recommendation_benchmark.csv`) | Verified from repository file header and metadata. |
| **Original Author / Publisher** | Atharva Ingle (`atharvaingle`) | Source-reported Kaggle repository metadata. |
| **Download URL** | `https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset` | Source-reported public Kaggle URL. |
| **License & Permitted Usage** | Apache License 2.0 (Permissive open source) | Source-reported on Kaggle repository. |
| **Original Publication / Context** | "Data fields: N, P, K, temperature, humidity, ph, rainfall, label. Built by augmenting Indian climate and soil research data." | Source-reported text in dataset documentation. |
| **Data Nature / Generation** | **Synthetic / Augmented Bounding-Box Sampling** | **Mathematically Verified Fact** (proven via statistical tests below). The data consists of pseudo-random uniform draws within axis-aligned hyper-rectangles per crop. |
| **Real Field Measurements** | **0 records are real farm measurements** | **Verified Fact**. There are no farm IDs, GPS coordinates, sensor logs, or laboratory test certificates. Real soil/weather variables never exhibit zero intra-crop correlation or fixed-width integer bounds. |
| **Geographic Coverage** | **None** (Zero state, district, or agro-ecological zone identifiers) | Verified Fact. The dataset provides no geographic coordinates or regional descriptors. |
| **Temporal Coverage** | **None** (Zero timestamp, year, season, or observation window) | Verified Fact. Scalar values fail to specify whether temperature/humidity represent daily, monthly, or annual means. |
| **Indian Conditions Representation** | **Partial / Caricatured** | The crop centroids loosely correspond to general Indian agronomic literature envelopes, but lack regional nuance, soil series compatibility, and climate variability. |

---

## 4. Mathematical & Data Quality Audit

### Comprehensive Dataset-Level Statistics

A complete audit of `kaggle_crop_recommendation_benchmark.csv` yielded the following verified metrics:

- **Total Records**: 2,200 rows
- **Total Columns**: 8 columns (7 numeric features + 1 string label)
- **Missing Values**: **0 (0.00%)** across all columns
- **Infinite Values**: **0 (0.00%)** (`np.inf` or `-np.inf`)
- **Exact Duplicate Rows**: **0 (0.00%)**
- **Feature-Only Duplicate Rows**: **0 (0.00%)**
- **Conflicting Label Duplicate Rows**: **0 (0.00%)**
- **Target Classes**: 22 unique crop labels
- **Class Balance**: Exactly **100 rows per class (4.545%)** across all 22 classes (perfect class balance)

### Feature Summary Statistics Table

| Feature Name | Dtype | Min | Max | Mean | Median | Std Dev | P25 | P75 | IQR | Skewness | Kurtosis |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Nitrogen (N)** | `int64` | 0 | 140 | 50.55 | 37.00 | 36.92 | 21.00 | 84.25 | 63.25 | +0.510 | -1.058 |
| **Phosphorus (P)** | `int64` | 5 | 145 | 53.36 | 51.00 | 32.99 | 28.00 | 68.00 | 40.00 | +1.011 | +0.860 |
| **Potassium (K)** | `int64` | 5 | 205 | 48.15 | 32.00 | 50.65 | 20.00 | 49.00 | 29.00 | +2.375 | +4.449 |
| **Temperature (°C)** | `float64` | 8.83 | 43.68 | 25.62 | 25.60 | 5.06 | 22.77 | 28.56 | 5.79 | +0.185 | +1.233 |
| **Humidity (%)** | `float64` | 14.26 | 99.98 | 71.48 | 80.47 | 22.26 | 60.26 | 89.95 | 29.69 | -1.092 | +0.302 |
| **Soil pH** | `float64` | 3.50 | 9.94 | 6.47 | 6.43 | 0.77 | 5.97 | 6.92 | 0.95 | +0.284 | +1.656 |
| **Rainfall (mm)** | `float64` | 20.21 | 298.56 | 103.46 | 94.87 | 54.96 | 64.55 | 124.27 | 59.72 | +0.966 | +0.607 |

---

## 5. Mathematical Proof of Synthetic Generation

Our statistical audit uncovered undeniable mathematical evidence that the 2,200 records were synthetically generated rather than collected from farm trials:

### Proof 1: Fixed-Width Integer Bounding Boxes for N, P, and K
Across all 22 crop classes, the range ($\Delta = \text{Max} - \text{Min}$) for N, P, and K is strictly identical or bounded:
- **$\Delta N = \text{Max}(N) - \text{Min}(N) = 40\text{ units}$** for 20 out of 22 crops (39 for Rice and Papaya due to boundary rounding).
- **$\Delta P = \text{Max}(P) - \text{Min}(P) = 25\text{ units}$** for 21 out of 22 crops (24 for Papaya).
- **$\Delta K = \text{Max}(K) - \text{Min}(K) = 10\text{ units}$** for **100% (22/22)** of all crops without exception!

For a continuous uniform random variable $U(a, b)$ of length $L = b - a$, the theoretical standard deviation is $\sigma = L / \sqrt{12}$:
- For $L_N = 40$: $\sigma_{\text{theoretical}} = 40 / 3.4641 = 11.55$. Across all 22 crops in the dataset, the observed mean standard deviation is **$11.93 \pm 0.52$**.
- For $L_P = 25$: $\sigma_{\text{theoretical}} = 25 / 3.4641 = 7.22$. Observed mean standard deviation is **$7.56 \pm 0.34$**.
- For $L_K = 10$: $\sigma_{\text{theoretical}} = 10 / 3.4641 = 2.89$. Observed mean standard deviation is **$3.13 \pm 0.15$**.

The Kolmogorov-Smirnov test for uniformity on the per-crop N, P, and K distributions yields p-values consistently supporting the uniform distribution hypothesis (e.g. Chickpea $P\text{-value} = 0.953$, Rice $N\text{-value} = 0.685$).

### Proof 2: Zero Intra-Crop Feature Correlation
In genuine agricultural ecosystems, environmental variables are strongly coupled:
- Air temperature and relative humidity have a strong negative thermodynamic correlation ($r < -0.60$).
- Soil pH strongly regulates available phosphorus ($P$) and base cations ($K$).
- Soil available $N, P, K$ correlate with soil organic matter and soil clay fraction.

In this dataset, the mean absolute correlation between features within the same crop class is **$r = 0.0755$** (virtually zero). The maximum correlation between any pair of features within any crop is only $0.289$. This confirms that each feature was sampled as an **independent pseudo-random variable** within its assigned box, completely detached from physical environmental couplings.

### Proof 3: 98.27% Linear Pairwise Separability
Out of all $\binom{22}{2} = 231$ pairwise crop comparisons:
- **227 pairs (98.27%)** are strictly linearly separable by at least one single axis-aligned feature threshold!
- Only **4 pairs (1.73%)** have bounding boxes that overlap across all 7 dimensions (`rice` vs `jute`, `maize` vs `blackgram`, `mothbeans` vs `blackgram`, `mothbeans` vs `lentil`).

```
Pairwise Separability Across 231 Crop Pairs:
  [█████████████████████████████████████████████████░] 98.27% Strictly Separable (227 pairs)
  [█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  1.73% 7D Overlap (4 pairs)
```

**Critical Scientific Consequence**:  
Any decision-tree-based algorithm (Random Forest, XGBoost) trained on this dataset will achieve **>99% cross-validation accuracy** effortlessly by simply placing axis-aligned splits along the bounding box walls. This 99% accuracy is an **illusion of synthetic hypercube separation**; it does NOT reflect genuine ability to recommend crops to an Indian farmer whose field conditions naturally fall between or across these artificial boxes.

---

## 6. Crop Label and Taxonomy Audit

FieldWise maintains a canonical catalog of **19 core Indian agricultural crops** (`canonical_crop_taxonomy.json`), harmonized across frontend and backend engines. Comparing the 22 dataset classes against FieldWise reveals severe structural divergence:

### Taxonomy Overlap Summary
- **FieldWise Canonical Crops**: **19 crops**
- **Overlapping Supported Crops**: **7 crops (36.8% coverage)**
- **FieldWise Staples Missing from Dataset**: **12 crops (63.2% missing)**
- **Dataset Crops Unsupported by FieldWise**: **15 crops**

### 1. Overlapping Supported Crops (7 Crops)
These 7 crops exist in both the 2,200 benchmark dataset and FieldWise's primary catalog:
1. `rice` $\to$ **Rice (Paddy)** (*Oryza sativa*, Poaceae, Cereal) — Exact match.
2. `maize` $\to$ **Maize (Corn)** (*Zea mays*, Poaceae, Cereal) — Exact match.
3. `cotton` $\to$ **Cotton** (*Gossypium hirsutum*, Malvaceae, Fiber) — Exact match.
4. `chickpea` $\to$ **Chickpea (Gram)** (*Cicer arietinum*, Fabaceae, Pulse) — Semantic equivalent.
5. `lentil` $\to$ **Lentil (Masoor)** (*Lens culinaris*, Fabaceae, Pulse) — Semantic equivalent.
6. `banana` $\to$ **Banana** (*Musa acuminata*, Musaceae, Fruit) — Supported in backend DB.
7. `mango` $\to$ **Mango** (*Mangifera indica*, Anacardiaceae, Fruit) — Supported in backend DB.

### 2. Critical FieldWise Indian Staples Absent from Dataset (12 Crops)
The 22-class benchmark dataset **completely omits 12 of India's most important staple crops**:
1. **Wheat (*Triticum aestivum*)**: India's #2 food staple and dominant Rabi cereal (over 30M ha).
2. **Sugarcane (*Saccharum officinarum*)**: India's primary commercial cash crop (over 5M ha).
3. **Soybean (*Glycine max*)**: India's leading Kharif oilseed (Madhya Pradesh & Maharashtra).
4. **Groundnut (*Arachis hypogaea*)**: Major oilseed and cash legume (Gujarat & Andhra Pradesh).
5. **Potato (*Solanum tuberosum*)**: Leading vegetable tuber staple (Uttar Pradesh, West Bengal, Bihar).
6. **Mustard (*Brassica juncea*)**: Dominant Rabi oilseed across North/Central India.
7. **Tomato (*Solanum lycopersicum*)**: Major horticulture crop cultivated nationwide.
8. **Onion (*Allium cepa*)**: Core commercial vegetable staple (Maharashtra, Karnataka, Gujarat).
9. **Jowar / Sorghum (*Sorghum bicolor*)**: Key climate-resilient dryland nutri-cereal.
10. **Bajra / Pearl Millet (*Pennisetum glaucum*)**: Dominant arid/semi-arid dryland cereal.
11. **Barley (*Hordeum vulgare*)**: Major commercial Rabi cereal.
12. **Sunflower (*Helianthus annuus*)**: Commercial edible oilseed.

> [!WARNING]
> An ML recommendation model trained on this dataset cannot recommend Wheat, Sugarcane, Mustard, Potato, or Soybean to any Indian farmer. Silently deploying this model in a production app would mean an Indian farmer asking for a winter (Rabi) crop recommendation in Punjab or Uttar Pradesh could NEVER be recommended Wheat or Mustard.

### 3. Dataset Classes Unsupported by FieldWise (15 Crops)
The dataset includes 15 specialty, orchard, or horticultural crops outside FieldWise's staple catalog:
- **Specialty Pulses**: `blackgram` (Urad), `mungbean` (Moong), `mothbeans` (Matki), `pigeonpeas` (Arhar/Tur), `kidneybeans` (Rajma).
- **Specialty Fruits & Plantation**: `apple`, `coconut`, `coffee`, `grapes`, `muskmelon`, `orange`, `papaya`, `pomegranate`, `watermelon`.
- **Fiber**: `jute`.

The complete mapping is permanently archived in `reports/phase_3c_1_crop_label_mapping.csv`.

---

## 7. Feature and Agronomic Suitability Audit

FieldWise's production application accepts **9 farmer inputs**:
1. Rainfall, 2. Temperature, 3. Humidity, 4. Soil Type, 5. Nitrogen, 6. Phosphorus, 7. Potassium, 8. Soil pH, 9. State / Geographic Location.

The 2,200 benchmark dataset supplies only **7 features**, creating fatal agronomic blindspots:

### Agronomic Gap Analysis

| Production Dimension | Dataset Status | Agronomic Impact & Failure Mode |
| :--- | :---: | :--- |
| **Soil Type** | ❌ **MISSING** | Soil texture and mineralogy govern drainage, cation exchange capacity (CEC), and root aeration. Rice requires heavy clay or alluvial soils for water retention; groundnut requires sandy loam for peg penetration; cotton requires vertisols (black cotton soil). Without soil type, an ML model cannot distinguish crop suitability on a sandy soil vs a heavy clay soil. |
| **State / District / Agro-Climatic Zone** | ❌ **MISSING** | Indian agriculture is partitioned into 15 Planning Commission Agro-Climatic Zones. Crops cannot be recommended purely on ambient temperature without latitude, photoperiod, and altitude context. |
| **Cultivation Season** | ❌ **MISSING** | Temperature and rainfall are seasonal. Kharif crops (Rice, Cotton) require monsoon warmth; Rabi crops (Wheat, Mustard, Chickpea) require temperate winter conditions; Zaid crops require summer heat. A model without seasonal context cannot advise a farmer what to sow in October vs June. |
| **Irrigation / Water Availability** | ❌ **MISSING** | The dataset records only raw rainfall. However, over 50% of Indian cropland (and >90% of wheat and sugarcane) is cultivated under tube-well or canal irrigation. A farmer with 50 mm of winter rainfall in Haryana can easily grow Wheat with tube-well irrigation; a model seeing only 50 mm rainfall would incorrectly predict drought failure. |
| **NPK Unit Ambiguity** | ⚠️ **UNVERIFIED** | The dataset labels N, P, K as "ratio of content in soil". Real soil test cards (SHC) report available Nitrogen in kg/ha (alkaline permanganate method), available P2O5 in kg/ha (Olsen's/Bray's method), and available K2O in kg/ha (ammonium acetate). Synthetic numbers confuse soil nutrient supply with crop fertilizer uptake. |
| **Severe Agronomic Incoherence** | ❌ **ANOMALOUS** | - **Apple**: In this dataset, Apple is assigned Temperature 21–24 °C, Humidity 90–95%, and Rainfall 100–125 mm. In reality, Apple (*Malus domestica*) is a temperate deciduous fruit requiring **700 to 1,000 chilling hours below 7 °C**; it dies in humid tropical lowlands.<br>- **Chickpea**: Artificially restricted to **14.26%–19.97% humidity**. In genuine Indian Rabi fields across MP and UP, relative humidity regularly fluctuates between 30% and 70%. |

The complete feature dictionary is permanently archived in `reports/phase_3c_1_feature_dictionary.csv`.

---

## 8. Leakage, Separability & Evaluation Readiness

### Evaluation Risks Identified:
1. **Synthetic Hypercube Memorization**:  
   Because 98.27% of crop pairs are separated by axis-aligned thresholds, standard K-Fold cross-validation will yield ~99% accuracy across standard classification models (Random Forest, Extra Trees, XGBoost). This does not demonstrate machine learning generalizability; it reflects memorization of synthetic bounding boxes.
2. **Conflicting & Near-Duplicate Leakage**:
   - Exact duplicate rows: 0.
   - Exact feature-only duplicate rows: 0.
   - However, within each 100-row crop cluster, observations are uniformly scattered across an extremely narrow box. A random 80/20 train/test split will interpolate between synthetic points, guaranteeing near-zero test error.
3. **Absence of Empirical Ground Truth**:
   Evaluating a model on this synthetic dataset evaluates only how well the model learned the author's bounding box rules—NOT whether the model can predict crop success on real Indian soil.

---

## 9. Final Dataset Suitability Verdict

### Verdict A: Suitable for Controlled Benchmark Experiments (Approved for Experimental Sandbox)
- **Approved Use**: The dataset **IS SUITABLE** for testing ML classifier mechanics, scaffolding data ingestion pipelines, evaluating probability calibration, and benchmarking algorithmic families (Random Forest, Gradient Boosting, MLP) across the 7 overlapping staple crops (`rice, maize, cotton, chickpea, lentil, banana, mango`).
- **Condition**: Results must be explicitly published as **Benchmark Sandbox Accuracy**, with prominent disclaimers that accuracy does not translate to real-world Indian farm conditions.

### Verdict C: Insufficient Provenance and Quality for Production Farm Deployment (Rejected for Production)
- **Rejected Use**: The dataset **IS COMPLETELY UNSUITABLE** for production crop recommendation in FieldWise.
- **Root Causes**:
  1. Synthetic data generation with near-zero intra-crop correlation and artificial linear separability.
  2. Total omission of 12 critical Indian staple crops (Wheat, Sugarcane, Potato, Mustard, Onion, Soybean, etc.).
  3. Total omission of Soil Type, State, District, Cultivation Season, and Irrigation status.
  4. Physically absurd agronomic bounds for key crops (e.g. tropical Apple, ultra-dry Chickpea).

---

## 10. Recommended Next-Phase Plan (Phase 3C.2 Roadmap)

Based on these audit findings, FieldWise must adopt a **two-track architecture** for Phase 3C.2:

```
                                  FIELDWISE PHASE 3C.2 ARCHITECTURE
                                                  │
                 ┌────────────────────────────────┴────────────────────────────────┐
                 ▼                                                                 ▼
   Track 1: Experimental ML Benchmark                               Track 2: Agronomic Expert Engine
   ---------------------------------                                --------------------------------
   • Scope: 7 Overlapping Crops                                     • Scope: All 19 Canonical Crops
   • Data: kaggle_crop_recommendation_benchmark.csv                 • Data: canonical_crop_taxonomy.json
   • Purpose: Algorithm benchmarking & calibration                  • Purpose: Safe, realistic farm recommendations
   • Strict Rule: Documented as synthetic benchmark                 • Filters: Soil Type, Season, State bounds
```

1. **Track 1: Benchmark ML Sandbox Engine (Phase 3C.2A)**:
   - Restrict ML training strictly to the 7 overlapping crops (`banana, chickpea, cotton, lentil, maize, mango, rice`).
   - Implement rigorous stratified train/validation/test splits.
   - Benchmark Multi-class Logistic Regression, Random Forest, and Gradient Boosting.
   - Evaluate feature importance, out-of-distribution rejection, and probability calibration.
   - Document benchmark metrics with explicit provenance tags.
2. **Track 2: Production Multi-Criteria Agronomic Recommendation Engine (Phase 3C.2B)**:
   - Retain and enhance FieldWise's existing rule-based expert recommendation engine for all 19 canonical crops.
   - Ground decisions in published ICAR, SAU, and TNAU agronomic packages of practices (`canonical_crop_taxonomy.json`).
   - Enforce hard agricultural constraints: **Soil Type compatibility**, **State / Agro-Climatic Zone**, and **Season (Kharif / Rabi / Zaid)**.
   - Do NOT fabricate synthetic observations for the 12 missing staple crops to create a pseudo-ML 19-class model.
3. **Data Acquisition Strategy for Real Category A Empirical Data**:
   - Pursue integration of public Indian agricultural trial repositories:
     - **ICAR AICRP (All India Coordinated Research Projects)**: Multilocation yield and nutrient response trials for Wheat, Mustard, Soybean, Sugarcane, Potato.
     - **ICRISAT Open Data**: Semi-arid tropics crop trial records for Sorghum (Jowar), Bajra, Groundnut, and Chickpea.
     - **Soil Health Card (SHC) Portal**: Geotagged farm soil test records paired with farmer-reported crop performance.
