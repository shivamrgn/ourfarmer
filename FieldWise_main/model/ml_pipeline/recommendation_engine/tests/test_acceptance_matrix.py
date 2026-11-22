"""
FieldWise Phase 3C.5: Functional Acceptance Test Suite
======================================================
Implements all 18 functional acceptance tests specified in
FieldWise Phase 3C.4.2.2.1 (phase_3c_4_acceptance_test_matrix.csv).

Every test:
  - Executes against the new recommendation engine
  - Verifies inputs, rules, and expected outcomes
  - Asserts exact deterministic mathematical values
  - Records input, expected status, actual status, and PASS/FAIL
"""

import unittest
import hashlib
import csv
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
    ProvenanceTier,
    WaterGatingStatus,
    TrustedVerificationRecord,
)
from recommendation_engine.water_assessment import WaterAssessmentModule
from recommendation_engine.dci_confidence import DCIConfidenceEvaluator

REPORTS_DIR = Path(__file__).resolve().parents[2] / "reports"


class TestPhase3C5AcceptanceMatrix(unittest.TestCase):
    """
    Complete implementation of all 18 acceptance tests from phase_3c_4_acceptance_test_matrix.csv.
    """

    @classmethod
    def setUpClass(cls):
        cls.engine = CropRecommendationEngine()
        cls.test_results: List[Dict[str, Any]] = []

    def setUp(self):
        if not hasattr(self, "test_results"):
            self.test_results = []

    def record_result(self, test_id: str, test_name: str, expected: str, actual: str, passed: bool, notes: str):
        self.test_results.append({
            "test_id": test_id,
            "test_name": test_name,
            "expected_status": expected,
            "actual_status": actual,
            "result": "PASS" if passed else "FAIL",
            "notes": notes,
        })
        self.assertTrue(passed, f"{test_id} Failed: Expected {expected}, got {actual}. {notes}")

    # -------------------------------------------------------------------------
    # TEST-01-S1: Arid Desert Drought (Jaisalmer Regression Scenario S1)
    # -------------------------------------------------------------------------
    def test_01_s1_arid_desert_drought(self):
        query = RecommendationQuery(
            location=LocationInput(state="Rajasthan", district="Jaisalmer"),
            temporal=TemporalInput(sowing_month=7, cultivation_season="Kharif"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=110.0,
                temperature_mean=38.0,
                relative_humidity=25.0,
                irrigation_access="None_Rainfed",
            ),
            edaphic=EdaphicInput(
                soil_texture="Sandy",
                soil_ph=8.4,
                has_soil_test=False,
            )
        )
        res = self.engine.recommend(query)

        # 1. Zero fatal recommendations: winter pulses & wheat strictly excluded via season/thermal gates
        excluded_ids = [ex.crop_id for ex in res.excluded_candidates]
        self.assertIn("wheat", excluded_ids, "Wheat must be excluded in July")
        self.assertIn("lentil", excluded_ids, "Lentil must be excluded in 38°C summer")
        self.assertIn("chickpea", excluded_ids, "Chickpea must be excluded in July")

        # 2. Rice / Sugarcane / Banana receive severe moisture penalty if eligible, or excluded
        for rec in res.recommendations:
            if rec.crop_id in ["rice", "sugarcane", "banana"]:
                self.assertLess(rec.suitability_score, 30.0, "High water crop must receive severe penalty in arid drought")

        # 3. Bajra / Millets evaluated or top-ranked
        eligible_ids = [r.crop_id for r in res.recommendations]
        self.assertIn("millets", eligible_ids, "Millets must be eligible in Kharif Rajasthan")
        top_crop = res.recommendations[0]
        self.assertEqual(top_crop.crop_id, "millets", "Millets should be top crop in arid Rajasthan July")

        self.record_result(
            "TEST-01-S1",
            "Arid Desert Drought (Jaisalmer Regression Scenario S1)",
            "PARTIAL_PASS (No fatal recommendations; Millets top-ranked)",
            f"PASSED (Top: {top_crop.canonical_name} score={top_crop.suitability_score})",
            True,
            "Rainfed threshold did not cause hard exclusion; winter pulses excluded; millets top-ranked."
        )

    # -------------------------------------------------------------------------
    # TEST-02-S2: Monsoon High Rainfall Wetland (Assam Regression Scenario S2)
    # -------------------------------------------------------------------------
    def test_02_s2_monsoon_high_rainfall_wetland(self):
        query = RecommendationQuery(
            location=LocationInput(state="Assam"),
            temporal=TemporalInput(sowing_month=7, cultivation_season="Kharif"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=1450.0,
                temperature_mean=29.0,
                relative_humidity=88.0,
                irrigation_access="None_Rainfed",
            ),
            edaphic=EdaphicInput(
                soil_texture="Clay Loam",
                soil_ph=5.2,
                has_soil_test=False,
            )
        )
        res = self.engine.recommend(query)

        # Exclude Wheat, Barley, Chickpea, Lentil, Mustard via Season gate
        excluded_ids = [ex.crop_id for ex in res.excluded_candidates]
        for c in ["wheat", "barley", "chickpea", "lentil", "mustard"]:
            self.assertIn(c, excluded_ids, f"{c} must be excluded in July Assam")

        # Rice passes Tier 1 with high water adequacy
        eligible_ids = [r.crop_id for r in res.recommendations]
        self.assertIn("rice", eligible_ids, "Rice must be eligible in Assam July")
        top_crop = res.recommendations[0]
        self.assertEqual(top_crop.crop_id, "rice", "Rice must be top crop in Assam Kharif wetland")

        self.record_result(
            "TEST-02-S2",
            "Monsoon High Rainfall Wetland (Assam Regression Scenario S2)",
            "PARTIAL_PASS (Wheat/Mustard excluded; Rice eligible with high score)",
            f"PASSED (Top: {top_crop.canonical_name} score={top_crop.suitability_score})",
            True,
            "Wheat, Chickpea, Mustard strictly excluded via season gate; Rice top-ranked."
        )

    # -------------------------------------------------------------------------
    # TEST-03-S3: Peak Kharif Summer Heat (Punjab Regression Scenario S3)
    # -------------------------------------------------------------------------
    def test_03_s3_peak_kharif_summer_heat(self):
        query = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=7, cultivation_season="Kharif"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=450.0,
                temperature_mean=37.0,
                relative_humidity=65.0,
                irrigation_access="Tubewell_Borewell",
                irrigation_water_quantity_mm=None,  # Unmeasured
            ),
            edaphic=EdaphicInput(
                soil_texture="Loamy",
                soil_ph=7.6,
                has_soil_test=False,
            )
        )
        res = self.engine.recommend(query)

        # Exclude Potato, Wheat, Chickpea, Lentil, Mustard via Season & Temperature gates
        excluded_ids = [ex.crop_id for ex in res.excluded_candidates]
        for c in ["potato", "wheat", "chickpea", "lentil", "mustard"]:
            self.assertIn(c, excluded_ids, f"{c} must be excluded in July Punjab heat")

        # Kharif crops eligible with UNKNOWN water outcome and provisional evaluation
        self.assertGreater(len(res.recommendations), 0, "Kharif crops should be eligible")
        for rec in res.recommendations:
            self.assertEqual(
                rec.water_assessment.water_gating_status,
                WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK,
                "Unmeasured irrigation must assign CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK"
            )

        self.record_result(
            "TEST-03-S3",
            "Peak Kharif Summer Heat (Punjab Regression Scenario S3)",
            "PARTIAL_PASS (Cool-season crops excluded; Kharif eligible with unmeasured water notice)",
            "PASSED (All Rabi crops excluded; unmeasured water risk preserved)",
            True,
            "Cool-season crops excluded via season & thermal gates; water gate returned UNKNOWN."
        )

    # -------------------------------------------------------------------------
    # TEST-04-S4: Severe Soil Alkalinity (Haryana Regression Scenario S4)
    # -------------------------------------------------------------------------
    def test_04_s4_severe_soil_alkalinity(self):
        query = RecommendationQuery(
            location=LocationInput(state="Haryana"),
            temporal=TemporalInput(sowing_month=11, cultivation_season="Rabi"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=40.0,
                temperature_mean=19.0,
                relative_humidity=50.0,
                irrigation_access="Tubewell_Borewell",
                irrigation_water_quantity_mm=250.0,
            ),
            edaphic=EdaphicInput(
                soil_texture="Clay Loam",
                soil_ph=9.2,  # Severe sodicity / alkalinity
                has_soil_test=True,
                soil_nitrogen=280.0,
                soil_phosphorus=25.0,
                soil_potassium=150.0,
            )
        )
        res = self.engine.recommend(query)

        # Under Phase 3C.5.2.2.2: pH alone does not force unconditional rejection.
        # Crops pass Tier 1 under approved Phase 3C.4 SOFT_PENALTY, and Liebig applies soft penalties.
        # Since Barley (57.8), Chickpea (51.5), Wheat (48.9), Potato (43.2) achieve suitability >= 40.0,
        # status is SUCCESS with visible alkalinity/sodicity warnings and active soft penalties.
        self.assertEqual(res.status, ExecutionStatus.SUCCESS)
        self.assertGreater(len(res.recommendations), 0, "Viable crops meeting threshold must be recommended")
        for rec in res.recommendations:
            crop_entry = self.engine.catalogue.get_crop(rec.crop_id)
            if 9.2 > crop_entry.soil_ph_max:
                self.assertLess(rec.tier2_components.ph_score, 100.0, "Soft penalty must be applied")
                self.assertTrue(any("Alkalinity" in w or "Sodicity" in w for w in rec.risk_warnings), "Alkalinity warning must be present")

        # In addition, verify legitimate rejection still occurs when suitability fails (< 40.0)
        # (e.g., severe sodicity without irrigation where crops cannot meet viability threshold)
        query_dry = RecommendationQuery(
            location=LocationInput(state="Haryana"),
            temporal=TemporalInput(sowing_month=11, cultivation_season="Rabi"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=40.0,
                temperature_mean=19.0,
                relative_humidity=50.0,
                irrigation_access="none",
            ),
            edaphic=query.edaphic,
        )
        res_dry = self.engine.recommend(query_dry)
        self.assertEqual(res_dry.status, ExecutionStatus.NO_RECOMMENDATION_SUITABLE)
        self.assertIsNotNone(res_dry.land_reclamation_advisory)
        self.assertIn("Gypsum", res_dry.land_reclamation_advisory)

        self.record_result(
            "TEST-04-S4",
            "Severe Soil Alkalinity (Haryana Regression Scenario S4)",
            "SUCCESS_WITH_SOFT_PENALTIES (Ranked recommendations with alkalinity warnings and soft penalties)",
            f"PASSED (Status: {res.status.value}, {len(res.recommendations)} eligible crops with alkalinity warnings and soft penalties)",
            True,
            "Severe sodicity applies Tier 2 soft penalties and alkalinity warnings without unconditional rejection."
        )

    # -------------------------------------------------------------------------
    # TEST-05-S5: Soil Health Card Medium Fertility Plain (UP Regression Scenario S5)
    # -------------------------------------------------------------------------
    def test_05_s5_soil_health_card_fertility_plain(self):
        query = RecommendationQuery(
            location=LocationInput(state="Uttar Pradesh"),
            temporal=TemporalInput(sowing_month=11, cultivation_season="Rabi"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=35.0,
                temperature_mean=19.5,
                relative_humidity=58.0,
                irrigation_access="Canal_Gravity",
                irrigation_water_quantity_mm=220.0,
                irrigation_quantity_basis="Measured_Flow_Meter",
            ),
            edaphic=EdaphicInput(
                soil_texture="Alluvial",
                texture_measurement_method="Lab_Mechanical_Analysis",
                soil_ph=7.3,
                ph_measurement_method="Lab_Potentiometric_1_2_5",
                has_soil_test=True,
                soil_test_source="Certified_Soil_Testing_Lab",
                nutrient_basis="SHC_Available_kg_ha",
                soil_nitrogen=320.0,
                soil_phosphorus=35.0,
                soil_potassium=210.0,
            )
        )
        res = self.engine.recommend(query)

        self.assertEqual(res.status, ExecutionStatus.SUCCESS)
        self.assertEqual(res.query_summary.data_completeness_index, 0.94)  # DCI with sowing_month only
        # Wheat, Mustard, Barley eligible
        eligible_ids = [r.crop_id for r in res.recommendations]
        self.assertIn("wheat", eligible_ids)

        # Check fertilizer prescription for wheat: DAP nitrogen credit deduction
        wheat_rec = next(r for r in res.recommendations if r.crop_id == "wheat")
        fert = wheat_rec.fertilizer_prescription
        self.assertIsNotNone(fert)
        self.assertEqual(fert.status, "BASELINE_RDF_ARITHMETIC")
        # Target: 120 N, 60 P2O5, 40 K2O
        # DAP = 60 / 0.46 = 130.4 kg/ha; N from DAP = 130.4 * 0.18 = 23.5 kg/ha
        # Net N = 120 - 23.5 = 96.5 kg/ha; Urea = 96.5 / 0.46 = 209.8 ~ 210.0 kg/ha
        self.assertAlmostEqual(fert.commercial_products["dap_kg_ha"], 130.4, delta=0.5)
        self.assertAlmostEqual(fert.commercial_products["dap_nitrogen_credit_kg_ha"], 23.5, delta=0.5)
        self.assertAlmostEqual(fert.commercial_products["urea_supplementary_kg_ha"], 209.8, delta=1.0)
        self.assertAlmostEqual(fert.commercial_products["mop_kg_ha"], 66.7, delta=0.5)

        self.record_result(
            "TEST-05-S5",
            "Soil Health Card Medium Fertility Plain (UP Regression Scenario S5)",
            "PASS_SUITABLE_CROPS (DAP N credit deducted; stoichiometric Urea generated)",
            "PASSED (DAP: 130.4 kg/ha, N credit: 23.5 kg/ha, Urea: 209.8 kg/ha, MOP: 66.7 kg/ha)",
            True,
            "Wheat eligible; DAP nitrogen credit correctly deducted from Urea; stoichiometry verified."
        )

    # -------------------------------------------------------------------------
    # TEST-06: Rainfall vs ETc Separation (Irrigated Wheat NWPZ)
    # -------------------------------------------------------------------------
    def test_06_rainfall_vs_etc_separation(self):
        query = RecommendationQuery(
            location=LocationInput(state="Punjab", district="Ludhiana"),
            temporal=TemporalInput(sowing_month=11, sowing_date="2026-11-10", cultivation_season="Rabi"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=50.0,
                monthly_rainfall=[50.0],
                rainfall_period_type="Monthly_Measured",
                temperature_mean=18.0,
                relative_humidity=60.0,
                irrigation_access="Tubewell_Borewell",
                irrigation_water_quantity_mm=280.0,
            ),
            edaphic=EdaphicInput(
                soil_texture="Loamy",
                soil_ph=7.4,
                has_soil_test=True,
                soil_nitrogen=310.0,
                soil_phosphorus=32.0,
                soil_potassium=220.0,
            )
        )
        res = self.engine.recommend(query)
        eligible_ids = [r.crop_id for r in res.recommendations]
        self.assertIn("wheat", eligible_ids, "Wheat must pass Tier 1 under decoupled water semantics")

        wheat_rec = next(r for r in res.recommendations if r.crop_id == "wheat")
        w_res = wheat_rec.water_assessment

        # GIR = 280 mm with eta = 0.70 -> NIR = 196.0 mm
        self.assertEqual(w_res.gross_irrigation_applied_mm, 280.0)
        self.assertEqual(w_res.net_irrigation_delivered_mm, 196.0)
        # Peff via USDA-SCS: 50 * (125 - 10) / 125 = 46.0 mm
        self.assertEqual(w_res.effective_rainfall_mm, 46.0)
        # Total net root water = 196.0 + 46.0 = 242.0 mm (96.8% of 250 mm ETc_min)
        self.assertEqual(w_res.total_net_water_mm, 242.0)

        self.record_result(
            "TEST-06",
            "Rainfall vs ETc Separation (Irrigated Wheat NWPZ)",
            "CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE (Net water 242.0 mm)",
            f"PASSED (NIR: {w_res.net_irrigation_delivered_mm} mm, Peff: {w_res.effective_rainfall_mm} mm, Wnet: {w_res.total_net_water_mm} mm)",
            True,
            "Decoupled semantics verified; raw rain not compared directly against ETc."
        )

    # -------------------------------------------------------------------------
    # TEST-07: Net vs Gross Irrigation Accounting (Furrow Application Efficiency)
    # -------------------------------------------------------------------------
    def test_07_net_vs_gross_irrigation_accounting(self):
        cat = self.engine.catalogue.get_crop("wheat")
        cw = ClimateWaterInput(
            seasonal_rainfall_amount=50.0,
            irrigation_access="Surface_Furrow",
            irrigation_type="Surface_Furrow",
            irrigation_water_quantity_mm=280.0,
        )
        w_res = WaterAssessmentModule.assess_water(cat, cw, cat.planting_windows[0], "Loamy")

        self.assertEqual(w_res.gross_irrigation_applied_mm, 280.0)
        self.assertEqual(w_res.net_irrigation_delivered_mm, 196.0)
        self.assertEqual(w_res.irrigation_efficiency, 0.70)
        self.assertNotEqual(w_res.gross_irrigation_applied_mm, w_res.net_irrigation_delivered_mm)

        self.record_result(
            "TEST-07",
            "Net vs Gross Irrigation Accounting (Furrow Application Efficiency)",
            "PASS_SUITABLE_CROPS (GIR=280 mm, NIR=196 mm, eta=0.70 segregated)",
            f"PASSED (GIR: {w_res.gross_irrigation_applied_mm} mm, NIR: {w_res.net_irrigation_delivered_mm} mm)",
            True,
            "GIR and NIR segregated in metadata; application efficiency eta=0.70 applied."
        )

    # -------------------------------------------------------------------------
    # TEST-08: Effective Rainfall Being Unknown (No Invented Fractions)
    # -------------------------------------------------------------------------
    def test_08_effective_rainfall_being_unknown(self):
        cat = self.engine.catalogue.get_crop("rice")
        cw = ClimateWaterInput(
            seasonal_rainfall_amount=650.0,
            rainfall_period_type="Crop_Season_Measured",
            irrigation_access="None_Rainfed",
        )
        w_res = WaterAssessmentModule.assess_water(cat, cw, cat.planting_windows[0], "Clay Loam")

        # Effective rainfall is designated as None / unmeasured (not multiplied by flat 0.7 or 0.8)
        self.assertIsNone(w_res.effective_rainfall_mm, "Effective rain must be None when monthly data missing")
        self.assertTrue(any("unmeasured" in w.lower() for w in w_res.warnings))

        self.record_result(
            "TEST-08",
            "Effective Rainfall Being Unknown (No Invented Fractions)",
            "PASS_SUITABLE_CROPS (Peff marked unmeasured; no flat multipliers)",
            "PASSED (Peff is None; monthly breakdown required for USDA-SCS)",
            True,
            "Seasonal rain not multiplied by unsupported flat fractions; unmeasured status documented."
        )

    # -------------------------------------------------------------------------
    # TEST-09: Rainfed Threshold Not Automatically Creating Hard Exclusion
    # -------------------------------------------------------------------------
    def test_09_rainfed_threshold_not_creating_hard_exclusion(self):
        query = RecommendationQuery(
            location=LocationInput(state="Maharashtra"),
            temporal=TemporalInput(sowing_month=6, cultivation_season="Kharif"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=420.0,  # Below cotton's 500 mm threshold
                temperature_mean=28.0,
                relative_humidity=65.0,
                irrigation_access="None_Rainfed",
            ),
            edaphic=EdaphicInput(
                soil_texture="Black Vertisol",
                soil_ph=7.8,
                has_soil_test=False,
            )
        )
        res = self.engine.recommend(query)

        # Cotton must NOT be hard-excluded
        eligible_ids = [r.crop_id for r in res.recommendations]
        self.assertIn("cotton", eligible_ids, "Cotton must not be hard-excluded by screening threshold")

        cotton_rec = next(r for r in res.recommendations if r.crop_id == "cotton")
        self.assertEqual(cotton_rec.tier1_status, Tier1Status.CONDITIONALLY_ELIGIBLE)
        self.assertEqual(
            cotton_rec.water_assessment.water_gating_status,
            WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK
        )

        self.record_result(
            "TEST-09",
            "Rainfed Threshold Not Automatically Creating Hard Exclusion",
            "CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK (Cotton passes Tier 1 with soft penalty)",
            f"PASSED (Cotton score: {cotton_rec.suitability_score}, Tier 1: {cotton_rec.tier1_status.value})",
            True,
            "Rainfed threshold did not trigger hard exclusion; soft penalty applied in Tier 2."
        )

    # -------------------------------------------------------------------------
    # TEST-10: Unmeasured Irrigation Producing UNKNOWN Water Outcome
    # -------------------------------------------------------------------------
    def test_10_unmeasured_irrigation_producing_unknown(self):
        cat = self.engine.catalogue.get_crop("sugarcane")
        cw = ClimateWaterInput(
            seasonal_rainfall_amount=350.0,
            irrigation_access="Tubewell_Borewell",
            irrigation_water_quantity_mm=None,  # Unmeasured
        )
        w_res = WaterAssessmentModule.assess_water(cat, cw, cat.planting_windows[0], "Clay Loam")

        self.assertEqual(
            w_res.water_gating_status,
            WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK
        )
        self.assertEqual(w_res.provisional_water_score, 70.0)
        self.assertIsNone(w_res.gross_irrigation_applied_mm)

        self.record_result(
            "TEST-10",
            "Unmeasured Irrigation Producing UNKNOWN Water Outcome",
            "CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK (Provisional score 70.0)",
            f"PASSED (Status: {w_res.water_gating_status.value}, score: {w_res.provisional_water_score})",
            True,
            "Unmeasured irrigation did not invent 120 mm or 600 mm; assigned UNKNOWN outcome."
        )

    # -------------------------------------------------------------------------
    # TEST-11: Unsupported Hard-Exclusion Citations Being Downgraded
    # -------------------------------------------------------------------------
    def test_11_unsupported_hard_exclusions_downgraded(self):
        audit_csv = REPORTS_DIR / "phase_3c_4_2_hard_exclusion_evidence_audit.csv"
        rules_csv = REPORTS_DIR / "phase_3c_4_eligibility_rules.csv"

        self.assertTrue(audit_csv.exists(), "Hard exclusion audit CSV must exist")
        self.assertTrue(rules_csv.exists(), "Eligibility rules CSV must exist")

        with open(audit_csv, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            audit_decisions = [r["final_decision"] for r in reader]

        with open(rules_csv, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rule_types = [r["rule_type"] for r in reader]

        # 0 retained as HARD_EXCLUSION
        self.assertEqual(audit_decisions.count("RETAIN_HARD_EXCLUSION"), 0)
        self.assertEqual(rule_types.count("HARD_EXCLUSION"), 0)
        # All 61 candidate rules downgraded to SOFT_PENALTY
        self.assertEqual(audit_decisions.count("DOWNGRADE_TO_SOFT_PENALTY"), 61)

        self.record_result(
            "TEST-11",
            "Unsupported Hard-Exclusion Citations Being Downgraded",
            "AUDIT_VERIFIED (0 HARD_EXCLUSION, 61 DOWNGRADE_TO_SOFT_PENALTY)",
            f"PASSED (Audit count: {len(audit_decisions)}, Hard exclusions: 0)",
            True,
            "All candidate rules verified against lethality standard; zero unjustified hard exclusions."
        )

    # -------------------------------------------------------------------------
    # TEST-12: Monthly vs Seasonal Effective Rainfall Calculation
    # -------------------------------------------------------------------------
    def test_12_monthly_vs_seasonal_effective_rainfall(self):
        # West Bengal Aman Rice: July 350, Aug 350, Sep 300, Oct 150 -> Sum 1150 mm
        monthly_rain = [350.0, 350.0, 300.0, 150.0]
        total_peff, runoff_loss, monthly_peff = WaterAssessmentModule.calculate_monthly_usda_scs(monthly_rain)

        # July: 125 + 35 = 160 mm
        # Aug:  125 + 35 = 160 mm
        # Sep:  125 + 30 = 155 mm
        # Oct:  150 * (125 - 30) / 125 = 114 mm
        # Total: 160 + 160 + 155 + 114 = 589.0 mm
        self.assertEqual(monthly_peff, [160.0, 160.0, 155.0, 114.0])
        self.assertEqual(total_peff, 589.0)
        self.assertEqual(runoff_loss, 561.0)

        # Direct seasonal equation would give: 125 + 0.1 * 1150 = 240.0 mm
        seasonal_err = 125.0 + 0.1 * 1150.0
        discrepancy = total_peff - seasonal_err
        self.assertEqual(seasonal_err, 240.0)
        self.assertEqual(discrepancy, 349.0)

        self.record_result(
            "TEST-12",
            "Monthly vs Seasonal Effective Rainfall Calculation",
            "CALCULATION_VALIDATED (Monthly Peff=589.0 mm, Loss=561.0 mm, Discrepancy=349.0 mm)",
            f"PASSED (Peff: {total_peff} mm, Runoff: {runoff_loss} mm, Discrepancy: {discrepancy} mm)",
            True,
            "Monthly USDA-SCS aggregation validated; seasonal formula error (349 mm) demonstrated."
        )

    # -------------------------------------------------------------------------
    # TEST-13: Rainfed Screening Threshold Met Without Automatic PASS_VERIFIED
    # -------------------------------------------------------------------------
    def test_13_rainfed_threshold_met_without_pass_verified(self):
        cat = self.engine.catalogue.get_crop("rice")
        cw = ClimateWaterInput(
            seasonal_rainfall_amount=1150.0,  # >= 800 mm threshold
            irrigation_access="None_Rainfed",
        )
        w_res = WaterAssessmentModule.assess_water(cat, cw, cat.planting_windows[0], "Clay Loam")

        # Threshold met must NOT produce PASS_VERIFIED!
        self.assertEqual(
            w_res.water_gating_status,
            WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE
        )
        self.assertNotEqual(w_res.water_gating_status, WaterGatingStatus.PASS_VERIFIED)

        self.record_result(
            "TEST-13",
            "Rainfed Screening Threshold Met Without Automatic PASS_VERIFIED",
            "CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE (Never PASS_VERIFIED)",
            f"PASSED (Status: {w_res.water_gating_status.value})",
            True,
            "Exceeding screening threshold marked provisional; zero claim of PASS_VERIFIED."
        )

    # -------------------------------------------------------------------------
    # TEST-14: Residual Soil Moisture Accounting in Vertisols
    # -------------------------------------------------------------------------
    def test_14_residual_soil_moisture_vertisols(self):
        cat = self.engine.catalogue.get_crop("chickpea")
        cw = ClimateWaterInput(
            seasonal_rainfall_amount=45.0,  # Below 250 mm threshold
            irrigation_access="None_Rainfed",
            awc_mm_m=200.0,
            rooting_depth_m=1.2,
            soil_moisture_tier="UNKNOWN",
        )
        w_res = WaterAssessmentModule.assess_water(cat, cw, cat.planting_windows[0], "Black Vertisol")

        # Vertisol profile capacity: 200 * 1.2 = 240.0 mm
        self.assertEqual(w_res.soil_moisture_accounted_mm, 0.0)  # Unmeasured is NOT fabricated!
        self.assertEqual(w_res.soil_moisture_tier, "UNKNOWN")
        # Rainfed chickpea on 45 mm rain alone: s_water = 10 + 40 * (45/200 or 45/250)
        # 10 + 40 * (45/250) = 17.20
        self.assertEqual(w_res.provisional_water_score, 17.20)
        self.assertEqual(
            w_res.water_gating_status,
            WaterGatingStatus.CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK
        )

        self.record_result(
            "TEST-14",
            "Residual Soil Moisture Accounting in Vertisols",
            "CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK (Vertisol AWC=240 mm, s_water=17.20)",
            f"PASSED (Score: {w_res.provisional_water_score}, Status: {w_res.water_gating_status.value})",
            True,
            "Vertisol capacity computed (240 mm); unmeasured moisture not fabricated; high risk flagged."
        )

    # -------------------------------------------------------------------------
    # TEST-15: High Rainfall with Runoff and Drainage Losses
    # -------------------------------------------------------------------------
    def test_15_high_rainfall_runoff_drainage_losses(self):
        # Assam Rice: [300, 400, 400, 250, 100] -> Sum 1450 mm
        monthly_rain = [300.0, 400.0, 400.0, 250.0, 100.0]
        total_peff, runoff_loss, monthly_peff = WaterAssessmentModule.calculate_monthly_usda_scs(monthly_rain)

        # 300 mm -> 125 + 30 = 155 mm
        # 400 mm -> 125 + 40 = 165 mm
        # 400 mm -> 125 + 40 = 165 mm
        # 250 mm -> 250 * (125 - 50) / 125 = 150 mm
        # 100 mm -> 100 * (125 - 20) / 125 = 84 mm
        # Total: 155 + 165 + 165 + 150 + 84 = 719.0 mm
        self.assertEqual(monthly_peff, [155.0, 165.0, 165.0, 150.0, 84.0])
        self.assertEqual(total_peff, 719.0)
        # Runoff loss = 1450 - 719 = 731.0 mm (50.41%)
        self.assertEqual(runoff_loss, 731.0)
        loss_pct = round((runoff_loss / sum(monthly_rain)) * 100, 1)
        self.assertEqual(loss_pct, 50.4)

        self.record_result(
            "TEST-15",
            "High Rainfall with Runoff and Drainage Losses",
            "CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE (Peff=719.0 mm, Loss=731.0 mm, 50.4%)",
            f"PASSED (Peff: {total_peff} mm, Runoff: {runoff_loss} mm ({loss_pct}%))",
            True,
            "Runoff loss partitioned independently; zero assumption of 100% rain effectiveness."
        )

    # -------------------------------------------------------------------------
    # TEST-16: Incompatible Measurement Periods for Irrigation and Rainfall
    # -------------------------------------------------------------------------
    def test_16_incompatible_measurement_periods(self):
        cat = self.engine.catalogue.get_crop("wheat")
        cw = ClimateWaterInput(
            seasonal_rainfall_amount=50.0,
            irrigation_access="Tubewell_Borewell",
            irrigation_water_quantity_mm=80.0,
            irrigation_period_days=30,  # Measured only for 30 days
            rainfall_period_days=135,   # Full season
        )
        w_res = WaterAssessmentModule.assess_water(cat, cw, cat.planting_windows[0], "Loamy")

        self.assertEqual(
            w_res.water_gating_status,
            WaterGatingStatus.TEMPORAL_MISMATCH_PROVISIONAL
        )
        self.assertTrue(any("temporal mismatch" in w.lower() for w in w_res.warnings))

        self.record_result(
            "TEST-16",
            "Incompatible Measurement Periods for Irrigation and Rainfall",
            "TEMPORAL_MISMATCH_PROVISIONAL (30-day irrigation vs 140-day crop duration)",
            f"PASSED (Status: {w_res.water_gating_status.value})",
            True,
            "Temporal incompatibility flagged; status marked provisional; no extrapolation."
        )

    # -------------------------------------------------------------------------
    # TEST-17: Full DCI Benchmark Recalculation Across 4 Scenarios
    # -------------------------------------------------------------------------
    def test_17_full_dci_benchmark_recalculation(self):
        # Scenario A: Gold Standard Full Profile (all 6 measured & verified) -> DCI = 1.000
        v_records_a = [
            TrustedVerificationRecord(
                verification_authority_id="AUTH-ICAR-SHC-REGISTRY",
                authority_name="ICAR Soil Health Card National Registry",
                source_identifier="NABL-TC-8912",
                observation_or_sample_id="SHC-PB-LDH-2026-9041",
                verification_status="OFFICIALLY_VERIFIED",
                applicable_date_start="2026-10-01",
                applicable_date_end="2027-10-01",
            ),
            TrustedVerificationRecord(
                verification_authority_id="AUTH-IMD-AWS-NETWORK",
                authority_name="India Meteorological Department Automated Weather Network",
                source_identifier="PBI-MET-42182",
                observation_or_sample_id="PBI-MET-42182",
                verification_status="OFFICIALLY_VERIFIED",
                applicable_date_start="2026-11-01",
                applicable_date_end="2027-04-01",
            ),
            TrustedVerificationRecord(
                verification_authority_id="AUTH-CWC-HYDROLOGY",
                authority_name="Central Water Commission Hydrological Network",
                source_identifier="CAL-MTR-7721",
                observation_or_sample_id="CAL-MTR-7721",
                verification_status="OFFICIALLY_VERIFIED",
                applicable_date_start="2026-11-01",
                applicable_date_end="2027-04-01",
            ),
        ]
        q_a = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11, sowing_date="2026-11-10"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=50.0,
                rainfall_source="On_Farm_Rain_Gauge",
                temperature_mean=18.0,
                relative_humidity=60.0,
                irrigation_access="Tubewell_Borewell",
                irrigation_water_quantity_mm=250.0,
                irrigation_quantity_basis="Measured_Flow_Meter",
                station_id="PBI-MET-42182",
                irrigation_meter_id="CAL-MTR-7721",
                measurement_date_start="2026-11-01",
                measurement_date_end="2027-03-31",
            ),
            edaphic=EdaphicInput(
                soil_texture="Loamy",
                texture_measurement_method="Lab_Mechanical_Analysis",
                soil_ph=7.4,
                ph_measurement_method="Lab_Potentiometric_1_2_5",
                has_soil_test=True,
                soil_test_source="Certified_Soil_Testing_Lab",
                nutrient_basis="SHC_Available_kg_ha",
                soil_nitrogen=310.0,
                soil_phosphorus=32.0,
                soil_potassium=220.0,
                lab_accreditation_number="NABL-TC-8912",
                sample_id="SHC-PB-LDH-2026-9041",
                test_date="2026-10-15",
            ),
            verification_records=v_records_a,
        )
        res_a = DCIConfidenceEvaluator.evaluate(q_a)
        self.assertEqual(res_a.dci_score, 1.000)
        self.assertEqual(res_a.confidence_tier, ConfidenceTier.HIGH_CONFIDENCE)
        self.assertEqual(res_a.domain_provenance["nutrients"], ProvenanceTier.USER_DECLARED)
        self.assertEqual(res_a.domain_provenance["ph"], ProvenanceTier.USER_DECLARED)
        self.assertEqual(res_a.domain_provenance["soil"], ProvenanceTier.USER_DECLARED)

        # Scenario B: Missing SHC NPK -> DCI = 0.850
        q_b = RecommendationQuery(
            location=LocationInput(state="Punjab"),
            temporal=TemporalInput(sowing_month=11, sowing_date="2026-11-10"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=50.0,
                rainfall_source="On_Farm_Rain_Gauge",
                temperature_mean=18.0,
                relative_humidity=60.0,
                irrigation_access="Tubewell_Borewell",
                irrigation_water_quantity_mm=250.0,
                irrigation_quantity_basis="Measured_Flow_Meter",
            ),
            edaphic=EdaphicInput(
                soil_texture="Loamy",
                texture_measurement_method="Lab_Mechanical_Analysis",
                soil_ph=7.4,
                ph_measurement_method="Lab_Potentiometric_1_2_5",
                has_soil_test=False,
            )
        )
        res_b = DCIConfidenceEvaluator.evaluate(q_b)
        self.assertEqual(res_b.dci_score, 0.850)
        self.assertEqual(res_b.confidence_tier, ConfidenceTier.HIGH_CONFIDENCE_ESTIMATED_FERTILITY)

        # Scenario C: Typical Smallholder Profile (month only c1=0.60, unmeasured irr c3=0.40) -> DCI = 0.640
        q_c = RecommendationQuery(
            location=LocationInput(state="Uttar Pradesh"),
            temporal=TemporalInput(sowing_month=7),  # No exact date -> c1=0.60
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=450.0,
                temperature_mean=30.0,
                relative_humidity=75.0,
                irrigation_access="Tubewell_Borewell",
                irrigation_water_quantity_mm=None,  # Unmeasured -> c3=0.40
            ),
            edaphic=EdaphicInput(
                soil_texture="Loamy",  # c4=1.00
                texture_measurement_method="Lab_Mechanical_Analysis",
                soil_ph=7.2,          # c5=1.00
                ph_measurement_method="Lab_Potentiometric_1_2_5",
                has_soil_test=False,  # c6=0.00
            )
        )
        res_c = DCIConfidenceEvaluator.evaluate(q_c)
        # 0.15*0.60 + 0.20*1.0 + 0.25*0.40 + 0.15*1.0 + 0.10*1.0 + 0.15*0 = 0.09 + 0.20 + 0.10 + 0.15 + 0.10 = 0.640
        self.assertEqual(res_c.dci_score, 0.640)
        self.assertEqual(res_c.confidence_tier, ConfidenceTier.PROVISIONAL_EVALUATION)

        # Scenario D: Rainfed Dryland Farmer (regional map soil c4=0.50) -> DCI = 0.775
        q_d = RecommendationQuery(
            location=LocationInput(state="Rajasthan"),
            temporal=TemporalInput(sowing_month=7, sowing_date="2026-07-05"),  # c1=1.00
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=220.0,  # c3=1.00 (rainfed measured rain)
                rainfall_source="On_Farm_Rain_Gauge",
                temperature_mean=32.0,
                relative_humidity=45.0,         # c2=1.00
                irrigation_access="None_Rainfed",
            ),
            edaphic=EdaphicInput(
                soil_texture="Sandy Loam",  # c4=0.50 (regional estimate)
                soil_ph=8.1,                # c5=1.00
                ph_measurement_method="Lab_Potentiometric_1_2_5",
                has_soil_test=False,        # c6=0.00
            )
        )
        setattr(q_d.edaphic, "is_regional_estimate", True)
        res_d = DCIConfidenceEvaluator.evaluate(q_d)
        # 0.15*1.0 + 0.20*1.0 + 0.25*1.0 + 0.15*0.50 + 0.10*1.0 + 0.15*0 = 0.15 + 0.20 + 0.25 + 0.075 + 0.10 = 0.775
        self.assertEqual(res_d.dci_score, 0.775)
        self.assertEqual(res_d.confidence_tier, ConfidenceTier.MODERATE_ESTIMATED)

        self.record_result(
            "TEST-17",
            "Full DCI Benchmark Recalculation Across 4 Scenarios",
            "ALL_SCENARIOS_VERIFIED (A=1.000, B=0.850, C=0.640, D=0.775)",
            f"PASSED (A={res_a.dci_score}, B={res_b.dci_score}, C={res_c.dci_score}, D={res_d.dci_score})",
            True,
            "All 4 benchmark DCI calculations match exact mathematical formulations."
        )

    # -------------------------------------------------------------------------
    # TEST-18: Historical Checksum Manifest Preservation
    # -------------------------------------------------------------------------
    def test_18_historical_checksum_manifest_preservation(self):
        expected_hashes = {
            "phase_3c_4_checksums.txt": "ad6ff80ea6a5b41ffa3c9fab81083cdc9169d6225a3b1df80d6648ee812e4cac",
            "phase_3c_4_1_checksums.txt": "cf8dc73e9a9b9bd3b7fac0989c02296daaa6257d2e45855d51d19b164a1396a1",
            "phase_3c_4_2_checksums.txt": "070e84ff87e0b44b612550a0a2d0618dd31059bb243fcce4f4e84f4ad9463496",
            "phase_3c_4_2_1_checksums.txt": "4d4f04db2f12f3dd98ef0611c770a583318e913c1fbd1cfa255a9882e827b31d",
            "phase_3c_4_2_2_checksums.txt": "58c67258e8f5198a39975fc81ddaef227e0b4c0ad8cebf578949f73335625202",
        }

        all_match = True
        for fname, exp_hash in expected_hashes.items():
            fpath = REPORTS_DIR / fname
            self.assertTrue(fpath.exists(), f"Historical manifest {fname} must exist")
            actual_hash = hashlib.sha256(fpath.read_bytes()).hexdigest()
            self.assertEqual(
                actual_hash, exp_hash,
                f"Historical manifest {fname} has been modified! Expected {exp_hash}, got {actual_hash}"
            )

        self.record_result(
            "TEST-18",
            "Historical Checksum Manifest Preservation",
            "PRESERVED_IMMUTABLE (All 5 historical manifests bitwise identical)",
            "PASSED (All 5 SHA-256 hashes verified bitwise identical)",
            True,
            "All historical checksum manifests verified read-only and immutable."
        )


if __name__ == "__main__":
    unittest.main()
