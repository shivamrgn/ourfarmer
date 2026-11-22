# FieldWise ML Pipeline — Historical Crop Yield Modeling & Evaluation (Phase 3B.1)

This directory contains the reproducible data processing pipeline and baseline machine learning experiments for the **FieldWise Agricultural Intelligence Platform**. It establishes a clear, traceable separation between:

1. **Crop Recommendation Classification Data**: Multi-parameter agronomic classification mapping soil chemistry and weather to optimal crop classes.
2. **Crop Yield Prediction Regression Data**: Macro-level historical agricultural observations (1997–2015) predicting yield ($\text{Tonnes/Hectare}$).

---

## Directory Structure

```
model/ml_pipeline/
├── data/
│   ├── raw/
│   │   ├── agriculture_in_india.csv                 # Raw 1997-2015 historical crop production (DAC&FW)
│   │   ├── district_rainfall_normal.csv             # Raw 30-year IMD district rainfall normals
│   │   └── kaggle_crop_recommendation_benchmark.csv # Raw 2,200-row synthetic benchmark dataset
│   └── processed/
│       ├── cleaned_crop_recommendation_benchmark.csv# Cleaned recommendation benchmark with provenance tags (2,200 rows)
│       ├── cleaned_crop_yield.csv                   # Cleaned pure-tonne regression dataset (227,573 records)
│       ├── segregated_cotton_bales_yield.csv        # Segregated cotton in bales of 170 kg lint (4,327 records)
│       ├── segregated_jute_mesta_bales_yield.csv    # Segregated jute/mesta in bales of 180 kg fiber (3,196 records)
│       ├── segregated_coconut_nuts_yield.csv        # Segregated coconut in nuts / non-mass units (1,957 records)
│       ├── segregated_arecanut_yield.csv            # Segregated arecanut with state-mixed reporting (1,578 records)
│       └── segregated_unverified_unit_yield.csv     # Segregated unverified reporting unit anomalies (35 records)
├── experiments/
│   ├── experiment_a_prime/                          # Prime-only models, manifests, preprocessor & predictions (126,375 rows)
│   ├── experiment_b_provisional/                    # Prime+Provisional models, manifests, preprocessor & predictions (161,270 rows)
│   └── phase_3b_1_2/                                # Phase 3B.1.2 corrected encoding & challenger models, preprocessors & predictions
│       ├── experiment_a_prime/                      # OHE/Native/TE models, predictions & preprocessors (Exp A)
│       └── experiment_b_provisional/                # OHE/Native/TE models, predictions & preprocessors (Exp B)
├── reports/
│   ├── canonical_crop_taxonomy.json                 # Reconciled 19-crop taxonomy across frontend and backend
│   ├── canonical_crop_taxonomy.csv                  # Tabular export of canonical agronomic bounds
│   ├── dataset_inventory.json                       # Automated profiling statistics across all datasets
│   ├── crop_exclusion_and_mapping_inventory.json   # Machine-readable inventory of all 97 crops and 17 excluded categories
│   ├── state_district_mapping.json                  # State & district alias dictionary
│   ├── yield_cleaning_report.json                   # Dynamic set-based sequential cleaning and overlap reconciliation
│   ├── sugarcane_unit_conversion_evidence.json      # Line-by-line documentary evidence for sugarcane unit conversions
│   ├── threshold_provenance.json                    # Traceable source citations, product bases & commercial ranges for 60 crops
│   ├── exploratory_area_correlation_analysis.json   # Exploratory bivariate correlation and area sensitivity analysis
│   ├── feature_leakage_and_sensitivity_review.json  # Feature leakage review report (compatibility alias)
│   ├── yield_outlier_review.json                    # Detailed review of all high observations, actions taken and rationale
│   ├── yield_outlier_review.csv                     # Tabular export of outlier actions
│   ├── crop_recommendation_dataset_audit.md         # Detailed agronomic assessment of recommendation data
│   ├── validation_summary.json                      # Quality assurance, split reconciliation & test results (Phase 3A.6)
│   ├── phase_3a_1_correction_report.md              # Preliminary Phase 3A.1 audit report
│   ├── phase_3a_2_final_quality_report.md           # Technical report on Phase 3A.2 final quality corrections
│   ├── phase_3a_3_quality_report.md                 # Report on Phase 3A.3 unit integrity & set reconciliation
│   ├── phase_3a_4_quality_report.md                 # Report on Phase 3A.4 final validator & threshold audit
│   ├── phase_3a_5_training_readiness_report.md      # Historical Phase 3A.5 report (superseded by Phase 3A.6)
│   ├── phase_3a_6_training_readiness_report.md      # Master Phase 3A.6 report: Training Eligibility & Split Reconciliation
│   ├── phase_3b_1_baseline_metrics.json             # Machine-readable validation metrics, crop/state/residual breakdowns
│   ├── phase_3b_1_baseline_report.md                # Master Phase 3B.1 report: First Historical Yield Regression Baselines
│   ├── phase_3b_1_1_diagnostic_audit.md             # Master Phase 3B.1.1 report: Diagnostic Audit of Baselines & Challenger
│   ├── phase_3b_1_1_metrics.json                    # Machine-readable diagnostic metrics, percentiles & challenger results
│   ├── phase_3b_1_1_common_crops_comparison.csv     # Per-crop validation counts, MAEs & deltas for 30 common prime crops
│   ├── phase_3b_1_1_residual_summary.csv            # Error percentiles (P50-P99), residual mean/std & max absolute error
│   ├── phase_3b_1_1_top_errors.csv                  # Largest 20 prediction errors ranked per model/experiment with metadata
│   ├── phase_3b_1_1_per_crop_residual_diagnostics.csv # Crop-by-crop sample counts, MAE, RMSE & contribution to total SSE
│   ├── phase_3b_1_1_per_state_residual_diagnostics.csv# State-by-state sample counts, MAE and RMSE diagnostics
│   ├── phase_3b_1_2_report.md                       # Master Phase 3B.1.2 report: Encoding Correction & Challenger Verification
│   ├── phase_3b_1_2_metrics.json                    # Machine-readable metrics across OHE, Native Categorical & Challenger models
│   ├── phase_3b_1_2_common_crops_comparison.csv     # Cross-experiment validation comparison on identical 13,422 prime rows
│   ├── phase_3b_1_2_challenger_resolutions.csv      # Fallback resolution counts for Challenger across N_min in {1, 3, 5}
│   ├── phase_3b_1_2_residual_summary.csv            # Error percentiles (P50-P99) and max error across all corrected models
│   ├── phase_3b_1_2_top_errors.csv                  # Largest 20 prediction errors per corrected model with full metadata
│   ├── phase_3b_1_2_per_crop_residual_diagnostics.csv# Crop-by-crop sample counts, MAE, RMSE & SSE contributions
│   ├── phase_3b_1_3_report.md                       # Master Phase 3B.1.3 report: Metrics Reconciliation & Final Baseline Selection
│   ├── phase_3b_1_3_metrics.json                    # Single source of truth for reconciled metrics down to 6 decimals & sample counts
│   ├── phase_3b_1_3_model_comparison.csv            # Tabular comparison of all 9 models across Exp A and Exp B
│   ├── phase_3b_1_3_common_crops_comparison.csv     # Per-crop validation counts, MAEs & deltas across identical 13,422 prime rows
│   ├── phase_3b_1_4_report.md                       # Master Phase 3B.1.4 report: Final Audit Corrections
│   ├── phase_3b_1_4_metrics.json                    # Single source of truth for audit verifications down to 10 decimal places
│   ├── phase_3b_1_4_1_report.md                     # Master Phase 3B.1.4.1 report: Sealed-Test Audit Corrections
│   ├── phase_3b_1_4_1_metrics.json                  # Machine-readable Phase 3B.1.4.1 audit metrics & assertions
│   ├── phase_3b_1_4_2_report.md                     # Master Phase 3B.1.4.2 report: Final Audit Hardening
│   ├── phase_3b_1_4_2_metrics.json                  # Single source of truth for Phase 3B.1.4.2 hardened metrics & invariants
│   ├── phase_3b_1_4_3_report.md                     # Master Phase 3B.1.4.3 report: Final Audit Hardening & Clean Packaging
│   ├── phase_3b_1_4_3_metrics.json                  # Machine-readable Phase 3B.1.4.3 audit metrics & assertions
│   ├── phase_3b_2_design.md                         # Master Phase 3B.2 Technical Design: Leakage-Safe Residual Stacking
│   ├── test_manifest_reconciliation.csv             # Test manifest set relations (Exp A: 5,433, Exp B: 6,852, Union: 6,852)
│   └── common_crop_delta_reconciliation.csv         # Full 30-crop delta & weighted error unit reconciliation (exact match)
├── scripts/
│   ├── inspect_datasets.py                          # Automated dataset profiling and summary generation
│   ├── clean_recommendation_data.py                 # Recommendation taxonomy harmonization & benchmark cleaning
│   ├── clean_yield_data.py                          # Yield target derivation, unit segregation & outlier filtering
│   ├── run_area_correlation_analysis.py             # Exploratory bivariate correlation & Cultivated Area analysis
│   ├── run_feature_sensitivity_review.py            # Compatibility wrapper delegating to correlation analysis
│   ├── validate_dataset.py                          # Pre-training automated validation assertion suite (Phase 3A.6)
│   ├── train_yield_baselines.py                     # Trains 6 regression baselines on chronological train partition (Phase 3B.1)
│   ├── evaluate_yield_baselines.py                  # Evaluates baselines on out-of-sample validation partition (Phase 3B.1)
│   ├── run_diagnostic_audit.py                      # Diagnostic audit suite, challenger baseline & metric verifier (Phase 3B.1.1)
│   ├── train_yield_phase_3b_1_2.py                  # Trains OHE, Native Categorical, Target Encoded & Challenger models (Phase 3B.1.2)
│   ├── evaluate_yield_phase_3b_1_2.py               # Independently evaluates Phase 3B.1.2 predictions and metrics (Phase 3B.1.2)
│   ├── reconcile_phase_3b_1_3.py                    # Independent programmatic metrics reconciler & report generator (Phase 3B.1.3)
│   └── reconcile_phase_3b_1_4.py                    # Final audit hardener & verifier (Phase 3B.1.4.3)
└── README.md                                        # This documentation file
```

