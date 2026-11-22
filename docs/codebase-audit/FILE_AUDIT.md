# FieldWise Platform — Complete File Classification & Audit

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-22  
**Total Files Scanned:** 685  
**Total Directories Scanned:** 64  

---

## 1. Classification Categories Overview

Every file in the repository is evaluated according to strict architectural guidelines:
- **Category A (Essential):** Actively required for application runtime, build, configuration, APIs, or tests.
- **Category B (Useful):** Provides value (e.g. documentation, reference datasets, migration scripts) but can be reorganized or consolidated.
- **Category C (Redundant):** Duplicated logic, repeated implementations, or identical copies.
- **Category D (Unused):** Zero inbound imports, unreachable execution paths, detached pages/components.
- **Category E (Obsolete):** Historical milestone archives, legacy project artifacts, old reports.
- **Category F (Unnecessary):** Temporary files, compiled bytecode, generated OS artifacts (`.DS_Store`).

---

## 2. Root Directory Files Audit

| File Path | Purpose | Current Usage | Dependencies / Refs | Category | Action | Risk Level |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `dev.js` | Monorepo multi-process dev runner | Runs `npm run dev` in landing, main, and backend | Child process spawning | **A** | KEEP | High if removed |
| `package.json` | Root workspace script definitions | Defines `"scripts": {"dev": "node dev.js"}` | None | **A** | KEEP | High if removed |
| `README.md` | Top-level repository overview | Documentation | None | **B** | KEEP | Low |
| `QA.txt` | Quality assurance audit report | Static documentation | None | **C** | DELETE | None (Exact copy of `QA_REPORT.txt`) |
| `QA_REPORT.txt` | Quality assurance audit report | Static documentation | None | **B** | MOVE | Low (Move to `docs/archive/`) |
| `Phase3C1_... .zip` (33 files) | Historical milestone build archives | None (historical deliverables) | None | **E** | ARCHIVE | None (Move to `archive/milestones/`) |
| `Phase3C1_... .sha256` (36 files)| SHA256 checksums for zips | None (historical deliverables) | Corresponding .zip | **E** | ARCHIVE | None (Move to `archive/milestones/`) |
| `FieldWise_Phase3B_2_CV_Review.zip.sha256` | Orphaned checksum file | None (Missing corresponding zip) | None | **F** | DELETE | None |
| `Phase3B2_Independent_Review_Evidence.zip.sha256` | Orphaned checksum file | None (Missing corresponding zip) | None | **F** | DELETE | None |
| `.DS_Store` (root) | macOS Finder metadata | OS generated | None | **F** | DELETE | None |

---

## 3. Visitor Portal Audit (`FieldWise_landing/`)

