"""
FieldWise Phase 3C.5: Edge-Case & Safety Boundary Test Suite
============================================================
Extensive test suite validating edge cases, boundary values, conflicting inputs,
environmental hostility boundaries, and backend-independent determinism.

Test Categories:
  1. Missing and invalid inputs
  2. Boundary values (pH, temperature, rainfall, humidity)
  3. Conflicting planting-window and regional information
  4. Rainfed and irrigated efficiency scenarios
  5. Unknown and provisional evidence handling
  6. Extreme pH and nutrient stress
  7. NO_RECOMMENDATION_SUITABLE vs INSUFFICIENT_DATA boundary
  8. 50-iteration deterministic ranking reproducibility
  9. Backend-independent, pure standard library execution
"""

import unittest
import sys
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
from recommendation_engine.input_validator import InputValidationError


class TestRecommendationEngineEdgeCases(unittest.TestCase):
    """
    Validates safety boundaries, edge cases, and deterministic invariants.
    """

    @classmethod
    def setUpClass(cls):
        cls.engine = CropRecommendationEngine()

    # -------------------------------------------------------------------------
    # 1. Missing and Invalid Inputs
    # -------------------------------------------------------------------------
    def test_missing_and_invalid_inputs(self):
        # Invalid month: 13 -> Engine returns VALIDATION_ERROR
        q_inv_m = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=13),
            climate_and_water=ClimateWaterInput(seasonal_rainfall_amount=50.0),
            edaphic=EdaphicInput(soil_texture="Loamy"),
        )
        res_inv_m = self.engine.recommend(q_inv_m)
        self.assertEqual(res_inv_m.status, ExecutionStatus.VALIDATION_ERROR)
        with self.assertRaises(InputValidationError):
            from recommendation_engine.input_validator import InputValidator
            InputValidator.validate_and_normalize(q_inv_m)

        # Negative rainfall -> Engine returns VALIDATION_ERROR
        q_neg_r = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(seasonal_rainfall_amount=-50.0),
            edaphic=EdaphicInput(soil_texture="Loamy"),
        )
        res_neg_r = self.engine.recommend(q_neg_r)
        self.assertEqual(res_neg_r.status, ExecutionStatus.VALIDATION_ERROR)

        # Negative irrigation -> Engine returns VALIDATION_ERROR
        q_neg_i = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=50.0,
                irrigation_water_quantity_mm=-100.0
            ),
            edaphic=EdaphicInput(soil_texture="Loamy"),
        )
        res_neg_i = self.engine.recommend(q_neg_i)
        self.assertEqual(res_neg_i.status, ExecutionStatus.VALIDATION_ERROR)

        # Invalid pH (outside 2.0 - 12.0) -> Engine returns VALIDATION_ERROR
        q_inv_ph = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(seasonal_rainfall_amount=50.0),
            edaphic=EdaphicInput(soil_texture="Loamy", soil_ph=13.5),
        )
        res_inv_ph = self.engine.recommend(q_inv_ph)
        self.assertEqual(res_inv_ph.status, ExecutionStatus.VALIDATION_ERROR)

        # Missing state -> Engine returns VALIDATION_ERROR
        q_no_state = RecommendationQuery(
            location=LocationInput(state=""),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(seasonal_rainfall_amount=50.0),
            edaphic=EdaphicInput(soil_texture="Loamy"),
        )
        res_no_state = self.engine.recommend(q_no_state)
        self.assertEqual(res_no_state.status, ExecutionStatus.VALIDATION_ERROR)

    # -------------------------------------------------------------------------
    # 2. Boundary Values
    # -------------------------------------------------------------------------
    def test_boundary_values(self):
        # pH boundary test: Rice preferred pH [5.0, 8.5]
        # At pH 5.0 (exact min), score should be 100
        q_ph_min = RecommendationQuery(
            location=LocationInput(state="West Bengal"),
            temporal=TemporalInput(sowing_month=7),
            climate_and_water=ClimateWaterInput(seasonal_rainfall_amount=1200.0, temperature_mean=28.0, relative_humidity=80.0),
            edaphic=EdaphicInput(soil_texture="Clay Loam", soil_ph=5.0),
        )
        res_ph_min = self.engine.recommend(q_ph_min)
        rice_rec = next((r for r in res_ph_min.recommendations if r.crop_id == "rice"), None)
        self.assertIsNotNone(rice_rec)
        self.assertEqual(rice_rec.tier2_components.ph_score, 100.0)

        # At pH 4.7 (buffer between 4.5 and 5.0), score decays between 50 and 100
        q_ph_buf = RecommendationQuery(
            location=LocationInput(state="West Bengal"),
            temporal=TemporalInput(sowing_month=7),
            climate_and_water=ClimateWaterInput(seasonal_rainfall_amount=1200.0, temperature_mean=28.0, relative_humidity=80.0),
            edaphic=EdaphicInput(soil_texture="Clay Loam", soil_ph=4.7),
        )
        res_ph_buf = self.engine.recommend(q_ph_buf)
        rice_buf = next((r for r in res_ph_buf.recommendations if r.crop_id == "rice"), None)
        self.assertIsNotNone(rice_buf)
        self.assertGreaterEqual(rice_buf.tier2_components.ph_score, 50.0)
        self.assertLess(rice_buf.tier2_components.ph_score, 100.0)

        # Zero rainfall boundary
        q_zero_rain = RecommendationQuery(
            location=LocationInput(state="Rajasthan"),
            temporal=TemporalInput(sowing_month=7),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=0.0,
                irrigation_access="None_Rainfed",
                temperature_mean=35.0,
                relative_humidity=35.0,
            ),
            edaphic=EdaphicInput(soil_texture="Sandy", soil_ph=8.0),
        )
        res_zero_rain = self.engine.recommend(q_zero_rain)
        # Should not crash with division by zero!
        self.assertIn(res_zero_rain.status, [ExecutionStatus.SUCCESS, ExecutionStatus.NO_RECOMMENDATION_SUITABLE])

    # -------------------------------------------------------------------------
    # 3. Conflicting Planting-Window & Regional Information
    # -------------------------------------------------------------------------
    def test_conflicting_planting_windows(self):
        # Wheat in July (Rabi crop in Kharif month)
        q_wheat_july = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=7, cultivation_season="Kharif"),
            climate_and_water=ClimateWaterInput(seasonal_rainfall_amount=400.0, temperature_mean=35.0, relative_humidity=65.0),
            edaphic=EdaphicInput(soil_texture="Loamy", soil_ph=7.2),
        )
        res = self.engine.recommend(q_wheat_july)
        ex_wheat = next((ex for ex in res.excluded_candidates if ex.crop_id == "wheat"), None)
        self.assertIsNotNone(ex_wheat, "Wheat must be excluded in July")
        self.assertEqual(ex_wheat.tier1_status, Tier1Status.DISQUALIFIED)

        # Adsali Sugarcane in Punjab (Adsali is restricted to Tropical Maharashtra/Karnataka)
        q_adsali_pb = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=7, planting_system="Adsali_Maharashtra"),
            climate_and_water=ClimateWaterInput(seasonal_rainfall_amount=400.0, temperature_mean=32.0, relative_humidity=65.0),
            edaphic=EdaphicInput(soil_texture="Loamy", soil_ph=7.2),
        )
        res_adsali = self.engine.recommend(q_adsali_pb)
        ex_sug = next((ex for ex in res_adsali.excluded_candidates if ex.crop_id == "sugarcane"), None)
        self.assertIsNotNone(ex_sug, "Adsali sugarcane must not match in Punjab")

    # -------------------------------------------------------------------------
    # 4. Rainfed and Irrigated Efficiency Scenarios
    # -------------------------------------------------------------------------
    def test_irrigation_efficiency_methods(self):
        # Drip efficiency (0.90) vs Furrow (0.70)
        q_drip = RecommendationQuery(
            location=LocationInput(state="Maharashtra"),
            temporal=TemporalInput(sowing_month=11, sowing_date="2026-11-10"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=40.0,
                irrigation_access="Drip_Micro",
                irrigation_type="Drip_Micro",
                irrigation_water_quantity_mm=200.0,
                temperature_mean=22.0,
            ),
            edaphic=EdaphicInput(soil_texture="Loamy", soil_ph=7.0),
        )
        res_drip = self.engine.recommend(q_drip)
        wheat_drip = next((r for r in res_drip.recommendations if r.crop_id == "wheat"), None)
        self.assertIsNotNone(wheat_drip)
        # NIR = 200 * 0.90 = 180.0 mm
        self.assertEqual(wheat_drip.water_assessment.net_irrigation_delivered_mm, 180.0)
        self.assertEqual(wheat_drip.water_assessment.irrigation_efficiency, 0.90)

    # -------------------------------------------------------------------------
    # 5. Unknown and Provisional Evidence Handling
    # -------------------------------------------------------------------------
    def test_unknown_and_provisional_handling(self):
        # Unmeasured irrigation quantity
        q_unmeasured = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11, sowing_date="2026-11-10"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=45.0,
                irrigation_access="Tubewell_Borewell",
                irrigation_water_quantity_mm=None,  # Unmeasured
                temperature_mean=19.0,
                relative_humidity=60.0,
            ),
            edaphic=EdaphicInput(soil_texture="Loamy", soil_ph=7.2),
        )
        res = self.engine.recommend(q_unmeasured)
        wheat = next((r for r in res.recommendations if r.crop_id == "wheat"), None)
        self.assertIsNotNone(wheat)
        self.assertEqual(wheat.water_assessment.water_gating_status, WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK)
        self.assertEqual(wheat.water_assessment.provisional_water_score, 70.0)
        self.assertEqual(wheat.evidence_confidence_tier, ConfidenceTier.PROVISIONAL_EVALUATION)

    # -------------------------------------------------------------------------
    # 6. Extreme pH Stress
    # -------------------------------------------------------------------------
    def test_extreme_ph_acidity_and_alkalinity(self):
        # Extreme acidity pH 3.8
        q_acid = RecommendationQuery(
            location=LocationInput(state="Assam"),
            temporal=TemporalInput(sowing_month=7),
            climate_and_water=ClimateWaterInput(seasonal_rainfall_amount=1200.0, temperature_mean=28.0, relative_humidity=80.0),
            edaphic=EdaphicInput(soil_texture="Clay Loam", soil_ph=3.8),
        )
        res_acid = self.engine.recommend(q_acid)
        # Under Phase 3C.5.2.2.2: pH alone does not force rejection. Acid-tolerant crops (Rice, Mango, Maize) achieve >= 40.0
        self.assertEqual(res_acid.status, ExecutionStatus.SUCCESS)
        self.assertGreater(len(res_acid.recommendations), 0)
        for rec in res_acid.recommendations:
            self.assertLess(rec.tier2_components.ph_score, 100.0)
            self.assertTrue(any("acidity" in w.lower() for w in rec.risk_warnings))

        # Extreme alkalinity pH 10.2
        q_alkali = RecommendationQuery(
            location=LocationInput(state="Haryana"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(seasonal_rainfall_amount=50.0, temperature_mean=19.0, relative_humidity=55.0),
            edaphic=EdaphicInput(soil_texture="Clay Loam", soil_ph=10.2),
        )
        res_alkali = self.engine.recommend(q_alkali)
        # Legitimate rejection: at pH 10.2 without sufficient water, all crops fail suitability viability threshold (< 40.0)
        self.assertEqual(res_alkali.status, ExecutionStatus.NO_RECOMMENDATION_SUITABLE)
        self.assertIsNotNone(res_alkali.land_reclamation_advisory)
        self.assertIn("gypsum", res_alkali.land_reclamation_advisory.lower())

    # -------------------------------------------------------------------------
    # 7. NO_RECOMMENDATION_SUITABLE vs INSUFFICIENT_DATA Boundary
    # -------------------------------------------------------------------------
    def test_hostility_vs_insufficient_data_boundary(self):
        # Case A: Complete inputs, but hostile environment (48°C extreme summer desert heat)
        # -> Must return NO_RECOMMENDATION_SUITABLE
        q_hostile = RecommendationQuery(
            location=LocationInput(state="Rajasthan"),
            temporal=TemporalInput(sowing_month=5, sowing_date="2026-05-15"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=20.0,
                temperature_mean=48.0,  # Lethal emergence scorch for all arable crops
                relative_humidity=15.0,
                irrigation_access="None_Rainfed",
            ),
            edaphic=EdaphicInput(soil_texture="Sandy", soil_ph=8.2, has_soil_test=True, soil_nitrogen=150.0),
        )
        res_hostile = self.engine.recommend(q_hostile)
        self.assertEqual(res_hostile.status, ExecutionStatus.NO_RECOMMENDATION_SUITABLE)
        self.assertIsNotNone(res_hostile.land_reclamation_advisory)

        # Case B: Incomplete inputs (missing rainfall and irrigation unstated)
        # -> Must return INSUFFICIENT_DATA
        q_incomplete = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=None,  # Missing
                irrigation_access=None,         # Missing
                temperature_mean=18.0,
            ),
            edaphic=EdaphicInput(soil_texture="Loamy"),
        )
        res_incomplete = self.engine.recommend(q_incomplete)
        self.assertEqual(res_incomplete.status, ExecutionStatus.INSUFFICIENT_DATA)

    # -------------------------------------------------------------------------
    # 8. Deterministic Ranking for Identical Inputs (50 Iterations)
    # -------------------------------------------------------------------------
    def test_deterministic_reproducibility_50_iterations(self):
        query = RecommendationQuery(
            location=LocationInput(state="Uttar Pradesh", district="Varanasi"),
            temporal=TemporalInput(sowing_month=11, sowing_date="2026-11-12", cultivation_season="Rabi"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=35.0,
                temperature_mean=19.5,
                relative_humidity=60.0,
                irrigation_access="Canal_Gravity",
                irrigation_water_quantity_mm=220.0,
            ),
            edaphic=EdaphicInput(
                soil_texture="Alluvial",
                soil_ph=7.2,
                has_soil_test=True,
                soil_nitrogen=310.0,
                soil_phosphorus=32.0,
                soil_potassium=210.0,
            )
        )

        base_res = self.engine.recommend(query)
        base_recs = [(r.rank, r.crop_id, r.suitability_score, r.evidence_confidence_tier.value) for r in base_res.recommendations]
        base_excluded = [ex.crop_id for ex in base_res.excluded_candidates]
        base_dci = base_res.query_summary.data_completeness_index

        for iteration in range(50):
            current_res = self.engine.recommend(query)
            current_recs = [(r.rank, r.crop_id, r.suitability_score, r.evidence_confidence_tier.value) for r in current_res.recommendations]
            current_excluded = [ex.crop_id for ex in current_res.excluded_candidates]
            current_dci = current_res.query_summary.data_completeness_index

            self.assertEqual(current_recs, base_recs, f"Non-deterministic recommendation ranking on iteration {iteration+1}")
            self.assertEqual(current_excluded, base_excluded, f"Non-deterministic excluded crops on iteration {iteration+1}")
            self.assertEqual(current_dci, base_dci, f"Non-deterministic DCI on iteration {iteration+1}")

    # -------------------------------------------------------------------------
    # 9. Backend-Independent Execution Check
    # -------------------------------------------------------------------------
    def test_backend_independent_execution(self):
        # Ensure zero imported modules from live predictor, backend APIs, or Supabase
        prohibited = [
            "model.predictor",
            "model.cropDatabase",
            "model.fertilizerDatabase",
            "src.lib.predictorEngine",
            "src.lib.api",
        ]
        for mod in prohibited:
            self.assertNotIn(mod, sys.modules, f"Prohibited module {mod} was imported!")


if __name__ == "__main__":
    unittest.main()