---

## Reproducible Pipeline Execution

All scripts are idempotent and execute sequentially from the project root (`FieldWise_main/`):

```bash
# 1. Profile and inspect raw datasets
python3 model/ml_pipeline/scripts/inspect_datasets.py

# 2. Clean recommendation benchmark & harmonize canonical crop taxonomy
python3 model/ml_pipeline/scripts/clean_recommendation_data.py

# 3. Clean historical yield dataset, normalize units, segregate non-tonne crops & join rainfall
python3 model/ml_pipeline/scripts/clean_yield_data.py

# 4. Evaluate exploratory bivariate correlations and Cultivated Area sensitivity
python3 model/ml_pipeline/scripts/run_area_correlation_analysis.py

# 5. Run independent pre-training validation assertion suite (Phase 3A.6)
python3 model/ml_pipeline/scripts/validate_dataset.py

# 6. Train historical yield baseline models (Phase 3B.1)
python3 model/ml_pipeline/scripts/train_yield_baselines.py

# 7. Evaluate baseline models on validation partition (Phase 3B.1)
python3 model/ml_pipeline/scripts/evaluate_yield_baselines.py

# 8. Run baseline diagnostic audit, challenger baseline & metric verification (Phase 3B.1.1)
python3 model/ml_pipeline/scripts/run_diagnostic_audit.py

# 9. Train Phase 3B.1.2 models (Corrected OHE/Native/TE encoders & Challenger across N_min in {1, 3, 5})
python3 model/ml_pipeline/scripts/train_yield_phase_3b_1_2.py

# 10. Independently evaluate Phase 3B.1.2 predictions and metrics
python3 model/ml_pipeline/scripts/evaluate_yield_phase_3b_1_2.py

# 11. Reconcile metrics directly from predictions, verify baseline trade-offs & generate master report (Phase 3B.1.3)
python3 model/ml_pipeline/scripts/reconcile_phase_3b_1_3.py

# 12. Run final audit hardening, manifest duplicate validation & clean packaging (Phase 3B.1.4.3)
python3 model/ml_pipeline/scripts/reconcile_phase_3b_1_4.py
```

---

## Data Provenance & Category Classification

In accordance with strict scientific standards, data categories are rigorously segregated:

* **Category A (Real Measured Observations)**: State-level agricultural statistics from DAC&FW (`cleaned_crop_yield.csv`), 227,573 validated pure-tonne records.
* **Category B (Published Agronomic Recommendations)**: Agronomic ranges codified in `canonical_crop_taxonomy.json` compiled from ICAR handbooks, SAU package of practices, and FAO EcoCrop specifications across all 19 canonical crops.
* **Category C (Augmented Agricultural Benchmark)**: `cleaned_crop_recommendation_benchmark.csv` (2,200 rows, 100 rows per class across 22 crops, compiled and augmented by Atharva Ingle from Indian soil, fertilizer, and climatic research; Apache 2.0 license: https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset).

---

## Architectural Separation of Classification Tracks

1. **7-Class Benchmark ML Classifier Track**:
   - Covers strictly the 7 overlapping crops (`rice`, `maize`, `chickpea`, `lentil`, `banana`, `mango`, `cotton`).
   - Evaluates machine learning algorithms and baseline classification mechanics.
   - **Crucial**: High benchmark cross-validation accuracy (~99%) applies strictly to this augmented benchmark and is **never conflated with real-world farm accuracy**.
