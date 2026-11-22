"""
FieldWise Phase 3C.5.2.1: Explanation & Warning Generation Module
================================================================
Generates transparent, evidence-backed agronomic justifications,
Liebig limiting-factor diagnostics, risk advisories, and safe
fertilizer guidance adhering strictly to Phase 3C.4 specifications.

Key Safety Mandates (Finding 2):
  - A Boolean has_stcr_calibration and target yield value are strictly
    insufficient to establish verified STCR status.
  - Requires a structured calibration record (STCRCalibrationRecord) with:
    unique calibration ID, crop/region applicability, source institution,
    publication reference, calibration coefficients, target yield range,
    and validation status/evidence.
  - Validates that the record matches the requested crop and region.
  - Missing or mismatched calibration must NEVER produce VERIFIED_STCR_GENERATED
    (falls back to BASELINE_RDF_ARITHMETIC).
  - Commercial fertilizer bag quantities are strictly WITHHELD when
    laboratory soil-test data is unavailable or incomplete.
  - When soil test is available, stoichiometric DAP nitrogen credit (18%)
    is deducted before computing supplementary Urea.
"""

from typing import List, Dict, Optional, Tuple, Any
from .schemas import (
    CropCatalogueEntry,
    RecommendationQuery,
    PlantingWindowDefinition,
    WaterAssessmentResult,
    Tier2Components,
    FertilizerPrescription,
    WaterGatingStatus,
    STCRCalibrationRecord,
)
from .stcr_registry import STCRCalibrationRegistry


