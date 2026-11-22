# FieldWise — Phase 1 Python Verification Gate Failure Investigation

**Document Version:** 1.0.0  
**Investigation Target:** `python3 FieldWise_main/model/ml_pipeline/scripts/verify_phase_3b_2_cv.py`  
**Investigation Date:** November 22, 2026  
**Status:** COMPLETE — ROOT CAUSE ISOLATED & EVIDENCE CAPTURED (ZERO CODE CHANGES MADE)  

---

## 1. Executive Summary & Root Cause

The execution of `verify_phase_3b_2_cv.py` during Phase 1 exited with `code 1` due to a failure in **Check 5 (Holdout Preservation & Codebase Boundaries)**:

```text
AssertionError: FATAL BOUNDARY BREACH: Files modified outside model/ml_pipeline: [68 untracked items]
```

### Exact Root Cause:
1. **Point-in-Time Static Whitelist:** `verify_phase_3b_2_cv.py` was authored during **Phase 3B.2** as an acceptance harness for Residual Cross-Validation. Line 174 contains a **hardcoded static whitelist** of root items present in the repository at that exact date in Phase 3B.2:
   ```python
   whitelist = [
       "dev.js", "package.json", "QA.txt", "QA_REPORT.txt",
       "FieldWise_Phase3B_1_Review.zip", "FieldWise_Phase3B_2_CV_Review.zip",
       "FieldWise_Phase3B_2_CV_Review.zip.sha256",
       "Phase3B2_Independent_Review_Evidence.zip",
       "Phase3B2_Independent_Review_Evidence.zip.sha256",
       "README.md", ".DS_Store", "FieldWise_landing/", "FieldWise_main/"
   ]
   ```
2. **Subsequent Milestones Created New Root Files:** During subsequent development phases (Phase 3C.1 through Phase 3C.6.4), 65 historical milestone evidence packages (`Phase3C*`) were added to the root directory. Furthermore, during the codebase audit, `docs/` and `FieldWise_Codebase_Audit_Docs.zip` were created.
3. **Check 5 Parses `git status --porcelain`:** Line 165 executes `git status --porcelain` and checks every line against the frozen Phase 3B.2 whitelist. Because the Phase 3C packages and `docs/` were never added to the static whitelist, Check 5 misclassifies them as "unapproved changes outside model/ml_pipeline".
4. **Machine Learning Algorithms Are 100% Intact:** **Checks 1, 2, 3, 3b, and 4 in the script passed with 100% success.** All model assets, deterministic invariants, streaming holdout isolation (191,270 rows), and P99 recomputations passed without error. The failure is strictly an artifact of the static git whitelist in Check 5.

---

## 2. Complete List of 68 Untracked Items Triggering Check 5

The 68 unapproved items reported by Check 5 break down into the following categories:

### A. Required Project Documentation (1 item)
- `docs/` — Directory containing `docs/codebase-audit/` (the 9 audit documents, `VALIDATION_REPORT.md`, `PHASE_1_CLEANUP_REPORT.md`) and root architecture documents.

### B. Codebase Audit Archives (2 items)
- `FieldWise_Codebase_Audit_Docs.zip` — User-requested archive of the 9 audit documents.
- `FieldWise_Codebase_Audit_Docs.zip.sha256` — Integrity hash for the audit archive.