2. **19-Crop Agronomic Recommendation Engine Track**:
   - Covers all 19 FieldWise canonical crops.
   - Evaluates multi-criteria suitability envelopes derived from ICAR and TNAU agronomic packages of practices (`canonical_crop_taxonomy.json`).
   - Incorporates **Soil Type** and **State / Agro-Ecological Region** as hard agronomic filtering rules.
   - No synthetic observations are fabricated for the 12 missing crops to create a pseudo-ML 19-class model.

---

## Phase 3B.1 Historical Yield Regression Baselines (Validation Results)

Phase 3B.1 evaluates six distinct baseline model architectures across two experimental tracks on the out-of-sample chronological validation set (2012–2013). The final test set (2014–2015) is **strictly sealed**:

### Validation Performance Summary

#### Experiment A — Prime-Only Track (126,375 records total / 13,422 validation records):
* **Random Forest Regressor**: Lowest absolute error (**$\text{MAE} = 1.4774\text{ t/ha}$**, **$\text{MedAE} = 0.2455\text{ t/ha}$**, **$82.1\%$** within $\pm 1.0\text{ t/ha}$, **$55.6\%$** within $\pm 20\%$).
* **Historical District Mean Baseline**: Highest variance explained (**$R^2 = 0.8882$**, **$\text{RMSE} = 5.0410\text{ t/ha}$**, **$\text{MAE} = 1.5013\text{ t/ha}$**).
* **XGBoost Regressor**: Balanced non-linear baseline (**$\text{MAE} = 1.5422\text{ t/ha}$**, **$R^2 = 0.8596$**).
* **Historical State Mean**: $\text{MAE} = 1.6434\text{ t/ha}$, $R^2 = 0.8716$.
* **Extra Trees Regressor**: $\text{MAE} = 1.5942\text{ t/ha}$, $R^2 = 0.8304$.
* **HistGradientBoosting**: $\text{MAE} = 1.7906\text{ t/ha}$, $R^2 = 0.8413$.

#### Experiment B — Prime Plus Provisional Track (161,270 records total / 17,254 validation records):
* **Historical District Mean Baseline**: **$\text{MAE} = 1.3290\text{ t/ha}$**, **$\text{RMSE} = 4.5503\text{ t/ha}$**, **$R^2 = 0.8867$**.
* **Random Forest Regressor**: **$\text{MAE} = 1.3704\text{ t/ha}$**, **$\text{MedAE} = 0.2315\text{ t/ha}$**, **$82.5\%$** within $\pm 1.0\text{ t/ha}$, $R^2 = 0.8357$.
* **XGBoost Regressor**: $\text{MAE} = 1.4451\text{ t/ha}$, $R^2 = 0.8637$.

### Key Insights & Agronomic Principles:
1. **The Dual Baseline Paradigm**: Historical District Mean excels at capturing long-term geographic baseline yield ($R^2 \approx 0.89$, especially on low-frequency crops where tree splits are sparse), while Random Forest excels on field-level absolute accuracy on staple crops (Rice MAE $0.45\text{ t/ha}$, Wheat MAE $0.46\text{ t/ha}$).
2. **Provisional Crops Expansion (Audit Update)**: Adding provisional crops expanded geographic and taxonomic coverage by $34,895$ records across 60 crops. While aggregate pooled error remained nearly neutral for linear/mean baselines ($\Delta\text{MAE} = -0.0006\text{ t/ha}$), decision tree ensembles exhibited localized error shifts (detailed in Phase 3B.1.1 audit).
3. **Sealed Test Set Guarantee**: 2014–2015 holdout ($10,905$ total rows / $5,433$ in Exp A / $6,852$ in Exp B) remains completely unexamined and sealed for final benchmark reporting.

---

## Phase 3B.1.1 Baseline Diagnostic Audit

Phase 3B.1.1 performed an exhaustive post-hoc diagnostic audit of baseline validation results (`reports/phase_3b_1_1_diagnostic_audit.md` and `reports/phase_3b_1_1_metrics.json`):

1. **Baseline Lookup Logic & Hierarchical Challenger**:
   - The existing `historical_district_mean` operates on `(Crop, District) -> (Crop, State) -> (Crop) -> Global Mean` without `Season` (minimum 1 training observation).
   - The recommended **Hierarchical District Challenger** incorporates `Season` (`District + Crop + Season` at Level 1). Evaluated out-of-sample on 2012–2013 validation data, it strictly outperforms the existing baseline across every metric:
     - **Exp A**: $\text{MAE} = \mathbf{1.4209\text{ t/ha}}$ (vs. 1.5013), $\text{RMSE} = \mathbf{4.9604\text{ t/ha}}$ (vs. 5.0410), $R^2 = \mathbf{0.8918}$ (vs. 0.8882).
     - **Exp B**: $\text{MAE} = \mathbf{1.2611\text{ t/ha}}$ (vs. 1.3290), $\text{RMSE} = \mathbf{4.4721\text{ t/ha}}$ (vs. 4.5503), $R^2 = \mathbf{0.8905}$ (vs. 0.8867).
     - Over **95.5%–96.6%** of validation predictions resolve at Level 1 (`District + Crop + Season`).
2. **Per-Crop Audit of the $\le +0.02\text{ t/ha}$ Claim**:
   - The Phase 3B.1 summary claim that *"adding provisional records changes common-crop MAE by no more than +0.02 t/ha"* was audited and found **empirically FALSE at the per-crop level**.
   - At the pooled level across all 30 common prime crops, **Extra Trees** degraded by **$+0.0445\text{ t/ha}$** and **Random Forest** degraded by **$+0.0234\text{ t/ha}$**.
   - At the individual crop level, 42 crop-model pairs exceeded $+0.02\text{ t/ha}$. Most severely, **Tomato** MAE under Random Forest spiked by **$+9.0112\text{ t/ha}$** (from 7.0940 to 16.1053 t/ha, a $+127.0\%$ error increase) due to ordinal encoding index shifting from index 26 to 52 when 27 provisional crops were interleaved alphabetically.
   - For **Lentil**, Historical District Mean MAE shifted by $-0.8412\text{ t/ha}$ because Lentil had zero training samples in 1997–2011 and fell back to changing global training means (5.44 vs 4.60 t/ha).
3. **Residual Diagnostics & High-Loss Concentration**:
   - Errors are massively concentrated in high-yield crops. In Experiment A Random Forest, **Sugarcane** (49.42%), **Papaya** (31.49%), and **Banana** (8.10%) account for **89.01% of all squared errors** across the dataset (despite representing only 6.62% of validation records).
   - Largest absolute errors occur in Papaya (underpredicted by up to 118.2 t/ha in AP) and Sugarcane (actual yield collapse in Thrissur, Kerala to 2.0 t/ha vs historical mean 95.7 t/ha).
