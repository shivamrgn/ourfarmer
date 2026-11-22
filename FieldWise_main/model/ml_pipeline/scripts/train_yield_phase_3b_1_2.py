"""
FieldWise ML Pipeline — Historical Crop Yield Regression (Phase 3B.1.2)
Script: train_yield_phase_3b_1_2.py

Implements corrected categorical encoding and re-evaluates the seasonal hierarchical district baseline:
  1. Seasonal Hierarchical Challenger Baseline (Levels 1-7, min_obs = 1, 3, 5)
  2. Corrected Categorical Random Forest (One-Hot Encoded with handle_unknown='ignore')
  3. Corrected Categorical Extra Trees (One-Hot Encoded with handle_unknown='ignore')
  4. Native Categorical XGBoost (enable_categorical=True, pandas category dtype)
  5. Leakage-Safe Target-Encoded Random Forest (5-fold internal CV fitted strictly on training data)

Strictly trained on historical training partition (1997-2011).
Generates predictions out-of-sample on validation partition (2012-2013).
Test partition (2014-2015) is STRICTLY SEALED.

Saves all artifacts in:
  model/ml_pipeline/experiments/phase_3b_1_2/
"""

import os
import sys
import json
import time
import joblib
import platform
import numpy as np
import pandas as pd

from sklearn.preprocessing import OneHotEncoder, TargetEncoder
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor, ExtraTreesRegressor
import xgboost as xgb
import sklearn

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PIPELINE_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PIPELINE_ROOT, "data")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")
REPORTS_DIR = os.path.join(PIPELINE_ROOT, "reports")
EXPERIMENTS_DIR = os.path.join(PIPELINE_ROOT, "experiments")
PHASE_DIR = os.path.join(EXPERIMENTS_DIR, "phase_3b_1_2")

RANDOM_SEED = 42

CAT_COLS = ["State", "District", "Season", "Crop"]
NUM_COLS = ["Crop_Year", "district_normal_annual_rainfall_mm", "district_normal_monsoon_rainfall_mm"]
TARGET_COL = "Yield_Tonnes_Per_Ha"


class SeasonalHierarchicalChallenger:
    """
    7-Level Seasonal Hierarchical District Challenger Baseline:
      Level 1: District + Crop + Season
      Level 2: District + Crop
      Level 3: State + Crop + Season
      Level 4: State + Crop
      Level 5: Crop + Season
      Level 6: Crop
      Level 7: Global Training Mean
    Accepts minimum observation threshold (min_obs).
    """
    def __init__(self, min_obs=1):
        self.min_obs = min_obs
        self.d_c_s = {}
        self.d_c = {}
        self.s_c_s = {}
        self.s_c = {}
        self.c_s = {}
        self.c = {}
        self.global_mean = 0.0

    def _get_group_means(self, df, group_cols, y_col=TARGET_COL):
        agg = df.groupby(group_cols)[y_col].agg(["mean", "count"])
        valid = agg[agg["count"] >= self.min_obs]
        return valid["mean"].to_dict()

    def fit(self, df, y_col=TARGET_COL):
        self.d_c_s = self._get_group_means(df, ["District", "Crop", "Season"], y_col)
        self.d_c = self._get_group_means(df, ["District", "Crop"], y_col)
        self.s_c_s = self._get_group_means(df, ["State", "Crop", "Season"], y_col)
        self.s_c = self._get_group_means(df, ["State", "Crop"], y_col)
        self.c_s = self._get_group_means(df, ["Crop", "Season"], y_col)
        self.c = self._get_group_means(df, ["Crop"], y_col)
        self.global_mean = float(df[y_col].mean())
        return self

    def predict(self, df):
        preds = []
        levels = []
        for _, row in df.iterrows():
            d = row["District"]
            c = row["Crop"]
            s = row["State"]
            sn = row["Season"]
            if (d, c, sn) in self.d_c_s:
                preds.append(self.d_c_s[(d, c, sn)])
                levels.append("1:District+Crop+Season")
            elif (d, c) in self.d_c:
                preds.append(self.d_c[(d, c)])
                levels.append("2:District+Crop")
            elif (s, c, sn) in self.s_c_s:
                preds.append(self.s_c_s[(s, c, sn)])
                levels.append("3:State+Crop+Season")
            elif (s, c) in self.s_c:
                preds.append(self.s_c[(s, c)])
                levels.append("4:State+Crop")
            elif (c, sn) in self.c_s:
                preds.append(self.c_s[(c, sn)])
                levels.append("5:Crop+Season")
            elif c in self.c:
                preds.append(self.c[c])
                levels.append("6:Crop")
            else:
                preds.append(self.global_mean)
                levels.append("7:Global")
        return np.array(preds, dtype=np.float64), levels


