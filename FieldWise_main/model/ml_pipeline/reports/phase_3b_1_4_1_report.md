# FieldWise — Phase 3B.1.4.2: Final Audit Hardening

**Document Reference**: `reports/phase_3b_1_4_2_report.md`  
**Execution Date**: November 18, 2026  
**Auditor & Modeling Team**: ML Engineering & Agronomic Architecture  
**Scope**: Final audit hardening resolving specific audit requirements from Phase 3B.1.4.2:
1. **Real Source-Code Audit of `min_obs`**: Abstract Syntax Tree (AST) inspection of `SeasonalHierarchicalChallenger._get_group_means` and `fit` in `train_yield_phase_3b_1_2.py`, confirming exact grouping keys, aggregation operations, count calculation, and threshold filtering without text searches or file-wide keyword scans.
2. **Empirical Verification of District-Homonym Explanation**: Non-target column inspection (`State`, `District`, `Crop`, `Season`, `Crop_Year`) demonstrating that 100.0% of multi-record training cells span multiple states, and 0 occur within a single state.
3. **Strengthened Validation Prediction Invariants**: Formal assertions for unique non-null IDs, finite values in targets and predictions, matching validation targets, and exact numerical equality between weighted aggregate and direct pooled MAE deltas across all 9 models.
4. **Enforced Manifest Invariants**: Mathematical invariants asserting manifest counts, strict subset relation ($A \subset B$), set differences, and non-negative derived conditional/excluded counts.
5. **Precise Audit Isolation Language**: Truthful and exact statements regarding non-target column reads, validation target scope, and sealed 2014–2015 holdout preservation.

---

> [!IMPORTANT]
> **Audit Isolation & Safeguard Certification**:
> To ensure complete integrity and avoid imprecise claims:
> - **Cleaned-Dataset Audit Routine**: Reads **strictly non-target columns** (`State`, `District`, `Crop`, `Season`, `Crop_Year`). Formal assertions verify that `Yield_Tonnes_Per_Ha`, `Production`, and `Cultivated_Area_Ha` are completely absent from memory during the cleaned-dataset audit.
> - **Validation Target Values**: Target values (`Yield_Tonnes_Per_Ha`) are read **only from saved 2012–2013 validation prediction files** (`validation_predictions.csv`) to compute validation metrics and verify stability arithmetic.
> - **Sealed 2014–2015 Test Holdout**: **No 2014–2015 test target values are loaded, inspected, or evaluated by this audit.** Zero test predictions were generated, zero test metrics computed, and zero test data used in model selection.
>
> Application code (`src/`, `backend/`, `model/predictor.js`), foundational cleaning artifacts (`data/raw/`, `data/processed/`), and historical baseline repositories remain **entirely untouched and preserved**. No models were trained during this phase.

---

## 1. Real Source-Code Audit of `min_obs` in `SeasonalHierarchicalChallenger`

### 1.1 AST Inspection Protocol

Rather than relying on fragile text searches or file-wide keyword matching, the audit script (`reconcile_phase_3b_1_4.py`) parses `model/ml_pipeline/scripts/train_yield_phase_3b_1_2.py` into a Python Abstract Syntax Tree (AST) using the `ast` standard library module.

The AST inspector walks the class definition of `SeasonalHierarchicalChallenger` and verifies the exact structure of `_get_group_means` and `fit`:

```python
# AST Inspection Snippet from reconcile_phase_3b_1_4.py
class_node = next(n for n in ast.walk(tree) if isinstance(n, ast.ClassDef) and n.name == "SeasonalHierarchicalChallenger")
ggm_node = next(n for n in class_node.body if isinstance(n, ast.FunctionDef) and n.name == "_get_group_means")
fit_node = next(n for n in class_node.body if isinstance(n, ast.FunctionDef) and n.name == "fit")
```

### 1.2 Verified AST Audit Fields

