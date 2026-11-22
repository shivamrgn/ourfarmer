"""
FieldWise ML Pipeline — Historical Crop Yield Regression Baselines (Phase 3B.1)
Script: train_yield_baselines.py

Trains reproducible baseline models for district-level historical crop yield estimation:
  1. Historical District Mean Yield (Hierarchical fallback)
  2. Historical State Mean Yield (Hierarchical fallback)
  3. Random Forest Regressor
  4. Extra Trees Regressor
  5. HistGradientBoosting Regressor
  6. XGBoost Regressor

Executes two strictly separated experimental tracks:
  - Experiment A (Prime-only): 126,375 records (30 verified source passage crops)
  - Experiment B (Prime + Provisional): 161,270 records (60 documented individual crops)

Enforces strict chronological partitioning:
  - Training: 1997–2011
  - Validation: 2012–2013
  - Final Test (SEALED): 2014–2015 (Unseen, unpredicted, unscaled)
"""

import os
import sys
import json
import time
import joblib
import platform
import argparse
import numpy as np
import pandas as pd

from sklearn.preprocessing import OrdinalEncoder
from sklearn.ensemble import RandomForestRegressor, ExtraTreesRegressor, HistGradientBoostingRegressor
import xgboost as xgb
import sklearn

# Path setup
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PIPELINE_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PIPELINE_ROOT, "data")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")
REPORTS_DIR = os.path.join(PIPELINE_ROOT, "reports")
EXPERIMENTS_DIR = os.path.join(PIPELINE_ROOT, "experiments")

# Fixed random state for strict reproducibility
RANDOM_SEED = 42

FEATURE_COLS_CAT = ["State", "District", "Season", "Crop"]
FEATURE_COLS_NUM = ["Crop_Year", "district_normal_annual_rainfall_mm", "district_normal_monsoon_rainfall_mm"]
TARGET_COL = "Yield_Tonnes_Per_Ha"


class DistrictMeanBaseline:
    """
    Historical District Mean Yield Baseline:
    Estimates yield as the training historical mean for (Crop, District).
    Fallback hierarchy:
      1. (Crop, District) mean in training data
      2. (Crop, State) mean in training data
      3. (Crop) overall mean in training data
      4. Global mean yield in training data
    """
    def __init__(self):
        self.crop_dist_means = {}
        self.crop_state_means = {}
        self.crop_means = {}
        self.global_mean = 0.0

    def fit(self, df, y_col=TARGET_COL):
        self.crop_dist_means = df.groupby(["Crop", "District"])[y_col].mean().to_dict()
        self.crop_state_means = df.groupby(["Crop", "State"])[y_col].mean().to_dict()
        self.crop_means = df.groupby("Crop")[y_col].mean().to_dict()
        self.global_mean = float(df[y_col].mean())
        return self

    def predict(self, df):
        preds = []
        for _, row in df.iterrows():
            c = row["Crop"]
            d = row["District"]
            s = row["State"]
            if (c, d) in self.crop_dist_means:
                preds.append(self.crop_dist_means[(c, d)])
            elif (c, s) in self.crop_state_means:
                preds.append(self.crop_state_means[(c, s)])
            elif c in self.crop_means:
                preds.append(self.crop_means[c])
            else:
                preds.append(self.global_mean)
        return np.array(preds, dtype=np.float64)


class StateMeanBaseline:
    """
    Historical State Mean Yield Baseline:
    Estimates yield as the training historical mean for (Crop, State).
    Fallback hierarchy:
      1. (Crop, State) mean in training data
      2. (Crop) overall mean in training data
      3. Global mean yield in training data
    """
    def __init__(self):
        self.crop_state_means = {}
        self.crop_means = {}
        self.global_mean = 0.0

    def fit(self, df, y_col=TARGET_COL):
        self.crop_state_means = df.groupby(["Crop", "State"])[y_col].mean().to_dict()
        self.crop_means = df.groupby("Crop")[y_col].mean().to_dict()
        self.global_mean = float(df[y_col].mean())
        return self

    def predict(self, df):
        preds = []
        for _, row in df.iterrows():
            c = row["Crop"]
            s = row["State"]
            if (c, s) in self.crop_state_means:
                preds.append(self.crop_state_means[(c, s)])
            elif c in self.crop_means:
                preds.append(self.crop_means[c])
            else:
                preds.append(self.global_mean)
        return np.array(preds, dtype=np.float64)


