"""
FieldWise Phase 3C.6.2.1.1: Python Recommendation Engine Adapter CLI
====================================================================
Standalone command-line interface connecting external caller processes
(such as the Node.js backend bridge) to the frozen Phase 3C.5 Recommendation Engine.

Execution Protocol:
  - stdin:  Reads a single JSON request object.
  - stdout: Emits a single valid JSON object containing the complete RecommendationResult.
  - stderr: Emits operational logs, diagnostics, and error stack traces.
  - Exit code: 0 on successful engine evaluation (including SUCCESS, INSUFFICIENT_DATA,
               NO_RECOMMENDATION_SUITABLE).
               Nonzero (1) on malformed JSON, validation failure, engine crash, or serialization error.

Mandatory Safety Invariants Enforced (Phase 3C.6.2.1.1 Closure):
  1. Rainfall Semantics:
     - Generic 'rainfall' without an explicit, established period classification remains unclassified
       and NEVER enters seasonal calculations.
     - Only an explicitly identified seasonal rainfall value may populate seasonal_rainfall_amount.
     - Annual rainfall (annual_rainfall, Annual_Estimated) never enters seasonal or effective rainfall.
     - Preserves annual rainfall context without ambiguous text parsing.
     - Handles zero correctly without truthiness pitfalls.
  2. Strict Boolean Validation:
     - has_soil_test and has_stcr_calibration must accept actual JSON booleans only (type is bool).
     - Strictly rejects strings ('true', 'false'), numeric values (0, 1), and other types.
     - Never uses Python bool() coercion.
  3. Strict Sowing-Month Validation:
     - Sowing month must be an actual JSON integer between 1 and 12.
     - Strictly rejects booleans (True/False), floats (10.0, 10.9), and numeric strings ('10').
  4. Irrigation Semantics:
     - Explicit 'None_Rainfed' and 'rainfed' map to 'None_Rainfed'.
     - Missing, blank, and 'UNKNOWN' remain unknown (None or UNKNOWN).
     - Generic 'none' is NEVER treated as an explicit rainfed declaration.
     - Preserves valid explicit irrigation categories.
  5. Numeric Safety:
     - Strictly rejects NaN and positive/negative infinity for every numeric input.
     - Strictly rejects non-finite or negative elements in monthly_rainfall.
     - Enforces non-negativity and domain bounds.
  6. Verification Records:
     - Rejects malformed verification-record structures instead of silently ignoring them.
     - User-provided lab names, IDs, or checkbox values never establish independent verification.
"""

import sys
import os
import json
import math
import enum
import traceback
import dataclasses
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple

# Enable relative, recommendation_engine package, and absolute project imports
try:
    from .schemas import (
        RecommendationQuery,
        RecommendationResult,
        LocationInput,
        TemporalInput,
        ClimateWaterInput,
        EdaphicInput,
        ExecutionStatus,
        TrustedVerificationRecord,
    )
    from .engine import CropRecommendationEngine
    from .input_validator import InputValidationError
except (ImportError, ValueError):
    current_file = Path(__file__).resolve()
    engine_dir = current_file.parent
    ml_pipeline_dir = engine_dir.parent
    project_root = ml_pipeline_dir.parent.parent.parent

    for path_dir in [str(ml_pipeline_dir), str(project_root)]:
        if path_dir not in sys.path:
            sys.path.insert(0, path_dir)

    try:
        from recommendation_engine.schemas import (
            RecommendationQuery,
            RecommendationResult,
            LocationInput,
            TemporalInput,
            ClimateWaterInput,
            EdaphicInput,
            ExecutionStatus,
            TrustedVerificationRecord,
        )
        from recommendation_engine.engine import CropRecommendationEngine
        from recommendation_engine.input_validator import InputValidationError
    except ImportError:
        from FieldWise_main.model.ml_pipeline.recommendation_engine.schemas import (
            RecommendationQuery,
            RecommendationResult,
            LocationInput,
            TemporalInput,
            ClimateWaterInput,
            EdaphicInput,
            ExecutionStatus,
            TrustedVerificationRecord,
        )
        from FieldWise_main.model.ml_pipeline.recommendation_engine.engine import CropRecommendationEngine
        from FieldWise_main.model.ml_pipeline.recommendation_engine.input_validator import InputValidationError


