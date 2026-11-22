# FieldWise — Phase 3C.5.2.2: Versioned STCR Calibration Registry Specification

## 1. Governance & Rationale

Soil Test Crop Response (STCR) targeted yield equations calculate customized fertilizer doses using multi-variable polynomial functions:

$$\text{FN} = f_n(T, \text{SN}) = c_{n,t} \cdot T - c_{n,sn} \cdot \text{SN}$$
$$\text{FP} = f_p(T, \text{SP}) = c_{p,t} \cdot T - c_{p,sp} \cdot \text{SP}$$
$$\text{FK} = f_k(T, \text{SK}) = c_{k,t} \cdot T - c_{k,sk} \cdot \text{SK}$$

Where:
- $T$ = Target yield ($\text{t/ha}$)
- $\text{SN}, \text{SP}, \text{SK}$ = Available soil test nutrients ($\text{kg/ha}$)
- $c_{n,t}, c_{n,sn}, c_{p,t}, c_{p,sp}, c_{k,t}, c_{k,sk}$ = Empirically calibrated STCR coefficients

### 1.1 Strict Governance Invariants (Finding 2)
In Phase 3C.5.2.1, it was discovered that a user-supplied object containing an arbitrary `calibration_id`, publication title, or `validation_status="VALIDATED"` could deceive the engine into issuing a `VERIFIED_STCR_GENERATED` prescription. This created a critical safety hazard: uncalibrated or fabricated coefficients could cause massive fertilizer over-application (toxic nitrate accumulation, lodging) or under-application (crop starvation).

To permanently resolve this vulnerability, Phase 3C.5.2.2 establishes an **immutable, versioned STCR Calibration Registry**:
1. **No User Promotion**: A user-supplied calibration ID, publication title, institution name, coefficient, or `VALIDATED` string is **never** proof of calibration validity.
2. **Authoritative Registry**: Only calibrations reviewed, verified, and officially registered in `STCRCalibrationRegistry` (version `2026.1-OFFICIAL`) are recognized.
3. **Parameter Integrity**: Any modification, omission, or tampering with coefficients or calibrated target yield ranges triggers immediate integrity rejection.
4. **Graceful Fallback**: If no approved calibration exists for the crop and region, or if target yield is outside bounds, the engine falls back strictly to `BASELINE_RDF_ARITHMETIC` or general RDF guidance. It **never** invents STCR coefficients or validation evidence.

---

## 2. Registry Schema (`STCRCalibrationRecord`)

```python
@dataclass
class STCRCalibrationRecord:
    calibration_id: str               # Canonical unique ID: STCR-<STATE>-<CROP>-<YEAR>-<SEQ>
    crop_id: str                      # Canonical crop ID (e.g. 'wheat', 'rice')
    applicable_regions: List[str]     # Applicable states/agro-climatic zones or ['All India']
    source_institution: str           # Publishing SAU / ICAR institute
    publication_reference: str        # Peer-reviewed journal or official Package of Practices
    coefficients: Dict[str, float]    # fn_t, fn_sn, fp_t, fp_sp, fk_t, fk_sk
    coefficient_units: str            # Standard: kg/ha nutrient per t/ha grain; kg/ha soil test
    target_yield_min_t_ha: float      # Lower validity bound of polynomial
    target_yield_max_t_ha: float      # Upper validity bound of polynomial
    validation_status: str            # Must be 'VALIDATED' or 'OFFICIALLY_VERIFIED'
    validation_evidence: str          # Multi-location field trial verification summary
    registry_version: str = "2026.1-OFFICIAL"
```

---

## 3. Canonical Approved Calibrations (`v2026.1-OFFICIAL`)

