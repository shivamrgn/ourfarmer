"""
FieldWise Phase 3C.5.1: Engine Safety & Evidence Integrity Regression Test Suite
==============================================================================
Rigorous regression test suite verifying all seven critical findings from the
independent Phase 3C.5 audit:
  1. Effective rainfall safety (USDA-SCS monthly formula aggregation & temporal compatibility)
  2. Missing nutrient inputs (No unearned favorable defaults; unmeasured nutrients remain UNKNOWN)
  3. Fertilizer prescription safety (Soil test completeness, SHC basis, DAP stoichiometry)
  4. DCI evidence integrity & provenance (pH, texture, rainfall, irrigation provenance differentiation)
  5. Catalogue fallback integrity (19 crops, 31 windows, CatalogueLoadError on corrupted files)
  6. Thermal gate (Diurnal extremes evaluated without mean substitution or invented hard exclusions)
  7. API adapter safety (Preservation of unverified inputs, epistemic states, and missing-input handling)
"""

import unittest
import sys
import tempfile
from pathlib import Path

ML_PIPELINE_DIR = Path(__file__).resolve().parents[2]
if str(ML_PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(ML_PIPELINE_DIR))

from recommendation_engine import (
    CropRecommendationEngine,
    RecommendationQuery,
    LocationInput,
    TemporalInput,
    ClimateWaterInput,
    EdaphicInput,
    ExecutionStatus,
    Tier1Status,
    ConfidenceTier,
    WaterGatingStatus,
)
from recommendation_engine.catalogue import (
    CanonicalCropCatalogue,
    CatalogueLoadError,
    EMBEDDED_CROP_DATA,
)
from recommendation_engine.water_assessment import WaterAssessmentModule
from recommendation_engine.tier1_eligibility import Tier1EligibilityEvaluator
from recommendation_engine.planting_window import PlantingWindowResolver
from recommendation_engine.tier2_scoring import Tier2ScoringModule
from recommendation_engine.dci_confidence import DCIConfidenceEvaluator
from recommendation_engine.explanations import ExplanationGenerator
from recommendation_engine.input_validator import InputValidator, InputValidationError


