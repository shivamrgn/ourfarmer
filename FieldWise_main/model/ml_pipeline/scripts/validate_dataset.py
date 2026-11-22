"""
FieldWise ML Pipeline — Pre-Training Dataset Quality, Eligibility & Split Validator (Phase 3A.6)

PROGRAMMATIC DEPENDENCY & VALIDATION SCOPE DISCLOSURE:
1. The validator imports cleaning constants (BASELINE_FEATURE_COLUMNS, VERIFIED_CROP_SCREENING_THRESHOLDS_METADATA)
   from clean_yield_data.py to verify internal execution reproducibility and schema integrity.
   This programmatic verification confirms software implementation fidelity, but does not substitute
   for independent external agronomic verification of physical literature passages.
2. The zero-discrepancy rainfall check confirms numerical join fidelity against the provided
   district_rainfall_normal.csv table. It is distinct from evaluating whether the state/district
   alias dictionary resolves historical administrative bifurcations.
3. The 60 documented crops are explicitly partitioned into 30 verified source passage crops
   and 30 provisional agronomic estimate crops.
4. Multidimensional training eligibility and chronological split counts are computed dynamically
   directly from the processed dataset without hardcoded values.
"""

import os
import sys
import json
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")


def validate_crop_recommendation():
    csv_path = os.path.join(PROCESSED_DIR, "cleaned_crop_recommendation_benchmark.csv")
    assert os.path.exists(csv_path), f"Processed recommendation dataset missing: {csv_path}"
    
    df = pd.read_csv(csv_path)
    print(f"\n🔍 [1/4] Validating Crop Recommendation Benchmark ({len(df)} rows)...")
    
    # 1. Schema check
    expected_cols = {'n', 'p', 'k', 'temperature', 'humidity', 'ph', 'rainfall', 'label', 'provenance', 'data_category'}
    assert expected_cols.issubset(set(df.columns)), f"Missing expected columns in recommendation benchmark: {expected_cols - set(df.columns)}"
    
    # 2. Non-null assertion
    assert df.notnull().all().all(), "Unexpected null values in recommendation benchmark!"
    
    # 3. Provenance and Category Assertions
    assert (df['data_category'] == 'Category_C_Augmented').all(), "Invalid data category tag!"
    assert (df['provenance'] == 'augmented_agricultural_benchmark').all(), "Invalid provenance tag!"
    
    # 4. Physical / Agronomic range assertions
    assert (df['n'] >= 0).all() and (df['n'] <= 250).all(), "Nitrogen values out of physical bounds!"
    assert (df['p'] >= 0).all() and (df['p'] <= 250).all(), "Phosphorus values out of physical bounds!"
    assert (df['k'] >= 0).all() and (df['k'] <= 250).all(), "Potassium values out of physical bounds!"
    assert (df['temperature'] >= 0).all() and (df['temperature'] <= 60).all(), "Temperature values out of physical bounds!"
    assert (df['humidity'] >= 0).all() and (df['humidity'] <= 100).all(), "Humidity values out of physical bounds!"
    assert (df['ph'] >= 3.0).all() and (df['ph'] <= 10.0).all(), "Soil pH values out of physical bounds!"
    assert (df['rainfall'] >= 0).all() and (df['rainfall'] <= 1000).all(), "Rainfall values out of physical bounds!"
    
    # 5. Overlap verification with FieldWise canonical crops
    with open(os.path.join(REPORTS_DIR, "canonical_crop_taxonomy.json")) as f:
        taxonomy = json.load(f)
    fieldwise_crops = {c['crop_id'] for c in taxonomy}
    benchmark_crops = set(df['label'].unique())
    overlapping_crops = sorted(list(fieldwise_crops.intersection(benchmark_crops)))
    missing_staples = sorted(list(fieldwise_crops - benchmark_crops))
    
    assert len(overlapping_crops) == 7, f"Expected exactly 7 overlapping crops, found {len(overlapping_crops)}: {overlapping_crops}"
    assert len(missing_staples) == 12, f"Expected 12 missing FieldWise crops, found {len(missing_staples)}: {missing_staples}"
    
    print(f"  ✅ Schema and physical range constraints: PASS")
    print(f"  ✅ 0 Null values across all features: PASS")
    print(f"  ✅ Strict provenance tracking (Category_C_Augmented): PASS")
    print(f"  ✅ 7-crop overlap verified: {overlapping_crops}")
    print(f"  ✅ 12 missing FieldWise crops segregated: {missing_staples}")
    
    return {
        "dataset": "cleaned_crop_recommendation_benchmark.csv",
        "status": "PASSED",
        "rows": len(df),
        "columns": len(df.columns),
        "crops_count": df['label'].nunique(),
        "balanced_benchmark_flag": bool(df['label'].value_counts().nunique() == 1),
        "overlapping_crops_with_fieldwise": overlapping_crops,
        "missing_fieldwise_crops_count": len(missing_staples),
        "missing_fieldwise_crops": missing_staples,
        "validation_protocol_note": "Benchmark cross-validation accuracy (~99%) applies exclusively to this 22-class augmented dataset and must not be conflated with empirical real-world farm accuracy."
    }


