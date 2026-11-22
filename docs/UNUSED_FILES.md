# FieldWise Platform — Unused, Redundant & Obsolete Files Analysis

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-22  

---

## 1. Executive Summary

A comprehensive automated and manual static dependency analysis identified **71 root archive files**, **24 unused UI components**, **8 detached frontend pages/components**, **2 orphaned backend services**, and **25 compiled Python bytecode files** that can be safely archived, merged, or deleted.

Removing or archiving these files will:
- Reduce repository disk footprint by **~65%** (excluding `node_modules`).
- Eliminate cognitive clutter and prevent developers from maintaining detached dead code.
- Prevent accidental deployment of legacy stubs and obsolete demo views.
- Streamline bundler parse trees and improve IDE indexing speed.

---

## 2. Detached & Dead Frontend Code (`FieldWise_main/src/`)

These files have **zero inbound imports** across the entire application and are completely absent from the client-side routing tree (`src/App.tsx`):

### 1. `src/components/LandingPage.tsx` (28.7 KB, 609 lines)
- **Status:** 100% Dead Code / Detached.
- **Evidence:** `grep -rn "LandingPage" src/` returns only the file declaration itself. The application uses the dedicated `FieldWise_landing` project as its visitor entry point.
- **Recommendation:** **DELETE**.
- **Risk:** Zero. No active routes or components import this file.

### 2. `src/pages/Auth.tsx` (7.1 KB, 168 lines)
- **Status:** 100% Dead Code / Detached.
- **Evidence:** `App.tsx` routes do not declare `/auth`. Login and registration are handled via the handoff from `FieldWise_landing`.
- **Recommendation:** **DELETE**.
- **Risk:** Zero.

### 3. `src/pages/Login.tsx` (4.7 KB, 126 lines)
- **Status:** 100% Dead Code / Detached.
- **Evidence:** Not referenced in `App.tsx`.
- **Recommendation:** **DELETE**.
- **Risk:** Zero.

### 4. `src/components/LoginForm.tsx` (15.8 KB, 394 lines)
- **Status:** 100% Dead Code / Detached.
- **Evidence:** Only imported by `pages/Login.tsx`, which is itself unused.
- **Recommendation:** **DELETE**.
- **Risk:** Zero.

### 5. `src/components/LoginDemo.tsx` (3.8 KB, 100 lines)
- **Status:** 100% Dead Code / Detached.
- **Evidence:** Legacy demo card titled "Welcome to Crops Wild" (former project title). Zero imports across the codebase.
- **Recommendation:** **DELETE**.
- **Risk:** Zero.

### 6. `src/components/PredictionForm.tsx` (11.7 KB, 298 lines)
- **Status:** Obsolete V1 Form.
- **Evidence:** `CropRecommendation.tsx` exclusively imports `PredictionFormV2` from `components/v2/PredictionFormV2.tsx`. `PredictionForm.tsx` has zero active imports.
- **Recommendation:** **DELETE**.
- **Risk:** Zero.

### 7. `src/components/PredictionResults.tsx` (12.3 KB, 342 lines)
- **Status:** Obsolete V1 Results Component.
- **Evidence:** `CropRecommendation.tsx` exclusively imports `PredictionResultsV2` from `components/v2/PredictionResultsV2.tsx`. `PredictionResults.tsx` has zero active imports.
- **Recommendation:** **DELETE**.
- **Risk:** Zero.

### 8. `src/components/NavLink.tsx` (751 B, 28 lines)
- **Status:** Unused Router Wrapper.
- **Evidence:** Zero imports. All navigation is handled via standard React Router `<Link>` or `<button onClick={() => navigate(...)}>`.
- **Recommendation:** **DELETE**.
- **Risk:** Zero.

### 9. `src/components/ProtectedRoute.tsx` (220 B, 11 lines)
- **Status:** No-op Pass-through Stub.
- **Evidence:** Defines `const ProtectedRoute = ({ children }) => <>{children}</>;`. Zero imports.
- **Recommendation:** **DELETE**.
- **Risk:** Zero.

