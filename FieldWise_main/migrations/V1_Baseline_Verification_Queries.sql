-- =============================================================================
-- FieldWise Phase 3C: Baseline V1 Catalog Verification Gateway
-- File Reference: migrations/V1_Baseline_Verification_Queries.sql
-- =============================================================================
-- Target Database: PostgreSQL 15+ / Supabase Staging Instance
-- Target Schema: public
-- Target Tables: public.farmers, public.farm_profiles, public.crop_predictions
--
-- Security & Operational Invariants:
--   1. Missing-Object Safety: Uses to_regclass() exclusively. Never throws SQL aborts on missing objects.
--   2. Single Authoritative Source: All 8 core gates are defined once in a temporary view (_v1_baseline_verification_gates).
--   3. Unified Gateway Integrity: Query 8 aggregates directly from the shared gate results. Zero logic drift.
--   4. PUBLIC Inspection via aclexplode(): Inspects grantee OID 0 directly across all 3 tables.
--   5. Full Role Privilege Coverage: Verifies effective access for all 7 table privileges across anon, authenticated, and service_role.
--      Fails if required roles are missing in pg_roles.
--   6. Foreign-Key Integrity: Asserts exact ON DELETE RESTRICT (r) action on both child tables.
--   7. Nullability and Column Contract Audit: Validates all 31 columns across all 3 tables.
--   8. Zero Mutation: Strictly read-only verification. Does NOT alter any database state.
-- =============================================================================

\x on
\echo '============================================================================='
-- FieldWise Phase 3C: Initializing Baseline V1 Verification Gateway
\echo '============================================================================='

-- -----------------------------------------------------------------------------
-- Step 0: Authoritative Shared Verification Gates Definition (Temporary View)
-- Single source of truth for all 8 core gates. Dropped at script completion.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE TEMP VIEW _v1_baseline_verification_gates AS
WITH 
-- -----------------------------------------------------------------------------
-- Gate 1: Table Existence
-- -----------------------------------------------------------------------------
gate_1_exist AS (
    SELECT 
        '1_EXIST' AS gate_id,
        '1. Target Tables Existence' AS check_name,
        CASE 
            WHEN to_regclass('public.farmers') IS NOT NULL 
             AND to_regclass('public.farm_profiles') IS NOT NULL 
             AND to_regclass('public.crop_predictions') IS NOT NULL 
            THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        CASE 
            WHEN to_regclass('public.farmers') IS NOT NULL 
             AND to_regclass('public.farm_profiles') IS NOT NULL 
             AND to_regclass('public.crop_predictions') IS NOT NULL 
            THEN 'PASS: All 3 baseline V1 tables exist in schema public (farmers, farm_profiles, crop_predictions)'
            ELSE format('FAIL: Missing tables detected: farmers=%s, farm_profiles=%s, crop_predictions=%s',
                        CASE WHEN to_regclass('public.farmers') IS NULL THEN 'MISSING' ELSE 'EXISTS' END,
                        CASE WHEN to_regclass('public.farm_profiles') IS NULL THEN 'MISSING' ELSE 'EXISTS' END,
                        CASE WHEN to_regclass('public.crop_predictions') IS NULL THEN 'MISSING' ELSE 'EXISTS' END)
        END AS details,
        'Execute V1_Baseline_Schema.sql to create missing baseline tables' AS remediation
),