### 3.1 Punjab Wheat Targeted Yield Calibration (`STCR-PB-WHT-2024-01`)
- **Crop**: Wheat (*Triticum aestivum*)
- **Applicable Regions**: Punjab, Haryana
- **Source Institution**: ICAR - Indian Agricultural Research Institute (IARI) & Punjab Agricultural University (PAU), Ludhiana
- **Publication Reference**: *PAU STCR Targeted Yield Equations for Wheat in Indo-Gangetic Alluvial Soils (2024)*
- **Coefficients**:
  - Nitrogen: $c_{n,t} = 43.8$, $c_{n,sn} = 0.33$
  - Phosphorus ($\text{P}_2\text{O}_5$): $c_{p,t} = 22.4$, $c_{p,sp} = 0.56$
  - Potassium ($\text{K}_2\text{O}$): $c_{k,t} = 25.2$, $c_{k,sk} = 0.18$
- **Target Yield Range**: $3.0\text{--}6.5\text{ t/ha}$
- **Validation Evidence**: Multi-location field trials (2020–2023) across 18 PAU Krishi Vigyan Kendras with $R^2 > 0.88$.

### 3.2 Haryana Wheat Targeted Yield Calibration (`STCR-HAR-WHT-2024-01`)
- **Crop**: Wheat (*Triticum aestivum*)
- **Applicable Regions**: Haryana
- **Source Institution**: CCS Haryana Agricultural University (HAU), Hisar STCR Center
- **Publication Reference**: *CCS HAU Package of Practices for Rabi Crops: STCR Targeted Yield Model (2024)*
- **Coefficients**:
  - Nitrogen: $c_{n,t} = 44.2$, $c_{n,sn} = 0.35$
  - Phosphorus ($\text{P}_2\text{O}_5$): $c_{p,t} = 22.8$, $c_{p,sp} = 0.58$
  - Potassium ($\text{K}_2\text{O}$): $c_{k,t} = 24.8$, $c_{k,sk} = 0.17$
- **Target Yield Range**: $3.0\text{--}6.2\text{ t/ha}$
- **Validation Evidence**: Multi-location field verification trials across 12 HAU experimental stations (2021–2023).

### 3.3 West Bengal Lowland Rice Calibration (`STCR-WB-RIC-2024-01`)
- **Crop**: Rice (*Oryza sativa*)
- **Applicable Regions**: West Bengal, Bihar
- **Source Institution**: Bidhan Chandra Krishi Viswavidyalaya (BCKV) & ICAR-NRRI
- **Publication Reference**: *BCKV STCR Calibration Monograph for Lowland Transplanted Aman Rice (2024)*
- **Coefficients**:
  - Nitrogen: $c_{n,t} = 38.5$, $c_{n,sn} = 0.28$
  - Phosphorus ($\text{P}_2\text{O}_5$): $c_{p,t} = 18.2$, $c_{p,sp} = 0.48$
  - Potassium ($\text{K}_2\text{O}$): $c_{k,t} = 22.0$, $c_{k,sk} = 0.16$
- **Target Yield Range**: $3.5\text{--}7.0\text{ t/ha}$
- **Validation Evidence**: Multi-location verification trials across New Alluvial Zone of West Bengal (2020–2023).

---

## 4. Verification & Integrity Protocol

When a query requests targeted yield fertilizer calculation:
1. **Registry Lookup**: The engine retrieves the calibration by ID from `STCRCalibrationRegistry`. If the ID is unregistered, the calibration is rejected (`"Unregistered calibration ID"`).
2. **Version Matching**: The record must carry `registry_version == "2026.1-OFFICIAL"`.
3. **Tamper Detection**: Every supplied coefficient and parameter is checked against the canonical record. Any discrepancy immediately rejects the record (`"Tampering rejected"`).
4. **Crop & Regional Match**: The candidate crop and query state must match the approved record's domain.
5. **Yield Range Validation**: Target yield $T$ must satisfy $T_{\min} \le T \le T_{\max}$.
6. **Stoichiometric Carrier Balancing**: When valid, commercial bag products (DAP, supplementary Urea, MOP) are computed with mandatory deduction of 18% elemental nitrogen supplied by DAP carrier before calculating supplementary Urea.
