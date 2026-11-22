# FieldWise — Phase 2A.4: GitHub Large-File Push Failure Investigation Report

**Execution Mode:** STRICT READ-ONLY INVESTIGATION  
**Date:** 2026-11-22  
**Target Repository:** `/Users/shivamkumar/farmingFinal`  
**Remote Target:** `origin` (`https://github.com/shivamrgn/ourfarmer.git`)  
**Controlling Documents:** `VALIDATION_REPORT.md`, `PHASE_2A_GIT_BASELINE_AUDIT.md`, `PHASE_2A_2_FINAL_PRE_COMMIT_VALIDATION.md`, `PHASE_2A_3_STAGED_BASELINE_REVIEW.md`  

---

## Executive Summary

Phase 2A.4 investigated the root cause of the GitHub push rejection encountered during initial repository synchronization. The investigation was conducted in **strict read-only mode** with zero modifications to the Git repository, working tree, or frozen ML pipeline.

### Core Findings
1. **Push Rejection Cause:** GitHub rejected the push because `FieldWise_main/model/ml_pipeline/experiments/experiment_b_provisional/models/extra_trees_regressor.joblib` is **108.55 MB (113,820,769 bytes)**, exceeding GitHub's strict **100.00 MB** hard rejection limit. Five additional model files exceed GitHub's **50.00 MB** warning threshold (ranging from 68.29 MB to 92.61 MB).
2. **Remote State Unchanged:** A read-only query of `git ls-remote origin` confirmed that the remote repository remains **completely empty (0 refs)**. The push failed atomically; no partial refs, branches, or tags were written to GitHub.
3. **Commit History Structure:** The repository contains exactly two local commits:
   - `eda1a2e` (tagged `v1.0.0-baseline`): `chore: establish repository baseline after Phase 1 cleanup and pre-commit audit`
   - `3b46b5d` (`HEAD -> main`): `docs: add Phase 2A.3 staged baseline review`
4. **Frozen ML Pipeline Decoupling:** Comprehensive code and reference analysis confirmed that **zero `.joblib` model files are required by the runtime application**. The production recommendation engine (`recommendation_engine/`) is a deterministic, rule-and-knowledge-based agronomic system. The frozen verification script (`verify_phase_3b_2_cv.py`) evaluates only precomputed CSV/JSON metrics and does not load any `.joblib` models. The large model files are **offline, historical, reproducible experiment checkpoints** from Phase 3B.1 and Phase 3B.1.2.
5. **No Checksum Tracking:** None of the `.joblib` files are tracked in `.sha256` digest files or release verification manifests.
6. **Recovery Recommendation:** Two viable storage solutions are evaluated: **Git LFS** and **External Artifact Storage with Manifest**. A controlled recovery strategy is presented that retains the current baseline commit as an archival local reference, preserves all model files on disk in the local working directory, and produces a clean, pushable Git history.

---

## 1. Local & Remote Git State Inspection

### A. Local Working Tree & Commit History
```bash
$ git status --short
# (clean working tree)

$ git log --oneline --decorate -5
3b46b5d (HEAD -> main) docs: add Phase 2A.3 staged baseline review
eda1a2e (tag: v1.0.0-baseline) chore: establish repository baseline after Phase 1 cleanup and pre-commit audit

$ git show-ref --tags
35ae277cfe7bd9cc99109da6f96cc32a4a5b1d61 refs/tags/v1.0.0-baseline
```
- **Working Tree:** Completely clean against `HEAD`.
- **Commits:** Exactly 2 commits exist locally.
- **Tags:** Exactly 1 annotated tag exists locally (`v1.0.0-baseline` pointing to `eda1a2e`).

### B. Remote Inspection (`origin`)
```bash
$ git ls-remote origin
# (0 refs returned, exit code 0)
```
- **Reachability:** GitHub `origin` (`https://github.com/shivamrgn/ourfarmer.git`) is reachable.
- **Remote Refs:** Zero refs exist on GitHub.
- **Atomic Push Confirmation:** GitHub's pre-receive hook rejected the packfile before updating any references. No remote branches, tags, or dangling objects were created on GitHub. The remote repository remains pristine.