class ExplanationGenerator:
    """
    Produces plain-language agronomic rationales, warnings, and fertilizer schedules.
    """

    @classmethod
    def identify_limiting_factor(cls, components: Tier2Components) -> Tuple[str, float]:
        """Identifies the minimum physical factor depressing suitability via Liebig rule."""
        factors = {
            "Water adequacy": components.water_score,
            "Climate / temperature": components.climate_score,
            "Soil texture": components.soil_score,
            "Soil pH reaction": components.ph_score,
        }
        min_factor = min(factors, key=factors.get)
        return min_factor, factors[min_factor]

    @classmethod
    def generate_advisory(
        cls,
        crop: CropCatalogueEntry,
        query: RecommendationQuery,
        components: Tier2Components,
        water_result: WaterAssessmentResult,
        active_window: Optional[PlantingWindowDefinition],
    ) -> List[str]:
        advisory: List[str] = []

        # 1. Window advisory
        if active_window:
            advisory.append(
                f"Optimal {active_window.planting_system} sowing window ({active_window.sowing_date_range}) "
                f"active in {active_window.region_or_zone}."
            )

        # 2. Liebig limiting factor diagnostic
        min_fac, min_val = cls.identify_limiting_factor(components)
        if min_val < 75.0:
            advisory.append(
                f"Liebig Limiting Factor: {min_fac} (sub-score {min_val}/100) is the primary constraint depressing overall yield potential."
            )

        # 3. Water management advisory
        if water_result.water_gating_status == WaterGatingStatus.SCREENING_THRESHOLD_MET:
            advisory.append("Gross seasonal rainfall meets rainfed screening threshold. Maintain field bunds to conserve soil moisture.")
        elif water_result.water_gating_status == WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK:
            advisory.append("Acute water deficit flagged. Recommend protective supplemental irrigation or drought-tolerant cultivar selection.")
        elif water_result.water_gating_status == WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK:
            advisory.append("Irrigation volume is unmeasured. Verify tubewell / canal flow rate prior to input procurement.")

        # 4. Soil texture advisory
        if query.edaphic.soil_texture:
            if query.edaphic.soil_texture in crop.preferred_soil_textures:
                advisory.append(f"{query.edaphic.soil_texture} soil provides optimal drainage and aeration for root proliferation.")

        return advisory

    @classmethod
    def generate_risk_warnings(
        cls,
        crop: CropCatalogueEntry,
        query: RecommendationQuery,
        components: Tier2Components,
        water_result: WaterAssessmentResult,
    ) -> List[str]:
        warnings: List[str] = list(water_result.warnings)
        t_mean = query.climate_and_water.temperature_mean
        ph = query.edaphic.soil_ph

        # Temperature warnings
        if t_mean is not None:
            if t_mean > 35.0:
                warnings.append(
                    f"Thermal Stress Notice: Mean temperature ({t_mean}°C) approaches upper heat threshold. "
                    "Risk of flower shedding, anthesis desiccation, and reduced grain fill."
                )
            elif t_mean < 15.0 and crop.sowing_temp_min_c > 12.0:
                warnings.append(
                    f"Cold Stress Notice: Low temperature ({t_mean}°C) may retard vegetative emergence."
                )

        # Soil pH warnings
        if ph is not None:
            if ph > crop.soil_ph_max:
                warnings.append(
                    f"Alkalinity/Sodicity Warning: Soil pH ({ph}) exceeds preferred maximum ({crop.soil_ph_max}). "
                    "Zinc, iron, and phosphorus availability may be restricted."
                )
            elif ph < crop.soil_ph_min:
                warnings.append(
                    f"Soil Acidity Warning: Soil pH ({ph}) below preferred minimum ({crop.soil_ph_min}). "
                    "Lime application recommended to neutralize potential aluminum toxicity."
                )

        return warnings

    @classmethod
    def validate_stcr_calibration(
        cls,
        record: Optional[STCRCalibrationRecord],
        crop_id: str,
        query_state: str,
        target_yield: Optional[float],
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        """
        Validates STCR Targeted Yield Calibration Record (Finding 2).
        Enforces strict constraints:
          1. Record must exist in official STCRCalibrationRegistry (v2026.1-OFFICIAL).
          2. User input CANNOT promote an unregistered record to verified status.
          3. Canonical coefficients and metadata must NOT be tampered with.
          4. Crop ID must match evaluated candidate crop.
          5. Applicable regions must include query state or 'All India'.
          6. Target yield must be provided and within calibrated [min, max] range.
        """
        if record is None:
            return False, "Missing STCR calibration record: boolean flag or target yield alone cannot establish calibration.", None

        # Verify integrity against official STCRCalibrationRegistry
        is_int_valid, int_reason, canonical = STCRCalibrationRegistry.validate_record_integrity(record)
        if not is_int_valid or canonical is None:
            return False, int_reason, None

        # Crop applicability check
        if canonical.crop_id.strip().lower() != crop_id.strip().lower():
            return False, f"Crop mismatch: calibration '{canonical.calibration_id}' applies to '{canonical.crop_id}', not evaluated crop '{crop_id}'.", None

        # Regional applicability check
        reg_clean = [r.strip().lower() for r in canonical.applicable_regions]
        state_clean = query_state.strip().lower()
        if state_clean not in reg_clean and "all india" not in reg_clean and "all_india" not in reg_clean:
            return False, f"Region mismatch: calibration '{canonical.calibration_id}' applies to {canonical.applicable_regions}, not query state '{query_state}'.", None

        # Target yield applicability check
        if target_yield is None:
            return False, f"Target yield (t/ha) not specified for STCR targeted yield calculation under '{canonical.calibration_id}'.", None

        if target_yield < canonical.target_yield_min_t_ha or target_yield > canonical.target_yield_max_t_ha:
            return False, (
                f"Target yield ({target_yield} t/ha) outside calibrated validity range "
                f"[{canonical.target_yield_min_t_ha}, {canonical.target_yield_max_t_ha}] t/ha for '{canonical.calibration_id}'."
            ), None

        details = {
            "calibration_id": canonical.calibration_id,
            "crop_id": canonical.crop_id,
            "applicable_regions": canonical.applicable_regions,
            "source_institution": canonical.source_institution,
            "publication_reference": canonical.publication_reference,
            "coefficients": canonical.coefficients,
            "coefficient_units": canonical.coefficient_units,
            "target_yield_t_ha": target_yield,
            "validation_status": canonical.validation_status,
            "validation_evidence": canonical.validation_evidence,
            "registry_version": canonical.registry_version,
        }
        return True, "STCR calibration verified against official registry.", details

    @classmethod
    def generate_fertilizer_prescription(
        cls,
        crop: CropCatalogueEntry,
        query: RecommendationQuery,
    ) -> FertilizerPrescription:
        """
        Enforces Phase 3C.5.2.1 Fertilizer Safety Mandates:
          1. Withholds commercial bag prescriptions when soil test is missing, incomplete,
             or on an unverified nutrient basis. A soil-test flag and one nutrient value
             are strictly insufficient.
          2. Requires structured STCRCalibrationRecord for VERIFIED_STCR_GENERATED.
             Missing or mismatched calibration falls back to BASELINE_RDF_ARITHMETIC.
          3. When complete laboratory SHC test (N, P, K on SHC_Available_kg_ha basis) is provided,
             computes balanced fertilizer products with mandatory 18% DAP nitrogen credit deduction.
        """
        ed = query.edaphic
        rdf = crop.rdf_n_p2o5_k2o_kg_ha

        # Baseline RDF: [N, P2O5, K2O]
        if len(rdf) >= 3:
            dose_n, dose_p, dose_k = rdf[0], rdf[1], rdf[2]
        else:
            dose_n, dose_p, dose_k = 100.0, 50.0, 50.0

        # Case 1: Soil test completely absent
        if not ed.has_soil_test:
            return FertilizerPrescription(
                status="WITHHELD_MISSING_SOIL_TEST",
                rdf_n_p2o5_k2o_kg_ha=[dose_n, dose_p, dose_k],
                adjusted_dose_kg_ha=None,
                commercial_products={},
                stoichiometric_notes=(
                    "Commercial fertilizer product quantities are withheld because verified laboratory Soil Health Card "
                    "readings are unavailable. Prescribing physical fertilizer bags without soil testing risks severe "
                    "vegetative lodging, blast disease, and nitrate pollution."
                ),
                disclaimers=[
                    "Advisory Only: Baseline state Package of Practices (POP) RDF shown in kg/ha.",
                    "Obtain a certified laboratory soil test or consult your local Krishi Vigyan Kendra (KVK) for customized dosing."
                ],
                calibration_details=None,
            )

        # Case 2: Incomplete soil test (N, P, or K missing)
        has_all_nutrients = (
            ed.soil_nitrogen is not None
            and ed.soil_phosphorus is not None
            and ed.soil_potassium is not None
        )
        if not has_all_nutrients:
            missing_nutrients = []
            if ed.soil_nitrogen is None:
                missing_nutrients.append("Nitrogen (N)")
            if ed.soil_phosphorus is None:
                missing_nutrients.append("Phosphorus (P)")
            if ed.soil_potassium is None:
                missing_nutrients.append("Potassium (K)")

            return FertilizerPrescription(
                status="WITHHELD_INCOMPLETE_SOIL_TEST",
                rdf_n_p2o5_k2o_kg_ha=[dose_n, dose_p, dose_k],
                adjusted_dose_kg_ha=None,
                commercial_products={},
                stoichiometric_notes=(
                    f"Commercial fertilizer prescriptions are withheld because laboratory soil test is incomplete "
                    f"(missing: {', '.join(missing_nutrients)}). A soil-test flag and partial nutrient values are "
                    "insufficient to compute balanced stoichiometric fertilizer products."
                ),
                disclaimers=[
                    "Advisory Only: Baseline state Package of Practices (POP) RDF shown in kg/ha.",
                    f"Complete laboratory testing for {', '.join(missing_nutrients)} before procuring fertilizer."
                ],
                calibration_details=None,
            )

        # Case 3: Missing or unverified nutrient basis
        if not ed.nutrient_basis or ed.nutrient_basis != "SHC_Available_kg_ha":
            return FertilizerPrescription(
                status="WITHHELD_UNVERIFIED_NUTRIENT_BASIS",
                rdf_n_p2o5_k2o_kg_ha=[dose_n, dose_p, dose_k],
                adjusted_dose_kg_ha=None,
                commercial_products={},
                stoichiometric_notes=(
                    f"Nutrient basis '{ed.nutrient_basis or 'Omitted'}' is not an approved quantitative laboratory standard. "
                    "Commercial bag recommendations require quantitative Soil Health Card available kg/ha basis (SHC_Available_kg_ha). "
                    "Missing or qualitative nutrient units cannot establish safe fertilizer doses."
                ),
                disclaimers=[
                    "Advisory Only: Baseline state Package of Practices (POP) RDF shown in kg/ha.",
                    "Verify laboratory Soil Health Card measurement basis (SHC_Available_kg_ha) before calculating physical products."
                ],
                calibration_details=None,
            )

        # Case 4: Complete Laboratory SHC Provided on SHC_Available_kg_ha Basis
        # Validate STCR calibration record (Finding 2)
        stcr_rec = getattr(query, "stcr_calibration", None)
        stcr_id = getattr(query, "stcr_calibration_id", None)
        target_yield = getattr(query, "target_yield_t_ha", None)
        query_state = query.location.state or ""

        if stcr_rec is None and stcr_id:
            stcr_rec = STCRCalibrationRegistry.get_record(stcr_id)
            if stcr_rec is None:
                is_stcr_valid = False
                stcr_reason = (
                    f"Unregistered calibration ID '{stcr_id}'. User input cannot promote an unregistered "
                    "or fabricated record to verified STCR status. Only reviewed calibrations in "
                    f"STCRCalibrationRegistry (v{STCRCalibrationRegistry.REGISTRY_VERSION}) are accepted."
                )
                stcr_details = None
            else:
                is_stcr_valid, stcr_reason, stcr_details = cls.validate_stcr_calibration(
                    stcr_rec, crop.crop_id, query_state, target_yield
                )
        else:
            is_stcr_valid, stcr_reason, stcr_details = cls.validate_stcr_calibration(
                stcr_rec, crop.crop_id, query_state, target_yield
            )

        if is_stcr_valid and stcr_details is not None:
            # Verified STCR Targeted Yield Polynomial Calculation:
            # FN = fn_t * T - fn_sn * SN
            # FP = fp_t * T - fp_sp * SP
            # FK = fk_t * T - fk_sk * SK
            c = stcr_details["coefficients"]
            sn = ed.soil_nitrogen or 0.0
            sp = ed.soil_phosphorus or 0.0
            sk = ed.soil_potassium or 0.0
            t = target_yield or 0.0

            calc_n = max(0.0, round(c["fn_t"] * t - c["fn_sn"] * sn, 1))
            calc_p = max(0.0, round(c["fp_t"] * t - c["fp_sp"] * sp, 1))
            calc_k = max(0.0, round(c["fk_t"] * t - c["fk_sk"] * sk, 1))

            dap = round(calc_p / 0.46, 1) if calc_p > 0 else 0.0
            n_dap = round(dap * 0.18, 1)
            n_supp = max(0.0, calc_n - n_dap)
            urea = round(n_supp / 0.46, 1)
            mop = round(calc_k / 0.60, 1) if calc_k > 0 else 0.0

            status_label = "VERIFIED_STCR_GENERATED"
            notes = (
                f"VERIFIED STCR TARGETED YIELD PRESCRIPTION: Calibrated for {t} t/ha target yield under "
                f"calibration ID '{stcr_details['calibration_id']}' ({stcr_details['source_institution']}). "
                f"Calculated nutrient doses: {calc_n} kg N/ha, {calc_p} kg P2O5/ha, {calc_k} kg K2O/ha. "
                f"Supplementary Urea ({urea} kg/ha) reflects net elemental nitrogen required after deducting "
                f"{n_dap} kg/ha N supplied by {dap} kg/ha DAP carrier."
            )
            disclaimers = [
                f"STCR Calibration Verified: {stcr_details['publication_reference']}.",
                f"Validation Evidence: {stcr_details['validation_evidence']}.",
                "Stoichiometrically balanced with 18% DAP nitrogen credit deduction.",
                "Split Urea into 2-3 top dressings according to physiological growth stages."
            ]
            adjusted_doses = [calc_n, calc_p, calc_k]
        else:
            # Baseline Package of Practices (POP) RDF arithmetic with DAP credit
            dap = round(dose_p / 0.46, 1) if dose_p > 0 else 0.0
            n_dap = round(dap * 0.18, 1)
            n_supp = max(0.0, dose_n - n_dap)
            urea = round(n_supp / 0.46, 1)
            mop = round(dose_k / 0.60, 1) if dose_k > 0 else 0.0

            status_label = "BASELINE_RDF_ARITHMETIC"
            notes = (
                f"Supplementary Urea quantity ({urea} kg/ha) reflects net elemental nitrogen required after deducting "
                f"{n_dap} kg/ha N supplied by {dap} kg/ha DAP. Avoids {round((dose_n/0.46) - urea, 1)} kg/ha physical Urea over-application. "
                "Classified as BASELINE_RDF_ARITHMETIC: derived from state baseline Package of Practices (POP) RDF "
                "with stoichiometric carrier balancing, not a site-calibrated polynomial STCR targeted-yield equation."
            )
            if getattr(query, "has_stcr_calibration", False) or stcr_rec is not None or getattr(query, "stcr_calibration_id", None) is not None:
                notes += f" [STCR Calibration Rejected: {stcr_reason}]"

            disclaimers = [
                "Stoichiometrically balanced for DAP basal application.",
                "Split Urea into 2-3 top dressings according to crop physiological stages (e.g. CRI and tillering).",
                "Baseline RDF arithmetic only: consult local Krishi Vigyan Kendra (KVK) for site-specific STCR target yield equations."
            ]
            adjusted_doses = [dose_n, dose_p, dose_k]

        return FertilizerPrescription(
            status=status_label,
            rdf_n_p2o5_k2o_kg_ha=[dose_n, dose_p, dose_k],
            adjusted_dose_kg_ha=adjusted_doses,
            commercial_products={
                "dap_kg_ha": dap,
                "dap_nitrogen_credit_kg_ha": n_dap,
                "urea_supplementary_kg_ha": urea,
                "mop_kg_ha": mop,
            },
            stoichiometric_notes=notes,
            disclaimers=disclaimers,
            calibration_details=stcr_details,
        )
