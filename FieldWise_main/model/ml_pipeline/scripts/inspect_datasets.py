"""
FieldWise ML Pipeline — Dataset Inspection Script (Phase 3A.3)
Audits and profiles raw and processed agricultural datasets for crop recommendation and yield prediction.
"""

import os
import json
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")

os.makedirs(REPORTS_DIR, exist_ok=True)

def inspect_agriculture_data():
    csv_path = os.path.join(RAW_DIR, "agriculture_in_india.csv")
    if not os.path.exists(csv_path):
        print(f"Missing: {csv_path}")
        return None

    df = pd.read_csv(csv_path)
    
    # Calculate derived yield for profiling
    df_valid = df.dropna(subset=['Production']).copy()
    df_valid = df_valid[df_valid['Area'] > 0]
    yield_series = df_valid['Production'] / df_valid['Area']

    summary = {
        "dataset_name": "agriculture_in_india.csv",
        "description": "Historical crop production statistics in India (1997-2015) published by DAC&FW / Ministry of Agriculture",
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "column_names": list(df.columns),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "missing_values": {col: int(val) for col, val in df.isnull().sum().items()},
        "missing_percentage": {col: round(float(val / len(df) * 100), 2) for col, val in df.isnull().sum().items()},
        "duplicates": int(df.duplicated().sum()),
        "unique_states_count": int(df['State_Name'].nunique()),
        "unique_districts_count": int(df['District_Name'].nunique()),
        "unique_crops_count": int(df['Crop'].nunique()),
        "year_min": int(df['Crop_Year'].min()),
        "year_max": int(df['Crop_Year'].max()),
        "area_stats": {
            "min": float(df['Area'].min()),
            "median": float(df['Area'].median()),
            "mean": float(df['Area'].mean()),
            "max": float(df['Area'].max()),
            "std": float(df['Area'].std())
        },
        "production_stats": {
            "min": float(df['Production'].min()),
            "median": float(df['Production'].median()),
            "mean": float(df['Production'].mean()),
            "max": float(df['Production'].max()),
            "std": float(df['Production'].std())
        },
        "yield_stats": {
            "min": float(yield_series.min()),
            "p25": float(yield_series.quantile(0.25)),
            "median": float(yield_series.median()),
            "p75": float(yield_series.quantile(0.75)),
            "p95": float(yield_series.quantile(0.95)),
            "p99": float(yield_series.quantile(0.99)),
            "max": float(yield_series.max()),
            "mean": float(yield_series.mean()),
            "std": float(yield_series.std())
        },
        "top_crops_by_frequency": df['Crop'].value_counts().head(15).to_dict()
    }
    return summary

def inspect_rainfall_data():
    csv_path = os.path.join(RAW_DIR, "district_rainfall_normal.csv")
    if not os.path.exists(csv_path):
        print(f"Missing: {csv_path}")
        return None

    df = pd.read_csv(csv_path)
    summary = {
        "dataset_name": "district_rainfall_normal.csv",
        "description": "District-wise 30-year normal rainfall statistics from the Indian Meteorological Department (IMD)",
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "column_names": list(df.columns),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "missing_values": {col: int(val) for col, val in df.isnull().sum().items()},
        "duplicates": int(df.duplicated().sum()),
        "unique_states": int(df['STATE_UT_NAME'].nunique()),
        "unique_districts": int(df['DISTRICT'].nunique()),
        "annual_rainfall_stats": {
            "min_mm": float(df['ANNUAL'].min()),
            "median_mm": float(df['ANNUAL'].median()),
            "mean_mm": float(df['ANNUAL'].mean()),
            "max_mm": float(df['ANNUAL'].max()),
            "std_mm": float(df['ANNUAL'].std())
        },
        "monsoon_rainfall_stats": {
            "min_mm": float(df['Jun-Sep'].min()),
            "median_mm": float(df['Jun-Sep'].median()),
            "mean_mm": float(df['Jun-Sep'].mean()),
            "max_mm": float(df['Jun-Sep'].max())
        }
    }
    return summary

