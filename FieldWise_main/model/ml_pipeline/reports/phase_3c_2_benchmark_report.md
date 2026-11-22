# FieldWise — Phase 3C.2: Seven-Class Crop Recommendation ML Benchmark Report

**Date**: 2026-11-19T13:02:00Z  
**Phase**: Phase 3C.2 (Seven-Class Crop Recommendation ML Benchmark)  
**Execution Scope**: Isolated strictly within `FieldWise_main/model/ml_pipeline/`  
**Application Preservation Status**: Complete isolation. Live FieldWise frontend, backend APIs, Supabase database, `model/predictor.js`, `model/cropDatabase.js`, `model/fertilizerDatabase.js`, and `src/lib/predictorEngine.ts` are strictly **UNTOUCHED and PRESERVED**.  
**Production Readiness Status**: **BENCHMARK ONLY — NOT PRODUCTION READY**. High benchmark accuracy reflects artificial bounding-box separability within synthetic data and does **NOT** establish real-world agricultural suitability.

---

## 1. Executive Summary & Benchmark Results

This report documents the design, training, validation comparison, and frozen one-time test evaluation of a controlled machine learning benchmark for crop recommendation. The experiment is restricted strictly to the **seven crop classes** shared between the audited 2,200-row benchmark dataset and FieldWise's canonical crop taxonomy.

### Key Benchmark Metrics Summary

| Model Family | Scaling | Val Acc | Val Macro-P | Val Macro-R | Val Macro-F1 | Val Log Loss | Val Brier | Val ECE (10-bin) | Status / Selection |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **DummyClassifier (Prior)** | None | 0.1429 | 0.0204 | 0.1429 | 0.0357 | 1.9459 | 0.8571 | 0.0000 | Baseline |
| **Logistic Regression (L2)** | StandardScaler | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.0480 | 0.0105 | 0.0443 | Candidate 2 |
| **Random Forest (100 trees, d=10)** | None | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.0076 | 0.0004 | 0.0075 | Candidate 3 |
| **Extra Trees (100 trees, d=10)** | None | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.0572 | 0.0110 | 0.0534 | Candidate 4 |
| **Gradient Boosting (100 trees, d=3)** | None | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **0.00000004** | **2.3e-15** | **4.4e-8** | 🏆 **Selected Winner** |

### One-Time Frozen Test Evaluation (Gradient Boosting)
- **Test Set Size**: 105 rows (15 rows per class across 7 classes)
- **Test Accuracy**: **1.0000 (100.0%)**
- **Test Macro Precision / Recall / F1**: **1.0000 / 1.0000 / 1.0000**
- **Test Multiclass Log Loss**: **$4.596 \times 10^{-8}$**
- **Test Multiclass Brier Score**: **$2.700 \times 10^{-15}$**
- **Test Expected Calibration Error (ECE, 10 bins)**: **$4.596 \times 10^{-8}$**

> [!CAUTION]
> **CRITICAL SCIENTIFIC INTERPRETATION**:  
> The 100.0% validation and test accuracy achieved by Gradient Boosting, Random Forest, and Logistic Regression is **an artifact of synthetic hyper-rectangular clustering** in the benchmark dataset (proven in Phase 3C.1). In this dataset, 98.27% of crop pairs are strictly separable by single-feature thresholds. **This performance does NOT demonstrate real-world agricultural accuracy** and must **NEVER** be used to justify replacing FieldWise's production agronomic expert engine.

---

## 2. Strict Scope & Application Preservation

All experimental code, models, and evaluation outputs remain completely quarantined within `model/ml_pipeline/`:
- **Frontend & UI**: `FieldWise_main/src/` (including `CropRecommendation.tsx` and `FertilizerRecommendation.tsx`) was **not modified**.
- **Backend APIs & Database**: Node/Express routes and Supabase tables were **not modified**.
- **Production Predictor**: `model/predictor.js` and `src/lib/predictorEngine.ts` remain active and **not modified**.
- **Agronomic Databases**: `model/cropDatabase.js` and `model/fertilizerDatabase.js` remain **not modified**.
- **Yield Modeling Integrity**: Phase 3A and Phase 3B yield models, manifests, and sealed test sets were **not modified or accessed**.
- **Raw Data Integrity**: `data/raw/kaggle_crop_recommendation_benchmark.csv` was **not modified**.

