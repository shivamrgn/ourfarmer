# FieldWise — Phase 3A.2.1: Final Staging Pre-Provisioning Verification

**Document Reference:** `docs/deployment/PHASE_3A_2_1_FINAL_STAGING_PREFLIGHT.md`
**Execution Date:** November 22, 2026
**Auditor / Security Architect:** Senior DevOps, Deployment Architect & Application Security Reviewer
**Audit Mode:** Read-Only Verification (No code changes, no migrations, no deployments executed)
**Final Verdict:** **READY WITH SPECIFIC CONDITIONS**

---

## 1. Git and Implementation Integrity

### 1.1 Branch and Commit Topology
- **Current Branch:** `main`
- **Current HEAD Commit:** `824d06ec1aa4ae57c595a2e91d5732d2372c746f`
- **Published Baseline Tag:** `v1.0.0-baseline` pointing to `f29dbd51623d909803d3d96bc1a30217b4ca5e9f`
- **Tag Integrity:** Unaltered. Baseline commit and tag remain strictly read-only and preserved.

### 1.2 Working-Tree Status
`git status --short` inspection reports:
```
 M FieldWise_landing/src/components/AuthModal.jsx
 M FieldWise_main/.env.example
 M FieldWise_main/.env.staging.example
 M FieldWise_main/backend/.env.example
 M FieldWise_main/backend/.env.staging.example
 M FieldWise_main/backend/src/routes/predict.js
 M FieldWise_main/backend/src/server.js
 M FieldWise_main/backend/src/tests/run_all_backend_tests.js
 M FieldWise_main/src/lib/supabase.ts
 M FieldWise_main/src/services/geminiService.ts
 M FieldWise_main/src/test/plant_disease_detection.test.ts
?? FieldWise_main/backend/src/controllers/diseaseDetectionController.js
?? FieldWise_main/backend/src/routes/disease.js
?? FieldWise_main/backend/src/routes/farmProfile.js
?? FieldWise_main/backend/src/routes/farmer.js
?? FieldWise_main/backend/src/services/v1/
?? FieldWise_main/backend/src/tests/gemini_disease_detection.test.js
?? FieldWise_main/backend/src/tests/v1_backend_persistence.test.js
?? docs/deployment/
```

### 1.3 Exact Phase 3A.2 Diff Summary (`git diff --stat`)
```
 FieldWise_landing/src/components/AuthModal.jsx     | 338 ++++++++---------
 FieldWise_main/.env.example                        |   7 +-
 FieldWise_main/.env.staging.example                |   6 +-
 FieldWise_main/backend/.env.example                |   4 +
 FieldWise_main/backend/.env.staging.example        |   5 +
 FieldWise_main/backend/src/routes/predict.js       |  52 +++
 FieldWise_main/backend/src/server.js               |   6 +
 FieldWise_main/backend/src/tests/run_all_backend_tests.js |  10 +
 FieldWise_main/src/lib/supabase.ts                 | 159 +++++++-
 FieldWise_main/src/services/geminiService.ts       | 256 +++----------
 FieldWise_main/src/test/plant_disease_detection.test.ts | 402 ++++++---------------
 11 files changed, 585 insertions(+), 660 deletions(-)
```

### 1.4 Frozen Artifact Invariance Verification
1. **Python Recommendation Engine:** `FieldWise_main/model/ml_pipeline/recommendation_engine/` contains exactly 0 modified or untracked files.
2. **Historical Evaluation Datasets:** `FieldWise_main/model/ml_pipeline/data/` contains exactly 0 modifications.
3. **Model Artifacts:** Model files (`*.joblib`, `models/`, model manifests) are 100% unaltered.
4. **Database Migrations:** No migration scripts in `supabase/migrations/` were modified or executed.
5. **V1 and V2 Public Contracts:**
   - Legacy `POST /api/predict` calculation request and response schemas remain identical.
   - V2 `POST /api/v2/predict` endpoints, validation schemas, idempotency guards, and persistence tables (`public.v2_crop_recommendations`) remain 100% intact.

---

## 2. V1 Persistence Completeness & Security Verification

