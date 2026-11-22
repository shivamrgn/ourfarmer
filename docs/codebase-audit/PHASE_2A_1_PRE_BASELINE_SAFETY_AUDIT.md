# FieldWise — Phase 2A.1: Pre-Baseline Safety Audit

**Document Version:** 1.0.0  
**Audit Date:** November 22, 2026  
**Status:** READ-ONLY SAFETY AUDIT COMPLETE — ZERO CODE MODIFICATIONS APPLIED  

---

## 1. Staged README Inspection

Inspection of the staged blob in `.git/index` via `git show :README.md`:

```bash
$ git show :README.md
# ourfarmer

$ git ls-files -s README.md
100644 05f9e5a24b993b9a6a3b070e1df53ddd5ad5298c 0	README.md
```

### Analysis of Staged Content:
- **File Metadata:** Mode `100644`, SHA-1 blob hash `05f9e5a24b993b9a6a3b070e1df53ddd5ad5298c`, size **11 bytes**.
- **Content:** Contains only `# ourfarmer\n`.
- **Sensitive Information:** **None.** Contains zero secrets, paths, credentials, or proprietary logic.
- **Utility Assessment:** Outdated placeholder text from when the repository was initially created under the name "ourfarmer". The working tree file `README.md` was physically deleted on disk, leaving Git with staged status `AD README.md`.
- **Recommendation:** When approved, safely unstage via `git reset HEAD README.md` to clear the legacy index state without committing obsolete text.

---

## 2. Environment Files and Credentials Audit

### 2.1. Complete Inventory of `.env*` Files

| # | File Path | Git Status | Active or Template | Secrets Present | Classification |
| :---: | :--- | :---: | :---: | :---: | :--- |
| 1 | `FieldWise_landing/.env` | Ignored (`FieldWise_landing/.gitignore:27`) | **Active** | Yes (Client API keys) | Public Web Client Config |
| 2 | `FieldWise_landing/.env.example` | Untracked (Not Ignored) | **Template** | No (Placeholders only) | Safe Environment Template |
| 3 | `FieldWise_main/.env` | Ignored (`FieldWise_main/.gitignore:21`) | **Active** | Yes (Sensitive API key) | Client API Keys & Config |
| 4 | `FieldWise_main/.env.example` | Untracked (Not Ignored) | **Template** | No (Placeholders only) | Safe Environment Template |
| 5 | `FieldWise_main/.env.staging.example`| Untracked (Not Ignored) | **Template** | No (Placeholders only) | Safe Environment Template |
| 6 | `FieldWise_main/backend/.env` | Ignored (`FieldWise_main/.gitignore:26`) | **Active** | Yes (**Server Secrets**) | Critical Backend Credentials |
| 7 | `FieldWise_main/backend/.env.example` | Untracked (Not Ignored) | **Template** | No (Placeholders only) | Safe Environment Template |
| 8 | `FieldWise_main/backend/.env.staging.example`| Untracked (Not Ignored) | **Template** | No (Placeholders only) | Safe Environment Template |

---

### 2.2. Credentials and Secret Categorization (All Values Redacted)

#### Category A: Critical Server-Side Secrets (**STRICT MUST EXCLUDE**)
These secrets grant elevated access to administrative infrastructure and must **never** be committed to Git:
1. **Backend JWT HMAC-SHA256 Signing Secret:**
   - Location: `FieldWise_main/backend/.env`
   - Key: `JWT_SECRET=[REDACTED_HIGH_ENTROPY_256BIT_SECRET]`
   - Risk: Compromise allows forging arbitrary authentication tokens.
2. **Supabase Service-Role Admin Key:**
   - Location: `FieldWise_main/backend/.env` (and staging environments)
   - Key: `SUPABASE_SERVICE_ROLE_KEY=[REDACTED_ELEVATED_SERVICE_KEY]`
   - Risk: Bypasses PostgreSQL Row Level Security (RLS) policies completely.
3. **Firebase Admin Service Account Private Keys:**
   - Referenced in backend validation. If configured as JSON or environment variable, grants full administrative access to project `fieldwise-6db7b`.

#### Category B: Sensitive Client API Keys (**STRICT MUST EXCLUDE**)
1. **Google AI Studio / Gemini API Key:**
   - Location: `FieldWise_main/.env`
   - Key: `VITE_GEMINI_API_KEY=[REDACTED_AI_STUDIO_API_KEY]`
   - Risk: Quota theft, unauthorized billing, or API abuse.