def verify_row_by_row_yield_numerics(df_raw, df_clean, df_cotton, df_jm, df_coconut, df_arecanut, df_unverified, expected_sets):
    """
    Independently verifies every processed yield value against raw Production / Area calculations.
    Ensures exact set equality for every processed dataset, dynamic sugarcane conversion sets,
    and numerical accuracy within rounding tolerances (<= 0.001) for all datasets including unverified records.
    """
    print(f"\n🔍 [2/4] Independently Verifying Every Processed Yield Value (Row-by-Row & Set Equality)...")
    raw_map = df_raw.set_index('raw_row_id')

    # 1. Cleaned pure-tonne regression dataset (227,573 rows)
    assert df_clean['raw_row_id'].is_unique, "Duplicate raw_row_id detected in cleaned_crop_yield.csv!"
    assert set(df_clean['raw_row_id']) == expected_sets['expected_R6'], "Cleaned dataset row IDs do not match expected R6 set!"

    raw_clean_sub = raw_map.loc[df_clean['raw_row_id']]
    exp_clean_yield = raw_clean_sub['Production'].values / raw_clean_sub['Area'].values

    # Dynamically verify Sugarcane conversion subsets in cleaned data
    actual_pb_clean_ids = set(df_clean[(df_clean['Crop'] == 'Sugarcane') & (df_clean['State'].str.upper() == 'PUNJAB') & (df_clean['Crop_Year'] == 2011)]['raw_row_id'])
    actual_tn_clean_ids = set(df_clean[(df_clean['Crop'] == 'Sugarcane') & (df_clean['State'].str.upper() == 'TAMIL NADU') & (df_clean['Crop_Year'] == 1997)]['raw_row_id'])

    assert actual_pb_clean_ids == expected_sets['expected_pb_clean_ids'], "Punjab 2011 Sugarcane clean IDs do not match dynamically expected set!"
    assert actual_tn_clean_ids == expected_sets['expected_tn_clean_ids'], "Tamil Nadu 1997 Sugarcane clean IDs do not match dynamically expected set!"

    # Apply only documented record-specific sugarcane conversion rules
    punjab_2011_mask = raw_clean_sub.index.isin(expected_sets['expected_pb_clean_ids'])
    tn_1997_mask = raw_clean_sub.index.isin(expected_sets['expected_tn_clean_ids'])

    exp_clean_yield[punjab_2011_mask] = exp_clean_yield[punjab_2011_mask] / 1000.0
    exp_clean_yield[tn_1997_mask] = exp_clean_yield[tn_1997_mask] / 10.0

    act_clean_yield = df_clean['Yield_Tonnes_Per_Ha'].values
    clean_diff = np.abs(exp_clean_yield - act_clean_yield)
    max_clean_diff = float(np.max(clean_diff))

    # Tolerance justification: 3-decimal rounding produces maximum round-half-even difference of 0.0005.
    assert max_clean_diff <= 0.001, f"Cleaned yield mismatch exceeds 0.001 tolerance: {max_clean_diff}"
    print(f"  ✅ Cleaned Pure-Tonne Yield: Verified all {len(df_clean):,} rows & set equality (Max diff: {max_clean_diff:.8f} <= 0.001)")

    # 2. Segregated Cotton (Bales of 170 kg lint)
    assert df_cotton['raw_row_id'].is_unique, "Duplicate raw_row_id in segregated_cotton_bales_yield.csv!"
    assert set(df_cotton['raw_row_id']) == expected_sets['expected_cotton_clean'], "Cotton row IDs do not match expected clean set!"
    raw_cotton_sub = raw_map.loc[df_cotton['raw_row_id']]
    exp_cotton = raw_cotton_sub['Production'].values / raw_cotton_sub['Area'].values
    act_cotton = df_cotton['Yield_Bales_Per_Ha'].values
    max_cotton_diff = float(np.max(np.abs(exp_cotton - act_cotton)))
    assert max_cotton_diff <= 0.001, f"Cotton yield mismatch exceeds 0.001 tolerance: {max_cotton_diff}"
    print(f"  ✅ Segregated Cotton Bales: Verified all {len(df_cotton):,} rows & set equality (Max diff: {max_cotton_diff:.8f} <= 0.001)")

    # 3. Segregated Jute & Mesta (Bales of 180 kg fiber)
    assert df_jm['raw_row_id'].is_unique, "Duplicate raw_row_id in segregated_jute_mesta_bales_yield.csv!"
    assert set(df_jm['raw_row_id']) == expected_sets['expected_jm_clean'], "Jute/Mesta row IDs do not match expected clean set!"
    raw_jm_sub = raw_map.loc[df_jm['raw_row_id']]
    exp_jm = raw_jm_sub['Production'].values / raw_jm_sub['Area'].values
    act_jm = df_jm['Yield_Bales_Per_Ha'].values
    max_jm_diff = float(np.max(np.abs(exp_jm - act_jm)))
    assert max_jm_diff <= 0.001, f"Jute/Mesta yield mismatch exceeds 0.001 tolerance: {max_jm_diff}"
    print(f"  ✅ Segregated Jute/Mesta Bales: Verified all {len(df_jm):,} rows & set equality (Max diff: {max_jm_diff:.8f} <= 0.001)")

    # 4. Segregated Coconut (Nuts)
    assert df_coconut['raw_row_id'].is_unique, "Duplicate raw_row_id in segregated_coconut_nuts_yield.csv!"
    assert set(df_coconut['raw_row_id']) == expected_sets['expected_coconut'], "Coconut row IDs do not match expected coconut set!"
    raw_coco_sub = raw_map.loc[df_coconut['raw_row_id']]
    exp_coco = raw_coco_sub['Production'].values / raw_coco_sub['Area'].values
    act_coco = df_coconut['Yield_Nuts_Per_Ha'].values
    max_coco_diff = float(np.max(np.abs(exp_coco - act_coco)))
    assert max_coco_diff <= 0.01, f"Coconut yield mismatch exceeds 0.01 tolerance: {max_coco_diff}"
    print(f"  ✅ Segregated Coconut Nuts: Verified all {len(df_coconut):,} rows & set equality (Max diff: {max_coco_diff:.8f} <= 0.01)")

    # 5. Segregated Arecanut (State-Mixed Reporting Units)
    assert df_arecanut['raw_row_id'].is_unique, "Duplicate raw_row_id in segregated_arecanut_yield.csv!"
    assert set(df_arecanut['raw_row_id']) == expected_sets['expected_arecanut'], "Arecanut row IDs do not match expected arecanut set!"
    raw_arca_sub = raw_map.loc[df_arecanut['raw_row_id']]
    exp_arca = raw_arca_sub['Production'].values / raw_arca_sub['Area'].values
    act_arca = df_arecanut['Yield_Raw_Reported_Per_Ha'].values
    max_arca_diff = float(np.max(np.abs(exp_arca - act_arca)))
    assert max_arca_diff <= 0.001, f"Arecanut yield mismatch exceeds 0.001 tolerance: {max_arca_diff}"
    
    # Assert target column is strictly named Yield_Raw_Reported_Per_Ha and not mislabeled as tonnes/mass
    assert 'Yield_Raw_Reported_Per_Ha' in df_arecanut.columns, "Arecanut dataset missing Yield_Raw_Reported_Per_Ha!"
    assert 'Yield_Tonnes_Per_Ha' not in df_arecanut.columns, "Arecanut must NEVER be described as uniform metric tonnes!"
    print(f"  ✅ Segregated Arecanut: Verified all {len(df_arecanut):,} rows retain raw ratio & set equality (Max diff: {max_arca_diff:.8f} <= 0.001)")

    # 6. Segregated Unverified Unit Anomalies (Numeric & Set Verification)
    assert df_unverified['raw_row_id'].is_unique, "Duplicate raw_row_id in segregated_unverified_unit_yield.csv!"
    assert set(df_unverified['raw_row_id']) == expected_sets['expected_unverified'], "Unverified dataset row IDs do not match expected unverified set!"
    assert set(df_unverified[df_unverified['Crop'] == 'Sugarcane']['raw_row_id']) == expected_sets['expected_sugar_unverified'], "Unverified Sugarcane IDs mismatch!"
    assert set(df_unverified[df_unverified['Crop'] == 'Cotton(lint)']['raw_row_id']) == expected_sets['expected_cotton_unverified'], "Unverified Cotton IDs mismatch!"

    # Numerically verify unverified raw yield
    raw_unv_sub = raw_map.loc[df_unverified['raw_row_id']]
    exp_raw_unv = raw_unv_sub['Production'].values / raw_unv_sub['Area'].values
    act_raw_unv = df_unverified['raw_yield'].values
    max_unv_raw_diff = float(np.max(np.abs(exp_raw_unv - act_raw_unv)))
    assert max_unv_raw_diff <= 0.001, f"Unverified raw yield mismatch exceeds 0.001 tolerance: {max_unv_raw_diff}"

    # Numerically verify unverified corrected yield (Sugarcane TN 1997 converted by / 10.0; others raw)
    tn_unv_ids = set(df_raw[(df_raw['Crop'] == 'Sugarcane') & (df_raw['State_Name'].str.strip() == 'Tamil Nadu') & (df_raw['Crop_Year'] == 1997)]['raw_row_id'])
    exp_corr_unv = exp_raw_unv.copy()
    tn_unv_mask = df_unverified['raw_row_id'].isin(tn_unv_ids).values
    exp_corr_unv[tn_unv_mask] = exp_corr_unv[tn_unv_mask] / 10.0
    act_corr_unv = df_unverified['yield_corrected'].values
    max_unv_corr_diff = float(np.max(np.abs(exp_corr_unv - act_corr_unv)))
    assert max_unv_corr_diff <= 0.001, f"Unverified corrected yield mismatch exceeds 0.001 tolerance: {max_unv_corr_diff}"

    print(f"  ✅ Segregated Unverified Anomalies: Verified all {len(df_unverified)} records numerically & set equality (Max diff: {max_unv_raw_diff:.8f} <= 0.001)")

    return {
        "max_cleaned_yield_numerical_difference": max_clean_diff,
        "max_cotton_numerical_difference": max_cotton_diff,
        "max_jute_mesta_numerical_difference": max_jm_diff,
        "max_coconut_numerical_difference": max_coco_diff,
        "max_arecanut_numerical_difference": max_arca_diff,
        "max_unverified_numerical_difference": max_unv_raw_diff,
        "tolerance_used": "<= 0.001 for 3-decimal rounded targets (half-unit rounding bound: 0.0005)",
        "set_equality_all_datasets": "VERIFIED_EXACT_EQUALITY_ALL_6_DATASETS",
        "row_by_row_verification_status": "PASSED_ALL_DATASETS"
    }


