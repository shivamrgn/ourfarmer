# FieldWise Phase 3C.6.8: Staging Infrastructure Provisioning & Readiness Report

**Execution Date:** 2026-11-21  
**Phase Target:** Phase 3C.6.8 — Staging Infrastructure Provisioning  
**Preceding Release Baseline:** Phase 3C.6.6.3 (Strictly Frozen)  
**Target Milestone:** Phase 3C.6.7 (Staging Deployment & End-to-End Acceptance)  
**Readiness Gateway Decision:** **NO-GO (BLOCKED PENDING STAGING DATABASE PROVISIONING)**

---

## 1. Executive Summary & Environment Classification

FieldWise Phase 3C.6.8 evaluates the infrastructure readiness of an isolated staging environment to host the frozen Phase 3C.6.6.3 V2 recommendation persistence implementation without impacting production systems.

### Scope & Strict Safeguards Enforced:
1. **Preservation of Phase 3C.6.6.3:** Zero application source code modifications have been made to the V1 API (`/api/predict`), V1 prediction persistence, Node-to-Python bridge, or the 15 frozen Python recommendation-engine modules.
2. **Production Isolation:** No commands, queries, or network calls were directed to production or shared database instances.
3. **Migration Holds:** The final PostgreSQL migration script (`V2_Persistence_Migration_Final_v3.sql`) has **NOT** been executed.
4. **Secret Zero-Exposure:** No API secrets, service-role keys, JWT secrets, or live credentials were read, printed, or recorded in this repository or report.
5. **No Speculative or Fabricated Credentials:** Staging infrastructure is recognized as **unprovisioned** in this local repository environment. No simulated runs were claimed as real staging executions.

### Environment Status:
* **Staging Database Status:** **UNPROVISIONED / OFFLINE** (Port 5432 closed locally, no dedicated cloud staging database configured).
* **Backup & PITR Status:** **NO SNAPSHOT AVAILABLE** (Cannot snapshot a non-existent database).
* **Current Operational Decision:** **NO-GO FOR PHASE 3C.6.7 DEPLOYMENT.** Detailed DBA checklist and verification suites have been generated to enable rapid deployment once cloud resources are provisioned.

---

## 2. Staging Infrastructure Setup Checklist (Tasks A & B)

Before executing Phase 3C.6.7 end-to-end acceptance tests, an infrastructure administrator or DBA must provision a dedicated, isolated staging environment adhering to this checklist.

| # | Infrastructure Domain | Requirement & Specification | Verification Method |
|---|----------------------|-----------------------------|---------------------|
| 1 | **Isolated Database** | Dedicated Supabase staging project or PostgreSQL 15+ instance. Completely separated from production project and production network. | Inspect Supabase dashboard / AWS RDS VPC. Hostname must reflect staging. |
| 2 | **Database Version** | PostgreSQL version 15.1+ or 16.x. | `SELECT version();` |
| 3 | **Required Extensions** | `pgcrypto` or `uuid-ossp` (for `gen_random_uuid()`), `btree_gin` (for GIN index on `top_recommendations` JSONB), `plpgsql`. | `SELECT * FROM pg_extension;` |
| 4 | **Parent Schema** | `public.farmers` table must be provisioned with `id TEXT PRIMARY KEY` or `VARCHAR PRIMARY KEY` matching the SQLite `users.id` synchronization key. | `\d public.farmers` |
| 5 | **Privileged Service Role** | Dedicated staging service-role key (`SUPABASE_SERVICE_ROLE_KEY`) with table-level bypass of RLS, used strictly by backend. | Verify token claims: `role: 'service_role'`. |
| 6 | **Public Anon Role** | Dedicated staging public anon key (`SUPABASE_ANON_KEY`) for public client handshakes. Strictly revoked from writing to V2 recommendations. | Verify token claims: `role: 'anon'`. |
| 7 | **Backend Staging Host** | Staging Node.js runtime (v20+), running on isolated port/host (e.g. `PORT=3001` or `staging-api.fieldwise.agri`). | `curl -k https://<staging-api>/health` |
| 8 | **Frontend Staging Host** | Staging Vite build consuming staging API endpoints (`VITE_API_URL`). Never bundled with service-role keys or database credentials. | Client bundle audit. |
| 9 | **Disaster Recovery** | Verified pre-migration database snapshot or point-in-time recovery (PITR) enabled. | Execute `pg_dump -Fc` or trigger cloud snapshot. |