4. **Low-Frequency Crop Clarification ($< 250$ Records)**:
   - Defined strictly as $< 250$ validation records.
   - Exp A contains 9 low-frequency crops (793 records); Exp B contains 27 low-frequency crops (2,291 records).
   - The previously reported $R^2$ values (**0.7980** for District Mean and **0.4165** for RF) are **POOLED $R^2$** values, not macro-averaged. Unweighted macro $R^2$ is mathematically degenerate on low-frequency crops due to near-zero within-crop variances (e.g. Lentil variance = 0.00018). Macro-averaged MAE is well-behaved: **5.7297 t/ha** (District Mean) vs **9.4695 t/ha** (Random Forest).
5. **Metric Verification**:
   - Recomputation from saved `validation_predictions.csv` files confirmed zero discrepancies ($0.000000$) across all metrics.
6. **Sealed-Test Safeguards**:
   - The 2014–2015 test set (10,905 records) remains strictly sealed, unread, and unpredicted.

---

## Phase 3B.1.2 Categorical Encoding Correction & Challenger Verification

Phase 3B.1.2 evaluated corrected categorical feature representations and independently re-evaluated the 7-level Seasonal Hierarchical District Challenger across observation thresholds ($N_{\min} \in \{1, 3, 5\}$):

### 1. Categorical Encoders Evaluated:
* **One-Hot Encoding**: Handled unknown validation categories via `handle_unknown="ignore"`. Output: 537 binary features in Exp A, 564 in Exp B.
* **Native Categorical Tree Support**: XGBoost with `enable_categorical=True` utilizing pandas `category` dtypes.
* **Leakage-Safe Target Encoding**: 5-fold cross-validated target encoding fitted strictly on the training partition (`TargetEncoder(smooth="auto", cv=5)`).

### 2. Verified Benchmark Performance (2012–2013 Validation Partition):

* **Experiment A (Prime-Only, 13,422 validation records)**:
  - **Challenger ($N_{\min}=1$)**: **$\text{MAE} = 1.4209\text{ t/ha}$**, $\text{RMSE} = 4.9604\text{ t/ha}$, $R^2 = 0.8918$, **$\text{MedAE} = 0.2842\text{ t/ha}$**.
  - **Challenger ($N_{\min}=5$)**: $\text{MAE} = 1.4349\text{ t/ha}$, **$\text{RMSE} = 4.9535\text{ t/ha}$**, **$R^2 = 0.8921$**, $\text{MedAE} = 0.2887\text{ t/ha}$.
  - **Native Categorical XGBoost**: $\text{MAE} = 1.4464\text{ t/ha}$, $\text{RMSE} = 5.8524\text{ t/ha}$, $R^2 = 0.8494$, **$\text{MedAE} = 0.2528\text{ t/ha}$**.
  - **Target-Encoded Random Forest**: $\text{MAE} = 1.5320\text{ t/ha}$, $\text{RMSE} = 5.9842\text{ t/ha}$, $R^2 = 0.8425$, $\text{MedAE} = 0.2581\text{ t/ha}$.
  - **One-Hot Random Forest**: $\text{MAE} = 1.6420\text{ t/ha}$, $\text{RMSE} = 5.9252\text{ t/ha}$, $R^2 = 0.8456$.
  - **One-Hot Extra Trees**: $\text{MAE} = 1.7098\text{ t/ha}$, $\text{RMSE} = 6.0174\text{ t/ha}$, $R^2 = 0.8408$.

* **Experiment B (Prime + Provisional, 17,254 validation records)**:
  - **Challenger ($N_{\min}=1$)**: **$\text{MAE} = 1.2611\text{ t/ha}$**, $\text{RMSE} = 4.4721\text{ t/ha}$, $R^2 = 0.8905$, **$\text{MedAE} = 0.2446\text{ t/ha}$**.
  - **Challenger ($N_{\min}=5$)**: $\text{MAE} = 1.2660\text{ t/ha}$, **$\text{RMSE} = 4.4568\text{ t/ha}$**, **$R^2 = 0.8913$**, $\text{MedAE} = 0.2507\text{ t/ha}$.
  - **Target-Encoded Random Forest**: $\text{MAE} = 1.4191\text{ t/ha}$, $\text{RMSE} = 5.4467\text{ t/ha}$, $R^2 = 0.8376$.
  - **Native Categorical XGBoost**: $\text{MAE} = 1.5201\text{ t/ha}$, $\text{RMSE} = 6.8505\text{ t/ha}$, $R^2 = 0.7432$.
  - **One-Hot Random Forest**: $\text{MAE} = 1.5914\text{ t/ha}$, $\text{RMSE} = 4.6729\text{ t/ha}$, $R^2 = 0.8805$.

### 3. Key Findings & Anomaly Resolutions:
1. **Tomato Error Fully Stabilized**: The $+9.01\text{ t/ha}$ error spike in Ordinal Random Forest was an artifact of alphabetical category interleaving. Under Native Categorical XGBoost ($\Delta = -0.15\text{ t/ha}$), Target-Encoded Random Forest ($\Delta = -0.77\text{ t/ha}$), and One-Hot Random Forest ($\Delta = -1.38\text{ t/ha}$), Tomato error is completely stable across Exp A and Exp B.
2. **Observation Threshold Trade-Off**: $N_{\min}=1$ yields the lowest point MAE ($1.4209\text{ t/ha}$ in A; $1.2611\text{ t/ha}$ in B) by maximizing district specificity. $N_{\min}=5$ yields the lowest RMSE ($4.9535\text{ t/ha}$ in A; $4.4568\text{ t/ha}$ in B) by filtering volatile, low-sample district cells.
3. **Low-Frequency Crop Performance Record**: On crops with $< 250$ validation rows, the Challenger ($N_{\min}=1$) achieves a record **$R^2 = 0.8028$** and **$\text{MAE} = 4.2652\text{ t/ha}$**, outperforming tree models by over $1.8\text{ t/ha}$.
4. **Common Prime Crop Cross-Experiment Stability**: Evaluated across identical 13,422 validation rows, all corrected models satisfy $\Delta\text{MAE} < 0.01\text{ t/ha}$ (One-Hot RF: $-0.0063\text{ t/ha}$; One-Hot ET: $+0.0056\text{ t/ha}$; Native XGB: $+0.0091\text{ t/ha}$; Challenger: $-0.0006\text{ t/ha}$).
5. **Sealed-Test Set Integrity**: The 2014–2015 test set (10,905 records) remains strictly sealed. No test-set predictions, metrics, or test-based decisions were produced.

---

## Phase 3B.1.3 Metrics Reconciliation, Stability Decomposition & Final Baseline Selection

Phase 3B.1.3 performed an exhaustive mathematical reconciliation and independent programmatic audit of all validation metrics and cross-experiment stability claims (`reports/phase_3b_1_3_report.md` and `reports/phase_3b_1_3_metrics.json`):

