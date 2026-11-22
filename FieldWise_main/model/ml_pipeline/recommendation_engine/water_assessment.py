"""
FieldWise Phase 3C.5: Decoupled Water Accounting & Assessment Module
===================================================================
Implements the six decoupled water concepts approved in Phase 3C.4.2.2.1:
  1. Crop Evapotranspiration (ETc min & optimal)
  2. Effective Rainfall (monthly USDA-SCS aggregation & runoff partitioning)
  3. Net Irrigation Requirement (NIR)
  4. Gross Irrigation Applied (GIR) with application efficiency (eta)
  5. Decoupled Rainfed Screening Semantics (SCREENING_THRESHOLD_MET vs PASS_VERIFIED)
  6. Residual Soil Moisture Accounting across 4 Epistemic Tiers (Vertisol storage)

Strict Safety Mandates:
  - Direct application of monthly equations to seasonal aggregates is strictly prohibited.
  - Rainfed screening thresholds NEVER cause hard exclusion or Tier 1 FAIL.
  - Empirical models (USDA-SCS) produce provisional status, never PASS_VERIFIED.
  - Unmeasured irrigation returns UNKNOWN water outcome; never invents flat 120 mm / 600 mm.
  - Segregates Net and Gross units cleanly in all calculations.
"""

from typing import Tuple, List, Optional, Dict
from .schemas import (
    CropCatalogueEntry,
    PlantingWindowDefinition,
    ClimateWaterInput,
    WaterAssessmentResult,
    WaterGatingStatus,
    SoilMoistureEpistemicTier,
)

# Application efficiency by irrigation method
IRRIGATION_EFFICIENCY_MAP = {
    "drip_micro": 0.90,
    "drip": 0.90,
    "micro": 0.90,
    "sprinkler": 0.75,
    "surface_furrow": 0.70,
    "furrow": 0.70,
    "border_flood": 0.70,
    "basin": 0.70,
    "canal_gravity": 0.70,
    "tubewell_borewell": 0.70,
    "open_well": 0.70,
    "tank_surface": 0.70,
}


