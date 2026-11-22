# FieldWise — Phase 3A.2: Staging Blocker Remediation Report

**Document Reference:** `docs/deployment/PHASE_3A_2_STAGING_BLOCKER_REMEDIATION.md`  
**Execution Date:** November 22, 2026  
**Auditor / Security Architect:** Senior DevOps & Security Reviewer  
**Status:** COMPLETE & VERIFIED  
**Deployment Verdict:** READY FOR PRIVATE STAGING PROVISIONING  

---

## 1. Executive Summary

During Phase 3A.1, a thorough security audit uncovered two critical application-level blockers preventing safe staging deployment:
1. **V1 Direct-to-Browser Supabase Access:** Frontend services (`src/lib/supabase.ts`) performed direct queries against `public.farmers`, `public.farm_profiles`, and `public.crop_predictions` using the browser's `anonKey`. Under the migration package's hardened zero-trust posture, direct access is completely revoked from `anon` and `authenticated` roles, causing silent write failures in production/staging environments.
2. **Gemini Vision API Key Exposure:** Plant leaf disease detection in `src/services/geminiService.ts` called Google Gemini API directly from the browser using `VITE_GEMINI_API_KEY`, exposing a sensitive, high-value AI Studio API key in public client bundles without rate limiting, server-side payload validation, or backend authorization.

### Remediation Objectives & Results
Both blockers have been fully resolved with zero architectural compromise:
- **Zero-Trust Database Security Preserved:** No database permissions were granted to `anon`, `authenticated`, or `public`. Table grants remain strictly restricted to `service_role`.
- **Backend-Mediated V1 Persistence:** 6 new authenticated Express endpoints deployed under `/api/farm-profile`, `/api/farmer`, and `/api/predict`.
- **Protected Multimodal AI Diagnostic Proxy:** Gemini Vision calls moved behind `/api/disease/diagnose` with server-side API key custody, sliding-window rate limiting, input validation, and metadata-only logging.
- **Strict Tenant & Identity Isolation:** Farmer identity is anchored strictly to verified JWT claims (`req.user.id`). Any client-supplied ID in body/params is discarded.
- **Preserved System Integrity:** The frozen Python recommendation engine, datasets, models, V1/V2 public contracts, and existing frontend UI workflows remain 100% intact.

---

## 2. Architecture & Implementation Remediation

### 2.1 Task 1 — V1 Backend-Mediated Persistence

#### A. Dedicated Backend Service & Routes
A new backend service `v1PersistenceService.js` and three router modules were created to proxy all V1 persistence operations through the backend `service_role` Supabase client:

| HTTP Method | Route Endpoint | Middleware | Handler / Service Function | Table Target | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/farmer/sync` | `authMiddleware` | `v1PersistenceService.syncFarmer` | `public.farmers` | Anchors farmer identity and updates profile details |
| `GET` | `/api/farmer/profile` | `authMiddleware` | `v1PersistenceService.getFarmer` | `public.farmers` | Fetches authenticated farmer record |
| `POST` | `/api/farm-profile` | `authMiddleware` | `v1PersistenceService.saveFarmProfile` | `public.farm_profiles` | Upserts farm profile attributes with parent verification |
| `GET` | `/api/farm-profile` | `authMiddleware` | `v1PersistenceService.getFarmProfile` | `public.farm_profiles` | Fetches authenticated farmer's latest farm profile |
| `POST` | `/api/predict/save` | `authMiddleware` | `v1PersistenceService.saveCropPrediction` | `public.crop_predictions` | Records prediction to historical ledger |
| `GET` | `/api/predict/history` | `authMiddleware` | `v1PersistenceService.getCropPredictionHistory` | `public.crop_predictions` | Fetches authenticated farmer's historical predictions |

#### B. Security & Identity Invariants
1. **Verified Server-Side Identity (`req.user.id`):** Identity is derived exclusively from the verified JWT payload parsed by `authMiddleware`. If an attacker passes `{ "farmer_id": "victim-uuid" }` or `{ "farmerId": "victim-uuid" }` in the request body, the server completely ignores the client parameter and anchors the operation strictly to `req.user.id`.
2. **Foreign-Key Parent Anchoring (`ensureParentFarmerRecord`):** Child table inserts into `public.farm_profiles` and `public.crop_predictions` depend on foreign key constraints (`ON DELETE RESTRICT`). `v1PersistenceService` invokes `ensureParentFarmerRecord(client, verifiedFarmerId, email, fullName)` before every write, guaranteeing the relational parent exists without collision.
3. **Cross-Tenant Isolation:** All queries filter strictly by `eq('farmer_id', verifiedFarmerId)`. Farmer A cannot read or overwrite Farmer B's farm profile, farmer details, or prediction history.
4. **Offline Resilience & Error Reporting:** Frontend service `src/lib/supabase.ts` was updated to send requests to the backend with Bearer token authentication. If the cloud request fails, an explicit error is returned to the caller; `localStorage` continues to store local state as an offline fallback, but cloud sync failure is never silently masked as a success.

---

### 2.2 Task 2 — Gemini Disease-Detection Key Protection

#### A. Dedicated AI Diagnostic Proxy Endpoint
A new authenticated diagnostic proxy was deployed at `POST /api/disease/diagnose` via `diseaseDetectionController.js` and `routes/disease.js`:

```
[Browser Client]
       │
       │ (1) POST /api/disease/diagnose
       │     Authorization: Bearer <JWT>
       │     Body: { image: base64/dataURL, mimeType, fileName }
       ▼