### 1. Independent Recalculation & Explicit Denominators:
* All 8 metrics (MAE, RMSE, $R^2$, MedAE, MAPE, Within $1\text{ t/ha}$, Within $10\%$, Within $20\%$) were recomputed directly from the saved prediction CSVs.
* Denominators are explicitly reported to prevent division-by-zero bias on relative metrics:
  - **Experiment A**: Total $N = 13,422$; Non-zero denominator ($y > 0.01\text{ t/ha}$) $N = 13,419$ (3 records $\le 0.01\text{ t/ha}$ excluded from MAPE and percentage tolerances).
  - **Experiment B**: Total $N = 17,254$; Non-zero denominator ($y > 0.01\text{ t/ha}$) $N = 17,251$ (3 records $\le 0.01\text{ t/ha}$ excluded).
* All Markdown tables are generated programmatically from `phase_3b_1_3_metrics.json` with zero manual transcription error.

### 2. Decomposition of the Stability Paradox (Aggregate vs. Per-Crop):
* The Phase 3B.1.2 summary claim that corrected tree models were "stable across common prime crops" with $\Delta\text{MAE} < 0.01\text{ t/ha}$ was proven to be an **aggregate artifact masking major per-crop shifts**:
  - Under One-Hot RF, **18 of 30 common prime crops exhibited $|\Delta\text{MAE}| > 0.05\text{ t/ha}$**.
  - Negative error shifts in sparse horticultural crops (**Papaya** $-17.58\text{ t/ha}$, **Grapes** $-15.24\text{ t/ha}$, **Cabbage** $-4.72\text{ t/ha}$, totalling $-1,474.3\text{ error units}$) almost exactly cancelled out positive error increases in major field crops (**Barley** $+0.75\text{ t/ha}$, **Wheat** $+0.43\text{ t/ha}$, **Sesamum** $+0.37\text{ t/ha}$, **Maize** $+0.31\text{ t/ha}$, totalling $+1,340.7\text{ error units}$), netting an aggregate shift of only $-0.0063\text{ t/ha}$.
* In sharp contrast, the **Seasonal Hierarchical Challenger ($N_{\min}=1$)** exhibited exact invariance: **29 of 30 common crops had $\Delta\text{MAE} = 0.0000\text{ t/ha}$**, with only **Lentil** ($-0.8412\text{ t/ha}$) shifting due to zero training observations in those districts falling back to a lower national global mean.

### 3. Multi-Metric Resolution of Challenger Thresholds ($N_{\min} \in \{1, 3, 5\}$):
* **$N_{\min}=1$**: Lowest MAE ($1.4209\text{ t/ha}$ in A; $1.2611\text{ t/ha}$ in B), lowest MedAE ($0.2842\text{ t/ha}$ in A; $0.2446\text{ t/ha}$ in B), with **$96.6\%$** resolving at Level 1 (`District + Crop + Season`). Captures granular local micro-climates.
* **$N_{\min}=5$**: Lowest RMSE ($4.9535\text{ t/ha}$ in A; $4.4568\text{ t/ha}$ in B), highest $R^2$ ($0.8921$ in A; $0.8913$ in B). Prunes noisy 1-to-4 sample micro-cells, routing $12.0\%$ to broader regional tiers to compress tail loss.
* **$N_{\min}=3$**: Balanced intermediate point (MAE $1.4334\text{ t/ha}$, RMSE $4.9548\text{ t/ha}$, $R^2 = 0.8920$, $91.1\%$ Level 1).

### 4. Defensible Baseline & Benchmark Selection:
* **Primary Historical Baseline**: **7-Level Seasonal Hierarchical Challenger ($N_{\min}=1$)** — establishes the empirical spatial-seasonal prior against which predictive models must be evaluated.
* **Secondary ML Benchmark**: **Native Categorical XGBoost** — best machine learning model (MAE $1.4464\text{ t/ha}$, MedAE $0.2528\text{ t/ha}$, $\le 1.0\text{ t/ha} = 82.15\%$), capable of dynamic conditioning on continuous rainfall covariates without high-dimensional one-hot sparsity.

### 5. Agronomic Distinction: District Baseline vs. Farm-Level Production Model:
* A district historical lookup represents **macro-level regional central tendency** averaged over thousands of diverse holdings.
* A farm-level production tool requires **field-specific causal features** (soil chemistry NPK/pH, irrigation methods, sowing dates, seed varieties, in-season rainfall shocks).
* Beating the historical baseline is **necessary** to prove genuine signal extraction beyond geographic inertia, but **not sufficient** for farm-level deployment, where predicting regional averages is uninformative for individual plot management.

### 6. Sealed-Test Set Safeguards:
* The 2014–2015 chronological test partitions (10,905 total records / 5,433 in Exp A / 6,852 in Exp B) remain **strictly unexamined and sealed**. Zero test predictions, zero test metrics, and zero test-informed model decisions.

---

## Phase 3B.1.4 Final Audit Corrections

Phase 3B.1.4 resolved all remaining audit and documentation inconsistencies before final baseline sign-off (`reports/phase_3b_1_4_report.md` and `reports/phase_3b_1_4_metrics.json`):

### 1. Test Manifest Set Reconciliation:
* Inspected `raw_row_id` metadata lists directly from `split_manifest.json` for Exp A and Exp B without loading test targets:
  - **Experiment A Test Count**: **5,433 records** (Prime-only).
  - **Experiment B Test Count**: **6,852 records** (Prime + Provisional).
  - **Intersection ($A \cap B$)**: **5,433 records** ($A \cap B = A$).
  - **Union ($A \cup B$)**: **6,852 records** ($A \cup B = B$).
  - **Subset Relationship**: **Experiment A is a strict subset of Experiment B ($A \subset B$)**; difference $B \setminus A = 1,419$ provisional test records.
* **Correction of Unique Record Count**: Across the two experiments, the unique test record count is **6,852**, not 10,905. The 10,905 count represents the entire dataset-wide test partition (which includes 6,852 eligible baseline + 3,391 conditional unmatched rainfall + 662 excluded crop records). Documented in [`reports/test_manifest_reconciliation.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/test_manifest_reconciliation.csv).

### 2. Programmatic Verification of Aggregate Stability Arithmetic:
* Evaluated per-crop and direct pooled MAE changes across all 13,422 common prime validation rows across all 9 models:
  - Formally proved: $\Delta\text{MAE}_{\text{pooled}} = \frac{1}{N_{\text{total}}} \sum_{c=1}^{30} N_c \cdot \Delta\text{MAE}_c$.
  - In One-Hot Random Forest, sum of positive error units ($+1,817.6533$) and negative error units ($-1,902.1125$) sums to net $-84.4592\text{ error units}$.
  - Weighted aggregate delta: $-84.4592 / 13,422 = \mathbf{-0.006293\text{ t/ha}}$.
  - Direct pooled delta: $\mathbf{-0.006293\text{ t/ha}}$.
  - **Absolute Discrepancy**: $\mathbf{0.0000000000\text{ t/ha}}$ (**EXACT MATCH VERIFIED**).
  - Exported complete 30-crop breakdown in [`reports/common_crop_delta_reconciliation.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/common_crop_delta_reconciliation.csv).