---

## 3. Sanitized Staging Configuration Templates

To prevent accidental secret leaks and ensure uniform staging deployments, sanitized templates have been generated and committed to the workspace.

### 3.1 Backend Staging Template (`FieldWise_main/backend/.env.staging.example`)
```ini
# =============================================================================
# FieldWise Phase 3C.6.8: Backend Staging Environment Template
# File Reference: FieldWise_main/backend/.env.staging.example
# =============================================================================
# SECURITY RULES:
#   1. DO NOT commit actual secrets or staging credentials to Git.
#   2. Staging credentials MUST be completely isolated from production.
#   3. Service-role keys (SUPABASE_SERVICE_ROLE_KEY) are backend-only and must NEVER
#      be shared with frontend bundles or external clients.
#   4. Copy this file to .env.staging and populate with designated staging credentials.
# =============================================================================

# Server Port & Environment Mode
PORT=3001
NODE_ENV=staging

# Staging Authentication JWT Secret
# Generate a dedicated 256-bit random string for staging (e.g. openssl rand -base64 32)
JWT_SECRET=staging_jwt_secret_key_change_me
JWT_EXPIRES_IN=7d

# Designated Supabase Staging Project Configuration
# Staging project reference must be distinct from production (e.g., https://<staging-ref>.supabase.co)
SUPABASE_URL=https://<your-staging-project-ref>.supabase.co

# Privileged Server-Side Service Role Key (Required for backend-mediated persistence)
# MUST have bypass RLS capabilities on public.v2_crop_recommendations.
# NEVER expose to browser clients or frontend code.
SUPABASE_SERVICE_ROLE_KEY=<your-staging-service-role-key>

# Public Anon Key for Staging (Optional on backend, used for public client fallbacks)
SUPABASE_ANON_KEY=<your-staging-anon-key>

# Cloud Persistence Switch
ENABLE_V2_CLOUD_PERSISTENCE=true

# Staging Direct PostgreSQL Connection String (Used for DBA psql migrations / backups)
# Example: postgresql://postgres:[STAGING-PASSWORD]@db.<staging-ref>.supabase.co:5432/postgres
DATABASE_URL=postgresql://postgres:<staging-db-password>@db.<your-staging-project-ref>.supabase.co:5432/postgres
```

### 3.2 Frontend Staging Template (`FieldWise_main/.env.staging.example`)
```ini
# =============================================================================
# FieldWise Phase 3C.6.8: Frontend Staging Environment Template
# File Reference: FieldWise_main/.env.staging.example
# =============================================================================
# SECURITY RULES:
#   1. All VITE_* variables are bundled into browser client code.
#   2. NEVER put service-role keys, database passwords, or private secrets in this file.
#   3. Frontend communicates with the backend REST API; database persistence is backend-mediated.
#   4. Copy this file to .env.staging and populate with designated staging public endpoints.
# =============================================================================

# Google Gemini API Key (Staging AI insights / disease detection sandbox)
VITE_GEMINI_API_KEY=<your-staging-gemini-api-key>

# Backend Staging REST API URL
# Points to the deployed staging backend service or local staging port
VITE_API_URL=https://staging-api.fieldwise.agri

# Staging Landing Page URL (For authentication redirects and logout flow)
VITE_LANDING_APP_URL=https://staging.fieldwise.agri

# Staging Supabase Public URL
VITE_SUPABASE_URL=https://<your-staging-project-ref>.supabase.co

# Staging Supabase Public Anon Key (Browser-safe anon key only; NEVER service_role)
VITE_SUPABASE_ANON_KEY=<your-staging-anon-key>

# Optional OpenWeather Staging API Key
VITE_OPENWEATHER_API_KEY=<your-staging-openweather-api-key>
```

