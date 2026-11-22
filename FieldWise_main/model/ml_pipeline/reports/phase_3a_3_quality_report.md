# FieldWise — Phase 3A.3 Quality Report: Yield Unit Integrity & Independent Validation

**Author**: FieldWise Data Engineering & Agricultural ML Team  
**Date**: November 17, 2026  
**Pipeline Stage**: Phase 3A.3 (Pre-Training Dataset Assembly, Unit Integrity & Independent Validation)  
**Status**: COMPLETE — ALL INDEPENDENT ASSERTIONS VERIFIED  

---

## 1. Executive Summary

Phase 3A.3 addresses critical findings from the Phase 3A.2 code and agronomic review. Prior pipeline iterations left commercial fibers (Cotton, Jute, Mesta) labeled as `Yield_Tonnes_Per_Ha` despite being officially recorded in bales, maintained Arecanut records despite state-mixed reporting conventions (fresh vs. dry cured nuts), and relied on an automatic $15.0\text{ t/ha}$ fallback ceiling for crops lacking documented physiological thresholds.

In Phase 3A.3, the data engineering pipeline was completely overhauled to enforce **strict target unit purity**, eliminate unsupported default ceilings, and establish an **independently reproducible validation suite** that derives all expected row sets dynamically from raw source data without hardcoded expectations.

### Key Outcomes:
1. **Pure Metric Tonne Target (`Yield_Tonnes_Per_Ha`)**: The primary historical regression dataset, [`cleaned_crop_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/cleaned_crop_yield.csv), now contains **exclusively verified metric tonne crops** ($227,573$ records across $33$ States and $57$ pure-tonne crops). All non-mass and bale-based crops have been segregated into dedicated datasets with explicit target units.
2. **Dedicated Unit Segregation**:
   - [`segregated_cotton_bales_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_cotton_bales_yield.csv): $4,327$ records with declared target `Yield_Bales_Per_Ha` ($1\text{ bale} = 170\text{ kg lint}$).
   - [`segregated_jute_mesta_bales_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_jute_mesta_bales_yield.csv): $3,196$ records with declared target `Yield_Bales_Per_Ha` ($1\text{ bale} = 180\text{ kg fiber}$).
   - [`segregated_coconut_nuts_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_coconut_nuts_yield.csv): $1,957$ records with declared target `Yield_Nuts_Per_Ha`.
   - [`segregated_arecanut_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_arecanut_yield.csv): $1,578$ records with declared target `Yield_Raw_Reported_Per_Ha` (annotating state-level cured vs. fresh nut discrepancies).
   - [`segregated_unverified_unit_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_unverified_unit_yield.csv): $35$ records ($12$ ambiguous Sugarcane $> 180\text{ t/ha}$, $23$ Maharashtra 1997 Cotton $> 10\text{ bales/ha}$).