### 3. Challenger `min_obs` Implementation Clarified:
* Inspected `SeasonalHierarchicalChallenger._get_group_means` in `train_yield_phase_3b_1_2.py`:
  - Determined that `min_obs` filters on `agg["count"]`, which counts **individual historical records (rows)**, NOT distinct `Crop_Year` values (`nunique("Crop_Year")`).
  - Documented that $99.62\%$ of training cells have 1 record per year, but $729$ cells ($0.38\%$) have 2 records in a year due to multi-state district homonyms (e.g. Aurangabad Bihar vs. Maharashtra).
  - Documented limitation: multi-record cells can meet $N_{\min}=3$ with fewer than 3 distinct years.
  - Specified proposed Phase 3C experiment: `SeasonalHierarchicalDistinctYearChallenger` using `distinct_years >= min_distinct_years` and including `State` in Level 1/2 keys.
  - Preserved Phase 3B.1.2 models without silent changes.

### 4. Accurate Characterization of Native Categorical XGBoost:
* Documented exact 7 features: `State`, `District`, `Season`, `Crop`, `Crop_Year`, `district_normal_annual_rainfall_mm`, `district_normal_monsoon_rainfall_mm`.
* Clarified that rainfall features are **static 30-year IMD climatological normals (1901–2000)**, NOT actual in-season rainfall or weather anomalies.
* Certified complete absence of weather shocks, temperature, soil chemistry (NPK, pH), and farm management.
* Accurately characterized as a **historical district-level machine learning benchmark**, not a farm-level advisory tool.

---

## Phase 3B.1.4.1 Sealed-Test Audit Corrections

Phase 3B.1.4.1 implemented critical audit and data-isolation corrections resolving formal review feedback on Phase 3B.1.4 (`reports/phase_3b_1_4_1_report.md` and `reports/phase_3b_1_4_1_metrics.json`):

### 1. Critical Column-Level Isolation for Sealed-Test Targets:
* In `scripts/reconcile_phase_3b_1_4.py`, the `audit_min_obs_implementation()` function previously loaded the full cleaned dataset before filtering for training years (`Crop_Year <= 2011`). While no test targets were predicted or evaluated, this loaded 2014–2015 test targets into memory.
* **Correction Applied**: The function now strictly specifies:
  ```python
  audit_cols = ["Crop_Year", "District", "Crop", "Season"]
  df = pd.read_csv(cleaned_path, usecols=audit_cols)
  assert "Yield_Tonnes_Per_Ha" not in df.columns
  assert "Production" not in df.columns
  assert "Cultivated_Area_Ha" not in df.columns
  train_df = df[df["Crop_Year"] <= 2011].copy()
  ```
* Formal assertions verify that `Yield_Tonnes_Per_Ha`, `Production`, `Cultivated_Area_Ha`, and all target columns are completely absent from memory.

### 2. Strengthened Validation Row Alignment Assertions:
* In `audit_stability_arithmetic()`, after selecting and sorting common prime validation rows across Experiment A and Experiment B ($13,422$ records), four explicit assertions verify complete identity:
  1. `assert len(df_a_sorted) == len(df_b_prime) == 13422` (Row counts match).
  2. `assert np.array_equal(df_a_sorted["raw_row_id"].values, df_b_prime["raw_row_id"].values)` (Sorted IDs identical).
  3. `assert np.array_equal(df_a_sorted["Crop"].values, df_b_prime["Crop"].values)` (Crop labels match row by row).
  4. `assert np.allclose(df_a_sorted["Yield_Tonnes_Per_Ha"].values, df_b_prime["Yield_Tonnes_Per_Ha"].values, atol=1e-6)` (Validation targets match row by row).

### 3. Clear Attribution of Dataset-Wide Test Partition Counts:
* **Independently Verified Manifest Counts**:
  - Experiment A test manifest: **5,433 records** (Prime-only, verified from `split_manifest.json` `raw_row_ids`).
  - Experiment B test manifest: **6,852 records** (Prime + Provisional, verified from `split_manifest.json` `raw_row_ids`).
  - Intersection ($A \cap B$): **5,433 records** ($A \cap B = A$).
  - Union ($A \cup B$): **6,852 records** ($A \cup B = B$, unique verified baseline test records).
  - Difference ($B \setminus A$): **1,419 records** (Provisional-only test records).
  - Subset Relation: **$A \subset B$ is a strict subset** ($A \neq B$).
* **Inherited Summary Count**:
  - **10,905 records** is an inherited figure from `reports/validation_summary.json` (Phase 3A.6 summary report). It was not independently derived from an unpartitioned test row ID list in this audit.
* **Derived Conditional / Excluded Count**:
  - **4,053 records** is derived strictly by subtraction ($10,905 - 6,852 = 4,053$). The breakdown of 3,391 unmatched rainfall and 662 excluded crop records is documented from Phase 3A.6 documentation.

---

## Phase 3B.1.4.2 Final Audit Hardening (No Model Training)

Phase 3B.1.4.2 implemented comprehensive audit hardening across code, data, and assertions (`reports/phase_3b_1_4_2_report.md` and `reports/phase_3b_1_4_2_metrics.json`):

### 1. Real Source-Code AST Audit of `min_obs`:
* Abstract Syntax Tree (`ast`) inspection directly analyzes `SeasonalHierarchicalChallenger._get_group_means` and `fit` in `train_yield_phase_3b_1_2.py`:
  - Verified grouping call: calls `groupby(group_cols)` using the `group_cols` argument.
  - Verified aggregation: calls `.agg(["mean", "count"])`, confirming row-count aggregation.
  - Verified count filter: evaluates `agg["count"] >= self.min_obs` with `>=` comparison.
  - Verified absence of distinct-year counting: walked all AST nodes of `_get_group_means`, confirming zero `nunique` calls.
  - Verified 6 hierarchical fallback keys in `fit`: `['District', 'Crop', 'Season']`, `['District', 'Crop']`, `['State', 'Crop', 'Season']`, `['State', 'Crop']`, `['Crop', 'Season']`, `['Crop']`, plus global mean.

### 2. Empirical Verification of District Homonyms:
* Audit read is strictly confined to non-target columns: `['State', 'District', 'Crop', 'Season', 'Crop_Year']` from `cleaned_crop_yield.csv`.
* Grouped 1997–2011 training data by `(District, Crop, Season, Crop_Year)`:
  - Total cells: **190,541 cells**.
  - Single-record cells: **189,812 cells (99.62%)**.
  - Multi-record cells: **729 cells (0.38%)**.
* Empirical state-distribution evaluation:
  - Multi-record cells spanning multiple states (`state_nunique > 1`): **729 cells (100.0%)**.
  - Multi-record cells within a single state (`state_nunique == 1`): **0 cells (0.0%)**.
