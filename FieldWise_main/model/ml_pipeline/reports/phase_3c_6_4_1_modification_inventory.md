# FieldWise — Phase 3C.6.4.1.1: File Modification Inventory & Safety Boundaries

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_4_1_modification_inventory.md`  
**Phase**: 3C.6.4.1.1 Persistence Design Closure (Read-Only)  
**Execution Timestamp**: November 2026  
**Status**: APPROVED RECONCILED INVENTORY  

---

## 1. Executive Summary

Phase 3C.6.4.1.1 is strictly **READ-ONLY**.

- **Application Production Code**: **0 modifications**. No frontend or backend files were modified.
- **Database Schemas & Migrations**: **0 migrations executed**. No tables created or altered.
- **Database Records**: **0 records inserted, updated, or deleted**.
- **RLS Policies**: **0 policy changes**.
- **Recommendation Engine Core**: All 14 files and `adapter_cli.py` confirmed 100% frozen via authoritative checksums.
- **Credential Protection**: **0 secrets exposed**.

---

## 2. Inventory of Created & Updated Report Deliverables

| Deliverable Report File Path | Action | Scope & Reconciled Content |
| :--- | :---: | :--- |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_4_1_persistence_architecture.md` | **Updated** | Comprehensive persistence audit distinguishing verified code from proposed design. Documents backend auth inspection, lack of Firebase verification, absence of Supabase connection in backend, and explicit **BLOCKED** status for cloud persistence pending auth closure. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_4_1_proposed_schema_and_diagram.md` | **Updated** | Reconciled Option A schema DDL: `has_soil_test` as `BOOLEAN NULL`, documented units/provenance for all numeric inputs, verbatim `request_payload` and `response_payload` JSONB snapshots, `api_version`, `idempotency_key`, `request_hash`, status-gated metrics check constraint, frozen contract constraint justifications (permitting negative temperatures), and append-only trigger. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_4_1_security_and_rls_assessment.md` | **Updated** | Authentication and ownership audit. Documents `backend/src/middleware/auth.js` local HMAC JWT verification, lack of Firebase ID token verification, lack of identity mapping to `public.farmers.id`, prohibition of client-supplied ownership, concrete RLS grants/policies, and append-only privilege design. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_4_1_migration_and_rollback_proposal.md` | **Updated** | Replaces unconditional `DROP TABLE CASCADE` with multi-tier rollback: Tier 1 pre-deployment zero-record drop, Tier 2 post-deployment application-level feature flag disable (preserving farmer data), Tier 3 application code rollback, dependency inspection, and disaster recovery backup protocols. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_4_1_v1_storage_mapping.md` | **Preserved** | Complete V1 storage-field breakdown, omissions in Supabase, and catalog of all 6 downstream consumers. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_4_1_v2_storage_mapping.md` | **Preserved** | Full V2 contract mapping and 8 mandatory semantic safeguards. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_4_1_inspected_files_inventory.md` | **Preserved** | Complete inventory of all inspected source files across backend, frontend, landing, and frozen engine. |
| `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_4_1_checksums.txt` | **Updated** | Authoritative SHA-256 manifest of all deliverable reports. |

---

## 3. Reconciled Verification Arithmetic

The test suite counts have been reconciled with exact precision, distinguishing unique automated tests from checksum verification checks:

### 3.1 Automated Test Execution Count: Exactly 166 Unique Tests

```
================================================================================
FieldWise Automated Test Suite Accounting (Reconciled)
================================================================================
  1. Frontend Vitest Suite:
     • src/test/example.test.ts .............................  1 test
     • src/test/v2_frontend_integration.test.tsx ............ 29 tests
     ───────────────────────────────────────────────────────────────
     Frontend Total:                                          30 tests

  2. Backend Bridge Suite:
     • backend/src/tests/auth.test.js .......................  1 test
     • backend/src/tests/v2_bridge_unit.test.js ............. 40 tests
     • backend/src/tests/v2_bridge_integration.test.js ...... 16 tests
     ───────────────────────────────────────────────────────────────
     Backend Total:                                           57 tests

  3. Python Engine & Adapter Suite:
     • recommendation_engine/tests/test_adapter_cli.py ...... 17 tests
     • recommendation_engine/tests/run_all_tests.py ......... 62 tests
     ───────────────────────────────────────────────────────────────
     Python Total:                                            79 tests

================================================================================
TOTAL UNIQUE AUTOMATED TESTS:                                166 tests (100% Pass)
================================================================================
```

*(Note: The previous report listed 167 due to a duplicate single-test count; the verified unique count is exactly 166).*

### 3.2 Checksum Verification Checks (Reported Separately)
- **Frozen Engine Checksums** (`phase_3c_6_2_1_3_checksums.txt`): **28 authoritative file checksums verified OK**.
- **Phase 3C.6.4.1.1 Deliverable Checksums** (`phase_3c_6_4_1_checksums.txt`): **8 deliverable report checksums verified OK**.
- Total checksum verifications: **36 verified OK**.