| Audit Field | Expected Condition | Inspected AST Finding | Status |
| :--- | :--- | :--- | :---: |
| **`class_located`** | `SeasonalHierarchicalChallenger` present in AST | Found `ast.ClassDef` named `SeasonalHierarchicalChallenger` | ✅ PASSED |
| **`method_located`** | `_get_group_means` present in class | Found `ast.FunctionDef` named `_get_group_means` | ✅ PASSED |
| **`parameters`** | `self, df, group_cols, y_col` | Parameters match `['self', 'df', 'group_cols', 'y_col']` | ✅ PASSED |
| **`groupby_uses_group_cols`** | `df.groupby(group_cols)` | Method calls `groupby` passing `group_cols` argument | ✅ PASSED |
| **`aggregation_functions`** | Includes `'mean'` and `'count'` | Method calls `.agg(['mean', 'count'])` | ✅ PASSED |
| **`threshold_condition`** | `agg['count'] >= self.min_obs` | Found binary comparison `agg['count'] >= self.min_obs` with operator `>=` | ✅ PASSED |
| **`uses_nunique_in_method`** | Absence of `nunique` in `_get_group_means` | Walked all AST nodes inside `_get_group_means`: 0 `nunique` calls | ✅ PASSED (False) |
| **`counts_distinct_years`** | False (counts individual rows) | Confirmed `agg['count']` counts rows, not distinct `Crop_Year` | ✅ PASSED (False) |
| **`fit_hierarchy_keys`** | 6 hierarchical fallback levels | Verified 6 calls to `_get_group_means` in `fit` with explicit keys | ✅ PASSED |

### 1.3 Verified Hierarchical Fallback Keys in `fit`

The AST audit extracted the exact grouping keys passed to `_get_group_means` in `fit`:
1. **Level 1**: `['District', 'Crop', 'Season']`
2. **Level 2**: `['District', 'Crop']`
3. **Level 3**: `['State', 'Crop', 'Season']`
4. **Level 4**: `['State', 'Crop']`
5. **Level 5**: `['Crop', 'Season']`
6. **Level 6**: `['Crop']`
7. **Level 7**: Global mean (`df[y_col].mean()`)

All AST assertions passed cleanly without exception.

---

## 2. Empirical Verification of the District-Homonym Explanation

### 2.1 Non-Target Data Isolation Protocol

To verify the district-homonym explanation without any possibility of test target leakage:
- Read columns were strictly restricted to: `['State', 'District', 'Crop', 'Season', 'Crop_Year']`.
- Assertions verified that `Yield_Tonnes_Per_Ha`, `Production`, and `Cultivated_Area_Ha` were completely absent.
- Analysis was partitioned strictly on `Crop_Year <= 2011` (1997–2011 training partition).

### 2.2 Empirical Cell Distribution & Homonym Attribution

In the 1997–2011 training data, records were grouped by `(District, Crop, Season, Crop_Year)`:
- **Total cells**: **190,541 cells**
- **Single-record cells ($N = 1$)**: **189,812 cells (99.62%)**
- **Multi-record cells ($N > 1$)**: **729 cells (0.38%)**

To determine whether multi-record cells are attributable to district homonyms, the audit evaluated the number of distinct `State` entries within each multi-record cell:
- **Multi-record cells spanning multiple states (`state_nunique > 1`)**: **729 cells (100.0%)**
- **Multi-record cells within a single state (`state_nunique == 1`)**: **0 cells (0.0%)**

> [!NOTE]
> **Empirical Attribution Finding**:
> Rather than assuming homonyms, the data demonstrates that **100.0% (729 of 729) of all multi-record cells in the training data span multiple states**. Exactly zero multi-record groups occur within a single state. All 729 multi-record cells are completely and exhaustively explained by 7 specific district pairs that exist in two distinct states.

### 2.3 Exhaustive Breakdown of Multi-State District Homonym Pairs