class WaterAssessmentModule:
    """
    Evaluates water availability and sufficiency using decoupled physical accounting.
    """

    @classmethod
    def calculate_monthly_usda_scs(cls, monthly_rainfall: List[float]) -> Tuple[float, float, List[float]]:
        """
        Calculates monthly effective rainfall using USDA-SCS empirical equations:
          For P_m <= 250 mm: P_eff,m = P_m * (125.0 - 0.2 * P_m) / 125.0
          For P_m > 250 mm:  P_eff,m = 125.0 + 0.1 * P_m
        Returns (total_peff_mm, total_runoff_loss_mm, monthly_peff_list).
        """
        monthly_peff: List[float] = []
        for p in monthly_rainfall:
            if p <= 0.0:
                peff = 0.0
            elif p <= 250.0:
                peff = p * (125.0 - 0.2 * p) / 125.0
            else:
                peff = 125.0 + 0.1 * p
            monthly_peff.append(round(peff, 2))

        total_gross = sum(monthly_rainfall)
        total_peff = round(sum(monthly_peff), 2)
        runoff_loss = round(max(0.0, total_gross - total_peff), 2)
        return total_peff, runoff_loss, monthly_peff

    @classmethod
    def get_application_efficiency(cls, irrigation_type: Optional[str], irrigation_access: Optional[str]) -> float:
        """Resolves application efficiency eta_appl."""
        if irrigation_type:
            norm = irrigation_type.strip().lower()
            if norm in IRRIGATION_EFFICIENCY_MAP:
                return IRRIGATION_EFFICIENCY_MAP[norm]
        if irrigation_access:
            norm = irrigation_access.strip().lower()
            if norm in IRRIGATION_EFFICIENCY_MAP:
                return IRRIGATION_EFFICIENCY_MAP[norm]
        return 0.70  # Default surface furrow / border flood baseline

    @classmethod
    def assess_water(
        cls,
        crop: CropCatalogueEntry,
        climate_water: ClimateWaterInput,
        active_window: Optional[PlantingWindowDefinition],
        soil_texture: Optional[str] = None,
    ) -> WaterAssessmentResult:
        """
        Performs full decoupled water assessment for a candidate crop.
        """
        warnings: List[str] = []
        cw = climate_water

        # 1. Determine Irrigation Management Regime
        is_rainfed = (
            cw.irrigation_access is None
            or cw.irrigation_access.lower() in ["none_rainfed", "rainfed", "none"]
        ) and (cw.irrigation_water_quantity_mm is None or cw.irrigation_water_quantity_mm <= 0.0)

        crop_duration = active_window.crop_duration_days if active_window else 120
        rainfed_thresh = crop.rainfed_threshold_mm if crop.rainfed_threshold_mm > 0 else crop.min_seasonal_water_mm
        etc_min = crop.min_seasonal_water_mm
        etc_opt = crop.optimal_seasonal_water_mm

        # 2. Temporal Compatibility Check (TEST-16 & Phase 3C.5.1 Finding 1)
        is_temporal_mismatch = False
        if cw.irrigation_period_days is not None and cw.rainfall_period_days is not None:
            if cw.irrigation_period_days != cw.rainfall_period_days:
                is_temporal_mismatch = True
                warnings.append(
                    f"Temporal mismatch: Irrigation measurement period ({cw.irrigation_period_days} days) "
                    f"does not match rainfall measurement period ({cw.rainfall_period_days} days). "
                    "Water quantities cannot be aggregated into a single effective balance."
                )

        if cw.irrigation_period_days is not None and cw.irrigation_period_days < crop_duration:
            is_temporal_mismatch = True
            warnings.append(
                f"Temporal mismatch: Irrigation measurement period ({cw.irrigation_period_days} days) is less than "
                f"crop duration ({crop_duration} days). Evaluation marked provisional."
            )

        if cw.rainfall_period_days is not None and cw.rainfall_period_days < crop_duration and not is_rainfed:
            is_temporal_mismatch = True
            warnings.append(
                f"Temporal mismatch: Rainfall measurement period ({cw.rainfall_period_days} days) is less than "
                f"crop duration ({crop_duration} days)."
            )

        # 3. Residual Soil Moisture Accounting in Vertisols (TEST-14, Example D)
        soil_moisture_accounted = 0.0
        soil_tier = SoilMoistureEpistemicTier.UNKNOWN
        is_vertisol = soil_texture and soil_texture.strip().lower() in ["black vertisol", "clay", "deep vertisol"]

        if is_vertisol:
            awc = cw.awc_mm_m if cw.awc_mm_m is not None else 200.0
            rooting_depth = cw.rooting_depth_m if cw.rooting_depth_m is not None else 1.2
            vertisol_profile_capacity = round(awc * rooting_depth, 2)
            if cw.soil_moisture_mm is not None and cw.soil_moisture_mm > 0.0:
                soil_moisture_accounted = cw.soil_moisture_mm
                soil_tier = SoilMoistureEpistemicTier.MEASURED
            elif cw.soil_moisture_tier and cw.soil_moisture_tier.upper() == "SOURCE_BACKED_ESTIMATED":
                soil_moisture_accounted = round(0.70 * vertisol_profile_capacity, 2)
                soil_tier = SoilMoistureEpistemicTier.SOURCE_BACKED_ESTIMATED
            else:
                soil_moisture_accounted = 0.0
                soil_tier = SoilMoistureEpistemicTier.UNKNOWN
                warnings.append(
                    f"Deep Vertisol profile capacity is {vertisol_profile_capacity} mm (AWC {awc} mm/m * {rooting_depth} m). "
                    "Unmeasured profile soil moisture is not fabricated."
                )

        # 4. Effective Rainfall Calculation (STRICT SAFETY MANDATE)
        # NEVER apply monthly USDA-SCS equation directly to an aggregated seasonal total!
        peff_total: Optional[float] = None
        runoff_loss: Optional[float] = None

        if cw.monthly_rainfall is not None and len(cw.monthly_rainfall) > 0:
            peff_total, runoff_loss, _ = cls.calculate_monthly_usda_scs(cw.monthly_rainfall)
            if runoff_loss > 0.0:
                warnings.append(
                    f"Hydrological loss partitioning: {runoff_loss} mm ({round(runoff_loss/sum(cw.monthly_rainfall)*100, 1)}%) "
                    "lost to surface runoff and deep drainage under USDA-SCS model."
                )
        elif cw.rainfall_period_type == "Monthly_Measured" or (cw.rainfall_period_days is not None and cw.rainfall_period_days <= 31):
            # Single-month window measured (e.g. November Western Disturbance)
            p = cw.seasonal_rainfall_amount if cw.seasonal_rainfall_amount is not None else 0.0
            if p <= 250.0:
                peff_total = round(p * (125.0 - 0.2 * p) / 125.0, 2)
            else:
                peff_total = round(125.0 + 0.1 * p, 2)
            runoff_loss = round(max(0.0, p - peff_total), 2)
        elif cw.seasonal_rainfall_amount is not None:
            # Multi-month seasonal aggregate without monthly distribution:
            # STRICTLY PROHIBITED from applying monthly USDA-SCS formula!
            peff_total = None  # UNKNOWN effective rainfall
            runoff_loss = None
            warnings.append(
                f"Monthly rainfall breakdown unavailable for seasonal total ({cw.seasonal_rainfall_amount} mm). "
                "Direct application of USDA-SCS monthly equation to seasonal aggregates is prohibited. "
                "Effective rainfall is designated as UNKNOWN / unmeasured / provisional."
            )

        # 5. Case Evaluation: Rainfed vs Irrigated
        if is_rainfed:
            p_season = cw.seasonal_rainfall_amount if cw.seasonal_rainfall_amount is not None else 0.0
            total_water = p_season + soil_moisture_accounted

            if is_temporal_mismatch:
                gating_status = WaterGatingStatus.TEMPORAL_MISMATCH_PROVISIONAL
                prov_score = 65.0
            elif p_season >= rainfed_thresh:
                # Screening threshold met - NEVER automatic PASS_VERIFIED!
                gating_status = WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE
                prov_score = 90.0 if p_season >= etc_opt else 80.0
            else:
                # Below threshold - WATER_DEFICIT_WARNING, never Tier 1 hard exclusion!
                gating_status = WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK
                # Liebig soft penalty score
                prov_score = round(10.0 + 40.0 * max(0.0, total_water / rainfed_thresh), 2)
                warnings.append(
                    f"Rainfed seasonal moisture ({p_season} mm) is below screening threshold ({rainfed_thresh} mm). "
                    "Assigned WATER_DEFICIT_WARNING with Tier 2 soft penalty."
                )

            deficit_opt = round(max(0.0, etc_opt - total_water), 2)
            deficit_min = round(max(0.0, rainfed_thresh - total_water), 2)

            return WaterAssessmentResult(
                water_gating_status=gating_status,
                effective_rainfall_mm=peff_total,
                net_irrigation_delivered_mm=0.0,
                gross_irrigation_applied_mm=0.0,
                total_net_water_mm=round(total_water, 2),
                deficit_against_optimal_mm=deficit_opt,
                deficit_against_min_mm=deficit_min,
                runoff_and_drainage_loss_mm=runoff_loss,
                irrigation_efficiency=0.0,
                soil_moisture_accounted_mm=soil_moisture_accounted,
                soil_moisture_tier=soil_tier,
                provisional_water_score=prov_score,
                warnings=warnings,
            )

        # Irrigated Management
        eta = cls.get_application_efficiency(cw.irrigation_type, cw.irrigation_access)
        gir = cw.irrigation_water_quantity_mm

        if gir is None:
            # Confirmed irrigation access, but unmeasured depth (TEST-03, TEST-10, Example C)
            gating_status = WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK
            warnings.append(
                f"Irrigation access indicated ({cw.irrigation_access}), but delivered volumetric depth is unmeasured. "
                "Water sufficiency evaluated as UNKNOWN; candidate received provisional baseline score."
            )
            return WaterAssessmentResult(
                water_gating_status=gating_status,
                effective_rainfall_mm=peff_total,
                net_irrigation_delivered_mm=None,
                gross_irrigation_applied_mm=None,
                total_net_water_mm=None,
                deficit_against_optimal_mm=None,
                deficit_against_min_mm=None,
                runoff_and_drainage_loss_mm=runoff_loss,
                irrigation_efficiency=eta,
                soil_moisture_accounted_mm=soil_moisture_accounted,
                soil_moisture_tier=soil_tier,
                provisional_water_score=70.0,  # Approved unmeasured irrigation baseline
                warnings=warnings,
            )

        # Measured Gross Irrigation Delivered
        nir_delivered = round(gir * eta, 2)
        has_measured_peff = peff_total is not None
        effective_rain = peff_total if has_measured_peff else 0.0
        total_net_water = round(nir_delivered + effective_rain + soil_moisture_accounted, 2)

        if not has_measured_peff and cw.seasonal_rainfall_amount is not None:
            warnings.append(
                f"Rainfall was provided ({cw.seasonal_rainfall_amount} mm) but monthly distribution is missing. "
                "Effective rainfall is excluded from root-zone net water; evaluation reflects net irrigation delivery only."
            )

        deficit_opt = round(max(0.0, etc_opt - total_net_water), 2)
        deficit_min = round(max(0.0, etc_min - total_net_water), 2)

        if is_temporal_mismatch:
            gating_status = WaterGatingStatus.TEMPORAL_MISMATCH_PROVISIONAL
        elif total_net_water >= etc_min:
            # Satisfies minimum physiological ETc
            gating_status = WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE
        else:
            gating_status = WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK
            warnings.append(
                f"Total net root-zone water ({total_net_water} mm) is below crop minimum ETc ({etc_min} mm)."
            )

        # Calculate score for irrigated crop
        if total_net_water >= etc_opt:
            irr_score = 100.0
        elif total_net_water >= etc_min:
            irr_score = round(100.0 * ((total_net_water - etc_min) / (etc_opt - etc_min)) ** 0.75, 2)
        else:
            irr_score = round(10.0 + 40.0 * max(0.0, total_net_water / etc_min), 2)

        return WaterAssessmentResult(
            water_gating_status=gating_status,
            effective_rainfall_mm=peff_total,
            net_irrigation_delivered_mm=nir_delivered,
            gross_irrigation_applied_mm=round(gir, 2),
            total_net_water_mm=total_net_water,
            deficit_against_optimal_mm=deficit_opt,
            deficit_against_min_mm=deficit_min,
            runoff_and_drainage_loss_mm=runoff_loss,
            irrigation_efficiency=eta,
            soil_moisture_accounted_mm=soil_moisture_accounted,
            soil_moisture_tier=soil_tier,
            provisional_water_score=irr_score,
            warnings=warnings,
        )