class AdapterValidationError(ValueError):
    """Raised when adapter-level schema or safety validation fails."""
    pass


def _get_first_present(d1: Dict[str, Any], d2: Dict[str, Any], *keys: str) -> Tuple[bool, Any]:
    """
    Safely retrieves the first matching key present in d1 then d2 whose value is not None.
    Avoids truthiness pitfalls so 0, 0.0, False, and empty strings are preserved correctly.
    """
    for k in keys:
        if k in d1 and d1[k] is not None:
            return True, d1[k]
    for k in keys:
        if k in d2 and d2[k] is not None:
            return True, d2[k]
    return False, None


def _parse_strict_bool(val: Any, field_name: str) -> bool:
    """
    Validates that a field is an actual JSON boolean (True or False).
    Strictly rejects strings ('true', 'false'), numbers (0, 1), and other types.
    """
    if type(val) is not bool:
        raise AdapterValidationError(
            f"Invalid boolean value for '{field_name}': {val!r}. "
            f"Must be an actual JSON boolean (true or false), got {type(val).__name__}."
        )
    return val


def _parse_strict_positive_int(val: Any, field_name: str) -> int:
    """
    Validates that a value is an actual JSON integer greater than zero.
    Strictly rejects booleans (True/False), floats (including 10.0 and 10.9),
    strings, None, and non-positive integers (<= 0).
    """
    if type(val) is not int or isinstance(val, bool):
        raise AdapterValidationError(
            f"Invalid '{field_name}': {val!r}. Must be an actual JSON integer > 0, got {type(val).__name__}."
        )
    if val <= 0:
        raise AdapterValidationError(
            f"Invalid '{field_name}': {val}. Value must be a positive integer greater than zero."
        )
    return val


def _parse_finite_float(
    val: Any,
    field_name: str,
    min_val: Optional[float] = None,
    max_val: Optional[float] = None,
) -> float:
    """
    Parses a float, strictly rejecting booleans, NaN, and +/- infinity,
    and validating sensible domain bounds.
    """
    if type(val) is bool:
        raise AdapterValidationError(
            f"Invalid numeric value for '{field_name}': boolean {val} is not a valid number."
        )
    try:
        f = float(val)
    except (ValueError, TypeError):
        raise AdapterValidationError(
            f"Invalid numeric value for '{field_name}': {val!r} is not a valid number."
        )
    if not math.isfinite(f):
        raise AdapterValidationError(
            f"Invalid numeric value for '{field_name}': non-finite number {val!r} (NaN or infinity) is rejected."
        )
    if min_val is not None and f < min_val:
        raise AdapterValidationError(
            f"Invalid numeric value for '{field_name}': {f} is below minimum allowed {min_val}."
        )
    if max_val is not None and f > max_val:
        raise AdapterValidationError(
            f"Invalid numeric value for '{field_name}': {f} is above maximum allowed {max_val}."
        )
    return f