---

## 3. Dataset Restrictions & Seven-Class Selection

Following the Phase 3C.1 audit findings, the benchmark excludes all 15 specialty/unsupported crops and extracts strictly the **seven canonical overlapping crops**:

1. `banana` $\to$ Banana (*Musa acuminata*, Musaceae, Fruit)
2. `chickpea` $\to$ Chickpea / Gram (*Cicer arietinum*, Fabaceae, Pulse)
3. `cotton` $\to$ Cotton (*Gossypium hirsutum*, Malvaceae, Commercial Fiber)
4. `lentil` $\to$ Lentil / Masoor (*Lens culinaris*, Fabaceae, Pulse)
5. `maize` $\to$ Maize / Corn (*Zea mays*, Poaceae, Cereal)
6. `mango` $\to$ Mango (*Mangifera indica*, Anacardiaceae, Orchard Fruit)
7. `rice` $\to$ Rice / Paddy (*Oryza sativa*, Poaceae, Cereal)

### Verified Input Invariants:
- **Total Selected Records**: Exactly **700 rows** (100 rows per class).
- **Excluded Records**: Exactly **1,500 rows** (15 classes $\times$ 100 rows).
- **Features Used**: Exactly **7 numeric features** (`N, P, K, temperature, humidity, ph, rainfall`).
- **Missing / Infinite Values**: Exactly **0**.
- **Data Augmentation**: Strictly **none**. Zero synthetic rows or missing classes were fabricated.

---

## 4. Stratified Data Partitioning & Leakage Prevention

To ensure strict reproducibility, a deterministic two-stage stratified partition was executed using random seed `42`:

```
               ┌────────────────────────────────────────────────────────┐
               │         700 Selected Observations (100 / class)        │
               └───────────────────────────┬────────────────────────────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼ (70% Stratified)                    ▼ (30% Stratified)
        ┌───────────────────────────────┐     ┌───────────────────────────────┐
        │        Training Set           │     │        Temporary Holdout      │
        │   490 Rows (70 / class)       │     │     210 Rows (30 / class)     │
        └───────────────────────────────┘     └───────────────┬───────────────┘
                                                              │
                                       ┌──────────────────────┴──────────────────────┐
                                       ▼ (50% Stratified)                            ▼ (50% Stratified)
                       ┌───────────────────────────────┐             ┌───────────────────────────────┐
                       │        Validation Set         │             │           Test Set            │
                       │     105 Rows (15 / class)     │             │     105 Rows (15 / class)     │
                       └───────────────────────────────┘             └───────────────────────────────┘
```

### Partition Properties:
- **Training Set**: 490 rows (70 rows/crop $\times$ 7 crops).
- **Validation Set**: 105 rows (15 rows/crop $\times$ 7 crops). Used for model comparison and selection.
- **Test Set**: 105 rows (15 rows/crop $\times$ 7 crops). Sealed until model selection was frozen; evaluated exactly once.
- **Disjointness Assertion**: The intersection between all three index sets is strictly empty ($\emptyset$), and their union is exactly 700 rows.
- **Manifest**: Every observation's partition assignment is recorded in `data/processed/recommendation/phase_3c_2_split_manifest.csv`.
- **Preconditioning Rule**: The `StandardScaler` for Logistic Regression was fitted exclusively on the 490 training rows and applied via a scikit-learn `Pipeline`. Test and validation rows were never used for scaling parameters.

> [!NOTE]
> **Spatial and Temporal Generalization Limitation**:  
> Because the benchmark dataset provides no state, district, GPS coordinate, year, or season, this stratified split is purely a random i.i.d. partition. It evaluates interpolation within synthetic bounding boxes, but cannot evaluate geographic transferability across Indian agro-climatic zones or temporal stability across crop years.

---

## 5. Candidate Model Architectures & Hyperparameters

Five model families were evaluated using modest, documented configurations without aggressive hyperparameter tuning:

1. **DummyClassifier (Baseline)**:
   - `strategy="prior"`: Predicts the empirical class prior probability distribution ($1/7 \approx 14.29\%$ per class).