def deep_validate_rainfall_join(df_clean, df_rain):
    """
    Independently validates the state/district join against raw rainfall source.
    Detects duplicate normalized source keys and asserts zero conflicting rainfall values.
    Asserts zero value discrepancy in matched records and compiles unmatched district inventory.
    """
    print(f"\n🔍 [3/4] Deeply Validating Rainfall Joins & Unmatched District Inventory...")
    
    with open(os.path.join(REPORTS_DIR, "state_district_mapping.json")) as f:
        mappings = json.load(f)
    state_aliases = mappings["state_aliases"]
    district_aliases = mappings["district_aliases"]

    df_rain_indep = df_rain.copy()
    df_rain_indep['State_Normalized'] = df_rain_indep['STATE_UT_NAME'].str.strip().str.upper().replace(state_aliases)
    df_rain_indep['District_Normalized'] = df_rain_indep['DISTRICT'].str.strip().str.upper().replace(district_aliases)
    
    # Pre-merge validation: detect duplicate normalized keys and conflicting rainfall values
    dup_rain = df_rain_indep[df_rain_indep.duplicated(subset=['State_Normalized', 'District_Normalized'], keep=False)]
    rain_val_cols = ['ANNUAL', 'Jun-Sep', 'Oct-Dec', 'Jan-Feb', 'Mar-May']
    if len(dup_rain) > 0:
        conflicts = dup_rain.groupby(['State_Normalized', 'District_Normalized'])[rain_val_cols].nunique().max(axis=1)
        conflicting_pairs = conflicts[conflicts > 1]
        assert len(conflicting_pairs) == 0, f"Conflicting rainfall values detected in duplicate normalized keys: {conflicting_pairs}"
        print(f"  ℹ️ Detected {len(dup_rain)} duplicate rainfall records, all with identical values (0 conflicting).")
    else:
        print("  ✅ Zero duplicate normalized rainfall keys detected in source.")

    # Create independent reference map
    rain_ref = df_rain_indep[['State_Normalized', 'District_Normalized', 'ANNUAL', 'Jun-Sep']].drop_duplicates(
        subset=['State_Normalized', 'District_Normalized']
    ).set_index(['State_Normalized', 'District_Normalized'])

    # 1. Matched Records Value Audit
    matched = df_clean[df_clean['district_normal_annual_rainfall_mm'].notnull()].copy()
    unmatched = df_clean[df_clean['district_normal_annual_rainfall_mm'].isnull()].copy()

    matched_count = len(matched)
    unmatched_count = len(unmatched)
    assert matched_count + unmatched_count == len(df_clean), "Rainfall matched + unmatched does not equal dataset size!"

    join_keys = list(zip(matched['State'], matched['District']))
    expected_annual = [rain_ref.loc[k, 'ANNUAL'] for k in join_keys]
    expected_monsoon = [rain_ref.loc[k, 'Jun-Sep'] for k in join_keys]

    diff_annual = np.abs(matched['district_normal_annual_rainfall_mm'].values - expected_annual)
    diff_monsoon = np.abs(matched['district_normal_monsoon_rainfall_mm'].values - expected_monsoon)

    max_diff_annual = float(np.max(diff_annual))
    max_diff_monsoon = float(np.max(diff_monsoon))

    assert max_diff_annual == 0.0, f"Annual rainfall value discrepancy in matched records: {max_diff_annual}"
    assert max_diff_monsoon == 0.0, f"Monsoon rainfall value discrepancy in matched records: {max_diff_monsoon}"
    print(f"  ✅ Rainfall Value Fidelity: Exactly 0.0 discrepancy across all {matched_count:,} matched records")

    # 2. Unmatched District Inventory & Root Cause Audit
    unmatched_pairs = unmatched.groupby(['State', 'District']).size().reset_index(name='crop_records_count')
    total_unmatched_pairs = len(unmatched_pairs)

    top_unmatched = unmatched_pairs.sort_values(by='crop_records_count', ascending=False).head(20).to_dict(orient='records')
    print(f"  ✅ Unmatched District Inventory: Analyzed {total_unmatched_pairs} unmatched State-District pairs ({unmatched_count:,} records)")

    return {
        "matched_records_count": matched_count,
        "unmatched_records_count": unmatched_count,
        "rainfall_match_rate_pct": round(matched_count / len(df_clean) * 100, 2),
        "rainfall_value_discrepancy_annual": max_diff_annual,
        "rainfall_value_discrepancy_monsoon": max_diff_monsoon,
        "source_duplicate_keys_count": len(dup_rain),
        "source_conflicting_keys_count": 0,
        "total_unmatched_state_district_pairs": total_unmatched_pairs,
        "top_unmatched_districts": top_unmatched,
        "unmatched_reasons_summary": {
            "state_bifurcation_telangana": "Telangana created in 2014; IMD 30-year normal table recorded these districts under Andhra Pradesh",
            "district_divisions": "Districts split after 2000 (e.g., Medinipur bifurcated into Paschim/Purba Medinipur; Bangalore into Rural/Urban; Bagalkot from Bijapur)",
            "spelling_nomenclature_variants": "Historic IMD spelling differences (e.g., Visakhapatanam vs Visakhapatnam, SPSR Nellore vs Nellore, Kadapa vs Cuddapah)"
        }
    }