[Express Backend Server]
       │ ── (2) authMiddleware verifies JWT
       │ ── (3) diseaseLimiter enforces 20 req/min
       │ ── (4) validateImageInput checks MIME (JPEG/PNG/WEBP) & size (50B–10MB)
       │ ── (5) Metadata-only logging (approxBytes, requestId, mimeType)
       │ ── (6) Dispatches via native HTTPS with server GEMINI_API_KEY
       ▼
[Google Gemini Vision API (Google AI Studio)]
       │
       ▼ (7) Validated JSON output + advisory disclaimer
[Express Backend Server] ──► [Browser Client]
```

#### B. Operational & Security Features
1. **Zero Client-Side Key Exposure:** `VITE_GEMINI_API_KEY` is completely removed from frontend client builds. `GEMINI_API_KEY` is held strictly in the backend server environment. If `GEMINI_API_KEY` is missing on the server, the endpoint fails gracefully with HTTP `503 GEMINI_NOT_CONFIGURED`.
2. **Strict Server-Side Input Validation:**
   - Image presence: Rejects missing payload with HTTP `400 IMAGE_REQUIRED`.
   - MIME Type: Rejects non-image formats (e.g. GIF, PDF, SVG) with HTTP `400 INVALID_IMAGE_TYPE`. Allowed: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`.
   - Payload size: Rejects corrupt/undersized payloads (< 50 bytes) with HTTP `400 IMAGE_CORRUPTED` and oversized payloads (> 10MB) with HTTP `400 IMAGE_TOO_LARGE`.
