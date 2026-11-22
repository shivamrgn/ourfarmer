# FieldWise — Phase 3A.5 Quality Report: Final Consistency & Training Readiness Audit

**Author**: FieldWise Data Engineering & Agricultural ML Team  
**Date**: November 17, 2026  
**Pipeline Stage**: Phase 3A.5 (Pre-Training Final Consistency, Dynamic Set Equality & Training Readiness Audit)  
**Status**: COMPLETE — ALL INDEPENDENT ASSERTIONS VERIFIED (100% PASSED)  

---

> [!WARNING]
> **SUPERSEDED DOCUMENTATION (HISTORICAL ARCHIVE)**:
> This Phase 3A.5 report has been formally superseded by [`phase_3a_6_training_readiness_report.md`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/phase_3a_6_training_readiness_report.md).
> The tiering classifications below mistakenly labeled 161,270 records as "30 primary crops with verified source passages" and 49,165 records as "30 provisional crops" (these counts actually represent rainfall-matched and unmatched records across all 60 documented crops), and stated 191,249 training records instead of the reconciled 191,270.
> For the authoritative multidimensional eligibility matrix, reconciled chronological split counts (191,270 / 25,398 / 10,905), and machine-readable aggregate/composite crop exclusions (17 crops, 13,819 records), refer exclusively to Phase 3A.6 documentation.

## 1. Executive Summary

Phase 3A.5 provides the final pre-training audit of the agricultural dataset engineering pipeline for FieldWise. Following external peer review of Phase 3A.4, five specific consistency, independence, and architectural requirements were audited and reconciled:

1. **Resolution of the Threshold Reporting Contradiction**:
   - Corrected the misstatement in Phase 3A.4 that "zero records exceed screening threshold $T$".
   - Verified that exactly **68 records across 21 crops** have yields between the agronomic screening threshold $T$ and the extreme plausibility bound $2T$ ($T < \text{Yield} \le 2T$).
   - Clarified that $T$ is an **agronomic screening threshold** (the upper benchmark of standard high-performing commercial farming), NOT an absolute biological ceiling.
   - Confirmed that these 68 records are **retained in the dataset** and flagged for manual agronomic review (e.g. green chillies reported under dry chillies, fresh turmeric rhizomes, intensive drip-fertigated rabi crops) rather than arbitrarily deleted, avoiding artificial high-end distribution truncation.
   - Confirmed that **zero records** exceed the extreme plausibility ceiling of $2T$ (all 47 extreme biological outliers $> 2T$ were dropped during preprocessing).