def run_experiment_track(exp_name, manifest_subpath, old_preds_subpath):
    print(f"\n{'='*70}")
    print(f"🚀 Launching Phase 3B.1.2 Training for: {exp_name}")
    print(f"{'='*70}")

    track_dir = os.path.join(PHASE_DIR, exp_name)
    models_dir = os.path.join(track_dir, "models")
    os.makedirs(models_dir, exist_ok=True)

    # 1. Load Data
    manifest_path = os.path.join(EXPERIMENTS_DIR, manifest_subpath)
    old_preds_path = os.path.join(EXPERIMENTS_DIR, old_preds_subpath)
    clean_csv_path = os.path.join(PROCESSED_DIR, "cleaned_crop_yield.csv")

    with open(manifest_path) as f:
        manifest = json.load(f)

    train_ids = set(manifest["training_partition_1997_2011"]["raw_row_ids"])
    val_ids = set(manifest["validation_partition_2012_2013"]["raw_row_ids"])

    df_clean = pd.read_csv(clean_csv_path)
    train_df = df_clean[df_clean["raw_row_id"].isin(train_ids)].copy().sort_values("raw_row_id")
    val_df = df_clean[df_clean["raw_row_id"].isin(val_ids)].copy().sort_values("raw_row_id")

    # Load old predictions for exact side-by-side baseline comparison
    df_old_preds = pd.read_csv(old_preds_path).sort_values("raw_row_id")

    print(f"  Training partition   : {len(train_df):,} rows (1997–2011)")
    print(f"  Validation partition : {len(val_df):,} rows (2012–2013)")

    val_preds_df = df_old_preds[["raw_row_id", "State", "District", "Crop_Year", "Season", "Crop", "provenance_status", TARGET_COL]].copy()
    val_preds_df["pred_existing_district_mean"] = df_old_preds["pred_historical_district_mean"].values
    val_preds_df["pred_existing_random_forest"] = df_old_preds["pred_random_forest"].values

    training_metadata = {
        "experiment_track": exp_name,
        "phase": "Phase 3B.1.2",
        "timestamp": pd.Timestamp.now().isoformat(),
        "training_partition": "1997-2011",
        "validation_partition": "2012-2013",
        "sealed_test_partition": "2014-2015 (SEALED)",
        "train_rows": len(train_df),
        "val_rows": len(val_df),
        "random_seed": RANDOM_SEED,
        "environment": {
            "python_version": platform.python_version(),
            "sklearn_version": sklearn.__version__,
            "xgboost_version": xgb.__version__
        },
        "models": {},
        "preprocessors": {}
    }

    # -------------------------------------------------------------------------
    # 1. Seasonal Hierarchical Challenger (min_obs = 1, 3, 5)
    # -------------------------------------------------------------------------
    for n_min in [1, 3, 5]:
        m_name = f"challenger_min_obs_{n_min}"
        print(f"\n  [Challenger] Fitting Seasonal Hierarchical Challenger (min_obs={n_min})...")
        t0 = time.time()
        ch = SeasonalHierarchicalChallenger(min_obs=n_min).fit(train_df)
        preds, levels = ch.predict(val_df)
        t1 = time.time()

        joblib.dump(ch, os.path.join(models_dir, f"seasonal_hierarchical_challenger_min{n_min}.joblib"))
        val_preds_df[f"pred_challenger_min_obs_{n_min}"] = preds
        val_preds_df[f"level_challenger_min_obs_{n_min}"] = levels

        training_metadata["models"][m_name] = {
            "type": "SeasonalHierarchicalChallenger",
            "min_obs": n_min,
            "fit_time_seconds": round(t1 - t0, 3),
            "level_counts": pd.Series(levels).value_counts().to_dict()
        }

    # -------------------------------------------------------------------------
    # 2. One-Hot Encoded Pipeline (Corrected Random Forest & Extra Trees)
    # -------------------------------------------------------------------------
    print("\n  [OHE] Fitting OneHotEncoder on training partition...")
    t0 = time.time()
    ct_ohe = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=True), CAT_COLS),
        ("num", "passthrough", NUM_COLS)
    ])
    X_train_ohe = ct_ohe.fit_transform(train_df)
    X_val_ohe = ct_ohe.transform(val_df)
    t1 = time.time()

    joblib.dump(ct_ohe, os.path.join(track_dir, "preprocessor_ohe.joblib"))
    training_metadata["preprocessors"]["one_hot_encoder"] = {
        "cat_cols": CAT_COLS,
        "num_cols": NUM_COLS,
        "handle_unknown": "ignore",
        "output_features_count": int(X_train_ohe.shape[1]),
        "fit_time_seconds": round(t1 - t0, 3)
    }

    # Model: Corrected Random Forest (OHE)
    print("  [RF-OHE] Training Random Forest Regressor (One-Hot Encoded)...")
    t0 = time.time()
    rf_ohe = RandomForestRegressor(
        n_estimators=100,
        max_depth=16,
        min_samples_leaf=5,
        random_state=RANDOM_SEED,
        n_jobs=-1
    )
    rf_ohe.fit(X_train_ohe, train_df[TARGET_COL].values)
    preds_rf_ohe = rf_ohe.predict(X_val_ohe)
    t1 = time.time()
    joblib.dump(rf_ohe, os.path.join(models_dir, "random_forest_ohe.joblib"))
    val_preds_df["pred_rf_one_hot"] = preds_rf_ohe
    training_metadata["models"]["random_forest_one_hot"] = {
        "type": "RandomForestRegressor",
        "n_estimators": 100,
        "max_depth": 16,
        "min_samples_leaf": 5,
        "fit_time_seconds": round(t1 - t0, 3)
    }

    # Model: Corrected Extra Trees (OHE)
    print("  [ET-OHE] Training Extra Trees Regressor (One-Hot Encoded)...")
    t0 = time.time()
    et_ohe = ExtraTreesRegressor(
        n_estimators=100,
        max_depth=16,
        min_samples_leaf=5,
        random_state=RANDOM_SEED,
        n_jobs=-1
    )
    et_ohe.fit(X_train_ohe, train_df[TARGET_COL].values)
    preds_et_ohe = et_ohe.predict(X_val_ohe)
    t1 = time.time()
    joblib.dump(et_ohe, os.path.join(models_dir, "extra_trees_ohe.joblib"))
    val_preds_df["pred_et_one_hot"] = preds_et_ohe
    training_metadata["models"]["extra_trees_one_hot"] = {
        "type": "ExtraTreesRegressor",
        "n_estimators": 100,
        "max_depth": 16,
        "min_samples_leaf": 5,
        "fit_time_seconds": round(t1 - t0, 3)
    }

    # -------------------------------------------------------------------------
    # 3. Native Categorical XGBoost
    # -------------------------------------------------------------------------
    print("  [XGB-Native] Training Native Categorical XGBoost Regressor...")
    train_cat_df = train_df.copy()
    val_cat_df = val_df.copy()

    for col in CAT_COLS:
        cats = sorted(train_cat_df[col].astype(str).unique())
        train_cat_df[col] = pd.Categorical(train_cat_df[col].astype(str), categories=cats)
        val_cat_df[col] = pd.Categorical(val_cat_df[col].astype(str), categories=cats)

    X_train_cat = train_cat_df[CAT_COLS + NUM_COLS]
    X_val_cat = val_cat_df[CAT_COLS + NUM_COLS]

    t0 = time.time()
    xgb_native = xgb.XGBRegressor(
        n_estimators=150,
        max_depth=8,
        learning_rate=0.08,
        enable_categorical=True,
        random_state=RANDOM_SEED,
        n_jobs=-1
    )
    xgb_native.fit(X_train_cat, train_df[TARGET_COL].values)
    preds_xgb_native = xgb_native.predict(X_val_cat)
    t1 = time.time()
    joblib.dump(xgb_native, os.path.join(models_dir, "xgboost_native_categorical.joblib"))
    val_preds_df["pred_xgb_native_categorical"] = preds_xgb_native
    training_metadata["models"]["xgboost_native_categorical"] = {
        "type": "XGBRegressor",
        "n_estimators": 150,
        "max_depth": 8,
        "learning_rate": 0.08,
        "enable_categorical": True,
        "fit_time_seconds": round(t1 - t0, 3)
    }

    # -------------------------------------------------------------------------
    # 4. Leakage-Safe Target-Encoded Pipeline (Random Forest)
    # -------------------------------------------------------------------------
    print("  [TE] Fitting Leakage-Safe TargetEncoder (5-fold CV) strictly on train...")
    t0 = time.time()
    te = TargetEncoder(smooth="auto", cv=5, random_state=RANDOM_SEED)
    X_train_te_cat = te.fit_transform(train_df[CAT_COLS], train_df[TARGET_COL].values)
    X_val_te_cat = te.transform(val_df[CAT_COLS])
    X_train_te = np.hstack([X_train_te_cat, train_df[NUM_COLS].values])
    X_val_te = np.hstack([X_val_te_cat, val_df[NUM_COLS].values])
    t1 = time.time()

    joblib.dump(te, os.path.join(track_dir, "preprocessor_target_encoder.joblib"))
    training_metadata["preprocessors"]["target_encoder"] = {
        "cat_cols": CAT_COLS,
        "num_cols": NUM_COLS,
        "cv": 5,
        "smooth": "auto",
        "fit_time_seconds": round(t1 - t0, 3)
    }

    print("  [RF-TE] Training Random Forest Regressor (Target Encoded)...")
    t0 = time.time()
    rf_te = RandomForestRegressor(
        n_estimators=100,
        max_depth=16,
        min_samples_leaf=5,
        random_state=RANDOM_SEED,
        n_jobs=-1
    )
    rf_te.fit(X_train_te, train_df[TARGET_COL].values)
    preds_rf_te = rf_te.predict(X_val_te)
    t1 = time.time()
    joblib.dump(rf_te, os.path.join(models_dir, "random_forest_target_encoded.joblib"))
    val_preds_df["pred_rf_target_encoded"] = preds_rf_te
    training_metadata["models"]["random_forest_target_encoded"] = {
        "type": "RandomForestRegressor",
        "n_estimators": 100,
        "max_depth": 16,
        "min_samples_leaf": 5,
        "fit_time_seconds": round(t1 - t0, 3)
    }

    # Save validation predictions and metadata
    val_preds_path = os.path.join(track_dir, "validation_predictions.csv")
    val_preds_df.to_csv(val_preds_path, index=False)
    print(f"\n  ✅ Saved validation predictions: {val_preds_path} ({len(val_preds_df):,} rows)")

    meta_path = os.path.join(track_dir, "training_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(training_metadata, f, indent=2)
    print(f"  ✅ Saved training metadata: {meta_path}")


def main():
    print("🌾 FieldWise Phase 3B.1.2: Initializing Corrected Encoding & Challenger Training Suite...")
    run_experiment_track(
        exp_name="experiment_a_prime",
        manifest_subpath="experiment_a_prime/split_manifest.json",
        old_preds_subpath="experiment_a_prime/validation_predictions.csv"
    )
    run_experiment_track(
        exp_name="experiment_b_provisional",
        manifest_subpath="experiment_b_provisional/split_manifest.json",
        old_preds_subpath="experiment_b_provisional/validation_predictions.csv"
    )
    print("\n🎉 Phase 3B.1.2 Model Training Complete across both tracks!")


if __name__ == "__main__":
    main()