class BaselinePreprocessor:
    """
    Feature preprocessor fitted exclusively on the training partition.
    Encodes categorical features via OrdinalEncoder and handles unseen categories with -1.
    Prevents any target or test/val leakage.
    """
    def __init__(self, cat_cols=FEATURE_COLS_CAT, num_cols=FEATURE_COLS_NUM):
        self.cat_cols = cat_cols
        self.num_cols = num_cols
        self.encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
        self.feature_names = None

    def fit(self, df):
        self.encoder.fit(df[self.cat_cols])
        self.feature_names = list(self.cat_cols) + list(self.num_cols)
        return self

    def transform(self, df):
        cat_arr = self.encoder.transform(df[self.cat_cols])
        num_arr = df[self.num_cols].values
        return np.hstack([cat_arr, num_arr])

    def fit_transform(self, df):
        return self.fit(df).transform(df)


def load_and_filter_datasets():
    """
    Loads cleaned_crop_yield.csv, threshold_provenance.json, and crop_exclusion_and_mapping_inventory.json,
    and returns separated DataFrames for Experiment A and Experiment B.
    """
    clean_csv_path = os.path.join(PROCESSED_DIR, "cleaned_crop_yield.csv")
    prov_path = os.path.join(REPORTS_DIR, "threshold_provenance.json")
    excl_path = os.path.join(REPORTS_DIR, "crop_exclusion_and_mapping_inventory.json")

    assert os.path.exists(clean_csv_path), f"Cleaned dataset missing: {clean_csv_path}"
    assert os.path.exists(prov_path), f"Threshold provenance missing: {prov_path}"
    assert os.path.exists(excl_path), f"Exclusion inventory missing: {excl_path}"

    df = pd.read_csv(clean_csv_path)
    with open(prov_path) as f:
        prov = json.load(f)
    with open(excl_path) as f:
        excl = json.load(f)

    verified = {k for k, v in prov.items() if v.get("provenance_status") == "verified_source_passage"}
    provisional = {k for k, v in prov.items() if v.get("provenance_status") == "provisional_agronomic_estimate"}
    excluded_crops = set(excl["macro_aggregate_totals"].keys()) | set(excl["composite_residual_categories"].keys()) | set(excl["ambiguous_product_basis_categories"].keys())

    # Screening threshold alignment
    thresholds = {k: v["screening_threshold"] for k, v in prov.items()}
    df["screening_threshold"] = df["Crop"].map(thresholds)
    df["is_le_threshold"] = df["Yield_Tonnes_Per_Ha"] <= df["screening_threshold"]
    df["is_matched_rainfall"] = df["district_normal_annual_rainfall_mm"].notnull()
    df["is_excluded"] = df["Crop"].isin(excluded_crops)

    prime_mask = df["Crop"].isin(verified) & df["is_matched_rainfall"] & df["is_le_threshold"] & (~df["is_excluded"])
    prov_mask = df["Crop"].isin(provisional) & df["is_matched_rainfall"] & df["is_le_threshold"] & (~df["is_excluded"])

    df_prime = df[prime_mask].copy()
    df_prime["provenance_status"] = "verified_source_passage"

    df_prov = df[prov_mask].copy()
    df_prov["provenance_status"] = "provisional_agronomic_estimate"

    df_exp_a = df_prime.copy()
    df_exp_b = pd.concat([df_prime, df_prov], ignore_index=True)

    assert len(df_exp_a) == 126375, f"Expected 126,375 rows for Exp A, got {len(df_exp_a)}"
    assert len(df_exp_b) == 161270, f"Expected 161,270 rows for Exp B, got {len(df_exp_b)}"

    return df_exp_a, df_exp_b


