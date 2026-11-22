"""
FieldWise ML Pipeline — Phase 3C.2: Seven-Class Crop Recommendation ML Benchmark
Script: evaluate_crop_recommendation_benchmark.py

Objective:
  Evaluates all candidate models on the validation set, inspects probability calibration,
  and evaluates the frozen selected model on the sealed test set ONCE.
  Generates all benchmark reports, confusion matrices, calibration curves, and checksums.

Strict Boundaries:
  - Models were selected based on validation metrics before test evaluation.
  - Test set evaluated exactly once with frozen weights.
  - Zero application code modification.
"""

import os
import sys
import json
import hashlib
import joblib
import numpy as np
import pandas as pd

# Set headless matplotlib configuration
os.environ["MPLCONFIGDIR"] = "/tmp/matplotlib"
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, log_loss
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)  # model/ml_pipeline
DATA_RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
DATA_PROC_REC_DIR = os.path.join(BASE_DIR, "data", "processed", "recommendation")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
MODELS_DIR = os.path.join(BASE_DIR, "models", "benchmark")
CM_DIR = os.path.join(REPORTS_DIR, "phase_3c_2_confusion_matrices")
CALIB_DIR = os.path.join(REPORTS_DIR, "phase_3c_2_calibration")

os.makedirs(CM_DIR, exist_ok=True)
os.makedirs(CALIB_DIR, exist_ok=True)

RAW_CSV_PATH = os.path.join(DATA_RAW_DIR, "kaggle_crop_recommendation_benchmark.csv")
MANIFEST_PATH = os.path.join(DATA_PROC_REC_DIR, "phase_3c_2_split_manifest.csv")
TRAINING_SUMMARY_PATH = os.path.join(REPORTS_DIR, "phase_3c_2_training_summary.json")

TARGET_CLASSES = sorted(["rice", "maize", "cotton", "chickpea", "lentil", "banana", "mango"])
FEATURE_COLS = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
LABEL_COL = "label"


def compute_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def multiclass_brier_score(y_true, y_prob, labels):
    y_true_onehot = pd.get_dummies(pd.Categorical(y_true, categories=labels)).values
    return float(np.mean(np.sum((y_prob - y_true_onehot) ** 2, axis=1)))


def compute_calibration_data(y_true, y_prob, labels, n_bins=10):
    confidences = np.max(y_prob, axis=1)
    predictions = [labels[idx] for idx in np.argmax(y_prob, axis=1)]
    accuracies = (np.array(predictions) == np.array(y_true)).astype(float)

    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    bin_records = []

    for i in range(n_bins):
        b_low, b_high = bin_edges[i], bin_edges[i + 1]
        if i == 0:
            bin_mask = (confidences >= b_low) & (confidences <= b_high)
        else:
            bin_mask = (confidences > b_low) & (confidences <= b_high)

        n_bin = int(np.sum(bin_mask))
        if n_bin > 0:
            bin_acc = float(np.mean(accuracies[bin_mask]))
            bin_conf = float(np.mean(confidences[bin_mask]))
            ece += (n_bin / len(y_true)) * abs(bin_acc - bin_conf)
        else:
            bin_acc = 0.0
            bin_conf = float((b_low + b_high) / 2.0)

        bin_records.append({
            "bin_index": i + 1,
            "bin_lower": float(b_low),
            "bin_upper": float(b_high),
            "bin_center": float((b_low + b_high) / 2.0),
            "count": n_bin,
            "accuracy": bin_acc,
            "mean_confidence": bin_conf
        })

    return float(ece), bin_records


def plot_confusion_matrix(cm, labels, title, save_path):
    fig, ax = plt.subplots(figsize=(7, 6))
    im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)
    
    ax.set(
        xticks=np.arange(len(labels)),
        yticks=np.arange(len(labels)),
        xticklabels=labels,
        yticklabels=labels,
        title=title,
        ylabel="True Label",
        xlabel="Predicted Label"
    )
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")

    thresh = cm.max() / 2.0
    for i in range(len(labels)):
        for j in range(len(labels)):
            ax.text(j, i, format(cm[i, j], "d"),
                    ha="center", va="center",
                    color="white" if cm[i, j] > thresh else "black")
    fig.tight_layout()
    fig.savefig(save_path, dpi=150)
    plt.close(fig)


