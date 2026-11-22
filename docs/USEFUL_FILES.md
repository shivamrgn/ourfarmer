# FieldWise Platform — Essential & Useful Files Reference

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-22  

---

## 1. Overview

This document serves as the authoritative architectural catalog of all **Essential (Category A)** and **Useful (Category B)** files in the FieldWise ecosystem. These files constitute the working intellectual property, runtime code, configuration, testing, and deployment assets of the platform.

---

## 2. Platform Core & Orchestration

### `dev.js`
- **Location:** `/dev.js`
- **Role:** Master development multi-process supervisor.
- **Why it matters:** Concurrently spawns the Visitor Landing (`:5173`), Main Dashboard (`:5174`), and Backend API (`:3001`), prefixing stdout/stderr with color-coded tags (`[Landing]`, `[MainApp]`, `[Backend]`) and wiring unified `SIGINT`/`SIGTERM` graceful shutdown listeners.

### `package.json` (Root)
- **Location:** `/package.json`
- **Role:** Root workspace metadata and script entry point.
- **Why it matters:** Defines the root `"npm run dev"` command used by developers and CI harnesses.

---

## 3. Visitor Portal Application (`FieldWise_landing/`)

### Core Runtime
- **`src/main.jsx`**: Bootstraps the React 19 application and injects global styling.
- **`src/App.jsx`**: Coordinates top-level view switching, authentication modals, visitor session management, and single-use handoff redirects to FieldWise_main.
- **`src/firebase.js`**: Initializes the Firebase Web SDK, wires Google Sign-In (`GoogleAuthProvider`, `signInWithPopup`), email/password authentication, and handles secure POST transmission of fresh ID tokens to `/api/auth/handoff/create`.
- **`firestore.rules`**: Authoritative Firestore security rules enforcing owner-only read/write constraints on farmer records.

### Interactive Landing Components
- **`src/components/Navbar.jsx`**: Global responsive header with login/register triggers and session detection.
- **`src/components/Hero.jsx`**: Dynamic hero section featuring primary value proposition and call-to-action.
- **`src/components/AuthModal.jsx`**: Modal dialog supporting tabbed Email/Password login, registration, and one-click Google Sign-In with real-time error banners (e.g. popup blocked, network error).
- **`src/components/DashboardPreview.jsx`**: Interactive, responsive demonstration of the FieldWise farmer dashboard embedded on the marketing page.
- **`src/components/FarmIntelligenceEngine.jsx`**: Visual breakdown of the 6 core decision intelligence pillars.
- **`src/components/RealWorldFarmData.jsx`**: Interactive demonstration of live telemetry across telemetry zones.
- **`src/components/MandiPriceIntelligence.jsx`**: Live commodity price ticker and trend preview.
- **`src/components/DataIntelligence.jsx`**: Data architecture and methodology section.
- **`src/components/FarmerSupport.jsx` & `ExpertAgriculturalSupport.jsx`**: Extension services and expert agronomist access points.
- **`src/components/WhyChooseUs.jsx`, `HowItWorks.jsx`, `FarmerJourney.jsx`, `FinalCTA.jsx`, `Footer.jsx`**: Core conversion, social proof, and informational sections.

---

## 4. Farmer Dashboard Application (`FieldWise_main/`)

### Application Shell & Providers
- **`src/main.tsx`**: Bootstraps React 18, React Query client, and strict mode.
- **`src/App.tsx`**: Configures client-side routing, theme providers, notification toast providers, and global contexts.
- **`src/context/AuthContext.tsx`**: The security nerve center of the frontend. Intercepts `?code=` query parameters, executes atomic handoff exchange with `/api/auth/handoff/exchange`, issues session JWTs, handles demo mode, and maintains synchronization with Supabase.
- **`src/context/LocationContext.tsx`**: Provides automatic geolocation (lat/long) and district resolution for localized weather and mandi price lookups.

### Dashboard Orchestration & Layout
- **`src/components/Dashboard.tsx`**: Main authenticated view controller. Manages tab switching across all 15 operational feature modules.
- **`src/components/dashboard/DashboardHeader.tsx`**: Top navigation displaying active farmer profile, location selector, notification bell, theme toggle, and logout button.
- **`src/components/dashboard/DashboardSidebar.tsx`**: Desktop collapsible navigation sidebar grouping modules into categorized sections.
- **`src/components/dashboard/DashboardMainContent.tsx`**: Dynamic viewport rendering the currently active feature module.
- **`src/components/dashboard/DashboardFooter.tsx`**: Platform footer with system telemetry and support links.
- **`src/components/dashboard/WeatherContext.tsx`**: Real-time agroclimatic state provider integrating NASA POWER and OpenWeather APIs.