3. **Privacy & Data Minimization:** Full base64 image strings and API keys are never logged. The backend logs only safe metadata: `requestId`, `mimeType`, `approxBytes`, `farmerId`, and `timestamp`.
4. **Model Resilience & Timeout Guard:** Employs an ordered candidate model fallback sequence (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-3.1-flash-lite`, `gemini-3.8-flash`) with a 15-second upstream timeout guard.
5. **Rate Limiting:** Dedicated in-memory sliding-window rate limiter enforces a limit of 20 requests per minute per IP/user (`HTTP 429`).
6. **Mandatory Advisory Disclaimer:** Every diagnostic response attaches an explicit advisory disclaimer:
   > *"FieldWise AI diagnostics are advisory recommendations based on visual pattern matching. Always consult a certified local agronomist before applying chemical treatments."*

---

## 3. Files Created & Modified

### Backend Modules (`FieldWise_main/backend/`)
- `src/services/v1/v1PersistenceService.js`: (Created) Complete server-side V1 persistence service with foreign-key parent verification, service-role client access, and cross-tenant filtering.
- `src/controllers/diseaseDetectionController.js`: (Created) Multimodal Gemini Vision diagnostic proxy with input validation, candidate fallback, and test dispatcher hooks.
- `src/routes/farmProfile.js`: (Created) Authenticated routes for `POST /api/farm-profile` and `GET /api/farm-profile`.
- `src/routes/farmer.js`: (Created) Authenticated routes for `POST /api/farmer/sync` and `GET /api/farmer/profile`.
- `src/routes/disease.js`: (Created) Protected route `POST /api/disease/diagnose` with 20 req/min rate limiter.
- `src/routes/predict.js`: (Modified) Added authenticated endpoints `POST /api/predict/save` and `GET /api/predict/history` while preserving legacy `POST /api/predict`.
- `src/server.js`: (Modified) Mounted `/api/farm-profile`, `/api/farmer`, and `/api/disease`.
- `src/tests/v1_backend_persistence.test.js`: (Created) 7 comprehensive integration tests for V1 persistence endpoints.
- `src/tests/gemini_disease_detection.test.js`: (Created) 8 comprehensive tests for AI diagnostics, validation, rate limiting, and key protection.
- `src/tests/run_all_backend_tests.js`: (Modified) Registered the 2 new test suites.

### Frontend Modules (`FieldWise_main/`)
- `src/lib/supabase.ts`: (Modified) Updated V1 persistence functions (`syncFarmerToSupabase`, `syncFarmProfileToSupabase`, `fetchFarmerFromSupabase`, `fetchFarmProfileFromSupabase`, `savePredictionToSupabase`, `fetchLatestPredictionFromSupabase`) to call authenticated backend endpoints.
- `src/services/geminiService.ts`: (Modified) Replaced direct Google Generative AI SDK calls with authenticated `fetch` calls to `/api/disease/diagnose`. Removed client-side `VITE_GEMINI_API_KEY` requirement.
- `src/test/plant_disease_detection.test.ts`: (Modified) Updated all 10 diagnostic unit tests to verify backend proxy communication, authentication requirements, input normalization, and error handling.

### Environment Templates
- `FieldWise_main/.env.example` & `.env.staging.example`: Documented removal of `VITE_GEMINI_API_KEY` from client bundles.
- `FieldWise_main/backend/.env.example` & `.env.staging.example`: Added `GEMINI_API_KEY` specification.

---

## 4. Verification & Test Evidence

### 4.1 Backend Test Suite (All 10 Suites Passed)
Command: `cd FieldWise_main/backend && npm test`
```
================================================================================
FieldWise Phase 3C.6.2.2: Unified Backend Test Execution Suite
================================================================================
▶ Running: Legacy Auth & Predictor Smoke Tests (src/tests/auth.test.js)...
✔ Legacy Auth & Predictor Smoke Tests: PASSED

▶ Running: V2 Bridge Deterministic Unit Tests (Mock Child Process) (src/tests/v2_bridge_unit.test.js)...
✔ V2 Bridge Deterministic Unit Tests: PASSED

▶ Running: V2 Bridge Live Integration Tests (Live Express & Python Adapter) (src/tests/v2_bridge_integration.test.js)...
✔ V2 Bridge Live Integration Tests: PASSED

▶ Running: V2 Persistence & Idempotency Tests (src/tests/v2_persistence_idempotency.test.js)...
✔ V2 Persistence & Idempotency Tests: PASSED

▶ Running: V2 Persistence & Security Integration Tests (src/tests/v2_persistence_integration.test.js)...
✔ V2 Persistence & Security Integration Tests: PASSED

▶ Running: Phase 2: Security Remediation Tests (CORS, JWT, Rate Limiting) (src/tests/security_remediation.test.js)...
✔ Phase 2: Security Remediation Tests: PASSED

▶ Running: Final Authentication Closure Tests (Firebase & Handoff Security) (src/tests/firebase_handoff_security.test.js)...
✔ Final Authentication Closure Tests: PASSED

▶ Running: Phase 2C: Test Runner & Startup Config Security Tests (src/tests/backend_config_security.test.js)...
✔ Phase 2C: Test Runner & Startup Config Security Tests: PASSED

▶ Running: Phase 3A.2: V1 Backend-Mediated Persistence Tests (src/tests/v1_backend_persistence.test.js)...
  ✔ 1. Unauthenticated requests to V1 persistence endpoints are rejected with 401
  ✔ 2. Farmer sync successfully anchors record in public.farmers
  ✔ 3. Farm profile save and fetch correctly persists under authenticated farmer identity
  ✔ 4. Client-supplied farmer_id in body is completely ignored and overridden by JWT
  ✔ 5. Cross-tenant isolation: Farmer A cannot view Farmer B farm profile or prediction history
  ✔ 6. POST /api/predict/save records prediction to ledger with parent anchoring
  ✔ 7. Backward compatibility: POST /api/predict computes crop recommendation without breaking
✔ Phase 3A.2: V1 Backend-Mediated Persistence Tests: PASSED

▶ Running: Phase 3A.2: Gemini Disease Detection Tests (src/tests/gemini_disease_detection.test.js)...
  ✔ 1. Unauthenticated request to /api/disease/diagnose returns 401
  ✔ 2. Missing image payload returns 400 IMAGE_REQUIRED
  ✔ 3. Unsupported MIME type returns 400 INVALID_IMAGE_TYPE
  ✔ 4. Undersized (<50 bytes) image returns 400 IMAGE_CORRUPTED
  ✔ 5. Missing GEMINI_API_KEY on server returns 503 GEMINI_NOT_CONFIGURED
  ✔ 6. Successful diagnosis returns 200 with standardized diagnosis and advisory disclaimer
  ✔ 7. Upstream AI failure returns 502 UPSTREAM_AI_ERROR
  ✔ 8. Rate limiter restricts excessive rapid diagnostic requests
✔ Phase 3A.2: Gemini Disease Detection Tests: PASSED

================================================================================
Backend Test Summary: 10/10 Suites Passed (Exit Code 0)
================================================================================
🎉 All backend tests executed cleanly and successfully!
```

### 4.2 Frontend Test Suite (All 8 Suites, 119 Tests Passed)
Command: `cd FieldWise_main && npm test -- --run`
```
 Test Files  8 passed (8)
      Tests  119 passed (119)
   Duration  8.81s
```
Includes:
- `src/test/plant_disease_detection.test.ts`: Passed (10 tests)
- `src/test/v2_frontend_integration.test.tsx`: Passed (38 tests)
- `src/test/my_farm_cloud_persistence.test.ts`: Passed
- `src/test/google_signin_persistence.test.ts`: Passed (6 tests)
- `src/test/auth_handoff_closure.test.ts`: Passed
- `src/test/account_data_persistence_restoration.test.ts`: Passed
- `src/test/documentation_page.test.tsx`: Passed

### 4.3 Python Recommendation Engine Suite
Command: `python3 FieldWise_main/model/ml_pipeline/recommendation_engine/tests/run_all_tests.py`
- 62/62 unit & regression tests passed.
- Frozen recommendation engine and models remain completely unaltered.

---

## 5. Staging Environment Configuration Requirements

To complete staging provisioning, configure the following environment variables:

### 5.1 Backend Service Environment (`FieldWise_main/backend/.env.staging`)
```bash
# Server Port & Runtime Mode
PORT=3001
NODE_ENV=staging

# Authentication Secret (Generate with: openssl rand -base64 32)
JWT_SECRET=<staging-jwt-secret>
JWT_EXPIRES_IN=7d

# Supabase Staging Project Reference
SUPABASE_URL=https://<staging-ref>.supabase.co
# Privileged Service Role Key (Bypasses RLS on public tables)
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>

# Google Gemini API Key (Multimodal plant leaf pathology)
GEMINI_API_KEY=<staging-google-ai-studio-api-key>

# Feature Switches
ENABLE_V2_CLOUD_PERSISTENCE=true
```

### 5.2 Frontend Client Environments (`FieldWise_main/.env.staging` & `FieldWise_landing/.env.staging`)
```bash
# Backend REST API Target
VITE_API_URL=https://staging-api.fieldwise.agri

# Cross-Application Navigation Target
VITE_LANDING_APP_URL=https://staging.fieldwise.agri
VITE_MAIN_APP_URL=https://staging-app.fieldwise.agri

# Supabase Public Reference (Anon key only)
VITE_SUPABASE_URL=https://<staging-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<staging-anon-key>

# NOTE: VITE_GEMINI_API_KEY is NO LONGER NEEDED in client environments.
```

---

## 6. Staging Deployment Verdict

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PHASE 3A.2 REMEDIATION AUDIT VERDICT                  │
├────────────────────────────────────────────────────────────────────────┤
│  Blocker 1: V1 Direct-to-Browser Supabase RLS Bypass   ──► RESOLVED   │
│  Blocker 2: Gemini AI Studio Key Client Exposure       ──► RESOLVED   │
│  Cross-Tenant Isolation & Identity Ownership Guard     ──► VERIFIED   │
│  Backend Test Suites Passing                           ──► 10/10      │
│  Frontend Test Suites Passing                          ──► 8/8 (119T) │
│  Python Recommendation Engine Invariance               ──► 62/62 PASS │
├────────────────────────────────────────────────────────────────────────┤
│  FINAL STAGING READINESS VERDICT:                      ──► READY      │
└────────────────────────────────────────────────────────────────────────┘
```
The application code and security boundaries are fully hardened and prepared for private staging provisioning.