def plot_reliability_diagram(bin_records, ece, title, save_path):
    df_bins = pd.DataFrame(bin_records)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot([0, 1], [0, 1], "k--", label="Perfect Calibration")
    
    non_empty = df_bins[df_bins["count"] > 0]
    ax.plot(non_empty["mean_confidence"], non_empty["accuracy"], "s-", color="navy", label=f"Model (ECE={ece:.4f})")
    ax.bar(df_bins["bin_center"], df_bins["accuracy"], width=0.08, alpha=0.2, color="blue", label="Bin Accuracy")
    
    ax.set_xlim([0.0, 1.05])
    ax.set_ylim([0.0, 1.05])
    ax.set_xlabel("Mean Predicted Confidence")
    ax.set_ylabel("Empirical Accuracy")
    ax.set_title(title)
    ax.legend(loc="lower right")
    ax.grid(True, linestyle=":", alpha=0.6)
    
    fig.tight_layout()
    fig.savefig(save_path, dpi=150)
    plt.close(fig)


def run_benchmark_evaluation():
    print("===================================================================")
    print("FieldWise Phase 3C.2: Crop Recommendation Benchmark Evaluation")
    print("Validation Comparison, Calibration Diagnostics & Frozen Test Run")
    print("===================================================================")

    # 1. Load Data & Manifest
    assert os.path.exists(RAW_CSV_PATH), f"Raw dataset missing: {RAW_CSV_PATH}"
    assert os.path.exists(MANIFEST_PATH), f"Manifest missing: {MANIFEST_PATH}"
    assert os.path.exists(TRAINING_SUMMARY_PATH), f"Training summary missing: {TRAINING_SUMMARY_PATH}"

    df_raw = pd.read_csv(RAW_CSV_PATH)
    manifest = pd.read_csv(MANIFEST_PATH)
    with open(TRAINING_SUMMARY_PATH, "r", encoding="utf-8") as f:
        training_summary = json.load(f)

    selected_model_key = training_summary["selected_model"]["key"]
    print(f"Loaded Split Manifest: {len(manifest)} rows")
    print(f"Frozen Selected Model: {selected_model_key} ({training_summary['selected_model']['display_name']})")

    # Reconstruct exact partitions
    df7 = df_raw.iloc[manifest["raw_row_index"]].copy().reset_index(drop=True)
    df7["split_partition"] = manifest["split_partition"].values

    train_mask = df7["split_partition"] == "train"
    val_mask = df7["split_partition"] == "validation"
    test_mask = df7["split_partition"] == "test"

    X_val = df7.loc[val_mask, FEATURE_COLS]
    y_val = df7.loc[val_mask, LABEL_COL].values
    X_test = df7.loc[test_mask, FEATURE_COLS]
    y_test = df7.loc[test_mask, LABEL_COL].values

    assert len(X_val) == 105, f"Validation size {len(X_val)} != 105"
    assert len(X_test) == 105, f"Test size {len(X_test)} != 105"

    # 2. Candidate Models Evaluation on Validation Set
    model_keys = ["DummyClassifier", "LogisticRegression", "RandomForest", "ExtraTrees", "GradientBoosting"]
    val_detailed_results = {}
    per_class_records = []

    print("\n--- Validation Set Evaluation (105 Rows) ---")

    for key in model_keys:
        model_path = os.path.join(MODELS_DIR, f"{key}.joblib")
        assert os.path.exists(model_path), f"Model artifact not found: {model_path}"
        model = joblib.load(model_path)

        y_pred = model.predict(X_val)
        y_prob = model.predict_proba(X_val)

        # Assert finite predictions and valid probabilities
        assert len(y_pred) == 105
        assert y_prob.shape == (105, 7)
        assert np.all(np.isfinite(y_prob))
        assert np.all(np.isclose(np.sum(y_prob, axis=1), 1.0, atol=1e-5))

        acc = float(accuracy_score(y_val, y_pred))
        macro_p = float(precision_score(y_val, y_pred, average="macro", zero_division=0))
        macro_r = float(recall_score(y_val, y_pred, average="macro", zero_division=0))
        macro_f1 = float(f1_score(y_val, y_pred, average="macro", zero_division=0))
        weighted_f1 = float(f1_score(y_val, y_pred, average="weighted", zero_division=0))
        ll = float(log_loss(y_val, y_prob, labels=TARGET_CLASSES))
        brier = float(multiclass_brier_score(y_val, y_prob, TARGET_CLASSES))
        ece, calib_bins = compute_calibration_data(y_val, y_prob, TARGET_CLASSES, n_bins=10)

        # Confusion Matrix
        cm = confusion_matrix(y_val, y_pred, labels=TARGET_CLASSES)
        cm_df = pd.DataFrame(cm, index=TARGET_CLASSES, columns=TARGET_CLASSES)
        cm_csv_path = os.path.join(CM_DIR, f"val_{key}_confusion_matrix.csv")
        cm_png_path = os.path.join(CM_DIR, f"val_{key}_confusion_matrix.png")
        cm_df.to_csv(cm_csv_path)
        plot_confusion_matrix(cm, TARGET_CLASSES, f"Validation Confusion Matrix: {key}", cm_png_path)

        # Calibration Curves
        calib_csv_path = os.path.join(CALIB_DIR, f"val_{key}_calibration.csv")
        calib_png_path = os.path.join(CALIB_DIR, f"val_{key}_calibration.png")
        pd.DataFrame(calib_bins).to_csv(calib_csv_path, index=False)
        plot_reliability_diagram(calib_bins, ece, f"Validation Reliability Diagram: {key}", calib_png_path)

        # Per-class metrics
        clf_rep = classification_report(y_val, y_pred, labels=TARGET_CLASSES, output_dict=True, zero_division=0)
        for c in TARGET_CLASSES:
            per_class_records.append({
                "model_key": key,
                "evaluation_split": "validation",
                "crop_label": c,
                "precision": float(clf_rep[c]["precision"]),
                "recall": float(clf_rep[c]["recall"]),
                "f1_score": float(clf_rep[c]["f1-score"]),
                "support": int(clf_rep[c]["support"])
            })

        val_detailed_results[key] = {
            "accuracy": acc,
            "macro_precision": macro_p,
            "macro_recall": macro_r,
            "macro_f1": macro_f1,
            "weighted_f1": weighted_f1,
            "multiclass_log_loss": ll,
            "multiclass_brier_score": brier,
            "expected_calibration_error_10bin": ece,
            "confusion_matrix_csv": cm_csv_path,
            "calibration_csv": calib_csv_path
        }

        print(f"  {key:20s} | Acc: {acc:.4f} | Macro-F1: {macro_f1:.4f} | LogLoss: {ll:.4f} | Brier: {brier:.4f} | ECE: {ece:.4f}")

    # 3. One-Time Evaluation of Frozen Selected Model on Test Set
    print("\n--- ONE-TIME EVALUATION OF FROZEN SELECTED MODEL ON TEST SET (105 Rows) ---")
    selected_model_path = os.path.join(MODELS_DIR, f"{selected_model_key}.joblib")
    selected_model = joblib.load(selected_model_path)

    y_test_pred = selected_model.predict(X_test)
    y_test_prob = selected_model.predict_proba(X_test)

    # Test Quality Assertions
    assert len(y_test_pred) == 105, f"Test prediction count {len(y_test_pred)} != 105"
    assert y_test_prob.shape == (105, 7), f"Test probability shape {y_test_prob.shape} != (105, 7)"
    assert np.all(np.isfinite(y_test_prob)), "Non-finite test probabilities found"
    assert np.all(np.isclose(np.sum(y_test_prob, axis=1), 1.0, atol=1e-5)), "Test probabilities do not sum to 1"

    test_acc = float(accuracy_score(y_test, y_test_pred))
    test_macro_p = float(precision_score(y_test, y_test_pred, average="macro", zero_division=0))
    test_macro_r = float(recall_score(y_test, y_test_pred, average="macro", zero_division=0))
    test_macro_f1 = float(f1_score(y_test, y_test_pred, average="macro", zero_division=0))
    test_weighted_f1 = float(f1_score(y_test, y_test_pred, average="weighted", zero_division=0))
    test_ll = float(log_loss(y_test, y_test_prob, labels=TARGET_CLASSES))
    test_brier = float(multiclass_brier_score(y_test, y_test_prob, TARGET_CLASSES))
    test_ece, test_calib_bins = compute_calibration_data(y_test, y_test_prob, TARGET_CLASSES, n_bins=10)

    # Test Confusion Matrix
    test_cm = confusion_matrix(y_test, y_test_pred, labels=TARGET_CLASSES)
    test_cm_df = pd.DataFrame(test_cm, index=TARGET_CLASSES, columns=TARGET_CLASSES)
    test_cm_csv_path = os.path.join(CM_DIR, f"test_selected_{selected_model_key}_confusion_matrix.csv")
    test_cm_png_path = os.path.join(CM_DIR, f"test_selected_{selected_model_key}_confusion_matrix.png")
    test_cm_df.to_csv(test_cm_csv_path)
    plot_confusion_matrix(test_cm, TARGET_CLASSES, f"Test Confusion Matrix: {selected_model_key}", test_cm_png_path)

    # Test Calibration Curves
    test_calib_csv_path = os.path.join(CALIB_DIR, f"test_selected_{selected_model_key}_calibration.csv")
    test_calib_png_path = os.path.join(CALIB_DIR, f"test_selected_{selected_model_key}_calibration.png")
    pd.DataFrame(test_calib_bins).to_csv(test_calib_csv_path, index=False)
    plot_reliability_diagram(test_calib_bins, test_ece, f"Test Reliability Diagram: {selected_model_key}", test_calib_png_path)

    # Test Per-Class Metrics
    test_clf_rep = classification_report(y_test, y_test_pred, labels=TARGET_CLASSES, output_dict=True, zero_division=0)
    for c in TARGET_CLASSES:
        per_class_records.append({
            "model_key": selected_model_key,
            "evaluation_split": "test",
            "crop_label": c,
            "precision": float(test_clf_rep[c]["precision"]),
            "recall": float(test_clf_rep[c]["recall"]),
            "f1_score": float(test_clf_rep[c]["f1-score"]),
            "support": int(test_clf_rep[c]["support"])
        })

    test_results = {
        "selected_model_key": selected_model_key,
        "test_rows": len(X_test),
        "accuracy": test_acc,
        "macro_precision": test_macro_p,
        "macro_recall": test_macro_r,
        "macro_f1": test_macro_f1,
        "weighted_f1": test_weighted_f1,
        "multiclass_log_loss": test_ll,
        "multiclass_brier_score": test_brier,
        "expected_calibration_error_10bin": test_ece,
        "confusion_matrix_csv": test_cm_csv_path,
        "calibration_csv": test_calib_csv_path
    }

    print(f"  Test Accuracy:        {test_acc:.4f}")
    print(f"  Test Macro-F1:        {test_macro_f1:.4f}")
    print(f"  Test Multiclass LL:   {test_ll:.6f}")
    print(f"  Test Brier Score:     {test_brier:.6f}")
    print(f"  Test ECE (10 bins):   {test_ece:.6f}")

    # 4. Save Artifacts
    # A. Per-Class Metrics CSV
    per_class_df = pd.DataFrame(per_class_records)
    per_class_csv_path = os.path.join(REPORTS_DIR, "phase_3c_2_per_class_metrics.csv")
    per_class_df.to_csv(per_class_csv_path, index=False)
    print(f"\n  [Artifact] Saved per-class metrics to: {per_class_csv_path}")

    # B. Complete Metrics JSON
    final_metrics_payload = {
        "metadata": {
            "phase": "Phase 3C.2: Seven-Class Crop Recommendation ML Benchmark",
            "timestamp": "2026-11-19T13:02:00Z",
            "dataset_input_sha256": compute_sha256(RAW_CSV_PATH),
            "manifest_sha256": compute_sha256(MANIFEST_PATH),
            "target_classes": TARGET_CLASSES,
            "features": FEATURE_COLS,
            "split_distribution": {"train": 490, "validation": 105, "test": 105, "total": 700}
        },
        "validation_model_comparison": val_detailed_results,
        "selected_model_frozen": training_summary["selected_model"],
        "one_time_test_evaluation": test_results,
        "scientific_disclaimer": (
            "This experiment reflects benchmark accuracy within a synthetically generated "
            "7-crop subset and does NOT establish real-world agricultural suitability, "
            "farm-level accuracy, or production readiness."
        )
    }

    metrics_json_path = os.path.join(REPORTS_DIR, "phase_3c_2_metrics.json")
    with open(metrics_json_path, "w", encoding="utf-8") as f:
        json.dump(final_metrics_payload, f, indent=2)
    print(f"  [Artifact] Saved complete metrics JSON to: {metrics_json_path}")

    # C. Checksums Manifest Generation
    report_path = os.path.join(REPORTS_DIR, "phase_3c_2_benchmark_report.md")
    artifacts_to_checksum = [
        RAW_CSV_PATH,
        MANIFEST_PATH,
        TRAINING_SUMMARY_PATH,
        metrics_json_path,
        per_class_csv_path,
        test_cm_csv_path,
        test_calib_csv_path,
        report_path,
        os.path.join(MODELS_DIR, "DummyClassifier.joblib"),
        os.path.join(MODELS_DIR, "LogisticRegression.joblib"),
        os.path.join(MODELS_DIR, "RandomForest.joblib"),
        os.path.join(MODELS_DIR, "ExtraTrees.joblib"),
        os.path.join(MODELS_DIR, "GradientBoosting.joblib"),
    ]

    checksums_txt_path = os.path.join(REPORTS_DIR, "phase_3c_2_checksums.txt")
    with open(checksums_txt_path, "w", encoding="utf-8") as f:
        for p in artifacts_to_checksum:
            if os.path.exists(p):
                rel_p = os.path.relpath(p, BASE_DIR)
                sha = compute_sha256(p)
                f.write(f"{sha}  {rel_p}\n")

    print(f"  [Artifact] Saved checksums manifest to: {checksums_txt_path}")
    print("\n===================================================================")
    print("EVALUATION ENGINE EXECUTION COMPLETED SUCCESSFULLY (EXIT CODE 0)")
    print("===================================================================")
    return True


if __name__ == "__main__":
    run_benchmark_evaluation()
