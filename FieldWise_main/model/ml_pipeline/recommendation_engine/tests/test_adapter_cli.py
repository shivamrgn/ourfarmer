"""
FieldWise Phase 3C.6.2.1.3: Python Adapter CLI Test Suite
========================================================
Comprehensive test suite verifying the standalone adapter CLI interface against all
Phase 3C.6.2.1.3 contract and seasonal rainfall provenance closure specifications:
  1. Valid JSON request produces clean execution and valid JSON output.
  2. Malformed JSON returns nonzero exit code and stderr diagnostics.
  3. Strict sowing-month validation: accepts only actual JSON integers 1-12;
     strictly rejects 10.9, 10.0, "10", True, 0, and 13.
  4. Missing irrigation does not become rainfed (irrigation_access=None).
  5. Irrigation semantics: generic "none" does NOT map to rainfed;
     explicit "rainfed" and "None_Rainfed" map to None_Rainfed; categories preserved.
  6. Rainfall semantics & deterministic conflict policy:
     - Generic 'rainfall' without period classification remains unclassified (None).
     - 'Crop_Season_Measured' + generic 'rainfall' populates seasonal_rainfall_amount.
     - Explicit 'seasonal_rainfall_mm' and 'seasonal_rainfall_amount' aliases accepted.
     - Annual rainfall and explicit seasonal rainfall supplied together preserves annual
       context in source_reference, while seasonal value alone populates seasonal_rainfall_amount.
     - Conflicting seasonal aliases, conflicting annual aliases, contradictory period types,
       and generic vs explicit conflicts are strictly rejected.
  7. Missing seasonal rainfall remains unknown; verifies real recommendations so test
     cannot pass vacuously.
  8. Strict boolean validation: has_soil_test and has_stcr_calibration strictly reject
     "true", "false", 1, 0, and accept only actual booleans.
  9. Soil-test declaration remains USER_DECLARED (never INDEPENDENTLY_VERIFIED; baseline RDF).
  10. Numeric safety: rejects NaN, positive/negative infinity, negative rainfall, and
      non-finite/negative monthly rainfall elements.
  11. Verification records: rejects malformed payload structures instead of silently ignoring them.
  12. Engine exception returns nonzero exit status and logs exclusively to stderr.
  13. Stdout contains valid JSON only across varied runs (zero log pollution).
  14. Existing frozen engine files remain 100% unchanged against authoritative manifest,
      verifying exactly 14 expected files and relative file set.
  15. Strict whole-day validation: irrigation_period_days and rainfall_period_days must be
      actual JSON integers > 0; strictly rejects floats (10.0, 10.9), strings ("10"), booleans,
      and non-positive values (0, -5).
  16. Strict JSON serialization: json.dumps(..., allow_nan=False) fails safely on non-finite
      output (exit code 1, zero stdout bytes, diagnostic on stderr).
  17. Seasonal rainfall provenance closure: seasonal aliases establish the rainfall period,
      not the evidence source or measurement status; when rainfall_period_type is omitted,
      it remains unprovided (None) and is never implicitly labeled Crop_Season_Measured;
      explicitly estimated classifications do not become measured.
"""

import sys
import os
import json
import math
import hashlib
import unittest
import subprocess
from pathlib import Path

# Resolve directory paths
TESTS_DIR = Path(__file__).resolve().parent
ENGINE_DIR = TESTS_DIR.parent
ML_PIPELINE_DIR = ENGINE_DIR.parent
REPORTS_DIR = ML_PIPELINE_DIR / "reports"
PROJECT_ROOT = ML_PIPELINE_DIR.parent.parent

# Add required paths for module imports
for p in [str(ML_PIPELINE_DIR), str(PROJECT_ROOT)]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from recommendation_engine.adapter_cli import build_query, serialize_result, AdapterValidationError
    from recommendation_engine.schemas import TrustedVerificationRecord
except ImportError:
    from FieldWise_main.model.ml_pipeline.recommendation_engine.adapter_cli import (
        build_query,
        serialize_result,
        AdapterValidationError,
    )
    from FieldWise_main.model.ml_pipeline.recommendation_engine.schemas import TrustedVerificationRecord


