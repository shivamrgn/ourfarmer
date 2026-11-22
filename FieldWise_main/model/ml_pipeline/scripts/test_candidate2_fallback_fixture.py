"""
FieldWise ML Pipeline — Phase 3B.2 Unit Test Fixture
Script: test_candidate2_fallback_fixture.py

Dedicated unit test fixture for Candidate 2 Fallback Ridge (§10.3, §10.4):
  1. Imports and tests the actual production Candidate 2 routing logic:
     `from train_eval_residual_stacking import route_candidate2_predictions`
  2. Constructs a synthetic dataset where one stratum (Oilseeds) has N_stratum_train < 500 rows (low support).
  3. Includes in the low-support stratum (Oilseeds):
     - Valid fallback rows (Groundnut, seen in training, in-support, valid features) -> Case 2
     - Screened rows (Groundnut, is_screened = True) -> Case 3
     - Unseen crops (Mustard, mapped to Oilseeds, but train_crop_counts = 0) -> Case 3
     - Invalid-feature rows (Groundnut with NaN, +inf, -inf, invalid is_screened) -> Case 5
  4. Includes in the active-supported stratum (Cereals & Millets, N >= 500):
     - Valid active rows (Rice, seen in training, in-support, valid features) -> Case 1
     - Invalid-feature rows (Rice with NaN, +inf, -inf, invalid is_screened) -> Case 5
  5. Also tests:
     - Case 4: Unmapped crop (ExoticDragonFruit, not in C_tax) -> Case 4
     - Comprehensive feature validation across:
       * NaN / +inf annual rainfall
       * NaN / -inf monsoon rainfall
       * NaN Crop_Year
       * NaN / +inf y_hat_base
       * NaN / +inf N_tilde_cell
       * -inf log_sigma2_cell
       * NaN base_key_state_count
       * NaN base_key_cross_state_collision
       * Invalid / null / non-boolean is_screened
       * Missing / None categorical Season
       * Empty categorical State
       * Missing / None DistrictID
       * Explicit is_feature_valid = False
  6. Enforces schema validation:
     - Missing any required column raises explicit ValueError.
     - District accepted in lieu of DistrictID.
  7. Precondition assertions:
     - r_fallback_eval None, length mismatch, or non-finite values (NaN, +/-inf) raise explicit assertions.
  8. Asserts:
     - Fallback predictions applied strictly to valid fallback-routed rows (Case 2).
     - Screened, unseen, unmapped, and invalid-feature rows receive exactly zero residual correction (0.0).
     - Both active and low-support invalid rows receive 0.0 residual correction and route to Case 5.
     - Exact 1-to-1 row reconciliation across all 5 cases.
     - 100% finite final predictions for every evaluation row.
"""

import os
import sys
import numpy as np
import pandas as pd
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.linear_model import Ridge
from scipy import sparse

# Import the actual production Candidate 2 routing function directly
scripts_dir = os.path.dirname(os.path.abspath(__file__))
if scripts_dir not in sys.path:
    sys.path.insert(0, scripts_dir)

from train_eval_residual_stacking import route_candidate2_predictions