| District & State Pair | Training Cells (1997–2011) | Multistate Flag | Nature of Duplication |
| :--- | :---: | :---: | :--- |
| **AURANGABAD (BIHAR, MAHARASHTRA)** | **162** | ✅ Multiple States | Distinct administrative districts in different states sharing identical name |
| **BALRAMPUR (CHHATTISGARH, UTTAR PRADESH)** | **17** | ✅ Multiple States | Distinct administrative districts in different states sharing identical name |
| **BILASPUR (CHHATTISGARH, HIMACHAL PRADESH)** | **134** | ✅ Multiple States | Distinct administrative districts in different states sharing identical name |
| **HAMIRPUR (HIMACHAL PRADESH, UTTAR PRADESH)** | **115** | ✅ Multiple States | Distinct administrative districts in different states sharing identical name |
| **KHERI (ASSAM, UTTAR PRADESH)** | **173** | ✅ Multiple States | Distinct administrative districts in different states sharing identical name |
| **PRATAPGARH (RAJASTHAN, UTTAR PRADESH)** | **45** | ✅ Multiple States | Distinct administrative districts in different states sharing identical name |
| **VIJAYAPURA (CHHATTISGARH, KARNATAKA)** | **83** | ✅ Multiple States | Distinct administrative districts in different states sharing identical name |

All multi-record groups in the 1997–2011 training partition represent identical district names across different states because Level 1 groups by `['District', 'Crop', 'Season']` without `State`.

### 2.4 Agronomic Limitation and Proposed Phase 3C Challenger

- **Limitation**: Because `agg['count']` counts rows rather than distinct calendar years, a district homonym combination with 3 records across 2 states can satisfy $N_{\min}=3$ across only 2 calendar years. The existing model does not strictly guarantee $N_{\min}$ distinct growing seasons.
- **Preservation Commitment**: In strict compliance with audit rules, **no models or training code were modified**.
- **Proposed Phase 3C Challenger (`SeasonalHierarchicalDistinctYearChallenger`)**:
  ```python
  agg = df.groupby(['State', 'District', 'Crop', 'Season']).agg(
      mean=(y_col, "mean"),
      distinct_years=("Crop_Year", "nunique"),
      record_count=(y_col, "count")
  )
  valid = agg[agg["distinct_years"] >= min_distinct_years]
  ```

---

## 3. Strengthened Validation Prediction Checks & Stability Invariants

### 3.1 Verification of Data Invariants

Before computing stability metrics, the following invariants were evaluated on `validation_predictions.csv` from Experiment A and Experiment B:
1. **Unique, Non-Null IDs**: Both files contain 100% non-null, strictly unique `raw_row_id` values.
2. **Required Columns**: All 9 model prediction columns exist in both files.
3. **Finite Values**: 100% of validation target values and 100% of model prediction values are finite (no NaNs, no infinities).
4. **Common Prime Validation Count**: Exactly **13,422 rows** in both subsets.
5. **Common Crop Labels**: Exactly **30 common crop labels** with identical sets.
6. **Row Alignment**: Sorted `raw_row_id` arrays match identically; `Crop` labels match row by row.
7. **Target Agreement**: Target values (`Yield_Tonnes_Per_Ha`) match row by row within $10^{-6}$.

### 3.2 Formal Mathematical Identity & Numerical Reconciliation

For any model evaluated across the identical $N_{\text{total}} = 13,422$ common prime validation rows, the direct pooled MAE difference is mathematically identical to the sample-weighted average of the per-crop MAE differences:

$$\Delta\text{MAE}_{\text{pooled}} = \text{MAE}_{B,\text{pooled}} - \text{MAE}_{A,\text{pooled}} = \frac{1}{N_{\text{total}}} \sum_{c=1}^{30} N_c \left(\text{MAE}_{B,c} - \text{MAE}_{A,c}\right) = \frac{\sum_{c=1}^{30} \text{Weighted Error Units}_c}{N_{\text{total}}}$$

All 9 models were programmatically asserted to satisfy:
$$|\Delta\text{MAE}_{\text{pooled}} - \Delta\text{MAE}_{\text{weighted}}| < 10^{-9}$$

