"""
FieldWise ML Pipeline — Historical Crop Yield Regression Baselines (Phase 3B.1)
Script: evaluate_yield_baselines.py

Performs rigorous validation evaluation of the baseline models:
  - Global metrics: MAE, RMSE, R², Median Absolute Error, Mean Absolute Percentage Error (MAPE)
  - Crop-by-crop performance breakdown
  - State-by-state performance breakdown
  - Low-frequency crop analysis
  - Error distribution and residual analysis (mean, std, skewness, percentiles, tolerance bands)
  - Cross-experiment comparison (Experiment A Prime-only vs Experiment B Prime + Provisional)
  - Provenance segment analysis (Verified source passages vs. Provisional agronomic estimates)

CRUCIAL INVARIANT:
  Only Validation data (2012–2013) is evaluated.
  The Final Test Set (2014–2015) remains strictly SEALED.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score, median_absolute_error

# Path setup
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PIPELINE_ROOT = os.path.dirname(SCRIPT_DIR)
REPORTS_DIR = os.path.join(PIPELINE_ROOT, "reports")
EXPERIMENTS_DIR = os.path.join(PIPELINE_ROOT, "experiments")

MODELS = [
    "historical_district_mean",
    "historical_state_mean",
    "random_forest",
    "extra_trees",
    "hist_gradient_boosting",
    "xgboost"
]

TARGET_COL = "Yield_Tonnes_Per_Ha"


def compute_metrics(y_true, y_pred):
    """Computes comprehensive regression evaluation metrics."""
    residuals = y_true - y_pred
    abs_errors = np.abs(residuals)
    
    # Avoid zero division in MAPE
    nonzero_mask = y_true > 0.01
    mape = float(np.mean(abs_errors[nonzero_mask] / y_true[nonzero_mask]) * 100) if np.any(nonzero_mask) else 0.0

    # Tolerance bands
    within_10_pct = float(np.mean(abs_errors[nonzero_mask] <= 0.10 * y_true[nonzero_mask]) * 100) if np.any(nonzero_mask) else 0.0
    within_20_pct = float(np.mean(abs_errors[nonzero_mask] <= 0.20 * y_true[nonzero_mask]) * 100) if np.any(nonzero_mask) else 0.0
    within_1_tha = float(np.mean(abs_errors <= 1.0) * 100)

    # Residual percentiles
    p10, p25, p50, p75, p90, p99 = np.percentile(residuals, [10, 25, 50, 75, 90, 99])

    return {
        "mae": float(round(mean_absolute_error(y_true, y_pred), 4)),
        "rmse": float(round(root_mean_squared_error(y_true, y_pred), 4)),
        "r2": float(round(r2_score(y_true, y_pred), 4)),
        "median_ae": float(round(median_absolute_error(y_true, y_pred), 4)),
        "mape_pct": float(round(mape, 2)),
        "within_10_pct": float(round(within_10_pct, 2)),
        "within_20_pct": float(round(within_20_pct, 2)),
        "within_1_tha_pct": float(round(within_1_tha, 2)),
        "residuals": {
            "mean": float(round(np.mean(residuals), 4)),
            "std": float(round(np.std(residuals), 4)),
            "skewness": float(round(stats.skew(residuals), 4)),
            "p10": float(round(p10, 4)),
            "p25": float(round(p25, 4)),
            "median_p50": float(round(p50, 4)),
            "p75": float(round(p75, 4)),
            "p90": float(round(p90, 4)),
            "p99": float(round(p99, 4))
        }
    }


def evaluate_experiment(exp_name, preds_path):
    """Evaluates all baseline models on the validation partition of a given experiment."""
    assert os.path.exists(preds_path), f"Predictions file missing: {preds_path}"
    df = pd.read_csv(preds_path)
    y_true = df[TARGET_COL].values

    print(f"\nEvaluating {exp_name.upper()} ({len(df):,} validation records)...")

    # 1. Global Model Performance
    global_metrics = {}
    for m in MODELS:
        col = f"pred_{m}"
        assert col in df.columns, f"Missing prediction column: {col}"
        y_pred = df[col].values
        global_metrics[m] = compute_metrics(y_true, y_pred)
        print(f"  {m:26s} | MAE: {global_metrics[m]['mae']:7.4f} | RMSE: {global_metrics[m]['rmse']:7.4f} | R²: {global_metrics[m]['r2']:7.4f}")

    # 2. Performance by Crop
    crop_metrics = {}
    crops = sorted(df["Crop"].unique())
    for c in crops:
        sub = df[df["Crop"] == c]
        if len(sub) < 5:
            continue
        c_true = sub[TARGET_COL].values
        crop_metrics[c] = {
            "sample_count": int(len(sub)),
            "mean_true_yield": float(round(np.mean(c_true), 4)),
            "std_true_yield": float(round(np.std(c_true), 4)),
            "models": {}
        }
        for m in MODELS:
            c_pred = sub[f"pred_{m}"].values
            crop_metrics[c]["models"][m] = {
                "mae": float(round(mean_absolute_error(c_true, c_pred), 4)),
                "rmse": float(round(root_mean_squared_error(c_true, c_pred), 4)),
                "r2": float(round(r2_score(c_true, c_pred), 4)) if np.var(c_true) > 1e-6 else 0.0
            }

    # 3. Performance by State
    state_metrics = {}
    states = sorted(df["State"].unique())
    for s in states:
        sub = df[df["State"] == s]
        if len(sub) < 10:
            continue
        s_true = sub[TARGET_COL].values
        state_metrics[s] = {
            "sample_count": int(len(sub)),
            "mean_true_yield": float(round(np.mean(s_true), 4)),
            "models": {}
        }
        for m in MODELS:
            s_pred = sub[f"pred_{m}"].values
            state_metrics[s]["models"][m] = {
                "mae": float(round(mean_absolute_error(s_true, s_pred), 4)),
                "rmse": float(round(root_mean_squared_error(s_true, s_pred), 4)),
                "r2": float(round(r2_score(s_true, s_pred), 4)) if np.var(s_true) > 1e-6 else 0.0
            }

    # 4. Low-Frequency Crops Analysis (validation sample count < 250)
    low_freq_crops = [c for c in crops if len(df[df["Crop"] == c]) < 250]
    low_freq_metrics = {}
    if low_freq_crops:
        sub_low = df[df["Crop"].isin(low_freq_crops)]
        l_true = sub_low[TARGET_COL].values
        low_freq_metrics["summary"] = {
            "crops_count": len(low_freq_crops),
            "total_samples": int(len(sub_low)),
            "crops_list": low_freq_crops
        }
        low_freq_metrics["models"] = {}
        for m in MODELS:
            l_pred = sub_low[f"pred_{m}"].values
            low_freq_metrics["models"][m] = compute_metrics(l_true, l_pred)

    # 5. Provenance Breakdown (if applicable)
    provenance_metrics = {}
    if "provenance_status" in df.columns and df["provenance_status"].nunique() > 1:
        for prov_status, group in df.groupby("provenance_status"):
            p_true = group[TARGET_COL].values
            provenance_metrics[prov_status] = {
                "sample_count": int(len(group)),
                "crops_count": int(group["Crop"].nunique()),
                "mean_true_yield": float(round(np.mean(p_true), 4)),
                "models": {}
            }
            for m in MODELS:
                p_pred = group[f"pred_{m}"].values
                provenance_metrics[prov_status]["models"][m] = compute_metrics(p_true, p_pred)

    return {
        "experiment_name": exp_name,
        "validation_records_count": int(len(df)),
        "global_model_metrics": global_metrics,
        "crop_level_metrics": crop_metrics,
        "state_level_metrics": state_metrics,
        "low_frequency_crops_analysis": low_freq_metrics,
        "provenance_breakdown": provenance_metrics
    }


def compare_experiments(exp_a_eval, exp_b_eval, preds_a_path, preds_b_path):
    """Performs rigorous cross-experiment comparison between Prime and Prime+Provisional."""
    df_a = pd.read_csv(preds_a_path)
    df_b = pd.read_csv(preds_b_path)

    # Common prime crops evaluation in Experiment B
    df_b_prime_slice = df_b[df_b["provenance_status"] == "verified_source_passage"]
    common_prime_comparison = {}
    for m in MODELS:
        y_a_true = df_a[TARGET_COL].values
        y_a_pred = df_a[f"pred_{m}"].values
        metrics_a = compute_metrics(y_a_true, y_a_pred)

        y_b_true = df_b_prime_slice[TARGET_COL].values
        y_b_pred = df_b_prime_slice[f"pred_{m}"].values
        metrics_b = compute_metrics(y_b_true, y_b_pred)

        common_prime_comparison[m] = {
            "model_trained_on_prime_only": {
                "mae": metrics_a["mae"],
                "rmse": metrics_a["rmse"],
                "r2": metrics_a["r2"]
            },
            "model_trained_on_prime_plus_provisional": {
                "mae": metrics_b["mae"],
                "rmse": metrics_b["rmse"],
                "r2": metrics_b["r2"]
            },
            "mae_delta": float(round(metrics_b["mae"] - metrics_a["mae"], 4)),
            "r2_delta": float(round(metrics_b["r2"] - metrics_a["r2"], 4))
        }

    return {
        "dataset_size_comparison": {
            "experiment_a_prime_records": exp_a_eval["validation_records_count"],
            "experiment_b_provisional_records": exp_b_eval["validation_records_count"],
            "additional_validation_records": exp_b_eval["validation_records_count"] - exp_a_eval["validation_records_count"],
            "crops_count_exp_a": len(exp_a_eval["crop_level_metrics"]),
            "crops_count_exp_b": len(exp_b_eval["crop_level_metrics"])
        },
        "performance_on_common_prime_crops": common_prime_comparison
    }


def main():
    print("🛡️ FieldWise Phase 3B.1: Initializing Validation Evaluation Suite...")

    preds_a_path = os.path.join(EXPERIMENTS_DIR, "experiment_a_prime", "validation_predictions.csv")
    preds_b_path = os.path.join(EXPERIMENTS_DIR, "experiment_b_provisional", "validation_predictions.csv")

    exp_a_eval = evaluate_experiment("experiment_a_prime", preds_a_path)
    exp_b_eval = evaluate_experiment("experiment_b_provisional", preds_b_path)

    comparison = compare_experiments(exp_a_eval, exp_b_eval, preds_a_path, preds_b_path)

    metrics_json = {
        "metadata": {
            "pipeline_stage": "Phase 3B.1: Historical Yield Regression Baselines Evaluation",
            "timestamp": pd.Timestamp.now().isoformat(),
            "evaluation_split": "Validation Partition (2012–2013)",
            "test_split_status": "SEALED_TEST_SET_UNSEEN_BY_MODELS (2014–2015)",
            "models_evaluated": MODELS,
            "target": TARGET_COL,
            "target_unit": "Metric Tonnes per Hectare"
        },
        "experiment_a_prime": exp_a_eval,
        "experiment_b_provisional": exp_b_eval,
        "cross_experiment_comparison": comparison
    }

    # Save metrics JSON
    metrics_json_path = os.path.join(REPORTS_DIR, "phase_3b_1_baseline_metrics.json")
    with open(metrics_json_path, "w") as f:
        json.dump(metrics_json, f, indent=2)

    print(f"\n🎉 Validation metrics successfully exported to: {metrics_json_path}")
    return metrics_json


if __name__ == "__main__":
    main()
