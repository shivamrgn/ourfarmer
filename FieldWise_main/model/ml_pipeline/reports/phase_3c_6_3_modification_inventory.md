# FieldWise — Phase 3C.6.3: File Modification Inventory & Safety Boundaries

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_3_modification_inventory.md`  
**Phase**: 3C.6.3 Frontend V2 Integration  
**Execution Timestamp**: November 2026  
**Status**: APPROVED RECONCILED INVENTORY  

---

## 1. Inventory of Files Created / Modified

### 1.1 Frontend Production Code
| Relative File Path | Action | Description & Scope of Changes |
| :--- | :---: | :--- |
| `FieldWise_main/src/types/v2Prediction.ts` | **Created** | Comprehensive TypeScript type definitions for Engine V2: `V2PredictRequest`, `V2PredictResponse`, `V2EngineData`, `V2CropRecommendation`, `V2WaterAssessment`, `V2NutrientPrescription`, `V2ExcludedCandidate`, and associated union types. |
| `FieldWise_main/src/components/v2/PredictionFormV2.tsx` | **Created** | Single primary V2 input form. Implements mandatory planned sowing month select (unselected by default, never current month), unknown irrigation default (`null`), explicit rainfed mapping (`None_Rainfed`), strict seasonal vs annual rainfall separation, farmer-declared soil test checkbox (`USER_DECLARED`), whole-day integer duration validation, client-side edaphic bounds validation, and `noValidate` decoupling. |
| `FieldWise_main/src/components/v2/PredictionResultsV2.tsx` | **Created** | Dedicated V2 recommendation interface. Supports all three engine statuses (`SUCCESS`, `INSUFFICIENT_DATA`, `NO_RECOMMENDATION_SUITABLE`). Enforces suitability score disclaimer (agronomic compatibility, not statistical probability), yield range as `[min, max] t/ha` (no point estimates), baseline RDF arithmetic fertilizer guidance with prominent warning banner, expandable excluded candidates accordion, and error retry banner. Employs `useEffect` for lifecycle-safe crop expansion without render-time `setState`. |
| `FieldWise_main/src/lib/api.ts` | **Modified** | Added `predictApi.predictV2`, and custom `V2ApiError` and `V2NetworkError` classes. Guaranteed zero silent fallback to V1 or offline engine on V2 errors. Preserved legacy `predictApi.predict` and local Gaussian engine fallback 100% intact. |
| `FieldWise_main/src/components/modules/CropRecommendation.tsx` | **Modified** | Integrated interactive Engine Version Switcher (`Engine V2 (Recommended)` vs `Engine V1 (Legacy)`). Mounts `PredictionFormV2` and `PredictionResultsV2` under V2 while preserving 100% of the legacy V1 farm profile cards, environmental sliders, and results when V1 is selected. |

### 1.2 Frontend Automated Test Suite
| Relative File Path | Action | Description & Scope of Changes |
| :--- | :---: | :--- |
| `FieldWise_main/src/test/v2_frontend_integration.test.tsx` | **Created** | 17 comprehensive unit/integration tests verifying: (1) `predictApi.predictV2` client invocation and error handling, (2) `PredictionFormV2` initial state, bounds validation, and payload construction, (3) `PredictionResultsV2` status rendering across `SUCCESS`, `INSUFFICIENT_DATA`, `NO_RECOMMENDATION_SUITABLE`, and error states, and (4) `CropRecommendation` engine toggle and legacy V1 preservation. Stabilized with `vi.hoisted()` mock user and exact accessible queries. |
| `FieldWise_main/src/test/setup.ts` | **Modified** | Polyfilled `ResizeObserver` and pointer capture methods (`hasPointerCapture`, `setPointerCapture`, `releasePointerCapture`) to support headless JSDOM rendering of Radix UI Select and Checkbox primitives. |

### 1.3 Documentation & Deliverable Reports
| Relative File Path | Action | Description & Scope of Changes |
| :--- | :---: | :--- |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_3_component_map.md` | **Created** | Comprehensive component hierarchy diagram, data flow mapping, agronomic input semantics, client-side validation rules, and error handling architecture. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_3_v1_compatibility_report.md` | **Created** | Certification of 100% backward compatibility of legacy V1 endpoint, client fallback, and user interface, with full test evidence. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_3_modification_inventory.md` | **Created** | Architectural boundary and file modification inventory for Phase 3C.6.3. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_3_checksums.txt` | **Created** | Authoritative SHA-256 manifest of all deliverables in Phase 3C.6.3. |

---

## 2. Inventory of Frozen / Untouched Components

### 2.1 Python Recommendation Engine Core (14 Frozen Files)
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

### 2.2 Python Adapter CLI
- `FieldWise_main/model/ml_pipeline/recommendation_engine/adapter_cli.py`: **UNTOUCHED**. Verified against authoritative checksum `6a1959ae616ade809287909bea210ceaac3a449f2a6ac5e2d12b45393d74fb34`.

### 2.3 Backend Production Code & Routes
- `FieldWise_main/backend/src/controllers/v2/predictController.js`: **UNTOUCHED**.
- `FieldWise_main/backend/src/services/v2/recommendationBridgeService.js`: **UNTOUCHED**.
- `FieldWise_main/backend/src/routes/v2/predict.js`: **UNTOUCHED**.
- `FieldWise_main/backend/src/controllers/predictController.js` (V1): **UNTOUCHED**.
- `FieldWise_main/backend/src/routes/predict.js` (V1): **UNTOUCHED**.
- `FieldWise_main/backend/src/services/predictor.js` (V1): **UNTOUCHED**.

### 2.4 Database & Persistence
- SQLite and Supabase database schemas: **UNTOUCHED** (Zero schema migrations).
- Persistence layer changes deferred to Phase 3C.6.4 in strict accordance with project phase boundaries.