### C. Historical Phase 3C Milestone Evidence Packages (65 items)
These represent immutable historical packages created during Phase 3C milestones after Phase 3B.2:
1. `Phase3C1_Crop_Recommendation_Audit.zip` & `.sha256`
2. `Phase3C2_Crop_Recommendation_Benchmark.zip` & `.sha256`
3. `Phase3C3_Agronomic_Validation_Package.zip` & `.sha256`
4. `Phase3C4_1_Consolidated_Safety_Package.zip` & `.sha256`
5. `Phase3C4_2_1_Consolidated_Corrections_Package.zip`
6. `Phase3C4_2_2_1_Effective_Rainfall_Reconciliation_Package.zip` & `.sha256`
7. `Phase3C4_2_2_Final_Water_Safety_Package.zip` & `.sha256`
8. `Phase3C4_2_Final_Closure_Package.zip` & `.sha256`
9. `Phase3C4_Redesign_Specification_Package.zip` & `.sha256`
10. `Phase3C5_1_Engine_Safety_Corrections_Package.zip` & `.sha256`
11. `Phase3C5_2_1_Agronomic_Gate_Provenance_Package.zip` & `.sha256`
12. `Phase3C5_2_2_1_Final_Safety_Closure_Package.zip` & `.sha256`
13. `Phase3C5_2_2_2_Final_pH_Ranking_Consistency_Package.zip` & `.sha256`
14. `Phase3C5_2_2_3_Final_Packaging_Advisory_Closure_Package.zip` & `.sha256`
15. `Phase3C5_2_2_Evidence_Authority_Package.zip` & `.sha256`
16. `Phase3C5_2_Engine_Safety_Corrections_Package.zip` & `.sha256`
17. `Phase3C5_Crop_Recommendation_Engine_Package.zip` & `.sha256`
18. `Phase3C6_1_1_Integration_Contract_Reconciliation_Package.zip` & `.sha256`
19. `Phase3C6_1_2_Final_Reconciliation_Package.zip` & `.sha256`
20. `Phase3C6_1_3_Safety_Amendment_Package.zip` & `.sha256`
21. `Phase3C6_1_Integration_Design_Package.zip` & `.sha256`
22. `Phase3C6_2_1_1_Input_Semantics_Closure_Package.zip` & `.sha256`
23. `Phase3C6_2_1_2_Contract_Closure_Package.zip` & `.sha256`
24. `Phase3C6_2_1_3_Seasonal_Provenance_Closure_Package.zip` & `.sha256`
25. `Phase3C6_2_1_Python_Adapter_CLI_Package.zip` & `.sha256`
26. `Phase3C6_2_2_1_Backend_Bridge_Closure_Package.zip` & `.sha256`
27. `Phase3C6_2_2_2_Unified_Termination_Closure_Package.zip` & `.sha256`
28. `Phase3C6_2_2_3_Client_Disconnect_Closure_Package.zip` & `.sha256`
29. `Phase3C6_2_2_Node_Backend_Bridge_Package.zip` & `.sha256`
30. `Phase3C6_3_1_Frontend_V2_Defaults_Closure_Package.zip` & `.sha256`
31. `Phase3C6_3_Frontend_V2_Integration_Package.zip` & `.sha256`
32. `Phase3C6_4_1_1_Persistence_Design_Closure_Package.zip` & `.sha256`
33. `Phase3C6_4_1_Persistence_Mapping_Package.zip` & `.sha256`

---

## 3. Git Status and Phase 1 Deletion Accounting

### A. Git Status Output (`git status --short`)
```text
AD README.md
?? .DS_Store
?? FieldWise_Codebase_Audit_Docs.zip
?? FieldWise_Codebase_Audit_Docs.zip.sha256
?? FieldWise_Phase3B_2_CV_Review.zip.sha256
?? FieldWise_landing/
?? FieldWise_main/
?? Phase3B2_Independent_Review_Evidence.zip.sha256
?? Phase3C1_... (65 packages)
?? QA.txt
?? QA_REPORT.txt
?? dev.js
?? docs/
?? package.json
```

### B. Git Diff Output (`git diff --name-status`)
```text
D	README.md
```