def run_experiment(exp_name, df_exp, output_dir):
    """
    Executes a complete controlled regression experiment for a given dataset track:
      1. Generates split manifest (Train: <=2011, Val: 2012-2013, Test: 2014-2015 SEALED)
      2. Fits BaselinePreprocessor on Train ONLY
      3. Fits 6 baseline models on Train ONLY
      4. Generates predictions on Validation Set
      5. Serializes models, preprocessor, manifest, and validation predictions
    """
    os.makedirs(output_dir, exist_ok=True)
    models_dir = os.path.join(output_dir, "models")
    os.makedirs(models_dir, exist_ok=True)

    print(f"\n========================================================")
    print(f"🚀 Running {exp_name.upper()} (Total Records: {len(df_exp):,})")
    print(f"========================================================")

    # 1. Chronological Splitting
    train_mask = df_exp["Crop_Year"] <= 2011
    val_mask = df_exp["Crop_Year"].isin([2012, 2013])
    test_mask = df_exp["Crop_Year"].isin([2014, 2015])

    train_df = df_exp[train_mask].copy()
    val_df = df_exp[val_mask].copy()
    test_df = df_exp[test_mask].copy()

    assert len(train_df) + len(val_df) + len(test_df) == len(df_exp), "Split counts do not sum to total!"

    print(f"  📊 Chronological Partitions:")
    print(f"     - Training (1997-2011): {len(train_df):,} records ({train_df['State'].nunique()} states, {train_df['District'].nunique()} districts, {train_df['Crop'].nunique()} crops)")
    print(f"     - Validation (2012-2013): {len(val_df):,} records ({val_df['State'].nunique()} states, {val_df['District'].nunique()} districts, {val_df['Crop'].nunique()} crops)")
    print(f"     - Test (2014-2015, SEALED): {len(test_df):,} records ({test_df['State'].nunique()} states, {test_df['District'].nunique()} districts, {test_df['Crop'].nunique()} crops)")

    # Save Split Manifest
    manifest = {
        "experiment_name": exp_name,
        "created_at": pd.Timestamp.now().isoformat(),
        "total_records": int(len(df_exp)),
        "target_column": TARGET_COL,
        "target_unit": "Metric Tonnes per Hectare",
        "feature_set": {
            "categorical": FEATURE_COLS_CAT,
            "numerical": FEATURE_COLS_NUM,
            "strictly_excluded": ["Production", "Cultivated_Area_Ha"]
        },
        "training_partition_1997_2011": {
            "record_count": int(len(train_df)),
            "distinct_states": int(train_df["State"].nunique()),
            "distinct_districts": int(train_df["District"].nunique()),
            "distinct_crops": int(train_df["Crop"].nunique()),
            "mean_yield": float(round(train_df[TARGET_COL].mean(), 4)),
            "std_yield": float(round(train_df[TARGET_COL].std(), 4)),
            "raw_row_ids": train_df["raw_row_id"].tolist()
        },
        "validation_partition_2012_2013": {
            "record_count": int(len(val_df)),
            "distinct_states": int(val_df["State"].nunique()),
            "distinct_districts": int(val_df["District"].nunique()),
            "distinct_crops": int(val_df["Crop"].nunique()),
            "mean_yield": float(round(val_df[TARGET_COL].mean(), 4)),
            "std_yield": float(round(val_df[TARGET_COL].std(), 4)),
            "raw_row_ids": val_df["raw_row_id"].tolist()
        },
        "test_partition_2014_2015_sealed": {
            "record_count": int(len(test_df)),
            "distinct_states": int(test_df["State"].nunique()),
            "distinct_districts": int(test_df["District"].nunique()),
            "distinct_crops": int(test_df["Crop"].nunique()),
            "status": "SEALED_TEST_SET_UNSEEN_BY_MODELS",
            "raw_row_ids": test_df["raw_row_id"].tolist()
        }
    }
    manifest_path = os.path.join(output_dir, "split_manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"  💾 Split manifest written: {manifest_path}")

    # 2. Fit Preprocessor exclusively on Training Data
    preprocessor = BaselinePreprocessor(cat_cols=FEATURE_COLS_CAT, num_cols=FEATURE_COLS_NUM)
    preprocessor.fit(train_df)
    preprocessor_path = os.path.join(output_dir, "preprocessor.joblib")
    joblib.dump(preprocessor, preprocessor_path)
    print(f"  💾 Preprocessor fitted & serialized: {preprocessor_path}")

    X_train = preprocessor.transform(train_df)
    y_train = train_df[TARGET_COL].values

    X_val = preprocessor.transform(val_df)
    y_val = val_df[TARGET_COL].values

    # Validation predictions DataFrame
    val_preds_df = val_df[["raw_row_id", "State", "District", "Crop_Year", "Season", "Crop", "provenance_status", TARGET_COL]].copy()

    # 3. Model Training & Serialization
    trained_models = {}
    training_times = {}

    # --- Model 1: Historical District Mean ---
    print("\n  [1/6] Fitting Historical District Mean Baseline...")
    t0 = time.time()
    m_dist = DistrictMeanBaseline()
    m_dist.fit(train_df)
    t1 = time.time()
    joblib.dump(m_dist, os.path.join(models_dir, "historical_district_mean.joblib"))
    val_preds_df["pred_historical_district_mean"] = m_dist.predict(val_df)
    training_times["historical_district_mean"] = round(t1 - t0, 3)
    trained_models["historical_district_mean"] = m_dist
    print(f"        Trained in {t1 - t0:.2f}s")

    # --- Model 2: Historical State Mean ---
    print("  [2/6] Fitting Historical State Mean Baseline...")
    t0 = time.time()
    m_state = StateMeanBaseline()
    m_state.fit(train_df)
    t1 = time.time()
    joblib.dump(m_state, os.path.join(models_dir, "historical_state_mean.joblib"))
    val_preds_df["pred_historical_state_mean"] = m_state.predict(val_df)
    training_times["historical_state_mean"] = round(t1 - t0, 3)
    trained_models["historical_state_mean"] = m_state
    print(f"        Trained in {t1 - t0:.2f}s")

    # --- Model 3: Random Forest Regressor ---
    print("  [3/6] Fitting Random Forest Regressor (n_estimators=100, max_depth=16)...")
    t0 = time.time()
    m_rf = RandomForestRegressor(
        n_estimators=100,
        max_depth=16,
        min_samples_leaf=5,
        n_jobs=-1,
        random_state=RANDOM_SEED
    )
    m_rf.fit(X_train, y_train)
    t1 = time.time()
    joblib.dump(m_rf, os.path.join(models_dir, "random_forest_regressor.joblib"))
    val_preds_df["pred_random_forest"] = m_rf.predict(X_val)
    training_times["random_forest"] = round(t1 - t0, 3)
    trained_models["random_forest"] = m_rf
    print(f"        Trained in {t1 - t0:.2f}s")

    # --- Model 4: Extra Trees Regressor ---
    print("  [4/6] Fitting Extra Trees Regressor (n_estimators=100, max_depth=16)...")
    t0 = time.time()
    m_et = ExtraTreesRegressor(
        n_estimators=100,
        max_depth=16,
        min_samples_leaf=5,
        n_jobs=-1,
        random_state=RANDOM_SEED
    )
    m_et.fit(X_train, y_train)
    t1 = time.time()
    joblib.dump(m_et, os.path.join(models_dir, "extra_trees_regressor.joblib"))
    val_preds_df["pred_extra_trees"] = m_et.predict(X_val)
    training_times["extra_trees"] = round(t1 - t0, 3)
    trained_models["extra_trees"] = m_et
    print(f"        Trained in {t1 - t0:.2f}s")

    # --- Model 5: HistGradientBoosting Regressor ---
    print("  [5/6] Fitting HistGradientBoosting Regressor (max_iter=150, max_depth=12)...")
    t0 = time.time()
    m_hgb = HistGradientBoostingRegressor(
        max_iter=150,
        max_depth=12,
        min_samples_leaf=15,
        l2_regularization=1.0,
        random_state=RANDOM_SEED
    )
    m_hgb.fit(X_train, y_train)
    t1 = time.time()
    joblib.dump(m_hgb, os.path.join(models_dir, "hist_gradient_boosting.joblib"))
    val_preds_df["pred_hist_gradient_boosting"] = m_hgb.predict(X_val)
    training_times["hist_gradient_boosting"] = round(t1 - t0, 3)
    trained_models["hist_gradient_boosting"] = m_hgb
    print(f"        Trained in {t1 - t0:.2f}s")

    # --- Model 6: XGBoost Regressor ---
    print("  [6/6] Fitting XGBoost Regressor (n_estimators=150, max_depth=8, lr=0.08)...")
    t0 = time.time()
    m_xgb = xgb.XGBRegressor(
        n_estimators=150,
        max_depth=8,
        learning_rate=0.08,
        subsample=0.8,
        colsample_bytree=0.8,
        n_jobs=-1,
        random_state=RANDOM_SEED
    )
    m_xgb.fit(X_train, y_train)
    t1 = time.time()
    joblib.dump(m_xgb, os.path.join(models_dir, "xgboost_regressor.joblib"))
    val_preds_df["pred_xgboost"] = m_xgb.predict(X_val)
    training_times["xgboost"] = round(t1 - t0, 3)
    trained_models["xgboost"] = m_xgb
    print(f"        Trained in {t1 - t0:.2f}s")

    # Save validation predictions
    val_preds_path = os.path.join(output_dir, "validation_predictions.csv")
    val_preds_df.to_csv(val_preds_path, index=False)
    print(f"\n  💾 Validation predictions saved: {val_preds_path}")

    # Save training metadata
    training_meta = {
        "experiment_name": exp_name,
        "timestamp": pd.Timestamp.now().isoformat(),
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "library_versions": {
            "sklearn": sklearn.__version__,
            "xgboost": xgb.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "joblib": joblib.__version__
        },
        "random_seed": RANDOM_SEED,
        "training_times_seconds": training_times,
        "models_serialized": [f"{k}.joblib" for k in trained_models.keys()],
        "features": {
            "categorical": FEATURE_COLS_CAT,
            "numerical": FEATURE_COLS_NUM,
            "target": TARGET_COL
        }
    }
    meta_path = os.path.join(output_dir, "training_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(training_meta, f, indent=2)

    return val_preds_df, training_meta


def main():
    parser = argparse.ArgumentParser(description="FieldWise Phase 3B.1 Historical Yield Baselines Training")
    parser.add_argument("--track", choices=["all", "a", "b"], default="all", help="Which experiment track to run")
    args = parser.parse_args()

    print("🌱 FieldWise Phase 3B.1: Initializing Historical Yield Regression Baselines...")
    df_exp_a, df_exp_b = load_and_filter_datasets()

    if args.track in ["all", "a"]:
        dir_a = os.path.join(EXPERIMENTS_DIR, "experiment_a_prime")
        run_experiment("experiment_a_prime", df_exp_a, dir_a)

    if args.track in ["all", "b"]:
        dir_b = os.path.join(EXPERIMENTS_DIR, "experiment_b_provisional")
        run_experiment("experiment_b_provisional", df_exp_b, dir_b)

    print("\n✅ ALL BASELINE TRAINING COMPLETED SUCCESSFULLY!")


if __name__ == "__main__":
    main()