| File Path | Purpose | Current Usage | Dependencies / Refs | Category | Action | Risk Level |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `package.json` | Package configuration | Build & run landing | React 19, Vite 8, Firebase | **A** | KEEP | High |
| `vite.config.js` | Vite bundler config | Dev server & bundle generation | `@vitejs/plugin-react` | **A** | KEEP | High |
| `index.html` | SPA HTML entry | Loads `src/main.jsx` | Browser DOM | **A** | KEEP | High |
| `firestore.rules` | Firebase security rules | Security rules deployed to Firebase | Firebase Firestore | **A** | KEEP | High |
| `src/main.jsx` | React root entry | Mounts React root to DOM | `src/App.jsx`, `src/index.css` | **A** | KEEP | High |
| `src/App.jsx` | Landing page layout & auth state | Coordinates landing page sections & modals | All landing components | **A** | KEEP | High |
| `src/firebase.js` | Firebase SDK init & handoff client | Auth login, register, Google sign-in, token dispatch | Firebase Auth, Backend API | **A** | KEEP | High |
| `src/index.css` | Global styling & typography | Global utility styles | Component styling | **A** | KEEP | High |
| `src/components/Navbar.jsx` & `.css` | Header navigation | Top navbar, Login trigger | `App.jsx` | **A** | KEEP | Medium |
| `src/components/Hero.jsx` & `.css` | Hero section | Landing visual lead & CTA | `App.jsx` | **A** | KEEP | Medium |
| `src/components/ProblemSolution.jsx` & `.css` | Value proposition | Landing section | `App.jsx` | **A** | KEEP | Low |
| `src/components/FarmIntelligenceEngine.jsx` & `.css`| Core features grid | Landing section | `App.jsx`, `AIFeatures.jsx` | **A** | KEEP | Low |
| `src/components/AIFeatures.jsx` | 123 B re-export stub | Re-exports `FarmIntelligenceEngine` | None (legacy alias) | **C** | DELETE | Very Low |
| `src/components/AIFeatures.css` | 15.7 KB orphaned CSS | Duplicate styles | None | **C** | DELETE | Very Low |
| `src/components/RealWorldFarmData.jsx` & `.css` | Live agricultural metrics | Landing section | `App.jsx`, `SmartTools.jsx` | **A** | KEEP | Low |
| `src/components/SmartTools.jsx` | 113 B re-export stub | Re-exports `RealWorldFarmData` | None (legacy alias) | **C** | DELETE | Very Low |
| `src/components/SmartTools.css` | 6.6 KB orphaned CSS | Duplicate styles | None | **C** | DELETE | Very Low |
| `src/components/DashboardPreview.jsx` & `.css` | Interactive landing demo | Rendered inline in `App.jsx` | `App.jsx` | **A** | KEEP | Medium |
| `src/components/Dashboard.jsx` & `.css` | Full in-landing dashboard | Legacy view in `App.jsx` (~95% dup with Preview) | `App.jsx` | **C** | MERGE | Medium (Consolidate into Preview or redirect to Main) |
| `src/components/AuthModal.jsx` & `.css` | Modal login/register | Firebase email/password & Google Sign-In | `firebase.js`, `App.jsx` | **A** | KEEP | High |
| `src/components/HowItWorks.jsx` & `.css` | 3-step farmer journey | Landing section | `App.jsx` | **A** | KEEP | Low |
| `src/components/MandiPriceIntelligence.jsx` & `.css`| Mandi prices showcase | Landing section | `App.jsx` | **A** | KEEP | Low |
| `src/components/DataIntelligence.jsx` & `.css` | Data metrics showcase | Landing section | `App.jsx` | **A** | KEEP | Low |
| `src/components/FarmerSupport.jsx` & `.css` | Support CTA | Landing section | `App.jsx` | **A** | KEEP | Low |
| `src/components/ExpertAgriculturalSupport.jsx` & `.css`| Expert consultation showcase | Landing section | `App.jsx` | **A** | KEEP | Low |
| `src/components/WhyChooseUs.jsx` & `.css` | Benefits grid | Landing section | `App.jsx` | **A** | KEEP | Low |
| `src/components/FarmerJourney.jsx` & `.css` | Farmer testimonials | Landing section | `App.jsx` | **A** | KEEP | Low |
| `src/components/FinalCTA.jsx` & `.css` | Bottom conversion banner | Landing section | `App.jsx` | **A** | KEEP | Low |
| `src/components/Footer.jsx` & `.css` | Footer links | Landing section | `App.jsx` | **A** | KEEP | Low |
| `src/assets/hero.png` | Scaffolding asset | Unused | None | **D** | DELETE | None |
| `src/assets/react.svg` | Default Vite asset | Unused | None | **D** | DELETE | None |
| `src/assets/vite.svg` | Default Vite asset | Unused | None | **D** | DELETE | None |
| `public/hero-farm.jpg` | Hero background photo (4.9 MB) | High-res background image | `Hero.css` | **B** | KEEP | High (Compress to WebP to save 4 MB) |

---

## 4. Farmer Dashboard Audit (`FieldWise_main/src/`)

### 4.1. Core Application & Routing
| File Path | Purpose | Current Usage | Dependencies | Category | Action | Risk Level |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `src/main.tsx` | Main React entry | Mounts React root | `App.tsx`, `index.css` | **A** | KEEP | High |
| `src/App.tsx` | Main Router & Query Client | Defines routes (`/`, `/profile`, `/settings`, etc.) | Router, Providers, Pages | **A** | KEEP | High |
| `src/index.css` | Tailwind & theme variables | Global styling | Tailwind CSS | **A** | KEEP | High |
| `src/App.css` | Minimal overrides | Global styles | None | **B** | MERGE | Very Low (Merge into `index.css`) |
| `src/vite-env.d.ts` | Vite type definitions | TypeScript env typing | TypeScript | **A** | KEEP | Low |
| `src/context/AuthContext.tsx` | Central authentication & handoff | Session state, token exchange, demo mode | Backend API, Supabase | **A** | KEEP | Critical |
| `src/context/LocationContext.tsx` | GPS/IP farm location state | Provides lat/long & district to modules | Browser Geolocation | **A** | KEEP | High |