def audit_multidimensional_eligibility_and_splits(df_clean, prov, excl_inv):
    """
    Computes multidimensional training eligibility cross-tabulation and validates
    chronological split counts directly from the actual data without hardcoding.
    """
    print("\n🔍 Auditing Multidimensional Training Eligibility & Chronological Splits...")
    
    verified_passages = {k for k, v in prov.items() if v.get('provenance_status') == 'verified_source_passage'}
    provisional_estimates = {k for k, v in prov.items() if v.get('provenance_status') == 'provisional_agronomic_estimate'}

    df = df_clean.copy()

    # Dimension 1: Threshold Provenance
    def get_prov(c):
        if c in verified_passages: return 'verified'
        if c in provisional_estimates: return 'provisional'
        return 'unmapped'
    df['prov_status'] = df['Crop'].map(get_prov)

    # Dimension 2: Rainfall Status
    df['rain_status'] = df['district_normal_annual_rainfall_mm'].notnull().map({True: 'matched', False: 'unmatched'})

    # Dimension 3: Yield Review
    def get_yield_rev(row):
        c = row['Crop']
        y = row['Yield_Tonnes_Per_Ha']
        if c in prov:
            T = prov[c]['screening_threshold']
            if y <= T: return '<= T'
            if y <= 2 * T: return 'T < yield <= 2T'
            return '> 2T'
        return 'unmapped_retained'
    df['yield_rev'] = df.apply(get_yield_rev, axis=1)

    # Dimension 4: Crop Identity
    df['crop_identity'] = df['Crop'].map(lambda c: excl_inv['all_crop_catalog'][c]['type'])

    # Dimension 5: Model Eligibility
    def get_eligibility(row):
        ident = row['crop_identity']
        p_st = row['prov_status']
        y_rev = row['yield_rev']
        rain = row['rain_status']

        if ident in ('macro_aggregate_total', 'composite_residual_category', 'ambiguous_product_basis'):
            return 'excluded'
        if p_st == 'verified' and y_rev == '<= T' and rain == 'matched':
            return 'eligible_prime'
        if p_st == 'provisional' and y_rev == '<= T' and rain == 'matched':
            return 'eligible_provisional'
        if y_rev == 'T < yield <= 2T' and rain == 'matched':
            return 'conditional_high_yield'
        if y_rev == '<= T' and rain == 'unmatched':
            return 'conditional_unmatched_rainfall'
        return 'conditional_other'
    df['model_eligibility'] = df.apply(get_eligibility, axis=1)

    # Cross-tabulation table
    multi_table = df.groupby(['prov_status', 'crop_identity', 'yield_rev', 'rain_status']).agg(
        record_count=('raw_row_id', 'count'),
        distinct_crops=('Crop', 'nunique')
    ).reset_index().to_dict(orient='records')

    # Summary by eligibility tier
    eligibility_summary = {}
    for el_tier, grp in df.groupby('model_eligibility'):
        eligibility_summary[el_tier] = {
            "record_count": int(len(grp)),
            "distinct_crops": int(grp['Crop'].nunique()),
            "share_pct": round(len(grp) / len(df) * 100, 2)
        }

    # Chronological Split Reconciliations
    # 1. Total Cleaned Dataset Splits
    train_total = df[df['Crop_Year'] <= 2011]
    val_total = df[df['Crop_Year'].isin([2012, 2013])]
    test_total = df[df['Crop_Year'].isin([2014, 2015])]

    assert len(train_total) + len(val_total) + len(test_total) == len(df), "Total dataset chronological splits do not sum to total records!"

    # 2. Eligible Dataset Splits (eligible_prime + eligible_provisional = 161,270 records)
    df_eligible = df[df['model_eligibility'].isin(['eligible_prime', 'eligible_provisional'])].copy()
    train_elig = df_eligible[df_eligible['Crop_Year'] <= 2011]
    val_elig = df_eligible[df_eligible['Crop_Year'].isin([2012, 2013])]
    test_elig = df_eligible[df_eligible['Crop_Year'].isin([2014, 2015])]

    assert len(train_elig) + len(val_elig) + len(test_elig) == len(df_eligible), "Eligible dataset chronological splits do not sum to eligible records!"

    # 3. Excluded Records Splits (13,819 records)
    df_excluded = df[df['model_eligibility'] == 'excluded'].copy()
    train_excl = df_excluded[df_excluded['Crop_Year'] <= 2011]
    val_excl = df_excluded[df_excluded['Crop_Year'].isin([2012, 2013])]
    test_excl = df_excluded[df_excluded['Crop_Year'].isin([2014, 2015])]

    assert len(train_excl) + len(val_excl) + len(test_excl) == len(df_excluded), "Excluded records chronological splits do not sum to excluded records!"

    print(f"  ✅ Multidimensional Eligibility Table: Generated across {len(multi_table)} cells (Total: {len(df):,} records)")
    print(f"  ✅ Chronological Split Reconciliation (Total Dataset):")
    print(f"     - Training (1997-2011): {len(train_total):,} records ({train_total['District'].nunique()} districts, {train_total['Crop'].nunique()} crops)")
    print(f"     - Validation (2012-2013): {len(val_total):,} records ({val_total['District'].nunique()} districts, {val_total['Crop'].nunique()} crops)")
    print(f"     - Test (2014-2015, Sealed): {len(test_total):,} records ({test_total['District'].nunique()} districts, {test_total['Crop'].nunique()} crops)")
    print(f"  ✅ Chronological Split Reconciliation (Eligible Subset):")
    print(f"     - Training (1997-2011): {len(train_elig):,} records")
    print(f"     - Validation (2012-2013): {len(val_elig):,} records")
    print(f"     - Test (2014-2015, Sealed): {len(test_elig):,} records")

    return {
        "multidimensional_eligibility_table": multi_table,
        "eligibility_summary": eligibility_summary,
        "chronological_splits_total": {
            "training_1997_2011": {
                "record_count": int(len(train_total)),
                "distinct_states": int(train_total['State'].nunique()),
                "distinct_districts": int(train_total['District'].nunique()),
                "distinct_crops": int(train_total['Crop'].nunique()),
                "share_pct": round(len(train_total) / len(df) * 100, 2)
            },
            "validation_2012_2013": {
                "record_count": int(len(val_total)),
                "distinct_states": int(val_total['State'].nunique()),
                "distinct_districts": int(val_total['District'].nunique()),
                "distinct_crops": int(val_total['Crop'].nunique()),
                "share_pct": round(len(val_total) / len(df) * 100, 2)
            },
            "test_2014_2015_sealed": {
                "record_count": int(len(test_total)),
                "distinct_states": int(test_total['State'].nunique()),
                "distinct_districts": int(test_total['District'].nunique()),
                "distinct_crops": int(test_total['Crop'].nunique()),
                "share_pct": round(len(test_total) / len(df) * 100, 2)
            },
            "exact_sum_assertion": "PASSED"
        },
        "chronological_splits_eligible": {
            "eligible_total_records": int(len(df_eligible)),
            "training_1997_2011": int(len(train_elig)),
            "validation_2012_2013": int(len(val_elig)),
            "test_2014_2015_sealed": int(len(test_elig)),
            "exact_sum_assertion": "PASSED"
        },
        "chronological_splits_excluded": {
            "excluded_total_records": int(len(df_excluded)),
            "training_1997_2011": int(len(train_excl)),
            "validation_2012_2013": int(len(val_excl)),
            "test_2014_2015_sealed": int(len(test_excl)),
            "exact_sum_assertion": "PASSED"
        }
    }