| Model Architecture | Total Common Prime Rows | Direct Pooled MAE Delta (t/ha) | Sum of Weighted Error Units | Weighted Aggregate Delta (t/ha) | Discrepancy | Verification Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **One-Hot Random Forest** | 13,422 | -0.006293 | -84.4592 | -0.006293 | 0.0000000000 | ✅ EXACT MATCH |
| **One-Hot Extra Trees** | 13,422 | +0.005565 | +74.6940 | +0.005565 | 0.0000000000 | ✅ EXACT MATCH |
| **Native Categorical XGBoost** | 13,422 | +0.009063 | +121.6497 | +0.009063 | 0.0000000000 | ✅ EXACT MATCH |
| **Seasonal Challenger (N_min=1)** | 13,422 | -0.000564 | -7.5706 | -0.000564 | 0.0000000000 | ✅ EXACT MATCH |
| **Seasonal Challenger (N_min=3)** | 13,422 | -0.000564 | -7.5706 | -0.000564 | 0.0000000000 | ✅ EXACT MATCH |
| **Seasonal Challenger (N_min=5)** | 13,422 | -0.000564 | -7.5706 | -0.000564 | 0.0000000000 | ✅ EXACT MATCH |
| **Target-Encoded Random Forest** | 13,422 | +0.047467 | +637.1067 | +0.047467 | 0.0000000000 | ✅ EXACT MATCH |
| **Existing District Mean** | 13,422 | -0.000564 | -7.5706 | -0.000564 | 0.0000000000 | ✅ EXACT MATCH |
| **Existing Random Forest (Ordinal)** | 13,422 | +0.023423 | +314.3867 | +0.023423 | 0.0000000000 | ✅ EXACT MATCH |

All 9 models reconcile with numerical discrepancy $< 4 \times 10^{-16}$, proving exact arithmetic equality.

### 3.3 Complete 30-Crop Error Cancellation Breakdown (One-Hot Random Forest)

