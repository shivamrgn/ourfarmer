# FieldWise — Phase 3A.2.2: Final Deployment Hygiene and Staging Configuration Closure

## Executive Summary

Phase 3A.2.2 completes the final deployment hygiene remediation and staging configuration closure for FieldWise before any infrastructure is provisioned or code is deployed to cloud environments.

This phase strictly eliminates client-side Gemini API key exposure, hardens backend image validation and timeout handling, fixes Gemini model configuration, aligns frontend/backend staging environment profiles (including Firebase project scoping and CORS allowlists), and validates the entire test suite and production builds across all services.

No cloud resources were provisioned, no database migrations were executed, no database table privileges were granted to `anon` or `authenticated` roles, and the frozen Python recommendation engine (`v1.0.0-baseline`) remained completely untouched.

---

## 1. Inventory of Files Changed & Architectural Rationale

| File Path | Action | Architectural Rationale |
| :--- | :--- | :--- |
| `FieldWise_main/src/services/geminiService.ts` | **Refactored / Cleaned** | Purged dead prototype functions (`getCropRecommendations`, `getCropPredictions`, `getMarketInsights` and mock fallback generators) and removed `@google/generative-ai` direct SDK usage and `VITE_GEMINI_API_KEY`. Retained strictly browser-side payload preparation, client MIME validation, and authenticated proxy call to `POST /api/disease/diagnose`. |
| `FieldWise_main/.env.example` | **Updated** | Removed obsolete `VITE_GEMINI_API_KEY` comment/placeholder. Documented that Gemini API keys are strictly backend secrets. |
| `FieldWise_main/.env.staging.example` | **Updated** | Removed obsolete `VITE_GEMINI_API_KEY`. Added staging backend URL and Firebase staging configuration placeholders. |
| `FieldWise_landing/.env.staging.example` | **Created** | Provided staging environment template for the landing application with dedicated Firebase staging project ID, `VITE_MAIN_APP_URL`, and `VITE_API_URL`. |
| `FieldWise_main/backend/.env.example` | **Updated** | Added `GEMINI_MODEL=gemini-1.5-flash`, documented `GEMINI_API_KEY` requirement and CORS configuration. |
| `FieldWise_main/backend/.env.staging.example` | **Updated** | Added staging configuration template including `FRONTEND_URL` (mandatory for CORS allowlist), `FIREBASE_PROJECT_ID`, `GEMINI_MODEL`, `GEMINI_API_KEY`, and per-instance rate limiter operational notes. |
| `FieldWise_main/backend/src/controllers/diseaseDetectionController.js` | **Hardened** | Enforced backend-only `GEMINI_API_KEY` (removed `VITE_GEMINI_API_KEY` fallback). Added base64 syntax validation, decoded byte length enforcement (50B to 10MB), binary magic byte signature verification (JPEG, PNG, WEBP), model configurability via `GEMINI_MODEL`, 10s per-model abortable timeout, and 25s cumulative request budget. |
| `FieldWise_main/backend/src/tests/gemini_disease_detection.test.js` | **Expanded** | Comprehensive unit test suite (10 tests) verifying binary magic bytes, corrupted base64 rejection, size bounds, timeout aborts, and strict rejection of frontend API keys. |
| `FieldWise_main/src/test/plant_disease_detection.test.ts` | **Updated** | Updated frontend unit tests to match cleaned client-side contract (verifying payload formatting, backend proxy delegation, and zero direct API key usage). |
| `FieldWise_landing/src/components/AuthModal.jsx` | **Restored to Clean HEAD** | Restored accidental formatting/placeholder edit from index, ensuring zero unintended diff in landing application. |

---

## 2. Gemini API Key Elimination & Backend Proxy Custody

### 2.1 Complete Frontend Key Removal
- **Direct Client SDK Purge:** The package `@google/generative-ai` is no longer imported or called within `FieldWise_main/src/services/geminiService.ts`.
- **Environment Variable Scrutiny:** All occurrences of `VITE_GEMINI_API_KEY` were eliminated from frontend code and configuration templates. A global repository search confirms zero active references in frontend source.
- **Dead Prototype Removal:** Dead prototype functions (`getCropRecommendations`, `getCropPredictions`, `getMarketInsights` along with mock fallback generators) that previously attempted browser-side Gemini calls were deleted.

### 2.2 Backend Strict Custody
- In `FieldWise_main/backend/src/controllers/diseaseDetectionController.js`, API key resolution was changed to:
  ```javascript
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'DISEASE_SERVICE_UNAVAILABLE',
      message: 'Plant disease detection service is temporarily unavailable.'
    });
  }
  ```
  The legacy fallback to `process.env.VITE_GEMINI_API_KEY` was completely removed.
- Tests confirm that setting `VITE_GEMINI_API_KEY` without `GEMINI_API_KEY` results in HTTP 503 `DISEASE_SERVICE_UNAVAILABLE`, proving no reliance on frontend key names.

---

## 3. Backend Image Validation & Timeout Hardening

The endpoint `POST /api/disease/diagnose` was audited and hardened with defence-in-depth image inspection:

### 3.1 Base64 Syntax & Decoded Byte Length
- **Syntax Check:** Verified data URL syntax and raw base64 regex matching (`/^[A-Za-z0-9+/]+={0,2}$/`).
- **Decoded Length:** Buffer decoding via `Buffer.from(base64Data, 'base64')` verifies that actual decoded binary length falls strictly within:
  - Minimum: **50 bytes** (rejects degenerate strings and empty stubs).
  - Maximum: **10 MB** (`10 * 1024 * 1024` bytes).

### 3.2 Binary Magic Byte Signature Inspection
To prevent non-image binary files or deceptive MIME headers from reaching upstream Google APIs, `detectImageFormat` inspects binary headers:
- **JPEG:** First 3 bytes must match `0xFF 0xD8 0xFF`.
- **PNG:** First 8 bytes must match `0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`.
- **WEBP:** Bytes 0–3 match `RIFF` and bytes 8–11 match `WEBP`.
- Any non-matching payload (such as plaintext, executable, or corrupted headers) is rejected immediately with HTTP 400 `INVALID_IMAGE_PAYLOAD`.

### 3.3 Socket & Cumulative Timeout Budget
- **Per-Model Abortable Timeout:** `PER_MODEL_TIMEOUT_MS = 10000` (10 seconds). Each upstream call to the Google Generative Language API uses an `AbortController` signal and explicitly destroys the underlying HTTPS socket on timeout.
- **Overall Request Budget:** `OVERALL_TIMEOUT_MS = 25000` (25 seconds). The controller tracks cumulative elapsed time; if attempting a fallback model would exceed the cumulative budget, fallback is aborted immediately, returning a clean timeout error to the client.
- **Zero Content Logging:** Raw image buffers, base64 strings, and API keys are strictly excluded from console logs and audit trails.

---

## 4. Gemini Model Configuration & Staging Acceptance Requirement

### 4.1 Configuration
- Primary model: Configured via backend environment variable `GEMINI_MODEL`, defaulting to `gemini-1.5-flash`.
- Secondary fallback model: `gemini-2.0-flash` (used only if primary fails due to transient 5xx/429 errors and overall budget permits).
- In staging, `GEMINI_MODEL=gemini-1.5-flash` is declared in `FieldWise_main/backend/.env.staging.example`.

### 4.2 Staging Acceptance Requirement
- **Requirement:** Because unit test environments mock external Google AI Studio network requests, live authenticated image diagnosis against the Google Gemini API must be conducted during private staging acceptance testing using a real test leaf image.

---

## 5. Firebase & Deployment Configuration Alignment

### 5.1 Project Scoping & Isolation
- Staging must use an independent Firebase project (e.g. `fieldwise-staging-<project-id>`). Production credentials must never be reused in staging.
- `FieldWise_landing/.env.staging.example` and `FieldWise_main/.env.staging.example` require identical `VITE_FIREBASE_PROJECT_ID` values.
- `FieldWise_main/backend/.env.staging.example` configures `FIREBASE_PROJECT_ID` matching the frontend projects so that backend JWT token verification targets the staging project's issuer.
- Firebase Console Authorized Domains must include:
  - `staging.fieldwise.agri`
  - `staging-app.fieldwise.agri`

### 5.2 Backend CORS Allowlist in Staging
- When `NODE_ENV=staging`, Express runs with `isDevMode() = false`.
- If `FRONTEND_URL` is omitted, the CORS allowlist is empty, causing CORS rejections.
- In `backend/.env.staging.example`, `FRONTEND_URL` is explicitly set to:
  `https://staging.fieldwise.agri,https://staging-app.fieldwise.agri`.

### 5.3 In-Memory Rate Limiting Operational Context
- Express rate limiters (`express-rate-limit`) currently use the default in-memory store.
- **Operational Reality:** On Google Cloud Run, rate limits are enforced per container instance, not globally across scaled instances. This is acceptable for private staging testing; for multi-instance production, a Redis/Valkey store will be introduced.

---

## 6. Verification & Test Execution Results

All verification suites were run against the updated codebase:

| Component | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Backend Test Suite** | `npm test` in `FieldWise_main/backend` | **PASS** (Exit 0) | 10 test suites passed (V1 backend persistence, Gemini proxy hardening, rate limits, CORS, JWT auth, V2 predict). |
| **Frontend Unit Tests** | `npm test -- --run` in `FieldWise_main` | **PASS** (Exit 0) | 8 test suites passed, 119 tests passed (plant disease detection, V2 frontend integration, form validation, routing). |
| **Python Recommendation Engine** | `python3 run_all_tests.py` | **PASS** (Exit 0) | 62 unit and regression tests passed; recommendation model and evaluation benchmarks frozen. |
| **Main App Build** | `npm run build` in `FieldWise_main` | **PASS** (Exit 0) | Production Vite bundle compiled cleanly with TypeScript validation. |
| **Landing App Build** | `npm run build` in `FieldWise_landing` | **PASS** (Exit 0) | Production Vite bundle compiled cleanly. |

---

## 7. Baseline and Security Immutability Confirmation

- **Baseline Tag:** `v1.0.0-baseline` remains pinned to commit `f29dbd51623d909803d3d96bc1a30217b4ca5e9f`.
- **Database Schema & RLS:** No changes made to SQL migrations. All Supabase table privileges remain revoked from `anon` and `authenticated`.
- **Frozen Python Engine:** No changes made to `recommendation_engine/`, model artifacts, or training data.
- **Git Branch:** Work is staged on `main`.