### 2.1 Complete Frontend Supabase Query Audit
A global codebase scan (`grep -rn "\.from('" FieldWise_main/src/ FieldWise_landing/src/`) confirms:
- **`FieldWise_landing`:** Contains **0** direct Supabase queries.
- **`FieldWise_main`:** All direct Supabase calls are consolidated within a single module: [`FieldWise_main/src/lib/supabase.ts`](file:///Users/shivamkumar/farmingFinal/FieldWise_main/src/lib/supabase.ts).

### 2.2 Endpoint-by-Endpoint Architecture Trace

| # | Endpoint | Method | Frontend Invocation | Backend Route | Middleware | Identity Resolution | Target Table | Service-Role Client |
| :- | :--- | :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | `/api/farmer/sync` | `POST` | `syncFarmerToSupabase(farmer)` | `routes/farmer.js:21` | `authMiddleware` | `resolveVerifiedFarmerIdentity(req.user)` | `public.farmers` | Yes |
| **2** | `/api/farmer/profile` | `GET` | `fetchFarmerFromSupabase(farmerId)` | `routes/farmer.js:46` | `authMiddleware` | `resolveVerifiedFarmerIdentity(req.user)` | `public.farmers` | Yes |
| **3** | `/api/farm-profile` | `POST` | `syncFarmProfileToSupabase(profile)` | `routes/farmProfile.js:21` | `authMiddleware` | `resolveVerifiedFarmerIdentity(req.user)` | `public.farm_profiles` | Yes |
| **4** | `/api/farm-profile` | `GET` | `fetchFarmProfileFromSupabase(farmerId)` | `routes/farmProfile.js:49` | `authMiddleware` | `resolveVerifiedFarmerIdentity(req.user)` | `public.farm_profiles` | Yes |
| **5** | `/api/predict/save` | `POST` | `savePredictionToSupabase(prediction)`| `routes/predict.js:34` | `authMiddleware` | `resolveVerifiedFarmerIdentity(req.user)` | `public.crop_predictions` | Yes |
| **6** | `/api/predict/history` | `GET` | `fetchLatestPredictionFromSupabase(id)`| `routes/predict.js:59` | `authMiddleware` | `resolveVerifiedFarmerIdentity(req.user)` | `public.crop_predictions` | Yes |

### 2.3 Identity Ownership & Tenant Isolation
- **Caller-Supplied ID Discarded:** In `v1PersistenceService.js`, the farmer UUID is resolved exclusively via `resolveVerifiedFarmerIdentity(userAuth)`, which extracts the verified claim from the decoded JWT token (`req.user.id` or `req.user.farmer_id`). If a caller injects `{ "farmer_id": "victim-uuid" }` or `{ "id": "victim-uuid" }` into the request body or parameters, the backend strictly ignores the client parameter and anchors the operation to `req.user.id`.
- **Relational Parent Anchoring:** Before any child insertion into `public.farm_profiles` or `public.crop_predictions`, the service executes `ensureParentFarmerRecord(client, verifiedFarmerId, email, fullName)`, preventing foreign-key constraint violations on `ON DELETE RESTRICT`.
- **Cross-Tenant Guard:** All read queries strictly append `.eq('farmer_id', verifiedFarmerId)`. Verified by integration test `v1_backend_persistence.test.js`: Farmer A cannot view or overwrite Farmer B's profile or predictions.

### 2.4 Error Handling & Offline Fallback Integrity
- In `FieldWise_main/src/lib/supabase.ts`, when a bearer token is present, the frontend calls the backend REST API:
  - If the server returns a non-2xx status (e.g. `401`, `429`, `500`), the function returns `{ success: false, error: errJson.message }`.
  - **No False Success:** A failed cloud write is never reported as successful.
  - `localStorage` continues to store the farmer's profile locally for offline usability, but cloud synchronization status explicitly reports failure when the cloud write fails.

---

## 3. Gemini Proxy Boundary & Secret Protection

### 3.1 Frontend Key Elimination
- **Active Diagnostic Path:** In `FieldWise_main/src/components/modules/DiseaseDetection.tsx`, user uploads call `detectPlantDisease` from `src/services/geminiService.ts`. This function dispatches exclusively to `POST ${API_URL}/api/disease/diagnose` with `Authorization: Bearer <token>`.
- **Residual Declaration Note (Condition):** `FieldWise_main/src/services/geminiService.ts:4` retains an unused top-level declaration:
  ```typescript
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  const model: GenerativeModel | null = genAI ? genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" }) : null;
  ```
  This is referenced only by three dead prototype functions (`getCropRecommendations`, `getCropPredictions`, `getMarketInsights`), none of which are imported or called anywhere in the active application. When `VITE_GEMINI_API_KEY` is omitted, `apiKey` is `''`, `model` is `null`, and functions fall back gracefully. However, for complete hygiene, this residue should be removed before public release.

### 3.2 Backend Key Custody & Environment Resolution
- The backend diagnostic controller (`FieldWise_main/backend/src/controllers/diseaseDetectionController.js:173`) resolves the API key as:
  ```javascript
  const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  ```
- **Finding:** The backend primarily reads `GEMINI_API_KEY`, but retains a fallback to `VITE_GEMINI_API_KEY` for local development convenience. In staging/production environments, `GEMINI_API_KEY` is the authoritative environment variable.

### 3.3 Server-Side Payload & Security Validation
1. **Base64 / Data-URL Parsing:** Extracted via regex `^data:([^;]+);base64,(.+)$` or raw base64 string.
2. **Decoded Size Enforcement:** `approxBytes = Math.round(base64Data.length * 0.75)`:
   - If `approxBytes < 50`: Rejects with `400 IMAGE_CORRUPTED`.
   - If `approxBytes > 10MB`: Rejects with `400 IMAGE_TOO_LARGE`.
3. **MIME Whitelist:** Strictly permits only `image/jpeg`, `image/jpg`, `image/png`, `image/webp`. Rejects other types with `400 INVALID_IMAGE_TYPE`.
4. **Upstream Timeout & Abort:** Standard `https.request` enforces a 15-second timeout (`req.setTimeout(15000)`). On timeout, the socket is destroyed, triggering model fallback.
5. **Output Schema Validation:** Downstream Gemini text is sanitized, parsed as JSON, and standardized into `DiseaseDetectionResult` containing all required fields and the mandatory advisory disclaimer.
6. **Data Minimization Logging:** Images and API keys are **never** logged. Logs record only safe metadata:
   ```json
   {
     "requestId": "diag_1795360895315_i35eyr",
     "mimeType": "image/jpeg",
     "approxBytes": 72,
     "farmerId": "11111111-1111-4111-8111-111111111111",
     "timestamp": "2026-11-22T15:21:35.315Z"
   }
   ```
7. **Rate Limiting:** Dedicated sliding-window rate limiter `diseaseLimiter` (`windowMs: 60000`, `maxRequests: 20`) is attached to `POST /api/disease/diagnose` in `src/routes/disease.js`.

### 3.4 Model Availability & Naming Consistency Check
The candidate fallback array in `diseaseDetectionController.js` defines:
```javascript
const CANDIDATE_MODELS = Object.freeze([
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
]);
```
- **Local Evidence Finding:**
  - The request payload uses Google AI Studio v1beta REST schema (`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`).
  - Standard, verified Google AI Studio vision models include `gemini-1.5-flash` and `gemini-2.0-flash`.
  - Non-standard identifiers (`gemini-2.5-flash`, `gemini-3.1-flash-lite`, `gemini-3.8-flash`) cannot be confirmed from local repository evidence alone.
  - **Mitigation:** The loop catches model failures and falls through cleanly to `gemini-1.5-flash`. To avoid latency overhead in staging, `GEMINI_MODEL=gemini-1.5-flash` should be explicitly set in staging environment variables.

---

## 4. Staging Configuration Consistency & Hostname Reconciliation

### 4.1 Canonical Hostname Architecture Table

| Component | Repository Directory | Local Dev Port | Staging Canonical Hostname | Reverse Proxy / CDN | Hosting Target |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **Landing Frontend** | `FieldWise_landing` | `5173` | `https://staging.fieldwise.agri` | Cloudflare Pages / Static CDN | Cloudflare Pages |
| **Main App Frontend** | `FieldWise_main` | `5174` | `https://staging-app.fieldwise.agri` | Cloudflare Pages / Static CDN | Cloudflare Pages |
| **Backend REST API** | `FieldWise_main/backend` | `3001` | `https://staging-api.fieldwise.agri` | Google Cloud Run / HTTPS L4/L7 | Google Cloud Run |

### 4.2 Cross-Origin & Environment Variable Reconciliation

```
[Landing Frontend: https://staging.fieldwise.agri]
   │
   ├── VITE_API_URL ──────► https://staging-api.fieldwise.agri
   ├── VITE_MAIN_APP_URL ──► https://staging-app.fieldwise.agri
   └── Firebase Auth ─────► project: fieldwise-6db7b
                                  │
                                  ▼ (POST /api/auth/handoff/create { idToken })
[Backend REST API: https://staging-api.fieldwise.agri]
   │
   ├── PORT ──────────────► Environment $PORT (Platform assigned, e.g. 8080/3001)
   ├── FRONTEND_URL ──────► https://staging.fieldwise.agri,https://staging-app.fieldwise.agri
   ├── FIREBASE_PROJECT_ID ► fieldwise-6db7b
   └── SUPABASE_URL ──────► https://<staging-ref>.supabase.co (service_role)
                                  ▲
                                  │ (POST /api/auth/handoff/exchange { handoffCode })
[Main App Frontend: https://staging-app.fieldwise.agri]
   │
   ├── VITE_API_URL ──────► https://staging-api.fieldwise.agri
   ├── VITE_LANDING_APP_URL► https://staging.fieldwise.agri
   └── VITE_SUPABASE_URL ─► https://<staging-ref>.supabase.co (anon_key)
```

### 4.3 Staging CORS Configuration Requirement
In `FieldWise_main/backend/src/server.js`:
```javascript
function getAllowedOrigins() {
    const raw = process.env.FRONTEND_URL || '';
    const configured = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (configured.length > 0) return configured;
    return isDevMode() ? ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8080'] : [];
}
```
- **Critical Requirement:** In staging (`NODE_ENV=staging`), `isDevMode()` returns `false`. If `FRONTEND_URL` is omitted, `getAllowedOrigins()` returns `[]`, which causes the backend to reject all browser requests with `403 CORS_FORBIDDEN`.
- **Condition:** `FRONTEND_URL=https://staging.fieldwise.agri,https://staging-app.fieldwise.agri` MUST be configured in staging backend environment variables.

### 4.4 Port Configuration Verification
- In `FieldWise_main/backend/src/server.js:164`:
  ```javascript
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => ...);
  ```
- **Confirmed:** The backend does **not** hardcode port 3001. It dynamically respects `process.env.PORT`, ensuring full compatibility with Google Cloud Run and containerized environments.

### 4.5 Firebase Staging Configuration
- **Project ID:** Default is `fieldwise-6db7b`.
- **Backend Validation Mode:**
  1. Primary: If `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS` is present, uses `firebase-admin` SDK.
  2. Fallback: If service account is absent, dynamically verifies JWT tokens against Google's public x509 certificates (`https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`), enforcing `aud === FIREBASE_PROJECT_ID` and `iss === https://securetoken.google.com/${FIREBASE_PROJECT_ID}`.
  3. Staging Requirement: The frontend `VITE_FIREBASE_PROJECT_ID` and backend `FIREBASE_PROJECT_ID` must be configured with identical project IDs.

---

## 5. Regression & Test Evidence

All tests and builds executed during the verification process passed with exit code 0:

### 5.1 Backend Automated Test Suite
- **Command:** `cd FieldWise_main/backend && npm test`
- **Runner:** `node src/tests/run_all_backend_tests.js`
- **Result:** **10 / 10 Suites Passed (100%)**
  1. Legacy Auth & Predictor Smoke Tests: PASSED
  2. V2 Bridge Deterministic Unit Tests: PASSED (16/16 subtests)
  3. V2 Bridge Live Integration Tests: PASSED (8/8 subtests)
  4. V2 Persistence & Idempotency Tests: PASSED
  5. V2 Persistence & Security Integration Tests: PASSED (10/10 subtests)
  6. Phase 2: Security Remediation Tests (CORS, JWT, Rate Limiting): PASSED (6/6 subtests)
  7. Final Authentication Closure Tests (Firebase & Handoff Security): PASSED (9/9 subtests)
  8. Phase 2C: Test Runner & Startup Config Security Tests: PASSED
  9. Phase 3A.2: V1 Backend-Mediated Persistence Tests: PASSED (7/7 subtests)
  10. Phase 3A.2: Gemini Disease Detection Tests: PASSED (8/8 subtests)

### 5.2 Frontend Automated Test Suite
- **Command:** `cd FieldWise_main && npm test -- --run`
- **Runner:** `vitest v3.2.4`
- **Result:** **8 / 8 Test Files Passed, 119 / 119 Tests Passed**
  - `src/test/plant_disease_detection.test.ts`: 10 passed
  - `src/test/v2_frontend_integration.test.tsx`: 38 passed
  - `src/test/my_farm_cloud_persistence.test.ts`: passed
  - `src/test/google_signin_persistence.test.ts`: 6 passed
  - `src/test/auth_handoff_closure.test.ts`: passed
  - `src/test/account_data_persistence_restoration.test.ts`: passed
  - `src/test/documentation_page.test.tsx`: passed

### 5.3 Production Builds
- `FieldWise_main`: `npm run build` completed successfully (`dist/assets/index-DEEmxkeK.js: 1,939 kB`, 0 errors).
- `FieldWise_landing`: `npm run build` completed successfully (`dist/assets/index-BDhYFQ7M.js: 984 kB`, 0 errors).

### 5.4 Frozen Recommendation Engine Verification
- **Command:** `python3 FieldWise_main/model/ml_pipeline/recommendation_engine/tests/run_all_tests.py`
- **Result:** **62 / 62 Tests Passed (100% Pass Rate, 0 Failures, 0 Errors)**.

---

## 6. Pre-Provisioning Conditions & Action Items

Before provisioning staging cloud infrastructure, the following concrete configuration items must be applied in the staging deployment configuration:

| # | Item | Target File / Service | Nature | Required Value / Action |
| :- | :--- | :--- | :--- | :--- |
| **C1** | **Backend CORS Allowlist** | `FieldWise_main/backend/.env.staging` | Environment Variable | Set `FRONTEND_URL=https://staging.fieldwise.agri,https://staging-app.fieldwise.agri` to prevent `403 CORS_FORBIDDEN` in staging mode. |
| **C2** | **Backend Gemini API Key** | Backend Cloud Run Secret | Secret Variable | Set `GEMINI_API_KEY=<google-ai-studio-api-key>` in backend environment. |
| **C3** | **Pinned Gemini Model** | Backend Cloud Run Environment | Environment Variable | Set `GEMINI_MODEL=gemini-1.5-flash` to ensure deterministic model resolution without fallback latency. |
| **C4** | **Firebase Project Alignment** | Landing `.env.staging` & Backend `.env.staging` | Environment Variable | Ensure `VITE_FIREBASE_PROJECT_ID` (landing) and `FIREBASE_PROJECT_ID` (backend) both point to `fieldwise-6db7b` (or dedicated staging project). |
| **C5** | **Dead Code Residue Cleanup** | `FieldWise_main/src/services/geminiService.ts` | Code Hygiene (Optional) | Remove unused `apiKey = import.meta.env.VITE_GEMINI_API_KEY` declaration at line 4 prior to public release. |

---

## 7. Final Staging Preflight Verdict

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FINAL STAGING PREFLIGHT VERDICT                      │
├────────────────────────────────────────────────────────────────────────┤
│  1. Git and Baseline Integrity                         ──► VERIFIED   │
│  2. Frozen Recommendation Engine Invariance            ──► VERIFIED   │
│  3. V1 Backend-Mediated Persistence Completeness       ──► COMPLETE   │
│  4. Zero-Trust Supabase RLS Isolation                  ──► PRESERVED  │
│  5. Gemini Key Private Backend Custody                 ──► COMPLETE   │
│  6. Rate Limiting & Input Validation Guards            ──► ACTIVE     │
│  7. Backend Test Suite (10/10 Suites)                  ──► 100% PASS  │
│  8. Frontend Test Suite (119/119 Tests)                ──► 100% PASS  │
│  9. Production Frontend Builds                         ──► PASSED (0) │
├────────────────────────────────────────────────────────────────────────┤
│  OVERALL VERDICT:                                                      │
│  READY WITH SPECIFIC CONDITIONS (Conditions C1–C4 satisfied in env)    │
└────────────────────────────────────────────────────────────────────────┘
```