### 3.3 Git Ignore Protection Verification
The workspace `.gitignore` file (`FieldWise_main/.gitignore`) was explicitly hardened to ensure staging credentials can never be accidentally committed to source control:
```gitignore
# Staging environment configuration secrets (Phase 3C.6.8)
.env.staging
.env.staging.local
.env.*.local
backend/.env.staging
backend/.env.staging.local
backend/.env.*.local
```
**Verification Evidence:** Tested via `git check-ignore`:
```bash
$ git check-ignore FieldWise_main/.env.staging FieldWise_main/backend/.env.staging
FieldWise_main/.env.staging
FieldWise_main/backend/.env.staging
# Exit code 0 (Confirmed ignored)
```

---

## 4. Pre-Migration Database Inspection & DBA Instructions

Because no isolated staging database is currently active in the local development sandbox, pre-migration verification cannot be executed against live tables at this moment. The deployment engineer or DBA must run the following preflight checks prior to running `V2_Persistence_Migration_Final_v3.sql`.

### Preflight Step 1: Pre-Migration Backup & Snapshot
A clean snapshot must be taken immediately before running the migration:
```bash
# Standalone PostgreSQL Backup Command:
pg_dump -h <staging-host> -U postgres -d postgres -Fc -f "staging_backup_pre_v2_$(date +%Y%m%d_%H%M%S).dump"

# Supabase Staging:
# Navigate to Dashboard -> Project Settings -> Database -> Backups -> Create Manual Backup
```

### Preflight Step 2: Database Version and Active Extensions Check
```sql
-- 1. Check PostgreSQL Version (Requires >= 15.0)
SELECT version();

-- 2. Check Required Extensions
SELECT extname, extversion 
FROM pg_extension 
WHERE extname IN ('pgcrypto', 'uuid-ossp', 'btree_gin', 'plpgsql');
```
*Remediation if extensions are missing:*
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gin;
```

### Preflight Step 3: Verify Existing `public.farmers` Parent Table
The `public.farmers` table must exist and have an `id` column compatible with the `farmer_id` foreign key:
```sql
SELECT 
    table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'farmers' 
  AND column_name = 'id';
```
*Expected Result:*
- `table_name`: `farmers`
- `column_name`: `id`
- `data_type`: `text` or `character varying`
- `is_nullable`: `NO`

### Preflight Step 4: Verify Absence of Incompatible Prior Tables
Confirm that no conflicting or partial `v2_crop_recommendations` table exists with legacy columns or incorrect constraints:
```sql
SELECT 
    CASE 
        WHEN to_regclass('public.v2_crop_recommendations') IS NULL THEN 'PROCEED: Table does not exist'
        ELSE 'WARNING: Table already exists. Inspect schema before running migration.'
    END AS preflight_table_status;
