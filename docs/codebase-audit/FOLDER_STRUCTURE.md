# FieldWise Platform — Folder Structure Analysis & Proposed Organization

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-22  

---

## 1. Existing Folder Structure (As-Is Critique)

The current directory layout exhibits significant historical accumulation, fragmented package naming, and mixed responsibility boundaries:

```
farmingFinal/
├── FieldWise_Phase3B_2_CV_Review.zip.sha256     <-- Orphaned sha256 checksum (missing zip)
├── Phase3B2_Independent_Review_Evidence.zip.sha256 <-- Orphaned sha256 checksum
├── Phase3C1_... to Phase3C6_... .zip (33 files) <-- Milestone build archives clogging root (~4 MB)
├── Phase3C1_... to Phase3C6_... .sha256 (36 files) <-- Checksum files clogging root
├── QA.txt & QA_REPORT.txt                       <-- Exact byte-for-byte duplicate files (20.8 KB each)
├── dev.js                                       <-- Root runner script
├── package.json                                 <-- Root package (fieldwise-suite)
│
├── FieldWise_landing/                           <-- Visitor app (package name: "finalone")
│   ├── firestore.rules
│   ├── package.json (React 19, Vite 8)
│   ├── public/ (hero-farm.jpg 4.9MB)
│   └── src/
│       ├── firebase.js
│       ├── components/ (38 files, 19 .jsx paired with 19 .css)
│       │   ├── AIFeatures.jsx (123 B re-export stub) & AIFeatures.css (15.7 KB orphaned)
│       │   ├── SmartTools.jsx (113 B re-export stub) & SmartTools.css (6.6 KB orphaned)
│       │   ├── Dashboard.jsx (33.5 KB) & DashboardPreview.jsx (33.6 KB) <-- ~95% duplication
│       │   └── ...
│
├── FieldWise_main/                              <-- Dashboard app (package name: "vite_react_shadcn_ts")
│   ├── backend/                                 <-- Backend API (package name: "croppredict-backend")
│   │   ├── data/ (croppredict.db SQLite)
│   │   ├── package.json (Express, Node 22)
│   │   └── src/ (config, controllers, middleware, routes, services, tests)
│   ├── migrations/                              <-- 8 SQL migrations and verification scripts
│   ├── model/                                   <-- Hybrid ML engine
│   │   ├── cropDatabase.js
│   │   ├── fertilizerDatabase.js
│   │   ├── predictor.js
│   │   ├── package.json (contains only {"type": "commonjs"})
│   │   └── ml_pipeline/                         <-- Python ML pipeline (373 files!)
│   │       ├── data/ (14 CSVs and notes)
│   │       ├── experiments/ (46 files, 32 .joblib checkpoint models)
│   │       ├── models/ (5 active .joblib models)
│   │       ├── recommendation_engine/ (26 .py files + 25 compiled .pyc files!)
│   │       ├── reports/ (229 files: markdown audits, CSV dumps, PNG charts)
│   │       └── scripts/ (26 Python evaluation and training scripts)
│   └── src/                                     <-- Main React Frontend (127 files)
│       ├── components/
│       │   ├── LandingPage.tsx (28.7 KB)        <-- Completely unused duplicate landing component
│       │   ├── LoginDemo.tsx (3.8 KB)           <-- Unused legacy "Crops Wild" login component
│       │   ├── LoginForm.tsx (15.8 KB)          <-- Detached from routing tree
│       │   ├── NavLink.tsx (751 B)              <-- Unused wrapper component
│       │   ├── PredictionForm.tsx (11.7 KB)     <-- Orphaned V1 prediction form
│       │   ├── PredictionResults.tsx (12.3 KB)  <-- Orphaned V1 prediction results
│       │   ├── ProtectedRoute.tsx (220 B)       <-- Pass-through stub (unused)
│       │   ├── dashboard/ (5 files)
│       │   ├── modules/ (16 files, high cyclomatic complexity, 800-1500 lines each)
│       │   ├── ui/ (51 Shadcn UI components, 24 completely unused)
│       │   └── v2/ (PredictionFormV2, PredictionResultsV2)
│       ├── context/ (AuthContext, LocationContext)
│       ├── data/ (cropData.ts)
│       ├── hooks/ (use-mobile, use-toast)
│       ├── lib/ (api, predictorEngine, supabase, utils)
│       ├── pages/ (8 pages, Auth.tsx & Login.tsx unused)
│       ├── services/ (12 services, circular dependency between market services)
│       ├── test/ (8 test suites, 110 tests)
│       └── types/ (cropPrediction, v2Prediction)
```

