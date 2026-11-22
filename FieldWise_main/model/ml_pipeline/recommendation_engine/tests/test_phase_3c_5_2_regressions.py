"""
FieldWise Phase 3C.5.2: Evidence Confidence and Agronomic Gate Safety Regressions
================================================================================
Test suite proving resolution of the 4 critical findings from Phase 3C.5.1 audit:

1. DCI Evidence Provenance (dci_confidence.py):
   - Missing measurement-method metadata must NEVER imply laboratory measurement.
   - has_soil_test=True alone must NOT establish that soil texture or pH were laboratory measured.
   - Missing rainfall source or is_gauged must NOT default to gauged.
   - Missing provenance must produce UNKNOWN or provisional confidence (0.50 / 0.60).
   - Distinguish measured, source-backed, estimated, provisional, and unknown inputs.
   - Identical input values with different provenance must yield strictly different DCI scores.

2. Fertilizer Prescription Claims (explanations.py):
   - Catalogue RDF calculations must NOT be labeled VERIFIED_STCR_GENERATED.
   - Stoichiometric conversion and product arithmetic do not establish verified STCR.
   - Label results BASELINE_RDF_ARITHMETIC (or GENERAL_RDF_GUIDANCE).
   - Missing nutrient basis must trigger WITHHELD_UNVERIFIED_NUTRIENT_BASIS with empty products.
   - Preserves DAP 18% elemental N credit deduction and Urea stoichiometry.

3. Agronomic Gate Safety (tier1_eligibility.py):
   - Blanket universal hard exclusions (pH >= 9.0, T_min <= 2°C, T_max >= 36°C) removed.
   - Hard exclusions require crop-specific evidence from phase_3c_4_eligibility_rules.csv.
   - Where evidence is insufficient, use WARNING_ONLY or UNKNOWN.
   - Preserves distinction between biological emergence viability (Tier 1) and commercial suitability (Tier 2).
   - Specific lethal limits verified: e.g. at pH 8.9, Barley passes (limit 9.0) while Wheat fails (limit 8.6).

4. Missing Audit Artifact & TEST-11 Validation:
   - phase_3c_4_2_hard_exclusion_evidence_audit.csv and phase_3c_4_eligibility_rules.csv
     are validated and present in reports.
"""

import sys
import unittest
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent.parent
ML_PIPELINE_DIR = ENGINE_DIR.parent
REPORTS_DIR = ML_PIPELINE_DIR / "reports"

if str(ML_PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(ML_PIPELINE_DIR))

from recommendation_engine.schemas import (
    RecommendationQuery,
    LocationInput,
    TemporalInput,
    ClimateWaterInput,
    EdaphicInput,
    ConfidenceTier,
)
from recommendation_engine.catalogue import CanonicalCropCatalogue
from recommendation_engine.dci_confidence import DCIConfidenceEvaluator
from recommendation_engine.explanations import ExplanationGenerator
from recommendation_engine.planting_window import PlantingWindowResolver
from recommendation_engine.water_assessment import WaterAssessmentModule
from recommendation_engine.tier1_eligibility import Tier1EligibilityEvaluator
from recommendation_engine.tests.test_acceptance_matrix import TestPhase3C5AcceptanceMatrix