def build_query(payload: Dict[str, Any]) -> RecommendationQuery:
    """
    Constructs a validated RecommendationQuery from a request payload dictionary.
    Supports both nested domain objects and flat top-level parameters.
    Enforces all Phase 3C.6.2.1.1 safety mandates.
    """
    if not isinstance(payload, dict):
        raise AdapterValidationError(
            f"Request payload must be a JSON object dictionary, got {type(payload).__name__}."
        )

    # 1. Extract domain sub-dictionaries (supports flat and nested structures)
    loc_dict = payload.get("location") if isinstance(payload.get("location"), dict) else payload
    temp_dict = payload.get("temporal") if isinstance(payload.get("temporal"), dict) else payload
    clim_dict = (
        payload.get("climate_and_water")
        if isinstance(payload.get("climate_and_water"), dict)
        else (payload.get("climate") if isinstance(payload.get("climate"), dict) else payload)
    )
    ed_dict = (
        payload.get("edaphic")
        if isinstance(payload.get("edaphic"), dict)
        else (payload.get("soil") if isinstance(payload.get("soil"), dict) else payload)
    )

    # 2. Location Input Validation
    has_state, raw_state = _get_first_present(loc_dict, payload, "state")
    if not has_state or raw_state is None or not str(raw_state).strip():
        raise AdapterValidationError("Missing required input: 'state' is mandatory.")
    state = str(raw_state).strip()

    has_dist, raw_dist = _get_first_present(loc_dict, payload, "district")
    district = str(raw_dist).strip() if (has_dist and raw_dist is not None) else None

    has_zone, raw_zone = _get_first_present(loc_dict, payload, "agro_climatic_zone", "agroZone")
    agro_zone = str(raw_zone).strip() if (has_zone and raw_zone is not None) else None

    location = LocationInput(
        state=state,
        district=district,
        agro_climatic_zone=agro_zone,
    )

    # 3. Temporal Input Validation (Strict Sowing-Month Integer 1-12)
    has_month, raw_month = _get_first_present(temp_dict, payload, "sowing_month")
    if not has_month or raw_month is None:
        raise AdapterValidationError("Missing required input: 'sowing_month' is mandatory.")
    if type(raw_month) is not int:
        raise AdapterValidationError(
            f"Invalid 'sowing_month': {raw_month!r}. Must be an actual JSON integer between 1 and 12, got {type(raw_month).__name__}."
        )
    if raw_month < 1 or raw_month > 12:
        raise AdapterValidationError(
            f"Invalid 'sowing_month': {raw_month}. Must be an integer between 1 and 12."
        )
    sowing_month = raw_month

    has_date, raw_date = _get_first_present(temp_dict, payload, "sowing_date")
    sowing_date = str(raw_date).strip() if (has_date and raw_date is not None) else None

    has_season, raw_season = _get_first_present(temp_dict, payload, "cultivation_season")
    cultivation_season = str(raw_season).strip() if (has_season and raw_season is not None) else None

    has_system, raw_system = _get_first_present(temp_dict, payload, "planting_system")
    planting_system = str(raw_system).strip() if (has_system and raw_system is not None) else None

    temporal = TemporalInput(
        sowing_month=sowing_month,
        sowing_date=sowing_date,
        cultivation_season=cultivation_season,
        planting_system=planting_system,
    )

    # 4. Climate and Water Input Validation
    # 4.1 Irrigation Semantics:
    # Explicit "None_Rainfed" and "rainfed" map to "None_Rainfed".
    # Missing, blank, and "UNKNOWN" remain unknown (None or UNKNOWN).
    # Generic "none" is NOT treated as an explicit rainfed declaration.
    has_irr, raw_irr = _get_first_present(clim_dict, payload, "irrigation_access")
    if not has_irr or raw_irr is None:
        irrigation_access = None
    else:
        irr_str = str(raw_irr).strip()
        if not irr_str or irr_str.upper() == "UNKNOWN":
            irrigation_access = None
        elif irr_str.lower() in ["none_rainfed", "rainfed"]:
            irrigation_access = "None_Rainfed"
        elif irr_str.lower() == "none":
            # Generic "none" must NOT be treated as an explicit rainfed declaration
            irrigation_access = None
        else:
            # Preserve valid explicit irrigation categories
            irrigation_access = irr_str

    # 4.2 Rainfall Semantics and Deterministic Conflict Policy:
    # - Generic 'rainfall' without an established period classification remains unclassified and never enters seasonal calculations.
    # - 'Crop_Season_Measured' + generic 'rainfall' populates seasonal_rainfall_amount.
    # - Aliases 'seasonal_rainfall_amount' and 'seasonal_rainfall_mm' are accepted and checked for conflicts.
    # - Annual rainfall (annual_rainfall, annual_rainfall_amount, annual_rainfall_mm) never enters seasonal calculations.
    # - Annual rainfall and explicit seasonal rainfall supplied together preserves annual context in source_reference
    #   while evaluating seasonal_rainfall_amount from the seasonal value alone.
    # - Conflicting alias values, conflicting generic vs explicit values, or conflicting period types are strictly rejected.
    has_source_ref, raw_source_ref = _get_first_present(clim_dict, payload, "source_reference")
    source_ref = str(raw_source_ref).strip() if (has_source_ref and raw_source_ref is not None) else None

    has_period, raw_period = _get_first_present(clim_dict, payload, "rainfall_period_type")
    period_type = str(raw_period).strip() if (has_period and raw_period is not None) else None

    # Step A: Validate explicit seasonal rainfall aliases
    has_s_amt, raw_s_amt = _get_first_present(clim_dict, payload, "seasonal_rainfall_amount")
    has_s_mm, raw_s_mm = _get_first_present(clim_dict, payload, "seasonal_rainfall_mm")

    val_s_amt = _parse_finite_float(raw_s_amt, "seasonal_rainfall_amount", min_val=0.0, max_val=12000.0) if has_s_amt else None
    val_s_mm = _parse_finite_float(raw_s_mm, "seasonal_rainfall_mm", min_val=0.0, max_val=12000.0) if has_s_mm else None

    if val_s_amt is not None and val_s_mm is not None:
        if abs(val_s_amt - val_s_mm) > 1e-4:
            raise AdapterValidationError(
                f"Conflicting values provided for 'seasonal_rainfall_amount' ({val_s_amt}) and 'seasonal_rainfall_mm' ({val_s_mm})."
            )
        explicit_seasonal_val: Optional[float] = val_s_amt
    elif val_s_amt is not None:
        explicit_seasonal_val = val_s_amt
    elif val_s_mm is not None:
        explicit_seasonal_val = val_s_mm
    else:
        explicit_seasonal_val = None

    # Step B: Validate annual rainfall aliases
    has_ann_1, raw_ann_1 = _get_first_present(clim_dict, payload, "annual_rainfall")
    has_ann_2, raw_ann_2 = _get_first_present(clim_dict, payload, "annual_rainfall_amount")
    has_ann_3, raw_ann_3 = _get_first_present(clim_dict, payload, "annual_rainfall_mm")

    ann_vals = []
    if has_ann_1:
        ann_vals.append(("annual_rainfall", _parse_finite_float(raw_ann_1, "annual_rainfall", min_val=0.0)))
    if has_ann_2:
        ann_vals.append(("annual_rainfall_amount", _parse_finite_float(raw_ann_2, "annual_rainfall_amount", min_val=0.0)))
    if has_ann_3:
        ann_vals.append(("annual_rainfall_mm", _parse_finite_float(raw_ann_3, "annual_rainfall_mm", min_val=0.0)))

    if len(ann_vals) > 1:
        first_name, first_val = ann_vals[0]
        for other_name, other_val in ann_vals[1:]:
            if abs(first_val - other_val) > 1e-4:
                raise AdapterValidationError(
                    f"Conflicting values provided for annual rainfall aliases: '{first_name}' ({first_val}) vs '{other_name}' ({other_val})."
                )
        explicit_annual_val: Optional[float] = first_val
    elif len(ann_vals) == 1:
        explicit_annual_val = ann_vals[0][1]
    else:
        explicit_annual_val = None

    # Step C: Extract generic rainfall if present
    has_gen_rf, raw_gen_rf = _get_first_present(clim_dict, payload, "rainfall")
    gen_rf_val = _parse_finite_float(raw_gen_rf, "rainfall", min_val=0.0, max_val=12000.0) if has_gen_rf else None

    # Step D: Enforce Deterministic Conflict Policy and Period Classification
    # 1. Prohibit declaring period_type == "Annual_Estimated" when explicit seasonal rainfall is supplied
    if explicit_seasonal_val is not None and period_type == "Annual_Estimated":
        raise AdapterValidationError(
            "Conflicting rainfall specification: 'rainfall_period_type' is set to 'Annual_Estimated', "
            f"but explicit seasonal rainfall ({explicit_seasonal_val} mm) was provided. "
            "Annual rainfall cannot be converted to seasonal rainfall."
        )

    # 2. Reconcile generic rainfall with explicit values and period types
    if gen_rf_val is not None:
        if period_type == "Crop_Season_Measured":
            if explicit_seasonal_val is not None and abs(explicit_seasonal_val - gen_rf_val) > 1e-4:
                raise AdapterValidationError(
                    f"Conflicting rainfall values: generic 'rainfall' ({gen_rf_val}) conflicts with "
                    f"explicit seasonal rainfall ({explicit_seasonal_val})."
                )
            if explicit_seasonal_val is None:
                explicit_seasonal_val = gen_rf_val
        elif period_type == "Annual_Estimated":
            if explicit_annual_val is not None and abs(explicit_annual_val - gen_rf_val) > 1e-4:
                raise AdapterValidationError(
                    f"Conflicting annual rainfall values: generic 'rainfall' ({gen_rf_val}) conflicts with "
                    f"explicit annual rainfall ({explicit_annual_val})."
                )
            if explicit_annual_val is None:
                explicit_annual_val = gen_rf_val
        else:
            # Unclassified generic rainfall without an established period type
            if explicit_seasonal_val is not None and abs(explicit_seasonal_val - gen_rf_val) > 1e-4:
                raise AdapterValidationError(
                    f"Conflicting rainfall values: generic 'rainfall' ({gen_rf_val}) conflicts with "
                    f"explicit seasonal rainfall ({explicit_seasonal_val})."
                )
            # If no explicit seasonal rainfall was provided, generic rainfall remains unclassified!
            # It must NEVER enter seasonal calculations.
            if explicit_seasonal_val is None and explicit_annual_val is None:
                context_note = f"Unclassified Rainfall Context: {gen_rf_val} mm"
                source_ref = f"{source_ref}; {context_note}" if source_ref else context_note

    # 3. Preserve Annual Rainfall Context (Annual rainfall NEVER enters seasonal_rainfall_amount)
    if explicit_annual_val is not None:
        context_note = f"Annual Rainfall Context: {explicit_annual_val} mm"
        source_ref = f"{source_ref}; {context_note}" if source_ref else context_note
        if period_type is None and explicit_seasonal_val is None:
            period_type = "Annual_Estimated"

    # 4. Final Seasonal Rainfall Assignment
    # A seasonal rainfall alias establishes the rainfall period, not the evidence source or measurement status.
    # When rainfall_period_type is omitted, it must remain unprovided (None) and never be implicitly labeled Crop_Season_Measured.
    seasonal_rainfall_amount = explicit_seasonal_val

    # Monthly rainfall list validation
    has_mrf, raw_mrf = _get_first_present(clim_dict, payload, "monthly_rainfall")
    monthly_rf: Optional[List[float]] = None
    if has_mrf and raw_mrf is not None:
        if not isinstance(raw_mrf, list):
            raise AdapterValidationError("monthly_rainfall must be a list of numeric values.")
        monthly_rf = []
        for idx, elem in enumerate(raw_mrf):
            val = _parse_finite_float(elem, f"monthly_rainfall[{idx}]", min_val=0.0)
            monthly_rf.append(val)

    # Irrigation water quantity
    has_iqty, raw_iqty = _get_first_present(clim_dict, payload, "irrigation_water_quantity_mm")
    irr_water_qty = _parse_finite_float(raw_iqty, "irrigation_water_quantity_mm", min_val=0.0) if has_iqty else None

    # Temperature parameters
    has_tmean, raw_tmean = _get_first_present(clim_dict, payload, "temperature_mean", "temperature")
    temp_mean = _parse_finite_float(raw_tmean, "temperature_mean", min_val=-20.0, max_val=60.0) if has_tmean else None

    has_tmin, raw_tmin = _get_first_present(clim_dict, payload, "temperature_min_night")
    temp_min_night = _parse_finite_float(raw_tmin, "temperature_min_night", min_val=-20.0, max_val=50.0) if has_tmin else None

    has_tmax, raw_tmax = _get_first_present(clim_dict, payload, "temperature_max_day")
    temp_max_day = _parse_finite_float(raw_tmax, "temperature_max_day", min_val=0.0, max_val=60.0) if has_tmax else None

    # Humidity parameter
    has_hum, raw_hum = _get_first_present(clim_dict, payload, "relative_humidity", "humidity")
    humidity = _parse_finite_float(raw_hum, "relative_humidity", min_val=0.0, max_val=100.0) if has_hum else None

    # Soil moisture parameters
    has_smoist, raw_smoist = _get_first_present(clim_dict, payload, "soil_moisture_mm")
    soil_moist_mm = _parse_finite_float(raw_smoist, "soil_moisture_mm", min_val=0.0) if has_smoist else None

    has_awc, raw_awc = _get_first_present(clim_dict, payload, "awc_mm_m")
    awc_mm_m = _parse_finite_float(raw_awc, "awc_mm_m", min_val=0.0) if has_awc else None

    has_root, raw_root = _get_first_present(clim_dict, payload, "rooting_depth_m")
    rooting_depth_m = _parse_finite_float(raw_root, "rooting_depth_m", min_val=0.0) if has_root else None

    # Period days (Strict whole-day positive integer validation)
    has_i_days, raw_i_days = _get_first_present(clim_dict, payload, "irrigation_period_days")
    i_days = _parse_strict_positive_int(raw_i_days, "irrigation_period_days") if has_i_days else None

    has_r_days, raw_r_days = _get_first_present(clim_dict, payload, "rainfall_period_days")
    r_days = _parse_strict_positive_int(raw_r_days, "rainfall_period_days") if has_r_days else None

    has_tier, raw_tier = _get_first_present(clim_dict, payload, "soil_moisture_tier")
    soil_moisture_tier = str(raw_tier).strip() if (has_tier and raw_tier is not None) else "UNKNOWN"

    has_src, raw_src = _get_first_present(clim_dict, payload, "rainfall_source")
    rainfall_source = str(raw_src).strip() if (has_src and raw_src is not None) else None

    has_qbasis, raw_qbasis = _get_first_present(clim_dict, payload, "irrigation_quantity_basis")
    irrigation_quantity_basis = str(raw_qbasis).strip() if (has_qbasis and raw_qbasis is not None) else None

    has_itype, raw_itype = _get_first_present(clim_dict, payload, "irrigation_type")
    irrigation_type = str(raw_itype).strip() if (has_itype and raw_itype is not None) else None

    has_station, raw_station = _get_first_present(clim_dict, payload, "station_id")
    station_id = str(raw_station).strip() if (has_station and raw_station is not None) else None

    has_mstart, raw_mstart = _get_first_present(clim_dict, payload, "measurement_date_start")
    m_start = str(raw_mstart).strip() if (has_mstart and raw_mstart is not None) else None

    has_mend, raw_mend = _get_first_present(clim_dict, payload, "measurement_date_end")
    m_end = str(raw_mend).strip() if (has_mend and raw_mend is not None) else None

    has_meter, raw_meter = _get_first_present(clim_dict, payload, "irrigation_meter_id")
    irrigation_meter_id = str(raw_meter).strip() if (has_meter and raw_meter is not None) else None

    climate_and_water = ClimateWaterInput(
        seasonal_rainfall_amount=seasonal_rainfall_amount,
        rainfall_period_type=period_type,
        rainfall_source=rainfall_source,
        monthly_rainfall=monthly_rf,
        irrigation_access=irrigation_access,  # Explicitly None or declared string
        irrigation_water_quantity_mm=irr_water_qty,
        irrigation_quantity_basis=irrigation_quantity_basis,
        irrigation_type=irrigation_type,
        irrigation_period_days=i_days,
        rainfall_period_days=r_days,
        temperature_mean=temp_mean,
        temperature_min_night=temp_min_night,
        temperature_max_day=temp_max_day,
        relative_humidity=humidity,
        soil_moisture_tier=soil_moisture_tier,
        soil_moisture_mm=soil_moist_mm,
        awc_mm_m=awc_mm_m,
        rooting_depth_m=rooting_depth_m,
        station_id=station_id,
        measurement_date_start=m_start,
        measurement_date_end=m_end,
        irrigation_meter_id=irrigation_meter_id,
        source_reference=source_ref,
    )

    # 5. Edaphic Input Validation
    has_tex, raw_tex = _get_first_present(ed_dict, payload, "soil_texture", "soilType")
    soil_tex = str(raw_tex).strip() if (has_tex and raw_tex is not None) else None

    has_ph, raw_ph = _get_first_present(ed_dict, payload, "soil_ph", "ph")
    soil_ph = _parse_finite_float(raw_ph, "soil_ph", min_val=2.0, max_val=12.0) if has_ph else None

    # Strict Boolean Validation for has_soil_test
    has_shc_flag, raw_shc = _get_first_present(ed_dict, payload, "has_soil_test")
    if has_shc_flag:
        has_shc = _parse_strict_bool(raw_shc, "has_soil_test")
    else:
        has_shc = False

    has_n, raw_n = _get_first_present(ed_dict, payload, "soil_nitrogen", "nitrogen")
    n_val = _parse_finite_float(raw_n, "soil_nitrogen", min_val=0.0) if has_n else None

    has_p, raw_p = _get_first_present(ed_dict, payload, "soil_phosphorus", "phosphorus")
    p_val = _parse_finite_float(raw_p, "soil_phosphorus", min_val=0.0) if has_p else None

    has_k, raw_k = _get_first_present(ed_dict, payload, "soil_potassium", "potassium")
    k_val = _parse_finite_float(raw_k, "soil_potassium", min_val=0.0) if has_k else None

    has_oc, raw_oc = _get_first_present(ed_dict, payload, "organic_carbon_pct", "organic_carbon", "organicCarbon")
    oc_val = _parse_finite_float(raw_oc, "organic_carbon_pct", min_val=0.0, max_val=100.0) if has_oc else None

    has_tmethod, raw_tmethod = _get_first_present(ed_dict, payload, "texture_measurement_method")
    tex_method = str(raw_tmethod).strip() if (has_tmethod and raw_tmethod is not None) else None

    has_phmethod, raw_phmethod = _get_first_present(ed_dict, payload, "ph_measurement_method")
    ph_method = str(raw_phmethod).strip() if (has_phmethod and raw_phmethod is not None) else None

    has_stsource, raw_stsource = _get_first_present(ed_dict, payload, "soil_test_source")
    st_source = str(raw_stsource).strip() if (has_stsource and raw_stsource is not None) else None

    has_nbasis, raw_nbasis = _get_first_present(ed_dict, payload, "nutrient_basis")
    nbasis = str(raw_nbasis).strip() if (has_nbasis and raw_nbasis is not None) else None

    has_lab_num, raw_lab_num = _get_first_present(ed_dict, payload, "lab_accreditation_number")
    lab_num = str(raw_lab_num).strip() if (has_lab_num and raw_lab_num is not None) else None

    has_sample, raw_sample = _get_first_present(ed_dict, payload, "sample_id")
    sample_id = str(raw_sample).strip() if (has_sample and raw_sample is not None) else None

    has_tdate, raw_tdate = _get_first_present(ed_dict, payload, "test_date", "lastTestedDate")
    tdate = str(raw_tdate).strip() if (has_tdate and raw_tdate is not None) else None

    has_edref, raw_edref = _get_first_present(ed_dict, payload, "edaphic_source_reference", "source_reference")
    ed_ref = str(raw_edref).strip() if (has_edref and raw_edref is not None) else None

    edaphic = EdaphicInput(
        soil_texture=soil_tex,
        texture_measurement_method=tex_method,
        soil_ph=soil_ph,
        ph_measurement_method=ph_method,
        has_soil_test=has_shc,
        soil_test_source=st_source,
        nutrient_basis=nbasis,
        soil_nitrogen=n_val,
        soil_phosphorus=p_val,
        soil_potassium=k_val,
        organic_carbon_pct=oc_val,
        lab_accreditation_number=lab_num,
        sample_id=sample_id,
        test_date=tdate,
        source_reference=ed_ref,
    )

    # 6. RecommendationQuery Construction & STCR Validation
    has_stcrid, raw_stcrid = _get_first_present(payload, payload, "stcr_calibration_id")
    stcr_id = str(raw_stcrid).strip() if (has_stcrid and raw_stcrid is not None) else None

    has_tyield, raw_tyield = _get_first_present(payload, payload, "target_yield_t_ha")
    target_yield = _parse_finite_float(raw_tyield, "target_yield_t_ha", min_val=0.01) if has_tyield else None

    # Strict Boolean Validation for has_stcr_calibration
    has_stcr_flag, raw_stcr = _get_first_present(payload, payload, "has_stcr_calibration")
    if has_stcr_flag:
        has_stcr = _parse_strict_bool(raw_stcr, "has_stcr_calibration")
    else:
        has_stcr = False

    # 7. Verification Records Validation
    has_vrecords, raw_v_records = _get_first_present(payload, payload, "verification_records")
    v_records: List[TrustedVerificationRecord] = []
    if has_vrecords and raw_v_records is not None:
        if not isinstance(raw_v_records, list):
            raise AdapterValidationError(
                f"Invalid 'verification_records': must be a list, got {type(raw_v_records).__name__}."
            )
        required_v_fields = [
            "verification_authority_id",
            "authority_name",
            "source_identifier",
            "observation_or_sample_id",
            "verification_status",
            "applicable_date_start",
            "applicable_date_end",
        ]
        for idx, rec in enumerate(raw_v_records):
            if isinstance(rec, TrustedVerificationRecord):
                v_records.append(rec)
            elif isinstance(rec, dict):
                missing = [f for f in required_v_fields if f not in rec or not str(rec[f]).strip()]
                if missing:
                    raise AdapterValidationError(
                        f"Malformed verification record at index {idx}: missing required field(s): {', '.join(missing)}."
                    )
                try:
                    v_records.append(TrustedVerificationRecord(**rec))
                except TypeError as e:
                    raise AdapterValidationError(
                        f"Malformed verification record at index {idx}: invalid arguments: {e}"
                    )
            else:
                raise AdapterValidationError(
                    f"Malformed verification record at index {idx}: expected dict, got {type(rec).__name__}."
                )

    return RecommendationQuery(
        location=location,
        temporal=temporal,
        climate_and_water=climate_and_water,
        edaphic=edaphic,
        stcr_calibration_id=stcr_id,
        target_yield_t_ha=target_yield,
        has_stcr_calibration=has_stcr,
        verification_records=v_records,
    )


