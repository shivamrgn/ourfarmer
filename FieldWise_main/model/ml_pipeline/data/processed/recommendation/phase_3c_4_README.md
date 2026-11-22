# FieldWise Phase 3C.4: Recommendation Engine Safety Redesign Specification
## Effective Rainfall and Rainfed Water Reconciliation Summary (Phase 3C.4.2.2.1)

**Version**: 1.5.0-FINAL-WATER-RECONCILIATION  
**Date**: November 20, 2026  
**Status**: APPROVED DESIGN-ONLY SPECIFICATION (Preservation Rules Enforced)  

---

### Core Agronomic & Mathematical Invariants
1. **Effective Rainfall Monthly USDA-SCS Formulation**:
   - Monthly USDA-SCS equation: $P_m \le 250 \implies P_m(125 - 0.2P_m)/125$; $P_m > 250 \implies 125 + 0.1P_m$.
   - Seasonal Effective Rainfall: $P_{{\text{{eff,seasonal}}}} = \sum_{{m=1}}^N P_{{\text{{eff}},m}}$.
   - Direct application of monthly formula to seasonal totals is prohibited.
   - Example A (1,150 mm West Bengal Rice): Monthly sum = $589.0\text{ mm}$; invalid seasonal application = $240.0\text{ mm}$ (delta $349.0\text{ mm}$).
   - Missing monthly distribution returns `UNKNOWN` effective rain and provisional status.
2. **Corrected Rainfed Status Semantics**:
   - Rainfall exceeding screening threshold sets `SCREENING_THRESHOLD_MET` (never automatic `PASS_VERIFIED`).
   - Rainfall below threshold sets `WATER_DEFICIT_WARNING` and Tier 2 Liebig soft penalty.
   - Rainfed screening thresholds NEVER independently produce `HARD_EXCLUSION` or Tier 1 FAIL.
3. **Residual Soil Moisture Accounting**:
   - 4 Epistemic Tiers: `MEASURED`, `SOURCE_BACKED_ESTIMATED`, `PROVISIONAL`, `UNKNOWN`.
   - Deep Vertisol storage capacity: $AWC = 200\text{ mm/m} \times 1.2\text{ m} = 240.0\text{ mm}$.
   - Unmeasured soil moisture is never fabricated.
4. **Hard-Exclusion Re-Audit (Strict Biological Lethality)**:
   - 0 candidate rules retained as `HARD_EXCLUSION`; 61 downgraded to `SOFT_PENALTY`.
   - Eligibility matrix: 0 `HARD_EXCLUSION`, 87 `SOFT_PENALTY`, 8 `WARNING_ONLY`, 4 `UNKNOWN`, 1 `NOT_APPLICABLE` (100 total).
5. **Orthogonal 6-Domain DCI Model**:
   - $DCI = 0.15 + 0.20 + 0.25 + 0.15 + 0.10 + 0.15 = 1.000$.
6. **Architectural Separation in Validator**:
   - 10 Specification Integrity Checks: PASSED.
   - Functional Acceptance Tests: NOT RUN — ENGINE NOT IMPLEMENTED (DESIGN-ONLY PHASE).
7. **Historical Manifest Preservation**:
   - `phase_3c_4_checksums.txt`, `phase_3c_4_1_checksums.txt`, `phase_3c_4_2_checksums.txt`, `phase_3c_4_2_1_checksums.txt`, and `phase_3c_4_2_2_checksums.txt` preserved read-only with cryptographic immutability assertions.