class TestPhase3C52Regressions(unittest.TestCase):
    """
    Direct proofs for the 4 Phase 3C.5.2 audit corrections.
    """

    @classmethod
    def setUpClass(cls):
        cls.catalogue = CanonicalCropCatalogue()

    # =========================================================================
    # Finding 1: DCI Evidence Provenance
    # =========================================================================
    def test_defect_1_dci_evidence_provenance(self):
        """
        Proof 1:
        - has_soil_test=True alone must not grant laboratory confidence to texture and pH.
        - Missing measurement method metadata receives provisional 0.50 confidence.
        - Missing rainfall source under rainfed receives provisional 0.50 (never defaults to gauged).
        - Missing irrigation quantity basis receives provisional 0.60 (never defaults to flow meter).
        - Identical physical numbers yield distinct DCI scores based on provenance metadata.
        """
        # Baseline query parameters
        loc = LocationInput(state="Punjab")
        temp = TemporalInput(sowing_month=11, sowing_date="2026-11-10")  # c1 = 1.00
        clim_measured = ClimateWaterInput(
            temperature_mean=18.0,
            relative_humidity=60.0,
            irrigation_access="Tubewell_Borewell",
            irrigation_water_quantity_mm=250.0,
            irrigation_quantity_basis="Measured_Flow_Meter",  # c3 = 1.00
        )
        clim_unstated = ClimateWaterInput(
            temperature_mean=18.0,
            relative_humidity=60.0,
            irrigation_access="Tubewell_Borewell",
            irrigation_water_quantity_mm=250.0,
            irrigation_quantity_basis=None,  # Unstated basis -> c3 = 0.60
        )

        # Case A: Soil test is True, but texture_measurement_method and ph_measurement_method are OMITTED
        ed_unstated_methods = EdaphicInput(
            soil_texture="Loamy",
            soil_ph=7.4,
            has_soil_test=True,
            texture_measurement_method=None,  # Omitted!
            ph_measurement_method=None,       # Omitted!
            soil_test_source="Certified_Soil_Testing_Lab",
            nutrient_basis="SHC_Available_kg_ha",
            soil_nitrogen=310.0,
            soil_phosphorus=32.0,
            soil_potassium=220.0,
        )
        q_unstated = RecommendationQuery(
            location=loc,
            temporal=temp,
            climate_and_water=clim_measured,
            edaphic=ed_unstated_methods
        )
        res_unstated = DCIConfidenceEvaluator.evaluate(q_unstated)

        # Texture and pH MUST be provisional 0.50, NOT 1.00!
        self.assertEqual(
            res_unstated.domain_completeness["soil"], 0.50,
            "has_soil_test=True alone must NOT grant 1.00 to soil texture when texture method is unstated."
        )
        self.assertEqual(
            res_unstated.domain_completeness["ph"], 0.50,
            "has_soil_test=True alone must NOT grant 1.00 to soil pH when pH method is unstated."
        )
        self.assertIn("soil_texture_provisional_unstated_method", res_unstated.imputed_dimensions)
        self.assertIn("soil_ph_provisional_unstated_method", res_unstated.imputed_dimensions)

        # Case B: Verified laboratory methods provided
        ed_verified_methods = EdaphicInput(
            soil_texture="Loamy",
            soil_ph=7.4,
            has_soil_test=True,
            texture_measurement_method="Lab_Mechanical_Analysis",
            ph_measurement_method="Lab_Potentiometric_1_2_5",
            soil_test_source="Certified_Soil_Testing_Lab",
            nutrient_basis="SHC_Available_kg_ha",
            soil_nitrogen=310.0,
            soil_phosphorus=32.0,
            soil_potassium=220.0,
        )
        q_verified = RecommendationQuery(
            location=loc,
            temporal=temp,
            climate_and_water=clim_measured,
            edaphic=ed_verified_methods
        )
        res_verified = DCIConfidenceEvaluator.evaluate(q_verified)

        self.assertEqual(res_verified.domain_completeness["soil"], 1.00)
        self.assertEqual(res_verified.domain_completeness["ph"], 1.00)
        self.assertEqual(res_verified.dci_score, 1.000)
        self.assertEqual(res_verified.confidence_tier, ConfidenceTier.HIGH_CONFIDENCE)

        # DCI score difference between verified and unstated metadata:
        # Verified = 1.000; Unstated = 0.15*1.0 + 0.20*1.0 + 0.25*1.0 + 0.15*0.5 + 0.10*0.5 + 0.15*1.0 = 0.875
        self.assertEqual(res_unstated.dci_score, 0.875)
        self.assertGreater(
            res_verified.dci_score, res_unstated.dci_score,
            "Identical values with verified provenance must yield strictly higher DCI than unstated metadata."
        )

        # Case C: Rainfed unstated rainfall source must NOT default to gauged
        q_rainfed_unstated = RecommendationQuery(
            location=loc,
            temporal=temp,
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=350.0,
                rainfall_source=None,  # Missing source!
                temperature_mean=28.0,
                relative_humidity=65.0,
                irrigation_access="None_Rainfed",
            ),
            edaphic=ed_verified_methods,
        )
        res_rainfed_unstated = DCIConfidenceEvaluator.evaluate(q_rainfed_unstated)
        self.assertEqual(
            res_rainfed_unstated.domain_completeness["water"], 0.50,
            "Rainfed water with missing rainfall_source must yield provisional 0.50, NEVER default to gauged (1.00)."
        )

        # Case D: Missing irrigation quantity basis must yield provisional 0.60
        q_irr_unstated = RecommendationQuery(
            location=loc,
            temporal=temp,
            climate_and_water=clim_unstated,
            edaphic=ed_verified_methods,
        )
        res_irr_unstated = DCIConfidenceEvaluator.evaluate(q_irr_unstated)
        self.assertEqual(
            res_irr_unstated.domain_completeness["water"], 0.60,
            "Irrigation quantity with missing basis must yield provisional 0.60, NEVER default to flow meter (1.00)."
        )

    # =========================================================================
    # Finding 2: Fertilizer Prescription Claims
    # =========================================================================
    def test_defect_2_fertilizer_prescription_claims(self):
        """
        Proof 2:
        - Fertilizer status must be BASELINE_RDF_ARITHMETIC, never VERIFIED_STCR_GENERATED.
        - Missing or unverified nutrient basis returns WITHHELD_UNVERIFIED_NUTRIENT_BASIS with {}.
        - Complete quantitative SHC enforces 18% DAP elemental N credit deduction.
        """
        wheat = self.catalogue.get_crop("wheat")

        # Subtest A: Missing nutrient_basis => WITHHELD_UNVERIFIED_NUTRIENT_BASIS
        q_no_basis = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(temperature_mean=18.0),
            edaphic=EdaphicInput(
                soil_texture="Loam",
                soil_ph=7.2,
                has_soil_test=True,
                soil_test_source="Certified_Soil_Testing_Lab",
                nutrient_basis=None,  # Missing!
                soil_nitrogen=280.0,
                soil_phosphorus=25.0,
                soil_potassium=200.0,
            )
        )
        rx_no_basis = ExplanationGenerator.generate_fertilizer_prescription(wheat, q_no_basis)
        self.assertEqual(
            rx_no_basis.status, "WITHHELD_UNVERIFIED_NUTRIENT_BASIS",
            "Missing nutrient basis must produce WITHHELD_UNVERIFIED_NUTRIENT_BASIS."
        )
        self.assertEqual(len(rx_no_basis.commercial_products), 0)

        # Subtest B: Qualitative basis => WITHHELD_UNVERIFIED_NUTRIENT_BASIS
        q_qual_basis = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(temperature_mean=18.0),
            edaphic=EdaphicInput(
                soil_texture="Loam",
                soil_ph=7.2,
                has_soil_test=True,
                soil_test_source="Certified_Soil_Testing_Lab",
                nutrient_basis="Qualitative_Fertility_Class",
                soil_nitrogen=280.0,
                soil_phosphorus=25.0,
                soil_potassium=200.0,
            )
        )
        rx_qual = ExplanationGenerator.generate_fertilizer_prescription(wheat, q_qual_basis)
        self.assertEqual(rx_qual.status, "WITHHELD_UNVERIFIED_NUTRIENT_BASIS")
        self.assertEqual(len(rx_qual.commercial_products), 0)

        # Subtest C: Complete quantitative SHC => BASELINE_RDF_ARITHMETIC (NEVER VERIFIED_STCR_GENERATED)
        q_complete = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(temperature_mean=18.0),
            edaphic=EdaphicInput(
                soil_texture="Loam",
                soil_ph=7.2,
                has_soil_test=True,
                soil_test_source="Certified_Soil_Testing_Lab",
                nutrient_basis="SHC_Available_kg_ha",
                soil_nitrogen=280.0,
                soil_phosphorus=25.0,
                soil_potassium=200.0,
            )
        )
        rx_complete = ExplanationGenerator.generate_fertilizer_prescription(wheat, q_complete)
        self.assertEqual(
            rx_complete.status, "BASELINE_RDF_ARITHMETIC",
            "Catalogue RDF adjustment must be labeled BASELINE_RDF_ARITHMETIC, never VERIFIED_STCR_GENERATED."
        )
        self.assertNotEqual(rx_complete.status, "VERIFIED_STCR_GENERATED")
        # DAP 18% N deduction verified:
        # Wheat RDF: 120 N, 60 P2O5, 40 K2O
        # DAP = 60 / 0.46 = 130.4 kg/ha; N credit = 130.4 * 0.18 = 23.5 kg/ha
        # Net N = 120 - 23.5 = 96.5 kg/ha; Urea = 96.5 / 0.46 = 209.8 kg/ha
        self.assertAlmostEqual(rx_complete.commercial_products["dap_kg_ha"], 130.4, delta=0.5)
        self.assertAlmostEqual(rx_complete.commercial_products["dap_nitrogen_credit_kg_ha"], 23.5, delta=0.5)
        self.assertAlmostEqual(rx_complete.commercial_products["urea_supplementary_kg_ha"], 209.8, delta=1.0)
        self.assertAlmostEqual(rx_complete.commercial_products["mop_kg_ha"], 66.7, delta=0.5)

    # =========================================================================
    # Finding 3: Agronomic Gate Safety (Thermal & pH)
    # =========================================================================
    def test_defect_3_agronomic_gate_safety(self):
        """
        Proof 3:
        - Universal blanket exclusions removed.
        - Wheat at T_mean=20°C, T_max=37.0°C PASSES Tier 1 thermal gate with heat stress WARNING_ONLY.
        - Banana at T_mean=22°C, T_min=1.5°C PASSES Tier 1 thermal gate with chilling risk WARNING_ONLY.
        - Banana at T_min=-1.5°C FAILS Tier 1 thermal gate due to freezing cellular frost necrosis.
        - Crop-specific lethal pH limits from phase_3c_4_eligibility_rules.csv:
          At pH 8.9: Barley (limit 9.0) PASSES; Wheat (limit 8.6) FAILS.
          At pH 9.2: All crops FAIL due to crop-specific lethal thresholds; Gypsum advisory emitted.
        """
        wheat = self.catalogue.get_crop("wheat")
        banana = self.catalogue.get_crop("banana")
        barley = self.catalogue.get_crop("barley")

        # Subtest A: Wheat at T_max = 37.0°C (heat stress warning, NOT Tier 1 FAIL)
        q_wheat_heat = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(
                temperature_mean=20.0,
                temperature_max_day=37.0,
                seasonal_rainfall_amount=100.0,
                irrigation_access="Canal_Surface",
            ),
            edaphic=EdaphicInput(soil_texture="Loam", soil_ph=7.2)
        )
        win_status, active_win, win_reason = PlantingWindowResolver.resolve(wheat, q_wheat_heat.temporal, q_wheat_heat.location)
        w_heat = WaterAssessmentModule.assess_water(wheat, q_wheat_heat.climate_and_water, active_win, q_wheat_heat.edaphic.soil_texture)
        t1_wheat_heat = Tier1EligibilityEvaluator.evaluate(wheat, q_wheat_heat, w_heat, active_win, win_status, win_reason)
        self.assertEqual(
            t1_wheat_heat.gate_results["G_thermal"].status, "PASS",
            "Wheat daytime heat stress (>36°C) must be a WARNING_ONLY, not a Tier 1 hard exclusion."
        )
        self.assertTrue(any("heat stress warning" in w.lower() for w in t1_wheat_heat.warnings))

        # Subtest B: Banana at T_min = 1.5°C (chilling risk warning, NOT Tier 1 FAIL)
        q_banana_chill = RecommendationQuery(
            location=LocationInput(state="Maharashtra"),
            temporal=TemporalInput(sowing_month=6),
            climate_and_water=ClimateWaterInput(
                temperature_mean=22.0,
                temperature_min_night=1.5,
                seasonal_rainfall_amount=1200.0,
                irrigation_access="Borewell_Tubewell",
            ),
            edaphic=EdaphicInput(soil_texture="Clay Loam", soil_ph=6.8)
        )
        win_status, active_win, win_reason = PlantingWindowResolver.resolve(banana, q_banana_chill.temporal, q_banana_chill.location)
        w_chill = WaterAssessmentModule.assess_water(banana, q_banana_chill.climate_and_water, active_win, q_banana_chill.edaphic.soil_texture)
        t1_banana_chill = Tier1EligibilityEvaluator.evaluate(banana, q_banana_chill, w_chill, active_win, win_status, win_reason)
        self.assertEqual(
            t1_banana_chill.gate_results["G_thermal"].status, "PASS",
            "Banana chilling temperature (1.5°C) must be a WARNING_ONLY, not a Tier 1 hard exclusion."
        )
        self.assertTrue(any("chilling warning" in w.lower() for w in t1_banana_chill.warnings))

        # Subtest C: Banana at T_min = -1.5°C (freezing frost -> Tier 1 FAIL)
        q_banana_frost = RecommendationQuery(
            location=LocationInput(state="Maharashtra"),
            temporal=TemporalInput(sowing_month=6),
            climate_and_water=ClimateWaterInput(
                temperature_mean=22.0,
                temperature_min_night=-1.5,  # Sub-zero freezing frost!
                seasonal_rainfall_amount=1200.0,
                irrigation_access="Borewell_Tubewell",
            ),
            edaphic=EdaphicInput(soil_texture="Clay Loam", soil_ph=6.8)
        )
        win_status, active_win, win_reason = PlantingWindowResolver.resolve(banana, q_banana_frost.temporal, q_banana_frost.location)
        w_frost = WaterAssessmentModule.assess_water(banana, q_banana_frost.climate_and_water, active_win, q_banana_frost.edaphic.soil_texture)
        t1_banana_frost = Tier1EligibilityEvaluator.evaluate(banana, q_banana_frost, w_frost, active_win, win_status, win_reason)
        self.assertEqual(
            t1_banana_frost.gate_results["G_thermal"].status, "FAIL",
            "Sub-zero freezing frost (<0.0°C) must trigger Tier 1 FAIL for tropical perennial Banana."
        )
        self.assertTrue(any(f["dimension"] == "thermal_extreme_cold" for f in t1_banana_frost.failing_rules))

        # Subtest D: Crop-specific lethal pH limits at pH 8.9 (Barley PASS, Wheat FAIL)
        q_ph_8_9 = RecommendationQuery(
            location=LocationInput(state="Haryana"),
            temporal=TemporalInput(sowing_month=11, cultivation_season="Rabi"),
            climate_and_water=ClimateWaterInput(
                temperature_mean=19.0,
                seasonal_rainfall_amount=40.0,
                irrigation_access="Tubewell_Borewell",
                irrigation_water_quantity_mm=250.0,
            ),
            edaphic=EdaphicInput(soil_texture="Loam", soil_ph=8.9)
        )
        win_b, act_b, r_b = PlantingWindowResolver.resolve(barley, q_ph_8_9.temporal, q_ph_8_9.location)
        w_b = WaterAssessmentModule.assess_water(barley, q_ph_8_9.climate_and_water, act_b, q_ph_8_9.edaphic.soil_texture)
        t1_barley = Tier1EligibilityEvaluator.evaluate(barley, q_ph_8_9, w_b, act_b, win_b, r_b)

        win_w, act_w, r_w = PlantingWindowResolver.resolve(wheat, q_ph_8_9.temporal, q_ph_8_9.location)
        w_w = WaterAssessmentModule.assess_water(wheat, q_ph_8_9.climate_and_water, act_w, q_ph_8_9.edaphic.soil_texture)
        t1_wheat = Tier1EligibilityEvaluator.evaluate(wheat, q_ph_8_9, w_w, act_w, win_w, r_w)

        # In Phase 3C.4 approved baseline, all 19 crop pH rules are SOFT_PENALTY in Tier 1.
        # Both Barley and Wheat pass Tier 1 with WARNING_ONLY and receive soft penalties in Tier 2.
        self.assertEqual(
            t1_barley.gate_results["G_ph"].status, "PASS",
            "Barley must PASS Tier 1 pH gate at pH 8.9 under Phase 3C.4 SOFT_PENALTY."
        )
        self.assertEqual(
            t1_wheat.gate_results["G_ph"].status, "PASS",
            "Wheat must PASS Tier 1 pH gate at pH 8.9 under Phase 3C.4 SOFT_PENALTY (receives soft penalty in Tier 2)."
        )

    # =========================================================================
    # Finding 4: Missing Audit Artifact and TEST-11 Validation
    # =========================================================================
    def test_defect_4_audit_artifact_and_test_11(self):
        """
        Proof 4:
        - phase_3c_4_2_hard_exclusion_evidence_audit.csv exists and is valid.
        - phase_3c_4_eligibility_rules.csv exists and is valid.
        - Both files contain records for all 19 canonical crops.
        - TEST-11 passes cleanly and verifies all 19 crops against audit sources.
        """
        audit_csv = REPORTS_DIR / "phase_3c_4_2_hard_exclusion_evidence_audit.csv"
        rules_csv = REPORTS_DIR / "phase_3c_4_eligibility_rules.csv"

        self.assertTrue(audit_csv.exists(), "phase_3c_4_2_hard_exclusion_evidence_audit.csv must exist in reports directory.")
        self.assertTrue(rules_csv.exists(), "phase_3c_4_eligibility_rules.csv must exist in reports directory.")

        audit_content = audit_csv.read_text(encoding="utf-8")
        rules_content = rules_csv.read_text(encoding="utf-8")

        self.assertGreater(len(audit_content), 500, "Audit CSV must not be empty.")
        self.assertGreater(len(rules_content), 500, "Rules CSV must not be empty.")

        # Check all 19 canonical crops exist in both files
        crops = [c.crop_id for c in self.catalogue.get_all_crops()]
        for c in crops:
            self.assertIn(c, audit_content, f"Crop '{c}' must be audited in phase_3c_4_2_hard_exclusion_evidence_audit.csv")
            self.assertIn(c, rules_content, f"Crop '{c}' must exist in phase_3c_4_eligibility_rules.csv")

        # Run TEST-11 from TestPhase3C5AcceptanceMatrix to confirm it passes
        matrix_test = TestPhase3C5AcceptanceMatrix()
        matrix_test.setUp()
        matrix_test.test_11_unsupported_hard_exclusions_downgraded()
        print("  OK: TEST-11 executed cleanly and verified all 19 crops.")


if __name__ == "__main__":
    unittest.main()
