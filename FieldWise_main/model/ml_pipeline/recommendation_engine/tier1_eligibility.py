"""
FieldWise Phase 3C.5: Tier 1 Agronomic Eligibility & Safety Gating Module
========================================================================
Evaluates candidate crops against the five biological survival gates:
  1. Temporal & Regional Planting Window Gate
  2. Thermal Emergence & Germination Gate
  3. Edaphic Soil Texture Compatibility Gate
  4. Soil Reaction (pH) Physiological Survival Gate
  5. Water Sufficiency & Delivery Gate

Safety Invariants Enforced:
  - Rainfed screening thresholds NEVER independently produce Tier 1 FAIL.
  - Unmeasured irrigation returns UNKNOWN, maintaining conditional eligibility.
  - Soil pH rules are classified as SOFT_PENALTY in accordance with approved Phase 3C.4 baseline.
  - Hard exclusions are restricted to true physiological lethality.
"""

from typing import Dict, List, Optional, Tuple
from .schemas import (
    CropCatalogueEntry,
    PlantingWindowDefinition,
    RecommendationQuery,
    Tier1Status,
    Tier1GateResult,
    Tier1EvaluationResult,
    WaterGatingStatus,
    WaterAssessmentResult,
)
from .planting_window import PlantingWindowResolver
from .water_assessment import WaterAssessmentModule