---

## 2. Complete Inventory of Tracked Large Files

All 688 tracked files in the repository history were inspected for byte size and categorized.

### A. Tracked Files Exceeding 50 MB

| # | File Path | Exact Bytes | Size (MB) | Git Blob SHA | File SHA-256 | GitHub Policy Status |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| **1** | `FieldWise_main/model/ml_pipeline/experiments/experiment_b_provisional/models/extra_trees_regressor.joblib` | 113,820,769 | **108.55 MB** | `519cf174...` | `14d6176fa8e6...` | **REJECTED (>100 MB Hard Limit)** |
| **2** | `FieldWise_main/model/ml_pipeline/experiments/experiment_a_prime/models/extra_trees_regressor.joblib` | 97,104,817 | **92.61 MB** | `c3881e91...` | `1aaa2c829e0b...` | **WARNING (>50 MB Recommended)** |
| **3** | `FieldWise_main/model/ml_pipeline/experiments/experiment_b_provisional/models/random_forest_regressor.joblib` | 87,102,433 | **83.07 MB** | `12c68faf...` | `8bfa03bf0c44...` | **WARNING (>50 MB Recommended)** |
| **4** | `FieldWise_main/model/ml_pipeline/experiments/experiment_a_prime/models/random_forest_regressor.joblib` | 77,317,345 | **73.74 MB** | `6c4acf9b...` | `42bc694cb20f...` | **WARNING (>50 MB Recommended)** |
| **5** | `FieldWise_main/model/ml_pipeline/experiments/phase_3b_1_2/experiment_b_provisional/models/random_forest_target_encoded.joblib` | 75,729,889 | **72.22 MB** | `cc67fc23...` | `040906de4174...` | **WARNING (>50 MB Recommended)** |
| **6** | `FieldWise_main/model/ml_pipeline/experiments/phase_3b_1_2/experiment_a_prime/models/random_forest_target_encoded.joblib` | 71,611,921 | **68.29 MB** | `e3fdf8d3...` | `54a541089def...` | **WARNING (>50 MB Recommended)** |

**Key Observation:** The 6 files above account for **498.48 MB** of binary data. All 6 are Scikit-Learn ensemble regressors (`ExtraTreesRegressor` and `RandomForestRegressor`) containing hundreds of unpruned decision trees serialized via Python `joblib`.

### B. Tracked Files Between 10 MB and 50 MB