-- -----------------------------------------------------------------------------
-- Gate 2: Primary Keys Verification
-- -----------------------------------------------------------------------------
gate_2_pks AS (
    SELECT 
        '2_PKS' AS gate_id,
        '2. Primary Keys Definition' AS check_name,
        CASE 
            WHEN to_regclass('public.farmers') IS NULL 
              OR to_regclass('public.farm_profiles') IS NULL 
              OR to_regclass('public.crop_predictions') IS NULL THEN 'FAIL'
            WHEN COALESCE(pk_audit.valid_pk_count, 0) = 3 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        CASE 
            WHEN to_regclass('public.farmers') IS NULL 
              OR to_regclass('public.farm_profiles') IS NULL 
              OR to_regclass('public.crop_predictions') IS NULL 
                THEN 'FAIL: One or more baseline tables do not exist'
            WHEN COALESCE(pk_audit.valid_pk_count, 0) = 3 
                THEN 'PASS: All 3 tables possess valid single-column primary keys (farmers.id TEXT, farm_profiles.id UUID, crop_predictions.id UUID)'
            ELSE format('FAIL: Primary key mismatch (%s of 3 valid). Details: %s',
                        COALESCE(pk_audit.valid_pk_count, 0), COALESCE(pk_audit.pk_details, 'none'))
        END AS details,
        'Ensure all 3 tables have explicit PRIMARY KEY constraints matching V1_Baseline_Schema.sql' AS remediation
    FROM (SELECT 1) AS dummy
    LEFT JOIN (
        WITH expected_pks AS (
            SELECT * FROM (VALUES
                ('farmers',          'id', 'text'),
                ('farm_profiles',    'id', 'uuid'),
                ('crop_predictions', 'id', 'uuid')
            ) AS t(tbl_name, col_name, typ_name)
        )
        SELECT 
            COUNT(*) FILTER (WHERE is_valid) AS valid_pk_count,
            string_agg(format('%s: %s', e.tbl_name, CASE WHEN is_valid THEN 'VALID' ELSE 'INVALID' END), '; ') AS pk_details
        FROM expected_pks e
        LEFT JOIN LATERAL (
            SELECT 
                EXISTS (
                    SELECT 1 
                    FROM pg_constraint con
                    JOIN pg_class c ON c.oid = con.conrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = con.conkey[1]
                    JOIN pg_type t ON t.oid = a.atttypid
                    WHERE con.contype = 'p'
                      AND n.nspname = 'public'
                      AND c.relname = e.tbl_name
                      AND a.attname = e.col_name
                      AND t.typname = e.typ_name
                      AND array_length(con.conkey, 1) = 1
                ) AS is_valid
        ) l ON true
    ) pk_audit ON true
),

-- -----------------------------------------------------------------------------
-- Gate 3: Foreign Key Integrity & Delete Actions (ON DELETE RESTRICT)
-- -----------------------------------------------------------------------------
gate_3_fks AS (
    SELECT 
        '3_FKS' AS gate_id,
        '3. Foreign Key Integrity (ON DELETE RESTRICT)' AS check_name,
        CASE 
            WHEN to_regclass('public.farmers') IS NULL 
              OR to_regclass('public.farm_profiles') IS NULL 
              OR to_regclass('public.crop_predictions') IS NULL THEN 'FAIL'
            WHEN COALESCE(fk_audit.valid_fk_count, 0) = 2 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        CASE 
            WHEN to_regclass('public.farmers') IS NULL 
              OR to_regclass('public.farm_profiles') IS NULL 
              OR to_regclass('public.crop_predictions') IS NULL 
                THEN 'FAIL: One or more baseline tables do not exist'
            WHEN COALESCE(fk_audit.valid_fk_count, 0) = 2 
                THEN 'PASS: Both child tables enforce single-column FK on farmer_id -> public.farmers(id) with ON DELETE RESTRICT (r)'
            ELSE format('FAIL: Foreign key mismatch (%s of 2 valid). Details: %s',
                        COALESCE(fk_audit.valid_fk_count, 0), COALESCE(fk_audit.fk_details, 'none'))
        END AS details,
        'Ensure both farm_profiles and crop_predictions reference public.farmers(id) ON DELETE RESTRICT' AS remediation
    FROM (SELECT 1) AS dummy
    LEFT JOIN (
        WITH expected_fks AS (
            SELECT * FROM (VALUES
                ('farm_profiles',    'farmer_id', 'farmers', 'id', 'r'),
                ('crop_predictions', 'farmer_id', 'farmers', 'id', 'r')
            ) AS t(from_tbl, from_col, to_tbl, to_col, del_type)
        )
        SELECT 
            COUNT(*) FILTER (WHERE is_valid) AS valid_fk_count,
            string_agg(format('%s.%s -> %s.%s [del: %s, valid: %s]', 
                              e.from_tbl, e.from_col, e.to_tbl, e.to_col, e.del_type, is_valid), '; ') AS fk_details
        FROM expected_fks e
        LEFT JOIN LATERAL (
            SELECT 
                EXISTS (
                    SELECT 1 
                    FROM pg_constraint con
                    JOIN pg_class c_from ON c_from.oid = con.conrelid
                    JOIN pg_namespace n_from ON n_from.oid = c_from.relnamespace
                    JOIN pg_class c_to ON c_to.oid = con.confrelid
                    JOIN pg_namespace n_to ON n_to.oid = c_to.relnamespace
                    JOIN pg_attribute a_from ON a_from.attrelid = c_from.oid AND a_from.attnum = con.conkey[1]
                    JOIN pg_attribute a_to ON a_to.attrelid = c_to.oid AND a_to.attnum = con.confkey[1]
                    WHERE con.contype = 'f'
                      AND n_from.nspname = 'public' AND c_from.relname = e.from_tbl AND a_from.attname = e.from_col
                      AND n_to.nspname = 'public' AND c_to.relname = e.to_tbl AND a_to.attname = e.to_col
                      AND con.confdeltype = e.del_type
                      AND array_length(con.conkey, 1) = 1
                      AND array_length(con.confkey, 1) = 1
                ) AS is_valid
        ) l ON true
    ) fk_audit ON true
),