### 4.2. Pages (`src/pages/`)
| File Path | Purpose | Current Usage | Dependencies | Category | Action | Risk Level |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `pages/Index.tsx` | Main dashboard shell | Renders `components/Dashboard.tsx` | `Dashboard.tsx` | **A** | KEEP | High |
| `pages/Profile.tsx` | Farmer profile & farm setup | Edit profile, farm details, cross-browser sync | `farmProfileService`, Supabase | **A** | KEEP | High (Needs modular decomposition) |
| `pages/Settings.tsx` | User preferences & themes | Language, notifications, security settings | `AuthContext` | **A** | KEEP | Medium |
| `pages/ExpertConsultation.tsx` | Expert consultation page | Direct route `/expert-consultation` | `expertSupportService` | **A** | KEEP | Medium |
| `pages/TermsAndConditions.tsx` | Legal terms | Route `/terms` | None | **A** | KEEP | Low |
| `pages/PrivacyPolicy.tsx` | Privacy policy | Route `/privacy` | None | **A** | KEEP | Low |
| `pages/NotFound.tsx` | 404 handler | Catch-all route `*` | Router | **A** | KEEP | Low |
| `pages/Auth.tsx` | Standalone auth page (7.1 KB) | **Unused** (Not routed in `App.tsx`) | `LoginForm.tsx` | **D** | DELETE | None |
| `pages/Login.tsx` | Standalone login page (4.7 KB) | **Unused** (Not routed in `App.tsx`) | `LoginForm.tsx` | **D** | DELETE | None |

### 4.3. Components (`src/components/`)
| File Path | Purpose | Current Usage | Dependencies | Category | Action | Risk Level |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `components/Dashboard.tsx` | Main dashboard orchestrator | Switches between 15 modules | Dashboard subcomponents | **A** | KEEP | Critical |
| `components/LandingPage.tsx` | Internal landing component (28.7 KB) | **Unused** (Replaced by `FieldWise_landing`) | None | **D** | DELETE | None |
| `components/LoginDemo.tsx` | Legacy "Crops Wild" login card | **Unused** (Zero imports) | None | **D** | DELETE | None |
| `components/LoginForm.tsx` | Legacy login form (15.8 KB) | **Unused** (Only imported by unused `Login.tsx`) | `authService` | **D** | DELETE | None |
| `components/NavLink.tsx` | NavLink compat wrapper | **Unused** (Zero imports) | None | **D** | DELETE | None |
| `components/PredictionForm.tsx` | V1 prediction form (11.7 KB) | **Unused** (Superceded by `PredictionFormV2`) | None | **D** | DELETE | None |
| `components/PredictionResults.tsx` | V1 prediction results (12.3 KB) | **Unused** (Superceded by `PredictionResultsV2`) | None | **D** | DELETE | None |
| `components/ProtectedRoute.tsx` | Pass-through wrapper (220 B) | **Unused** (Zero imports, returns `{children}`) | None | **D** | DELETE | None |
| `components/common/ErrorBoundary.tsx` | Global error boundary | Error trapping | React Component | **A** | KEEP | High |
| `components/dashboard/*` (5 files) | Header, Sidebar, Content, Footer, Weather | Core dashboard layout structure | Contexts, UI components | **A** | KEEP | Critical |
| `components/v2/PredictionFormV2.tsx` | Agronomic V2 form | Form for NPK, pH, soil, water, climate | React Hook Form, Radix | **A** | KEEP | Critical |
| `components/v2/PredictionResultsV2.tsx` | Agronomic V2 results | Displays ranked crops, economics, gates | Recharts, Lucide | **A** | KEEP | Critical |