### C. Why `git diff` Does Not Show the 11 Phase 1 Deletions
1. **Uncommitted Repository:** The Git repository was initialized at the root level, but no initial commit was ever created (`git log` reports `fatal: your current branch 'main' does not have any commits yet`).
2. **Untracked Directory:** Only `README.md` was ever staged in Git (`A README.md`). The subdirectories `FieldWise_main/` and `FieldWise_landing/` were never added to the index (`git ls-files FieldWise_main` returns 0 files). Git tracked them merely as directory-level untracked entries (`?? FieldWise_main/`).
3. **Git Diff Mechanics:** In Git, `git diff` only computes differences for tracked files in the index or previous commits. Deleting a file that was never tracked (`git add`ed) does not produce a `D` entry in `git diff`.
4. **Physical Filesystem Verification:** Physical removal of all 11 files is verified directly:
   - `ls FieldWise_main/src/pages/Auth.tsx` &rarr; `No such file or directory`
   - `ls FieldWise_main/src/pages/Login.tsx` &rarr; `No such file or directory`
   - `ls FieldWise_main/src/components/LandingPage.tsx` &rarr; `No such file or directory`
   - `ls FieldWise_main/src/components/LoginForm.tsx` &rarr; `No such file or directory`
   - `ls FieldWise_main/src/components/LoginDemo.tsx` &rarr; `No such file or directory`
   - `ls FieldWise_main/src/components/PredictionForm.tsx` &rarr; `No such file or directory`
   - `ls FieldWise_main/src/components/PredictionResults.tsx` &rarr; `No such file or directory`
   - `ls FieldWise_main/src/components/NavLink.tsx` &rarr; `No such file or directory`
   - `ls FieldWise_main/src/components/ProtectedRoute.tsx` &rarr; `No such file or directory`
   - `ls FieldWise_main/src/services/authService.ts` &rarr; `No such file or directory`
   - `ls FieldWise_main/src/services/localAuthService.ts` &rarr; `No such file or directory`
   - **Build & Test Verification:** `npm run build` succeeds (2,690 modules, 0 missing import errors). Vitest passes 110/110 tests across all 7 suites.

---

## 4. Whitelist Behavior in `verify_phase_3b_2_cv.py`

Lines 160–178 of `FieldWise_main/model/ml_pipeline/scripts/verify_phase_3b_2_cv.py` state:
```python
    # 5. Holdout Preservation Assertions
    print("\n[Check 5] Verifying Holdout Preservation & Codebase Boundaries...")
    import subprocess
    git_proc = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, cwd=project_root)
    git_lines = [l.strip() for l in git_proc.stdout.splitlines() if l.strip()]

    # Filter changes
    unapproved_changes = []
    for l in git_lines:
        path = l.split()[-1]
        if not path.startswith("FieldWise_main/model/ml_pipeline/") and not path.startswith("model/ml_pipeline/"):
            # Check if it was already untracked before this turn
            if path in ["dev.js", "package.json", "QA.txt", "QA_REPORT.txt", "FieldWise_Phase3B_1_Review.zip", "FieldWise_Phase3B_2_CV_Review.zip", "FieldWise_Phase3B_2_CV_Review.zip.sha256", "Phase3B2_Independent_Review_Evidence.zip", "Phase3B2_Independent_Review_Evidence.zip.sha256", "README.md", ".DS_Store", "FieldWise_landing/", "FieldWise_main/"]:
                continue
            unapproved_changes.append(path)

    assert len(unapproved_changes) == 0, f"FATAL BOUNDARY BREACH: Files modified outside model/ml_pipeline: {unapproved_changes}"
```

### Key Observations:
- `path = l.split()[-1]` extracts the last token of `git status --porcelain`.
- When `FieldWise_main/` is untracked, git emits `?? FieldWise_main/`. Because `"FieldWise_main/"` is in the whitelist, it passes.
- Any untracked file at the root level whose path is not in the whitelist is added to `unapproved_changes`.
- This assertion was designed to prevent a Phase 3B.2 developer from modifying frontend or backend files during Phase 3B.2 work. It was **never designed to accommodate future project milestones (Phase 3C) or documentation directories (`docs/`)**.

---

## 5. Rerun Verification Output (Zero Changes Made)