#### Category C: Public Web Client Identifiers (Separate Classification)
These identifiers are compiled into client-side single-page application bundles by design:
1. **Firebase Web Client Configuration:**
   - Locations: `FieldWise_landing/.env`, `FieldWise_landing/src/firebase.js`
   - Keys: `VITE_FIREBASE_API_KEY=[REDACTED_PUBLIC_WEB_KEY]`, `VITE_FIREBASE_PROJECT_ID=fieldwise-6db7b`, `VITE_FIREBASE_AUTH_DOMAIN=fieldwise-6db7b.firebaseapp.com`, `VITE_FIREBASE_APP_ID=[REDACTED_APP_ID]`
   - Assessment: Firebase Web API keys identify the project to Google infrastructure. Security is enforced through Firestore Security Rules and backend token verification. While compiled into public bundles, **the active `.env` file containing them must still remain uncommitted**.
2. **Supabase Public Anonymous Key:**
   - Location: `FieldWise_main/.env`
   - Key: `VITE_SUPABASE_ANON_KEY=[REDACTED_ANON_JWT]`, `VITE_SUPABASE_URL=https://[REDACTED_PROJECT].supabase.co`
   - Assessment: Read/write permissions are restricted by Supabase Row Level Security (RLS). Active file must remain uncommitted.

#### Category D: False Positives in Source Code
1. `service_role` in `FieldWise_main/migrations/*.sql`:
   - Verification confirms this is the PostgreSQL role identifier in `GRANT` DDL statements (e.g. `GRANT ALL ON TABLE public.farmers TO service_role;`), **not a credential or private token**.

---

## 3. Ignore Rules Audit & Proposed Root `.gitignore`

### 3.1. Current Ignore Status
- **Root `.gitignore`:** **MISSING.** Root level has zero ignore rules.
- **Nested `.gitignore` Files:** `FieldWise_landing/.gitignore` and `FieldWise_main/.gitignore` exist but their ignore scopes do not cover root archives, root OS files, or root environment files.

### 3.2. Proposed Root `.gitignore` (DO NOT CREATE YET)
```gitignore
# ==============================================================================
# FieldWise Root .gitignore (Proposed)
# ==============================================================================

# OS & Editor Artifacts
.DS_Store
*/.DS_Store
*/**/.DS_Store
.idea/
.vscode/*
!.vscode/extensions.json
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Dependencies
node_modules/
*/node_modules/
*/**/node_modules/
bun.lockb

# Build Outputs & Bundler Caches
dist/
*/dist/
*/**/dist/
dist-ssr/
*.local

# Python Bytecode & Cache
__pycache__/
*/__pycache__/
*/**/__pycache__/
*.py[cod]
*$py.class

# SQLite Databases & Ephemeral Storage
*.db
*.db-shm
*.db-wal
*.db-journal
*.sqlite
backend/data/*.db
backend/data/*.db-*
FieldWise_main/backend/data/*.db
FieldWise_main/backend/data/*.db-*

# Logs & Diagnostics
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Environment Variables & Server Secrets (STRICT)
.env
.env.*
*.env
*.env.*
**/.env
**/.env.*

# PRESERVE Safe Example/Staging Templates (UN-IGNORE)
!.env.example
!*.env.example
!**/.env.example
!.env.staging.example
!*.env.staging.example
!**/.env.staging.example
```

---

## 4. Archive and Repository Size Audit

Detailed analysis of all 34 root ZIP archives and 35 SHA256 checksum files:

| Filename | File Size | Matching SHA File | Checksum Verified | GitHub Size Alert (>50MB) |
| :--- | :---: | :---: | :---: | :---: |
| `FieldWise_Codebase_Audit_Docs.zip` | 37,603 B (0.04 MB) | `True` | **VALID** | Safe |
| `Phase3C1_Crop_Recommendation_Audit.zip` | 172,445 B (0.16 MB) | `True` | **VALID** | Safe |
| `Phase3C2_Crop_Recommendation_Benchmark.zip` | 1,097,942 B (1.05 MB) | `True` | **VALID** | Safe |
| `Phase3C3_Agronomic_Validation_Package.zip` | 64,386 B (0.06 MB) | `True` | **VALID** | Safe |
| `Phase3C4_1_Consolidated_Safety_Package.zip` | 99,950 B (0.10 MB) | `True` | **VALID** | Safe |
| `Phase3C4_2_1_Consolidated_Corrections_Package.zip` | 147,476 B (0.14 MB) | `False` | N/A (Missing SHA) | Safe |
| `Phase3C4_2_2_1_Effective_Rainfall_Reconciliation_Package.zip` | 177,275 B (0.17 MB) | `True` | **VALID** | Safe |
| `Phase3C4_2_2_Final_Water_Safety_Package.zip` | 161,277 B (0.15 MB) | `True` | **VALID** | Safe |
| `Phase3C4_2_Final_Closure_Package.zip` | 129,365 B (0.12 MB) | `True` | **VALID** | Safe |
| `Phase3C4_Redesign_Specification_Package.zip` | 60,835 B (0.06 MB) | `True` | **VALID** | Safe |
| `Phase3C5_1_Engine_Safety_Corrections_Package.zip` | 95,982 B (0.09 MB) | `True` | **VALID** | Safe |
| `Phase3C5_2_1_Agronomic_Gate_Provenance_Package.zip` | 178,589 B (0.17 MB) | `True` | **VALID** | Safe |
| `Phase3C5_2_2_1_Final_Safety_Closure_Package.zip` | 154,250 B (0.15 MB) | `True` | **VALID** | Safe |
| `Phase3C5_2_2_2_Final_pH_Ranking_Consistency_Package.zip` | 154,437 B (0.15 MB) | `True` | **VALID** | Safe |
| `Phase3C5_2_2_3_Final_Packaging_Advisory_Closure_Package.zip` | 153,690 B (0.15 MB) | `True` | **VALID** | Safe |
| `Phase3C5_2_2_Evidence_Authority_Package.zip` | 269,973 B (0.26 MB) | `True` | **VALID** | Safe |
| `Phase3C5_2_Engine_Safety_Corrections_Package.zip` | 139,624 B (0.13 MB) | `True` | **VALID** | Safe |
| `Phase3C5_Crop_Recommendation_Engine_Package.zip` | 168,454 B (0.16 MB) | `True` | **VALID** | Safe |
| `Phase3C6_1_1_Integration_Contract_Reconciliation_Package.zip` | 26,785 B (0.03 MB) | `True` | **VALID** | Safe |
| `Phase3C6_1_2_Final_Reconciliation_Package.zip` | 24,030 B (0.02 MB) | `True` | **VALID** | Safe |
| `Phase3C6_1_3_Safety_Amendment_Package.zip` | 26,725 B (0.03 MB) | `True` | **VALID** | Safe |
| `Phase3C6_1_Integration_Design_Package.zip` | 26,725 B (0.03 MB) | `True` | **VALID** | Safe |
| `Phase3C6_2_1_1_Input_Semantics_Closure_Package.zip` | 19,369 B (0.02 MB) | `True` | **VALID** | Safe |
| `Phase3C6_2_1_2_Contract_Closure_Package.zip` | 24,672 B (0.02 MB) | `True` | **VALID** | Safe |
| `Phase3C6_2_1_3_Seasonal_Provenance_Closure_Package.zip` | 24,993 B (0.02 MB) | `True` | **VALID** | Safe |
| `Phase3C6_2_1_Python_Adapter_CLI_Package.zip` | 19,369 B (0.02 MB) | `True` | **VALID** | Safe |
| `Phase3C6_2_2_1_Backend_Bridge_Closure_Package.zip` | 38,791 B (0.04 MB) | `True` | **VALID** | Safe |
| `Phase3C6_2_2_2_Unified_Termination_Closure_Package.zip` | 41,271 B (0.04 MB) | `True` | **VALID** | Safe |
| `Phase3C6_2_2_3_Client_Disconnect_Closure_Package.zip` | 44,726 B (0.04 MB) | `True` | **VALID** | Safe |
| `Phase3C6_2_2_Node_Backend_Bridge_Package.zip` | 44,726 B (0.04 MB) | `True` | **VALID** | Safe |
| `Phase3C6_3_1_Frontend_V2_Defaults_Closure_Package.zip` | 48,444 B (0.05 MB) | `True` | **VALID** | Safe |
| `Phase3C6_3_Frontend_V2_Integration_Package.zip` | 46,077 B (0.04 MB) | `True` | **VALID** | Safe |
| `Phase3C6_4_1_1_Persistence_Design_Closure_Package.zip` | 37,281 B (0.04 MB) | `True` | **VALID** | Safe |
| `Phase3C6_4_1_Persistence_Mapping_Package.zip` | 37,281 B (0.04 MB) | `True` | **VALID** | Safe |

### Summary Findings:
- **Total Archives Size:** **3,994,818 bytes (~3.81 MB)** across all 34 ZIP archives.
- **Maximum File Size:** 1.05 MB (`Phase3C2_Crop_Recommendation_Benchmark.zip`).  
  *No file approaches GitHub's 100 MB hard limit or 50 MB warning threshold.*
- **Checksum Parity:** 33 of 34 ZIP files have matching `.sha256` files that **100% verify**. Only `Phase3C4_2_1_Consolidated_Corrections_Package.zip` lacks a standalone `.sha256` file.
- **Orphaned Checksums:** 2 files (`FieldWise_Phase3B_2_CV_Review.zip.sha256` and `Phase3B2_Independent_Review_Evidence.zip.sha256`) exist without root zip files. Both are required by the whitelist in `verify_phase_3b_2_cv.py`.
- **Recommendation:** Because total archive size is only 3.81 MB, retaining them in Git or an `archive/milestones/` folder does not bloat the repository.

