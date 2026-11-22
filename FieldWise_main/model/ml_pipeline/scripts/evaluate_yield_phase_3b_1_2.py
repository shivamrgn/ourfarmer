"""
FieldWise ML Pipeline — Evaluation Suite (Phase 3B.1.2)
Script: evaluate_yield_phase_3b_1_2.py

Independently evaluates Phase 3B.1.2 validation predictions:
  1. Compares Existing Baseline vs Seasonal Hierarchical Challenger (min_obs = 1, 3, 5)
  2. Compares Existing Random Forest vs Corrected Categorical Models (OHE RF, OHE ET, Native XGB, TE RF)
  3. Records Fallback Resolution Counts for Challenger Models
  4. Per-Crop Comparison for 30 Common Prime Crops on identical validation rows
  5. Anomaly checks: Tomato error stability, Papaya & Sugarcane SSE contributions, Low-frequency crops
  6. Recalculates all metrics dynamically with explicit denominator filter (y > 0.01)

Exports:
  reports/phase_3b_1_2_metrics.json
  reports/phase_3b_1_2_common_crops_comparison.csv
  reports/phase_3b_1_2_residual_summary.csv
  reports/phase_3b_1_2_top_errors.csv
  reports/phase_3b_1_2_per_crop_residual_diagnostics.csv
  reports/phase_3b_1_2_challenger_resolutions.csv
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score, median_absolute_error

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PIPELINE_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PIPELINE_ROOT, "data")
REPORTS_DIR = os.path.join(PIPELINE_ROOT, "reports")
EXPERIMENTS_DIR = os.path.join(PIPELINE_ROOT, "experiments")
PHASE_DIR = os.path.join(EXPERIMENTS_DIR, "phase_3b_1_2")

TARGET_COL = "Yield_Tonnes_Per_Ha"

EVAL_MODELS = [
    "existing_district_mean",
    "existing_random_forest",
    "challenger_min_obs_1",
    "challenger_min_obs_3",
    "challenger_min_obs_5",
    "rf_one_hot",
    "et_one_hot",
    "xgb_native_categorical",
    "rf_target_encoded"
]


def compute_standard_metrics(y_true, y_pred):
    residuals = y_true - y_pred
    abs_errors = np.abs(residuals)
    
    nonzero_mask = y_true > 0.01
    mape = float(np.mean(abs_errors[nonzero_mask] / y_true[nonzero_mask]) * 100) if np.any(nonzero_mask) else 0.0
    within_10 = float(np.mean(abs_errors[nonzero_mask] <= 0.10 * y_true[nonzero_mask]) * 100) if np.any(nonzero_mask) else 0.0
    within_20 = float(np.mean(abs_errors[nonzero_mask] <= 0.20 * y_true[nonzero_mask]) * 100) if np.any(nonzero_mask) else 0.0
    within_1 = float(np.mean(abs_errors <= 1.0) * 100)

    mae = float(round(mean_absolute_error(y_true, y_pred), 4))
    rmse = float(round(root_mean_squared_error(y_true, y_pred), 4))
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    ss_res = np.sum(residuals ** 2)
    r2 = float(round(1.0 - (ss_res / ss_tot), 4)) if ss_tot > 0 else 0.0
    med_ae = float(round(median_absolute_error(y_true, y_pred), 4))

    return {
        "mae": mae,
        "rmse": rmse,
        "r2": r2,
        "median_ae": med_ae,
        "mape_pct": round(mape, 2),
        "within_10_pct": round(within_10, 2),
        "within_20_pct": round(within_20, 2),
        "within_1_tha_pct": round(within_1, 2)
    }


def run_evaluation():
    print("🔬 FieldWise Phase 3B.1.2: Commencing Independent Evaluation Suite...")
    os.makedirs(REPORTS_DIR, exist_ok=True)

    preds_a_path = os.path.join(PHASE_DIR, "experiment_a_prime", "validation_predictions.csv")
    preds_b_path = os.path.join(PHASE_DIR, "experiment_b_provisional", "validation_predictions.csv")

    df_a = pd.read_csv(preds_a_path)
    df_b = pd.read_csv(preds_b_path)

    print(f"  Loaded Exp A predictions: {len(df_a):,} rows")
    print(f"  Loaded Exp B predictions: {len(df_b):,} rows")

    results = {
        "metadata": {
            "evaluation_phase": "Phase 3B.1.2",
            "timestamp": pd.Timestamp.now().isoformat(),
            "validation_partition": "2012-2013 chronological holdout",
            "models_evaluated": EVAL_MODELS
        },
        "experiment_a_prime": {},
        "experiment_b_provisional": {},
        "cross_experiment_prime_comparison": {},
        "challenger_resolution_breakdowns": {},
        "anomaly_investigations": {}
    }

    # 1. Global Metrics across all models
    for exp_key, df_exp in [("experiment_a_prime", df_a), ("experiment_b_provisional", df_b)]:
        y_true = df_exp[TARGET_COL].values
        mod_dict = {}
        for m in EVAL_MODELS:
            pred_col = f"pred_{m}"
            if pred_col in df_exp.columns:
                mod_dict[m] = compute_standard_metrics(y_true, df_exp[pred_col].values)
        results[exp_key]["global_model_metrics"] = mod_dict

    # 2. Challenger Resolution Counts
    challenger_res_rows = []
    for exp_name, df_exp in [("experiment_a", df_a), ("experiment_b", df_b)]:
        for n_min in [1, 3, 5]:
            lvl_col = f"level_challenger_min_obs_{n_min}"
            counts = df_exp[lvl_col].value_counts().to_dict()
            results["challenger_resolution_breakdowns"][f"{exp_name}_min_obs_{n_min}"] = counts
            for lvl, cnt in counts.items():
                challenger_res_rows.append({
                    "Experiment": exp_name,
                    "Min_Observations": n_min,
                    "Fallback_Level": lvl,
                    "Resolved_Records": cnt,
                    "Percentage": round((cnt / len(df_exp)) * 100, 2)
                })

    df_ch_res = pd.DataFrame(challenger_res_rows)
    ch_res_path = os.path.join(REPORTS_DIR, "phase_3b_1_2_challenger_resolutions.csv")
    df_ch_res.to_csv(ch_res_path, index=False)
    print(f"  ✅ Saved Challenger resolutions CSV: {ch_res_path}")

    # 3. Residual Diagnostics & Summary
    residual_summary_rows = []
    top_errors_rows = []
    per_crop_sse_rows = []

    for exp_name, df_exp in [("experiment_a", df_a), ("experiment_b", df_b)]:
        y_true = df_exp[TARGET_COL].values
        for m in EVAL_MODELS:
            col = f"pred_{m}"
            if col not in df_exp.columns:
                continue
            y_pred = df_exp[col].values
            res = y_true - y_pred
            abs_err = np.abs(res)

            p50, p75, p90, p95, p99 = np.percentile(abs_err, [50, 75, 90, 95, 99])
            max_ae = float(np.max(abs_err))
            mean_res = float(np.mean(res))
            std_res = float(np.std(res))
            total_sse = float(np.sum(res ** 2))

            residual_summary_rows.append({
                "Experiment": exp_name,
                "Model": m,
                "Total_Records": len(df_exp),
                "Residual_Mean": round(mean_res, 4),
                "Residual_Std": round(std_res, 4),
                "AbsErr_P50": round(float(p50), 4),
                "AbsErr_P75": round(float(p75), 4),
                "AbsErr_P90": round(float(p90), 4),
                "AbsErr_P95": round(float(p95), 4),
                "AbsErr_P99": round(float(p99), 4),
                "Max_Abs_Error": round(max_ae, 4)
            })

            # Top 20 errors
            df_copy = df_exp.copy()
            df_copy["abs_error"] = abs_err
            df_copy["residual"] = res
            df_copy["prediction"] = y_pred
            top20 = df_copy.sort_values(by="abs_error", ascending=False).head(20)

            for rank, (_, row) in enumerate(top20.iterrows(), 1):
                top_errors_rows.append({
                    "Experiment": exp_name,
                    "Model": m,
                    "Rank": rank,
                    "Crop": row["Crop"],
                    "State": row["State"],
                    "District": row["District"],
                    "Crop_Year": int(row["Crop_Year"]),
                    "Season": row["Season"],
                    "Actual_Yield": round(float(row[TARGET_COL]), 4),
                    "Predicted_Yield": round(float(row["prediction"]), 4),
                    "Absolute_Error": round(float(row["abs_error"]), 4),
                    "Residual_y_minus_pred": round(float(row["residual"]), 4)
                })

            # Per-crop SSE and metrics
            for c in df_exp["Crop"].unique():
                c_mask = df_exp["Crop"] == c
                c_y = y_true[c_mask]
                c_p = y_pred[c_mask]
                c_res = c_y - c_p
                c_sse = np.sum(c_res ** 2)
                c_contrib = (c_sse / total_sse) * 100.0 if total_sse > 0 else 0.0

                per_crop_sse_rows.append({
                    "Experiment": exp_name,
                    "Model": m,
                    "Crop": c,
                    "Sample_Count": int(np.sum(c_mask)),
                    "MAE": round(float(mean_absolute_error(c_y, c_p)), 4),
                    "RMSE": round(float(root_mean_squared_error(c_y, c_p)), 4),
                    "Crop_SSE": round(float(c_sse), 2),
                    "Pct_Contribution_to_Total_SSE": round(float(c_contrib), 4)
                })

    df_res_sum = pd.DataFrame(residual_summary_rows)
    res_sum_path = os.path.join(REPORTS_DIR, "phase_3b_1_2_residual_summary.csv")
    df_res_sum.to_csv(res_sum_path, index=False)

    df_top_err = pd.DataFrame(top_errors_rows)
    top_err_path = os.path.join(REPORTS_DIR, "phase_3b_1_2_top_errors.csv")
    df_top_err.to_csv(top_err_path, index=False)

    df_crop_sse = pd.DataFrame(per_crop_sse_rows)
    crop_sse_path = os.path.join(REPORTS_DIR, "phase_3b_1_2_per_crop_residual_diagnostics.csv")
    df_crop_sse.to_csv(crop_sse_path, index=False)

    print(f"  ✅ Saved residual summary CSV: {res_sum_path}")
    print(f"  ✅ Saved top errors CSV: {top_err_path}")
    print(f"  ✅ Saved per-crop SSE diagnostics CSV: {crop_sse_path}")

    # 4. Per-Crop Comparison for 30 Common Prime Crops on Identical Rows
    print("\n  Evaluating 30 Common Prime Crops on identical validation rows (13,422 rows)...")
    common_prime_crops = sorted(df_a["Crop"].unique())
    # Subslice Exp B strictly on the identical 13,422 rows
    df_b_prime_slice = df_b[df_b["raw_row_id"].isin(set(df_a["raw_row_id"]))].sort_values("raw_row_id")
    df_a_sorted = df_a.sort_values("raw_row_id")

    assert len(df_a_sorted) == len(df_b_prime_slice) == 13422, "Row count mismatch on common prime validation rows!"

    crop_comp_rows = []
    comp_dict = {}

    for c in common_prime_crops:
        sub_a = df_a_sorted[df_a_sorted["Crop"] == c]
        sub_b = df_b_prime_slice[df_b_prime_slice["Crop"] == c]
        n_val = len(sub_a)
        y_val_c = sub_a[TARGET_COL].values

        comp_dict[c] = {"n_val": n_val, "models": {}}

        for m in EVAL_MODELS:
            col = f"pred_{m}"
            if col not in sub_a.columns or col not in sub_b.columns:
                continue
            mae_a = float(mean_absolute_error(y_val_c, sub_a[col].values))
            mae_b = float(mean_absolute_error(y_val_c, sub_b[col].values))
            abs_diff = float(mae_b - mae_a)
            pct_change = float((abs_diff / mae_a) * 100) if mae_a > 1e-6 else 0.0

            comp_dict[c]["models"][m] = {
                "mae_exp_a": round(mae_a, 4),
                "mae_exp_b": round(mae_b, 4),
                "mae_abs_diff": round(abs_diff, 4),
                "mae_pct_change": round(pct_change, 2)
            }

            crop_comp_rows.append({
                "Crop": c,
                "Model": m,
                "Validation_Samples_Exp_A": n_val,
                "Validation_Samples_Exp_B": n_val,
                "MAE_Exp_A": round(mae_a, 4),
                "MAE_Exp_B": round(mae_b, 4),
                "MAE_Absolute_Diff_B_minus_A": round(abs_diff, 4),
                "MAE_Pct_Change": round(pct_change, 2)
            })

    df_crop_comp = pd.DataFrame(crop_comp_rows)
    crop_comp_path = os.path.join(REPORTS_DIR, "phase_3b_1_2_common_crops_comparison.csv")
    df_crop_comp.to_csv(crop_comp_path, index=False)
    results["cross_experiment_prime_comparison"] = comp_dict
    print(f"  ✅ Saved common prime crops comparison CSV: {crop_comp_path}")

    # 5. Specific Anomaly Checks
    # Anomaly 1: Tomato Error across models in Exp A vs Exp B
    sub_tom = df_crop_comp[df_crop_comp["Crop"] == "Tomato"]
    tom_dict = sub_tom[["Model", "MAE_Exp_A", "MAE_Exp_B", "MAE_Absolute_Diff_B_minus_A", "MAE_Pct_Change"]].to_dict(orient="records")

    # Anomaly 2: Papaya and Sugarcane SSE contribution
    sub_sse_a = df_crop_sse[df_crop_sse["Experiment"] == "experiment_a"]
    sse_dict = {}
    for m in EVAL_MODELS:
        sub_m = sub_sse_a[sub_sse_a["Model"] == m]
        sugar = sub_m[sub_m["Crop"] == "Sugarcane"]["Pct_Contribution_to_Total_SSE"].values
        papaya = sub_m[sub_m["Crop"] == "Papaya"]["Pct_Contribution_to_Total_SSE"].values
        banana = sub_m[sub_m["Crop"] == "Banana"]["Pct_Contribution_to_Total_SSE"].values
        sse_dict[m] = {
            "sugarcane_sse_pct": round(float(sugar[0]), 2) if len(sugar) else 0.0,
            "papaya_sse_pct": round(float(papaya[0]), 2) if len(papaya) else 0.0,
            "banana_sse_pct": round(float(banana[0]), 2) if len(banana) else 0.0,
            "combined_three_crops_sse_pct": round(float((sugar[0] if len(sugar) else 0.0) +
                                                        (papaya[0] if len(papaya) else 0.0) +
                                                        (banana[0] if len(banana) else 0.0)), 2)
        }

    # Anomaly 3: Low-Frequency Crops (<250 validation rows)
    crop_counts_a = df_a["Crop"].value_counts()
    low_freq_crops_a = sorted(crop_counts_a[crop_counts_a < 250].index.tolist())
    df_low_a = df_a[df_a["Crop"].isin(low_freq_crops_a)]
    low_metrics_a = {}
    for m in EVAL_MODELS:
        col = f"pred_{m}"
        if col in df_low_a.columns:
            low_metrics_a[m] = compute_standard_metrics(df_low_a[TARGET_COL].values, df_low_a[col].values)

    results["anomaly_investigations"] = {
        "tomato_encoding_stability": tom_dict,
        "sugarcane_papaya_sse_contributions": sse_dict,
        "low_frequency_crops_performance": {
            "exp_a_low_crops_count": len(low_freq_crops_a),
            "exp_a_low_total_samples": len(df_low_a),
            "exp_a_low_crops_list": low_freq_crops_a,
            "pooled_metrics": low_metrics_a
        }
    }

    # Save metrics JSON
    metrics_json_path = os.path.join(REPORTS_DIR, "phase_3b_1_2_metrics.json")
    with open(metrics_json_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"  ✅ Saved Phase 3B.1.2 metrics JSON: {metrics_json_path}")
    print("\n🎉 Phase 3B.1.2 Independent Evaluation Complete!")


if __name__ == "__main__":
    run_evaluation()