```

---

## 5. Post-Migration DBA Catalog Verification Suite

Following the execution of `FieldWise_main/migrations/V2_Persistence_Migration_Final_v3.sql`, the DBA must execute the authoritative catalog verification script:  
**`FieldWise_main/migrations/V2_DBA_Staging_Verification_Queries.sql`**

### Design Principle of the Catalog Verification Suite
Standard SQL queries returning empty result sets (`0 rows`) when a table or constraint does not exist can create the illusion of success in automated runners.  
To eliminate false passes:
- Every query utilizes `FROM (SELECT 1) AS dummy LEFT JOIN ...` to guarantee that exactly **one row** is returned per test.
- Every check outputs an explicit `status` column with either **`PASS`** or **`FAIL`**.
- Detailed diagnostics and remediation SQL are emitted directly in the query output for any failure.

### 5.1 Verification Query Suite Reference

#### Query 1: Foreign-Key Definition and Delete Action
*Validates that `farmer_id` references `public.farmers(id)` with `ON DELETE RESTRICT` (pg_constraint code `'r'`).*
```sql
SELECT 
    '1. Foreign Key Integrity' AS check_name,
    CASE 
        WHEN con.confdeltype = 'r' 
             AND c_from.relname = 'v2_crop_recommendations' 
             AND a_from.attname = 'farmer_id' 
             AND c_to.relname = 'farmers' 
             AND a_to.attname = 'id'
        THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    COALESCE(
        format('Constraint "%s": %s.%s -> %s.%s (ON DELETE %s)', 
               con.conname, c_from.relname, a_from.attname, c_to.relname, a_to.attname,
               CASE con.confdeltype WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE con.confdeltype::text END),
        'FAIL: Foreign key constraint on farmer_id -> public.farmers(id) NOT FOUND'
    ) AS details,
    CASE 
        WHEN con.confdeltype = 'r' THEN 'None'
        ELSE 'Ensure farmer_id references public.farmers(id) ON DELETE RESTRICT'
    END AS remediation
FROM (SELECT 1) AS dummy
LEFT JOIN pg_constraint con 
    ON con.contype = 'f' 
   AND con.conrelid = 'public.v2_crop_recommendations'::regclass
   AND con.confrelid = 'public.farmers'::regclass
LEFT JOIN pg_class c_from ON c_from.oid = con.conrelid
LEFT JOIN pg_class c_to ON c_to.oid = con.confrelid
LEFT JOIN pg_attribute a_from ON a_from.attrelid = c_from.oid AND a_from.attnum = con.conkey[1]
LEFT JOIN pg_attribute a_to ON a_to.attrelid = c_to.oid AND a_to.attnum = con.confkey[1];
```

#### Query 2: Exact Composite Unique Constraint
*Validates that a unique constraint spans exactly `(farmer_id, idempotency_key)` to enforce idempotency.*
```sql
SELECT 
    '2. Composite Unique Constraint' AS check_name,
    CASE 
        WHEN u.unique_cols = ARRAY['farmer_id', 'idempotency_key'] THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    COALESCE(
        format('Constraint "%s" on columns %s', u.conname, u.unique_cols::text),
        'FAIL: Unique constraint on (farmer_id, idempotency_key) NOT FOUND'
    ) AS details,
    CASE 
        WHEN u.unique_cols = ARRAY['farmer_id', 'idempotency_key'] THEN 'None'
        ELSE 'Add CONSTRAINT uq_v2_rec_farmer_idempotency UNIQUE (farmer_id, idempotency_key)'
    END AS remediation
FROM (SELECT 1) AS dummy
LEFT JOIN (
    SELECT con.conname, array_agg(a.attname ORDER BY array_position(con.conkey, a.attnum)) AS unique_cols
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(con.conkey)
    WHERE con.contype = 'u' 
      AND con.conrelid = 'public.v2_crop_recommendations'::regclass
      AND array_length(con.conkey, 1) = 2
    GROUP BY con.conname
    HAVING array_agg(a.attname ORDER BY array_position(con.conkey, a.attnum)) = ARRAY['farmer_id', 'idempotency_key']
) u ON true;
```

#### Query 3: Immutability Trigger Events & Status
*Validates that trigger `trg_prevent_v2_recommendations_mutation` is attached, enabled (`tgenabled = 'O'`), intercepts both `UPDATE` and `DELETE`, and points to `fn_prevent_v2_recommendations_mutation()`.*
```sql
SELECT 
    '3. Immutability Trigger' AS check_name,
    CASE 
        WHEN tg.tgname IS NOT NULL 
             AND tg.tgenabled = 'O' 
             AND (tg.tgtype & 4) != 0 
             AND (tg.tgtype & 8) != 0
             AND tg.proname = 'fn_prevent_v2_recommendations_mutation'
        THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    COALESCE(
        format('Trigger "%s" enabled=%s, events=[%s%s], function=%s()',
               tg.tgname, tg.tgenabled,
               CASE WHEN (tg.tgtype & 4) != 0 THEN 'UPDATE ' ELSE '' END,
               CASE WHEN (tg.tgtype & 8) != 0 THEN 'DELETE' ELSE '' END,
               tg.proname),
        'FAIL: Active immutability trigger NOT FOUND on public.v2_crop_recommendations'
    ) AS details,
    'Ensure trg_prevent_v2_recommendations_mutation BEFORE UPDATE OR DELETE is attached and enabled' AS remediation