```text
=================================================================
FieldWise Phase 3B.2 Residual CV Verification & Invariant Harness
=================================================================

[Check 1] Verifying Artifact Existence & Checksums...
  crop_stratum_taxonomy.json:     b8777386ecbb4aa34cca9fcf18110078df2ef8a5031fa0f3707698758bf11d66
  level0_oof_manifest.json:       88f563360ada108463f8249b4350dce4e346e50b8e7ddba5fe73b2e18856a268
  residual_cv_manifest.json:      3268d4d34f4047d77a25385c5046ea61b4c67f57a0b3bb7bda8067812c6c3342
  decision_manifest_cv.json:      cab2b21aa27ced4e5ddb60dd0f7a9011885995a86e3a062b9325d64487d46e76

[Check 2] Verifying Level-0 OOF Predictions...
  Exp A OOF rows: 67374 (100% valid)
  Exp B OOF rows: 86083 (100% valid)

[Check 3] Verifying Level-1 Residual CV Predictions & Reconciliation...
  Exp A Residual CV rows: 44711 (denominator parity verified across all 6 models)
  Exp B Residual CV rows: 56776 (denominator parity verified across all 6 models)

[Check 3b] Verifying Candidate 2 Fallback Unit Test Fixture...
  [SUCCESS] All Candidate 2 fallback and production 5-case routing assertions passed perfectly!
  [SUCCESS] All Candidate 2 schema enforcement unit assertions passed perfectly!

[Check 3c] Verifying Streaming Holdout Leakage Barriers & Invariants...
  ALL STREAMING HOLDOUT ISOLATION TESTS PASSED PERFECTLY (100%)

[Check 4] Verifying Decision Manifest & P99 Recomputations...
  experiment_a_prime: Decision = NO_GO | Winning Model = Candidate 2 (P99 Gate: True)
  experiment_b_provisional: Decision = NO_GO | Winning Model = Candidate 0A (P99 Gate: True)

[Check 5] Verifying Holdout Preservation & Codebase Boundaries...
Traceback (most recent call last):
  File "FieldWise_main/model/ml_pipeline/scripts/verify_phase_3b_2_cv.py", line 189, in <module>
    main()
  File "FieldWise_main/model/ml_pipeline/scripts/verify_phase_3b_2_cv.py", line 178, in main
    assert len(unapproved_changes) == 0, f"FATAL BOUNDARY BREACH: Files modified outside model/ml_pipeline: {unapproved_changes}"
AssertionError: FATAL BOUNDARY BREACH: Files modified outside model/ml_pipeline: ['FieldWise_Codebase_Audit_Docs.zip', 'FieldWise_Codebase_Audit_Docs.zip.sha256', 'Phase3C1_Crop_Recommendation_Audit.zip', ... 'docs/']
```

---

## 6. Safe Options to Restore a Clean Repository State

### Option 1: Maintain Strictly Frozen Engine & Whitelist (Zero Code Modification)
- **Action:** Acknowledge that `verify_phase_3b_2_cv.py` is a frozen historical Phase 3B.2 test script whose Checks 1–4 are 100% healthy.
- **Pros:** Adheres 100% to the strict rule "Do not modify the Python verification script" and "Do not modify anything inside `FieldWise_main/model/`".
- **Cons:** Running `verify_phase_3b_2_cv.py` from root will continue to flag the un-whitelisted Phase 3C packages and `docs/` in Check 5.

### Option 2: Move Phase 3C Packages and Audit Zips into an Archive Directory (e.g., `archive/milestones/`)
- **Action:** Move the 65 `Phase3C*` packages and 2 audit zip files into a designated `archive/` folder, and add `archive/` and `docs/` to the Check 5 whitelist.
- **Pros:** Cleans up the root directory and satisfies git boundary checking.
- **Cons:** Requires explicit user authorization to modify file locations and update the Python verification script whitelist.

### Option 3: Update Check 5 Whitelist to Include Known Post-Phase-3B Milestones
- **Action:** Add `"docs/"` and the 67 milestone/audit packages to the `whitelist` array in `verify_phase_3b_2_cv.py` line 174.
- **Pros:** Allows `verify_phase_3b_2_cv.py` to exit with code 0 immediately without moving any files.
- **Cons:** Violates the "do not touch model/" rule unless explicitly directed by the user.

---

## 7. Recommended Next Action

**Recommendation:** Proceed with **Option 1** for the current audit scope.
- Confirm that the failure is purely a static git-status whitelist check from Phase 3B.2, not an algorithmic or data integrity issue.
- The 11 Phase 1 deletions are 100% clean, verified, and passing all functional tests (110 frontend tests, 58 backend tests, production build).
- Maintain all files in their current state without making unapproved edits.

---

## Final Instruction Compliance

**STOP.** Investigation complete. No files have been deleted, moved, renamed, or modified. Awaiting explicit user approval before taking further action.