3. **Elimination of Fallback Ceilings**: The automatic $15.0\text{ t/ha}$ fallback ceiling was eliminated. Crops are partitioned into an explicit dictionary of documented ICAR/DES thresholds vs. an explicit manual review list of $50$ unmapped crops ($11,226$ records). No unmapped observation was dropped under an unsupported ceiling.
4. **Independent Dynamic Validator**: [`validate_dataset.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/validate_dataset.py) independently loads the raw historical dataset, reconstructs every cleaning mask, dynamically computes expected partition sets, and verifies that the $12$ partition sets are strictly pairwise disjoint and sum exactly to the raw universe:
   $$\sum_{i=1}^{12} |S_i| = 246,091 \quad (\text{Exact } 0 \text{ Discrepancy})$$
5. **Scientific Validation Distinction**: Explicitly distinguished automated test assertions from empirical scientific validity, documenting data provenance boundaries, microclimatic aggregation limits, and probability calibration requirements.

---

## 2. Production Measurement Unit Audit (All 124 Crops)

In Indian official agricultural statistics (Directorate of Economics & Statistics, Ministry of Agriculture & Farmers Welfare / DAC&FW, and state Directorates of Agriculture), production measurement units vary by commodity class. Misinterpreting non-tonne production as metric tonnes introduces multi-fold errors in derived yield models.

### Commodity Unit Breakdown

| Commodity Group | Crops Included | Official Production Reporting Unit | Official Area Unit | Derived Target Yield Unit | Handling Strategy in FieldWise Phase 3A.3 |
|---|---|---|---|---|---|
| **Foodgrains (Cereals)** | Rice, Wheat, Maize, Jowar, Bajra, Ragi, Barley, Small millets | Metric Tonnes ($\text{t}$) | Hectares ($\text{ha}$) | $\text{Tonnes/Ha}$ | Retained in [`cleaned_crop_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/cleaned_crop_yield.csv) |
| **Foodgrains (Pulses)** | Gram, Arhar/Tur, Moong, Urad, Masoor/Lentil, Horse-gram, Khesari, Moth, Cowpea | Metric Tonnes ($\text{t}$) | Hectares ($\text{ha}$) | $\text{Tonnes/Ha}$ | Retained in [`cleaned_crop_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/cleaned_crop_yield.csv) |
| **Major Oilseeds** | Groundnut, Rapeseed & Mustard, Soyabean, Sunflower, Sesamum, Castor, Linseed, Niger | Metric Tonnes ($\text{t}$) | Hectares ($\text{ha}$) | $\text{Tonnes/Ha}$ | Retained in [`cleaned_crop_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/cleaned_crop_yield.csv) |
| **Sugarcane** | Sugarcane (Stalk weight) | Metric Tonnes ($\text{t}$) | Hectares ($\text{ha}$) | $\text{Tonnes/Ha}$ | Unit conversions verified for Punjab 2011 & TN 1997 ($42$ records). Ambiguous $> 180\text{ t/ha}$ ($12$ records) segregated |
| **Horticulture (Vegetables/Fruits)** | Potato, Onion, Tomato, Banana, Mango, Tapioca, Cabbage, Brinjal, Citrus, etc. | Metric Tonnes ($\text{t}$) | Hectares ($\text{ha}$) | $\text{Tonnes/Ha}$ | Retained in [`cleaned_crop_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/cleaned_crop_yield.csv) |
| **Spices & Plantation** | Turmeric, Ginger, Garlic, Black pepper, Cardamom, Coriander, Rubber, Coffee, Tea | Metric Tonnes ($\text{t}$) | Hectares ($\text{ha}$) | $\text{Tonnes/Ha}$ | Retained in [`cleaned_crop_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/cleaned_crop_yield.csv) |
| **Commercial Cotton** | Cotton(lint) | **Bales of $170\text{ kg}$ lint** ($0.170\text{ t}$) | Hectares ($\text{ha}$) | $\text{Bales/Ha}$ | **Segregated** into [`segregated_cotton_bales_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_cotton_bales_yield.csv) ($4,327$ rows) |
| **Commercial Bast Fibers** | Jute, Mesta, Jute & mesta | **Bales of $180\text{ kg}$ fiber** ($0.180\text{ t}$) | Hectares ($\text{ha}$) | $\text{Bales/Ha}$ | **Segregated** into [`segregated_jute_mesta_bales_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_jute_mesta_bales_yield.csv) ($3,196$ rows) |
| **Palms / Tree Nuts** | Coconut | **Thousand Nuts / nuts** | Hectares ($\text{ha}$) | $\text{Nuts/Ha}$ | **Segregated** into [`segregated_coconut_nuts_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_coconut_nuts_yield.csv) ($1,957$ rows) |
| **Mixed Tree Nuts** | Arecanut, Atcanut (Raw), Arcanut (Processed) | **State-Mixed** (Kerala dry cured nut vs Karnataka fresh green nut) | Hectares ($\text{ha}$) | $\text{Raw Reported Ratio}$ | **Segregated** into [`segregated_arecanut_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_arecanut_yield.csv) ($1,578$ rows) |
| **Unverified Anomalies** | Sugarcane $> 180$, Cotton MH 1997 $> 10$ | **Indeterminate / Transposition** | Hectares ($\text{ha}$) | $\text{Unverified}$ | **Segregated** into [`segregated_unverified_unit_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_unverified_unit_yield.csv) ($35$ rows) |

---

## 3. Documentary Evidence for Sugarcane Conversions

In Phase 3A.2, heuristic rules were replaced with official source documentation. In Phase 3A.3, these conversions were re-audited and affirmed against the raw data:

1. **Punjab Sugarcane (Crop Year 2011, 15 District Records)**:
   - **Reported Numbers**: Production values entered in kilograms ($65,000,000$ to $78,000,000\text{ kg}$) or with area in thousand hectares, yielding raw quotients of $65,000$ to $78,000$.
   - **Conversion Factor**: $\times 0.001$ ($\div 1000$).
   - **Converted Yield**: $65.0$ to $78.0\text{ t/ha}$.
   - **Documentary Evidence**: *Punjab Statistical Abstract 2011-12* (Economic and Statistical Organisation, Government of Punjab) and DAC&FW Annual Series. Adjacent years in Punjab (2009, 2010, 2012, 2013) show state median yields of $70.75$ to $78.30\text{ t/ha}$.
2. **Tamil Nadu Sugarcane (Crop Year 1997, 27 District Records)**:
   - **Reported Numbers**: Production recorded in quintals ($1\text{ quintal} = 100\text{ kg} = 0.1\text{ t}$), yielding raw quotients of $950$ to $1,150$.
   - **Conversion Factor**: $\times 0.1$ ($\div 10$).
   - **Converted Yield**: $95.0$ to $115.0\text{ t/ha}$.
   - **Documentary Evidence**: *Tamil Nadu Season and Crop Report 1996-97 & 1997-98* (Directorate of Economics and Statistics, Chennai). Matches the adjacent 1998–2013 Tamil Nadu state median yield of $107.1$ to $112.5\text{ t/ha}$.
3. **Ambiguous Sugarcane $> 180\text{ t/ha}$ ($12$ District Records)**:
   - Located across sporadic districts (e.g., Belgaum, Meerut, Muzaffarnagar) without official state corroboration.
   - Segregated into `segregated_unverified_unit_yield.csv` rather than guessing or applying unverified scale adjustments.

Full record-by-record metadata is preserved in [`reports/sugarcane_unit_conversion_evidence.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/sugarcane_unit_conversion_evidence.json).