def serialize_result(res: RecommendationResult) -> Dict[str, Any]:
    """
    Recursively converts a RecommendationResult dataclass into a JSON-serializable dictionary,
    converting all internal Enum instances to their respective primitive values.
    """
    def _convert(val: Any) -> Any:
        if isinstance(val, enum.Enum):
            return val.value
        elif dataclasses.is_dataclass(val):
            return _convert(dataclasses.asdict(val))
        elif isinstance(val, dict):
            return {k: _convert(v) for k, v in val.items()}
        elif isinstance(val, list):
            return [_convert(v) for v in val]
        return val

    raw_dict = dataclasses.asdict(res)
    return _convert(raw_dict)


def main(args: Optional[List[str]] = None) -> int:
    """
    CLI execution entry point.
    Reads JSON from stdin, invokes the engine, serializes result to stdout.
    All error diagnostics are strictly directed to stderr.
    """
    try:
        raw_input = sys.stdin.read()
    except Exception as e:
        sys.stderr.write(f"ERROR: Failed to read stdin: {e}\n")
        return 1

    if not raw_input or not raw_input.strip():
        sys.stderr.write("ERROR: Empty input received on stdin. Expected JSON request object.\n")
        return 1

    try:
        payload = json.loads(raw_input)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"ERROR: Malformed JSON input: {e}\n")
        return 1

    if not isinstance(payload, dict):
        sys.stderr.write(
            f"ERROR: Request payload must be a JSON object dictionary, got {type(payload).__name__}.\n"
        )
        return 1

    try:
        query = build_query(payload)
    except (AdapterValidationError, InputValidationError, ValueError, TypeError) as e:
        sys.stderr.write(f"VALIDATION ERROR: {e}\n")
        return 1
    except Exception as e:
        sys.stderr.write(f"UNEXPECTED VALIDATION ERROR: {type(e).__name__}: {e}\n")
        traceback.print_exc(file=sys.stderr)
        return 1

    try:
        engine = CropRecommendationEngine()
        result = engine.recommend(query)
    except Exception as e:
        sys.stderr.write(f"ENGINE EXECUTION ERROR: {type(e).__name__}: {e}\n")
        traceback.print_exc(file=sys.stderr)
        return 1

    # Check for engine-level validation rejection
    if result.status == ExecutionStatus.VALIDATION_ERROR:
        err_msg = result.diagnostics.get("error", "Engine rejected query as invalid.")
        sys.stderr.write(f"ENGINE VALIDATION ERROR: {err_msg}\n")
        return 1

    try:
        output_dict = serialize_result(result)
        json_str = json.dumps(output_dict, indent=2, allow_nan=False)
        sys.stdout.write(json_str)
        sys.stdout.write("\n")
        sys.stdout.flush()
        return 0
    except Exception as e:
        sys.stderr.write(f"SERIALIZATION ERROR: {type(e).__name__}: {e}\n")
        traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
