"""
FieldWise Phase 3C.5.2.2: Data Completeness Index (DCI) & Provenance Evaluator
=============================================================================
Formalizes the six orthogonal measurement domains, calculates the DCI score,
and classifies evidence into rigorous, uncalibrated confidence tiers and
formal epistemic provenance tiers:
  - INDEPENDENTLY_VERIFIED
  - SOURCE_REFERENCED
  - USER_DECLARED
  - ESTIMATED
  - PROVISIONAL
  - UNKNOWN

Strict Evidence Authority & Verification Invariants (Finding 3):
  - A station ID alone CANNOT establish independent verification.
  - A laboratory name alone CANNOT establish independent verification.
  - Requires an actual TrustedVerificationRecord from an accredited authority,
    matching observation/sample identifier, valid observation date/period,
    and official verification status.
  - User-provided strings or unverified metadata are NEVER promoted to
    INDEPENDENTLY_VERIFIED status (they remain USER_DECLARED).
  - Retains SOURCE_REFERENCED, USER_DECLARED, or UNKNOWN as appropriate.
  - Do not claim online source verification if no verification mechanism exists.

Weights:
  w_temporal   = 0.15
  w_climate    = 0.20
  w_water      = 0.25
  w_soil       = 0.15
  w_ph         = 0.10
  w_nutrients  = 0.15
  Sum          = 1.000

Rejection Boundary:
  DCI < 0.500 triggers INSUFFICIENT_DATA rejection before biological scoring.
"""

from typing import Dict, List, Tuple
from .schemas import (
    RecommendationQuery,
    DCIResult,
    ConfidenceTier,
    ProvenanceTier,
)
from .provenance_registry import TrustedVerificationRegistry