---

## 5. Git Remote & Repository Configuration Audit

```bash
$ git remote -v
origin	https://github.com/shivamrgn/ourfarmer.git (fetch)
origin	https://github.com/shivamrgn/ourfarmer.git (push)

$ git branch -vv
# (No output — main has no commits and no upstream tracking branch)

$ cat .git/config
[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
	ignorecase = true
	precomposeunicode = true
[remote "origin"]
	url = https://github.com/shivamrgn/ourfarmer.git
	fetch = +refs/heads/*:refs/remotes/origin/*
```

### Remote History Findings:
- Local `main` branch has **no upstream configured**.
- No remote-tracking branches exist in `.git/refs/remotes/`.
- The repository was initialized locally on November 15, 2026.
- A remote `origin` pointing to `https://github.com/shivamrgn/ourfarmer.git` was configured.
- No network operations (`git fetch` or `git pull`) have been executed, so remote commit status is unknown locally.
- When an initial commit is created locally, it will establish the root commit of `main`.

---

## 6. Explicit Staging Manifest (Proposed Categorization)

| Category | File Paths / Subdirectories | Target Git Action | Rationale |
| :--- | :--- | :---: | :--- |
| **Application Source** | `FieldWise_landing/src/`, `FieldWise_main/src/`, `FieldWise_main/backend/src/`, `FieldWise_main/model/`, `dev.js` | **STAGE** | Core production logic |
| **Package Manifests & Locks** | `package.json`, `FieldWise_landing/package.json`, `FieldWise_landing/package-lock.json`, `FieldWise_main/package.json`, `FieldWise_main/package-lock.json`, `FieldWise_main/backend/package.json`, `FieldWise_main/backend/package-lock.json`, `FieldWise_main/components.json` | **STAGE** | Dependency lock consistency |
| **Tests & Tooling Config** | `FieldWise_main/src/test/`, `FieldWise_main/backend/src/tests/`, `tsconfig*.json`, `vite.config.*`, `vitest.config.ts`, `tailwind.config.ts`, `eslint.config.js`, `.oxlintrc.json`, `firestore.rules` | **STAGE** | Test & build configurations |
| **Documentation** | `docs/`, `FieldWise_landing/README.md`, `FieldWise_landing/TECH_STACK.md`, `FieldWise_main/README.md`, `FieldWise_main/docs/` | **STAGE** | Project knowledge & audit records |
| **Safe Environment Templates** | `*.env.example`, `*.env.staging.example` (5 files) | **STAGE** | Safe onboarding templates |
| **Historical Milestone Packages** | 34 `.zip` files, 35 `.sha256` files, `QA.txt`, `QA_REPORT.txt` | **STAGE** | Audit evidence & ML whitelist compliance |
| **Secrets & Databases** | `FieldWise_landing/.env`, `FieldWise_main/.env`, `FieldWise_main/backend/.env`, `backend/data/*.db*` | **STRICTLY EXCLUDE** | Sensitive credentials & SQLite DBs |
| **Build Artifacts & Bytecode** | `dist/`, `node_modules/`, `*.pyc`, `__pycache__/`, `.DS_Store` | **STRICTLY EXCLUDE** | Ephemeral generated files |

*Strict Directive: Never use `git add .` or `git add -A`. All staging must follow explicit paths after the root `.gitignore` is in place.*

---

## 7. Protected Asset Checksum Verification

```bash
$ shasum -a 256 FieldWise_main/model/ml_pipeline/scripts/verify_phase_3b_2_cv.py
cbe468879159ff426f8586be4c8e8964249db2719f92bbbb4d9db0448fea8140  FieldWise_main/model/ml_pipeline/scripts/verify_phase_3b_2_cv.py
```
- **Verification Status:** **100% UNMODIFIED AND INTACT.**
- Zero files in `FieldWise_main/model/` were altered during Phase 1 cleanup.

---

## 8. Final Decision & Recommendation

### Final Decision:
**READY FOR BASELINE PREPARATION**

### Prerequisites to Execute (When Approved):
1. Create the proposed root `.gitignore` file to ensure secrets, SQLite databases, and OS artifacts cannot be staged.
2. Unstage the legacy `AD README.md` entry via `git reset HEAD README.md`.
3. Explicitly stage the application source, manifests, tests, safe templates, documentation, and milestone packages.
4. Execute `git commit -m "chore: establish FieldWise baseline post-Phase-1 cleanup"`.
5. Create tag `v1.0.0-phase1-baseline` as an immutable checkpoint before Phase 2.

---

## Stop Condition Compliance

**READ-ONLY AUDIT COMPLETE.**  
No files were created (outside this report), modified, deleted, or moved. No Git commands modifying the repository state were executed. Awaiting explicit user approval before taking further action.
