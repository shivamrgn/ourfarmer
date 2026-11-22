# FieldWise — Phase 3C.5.2.1: Structured STCR Calibration Specification & Verification Contract

**Document ID**: `FW-P3C521-STCR-01`  
**Engine Version**: `2.2.3-CLOSURE`  
**Phase**: `3C.5.2.1 (Agronomic Gate and Verification Provenance Closure)`  
**Status**: `APPROVED_SPECIFICATION`  
**Date**: `2026-11-20`  

---

## 1. Objective & Problem Statement

Phase 3C.5.2 audit findings revealed that in previous implementations:
1. A simple Boolean flag (`has_stcr_calibration = True`) combined with a floating-point target yield value was capable of triggering a `VERIFIED_STCR_GENERATED` prescription label.
2. The engine lacked a formal schema to store and validate the actual polynomial calibration coefficients ($a_1, a_2, b_1, b_2, c_1, c_2$), the institutional source, the publication citation, the target yield domain of validity, and the geographic applicability.
3. This enabled fabricated or uncalibrated claims to masquerade as verified Soil Test Crop Response (STCR) recommendations, violating our core scientific transparency and evidentiary integrity mandates.

This specification formalizes the `STCRCalibrationRecord` data contract, implements rigorous multi-field validation, and defines the fallback mechanisms to `BASELINE_RDF_ARITHMETIC` whenever calibration is missing, incomplete, unvalidated, or mismatched.

---

## 2. STCR Calibration Record Schema Definition

The canonical data contract is formalized in `recommendation_engine/schemas.py`:

```python
@dataclass
class STCRCalibrationRecord:
    """
    Structured STCR Targeted Yield Calibration Record.
    Requires complete provenance, applicability constraints, and verified coefficients.
    """
    calibration_id: str                      # Unique calibration identifier (e.g. 'STCR-PB-WHT-2024-01')
    crop_id: str                             # Target canonical crop ID (e.g. 'wheat')
    applicable_regions: List[str]            # List of validated states/zones (e.g. ['Punjab', 'Haryana'])
    source_institution: str                  # Accredited research center (e.g. 'ICAR-IARI / PAU Ludhiana')
    publication_reference: str               # Peer-reviewed journal or university Package of Practices bulletin
    coefficients: Dict[str, float]           # Polynomial coefficients: fn_t, fn_sn, fp_t, fp_sp, fk_t, fk_sk
    coefficient_units: str                   # Engineering units of coefficients
    target_yield_min_t_ha: float             # Minimum boundary of calibrated yield envelope
    target_yield_max_t_ha: float             # Maximum boundary of calibrated yield envelope
    validation_status: str                   # Must be 'VALIDATED' or 'OFFICIALLY_VERIFIED'
    validation_evidence: str                 # Documented multi-location validation trial summary
```

---

## 3. Strict Validation Contract

In `recommendation_engine/explanations.py`, the method `validate_stcr_calibration` enforces eight sequential verification gates before any recommendation can be designated as `VERIFIED_STCR_GENERATED`:

| Gate | Check | Rejection Action on Failure | Failure Rationale |
| :--- | :--- | :--- | :--- |
| **G1: Existence** | `record is not None` | Reject to `BASELINE_RDF_ARITHMETIC` | Raw Boolean flag `has_stcr_calibration=True` without structured record is rejected as a fabricated claim. |
| **G2: Type Safety** | `isinstance(record, STCRCalibrationRecord)` | Reject to `BASELINE_RDF_ARITHMETIC` | Malformed objects, raw dictionaries, or primitive strings are rejected. |
| **G3: Completeness** | All fields non-empty (`calibration_id`, `source_institution`, `publication_reference`, `validation_status`, `validation_evidence`) | Reject to `BASELINE_RDF_ARITHMETIC` | Records lacking traceable institutional provenance or validation evidence cannot establish verified status. |
| **G4: Validation Status** | `validation_status in ['VALIDATED', 'OFFICIALLY_VERIFIED']` | Reject to `BASELINE_RDF_ARITHMETIC` | Provisional, draft, or unverified calibrations are strictly rejected. |
| **G5: Crop Match** | `record.crop_id.lower() == crop_id.lower()` | Reject to `BASELINE_RDF_ARITHMETIC` | Calibrations developed for one crop (e.g., Wheat) cannot be applied to another (e.g., Rice). |
| **G6: Region Match** | `query_state.lower() in applicable_regions` or `'all india' in applicable_regions` | Reject to `BASELINE_RDF_ARITHMETIC` | Calibrations calibrated for specific agro-climatic zones (e.g., Indo-Gangetic Alluvium in Punjab) cannot be extrapolated to unrelated soils (e.g., Alfisols in Tamil Nadu). |
| **G7: Target Yield Range** | `target_yield_min_t_ha <= target_yield_t_ha <= target_yield_max_t_ha` | Reject to `BASELINE_RDF_ARITHMETIC` | Extrapolation beyond the experimentally validated yield curve induces severe nutrient toxicities or crop lodging. |
| **G8: Coefficient Set** | Required keys present: `fn_t`, `fn_sn`, `fp_t`, `fp_sp`, `fk_t`, `fk_sk` | Reject to `BASELINE_RDF_ARITHMETIC` | Incomplete equation coefficients prevent balanced tripartite (N-P-K) stoichiometric calculations. |