* **Empirical Attribution Proved**: Exactly 729 of 729 (100.0%) multi-record training cells are inter-state district homonyms across 7 specific district pairs (`AURANGABAD` Bihar vs. Maharashtra, `BALRAMPUR` Chhattisgarh vs. UP, `BILASPUR` Chhattisgarh vs. HP, `HAMIRPUR` HP vs. UP, `KHERI` Assam vs. UP, `PRATAPGARH` Rajasthan vs. UP, `VIJAYAPURA` Chhattisgarh vs. Karnataka). Zero multi-record cells occur within a single state.

### 3. Strengthened Validation Prediction Invariants:
* Invariants asserted on `validation_predictions.csv`:
  - 100% non-null, unique `raw_row_id` values in both Exp A and Exp B.
  - All 9 required prediction columns present and populated with 100% finite values.
  - Exactly 13,422 common prime validation rows across exactly 30 common crop labels.
  - Sorted IDs, crop labels, and validation target values match row by row.
  - Formal assertion verified for all 9 models: $|\Delta\text{MAE}_{\text{pooled}} - \Delta\text{MAE}_{\text{weighted}}| < 10^{-9}$ (all models reconcile within $< 4 \times 10^{-16}$).

### 4. Enforced Manifest Invariants:
* Asserted invariant relationships on `split_manifest.json`:
  - Exp A test IDs = 5,433; Exp B test IDs = 6,852.
  - Exp A is a strict subset of Exp B ($A \subset B$, $A \neq B$).
  - Intersection = 5,433; Union = 6,852; $B \setminus A = 1,419$; $A \setminus B = 0$.
  - Derived conditional/excluded count is non-negative and equals exactly 4,053 ($10,905 - 6,852$).

### 5. Truthful and Precise Audit Isolation Language:
* The cleaned-dataset audit reads only its specified non-target columns (`State`, `District`, `Crop`, `Season`, `Crop_Year`). Target columns are asserted absent.
* Validation target values are read only from saved 2012–2013 validation prediction files.
* Zero 2014–2015 test target values are loaded, inspected, or evaluated.

---

## Phase 3B.1.4.3 Final Audit Hardening & Clean Packaging (No Model Training)

Phase 3B.1.4.3 finalized the audit pipeline with strict AST sequence assertions, manifest duplicate validation, and pristine packaging (`reports/phase_3b_1_4_3_report.md` and `reports/phase_3b_1_4_3_metrics.json`):

### 1. Strengthened AST Hierarchy Order Invariant:
* Formally asserted that the 6 hierarchical grouping levels in `SeasonalHierarchicalChallenger.fit` (`train_yield_phase_3b_1_2.py`) match the exact expected sequence:
  1. Level 1: `['District', 'Crop', 'Season']`
  2. Level 2: `['District', 'Crop']`
  3. Level 3: `['State', 'Crop', 'Season']`
  4. Level 4: `['State', 'Crop']`
  5. Level 5: `['Crop', 'Season']`
  6. Level 6: `['Crop']`
* Explicitly asserts: `len(fit_hierarchy_keys) == 6`, zero duplicate combinations, and exact pairwise match in order (`actual_k == expected_k`).

### 2. Strengthened Manifest Duplicate Validation:
* Before performing set operations, asserted zero duplicate raw row IDs in both manifests:
  - Exp A test raw ID list: 5,433 entries, 5,433 unique (0 duplicates).
  - Exp B test raw ID list: 6,852 entries, 6,852 unique (0 duplicates).
* Preserved all set invariants: $A \subset B$, $A \cap B = 5,433$, $A \cup B = 6,852$, $B \setminus A = 1,419$, $A \setminus B = 0$, non-negative derived count (4,053).

### 3. Clean Archive Packaging:
* Verified that `FieldWise_Phase3B_1_Review.zip` strictly excludes:
  - All `.env` files (including nested `.env` and `.env.example`).
  - `.git` version control directories.
  - `node_modules` and dependency trees.
  - `dist` and build outputs.
  - `__pycache__` and bytecode caches.
  - `.DS_Store` and temporary system files.

---

## Phase 3B.2 Technical Design: Leakage-Safe Residual Stacking

The technical design specification for evaluating residual stacking on top of the Seasonal Hierarchical Challenger is established in [`reports/phase_3b_2_design.md`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/phase_3b_2_design.md):
* **Core Hypothesis**: Tests whether a Level-1 model (L2 Ridge or shallow LightGBM) trained on out-of-fold residuals ($r_i = y_i - \hat{y}_{\text{base}, i}$) can learn secular yield drift (`Crop_Year`) and climatological normal interactions without corrupting the localized 96.6% Level-1 baseline accuracy.
* **Leakage-Proof OOF Strategy**: Formally bans in-sample residuals; specifies a 4-Stage Purged Expanding Temporal Walk-Forward CV ($1997–2002 \to 2003–2011$).
* **Shrinkage & Guardrails**: Enforces level-dependent attenuation ($\alpha = 0.2$ for Level 1, $0.5$ for fallback) and hard biological bounding $[0.001, \; 2T_c]$.
* **Harm Detection Protocol**: Formalizes the Crop Harm Rate ($H_{\text{crop}}$) and strict agronomic stop-loss rules protecting national food security staples (Wheat, Rice, Gram).
* **Sealed-Test Firewall**: Strictly preserves the 2014–2015 test holdout (zero predictions, zero metrics, zero model selection).

---

## Phase 3A.6 Training Eligibility & Chronological Split Architecture

### 1. Reconciled Chronological Holdout Partitions

* **Total Cleaned Dataset (227,573 records)**:
  - **Training Set (1997–2011, 15 years)**: **191,270 records** (84.05%) | 33 states, 631 districts, 87 crops.
  - **Validation Set (2012–2013, 2 years)**: **25,398 records** (11.16%) | 26 states, 552 districts, 73 crops.
  - **Test Set (2014–2015, 2 years, SEALED)**: **10,905 records** (4.79%) | 22 states, 426 districts, 70 crops.
  - **Sum**: $191,270 + 25,398 + 10,905 = 227,573$ records ($\Delta = 0$).

* **Eligible Baseline Subset (161,270 records)**:
  - **Training Set (1997–2011)**: **137,164 records** (85.05%) | 28 states, 471 districts, 56 crops.
  - **Validation Set (2012–2013)**: **17,254 records** (10.70%) | 22 states, 392 districts, 55 crops.
  - **Test Set (2014–2015, SEALED)**: **6,852 records** (4.25%) | 18 states, 293 districts, 55 crops.
  - **Sum**: $137,164 + 17,254 + 6,852 = 161,270$ records ($\Delta = 0$).

* **Excluded Subset (13,819 records)**:
  - **Training Set (1997–2011)**: **11,877 records**.
  - **Validation Set (2012–2013)**: **1,280 records**.
  - **Test Set (2014–2015, SEALED)**: **662 records**.
  - **Sum**: $11,877 + 1,280 + 662 = 13,819$ records ($\Delta = 0$).

