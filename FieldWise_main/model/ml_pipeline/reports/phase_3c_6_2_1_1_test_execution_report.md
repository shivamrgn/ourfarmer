# FieldWise — Phase 3C.6.2.1.1: Adapter Input-Semantics Closure Test Report

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_2_1_1_test_execution_report.md`  
**Phase**: 3C.6.2.1.1 Python Adapter Input-Semantics Closure  
**Execution Timestamp**: November 2026  
**Status**: 100% PASS (76/76 Tests Passing: 14 Dedicated Adapter Tests + 62 Frozen Engine Regression Tests)  

---

## 1. Executive Summary

Phase 3C.6.2.1.1 resolves all identified input-validation and semantic issues in `adapter_cli.py` and strengthens `test_adapter_cli.py` with rigorous negative and boundary tests:
1. **Rainfall Semantics**:
   - Removed implicit mapping from generic `rainfall` to `seasonal_rainfall_amount`.
   - Generic `rainfall` without an explicit, established period classification remains unclassified and never enters seasonal calculations.
   - Annual rainfall (`annual_rainfall`, `annual_rainfall_amount`, or `rainfall_period_type: "Annual_Estimated"`) never enters seasonal or effective rainfall calculations.
   - Preserved annual rainfall context (`Annual_Estimated`) without ambiguous text parsing.
   - Handled zero correctly (`annual_rainfall: 0.0`) without truthiness-based extraction bugs.
2. **Strict Boolean Validation**:
   - `has_soil_test` and `has_stcr_calibration` strictly require actual JSON booleans (`type is bool`).
   - Strings such as `"false"` and `"true"`, numeric values (`1`, `0`), and other types are strictly rejected.
   - Zero Python `bool()` coercion on user-provided evidence flags.
3. **Strict Sowing-Month Validation**:
   - Accepts only an actual JSON integer between 1 and 12 (`type is int`).
   - Strictly rejects booleans (`True`), floats (`10.0`, `10.9`), numeric strings (`"10"`), and out-of-range values (`0`, `13`).
4. **Irrigation Semantics**:
   - Explicit `"None_Rainfed"` and `"rainfed"` map to `"None_Rainfed"`.
   - Missing, blank, and `"UNKNOWN"` remain unknown (`None` or `"UNKNOWN"`).
   - Generic `"none"` is strictly NOT treated as an explicit rainfed declaration (remains `None`).
   - Explicit irrigation categories (`"Tubewell_Borewell"`, `"Canal_Gravity"`, `"Drip_Micro"`, etc.) are preserved.
5. **Numeric Safety**:
   - Rejects `NaN`, `+inf`, `-inf` (`math.isfinite`) across all numeric parameters.
   - Rejects negative rainfall, negative humidity, negative nutrients, and non-finite/negative monthly rainfall list elements.
6. **Verification Records Structure**:
   - Preserves trusted-verification boundary.
   - Rejects malformed verification-record payload structures (non-list, non-dict, missing required fields) with `AdapterValidationError`.
7. **Non-Vacuous Verification**:
   - Test 7 verifies real recommendation outputs (`len(recommendations) > 0`) before asserting `effective_rainfall_mm is None`.

---

## 2. Dedicated Adapter CLI Test Suite Results (14 Tests)

Test File: `FieldWise_main/model/ml_pipeline/recommendation_engine/tests/test_adapter_cli.py`  
Command: `python3 -m unittest FieldWise_main/model/ml_pipeline/recommendation_engine/tests/test_adapter_cli.py -v`

| Test Method | Category / Objective | Result | Execution Time | Description & Proof |
| :--- | :--- | :---: | :---: | :--- |
| `test_01_valid_json_request` | Valid Request Processing | **PASS** | ~0.08s | Full JSON request via stdin returns exit code 0, emits valid `RecommendationResult` on stdout with `status="SUCCESS"`, 5 ranked recommendations, and empty stderr. |
| `test_02_malformed_json` | Input Validation | **PASS** | ~0.08s | Truncated/syntax-invalid JSON input returns exit code 1, emits zero stdout bytes, and outputs informative JSON error on stderr. |
| `test_03_strict_sowing_month_validation` | Strict Integer Sowing Month | **PASS** | ~0.08s | Rejects missing sowing month, floats (`10.9`, `10.0`), string (`"10"`), boolean (`True`), and out-of-bounds (`0`, `13`). Accepts only `type is int` (1-12). |
| `test_04_missing_irrigation_does_not_become_rainfed` | Irrigation Default Safety | **PASS** | ~0.08s | When `irrigation_access` is omitted, the adapter explicitly passes `irrigation_access=None`, overriding the frozen constructor default `"None_Rainfed"`. |
| `test_05_irrigation_semantics_none_vs_rainfed` | Irrigation Semantics | **PASS** | ~0.01s | Generic `"none"` does NOT map to rainfed (remains `None`). Explicit `"rainfed"` and `"None_Rainfed"` map to `"None_Rainfed"`. Categories preserved. |
| `test_06_rainfall_semantics` | Rainfall Period Separation | **PASS** | ~0.01s | Generic `rainfall` without period classification remains unclassified (`seasonal_rainfall_amount is None`). Annual rainfall (including `0.0`) never enters seasonal calculations. Explicit seasonal rainfall populates `seasonal_rainfall_amount`. |
| `test_07_missing_seasonal_rainfall_remains_unknown` | Non-Vacuous Water Evaluation | **PASS** | ~0.08s | Missing seasonal rainfall preserves `None`. Asserts `len(recommendations) > 0` (5 real crops) and verifies every recommendation has `effective_rainfall_mm = None`. |
| `test_08_strict_boolean_validation` | Strict Boolean Safety | **PASS** | ~0.01s | `has_soil_test` and `has_stcr_calibration` strictly reject `"true"`, `"false"`, `1`, `0`. Accepts only actual JSON booleans `True` and `False`. |
| `test_09_soil_test_declaration_remains_user_declared` | Provenance & STCR Safety | **PASS** | ~0.08s | Form toggle `has_soil_test: true` and lab string remain `USER_DECLARED`. Prescriptions strictly return `BASELINE_RDF_ARITHMETIC`, never `VERIFIED_STCR_GENERATED`. |
| `test_10_numeric_safety_nan_infinity_bounds` | Finite Number & Unit Safety | **PASS** | ~0.01s | Rejects `NaN`, `+inf`, `-inf`, negative rainfall, negative humidity, and non-finite / negative elements in `monthly_rainfall`. |
| `test_11_verification_records_validation` | Verification Record Parsing | **PASS** | ~0.01s | Rejects malformed verification-record structures (non-list, non-dict, missing mandatory authority fields) with `AdapterValidationError`. Accepts valid records. |
| `test_12_engine_exception_returns_nonzero_exit_status` | Fault Isolation | **PASS** | ~0.08s | Simulated catastrophic engine runtime error produces exit code 1, suppresses corrupt stdout, and logs traceback to stderr only. |
| `test_13_stdout_contains_valid_json_only` | Stream Purity | **PASS** | ~0.10s | Evaluates varied payloads (success, insufficient data, severe sodicity). In every case, stdout is 100% parseable by `json.loads` without extraneous text. |
| `test_14_existing_frozen_engine_files_remain_unchanged` | Immutability Verification | **PASS** | ~0.02s | Cryptographic verification that all 14 core engine files match their exact SHA-256 hashes from the Phase 3C.5.2.2.3 frozen manifest. |

**Adapter Suite Summary**: **14/14 Passed (100.0%)** in 0.882s.

---

## 3. Frozen Recommendation Engine Regression Suite (62 Tests)

Test Runner: `FieldWise_main/model/ml_pipeline/recommendation_engine/tests/run_all_tests.py`

| Suite Name | Scope | Tests Run | Passed | Failures | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `TestPhase3C5AcceptanceMatrix` | S1–S5 Scenarios & Decoupled Water/DCI Accounting | 18 | 18 | 0 | **PASS** |
| `TestRecommendationEngineEdgeCases` | Extremes, Missing Data, Boundary Checks, Determinism | 9 | 9 | 0 | **PASS** |
| `TestPhase3C51Regressions` | DCI Provenance & Physical Accounting Findings | 7 | 7 | 0 | **PASS** |
| `TestPhase3C52Regressions` | Lethal pH Removal, Provenance Authority, STCR Registry | 4 | 4 | 0 | **PASS** |
| `TestPhase3C521Regressions` | Soft Penalty Consistency & Trusted Authority Gating | 5 | 5 | 0 | **PASS** |
| `TestPhase3C522Regressions` | Provenance Authentication & Unsubstantiated Claim Purge | 9 | 9 | 0 | **PASS** |
| `TestPhase3C5221Regressions` | Specification Consistency & Audit Manifest Integrity | 5 | 5 | 0 | **PASS** |
| `TestPhase3C5222Regressions` | pH Non-rejection, Liebig Penalties, Advisory Phrasing | 5 | 5 | 0 | **PASS** |
| **Combined Frozen Engine Total** | **End-to-End Agronomic Engine Core** | **62** | **62** | **0** | **100.0% PASS** |

**Total Suite Verification Across Workspace**: **76/76 tests passing (100.0%)**.

---

## 4. CLI Execution from Project Root and External Working Directory

1. **Project Root Execution**:
   ```bash
   echo '{"state": "Punjab", "sowing_month": 10, ...}' | python3 FieldWise_main/model/ml_pipeline/recommendation_engine/adapter_cli.py
   # Exit code: 0 | Stdout: Valid JSON | Stderr: 0 bytes
   ```
2. **External Directory (`/tmp`) Execution**:
   ```bash
   cd /tmp && echo '{"state": "Punjab", "sowing_month": 10, ...}' | python3 /path/to/adapter_cli.py
   # Exit code: 0 | Stdout: Valid JSON | Stderr: 0 bytes
   ```
3. **Error Handling from External Directory (`/tmp`)**:
   ```bash
   cd /tmp && echo '{"state": "Punjab", "sowing_month": 10.9}' | python3 /path/to/adapter_cli.py
   # Exit code: 1 | Stdout: 0 bytes | Stderr: "VALIDATION ERROR: Invalid 'sowing_month': 10.9. Must be an actual JSON integer between 1 and 12, got float."
   ```