class TestRecommendationEngineAdapterCLI(unittest.TestCase):
    """
    Validates adapter_cli.py subprocess execution, input-semantics closure,
    and contract compliance.
    """

    @classmethod
    def setUpClass(cls):
        cls.cli_path = ENGINE_DIR / "adapter_cli.py"
        cls.python_exe = sys.executable

    def _run_cli(self, input_str: str) -> subprocess.CompletedProcess:
        """Helper to invoke adapter_cli.py via subprocess with stdin piping."""
        env = dict(os.environ)
        env["PYTHONPATH"] = f"{PROJECT_ROOT}:{ML_PIPELINE_DIR}:{PROJECT_ROOT}/FieldWise_main"
        return subprocess.run(
            [self.python_exe, str(self.cli_path)],
            input=input_str,
            capture_output=True,
            text=True,
            env=env,
        )

    # -------------------------------------------------------------------------
    # Test 1: Valid JSON request
    # -------------------------------------------------------------------------
    def test_01_valid_json_request(self):
        payload = {
            "state": "Punjab",
            "district": "Ludhiana",
            "sowing_month": 10,
            "irrigation_access": "Tubewell_Borewell",
            "irrigation_water_quantity_mm": 350.0,
            "seasonal_rainfall_amount": 100.0,
            "rainfall_source": "IMD_Station_Gridded",
            "temperature": 24.0,
            "humidity": 65.0,
            "soil_texture": "Sandy Loam",
            "soil_ph": 7.2,
            "has_soil_test": True,
            "nitrogen": 120.0,
            "phosphorus": 45.0,
            "potassium": 150.0,
        }
        res = self._run_cli(json.dumps(payload))
        self.assertEqual(res.returncode, 0, f"Expected returncode 0, got {res.returncode}. Stderr: {res.stderr}")
        self.assertTrue(len(res.stdout.strip()) > 0, "Stdout should not be empty.")

        data = json.loads(res.stdout)
        self.assertIn("status", data)
        self.assertEqual(data["status"], "SUCCESS")
        self.assertIn("recommendations", data)
        self.assertTrue(len(data["recommendations"]) > 0)
        self.assertIn("query_summary", data)
        self.assertEqual(data["engine_version"], "2.2.0-CLOSURE")

    # -------------------------------------------------------------------------
    # Test 2: Malformed JSON
    # -------------------------------------------------------------------------
    def test_02_malformed_json(self):
        malformed_input = '{"state": "Punjab", "sowing_month": 10, '
        res = self._run_cli(malformed_input)
        self.assertNotEqual(res.returncode, 0, "Malformed JSON must return nonzero exit code.")
        self.assertEqual(res.stdout.strip(), "", "Stdout must be empty on malformed JSON.")
        self.assertIn("Malformed JSON input", res.stderr)

    # -------------------------------------------------------------------------
    # Test 3: Strict sowing-month validation (10.9, 10.0, "10", True, 0, 13)
    # -------------------------------------------------------------------------
    def test_03_strict_sowing_month_validation(self):
        base_payload = {"state": "Punjab"}

        # 3.1 Missing sowing month
        with self.assertRaises(AdapterValidationError) as ctx:
            build_query(base_payload)
        self.assertIn("sowing_month", str(ctx.exception))

        # 3.2 Fractional float 10.9
        with self.assertRaises(AdapterValidationError):
            build_query({**base_payload, "sowing_month": 10.9})

        # 3.3 Integer float 10.0
        with self.assertRaises(AdapterValidationError):
            build_query({**base_payload, "sowing_month": 10.0})

        # 3.4 String "10"
        with self.assertRaises(AdapterValidationError):
            build_query({**base_payload, "sowing_month": "10"})

        # 3.5 Boolean True
        with self.assertRaises(AdapterValidationError):
            build_query({**base_payload, "sowing_month": True})

        # 3.6 Out of range: 0
        with self.assertRaises(AdapterValidationError):
            build_query({**base_payload, "sowing_month": 0})

        # 3.7 Out of range: 13
        with self.assertRaises(AdapterValidationError):
            build_query({**base_payload, "sowing_month": 13})

        # 3.8 CLI subprocess execution check for invalid sowing_month
        res = self._run_cli(json.dumps({**base_payload, "sowing_month": "10"}))
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("sowing_month", res.stderr)

        # 3.9 Valid integer 10 succeeds
        query = build_query({**base_payload, "sowing_month": 10})
        self.assertEqual(query.temporal.sowing_month, 10)

    # -------------------------------------------------------------------------
    # Test 4: Missing irrigation does not become rainfed
    # -------------------------------------------------------------------------
    def test_04_missing_irrigation_does_not_become_rainfed(self):
        payload_no_irr = {
            "state": "Punjab",
            "sowing_month": 10,
            "seasonal_rainfall_amount": 500.0,
            "rainfall_source": "Farmer_Estimated",
            "temperature": 24.0,
            "humidity": 60.0,
            "soil_texture": "Sandy Loam",
            "soil_ph": 7.0,
            "has_soil_test": True,
            "nitrogen": 120.0,
            "phosphorus": 40.0,
            "potassium": 150.0,
        }
        # Direct query builder check
        query = build_query(payload_no_irr)
        self.assertIsNone(
            query.climate_and_water.irrigation_access,
            "Adapter must explicitly pass irrigation_access=None when omitted, overriding constructor default 'None_Rainfed'."
        )

        # Subprocess execution check
        res = self._run_cli(json.dumps(payload_no_irr))
        self.assertEqual(res.returncode, 0)
        data = json.loads(res.stdout)
        water_regime = data["query_summary"]["water_regime_evaluated"]
        self.assertFalse(
            water_regime.startswith("None_Rainfed"),
            f"Omitted irrigation must not be evaluated as None_Rainfed. Got: {water_regime}"
        )

    # -------------------------------------------------------------------------
    # Test 5: Irrigation semantics (generic "none" vs explicit "rainfed")
    # -------------------------------------------------------------------------
    def test_05_irrigation_semantics_none_vs_rainfed(self):
        base = {"state": "Punjab", "sowing_month": 10}

        # 5.1 Generic "none" must NOT be treated as rainfed
        q_none = build_query({**base, "irrigation_access": "none"})
        self.assertIsNone(
            q_none.climate_and_water.irrigation_access,
            "Generic 'none' must not map to None_Rainfed; must remain unknown/None."
        )

        # 5.2 Missing / blank / UNKNOWN remain unknown
        q_blank = build_query({**base, "irrigation_access": "   "})
        self.assertIsNone(q_blank.climate_and_water.irrigation_access)

        q_unknown = build_query({**base, "irrigation_access": "UNKNOWN"})
        self.assertIsNone(q_unknown.climate_and_water.irrigation_access)

        # 5.3 Explicit "rainfed" maps to "None_Rainfed"
        q_rainfed = build_query({**base, "irrigation_access": "rainfed"})
        self.assertEqual(q_rainfed.climate_and_water.irrigation_access, "None_Rainfed")

        # 5.4 Explicit "None_Rainfed" is preserved
        q_explicit = build_query({**base, "irrigation_access": "None_Rainfed"})
        self.assertEqual(q_explicit.climate_and_water.irrigation_access, "None_Rainfed")

        # 5.5 Valid explicit irrigation categories are preserved
        q_tube = build_query({**base, "irrigation_access": "Tubewell_Borewell"})
        self.assertEqual(q_tube.climate_and_water.irrigation_access, "Tubewell_Borewell")

    # -------------------------------------------------------------------------
    # Test 6: Rainfall semantics and deterministic conflict policy
    # -------------------------------------------------------------------------
    def test_06_rainfall_semantics(self):
        base = {"state": "Punjab", "sowing_month": 10}

        # 6.1 Generic rainfall with no period classification must remain unclassified
        q_generic = build_query({**base, "rainfall": 200.0})
        self.assertIsNone(
            q_generic.climate_and_water.seasonal_rainfall_amount,
            "Generic 'rainfall' without an established period classification must NOT populate seasonal_rainfall_amount."
        )
        self.assertIn("Unclassified Rainfall Context: 200.0 mm", q_generic.climate_and_water.source_reference)

        # 6.2 Crop_Season_Measured plus generic rainfall populates seasonal_rainfall_amount
        q_season_generic = build_query({
            **base,
            "rainfall": 180.0,
            "rainfall_period_type": "Crop_Season_Measured",
        })
        self.assertEqual(
            q_season_generic.climate_and_water.seasonal_rainfall_amount,
            180.0,
            "'Crop_Season_Measured' plus generic 'rainfall' must populate seasonal_rainfall_amount."
        )
        self.assertEqual(q_season_generic.climate_and_water.rainfall_period_type, "Crop_Season_Measured")

        # 6.3 Generic rainfall with an annual classification
        q_annual_class = build_query({
            **base,
            "rainfall": 1200.0,
            "rainfall_period_type": "Annual_Estimated",
        })
        self.assertIsNone(
            q_annual_class.climate_and_water.seasonal_rainfall_amount,
            "Annual rainfall classification must never populate seasonal_rainfall_amount."
        )
        self.assertEqual(q_annual_class.climate_and_water.rainfall_period_type, "Annual_Estimated")
        self.assertIn("Annual Rainfall Context: 1200.0 mm", q_annual_class.climate_and_water.source_reference)

        # 6.4 Explicit seasonal_rainfall_amount alias (unclassified when period_type is omitted)
        q_seasonal_amt = build_query({**base, "seasonal_rainfall_amount": 350.0})
        self.assertEqual(q_seasonal_amt.climate_and_water.seasonal_rainfall_amount, 350.0)
        self.assertIsNone(
            q_seasonal_amt.climate_and_water.rainfall_period_type,
            "seasonal_rainfall_amount without rainfall_period_type must remain None (never implicitly Crop_Season_Measured)."
        )

        # 6.5 Explicit seasonal_rainfall_mm alias (unclassified when period_type is omitted)
        q_seasonal_mm = build_query({**base, "seasonal_rainfall_mm": 275.0})
        self.assertEqual(q_seasonal_mm.climate_and_water.seasonal_rainfall_amount, 275.0)
        self.assertIsNone(
            q_seasonal_mm.climate_and_water.rainfall_period_type,
            "seasonal_rainfall_mm without rainfall_period_type must remain None (never implicitly Crop_Season_Measured)."
        )

        # 6.6 Annual rainfall and explicit seasonal rainfall supplied together
        q_both = build_query({
            **base,
            "annual_rainfall": 1100.0,
            "seasonal_rainfall_amount": 320.0,
        })
        self.assertEqual(
            q_both.climate_and_water.seasonal_rainfall_amount,
            320.0,
            "Explicit seasonal rainfall must populate seasonal_rainfall_amount."
        )
        self.assertNotEqual(
            q_both.climate_and_water.seasonal_rainfall_amount,
            1100.0,
            "Annual rainfall must never become seasonal rainfall."
        )
        self.assertIn("Annual Rainfall Context: 1100.0 mm", q_both.climate_and_water.source_reference)
        self.assertIsNone(
            q_both.climate_and_water.rainfall_period_type,
            "Annual + seasonal without period classification must keep rainfall_period_type as None."
        )

        # 6.7 Annual rainfall equal to zero (handled correctly without truthiness bugs)
        q_zero_annual = build_query({**base, "annual_rainfall": 0.0})
        self.assertIsNone(
            q_zero_annual.climate_and_water.seasonal_rainfall_amount,
            "annual_rainfall=0.0 must not populate seasonal_rainfall_amount."
        )
        self.assertEqual(q_zero_annual.climate_and_water.rainfall_period_type, "Annual_Estimated")
        self.assertIn("Annual Rainfall Context: 0.0 mm", q_zero_annual.climate_and_water.source_reference)

        # 6.8 Conflicting seasonal aliases (different values)
        with self.assertRaises(AdapterValidationError) as ctx:
            build_query({**base, "seasonal_rainfall_amount": 300.0, "seasonal_rainfall_mm": 400.0})
        self.assertIn("Conflicting values", str(ctx.exception))

        # 6.9 Matching seasonal aliases (identical values accepted)
        q_matching_s = build_query({**base, "seasonal_rainfall_amount": 300.0, "seasonal_rainfall_mm": 300.0})
        self.assertEqual(q_matching_s.climate_and_water.seasonal_rainfall_amount, 300.0)

        # 6.10 Conflicting annual aliases
        with self.assertRaises(AdapterValidationError) as ctx:
            build_query({**base, "annual_rainfall": 1000.0, "annual_rainfall_mm": 1200.0})
        self.assertIn("Conflicting values", str(ctx.exception))

        # 6.11 Contradictory period type: Annual_Estimated + explicit seasonal rainfall
        with self.assertRaises(AdapterValidationError) as ctx:
            build_query({
                **base,
                "rainfall_period_type": "Annual_Estimated",
                "seasonal_rainfall_amount": 350.0,
            })
        self.assertIn("Annual rainfall cannot be converted to seasonal rainfall", str(ctx.exception))

        # 6.12 Conflicting generic rainfall vs explicit seasonal rainfall
        with self.assertRaises(AdapterValidationError) as ctx:
            build_query({
                **base,
                "rainfall": 500.0,
                "seasonal_rainfall_amount": 300.0,
            })
        self.assertIn("Conflicting rainfall values", str(ctx.exception))

    # -------------------------------------------------------------------------
    # Test 7: Missing seasonal rainfall remains unknown (non-vacuous recommendation check)
    # -------------------------------------------------------------------------
    def test_07_missing_seasonal_rainfall_remains_unknown(self):
        payload_no_rain = {
            "state": "Punjab",
            "sowing_month": 10,
            "irrigation_access": "Tubewell_Borewell",
            "irrigation_water_quantity_mm": 400.0,
            "temperature": 25.0,
            "humidity": 60.0,
            "soil_texture": "Sandy Loam",
            "soil_ph": 7.0,
            "has_soil_test": True,
            "nitrogen": 120.0,
            "phosphorus": 40.0,
            "potassium": 150.0,
        }
        query = build_query(payload_no_rain)
        self.assertIsNone(
            query.climate_and_water.seasonal_rainfall_amount,
            "Missing seasonal rainfall must remain None (unknown)."
        )

        res = self._run_cli(json.dumps(payload_no_rain))
        self.assertEqual(res.returncode, 0)
        data = json.loads(res.stdout)
        self.assertEqual(data["status"], "SUCCESS")

        # NON-VACUOUS CHECK: Verify that recommendations exist!
        recs = data.get("recommendations", [])
        self.assertGreater(
            len(recs), 0,
            "Test requires at least one actual recommendation so recommendation-level check cannot pass vacuously."
        )

        # For every real recommendation, effective rainfall must be None/null
        for rec in recs:
            self.assertIsNone(
                rec["water_assessment"]["effective_rainfall_mm"],
                f"Effective rainfall must be None/null when seasonal rainfall is omitted for {rec.get('canonical_name')}."
            )

    # -------------------------------------------------------------------------
    # Test 8: Strict boolean validation ("false", "true", 1, 0 rejected)
    # -------------------------------------------------------------------------
    def test_08_strict_boolean_validation(self):
        base = {"state": "Punjab", "sowing_month": 10}

        # 8.1 has_soil_test: strings rejected
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "has_soil_test": "false"})
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "has_soil_test": "true"})

        # 8.2 has_soil_test: numbers rejected
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "has_soil_test": 1})
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "has_soil_test": 0})

        # 8.3 has_stcr_calibration: strings rejected
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "has_stcr_calibration": "true"})
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "has_stcr_calibration": "false"})

        # 8.4 has_stcr_calibration: numbers rejected
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "has_stcr_calibration": 1})
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "has_stcr_calibration": 0})

        # 8.5 Valid booleans accepted
        q_true = build_query({**base, "has_soil_test": True, "has_stcr_calibration": False})
        self.assertTrue(q_true.edaphic.has_soil_test)
        self.assertFalse(q_true.has_stcr_calibration)

    # -------------------------------------------------------------------------
    # Test 9: Soil-test declaration remains user-declared (baseline RDF arithmetic)
    # -------------------------------------------------------------------------
    def test_09_soil_test_declaration_remains_user_declared(self):
        payload_soil_test = {
            "state": "Punjab",
            "sowing_month": 10,
            "irrigation_access": "Tubewell_Borewell",
            "irrigation_water_quantity_mm": 350.0,
            "seasonal_rainfall_amount": 100.0,
            "temperature": 24.0,
            "humidity": 65.0,
            "soil_texture": "Sandy Loam",
            "soil_ph": 7.2,
            "has_soil_test": True,  # User declaration boolean
            "soil_test_source": "Certified_Soil_Testing_Lab",  # Unverified user string
            "nutrient_basis": "SHC_Available_kg_ha",
            "nitrogen": 120.0,
            "phosphorus": 45.0,
            "potassium": 150.0,
        }
        res = self._run_cli(json.dumps(payload_soil_test))
        self.assertEqual(res.returncode, 0)
        data = json.loads(res.stdout)

        # Confidence tier must NOT be promoted to INDEPENDENTLY_VERIFIED
        self.assertNotEqual(
            data["query_summary"]["evidence_confidence_tier"],
            "INDEPENDENTLY_VERIFIED",
            "A form checkbox and lab name alone must never grant INDEPENDENTLY_VERIFIED status."
        )

        recs = data.get("recommendations", [])
        self.assertGreater(len(recs), 0)
        for rec in recs:
            fert = rec.get("fertilizer_prescription")
            if fert:
                self.assertNotEqual(
                    fert["status"],
                    "VERIFIED_STCR_GENERATED",
                    "Fertilizer prescription must not claim VERIFIED_STCR_GENERATED without an approved registry record."
                )
                self.assertEqual(fert["status"], "BASELINE_RDF_ARITHMETIC")

    # -------------------------------------------------------------------------
    # Test 10: Numeric safety (NaN, infinity, negative rainfall, monthly rainfall)
    # -------------------------------------------------------------------------
    def test_10_numeric_safety_nan_infinity_bounds(self):
        base = {"state": "Punjab", "sowing_month": 10}

        # 10.1 NaN for seasonal_rainfall_amount
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "seasonal_rainfall_amount": float("nan")})

        # 10.2 Infinity for temperature
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "temperature": float("inf")})

        with self.assertRaises(AdapterValidationError):
            build_query({**base, "temperature": float("-inf")})

        # 10.3 Negative rainfall
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "seasonal_rainfall_amount": -50.0})

        with self.assertRaises(AdapterValidationError):
            build_query({**base, "annual_rainfall": -100.0})

        # 10.4 Non-finite element in monthly_rainfall
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "monthly_rainfall": [50.0, float("nan"), 40.0]})

        # 10.5 Negative element in monthly_rainfall
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "monthly_rainfall": [50.0, -10.0, 40.0]})

        # 10.6 Malformed monthly_rainfall (not a list)
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "monthly_rainfall": "50, 40, 30"})

    # -------------------------------------------------------------------------
    # Test 11: Verification records validation (rejects malformed structures)
    # -------------------------------------------------------------------------
    def test_11_verification_records_validation(self):
        base = {"state": "Punjab", "sowing_month": 10}

        # 11.1 Not a list
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "verification_records": "invalid_string"})

        with self.assertRaises(AdapterValidationError):
            build_query({**base, "verification_records": {"authority": "ICAR"}})

        # 11.2 List with non-dict element
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "verification_records": [123]})

        # 11.3 Dict missing mandatory fields
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "verification_records": [{"verification_authority_id": "AUTH-1"}]})

        # 11.4 Valid structured verification record accepted
        valid_rec = {
            "verification_authority_id": "AUTH-ICAR-SHC-REGISTRY",
            "authority_name": "ICAR / DAC&FW National Soil Health Card Digital Portal",
            "source_identifier": "SRC-SHC-2026-PB",
            "observation_or_sample_id": "SHC-SAMPLE-9901",
            "verification_status": "OFFICIALLY_VERIFIED",
            "applicable_date_start": "2026-01-01",
            "applicable_date_end": "2026-12-31",
            "digital_signature_or_token": "VALID-TOKEN-9901",
        }
        q_valid = build_query({**base, "verification_records": [valid_rec]})
        self.assertEqual(len(q_valid.verification_records), 1)
        self.assertEqual(q_valid.verification_records[0].verification_authority_id, "AUTH-ICAR-SHC-REGISTRY")

    # -------------------------------------------------------------------------
    # Test 12: Engine exception returns nonzero exit status
    # -------------------------------------------------------------------------
    def test_12_engine_exception_returns_nonzero_exit_status(self):
        test_script = f"""
import sys
import unittest.mock as mock
from pathlib import Path

ml_pipeline_dir = Path('{str(ML_PIPELINE_DIR)}')
if str(ml_pipeline_dir) not in sys.path:
    sys.path.insert(0, str(ml_pipeline_dir))

from recommendation_engine.adapter_cli import main
from recommendation_engine.engine import CropRecommendationEngine

with mock.patch.object(CropRecommendationEngine, 'recommend', side_effect=RuntimeError('Simulated catastrophic engine failure')):
    sys.exit(main())
"""
        valid_payload = json.dumps({"state": "Punjab", "sowing_month": 10})
        env = dict(os.environ)
        env["PYTHONPATH"] = f"{PROJECT_ROOT}:{ML_PIPELINE_DIR}:{PROJECT_ROOT}/FieldWise_main"
        proc = subprocess.run(
            [self.python_exe, "-c", test_script],
            input=valid_payload,
            capture_output=True,
            text=True,
            env=env,
        )
        self.assertEqual(proc.returncode, 1, "Engine exception must produce nonzero exit code (1).")
        self.assertEqual(proc.stdout.strip(), "", "Stdout must be empty on engine exception.")
        self.assertIn("ENGINE EXECUTION ERROR", proc.stderr)
        self.assertIn("Simulated catastrophic engine failure", proc.stderr)

    # -------------------------------------------------------------------------
    # Test 13: Stdout contains valid JSON only across varied executions
    # -------------------------------------------------------------------------
    def test_13_stdout_contains_valid_json_only(self):
        test_payloads = [
            # Successful query
            {
                "state": "Punjab",
                "sowing_month": 10,
                "irrigation_access": "Tubewell_Borewell",
                "irrigation_water_quantity_mm": 300.0,
                "seasonal_rainfall_amount": 50.0,
                "temperature": 24.0,
                "humidity": 65.0,
                "soil_texture": "Sandy Loam",
                "soil_ph": 7.2,
                "has_soil_test": True,
                "nitrogen": 120.0,
                "phosphorus": 45.0,
                "potassium": 150.0,
            },
            # Inadequate data query (missing water for rainfed)
            {
                "state": "Punjab",
                "sowing_month": 10,
                "irrigation_access": "None_Rainfed",
                "seasonal_rainfall_amount": None,
                "soil_texture": "Sandy Loam",
                "soil_ph": 7.2,
            },
            # Hostile soil pH 9.2 query
            {
                "state": "Punjab",
                "sowing_month": 10,
                "irrigation_access": "Tubewell_Borewell",
                "irrigation_water_quantity_mm": 350.0,
                "seasonal_rainfall_amount": 100.0,
                "temperature": 24.0,
                "humidity": 65.0,
                "soil_texture": "Sandy Loam",
                "soil_ph": 9.2,
                "has_soil_test": True,
                "nitrogen": 120.0,
                "phosphorus": 45.0,
                "potassium": 150.0,
            },
        ]

        for idx, payload in enumerate(test_payloads):
            res = self._run_cli(json.dumps(payload))
            self.assertEqual(res.returncode, 0, f"Payload {idx} failed with exit code {res.returncode}. Stderr: {res.stderr}")
            try:
                parsed = json.loads(res.stdout)
                self.assertIsInstance(parsed, dict)
                self.assertIn("status", parsed)
            except Exception as e:
                self.fail(f"Payload {idx} output is not valid JSON: {e}. Output was:\n{res.stdout}")

    # -------------------------------------------------------------------------
    # Test 14: Existing frozen engine files remain unchanged against manifest
    # -------------------------------------------------------------------------
    def test_14_existing_frozen_engine_files_remain_unchanged(self):
        """
        Verifies that all 14 frozen recommendation engine core files match their exact
        cryptographic SHA-256 hashes from the Phase 3C.5.2.2.3 frozen manifest,
        and confirms no unauthorized files exist.
        """
        expected_frozen_files = {
            "__init__.py",
            "catalogue.py",
            "dci_confidence.py",
            "engine.py",
            "explanations.py",
            "input_validator.py",
            "planting_window.py",
            "provenance_registry.py",
            "ranking.py",
            "schemas.py",
            "stcr_registry.py",
            "tier1_eligibility.py",
            "tier2_scoring.py",
            "water_assessment.py",
        }
        self.assertEqual(len(expected_frozen_files), 14, "Must require exactly 14 expected frozen files.")

        manifest_path = REPORTS_DIR / "phase_3c_5_2_2_3_checksums.txt"
        self.assertTrue(manifest_path.exists(), "Manifest file must exist.")

        manifest_hashes = {}
        for line in manifest_path.read_text().splitlines():
            line = line.strip()
            if not line or " " not in line:
                continue
            parts = line.split(None, 1)
            sha = parts[0]
            fpath = parts[1].strip()
            # Only track recommendation_engine Python source files
            if "recommendation_engine/" in fpath and fpath.endswith(".py") and "/tests/" not in fpath:
                fname = Path(fpath).name
                manifest_hashes[fname] = sha

        self.assertEqual(
            set(manifest_hashes.keys()),
            expected_frozen_files,
            f"Manifest file set must match exactly 14 frozen engine files. Missing/extra: {set(manifest_hashes.keys()) ^ expected_frozen_files}"
        )
        self.assertEqual(len(manifest_hashes), 14, "Must verify exactly 14 core engine python files.")

        for fname, expected_hash in manifest_hashes.items():
            fpath = ENGINE_DIR / fname
            self.assertTrue(fpath.exists(), f"Engine file {fname} must exist.")
            content = fpath.read_bytes()
            computed_hash = hashlib.sha256(content).hexdigest()
            self.assertEqual(
                computed_hash,
                expected_hash,
                f"Cryptographic hash mismatch for frozen engine file {fname}!\nExpected: {expected_hash}\nComputed: {computed_hash}"
            )

        # Confirm no extraneous or unauthorized files were added to recommendation_engine/
        actual_engine_py = {p.name for p in ENGINE_DIR.glob("*.py")}
        self.assertEqual(
            actual_engine_py,
            expected_frozen_files | {"adapter_cli.py"},
            "No unauthorized Python files may exist in recommendation_engine/"
        )

    # -------------------------------------------------------------------------
    # Test 15: Strict whole-day validation (actual JSON integers > 0 only)
    # -------------------------------------------------------------------------
    def test_15_strict_whole_day_validation(self):
        base = {"state": "Punjab", "sowing_month": 10}

        # 15.1 Valid integers accepted
        q_valid = build_query({
            **base,
            "irrigation_period_days": 120,
            "rainfall_period_days": 90,
        })
        self.assertEqual(q_valid.climate_and_water.irrigation_period_days, 120)
        self.assertEqual(q_valid.climate_and_water.rainfall_period_days, 90)

        # 15.2 irrigation_period_days: rejects fractional float 10.9
        with self.assertRaises(AdapterValidationError) as ctx:
            build_query({**base, "irrigation_period_days": 10.9})
        self.assertIn("irrigation_period_days", str(ctx.exception))

        # 15.3 irrigation_period_days: rejects integer float 10.0 (no float coercion!)
        with self.assertRaises(AdapterValidationError) as ctx:
            build_query({**base, "irrigation_period_days": 10.0})
        self.assertIn("irrigation_period_days", str(ctx.exception))

        # 15.4 irrigation_period_days: rejects numeric string "10"
        with self.assertRaises(AdapterValidationError) as ctx:
            build_query({**base, "irrigation_period_days": "10"})
        self.assertIn("irrigation_period_days", str(ctx.exception))

        # 15.5 irrigation_period_days: rejects boolean True and False
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "irrigation_period_days": True})
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "irrigation_period_days": False})

        # 15.6 irrigation_period_days: rejects zero and negative values
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "irrigation_period_days": 0})
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "irrigation_period_days": -15})

        # 15.7 rainfall_period_days: rejects fractional float 15.5
        with self.assertRaises(AdapterValidationError) as ctx:
            build_query({**base, "rainfall_period_days": 15.5})
        self.assertIn("rainfall_period_days", str(ctx.exception))

        # 15.8 rainfall_period_days: rejects integer float 15.0
        with self.assertRaises(AdapterValidationError) as ctx:
            build_query({**base, "rainfall_period_days": 15.0})
        self.assertIn("rainfall_period_days", str(ctx.exception))

        # 15.9 rainfall_period_days: rejects string "30"
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "rainfall_period_days": "30"})

        # 15.10 rainfall_period_days: rejects boolean True and False
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "rainfall_period_days": True})
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "rainfall_period_days": False})

        # 15.11 rainfall_period_days: rejects zero and negative values
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "rainfall_period_days": 0})
        with self.assertRaises(AdapterValidationError):
            build_query({**base, "rainfall_period_days": -30})

    # -------------------------------------------------------------------------
    # Test 16: Strict JSON serialization fails safely on NaN or infinity
    # -------------------------------------------------------------------------
    def test_16_strict_json_serialization_fails_on_nan_or_infinity(self):
        """
        Verifies that json.dumps(..., allow_nan=False) raises a ValueError when
        non-finite numbers (NaN, infinity) are present, which main() catches safely:
          - Exit code 1
          - Zero stdout bytes
          - Diagnostic on stderr
        """
        test_script = f"""
import sys
import unittest.mock as mock
from pathlib import Path

ml_pipeline_dir = Path('{str(ML_PIPELINE_DIR)}')
project_root = Path('{str(PROJECT_ROOT)}')
for p in [str(project_root), str(ml_pipeline_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from recommendation_engine.adapter_cli import main
from recommendation_engine import adapter_cli

# Simulate non-finite float value produced during result serialization
with mock.patch.object(adapter_cli, 'serialize_result', return_value={{"non_finite_metric": float('nan')}}):
    sys.exit(main())
"""
        valid_payload = json.dumps({"state": "Punjab", "sowing_month": 10})
        env = dict(os.environ)
        env["PYTHONPATH"] = f"{PROJECT_ROOT}:{ML_PIPELINE_DIR}:{PROJECT_ROOT}/FieldWise_main"
        proc = subprocess.run(
            [self.python_exe, "-c", test_script],
            input=valid_payload,
            capture_output=True,
            text=True,
            env=env,
        )
        self.assertEqual(proc.returncode, 1, f"Non-finite output must exit with code 1. Stderr: {proc.stderr}")
        self.assertEqual(len(proc.stdout), 0, "Stdout must contain exactly zero bytes when non-finite float is serialized.")
        self.assertEqual(proc.stdout, "", "Stdout string must be empty.")
        self.assertIn("SERIALIZATION ERROR", proc.stderr, "Stderr must contain SERIALIZATION ERROR diagnostic.")
        self.assertIn("Out of range float values", proc.stderr, "Stderr must report non-finite float rejection.")

    # -------------------------------------------------------------------------
    # Test 17: Seasonal rainfall provenance closure (Phase 3C.6.2.1.3)
    # -------------------------------------------------------------------------
    def test_17_seasonal_rainfall_provenance_closure(self):
        """
        Verifies that seasonal aliases establish the rainfall period amount, not the
        evidence source or measurement status:
          1. Seasonal alias without classification does not become Crop_Season_Measured.
          2. Seasonal alias with explicit Crop_Season_Measured preserves that classification.
          3. Seasonal alias with an explicitly estimated classification does not become measured.
          4. Annual plus seasonal values preserve annual context without changing seasonal provenance.
          5. Generic rainfall without classification remains unclassified and out of seasonal.
          6. Annual rainfall never converts into seasonal rainfall.
        """
        base = {"state": "Punjab", "sowing_month": 10}

        # 17.1 Seasonal alias without classification does not become Crop_Season_Measured
        q1 = build_query({**base, "seasonal_rainfall_amount": 300.0})
        self.assertEqual(q1.climate_and_water.seasonal_rainfall_amount, 300.0)
        self.assertIsNone(q1.climate_and_water.rainfall_period_type)
        self.assertNotEqual(q1.climate_and_water.rainfall_period_type, "Crop_Season_Measured")

        q1_mm = build_query({**base, "seasonal_rainfall_mm": 250.0})
        self.assertEqual(q1_mm.climate_and_water.seasonal_rainfall_amount, 250.0)
        self.assertIsNone(q1_mm.climate_and_water.rainfall_period_type)
        self.assertNotEqual(q1_mm.climate_and_water.rainfall_period_type, "Crop_Season_Measured")

        # 17.2 Seasonal alias with explicit Crop_Season_Measured preserves that classification
        q2 = build_query({
            **base,
            "seasonal_rainfall_amount": 300.0,
            "rainfall_period_type": "Crop_Season_Measured",
        })
        self.assertEqual(q2.climate_and_water.seasonal_rainfall_amount, 300.0)
        self.assertEqual(q2.climate_and_water.rainfall_period_type, "Crop_Season_Measured")

        # 17.3 Seasonal alias with an explicitly estimated classification does not become measured
        q3 = build_query({
            **base,
            "seasonal_rainfall_amount": 300.0,
            "rainfall_period_type": "Crop_Season_Estimated",
        })
        self.assertEqual(q3.climate_and_water.seasonal_rainfall_amount, 300.0)
        self.assertEqual(q3.climate_and_water.rainfall_period_type, "Crop_Season_Estimated")
        self.assertNotEqual(q3.climate_and_water.rainfall_period_type, "Crop_Season_Measured")

        # 17.4 Annual plus seasonal values preserve annual context without changing seasonal provenance
        # Case A: unclassified seasonal
        q4_unclassified = build_query({
            **base,
            "annual_rainfall": 1200.0,
            "seasonal_rainfall_amount": 350.0,
        })
        self.assertEqual(q4_unclassified.climate_and_water.seasonal_rainfall_amount, 350.0)
        self.assertIsNone(q4_unclassified.climate_and_water.rainfall_period_type)
        self.assertNotEqual(q4_unclassified.climate_and_water.rainfall_period_type, "Crop_Season_Measured")
        self.assertIn("Annual Rainfall Context: 1200.0 mm", q4_unclassified.climate_and_water.source_reference)

        # Case B: explicitly estimated seasonal
        q4_estimated = build_query({
            **base,
            "annual_rainfall": 1200.0,
            "seasonal_rainfall_amount": 350.0,
            "rainfall_period_type": "Crop_Season_Estimated",
        })
        self.assertEqual(q4_estimated.climate_and_water.seasonal_rainfall_amount, 350.0)
        self.assertEqual(q4_estimated.climate_and_water.rainfall_period_type, "Crop_Season_Estimated")
        self.assertNotEqual(q4_estimated.climate_and_water.rainfall_period_type, "Crop_Season_Measured")
        self.assertIn("Annual Rainfall Context: 1200.0 mm", q4_estimated.climate_and_water.source_reference)

        # Case C: explicitly measured seasonal
        q4_measured = build_query({
            **base,
            "annual_rainfall": 1200.0,
            "seasonal_rainfall_amount": 350.0,
            "rainfall_period_type": "Crop_Season_Measured",
        })
        self.assertEqual(q4_measured.climate_and_water.seasonal_rainfall_amount, 350.0)
        self.assertEqual(q4_measured.climate_and_water.rainfall_period_type, "Crop_Season_Measured")
        self.assertIn("Annual Rainfall Context: 1200.0 mm", q4_measured.climate_and_water.source_reference)

        # 17.5 Generic rainfall with no classification remains unclassified and out of seasonal
        q5 = build_query({**base, "rainfall": 400.0})
        self.assertIsNone(q5.climate_and_water.seasonal_rainfall_amount)
        self.assertIsNone(q5.climate_and_water.rainfall_period_type)
        self.assertIn("Unclassified Rainfall Context: 400.0 mm", q5.climate_and_water.source_reference)

        # 17.6 Annual rainfall never converts into seasonal rainfall
        q6 = build_query({**base, "annual_rainfall": 950.0})
        self.assertIsNone(q6.climate_and_water.seasonal_rainfall_amount)
        self.assertEqual(q6.climate_and_water.rainfall_period_type, "Annual_Estimated")
        self.assertIn("Annual Rainfall Context: 950.0 mm", q6.climate_and_water.source_reference)


if __name__ == "__main__":
    unittest.main()
