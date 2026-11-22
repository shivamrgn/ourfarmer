# FieldWise — Phase 3C.5.2.2: API Adapter Guide & Evidence Authority Integration

## 1. Document Overview & Non-Destructive Principles

**Identifier**: `GUIDE-3C-5-2-2-ADAPTER-v2.2.4`  
**Phase**: Phase 3C.5.2.2 (Evidence Authority and Specification Consistency)  
**Status**: **REFERENCE SPECIFICATION — STRICTLY ISOLATED**  
**Core Invariant**: Zero modifications to live production application files (`model/predictor.js`, `model/cropDatabase.js`, `model/fertilizerDatabase.js`, `src/lib/predictorEngine.ts`, `src/lib/api.ts`).

This guide details the integration contract and schema updates for the FieldWise Recommendation Engine following Phase 3C.5.2.2 evidence authority corrections.

---

## 2. API Contract Updates in Phase 3C.5.2.2

### 2.1 New Query Fields in `RecommendationQuery`

```python
@dataclass
class RecommendationQuery:
    location: LocationInput
    temporal: TemporalInput
    climate_and_water: ClimateWaterInput
    edaphic: EdaphicInput
    # Added in Phase 3C.5.2.2:
    stcr_calibration_id: Optional[str] = None
    stcr_calibration: Optional[STCRCalibrationRecord] = None
    target_yield_t_ha: Optional[float] = None
    verification_records: List[TrustedVerificationRecord] = field(default_factory=list)
```

### 2.2 Field Definitions & Validation Rules

1. **`stcr_calibration_id` (`Optional[str]`)**:
   - Unique identifier of an approved STCR calibration record registered in `STCRCalibrationRegistry` (version `2026.1-OFFICIAL`).
   - Example: `"STCR-PB-WHT-2024-01"`, `"STCR-HAR-WHT-2024-01"`, `"STCR-WB-RIC-2024-01"`.
   - Any unregistered ID is strictly rejected back to `BASELINE_RDF_ARITHMETIC`.
2. **`target_yield_t_ha` (`Optional[float]`)**:
   - Target yield specified in tonnes per hectare ($\text{t/ha}$).
   - Must fall within the calibration's validity range $[T_{\min}, T_{\max}]$ (e.g. $3.0\text{--}6.5\text{ t/ha}$ for Punjab Wheat).
3. **`verification_records` (`List[TrustedVerificationRecord]`)**:
   - List of cryptographically or administratively verifiable observation records issued by recognized authorities.
   - Required to elevate domain observations to `INDEPENDENTLY_VERIFIED` status.
   - If empty or omitted, station IDs, laboratory names, and sample IDs supplied by the user are evaluated strictly as `USER_DECLARED`.

---

## 3. Trusted Verification Record Contract

```typescript
interface TrustedVerificationRecord {
  verificationAuthorityId: string;    // e.g. "AUTH-ICAR-SHC-REGISTRY", "AUTH-IMD-AWS-NETWORK", "AUTH-CWC-HYDROLOGY"
  authorityName: string;               // e.g. "ICAR Soil Health Card National Registry"
  sourceIdentifier: string;            // e.g. "NABL-TC-8912"
  observationOrSampleId: string;       // Must match query's sampleId, stationId, or irrigationMeterId
  verificationStatus: string;          // Must be "OFFICIALLY_VERIFIED" or "TRUSTED_AUTHORITY_CONFIRMED"
  applicableDateStart: string;         // "YYYY-MM-DD"
  applicableDateEnd: string;           // "YYYY-MM-DD"
  digitalSignatureOrToken?: string;    // Verifiable audit token / certificate hash
}
```

---

## 4. Example Integration Payloads

### 4.1 Example A: Farmer Self-Declared Query (No Verification Records)
Farmer enters data via mobile app. Weather station ID and lab name are entered manually.

```json
{
  "location": { "state": "Punjab", "district": "Ludhiana" },
  "temporal": { "sowing_month": 11, "sowing_date": "2026-11-10", "cultivation_season": "Rabi" },
  "climate_and_water": {
    "temperature_mean": 18.0,
    "seasonal_rainfall_amount": 50.0,
    "rainfall_source": "On_Farm_Rain_Gauge",
    "station_id": "PBI-AWS-42182",
    "irrigation_access": "Tubewell_Borewell",
    "irrigation_water_quantity_mm": 250.0,
    "irrigation_quantity_basis": "Measured_Flow_Meter"
  },
  "edaphic": {
    "soil_texture": "Loamy",
    "soil_ph": 7.4,
    "has_soil_test": true,
    "soil_test_source": "Certified_Soil_Testing_Lab",
    "nutrient_basis": "SHC_Available_kg_ha",
    "soil_nitrogen": 280.0,
    "soil_phosphorus": 25.0,
    "soil_potassium": 200.0,
    "lab_accreditation_number": "NABL-TC-8912",
    "sample_id": "SHC-PB-9041"
  },
  "stcr_calibration_id": null,
  "verification_records": []
}
```
**Engine Evaluation Outcome**:
- DCI Score: $1.000$ (all 6 domains measured).
- Confidence Tier: `HIGH_CONFIDENCE`.
- Provenance Tier: `USER_DECLARED` (unverified IDs remain user-declared; no elevation).
- Fertilizer Prescription: `BASELINE_RDF_ARITHMETIC` with stoichiometric DAP 18% N deduction.