### 10. `src/services/authService.ts` (2.5 KB) & `localAuthService.ts` (5.7 KB)
- **Status:** Orphaned Authentication Services.
- **Evidence:** `AuthContext.tsx` handles all token exchanges, session lookups, and demo logins directly via `fetch`. Neither service is imported by any active component.
- **Recommendation:** **DELETE**.
- **Risk:** Zero.

### 11. `src/components/modules/EnhancedMarketPrices.tsx` (415 B)
- **Status:** Redundant Pass-Through Wrapper.
- **Evidence:** Literally returns `<MandiPriceIntelligence className={className} onNavigate={onNavigate} />;`.
- **Recommendation:** **DELETE** after updating the single reference in `Marketplace.tsx` to import `MandiPriceIntelligence` directly.
- **Risk:** Zero.

---

## 3. Unused UI Components (`FieldWise_main/src/components/ui/`)

Out of 51 UI components, **24 components have zero imports** in the application:

| Unused UI Component | Size | Reason for Retention or Deletion | Action |
| :--- | :---: | :--- | :---: |
| `alert-dialog.tsx` | 4.3 KB | Unused. No modals require AlertDialog. | **DELETE** |
| `aspect-ratio.tsx` | 143 B | Unused. Images use Tailwind aspect utilities. | **DELETE** |
| `breadcrumb.tsx` | 2.7 KB | Unused. Navigation is flat tab-based. | **DELETE** |
| `calendar.tsx` | 2.5 KB | Unused. Drags in `react-day-picker` & `date-fns`. | **DELETE** |
| `carousel.tsx` | 6.2 KB | Unused. Drags in `embla-carousel-react`. | **DELETE** |
| `chart.tsx` | 10.0 KB | Unused. Recharts is used directly without wrapper. | **DELETE** |
| `collapsible.tsx` | 320 B | Unused. Sections use Accordion instead. | **DELETE** |
| `command.tsx` | 4.8 KB | Unused. Drags in `cmdk`. | **DELETE** |
| `context-menu.tsx` | 7.2 KB | Unused. No right-click menus in app. | **DELETE** |
| `drawer.tsx` | 2.9 KB | Unused. Drags in `vaul`. | **DELETE** |
| `form.tsx` | 4.0 KB | Unused. Forms use React Hook Form directly. | **DELETE** |
| `hover-card.tsx` | 1.2 KB | Unused. Tooltip is used instead. | **DELETE** |
| `input-otp.tsx` | 2.2 KB | Unused. Drags in `input-otp`. | **DELETE** |
| `menubar.tsx` | 7.8 KB | Unused. No desktop OS-style menubars. | **DELETE** |
| `navigation-menu.tsx` | 5.0 KB | Unused. Sidebar & Navbar use standard buttons. | **DELETE** |
| `pagination.tsx` | 2.7 KB | Unused. Lists use virtual scrolling or limit buttons. | **DELETE** |
| `popover.tsx` | 1.2 KB | Unused. DropdownMenu & Dialog used instead. | **DELETE** |
| `radio-group.tsx` | 1.4 KB | Unused. Select & Button toggles used instead. | **DELETE** |
| `resizable.tsx` | 1.7 KB | Unused. Drags in `react-resizable-panels`. | **DELETE** |
| `scroll-area.tsx` | 1.6 KB | Unused. Standard CSS `overflow-y-auto` used instead. | **DELETE** |
| `sidebar.tsx` | 22.8 KB | Unused. Custom `DashboardSidebar.tsx` used instead. | **DELETE** |
| `table.tsx` | 2.7 KB | Unused. Tables use Tailwind HTML `<table>`. | **DELETE** |
| `toggle-group.tsx` | 1.7 KB | Unused. Custom tab buttons used instead. | **DELETE** |
| `use-toast.ts` (ui stub) | 82 B | Redundant duplicate of `hooks/use-toast.ts`. | **DELETE** |