class Tier1EligibilityEvaluator:
    """
    Evaluates whether a candidate crop qualifies biologically to enter Tier 2 scoring.
    """

    @classmethod
    def evaluate(
        cls,
        crop: CropCatalogueEntry,
        query: RecommendationQuery,
        water_result: WaterAssessmentResult,
        active_window: Optional[PlantingWindowDefinition],
        window_status: str,
        window_reason: str,
    ) -> Tier1EvaluationResult:
        """
        Executes all five biological survival gates.
        """
        gate_results: Dict[str, Tier1GateResult] = {}
        failing_rules: List[Dict[str, str]] = []
        warnings: List[str] = list(water_result.warnings)

        # ---------------------------------------------------------------------
        # Gate 1: Temporal & Planting Window Gate
        # ---------------------------------------------------------------------
        if window_status == "PASS":
            gate_results["G_season"] = Tier1GateResult("G_season", "PASS", window_reason)
        elif window_status == "UNKNOWN":
            gate_results["G_season"] = Tier1GateResult("G_season", "UNKNOWN", window_reason)
        else:
            gate_results["G_season"] = Tier1GateResult("G_season", "FAIL", window_reason)
            failing_rules.append({
                "rule_id": f"RULE-{crop.crop_id.upper()}-SEAS-01",
                "dimension": "planting_window",
                "reason": window_reason
            })

        # ---------------------------------------------------------------------
        # Gate 2: Thermal Emergence Gate
        # ---------------------------------------------------------------------
        t_mean = query.climate_and_water.temperature_mean
        t_min = query.climate_and_water.temperature_min_night
        t_max = query.climate_and_water.temperature_max_day

        thermal_reasons = []
        thermal_fail = False
        thermal_unknown = False

        # Evaluation of Mean Temperature
        if t_mean is None:
            thermal_unknown = True
            thermal_reasons.append("Mean temperature not provided.")
        elif t_mean < crop.sowing_temp_min_c:
            thermal_fail = True
            reason = (
                f"{crop.canonical_name}: Mean temperature ({t_mean}°C) is below minimum lethal "
                f"germination threshold ({crop.sowing_temp_min_c}°C). Severe chilling/frost emergence failure."
            )
            thermal_reasons.append(reason)
            failing_rules.append({
                "rule_id": f"RULE-{crop.crop_id.upper()}-TEMP-01",
                "dimension": "thermal_emergence",
                "reason": reason
            })
        elif t_mean > crop.sowing_temp_max_c:
            thermal_fail = True
            reason = (
                f"{crop.canonical_name}: Mean temperature ({t_mean}°C) exceeds maximum lethal "
                f"emergence threshold ({crop.sowing_temp_max_c}°C). Extreme seedling heat scorch and desiccation."
            )
            thermal_reasons.append(reason)
            failing_rules.append({
                "rule_id": f"RULE-{crop.crop_id.upper()}-TEMP-01",
                "dimension": "thermal_emergence",
                "reason": reason
            })
        else:
            thermal_reasons.append(
                f"{crop.canonical_name}: Mean temperature ({t_mean}°C) within survival limits [{crop.sowing_temp_min_c}, {crop.sowing_temp_max_c}]°C."
            )

        # Evaluation of Diurnal Extremes (Night Min and Day Max)
        # Strict Phase 3C.5.2 Evidence Integrity:
        # Never apply unsupported universal crop-group thresholds.
        # A hard exclusion requires crop-specific, context-appropriate evidence of 100% biological mortality.
        # Where evidence is insufficient, use WARNING_ONLY or UNKNOWN.
        # Preserve the distinction between biological emergence viability (Tier 1) and commercial suitability (Tier 2).
        if t_min is not None:
            if crop.crop_id in ["banana", "mango"] and t_min < 0.0:
                # Documented lethal freezing cellular collapse for tropical tree/herbaceous perennials
                thermal_fail = True
                reason = (
                    f"{crop.canonical_name}: Night minimum temperature ({t_min}°C) indicates sub-zero freezing "
                    "frost (<0.0°C). Lethal pseudostem/graft necrosis in frost-intolerant tropical perennial."
                )
                thermal_reasons.append(reason)
                failing_rules.append({
                    "rule_id": f"RULE-{crop.crop_id.upper()}-FROST-01",
                    "dimension": "thermal_extreme_cold",
                    "reason": reason
                })
            elif t_min < 2.0 and crop.crop_id in ["banana", "mango", "sugarcane", "cotton", "rice"]:
                warnings.append(
                    f"{crop.canonical_name}: Severe chilling warning: Night minimum temperature ({t_min}°C) drops below 2.0°C; severe growth arrest and chilling injury risk."
                )
            elif t_min < 5.0:
                warnings.append(
                    f"{crop.canonical_name}: Chilling risk warning: Night minimum temperature ({t_min}°C) drops below 5.0°C; emergence delay possible."
                )
            elif t_min < 0.0:
                warnings.append(
                    f"{crop.canonical_name}: Sub-freezing night temperature ({t_min}°C) detected; severe vegetative frost hazard, frost protection advised."
                )
        else:
            thermal_reasons.append("Diurnal minimum not supplied; evaluated on mean temperature.")

        if t_max is not None:
            # Daytime high temperatures:
            # Wheat, Chickpea, and other rabi crops suffer heat stress at T_max > 32°C / 36°C, but do not
            # suffer 100% emergence death when T_mean is within biological limits.
            # Preserved as WARNING_ONLY (and Tier 2 Liebig suitability penalty), NOT a Tier 1 hard exclusion!
            if crop.crop_id in ["wheat", "potato", "lentil", "chickpea", "barley", "mustard"] and t_max > 36.0:
                warnings.append(
                    f"{crop.canonical_name}: Severe heat stress warning: Daytime maximum temperature ({t_max}°C) exceeds 36.0°C for cool-season rabi crop; reproductive desiccation risk."
                )
            elif crop.crop_id in ["wheat", "potato", "lentil", "chickpea", "barley", "mustard"] and t_max > 32.0:
                warnings.append(
                    f"{crop.canonical_name}: Heat stress warning: Daytime maximum temperature ({t_max}°C) exceeds optimal rabi vegetative limit (>32.0°C)."
                )
            elif t_max > 42.0:
                warnings.append(
                    f"{crop.canonical_name}: Extreme daytime heat ({t_max}°C) detected; canopy scorching and reproductive abortion risk."
                )
        else:
            thermal_reasons.append("Diurnal maximum not supplied; evaluated on mean temperature.")

        if thermal_fail:
            gate_results["G_thermal"] = Tier1GateResult("G_thermal", "FAIL", " | ".join(thermal_reasons))
        elif thermal_unknown:
            gate_results["G_thermal"] = Tier1GateResult("G_thermal", "UNKNOWN", " | ".join(thermal_reasons))
        else:
            gate_results["G_thermal"] = Tier1GateResult("G_thermal", "PASS", " | ".join(thermal_reasons))

        # ---------------------------------------------------------------------
        # Gate 3: Edaphic Soil Texture Gate
        # ---------------------------------------------------------------------
        soil_tex = query.edaphic.soil_texture
        if not soil_tex:
            gate_results["G_soil"] = Tier1GateResult("G_soil", "UNKNOWN", "Soil texture not provided.")
        else:
            # Check if texture is strictly restricted (lethal physical impedance)
            is_restricted = any(tex.lower() == soil_tex.lower() for tex in crop.restricted_soil_textures)
            if is_restricted:
                reason = (
                    f"{crop.canonical_name}: Soil texture '{soil_tex}' is in restricted class "
                    f"({', '.join(crop.restricted_soil_textures)}). Incompatible physical aeration/drainage."
                )
                gate_results["G_soil"] = Tier1GateResult("G_soil", "FAIL", reason)
                failing_rules.append({
                    "rule_id": f"RULE-{crop.crop_id.upper()}-SOIL-01",
                    "dimension": "soil_texture",
                    "reason": reason
                })
            else:
                gate_results["G_soil"] = Tier1GateResult(
                    "G_soil", "PASS",
                    f"{crop.canonical_name}: Soil texture '{soil_tex}' compatible."
                )

        # ---------------------------------------------------------------------
        # Gate 4: Soil Reaction (pH) Survival Gate
        # ---------------------------------------------------------------------
        # Strict Phase 3C.5.2.2.1 Agronomic Evidence Standard (Finding 1):
        # Uses approved Phase 3C.4 eligibility classifications as authoritative baseline.
        # All 19 crops in Phase 3C.4 (reports/phase_3c_4_eligibility_rules.csv and
        # reports/phase_3c_4_2_hard_exclusion_evidence_audit.csv) are classified as SOFT_PENALTY.
        # Rules classified SOFT_PENALTY must NEVER become HARD_EXCLUSION.
        #
        # - Sub-optimal soil pH induces nutrient chlorosis and yield loss rather than 100% biological
        #   emergence mortality; handled via Tier 2 soft penalties and management advisories.
        # - When soil pH is outside a crop's preferred range [soil_ph_min, soil_ph_max], the crop
        #   PASSES Tier 1 with WARNING_ONLY and receives non-compensatory Liebig suitability penalties in Tier 2.
        # - No unsupported universal or crop-specific lethal pH hard exclusions remain.
        # - Severe environmental hostility (e.g. pH >= 9.0 sodicity dispersion or pH <= 4.5 severe acidity)
        #   is evaluated in Tier 2 and ranking where depressed suitability triggers NO_RECOMMENDATION_SUITABLE
        #   with appropriate soil reclamation advisories (Gypsum / Lime).
        soil_ph = query.edaphic.soil_ph
        if soil_ph is None:
            gate_results["G_ph"] = Tier1GateResult("G_ph", "UNKNOWN", "Soil pH not provided.")
        else:
            if soil_ph < crop.soil_ph_min or soil_ph > crop.soil_ph_max:
                gate_results["G_ph"] = Tier1GateResult(
                    "G_ph", "PASS",
                    f"{crop.canonical_name}: Soil pH ({soil_ph}) outside preferred agronomic range [{crop.soil_ph_min}, {crop.soil_ph_max}] (classified as SOFT_PENALTY in Phase 3C.4 specification; evaluated in Tier 2)."
                )
                warnings.append(
                    f"{crop.canonical_name}: Soil pH ({soil_ph}) outside preferred agronomic range [{crop.soil_ph_min}, {crop.soil_ph_max}]. Yield depression and micronutrient deficiency possible (evaluated with soft penalty in Tier 2)."
                )
            else:
                gate_results["G_ph"] = Tier1GateResult(
                    "G_ph", "PASS",
                    f"{crop.canonical_name}: Soil pH ({soil_ph}) within preferred agronomic range [{crop.soil_ph_min}, {crop.soil_ph_max}]."
                )

            if soil_ph >= 9.0:
                warnings.append(
                    f"Severe soil sodicity/alkalinity hazard (pH {soil_ph} >= 9.0): chemical gypsum application and leaching required."
                )
            elif soil_ph <= 4.5:
                warnings.append(
                    f"Severe soil acidity hazard (pH {soil_ph} <= 4.5): agricultural lime application required."
                )

        # ---------------------------------------------------------------------
        # Gate 5: Water Survival Gate
        # ---------------------------------------------------------------------
        # Strictly enforces Phase 3C.4.2.2.1:
        # Rainfed screening thresholds NEVER cause hard exclusion or Tier 1 FAIL.
        w_status = water_result.water_gating_status
        if w_status == WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK:
            gate_results["G_water"] = Tier1GateResult(
                "G_water", "UNKNOWN",
                f"{crop.canonical_name}: Irrigation access confirmed but delivered volume unmeasured."
            )
        elif w_status == WaterGatingStatus.TEMPORAL_MISMATCH_PROVISIONAL:
            gate_results["G_water"] = Tier1GateResult(
                "G_water", "UNKNOWN",
                f"{crop.canonical_name}: Irrigation measurement period incompatible with crop duration."
            )
        elif w_status == WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK:
            gate_results["G_water"] = Tier1GateResult(
                "G_water", "PASS",  # Passed Tier 1 gating with soft penalty downstream
                f"{crop.canonical_name}: Water deficit flagged; eligible with high water risk and Tier 2 penalty."
            )
        else:
            gate_results["G_water"] = Tier1GateResult(
                "G_water", "PASS",
                f"{crop.canonical_name}: Water assessment criteria satisfied ({w_status.value})."
            )

        # ---------------------------------------------------------------------
        # Synthesize Overall Tier 1 Status
        # ---------------------------------------------------------------------
        has_fail = any(g.status == "FAIL" for g in gate_results.values())
        has_unknown = any(g.status == "UNKNOWN" for g in gate_results.values())

        if has_fail:
            overall = Tier1Status.DISQUALIFIED
        elif has_unknown or w_status in [
            WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK,
            WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK,
            WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE,
            WaterGatingStatus.TEMPORAL_MISMATCH_PROVISIONAL,
        ]:
            overall = Tier1Status.CONDITIONALLY_ELIGIBLE
        else:
            overall = Tier1Status.ELIGIBLE

        return Tier1EvaluationResult(
            overall_status=overall,
            gate_results=gate_results,
            failing_rules=failing_rules,
            warnings=warnings,
        )