From [`reports/common_crop_delta_reconciliation.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/common_crop_delta_reconciliation.csv):

| Crop | Validation Samples ($N_c$) | Exp A MAE (t/ha) | Exp B MAE (t/ha) | MAE Delta (t/ha) | Weighted Error Units ($N_c \times \Delta\text{MAE}$) | Shift Direction |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Papaya** | 69 | 25.4387 | 7.8589 | -17.5798 | -1213.0068 | 🟢 Error Decrease |
| **Maize** | 1,204 | 0.7635 | 1.0689 | +0.3054 | +367.7570 | 🔴 Error Increase |
| **Wheat** | 595 | 0.6252 | 1.0508 | +0.4256 | +253.2468 | 🔴 Error Increase |
| **Sesamum** | 661 | 0.1470 | 0.5192 | +0.3722 | +246.0555 | 🔴 Error Increase |
| **Barley** | 325 | 0.4612 | 1.2066 | +0.7454 | +242.2708 | 🔴 Error Increase |
| **Moong(Green Gram)** | 977 | 0.1937 | 0.4305 | +0.2369 | +231.4101 | 🔴 Error Increase |
| **Onion** | 598 | 3.1000 | 2.7407 | -0.3593 | -214.8708 | 🟢 Error Decrease |
| **Rice** | 1,164 | 0.6291 | 0.7958 | +0.1667 | +194.0272 | 🔴 Error Increase |
| **Cabbage** | 36 | 19.5137 | 14.7976 | -4.7161 | -169.7795 | 🟢 Error Decrease |
| **Urad** | 868 | 0.1931 | 0.3849 | +0.1918 | +166.5060 | 🔴 Error Increase |
| **Grapes** | 6 | 20.3230 | 5.0803 | -15.2427 | -91.4565 | 🟢 Error Decrease |
| **Sugarcane** | 628 | 12.8285 | 12.7372 | -0.0913 | -57.3188 | 🟢 Error Decrease |
| **Sweet potato** | 358 | 1.7459 | 1.5892 | -0.1567 | -56.0820 | 🟢 Error Decrease |
| **Tomato** | 40 | 16.1987 | 14.8171 | -1.3816 | -55.2651 | 🟢 Error Decrease |
| **Banana** | 192 | 6.7229 | 6.9428 | +0.2199 | +42.2219 | 🔴 Error Increase |
| **Tapioca** | 122 | 3.9175 | 4.1944 | +0.2768 | +33.7755 | 🔴 Error Increase |
| **Potato** | 494 | 3.0261 | 2.9715 | -0.0545 | -26.9307 | 🟢 Error Decrease |
| **Sunflower** | 423 | 0.4432 | 0.4144 | -0.0288 | -12.1838 | 🟢 Error Decrease |
| **Paddy** | 103 | 1.0464 | 1.1318 | +0.0854 | +8.7953 | 🔴 Error Increase |
| **Groundnut** | 728 | 0.5580 | 0.5692 | +0.0112 | +8.1542 | 🔴 Error Increase |
| **Masoor** | 392 | 0.2885 | 0.3039 | +0.0154 | +6.0554 | 🔴 Error Increase |
| **Castor seed** | 216 | 0.4369 | 0.4602 | +0.0233 | +5.0323 | 🔴 Error Increase |
| **Jowar** | 537 | 0.5500 | 0.5573 | +0.0073 | +3.8994 | 🔴 Error Increase |
| **Arhar/Tur** | 614 | 0.3319 | 0.3379 | +0.0060 | +3.6821 | 🔴 Error Increase |
| **Soyabean** | 257 | 0.4661 | 0.4523 | -0.0138 | -3.5394 | 🟢 Error Decrease |
| **Rapeseed &Mustard** | 549 | 0.3920 | 0.3973 | +0.0053 | +2.9091 | 🔴 Error Increase |
| **Gram** | 550 | 0.3307 | 0.3334 | +0.0028 | +1.5173 | 🔴 Error Increase |
| **Bajra** | 381 | 0.6365 | 0.6341 | -0.0024 | -0.9229 | 🟢 Error Decrease |
| **Ragi** | 326 | 0.6660 | 0.6637 | -0.0023 | -0.7561 | 🟢 Error Decrease |
| **Lentil** | 9 | 0.0874 | 0.1249 | +0.0375 | +0.3373 | 🔴 Error Increase |

#### Exact Arithmetic Cancellation Summary:
- **Sum of Positive Error Units (18 crops with degraded error)**: $\mathbf{+1817.6533\text{ error units}}$ (dominated by Maize $+367.7$, Wheat $+253.2$, Sesamum $+246.0$, Barley $+242.3$, Moong $+231.5$, Rice $+194.0$, Urad $+166.5$).
- **Sum of Negative Error Units (12 crops with reduced error)**: $\mathbf{-1902.1125\text{ error units}}$ (dominated by Papaya $-1,213.0$, Onion $-214.9$, Cabbage $-169.8$, Grapes $-91.5$, Sugarcane $-57.3$, Sweet potato $-56.1$, Tomato $-55.3$).
- **Net Pooled Error Units Across All 30 Crops**: $\mathbf{-84.4592\text{ error units}}$
- **Weighted Aggregate Delta**: $\frac{-84.4592}{13,422} = \mathbf{-0.006293\text{ t/ha}}$
- **Direct Pooled Delta**: $\mathbf{-0.006293\text{ t/ha}}$
- **Discrepancy**: $\mathbf{0.0000000000\text{ t/ha}}$ (**VERIFIED EXACT MATCH**).

---

## 4. Enforced Manifest Invariants & Set Relationships

### 4.1 Manifest Invariants Execution

Evaluation of `split_manifest.json` from Experiment A and Experiment B confirms:
- **Experiment A Test Set (`raw_row_ids`)**: Exactly **5,433 records** (Prime-only crops).
- **Experiment B Test Set (`raw_row_ids`)**: Exactly **6,852 records** (Prime + Provisional crops).
- **Strict Subset Relation**: Asserted: $A \subset B$ and $A \neq B$ (Assertion = **True**).
- **Intersection ($A \cap B$)**: Exactly **5,433 records** ($A \cap B = A$).
- **Union ($A \cup B$)**: Exactly **6,852 records** ($A \cup B = B$).
- **Difference ($B \setminus A$)**: Exactly **1,419 records** (Provisional-only test records).
- **Difference ($A \setminus B$)**: Exactly **0 records** ($A \setminus B = \emptyset$).
- **Derived Conditional / Excluded Count**:
  $$\text{Derived Count} = 10,905 \text{ (inherited total)} - 6,852 \text{ (verified baseline union)} = \mathbf{4,053}$$
  Asserted non-negative: $4,053 \ge 0$ (Assertion = **True**).

### 4.2 Reconciliation Table (`reports/test_manifest_reconciliation.csv`)

| Partition Description | Record Count | Verification Method | Subset Relationship | Agronomic Composition |
| :--- | :---: | :--- | :--- | :--- |
| **Experiment A Test Manifest (Prime-Only)** | **5,433** | Independently verified from Exp A split_manifest.json raw_row_ids | Strict subset of Experiment B (A ⊂ B) | 30 verified prime crops with yield <= T and matched IMD rainfall |
| **Experiment B Test Manifest (Prime + Provisional)** | **6,852** | Independently verified from Exp B split_manifest.json raw_row_ids | Superset of Experiment A (B ⊃ A) | 60 documented crops (30 prime + 30 provisional) with yield <= T and matched IMD rainfall |
| **Intersection (Experiment A ∩ Experiment B)** | **5,433** | Independently computed set intersection of manifests (A ∩ B) | Exact match with Experiment A | Common prime crop test records present in both experiments |
| **Union (Experiment A ∪ Experiment B)** | **6,852** | Independently computed set union of manifests (A ∪ B) | Exact match with Experiment B | All eligible baseline test records across both experiments |
| **Difference (Experiment B \ Experiment A)** | **1,419** | Independently computed set difference of manifests (B \ A) | Provisional-only test records | 30 provisional crop test records in 2014-2015 |
| **Dataset-Wide Test Partition (Cleaned Universe)** | **10,905** | Inherited record count from reports/validation_summary.json (Phase 3A.6 summary; NOT independently verified via test ID list) | Entire 2014-2015 chronological holdout across all categories | 6,852 eligible baseline (verified from manifests) + 4,053 conditional/excluded records (calculated strictly by subtraction) |

### 4.3 Attribution Distinction

To preserve exact audit transparency:
1. **5,433 and 6,852**: Independently computed and verified directly from the `raw_row_id` manifests without loading target values.
2. **10,905**: Inherited summary count from `reports/validation_summary.json` (Phase 3A.6 documentation).
3. **4,053**: Derived strictly by arithmetic subtraction ($10,905 - 6,852$). The breakdown into 3,391 unmatched rainfall and 662 excluded crop records is documented from Phase 3A.6 documentation.

---

## 5. Accurate Characterization of Native Categorical XGBoost

### 5.1 Actual Feature Set Specification

Native Categorical XGBoost (`xgboost_native_categorical.joblib`) was trained strictly on **7 tabular features**:

| Feature Name | Feature Type | Data Source & Nature |
| :--- | :---: | :--- |
| **`State`** | Categorical | Nominal state identifier |
| **`District`** | Categorical | Nominal district identifier |
| **`Season`** | Categorical | Nominal season (`Kharif`, `Rabi`, `Whole Year`, etc.) |
| **`Crop`** | Categorical | Nominal botanical crop identifier |
| **`Crop_Year`** | Numerical | Calendar year integer (1997–2011) |
| **`district_normal_annual_rainfall_mm`** | Numerical | **Static 30-year climatological normal (1901–2000)** from IMD |
| **`district_normal_monsoon_rainfall_mm`** | Numerical | **Static 30-year climatological normal (1901–2000)** from IMD |

### 5.2 Explicit Statement of Absent Variables

We formally certify that the following variables are **COMPLETELY ABSENT** from the model and dataset:
- **Actual in-season weather**: No actual annual rainfall, no monsoon onset dates, no dry spell duration, no temperature (min/max/mean), and no growing degree days (GDD).
- **Weather anomalies / climate shocks**: No rainfall deviation percentages from normal, no drought indices (SPI/SPEI), and no extreme weather event flags.
- **Soil chemistry**: No Nitrogen (N), Phosphorus (P), Potassium (K), pH, electrical conductivity (EC), or soil organic carbon (SOC).
- **Farm-level management**: No irrigation method/volume, fertilizer application rates, sowing dates, seed varieties (hybrids vs landraces), or pest treatments.

### 5.3 Agronomic and Statistical Characterization

- **Correct Description**: Native Categorical XGBoost is a **historical district-level machine learning benchmark**.
- **What it Learns**: It models non-linear interactions between geographic categories, crop types, secular time trends (`Crop_Year`), and baseline regional climate normals.
- **Role in FieldWise**: It serves as an empirical machine-learning benchmark showing that gradient-boosted trees can fit historical district-level agricultural statistics ($R^2 = 0.849$, $\text{MAE} = 1.446\text{ t/ha}$) without artificial ordinal encoding distortion. It is **NOT** a farm-level predictive advisor or weather-anomaly model.

---

## 6. Summary of Deliverables & Verification Checklist

All required Phase 3B.1.4.2 deliverables have been generated programmatically:

| Deliverable | File Path | Status | Purpose |
| :--- | :--- | :---: | :--- |
| **Audit Corrections Report** | [`reports/phase_3b_1_4_2_report.md`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/phase_3b_1_4_2_report.md) | **Generated** | Primary audited report documenting AST source inspection, empirical district-homonym verification, validation invariants, and manifest invariants. |
| **Audit Metrics JSON** | [`reports/phase_3b_1_4_2_metrics.json`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/phase_3b_1_4_2_metrics.json) | **Generated** | Single source of truth containing exact programmatic numbers down to 10 decimal places. |
| **Test Manifest Reconciliation CSV** | [`reports/test_manifest_reconciliation.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/test_manifest_reconciliation.csv) | **Generated** | Tabular reconciliation of test-set IDs across Exp A, Exp B, intersection, union, and dataset totals. |
| **Common Crop Delta Reconciliation CSV** | [`reports/common_crop_delta_reconciliation.csv`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/reports/common_crop_delta_reconciliation.csv) | **Generated** | Row-by-row per-crop validation counts, MAEs, deltas, and weighted error units across all 30 common prime crops. |
| **Audit Script** | [`scripts/reconcile_phase_3b_1_4.py`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/scripts/reconcile_phase_3b_1_4.py) | **Executable** | Standalone Python script executing all audit assertions and exporting reports. |
| **Pipeline Documentation** | [`README.md`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/README.md) | **Updated** | Updated with Phase 3B.1.4.2 audit findings and instructions. |
| **Review Archive** | [`FieldWise_Phase3B_1_Review.zip`](file:///Users/shivamkumar/farmingFinal/FieldWise_Phase3B_1_Review.zip) | **Packaged** | Complete, clean review ZIP archive containing all project code, reports, datasets, and experiment outputs. |

### Final Compliance Checklist
- [x] Real source-code audit of `SeasonalHierarchicalChallenger._get_group_means` executed via AST inspection; verified grouping keys, agg, count filter, and absence of `nunique`.
- [x] District-homonym explanation empirically verified on non-target columns (`State`, `District`, `Crop`, `Season`, `Crop_Year`); proved 729 / 729 multi-record cells (100.0%) span multiple states across 7 specific homonym pairs, with 0 single-state multi-record cells.
- [x] Validation prediction invariants asserted: unique non-null IDs, presence of required columns, finite values, 13,422 common rows, 30 common crops, and exact numerical equality between weighted aggregate and direct pooled MAE deltas across all 9 models.
- [x] Manifest invariants asserted: Exp A=5,433, Exp B=6,852, $A \subset B$, Intersection=5,433, Union=6,852, $B \setminus A=1,419$, $A \setminus B=0$, derived conditional/excluded count non-negative (4,053).
- [x] Truthful and precise audit isolation language: non-target columns specified for cleaned dataset read; validation targets read only from saved 2012–2013 validation files; zero 2014–2015 test targets loaded/predicted/evaluated.
- [x] Zero models trained; zero test predictions generated; zero test metrics computed; sealed test set strictly preserved.
- [x] Frontend, backend, and `model/predictor.js` completely unmodified; no residual stacking implemented.