class DCIConfidenceEvaluator:
    """
    Evaluates query evidence completeness across the 6 orthogonal domains
    and establishes verified epistemic provenance tiers.
    """

    WEIGHTS = {
        "temporal": 0.15,
        "climate": 0.20,
        "water": 0.25,
        "soil": 0.15,
        "ph": 0.10,
        "nutrients": 0.15,
    }

    @classmethod
    def evaluate(cls, query: RecommendationQuery) -> DCIResult:
        """
        Calculates domain completeness scores c_k, weighted DCI, confidence tier,
        and domain provenance tiers.
        """
        c: Dict[str, float] = {}
        prov: Dict[str, ProvenanceTier] = {}
        measured: List[str] = []
        imputed: List[str] = []

        cw = query.climate_and_water
        ed = query.edaphic
        v_records = getattr(query, "verification_records", []) or []

        # ---------------------------------------------------------------------
        # 1. Temporal Domain (w1 = 0.15)
        # ---------------------------------------------------------------------
        # 1.00 for exact sowing date (YYYY-MM-DD); 0.60 for broad season/month only; 0.00 if omitted
        if query.temporal.sowing_date and len(query.temporal.sowing_date.split("-")) == 3:
            c["temporal"] = 1.00
            measured.append("sowing_date")
            # Provenance: Without operational cryptographic PKI public key verification,
            # user-provided dates cannot be awarded INDEPENDENTLY_VERIFIED.
            if getattr(ed, "source_reference", None) or getattr(cw, "source_reference", None):
                prov["temporal"] = ProvenanceTier.SOURCE_REFERENCED
            else:
                prov["temporal"] = ProvenanceTier.USER_DECLARED
        elif query.temporal.sowing_month is not None:
            c["temporal"] = 0.60
            imputed.append("broad_temporal_month_only")
            prov["temporal"] = ProvenanceTier.ESTIMATED
        else:
            c["temporal"] = 0.00
            imputed.append("temporal_omitted")
            prov["temporal"] = ProvenanceTier.UNKNOWN

        # ---------------------------------------------------------------------
        # 2. Climate Domain (w2 = 0.20)
        # ---------------------------------------------------------------------
        # 1.00 for measured temp and humidity; 0.50 for single parameter; 0.00 if omitted
        t_present = cw.temperature_mean is not None
        h_present = cw.relative_humidity is not None
        if t_present and h_present:
            c["climate"] = 1.00
            measured.append("temperature_and_humidity")
            if getattr(cw, "source_reference", None):
                prov["climate"] = ProvenanceTier.SOURCE_REFERENCED
            else:
                prov["climate"] = ProvenanceTier.USER_DECLARED
        elif t_present or h_present:
            c["climate"] = 0.50
            imputed.append("single_climate_parameter")
            prov["climate"] = ProvenanceTier.PROVISIONAL
        else:
            c["climate"] = 0.00
            imputed.append("climate_omitted")
            prov["climate"] = ProvenanceTier.UNKNOWN

        # ---------------------------------------------------------------------
        # 3. Water Domain (w3 = 0.25)
        # ---------------------------------------------------------------------
        is_rainfed = (
            cw.irrigation_access is None
            or cw.irrigation_access.lower() in ["none_rainfed", "rainfed", "none"]
        ) and (cw.irrigation_water_quantity_mm is None or cw.irrigation_water_quantity_mm <= 0.0)

        if is_rainfed:
            if cw.seasonal_rainfall_amount is not None:
                if cw.rainfall_source in ["IMD_Station_Gridded", "On_Farm_Rain_Gauge", "Gauged", "User_Gauge"]:
                    c["water"] = 1.00
                    measured.append("seasonal_rain_gauged")
                    if getattr(cw, "source_reference", None):
                        prov["water"] = ProvenanceTier.SOURCE_REFERENCED
                    else:
                        prov["water"] = ProvenanceTier.USER_DECLARED
                elif cw.rainfall_source in ["Farmer_Estimated", "Unverified_Estimate"]:
                    c["water"] = 0.60
                    imputed.append("estimated_unverified_rainfall")
                    prov["water"] = ProvenanceTier.ESTIMATED
                else:
                    # Missing rainfall source or is_gauged metadata: MUST NOT default to gauged!
                    c["water"] = 0.50
                    imputed.append("rainfall_provisional_unstated_source")
                    prov["water"] = ProvenanceTier.PROVISIONAL
            else:
                c["water"] = 0.00
                imputed.append("water_omitted")
                prov["water"] = ProvenanceTier.UNKNOWN
        else:
            if cw.irrigation_water_quantity_mm is not None and cw.irrigation_water_quantity_mm > 0.0:
                if cw.irrigation_quantity_basis in ["Measured_Flow_Meter", "Calibrated_V_Notch", "Flow_Meter"]:
                    c["water"] = 1.00
                    measured.append("measured_irrigation_flow_meter")
                    if getattr(cw, "source_reference", None):
                        prov["water"] = ProvenanceTier.SOURCE_REFERENCED
                    else:
                        prov["water"] = ProvenanceTier.USER_DECLARED
                elif cw.irrigation_quantity_basis in ["Estimated_Hours_Pump_Capacity", "Estimated_Hours", "Farmer_Estimated", "Uncalibrated_Estimate"]:
                    c["water"] = 0.75
                    imputed.append("estimated_irrigation_hours")
                    prov["water"] = ProvenanceTier.ESTIMATED
                else:
                    c["water"] = 0.60
                    imputed.append("irrigation_provisional_unstated_basis")
                    prov["water"] = ProvenanceTier.PROVISIONAL
            elif cw.irrigation_access and cw.irrigation_access.lower() not in ["none_rainfed", "rainfed", "none"]:
                c["water"] = 0.40
                imputed.append("unmeasured_irrigation_volume")
                prov["water"] = ProvenanceTier.PROVISIONAL
            else:
                c["water"] = 0.00
                imputed.append("water_omitted")
                prov["water"] = ProvenanceTier.UNKNOWN

        # ---------------------------------------------------------------------
        # 4. Soil Texture Domain (w4 = 0.15)
        # ---------------------------------------------------------------------
        if ed.soil_texture:
            tex_method = getattr(ed, "texture_measurement_method", None)
            is_reg = getattr(ed, "is_regional_estimate", False)
            if tex_method in ["Lab_Mechanical_Analysis", "Hydrometer_Pipette"]:
                c["soil"] = 1.00
                measured.append("soil_texture_lab_mechanical")
                if getattr(ed, "source_reference", None):
                    prov["soil"] = ProvenanceTier.SOURCE_REFERENCED
                else:
                    prov["soil"] = ProvenanceTier.USER_DECLARED
            elif tex_method in ["Field_Feel_Method", "Farmer_Stated"]:
                c["soil"] = 0.50
                imputed.append("field_feel_soil_texture")
                prov["soil"] = ProvenanceTier.ESTIMATED
            elif is_reg or tex_method in ["Regional_Map_Estimate"]:
                c["soil"] = 0.50
                imputed.append("regional_map_soil_texture")
                prov["soil"] = ProvenanceTier.ESTIMATED
            else:
                c["soil"] = 0.50
                imputed.append("soil_texture_provisional_unstated_method")
                prov["soil"] = ProvenanceTier.PROVISIONAL
        else:
            c["soil"] = 0.00
            imputed.append("soil_texture_omitted")
            prov["soil"] = ProvenanceTier.UNKNOWN

        # ---------------------------------------------------------------------
        # 5. Soil pH Domain (w5 = 0.10)
        # ---------------------------------------------------------------------
        if ed.soil_ph is not None:
            ph_method = getattr(ed, "ph_measurement_method", None)
            if ph_method in ["Lab_Potentiometric_1_2_5", "Certified_Lab"]:
                c["ph"] = 1.00
                measured.append("soil_ph_potentiometric_lab")
                if getattr(ed, "source_reference", None):
                    prov["ph"] = ProvenanceTier.SOURCE_REFERENCED
                else:
                    prov["ph"] = ProvenanceTier.USER_DECLARED
            elif ph_method in ["Field_Colorimetric_Strip", "Portable_Pocket_Pen", "Litmus_Paper", "Farmer_Stated"]:
                c["ph"] = 0.50
                imputed.append("field_strip_ph")
                prov["ph"] = ProvenanceTier.ESTIMATED
            elif ph_method in ["Regional_Map_Estimate"]:
                c["ph"] = 0.50
                imputed.append("regional_map_ph")
                prov["ph"] = ProvenanceTier.ESTIMATED
            else:
                c["ph"] = 0.50
                imputed.append("soil_ph_provisional_unstated_method")
                prov["ph"] = ProvenanceTier.PROVISIONAL
        else:
            c["ph"] = 0.00
            imputed.append("soil_ph_omitted")
            prov["ph"] = ProvenanceTier.UNKNOWN

        # ---------------------------------------------------------------------
        # 6. Nutrients Domain (w6 = 0.15)
        # ---------------------------------------------------------------------
        has_n = ed.soil_nitrogen is not None
        has_p = ed.soil_phosphorus is not None
        has_k = ed.soil_potassium is not None
        all_npk = has_n and has_p and has_k
        any_npk = has_n or has_p or has_k

        if ed.has_soil_test and all_npk:
            if ed.nutrient_basis == "SHC_Available_kg_ha":
                c["nutrients"] = 1.00
                if getattr(ed, "source_reference", None):
                    measured.append("shc_quantitative_npk_complete_sourced")
                    prov["nutrients"] = ProvenanceTier.SOURCE_REFERENCED
                elif ed.soil_test_source in ["Certified_Soil_Testing_Lab", "Certified_Lab"] or getattr(ed, "sample_id", None):
                    measured.append("shc_quantitative_npk_complete_user_declared")
                    prov["nutrients"] = ProvenanceTier.USER_DECLARED
                else:
                    c["nutrients"] = 0.75
                    imputed.append("shc_quantitative_npk_unstated_source")
                    prov["nutrients"] = ProvenanceTier.PROVISIONAL
            else:
                c["nutrients"] = 0.50
                imputed.append("shc_unverified_nutrient_basis")
                prov["nutrients"] = ProvenanceTier.PROVISIONAL
        elif ed.has_soil_test and any_npk:
            c["nutrients"] = 0.50
            imputed.append("shc_partial_nutrients_incomplete")
            prov["nutrients"] = ProvenanceTier.PROVISIONAL
        elif ed.nutrient_basis == "Qualitative_Fertility_Class":
            c["nutrients"] = 0.50
            imputed.append("qualitative_fertility")
            prov["nutrients"] = ProvenanceTier.ESTIMATED
        else:
            c["nutrients"] = 0.00
            imputed.append("nutrients_imputed_baseline")
            prov["nutrients"] = ProvenanceTier.UNKNOWN

        # ---------------------------------------------------------------------
        # Synthesis: DCI, Confidence Tier, Overall Provenance
        # ---------------------------------------------------------------------
        dci_score = sum(cls.WEIGHTS[k] * c[k] for k in cls.WEIGHTS)
        dci_score = round(dci_score, 3)

        # Classify Confidence Tier
        if dci_score < 0.500:
            tier = ConfidenceTier.INSUFFICIENT_DATA
        elif dci_score >= 0.90:
            tier = ConfidenceTier.HIGH_CONFIDENCE
        elif dci_score >= 0.80 and c["nutrients"] == 0.0:
            tier = ConfidenceTier.HIGH_CONFIDENCE_ESTIMATED_FERTILITY
        elif dci_score >= 0.70:
            tier = ConfidenceTier.MODERATE_ESTIMATED
        else:
            tier = ConfidenceTier.PROVISIONAL_EVALUATION

        # Classify Overall Provenance Tier
        active_prov = [v for k, v in prov.items() if c[k] > 0.0]
        if not active_prov:
            overall_prov = ProvenanceTier.UNKNOWN
        elif all(p == ProvenanceTier.SOURCE_REFERENCED for p in active_prov):
            overall_prov = ProvenanceTier.SOURCE_REFERENCED
        elif any(p == ProvenanceTier.USER_DECLARED for p in active_prov):
            overall_prov = ProvenanceTier.USER_DECLARED
        elif any(p == ProvenanceTier.ESTIMATED for p in active_prov):
            overall_prov = ProvenanceTier.ESTIMATED
        elif any(p == ProvenanceTier.PROVISIONAL for p in active_prov):
            overall_prov = ProvenanceTier.PROVISIONAL
        else:
            overall_prov = ProvenanceTier.UNKNOWN

        return DCIResult(
            dci_score=dci_score,
            domain_completeness=c,
            confidence_tier=tier,
            measured_dimensions=measured,
            imputed_dimensions=imputed,
            domain_provenance=prov,
            overall_provenance=overall_prov,
        )
