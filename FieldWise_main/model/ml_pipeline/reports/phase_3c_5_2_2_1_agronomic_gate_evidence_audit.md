# FieldWise — Phase 3C.5.2.2.1: Agronomic Gate Evidence & pH Restoration Audit

## 1. Executive Summary

This audit establishes definitive agronomic gate safety and specification consistency for edaphic and pH survival gating in the FieldWise Crop Recommendation Engine. Following the independent review of Phase 3C.5.2.2, this audit restores the approved Phase 3C.4 specification baseline (`reports/phase_3c_4_eligibility_rules.csv` and `reports/phase_3c_4_2_hard_exclusion_evidence_audit.csv`).

Key Corrections Enacted in Phase 3C.5.2.2.1:
1. **Excised Unsupported Universal pH Exclusions**: Removed `RULE-UNIVERSAL-SODICITY-01` (universal Tier 1 exclusion at $\text{pH} > 9.0$) and `RULE-UNIVERSAL-ACIDITY-01` (universal Tier 1 exclusion at $\text{pH} < 4.0$) from the Tier 1 agronomic gate ($G_{\text{ph}}$).
2. **Excised `VERIFIED_LETHAL_PH_LIMITS`**: Completely removed hard-coded lethal dictionaries that converted soft penalties into Tier 1 hard exclusions without verifiable Class A 100% biological crop mortality evidence.
3. **Restored Phase 3C.4 Approved Classifications**: In accordance with `reports/phase_3c_4_eligibility_rules.csv`, all 19 canonical crop pH rules are strictly classified as `SOFT_PENALTY`. Violations in Tier 1 evaluate to status `PASS` with `WARNING_ONLY` and `action_on_violation: Apply Agronomic Penalty`.
4. **Architectural Separation of Eligibility and Ranking**: Tier 1 gates only for biological impossibility (0% emergence). Extreme soil hostility ($\text{pH} < 4.2$ toxic acidity or $\text{pH} > 9.0$ extreme sodicity dispersion) is handled in Tier 2 and ranking, where depressed agronomic suitability triggers `NO_RECOMMENDATION_SUITABLE` with 0 recommendations and mandatory soil reclamation advisories (Agricultural Limestone or Agricultural Gypsum).

---

## 2. Authoritative Baseline Alignment (Phase 3C.4)

In the Phase 3C.4 specification, all edaphic pH rules across the 19 canonical crops were comprehensively audited against empirical agronomic literature (ICAR, CSSRI, FAO-29):

1. **61 Hard Exclusion Audit**: In `reports/phase_3c_4_2_hard_exclusion_evidence_audit.csv`, all 61 candidate rules were designated `DOWNGRADE_TO_SOFT_PENALTY`. Zero rules were retained as unhedged hard exclusions in Tier 1.
2. **Eligibility Rules Reconciliation**: In `reports/phase_3c_4_eligibility_rules.csv`, the parameter `Soil pH (pH)` for all 19 crops is designated with `rule_type: SOFT_PENALTY` and `action_on_violation: Apply Agronomic Penalty`.
3. **Soft Penalty Semantics**: When soil pH is outside a crop's optimal range $[\text{pH}_{\min}, \text{pH}_{\max}]$, the plant suffers physiological stress (interveinal chlorosis, reduced nutrient availability, 15%–30% yield depression). However, the crop is biologically viable and capable of completing its life cycle with remedial management (foliar micronutrient sprays, gypsum, organic amendments). Such conditions must never trigger a Tier 1 `FAIL`.

---

## 3. Multi-pH Boundary Evaluation Across 19 Crops

The engine evaluates soil reaction across five boundary levels: pH 4.0, 8.5, 8.6, 9.0, and 9.2:

| Soil pH Level | Tier 1 Gate 4 ($G_{\text{ph}}$) Outcome | Tier 2 Liebig Suitability Impact | Ranking Outcome & Protective Safeguards |
| :---: | :---: | :--- | :--- |
| **pH 4.0** | `PASS` (`WARNING_ONLY` for all 19 crops) | Severe acidity penalty applied ($s_{\text{ph}} = 20.0$). Core suitability depressed below viability threshold ($< 40.0$). | `NO_RECOMMENDATION_SUITABLE` (0 recommendations). Mandatory Agricultural Limestone / Dolomite reclamation advisory issued. |
| **pH 8.5** | `PASS` (Crops within preferred range pass cleanly; crops outside pass with `WARNING_ONLY`). | Non-compensatory soft penalty applied to out-of-range crops; optimal crops receive $s_{\text{ph}} = 100.0$. | Normal ranking. Suitable crops recommended; depressed crops ranked lower. |
| **pH 8.6** | `PASS` (`WARNING_ONLY` for out-of-range crops; all 19 crops pass Tier 1). | Non-compensatory soft penalty applied to out-of-range crops (including Pulses). | Normal ranking. Candidates receive soft penalties proportional to distance from preferred range. |
| **pH 9.0** | `PASS` (`WARNING_ONLY` for all crops outside preferred range). | Salt-tolerant crops (Barley, Cotton) and hardy perennials (Mango) receive moderate penalties ($s_{\text{ph}} \approx 40\text{--}60$). | Candidates recommended with soft penalties and risk warnings (`"Alkalinity/Sodicity Warning"`). |
| **pH 9.2** | `PASS` (`WARNING_ONLY` for all 19 crops under Phase 3C.4 `SOFT_PENALTY`). | Extreme sodicity penalty applied ($s_{\text{ph}} = 15.0$). All crops depressed below viability threshold ($< 40.0$). | `NO_RECOMMENDATION_SUITABLE` (0 recommendations). Mandatory Gypsum land reclamation advisory issued. |

---

## 4. Elimination of Implementation Contradictions

The independent review of Phase 3C.5.2.2 identified that earlier patches introduced hard-coded lethal dictionaries (`VERIFIED_LETHAL_PH_LIMITS`) and universal hard exclusions (`RULE-UNIVERSAL-SODICITY-01` at pH > 9.0 and `RULE-UNIVERSAL-ACIDITY-01` at pH < 4.0) inside `tier1_eligibility.py`. These contradicted the approved Phase 3C.4 specification:

1. **Restored Soft Penalties**: All 19 crops now strictly evaluate under their Phase 3C.4 approved `SOFT_PENALTY` designation in Tier 1.
2. **Excised Lethal Limits**: `VERIFIED_LETHAL_PH_LIMITS` was completely removed from `tier1_eligibility.py`.
3. **No Unsubstantiated Hard Exclusions**: No new hard exclusion may be introduced without independently verified, crop-specific peer-reviewed evidence and explicit specification approval.
4. **Preservation of UNKNOWN**: Missing pH inputs (`soil_ph is None`) strictly evaluate to `UNKNOWN` in Gate 4 ($G_{\text{ph}}$) with provisional DCI scoring.

---

## 5. Verification Proofs

All 57 automated regression tests in `test_phase_3c_5_2_2_1_regressions.py` and the master test runner confirm:
- At pH 4.0, 8.5, 8.6, 9.0, and 9.2, all 19 canonical crops evaluate as `SOFT_PENALTY` in Tier 1.
- Gating status is `PASS` with `WARNING_ONLY` for crops outside their preferred range.
- Ranking correctly protects farmers from hostile chemical environments by withholding unviable recommendations and providing actionable reclamation advisories.