class TestPhase3C51Regressions(unittest.TestCase):
    """
    Direct regression proofs for the seven findings of the Phase 3C.5 audit.
    """

    @classmethod
    def setUpClass(cls):
        cls.engine = CropRecommendationEngine()
        cls.catalogue = cls.engine.catalogue

    # =========================================================================
    # Finding 1: Effective Rainfall Safety
    # =========================================================================
    def test_finding_1_effective_rainfall_safety(self):
        """
        Proof 1: Never apply the monthly USDA-SCS equation directly to an aggregated
        multi-month seasonal total. If monthly breakdown is missing, effective rainfall
        must remain None / UNKNOWN rather than producing mathematically invalid estimates.
        """
        rice = self.catalogue.get_crop("rice")
        wheat = self.catalogue.get_crop("wheat")

        # Scenario A: 1,150 mm seasonal rain WITHOUT monthly breakdown
        # Applying monthly formula P > 250 => 125 + 0.1*1150 = 240 mm (Discrepancy of 349 mm!).
        # The corrected engine MUST refuse to apply the formula and set effective_rainfall_mm to None.
        q_seasonal = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=6),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=1150.0,
                rainfall_period_type="Crop_Season_Measured",
                monthly_rainfall=None,  # No monthly breakdown!
                irrigation_access="Canal_Surface",
                irrigation_water_quantity_mm=200.0,
            ),
            edaphic=EdaphicInput(soil_texture="Clay Loam", soil_ph=7.0),
        )
        res_seasonal = WaterAssessmentModule.assess_water(
            crop=rice,
            climate_water=q_seasonal.climate_and_water,
            active_window=None,
            soil_texture=q_seasonal.edaphic.soil_texture,
        )
        self.assertIsNone(
            res_seasonal.effective_rainfall_mm,
            "Effective rainfall must be None when monthly rainfall breakdown is missing."
        )
        self.assertIn("UNKNOWN / unmeasured / provisional", res_seasonal.warnings[0])

        # Scenario B: 1,150 mm seasonal rain WITH monthly breakdown [300, 300, 300, 250]
        # Monthly USDA: 300 mm => 125 + 0.1*300 = 155 mm (x3) = 465 mm
        # 250 mm => 250 * (125 - 0.2*250)/125 = 150 mm
        # Total Peff = 465 + 150 = 615 mm.
        q_monthly = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=6),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=1150.0,
                monthly_rainfall=[300.0, 300.0, 300.0, 250.0],
                rainfall_period_type="Monthly_Measured",
                irrigation_access="Canal_Surface",
                irrigation_water_quantity_mm=200.0,
            ),
            edaphic=EdaphicInput(soil_texture="Clay Loam", soil_ph=7.0),
        )
        res_monthly = WaterAssessmentModule.assess_water(
            crop=rice,
            climate_water=q_monthly.climate_and_water,
            active_window=None,
            soil_texture=q_monthly.edaphic.soil_texture,
        )
        self.assertIsNotNone(res_monthly.effective_rainfall_mm)
        self.assertAlmostEqual(res_monthly.effective_rainfall_mm, 615.0, delta=1.0)

        # Scenario C: Incompatible rainfall and irrigation measurement periods
        # e.g. rainfall measured over 30 days while irrigation measured over 120 days
        q_mismatch = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=50.0,
                rainfall_period_days=30,  # 30 days!
                irrigation_period_days=120,  # 120 days!
                irrigation_access="Borewell_Tubewell",
                irrigation_water_quantity_mm=300.0,
            ),
            edaphic=EdaphicInput(soil_texture="Loam", soil_ph=7.2),
        )
        res_mismatch = WaterAssessmentModule.assess_water(
            crop=wheat,
            climate_water=q_mismatch.climate_and_water,
            active_window=None,
            soil_texture=q_mismatch.edaphic.soil_texture,
        )
        self.assertEqual(
            res_mismatch.water_gating_status,
            WaterGatingStatus.TEMPORAL_MISMATCH_PROVISIONAL,
            "Incompatible temporal periods must trigger TEMPORAL_MISMATCH_PROVISIONAL."
        )

    # =========================================================================
    # Finding 2: Missing Nutrient Inputs
    # =========================================================================
    def test_finding_2_missing_nutrient_inputs(self):
        """
        Proof 2: Remove favorable default P (35) and K (200) when absent. Missing NPK
        must remain UNKNOWN and receive an unmeasured baseline rating (50.0), NOT an
        unearned 100 points in DAC&FW Medium rating.
        """
        wheat = self.catalogue.get_crop("wheat")

        base_query_kwargs = dict(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=150.0,
                temperature_mean=18.0,
                relative_humidity=65.0,
                irrigation_access="Borewell_Tubewell",
                irrigation_water_quantity_mm=300.0,
            ),
        )

        # Case A: Missing all N, P, K
        q_no_npk = RecommendationQuery(
            **base_query_kwargs,
            edaphic=EdaphicInput(soil_texture="Loam", soil_ph=7.2, has_soil_test=False)
        )
        score_no_npk = Tier2ScoringModule.score_nutrients(q_no_npk)
        self.assertEqual(
            score_no_npk, 50.0,
            "When all nutrients are missing, nutrient score must be unmeasured baseline (50.0), never 100."
        )

        # Case B: Partial NPK presence (Testing all 8 combinations of presence)
        combinations = [
            (False, False, False),
            (True, False, False),
            (False, True, False),
            (False, False, True),
            (True, True, False),
            (True, False, True),
            (False, True, True),
            (True, True, True),
        ]

        for has_n, has_p, has_k in combinations:
            ed = EdaphicInput(
                soil_texture="Loam",
                soil_ph=7.2,
                has_soil_test=True,
                soil_nitrogen=300.0 if has_n else None,
                soil_phosphorus=30.0 if has_p else None,
                soil_potassium=200.0 if has_k else None,
            )
            q = RecommendationQuery(**base_query_kwargs, edaphic=ed)
            score = Tier2ScoringModule.score_nutrients(q)

            # Assert that missing nutrients are never awarded 100 points
            if not has_n and not has_p and not has_k:
                self.assertEqual(score, 50.0)
            elif has_n and has_p and has_k:
                # All present in Medium range => 100.0
                self.assertEqual(score, 100.0)
            else:
                # Partial presence => weighted combination of measured and 50.0 baseline
                self.assertGreater(score, 50.0)
                self.assertLess(score, 100.0)

    # =========================================================================
    # Finding 3: Fertilizer Prescription Safety
    # =========================================================================
    def test_finding_3_fertilizer_prescription_safety(self):
        """
        Proof 3: Withhold commercial fertilizer product bags when soil test is incomplete
        or nutrient basis is unverified. If complete SHC is present, deduct 18% DAP N credit.
        """
        wheat = self.catalogue.get_crop("wheat")

        # Case A: Partial soil test (N provided, but P and K missing)
        q_partial = RecommendationQuery(
            location=LocationInput(state="Haryana"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(temperature_mean=18.0),
            edaphic=EdaphicInput(
                soil_texture="Loam",
                soil_ph=7.2,
                has_soil_test=True,
                soil_test_source="Certified_Soil_Testing_Lab",
                nutrient_basis="SHC_Available_kg_ha",
                soil_nitrogen=280.0,
                soil_phosphorus=None,  # Missing!
                soil_potassium=None,   # Missing!
            )
        )
        rx_partial = ExplanationGenerator.generate_fertilizer_prescription(wheat, q_partial)
        self.assertEqual(rx_partial.status, "WITHHELD_INCOMPLETE_SOIL_TEST")
        self.assertEqual(len(rx_partial.commercial_products), 0, "Commercial products must be withheld for incomplete soil test.")

        # Case B: Unverified nutrient basis
        q_unverified = RecommendationQuery(
            location=LocationInput(state="Haryana"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(temperature_mean=18.0),
            edaphic=EdaphicInput(
                soil_texture="Loam",
                soil_ph=7.2,
                has_soil_test=True,
                soil_test_source="Certified_Soil_Testing_Lab",
                nutrient_basis="Qualitative_Fertility_Class",  # Non-quantitative!
                soil_nitrogen=280.0,
                soil_phosphorus=25.0,
                soil_potassium=180.0,
            )
        )
        rx_unverified = ExplanationGenerator.generate_fertilizer_prescription(wheat, q_unverified)
        self.assertEqual(rx_unverified.status, "WITHHELD_UNVERIFIED_NUTRIENT_BASIS")
        self.assertEqual(len(rx_unverified.commercial_products), 0)

        # Case C: Complete quantitative SHC test with verified DAP stoichiometry
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
                soil_nitrogen=280.0,  # Medium
                soil_phosphorus=24.0, # Medium
                soil_potassium=220.0, # Medium
            )
        )
        rx_complete = ExplanationGenerator.generate_fertilizer_prescription(wheat, q_complete)
        self.assertEqual(rx_complete.status, "BASELINE_RDF_ARITHMETIC")
        self.assertIn("dap_kg_ha", rx_complete.commercial_products)
        self.assertIn("urea_supplementary_kg_ha", rx_complete.commercial_products)
        self.assertIn("mop_kg_ha", rx_complete.commercial_products)
        self.assertIn("deducting 23.5 kg/ha N supplied by 130.4 kg/ha DAP", rx_complete.stoichiometric_notes)

    # =========================================================================
    # Finding 4: DCI Evidence Provenance Differentiation
    # =========================================================================
    def test_finding_4_dci_evidence_provenance(self):
        """
        Proof 4: Identical numerical values with different provenance must receive
        differentiated confidence scores. Missing/estimated evidence must never receive
        measured lab data confidence.
        """
        wheat = self.catalogue.get_crop("wheat")
        base_loc = LocationInput(state="Punjab")
        base_temp = TemporalInput(sowing_month=11)

        # Subtest A: Soil pH 7.4 with Lab vs Strip vs Unstated
        q_lab_ph = RecommendationQuery(
            location=base_loc, temporal=base_temp,
            climate_and_water=ClimateWaterInput(temperature_mean=18.0, seasonal_rainfall_amount=100.0, irrigation_access="Canal_Surface"),
            edaphic=EdaphicInput(soil_texture="Loam", soil_ph=7.4, ph_measurement_method="Lab_Potentiometric_1_2_5")
        )
        q_strip_ph = RecommendationQuery(
            location=base_loc, temporal=base_temp,
            climate_and_water=ClimateWaterInput(temperature_mean=18.0, seasonal_rainfall_amount=100.0, irrigation_access="Canal_Surface"),
            edaphic=EdaphicInput(soil_texture="Loam", soil_ph=7.4, ph_measurement_method="Field_Colorimetric_Strip")
        )
        res_lab = DCIConfidenceEvaluator.evaluate(q_lab_ph)
        res_strip = DCIConfidenceEvaluator.evaluate(q_strip_ph)

        self.assertEqual(res_lab.domain_completeness["ph"], 1.0, "Lab potentiometric pH must receive 1.0 confidence.")
        self.assertEqual(res_strip.domain_completeness["ph"], 0.5, "Field colorimetric strip pH must receive 0.5 confidence.")
        self.assertGreater(res_lab.dci_score, res_strip.dci_score, "DCI for lab pH must exceed DCI for field strip pH.")

        # Subtest B: Soil Texture with Lab vs Field Feel
        q_lab_tex = RecommendationQuery(
            location=base_loc, temporal=base_temp,
            climate_and_water=ClimateWaterInput(temperature_mean=18.0, seasonal_rainfall_amount=100.0, irrigation_access="Canal_Surface"),
            edaphic=EdaphicInput(soil_texture="Clay Loam", texture_measurement_method="Lab_Mechanical_Analysis")
        )
        q_feel_tex = RecommendationQuery(
            location=base_loc, temporal=base_temp,
            climate_and_water=ClimateWaterInput(temperature_mean=18.0, seasonal_rainfall_amount=100.0, irrigation_access="Canal_Surface"),
            edaphic=EdaphicInput(soil_texture="Clay Loam", texture_measurement_method="Field_Feel_Method")
        )
        res_tex_lab = DCIConfidenceEvaluator.evaluate(q_lab_tex)
        res_tex_feel = DCIConfidenceEvaluator.evaluate(q_feel_tex)
        self.assertEqual(res_tex_lab.domain_completeness["soil"], 1.0)
        self.assertEqual(res_tex_feel.domain_completeness["soil"], 0.5)

        # Subtest C: Rainfall 100 mm with On-Farm Gauge vs Farmer Estimate
        q_gauge_rain = RecommendationQuery(
            location=base_loc, temporal=base_temp,
            climate_and_water=ClimateWaterInput(
                temperature_mean=18.0,
                seasonal_rainfall_amount=100.0,
                rainfall_period_type="Crop_Season_Measured",
                rainfall_source="On_Farm_Rain_Gauge",
                irrigation_access="None_Rainfed"
            ),
            edaphic=EdaphicInput(soil_texture="Loam", soil_ph=7.0)
        )
        q_est_rain = RecommendationQuery(
            location=base_loc, temporal=base_temp,
            climate_and_water=ClimateWaterInput(
                temperature_mean=18.0,
                seasonal_rainfall_amount=100.0,
                rainfall_period_type="Crop_Season_Measured",
                rainfall_source="Farmer_Estimated",
                irrigation_access="None_Rainfed"
            ),
            edaphic=EdaphicInput(soil_texture="Loam", soil_ph=7.0)
        )
        res_rain_gauge = DCIConfidenceEvaluator.evaluate(q_gauge_rain)
        res_rain_est = DCIConfidenceEvaluator.evaluate(q_est_rain)
        self.assertEqual(res_rain_gauge.domain_completeness["water"], 1.0)
        self.assertEqual(res_rain_est.domain_completeness["water"], 0.6)

    # =========================================================================
    # Finding 5: Catalogue Fallback Integrity
    # =========================================================================
    def test_finding_5_catalogue_fallback_integrity(self):
        """
        Proof 5: Genuine embedded fallback for all 19 crops and 31 windows. Never
        silently return an empty catalogue. Raise CatalogueLoadError on missing or corrupted files.
        """
        # Case A: Missing CSV file => Must raise CatalogueLoadError
        non_existent_path = Path("/tmp/definitely_non_existent_catalogue_12345.csv")
        with self.assertRaises(CatalogueLoadError):
            CanonicalCropCatalogue(non_existent_path)

        # Case B: Corrupted/malformed CSV file => Must raise CatalogueLoadError
        with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False) as tf:
            tf.write("invalid_header,corrupted_col\n")
            tf.write("foo,bar\n")
            temp_csv = Path(tf.name)

        try:
            with self.assertRaises(CatalogueLoadError):
                CanonicalCropCatalogue(temp_csv)
        finally:
            if temp_csv.exists():
                temp_csv.unlink()

        # Case C: Production canonical catalogue check & Embedded Fallback
        prod_cat = CanonicalCropCatalogue()
        self.assertEqual(len(prod_cat.get_all_crops()), 19)
        self.assertEqual(prod_cat.total_planting_windows, 31)
        self.assertEqual(len(EMBEDDED_CROP_DATA), 19, "Embedded crop data dictionary must contain all 19 crops.")

    # =========================================================================
    # Finding 6: Thermal Gate Boundaries & Missing Extremes
    # =========================================================================
    def test_finding_6_thermal_gate(self):
        """
        Proof 6: Evaluate minimum night and maximum day temperatures when supplied.
        Do not substitute mean temperature for missing extremes. If crop-specific extreme
        evidence is unavailable, return UNKNOWN or warning rather than inventing hard exclusion.
        """
        banana = self.catalogue.get_crop("banana")
        wheat = self.catalogue.get_crop("wheat")
        millets = self.catalogue.get_crop("millets")

        # Case A: Chilling temperature for Banana (T_mean=22°C within range [18,38], T_min=1.5°C)
        # Under Phase 3C.5.2, T_min = 1.5°C produces WARNING_ONLY, NOT hard exclusion (hard exclusion requires T_min < 0.0°C).
        q_chill = RecommendationQuery(
            location=LocationInput(state="Maharashtra"),
            temporal=TemporalInput(sowing_month=6),
            climate_and_water=ClimateWaterInput(
                temperature_mean=22.0,
                temperature_min_night=1.5,  # Chilling risk (>0.0°C)
                seasonal_rainfall_amount=1200.0,
                irrigation_access="Borewell_Tubewell"
            ),
            edaphic=EdaphicInput(soil_texture="Clay Loam", soil_ph=6.8)
        )
        win_status, active_win, win_reason = PlantingWindowResolver.resolve(banana, q_chill.temporal, q_chill.location)
        w_chill = WaterAssessmentModule.assess_water(banana, q_chill.climate_and_water, active_win, q_chill.edaphic.soil_texture)
        t1_chill = Tier1EligibilityEvaluator.evaluate(banana, q_chill, w_chill, active_win, win_status, win_reason)
        self.assertEqual(t1_chill.gate_results["G_thermal"].status, "PASS")
        self.assertTrue(any("chilling warning" in w.lower() for w in t1_chill.warnings))

        # Case A.2: Sub-zero freezing frost for Banana (T_min = -1.5°C < 0.0°C)
        q_frost = RecommendationQuery(
            location=LocationInput(state="Maharashtra"),
            temporal=TemporalInput(sowing_month=6),
            climate_and_water=ClimateWaterInput(
                temperature_mean=22.0,
                temperature_min_night=-1.5,  # Sub-zero freezing frost!
                seasonal_rainfall_amount=1200.0,
                irrigation_access="Borewell_Tubewell"
            ),
            edaphic=EdaphicInput(soil_texture="Clay Loam", soil_ph=6.8)
        )
        win_status, active_win, win_reason = PlantingWindowResolver.resolve(banana, q_frost.temporal, q_frost.location)
        w_frost = WaterAssessmentModule.assess_water(banana, q_frost.climate_and_water, active_win, q_frost.edaphic.soil_texture)
        t1_frost = Tier1EligibilityEvaluator.evaluate(banana, q_frost, w_frost, active_win, win_status, win_reason)
        self.assertEqual(t1_frost.gate_results["G_thermal"].status, "FAIL")
        self.assertTrue(any(f["dimension"] == "thermal_extreme_cold" for f in t1_frost.failing_rules))

        # Case B: Severe Heat Stress for Wheat (T_mean=20°C within range [12,25], but T_max=37.0°C)
        # Under Phase 3C.5.2, daytime high heat produces WARNING_ONLY and Tier 2 penalty, NOT Tier 1 hard exclusion.
        q_scorch = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(
                temperature_mean=20.0,
                temperature_max_day=37.0,  # Heat stress > 36.0°C
                seasonal_rainfall_amount=100.0,
                irrigation_access="Canal_Surface"
            ),
            edaphic=EdaphicInput(soil_texture="Loam", soil_ph=7.2)
        )
        win_status, active_win, win_reason = PlantingWindowResolver.resolve(wheat, q_scorch.temporal, q_scorch.location)
        w_scorch = WaterAssessmentModule.assess_water(wheat, q_scorch.climate_and_water, active_win, q_scorch.edaphic.soil_texture)
        t1_scorch = Tier1EligibilityEvaluator.evaluate(wheat, q_scorch, w_scorch, active_win, win_status, win_reason)
        self.assertEqual(t1_scorch.gate_results["G_thermal"].status, "PASS")
        self.assertTrue(any("heat stress warning" in w.lower() for w in t1_scorch.warnings))

        # Case B.2: Wheat exceeding maximum mean temperature (T_mean = 32°C > 28°C max sowing limit)
        q_lethal_heat = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(
                temperature_mean=32.0,
                seasonal_rainfall_amount=100.0,
                irrigation_access="Canal_Surface"
            ),
            edaphic=EdaphicInput(soil_texture="Loam", soil_ph=7.2)
        )
        win_status, active_win, win_reason = PlantingWindowResolver.resolve(wheat, q_lethal_heat.temporal, q_lethal_heat.location)
        w_lethal = WaterAssessmentModule.assess_water(wheat, q_lethal_heat.climate_and_water, active_win, q_lethal_heat.edaphic.soil_texture)
        t1_lethal = Tier1EligibilityEvaluator.evaluate(wheat, q_lethal_heat, w_lethal, active_win, win_status, win_reason)
        self.assertEqual(t1_lethal.gate_results["G_thermal"].status, "FAIL")
        self.assertTrue(any(f["dimension"] == "thermal_emergence" for f in t1_lethal.failing_rules))

        # Case C: Missing diurnal extremes (T_min=None, T_max=None)
        # Evaluates T_mean only, does NOT invent extremes or disqualify crop
        q_no_extremes = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(
                temperature_mean=19.0,
                temperature_min_night=None,
                temperature_max_day=None,
                seasonal_rainfall_amount=100.0,
                irrigation_access="Canal_Surface"
            ),
            edaphic=EdaphicInput(soil_texture="Loam", soil_ph=7.2)
        )
        win_status, active_win, win_reason = PlantingWindowResolver.resolve(wheat, q_no_extremes.temporal, q_no_extremes.location)
        w_no_ext = WaterAssessmentModule.assess_water(wheat, q_no_extremes.climate_and_water, active_win, q_no_extremes.edaphic.soil_texture)
        t1_no_ext = Tier1EligibilityEvaluator.evaluate(wheat, q_no_extremes, w_no_ext, active_win, win_status, win_reason)
        self.assertEqual(t1_no_ext.gate_results["G_thermal"].status, "PASS")

        # Case D: Extreme heat for heat-tolerant crop without documented lethal emergence scorch
        # Millets at T_max = 43.0°C generates a warning, NOT an invented hard exclusion
        q_millet_heat = RecommendationQuery(
            location=LocationInput(state="Rajasthan"),
            temporal=TemporalInput(sowing_month=7),
            climate_and_water=ClimateWaterInput(
                temperature_mean=32.0,
                temperature_max_day=43.0,
                seasonal_rainfall_amount=350.0,
                irrigation_access="None_Rainfed"
            ),
            edaphic=EdaphicInput(soil_texture="Sandy Loam", soil_ph=7.5)
        )
        win_status, active_win, win_reason = PlantingWindowResolver.resolve(millets, q_millet_heat.temporal, q_millet_heat.location)
        w_millet = WaterAssessmentModule.assess_water(millets, q_millet_heat.climate_and_water, active_win, q_millet_heat.edaphic.soil_texture)
        t1_millet = Tier1EligibilityEvaluator.evaluate(millets, q_millet_heat, w_millet, active_win, win_status, win_reason)
        self.assertEqual(t1_millet.gate_results["G_thermal"].status, "PASS")
        self.assertTrue(any("Extreme daytime heat" in w for w in t1_millet.warnings))

    # =========================================================================
    # Finding 7: API Adapter Safety & Missing-Input Enforcement
    # =========================================================================
    def test_finding_7_adapter_safety_and_missing_inputs(self):
        """
        Proof 7: Prevent unverified inferences. Queries missing administrative location
        or temporal parameters must be halted. Inputs without explicit SHC accreditation
        must never emit physical fertilizer bags.
        """
        validator = InputValidator()

        # Case A: Missing State -> InputValidationError
        q_no_state = RecommendationQuery(
            location=LocationInput(state=""),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(temperature_mean=20.0),
            edaphic=EdaphicInput(soil_texture="Loam", soil_ph=7.0),
        )
        with self.assertRaises(InputValidationError) as ctx:
            validator.validate_and_normalize(q_no_state)
        self.assertIn("Location state is required", str(ctx.exception))

        # Case B: Missing Sowing Month -> InputValidationError
        q_no_month = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=15),  # Invalid month!
            climate_and_water=ClimateWaterInput(temperature_mean=20.0),
            edaphic=EdaphicInput(soil_texture="Loam", soil_ph=7.0),
        )
        with self.assertRaises(InputValidationError) as ctx:
            validator.validate_and_normalize(q_no_month)
        self.assertIn("Invalid sowing_month", str(ctx.exception))

        # Case C: NPK entered without has_soil_test=True => Commercial products withheld
        q_unverified_npk = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11, cultivation_season="Rabi"),
            climate_and_water=ClimateWaterInput(
                temperature_mean=19.0,
                relative_humidity=65.0,
                seasonal_rainfall_amount=100.0,
                irrigation_access="Canal_Surface",
                irrigation_water_quantity_mm=300.0,
            ),
            edaphic=EdaphicInput(
                soil_texture="Loam",
                soil_ph=7.2,
                has_soil_test=False,  # Farmer entered numbers but has no accredited lab card!
                soil_nitrogen=280.0,
                soil_phosphorus=25.0,
                soil_potassium=200.0,
            )
        )
        res = self.engine.recommend(q_unverified_npk)
        self.assertEqual(res.status, ExecutionStatus.SUCCESS)
        top_crop = res.recommendations[0]
        self.assertEqual(top_crop.fertilizer_prescription.status, "WITHHELD_MISSING_SOIL_TEST")
        self.assertEqual(len(top_crop.fertilizer_prescription.commercial_products), 0)


if __name__ == "__main__":
    unittest.main()