| File Path | Size (MB) | Category / Purpose |
| :--- | :-: | :--- |
| `FieldWise_main/model/ml_pipeline/experiments/phase_3b_2/residual_cv_predictions_exp_b.csv` | **18.79 MB** | Level-1 Residual CV predictions (Exp B) |
| `FieldWise_main/model/ml_pipeline/experiments/phase_3b_1_2/experiment_b_provisional/models/xgboost_native_categorical.joblib` | **18.28 MB** | XGBoost model checkpoint (Exp B) |
| `FieldWise_main/model/ml_pipeline/experiments/phase_3b_1_2/experiment_a_prime/models/xgboost_native_categorical.joblib` | **17.11 MB** | XGBoost model checkpoint (Exp A') |
| `FieldWise_main/model/ml_pipeline/experiments/phase_3b_1_2/experiment_a_prime/models/random_forest_ohe.joblib` | **16.67 MB** | One-Hot Encoded Random Forest (Exp A') |
| `FieldWise_main/model/ml_pipeline/data/processed/cleaned_crop_yield.csv` | **15.40 MB** | Cleaned historical crop yield dataset (1997–2015) |
| `FieldWise_main/model/ml_pipeline/experiments/phase_3b_2/residual_cv_predictions_exp_a.csv` | **14.98 MB** | Level-1 Residual CV predictions (Exp A') |
| `FieldWise_main/model/ml_pipeline/experiments/phase_3b_1_2/experiment_a_prime/models/extra_trees_ohe.joblib` | **14.45 MB** | One-Hot Encoded Extra Trees (Exp A') |
| `FieldWise_main/model/ml_pipeline/experiments/phase_3b_1_2/experiment_b_provisional/models/random_forest_ohe.joblib` | **13.88 MB** | One-Hot Encoded Random Forest (Exp B) |
| `FieldWise_main/model/ml_pipeline/experiments/phase_3b_1_2/experiment_b_provisional/models/extra_trees_ohe.joblib` | **12.66 MB** | One-Hot Encoded Extra Trees (Exp B) |
| `FieldWise_main/model/ml_pipeline/experiments/phase_3b_2/level0_oof_residuals_exp_b.csv` | **12.31 MB** | Level-0 OOF residuals (Exp B) |
| `FieldWise_main/model/ml_pipeline/data/raw/agriculture_in_india.csv` | **11.91 MB** | Raw Ministry of Agriculture source dataset |

**Status:** None of these files exceed GitHub's 50 MB threshold. They push cleanly without warnings.

### C. Total Joblib Files in Repository
- **Total `.joblib` files:** 37 files
- **Total combined size:** **601.96 MB**
- **Distribution:**
  - `experiments/experiment_a_prime/models/`: 6 files (169.21 MB)
  - `experiments/experiment_b_provisional/models/`: 6 files (194.55 MB)
  - `experiments/phase_3b_1_2/experiment_a_prime/models/`: 7 files (117.62 MB)
  - `experiments/phase_3b_1_2/experiment_b_provisional/models/`: 7 files (118.55 MB)
  - `models/benchmark/`: 5 files (1.97 MB — all files < 1 MB)
  - Preprocessor joblibs: 6 files (0.06 MB)

---

## 3. Frozen ML Pipeline Inspection & Dependency Analysis

An exhaustive search across all source code, tests, and configuration files was conducted to determine how these `.joblib` files interact with the application.

```mermaid
graph TD
    subgraph Runtime Applications
        FE[FieldWise Frontend Web App] -->|HTTP POST /api/v2/predict| BE[Node.js Express Backend]
        BE -->|Child Process stdin/stdout| CLI[adapter_cli.py]
        CLI --> RE[CropRecommendationEngine]
        RE --> Rules[Agronomic Rules & Soil Taxonomy]
        RE --> STCR[STCR Fertilizer Registry]
        RE --> DCI[DCI Confidence Evaluator]
    end

    subgraph Offline Research Experiments
        TrainBaselines[train_yield_baselines.py] -.->|Saves| Joblibs[37 .joblib Models 602 MB]
        Train3B[train_yield_phase_3b_1_2.py] -.->|Saves| Joblibs
    end

    subgraph Verification Script
        Verify[verify_phase_3b_2_cv.py] -->|Reads| CSVs[Residual CSVs]
        Verify -->|Reads| JSONs[Decision Manifests JSON]
    end

    style Joblibs fill:#f96,stroke:#333,stroke-width:2px
    style RE fill:#9f9,stroke:#333,stroke-width:2px
```

### A. Production Runtime Decoupling
- **Frontend & Backend API:** The Node.js Express backend (`FieldWise_main/backend/`) executes `recommendationBridgeService.js`, which spawns Python subprocesses calling `adapter_cli.py`.
- **Recommendation Engine (`engine.py`):** The Python engine is an **expert agronomic rule-based system**. It imports:
  - `catalogue.py` (Canonical Crop Catalogue)
  - `input_validator.py` (Soil / climate parameter checks)
  - `planting_window.py` (Crop calendar logic)
  - `water_assessment.py` (Rainfall and irrigation scoring)
  - `tier1_eligibility.py` (Agronomic hard gates)
  - `tier2_scoring.py` (Multi-criteria agronomic ranking)
  - `dci_confidence.py` (Data Coverage Index)
  - `ranking.py` & `explanations.py` (Advisory generator)
- **Zero Runtime Joblib Imports:** Neither `adapter_cli.py` nor `engine.py` nor any runtime service imports `joblib` or loads any serialized machine learning model.

### B. Frozen Verification Script (`verify_phase_3b_2_cv.py`)
- **Check 1:** Verifies existence and SHA-256 of 4 JSON files (`crop_stratum_taxonomy.json`, `level0_oof_manifest.json`, `residual_cv_manifest.json`, `decision_manifest_cv.json`). **Does not check `.joblib` files.**
- **Check 2:** Verifies Level-0 OOF predictions from `level0_oof_residuals_exp_*.csv`.
- **Check 3:** Verifies Level-1 Residual CV predictions from `residual_cv_predictions_exp_*.csv`.
- **Check 3b:** Runs in-memory Candidate 2 fallback unit test fixtures.
- **Check 4:** Reads `decision_manifest_cv.json` and verifies P99 recomputations.
- **Check 5:** Whitelist invariant gate.
- **Conclusion:** The frozen verification script **does not read, verify, or require any `.joblib` model file**.

### C. Checksum Manifests
An exhaustive search across all 39 `.sha256` files in the repository confirmed:
- Zero `.joblib` files are tracked in `.sha256` digest manifests.
- Historical release packages (`Phase3C*.zip`) package documentation, reports, and code, not `.joblib` model binaries.

### D. Reproducibility & Classification
- **Classification:** Historical, provisional, offline training research checkpoints.
- **Reproducibility:** 100% reproducible. The training scripts `train_yield_baselines.py` and `train_yield_phase_3b_1_2.py` are versioned in Git along with the input training dataset `cleaned_crop_yield.csv` (15.4 MB) and random seed definitions.

---

## 4. Evaluation of Storage Options

| Evaluation Dimension | Option 1: Git LFS (Large File Storage) | Option 2: External Storage + Checksum Manifest |
| :--- | :--- | :--- |
| **Mechanism** | Replaces large binary blobs in Git trees with text pointers (~130 bytes); stores binaries on GitHub LFS servers. | Excludes `.joblib` files from Git tracking via `.gitignore`; tracks SHA-256 manifest in Git; stores binaries externally (or on GitHub Releases). |
| **GitHub Storage Quota** | Uses GitHub LFS quota. Free accounts include **1 GB storage**. Total `.joblib` files (602 MB) consume **~60% of free storage**. | **Zero LFS quota used**. GitHub Releases allows up to **2 GB per file release asset** completely free of LFS storage caps. |
| **GitHub Bandwidth Quota** | GitHub LFS has a **1 GB/month free bandwidth cap**. Pulling 602 MB once consumes 60% of monthly quota; 2 pulls exceed quota and lock LFS downloads for the entire account. | No bandwidth quota lockouts. GitHub Releases or standard HTTP downloads are unrestricted. |
| **Tooling Prerequisite** | Requires `git-lfs` CLI installed on every developer machine and CI/CD agent. | Requires only standard `git` and standard Python (`shasum -a 256`). |
| **Working Tree Impact** | Files remain in working tree as normal files. | Files remain **100% intact on disk in the developer's local working directory** (untracked by Git). |
| **Git Clone Speed** | Slower clone; downloads 600 MB of binaries during checkout unless smudge filters are disabled. | Fast clone; repository packfile is ~45 MB instead of 650 MB. |
| **Implementation Complexity** | Requires rewriting existing commits using `git lfs migrate import --include="*.joblib"`. | Requires adding `*.joblib` to root `.gitignore` and generating a `models_manifest.sha256`. |
| **Failure / Lockout Risk** | **High**: If monthly bandwidth (1 GB) is exceeded, GitHub blocks `git clone` / `git pull` across all repositories until data packs are purchased ($5/month). | **Zero**: Normal Git workflow is completely immune to LFS quotas or service outages. |

### Comparative Recommendation
While Git LFS is an established mechanism, **Option 2 (External Storage with SHA-256 Manifest)** is technically superior for this repository:
1. The `.joblib` files are not needed by the runtime application, frontend, backend, or verification scripts.
2. Placing 602 MB of model checkpoints in Git LFS will push the free GitHub account near its 1 GB storage limit and will quickly trip the strict 1 GB/month bandwidth limit during CI or developer pulls.
3. Keeping `.joblib` files untracked in Git while **retaining them untouched on local disk** provides immediate pushability, fast clones, zero recurring costs, and 100% data preservation.

---

## 5. Recommended Safe Recovery Strategy

Because Git commits are cryptographically immutable, commit `eda1a2e` contains the 108.55 MB blob. Even if a subsequent commit deletes the file, GitHub's server-side pre-receive hook inspects all commits in the push packfile and will reject any push where `eda1a2e` is present in the ancestry.

Therefore, establishing a clean initial history that excludes oversized blobs from the commit packfile is mathematically required.

### 5-Step Controlled Recovery Plan

```mermaid
sequenceDiagram
    participant Dev as Local Repository
    participant Git as Git Index & Refs
    participant GH as Remote GitHub (origin)

    Note over Dev,Git: Step 1: Preserve Current Commits
    Dev->>Git: Branch archival ref: git branch archive/baseline-with-joblibs
    Dev->>Git: Retag archival ref: git tag v1.0.0-baseline-raw eda1a2e

    Note over Dev,Git: Step 2: Update .gitignore & Generate Manifest
    Dev->>Git: Add *.joblib to root .gitignore
    Dev->>Git: Generate models_manifest.sha256 for all 37 .joblib files
    Dev->>Dev: All model files remain 100% intact in working tree

    Note over Dev,Git: Step 3: Rebuild Clean Pushable History
    Dev->>Git: Create clean initial baseline without .joblib blobs
    Dev->>Git: Point tag v1.0.0-baseline to clean baseline commit

    Note over Git,GH: Step 4: Verification & Push
    Git->>GH: git push -u origin main --tags (Total packfile ~45 MB, 0 errors)
    GH-->>Git: 200 OK (Clean baseline established on GitHub)
```

#### Step 1: Preserve Existing Commits & Tags as Historical Local References
To guarantee zero loss of audit evidence, the existing commits must be permanently preserved locally under archival ref names:
- Create an archival branch: `git branch archive/baseline-with-joblibs HEAD`
- Create an archival tag: `git tag v1.0.0-baseline-raw eda1a2e`
- Delete the rejected tag: `git tag -d v1.0.0-baseline`

#### Step 2: Exclude Joblib Files in `.gitignore`
Append to root `.gitignore`:
```gitignore
# Machine Learning Model Checkpoints (>50 MB binaries)
*.joblib
FieldWise_main/model/ml_pipeline/experiments/**/models/*.joblib
```

#### Step 3: Create Verifiable Cryptographic Manifest
Generate `FieldWise_main/model/ml_pipeline/experiments/models_manifest.sha256` containing exact byte sizes and SHA-256 digests for all 37 `.joblib` files. This ensures cryptographic provenance is versioned in Git without burdening the packfile with 602 MB of binaries.

#### Step 4: Local Working Tree Safety Guarantee
- **No model files will be deleted from the working tree.**
- `extra_trees_regressor.joblib` (108.55 MB) and all other 36 model files will remain on disk in their exact directories.
- They simply transition from being tracked Git objects to being ignored local artifacts.

#### Step 5: Establish Clean Baseline Commit & Tag
- Re-stage project files excluding `.joblib` (using the updated `.gitignore`).
- Create initial commit:
  `chore: establish repository baseline after Phase 1 cleanup (joblibs externalized)`
- Create baseline tag:
  `git tag -a v1.0.0-baseline -m "FieldWise baseline checkpoint (clean pushable history)"`
- Push to GitHub:
  `git push -u origin main --tags` (will succeed instantly, packfile size ~45 MB).

---

## 6. Readiness Decision

### Status: **`READY FOR CONTROLLED RECOVERY OPERATION`**

All investigation objectives are complete:
- Root cause identified with byte-level precision.
- Remote repository confirmed clean and empty.
- ML pipeline verified completely decoupled from model binaries.
- Safe recovery architecture formulated with zero file loss and full historical preservation.

### Strict Guardrail Reminder
In accordance with Phase 2A.4 rules:
- No commits, tags, resets, pushes, or file deletions were performed.
- All operations remain halted pending user review and authorization.
