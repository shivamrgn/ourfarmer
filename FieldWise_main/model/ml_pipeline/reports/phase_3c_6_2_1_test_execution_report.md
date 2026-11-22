# FieldWise — Phase 3C.6.2.1: Adapter CLI Test Execution Report

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_2_1_test_execution_report.md`  
**Phase**: 3C.6.2.1 Python Adapter CLI Implementation  
**Execution Timestamp**: November 2026  
**Status**: 100% PASS (73/73 Tests Passing: 11 New Adapter Tests + 62 Frozen Engine Regression Tests)  

---

## 1. Executive Summary

Phase 3C.6.2.1 implements the standalone Python Command-Line Interface (`adapter_cli.py`) connecting external caller processes (specifically the planned Node.js backend bridge in Phase 3C.6.2.2) to the frozen Phase 3C.5 Recommendation Engine.

The implementation strictly satisfies all safety and agronomic boundary constraints:
- **Zero modification to existing frozen engine files**: Verified programmatically via cryptographic SHA-256 validation of all 14 core engine files.
- **Irrigation default safety**: Omitted irrigation explicitly overrides the frozen constructor default `"None_Rainfed"`, passing `irrigation_access=None`.
- **Rainfall period fidelity**: Annual rainfall (`annual_rainfall`) is strictly prohibited from populating `seasonal_rainfall_amount` and is preserved as contextual information (`Annual_Estimated`). Missing seasonal rainfall remains `None` (unknown).
- **Soil-test provenance integrity**: Form declarations remain `USER_DECLARED`. In the absence of approved registry calibrations, fertilizer status strictly returns `BASELINE_RDF_ARITHMETIC`, never claiming `VERIFIED_STCR_GENERATED`.
- **Stream separation**: All diagnostic errors and exceptions are routed exclusively to `stderr`. Valid JSON output is emitted exclusively to `stdout`.

---

## 2. Dedicated Adapter CLI Test Suite Results

Test File: `FieldWise_main/model/ml_pipeline/recommendation_engine/tests/test_adapter_cli.py`  
Command: `python3 -m unittest FieldWise_main/model/ml_pipeline/recommendation_engine/tests/test_adapter_cli.py -v`

| Test Method | Category / Objective | Result | Execution Time | Description & Proof |
| :--- | :--- | :---: | :---: | :--- |
| `test_01_valid_json_request` | Valid Request Processing | **PASS** | ~0.09s | Full JSON request via stdin returns exit code 0, emits valid `RecommendationResult` on stdout with `status="SUCCESS"`, 5 ranked recommendations, and empty stderr. |
| `test_02_malformed_json` | Input Validation | **PASS** | ~0.08s | Truncated/syntax-invalid JSON input returns exit code 1, emits zero stdout bytes, and outputs informative JSON error on stderr. |
| `test_03_missing_sowing_month` | Temporal Safety Gate | **PASS** | ~0.08s | Omission of `sowing_month` or out-of-range integer (13) returns exit code 1, emits zero stdout bytes, and outputs descriptive validation message on stderr. |
| `test_04_missing_irrigation_does_not_become_rainfed` | Irrigation Default Safety | **PASS** | ~0.09s | When `irrigation_access` is omitted, the adapter explicitly passes `irrigation_access=None`, overriding the frozen constructor default `"None_Rainfed"`. Water regime evaluated is not rainfed. |
| `test_05_explicit_rainfed_selection_is_preserved` | Rainfed Declaration | **PASS** | ~0.09s | Explicit farmer selection `"None_Rainfed"` is preserved as `irrigation_access="None_Rainfed"` and reflected in query summary and water balance. |
| `test_06_annual_rainfall_is_never_treated_as_seasonal_rainfall` | Rainfall Separation Safety | **PASS** | ~0.08s | Supplying `annual_rainfall: 1200.0` or `rainfall_period_type: "Annual_Estimated"` ensures `seasonal_rainfall_amount` remains `None`. Contextual annual depth is preserved in `source_reference`. |
| `test_07_missing_seasonal_rainfall_remains_unknown` | Unmeasured Moisture | **PASS** | ~0.09s | Omission of seasonal rainfall preserves `seasonal_rainfall_amount=None` (unknown). Effective rainfall across all recommendations is evaluated as `null`. |
| `test_08_soil_test_declaration_remains_user_declared` | Provenance & STCR Safety | **PASS** | ~0.09s | Form toggle `has_soil_test: true` and lab string remain `USER_DECLARED`. With empty registry, fertilizer prescriptions strictly return `BASELINE_RDF_ARITHMETIC`, never claiming `VERIFIED_STCR_GENERATED`. |
| `test_09_engine_exception_returns_nonzero_exit_status` | Fault Isolation | **PASS** | ~0.08s | Simulated catastrophic engine runtime error produces exit code 1, suppresses corrupt stdout, and logs traceback to stderr only. |
| `test_10_stdout_contains_valid_json_only` | Protocol Stream Purity | **PASS** | ~0.10s | Evaluates varied payloads (success, insufficient data, severe sodicity). In every case, stdout is 100% parseable by `json.loads` without extraneous text. |
| `test_11_existing_frozen_engine_files_remain_unchanged` | Architectural Immutability | **PASS** | ~0.02s | Cryptographic verification that all 14 core engine files match their exact SHA-256 hashes from the Phase 3C.5.2.2.3 frozen manifest. |

**Adapter Suite Summary**: **11/11 Passed (100.0%)** in 0.976s.

---

## 3. Frozen Recommendation Engine Regression Suite

Test Runner: `FieldWise_main/model/ml_pipeline/recommendation_engine/tests/run_all_tests.py`  
Command: `python3 FieldWise_main/model/ml_pipeline/recommendation_engine/tests/run_all_tests.py`

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

**Total Verification Across Workspace**: **73/73 tests passing (100.0%)**.

---

## 4. Verification of Safety Requirements

### 4.1 Irrigation Default Override Verification
- In the frozen engine, `ClimateWaterInput(irrigation_access: Optional[str] = "None_Rainfed")` defines a constructor default of `"None_Rainfed"`.
- `adapter_cli.py` explicitly executes:
  ```python
  raw_irr = clim_dict.get("irrigation_access")
  if raw_irr is None:
      irrigation_access = None  # Explicit override
  ```
- Verified by `test_04_missing_irrigation_does_not_become_rainfed`:
  The query is constructed with `irrigation_access=None`, preventing silent conversion to rainfed and evaluating water regime as unknown/unmeasured.

### 4.2 Annual vs. Seasonal Rainfall Separation Verification
- `farmProfile.conditions.rainfall` represents annual rainfall. In `adapter_cli.py`:
  ```python
  if period_type == "Annual_Estimated":
      seasonal_rainfall_amount = None
  ```
- If an annual rainfall figure is provided, `seasonal_rainfall_amount` remains `None`.
- Verified by `test_06` and `test_07`: Annual totals are never passed as seasonal moisture, and monthly USDA-SCS equations are never evaluated against annual figures.

### 4.3 Provenance and STCR Calibration Claims Verification
- A user toggle (`has_soil_test: true`) or unverified laboratory name remains strictly `USER_DECLARED`.
- In accordance with the empty approved STCR registry (`_APPROVED_CALIBRATIONS = {}`), fertilizer prescriptions return `BASELINE_RDF_ARITHMETIC`.
- Verified by `test_08`: The engine never issues `VERIFIED_STCR_GENERATED` or `INDEPENDENTLY_VERIFIED` without an authentic, signed `TrustedVerificationRecord`.
