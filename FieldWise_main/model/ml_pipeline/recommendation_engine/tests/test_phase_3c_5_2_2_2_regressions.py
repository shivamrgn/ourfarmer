"""
FieldWise Phase 3C.5.2.2.2: pH Ranking Consistency Regression Test Suite
========================================================================
Validates resolution of the remaining pH ranking consistency findings:

1. Multi-pH boundary evaluation across pH 4.0, 4.2, 8.6, 9.0, and 9.2:
   - Verifies that pH alone does NOT trigger automatic NO_RECOMMENDATION_SUITABLE rejection.
   - Ordinary suitability scoring and ranking proceeds across all canonical crops.
2. Severe soil warnings remain visible:
   - Acidity warnings for pH <= 4.5.
   - Alkalinity/Sodicity warnings for pH >= 8.5.
3. Soft penalties remain active:
   - Tier 2 Liebig scoring applies soft penalties (ph_score < 100.0) where pH is outside preferred range.
4. Ordinary threshold rejection still works when calculated scores fail threshold:
   - Legitimate NO_RECOMMENDATION_SUITABLE is returned when candidate suitability scores fail
     the viability threshold (< 40.0).
   - Generates appropriate land reclamation advisories (Lime for acid, Gypsum for sodic, Drought for arid).
5. Deterministic reproducibility:
   - 50 consecutive executions on identical queries produce bitwise identical outputs and rankings.
"""

import unittest
import hashlib
import json
import sys
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
ENGINE_DIR = TESTS_DIR.parent
ML_PIPELINE_DIR = ENGINE_DIR.parent

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
    CanonicalCropCatalogue,
)