### 4.4. Feature Modules (`src/components/modules/`)
| File Path | Purpose | Current Usage | Dependencies | Category | Action | Risk Level |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `CropRecommendation.tsx` | Dual-engine crop recommendation | Core dashboard feature | `PredictionFormV2`, `api.ts` | **A** | KEEP | Critical |
| `DiseaseDetection.tsx` | Gemini vision plant disease analysis | Core dashboard feature | `geminiService.ts`, `expertSupportService` | **A** | KEEP | Critical |
| `FertilizerRecommendation.tsx` | Soil NPK remediation calculator | Core dashboard feature | Lucide, Radix | **A** | KEEP | High |
| `SoilEnvironmentIntelligence.tsx` | Soil telemetry & zone moisture | Core dashboard feature | Recharts, Lucide | **A** | KEEP | High |
| `MandiPriceIntelligence.tsx` | APMC commodity market prices | Core dashboard feature | `marketPricesService.ts` | **A** | KEEP | High |
| `GovernmentSchemes.tsx` | Welfare schemes & subsidies | Core dashboard feature | `governmentSchemesService.ts` | **A** | KEEP | High |
| `ExpertConsultation.tsx` | Agronomist consultation portal | Core dashboard feature | `expertSupportService.ts` | **A** | KEEP | High |
| `WeatherAlerts.tsx` | Extreme weather & rainfall alerts | Core dashboard feature | `weatherService.ts`, NASA POWER | **A** | KEEP | High |
| `FarmIntelligence.tsx` | Unified intelligence summary | Core dashboard feature | Multiple services | **A** | KEEP | High |
| `Marketplace.tsx` | Direct farmer trading marketplace | Core dashboard feature | `marketPricesService.ts` | **A** | KEEP | Medium |
| `FarmMarket.tsx` | Farm inputs store | Core dashboard feature | Lucide | **A** | KEEP | Medium |
| `EquipmentRental.tsx` | Machinery sharing portal | Core dashboard feature | Lucide | **A** | KEEP | Medium |
| `DocumentationPage.tsx` | In-app API documentation | Core dashboard feature | Lucide, Code display | **A** | KEEP | Low |
| `HelpPage.tsx` | User FAQs & guides | Core dashboard feature | Lucide | **A** | KEEP | Low |
| `AccuracyTest.tsx` | ML model accuracy benchmark | Benchmark route `/accuracy-test` | `cropData.ts` | **A** | KEEP | Low |
| `EnhancedMarketPrices.tsx` | Pass-through wrapper (415 B) | Wraps `MandiPriceIntelligence` | `MandiPriceIntelligence.tsx` | **C** | DELETE | Very Low (Replace import with direct component) |

### 4.5. UI Library Components (`src/components/ui/` - 51 files)
- **Active (27 files):** `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `tabs.tsx`, `badge.tsx`, `dialog.tsx`, `sheet.tsx`, `toast.tsx`, `toaster.tsx`, `sonner.tsx`, `skeleton.tsx`, `switch.tsx`, `textarea.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`, `checkbox.tsx`, `progress.tsx`, `slider.tsx`, `separator.tsx`, `avatar.tsx`, `alert.tsx`, `accordion.tsx`, `toggle.tsx`, `FloatingParticles.tsx`, `FloatingShapes.tsx`.  
  *Action:* **KEEP (Category A)**
- **Unused (24 files):** `alert-dialog.tsx`, `aspect-ratio.tsx`, `breadcrumb.tsx`, `calendar.tsx`, `carousel.tsx`, `chart.tsx`, `collapsible.tsx`, `command.tsx`, `context-menu.tsx`, `drawer.tsx`, `form.tsx`, `hover-card.tsx`, `input-otp.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `popover.tsx`, `radio-group.tsx`, `resizable.tsx`, `scroll-area.tsx`, `sidebar.tsx`, `table.tsx`, `toggle-group.tsx`, `use-toast.ts` (stub).  
  *Action:* **DELETE (Category D)** — Eliminates 24 unneeded component files and enables removal of 10+ unneeded `@radix-ui/*` dependencies.