---

## 2. Identified Structural Defects

1. **Root Directory Clutter**: 33 `.zip` files and 38 `.sha256` files (~4 MB) stored directly in the repository root. These represent historical Phase 3 milestone archives that belong in an `archive/` or release bucket.
2. **Duplicated QA Reports**: `QA.txt` and `QA_REPORT.txt` are identical byte-for-byte copies (20,889 bytes each).
3. **Inconsistent Package Naming**:
   - Root: `fieldwise-suite`
   - Landing: `finalone` (scaffolding artifact)
   - Dashboard: `vite_react_shadcn_ts` (template artifact)
   - Backend: `croppredict-backend` (legacy project name)
   - Model: Empty name in `model/package.json`
4. **React Version Inconsistency**:
   - `FieldWise_landing`: React 19 (`^19.2.8`)
   - `FieldWise_main`: React 18 (`^18.3.1`)
5. **Committed Bytecode (`.pyc`)**: 25 compiled `.pyc` files committed in `model/ml_pipeline/recommendation_engine/` instead of being ignored via `.gitignore`.
6. **Bloated Report Directory**: 229 intermediate evaluation and benchmark files in `model/ml_pipeline/reports/` mixed with active project assets.
7. **Orphaned Frontend Components in Main**: `LandingPage.tsx` (28.7 KB), `PredictionForm.tsx` (11.7 KB), `PredictionResults.tsx` (12.3 KB), `LoginForm.tsx` (15.8 KB), `LoginDemo.tsx` (3.8 KB), and `pages/Auth.tsx` / `pages/Login.tsx` are completely detached from the application routing graph.
8. **UI Component Over-provisioning**: 24 out of 51 UI components in `components/ui/` are unused, dragging in 10+ unneeded `@radix-ui/*` dependencies.

---

## 3. Proposed Target Folder Structure (Monorepo Standard)

The recommended structure organizes the platform into standard `apps/`, `services/`, `packages/`, and `docs/` domains while preserving runtime contracts:

