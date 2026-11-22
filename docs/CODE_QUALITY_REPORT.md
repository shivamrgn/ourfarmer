# FieldWise Platform — Deep Code Quality & Architecture Audit

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-22  

---

## 1. Executive Summary

This report presents an in-depth code quality assessment across the FieldWise codebase. While the core algorithms (Gemini multimodal vision pathology, Python recommendation engine CLI, Firebase token handoff, and Supabase RLS persistence) are functionally robust and comprehensively tested, several architectural, maintainability, and code quality issues require remediation.

### Critical Quality Indicators
- **Circular Dependencies:** 1 detected cycle between core frontend services.
- **Monolithic Components:** 7 frontend files exceed 1,000 lines of code.
- **Code Duplication:** High duplication between Landing Dashboard and Preview; duplicate QA files.
- **Dead Code Surface:** 24 unused UI components and 10 detached page/component files.
- **CSS Architecture:** 19 isolated `.css` files in `FieldWise_landing` without scoped modules or design token sharing.
- **Large Assets:** 4.9 MB uncompressed JPEG in public web directory.

---

## 2. Circular Dependencies

### Critical Finding: `marketPricesService.ts` <--> `marketPricesConnectionService.ts`
- **Location 1:** `FieldWise_main/src/services/marketPricesService.ts:1`
  ```typescript
  import marketPricesConnectionService from './marketPricesConnectionService';
  ```
- **Location 2:** `FieldWise_main/src/services/marketPricesConnectionService.ts:1`
  ```typescript
  import { MarketPrice, PriceTrend, MarketStats } from './marketPricesService';
  ```
- **Architectural Impact:**
  Mutual circular dependencies can cause `undefined` export evaluation during module bundling, introduce subtle timing bugs in hot-module reloading (HMR), and make tree-shaking impossible.
- **Remediation Strategy:**
  1. Extract shared interfaces (`MarketPrice`, `PriceTrend`, `MarketStats`, `MarketPriceParams`) into a dedicated type definition file: `src/types/marketPrices.ts`.
  2. Merge `marketPricesConnectionService.ts` (API transport) into `marketPricesService.ts` (business intelligence) to eliminate the artificial file boundary entirely.

---

## 3. Code Duplication & Redundant Logic

### 1. In-Landing Dashboard vs. Interactive Dashboard Preview
- **Files:**
  - `FieldWise_landing/src/components/Dashboard.jsx` (33.5 KB, 727 lines, `Dashboard.css` 13.5 KB)
  - `FieldWise_landing/src/components/DashboardPreview.jsx` (33.6 KB, 702 lines, `DashboardPreview.css` 35.0 KB)
- **Problem:**
  Both files duplicate the entire mock farm state, crop stage progress, weather telemetry, soil NPK values, disease scanner states, and active tab rendering.
- **Root Cause:**
  `Dashboard.jsx` was originally created as an embedded dashboard before FieldWise was separated into a dedicated main application (`FieldWise_main`).
- **Remediation:**
  Remove `Dashboard.jsx` and `Dashboard.css`. Update `App.jsx` so that logged-in users who click "Dashboard" are redirected directly to `FieldWise_main` (`http://localhost:5174`) via the single-use token handoff. Retain only `DashboardPreview.jsx` for the public marketing showcase.

### 2. Redundant Wrapper Component: `EnhancedMarketPrices.tsx`
- **Location:** `FieldWise_main/src/components/modules/EnhancedMarketPrices.tsx` (415 bytes)
  ```typescript
  export const EnhancedMarketPrices = ({ className, onNavigate }: EnhancedMarketPricesProps) => {
    return <MandiPriceIntelligence className={className} onNavigate={onNavigate} />;
  };
  ```
- **Problem:**
  A trivial wrapper providing zero abstraction over `MandiPriceIntelligence`.
- **Remediation:**
  In `Marketplace.tsx`, replace `<EnhancedMarketPrices />` with `<MandiPriceIntelligence />` and delete `EnhancedMarketPrices.tsx`.

### 3. Re-export Stubs in Landing Page
- `FieldWise_landing/src/components/AIFeatures.jsx` re-exports `FarmIntelligenceEngine` but keeps a 15.8 KB orphaned `AIFeatures.css` file.
- `FieldWise_landing/src/components/SmartTools.jsx` re-exports `RealWorldFarmData` but keeps a 6.6 KB orphaned `SmartTools.css` file.
- **Remediation:**
  Delete both stubs and their orphaned stylesheets; update references in `App.jsx`.