def validate_crop_yield_independently():
    """
    Independently loads raw historical dataset, reconstructs masks, derives dynamic row sets,
    validates crop-specific screening thresholds and high-yield observations (T < yield <= 2T),
    audits feature sets, and validates multidimensional training eligibility.
    """
    raw_crop_path = os.path.join(RAW_DIR, "agriculture_in_india.csv")
    rain_path = os.path.join(RAW_DIR, "district_rainfall_normal.csv")
    cleaned_yield_path = os.path.join(PROCESSED_DIR, "cleaned_crop_yield.csv")
    coconut_csv = os.path.join(PROCESSED_DIR, "segregated_coconut_nuts_yield.csv")
    cotton_csv = os.path.join(PROCESSED_DIR, "segregated_cotton_bales_yield.csv")
    jm_csv = os.path.join(PROCESSED_DIR, "segregated_jute_mesta_bales_yield.csv")
    arecanut_csv = os.path.join(PROCESSED_DIR, "segregated_arecanut_yield.csv")
    unverified_csv = os.path.join(PROCESSED_DIR, "segregated_unverified_unit_yield.csv")

    print(f"\n🔍 [4/4] Validating Crop-Specific Thresholds & Partition Mathematics...")
    df_raw = pd.read_csv(raw_crop_path)
    df_rain = pd.read_csv(rain_path)
    total_raw_rows = len(df_raw)
    df_raw['raw_row_id'] = np.arange(total_raw_rows)
    U = set(df_raw['raw_row_id'])

    # 1. Independent reconstruction of raw removal masks
    s_null_prod = set(df_raw[df_raw['Production'].isnull()]['raw_row_id'])
    s_nonpos_area = set(df_raw[df_raw['Area'] <= 0]['raw_row_id'])
    s_zero_prod = set(df_raw[(df_raw['Production'] <= 0) & (df_raw['Production'].notnull())]['raw_row_id'])

    valid_pos_raw = df_raw[df_raw['Production'].notnull() & (df_raw['Production'] > 0) & (df_raw['Area'] > 0)].copy()
    valid_pos_raw['raw_yield'] = valid_pos_raw['Production'] / valid_pos_raw['Area']
    s_neg_yield = set(valid_pos_raw[valid_pos_raw['raw_yield'] < 0.005]['raw_row_id'])

    # Non-tonne crop subsets in raw data
    s_coconut = set(df_raw[df_raw['Crop'] == 'Coconut']['raw_row_id'])
    s_cotton = set(df_raw[df_raw['Crop'] == 'Cotton(lint)']['raw_row_id'])
    s_jute_mesta = set(df_raw[df_raw['Crop'].isin(['Jute', 'Mesta', 'Jute & mesta'])]['raw_row_id'])
    s_arecanut = set(df_raw[df_raw['Crop'].isin(['Arecanut', 'Atcanut (Raw)', 'Arcanut (Processed)'])]['raw_row_id'])

    # 2. Dynamic sequential stage calculation
    R0 = U
    D1 = R0 & s_null_prod
    R1 = R0 - D1

    D2 = R1 & s_nonpos_area
    R2 = R1 - D2

    D3 = R2 & s_zero_prod
    R3 = R2 - D3

    D4 = R3 & s_neg_yield
    R4 = R3 - D4

    # 3. Dynamic segregation sets from R4
    D_coconut = R4 & s_coconut
    D_cotton = R4 & s_cotton
    D_jute_mesta = R4 & s_jute_mesta
    D_arecanut = R4 & s_arecanut

    # Cotton unverified: Maharashtra 1997 with yield > 10 bales/ha
    cotton_r4 = df_raw.loc[sorted(list(D_cotton))].copy()
    cotton_r4['yield'] = cotton_r4['Production'] / cotton_r4['Area']
    cotton_mh_1997_mask = (cotton_r4['State_Name'].str.strip() == 'Maharashtra') & (cotton_r4['Crop_Year'] == 1997) & (cotton_r4['yield'] > 10.0)
    s_cotton_unverified = set(cotton_r4[cotton_mh_1997_mask]['raw_row_id'])
    s_cotton_clean = D_cotton - s_cotton_unverified

    # Jute/Mesta extreme biological outlier (> 50 bales/ha)
    jm_r4 = df_raw.loc[sorted(list(D_jute_mesta))].copy()
    jm_r4['yield'] = jm_r4['Production'] / jm_r4['Area']
    s_jm_extreme = set(jm_r4[jm_r4['yield'] > 50.0]['raw_row_id'])
    s_jm_clean = D_jute_mesta - s_jm_extreme

    # 4. Pure Metric Tonne Universe (R5)
    R5 = R4 - D_coconut - D_cotton - D_jute_mesta - D_arecanut
    df_r5 = df_raw.loc[sorted(list(R5))].copy()
    df_r5['raw_yield'] = df_r5['Production'] / df_r5['Area']
    df_r5['yield_corrected'] = df_r5['raw_yield']

    # Sugarcane conversions
    punjab_2011_mask = (df_r5['Crop'] == 'Sugarcane') & (df_r5['State_Name'].str.strip() == 'Punjab') & (df_r5['Crop_Year'] == 2011)
    df_r5.loc[punjab_2011_mask, 'yield_corrected'] = df_r5.loc[punjab_2011_mask, 'raw_yield'] / 1000.0

    tn_1997_mask = (df_r5['Crop'] == 'Sugarcane') & (df_r5['State_Name'].str.strip() == 'Tamil Nadu') & (df_r5['Crop_Year'] == 1997)
    df_r5.loc[tn_1997_mask, 'yield_corrected'] = df_r5.loc[tn_1997_mask, 'raw_yield'] / 10.0

    # Sugarcane unverified > 180 t/ha
    s_sugar_unverified = set(df_r5[(df_r5['Crop'] == 'Sugarcane') & (df_r5['yield_corrected'] > 180.0)]['raw_row_id'])
    s_segregated_unverified = s_sugar_unverified | s_cotton_unverified

    # Extreme biological outliers for tonne crops with documented ceilings
    # NOTE: The validator imports cleaning constants from clean_yield_data.py to verify internal execution consistency
    from clean_yield_data import VERIFIED_CROP_SCREENING_THRESHOLDS_METADATA, VERIFIED_CROP_SCREENING_THRESHOLDS_TONNES_PER_HA
    df_r5_rem = df_r5[~df_r5['raw_row_id'].isin(s_sugar_unverified)].copy()
    df_r5_rem['ceiling'] = df_r5_rem['Crop'].map(VERIFIED_CROP_SCREENING_THRESHOLDS_TONNES_PER_HA)
    
    # Extreme outliers: yield > 2 * ceiling ONLY where ceiling is documented
    extreme_tonne_mask = (df_r5_rem['ceiling'].notnull()) & (df_r5_rem['yield_corrected'] > (df_r5_rem['ceiling'] * 2.0))
    s_extreme_tonne = set(df_r5_rem[extreme_tonne_mask]['raw_row_id'])

    # Expected cleaned row set (R6)
    expected_R6 = R5 - s_sugar_unverified - s_extreme_tonne

    # Dynamic sets for Punjab 2011 and Tamil Nadu 1997 conversions in cleaned data
    expected_pb_clean_ids = set(df_r5[punjab_2011_mask]['raw_row_id']) & expected_R6
    expected_tn_clean_ids = set(df_r5[tn_1997_mask]['raw_row_id']) & expected_R6

    # Load Processed Datasets
    df_clean = pd.read_csv(cleaned_yield_path)
    df_coconut = pd.read_csv(coconut_csv)
    df_cotton = pd.read_csv(cotton_csv)
    df_jm = pd.read_csv(jm_csv)
    df_arecanut = pd.read_csv(arecanut_csv)
    df_unverified = pd.read_csv(unverified_csv)

    expected_sets = {
        "expected_R6": expected_R6,
        "expected_cotton_clean": s_cotton_clean,
        "expected_jm_clean": s_jm_clean,
        "expected_coconut": D_coconut,
        "expected_arecanut": D_arecanut,
        "expected_unverified": s_segregated_unverified,
        "expected_sugar_unverified": s_sugar_unverified,
        "expected_cotton_unverified": s_cotton_unverified,
        "expected_pb_clean_ids": expected_pb_clean_ids,
        "expected_tn_clean_ids": expected_tn_clean_ids
    }

    # Verify Row-by-Row Numerics & Set Equality across all datasets
    numeric_audit_results = verify_row_by_row_yield_numerics(
        df_raw, df_clean, df_cotton, df_jm, df_coconut, df_arecanut, df_unverified, expected_sets
    )

    # Deep Validate Rainfall Joins
    rainfall_audit_results = deep_validate_rainfall_join(df_clean, df_rain)

    # Load Exclusion Inventory & Provenance
    with open(os.path.join(REPORTS_DIR, "threshold_provenance.json")) as f:
        prov = json.load(f)
    with open(os.path.join(REPORTS_DIR, "crop_exclusion_and_mapping_inventory.json")) as f:
        excl_inv = json.load(f)

    # 5. CROP-SPECIFIC THRESHOLD & HIGH-YIELD OBSERVATION AUDIT (Phase 3A.5 / 3A.6)
    print("\n🔍 Validating Crop-Specific Screening Thresholds & Retained High Observations...")
    verified_crops_checked = {}
    unmapped_crops_reported = {}
    total_records_above_T = 0
    total_records_above_2T = 0
    crops_with_records_between_T_and_2T = {}

    for crop_name, group in df_clean.groupby('Crop'):
        yields = group['Yield_Tonnes_Per_Ha']
        if crop_name in VERIFIED_CROP_SCREENING_THRESHOLDS_METADATA:
            meta = VERIFIED_CROP_SCREENING_THRESHOLDS_METADATA[crop_name]
            screening_thresh = meta["screening_threshold"]
            extreme_limit = meta["extreme_plausibility_bound"]
            max_crop_yield = float(yields.max())
            
            # Count records <= T, records between T and 2T, and records > 2T
            le_T_count = int((yields <= screening_thresh).sum())
            between_T_and_2T = int(((yields > screening_thresh) & (yields <= extreme_limit)).sum())
            above_2T_count = int((yields > extreme_limit).sum())

            total_records_above_T += between_T_and_2T
            total_records_above_2T += above_2T_count

            # Assert that NO record exceeds 2x screening threshold (extreme plausibility limit)
            assert above_2T_count == 0, (
                f"Crop '{crop_name}' has {above_2T_count} records exceeding extreme plausibility limit ({extreme_limit} t/ha)! Max: {max_crop_yield} t/ha"
            )

            if between_T_and_2T > 0:
                crops_with_records_between_T_and_2T[crop_name] = {
                    "count": between_T_and_2T,
                    "screening_threshold_T": screening_thresh,
                    "max_observed_yield": max_crop_yield,
                    "notes": "Retained in cleaned dataset as high observation; flagged for manual agronomic review (NOT deleted)"
                }

            verified_crops_checked[crop_name] = {
                "records_count": int(len(group)),
                "screening_threshold_t_ha": float(screening_thresh),
                "extreme_plausibility_limit_t_ha": float(extreme_limit),
                "records_le_screening_threshold": le_T_count,
                "records_between_T_and_2T": between_T_and_2T,
                "records_above_2T": above_2T_count,
                "max_observed_yield_t_ha": round(max_crop_yield, 3),
                "median_observed_yield_t_ha": round(float(yields.median()), 3),
                "provenance_status": meta["provenance_status"],
                "product_basis": meta["product_basis"],
                "moisture_or_harvest_form_notes": meta["moisture_or_harvest_form_notes"],
                "status": "PASS_WITHIN_EXTREME_LIMITS"
            }
        else:
            # Unmapped crop: DO NOT invent a threshold. Report separately.
            unmapped_crops_reported[crop_name] = {
                "records_count": int(len(group)),
                "min_observed_yield_t_ha": round(float(yields.min()), 3),
                "median_observed_yield_t_ha": round(float(yields.median()), 3),
                "max_observed_yield_t_ha": round(float(yields.max()), 3),
                "screening_threshold": None,
                "handling": "RETAINED_IN_DATASET_MANUAL_REVIEW"
            }

    print(f"  ✅ Verified Documented Crops ({len(verified_crops_checked)} crops): All records <= 2x screening threshold (0 records > 2T): PASS")
    print(f"  ℹ️ Retained High Observations: {total_records_above_T} records across {len(crops_with_records_between_T_and_2T)} crops with T < yield <= 2T retained for manual review")
    print(f"  ✅ Unmapped / Composite Crops ({len(unmapped_crops_reported)} crops): Reported separately, 0 invented thresholds: PASS")

    # 6. Multidimensional Eligibility & Chronological Splits Audit (Phase 3A.6)
    eligibility_and_splits = audit_multidimensional_eligibility_and_splits(df_clean, prov, excl_inv)

    # 7. Feature Set Anti-Leakage Audit
    from clean_yield_data import BASELINE_FEATURE_COLUMNS, TARGET_COLUMN
    assert 'Production' not in df_clean.columns, "CRITICAL: Production column found in cleaned dataset (Target Leakage)!"
    assert 'Cultivated_Area_Ha' not in BASELINE_FEATURE_COLUMNS, "CRITICAL: Cultivated_Area_Ha must be excluded from baseline feature set!"
    print("  ✅ Feature Set Audit: Production excluded; Cultivated_Area_Ha excluded from baseline feature set: PASS")

    # 8. Disjointness & Exact Universe Union
    partition_sets = [
        ("D1_null_prod", D1),
        ("D2_invalid_area", D2),
        ("D3_zero_prod", D3),
        ("D4_neg_yield", D4),
        ("D_coconut", D_coconut),
        ("Cotton_Clean", s_cotton_clean),
        ("Jute_Mesta_Clean", s_jm_clean),
        ("Arecanut_Segregated", D_arecanut),
        ("Segregated_Unverified", s_segregated_unverified),
        ("Extreme_Tonne_Outliers", s_extreme_tonne),
        ("Extreme_Fiber_Outliers", s_jm_extreme),
        ("Final_Cleaned_Tonne_R6", expected_R6)
    ]

    for i in range(len(partition_sets)):
        for j in range(i + 1, len(partition_sets)):
            name_i, set_i = partition_sets[i]
            name_j, set_j = partition_sets[j]
            overlap = set_i.intersection(set_j)
            assert len(overlap) == 0, f"Overlap between {name_i} and {name_j}: {len(overlap)} rows!"

    union_all = set()
    for _, s in partition_sets:
        union_all = union_all.union(s)
    assert union_all == U, f"Set union mismatch with raw universe! Discrepancy: {len(U - union_all)}"
    assert sum(len(s) for _, s in partition_sets) == total_raw_rows, "Sum of partition sizes mismatch!"
    print(f"  ✅ Dynamic Set Mathematics: 12 pairwise disjoint sets sum to {total_raw_rows:,} (0 discrepancy): PASS")

    return {
        "dataset": "cleaned_crop_yield.csv",
        "status": "PASSED",
        "raw_universe_rows": total_raw_rows,
        "final_cleaned_rows": len(df_clean),
        "target_unit": "Metric Tonnes per Hectare",
        "unique_crops_total": int(df_clean['Crop'].nunique()),
        "verified_documented_crops_count": len(verified_crops_checked),
        "unmapped_crops_count": len(unmapped_crops_reported),
        "crop_threshold_consistency_audit": {
            "total_verified_records": sum(x['records_count'] for x in verified_crops_checked.values()),
            "total_records_le_threshold_T": sum(x['records_le_screening_threshold'] for x in verified_crops_checked.values()),
            "total_records_between_T_and_2T": total_records_above_T,
            "crops_count_between_T_and_2T": len(crops_with_records_between_T_and_2T),
            "total_records_above_2T": total_records_above_2T,
            "retained_high_observations_details": crops_with_records_between_T_and_2T,
            "handling_explanation": "Records with T < yield <= 2T are retained in cleaned_crop_yield.csv as high observations / flagged for manual review to avoid artificial distribution truncation. Only extreme outliers > 2T were dropped."
        },
        "multidimensional_training_eligibility": eligibility_and_splits["multidimensional_eligibility_table"],
        "eligibility_summary": eligibility_and_splits["eligibility_summary"],
        "chronological_splits_total": eligibility_and_splits["chronological_splits_total"],
        "chronological_splits_eligible": eligibility_and_splits["chronological_splits_eligible"],
        "chronological_splits_excluded": eligibility_and_splits["chronological_splits_excluded"],
        "verified_crops_threshold_audit": verified_crops_checked,
        "unmapped_crops_inventory": unmapped_crops_reported,
        "numeric_verification": numeric_audit_results,
        "rainfall_join_verification": rainfall_audit_results,
        "segregated_datasets_counts": {
            "segregated_coconut_nuts_yield": len(df_coconut),
            "segregated_cotton_bales_yield": len(df_cotton),
            "segregated_jute_mesta_bales_yield": len(df_jm),
            "segregated_arecanut_yield": len(df_arecanut),
            "segregated_unverified_unit_yield": len(df_unverified)
        },
        "dropped_subsets_counts": {
            "D1_null_production": len(D1),
            "D2_invalid_area": len(D2),
            "D3_zero_production": len(D3),
            "D4_negligible_yield": len(D4),
            "extreme_tonne_outliers": len(s_extreme_tonne),
            "extreme_fiber_outliers": len(s_jm_extreme)
        },
        "set_reconciliation": {
            "pairwise_disjointness_verified": True,
            "mathematical_universe_reconciliation": "PERFECT (Exact 0 discrepancy)"
        }
    }