def test_candidate2_fallback_routing_and_reconciliation():
    print("===================================================================")
    print("Running Production Candidate 2 Fallback Ridge & 5-Case Routing Test")
    print("===================================================================")
    
    rng = np.random.default_rng(42)
    
    # Define Taxonomy mapping with 4 strata
    strata = ["Cereals & Millets", "Pulses & Legumes", "Oilseeds", "Commercial & Horticultural"]
    crop_stratum_map = {
        "Rice": "Cereals & Millets",
        "Wheat": "Cereals & Millets",
        "Gram": "Pulses & Legumes",
        "Arhar/Tur": "Pulses & Legumes",
        "Groundnut": "Oilseeds",          # Low-support stratum in training (< 500 rows)
        "Soyabean": "Oilseeds",           # Low-support stratum in training (< 500 rows)
        "Mustard": "Oilseeds",            # Mapped to Oilseeds, but 0 training rows (Unseen!)
        "Sugarcane": "Commercial & Horticultural",
        "Cotton": "Commercial & Horticultural",
    }
    tax_crops = set(crop_stratum_map.keys())

    cat_cols = ['State', 'DistrictID', 'Crop', 'Season', 'Level_base']
    num_cols = ['Crop_Year', 'district_normal_annual_rainfall_mm', 'district_normal_monsoon_rainfall_mm',
                'y_hat_base', 'N_tilde_cell', 'log_sigma2_cell', 'base_key_state_count']
    bin_cols = ['base_key_cross_state_collision']

    # Generate Synthetic Training Data (Permitted period: M_train = 1)
    # Stratum 1 (Cereals): 600 rows (>= 500 -> Active)
    # Stratum 2 (Pulses): 550 rows (>= 500 -> Active)
    # Stratum 3 (Oilseeds): 150 rows (< 500 -> Low-support -> Triggers FALLBACK)
    # Stratum 4 (Commercial): 700 rows (>= 500 -> Active)
    
    train_rows = []
    def make_rows(crop, n, start_id=0):
        records = []
        for i in range(n):
            records.append({
                "row_id": f"tr_{crop}_{start_id + i}",
                "State": "STATE_A" if i % 2 == 0 else "STATE_B",
                "DistrictID": f"STATE_A__DIST_{i%5}" if i % 2 == 0 else f"STATE_B__DIST_{i%5}",
                "Crop": crop,
                "Season": "Kharif" if i % 2 == 0 else "Rabi",
                "Level_base": "State_District_Crop_Season",
                "Crop_Year": 2005,
                "district_normal_annual_rainfall_mm": 1000.0 + rng.normal(0, 50),
                "district_normal_monsoon_rainfall_mm": 800.0 + rng.normal(0, 40),
                "y_hat_base": float(rng.uniform(1.0, 4.0)),
                "N_tilde_cell": 15.0,
                "log_sigma2_cell": -0.5,
                "base_key_state_count": 1.0,
                "base_key_cross_state_collision": 0,
                "residual": float(rng.normal(0, 0.2)),
                "Yield_Tonnes_Per_Ha": 2.5,
                "is_screened": False,
                "is_feature_valid": True
            })
        return records

    train_rows.extend(make_rows("Rice", 350))
    train_rows.extend(make_rows("Wheat", 250))       # Cereals total = 600 (ACTIVE)
    train_rows.extend(make_rows("Gram", 300))
    train_rows.extend(make_rows("Arhar/Tur", 250))   # Pulses total = 550 (ACTIVE)
    train_rows.extend(make_rows("Groundnut", 100))
    train_rows.extend(make_rows("Soyabean", 50))     # Oilseeds total = 150 (< 500 -> LOW SUPPORT)
    # Note: Mustard has 0 rows in training data!
    train_rows.extend(make_rows("Sugarcane", 400))
    train_rows.extend(make_rows("Cotton", 300))      # Commercial total = 700 (ACTIVE)

    train_df = pd.DataFrame(train_rows)
    train_df["stratum"] = train_df["Crop"].map(crop_stratum_map)
    train_crop_counts = train_df["Crop"].value_counts().to_dict()

    print(f"  Synthetic Training Rows: {len(train_df)}")
    for s in strata:
        n_s = len(train_df[train_df["stratum"] == s])
        print(f"    Stratum '{s}': {n_s} training rows ({'ACTIVE' if n_s >= 500 else 'LOW-SUPPORT / FALLBACK'})")
    assert len(train_df[train_df["stratum"] == "Oilseeds"]) == 150, "Oilseeds must have exactly 150 rows"
    assert "Mustard" not in train_crop_counts, "Mustard must have 0 rows in training"

    # Preprocessing Encoders & Scalers fitted on pooled valid training rows
    ohe_master = OneHotEncoder(handle_unknown="ignore", sparse_output=True)
    X_tr_cat = ohe_master.fit_transform(train_df[cat_cols])
    scaler_master = StandardScaler()
    X_tr_num = scaler_master.fit_transform(train_df[num_cols])
    X_tr_master = sparse.hstack([X_tr_cat, sparse.csr_matrix(X_tr_num), sparse.csr_matrix(train_df[bin_cols].values)]).tocsr()
    y_tr_pooled = train_df["residual"].values

    # Fit Candidate 2 Fallback Ridge (lambda_fallback = 1.0)
    clf_c2_fb = Ridge(alpha=1.0, fit_intercept=True, solver="auto", random_state=42)
    clf_c2_fb.fit(X_tr_master, y_tr_pooled)

    # Fit Candidate 2 Active Stratum Ridge Models (for strata with >= 500 rows)
    c2_models = {}
    c2_locked_lambdas = {}
    for s in strata:
        tr_s = train_df[train_df["stratum"] == s]
        n_tr_s = len(tr_s)
        if n_tr_s >= 500:
            ohe_s = OneHotEncoder(handle_unknown="ignore", sparse_output=True)
            X_tr_cat_s = ohe_s.fit_transform(tr_s[cat_cols])
            scaler_s = StandardScaler()
            X_tr_num_s = scaler_s.fit_transform(tr_s[num_cols])
            X_tr_s = sparse.hstack([X_tr_cat_s, sparse.csr_matrix(X_tr_num_s), sparse.csr_matrix(tr_s[bin_cols].values)]).tocsr()
            y_tr_s = tr_s["residual"].values

            clf_s = Ridge(alpha=10.0, fit_intercept=True, solver="auto", random_state=42)
            clf_s.fit(X_tr_s, y_tr_s)

            c2_models[s] = {
                "status": "ACTIVE",
                "n_tr": n_tr_s,
                "clf": clf_s,
                "ohe": ohe_s,
                "scaler": scaler_s
            }
            c2_locked_lambdas[s] = 10.0
        else:
            c2_models[s] = {
                "status": "FALLBACK",
                "n_tr": n_tr_s
            }
            c2_locked_lambdas[s] = 1.0

    # =========================================================================
    # Construct Synthetic Evaluation Dataset
    # Audit Requirements:
    #   1. Active-supported stratum (Cereals & Millets): valid active rows (Case 1)
    #      AND invalid-feature rows (Case 5).
    #   2. Low-support stratum (Oilseeds, <500 rows): valid fallback rows (Case 2),
    #      screened rows (Case 3), unseen crop rows (Case 3), AND invalid-feature rows (Case 5).
    #   3. Unmapped crop (ExoticDragonFruit) -> Case 4.
    # =========================================================================
    eval_rows = []

    # 1. Case 1: Active Stratum Valid Rows (Rice in Cereals & Millets) -> 10 rows
    for i in range(10):
        eval_rows.append({
            "row_id": f"ev_case1_rice_{i}",
            "State": "STATE_A", "DistrictID": "STATE_A__DIST_1",
            "Crop": "Rice", "Season": "Kharif", "Level_base": "State_District_Crop_Season",
            "Crop_Year": 2007, "district_normal_annual_rainfall_mm": 1010.0, "district_normal_monsoon_rainfall_mm": 810.0,
            "y_hat_base": 2.2, "N_tilde_cell": 15.0, "log_sigma2_cell": -0.5, "base_key_state_count": 1.0,
            "base_key_cross_state_collision": 0, "residual": 0.05, "Yield_Tonnes_Per_Ha": 2.25,
            "is_screened": False, "is_feature_valid": True
        })

    # 2. In Low-Support Stratum (Oilseeds, N_train = 150 < 500):
    # 2a. Valid Fallback rows: Groundnut (seen in training N=100, valid features, not screened) -> 8 rows (Case 2)
    for i in range(8):
        eval_rows.append({
            "row_id": f"ev_case2_groundnut_valid_{i}",
            "State": "STATE_B", "DistrictID": "STATE_B__DIST_2",
            "Crop": "Groundnut", "Season": "Kharif", "Level_base": "State_District_Crop_Season",
            "Crop_Year": 2007, "district_normal_annual_rainfall_mm": 950.0, "district_normal_monsoon_rainfall_mm": 750.0,
            "y_hat_base": 1.5, "N_tilde_cell": 12.0, "log_sigma2_cell": -0.4, "base_key_state_count": 1.0,
            "base_key_cross_state_collision": 0, "residual": -0.10, "Yield_Tonnes_Per_Ha": 1.40,
            "is_screened": False, "is_feature_valid": True
        })

    # 2b. Screened rows in low-support stratum: Groundnut (is_screened = True) -> 5 rows (Case 3)
    for i in range(5):
        eval_rows.append({
            "row_id": f"ev_case3_groundnut_screened_{i}",
            "State": "STATE_B", "DistrictID": "STATE_B__DIST_2",
            "Crop": "Groundnut", "Season": "Kharif", "Level_base": "State_District_Crop_Season",
            "Crop_Year": 2007, "district_normal_annual_rainfall_mm": 950.0, "district_normal_monsoon_rainfall_mm": 750.0,
            "y_hat_base": 25.0, "N_tilde_cell": 1.0, "log_sigma2_cell": 2.0, "base_key_state_count": 1.0,
            "base_key_cross_state_collision": 0, "residual": 0.0, "Yield_Tonnes_Per_Ha": 2.0,
            "is_screened": True, "is_feature_valid": True
        })

    # 2c. Unseen crops in low-support stratum: Mustard (mapped to Oilseeds, 0 training rows) -> 5 rows (Case 3)
    for i in range(5):
        eval_rows.append({
            "row_id": f"ev_case3_mustard_unseen_{i}",
            "State": "STATE_B", "DistrictID": "STATE_B__DIST_2",
            "Crop": "Mustard", "Season": "Rabi", "Level_base": "State_District_Crop_Season",
            "Crop_Year": 2007, "district_normal_annual_rainfall_mm": 950.0, "district_normal_monsoon_rainfall_mm": 750.0,
            "y_hat_base": 1.2, "N_tilde_cell": 5.0, "log_sigma2_cell": -0.2, "base_key_state_count": 1.0,
            "base_key_cross_state_collision": 0, "residual": 0.0, "Yield_Tonnes_Per_Ha": 1.2,
            "is_screened": False, "is_feature_valid": True
        })

    # 3. Case 4: Unmapped crop (ExoticDragonFruit, not in C_tax) -> 5 rows (Case 4)
    for i in range(5):
        eval_rows.append({
            "row_id": f"ev_case4_dragonfruit_unmapped_{i}",
            "State": "STATE_A", "DistrictID": "STATE_A__DIST_1",
            "Crop": "ExoticDragonFruit", "Season": "Kharif", "Level_base": "State_District_Crop_Season",
            "Crop_Year": 2007, "district_normal_annual_rainfall_mm": 1000.0, "district_normal_monsoon_rainfall_mm": 800.0,
            "y_hat_base": 5.0, "N_tilde_cell": 1.0, "log_sigma2_cell": 0.0, "base_key_state_count": 1.0,
            "base_key_cross_state_collision": 0, "residual": 0.0, "Yield_Tonnes_Per_Ha": 5.0,
            "is_screened": False, "is_feature_valid": True
        })

    # 4. Case 5: Comprehensive Invalid Feature Rows in BOTH Active Stratum and Low-Support Stratum
    # 4A. Active-Supported Stratum (Rice in Cereals & Millets) -> 18 distinct scenarios
    active_base_template = {
        "State": "STATE_A", "DistrictID": "STATE_A__DIST_1",
        "Crop": "Rice", "Season": "Kharif", "Level_base": "State_District_Crop_Season",
        "Crop_Year": 2007, "district_normal_annual_rainfall_mm": 1010.0, "district_normal_monsoon_rainfall_mm": 810.0,
        "y_hat_base": 2.2, "N_tilde_cell": 15.0, "log_sigma2_cell": -0.5, "base_key_state_count": 1.0,
        "base_key_cross_state_collision": 0, "residual": 0.0, "Yield_Tonnes_Per_Ha": 2.2,
        "is_screened": False, "is_feature_valid": True
    }

    active_invalid_scenarios = [
        ("case5_active_nan_annual_rain", {"district_normal_annual_rainfall_mm": np.nan}),
        ("case5_active_posinf_annual_rain", {"district_normal_annual_rainfall_mm": np.inf}),
        ("case5_active_neginf_monsoon_rain", {"district_normal_monsoon_rainfall_mm": -np.inf}),
        ("case5_active_nan_monsoon_rain", {"district_normal_monsoon_rainfall_mm": np.nan}),
        ("case5_active_nan_crop_year", {"Crop_Year": np.nan}),
        ("case5_active_nan_y_hat_base", {"y_hat_base": np.nan}),
        ("case5_active_posinf_y_hat_base", {"y_hat_base": np.inf}),
        ("case5_active_posinf_N_tilde", {"N_tilde_cell": np.inf}),
        ("case5_active_nan_N_tilde", {"N_tilde_cell": np.nan}),
        ("case5_active_neginf_log_sigma2", {"log_sigma2_cell": -np.inf}),
        ("case5_active_nan_state_count", {"base_key_state_count": np.nan}),
        ("case5_active_nan_collision", {"base_key_cross_state_collision": np.nan}),
        ("case5_active_none_is_screened", {"is_screened": None}),
        ("case5_active_invalid_str_is_screened", {"is_screened": "CORRUPT_BOOLEAN_FLAG"}),
        ("case5_active_none_season", {"Season": None}),
        ("case5_active_empty_state", {"State": ""}),
        ("case5_active_none_district", {"DistrictID": None}),
        ("case5_active_explicit_flag_false", {"is_feature_valid": False}),
    ]

    for scenario_name, overrides in active_invalid_scenarios:
        row = dict(active_base_template)
        row["row_id"] = f"ev_{scenario_name}"
        row.update(overrides)
        eval_rows.append(row)

    # 4B. Low-Support Stratum (Groundnut in Oilseeds) -> 18 distinct scenarios
    lowsup_base_template = {
        "State": "STATE_B", "DistrictID": "STATE_B__DIST_2",
        "Crop": "Groundnut", "Season": "Kharif", "Level_base": "State_District_Crop_Season",
        "Crop_Year": 2007, "district_normal_annual_rainfall_mm": 950.0, "district_normal_monsoon_rainfall_mm": 750.0,
        "y_hat_base": 1.5, "N_tilde_cell": 12.0, "log_sigma2_cell": -0.4, "base_key_state_count": 1.0,
        "base_key_cross_state_collision": 0, "residual": 0.0, "Yield_Tonnes_Per_Ha": 1.5,
        "is_screened": False, "is_feature_valid": True
    }

    lowsup_invalid_scenarios = [
        ("case5_lowsup_nan_annual_rain", {"district_normal_annual_rainfall_mm": np.nan}),
        ("case5_lowsup_posinf_annual_rain", {"district_normal_annual_rainfall_mm": np.inf}),
        ("case5_lowsup_neginf_monsoon_rain", {"district_normal_monsoon_rainfall_mm": -np.inf}),
        ("case5_lowsup_nan_monsoon_rain", {"district_normal_monsoon_rainfall_mm": np.nan}),
        ("case5_lowsup_nan_crop_year", {"Crop_Year": np.nan}),
        ("case5_lowsup_nan_y_hat_base", {"y_hat_base": np.nan}),
        ("case5_lowsup_posinf_y_hat_base", {"y_hat_base": np.inf}),
        ("case5_lowsup_posinf_N_tilde", {"N_tilde_cell": np.inf}),
        ("case5_lowsup_nan_N_tilde", {"N_tilde_cell": np.nan}),
        ("case5_lowsup_neginf_log_sigma2", {"log_sigma2_cell": -np.inf}),
        ("case5_lowsup_nan_state_count", {"base_key_state_count": np.nan}),
        ("case5_lowsup_nan_collision", {"base_key_cross_state_collision": np.nan}),
        ("case5_lowsup_none_is_screened", {"is_screened": None}),
        ("case5_lowsup_nan_is_screened", {"is_screened": np.nan}),
        ("case5_lowsup_none_season", {"Season": None}),
        ("case5_lowsup_empty_state", {"State": ""}),
        ("case5_lowsup_none_district", {"DistrictID": None}),
        ("case5_lowsup_explicit_flag_false", {"is_feature_valid": False}),
    ]

    for scenario_name, overrides in lowsup_invalid_scenarios:
        row = dict(lowsup_base_template)
        row["row_id"] = f"ev_{scenario_name}"
        row.update(overrides)
        eval_rows.append(row)

    eval_df = pd.DataFrame(eval_rows)
    eval_df["stratum"] = eval_df["Crop"].map(crop_stratum_map)
    n_eval = len(eval_df)
    expected_total_rows = 10 + 8 + 5 + 5 + 5 + len(active_invalid_scenarios) + len(lowsup_invalid_scenarios)
    assert n_eval == expected_total_rows, f"Expected {expected_total_rows} evaluation rows, got {n_eval}"

    # Precompute active predictions for active strata
    for s, mod in c2_models.items():
        ev_s = eval_df[eval_df["stratum"] == s]
        if mod["status"] == "ACTIVE" and len(ev_s) > 0:
            # Impute temporarily for feature transformation of active model
            ev_s_imputed = ev_s.copy()
            for col in num_cols:
                ev_s_imputed[col] = pd.to_numeric(ev_s_imputed[col], errors='coerce').fillna(1.0)
                ev_s_imputed[col] = np.where(np.isfinite(ev_s_imputed[col]), ev_s_imputed[col], 1.0)
            for col in cat_cols:
                ev_s_imputed[col] = ev_s_imputed[col].fillna("MISSING").replace("", "MISSING")
            ev_s_imputed["base_key_cross_state_collision"] = ev_s_imputed["base_key_cross_state_collision"].fillna(0).astype(int)

            x_cat = mod["ohe"].transform(ev_s_imputed[cat_cols])
            x_num = mod["scaler"].transform(ev_s_imputed[num_cols])
            x_s = sparse.hstack([x_cat, sparse.csr_matrix(x_num), sparse.csr_matrix(ev_s_imputed[bin_cols].values)]).tocsr()
            mod["ev_indices"] = ev_s.index
            mod["active_preds"] = mod["clf"].predict(x_s)

    # Precompute Fallback Model Predictions for All Eval Rows (safe dummy imputation for the master feature matrix)
    eval_df_imputed = eval_df.copy()
    for col in num_cols:
        eval_df_imputed[col] = pd.to_numeric(eval_df_imputed[col], errors='coerce').fillna(1.0)
        eval_df_imputed[col] = np.where(np.isfinite(eval_df_imputed[col]), eval_df_imputed[col], 1.0)
    for col in cat_cols:
        eval_df_imputed[col] = eval_df_imputed[col].fillna("MISSING").replace("", "MISSING")
    eval_df_imputed["base_key_cross_state_collision"] = eval_df_imputed["base_key_cross_state_collision"].fillna(0).astype(int)

    X_ev_cat = ohe_master.transform(eval_df_imputed[cat_cols])
    X_ev_num = scaler_master.transform(eval_df_imputed[num_cols])
    X_ev_master = sparse.hstack([X_ev_cat, sparse.csr_matrix(X_ev_num), sparse.csr_matrix(eval_df_imputed[bin_cols].values)]).tocsr()
    raw_fb_preds = clf_c2_fb.predict(X_ev_master)

    # =========================================================================
    # EXECUTE ACTUAL PRODUCTION ROUTING FUNCTION
    # =========================================================================
    alpha_test = 0.50
    print("  [Execution] Calling production route_candidate2_predictions()...")
    r_c2_unified, pred_cand_2, routing_cases, routing_statuses, counts = route_candidate2_predictions(
        eval_df=eval_df,
        stratum_models=c2_models,
        c2_locked_lambdas=c2_locked_lambdas,
        r_fallback_eval=raw_fb_preds,
        train_crop_counts=train_crop_counts,
        tax_crops=tax_crops,
        alpha_multiplier=alpha_test
    )

    eval_df["pred_cand_2"] = pred_cand_2
    eval_df["cand_2_routing_case"] = routing_cases
    eval_df["cand_2_routing_status"] = routing_statuses

    # =========================================================================
    # RIGOROUS AUDIT ASSERTIONS
    # =========================================================================
    print("  [Assertions] Verifying counts and exact routing...")
    print(f"    Case 1 (Active Stratum):              {counts['active_count']}")
    print(f"    Case 2 (Fallback Ridge):              {counts['fallback_count']}")
    print(f"    Case 3 (Screened Out-of-Support):     {counts['screened_count']}")
    print(f"    Case 3 (Unseen Crop):                 {counts['unseen_count']}")
    print(f"    Case 4 (Unmapped Zero):               {counts['unmapped_count']}")
    print(f"    Case 5 (Invalid Feature Zero):        {counts['invalid_count']}")
    print(f"    Total Zero Residual Rows:             {counts['total_zero_residual']}")
    print(f"    Total Evaluated Rows:                 {counts['total_eval']}")

    # Check exact expected counts:
    # 10 active, 8 fallback, 5 screened, 5 unseen, 5 unmapped, 36 invalid (18 active + 18 lowsup), 51 total zero, 69 total eval
    assert counts["active_count"] == 10, f"Expected 10 active rows, got {counts['active_count']}"
    assert counts["fallback_count"] == 8, f"Expected 8 fallback rows, got {counts['fallback_count']}"
    assert counts["screened_count"] == 5, f"Expected 5 screened rows, got {counts['screened_count']}"
    assert counts["unseen_count"] == 5, f"Expected 5 unseen rows, got {counts['unseen_count']}"
    assert counts["unmapped_count"] == 5, f"Expected 5 unmapped rows, got {counts['unmapped_count']}"
    assert counts["invalid_count"] == 36, f"Expected 36 invalid rows, got {counts['invalid_count']}"
    assert counts["total_zero_residual"] == 51, f"Expected 51 total zero-residual rows, got {counts['total_zero_residual']}"
    assert counts["total_eval"] == 69, f"Expected 69 total rows, got {counts['total_eval']}"

    # Assertion 1: Exact 1-to-1 Disjoint Reconciliation
    reconciled_sum = counts["active_count"] + counts["fallback_count"] + counts["total_zero_residual"]
    assert reconciled_sum == 69, f"Reconciliation failed: {reconciled_sum} != 69"
    assert len(routing_cases) == 69
    assert len(routing_statuses) == 69

    # Assertion 2: Fallback predictions applied STRICTLY to valid fallback-routed rows (Case 2)
    case2_indices = [i for i, c in enumerate(routing_cases) if c == 2]
    assert len(case2_indices) == 8, f"Expected exactly 8 Case 2 rows, got {len(case2_indices)}"
    for idx in case2_indices:
        expected_r = raw_fb_preds[idx]
        actual_r = r_c2_unified[idx]
        assert abs(actual_r - expected_r) < 1e-12, f"Row {idx} Fallback prediction mismatch: {actual_r} vs {expected_r}"
        expected_pred = eval_df.iloc[idx]["y_hat_base"] + alpha_test * expected_r
        actual_pred = pred_cand_2[idx]
        assert abs(actual_pred - expected_pred) < 1e-12, f"Row {idx} Final prediction mismatch"

    # Assertion 3: Active-supported stratum invalid rows (Rice) ALL route to Case 5 and receive 0.0 residual
    active_invalid_indices = [i for i, r in eval_df.iterrows() if "case5_active" in str(r.get("row_id", ""))]
    assert len(active_invalid_indices) == 18, f"Expected 18 active invalid rows, got {len(active_invalid_indices)}"
    for idx in active_invalid_indices:
        assert routing_cases[idx] == 5, f"Row {idx} did not route to Case 5: got {routing_cases[idx]}"
        assert routing_statuses[idx] == "ZERO_RESIDUAL_INVALID_FEATURE", f"Row {idx} status mismatch: {routing_statuses[idx]}"
        assert r_c2_unified[idx] == 0.0, f"Row {idx} residual non-zero: {r_c2_unified[idx]}"
        y_base_raw = eval_df.iloc[idx]["y_hat_base"]
        y_base_expected = y_base_raw if np.isfinite(y_base_raw) else 0.0
        assert pred_cand_2[idx] == y_base_expected, f"Row {idx} Base prediction not preserved: {pred_cand_2[idx]} vs {y_base_expected}"

    # Assertion 4: Low-support stratum invalid rows (Groundnut) ALL route to Case 5 and receive 0.0 residual
    lowsup_invalid_indices = [i for i, r in eval_df.iterrows() if "case5_lowsup" in str(r.get("row_id", ""))]
    assert len(lowsup_invalid_indices) == 18, f"Expected 18 low-support invalid rows, got {len(lowsup_invalid_indices)}"
    for idx in lowsup_invalid_indices:
        assert routing_cases[idx] == 5, f"Row {idx} did not route to Case 5: got {routing_cases[idx]}"
        assert routing_statuses[idx] == "ZERO_RESIDUAL_INVALID_FEATURE", f"Row {idx} status mismatch: {routing_statuses[idx]}"
        assert r_c2_unified[idx] == 0.0, f"Row {idx} residual non-zero: {r_c2_unified[idx]}"
        y_base_raw = eval_df.iloc[idx]["y_hat_base"]
        y_base_expected = y_base_raw if np.isfinite(y_base_raw) else 0.0
        assert pred_cand_2[idx] == y_base_expected, f"Row {idx} Base prediction not preserved: {pred_cand_2[idx]} vs {y_base_expected}"

    # Assertion 5: Screened, unseen, and unmapped rows receive EXACTLY zero residual correction (0.0)
    zero_cases_indices = [i for i, c in enumerate(routing_cases) if c in (3, 4, 5)]
    assert len(zero_cases_indices) == 51, f"Expected exactly 51 zero-residual rows, got {len(zero_cases_indices)}"
    for idx in zero_cases_indices:
        actual_r = r_c2_unified[idx]
        assert actual_r == 0.0, f"Row {idx} residual non-zero: {actual_r} (Case {routing_cases[idx]}, Status {routing_statuses[idx]})"
        y_base_raw = eval_df.iloc[idx]["y_hat_base"]
        y_base_expected = y_base_raw if np.isfinite(y_base_raw) else 0.0
        actual_pred = pred_cand_2[idx]
        assert actual_pred == y_base_expected, f"Row {idx} Base prediction not preserved: {actual_pred} vs {y_base_expected}"

    # Assertion 6: Case 1 valid rows receive active stratum prediction
    case1_indices = [i for i, c in enumerate(routing_cases) if c == 1]
    assert len(case1_indices) == 10, f"Expected exactly 10 Case 1 rows, got {len(case1_indices)}"
    expected_active_preds = c2_models["Cereals & Millets"]["active_preds"]
    for idx in case1_indices:
        assert abs(r_c2_unified[idx] - expected_active_preds[idx]) < 1e-12, f"Row {idx} Active prediction mismatch"

    # Assertion 7: 100% Finite Final Predictions Across ALL Rows
    assert np.all(np.isfinite(pred_cand_2)), "Non-finite predictions found!"

    print("  [SUCCESS] All Candidate 2 fallback and production 5-case routing assertions passed perfectly!")
    return True