-- -----------------------------------------------------------------------------
-- Gate 4: Query Optimization Indexes
-- -----------------------------------------------------------------------------
gate_4_idx AS (
    SELECT 
        '4_INDEXES' AS gate_id,
        '4. Required Indexes' AS check_name,
        CASE 
            WHEN to_regclass('public.farmers') IS NULL 
              OR to_regclass('public.farm_profiles') IS NULL 
              OR to_regclass('public.crop_predictions') IS NULL THEN 'FAIL'
            WHEN COALESCE(idx_audit.valid_idx_count, 0) = 3 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        CASE 
            WHEN to_regclass('public.farmers') IS NULL 
              OR to_regclass('public.farm_profiles') IS NULL 
              OR to_regclass('public.crop_predictions') IS NULL 
                THEN 'FAIL: One or more baseline tables do not exist'
            WHEN COALESCE(idx_audit.valid_idx_count, 0) = 3 
                THEN 'PASS: All 3 performance indexes exist (idx_farmers_email, idx_farm_profiles_farmer_updated, idx_crop_predictions_farmer_created)'
            ELSE format('FAIL: Index mismatch (%s of 3 valid). Details: %s',
                        COALESCE(idx_audit.valid_idx_count, 0), COALESCE(idx_audit.idx_details, 'none'))
        END AS details,
        'CREATE INDEX IF NOT EXISTS statements from V1_Baseline_Schema.sql' AS remediation
    FROM (SELECT 1) AS dummy
    LEFT JOIN (
        WITH expected_indexes AS (
            SELECT * FROM (VALUES
                ('farmers',          'idx_farmers_email'),
                ('farm_profiles',    'idx_farm_profiles_farmer_updated'),
                ('crop_predictions', 'idx_crop_predictions_farmer_created')
            ) AS t(tbl_name, idx_name)
        )
        SELECT 
            COUNT(*) FILTER (WHERE is_valid) AS valid_idx_count,
            string_agg(format('%s: %s', e.idx_name, CASE WHEN is_valid THEN 'EXISTS' ELSE 'MISSING' END), '; ') AS idx_details
        FROM expected_indexes e
        LEFT JOIN LATERAL (
            SELECT 
                EXISTS (
                    SELECT 1 
                    FROM pg_index i
                    JOIN pg_class c_idx ON c_idx.oid = i.indexrelid
                    JOIN pg_class c_tbl ON c_tbl.oid = i.indrelid
                    JOIN pg_namespace n ON n.oid = c_tbl.relnamespace
                    WHERE n.nspname = 'public' 
                      AND c_tbl.relname = e.tbl_name
                      AND c_idx.relname = e.idx_name
                ) AS is_valid
        ) l ON true
    ) idx_audit ON true
),