class TestPhase3C5222Regressions(unittest.TestCase):
    """
    Test suite for Phase 3C.5.2.2.2 ranking consistency and boundary safety.
    """

    def setUp(self):
        self.engine = CropRecommendationEngine()
        self.catalogue = CanonicalCropCatalogue()

    # =========================================================================
    # 1. Multi-pH Boundary Evaluation: pH Alone Does NOT Force Rejection
    # =========================================================================
    def test_multi_ph_boundary_evaluation_no_automatic_rejection(self):
        """
        Verify across boundary pH values (4.0, 4.2, 8.6, 9.0, 9.2) that pH alone
        does NOT trigger automatic NO_RECOMMENDATION_SUITABLE rejection.
        When other environmental factors support viable growth (suitability >= 40.0),
        status is SUCCESS with properly ranked candidates.
        """
        boundary_ph_values = [4.0, 4.2, 8.6, 9.0, 9.2]

        for ph_val in boundary_ph_values:
            with self.subTest(ph=ph_val):
                # Punjab Kharif query with adequate irrigation and nutrients
                query = RecommendationQuery(
                    location=LocationInput(state="Punjab", district="Ludhiana"),
                    temporal=TemporalInput(sowing_month=7, cultivation_season="Kharif", sowing_date="2026-07-05"),
                    climate_and_water=ClimateWaterInput(
                        temperature_mean=28.0,
                        seasonal_rainfall_amount=500.0,
                        rainfall_source="On_Farm_Rain_Gauge",
                        station_id="IMD-LDH-01",
                        irrigation_access="Tubewell_Borewell",
                        irrigation_water_quantity_mm=300.0,
                    ),
                    edaphic=EdaphicInput(
                        soil_texture="Loamy",
                        soil_ph=ph_val,
                        has_soil_test=True,
                        nutrient_basis="SHC_Available_kg_ha",
                        soil_nitrogen=280.0,
                        soil_phosphorus=25.0,
                        soil_potassium=200.0,
                    ),
                )
                res = self.engine.recommend(query)

                # pH alone must NOT cause unconditional rejection
                self.assertEqual(
                    res.status,
                    ExecutionStatus.SUCCESS,
                    f"pH {ph_val} alone must not force NO_RECOMMENDATION_SUITABLE when candidates meet threshold.",
                )
                self.assertGreater(
                    len(res.recommendations),
                    0,
                    f"Eligible viable candidates must be returned at pH {ph_val}.",
                )

                # Verify top candidate meets or exceeds viability threshold
                top_rec = res.recommendations[0]
                self.assertGreaterEqual(
                    top_rec.suitability_score,
                    40.0,
                    f"Top candidate at pH {ph_val} must have suitability >= 40.0.",
                )

                # Verify monotonic ranking order
                scores = [r.suitability_score for r in res.recommendations]
                self.assertEqual(
                    scores,
                    sorted(scores, reverse=True),
                    f"Recommendations at pH {ph_val} must be ranked in descending order of suitability score.",
                )

    # =========================================================================
    # 2. Severe Soil Warnings Remain Visible Across Boundaries
    # =========================================================================
    def test_severe_soil_warnings_remain_visible(self):
        """
        Verify that severe soil warnings remain visible on all recommendations:
        - pH <= 4.5: Soil Acidity Warning (recommending lime application).
        - pH >= 8.5: Alkalinity/Sodicity Warning (highlighting nutrient restrictions).
        """
        # Test acidic boundaries
        for ph_acid in [4.0, 4.2]:
            q_acid = RecommendationQuery(
                location=LocationInput(state="Assam", district="Kamrup"),
                temporal=TemporalInput(sowing_month=7),
                climate_and_water=ClimateWaterInput(
                    seasonal_rainfall_amount=1200.0,
                    temperature_mean=28.0,
                    relative_humidity=80.0,
                ),
                edaphic=EdaphicInput(soil_texture="Clay Loam", soil_ph=ph_acid),
            )
            res_acid = self.engine.recommend(q_acid)
            self.assertEqual(res_acid.status, ExecutionStatus.SUCCESS)
            self.assertGreater(len(res_acid.recommendations), 0)

            for rec in res_acid.recommendations:
                has_acidity_warning = any("acidity" in w.lower() for w in rec.risk_warnings)
                self.assertTrue(
                    has_acidity_warning,
                    f"Crop {rec.canonical_name} at pH {ph_acid} must contain Soil Acidity Warning in risk_warnings.",
                )

        # Test alkaline boundaries
        for ph_alkali in [8.6, 9.0, 9.2]:
            q_alkali = RecommendationQuery(
                location=LocationInput(state="Haryana", district="Hisar"),
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
                    soil_ph=ph_alkali,
                    has_soil_test=True,
                    soil_nitrogen=280.0,
                    soil_phosphorus=25.0,
                    soil_potassium=150.0,
                ),
            )
            res_alkali = self.engine.recommend(q_alkali)
            self.assertEqual(res_alkali.status, ExecutionStatus.SUCCESS)
            self.assertGreater(len(res_alkali.recommendations), 0)

            for rec in res_alkali.recommendations:
                crop = self.catalogue.get_crop(rec.crop_id)
                if ph_alkali > crop.soil_ph_max:
                    has_alkalinity_warning = any(
                        "alkalinity" in w.lower() or "sodicity" in w.lower() for w in rec.risk_warnings
                    )
                    self.assertTrue(
                        has_alkalinity_warning,
                        f"Crop {rec.canonical_name} at pH {ph_alkali} must contain Alkalinity/Sodicity Warning.",
                    )

    # =========================================================================
    # 3. Soft Penalties Remain Active in Tier 2 Liebig Scoring
    # =========================================================================
    def test_soft_penalties_remain_active_in_tier_2(self):
        """
        Verify that crops outside their preferred pH range receive active soft penalties
        (ph_score < 100.0) in Tier 2 Liebig scoring, rather than hard exclusion.
        """
        # Test pH 9.2 on wheat (preferred range 6.0 - 8.3)
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
                soil_ph=9.2,
                has_soil_test=True,
                soil_nitrogen=280.0,
                soil_phosphorus=25.0,
                soil_potassium=150.0,
            ),
        )
        res = self.engine.recommend(query)
        self.assertEqual(res.status, ExecutionStatus.SUCCESS)

        wheat_rec = next((r for r in res.recommendations if r.crop_id == "wheat"), None)
        self.assertIsNotNone(wheat_rec, "Wheat must pass Tier 1 under SOFT_PENALTY.")
        self.assertEqual(
            wheat_rec.tier2_components.ph_score,
            30.0,
            "Wheat pH score at 9.2 (exceeding max 8.3 by > 0.5) must be 30.0 (severe soft penalty).",
        )
        self.assertLess(
            wheat_rec.suitability_score,
            55.0,
            "Wheat suitability score must be depressed by the Liebig minimum pH penalty.",
        )

        # Test pH 4.0 on Maize (preferred range 5.5 - 7.5)
        q_acid = RecommendationQuery(
            location=LocationInput(state="Assam"),
            temporal=TemporalInput(sowing_month=7),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=1200.0,
                temperature_mean=28.0,
                relative_humidity=80.0,
            ),
            edaphic=EdaphicInput(soil_texture="Clay Loam", soil_ph=4.0),
        )
        res_acid = self.engine.recommend(q_acid)
        maize_rec = next((r for r in res_acid.recommendations if r.crop_id == "maize"), None)
        self.assertIsNotNone(maize_rec, "Maize must pass Tier 1 under SOFT_PENALTY at pH 4.0.")
        self.assertEqual(
            maize_rec.tier2_components.ph_score,
            30.0,
            "Maize pH score at 4.0 (below min 5.5 by > 0.5) must be 30.0.",
        )

    # =========================================================================
    # 4. Legitimate No-Recommendation Suitability Threshold Rejection
    # =========================================================================
    def test_legitimate_no_recommendation_when_scores_fail_threshold(self):
        """
        Verify that NO_RECOMMENDATION_SUITABLE is legitimately returned when actual
        calculated suitability scores fail the minimum viability threshold (< 40.0).
        Also verifies corresponding land reclamation advisories.
        """
        # Case A: Severe sodicity + water deficit (pH 9.2, no irrigation, low rainfall)
        # All crops depressed below 40.0
        q_sodic_dry = RecommendationQuery(
            location=LocationInput(state="Haryana"),
            temporal=TemporalInput(sowing_month=11, cultivation_season="Rabi"),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=40.0,
                temperature_mean=19.0,
                relative_humidity=50.0,
                irrigation_access="none",
            ),
            edaphic=EdaphicInput(
                soil_texture="Clay Loam",
                soil_ph=9.2,
                has_soil_test=True,
                soil_nitrogen=280.0,
                soil_phosphorus=25.0,
                soil_potassium=150.0,
            ),
        )
        res_sodic_dry = self.engine.recommend(q_sodic_dry)
        self.assertEqual(
            res_sodic_dry.status,
            ExecutionStatus.NO_RECOMMENDATION_SUITABLE,
            "Must return NO_RECOMMENDATION_SUITABLE when all suitability scores fall below 40.0.",
        )
        self.assertIsNotNone(res_sodic_dry.land_reclamation_advisory)
        self.assertIn("Gypsum", res_sodic_dry.land_reclamation_advisory)
        self.assertIn("Sesbania", res_sodic_dry.land_reclamation_advisory)
        self.assertNotIn("Biological survival failed", res_sodic_dry.land_reclamation_advisory)
        for cand in res_sodic_dry.recommendations:
            self.assertLess(
                cand.suitability_score,
                40.0,
                f"Candidate {cand.canonical_name} must have score < 40.0 under NO_RECOMMENDATION_SUITABLE.",
            )

        # Case B: Toxic acidity + heat/water stress (pH 3.8 in drought conditions)
        q_acid_dry = RecommendationQuery(
            location=LocationInput(state="Assam"),
            temporal=TemporalInput(sowing_month=7),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=80.0,  # Far below rice/kharif water requirements
                temperature_mean=38.0,
                relative_humidity=40.0,
                irrigation_access="none",
            ),
            edaphic=EdaphicInput(soil_texture="Clay Loam", soil_ph=3.8),
        )
        res_acid_dry = self.engine.recommend(q_acid_dry)
        self.assertEqual(res_acid_dry.status, ExecutionStatus.NO_RECOMMENDATION_SUITABLE)
        self.assertIsNotNone(res_acid_dry.land_reclamation_advisory)
        self.assertIn("limestone", res_acid_dry.land_reclamation_advisory.lower())
        self.assertNotIn("Biological survival failed", res_acid_dry.land_reclamation_advisory)

        # Case C: Non-pH induced low suitability (e.g., hyper-arid desert with normal pH 7.2)
        q_arid = RecommendationQuery(
            location=LocationInput(state="Rajasthan"),
            temporal=TemporalInput(sowing_month=5),
            climate_and_water=ClimateWaterInput(
                seasonal_rainfall_amount=100.0,
                temperature_mean=45.0,  # Extreme heat stress
                relative_humidity=20.0,
                irrigation_access="none",
            ),
            edaphic=EdaphicInput(soil_texture="Sandy", soil_ph=7.2),
        )
        res_arid = self.engine.recommend(q_arid)
        self.assertEqual(res_arid.status, ExecutionStatus.NO_RECOMMENDATION_SUITABLE)
        self.assertIsNotNone(res_arid.land_reclamation_advisory)
        self.assertIn("drought", res_arid.land_reclamation_advisory.lower())

    # =========================================================================
    # 5. Deterministic Reproducibility
    # =========================================================================
    def test_50_iteration_deterministic_reproducibility(self):
        """
        Verify that 50 consecutive runs across diverse pH queries produce
        100% bitwise identical output hashes.
        """
        queries = [
            RecommendationQuery(
                location=LocationInput(state="Punjab", district="Ludhiana"),
                temporal=TemporalInput(sowing_month=7, cultivation_season="Kharif", sowing_date="2026-07-05"),
                climate_and_water=ClimateWaterInput(
                    temperature_mean=28.0,
                    seasonal_rainfall_amount=500.0,
                    irrigation_access="Tubewell_Borewell",
                    irrigation_water_quantity_mm=300.0,
                ),
                edaphic=EdaphicInput(
                    soil_texture="Loamy",
                    soil_ph=ph,
                    has_soil_test=True,
                    nutrient_basis="SHC_Available_kg_ha",
                    soil_nitrogen=280.0,
                    soil_phosphorus=25.0,
                    soil_potassium=200.0,
                ),
            )
            for ph in [4.0, 4.2, 8.6, 9.0, 9.2]
        ]

        for idx, q in enumerate(queries):
            hashes = []
            for _ in range(10):  # 10 runs per query = 50 total runs
                res = self.engine.recommend(q)
                serialized = json.dumps(
                    {
                        "status": res.status.value,
                        "advisory": res.land_reclamation_advisory,
                        "recs": [
                            {
                                "crop_id": r.crop_id,
                                "rank": r.rank,
                                "score": r.suitability_score,
                                "ph_score": r.tier2_components.ph_score,
                                "warnings": r.risk_warnings,
                            }
                            for r in res.recommendations
                        ],
                    },
                    sort_keys=True,
                )
                h = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
                hashes.append(h)

            self.assertEqual(
                len(set(hashes)),
                1,
                f"Query {idx} (pH {q.edaphic.soil_ph}) produced non-deterministic results across iterations.",
            )


if __name__ == "__main__":
    unittest.main()