2. **Improvement of Validation Independence**:
   - Replaced hardcoded row counts (such as Punjab 2011 Sugarcane and Tamil Nadu 1997 Sugarcane) with dynamically reconstructed row-ID sets derived directly from raw masks.
   - Numerically verified the unverified dataset ([`segregated_unverified_unit_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_unverified_unit_yield.csv)) row-by-row against raw $\text{Production} / \text{Area}$ (both raw ratio and converted ratio where applicable; max discrepancy: $0.00000000 \le 0.001$).
   - Enforced **exact dynamic set equality** ($A = B$) for all 6 processed datasets against their independently derived expected row sets.
   - Added pre-merge validation to detect duplicate normalized rainfall keys in `district_rainfall_normal.csv` and asserted zero conflicting rainfall values.
3. **Qualification of Threshold Provenance & Product Basis**:
   - Audited all 60 documented crops, distinguishing **30 verified source passage crops** (supported by specific published varietal trial results from dedicated ICAR institutes) from **30 provisional agronomic estimate crops** (general package of practices or crops with potential product-form ambiguity).
   - Documented the exact **product basis** and moisture characteristics for all 60 crops (e.g. air-dry grain at 12% moisture vs. fresh tuber at 78% moisture vs. cured dry spice at 10% moisture), preventing invalid cross-basis comparisons.
4. **Clarification of Cultivated Area Analysis**:
   - Formally designated the analysis as an **exploratory bivariate correlation analysis** ([`run_area_correlation_analysis.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/run_area_correlation_analysis.py) and [`exploratory_area_correlation_analysis.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/exploratory_area_correlation_analysis.json)).
   - Explicitly clarified that **no machine learning models have been trained** with or without `Cultivated_Area_Ha`, and no empirical predictive performance comparisons have been conducted.
   - Confirmed that `Cultivated_Area_Ha` is strictly excluded from default baseline features due to mathematical coupling ($\text{Yield} = \text{Production} / \text{Area}$) and district-level scale disparity.
5. **Training-Readiness Inventory & Split Design**:
   - Established a 6-tier dataset inventory separating prime eligible training records, provisional crops, retained high observations, unmapped crops, and unresolved rainfall records.
   - Conducted a feature availability gap analysis comparing training data against farm-level inference inputs.
   - Designed a robust **chronological holdout validation strategy** (Train: 1997–2011, Validation: 2012–2013, Test: 2014–2015) to prevent temporal auto-correlation leakage.

All automated assertion tests executed via [`validate_dataset.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/validate_dataset.py) passed with **zero errors**.

---

## 2. Training-Readiness Inventory & Dataset Tiering

To provide complete transparency prior to Phase 3B model development, the processed agricultural dataset is stratified into 6 distinct operational tiers based on unit consistency, documentation rigor, threshold compliance, and climatic matching:

```
+----------------------------------------------------------------------------------------------------+
|                         FIELDWISE HISTORICAL REGRESSION UNIVERSE (227,573 Records)                 |
+----------------------------------------------------------------------------------------------------+
  │
  ├── [TIER 1] Prime Training-Ready Records (Pure Tonnes, Verified Passage, <= T, Matched Rainfall):
  │            161,270 records (70.87% of cleaned dataset) across 30 primary food/commercial crops.
  │
  ├── [TIER 2] Provisional Documented Crops (Pure Tonnes, Provisional Threshold, <= T, Matched Rainfall):
  │            49,165 records (21.60% of cleaned dataset) across 30 minor/horticultural crops.
  │
  ├── [TIER 3] Retained High Observations Flagged for Review (Pure Tonnes, T < Yield <= 2T):
  │            68 records (0.0299% of cleaned dataset) across 21 crops (retained, NOT deleted).
  │
  ├── [TIER 4] Unmapped / Composite Crops under Manual Review (Pure Tonnes, No Documented Ceiling):
  │            17,070 records (7.50% of cleaned dataset) across 37 crops (retained without invented ceiling).
  │
  └── [TIER 5] Records with Unresolved Rainfall Matches (Missing 30-Year Normal Baseline):
               53,210 records (23.38% of cleaned dataset) across 177 state-district pairs.
+----------------------------------------------------------------------------------------------------+
  │
  └── [TIER 6] Segregated Non-Metric-Tonne Datasets (11,093 Records across 5 dedicated files):
               ├── Cotton: 4,327 clean records (Yield_Bales_Per_Ha, 170 kg lint)
               ├── Jute & Mesta: 3,196 clean records (Yield_Bales_Per_Ha, 180 kg fiber)
               ├── Coconut: 1,957 clean records (Yield_Nuts_Per_Ha)
               ├── Arecanut: 1,578 clean records (Yield_Raw_Reported_Per_Ha, state-mixed units)
               └── Unverified Reporting Anomalies: 35 records (12 Sugarcane > 180, 23 Cotton MH 1997 > 10)
```

### Detailed Tier Breakdown:

| Tier | Category Description | Target Unit | Total Records | Retention / Action in Phase 3B |
| :--- | :--- | :---: | :---: | :--- |
| **Tier 1** | **Prime Training-Ready Records**<br>Pure metric tonnes, primary ICAR source passage, yield $\le T$, resolved rainfall normal. | Metric Tonnes / Ha | **$161,270$** ($70.87\%$) | **Immediate Baseline Training**. Highest statistical and agronomic confidence. |
| **Tier 2** | **Provisional Documented Crops**<br>Pure metric tonnes, provisional agronomic estimate threshold, yield $\le T$, resolved rainfall normal. | Metric Tonnes / Ha | **$49,165$** ($21.60\%$) | **Eligible for Secondary / Specialized Models** after agronomist sign-off. |
| **Tier 3** | **Retained High Observations**<br>Pure metric tonnes, documented crop, yield between $T$ and $2T$ ($T < \text{Yield} \le 2T$). | Metric Tonnes / Ha | **$68$** ($0.03\%$) | **Retained in dataset**. Flagged for manual review; can be included in robust regression (e.g. Huber loss) or evaluated separately. |
| **Tier 4** | **Unmapped & Composite Crops**<br>Pure metric tonnes, unmapped or composite species (`other oilseeds`, `Other Vegetables`, etc.). | Metric Tonnes / Ha | **$17,070$** ($7.50\%$) | **Excluded from single-crop models**. Retained in historical database for macro-reference. |
| **Tier 5** | **Unresolved Rainfall Matches**<br>Historical crop records valid, but IMD 30-year normal missing due to administrative bifurcation. | Metric Tonnes / Ha | **$53,210$** ($23.38\%$) | **Imputation or Spatial Fallback Required** (e.g. state-level normal or cartographic parent-district crosswalk) before model ingestion. |
| **Tier 6** | **Segregated Non-Tonne Datasets**<br>Cotton (bales), Jute/Mesta (bales), Coconut (nuts), Arecanut (raw ratio), Unverified unit anomalies. | Declared True Units | **$11,093$** | **Segregated from Pure-Tonne Models**. Eligible for separate crop-specific fiber/nut models. |

---

## 3. Resolution of the Threshold Reporting Contradiction

### 3.1 Background of the Discrepancy
In Phase 3A.4, automated test summaries and report prose stated that:
> *"All records satisfy $\text{Yield} \le T_{\text{crop}}$."*

This phrasing was scientifically and numerically inaccurate. During Phase 3A.3, the pipeline logic was explicitly configured to drop only observations exceeding the **extreme plausibility ceiling of $2T$** (47 records dropped), while retaining observations between $T$ and $2T$ to avoid artificial truncation of high-performing observations:
```python
# clean_yield_data.py (Step 5C):
extreme_outlier_mask = (df_r5_rem['ceiling'].notnull()) & (df_r5_rem['yield_corrected'] > (df_r5_rem['ceiling'] * 2.0))
df_extreme_outliers = df_r5_rem[extreme_outlier_mask].copy() # Dropped 47 records
```

### 3.2 Recalculated Audit Findings
An independent re-audit of [`cleaned_crop_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/cleaned_crop_yield.csv) against [`threshold_provenance.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/threshold_provenance.json) confirms:
- **Total Verified Crop Records**: $210,503$ records across 60 crops.
- **Records $\le T$**: **$210,435$ records** ($99.968\%$).
- **Records between $T$ and $2T$ ($T < \text{Yield} \le 2T$)**: Exactly **$68$ records** ($0.032\%$) across 21 crops.
- **Records exceeding $2T$**: Exactly **$0$ records** ($0.000\%$).

### 3.3 Complete Inventory of Retained Observations Between $T$ and $2T$

The following table documents every crop with observations between $T$ and $2T$, including the screening threshold $T$, maximum observed yield, and agronomic rationale for retention:

| Crop Name | Screening Threshold $T$ ($\text{t/ha}$) | Extreme Bound $2T$ ($\text{t/ha}$) | Retained Records ($T < y \le 2T$) | Max Observed Yield ($\text{t/ha}$) | Agronomic & Reporting Rationale for Retention |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Dry chillies** | $12.0$ | $24.0$ | **$10$** | $16.667$ | Mixed reporting: local districts reported green fresh chillies ($12\text{--}18\text{ t/ha}$) under `Dry chillies` instead of dry cured red pods ($2\text{--}4\text{ t/ha}$). |
| **Onion** | $55.0$ | $110.0$ | **$5$** | $74.043$ | High-density drip fertigation and intensive hybrid rabi cultivation in Nashik/Pune occasionally achieve $60\text{--}75\text{ t/ha}$. |
| **Soyabean** | $6.0$ | $12.0$ | **$5$** | $11.444$ | Intensive irrigated seed multiplication plots or small-district acreage reporting anomalies; plausible under record plot management. |
| **Small millets**| $6.0$ | $12.0$ | **$5$** | $10.198$ | Mixed minor millet reporting (finger/foxtail/proso); unthreshed earhead weight occasionally entered instead of clean grain. |
| **Rapeseed &Mustard**| $5.5$ | $11.0$ | **$5$** | $8.542$ | High-input irrigated Indian mustard (*Brassica juncea*) trial records in Bharatpur/Karnal reach $7.5\text{--}8.8\text{ t/ha}$. |
| **Coriander** | $4.0$ | $8.0$ | **$4$** | $7.059$ | Fresh green herb biomass reported under coriander instead of clean dry seed. |
| **Urad** | $3.5$ | $7.0$ | **$4$** | $6.000$ | Indeterminate spring/summer irrigated blackgram under disease-free intensive management. |
| **Potato** | $60.0$ | $120.0$ | **$3$** | $100.000$ | Record plot yields for early bulking Kufri Pukhraj in Punjab/Western UP under intensive fertigation reach $80\text{--}100\text{ t/ha}$ fresh tuber. |
| **Turmeric** | $20.0$ | $40.0$ | **$3$** | $25.000$ | Fresh green rhizome weight ($18\text{--}25\text{ t/ha}$) reported instead of cured dry rhizome ($3\text{--}5\text{ t/ha}$). |
| **Rice** | $15.0$ | $30.0$ | **$3$** | $15.190$ | Marginal exceedance ($+0.19\text{ t/ha}$) of screening threshold in high-yielding boro rice pockets; well below biological ceiling. |
| **Barley** | $8.0$ | $16.0$ | **$3$** | $10.000$ | Dual-purpose irrigated 6-row feed barley in Punjab/Haryana state crop competitions. |
| **Arhar/Tur** | $4.5$ | $9.0$ | **$3$** | $8.000$ | Long-duration perennial or transplanted hybrid pigeonpea under intensive irrigation. |
| **Niger seed** | $3.0$ | $6.0$ | **$3$** | $5.438$ | Improved line-sown trial plot yields; retained for manual review. |
| **Maize** | $16.0$ | $32.0$ | **$2$** | $25.677$ | Single-cross rabi maize hybrids in Bihar/Andhra Pradesh under full irrigation; potential green cob weight entry. |
| **Guar seed** | $15.0$ | $30.0$ | **$2$** | $15.280$ | Marginal exceedance ($+0.28\text{ t/ha}$); fresh pod harvest reported instead of dry seed. |
| **Jowar** | $8.0$ | $16.0$ | **$2$** | $14.569$ | Irrigated rabi hybrid sorghum in Maharashtra; green fodder biomass occasionally conflated with grain. |
| **Bajra** | $7.0$ | $14.0$ | **$2$** | $13.946$ | Summer irrigated pearl millet hybrids in Gujarat achieving high biomass. |
| **Sannhamp** | $10.0$ | $20.0$ | **$1$** | $14.000$ | Dry unretted whole stalk entered instead of extracted clean fiber. |
| **Groundnut** | $8.0$ | $16.0$ | **$1$** | $14.925$ | High-input summer groundnut record plot in Saurashtra with full drip fertigation. |
| **Sunflower** | $5.0$ | $10.0$ | **$1$** | $10.000$ | High-yielding commercial hybrid record plot under border row effect. |
| **Cashewnut** | $4.0$ | $8.0$ | **$1$** | $7.000$ | High-density dwarf cashew plantation in Goa/Maharashtra at peak bearing age. |

**Total Retained High Observations**: **68 records** across **21 crops**.  
*Action*: These records are **retained** in [`cleaned_crop_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/cleaned_crop_yield.csv) and fully flagged for review. In Phase 3B, modeling pipelines may evaluate sensitivity with and without Tier 3 records or employ robust M-estimators (Huber / Tukey loss) to prevent undue leverage.

---

## 4. Threshold Provenance & Product Basis Qualification

### 4.1 Provenance Status Classification
To qualify the institutional credibility of screening thresholds, all 60 documented crops are categorized into two explicit tiers in [`threshold_provenance.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/threshold_provenance.json):

1. **`verified_source_passage` (30 Crops)**: Supported by published varietal release bulletins, AICRP national trial summaries, or ICAR institute annual reports stating explicit trial maxima or state record plot yields.
   - *Cereals*: Wheat, Rice, Paddy, Maize, Barley, Jowar, Bajra, Ragi.
   - *Pulses*: Gram, Arhar/Tur, Moong(Green Gram), Urad, Masoor, Lentil.
   - *Oilseeds*: Groundnut, Soyabean, Rapeseed &Mustard, Sunflower, Sesamum, Castor seed.
   - *Vegetables & Tubers*: Potato, Onion, Tomato, Cabbage, Tapioca, Sweet potato.
   - *Commercial/Fruits*: Sugarcane, Banana, Papaya, Grapes.
2. **`provisional_agronomic_estimate` (30 Crops)**: Derived from general horticultural package of practices, regional extension guides, or crops with potential commercial processing/moisture ambiguity (e.g. green vs. dry spices, fresh fruit vs. kernel, made tea vs. green leaf).
   - *Spices*: Dry chillies, Dry ginger, Ginger, Turmeric, Garlic, Black pepper, Coriander, Cardamom.
   - *Horticultural Fruits & Veg*: Bhindi, Brinjal, Drum Stick, Pineapple, Mango, Orange, Lemon, Pome Granet, Sapota.
   - *Commercial/Plantation/Fiber*: Guar seed, Sannhamp, Tea, Tobacco, Cashewnut, Cashewnut Raw, Rubber, Coffee.
   - *Minor Crops*: Small millets, Linseed, Horse-gram, Safflower, Niger seed.

### 4.2 Product Basis & Moisture Qualification
A major risk in agricultural yield modeling is silently comparing different product bases as if they were identical. Every crop entry in [`threshold_provenance.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/threshold_provenance.json) now specifies its exact physical harvest form:

- **Fresh Vegetative Stalk / Root**: Sugarcane, Tapioca, Sweet potato, Potato, Cabbage, Tomato. Moisture content is $70\text{--}94\%$. Starch and sugar recovery represent $10\text{--}30\%$ of gross reported mass.
- **Air-Dry Threshed Grain**: Wheat, Rice, Paddy, Maize, Barley, Sorghum, Millets. Normalized strictly to $12\text{--}14\%$ moisture content. Gross vegetative biomass (straw/stover) is $1.2\text{--}2.0\times$ the grain yield.
- **Air-Dry Clean Pulse Seed**: Gram, Arhar/Tur, Moong, Urad, Lentil. Standard moisture $10\text{--}12\%$.
- **Dry Clean Oilseed / Pod**: Groundnut in shell ($7\%$), Soyabean ($8\%$), Mustard ($6\%$), Sunflower ($7\%$), Sesamum ($6\%$).
- **Cured Dry Spices**: Dry chillies ($10\%$), Cured dry turmeric rhizome ($10\%$), Black peppercorn ($11\%$), Cardamom capsule ($10\%$). Fresh-to-dry conversion ratios range from $3:1$ to $5:1$.
- **Commercial Plantation Extracts**: Made black tea ($3\%$ moisture; green leaf is $4.5\times$ made tea), Clean green coffee bean ($11\%$ moisture; fresh cherry is $5.5\times$ green bean), Dry Rubber Content ($1\text{--}2\%$ moisture; field latex is $3\times$ DRC).

> [!IMPORTANT]
> Models must never cross-compare fresh tuber or vegetative yields ($60\text{ t/ha}$) with dry grain yields ($6\text{ t/ha}$) without accounting for the $10\times$ moisture difference.

---

## 5. Exploratory Bivariate Correlation & Cultivated Area Sensitivity

A dedicated review was conducted via [`run_area_correlation_analysis.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/run_area_correlation_analysis.py) and codified in [`exploratory_area_correlation_analysis.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/exploratory_area_correlation_analysis.json).

### 5.1 Clarification of Analysis Scope
This analysis represents an **exploratory bivariate correlation and scale disparity evaluation**.
- **No Machine Learning Models Have Been Trained**: Predictive performance has NOT been evaluated with or without `Cultivated_Area_Ha`.
- **Exclusion from Baseline Features**: `Cultivated_Area_Ha` is strictly excluded from default baseline modeling features due to:
  1. *Mathematical Coupling*: $\text{Yield} = \text{Production} / \text{Cultivated\_Area\_Ha}$. Supplying Area creates an artificial inverse artifact in small areas and allows models to act on area as an offset.
  2. *Scale Disparity*: District historical acreage ($\text{median } 620\text{ ha}$, $\text{mean } 12,031\text{ ha}$, $\text{max } 8.58\text{M ha}$) represents aggregate regional production, whereas farmer parcel input ($0.4\text{--}20\text{ ha}$) represents private landholding.
  3. *Spurious Regional Correlation*: In aggregate data, large acreage indicates prime commercial belts with extensive irrigation, yielding strong positive correlations for staple crops (Wheat Pearson $r = +0.6044$, Potato $r = +0.3307$). Evaluating a farmer's $1\text{ ha}$ plot against this distribution would spuriously predict a severely penalized yield.
- **Strictly Excluded Leakage Column**: `Production` is completely excluded from all feature sets to prevent exact deterministic target leakage ($R^2 = 1.0$).

### 5.2 Baseline Feature Set Specification
The default baseline feature set for Phase 3B historical regression modeling is:
```json
[
  "State",
  "District",
  "Crop_Year",
  "Season",
  "Crop",
  "district_normal_annual_rainfall_mm",
  "district_normal_monsoon_rainfall_mm"
]
```
`Cultivated_Area_Ha` is preserved in the CSV file strictly as an auxiliary column for offline, non-default sensitivity experiments.

---

## 6. Feature Availability Gap Analysis: Training vs. Farm-Level Inference

A fundamental architectural consideration for FieldWise is the difference between features available in historical government training data versus features available when an individual farmer uses the application:

| Feature Dimension | Training Dataset (`cleaned_crop_yield.csv`) | Farm-Level Inference (FieldWise Frontend) | Alignment Status & Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Geographic Location** | `State`, `District` (Administrative text) | GPS Latitude/Longitude $\to$ Reverse geocoded `State`, `District` | **Aligned**. Standardized state and district aliases bridge naming variants. |
| **Crop Identity** | `Crop` (124 historical names mapped to 60 verified + 37 unmapped) | User selects from canonical crop dropdown (19 crops) | **Aligned**. Canonical taxonomy bridges the 19 FieldWise crops to historical labels. |
| **Cropping Season** | `Season` (Kharif, Rabi, Whole Year, Summer, Autumn, Winter) | Auto-detected from month or selected by farmer | **Aligned**. Standard seasonal categories match. |
| **Temporal Trend** | `Crop_Year` (1997–2015) | Current year (e.g. 2026) | **Extrapolation Risk**. Models must not use `Crop_Year` as an unconstrained linear coefficient; use trend plateauing or anchor to modern baseline. |
| **Rainfall / Weather** | Static 30-year IMD District Normals (Annual, Monsoon) | Real-time OpenWeather / NASA POWER daily precipitation & temperature | **Climatic Gap**. District normal serves as regional agro-climatic baseline; real-time daily weather requires calibrated seasonal aggregation. |
| **Soil Chemistry (N, P, K)** | **ABSENT** from historical DAC&FW yield records | Entered by farmer from Soil Health Card (SHC) | **CRITICAL GAP**. Macro historical yield statistics reflect regional averages, not field-level NPK response curves. |
| **Soil pH & Soil Type** | **ABSENT** from historical DAC&FW yield records | Entered by farmer from SHC / soil test | **CRITICAL GAP**. Soil type and pH cannot be learned from historical DAC&FW regression data alone. |
| **Farm Parcel Area** | Aggregate district cropped area ($10\text{--}8,580,000\text{ ha}$) | Private farm landholding ($0.5\text{--}25\text{ acres}$) | **Scale Disparity**. Model must NOT condition baseline yield on private plot size. |

### Architectural Mitigation in Phase 3B: Two-Track System
Because historical macro-level regression data lacks soil chemistry ($N, P, K, pH$), FieldWise must maintain two decoupled, complementary intelligence tracks:
1. **Track 1: Multi-Criteria Agronomic Classification Engine**: Evaluates field-level soil chemistry ($N, P, K, pH$), local temperature, humidity, and rainfall against biological suitability envelopes codified in `canonical_crop_taxonomy.json` (ICAR/TNAU packages of practices).
2. **Track 2: Macro-Regional Yield Regression Engine**: Predicts regional baseline yield expectation conditioned on agro-climatic zone (`State`, `District`), historical technological trend, season, and regional climatological water endowment.

---

## 7. Recommended Validation Strategy & Chronological Holdout Split Design

### 7.1 Flaws of Naive Random K-Fold Cross-Validation
Standard random row splitting (e.g. random 80/20 train/test split or standard 5-fold cross-validation) is scientifically invalid for this dataset due to **spatial and temporal auto-correlation leakage**:
- The dataset contains repeated observations for identical State-District-Crop combinations across consecutive years (1997–2015).
- If rows are randomly sampled, Ludhiana Wheat 2008 will appear in the training fold while Ludhiana Wheat 2009 appears in the test fold. The model easily memorizes the district-specific mean yield rather than learning generalizable agro-climatic dynamics.

### 7.2 Intended Chronological Holdout Design
To guarantee an honest, leak-free evaluation of generalization capability, model training must adopt an **out-of-time chronological holdout split**:

```
+----------------------------------------------------------------------------------------------------+
|                               CHRONOLOGICAL DATA SPLIT ARCHITECTURE                                |
+----------------------------------------------------------------------------------------------------+
|   TRAINING SET: 1997 – 2011 (15 Crop Years)                | VALIDATION SET      | TEST SET        |
|   191,249 Records (84.04% of dataset)                     | 2012 – 2013         | 2014 – 2015     |
|   - Feature engineering & model fitting                   | 25,398 Records      | 10,905 Records  |
|   - Spatial block cross-validation (GroupKFold on Dist)    | (11.16%) Tuning     | (4.79%) Unseen  |
+-----------------------------------------------------------+---------------------+-----------------+
```

1. **Training Split (1997–2011, 15 Years)**:
   - **$191,249$ records** ($84.04\%$).
   - Used exclusively for feature encoding, parameter estimation, and baseline fitting.
   - Cross-validation within the training split must use **GroupKFold grouped by District** to evaluate spatial generalization across non-contiguous administrative territories.
2. **Validation Split (2012–2013, 2 Years)**:
   - **$25,398$ records** ($11.16\%$).
   - Used strictly for hyperparameter tuning, tree depth selection, learning rate decay, and early stopping.
3. **Holdout Test Split (2014–2015, 2 Years)**:
   - **$10,905$ records** ($4.79\%$).
   - Strictly sealed until final model evaluation. Provides an unbiased out-of-time benchmark measuring how well historical patterns predict modern agricultural yields.

---

## 8. Improved Validation Independence & Set Reconciliation

### 8.1 Exact Dynamic Set Equality
In Phase 3A.5, [`validate_dataset.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/validate_dataset.py) establishes **exact set equality** ($A = B$) for all 6 processed output datasets against independently derived row sets:

$$\text{set}(\text{actual\_dataset.raw\_row\_id}) \equiv \text{expected\_dynamic\_subset}$$

- Cleaned pure-tonne regression set: $|S_{\text{clean}}| = 227,573 \equiv |R_6|$ (Exact set equality verified).
- Segregated Cotton: $|S_{\text{cotton}}| = 4,327 \equiv |S_{\text{cotton clean}}|$ (Exact set equality verified).
- Segregated Jute & Mesta: $|S_{\text{jm}}| = 3,196 \equiv |S_{\text{jm clean}}|$ (Exact set equality verified).
- Segregated Coconut: $|S_{\text{coconut}}| = 1,957 \equiv |D_{\text{coconut}}|$ (Exact set equality verified).
- Segregated Arecanut: $|S_{\text{arecanut}}| = 1,578 \equiv |D_{\text{arecanut}}|$ (Exact set equality verified).
- Segregated Unverified: $|S_{\text{unverified}}| = 35 \equiv |S_{\text{sugar unverified}} \cup S_{\text{cotton unverified}}|$ (Exact set equality verified).

### 8.2 Numerical Derivation Verification across All Datasets
Every processed yield value was compared against raw $\text{Production} / \text{Cultivated\_Area\_Ha}$:
- Cleaned pure-tonne dataset: Maximum discrepancy = **$0.00050000$** ($\le 0.001$).
- Cotton bales dataset: Maximum discrepancy = **$0.00050000$** ($\le 0.001$).
- Jute & Mesta bales dataset: Maximum discrepancy = **$0.00050000$** ($\le 0.001$).
- Coconut nuts dataset: Maximum discrepancy = **$0.00500000$** ($\le 0.010$).
- Arecanut dataset: Maximum discrepancy = **$0.00050000$** ($\le 0.001$).
- Segregated Unverified dataset: Maximum discrepancy = **$0.00000000$** ($\le 0.001$).

### 8.3 Pre-Merge Rainfall Integrity
Pre-merge checks on `district_rainfall_normal.csv` confirmed:
- **Duplicate Normalized Keys in Source**: Exactly **$0$**.
- **Conflicting Rainfall Values**: Exactly **$0$**.
- Value discrepancy in all $174,363$ matched records: Exactly **$0.0\text{ mm}$**.

### 8.4 Exact Mathematical Universe Reconciliation
All 12 dynamically derived partition sets are strictly pairwise disjoint:
$$S_i \cap S_j = \emptyset \quad \forall i \neq j$$
$$\sum_{i=1}^{12} |S_i| = 246,091 \quad (\Delta = 0 \text{ Exact Match with Raw Universe})$$

---

## 9. Verification & Changed-File Inventory

| File Path | Status | Action Taken in Phase 3A.5 |
| :--- | :---: | :--- |
| [`scripts/clean_yield_data.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/clean_yield_data.py) | Updated | Enriched all 60 metadata entries with `provenance_status`, `product_basis`, and `moisture_or_harvest_form_notes`; populated `raw_yield` and `yield_corrected` for all unverified records; added rainfall duplicate key check. |
| [`scripts/validate_dataset.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/validate_dataset.py) | Overhauled | Replaced hardcoded counts with dynamic set equality checks for all 6 datasets; added unverified numerical derivation audit; added rainfall duplicate/conflict checks; audited records between $T$ and $2T$. |
| [`scripts/run_area_correlation_analysis.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/run_area_correlation_analysis.py) | Created | Designated script for exploratory bivariate correlation analysis, scale disparity analysis, and baseline feature specification. |
| [`scripts/run_feature_sensitivity_review.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/run_feature_sensitivity_review.py) | Updated | Compatibility wrapper delegating directly to `run_area_correlation_analysis.py`. |
| [`reports/threshold_provenance.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/threshold_provenance.json) | Updated | Comprehensive provenance repository with 30 verified source passage crops, 30 provisional estimate crops, and complete product basis specifications. |
| [`reports/exploratory_area_correlation_analysis.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/exploratory_area_correlation_analysis.json) | Created | Detailed report on exploratory bivariate correlations, area distribution quantiles, and anti-leakage feature specifications. |
| [`reports/feature_leakage_and_sensitivity_review.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/feature_leakage_and_sensitivity_review.json) | Updated | Maintained as an identical reference copy for pipeline backward compatibility. |
| [`reports/validation_summary.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/validation_summary.json) | Updated | Machine-readable validation audit summary (100% assertions passed) with explicit `crop_threshold_consistency_audit` section. |
| [`reports/phase_3a_4_quality_report.md`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/phase_3a_4_quality_report.md) | Corrected | Added correction regarding the 68 retained records between $T$ and $2T$, and corrected verified vs unmapped crop partition figures. |
| [`README.md`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/README.md) | Updated | Complete pipeline documentation reflecting Phase 3A.5 architecture, feature sets, and reports. |
| [`reports/phase_3a_5_training_readiness_report.md`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/phase_3a_5_training_readiness_report.md) | Created | This master training readiness, dataset tiering, and validation split design report. |

---

## 10. Scientific Validation Disclaimer & Pre-Training Readiness Statement

> [!NOTE]
> Passing 100% of the assertions in [`validate_dataset.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/validate_dataset.py) proves relational consistency, dynamic set equality, unit purity, anti-leakage compliance, and row-by-row derivation fidelity within numerical rounding limits ($0.0005$). It confirms that all 6 output datasets are mathematically sound, that threshold provenance is qualified, and that data leakage is eliminated.
>
> However, automated tests do **not** constitute empirical scientific validation of field predictive capability. A model trained on district-level historical data predicts regional aggregate yields, not high-resolution microclimatic parcel outcomes.
>
> **Training Readiness Verdict**: The FieldWise dataset engineering pipeline is **100% complete, reproducible, and ready for model training in Phase 3B**, subject to external approval of the chronological split design and tiering structure.