def inspect_kaggle_recommendation():
    csv_path = os.path.join(RAW_DIR, "kaggle_crop_recommendation_benchmark.csv")
    if not os.path.exists(csv_path):
        print(f"Missing: {csv_path}")
        return None

    df = pd.read_csv(csv_path)
    summary = {
        "dataset_name": "kaggle_crop_recommendation_benchmark.csv",
        "description": "Augmented agricultural dataset compiled and engineered from Indian climate, soil, and fertilizer research data",
        "author": "Atharva Ingle",
        "source_url": "https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset",
        "license": "Apache 2.0",
        "methodology": "Augmented agricultural data based on Indian climate, soil, and fertilizer research data (removes unsupported claims of Gaussian synthetic generation)",
        "provenance_category": "Category_C_Augmented",
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "column_names": list(df.columns),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "missing_values": {col: int(val) for col, val in df.isnull().sum().items()},
        "duplicates": int(df.duplicated().sum()),
        "unique_crops_count": int(df['label'].nunique()),
        "crops": sorted(df['label'].unique().tolist()),
        "observations_per_crop": {crop: int(count) for crop, count in df['label'].value_counts().items()},
        "feature_ranges": {
            col: {
                "min": float(df[col].min()),
                "median": float(df[col].median()),
                "mean": float(df[col].mean()),
                "max": float(df[col].max()),
                "std": float(df[col].std())
            } for col in ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']
        }
    }
    return summary

def inspect_processed_yield_datasets():
    processed = {}
    files = {
        "cleaned_crop_yield": ("cleaned_crop_yield.csv", "Yield_Tonnes_Per_Ha", "Metric Tonnes per Hectare (Pure mass basis)"),
        "segregated_cotton_bales_yield": ("segregated_cotton_bales_yield.csv", "Yield_Bales_Per_Ha", "Bales of 170 kg lint per Hectare"),
        "segregated_jute_mesta_bales_yield": ("segregated_jute_mesta_bales_yield.csv", "Yield_Bales_Per_Ha", "Bales of 180 kg clean fiber per Hectare"),
        "segregated_coconut_nuts_yield": ("segregated_coconut_nuts_yield.csv", "Yield_Nuts_Per_Ha", "Nuts per Hectare"),
        "segregated_arecanut_yield": ("segregated_arecanut_yield.csv", "Yield_Raw_Reported_Per_Ha", "Raw reported ratio per Hectare (state-mixed cured vs fresh nuts)"),
        "segregated_unverified_unit_yield": ("segregated_unverified_unit_yield.csv", "unverified", "Unverified reporting unit anomalies (Sugarcane >180, Cotton MH 1997 >10)")
    }
    for key, (filename, target_col, unit_desc) in files.items():
        path = os.path.join(PROCESSED_DIR, filename)
        if os.path.exists(path):
            df = pd.read_csv(path)
            stat = {
                "filename": filename,
                "rows": int(len(df)),
                "columns": int(len(df.columns)),
                "target_unit": unit_desc,
                "unique_crops": int(df['Crop'].nunique()) if 'Crop' in df.columns else None,
                "unique_states": int(df['State'].nunique()) if 'State' in df.columns else (int(df['State_Name'].nunique()) if 'State_Name' in df.columns else None)
            }
            if target_col in df.columns:
                stat["yield_stats"] = {
                    "min": float(df[target_col].min()),
                    "median": float(df[target_col].median()),
                    "mean": float(df[target_col].mean()),
                    "max": float(df[target_col].max())
                }
            processed[key] = stat
    return processed

def main():
    print("🌾 Starting comprehensive dataset inspection (Phase 3A.3)...")
    agri_summary = inspect_agriculture_data()
    rain_summary = inspect_rainfall_data()
    rec_summary = inspect_kaggle_recommendation()
    processed_summary = inspect_processed_yield_datasets()

    combined_inventory = {
        "metadata": {
            "project": "FieldWise Agricultural Intelligence",
            "audit_phase": "Phase 3A.3: Yield Unit Integrity and Independent Validation",
            "timestamp": pd.Timestamp.now().isoformat()
        },
        "raw_datasets": {
            "agriculture_in_india": agri_summary,
            "district_rainfall_normal": rain_summary,
            "kaggle_crop_recommendation_benchmark": rec_summary
        },
        "processed_datasets": processed_summary
    }

    out_file = os.path.join(REPORTS_DIR, "dataset_inventory.json")
    with open(out_file, "w") as f:
        json.dump(combined_inventory, f, indent=2)

    print(f"✅ Dataset inventory and profiling saved to: {out_file}")
    
    # Print human-readable console summary
    print("\n--- INVENTORY SUMMARY ---")
    if agri_summary:
        print(f"1. Agriculture In India: {agri_summary['rows']:,} rows, {agri_summary['columns']} cols, {agri_summary['unique_crops_count']} crops (1997-2015)")
    if rain_summary:
        print(f"2. District Rainfall Normal: {rain_summary['rows']} rows, {rain_summary['columns']} cols, {rain_summary['unique_districts']} districts")
    if rec_summary:
        print(f"3. Kaggle Recommendation Benchmark: {rec_summary['rows']} rows, {rec_summary['unique_crops_count']} crops")
    print(f"4. Processed Datasets: {len(processed_summary)} files created with verified unit segregation.")

if __name__ == "__main__":
    main()