---

## 4. Polynomial Mathematical Model & Balanced Fertilizer Carrier Calculations

When all eight validation gates pass, the engine evaluates the verified ICAR-STCR targeted yield equations:

### 4.1 Targeted Nutrient Doses (kg/ha)
$$\text{FN} = \max\left(0.0, \, c_{\text{fn\_t}} \cdot T - c_{\text{fn\_sn}} \cdot \text{SN}\right)$$
$$\text{FP} = \max\left(0.0, \, c_{\text{fp\_t}} \cdot T - c_{\text{fp\_sp}} \cdot \text{SP}\right)$$
$$\text{FK} = \max\left(0.0, \, c_{\text{fk\_t}} \cdot T - c_{\text{fk\_sk}} \cdot \text{SK}\right)$$

where:
- $T$ = Target crop yield in metric tonnes per hectare ($\text{t/ha}$).
- $\text{SN}, \text{SP}, \text{SK}$ = Measured laboratory soil test values in $\text{kg/ha}$ on `SHC_Available_kg_ha` basis.
- $c$ = Calibrated coefficients from `STCRCalibrationRecord.coefficients`.

### 4.2 Stoichiometric Carrier Balancing with DAP Nitrogen Credit
1. **Di-Ammonium Phosphate (DAP, 18-46-0)**:
   $$\text{DAP}_{\text{kg/ha}} = \frac{\text{FP}}{0.46}$$
2. **Elemental Nitrogen Delivered by DAP**:
   $$N_{\text{DAP}} = \text{DAP}_{\text{kg/ha}} \times 0.18$$
3. **Supplementary Elemental Nitrogen Required**:
   $$N_{\text{supp}} = \max\left(0.0, \, \text{FN} - N_{\text{DAP}}\right)$$
4. **Supplementary Urea (46% N)**:
   $$\text{Urea}_{\text{kg/ha}} = \frac{N_{\text{supp}}}{0.46}$$
5. **Muriate of Potash (MOP, 60% K2O)**:
   $$\text{MOP}_{\text{kg/ha}} = \frac{\text{FK}}{0.60}$$

---

## 5. Verified Example & Numerical Proof

Using Punjab Wheat reference calibration (`STCR-PB-WHT-2024-01`):
- **Inputs**: $T = 5.0\text{ t/ha}$, $\text{SN} = 280.0\text{ kg/ha}$, $\text{SP} = 25.0\text{ kg/ha}$, $\text{SK} = 150.0\text{ kg/ha}$.
- **Coefficients**: $c_{\text{fn\_t}} = 43.8, c_{\text{fn\_sn}} = 0.33, c_{\text{fp\_t}} = 22.4, c_{\text{fp\_sp}} = 0.56, c_{\text{fk\_t}} = 25.2, c_{\text{fk\_sk}} = 0.18$.
- **Calculated Nutrient Targets**:
  - $\text{FN} = 43.8 \times 5.0 - 0.33 \times 280.0 = 219.0 - 92.4 = 126.6\text{ kg N/ha}$.
  - $\text{FP} = 22.4 \times 5.0 - 0.56 \times 25.0 = 112.0 - 14.0 = 98.0\text{ kg P}_2\text{O}_5\text{/ha}$.
  - $\text{FK} = 25.2 \times 5.0 - 0.18 \times 150.0 = 126.0 - 27.0 = 99.0\text{ kg K}_2\text{O/ha}$.
- **Commercial Carrier Products**:
  - $\text{DAP} = 98.0 / 0.46 = 213.0\text{ kg/ha}$.
  - $N_{\text{DAP}} = 213.0 \times 0.18 = 38.3\text{ kg N/ha}$.
  - $\text{Urea} = (126.6 - 38.3) / 0.46 = 88.3 / 0.46 = 192.0\text{ kg/ha}$.
  - $\text{MOP} = 99.0 / 0.60 = 165.0\text{ kg/ha}$.
- **Result Status**: `VERIFIED_STCR_GENERATED` with `calibration_details` attached.

---

## 6. Regression Test Coverage

The implementation is verified by six dedicated test cases in `test_phase_3c_5_2_1_regressions.py`:
- `Subtest 2A`: Fabricated Boolean flag without record rejects to `BASELINE_RDF_ARITHMETIC`.
- `Subtest 2B`: Unvalidated calibration status (`UNVERIFIED`) rejects to `BASELINE_RDF_ARITHMETIC`.
- `Subtest 2C`: Crop mismatch (Wheat calibration applied to Rice) rejects with clear explanatory note.
- `Subtest 2D`: Region mismatch (Punjab calibration applied to Tamil Nadu) rejects with region note.
- `Subtest 2E`: Target yield out of range ($8.5\text{ t/ha} > 6.5\text{ t/ha}$) rejects with validity range note.
- `Subtest 2F`: Valid calibration record produces `VERIFIED_STCR_GENERATED` with exact mathematical doses.