```
fieldwise/
├── package.json                         <-- Monorepo package with workspace scripts
├── dev.js                               <-- Orchestrator runner (starts landing, app, backend)
├── README.md                            <-- Top-level documentation and quick-start
├── .gitignore                           <-- Comprehensive root gitignore (.pyc, zips, logs)
│
├── docs/                                <-- Dedicated architectural & engineering documentation
│   ├── PROJECT_OVERVIEW.md
│   ├── FOLDER_STRUCTURE.md
│   ├── FILE_AUDIT.md
│   ├── USEFUL_FILES.md
│   ├── UNUSED_FILES.md
│   ├── CODE_QUALITY_REPORT.md
│   ├── DEPENDENCY_AUDIT.md
│   ├── REFACTORING_PLAN.md
│   └── ARCHITECTURE.md
│
├── archive/                             <-- Archived milestone packages & legacy reports
│   ├── phase_milestones/                <-- 33 .zip and 38 .sha256 packages moved here
│   └── legacy_reports/                  <-- QA.txt and historical milestone logs
│
├── apps/
│   ├── landing/                         (renamed from FieldWise_landing, package: @fieldwise/landing)
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   ├── index.html
│   │   ├── public/
│   │   └── src/
│   │       ├── main.jsx
│   │       ├── App.jsx
│   │       ├── firebase.js
│   │       ├── components/              (Consolidated: remove AIFeatures/SmartTools stubs)
│   │       └── styles/                  (Centralized CSS modules / Tailwind)
│   │
│   └── dashboard/                       (renamed from FieldWise_main, package: @fieldwise/dashboard)
│       ├── package.json
│       ├── vite.config.ts
│       ├── vitest.config.ts
│       ├── index.html
│       ├── public/
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── components/
│           │   ├── common/              (ErrorBoundary, NavLink)
│           │   ├── dashboard/           (Header, Sidebar, Content, Footer, WeatherContext)
│           │   ├── modules/             (15 active modules; monoliths decomposed)
│           │   │   ├── crop-recommendation/
│           │   │   ├── disease-detection/
│           │   │   ├── fertilizer-advisory/
│           │   │   ├── soil-intelligence/
│           │   │   ├── mandi-prices/
│           │   │   └── ...
│           │   ├── ui/                  (Trimmed to only 27 active Shadcn components)
│           │   └── v2/                  (PredictionFormV2, PredictionResultsV2)
│           ├── context/                 (AuthContext, LocationContext)
│           ├── hooks/                   (use-mobile, use-toast)
│           ├── lib/                     (api, predictorEngine, supabase, utils)
│           ├── pages/                   (Profile, Settings, ExpertConsultation, etc.)
│           ├── services/                (Consolidated services with circular imports broken)
│           ├── types/                   (cropPrediction, v2Prediction, marketPrices)
│           └── test/                    (Unit and integration test suites)
│
├── services/
│   └── api/                             (renamed from FieldWise_main/backend, package: @fieldwise/api)
│       ├── package.json
│       ├── data/                        (croppredict.db SQLite)
│       └── src/
│           ├── server.js
│           ├── config/                  (database, supabaseClient, validateEnv, v2/bridgeConfig)
│           ├── controllers/             (authController, firebaseVerifyController, predictController)
│           ├── middleware/              (auth, rateLimiter)
│           ├── routes/                  (auth, expertSupport, predict, schemes, v2/predict)
│           ├── services/                (recommendationBridgeService, recommendationPersistenceService)
│           └── tests/                   (7 backend integration and unit test suites)
│
├── packages/
│   ├── database/                        (renamed from FieldWise_main/migrations)
│   │   ├── V1_Baseline_Schema.sql
│   │   ├── V2_Persistence_Migration_Final_v3.sql
│   │   ├── V3_MyFarm_CrossBrowser_Persistence_Migration.sql
│   │   └── verification_queries/
│   │
│   └── agronomy-engine/                 (renamed from FieldWise_main/model)
│       ├── package.json
│       ├── predictor.js                 (Legacy JS rule-based predictor)
│       ├── databases/                   (cropDatabase.js, fertilizerDatabase.js)
│       └── python_pipeline/             (renamed from ml_pipeline)
│           ├── recommendation_engine/   (Active Python agronomy engine and CLI)
│           ├── models/                  (Active .joblib models)
│           ├── data/                    (Active reference agronomy datasets)
│           ├── scripts/                 (Training and evaluation scripts)
│           └── experiments/             (Experiment checkpoints)
```

---

## 4. Key Benefits of the Proposed Structure

1. **Clear Separation of Concerns**: Public marketing, authenticated dashboard, backend REST API, database schemas, and Python ML pipelines have distinct boundaries.
2. **Root Directory Cleanliness**: Moves 71 archive/checksum files out of root into a dedicated `archive/` folder.
3. **Elimination of Dead Code**: Removes ~100 KB of unused legacy components (`LandingPage.tsx`, `LoginForm.tsx`, `PredictionForm.tsx`, `LoginDemo.tsx`, stubs).
4. **Build & Bundle Efficiency**: Removing 24 unused Radix components reduces npm dependency footprint and client bundle parse time.
5. **No Broken Contracts**: The structure maintains backward-compatible path mappings and environment variable compatibility.
