"""
FieldWise ML Pipeline — Exploratory Bivariate Correlation & Cultivated Area Analysis (Phase 3A.5)
Performs:
1. Mathematical coupling analysis between Cultivated_Area_Ha and derived target Yield = Production / Area.
2. Scale disparity analysis: Farm plot size (0.5 - 20 ha) vs. District aggregate area (1 - 8.5M ha).
3. Exploratory bivariate Pearson and Spearman correlation analysis across crops (e.g. Wheat r=+0.604, Potato r=+0.331).
4. Feature set definition: Baseline features (excluding Area) vs. Auxiliary/Experimental features.
5. Climatic feature distinction: Static 30-year district rainfall normals vs. high-resolution weather.

CRITICAL DISCLAIMER:
This is an exploratory correlation analysis only, NOT an empirical model comparison.
No machine learning models have been trained with or without Cultivated_Area_Ha.
Cultivated_Area_Ha is excluded from default baseline features because of mathematical coupling and scale disparity.
Production is excluded because it causes deterministic target leakage.
No claims regarding area-inclusive predictive performance are made.
"""

import os
import json
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")


def run_area_correlation_analysis():
    csv_path = os.path.join(PROCESSED_DIR, "cleaned_crop_yield.csv")
    assert os.path.exists(csv_path), f"Cleaned dataset missing: {csv_path}"

    df = pd.read_csv(csv_path)
    print(f"📊 Running Exploratory Bivariate Correlation & Area Analysis ({len(df):,} records)...")

    # 1. Macro-Level Area Distribution
    area_stats = {
        "count": int(len(df)),
        "mean_ha": round(float(df['Cultivated_Area_Ha'].mean()), 2),
        "std_ha": round(float(df['Cultivated_Area_Ha'].std()), 2),
        "min_ha": round(float(df['Cultivated_Area_Ha'].min()), 2),
        "p01_ha": round(float(df['Cultivated_Area_Ha'].quantile(0.01)), 2),
        "p05_ha": round(float(df['Cultivated_Area_Ha'].quantile(0.05)), 2),
        "p25_ha": round(float(df['Cultivated_Area_Ha'].quantile(0.25)), 2),
        "median_ha": round(float(df['Cultivated_Area_Ha'].median()), 2),
        "p75_ha": round(float(df['Cultivated_Area_Ha'].quantile(0.75)), 2),
        "p95_ha": round(float(df['Cultivated_Area_Ha'].quantile(0.95)), 2),
        "p99_ha": round(float(df['Cultivated_Area_Ha'].quantile(0.99)), 2),
        "max_ha": round(float(df['Cultivated_Area_Ha'].max()), 2)
    }

    # 2. Overall Correlations
    pearson_corr = float(df['Cultivated_Area_Ha'].corr(df['Yield_Tonnes_Per_Ha']))
    spearman_corr = float(df['Cultivated_Area_Ha'].corr(df['Yield_Tonnes_Per_Ha'], method='spearman'))
    log_area = np.log(df['Cultivated_Area_Ha'])
    log_yield = np.log(df['Yield_Tonnes_Per_Ha'])
    log_corr = float(log_area.corr(log_yield))

    # 3. Crop-Specific Correlation Patterns
    major_crops = [
        'Wheat', 'Rice', 'Maize', 'Sugarcane', 'Potato', 'Gram',
        'Groundnut', 'Soyabean', 'Bajra', 'Jowar', 'Onion', 'Arhar/Tur'
    ]
    crop_correlations = {}
    for c in major_crops:
        sub = df[df['Crop'] == c]
        if len(sub) > 100:
            crop_correlations[c] = {
                "records_count": int(len(sub)),
                "pearson_r": round(float(sub['Cultivated_Area_Ha'].corr(sub['Yield_Tonnes_Per_Ha'])), 4),
                "spearman_rho": round(float(sub['Cultivated_Area_Ha'].corr(sub['Yield_Tonnes_Per_Ha'], method='spearman')), 4),
                "median_area_ha": round(float(sub['Cultivated_Area_Ha'].median()), 1),
                "median_yield_t_ha": round(float(sub['Yield_Tonnes_Per_Ha'].median()), 3)
            }

    # 4. Mathematical Coupling & Scale Disparity Review
    review_summary = {
        "metadata": {
            "title": "Exploratory Bivariate Correlation & Cultivated Area Sensitivity Review",
            "pipeline_stage": "Phase 3A.5: Final Consistency and Training Readiness Audit",
            "analysis_type": "Exploratory Bivariate Correlation & Distribution Analysis (NO ML Models Trained)",
            "timestamp": pd.Timestamp.now().isoformat(),
            "methodological_disclaimer": (
                "IMPORTANT: This report presents exploratory correlation metrics and statistical distribution analysis only. "
                "No machine learning models have been trained with or without Cultivated_Area_Ha. "
                "Cultivated_Area_Ha is excluded from the default baseline feature set because of mathematical coupling "
                "(Yield = Production / Area) and district-level scale disparity. Production is excluded because it causes "
                "deterministic target leakage. No claims regarding area-inclusive predictive performance are made."
            )
        },
        "mathematical_coupling_analysis": {
            "target_derivation_equation": "Yield_Tonnes_Per_Ha = Production / Cultivated_Area_Ha",
            "coupling_risk": (
                "Because Cultivated_Area_Ha is the explicit denominator in the target calculation, "
                "including it as an input feature introduces direct mathematical coupling. Any reporting "
                "irregularity or measurement noise in Area directly influences both the predictor X and "
                "target Y simultaneously, creating an artificial inverse artifact in small areas."
            ),
            "log_transform_perspective": "log(Yield) = log(Production) - log(Area). Giving log(Area) to a regression model allows it to act as an unconstrained coefficient offset rather than capturing biological yield factors."
        },
        "scale_disparity_analysis": {
            "training_data_scale": "District-level administrative aggregate acreage (median: 620 ha, mean: 12,031 ha, max: 8.58M ha)",
            "inference_application_scale": "Farmer-level private parcel size entered in FieldWise frontend (0.4 ha to 20 ha; median 1.01 ha / 2.5 acres)",
            "extrapolation_risk": (
                "In historical data, small district area (< 10 ha) indicates marginal, non-adapted crops with depressed yields "
                "(e.g., 5 ha of non-adapted wheat in Kerala), while large area (> 100,000 ha) indicates prime commercial belts "
                "(e.g., Ludhiana wheat). A model trained with Area will learn a strong spurious positive relationship for staple crops "
                "(Wheat r=+0.604, Potato r=+0.331). At inference time, when an individual farmer in Ludhiana inputs their 1 ha farm size, "
                "the model evaluates in the lowest 2% of the training area distribution and erroneously predicts severe yield penalty."
            )
        },
        "empirical_correlation_metrics": {
            "overall_pearson_r": round(pearson_corr, 4),
            "overall_spearman_rho": round(spearman_corr, 4),
            "overall_log_log_r": round(log_corr, 4),
            "major_crop_correlations": crop_correlations
        },
        "feature_set_specification": {
            "baseline_features_default": [
                "State", "District", "Crop_Year", "Season", "Crop",
                "district_normal_annual_rainfall_mm", "district_normal_monsoon_rainfall_mm"
            ],
            "baseline_rationale": "Captures agro-climatic zone, geography, seasonal weather regime, crop identity, and temporal technology trend without administrative area artifacts.",
            "target_variable": "Yield_Tonnes_Per_Ha (Pure mass basis)",
            "strictly_excluded_leakage_features": [
                "Production (Causes exact deterministic leakage Y = P / A)"
            ],
            "experimental_sensitivity_features": [
                "Cultivated_Area_Ha (Preserved in CSV strictly as an auxiliary column; excluded from baseline models; reserved for separate sensitivity experiments)"
            ]
        },
        "climatic_feature_distinction": {
            "district_normal_rainfall_source": "IMD 30-year normal climatological baseline (1951-2000 / 1971-2000)",
            "distinction_note": (
                "District normal rainfall reflects long-term climatological water availability for the administrative territory, "
                "not the actual high-resolution in-season daily precipitation experienced during the specific crop phenology. "
                "It serves as a macro-climatic agro-ecological feature, not a real-time weather observation."
            )
        }
    }

    # Save to both file names for backward compatibility and semantic clarity
    out_path1 = os.path.join(REPORTS_DIR, "exploratory_area_correlation_analysis.json")
    out_path2 = os.path.join(REPORTS_DIR, "feature_leakage_and_sensitivity_review.json")

    with open(out_path1, "w") as f:
        json.dump(review_summary, f, indent=2)
    with open(out_path2, "w") as f:
        json.dump(review_summary, f, indent=2)

    print(f"✅ Correlation analysis complete! Reports saved to:\n   - {out_path1}\n   - {out_path2}")
    return review_summary


if __name__ == "__main__":
    run_area_correlation_analysis()