---

## 4. Large Monolithic Files & Separation of Concerns

The following files violate the Single Responsibility Principle by combining data fetching, business logic, form validation, mock databases, and deeply nested JSX:

| Monolithic File | Lines | Size | Issues Identified |
| :--- | :---: | :---: | :--- |
| `pages/Profile.tsx` | 1,622 | 74.1 KB | Handles personal info, farm specs, location geocoding, soil types, crop rotations, Supabase sync, notifications, and passwords in a single giant component. |
| `components/modules/SoilEnvironmentIntelligence.tsx` | 1,463 | 69.4 KB | Embeds simulated sensor telemetry loops, Recharts rendering, SVG icons, and threshold alert calculations in one file. |
| `services/marketPricesService.ts` | 1,432 | 41.8 KB | Contains extensive static APMC market databases, trend calculators, and mock generator functions. |
| `components/modules/CropRecommendation.tsx` | 1,230 | 58.0 KB | Combines Legacy Engine V1 and Engine V2 switcher, soil prefill logic, result caching, and advice rendering. |
| `components/modules/FertilizerRecommendation.tsx` | 1,255 | 58.4 KB | Embeds custom NPK deficit calculation formulas, commercial fertilizer tables, and PDF print formatting. |
| `components/v2/PredictionFormV2.tsx` | 1,126 | 49.6 KB | Massive multi-section form without subcomponent modularization. |
| `components/modules/ExpertConsultation.tsx` | 1,071 | 52.3 KB | In-memory inquiry queues, form handling, directory filtering, and modal management. |
| `components/modules/DiseaseDetection.tsx` | 1,045 | 49.3 KB | Image drag-and-drop, camera handling, disease card rendering, and historical log mapping. |

### Recommended Refactoring Architecture:
Decompose each module into a cohesive directory pattern:
```
components/modules/crop-recommendation/
├── index.tsx                 <-- Module entry and state controller (<300 lines)
├── components/
│   ├── EngineSwitcher.tsx
│   ├── SoilInputSection.tsx
│   └── RecommendationCards.tsx
├── hooks/
│   └── useCropRecommendation.ts <-- Query & mutation logic
└── utils/
    └── agronomicCalculations.ts
```

---

## 5. Security & Configuration Observations

1. **Client-Side API Key Exposure:**
   - `VITE_GEMINI_API_KEY` is bundled directly into the frontend client build (`dist/assets/index-*.js`).
   - *Risk:* Anyone inspecting browser network traffic or dev tools can extract the Google AI Studio key and exhaust quotas.
   - *Recommendation:* Transition Gemini vision analysis to an authenticated backend proxy endpoint: `POST /api/diagnosis/detect-disease` in the Node.js Express server.
2. **Dual SQLite Drivers in Backend:**
   - `src/config/database.js` requires `better-sqlite3` as a fallback inside a `try/catch` block while using native `node:sqlite`.
   - *Observation:* Node.js 22.18+ provides stable `node:sqlite`. `better-sqlite3` causes compilation issues on Windows/macOS if node-gyp build tools are missing.
   - *Recommendation:* Standardize strictly on Node native `node:sqlite` and drop `better-sqlite3` from `package.json`.
3. **CORS Allowlist Security:**
   - Backend `src/middleware/cors.js` enforces strict origin allowlisting (`http://localhost:5173`, `http://localhost:5174`, `http://localhost:5175`, `http://localhost:5176`). This is properly configured and tested.

---

## 6. Performance & Asset Optimization

1. **Uncompressed Landing Hero Image:**
   - `FieldWise_landing/public/hero-farm.jpg` is **4.9 MB (4,899,401 bytes)**!
   - *Impact:* Drastically hurts Largest Contentful Paint (LCP) and mobile performance over cellular connections.
   - *Remediation:* Compress to modern WebP format (`hero-farm.webp`) at 85% quality, reducing file size to under **400 KB** (a 92% reduction).
2. **Bundle Size & Dead UI Components:**
   - 24 unused Radix UI components increase bundle parse times and pull in unused libraries (`embla-carousel-react`, `cmdk`, `vaul`, `input-otp`, `react-resizable-panels`).
   - Removing unused components reduces final bundle size by ~180 KB.