def main():
    print("🛡️ Running pre-training dataset validation suite (Phase 3A.6)...")
    rec_results = validate_crop_recommendation()
    yield_results = validate_crop_yield_independently()

    summary = {
        "metadata": {
            "pipeline_stage": "Phase 3A.6: Training Eligibility and Split Reconciliation",
            "timestamp": pd.Timestamp.now().isoformat(),
            "overall_status": "ALL_ASSERTIONS_PASSED",
            "scientific_validation_disclaimer": (
                "IMPORTANT: Passing automated assertion checks confirms relational schema conformance, "
                "unit segregation, dynamic set equality, numerical row-by-row derivation fidelity, "
                "and crop-specific screening thresholds. It does NOT constitute empirical scientific validation "
                "of field predictive capability. Benchmark cross-validation metrics apply strictly to the 22-class "
                "augmented dataset, and historical yield data reflects government district-level aggregates with "
                "inherent unmeasured spatial, microclimatic, and farm-management variability."
            )
        },
        "crop_recommendation_benchmark_validation": rec_results,
        "crop_yield_regression_validation": yield_results
    }

    summary_path = os.path.join(REPORTS_DIR, "validation_summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\n🎉 ALL PHASE 3A.6 ASSERTIONS PASSED! Validation summary written to: {summary_path}")
    return summary


if __name__ == "__main__":
    main()
