# FieldWise — Phase 3C.5.2.1: Epistemic Provenance Verification Specification

**Document ID**: `FW-P3C521-PROV-01`  
**Engine Version**: `2.2.3-CLOSURE`  
**Phase**: `3C.5.2.1 (Agronomic Gate and Verification Provenance Closure)`  
**Status**: `APPROVED_SPECIFICATION`  
**Date**: `2026-11-20`  

---

## 1. Objective & Problem Statement

Phase 3C.5.2 audit findings established that:
1. The engine previously treated self-declared strings such as `"Certified_Soil_Testing_Lab"` or `"IMD_Station_Gridded"` as sufficient proof of verified laboratory measurement or gauged meteorological observations.
2. In agricultural extension and remote advisory systems, self-declared provenance strings without traceable identifiers can easily be entered by end-users or upstream adapters without verified backing.
3. Silently upgrading user-declared strings to verified laboratory or gauged status artificially inflated data confidence tiers, masking epistemic risk and creating liability for inaccurate fertilizer prescriptions or water budgeting.

This specification formalizes the six-tier epistemic provenance hierarchy, mandates verifiable supporting metadata before assigning `INDEPENDENTLY_VERIFIED`, and ensures self-declared data is strictly preserved as `USER_DECLARED`.

---

## 2. Six-Tier Epistemic Provenance Hierarchy

The canonical provenance tiers are formalized in `recommendation_engine/schemas.py`:

```python
class ProvenanceTier(str, Enum):
    INDEPENDENTLY_VERIFIED = "INDEPENDENTLY_VERIFIED"  # Backed by accredited lab cert / physical station ID / flow meter
    SOURCE_REFERENCED      = "SOURCE_REFERENCED"       # Grounded in traceable external portal, published database, or DOI
    USER_DECLARED          = "USER_DECLARED"           # User-supplied or adapter-declared claim lacking verifiable IDs
    ESTIMATED              = "ESTIMATED"               # Farmer visual estimate, field feel method, or regional map overlay
    PROVISIONAL            = "PROVISIONAL"             # Unstated measurement method, partial nutrient set, or unmeasured water
    UNKNOWN                = "UNKNOWN"                 # Parameter completely omitted or unprovided
```

---

## 3. Traceable Metadata Contract & Requirements

To qualify for `INDEPENDENTLY_VERIFIED`, a domain must provide physical instrument, station, or laboratory identifiers along with temporal bounding:

| Domain | Required Fields for `INDEPENDENTLY_VERIFIED` | Required Fields for `SOURCE_REFERENCED` | Classification When Strings Provided Without Identifiers |
| :--- | :--- | :--- | :--- |
| **Nutrients** | `lab_accreditation_number` (NABL / ICAR code) + `sample_id` + `test_date` | `source_reference` (Soil Health Card portal record URL) | `USER_DECLARED` (e.g. `soil_test_source="Certified_Soil_Testing_Lab"`) |
| **Soil pH** | `lab_accreditation_number` + `sample_id` + `ph_measurement_method="Lab_Potentiometric_1_2_5"` | `source_reference` (Verifiable report URL / publication) | `USER_DECLARED` (e.g. `ph_measurement_method="Certified_Lab"`) |
| **Soil Texture** | `lab_accreditation_number` + `sample_id` + `texture_measurement_method="Lab_Mechanical_Analysis"` | `source_reference` (Verifiable soil survey document) | `USER_DECLARED` (e.g. `texture_measurement_method="Lab_Mechanical_Analysis"`) |
| **Water (Rain)** | `station_id` (IMD / WMO station ID) + date range (`measurement_date_start`/`end` or `rainfall_period_days`) | `source_reference` (IMD gridded dataset citation) | `USER_DECLARED` (e.g. `rainfall_source="IMD_Station_Gridded"`) |
| **Water (Irrigation)**| `irrigation_meter_id` (calibrated flow meter ID) or `station_id` | `source_reference` (Canal discharge schedule / water authority log) | `USER_DECLARED` (e.g. `irrigation_quantity_basis="Measured_Flow_Meter"`) |
| **Climate** | `station_id` (meteorological station or calibrated on-farm logger) | `source_reference` (Gridded meteorological dataset) | `USER_DECLARED` (e.g. temperature and humidity entered without station ID) |

---

## 4. Domain-by-Domain Provenance Evaluation Logic

In `recommendation_engine/dci_confidence.py`, the evaluation logic follows explicit rules:

### 4.1 Temporal Domain ($w_1 = 0.15$)
- Exact sowing date (YYYY-MM-DD):
  - If anchored to a verified instrument/station date record (`cw.station_id`, `ed.lab_accreditation_number`, or `cw.measurement_date_start`): `INDEPENDENTLY_VERIFIED`.
  - If accompanied by `source_reference`: `SOURCE_REFERENCED`.
  - Else: `USER_DECLARED`.
