# FieldWise — Phase 3C.6.4.1: Inspected Files Inventory & Architectural Evidence

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_4_1_inspected_files_inventory.md`  
**Phase**: 3C.6.4.1 Persistence and Storage Mapping (Read-Only)  
**Execution Timestamp**: November 2026  
**Status**: APPROVED RECONCILED INVENTORY  

---

## 1. Executive Summary

In compliance with the Phase 3C.6.4.1 directive, this document provides an exhaustive inventory of all source code files, database instances, schema definitions, service modules, and reports inspected during the persistence audit.

---

## 2. Comprehensive Inventory of Inspected Files

### 2.1 Backend Persistence & Controllers
| Absolute / Relative File Path | Size / Lines | Subsystem Role | Key Evidence Extracted |
| :--- | :---: | :--- | :--- |
| `FieldWise_main/backend/src/config/database.js` | 50 lines | SQLite Database Setup | Initializes local database at `backend/data/croppredict.db` using `node:sqlite` (`DatabaseSync`). Creates `users` table. |
| `FieldWise_main/backend/data/croppredict.db` | Binary (28 KB) | SQLite Database File | Inspected using SQLite CLI / Python. Contains tables: `users`, `expert_inquiries`, `sqlite_sequence`. **Zero prediction tables in SQLite**. |
| `FieldWise_main/backend/src/controllers/predictController.js` | 55 lines | V1 Predict Controller | Calls `predictCrops()`. Completely stateless in Express; performs zero database reads or writes. |
| `FieldWise_main/backend/src/controllers/v2/predictController.js` | 98 lines | V2 Bridge Controller | Spawns `adapter_cli.py` via `recommendationBridgeService`. Completely stateless in Express; performs zero database reads or writes. |
| `FieldWise_main/backend/src/controllers/authController.js` | 89 lines | Auth Controller | Executes `db.prepare('SELECT id FROM users WHERE email = ?')` and `INSERT INTO users (...)` on SQLite database. |
| `FieldWise_main/backend/src/routes/expertSupport.js` | 859 lines | Expert Support Route | Creates `expert_inquiries` table in SQLite. Persists inquiry tickets and provides recent ticket query. |
| `FieldWise_main/backend/src/routes/predict.js` | 32 lines | V1 Predict Route | Validates 8 numeric fields with `express-validator`. Does not validate `state` or `sowing_month`. |
| `FieldWise_main/backend/src/routes/v2/predict.js` | 135 lines | V2 Predict Route | Enforces strict JSON numeric types, bounds, and mandatory `sowing_month` (integer 1–12). |
| `FieldWise_main/backend/src/server.js` | 94 lines | Server Entry Point | Mounts routers: `/api/predict` (V1), `/api/v2/predict` (V2), `/api/auth`, `/api/expert-support`, `/api/schemes`. |

---

### 2.2 Frontend Services, Storage & Contexts
| Absolute / Relative File Path | Size / Lines | Subsystem Role | Key Evidence Extracted |
| :--- | :---: | :--- | :--- |
| `FieldWise_main/src/lib/supabase.ts` | 298 lines | Supabase Client & Helper Functions | Declares TypeScript interfaces: `DbFarmer`, `DbFarmProfile`, `DbCropPrediction`. Implements: `ensureParentFarmerExists()`, `syncFarmerToSupabase()`, `syncFarmProfileToSupabase()`, `savePredictionToSupabase()`, and `syncCurrentStateToSupabase()`. |
| `FieldWise_main/src/services/farmProfileService.ts` | 325 lines | Farm Profile Service | Reads/writes `localStorage['cropswild_farm_profile']`. Triggers `syncFarmProfileToSupabase()` to update profile in cloud. Enforces `isNumeric` zero preservation. |
| `FieldWise_main/src/services/farmIntelligenceService.ts` | 818 lines | Cross-Module Intelligence | Reads `cropswild_crop_recommendation_last`, `cropswild_fertilizer_recommendation_last`, and `cropswild_disease_detection_last` from `localStorage`. Computes genuine data readiness. |
| `FieldWise_main/src/context/AuthContext.tsx` | 303 lines | Client Authentication Context | Reads active user profile from `localStorage['fieldwise_active_user']` (written by landing app). Maps Firebase profile to `AuthUser`. |
| `FieldWise_main/src/lib/api.ts` | 158 lines | Axios API Client | Implements `predictApi.predict()` with silent offline Gaussian fallback, and `predictApi.predictV2()` with isolated `V2ApiError` / `V2NetworkError`. |
| `FieldWise_main/src/lib/predictorEngine.ts` | 490 lines | Client-Side Offline Model | TypeScript in-browser clone of legacy Gaussian predictor. Used exclusively for V1 offline fallback. |

---

### 2.3 User Interface Modules
| Absolute / Relative File Path | Size / Lines | Subsystem Role | Key Evidence Extracted |
| :--- | :---: | :--- | :--- |
| `FieldWise_main/src/components/modules/CropRecommendation.tsx` | 1165 lines | Dual-Engine Container | Hosts Engine Version Switcher. Under V1: writes to `cropswild_crop_recommendation_last` and calls `savePredictionToSupabase()`. Under V2: receives `v2Response` into ephemeral state. |
| `FieldWise_main/src/components/v2/PredictionFormV2.tsx` | 740 lines | Single Primary V2 Entry Point | Enforces unselected defaults (`sowing_month: null`, `state: ''`, `nutrient_basis: ''`). Type-safe `isNumeric` guards. Safe payload construction. |
| `FieldWise_main/src/components/v2/PredictionResultsV2.tsx` | 548 lines | V2 Results Presentation | Renders all 3 statuses: `SUCCESS`, `INSUFFICIENT_DATA`, `NO_RECOMMENDATION_SUITABLE`. Formats yield as `[min, max] t/ha`, baseline RDF fertilizer banner, and excluded candidates accordion. |
| `FieldWise_main/src/components/modules/FertilizerRecommendation.tsx` | 1259 lines | Fertilizer Formulations | Reads/writes `localStorage['cropswild_fertilizer_recommendation_last']`. Dispatches `fieldwise:intelligence_updated`. |
| `FieldWise_main/src/components/modules/FarmIntelligence.tsx` | 780 lines | Farm Intelligence Dashboard | Consumes stored recommendations from `farmIntelligenceService` to render recommendation cards and match percentages. |
| `FieldWise_main/src/components/dashboard/DashboardMainContent.tsx` | 943 lines | Main Dashboard Home View | Displays top recommendation summary banner: `{crop} ({confidence}% match)`. |
| `FieldWise_main/src/pages/Profile.tsx` | 480 lines | Farmer Profile Editor | Edits and saves farm profile via `farmProfileService.saveFarmProfile(profile, true)`. |

---

### 2.4 Landing Application & Authentication
| Absolute / Relative File Path | Size / Lines | Subsystem Role | Key Evidence Extracted |
| :--- | :---: | :--- | :--- |
| `FieldWise_landing/src/firebase.js` | 425 lines | Landing Auth & Persistence | Uses Firebase Auth and Firestore collection `'farmers'`. Writes session to `localStorage['fieldwise_active_user']` and `'fieldwise_session_expiry'`. |
| `FieldWise_main/docs/TECHNICAL_DOCUMENTATION.md` | 489 lines | Technical Platform Architecture | Documents backend SQLite schema for `users` and `expert_inquiries`, environment configurations, and API endpoints. |

---

### 2.5 Frozen Python Recommendation Engine Core (Reference Verification)
| Absolute / Relative File Path | Size / Lines | Subsystem Role | Key Verification Finding |
| :--- | :---: | :--- | :--- |
| `FieldWise_main/model/ml_pipeline/recommendation_engine/schemas.py` | 218 lines | Engine Schemas | Dataclasses for `RecommendationQuery`, `RecommendationResult`, `LocationInput`, `TemporalInput`, `ClimateWaterInput`, `EdaphicInput`. Verified frozen. |
| `FieldWise_main/model/ml_pipeline/recommendation_engine/adapter_cli.py` | 338 lines | CLI Bridge Adapter | Reads JSON query from stdin, executes recommendation engine, writes JSON result to stdout. Verified frozen against authoritative hash `6a1959ae...`. |