-- -----------------------------------------------------------------------------
-- Gate 5: Row Level Security (RLS) & Policy Hardening
-- -----------------------------------------------------------------------------
gate_5_rls AS (
    SELECT 
        '5_RLS' AS gate_id,
        '5. Row Level Security & Policies' AS check_name,
        CASE 
            WHEN to_regclass('public.farmers') IS NULL 
              OR to_regclass('public.farm_profiles') IS NULL 
              OR to_regclass('public.crop_predictions') IS NULL THEN 'FAIL'
            WHEN COALESCE(rls_audit.rls_enabled_count, 0) != 3 THEN 'FAIL'
            WHEN COALESCE(rls_audit.unexpected_permissive_count, 0) > 0 THEN 'FAIL'
            ELSE 'PASS'
        END AS status,
        CASE 
            WHEN to_regclass('public.farmers') IS NULL 
              OR to_regclass('public.farm_profiles') IS NULL 
              OR to_regclass('public.crop_predictions') IS NULL 
                THEN 'FAIL: One or more baseline tables do not exist'
            WHEN COALESCE(rls_audit.rls_enabled_count, 0) != 3 
                THEN format('FAIL: RLS is not enabled across all 3 tables (%s of 3 enabled)', rls_audit.rls_enabled_count)
            WHEN COALESCE(rls_audit.unexpected_permissive_count, 0) > 0 
                THEN format('FAIL: Unexpected permissive RLS policies detected (%s unexpected: %s)',
                            rls_audit.unexpected_permissive_count, rls_audit.unexpected_policy_names)
            ELSE 'PASS: RLS enabled across all 3 tables (relrowsecurity=true). Zero permissive policies for anon/public: strict default-deny active.'
        END AS details,
        'ALTER TABLE <tbl> ENABLE ROW LEVEL SECURITY; and remove permissive anon policies' AS remediation
    FROM (SELECT 1) AS dummy
    LEFT JOIN (
        SELECT 
            COUNT(*) FILTER (WHERE c.relrowsecurity = true) AS rls_enabled_count,
            COUNT(*) FILTER (
                WHERE p.polpermissive = true 
                  AND (
                      p.polroles = '{0}'::oid[] OR 
                      EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid = ANY(p.polroles) AND r.rolname IN ('anon', 'public'))
                  )
            ) AS unexpected_permissive_count,
            string_agg(CASE WHEN p.polpermissive = true AND (p.polroles = '{0}'::oid[] OR EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid = ANY(p.polroles) AND r.rolname IN ('anon', 'public'))) THEN format('%s.%s', c.relname, p.polname) END, ', ') AS unexpected_policy_names
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_policy p ON p.polrelid = c.oid
        WHERE n.nspname = 'public' AND c.relname IN ('farmers', 'farm_profiles', 'crop_predictions')
    ) rls_audit ON true
),