### 2. Multidimensional Training Eligibility Pools

* **Eligible Prime (`eligible_prime`)**: **126,375 records** (30 crops, 55.53%) — Verified source passage + individual botanical crop + $\le T$ + matched rainfall.
* **Eligible Provisional (`eligible_provisional`)**: **34,895 records** (30 crops, 15.33%) — Provisional agronomic estimate + individual botanical crop + $\le T$ + matched rainfall.
* **Combined Eligible Baseline Pool**: **161,270 records** (60 crops, 70.87%) — Unified baseline dataset for Phase 3B single-crop regression modeling.
* **Conditional Unmatched Rainfall (`conditional_unmatched_rainfall`)**: **49,165 records** (59 crops, 21.60%) — Documented individual crops with $\le T$ but missing IMD normals due to administrative district bifurcations (e.g. Telangana 2014).
* **Conditional High Yield (`conditional_high_yield`)**: **39 records** (18 crops, 0.02%) — High observations ($T < \text{yield} \le 2T$) with matched rainfall, retained for manual review.
* **Conditional Other (`conditional_other`)**: **3,280 records** (33 crops, 1.44%) — 29 retained high observations with unmatched rainfall + 3,251 unmapped minor crop records (2,465 matched, 786 unmatched).
* **Excluded (`excluded`)**: **13,819 records** (17 crops, 6.07%) — Macro-aggregates, composite residuals, and ambiguous product bases.
* **Total**: Exactly **227,573 records** ($\Delta = 0$).

### 3. Excluded Crops Inventory (17 Categories, 13,819 Records)

Documented in machine-readable format in [`reports/crop_exclusion_and_mapping_inventory.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/crop_exclusion_and_mapping_inventory.json):
* **Macro-Aggregates (3 categories, 865 records)**: `Total foodgrain` (188), `Pulses total` (264), `Oilseeds total` (413). High-level summaries grouping incompatible biological crops.
* **Composite Residuals (12 categories, 12,923 records)**: `Other Kharif pulses` (3,511), `Other  Rabi pulses` (3,051), `Peas & beans (Pulses)` (4,415), `Other Cereals & Millets` (608), `other oilseeds` (572), `Other Fresh Fruits` (153), `Other Vegetables` (95), `other misc. pulses` (49), `Cond-spcs other` (18), `Pome Fruit` (169), `Citrus Fruit` (180), `Beans & Mutter(Vegetable)` (102). Multi-species blends with unspecifiable agronomic envelopes.
* **Ambiguous Product Basis (2 categories, 31 records)**:
  - `Kapas` (12 records): Unginned seed cotton (~65% seed, ~35% lint) in metric tonnes, non-comparable to ginned lint bales or food grains.
  - `Cashewnut Processed` (19 records): Processed edible kernel, whereas kernel outturn is only 22–28% of raw nut in shell (`Cashewnut` / `Cashewnut Raw`).

### 4. Retained High-Yield Observations (68 Records Across 21 Crops)

* Exactly **68 records** across 21 crops fall between screening threshold $T$ and extreme bound $2T$ ($T < \text{yield} \le 2T$).
* **Rainfall Match**: 39 records have matched IMD normals; 29 records have unmatched normals.
* **Zero Extreme Biological Outliers**: 0 records exceed $2T$ (all 47 extreme outliers $> 2T$ were removed in cleaning).
* **Retention Rationale**: Retained to avoid artificial high-yield distribution truncation; flagged for manual review (e.g. green chillies reported under dry chillies, fresh rhizomes, high-input drip fertigation).

### 5. Scientific Validation Scope & Known Data Limitations

* **Programmatic Software Verification vs. Agronomic Validation**: Automated assertions verify software implementation fidelity (relational schema conformance, unit conversions, row-by-row arithmetic, exact set equality). They confirm that the code executed as programmed, but do **not** substitute for external agronomic validation of physical literature passages or field predictive accuracy.
* **30-Year IMD Rainfall Normals Limitation**: The joined rainfall features represent 30-year climatological normals (1901–2000), not the actual real-time historical weather that occurred during the specific growing season of that crop year. Models learn spatial climatic zones, not annual drought/flood shocks.

---

## Strict Safeguards & Yield Quality Architecture

1. **Pure Metric Tonne Target (`Yield_Tonnes_Per_Ha`)**:
   - `cleaned_crop_yield.csv` strictly contains crops whose production was officially measured in metric tonnes ($227,573$ records).
   - Commercial fibers reported in bales (`Cotton`, `Jute`, `Mesta`) are segregated into dedicated datasets with target `Yield_Bales_Per_Ha`.
   - Coconut (nuts) is segregated into `segregated_coconut_nuts_yield.csv` with target `Yield_Nuts_Per_Ha`.
   - Arecanut (mixed dry kernel vs. fresh nut state reporting) is segregated into `segregated_arecanut_yield.csv` with target `Yield_Raw_Reported_Per_Ha`.
2. **Crop-Specific Screening Thresholds**:
   - Crop-specific screening thresholds ($T$) with extreme plausibility bounds ($2T$) across 60 verified crops ($210,503$ records) with traceable primary institutional citations (`threshold_provenance.json`).
   - All 60 documented crops are partitioned into 30 verified source passage crops and 30 provisional agronomic estimate crops.
3. **Independent Row-by-Row Yield Derivation & Exact Set Equality**:
   - Evaluates every single yield value against raw $\text{Production} / \text{Cultivated\_Area\_Ha}$ using documented conversion factors.
   - Exact dynamic set equality ($A = B$) verified for ALL 6 processed datasets against independently derived expected sets.
   - Maximum numerical discrepancy observed across all $227,573$ cleaned records is $0.00050000 \le 0.001$ (matching the theoretical half-unit bound for 3-decimal rounding).
4. **Anti-Leakage & Area Sensitivity Specification**:
   - `Production` is strictly excluded from all model feature sets.
   - `Cultivated_Area_Ha` is strictly excluded from the baseline feature set to prevent scale disparity artifacts.
   - Baseline features: `['State', 'District', 'Crop_Year', 'Season', 'Crop', 'district_normal_annual_rainfall_mm', 'district_normal_monsoon_rainfall_mm']`.
5. **Sequential Cleaning Pipeline ($246,091 \to 227,573$ records)**:
   - $R_0 = 246,091$ (Raw starting rows)
   - Dropped null production: 3,730
   - Dropped non-positive area: 0
   - Dropped zero production: 3,523
   - Dropped negligible yield ($< 0.005\text{ t/ha}$): 124
   - Segregated: Coconut (1,957), Cotton (4,327), Jute & Mesta (3,196), Arecanut (1,578), Unverified (35)
   - Dropped extreme biological outliers: 47 tonne outliers ($> 2T$), 1 jute outlier
   - $R_{\text{clean}} = 227,573$ records
   - All 12 partition subsets are strictly pairwise disjoint and sum to exactly $246,091$ records ($\Delta = 0$).