def test_candidate2_missing_columns_schema_enforcement():
    print("===================================================================")
    print("Running Candidate 2 Schema Enforcement Unit Test")
    print("===================================================================")
    valid_row = {
        "State": "STATE_A",
        "DistrictID": "DIST_1",
        "Crop": "Rice",
        "Season": "Kharif",
        "Level_base": "State_District_Crop_Season",
        "Crop_Year": 2007,
        "district_normal_annual_rainfall_mm": 1000.0,
        "district_normal_monsoon_rainfall_mm": 800.0,
        "y_hat_base": 2.5,
        "N_tilde_cell": 10.0,
        "log_sigma2_cell": -0.5,
        "base_key_state_count": 1.0,
        "base_key_cross_state_collision": 0,
        "is_screened": False,
        "stratum": "Cereals & Millets"
    }
    df_valid = pd.DataFrame([valid_row])

    # Required columns to test
    required_cols = [
        'is_screened', 'Crop', 'State', 'Season', 'Level_base',
        'Crop_Year', 'district_normal_annual_rainfall_mm', 'district_normal_monsoon_rainfall_mm',
        'y_hat_base', 'N_tilde_cell', 'log_sigma2_cell', 'base_key_state_count',
        'base_key_cross_state_collision'
    ]

    for col in required_cols:
        df_missing = df_valid.drop(columns=[col])
        try:
            route_candidate2_predictions(
                eval_df=df_missing,
                stratum_models={},
                c2_locked_lambdas={},
                r_fallback_eval=np.array([0.0]),
                train_crop_counts={"Rice": 100},
                tax_crops={"Rice"},
                alpha_multiplier=1.0
            )
            assert False, f"Expected ValueError for missing column '{col}', but no error raised!"
        except ValueError as e:
            assert f"Missing required feature column(s): ['{col}']" in str(e) or col in str(e), (
                f"Unexpected error message for missing '{col}': {e}"
            )
            print(f"  PASSED: Detected missing column '{col}' -> raised schema error: {e}")

    # Test DistrictID / District missing (when neither is present)
    df_no_dist = df_valid.drop(columns=["DistrictID"])
    try:
        route_candidate2_predictions(
            eval_df=df_no_dist,
            stratum_models={},
            c2_locked_lambdas={},
            r_fallback_eval=np.array([0.0]),
            train_crop_counts={"Rice": 100},
            tax_crops={"Rice"},
            alpha_multiplier=1.0
        )
        assert False, "Expected ValueError when neither DistrictID nor District is present!"
    except ValueError as e:
        assert "DistrictID (or District)" in str(e), f"Unexpected error for missing District: {e}"
        print(f"  PASSED: Detected missing DistrictID/District -> raised schema error: {e}")

    # Test that having 'District' instead of 'DistrictID' passes schema validation
    df_with_dist = df_valid.rename(columns={"DistrictID": "District"})
    r_u, p_u, cases, statuses, counts = route_candidate2_predictions(
        eval_df=df_with_dist,
        stratum_models={},
        c2_locked_lambdas={},
        r_fallback_eval=np.array([0.0]),
        train_crop_counts={},  # unseen -> Case 3
        tax_crops={"Rice"},
        alpha_multiplier=1.0
    )
    assert cases[0] == 3
    print("  PASSED: 'District' accepted in lieu of 'DistrictID' without schema error.")
    print("  [SUCCESS] All Candidate 2 schema enforcement checks passed perfectly!")
    return True