---

## 4. Elimination of Unsupported Default Ceilings

### Methodological Correction
Previous versions applied an automatic fallback ceiling of $15.0\text{ t/ha}$ via `.fillna(15.0)`. This caused minor or unmapped crops (such as `Other Fresh Fruits` with yield $25.26\text{ t/ha}$ or `Other Rabi pulses` with yield $22.71\text{ t/ha}$) to be evaluated against an arbitrary threshold.

In Phase 3A.3:
1. `DEFAULT_CROP_PHYSIOLOGICAL_CEILING_TONNES_PER_HA = 15.0` has been **completely eliminated**.
2. **Documented Ceilings Dictionary**: [`VERIFIED_CROP_PHYSIOLOGICAL_CEILINGS_TONNES_PER_HA`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/clean_yield_data.py#L61-L130) contains $72$ crops with documented biological maximums grounded in:
   - *ICAR Handbook of Agriculture* (Indian Council of Agricultural Research)
   - *Agricultural Statistics at a Glance* (DES, Ministry of Agriculture)
   - *FAO EcoCrop Database* (Food and Agriculture Organization)
   - *National Horticulture Board (NHB) Indian Horticulture Database*
3. **Unit-Specific Ceilings Dictionary**: [`UNIT_SPECIFIC_PHYSIOLOGICAL_CEILINGS`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/clean_yield_data.py#L132-L160) tracks fiber and nut ceilings separately (Cotton: $5.0\text{ bales/ha}$; Jute/Mesta: $25.0\text{ bales/ha}$; Coconut: $25,000\text{ nuts/ha}$).
4. **Unverified Ceiling Retained List**: [`UNVERIFIED_CEILING_CROPS_MANUAL_REVIEW`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/clean_yield_data.py#L162-L175) lists $50$ minor or composite crops ($11,226$ records). Observations for these crops are **retained in the dataset and flagged for manual review**, ensuring zero records are excluded under unsupported defaults.

### Outlier Filtering Action Breakdown

| Category | Record Count | Processing Rule | Agronomic & Mathematical Rationale |
|---|---|---|---|
| **Unit Corrected (Sugarcane)** | $42$ | Re-scaled by verified factor ($0.001$ or $0.1$) | Supported by Punjab & TN Statistical Abstracts |
| **Segregated (Unverified Unit)** | $35$ | Moved to dedicated CSV | $12$ Sugarcane $> 180\text{ t/ha}$, $23$ MH 1997 Cotton $> 10\text{ bales/ha}$ |
| **Excluded (Extreme Tonne Outliers)** | $47$ | Excluded from regression dataset | Exceeds $2\times$ documented ICAR ceiling (e.g., Maize $1,494\text{ t/ha}$, Onion $2,150\text{ t/ha}$, Sesamum $235\text{ t/ha}$, Cashewnut $9,801\text{ t/ha}$). Clerical keypunch transposition errors |
| **Excluded (Extreme Fiber Outlier)** | $1$ | Excluded from fiber dataset | Begusarai 1997 Mesta ($68.0\text{ bales/ha} > 2 \times 25.0$) |
| **Retained (Plausible High Yield)** | $106$ | Retained in cleaned dataset | Yield between $1\times$ and $2\times$ documented ceiling; represents intensive commercial management under high inputs |
| **Retained (Unverified Ceiling Review)** | $3$ | Retained in cleaned dataset | Unmapped crops (`Other Fresh Fruits` $25.26$, `Other Rabi pulses` $22.71, 18.0$); retained because no documented ceiling justifies exclusion |

All actions, raw row IDs, and rationales are logged in [`reports/yield_outlier_review.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/yield_outlier_review.json) and [`reports/yield_outlier_review.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/yield_outlier_review.csv).

---

## 5. Mathematical Set Partition & Dynamic Reconciliation

Let $U = \{0, 1, 2, \dots, 246090\}$ represent the universe of raw records in `agriculture_in_india.csv` ($|U| = 246,091$).

The cleaning pipeline establishes a sequence of mutually disjoint subsets that partition $U$:

```
Raw Historical Universe U (246,091 records)
├── D1: Missing Production (Null) ──────────────────────────  3,730 records
├── D2: Invalid Cultivated Area (Area <= 0) ────────────────      0 records
├── D3: Zero Production Observations ──────────────────────  3,523 records
├── D4: Negligible Yield (< 0.005 t/ha) ────────────────────    124 records
├── Segregated Datasets (Non-Tonne Units & Anomalies):
│   ├── D_coconut: Coconut (Thousand Nuts / nuts) ──────────  1,957 records
│   ├── Cotton_Clean: Cotton (Bales of 170 kg) ─────────────  4,327 records
│   ├── Jute_Mesta_Clean: Jute/Mesta (Bales of 180 kg) ─────  3,196 records
│   ├── Arecanut_Segregated: Arecanut (State-Mixed Units) ──  1,578 records
│   └── Segregated_Unverified: Ambiguous Units ─────────────     35 records
│       ├── Ambiguous Sugarcane > 180 t/ha: 12 records
│       └── Maharashtra 1997 Cotton > 10 bales/ha: 23 records
├── Excluded Extreme Biological Impossibilities:
│   ├── Extreme_Tonne_Outliers (> 2x ICAR ceiling) ─────────     47 records
│   └── Extreme_Fiber_Outliers (> 50 bales/ha) ─────────────      1 record
└── Final Cleaned Pure-Tonne Dataset R6 ──────────────────── 227,573 records
    Total Partition Sum:                                     246,091 records (Exact 0 discrepancy)
```

### Exact Pairwise Disjointness & Union Verification
In [`validate_dataset.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/validate_dataset.py), all $12$ partition sets were tested using set intersections:
$$\forall i \ne j, \quad S_i \cap S_j = \emptyset \quad (\text{Zero overlapping row IDs})$$
$$\bigcup_{i=1}^{12} S_i = U \quad (\text{Exact } 246,091 \text{ rows reconciled})$$

---

## 6. District Rainfall Join & Anti-Leakage Verification

1. **Static 30-Year Climatic Normal Join**:
   - Primary rainfall source: `district_rainfall_normal.csv` ($641$ districts, IMD 30-year normal).
   - Joined on normalized keys `['State_Normalized', 'District_Normalized']`.
   - **Duplication Assertion**: `assert df_clean['raw_row_id'].duplicated().sum() == 0` (0 duplicates).
   - **Coverage Arithmetic**:
     - Matched rainfall records: $174,363$ ($76.62\%$)
     - Unmatched rainfall records: $53,210$ ($23.38\%$)
     - Matched $+$ Unmatched $= 227,573 = |R_6|$ (Exact balance).
2. **Target Leakage Prevention**:
   - `Production` was used strictly to derive $\text{Yield} = \text{Production} / \text{Area}$.
   - `Production` is **strictly excluded** from feature columns in [`cleaned_crop_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/cleaned_crop_yield.csv).
   - Asserted in validation: `assert 'Production' not in df_clean.columns`.

---

## 7. Recommendation Benchmark Overlap & Taxonomy Harmonization

The recommendation classification track remains strictly separated from historical regression:

1. **Benchmark Ground Truth**:
   - `cleaned_crop_recommendation_benchmark.csv` ($2,200$ rows, $22$ classes, $100$ rows/class).
   - Category C (Augmented Agricultural Benchmark, compiled by Atharva Ingle from Indian agricultural research data; Apache 2.0 license).
2. **7-Crop ML Benchmark vs. 19-Crop Agronomic Engine**:
   - **7 Overlapping Crops**: `banana`, `chickpea`, `cotton`, `lentil`, `maize`, `mango`, `rice`.
   - **12 Missing FieldWise Crops**: `barley`, `groundnut`, `jowar`, `millets`, `mustard`, `onion`, `potato`, `soybean`, `sugarcane`, `sunflower`, `tomato`, `wheat`.
   - In accordance with audit standards, **no synthetic observations were fabricated** for the 12 missing crops. The 19-crop engine utilizes codified agronomic envelope matrices (`canonical_crop_taxonomy.json`), while ML classification is restricted to the 7 benchmark classes.

---

## 8. Scientific Validation Disclaimer & Methodological Limitations

Automated assertion testing confirms mathematical rigor, relational schema conformance, and bounded sanity limits. It does **not** substitute for empirical field validation.

### Key Methodological Limitations to Acknowledge Before Modeling:
1. **Macro-Level District Aggregation**: Historical yield observations represent district-wide seasonal aggregates. They smooth over parcel-level microclimates, individual farm soil profiles, farmer management variations, and localized pest outbreaks.
2. **Static Climatic Normals vs. Dynamic Weather**: District rainfall normals reflect 30-year historical averages, not the actual in-season rainfall experienced by each crop plot during its specific phenological growth stages.
3. **Augmented Benchmark Calibration**: Cross-validation accuracy on the 22-class benchmark dataset (~99%) reflects well-separated class clusters in feature space. In real farm deployments, out-of-distribution soil chemistries, extreme weather events, and mixed cropping systems will degrade field accuracy. Probability calibration and out-of-distribution uncertainty estimation will be mandatory in Phase 3B.

---

## 9. Verification & Changed-File Inventory

### Executed Commands & Verifications
```bash
# 1. Dataset Profiling & Inventory Update
python3 FieldWise_main/model/ml_pipeline/scripts/inspect_datasets.py
# Output: Profiled 246,091 raw rows, 641 rainfall rows, 2,200 benchmark rows, and 6 processed datasets.

# 2. Recommendation Benchmark Harmonization
python3 FieldWise_main/model/ml_pipeline/scripts/clean_recommendation_data.py
# Output: Verified 0 duplicates, 0 range violations, 7 overlapping crops, 12 missing crops segregated.

# 3. Unit Integrity Cleaning & Segregation Pipeline
python3 FieldWise_main/model/ml_pipeline/scripts/clean_yield_data.py
# Output: Clean pure-tonne dataset: 227,573 records (92.48% retention), 5 dedicated segregated datasets created.

# 4. Independent Dynamic Validation Suite
python3 FieldWise_main/model/ml_pipeline/scripts/validate_dataset.py
# Output: ALL ASSERTIONS PASSED (zero hardcoded counts, exact universe union, 0 join duplication).
```

### Complete Changed-File List
| File Path | Nature of Change | Summary of Modifications |
|---|---|---|
| [`clean_yield_data.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/clean_yield_data.py) | Modified | Enforced pure metric tonne target; segregated cotton, jute/mesta, coconut, arecanut, and unverified units; removed automatic 15 t/ha default ceiling; implemented explicit threshold inventory |
| [`validate_dataset.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/validate_dataset.py) | Modified | Reconstructed raw masks independently; eliminated hardcoded row expectations; added pairwise disjointness and exact universe union verification; audited target units across all 6 files |
| [`inspect_datasets.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/inspect_datasets.py) | Modified | Updated profiling to cover all 6 processed unit-segregated datasets and Phase 3A.3 metadata |
| [`cleaned_crop_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/cleaned_crop_yield.csv) | Generated | Pure metric tonne regression dataset ($227,573$ records, target: `Yield_Tonnes_Per_Ha`) |
| [`segregated_cotton_bales_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_cotton_bales_yield.csv) | Generated | Cotton fiber dataset ($4,327$ records, target: `Yield_Bales_Per_Ha`) |
| [`segregated_jute_mesta_bales_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_jute_mesta_bales_yield.csv) | Generated | Jute/Mesta fiber dataset ($3,196$ records, target: `Yield_Bales_Per_Ha`) |
| [`segregated_coconut_nuts_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_coconut_nuts_yield.csv) | Generated | Coconut nut dataset ($1,957$ records, target: `Yield_Nuts_Per_Ha`) |
| [`segregated_arecanut_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_arecanut_yield.csv) | Generated | Arecanut mixed-unit dataset ($1,578$ records, target: `Yield_Raw_Reported_Per_Ha`) |
| [`segregated_unverified_unit_yield.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/data/processed/segregated_unverified_unit_yield.csv) | Generated | Segregated unverified anomalies ($35$ records: $12$ Sugarcane, $23$ Cotton MH 1997) |
| [`yield_cleaning_report.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/yield_cleaning_report.json) | Generated | Updated sequential cleaning metrics and mathematical partition verification |
| [`validation_summary.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/validation_summary.json) | Generated | Updated automated assertion test results and scientific validation disclaimer |
| [`dataset_inventory.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/dataset_inventory.json) | Generated | Updated raw and processed dataset inventory metadata |
| [`yield_outlier_review.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/yield_outlier_review.json) | Generated | Re-computed outlier review records reflecting elimination of default ceilings |
| [`yield_outlier_review.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/yield_outlier_review.csv) | Generated | Tabular export of outlier actions |
| [`README.md`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/README.md) | Modified | Updated directory tree, target unit documentation, and sequential pipeline counts |
| [`reports/phase_3a_3_quality_report.md`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/phase_3a_3_quality_report.md) | Created | Master technical audit report for Phase 3A.3 |

**Scope Guarantee**: Strictly zero changes were made outside `FieldWise_main/model/ml_pipeline/`. No frontend components (`src/`), backend APIs (`backend/`), or prediction engines (`model/predictor.js`) were modified. No machine learning models were trained.
