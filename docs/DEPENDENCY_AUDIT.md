# FieldWise Platform — Comprehensive Dependency Audit

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-22  

---

## 1. Executive Summary

A comprehensive dependency scan was performed across all four project `package.json` manifests:
1. **Root:** `package.json` (`fieldwise-suite`)
2. **Landing App:** `FieldWise_landing/package.json` (`finalone`)
3. **Main Dashboard:** `FieldWise_main/package.json` (`vite_react_shadcn_ts`)
4. **Backend API:** `FieldWise_main/backend/package.json` (`croppredict-backend`)

### Key Findings
- **React Version Inconsistency:** Landing uses **React 19** (`^19.2.8`), whereas Main Dashboard uses **React 18** (`^18.3.1`).
- **Unused Packages:** 4 direct npm packages in `FieldWise_main` (`zod`, `@hookform/resolvers`, `date-fns`, `lovable-tagger`) are never imported.
- **Unused Component Dependencies:** 10+ `@radix-ui/*` packages and UI helpers (`embla-carousel-react`, `cmdk`, `vaul`, `input-otp`, `react-resizable-panels`) are only imported by dead UI files.
- **Redundant SQLite Drivers:** Backend installs `better-sqlite3` as an external binary dependency while running on Node 22 native `node:sqlite`.

---

## 2. Package-by-Package Audit

### 2.1. Root Orchestrator (`/package.json`)
```json
{
  "name": "fieldwise-suite",
  "private": true,
  "scripts": { "dev": "node dev.js" }
}
```
- **Dependencies:** 0
- **DevDependencies:** 0
- **Assessment:** Clean, minimal. Recommend adding workspace definitions or npm scripts for unified linting and testing across subprojects:
  ```json
  "scripts": {
    "dev": "node dev.js",
    "test": "npm test --prefix FieldWise_main && npm test --prefix FieldWise_main/backend",
    "build": "npm run build --prefix FieldWise_landing && npm run build --prefix FieldWise_main"
  }
  ```

---

### 2.2. Visitor Portal (`FieldWise_landing/package.json`)
```json
{
  "name": "finalone",
  "dependencies": {
    "firebase": "^12.19.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.7",
    "@vitejs/plugin-react": "^6.1.1",
    "oxlint": "^1.81.0",
    "vite": "^8.3.0"
  }
}
```
- **Audit Findings:**
  - `firebase`: **KEEP**. Actively used for Google Sign-In and email auth in `src/firebase.js`.
  - `react` & `react-dom` (v19.2.8): **CONSOLIDATE CANDIDATE**. React 19 is functional here, but running React 19 in landing and React 18 in main creates cognitive overhead and potential friction if components or hooks are shared.
  - `name: "finalone"`: Scaffolding artifact. Recommend updating to `"name": "@fieldwise/landing"`.

---

### 2.3. Farmer Dashboard (`FieldWise_main/package.json`)

#### Unused Direct Dependencies in Source Code
The following packages are declared in `dependencies` but have **zero imports** in `src/`:

| Package Name | Declared Version | Why It Is Unused | Recommendation |
| :--- | :--- | :--- | :--- |
| `zod` | `^3.25.76` | Form validation is implemented with custom regex and React Hook Form validation. No Zod schemas exist. | **REMOVE** |
| `@hookform/resolvers` | `^3.10.0` | Used exclusively to bind Zod to React Hook Form; since Zod is unused, this resolver is unused. | **REMOVE** |
| `date-fns` | `^3.6.0` | Dates are formatted using native JavaScript `Intl.DateTimeFormat` and `.toLocaleDateString()`. | **REMOVE** |
| `lovable-tagger` (dev) | `^1.1.13` | Initial template scaffolding tagger; produces no value in production or custom development. | **REMOVE** |

#### UI Dependencies Tied Exclusively to Unused UI Components
The following packages are installed solely to power the 24 dead UI components identified in `docs/UNUSED_FILES.md`:

| Package Name | Associated Unused UI Component | Recommendation |
| :--- | :--- | :--- |
| `@radix-ui/react-navigation-menu` | `components/ui/navigation-menu.tsx` | **REMOVE** after deleting component |
| `@radix-ui/react-menubar` | `components/ui/menubar.tsx` | **REMOVE** after deleting component |
| `@radix-ui/react-context-menu` | `components/ui/context-menu.tsx` | **REMOVE** after deleting component |
| `@radix-ui/react-radio-group` | `components/ui/radio-group.tsx` | **REMOVE** after deleting component |
| `@radix-ui/react-scroll-area` | `components/ui/scroll-area.tsx` | **REMOVE** after deleting component |
| `@radix-ui/react-hover-card` | `components/ui/hover-card.tsx` | **REMOVE** after deleting component |
| `embla-carousel-react` | `components/ui/carousel.tsx` | **REMOVE** after deleting component |
| `cmdk` | `components/ui/command.tsx` | **REMOVE** after deleting component |
| `vaul` | `components/ui/drawer.tsx` | **REMOVE** after deleting component |
| `input-otp` | `components/ui/input-otp.tsx` | **REMOVE** after deleting component |
| `react-resizable-panels` | `components/ui/resizable.tsx` | **REMOVE** after deleting component |
| `react-day-picker` | `components/ui/calendar.tsx` | **REMOVE** after deleting component |

#### Essential Direct Dependencies (Retain)
- `@google/generative-ai`: Core Gemini vision pathology inference.
- `@supabase/supabase-js`: Authoritative cloud persistence for My Farm, farmers, and predictions.
- `react`, `react-dom`, `react-router-dom`: Core application framework.
- `@tanstack/react-query`: Asynchronous server state and caching.
- `axios`: REST API transport.
- `recharts`: Soil telemetry and market trend data visualization.
- `lucide-react`: System icons.
- `framer-motion`: Transition animations.
- `tailwind-merge`, `clsx`, `class-variance-authority`: Component styling system.
- Active `@radix-ui/*` packages: `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-tooltip`, `@radix-ui/react-switch`, `@radix-ui/react-checkbox`, `@radix-ui/react-progress`, `@radix-ui/react-slider`, `@radix-ui/react-accordion`, `@radix-ui/react-avatar`, `@radix-ui/react-badge`, `@radix-ui/react-slot`.

---

### 2.4. Backend API (`FieldWise_main/backend/package.json`)
```json
{
  "name": "croppredict-backend",
  "dependencies": {
    "@supabase/supabase-js": "^2.117.2",
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^9.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.3",
    "express-validator": "^7.0.1",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```
- **Audit Findings:**
  - `better-sqlite3`: **REMOVE**. The backend runs on Node.js 22.18+, which includes native `node:sqlite`. `better-sqlite3` requires C++ native compilation, creating unnecessary deployment friction.
  - `name: "croppredict-backend"`: Recommend updating to `"name": "@fieldwise/api"`.
  - All other dependencies (`express`, `cors`, `dotenv`, `jsonwebtoken`, `bcryptjs`, `express-validator`, `@supabase/supabase-js`, `nodemon`) are actively used and essential.

---

## 3. Dependency Consolidation Recommendations

```
┌──────────────────────────────┬────────────────────────────┬─────────────────────────────┐
│ Action                       │ Package(s)                 │ Impact                      │
├──────────────────────────────┼────────────────────────────┼─────────────────────────────┤
│ REMOVE Unused Direct Libs    │ zod, @hookform/resolvers,  │ Saves ~15 MB node_modules,  │
│                              │ date-fns, lovable-tagger   │ cleaner package manifest    │
├──────────────────────────────┼────────────────────────────┼─────────────────────────────┤
│ REMOVE Unused UI Components  │ cmdk, vaul, input-otp,     │ Eliminates 12 packages,     │
│ & Associated Libraries       │ embla-carousel-react,      │ saves ~180 KB client bundle │
│                              │ react-resizable-panels,    │                             │
│                              │ 6+ @radix-ui/* packages    │                             │
├──────────────────────────────┼────────────────────────────┼─────────────────────────────┤
│ REMOVE Native SQLite Binary  │ better-sqlite3             │ Standardizes on Node 22     │
│                              │                            │ native node:sqlite          │
├──────────────────────────────┼────────────────────────────┼─────────────────────────────┤
│ RENAME Package Names         │ finalone -> @fieldwise/... │ Consistent monorepo naming  │
│                              │ vite_react -> @fieldwise/..│ convention                  │
└──────────────────────────────┴────────────────────────────┴─────────────────────────────┘
```
