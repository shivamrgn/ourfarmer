# FieldWise — Phase 3C.3: Agronomic Validation & Audit Artifacts

**Phase**: Phase 3C.3 (Agronomic Validation of the 19-Crop Recommendation Engine)  
**Execution Timestamp**: 2026-11-19T13:30:00Z  
**Directory**: `FieldWise_main/model/ml_pipeline/data/processed/recommendation/`  
**Application Preservation Status**: Complete Isolation. Live frontend, backend APIs, Supabase database, `model/predictor.js`, `model/cropDatabase.js`, `model/fertilizerDatabase.js`, and `src/lib/predictorEngine.ts` strictly **UNTOUCHED / READ-ONLY**.

---

## 1. Overview & Objective

Phase 3C.3 performs an exhaustive, source-backed agronomic validation and safety audit of FieldWise's existing 19-crop canonical taxonomy and recommendation engines (online backend `model/predictor.js` and offline frontend fallback `src/lib/predictorEngine.ts`).

All crop parameters, suitability ranges, and scoring heuristics were audited against peer-reviewed agricultural science evidence from the Indian Council of Agricultural Research (ICAR), State Agricultural Universities (SAUs), the Ministry of Agriculture & Farmers Welfare (MoA&FW), and the Food and Agriculture Organization (FAO).

---

## 2. Deliverables Manifest

All deliverables are archived in `model/ml_pipeline/reports/`, `model/ml_pipeline/scripts/`, and this directory:

| Artifact Path | Description | Format |
| :--- | :--- | :---: |
| `reports/phase_3c_3_crop_inventory.csv` | Authoritative extraction of all 19 canonical crops with exact original parameters. | CSV (19 rows) |
| `reports/phase_3c_3_backend_frontend_consistency.csv` | Full discrepancy audit between backend database, frontend fallback, and canonical taxonomy. | CSV (102 rows) |
| `reports/phase_3c_3_source_registry.csv` | Formal registry of all 21 cited ICAR, SAU, Govt, and FAO agronomic references. | CSV (21 rows) |
| `reports/phase_3c_3_agronomic_evidence_matrix.csv` | Crop-by-crop parameter evidence evaluation matrix (19 crops × 10 parameters). | CSV (190 rows) |
| `reports/phase_3c_3_engine_safety_audit.md` | In-depth mathematical and agronomic safety audit of the scoring algorithms. | Markdown |
| `reports/phase_3c_3_agronomic_validation_report.md` | Comprehensive publication-grade validation report covering all 11 sections. | Markdown |
| `reports/phase_3c_3_validation_metrics.json` | Machine-readable metrics, scenario stress-test outputs, and audit verdicts. | JSON |
| `scripts/audit_agronomic_crop_requirements.py` | Standalone, self-contained Python execution engine that reproduces all results. | Python CLI |
| `data/processed/recommendation/phase_3c_3_README.md` | Reproduction guide, provenance explanation, and SHA-256 manifest. | Markdown |

---

## 3. Reproduction Instructions

To reproduce all inventory extractions, consistency audits, empirical stress-test scenarios, and metric calculations:

```bash
cd /Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline
python3 scripts/audit_agronomic_crop_requirements.py
```

Expected execution output:
- Loads 19 canonical crops from `reports/canonical_crop_taxonomy.json`.
- Parses backend databases (`model/cropDatabase.js`, `model/fertilizerDatabase.js`) via Node.js.
- Parses frontend engine (`src/lib/predictorEngine.ts`) via Node.js.
- Generates and validates all CSV and JSON reports.
- Executes stress scenarios S1–S5 on both engines.
- Verifies artifact existence and computes SHA-256 checksums.
- Exits cleanly with code 0.

---

## 4. Key Metrics Summary

- **Canonical Crops**: 19
- **Backend Database Crops**: 16 (Missing: sunflower, barley, millets)
- **Frontend Fallback Crops**: 16 (Missing: banana, mango, jowar)
- **Shared Crops**: 13
- **Total Backend/Frontend Discrepancies**: 102
- **Evaluated Parameter Instances**: 190 (19 crops × 10 parameters)
- **Evidence Classifications**:
  - Class A (Directly Supported): 133 (70.0%)
  - Class B (Partially Supported): 10 (5.3%)
  - Class C (Conflicting Evidence): 1 (0.5%)
  - Class D (Unsupported / Defective): 46 (24.2%)
  - Class E (Not Applicable): 0 (0.0%)

---

## 5. Audit Verdicts

1. Canonical Crop Taxonomy Quality: **Approved with limitations**
2. Agronomic Parameter Evidence Quality: **Requires correction**
3. Backend Rule Engine Defensibility: **Requires correction**
4. Frontend Fallback Consistency: **Requires correction**
5. Suitability for Future Controlled Code Changes: **Approved with limitations**
6. Production Readiness: **Rejected**

---

## 6. SHA-256 Artifact Checksums

```
46e6b582167c01062b9a7f34cceca0a8a7ca226d91f24d77cb3725b3064cb9b0  reports/phase_3c_3_crop_inventory.csv
91875d269d6c66da9bc213b30e8c07e0b5efd3546a943722a2bb60fa9fa9ee89  reports/phase_3c_3_backend_frontend_consistency.csv
7717b378b240d25f560e2012d992f085521b5eb97061d4a0fa8892f254558e8e  reports/phase_3c_3_source_registry.csv
13f9a5ba231ce1b8b809d3b76a084535cecf83427778bfe5c2a16d56dcf38198  reports/phase_3c_3_agronomic_evidence_matrix.csv
45e78833141b9e19489fc93a4b0870eaee91d842d0a0b82f0a17409cbe7737c5  reports/phase_3c_3_validation_metrics.json
```
