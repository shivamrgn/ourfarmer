# FieldWise ML Pipeline — Processed Recommendation Data Registry

## 1. Directory Purpose & Scope

This directory (`data/processed/recommendation/`) is the designated repository for processed datasets, benchmark splits, and agronomic mapping tables supporting crop recommendation research in FieldWise.

All artifacts in this directory are strictly isolated from yield estimation pipelines (`Phase 3A` and `Phase 3B`) and from production application runtimes.

---

## 2. Dataset Inventory & Provenance Classifications

FieldWise enforces a rigorous 3-category provenance classification for agricultural data:

| Dataset / File | Provenance Category | Source / Provenance | Description / Purpose |
| :--- | :--- | :--- | :--- |
| `kaggle_crop_recommendation_benchmark.csv` | **Category C: Augmented Benchmark** | Kaggle (Atharva Ingle, Apache 2.0) | 2,200 rows, 7 features (`N, P, K, temperature, humidity, ph, rainfall`), 22 crop classes (100 rows/class). Sampled uniformly within hyper-rectangular bounding boxes. Suitable *only* for controlled benchmark algorithmic experiments. |
| `cleaned_crop_recommendation_benchmark.csv` | **Category C: Augmented Benchmark** | Cleaned & normalized benchmark dataset | Normalized lowercase labels, added metadata tags (`provenance`, `data_category`). |
| `canonical_crop_taxonomy.json` | **Category B: Agronomic Ranges** | ICAR, SAUs, TNAU Agritech, FAO EcoCrop | Curated physiological bounds, soil suitability lists, and state agro-climatic zones for all 19 canonical FieldWise staple crops. |
| Future Target: ICAR AICRP / Soil Health Card / CACP | **Category A: Measured Observations** | Research station trials & farm soil tests | Target empirical data required for genuine farm-level recommendation models in Indian conditions. |

---

## 3. Key Findings from Phase 3C.1 Audit

1. **Synthetic Generation Artifact**:
   - The 2,200-row benchmark dataset was generated synthetically by sampling independent pseudo-uniform random numbers within fixed-width per-crop hyper-rectangles:
     - $\Delta N = 40\text{ units}$
     - $\Delta P = 25\text{ units}$
     - $\Delta K = 10\text{ units}$
   - Pairwise bounding box overlap across the 22 classes is only 1.73% (4 out of 231 pairs). 98.27% of crop pairs are strictly separable by at least one axis-aligned 1D threshold.
   - Intra-crop feature correlation is virtually zero (mean $r = 0.0755$), confirming that features were generated independently without simulating physical soil-plant-atmosphere interactions.
2. **Artificial Accuracy Hazard**:
   - Any multi-class classifier (Random Forest, XGBoost) achieves 99%+ cross-validation accuracy on this benchmark purely by memorizing the non-overlapping synthetic hypercubes.
   - **Crucial Rule**: This 99% benchmark accuracy is an artifact of synthetic cluster separation and must **NEVER** be cited as real-world farm accuracy or used for production deployment.
3. **Severe Catalog Misalignment (12 Missing Staples)**:
   - Covers only **7 of the 19 FieldWise canonical crops**: `banana, chickpea, cotton, lentil, maize, mango, rice`.
   - Entirely omits **12 primary Indian staple crops**: `wheat` (India's #2 staple!), `sugarcane`, `soybean`, `groundnut`, `potato`, `mustard`, `tomato`, `onion`, `jowar` (sorghum), `sunflower`, `barley`, and `millets` (bajra).
   - Contains **15 specialty/horticultural crops** unsupported by FieldWise's primary staple catalog (`apple, blackgram, coconut, coffee, grapes, jute, kidneybeans, mothbeans, mungbean, muskmelon, orange, papaya, pigeonpeas, pomegranate, watermelon`).
4. **Missing Production-Critical Agricultural Features**:
   - Omits **Soil Type** (Clay, Alluvial, Black Vertisol, Sandy Loam, Red Loam).
   - Omits **Geographic Context** (State, District, Agro-Ecological Zone).
   - Omits **Cultivation Season** (Kharif, Rabi, Zaid).
   - Omits **Irrigation Infrastructure & Water Availability**.

---

## 4. Architectural Separation & Protocol

To prevent corrupted agronomic recommendations in production:

1. **Benchmark ML Sandbox Track**:
   - Operates strictly on the 7 overlapping crops (`banana, chickpea, cotton, lentil, maize, mango, rice`).
   - Serves solely to test feature importance, classifier architectures (Random Forest, Gradient Boosting, MLP), and calibration methods.
   - Clearly documented as an experimental sandbox.
2. **Agronomic Multi-Criteria Expert Engine Track**:
   - Operates across all 19 canonical FieldWise staple crops.
   - Powered by physiological bounds (`canonical_crop_taxonomy.json`), hard soil-compatibility filters, and state/seasonal suitability matrices.
   - Never evaluates synthetic observations for missing crops.

---

## 5. Phase 3C.2 Seven-Class ML Benchmark & Reproduction Guide

### Overview
Phase 3C.2 implements a controlled, reproducible machine learning benchmark on the 7 overlapping staple crops (`banana, chickpea, cotton, lentil, maize, mango, rice`) using 700 total rows (100 rows/crop).

### Reproduction Protocol
1. **Train & Select Models**:
   ```bash
   python3 FieldWise_main/model/ml_pipeline/scripts/train_crop_recommendation_benchmark.py
   ```
   - Filters 700 rows and partitions into Stratified 70% Train (490), 15% Validation (105), and 15% Test (105) with seed 42.
   - Saves partition manifest to `phase_3c_2_split_manifest.csv`.
   - Fits 5 candidate models (`DummyClassifier`, `LogisticRegression`, `RandomForest`, `ExtraTrees`, `GradientBoosting`) on Train data only.
   - Evaluates on Validation data, applies documented tie-breaking protocol (Macro-F1, Log Loss, Brier Score), and freezes the selected model.

2. **Evaluate Benchmark & Frozen Test**:
   ```bash
   python3 FieldWise_main/model/ml_pipeline/scripts/evaluate_crop_recommendation_benchmark.py
   ```
   - Evaluates all candidate models on the Validation set.
   - Evaluates the frozen selected model (`GradientBoosting`) ONCE on the sealed Test set.
   - Generates confusion matrices, calibration plots, per-class metrics CSV, metrics JSON, and checksums manifest.

### Computational Environment & Dependencies
- **Python**: 3.10+
- **scikit-learn**: 1.8.0
- **joblib**: 1.5.2
- **pandas**: 2.3.3
- **numpy**: 2.4.1
- **scipy**: 1.16.3
- **matplotlib**: 3.10.3 (headless Agg backend)

### Key Files Generated
- `phase_3c_2_split_manifest.csv`: Row-level split mapping (`raw_row_index`, `crop_label`, `split_partition`).
- `../../reports/phase_3c_2_benchmark_report.md`: Authoritative technical benchmark report.
- `../../reports/phase_3c_2_metrics.json`: Machine-readable metrics payload.
- `../../reports/phase_3c_2_per_class_metrics.csv`: Per-class diagnostics across validation and test.
- `../../reports/phase_3c_2_confusion_matrices/`: Confusion matrix CSVs and annotated heatmap PNGs.
- `../../reports/phase_3c_2_calibration/`: Reliability curve CSVs and plots.
- `../../reports/phase_3c_2_checksums.txt`: SHA-256 integrity manifest.