### Feature Modules
- **`src/components/modules/CropRecommendation.tsx`**: Dual-engine crop selector supporting Legacy V1 (fast heuristic) and Agronomic V2 (multi-factor scientific recommendation engine).
- **`src/components/modules/DiseaseDetection.tsx`**: Real multimodal vision plant pathology system powered by Google Gemini 3.5/3.8 Flash. Validates leaf photos, rejects non-plant images, flags blurry photos, and provides curative remedies.
- **`src/components/modules/FertilizerRecommendation.tsx`**: Precision NPK deficit calculator delivering organic and chemical fertilizer remediation schedules.
- **`src/components/modules/SoilEnvironmentIntelligence.tsx`**: Telemetry visualizer for soil moisture, temperature, pH, and conductivity across multiple zones.
- **`src/components/modules/MandiPriceIntelligence.tsx`**: Comprehensive APMC mandi price tracking, historical commodity trends, and nearest market arrival forecasts.
- **`src/components/modules/GovernmentSchemes.tsx`**: Searchable catalog and qualification matcher for state and central agricultural schemes.
- **`src/components/modules/ExpertConsultation.tsx`**: Booking and inquiry portal for connecting farmers with agricultural scientists and extension specialists.
- **`src/components/modules/WeatherAlerts.tsx`**: Extreme agroclimatic advisory engine (frost, drought, monsoon timing).
- **`src/components/modules/Marketplace.tsx`**: Farmer-to-farmer trade marketplace for surplus harvest and equipment.
- **`src/components/modules/FarmMarket.tsx`**: Certified seed, fertilizer, and biological input catalog.
- **`src/components/modules/EquipmentRental.tsx`**: Tractor, harvester, and drone rental coordination engine.
- **`src/components/modules/DocumentationPage.tsx`**: In-app developer and API integration reference.
- **`src/components/modules/HelpPage.tsx`**: Knowledgebase and farmer FAQ center.
- **`src/components/modules/AccuracyTest.tsx`**: Agronomic model validation harness evaluating cross-validated prediction accuracy.

### V2 Prediction Components
- **`src/components/v2/PredictionFormV2.tsx`**: 1100-line comprehensive input form for soil chemistry, water availability, climate, and irrigation type.
- **`src/components/v2/PredictionResultsV2.tsx`**: Rich presentation component rendering crop suitability ranking cards, economic ROI analysis, and agronomic gate provenance.

### Core Services
- **`src/services/geminiService.ts`**: Multi-model vision pipeline (`gemini-3.5-flash`, `gemini-3.8-flash`, `gemini-3.1-flash-lite`, `gemini-2.5-flash`) with structured JSON schema enforcement and timeout controls.
- **`src/services/farmProfileService.ts`**: Bi-directional cloud synchronization service ensuring all 5 My Farm fields (Village, Land Identifier, Current Crops, Crop Rotation History, Agro-Climatic Zone) persist in Supabase under the verified Firebase UID.
- **`src/services/farmIntelligenceService.ts`**: Aggregation engine consolidating metrics across weather, soil, mandi rates, and schemes.
- **`src/services/expertSupportService.ts`**: Manages agronomist inquiry submission, history tracking, and contact directories.
- **`src/services/governmentSchemesService.ts`**: In-memory scheme repository and profile matching algorithm.
- **`src/services/weatherService.ts`**: Multi-provider meteorological client with in-memory caching and fallback telemetry.
- **`src/services/nasaPowerService.ts`**: Direct client for NASA POWER Agroclimatology REST APIs.
- **`src/services/notificationService.ts`**: Event-driven notification bus managing user alerts with local persistence.
- **`src/services/marketPricesService.ts`**: Commodity pricing calculations, trends, and market statistics.

---

## 5. Backend REST API (`FieldWise_main/backend/`)

### Infrastructure & Configuration
- **`src/server.js`**: Express server bootstrapping, middleware mounting, security headers, CORS allowlist, and route registration on port 3001.
- **`src/config/database.js`**: Resilient SQLite configuration utilizing Node 22 native `node:sqlite` with automatic fallback to `better-sqlite3`.
- **`src/config/supabaseClient.js`**: Privileged service-role Supabase client for server-side persistence.
- **`src/config/v2/bridgeConfig.js`**: Immutable configuration for the Python recommendation engine CLI (buffer limits, timeouts, paths).
- **`src/middleware/auth.js`**: JWT authentication middleware enforcing valid HMAC-SHA256 signatures and expiration.
- **`src/middleware/rateLimiter.js`**: Sliding window rate limiting protecting endpoints against brute-force attacks.

### API Controllers & Services
- **`src/controllers/firebaseVerifyController.js`**: Handles single-use handoff code generation, cryptographic random code generation, verification, and exchange.
- **`src/controllers/v2/predictController.js`**: V2 endpoint invoking the Python engine bridge and persisting results to Supabase.
- **`src/services/v2/recommendationBridgeService.js`**: Robust child process manager spawning Python with independent stdout/stderr buffer management and timeout enforcement.
- **`src/services/v2/recommendationPersistenceService.js`**: Cloud persistence service saving predictions and upserting parent farmer records.

---

## 6. Machine Learning Engine & Database Migrations

### Agronomic Engine
- **`model/ml_pipeline/recommendation_engine/adapter_cli.py`**: Official CLI interface connecting the Node.js backend to the Python recommendation engine.
- **`model/ml_pipeline/recommendation_engine/*.py`**: Scientific Python modules evaluating thermal boundaries, water safety, soil pH, and economic viability.
- **`model/ml_pipeline/models/*.joblib`**: Production trained Random Forest and XGBoost model artifacts.
- **`model/ml_pipeline/data/*.csv`**: Reference agronomic datasets (crop water requirements, NPK uptake tables, district rainfall data).

### Database Migrations
- **`migrations/V1_Baseline_Schema.sql`**: Baseline DDL creating `farmers`, `farm_profiles`, and `crop_predictions` tables with RLS.
- **`migrations/V2_Persistence_Migration_Final_v3.sql`**: Production V2 migration creating foreign key constraints and prediction persistence schemas.
- **`migrations/V3_MyFarm_CrossBrowser_Persistence_Migration.sql`**: P0 schema enhancement adding village, land identifier, current crops, rotation history, and agro-climatic zone columns.
