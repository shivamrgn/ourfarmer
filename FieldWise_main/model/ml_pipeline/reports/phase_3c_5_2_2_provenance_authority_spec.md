# FieldWise — Phase 3C.5.2.2: Trusted Verification Authority & Provenance Specification

## 1. Architectural Principles & Rationale

Agricultural decision support engines operating on user-supplied data face a pervasive epistemic hazard: **unearned confidence elevation**. A user, script, or frontend may supply a string such as `station_id="IMD-AWS-42182"` or `lab_accreditation="NABL-1234"` without any authentic connection to an authoritative observation registry.

In Phase 3C.5.2.1, it was discovered that presence of arbitrary ID strings alone could elevate an observation to `INDEPENDENTLY_VERIFIED` status. This allowed fabricated or unverified claims to appear as independently audited scientific measurements.

Phase 3C.5.2.2 establishes an **authoritative epistemic provenance governance model**:
1. **Six Strict Epistemic Provenance Tiers**:
   - `INDEPENDENTLY_VERIFIED`: Confirmed by an authentic, valid record from an accredited authority.
   - `SOURCE_REFERENCED`: Grounded in an external published reference (e.g. government portal URL, gridded dataset citation).
   - `USER_DECLARED`: Provided directly by the user or farmer (including unverified station IDs, lab names, or sample IDs).
   - `ESTIMATED`: Derived from field proxy methods (e.g. field feel soil texture, colorimetric strips, pump-hour estimates).
   - `PROVISIONAL`: Missing explicit measurement basis, unstated method, or incomplete metadata.
   - `UNKNOWN`: Missing, omitted, or unquantifiable parameter.
2. **Station IDs & Lab Names Alone Remain USER_DECLARED**: A station ID alone cannot establish independent verification. A laboratory accreditation string alone cannot establish independent verification.
3. **Trusted Verification Record Required**: Independent verification requires an authentic `TrustedVerificationRecord` from a recognized national authority with a matching observation/sample ID, valid observation dates, and verified status.

---

## 2. Recognized Authority Directory

The engine maintains a versioned directory of recognized national and state verification authorities:

| Authority ID | Recognized Authority Name | Scope / Jurisdiction | Validated Measurement Domain |
| :--- | :--- | :--- | :--- |
| `AUTH-ICAR-SHC-REGISTRY` | ICAR / DAC&FW National Soil Health Card Digital Portal | National Soil Testing Laboratory Accreditation & Card Verification | `soil_and_nutrients` |
| `AUTH-IMD-AWS-NETWORK` | India Meteorological Department Automated Weather Station Network | National Surface Meteorological Observation & Gridded Radar Data | `climate_and_rainfall` |
| `AUTH-CWC-HYDROLOGY` | Central Water Commission & State Irrigation Hydrometry Registry | Calibrated Irrigation Discharge & Tubewell Flow Metering | `irrigation_water` |
| `AUTH-NABL-ACCREDITED-LAB` | National Accreditation Board for Testing and Calibration Laboratories (NABL) | Certified Analytical Chemical and Edaphic Soil Testing Laboratories | `soil_and_nutrients` |

Unrecognized authority IDs (e.g. `AUTH-FAKE-PORTAL-01`) are automatically rejected.

---

## 3. Trusted Verification Record Schema (`TrustedVerificationRecord`)

```python
@dataclass
class TrustedVerificationRecord:
    verification_authority_id: str     # Must match a key in RECOGNIZED_AUTHORITIES
    authority_name: str                # Official registered name
    source_identifier: str             # Verifiable registry / datasource ID
    observation_or_sample_id: str      # Must match query's sample_id, station_id, or meter_id
    verification_status: str           # Must be 'OFFICIALLY_VERIFIED' or 'TRUSTED_AUTHORITY_CONFIRMED'
    applicable_date_start: str         # YYYY-MM-DD
    applicable_date_end: str           # YYYY-MM-DD
    digital_signature_or_token: str = "" # Verifiable audit token / certificate hash
```

---