FROM (SELECT 1) AS dummy
LEFT JOIN (
    SELECT tg.tgname, tg.tgenabled, tg.tgtype, p.proname
    FROM pg_trigger tg
    JOIN pg_proc p ON p.oid = tg.tgfoid
    WHERE tg.tgrelid = 'public.v2_crop_recommendations'::regclass
      AND NOT tg.tgisinternal
      AND tg.tgname = 'trg_prevent_v2_recommendations_mutation'
) tg ON true;
```

#### Query 4: Row Level Security (RLS) State
*Validates that RLS is explicitly enabled (`relrowsecurity = true`).*
```sql
SELECT 
    '4. Row Level Security (RLS)' AS check_name,
    CASE 
        WHEN c.relrowsecurity = true THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    COALESCE(
        format('Table public.v2_crop_recommendations RLS enabled=%s, policies_count=%s', c.relrowsecurity, COALESCE(pol.cnt, 0)),
        'FAIL: Table public.v2_crop_recommendations NOT FOUND'
    ) AS details,
    'Run: ALTER TABLE public.v2_crop_recommendations ENABLE ROW LEVEL SECURITY;' AS remediation
FROM (SELECT 1) AS dummy
LEFT JOIN pg_class c ON c.oid = 'public.v2_crop_recommendations'::regclass
LEFT JOIN (
    SELECT count(*) AS cnt FROM pg_policy WHERE polrelid = 'public.v2_crop_recommendations'::regclass
) pol ON true;
```

#### Query 5: Explicit and Effective Role Privilege Hardening
*Validates that anonymous role has 0 permissions, authenticated and public have 0 mutation privileges, and service_role has necessary SELECT and INSERT permissions.*
```sql
SELECT 
    '5. Privilege Hardening' AS check_name,
    CASE 
        WHEN privs.anon_count = 0 
             AND privs.auth_mutation_count = 0 
             AND privs.public_mutation_count = 0
             AND privs.service_role_count >= 2
        THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    format('anon_privileges=%s (exp 0), auth_mutations=%s (exp 0), public_mutations=%s (exp 0), service_role_privs=%s (exp >=2)',
           privs.anon_count, privs.auth_mutation_count, privs.public_mutation_count, privs.service_role_count) AS details,
    'REVOKE ALL FROM anon, authenticated, public; GRANT SELECT, INSERT TO service_role;' AS remediation
