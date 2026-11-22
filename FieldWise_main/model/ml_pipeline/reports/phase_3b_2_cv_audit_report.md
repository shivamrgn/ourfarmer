# FieldWise — Phase 3B.2 Residual Cross-Validation Audit & Candidate Comparison Report

**Generated**: 2026-11-19T05:09:46Z  
**Architecture Revision**: 3.5  
**Evaluation Scope**: Internal Level-1 Forward-Chaining Residual Cross-Validation ($D_{\text{OOF}}$ 2003–2011)  
**Holdout Preservation Status**: Final 2012–2013 Validation and 2014–2015 Test Targets strictly **UNTOUCHED / SEALED**.

---

## 1. Executive Summary & Candidate Selection

Level-1 residual temporal cross-validation evaluated five competing candidate model families over the 9-year out-of-fold base residual dataset ($D_{\text{OOF}}$ 2003–2011) across three forward-chaining evaluation blocks:
- **Split 1**: Train 2003–2005 ($H_1=6$ base) $\to$ Eval 2006–2007 (Exp A: 15,363 / Exp B: 19,547 rows)
- **Split 2**: Train 2003–2007 ($H_2=9$ base) $\to$ Eval 2008–2009 (Exp A: 14,901 / Exp B: 19,064 rows)
- **Split 3**: Train 2003–2009 ($H_3=11$ base) $\to$ Eval 2010–2011 (Exp A: 14,447 / Exp B: 18,165 rows)

### Primary Candidate Selection Results

| Metric / Dimension | Experiment A (Prime Only) | Experiment B (Prime + Provisional) |
| :--- | :---: | :---: |
| **Total Residual CV Evaluation Rows** | **44,711** | **56,776** |
| **Level-0 Base Challenger CV MAE** | 1.086207 t/ha | 0.958786 t/ha |
| **Candidate 0A (Global Shrunk Mean)** | 1.079792 t/ha ($q^*=0.5$) | **0.953951 t/ha** ($q^*=0.25$) |
| **Candidate 0B (Crop-Stratified Shrunk Mean)** | 1.081399 t/ha ($q^*=0.25$) | 0.955427 t/ha ($q^*=0.25$) |
| **Candidate 1 (Unweighted Ridge)** | 1.086207 t/ha ($\lambda^*=100.0, \alpha^*=0.0$) | 0.958786 t/ha ($\lambda^*=100.0, \alpha^*=0.0$) |
| **Candidate 1 (Equal-Crop Ridge)** | 1.086207 t/ha ($\lambda^*=100.0, \alpha^*=0.0$) | 0.958786 t/ha ($\lambda^*=100.0, \alpha^*=0.0$) |
| **Candidate 2 (Crop-Stratified Ridge)** | **1.077632 t/ha** ($\alpha^*=0.25$) | 0.958786 t/ha ($\alpha^*=0.0$) |
| **Winning Sole Primary Candidate** | **Candidate 2** | **Candidate 0A** |
| **Pooled CV Delta MAE Gain** | **-0.008575 t/ha** (-8.57 kg/ha) | **-0.004834 t/ha** (-4.83 kg/ha) |
| **Step 1 Rejection Condition Triggered** | **Yes** (Delta MAE > -0.020 t/ha) | **Yes** (Delta MAE > -0.020 t/ha) |
| **Final Residual CV Decision** | ❌ **NO_GO** | ❌ **NO_GO** |

---

## 2. Governance Decision Walkthrough & Rejection Root-Cause Analysis

Under Revision 3.5's two-step formal outcome taxonomy (§14.1), both Experiment A and Experiment B result in **NO-GO**:

### Experiment A (Prime Only): Outcome = NO-GO
- **Primary Winning Model**: Candidate 2 (Crop-Stratified Ridge Regressor with Fallback)
- **Base Challenger CV MAE**: 1.086207 t/ha
- **Stacked CV MAE**: 1.077632 t/ha
- **Delta MAE Gain**: -0.008575 t/ha (-8.57 kg/ha)
- **Step 1 Rejection Trigger**: Under Revision 3.5 Section 14.1, Step 1 Rejection is triggered if $\Delta\text{MAE} > -0.020\text{ t/ha}$ (minimum practical gain threshold of 20 kg/ha). Because $\Delta\text{MAE} = -0.008575\text{ t/ha} > -0.020\text{ t/ha}$, the model achieves only an 8.58 kg/ha improvement, which is below the required 20 kg/ha operational hurdle.
- **Decision**: ❌ **NO-GO**. The prior Experiment A GO outcome is completely eliminated.
- **Secondary Gates**:
  - P99 Tail Ratio: 0.988865 $\le 1.05$ (Passed)
  - Crop Harm Rate ($H_{\text{crop}}$): 11.54% (3/26) $\le 20.0\%$ (Passed)
  - Crop Coverage: 86.67% $\ge 80.0\%$ (Passed)