2. **Multinomial Logistic Regression (L2 Regularized)**:
   - Pipeline: `StandardScaler() -> LogisticRegression(C=1.0, max_iter=1000, solver="lbfgs", random_state=42)`.
   - Convex linear baseline operating in normalized continuous space.
3. **Random Forest Classifier**:
   - `RandomForestClassifier(n_estimators=100, max_depth=10, min_samples_split=2, random_state=42)`.
   - Non-linear ensemble of decision trees with bagging.
4. **Extra Trees Classifier**:
   - `ExtraTreesClassifier(n_estimators=100, max_depth=10, min_samples_split=2, random_state=42)`.
   - Extremely randomized trees evaluating random cut points for maximum variance reduction.
5. **Gradient Boosting Classifier**:
   - `GradientBoostingClassifier(n_estimators=100, max_depth=3, learning_rate=0.1, random_state=42)`.
   - Sequential gradient boosted shallow trees minimizing multi-class cross-entropy.

Fitted model weights are serialized in `models/benchmark/`.

---

## 6. Validation Comparison & Selection Protocol

### Documented Selection & Tie-Breaking Protocol (§6):
Before evaluating the validation set, the selection protocol was formally defined:
1. **Primary Selection Metric**: Highest Validation **Macro-F1**.
2. **Tie-Breaker 1**: Lowest Multiclass **Log Loss** ($-\frac{1}{N}\sum \log p_{y}$).
3. **Tie-Breaker 2**: Lowest Multiclass **Brier Score** ($\frac{1}{N}\sum \|p - y\|^2$).
4. **Tie-Breaker 3**: Model Parsimony / Inference Latency.

### Validation Evaluation Results (105 Rows)

| Model Name | Accuracy | Macro-F1 | Weighted-F1 | Log Loss | Brier Score | ECE (10-bin) | Selection Rank |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Gradient Boosting** | **1.0000** | **1.0000** | **1.0000** | **$4.405 \times 10^{-8}$** | **$2.274 \times 10^{-15}$** | **$4.405 \times 10^{-8}$** | 🏆 **Rank 1 (Winner)** |
| **Random Forest** | 1.0000 | 1.0000 | 1.0000 | 0.007633 | 0.000357 | 0.007524 | Rank 2 |
| **Logistic Regression** | 1.0000 | 1.0000 | 1.0000 | 0.048008 | 0.010503 | 0.044340 | Rank 3 |
| **Extra Trees** | 1.0000 | 1.0000 | 1.0000 | 0.057200 | 0.010951 | 0.053363 | Rank 4 |
| **Dummy Classifier** | 0.1429 | 0.0357 | 0.0357 | 1.945910 | 0.857143 | 0.000000 | Rank 5 |

### Selection Outcome:
All four non-trivial models achieved perfect Macro-F1 ($1.0000$) on the validation set. Applying **Tie-Breaker 1 (Multiclass Log Loss)** and **Tie-Breaker 2 (Multiclass Brier Score)**, **Gradient Boosting** emerged as the winning candidate:
- Validation Log Loss: **$4.405 \times 10^{-8}$** (vs. $0.0076$ for Random Forest and $0.0480$ for Logistic Regression).
- Validation Brier Score: **$2.274 \times 10^{-15}$** (vs. $0.00036$ for Random Forest).

The selection of **Gradient Boosting** was frozen in `reports/phase_3c_2_training_summary.json` prior to any test-set inspection.

---

## 7. Frozen One-Time Test Evaluation

Following model selection, the frozen Gradient Boosting model was evaluated **once** on the sealed Test partition (105 observations, 15 per class):

### Test Performance Metrics

| Metric | Test Set Value | Validation Set Value | Generalization Delta |
| :--- | :---: | :---: | :---: |
| **Accuracy** | **1.0000 (100.0%)** | 1.0000 (100.0%) | 0.0000 |
| **Macro Precision** | **1.0000** | 1.0000 | 0.0000 |
| **Macro Recall** | **1.0000** | 1.0000 | 0.0000 |
| **Macro F1-Score** | **1.0000** | 1.0000 | 0.0000 |
| **Weighted F1-Score** | **1.0000** | 1.0000 | 0.0000 |
| **Multiclass Log Loss** | **$4.596 \times 10^{-8}$** | $4.405 \times 10^{-8}$ | $+1.91 \times 10^{-9}$ |
| **Multiclass Brier Score** | **$2.700 \times 10^{-15}$** | $2.274 \times 10^{-15}$ | $+4.25 \times 10^{-16}$ |
| **Expected Calibration Error (ECE)** | **$4.596 \times 10^{-8}$** | $4.405 \times 10^{-8}$ | $+1.91 \times 10^{-9}$ |