---

### 4.2 Example B: Verified Agronomic & STCR Query
Card verified via National SHC Portal (`AUTH-ICAR-SHC-REGISTRY`) with official PAU targeted yield STCR calibration.

```json
{
  "location": { "state": "Punjab", "district": "Ludhiana" },
  "temporal": { "sowing_month": 11, "sowing_date": "2026-11-10", "cultivation_season": "Rabi" },
  "climate_and_water": {
    "temperature_mean": 18.0,
    "relative_humidity": 60.0,
    "seasonal_rainfall_amount": 50.0,
    "rainfall_source": "On_Farm_Rain_Gauge",
    "station_id": "PBI-MET-42182",
    "irrigation_access": "Tubewell_Borewell",
    "irrigation_water_quantity_mm": 250.0,
    "irrigation_quantity_basis": "Measured_Flow_Meter",
    "irrigation_meter_id": "CAL-MTR-7721",
    "measurement_date_start": "2026-11-01",
    "measurement_date_end": "2027-03-31"
  },
  "edaphic": {
    "soil_texture": "Loamy",
    "texture_measurement_method": "Lab_Mechanical_Analysis",
    "soil_ph": 7.4,
    "ph_measurement_method": "Lab_Potentiometric_1_2_5",
    "has_soil_test": true,
    "soil_test_source": "Certified_Soil_Testing_Lab",
    "nutrient_basis": "SHC_Available_kg_ha",
    "soil_nitrogen": 280.0,
    "soil_phosphorus": 25.0,
    "soil_potassium": 200.0,
    "sample_id": "SHC-PB-LDH-2026-9041",
    "test_date": "2026-10-15"
  },
  "stcr_calibration_id": "STCR-PB-WHT-2024-01",
  "target_yield_t_ha": 5.0,
  "verification_records": [
    {
      "verification_authority_id": "AUTH-ICAR-SHC-REGISTRY",
      "authority_name": "ICAR Soil Health Card National Registry",
      "source_identifier": "NABL-TC-8912",
      "observation_or_sample_id": "SHC-PB-LDH-2026-9041",
      "verification_status": "OFFICIALLY_VERIFIED",
      "applicable_date_start": "2026-10-01",
      "applicable_date_end": "2027-10-01",
      "digital_signature_or_token": "ICAR-SIG-9041-A8B9"
    },
    {
      "verification_authority_id": "AUTH-IMD-AWS-NETWORK",
      "authority_name": "India Meteorological Department Automated Weather Network",
      "source_identifier": "PBI-MET-42182",
      "observation_or_sample_id": "PBI-MET-42182",
      "verification_status": "OFFICIALLY_VERIFIED",
      "applicable_date_start": "2026-11-01",
      "applicable_date_end": "2027-04-01",
      "digital_signature_or_token": "IMD-SIG-42182-C3D4"
    },
    {
      "verification_authority_id": "AUTH-CWC-HYDROLOGY",
      "authority_name": "Central Water Commission Hydrological Network",
      "source_identifier": "CAL-MTR-7721",
      "observation_or_sample_id": "CAL-MTR-7721",
      "verification_status": "OFFICIALLY_VERIFIED",
      "applicable_date_start": "2026-11-01",
      "applicable_date_end": "2027-04-01",
      "digital_signature_or_token": "CWC-SIG-7721-E5F6"
    }
  ]
}
```
**Engine Evaluation Outcome**:
- DCI Score: $1.000$.
- Confidence Tier: `HIGH_CONFIDENCE`.
- Provenance Tier: `INDEPENDENTLY_VERIFIED` (all active domains confirmed by trusted records).
- Fertilizer Prescription: `VERIFIED_STCR_GENERATED` ($126.6$ kg N/ha, $98.0$ kg $\text{P}_2\text{O}_5$/ha, $90.0$ kg $\text{K}_2\text{O}$/ha; $213.0$ kg DAP, $192.0$ kg Urea with $38.3$ kg N credit, $150.0$ kg MOP).

---

## 5. Backward Compatibility & Error Handling

- **Omitting `verification_records`**: Legacy callers or standard smallholder submissions that omit `verification_records` continue to execute without interruption, resolving provenance safely to `USER_DECLARED`.
- **Omitting `stcr_calibration_id`**: Callers not using targeted yield polynomial STCR receive standard `BASELINE_RDF_ARITHMETIC` balanced fertilizer prescriptions.
- **Fabricated Records**: User-supplied calibration IDs or unverified observation records are rejected gracefully without raising unhandled exceptions or halting prediction.
