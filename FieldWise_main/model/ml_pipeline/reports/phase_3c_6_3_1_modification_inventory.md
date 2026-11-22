# FieldWise — Phase 3C.6.3.1: File Modification Inventory & Safety Boundaries

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_3_1_modification_inventory.md`  
**Phase**: 3C.6.3.1 V2 Input Default and Provenance Closure  
**Execution Timestamp**: November 2026  
**Status**: APPROVED RECONCILED INVENTORY  

---

## 1. Inventory of Files Modified in Phase 3C.6.3.1

### 1.1 Frontend Production Code
| Relative File Path | Action | Description & Exact Scope of Changes |
| :--- | :---: | :--- |
| `FieldWise_main/src/components/v2/PredictionFormV2.tsx` | **Modified** | **Removed all fabricated measurement defaults**: eliminated hardcoded values (Punjab, 25°C, 65% humidity, Loam, pH 6.8, N 80, P 40, K 40, OC 0.65%, `SHC_Available_kg_ha`). Initialized all unsupplied fields to `null` or `''`. Implemented `isNumeric` guard to preserve valid zero (`0`, `0.0`) values. Ensured profile prefill populates only explicitly declared attributes without inferring soil test availability or nutrient basis. Updated `handleReset` to restore safe `null`/unselected state. Updated payload builder to send `null` or omitted values without injecting fallback defaults. |

### 1.2 Frontend Automated Test Suite
| Relative File Path | Action | Description & Exact Scope of Changes |
| :--- | :---: | :--- |
| `FieldWise_main/src/test/v2_frontend_integration.test.tsx` | **Modified** | Added **12 comprehensive automated tests** under `Phase 3C.6.3.1: V2 Input Defaults & Provenance Closure` verifying: (1) Fresh form renders all measurement fields empty/null, (2) Submit button disabled until mandatory fields are filled, (3) Profile prefill populates only explicitly supplied values, (4) Zero measurements are preserved across all edaphic/environmental inputs, (5) Missing profile values remain null/unselected, (6) Sowing month remains unselected on profile load, (7) Irrigation remains UNKNOWN unless explicitly declared, (8) Soil test checkbox remains unchecked on profile load, (9) Reset button clears to null/unselected without reviving fabricated defaults, (10) Request payload sends null for unsupplied fields, (11) Request payload omits nutrient basis when unselected, and (12) All 17 previous Phase 3C.6.3 tests continue to pass without regression (29 total tests in file). |

### 1.3 Documentation & Deliverable Reports
| Relative File Path | Action | Description & Exact Scope of Changes |
| :--- | :---: | :--- |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_3_1_component_map.md` | **Created** | Comprehensive parameter initialization matrix, `isNumeric` guarding specification, explicit profile prefill rules, reset invariants, and safe payload construction. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_3_1_v1_compatibility_report.md` | **Created** | Verification of zero regressions across legacy V1 client, V1 backend route, and V1 user interface, with complete test execution evidence. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_3_1_modification_inventory.md` | **Created** | File modification inventory, architectural safety boundaries, and frozen component catalog for Phase 3C.6.3.1. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_3_1_checksums.txt` | **Created** | Authoritative SHA-256 manifest of all deliverables in Phase 3C.6.3.1. |

---

## 2. Inventory of Unmodified Frontend V2 Components (Preserved from Phase 3C.6.3)

| Relative File Path | Status | Verification Check |
| :--- | :---: | :--- |
| `FieldWise_main/src/types/v2Prediction.ts` | **Unmodified** | Type definitions for `V2PredictRequest`, `V2PredictResponse`, and agronomic sub-schemas preserved. |
| `FieldWise_main/src/components/v2/PredictionResultsV2.tsx` | **Unmodified** | Presentation of `SUCCESS`, `INSUFFICIENT_DATA`, `NO_RECOMMENDATION_SUITABLE`, and error states preserved. `useEffect` lifecycle hook preserved. |
| `FieldWise_main/src/lib/api.ts` | **Unmodified** | `predictApi.predictV2`, `V2ApiError`, and `V2NetworkError` preserved with zero silent fallback. Legacy `predictApi.predict` preserved. |
| `FieldWise_main/src/components/modules/CropRecommendation.tsx` | **Unmodified** | Engine Version Switcher and container layout preserved. |
| `FieldWise_main/src/test/setup.ts` | **Unmodified** | `ResizeObserver` and pointer capture JSDOM polyfills preserved. |

---

## 3. Inventory of Frozen / Untouched System Components

### 3.1 Python Recommendation Engine Core (14 Frozen Files)
All 14 files in `FieldWise_main/model/ml_pipeline/recommendation_engine/` remain frozen and unmodified:
1. `__init__.py`
2. `catalogue.py`
3. `dci_confidence.py`
4. `engine.py`
5. `explanations.py`
6. `input_validator.py`
7. `planting_window.py`
8. `provenance_registry.py`
9. `ranking.py`
10. `schemas.py`
11. `stcr_registry.py`
12. `tier1_eligibility.py`
13. `tier2_scoring.py`
14. `water_assessment.py`

### 3.2 Python Adapter CLI
- `FieldWise_main/model/ml_pipeline/recommendation_engine/adapter_cli.py`: **UNTOUCHED**. Verified against authoritative checksum `6a1959ae616ade809287909bea210ceaac3a449f2a6ac5e2d12b45393d74fb34`.

### 3.3 Backend Production Code & Routes
- `FieldWise_main/backend/src/controllers/v2/predictController.js`: **UNTOUCHED**.
- `FieldWise_main/backend/src/services/v2/recommendationBridgeService.js`: **UNTOUCHED**.
- `FieldWise_main/backend/src/routes/v2/predict.js`: **UNTOUCHED**.
- `FieldWise_main/backend/src/controllers/predictController.js` (V1): **UNTOUCHED**.
- `FieldWise_main/backend/src/routes/predict.js` (V1): **UNTOUCHED**.
- `FieldWise_main/backend/src/services/predictor.js` (V1): **UNTOUCHED**.

### 3.4 Database & Persistence
- SQLite and Supabase database schemas: **UNTOUCHED** (Zero schema migrations).
- Phase 3C.6.4 persistence tasks remain deferred until authorized.
