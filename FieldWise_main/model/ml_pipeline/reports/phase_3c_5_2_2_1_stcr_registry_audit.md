# FieldWise — Phase 3C.5.2.2.1: STCR Calibration Registry Audit & Governance

## 1. Executive Summary & Audit Rationale

Soil Test Crop Response (STCR) targeted yield equations calculate site-specific fertilizer doses using multi-variable polynomial functions:

$$\text{FN} = c_{n,t} \cdot T - c_{n,sn} \cdot \text{SN}$$
$$\text{FP} = c_{p,t} \cdot T - c_{p,sp} \cdot \text{SP}$$
$$\text{FK} = c_{k,t} \cdot T - c_{k,sk} \cdot \text{SK}$$

In Phase 3C.5.2.2, a local dictionary of STCR calibration records (`STCR-PB-WHT-2024-01`, `STCR-HAR-WHT-2024-01`, `STCR-WB-RIC-2024-01`) was introduced into `stcr_registry.py`. The independent review of Phase 3C.5.2.2 raised a critical finding: **a record cannot be claimed as officially approved or validated merely because it exists in a local codebase registry.**

Without audited primary source documents, independently verified multi-location trial reports, certified regression coefficients, and formal institutional sign-offs, storing hard-coded calibrations creates an unsubstantiated epistemic claim of official validation.

---

## 2. Audit of Previous Registry Records

An exhaustive evidence audit was conducted on the three calibration records previously present in `stcr_registry.py`:

| Calibration ID | Target Crop | Claimed Region | Claimed Source Institution | Audit Finding & Verification Status | Action Enacted in Phase 3C.5.2.2.1 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `STCR-PB-WHT-2024-01` | Wheat | Punjab, Haryana | ICAR-IARI / PAU Ludhiana | Primary experimental trial data ($R^2 > 0.88$) and formal ICAR validation certificate not independently archived in workspace. | **REMOVED** from active approved registry. |
| `STCR-HAR-WHT-2024-01` | Wheat | Haryana | CCS HAU Hisar STCR Center | Trial location coordinates, soil series boundary maps, and official bulletin publication not verified. | **REMOVED** from active approved registry. |
| `STCR-WB-RIC-2024-01` | Rice | West Bengal, Bihar | BCKV / ICAR-NRRI | Alluvial zone calibration data and cultivar-specific coefficients unverified against primary ICAR STCR project reports. | **REMOVED** from active approved registry. |

---

## 3. Empty Registry Governance Baseline

In accordance with Phase 3C.5.2.2.1 safety mandates:
1. **Empty Registry Baseline**: Until genuine, peer-reviewed multi-location calibration evidence is comprehensively audited, verified, and approved, the registry contains **zero approved calibrations**:
   ```python
   _APPROVED_CALIBRATIONS: Dict[str, STCRCalibrationRecord] = {}
   ```
2. **Zero Inventions**: The engine strictly prohibits fabricating coefficients, inventing publication titles, or asserting unverified institutional approvals.
3. **Rejection of Unregistered Records**: Any user-supplied or query-referenced calibration ID (including former demo IDs) is rejected at the registry integrity gate.
4. **Transparent Audit Notes**: When an unregistered STCR calibration ID or record is supplied in a recommendation query, the engine appends an explicit explanation to `stoichiometric_notes`:
   `[STCR Calibration Rejected: Unregistered calibration ID '<id>'. User input cannot promote an unregistered or fabricated record to verified STCR status. Only reviewed calibrations in STCRCalibrationRegistry (v1.0.0) are accepted.]`

---

## 4. Safe Production Fallback: Baseline RDF Arithmetic

When an STCR calibration cannot be independently established, the engine safely falls back to **Baseline Package of Practices (POP) RDF Arithmetic**:

1. **State POP Baselines**: Uses official state Package of Practices Recommended Dose of Fertilizers (RDF) in elemental nutrient ratio ($\text{N}:\text{P}_2\text{O}_5:\text{K}_2\text{O}\text{ kg/ha}$).
2. **Mandatory DAP Nitrogen Credit Deduction**:
   - Di-Ammonium Phosphate (DAP) contains $46\%\text{ P}_2\text{O}_5$ and $18\%\text{ N}$.
   - Physical DAP applied: $\text{DAP} = \text{Dose}_{\text{P}_2\text{O}_5} / 0.46$.
   - Nitrogen supplied by DAP: $\text{N}_{\text{DAP}} = \text{DAP} \times 0.18$.
   - Net supplementary Nitrogen required: $\text{N}_{\text{supp}} = \max(0.0, \text{Dose}_{\text{N}} - \text{N}_{\text{DAP}})$.
   - Supplementary Urea applied: $\text{Urea} = \text{N}_{\text{supp}} / 0.46$.
   - Muriate of Potash applied: $\text{MOP} = \text{Dose}_{\text{K}_2\text{O}} / 0.60$.
3. **Prevention of Physical Over-Application**: For example, in UP/Punjab Wheat ($\text{RDF } 120:60:40$), applying $130.4\text{ kg/ha}$ DAP supplies $23.5\text{ kg/ha}$ N. Net supplementary Urea is $209.8\text{ kg/ha}$ (instead of $260.9\text{ kg/ha}$ uncredited Urea), preventing $51.1\text{ kg/ha}$ of toxic nitrogen over-fertilization.

---

## 5. Prerequisites for Future STCR Calibration Registration

Before any calibration record can be admitted to `STCRCalibrationRegistry._APPROVED_CALIBRATIONS`, the following four evidentiary gates must be satisfied:
1. **Primary Document Archival**: Full-text PDF of the peer-reviewed journal article or official State Agricultural University / ICAR Package of Practices bulletin archived in `references/`.
2. **Trial Provenance**: Multi-location field trial data spanning at least 3 cropping seasons with documented coefficient of determination ($R^2 \ge 0.80$).
3. **Boundary Verification**: Documented target yield validity range $[T_{\min}, T_{\max}]$ and applicable soil series / agro-climatic zones.
4. **Independent Review Approval**: Explicit sign-off from an independent agronomic review panel confirming mathematical and biological safety.