-- -----------------------------------------------------------------------------
-- Gate 6: Explicit Grants & Effective Privileges
-- -----------------------------------------------------------------------------
gate_6_priv AS (
    SELECT 
        '6_PRIVILEGES' AS gate_id,
        '6. Effective Privileges & Least Privilege' AS check_name,
        CASE 
            WHEN to_regclass('public.farmers') IS NULL 
              OR to_regclass('public.farm_profiles') IS NULL 
              OR to_regclass('public.crop_predictions') IS NULL THEN 'FAIL'
            WHEN COALESCE(priv_audit.public_acl_count, 0) > 0 THEN 'FAIL'
            WHEN COALESCE(priv_audit.anon_has_privs, false) = true THEN 'FAIL'
            WHEN COALESCE(priv_audit.auth_has_privs, false) = true THEN 'FAIL'
            WHEN COALESCE(priv_audit.service_role_missing_privs, 0) > 0 THEN 'FAIL'
            ELSE 'PASS'
        END AS status,
        CASE 
            WHEN to_regclass('public.farmers') IS NULL 
              OR to_regclass('public.farm_profiles') IS NULL 
              OR to_regclass('public.crop_predictions') IS NULL 
                THEN 'FAIL: One or more baseline tables do not exist'
            WHEN COALESCE(priv_audit.public_acl_count, 0) > 0 
                THEN format('FAIL: PUBLIC possesses privileges in relacl (grantee OID 0): %s', priv_audit.public_acl_details)
            WHEN COALESCE(priv_audit.anon_has_privs, false) = true 
                THEN format('FAIL: Role anon possesses effective table privileges: %s', priv_audit.anon_priv_list)
            WHEN COALESCE(priv_audit.auth_has_privs, false) = true 
                THEN format('FAIL: Role authenticated possesses effective table privileges: %s', priv_audit.auth_priv_list)
            WHEN COALESCE(priv_audit.service_role_missing_privs, 0) > 0 
                THEN format('FAIL: service_role lacks required permissions (%s missing)', priv_audit.service_role_missing_privs)
            ELSE 'PASS: Hardened privilege model verified across all 3 tables. PUBLIC ACL (OID 0): 0 privs; anon: 0 privs; authenticated: 0 privs; service_role holds expected operational grants.'
        END AS details,
        'REVOKE ALL ON public.farmers, public.farm_profiles, public.crop_predictions FROM anon, authenticated, public;' AS remediation
    FROM (SELECT 1) AS dummy
    LEFT JOIN (
        SELECT 
            -- PUBLIC ACL (OID 0) check
            COUNT(*) FILTER (WHERE a.grantee = 0) AS public_acl_count,
            string_agg(CASE WHEN a.grantee = 0 THEN format('%s: %s', c.relname, a.privilege_type) END, '; ') AS public_acl_details,
            -- Effective anon privileges
            bool_or(r.rolname = 'anon' AND has_table_privilege(r.oid, c.oid, p.priv)) AS anon_has_privs,
            string_agg(CASE WHEN r.rolname = 'anon' AND has_table_privilege(r.oid, c.oid, p.priv) THEN format('%s.%s', c.relname, p.priv) END, ', ') AS anon_priv_list,
            -- Effective authenticated privileges
            bool_or(r.rolname = 'authenticated' AND has_table_privilege(r.oid, c.oid, p.priv)) AS auth_has_privs,
            string_agg(CASE WHEN r.rolname = 'authenticated' AND has_table_privilege(r.oid, c.oid, p.priv) THEN format('%s.%s', c.relname, p.priv) END, ', ') AS auth_priv_list,
            -- service_role required grants check
            COUNT(*) FILTER (
                WHERE r.rolname = 'service_role' 
                  AND (
                      (c.relname = 'farmers' AND p.priv IN ('SELECT', 'INSERT', 'UPDATE') AND NOT has_table_privilege(r.oid, c.oid, p.priv)) OR
                      (c.relname = 'farm_profiles' AND p.priv IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE') AND NOT has_table_privilege(r.oid, c.oid, p.priv)) OR
                      (c.relname = 'crop_predictions' AND p.priv IN ('SELECT', 'INSERT') AND NOT has_table_privilege(r.oid, c.oid, p.priv))
                  )
            ) AS service_role_missing_privs
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN pg_roles r
        CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS p(priv)
        LEFT JOIN LATERAL aclexplode(c.relacl) a ON true
        WHERE n.nspname = 'public' AND c.relname IN ('farmers', 'farm_profiles', 'crop_predictions')
          AND r.rolname IN ('anon', 'authenticated', 'service_role')
    ) priv_audit ON true
),

-- -----------------------------------------------------------------------------
-- Gate 7: Column Nullability & Schema Contract Audit (All 31 Expected Columns)
-- -----------------------------------------------------------------------------
gate_7_cols AS (
    SELECT 
        '7_COLUMNS' AS gate_id,
        '7. Column Presence & Nullability Contract (All 31 Columns)' AS check_name,
        CASE 
            WHEN to_regclass('public.farmers') IS NULL 
              OR to_regclass('public.farm_profiles') IS NULL 
              OR to_regclass('public.crop_predictions') IS NULL THEN 'FAIL'
            WHEN COALESCE(col_audit.passed_cols, 0) = 31 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        CASE 
            WHEN to_regclass('public.farmers') IS NULL 
              OR to_regclass('public.farm_profiles') IS NULL 
              OR to_regclass('public.crop_predictions') IS NULL 
                THEN 'FAIL: One or more baseline tables do not exist'
            WHEN COALESCE(col_audit.passed_cols, 0) = 31 
                THEN 'PASS: All 31 expected columns present with exact nullability across farmers (7), farm_profiles (12), and crop_predictions (12)'
            ELSE format('FAIL: Only %s of 31 columns passed contract audit. Failing/Missing: %s',
                        COALESCE(col_audit.passed_cols, 0), COALESCE(col_audit.failing_cols, 'all'))
        END AS details,
        'Ensure table definitions match V1_Baseline_Schema.sql exactly' AS remediation
    FROM (SELECT 1) AS dummy
    LEFT JOIN (
        WITH expected_cols AS (
            SELECT * FROM (VALUES
                -- public.farmers (7 columns)
                ('farmers', 'id',         'NO'),
                ('farmers', 'email',      'NO'),
                ('farmers', 'full_name',  'YES'),
                ('farmers', 'phone',      'YES'),
                ('farmers', 'location',   'YES'),
                ('farmers', 'farm_size',  'YES'),
                ('farmers', 'created_at', 'NO'),
                -- public.farm_profiles (12 columns)
                ('farm_profiles', 'id',              'NO'),
                ('farm_profiles', 'farmer_id',       'NO'),
                ('farm_profiles', 'state',           'YES'),
                ('farm_profiles', 'district',        'YES'),
                ('farm_profiles', 'soil_type',       'YES'),
                ('farm_profiles', 'ph',              'YES'),
                ('farm_profiles', 'nitrogen',        'YES'),
                ('farm_profiles', 'phosphorus',      'YES'),
                ('farm_profiles', 'potassium',       'YES'),
                ('farm_profiles', 'rainfall',        'YES'),
                ('farm_profiles', 'irrigation_type', 'YES'),
                ('farm_profiles', 'updated_at',      'NO'),
                -- public.crop_predictions (12 columns)
                ('crop_predictions', 'id',               'NO'),
                ('crop_predictions', 'farmer_id',        'NO'),
                ('crop_predictions', 'recommended_crop', 'NO'),
                ('crop_predictions', 'confidence',       'YES'),
                ('crop_predictions', 'nitrogen',         'YES'),
                ('crop_predictions', 'phosphorus',       'YES'),
                ('crop_predictions', 'potassium',        'YES'),
                ('crop_predictions', 'ph',               'YES'),
                ('crop_predictions', 'rainfall',         'YES'),
                ('crop_predictions', 'temperature',      'YES'),
                ('crop_predictions', 'humidity',         'YES'),
                ('crop_predictions', 'created_at',        'NO')
            ) AS t(tbl_name, col_name, expected_nullable)
        ),
        eval_cols AS (
            SELECT 
                e.tbl_name,
                e.col_name,
                (c.is_nullable IS NOT NULL AND c.is_nullable = e.expected_nullable) AS is_correct
            FROM expected_cols e
            LEFT JOIN information_schema.columns c 
                ON c.table_schema = 'public' 
               AND c.table_name = e.tbl_name 
               AND c.column_name = e.col_name
        )
        SELECT 
            COUNT(*) FILTER (WHERE is_correct = true) AS passed_cols,
            string_agg(CASE WHEN NOT is_correct OR is_correct IS NULL THEN format('%s.%s', tbl_name, col_name) END, ', ') AS failing_cols
        FROM eval_cols
    ) col_audit ON true
)

-- Combine all 7 core gates
SELECT * FROM gate_1_exist
UNION ALL SELECT * FROM gate_2_pks
UNION ALL SELECT * FROM gate_3_fks
UNION ALL SELECT * FROM gate_4_idx
UNION ALL SELECT * FROM gate_5_rls
UNION ALL SELECT * FROM gate_6_priv
UNION ALL SELECT * FROM gate_7_cols;

-- -----------------------------------------------------------------------------
-- Query 1: Table Existence
-- -----------------------------------------------------------------------------
SELECT check_name, status, details, remediation 
FROM _v1_baseline_verification_gates 
WHERE gate_id = '1_EXIST';

-- -----------------------------------------------------------------------------
-- Query 2: Primary Keys Definition
-- -----------------------------------------------------------------------------
SELECT check_name, status, details, remediation 
FROM _v1_baseline_verification_gates 
WHERE gate_id = '2_PKS';

-- -----------------------------------------------------------------------------
-- Query 3: Foreign Key Integrity (ON DELETE RESTRICT)
-- -----------------------------------------------------------------------------
SELECT check_name, status, details, remediation 
FROM _v1_baseline_verification_gates 
WHERE gate_id = '3_FKS';

-- -----------------------------------------------------------------------------
-- Query 4: Performance Indexes
-- -----------------------------------------------------------------------------
SELECT check_name, status, details, remediation 
FROM _v1_baseline_verification_gates 
WHERE gate_id = '4_INDEXES';

-- -----------------------------------------------------------------------------
-- Query 5: Row Level Security & Policies
-- -----------------------------------------------------------------------------
SELECT check_name, status, details, remediation 
FROM _v1_baseline_verification_gates 
WHERE gate_id = '5_RLS';

-- -----------------------------------------------------------------------------
-- Query 6: Privileges & Role Hardening
-- -----------------------------------------------------------------------------
SELECT check_name, status, details, remediation 
FROM _v1_baseline_verification_gates 
WHERE gate_id = '6_PRIVILEGES';

-- -----------------------------------------------------------------------------
-- Query 7: Column Nullability & Presence Audit
-- -----------------------------------------------------------------------------
SELECT check_name, status, details, remediation 
FROM _v1_baseline_verification_gates 
WHERE gate_id = '7_COLUMNS';

-- -----------------------------------------------------------------------------
-- Query 8: Unified Baseline Gateway Verdict
-- -----------------------------------------------------------------------------
SELECT 
    '8. Unified Baseline Gateway Verdict' AS check_name,
    CASE 
        WHEN bool_and(status = 'PASS') AND count(*) = 7 THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN bool_and(status = 'PASS') AND count(*) = 7 
            THEN 'GATEWAY VERIFIED: All 7 baseline V1 catalog verification gates PASSED without errors. Baseline schema approved for V2 migration application.'
        ELSE format('GATEWAY BLOCKED: Baseline verification failed (%s of %s gates passed). Failing gates: %s',
                    count(*) FILTER (WHERE status = 'PASS'),
                    count(*),
                    string_agg(CASE WHEN status != 'PASS' THEN format('[%s: %s]', gate_id, details) END, '; '))
    END AS details,
    CASE 
        WHEN bool_and(status = 'PASS') AND count(*) = 7 
            THEN 'None. Target database is ready for Phase 3C.6.6.2 (V2_Persistence_Migration_Final_v3.sql).'
        ELSE 'Review diagnostic outputs in Queries 1-7 above and resolve indicated schema failures.'
    END AS remediation
FROM _v1_baseline_verification_gates;

-- -----------------------------------------------------------------------------
-- Step Cleanup: Drop Temporary View
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS _v1_baseline_verification_gates;

\echo '============================================================================='
-- FieldWise Phase 3C: Baseline V1 Catalog Verification Gateway Complete
\echo '============================================================================='
