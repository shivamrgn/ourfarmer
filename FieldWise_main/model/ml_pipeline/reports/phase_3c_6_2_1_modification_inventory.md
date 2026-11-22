# FieldWise — Phase 3C.6.2.1: File Modification Inventory & Architectural Boundaries

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_2_1_modification_inventory.md`  
**Phase**: 3C.6.2.1 Python Adapter CLI Implementation  
**Execution Timestamp**: November 2026  
**Status**: APPROVED RECONCILED INVENTORY  

---

## 1. Inventory of Files Created

| Relative File Path | Action | Purpose & Scope |
| :--- | :---: | :--- |
| `FieldWise_main/model/ml_pipeline/recommendation_engine/adapter_cli.py` | **Created** | Standalone Python CLI runner script. Reads single JSON request from `stdin`, enforces input validation and safety overrides (irrigation explicit `None`, annual rainfall separation), invokes `CropRecommendationEngine.recommend()`, serializes `RecommendationResult` to `stdout`, and routes all errors/traces strictly to `stderr`. |
| `FieldWise_main/model/ml_pipeline/recommendation_engine/tests/test_adapter_cli.py` | **Created** | Dedicated test suite containing 11 tests verifying subprocess invocation, JSON stream separation, safety overrides, error handling, and frozen engine integrity. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_2_1_test_execution_report.md` | **Created** | Comprehensive test execution report documenting results of the 11 adapter tests and the 62 frozen regression tests. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_2_1_modification_inventory.md` | **Created** | Architectural boundary and file modification inventory report. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_2_1_checksums.txt` | **Created** | Authoritative SHA-256 manifest of all Phase 3C.6.2.1 deliverables. |

---

## 2. Inventory of Frozen / Untouched Components

In accordance with Phase 3C.6.2.1 strict boundaries, the following components remain **100% untouched and unchanged**:

| Component / Subsystem | Status | Verification & Integrity Notes |
| :--- | :---: | :--- |
| **Phase 3C.5 Recommendation Engine Core (14 files)** | **UNTOUCHED** | `catalogue.py`, `dci_confidence.py`, `engine.py`, `explanations.py`, `input_validator.py`, `planting_window.py`, `provenance_registry.py`, `ranking.py`, `schemas.py`, `stcr_registry.py`, `tier1_eligibility.py`, `tier2_scoring.py`, `water_assessment.py`, `__init__.py`. Cryptographic SHA-256 hashes verified against `phase_3c_5_2_2_3_checksums.txt`. |
| **Existing Frozen Engine Regression Tests (8 test files)** | **UNTOUCHED** | `test_acceptance_matrix.py`, `test_edge_cases.py`, `test_phase_3c_5_1_regressions.py`, `test_phase_3c_5_2_regressions.py`, `test_phase_3c_5_2_1_regressions.py`, `test_phase_3c_5_2_2_regressions.py`, `test_phase_3c_5_2_2_1_regressions.py`, `test_phase_3c_5_2_2_2_regressions.py`, `run_all_tests.py`. All 62 tests continue passing 100%. |
| **Frontend UI Files** | **UNTOUCHED** | `FieldWise_main/src/components/modules/CropRecommendation.tsx`, `PredictionForm.tsx`, `PredictionResults.tsx`, `lib/api.ts`, `lib/predictorEngine.ts`, `services/*`. Zero changes. |
| **Existing V1 API Routes & Controllers** | **UNTOUCHED** | `FieldWise_main/backend/src/routes/predict.js`, `FieldWise_main/backend/src/controllers/predictController.js`, `FieldWise_main/model/predictor.js`. Zero changes. |
| **Database Schemas & Supabase** | **UNTOUCHED** | Zero database migrations, zero schema mutations. |
| **Environment Configuration & Secrets** | **UNTOUCHED** | `.env` files strictly unread, unprinted, uncopied, and unmodified. |

---

## 3. Strict Boundary Compliance Check

- [x] Standalone Python CLI created outside frozen engine logic.
- [x] Zero modifications to existing Phase 3C.5 engine files.
- [x] Zero modifications to frontend code or legacy V1 endpoints.
- [x] Zero modifications to database schemas.
- [x] Zero access to `.env` secrets.
- [x] All 62 existing frozen regression tests passing.
- [x] All 11 dedicated adapter tests passing.
- [x] Subprocess JSON protocol verified with strict stream separation (`stdout` JSON only, `stderr` diagnostics).