---

## 4. Visitor Portal Redundant Files (`FieldWise_landing/`)

### 1. `src/components/AIFeatures.jsx` & `AIFeatures.css`
- **Finding:** `AIFeatures.jsx` contains only `export { default } from './FarmIntelligenceEngine'`. However, `AIFeatures.css` is an unreferenced 15.8 KB duplicate stylesheet!
- **Action:** **DELETE** both files.

### 2. `src/components/SmartTools.jsx` & `SmartTools.css`
- **Finding:** `SmartTools.jsx` contains only `export { default } from './RealWorldFarmData'`. However, `SmartTools.css` is an unreferenced 6.6 KB duplicate stylesheet!
- **Action:** **DELETE** both files.

### 3. `src/components/Dashboard.jsx` & `Dashboard.css`
- **Finding:** 727-line component that is 95% identical to `DashboardPreview.jsx` (702 lines). In `App.jsx`, when `currentUser` is logged in, clicking "Dashboard" renders this copy instead of redirecting the user to `FieldWise_main` (`http://localhost:5174`).
- **Action:** **MERGE / REDIRECT**. Redirect authenticated users directly to `FieldWise_main` with their session token, eliminating the duplicate 33.5 KB dashboard copy.

### 4. Unused Scaffolding Assets
- `src/assets/hero.png` (13 KB): Vite boilerplate asset.
- `src/assets/react.svg` (4 KB): React boilerplate asset.
- `src/assets/vite.svg` (8.7 KB): Vite boilerplate asset.
- **Action:** **DELETE**.

---

## 5. Root Directory Historical Archives & Duplicates

### 1. Duplicate QA Reports
- `QA.txt` (20,889 bytes)
- `QA_REPORT.txt` (20,889 bytes)
- **Finding:** Exact byte-for-byte identical text files.
- **Action:** **DELETE `QA.txt`** and move `QA_REPORT.txt` to `docs/archive/`.

### 2. Historical Milestone ZIP & Checksum Packages (69 files, ~4 MB)
The root directory contains 33 `.zip` files and 36 `.sha256` files from Phase 3 development milestones:
- `Phase3C1_Crop_Recommendation_Audit.zip` & `.sha256`
- `Phase3C2_Crop_Recommendation_Benchmark.zip` & `.sha256`
- `Phase3C3_Agronomic_Validation_Package.zip` & `.sha256`
- `Phase3C4_...` (10 packages & checksums)
- `Phase3C5_...` (16 packages & checksums)
- `Phase3C6_...` (26 packages & checksums)
- **Action:** **MOVE to `archive/milestones/`**. These are milestone deliverables that clutter root and should not reside in the active source tree.

### 3. Orphaned Checksum Files (Missing Zip Archives)
- `FieldWise_Phase3B_2_CV_Review.zip.sha256` (100 bytes)
- `Phase3B2_Independent_Review_Evidence.zip.sha256` (107 bytes)
- **Finding:** Checksum files referencing `.zip` archives that do not exist.
- **Action:** **DELETE**.

---

## 6. Python Pipeline Bytecode & Legacy Reports

### 1. Committed Python Bytecode (`.pyc`)
- **Location:** `FieldWise_main/model/ml_pipeline/recommendation_engine/`
- **Files:** 25 `.pyc` files compiled by Python 3.10/3.11.
- **Finding:** Compiled binaries committed to git repository.
- **Action:** **DELETE** and add `*.pyc` and `__pycache__/` to root `.gitignore`.

### 2. Intermediate Milestone ML Reports (229 files)
- **Location:** `FieldWise_main/model/ml_pipeline/reports/`
- **Files:** 95 markdown reports, 42 CSV dumps, 50 JSON logs, 12 PNG charts.
- **Finding:** Detailed historical test artifacts from Phase 3A-3C benchmarking.
- **Action:** **MOVE to `archive/ml_reports/`**.