FROM (
    SELECT 
        COUNT(*) FILTER (WHERE grantee = 'anon') AS anon_count,
        COUNT(*) FILTER (WHERE grantee = 'authenticated' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')) AS auth_mutation_count,
        COUNT(*) FILTER (WHERE grantee = 'PUBLIC' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')) AS public_mutation_count,
        COUNT(*) FILTER (WHERE grantee = 'service_role' AND privilege_type IN ('SELECT', 'INSERT')) AS service_role_count
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'v2_crop_recommendations'
) privs;
```

#### Query 6: Numeric NaN and Infinity Rejection Constraints
*Validates that all 11 numeric agronomic and input columns have explicit `!= 'NaN'::numeric` constraints.*
```sql
SELECT 
    '6. Numeric NaN Rejection' AS check_name,
    CASE 
        WHEN nan_check.guarded_cols = 11 THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    format('%s of 11 numeric columns explicitly guarded with != NaN::numeric', nan_check.guarded_cols) AS details,
    'Ensure all 11 numeric columns have CHECK (col IS NULL OR (... AND col != ''NaN''::numeric))' AS remediation
FROM (
    SELECT count(DISTINCT c.conname) AS guarded_cols
    FROM pg_constraint c
    WHERE c.conrelid = 'public.v2_crop_recommendations'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%!= ''NaN''::numeric%'
) nan_check;
```

#### Query 7: Nullability Invariants (Mandatory vs Optional Columns)
*Validates that mandatory fields (`state`) are `NOT NULL` while unselected optional inputs (`sowing_month`, `district`, `irrigation_access`, `soil_texture`, `has_soil_test`) are preserved as `NULLable`.*
```sql
SELECT 
    '7. Nullability & Optional Fields' AS check_name,
    CASE 
        WHEN cols.sowing_month_null = 'YES' 
             AND cols.district_null = 'YES' 
             AND cols.irrigation_null = 'YES' 
             AND cols.soil_texture_null = 'YES' 
             AND cols.has_soil_test_null = 'YES' 
             AND cols.state_null = 'NO'
        THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    format('state(NOT NULL)=%s, sowing_month(NULLABLE)=%s, district=%s, irrigation=%s, soil_texture=%s, has_soil_test=%s',
           cols.state_null = 'NO', cols.sowing_month_null = 'YES', cols.district_null, cols.irrigation_null, cols.soil_texture_null, cols.has_soil_test_null) AS details,
    'Ensure state is NOT NULL and sowing_month, district, irrigation, texture, has_soil_test are NULLable' AS remediation
FROM (
    SELECT 
        MAX(CASE WHEN column_name = 'state' THEN is_nullable END) AS state_null,
        MAX(CASE WHEN column_name = 'sowing_month' THEN is_nullable END) AS sowing_month_null,
        MAX(CASE WHEN column_name = 'district' THEN is_nullable END) AS district_null,
        MAX(CASE WHEN column_name = 'irrigation_access' THEN is_nullable END) AS irrigation_null,
        MAX(CASE WHEN column_name = 'soil_texture' THEN is_nullable END) AS soil_texture_null,
        MAX(CASE WHEN column_name = 'has_soil_test' THEN is_nullable END) AS has_soil_test_null
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'v2_crop_recommendations'
) cols;
```

---

## 6. Readiness Determination & Blocker Summary

### Operational Decision: **NO-GO FOR PHASE 3C.6.7 STAGING EXECUTION**

### Specific Blocker Inventory:
1. **Unprovisioned Staging Cloud Database:** A dedicated, isolated Supabase staging instance or PostgreSQL 15+ database has not yet been provisioned by the cloud project administrator.
2. **Missing Staging Service Credentials:** No staging `SUPABASE_SERVICE_ROLE_KEY` or staging `DATABASE_URL` exists in the local environment.
3. **No Active Database Snapshot:** A pre-migration backup cannot be created until the designated staging database is live and reachable.
4. **Local Port 5432 Inactive:** No local PostgreSQL daemon is bound to port 5432.

### Next Action to Unblock Phase 3C.6.7:
1. Cloud administrator provisions an isolated Supabase staging project or PostgreSQL database.
2. Deployment engineer populates `FieldWise_main/backend/.env.staging` and `FieldWise_main/.env.staging` using the sanitized `.example` templates.
3. DBA executes the preflight checks and applies `V2_Persistence_Migration_Final_v3.sql`.
4. DBA runs `V2_DBA_Staging_Verification_Queries.sql` to verify that all 7 checks return `PASS`.
5. Once all 7 checks return `PASS`, Phase 3C.6.7 end-to-end acceptance testing may immediately commence.

---
*Report certified compliant with Phase 3C.6.8 guidelines. Zero production systems modified. Zero application code modified.*