def test_candidate2_fallback_precondition_assertions():
    print("===================================================================")
    print("Running Candidate 2 Pre-routing Precondition Unit Test")
    print("===================================================================")
    valid_row = {
        "State": "STATE_A",
        "DistrictID": "DIST_1",
        "Crop": "Rice",
        "Season": "Kharif",
        "Level_base": "State_District_Crop_Season",
        "Crop_Year": 2007,
        "district_normal_annual_rainfall_mm": 1000.0,
        "district_normal_monsoon_rainfall_mm": 800.0,
        "y_hat_base": 2.5,
        "N_tilde_cell": 10.0,
        "log_sigma2_cell": -0.5,
        "base_key_state_count": 1.0,
        "base_key_cross_state_collision": 0,
        "is_screened": False,
        "stratum": "Cereals & Millets"
    }
    df_eval = pd.DataFrame([valid_row, valid_row, valid_row])  # 3 rows

    # Test 1: r_fallback_eval is None
    try:
        route_candidate2_predictions(
            eval_df=df_eval,
            stratum_models={},
            c2_locked_lambdas={},
            r_fallback_eval=None,
            train_crop_counts={},
            tax_crops={"Rice"}
        )
        assert False, "Expected ValueError when r_fallback_eval is None"
    except ValueError as e:
        assert "r_fallback_eval is None" in str(e)
        print(f"  PASSED: Detected r_fallback_eval is None -> {e}")

    # Test 2: Length mismatch (2 entries for 3 evaluation rows)
    try:
        route_candidate2_predictions(
            eval_df=df_eval,
            stratum_models={},
            c2_locked_lambdas={},
            r_fallback_eval=np.array([0.1, 0.2]),  # len 2 != 3
            train_crop_counts={},
            tax_crops={"Rice"}
        )
        assert False, "Expected AssertionError on length mismatch"
    except AssertionError as e:
        assert "fallback prediction array length (2) != evaluation rows (3)" in str(e)
        print(f"  PASSED: Detected length mismatch -> {e}")

    # Test 3: Non-finite value NaN
    try:
        route_candidate2_predictions(
            eval_df=df_eval,
            stratum_models={},
            c2_locked_lambdas={},
            r_fallback_eval=np.array([0.1, np.nan, 0.2]),
            train_crop_counts={},
            tax_crops={"Rice"}
        )
        assert False, "Expected AssertionError on NaN fallback prediction"
    except AssertionError as e:
        assert "non-finite values" in str(e)
        print(f"  PASSED: Detected NaN in fallback predictions -> {e}")

    # Test 4: Non-finite value +inf
    try:
        route_candidate2_predictions(
            eval_df=df_eval,
            stratum_models={},
            c2_locked_lambdas={},
            r_fallback_eval=np.array([0.1, np.inf, 0.2]),
            train_crop_counts={},
            tax_crops={"Rice"}
        )
        assert False, "Expected AssertionError on +inf fallback prediction"
    except AssertionError as e:
        assert "non-finite values" in str(e)
        print(f"  PASSED: Detected +inf in fallback predictions -> {e}")

    # Test 5: Non-finite value -inf
    try:
        route_candidate2_predictions(
            eval_df=df_eval,
            stratum_models={},
            c2_locked_lambdas={},
            r_fallback_eval=np.array([-np.inf, 0.1, 0.2]),
            train_crop_counts={},
            tax_crops={"Rice"}
        )
        assert False, "Expected AssertionError on -inf fallback prediction"
    except AssertionError as e:
        assert "non-finite values" in str(e)
        print(f"  PASSED: Detected -inf in fallback predictions -> {e}")

    print("  [SUCCESS] All Candidate 2 fallback precondition assertions passed perfectly!")
    return True


def run_all_candidate2_fixture_tests():
    print("===================================================================")
    print("RUNNING COMPLETE CANDIDATE 2 PRODUCTION FIXTURE TEST SUITE")
    print("===================================================================")
    test_candidate2_fallback_routing_and_reconciliation()
    test_candidate2_missing_columns_schema_enforcement()
    test_candidate2_fallback_precondition_assertions()
    print("===================================================================")
    print("ALL CANDIDATE 2 PRODUCTION FIXTURE TESTS PASSED PERFECTLY (100%)")
    print("===================================================================")
    return True


if __name__ == "__main__":
    run_all_candidate2_fixture_tests()