### 4.6. Services & Lib (`src/services/` & `src/lib/`)
| File Path | Purpose | Current Usage | Dependencies | Category | Action | Risk Level |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `services/geminiService.ts` | Multi-model vision pathology engine | Plant disease diagnosis (Gemini 3.5/3.8 Flash) | `@google/generative-ai` | **A** | KEEP | Critical |
| `services/farmProfileService.ts` | Cloud farm profile synchronization | Manages 5 core farm fields in Supabase | Supabase, LocalStorage | **A** | KEEP | Critical |
| `services/farmIntelligenceService.ts`| Aggregates farm metrics | Feeds FarmIntelligence module | Multiple services | **A** | KEEP | High |
| `services/expertSupportService.ts` | Agronomist support logic | Manages inquiries and consultations | In-memory & LocalStorage | **A** | KEEP | High |
| `services/governmentSchemesService.ts`| Scheme database & matching | Matches schemes to farmer profile | Static database | **A** | KEEP | High |
| `services/weatherService.ts` | Weather fetching & caching | OpenWeather/mock telemetry | Fetch API | **A** | KEEP | High |
| `services/nasaPowerService.ts` | NASA agroclimatology client | Satellite solar/rainfall telemetry | Fetch API | **A** | KEEP | Medium |
| `services/notificationService.ts` | In-app notification center | Alert dispatch and persistence | LocalStorage | **A** | KEEP | Medium |
| `services/marketPricesService.ts` | Mandi price calculations | Mandi price displays | `marketPricesConnectionService` | **A** | MERGE | High (Break circular dependency) |
| `services/marketPricesConnectionService.ts` | External mandi API connection | Mandi price fetch & trends | `marketPricesService` | **A** | MERGE | High (Consolidate into `marketPricesService.ts`) |
| `services/authService.ts` | Legacy REST auth service (2.5 KB) | **Unused** (Zero imports, AuthContext uses fetch) | None | **D** | DELETE | None |
| `services/localAuthService.ts` | Legacy local storage auth (5.7 KB) | **Unused** (Zero imports) | None | **D** | DELETE | None |
| `lib/api.ts` | Axios client for backend API | Calls `/api/v2/predict` and `/api/auth` | Axios | **A** | KEEP | High |
| `lib/predictorEngine.ts` | Client-side rule heuristics | Fallback calculations | None | **A** | KEEP | Medium |
| `lib/supabase.ts` | Supabase browser client | Handles RLS, database persistence | `@supabase/supabase-js` | **A** | KEEP | Critical |
| `lib/utils.ts` | Tailwind class merger (`cn`) | Styling utility across all UI components | `clsx`, `tailwind-merge` | **A** | KEEP | High |

---

## 5. Backend REST API Audit (`FieldWise_main/backend/`)

| File Path | Purpose | Current Usage | Dependencies | Category | Action | Risk Level |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `package.json` | Backend dependencies & scripts | Runs backend server | Express, SQLite, Supabase | **A** | KEEP | High |
| `src/server.js` | Express app initialization | Starts HTTP server on port 3001 | Express, Routes, Middleware | **A** | KEEP | Critical |
| `src/config/database.js` | SQLite DB configuration | Dual-driver DB init (`node:sqlite` / `better-sqlite3`)| SQLite | **A** | KEEP | High |
| `src/config/supabaseClient.js` | Supabase service-role client | Server-side database persistence | `@supabase/supabase-js` | **A** | KEEP | High |
| `src/config/validateEnv.js` | Environment validation | Checks JWT secret, Supabase keys | Node.js process.env | **A** | KEEP | High |
| `src/config/v2/bridgeConfig.js` | Python bridge execution bounds | Centralized paths, timeouts, buffer limits | Path | **A** | KEEP | Critical |
| `src/middleware/auth.js` | JWT verification middleware | Protects authenticated endpoints | `jsonwebtoken` | **A** | KEEP | Critical |
| `src/middleware/rateLimiter.js` | IP rate limiter | Enforces 100 req/15 min | Express | **A** | KEEP | High |
| `src/controllers/authController.js` | Legacy auth controller | User registration & login endpoints | SQLite DB, `bcryptjs` | **A** | KEEP | High |
| `src/controllers/firebaseVerifyController.js` | Single-use token handoff | Handoff creation, verification & exchange | Firebase Admin SDK | **A** | KEEP | Critical |
| `src/controllers/predictController.js` | Legacy V1 predict controller | Calls JS `predictor.js` | `model/predictor.js` | **A** | KEEP | Medium |
| `src/controllers/v2/predictController.js` | V2 Python predict controller | Calls Python bridge & Supabase persistence | `recommendationBridgeService` | **A** | KEEP | Critical |
| `src/routes/*` (5 files) | API route declarations | Declares `/api/auth`, `/api/predict`, etc. | Controllers | **A** | KEEP | Critical |
| `src/services/v2/recommendationBridgeService.js` | Child process runner | Spawns Python CLI with safety buffers | `child_process` | **A** | KEEP | Critical |
| `src/services/v2/recommendationPersistenceService.js`| Cloud persistence service | Maps engine output to Supabase | `supabaseClient` | **A** | KEEP | Critical |
| `src/tests/*` (8 files) | Comprehensive backend test suites | Validates bridge, auth, security, persistence | Node.js test runner | **A** | KEEP | Critical |
| `data/croppredict.db` | Local SQLite database file | Local user table | SQLite | **A** | KEEP | Medium |