Zero misclassifications occurred across all 105 test rows.

---

## 8. Per-Class Diagnostics & Confusion Matrices

### Per-Class Test Performance (Gradient Boosting)

| Crop Label | Support | Precision | Recall | F1-Score | True Positives | False Positives | False Negatives |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **banana** | 15 | 1.0000 | 1.0000 | 1.0000 | 15 | 0 | 0 |
| **chickpea** | 15 | 1.0000 | 1.0000 | 1.0000 | 15 | 0 | 0 |
| **cotton** | 15 | 1.0000 | 1.0000 | 1.0000 | 15 | 0 | 0 |
| **lentil** | 15 | 1.0000 | 1.0000 | 1.0000 | 15 | 0 | 0 |
| **maize** | 15 | 1.0000 | 1.0000 | 1.0000 | 15 | 0 | 0 |
| **mango** | 15 | 1.0000 | 1.0000 | 1.0000 | 15 | 0 | 0 |
| **rice** | 15 | 1.0000 | 1.0000 | 1.0000 | 15 | 0 | 0 |
| **Total / Macro** | **105** | **1.0000** | **1.0000** | **1.0000** | **105** | **0** | **0** |

The complete per-class CSV is available at [phase_3c_2_per_class_metrics.csv](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/phase_3c_2_per_class_metrics.csv).

### Confusion Matrix Analysis
The test confusion matrix is an exact diagonal matrix with 15 entries per crop along the principal diagonal and zero off-diagonal errors:
- Confusion Matrix CSV: `reports/phase_3c_2_confusion_matrices/test_selected_GradientBoosting_confusion_matrix.csv`
- Annotated Heatmap Image: `reports/phase_3c_2_confusion_matrices/test_selected_GradientBoosting_confusion_matrix.png`

---

## 9. Probability Calibration, Brier Scores & ECE Diagnostics

### Multiclass Brier Score Formulation
For a multi-class problem with $K=7$ classes and $N=105$ test instances, the Brier score is computed as:
$$\text{Brier} = \frac{1}{N} \sum_{i=1}^N \sum_{k=1}^K \left( p_{ik} - y_{ik} \right)^2$$
where $y_{ik} \in \{0, 1\}$ is the one-hot ground-truth indicator and $p_{ik} \in [0, 1]$ is the model's predicted probability for class $k$. The resulting test Brier score is **$2.700 \times 10^{-15}$**, indicating near-perfect probability alignment with the synthetic target.

### Expected Calibration Error (ECE) Formulation
Using $M=10$ equal-width confidence bins on $[0, 1]$:
$$\text{ECE} = \sum_{m=1}^{10} \frac{|B_m|}{N} \left| \text{acc}(B_m) - \text{conf}(B_m) \right|$$
For the Gradient Boosting model on the test set:
- 100% of observations fall into the highest confidence bin ($[0.9, 1.0]$).
- Average predicted confidence in bin 10: **$1.000000$**
- Empirical accuracy in bin 10: **$1.000000$**
- Resulting ECE: **$4.596 \times 10^{-8}$** (near zero).

The calibration data and reliability diagrams are archived at:
- Calibration Table: `reports/phase_3c_2_calibration/test_selected_GradientBoosting_calibration.csv`
- Reliability Diagram: `reports/phase_3c_2_calibration/test_selected_GradientBoosting_calibration.png`

---

## 10. Comprehensive Scientific Limitations & Agronomic Warnings

> [!WARNING]
> ### WHY 100% BENCHMARK ACCURACY DOES NOT EQUAL AGRICULTURAL VALIDITY
> It is an egregious machine learning anti-pattern to equate high accuracy on this synthetic benchmark with real-world farm suitability. The following fundamental limitations prevent this model from being deployed to actual Indian farmers:

1. **Synthetic Bounding-Box Memorization**:
   - As established in Phase 3C.1, this dataset was created by drawing independent pseudo-uniform random numbers inside axis-aligned hyper-rectangles per crop.
   - 98.27% of all crop pairs in the benchmark are linearly separable by a single feature threshold.
   - For example, `chickpea` was artificially restricted to **14.26%–19.97% humidity** (no other crop has humidity below 30%), and `apple` was assigned an artificial $K \in [195, 205]$.
   - The tree ensembles achieved 100% accuracy simply by learning the author's artificial bounding box cuts. They did **not** learn real-world agronomic principles.
2. **Missing 12 Major Indian Staple Crops**:
   - The benchmark covers only 7 crops. It completely omits **Wheat** (India's #2 food crop, >30M ha), **Sugarcane**, **Potato**, **Mustard**, **Onion**, **Tomato**, **Soybean**, **Groundnut**, **Jowar**, **Bajra**, **Barley**, and **Sunflower**.
   - An Indian farmer in Punjab or Haryana seeking a winter recommendation could **never** be advised to plant Wheat or Mustard by this model.
3. **Absence of Critical Real-World Farming Features**:
   - **Soil Type**: The model cannot differentiate between heavy black cotton vertisols and light sandy loam.
   - **Geography / Agro-Climatic Zone**: The model lacks latitude, altitude, and regional climate context.
   - **Cultivation Season**: The model lacks awareness of Kharif monsoon vs. Rabi winter sowing windows.
   - **Irrigation Infrastructure**: The model relies on raw rainfall and ignores tube-well and canal irrigation, falsely predicting drought failure in irrigated arid zones.
4. **False Real-World Failure Modes**:
   - If an Indian farmer in Madhya Pradesh enters 45% relative humidity (a normal winter day for chickpea), this model will predict **0% probability for chickpea**, because its synthetic training data artificially confined chickpea to $\le 20\%$ humidity!

---

## 11. Execution Verification & Artifact Inventory

### Checksum Manifest (`reports/phase_3c_2_checksums.txt`)

```
54a5a6e5408668e668667efc50de2fc867c1b875e0431b4f54dd331b0a109a4e  data/raw/kaggle_crop_recommendation_benchmark.csv
9b360952f666f3be6b4901562ca4c33c84a1188721786e2c48f55cdbdc1ea7bb  data/processed/recommendation/phase_3c_2_split_manifest.csv
1c62dd7eeff0b7b4b674376cce459ab5297884b2aa2d34d70b5d6114611333bf  reports/phase_3c_2_training_summary.json
06da8807196aca566310295373a62bc22acb0bfa61d5fb53f827b0e29c9c8e4b  reports/phase_3c_2_metrics.json
8d459fcf4c2d9c866fb634a9c92fb0858b5e608c537e553fdc376fcee8f49d8d  reports/phase_3c_2_per_class_metrics.csv
4f55b8c9f2b76044af38f076150c3c876cb46b6b3c67550e8d3bc9b8de2ff430  reports/phase_3c_2_confusion_matrices/test_selected_GradientBoosting_confusion_matrix.csv
daafda15ac4a9f9c2bc74bd4dc3a696bf0038622479aa155a282546c9c6034b8  reports/phase_3c_2_calibration/test_selected_GradientBoosting_calibration.csv
140c1b24ed7afb3e7f9687b5ed4a3b62485e42991ad368a47c72f3f5298ce9cd  models/benchmark/DummyClassifier.joblib
805e0d575851bdc33f210e18db8249675770aff1f9c3289850809ab69a948569  models/benchmark/LogisticRegression.joblib
5ac9b316a5c22fb815a0d83dcd5f98c80a07988770b532f61f2ac6f5d89349b5  models/benchmark/RandomForest.joblib
456aee62f6cf6294ff7c019e0f68045ed639eb48d1fe1aeae84ec6aba1b5310f  models/benchmark/ExtraTrees.joblib
df291d7b38cddd6eb35c15f446566e623af3a14a29804dd56dbce4dcf77db620  models/benchmark/GradientBoosting.joblib
```

---

## 12. Final Stop Condition

This completes the Phase 3C.2 Seven-Class ML Benchmark. As required by the specification:
- **No live application code was touched.**
- **No models were deployed or exposed to users.**
- **No data was fabricated for missing crops.**
- **Execution is stopped** to await independent review.