- Sowing month only: `ESTIMATED` ($c_1 = 0.60$).
- Omitted: `UNKNOWN` ($c_1 = 0.00$).

### 4.2 Climate Domain ($w_2 = 0.20$)
- Temperature and relative humidity provided:
  - If `cw.station_id` provided: `INDEPENDENTLY_VERIFIED`.
  - If `cw.source_reference` provided: `SOURCE_REFERENCED`.
  - Else: `USER_DECLARED`.
- Single parameter only: `PROVISIONAL` ($c_2 = 0.50$).
- Omitted: `UNKNOWN` ($c_2 = 0.00$).

### 4.3 Water Domain ($w_3 = 0.25$)
- **Rainfed**:
  - Gauged source declared (`"IMD_Station_Gridded"`, `"On_Farm_Rain_Gauge"`):
    - Has `cw.station_id`: `INDEPENDENTLY_VERIFIED`.
    - Has `cw.source_reference`: `SOURCE_REFERENCED`.
    - Untraceable string alone: `USER_DECLARED` (Never upgraded to `INDEPENDENTLY_VERIFIED`!).
  - Farmer estimated: `ESTIMATED` ($c_3 = 0.60$).
  - Unstated source: `PROVISIONAL` ($c_3 = 0.50$, never defaults to gauged!).
  - Omitted: `UNKNOWN` ($c_3 = 0.00$).
- **Irrigated**:
  - Flow meter declared:
    - Has `cw.irrigation_meter_id` or `cw.station_id`: `INDEPENDENTLY_VERIFIED`.
    - Has `cw.source_reference`: `SOURCE_REFERENCED`.
    - Untraceable string alone: `USER_DECLARED`.
  - Estimated hours / pump capacity: `ESTIMATED` ($c_3 = 0.75$).
  - Unstated basis: `PROVISIONAL` ($c_3 = 0.60$).
  - Confirmed access but unmeasured volume: `PROVISIONAL` ($c_3 = 0.40$).
  - Omitted: `UNKNOWN` ($c_3 = 0.00$).

### 4.4 Edaphic Domains: Texture ($w_4 = 0.15$), pH ($w_5 = 0.10$), Nutrients ($w_6 = 0.15$)
- Laboratory method declared (`Lab_Mechanical_Analysis`, `Lab_Potentiometric_1_2_5`, `Certified_Soil_Testing_Lab`):
  - Has `lab_accreditation_number` AND `sample_id`: `INDEPENDENTLY_VERIFIED`.
  - Has `source_reference`: `SOURCE_REFERENCED`.
  - Untraceable string alone: `USER_DECLARED`.
- Field feel method, pocket pen, colorimetric strip, or regional map: `ESTIMATED`.
- Unstated method, partial nutrient set, or unverified nutrient basis: `PROVISIONAL`.
- Omitted: `UNKNOWN`.

---

## 5. Overall Provenance Tier Synthesis Algorithm

The composite `overall_provenance` is computed across all active (non-omitted) domains:
1. If **all** active domains are `INDEPENDENTLY_VERIFIED` $\rightarrow$ `INDEPENDENTLY_VERIFIED`.
2. Else if **all** active domains are `INDEPENDENTLY_VERIFIED` or `SOURCE_REFERENCED` $\rightarrow$ `SOURCE_REFERENCED`.
3. Else if **any** active domain is `USER_DECLARED` $\rightarrow$ `USER_DECLARED`.
4. Else if **any** active domain is `ESTIMATED` $\rightarrow$ `ESTIMATED`.
5. Else if **any** active domain is `PROVISIONAL` $\rightarrow$ `PROVISIONAL`.
6. Else $\rightarrow$ `UNKNOWN`.

---

## 6. Regression Test Evidence

Verified in `test_phase_3c_5_2_1_regressions.py` (`test_defect_3_provenance_verification_tiers`):
- **Case A**: Identical input values with self-declared strings (`Certified_Soil_Testing_Lab`, `IMD_Station_Gridded`, `Measured_Flow_Meter`) without identifiers are assigned `USER_DECLARED` across all domains, and `overall_provenance == USER_DECLARED`.
- **Case B**: Identical input values with traceable identifiers (`NABL-TC-8912`, `SHC-PB-LDH-2026-9041`, `IMD-PBI-42182`, `CAL-MTR-7721`) are assigned `INDEPENDENTLY_VERIFIED` across all domains, and `overall_provenance == INDEPENDENTLY_VERIFIED`.
- **Case C**: External portal URL citations produce `SOURCE_REFERENCED`.
- **Case D**: Proves conclusively that self-declared strings are never silently upgraded to independently verified status.