### Experiment B (Prime + Provisional): Outcome = NO-GO
- **Primary Winning Model**: Candidate 0A (Global Shrunk Mean with $q^*=0.25$)
- **Base Challenger CV MAE**: 0.958786 t/ha
- **Stacked CV MAE**: 0.953951 t/ha
- **Delta MAE Gain**: -0.004834 t/ha (-4.83 kg/ha)
- **Step 1 Rejection Trigger**: $\Delta\text{MAE} = -0.004834\text{ t/ha} > -0.020\text{ t/ha}$, achieving only a 4.83 kg/ha improvement, failing the minimum 20 kg/ha improvement threshold.
- **Decision**: ❌ **NO-GO**.
- **Secondary Gates**:
  - P99 Tail Ratio: 1.001667 $\le 1.05$ (Passed)
  - Crop Harm Rate ($H_{\text{crop}}$): 2.08% (1/48) $\le 20.0\%$ (Passed)
  - Crop Coverage: 80.00% $\ge 75.0\%$ (Passed)

---

## 3. Protected Food-Security Staples Governance (§13.1, §13.2)

Observation-weighted paired multiplicity cluster bootstrap ($B=2,000$ replicates, seed 42) across state-qualified district clusters:

### Experiment A Protected Staples
| Staple Crop | N (CV Eval) | District Clusters ($M_c$) | Cluster Tier | Point $\Delta\text{MAE}$ | 95% Bootstrap CI | Step 1 Reject ($> +0.050$) |
| :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| **Rice** | 3815 | 452 | ROBUST_CLUSTER_COUNT | -0.006754 t/ha | `[-0.0088, -0.0047]` | False |
| **Wheat** | 2157 | 396 | ROBUST_CLUSTER_COUNT | -0.006988 t/ha | `[-0.0089, -0.0050]` | False |
| **Gram** | 2000 | 374 | ROBUST_CLUSTER_COUNT | -0.003657 t/ha | `[-0.0048, -0.0025]` | False |
| **Arhar/Tur** | 2048 | 375 | ROBUST_CLUSTER_COUNT | -0.003690 t/ha | `[-0.0051, -0.0024]` | False |

### Experiment B Protected Staples
| Staple Crop | N (CV Eval) | District Clusters ($M_c$) | Cluster Tier | Point $\Delta\text{MAE}$ | 95% Bootstrap CI | Step 1 Reject ($> +0.050$) |
| :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| **Rice** | 3815 | 452 | ROBUST_CLUSTER_COUNT | -0.010283 t/ha | `[-0.0119, -0.0086]` | False |
| **Wheat** | 2157 | 396 | ROBUST_CLUSTER_COUNT | -0.015934 t/ha | `[-0.0179, -0.0139]` | False |
| **Gram** | 2000 | 374 | ROBUST_CLUSTER_COUNT | -0.006111 t/ha | `[-0.0082, -0.0040]` | False |
| **Arhar/Tur** | 2048 | 375 | ROBUST_CLUSTER_COUNT | +0.003190 t/ha | `[+0.0010, +0.0053]` | False |

---

## 4. Disjoint Prediction Reconciliation & Denominator Parity

All evaluation rows across all splits satisfy the additive disjoint identity without missing or duplicated rows:
- **Experiment A**:
  - Expected Rows: 44,711
  - Primary Candidate Predictions Generated: 44711
  - Cross-candidate metric denominator parity: exactly 44,711 observations across all candidate models.
  - Finite metrics verified: 100% finite.
- **Experiment B**:
  - Expected Rows: 56,776
  - Primary Candidate Predictions Generated: 56776
  - Cross-candidate metric denominator parity: exactly 56,776 observations across all candidate models.
  - Finite metrics verified: 100% finite.

---

## 5. Final Holdout Preservation Confirmation

- **2012–2013 Validation Partition**: Zero validation records were predicted, evaluated, or inspected during this development step.
- **2014–2015 Test Holdout**: Strictly sealed; zero test targets or features were loaded, streamed, or accessed.