## 4. Domain Provenance Evaluation Matrix

The `DCIConfidenceEvaluator` applies the following deterministic classification matrix across the 6 orthogonal measurement domains:

| Domain | Conditions for `INDEPENDENTLY_VERIFIED` | Conditions for `SOURCE_REFERENCED` | Conditions for `USER_DECLARED` | Conditions for `ESTIMATED` / `PROVISIONAL` |
| :--- | :--- | :--- | :--- | :--- |
| **Temporal** ($w_1 = 0.15$) | Exact date ($YYYY\text{-}MM\text{-}DD$) confirmed by active verification record. | Exact date backed by published source reference. | Exact date entered by user without external record. | Sowing month only (`ESTIMATED`, $c_1=0.60$); Omitted (`UNKNOWN`, $c_1=0.00$). |
| **Climate** ($w_2 = 0.20$) | Temp and humidity matched by `AUTH-IMD-AWS-NETWORK` record. | Temp and humidity backed by published dataset citation (e.g. IMD Gridded). | Measured values provided by user with station ID but no verification record. | Single parameter provided (`PROVISIONAL`, $c_2=0.50$); Omitted (`UNKNOWN`, $c_2=0.00$). |
| **Water** ($w_3 = 0.25$) | Rain gauge matched by `AUTH-IMD-AWS-NETWORK`, or meter matched by `AUTH-CWC-HYDROLOGY`. | Rainfall or irrigation backed by water agency report / portal. | Gauged rain or flow-meter volume entered by user with ID but no record. | Unmeasured irrigation volume (`PROVISIONAL`, $c_3=0.40$); Farmer estimate (`ESTIMATED`, $c_3=0.60\text{--}0.75$). |
| **Soil Texture** ($w_4 = 0.15$) | Lab mechanical analysis matched by `AUTH-ICAR-SHC-REGISTRY` or `AUTH-NABL`. | Texture backed by published soil survey report / portal. | Lab mechanical analysis entered by user without verification record. | Field feel method (`ESTIMATED`, $c_4=0.50$); Regional map (`ESTIMATED`, $c_4=0.50$). |
| **Soil pH** ($w_5 = 0.10$) | Potentiometric lab pH matched by `AUTH-ICAR-SHC-REGISTRY` or `AUTH-NABL`. | Lab pH backed by published soil test portal. | Lab potentiometric pH entered by user without verification record. | Field strip / pocket pen (`ESTIMATED`, $c_5=0.50$); Regional map (`ESTIMATED`, $c_5=0.50$). |
| **Nutrients (NPK)** ($w_6 = 0.15$) | Complete NPK on `SHC_Available_kg_ha` matched by `AUTH-ICAR-SHC-REGISTRY` or `AUTH-NABL`. | Complete NPK on `SHC_Available_kg_ha` backed by Soil Health Card portal URL. | Complete NPK on `SHC_Available_kg_ha` from certified lab entered by user without record. | Qualitative class (`ESTIMATED`, $c_6=0.50$); Partial NPK (`PROVISIONAL`, $c_6=0.50$); Unstated basis (`PROVISIONAL`, $c_6=0.50$). |

---

## 5. Overall Provenance Tier Synthesis

The overall query provenance tier is deterministically synthesized from all active measurement domains ($c_k > 0.0$):
1. If all active domains are `INDEPENDENTLY_VERIFIED` $\to$ `INDEPENDENTLY_VERIFIED`.
2. If all active domains are either `INDEPENDENTLY_VERIFIED` or `SOURCE_REFERENCED` $\to$ `SOURCE_REFERENCED`.
3. If any active domain is `USER_DECLARED` $\to$ `USER_DECLARED`.
4. If any active domain is `ESTIMATED` (and none `USER_DECLARED`) $\to$ `ESTIMATED`.
5. If any active domain is `PROVISIONAL` $\to$ `PROVISIONAL`.
6. If all domains are omitted $\to$ `UNKNOWN`.

This ensures that self-declared or unverified observations can never be promoted to independently verified status.