---

## 6. Machine Learning & Model Pipeline Audit (`FieldWise_main/model/`)

| File Path | Purpose | Current Usage | Category | Action | Risk Level |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `cropDatabase.js` | 22-crop agronomic baseline data | Reference data for legacy predictor | **A** | KEEP | Medium |
| `fertilizerDatabase.js` | Fertilizer composition matrix | Reference data for fertilizer module | **A** | KEEP | Medium |
| `predictor.js` | JavaScript rule-based predictor | Used by legacy V1 predict endpoint | **A** | KEEP | Medium |
| `package.json` | Contains only `{"type": "commonjs"}` | CJS declaration | **D** | DELETE | Very Low (CJS can be declared via `.cjs` or parent) |
| `ml_pipeline/recommendation_engine/*.py` (26 files) | Active Python agronomic engine | Core calculation logic & CLI adapter | **A** | KEEP | Critical |
| `ml_pipeline/recommendation_engine/*.pyc` (25 files) | Compiled Python bytecode | Generated binaries committed accidentally | **F** | DELETE | None (Add to `.gitignore`) |
| `ml_pipeline/models/*.joblib` (5 files) | Serialized machine learning models | Active ML inference | **A** | KEEP | Critical |
| `ml_pipeline/data/*.csv` (11 files) | Agronomic reference datasets | Soil limits, rainfall tables, NPK requirements | **A** | KEEP | High |
| `ml_pipeline/scripts/*.py` (26 files) | Training and evaluation scripts | Model training, verification, calibration | **B** | KEEP | Low |
| `ml_pipeline/experiments/` (46 files) | Experiment checkpoints & trials | 32 `.joblib` trial models and CSVs | **B** | ARCHIVE | Low (Move to `archive/experiments/`) |
| `ml_pipeline/reports/` (229 files) | Milestone benchmark reports & dumps | 95 markdown files, 42 CSVs, 50 JSONs | **E** | ARCHIVE | Low (Move to `archive/ml_reports/`) |

---

## 7. Database Migrations Audit (`FieldWise_main/migrations/`)

| File Path | Purpose | Current Usage | Category | Action | Risk Level |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `V1_Baseline_Schema.sql` | Baseline DDL for farmers & profiles | Staging & production database setup | **A** | KEEP | Critical |
| `V1_Baseline_Verification_Queries.sql` | Post-migration checks for V1 | Database auditing | **B** | KEEP | Low |
| `V1_Baseline_DDL_Audit_Report.md` | DDL audit report | Reference documentation | **B** | MOVE | Low (Move to `docs/`) |
| `V2_Persistence_Migration_Final_v3.sql` | V2 persistence & foreign key constraints | Supabase `crop_predictions` schema | **A** | KEEP | Critical |
| `V2_DBA_Staging_Verification_Queries.sql` | V2 verification queries | Database auditing | **B** | KEEP | Low |
| `V2_Persistence_Rollback_Procedure.sql` | Disaster recovery rollback script | Rollback procedure | **A** | KEEP | High |
| `V3_MyFarm_CrossBrowser_Persistence_Migration.sql` | P0 My Farm schema enhancements | Supabase `farm_profiles` columns | **A** | KEEP | Critical |
| `V3_MyFarm_CrossBrowser_Verification_Queries.sql` | V3 verification queries | Database auditing | **B** | KEEP | Low |
