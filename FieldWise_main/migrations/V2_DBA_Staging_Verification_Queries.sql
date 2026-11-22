-- =============================================================================
-- FieldWise Phase 3C.6.8.2: Final Authoritative DBA Staging Catalog Verification Gateway
-- File Reference: migrations/V2_DBA_Staging_Verification_Queries.sql
-- =============================================================================
-- Target Database: PostgreSQL 15+ / Supabase Staging Instance
-- Target Table: public.v2_crop_recommendations
-- Target Parent: public.farmers
--
-- Security & Operational Invariants:
--   1. Missing-Object Safety: Uses to_regclass() exclusively. Never throws SQL aborts on missing objects.
--   2. Single Authoritative Source: All 8 core gates are defined once in a temporary view (_v2_staging_verification_gates).
--   3. Unified Gateway Integrity: Query 8 aggregates directly from the shared gate results. Zero logic drift.
--   4. PUBLIC Inspection via aclexplode(): Inspects grantee OID 0 directly. Never passes 'public' to has_table_privilege().
--   5. Full Role Privilege Coverage: Verifies effective access for all 7 table privileges across anon, authenticated, and service_role.
--      Fails if required roles are missing in pg_roles. Asserts service_role lacks effective UPDATE, DELETE, TRUNCATE.
--   6. Column-Specific Constraint Semantics: Replaces naive substring checks with exact column attachment (conkey = ARRAY[attnum]),
--      regex-anchored NaN rejection, exact numeric bounds, and explicit handling of unbounded measurements.
--   7. RLS Interpretation: Audits policies individually. Flags unexpected permissive policies. Documents BYPASSRLS behavior.
--   8. Scope Honesty: Query 7 explicitly labeled as Nullability and Column-Presence audit for all 39 columns.
-- =============================================================================

\x on
\echo '============================================================================='
\echo 'FieldWise Phase 3C.6.8.2: Initializing Authoritative Staging Verification'
\echo '============================================================================='

-- -----------------------------------------------------------------------------
-- Step 0: Authoritative Shared Verification Gates Definition (Temporary View)
-- Single source of truth for all 8 core gates. Dropped at script completion.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE TEMP VIEW _v2_staging_verification_gates AS
WITH 
-- -----------------------------------------------------------------------------
-- Gate 1: Foreign Key Integrity
-- -----------------------------------------------------------------------------
gate_1_fk AS (
    SELECT 
        '1_FK' AS gate_id,
        '1. Foreign Key Integrity' AS check_name,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL THEN 'FAIL'
            WHEN to_regclass('public.farmers') IS NULL THEN 'FAIL'
            WHEN COALESCE(fk.valid_fk_count, 0) = 1 AND COALESCE(fk.total_table_fk_count, 0) = 1 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL 
                THEN 'FAIL: Target table public.v2_crop_recommendations does not exist'
            WHEN to_regclass('public.farmers') IS NULL 
                THEN 'FAIL: Parent table public.farmers does not exist'
            WHEN COALESCE(fk.total_table_fk_count, 0) = 0 
                THEN 'FAIL: Foreign key constraint on farmer_id -> public.farmers(id) NOT FOUND'
            WHEN COALESCE(fk.valid_fk_count, 0) = 1 AND COALESCE(fk.total_table_fk_count, 0) = 1 
                THEN COALESCE(fk.details, 'PASS: Valid foreign key found')
            WHEN COALESCE(fk.total_table_fk_count, 0) > 1 
                THEN format('FAIL: Ambiguous/additional foreign keys detected (%s foreign keys on table: %s)', fk.total_table_fk_count, fk.details)
            ELSE format('FAIL: Foreign key configuration mismatch (%s)', fk.details)
        END AS details,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL OR to_regclass('public.farmers') IS NULL 
                THEN 'Ensure both public.farmers and public.v2_crop_recommendations exist before running migration'
            WHEN COALESCE(fk.valid_fk_count, 0) = 1 AND COALESCE(fk.total_table_fk_count, 0) = 1 
                THEN 'None'
            ELSE 'Ensure exactly one foreign key exists: ALTER TABLE public.v2_crop_recommendations ADD CONSTRAINT fk_v2_rec_farmer FOREIGN KEY (farmer_id) REFERENCES public.farmers(id) ON DELETE RESTRICT;'
        END AS remediation
    FROM (SELECT 1) AS dummy
    LEFT JOIN (
        SELECT 
            COUNT(*) FILTER (
                WHERE con.confdeltype = 'r' 
                  AND con.conkey = ARRAY[a_from.attnum]
                  AND con.confkey = ARRAY[a_to.attnum]
                  AND array_length(con.conkey, 1) = 1
                  AND array_length(con.confkey, 1) = 1
                  AND a_from.attname = 'farmer_id'
                  AND a_to.attname = 'id'
                  AND n_from.nspname = 'public'
                  AND n_to.nspname = 'public'
            ) AS valid_fk_count,
            COUNT(*) AS total_table_fk_count,
            string_agg(
                format('Constraint "%s": %s.%s(%s) -> %s.%s(%s) [ON DELETE %s]',
                       con.conname,
                       n_from.nspname, c_from.relname, a_from.attname,
                       n_to.nspname, c_to.relname, a_to.attname,
                       CASE con.confdeltype 
                           WHEN 'r' THEN 'RESTRICT' 
                           WHEN 'c' THEN 'CASCADE' 
                           WHEN 'n' THEN 'SET NULL' 
                           WHEN 'd' THEN 'SET DEFAULT' 
                           WHEN 'a' THEN 'NO ACTION' 
                           ELSE con.confdeltype::text 
                       END),
                '; '
            ) AS details
        FROM pg_constraint con
        JOIN pg_class c_from ON c_from.oid = con.conrelid
        JOIN pg_namespace n_from ON n_from.oid = c_from.relnamespace
        JOIN pg_class c_to ON c_to.oid = con.confrelid
        JOIN pg_namespace n_to ON n_to.oid = c_to.relnamespace
        JOIN pg_attribute a_from ON a_from.attrelid = c_from.oid AND a_from.attnum = con.conkey[1] AND NOT a_from.attisdropped
        JOIN pg_attribute a_to ON a_to.attrelid = c_to.oid AND a_to.attnum = con.confkey[1] AND NOT a_to.attisdropped
        WHERE con.contype = 'f'
          AND con.conrelid = to_regclass('public.v2_crop_recommendations')
    ) fk ON true
),

-- -----------------------------------------------------------------------------
-- Gate 2: Composite Unique Constraint
-- Enforces table-level UNIQUE constraint in pg_constraint (contype='u')
-- -----------------------------------------------------------------------------
gate_2_uq AS (
    SELECT 
        '2_UQ' AS gate_id,
        '2. Composite Unique Constraint' AS check_name,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL THEN 'FAIL'
            WHEN COALESCE(uq.exact_uq_count, 0) = 1 AND COALESCE(uq.total_uq_count, 0) = 1 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL 
                THEN 'FAIL: Target table public.v2_crop_recommendations does not exist'
            WHEN COALESCE(uq.exact_uq_count, 0) = 1 AND COALESCE(uq.total_uq_count, 0) = 1
                THEN format('PASS: Valid table-level unique constraint found: %s', uq.details)
            WHEN COALESCE(uq.total_uq_count, 0) = 0 
                THEN 'FAIL: Table-level unique constraint on (farmer_id, idempotency_key) NOT FOUND in pg_constraint'
            WHEN COALESCE(uq.exact_uq_count, 0) = 0 
                THEN format('FAIL: Unique constraint column mismatch (%s)', uq.details)
            ELSE format('FAIL: Multiple or ambiguous unique constraints detected (%s)', uq.details)
        END AS details,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL 
                THEN 'Create public.v2_crop_recommendations first'
            WHEN COALESCE(uq.exact_uq_count, 0) = 1 AND COALESCE(uq.total_uq_count, 0) = 1 
                THEN 'None'
            ELSE 'ALTER TABLE public.v2_crop_recommendations ADD CONSTRAINT uq_v2_rec_farmer_idempotency UNIQUE (farmer_id, idempotency_key);'
        END AS remediation
    FROM (SELECT 1) AS dummy
    LEFT JOIN (
        SELECT 
            COUNT(*) FILTER (WHERE u.ordered_cols = ARRAY['farmer_id', 'idempotency_key'] AND u.col_count = 2) AS exact_uq_count,
            COUNT(*) AS total_uq_count,
            string_agg(
                format('Constraint "%s" (columns: %s, cardinality: %s)', 
                       u.conname, u.ordered_cols::text, u.col_count),
                '; '
            ) AS details
        FROM (
            SELECT 
                con.conname,
                array_length(con.conkey, 1) AS col_count,
                array_agg(a.attname ORDER BY array_position(con.conkey, a.attnum)) AS ordered_cols
            FROM pg_constraint con
            JOIN pg_class c ON c.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey) AND NOT a.attisdropped
            WHERE con.contype = 'u'
              AND n.nspname = 'public'
              AND con.conrelid = to_regclass('public.v2_crop_recommendations')
            GROUP BY con.conname, con.conkey
        ) u
    ) uq ON true
),

-- -----------------------------------------------------------------------------
-- Gate 3: Immutability Trigger
-- Bitmask Reference: ROW=1, BEFORE=2, INSERT=4, DELETE=8, UPDATE=16, TRUNCATE=32
-- Expected tgtype = 1 + 2 + 8 + 16 = 27; tgtype & 36 must be 0 (no INSERT, no TRUNCATE)
-- -----------------------------------------------------------------------------
gate_3_trg AS (
    SELECT 
        '3_TRIGGER' AS gate_id,
        '3. Immutability Trigger' AS check_name,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL THEN 'FAIL'
            WHEN COALESCE(tg.valid_tg_count, 0) = 1 AND COALESCE(tg.total_tg_count, 0) = 1 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL 
                THEN 'FAIL: Target table public.v2_crop_recommendations does not exist'
            WHEN COALESCE(tg.total_tg_count, 0) = 0 
                THEN 'FAIL: Trigger trg_prevent_v2_recommendations_mutation NOT FOUND on public.v2_crop_recommendations'
            WHEN COALESCE(tg.valid_tg_count, 0) = 1 AND COALESCE(tg.total_tg_count, 0) = 1 
                THEN format('PASS: Valid immutability trigger attached and active: %s', tg.details)
            WHEN COALESCE(tg.total_tg_count, 0) > 1 
                THEN format('FAIL: Multiple triggers detected on target table (%s)', tg.details)
            ELSE format('FAIL: Trigger definition invalid or disabled (%s)', tg.details)
        END AS details,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL 
                THEN 'Create public.v2_crop_recommendations first'
            WHEN COALESCE(tg.valid_tg_count, 0) = 1 AND COALESCE(tg.total_tg_count, 0) = 1 
                THEN 'None'
            ELSE 'CREATE TRIGGER trg_prevent_v2_recommendations_mutation BEFORE UPDATE OR DELETE ON public.v2_crop_recommendations FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_v2_recommendations_mutation();'
        END AS remediation
    FROM (SELECT 1) AS dummy
    LEFT JOIN (
        SELECT 
            COUNT(*) FILTER (
                WHERE tg.tgenabled = 'O'
                  AND (tg.tgtype & 1) != 0   -- ROW level (TRIGGER_TYPE_ROW)
                  AND (tg.tgtype & 2) != 0   -- BEFORE timing (TRIGGER_TYPE_BEFORE)
                  AND (tg.tgtype & 8) != 0   -- Fires on DELETE (TRIGGER_TYPE_DELETE)
                  AND (tg.tgtype & 16) != 0  -- Fires on UPDATE (TRIGGER_TYPE_UPDATE)
                  AND (tg.tgtype & 4) = 0    -- Does NOT fire on INSERT
                  AND (tg.tgtype & 32) = 0   -- Does NOT fire on TRUNCATE
                  AND fn_ns.nspname = 'public'
                  AND p.proname = 'fn_prevent_v2_recommendations_mutation'
            ) AS valid_tg_count,
            COUNT(*) AS total_tg_count,
            string_agg(
                format('Trigger "%s" enabled=%s, timing=%s, level=%s, events=[%s%s%s], function=%s.%s()',
                       tg.tgname, tg.tgenabled,
                       CASE WHEN (tg.tgtype & 2) != 0 THEN 'BEFORE' ELSE 'AFTER' END,
                       CASE WHEN (tg.tgtype & 1) != 0 THEN 'ROW' ELSE 'STATEMENT' END,
                       CASE WHEN (tg.tgtype & 4) != 0 THEN 'INSERT ' ELSE '' END,
                       CASE WHEN (tg.tgtype & 16) != 0 THEN 'UPDATE ' ELSE '' END,
                       CASE WHEN (tg.tgtype & 8) != 0 THEN 'DELETE' ELSE '' END,
                       fn_ns.nspname, p.proname),
                '; '
            ) AS details
        FROM pg_trigger tg
        JOIN pg_class c ON c.oid = tg.tgrelid
        JOIN pg_namespace tbl_ns ON tbl_ns.oid = c.relnamespace
        JOIN pg_proc p ON p.oid = tg.tgfoid
        JOIN pg_namespace fn_ns ON fn_ns.oid = p.pronamespace
        WHERE NOT tg.tgisinternal
          AND tg.tgname = 'trg_prevent_v2_recommendations_mutation'
          AND tbl_ns.nspname = 'public'
          AND c.oid = to_regclass('public.v2_crop_recommendations')
    ) tg ON true
),

-- -----------------------------------------------------------------------------
-- Gate 4: Row Level Security (RLS) & Policies Assessment
-- -----------------------------------------------------------------------------
gate_4_rls AS (
    SELECT 
        '4_RLS' AS gate_id,
        '4. Row Level Security & Policies' AS check_name,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL THEN 'FAIL'
            WHEN c.relrowsecurity != true THEN 'FAIL'
            WHEN COALESCE(pol.unexpected_permissive_count, 0) > 0 THEN 'FAIL'
            ELSE 'PASS'
        END AS status,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL 
                THEN 'FAIL: Target table public.v2_crop_recommendations does not exist'
            WHEN c.relrowsecurity != true 
                THEN 'FAIL: Row Level Security is NOT enabled on public.v2_crop_recommendations'
            WHEN COALESCE(pol.unexpected_permissive_count, 0) > 0 
                THEN format('FAIL: Unexpected permissive RLS policies detected (%s unexpected policies: %s)',
                            pol.unexpected_permissive_count, pol.unexpected_policy_details)
            WHEN COALESCE(pol.total_policy_count, 0) = 0 
                THEN 'PASS: RLS enabled (relrowsecurity=true). Zero policies defined: strict default-deny active for all non-bypassing roles. Note: service_role possesses BYPASSRLS and operates via trusted backend.'
            ELSE format('PASS: RLS enabled (relrowsecurity=true). Total policies: %s (%s). Note: service_role possesses BYPASSRLS.',
                        pol.total_policy_count, pol.policy_details)
        END AS details,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL 
                THEN 'Create public.v2_crop_recommendations first'
            WHEN c.relrowsecurity != true 
                THEN 'ALTER TABLE public.v2_crop_recommendations ENABLE ROW LEVEL SECURITY;'
            WHEN COALESCE(pol.unexpected_permissive_count, 0) > 0 
                THEN 'Review and DROP unexpected permissive RLS policies on public.v2_crop_recommendations'
            ELSE 'None'
        END AS remediation
    FROM (SELECT 1) AS dummy
    LEFT JOIN pg_class c ON c.oid = to_regclass('public.v2_crop_recommendations')
    LEFT JOIN (
        SELECT 
            COUNT(*) AS total_policy_count,
            COUNT(*) FILTER (
                WHERE p.polpermissive = true 
                  AND (
                      p.polroles = '{0}'::oid[] OR 
                      EXISTS (
                          SELECT 1 FROM pg_roles r 
                          WHERE r.oid = ANY(p.polroles) 
                            AND r.rolname IN ('anon', 'authenticated', 'public')
                      )
                  )
            ) AS unexpected_permissive_count,
            string_agg(
                format('Policy "%s" (cmd: %s, permissive: %s, roles: %s)', 
                       p.polname, 
                       CASE p.polcmd 
                           WHEN 'r' THEN 'SELECT' 
                           WHEN 'a' THEN 'INSERT' 
                           WHEN 'w' THEN 'UPDATE' 
                           WHEN 'd' THEN 'DELETE' 
                           WHEN '*' THEN 'ALL' 
                           ELSE p.polcmd::text 
                       END,
                       CASE WHEN p.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
                       COALESCE((SELECT string_agg(r.rolname, ', ') FROM pg_roles r WHERE r.oid = ANY(p.polroles)), 'PUBLIC')),
                '; '
            ) AS policy_details,
            string_agg(
                CASE WHEN p.polpermissive = true AND (p.polroles = '{0}'::oid[] OR EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid = ANY(p.polroles) AND r.rolname IN ('anon', 'authenticated', 'public')))
                     THEN p.polname END,
                ', '
            ) AS unexpected_policy_details
        FROM pg_policy p
        WHERE p.polrelid = to_regclass('public.v2_crop_recommendations')
    ) pol ON true
),

-- -----------------------------------------------------------------------------
-- Gate 5: Explicit Grants & Effective Privileges
-- PUBLIC inspected via aclexplode() grantee OID 0 (never 'public' string).
-- Effective permissions for all 7 table privileges evaluated.
-- -----------------------------------------------------------------------------
gate_5_priv AS (
    SELECT 
        '5_PRIVILEGES' AS gate_id,
        '5. Effective & Explicit Privileges' AS check_name,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL THEN 'FAIL'
            WHEN COALESCE(roles_audit.missing_roles_count, 0) > 0 THEN 'FAIL'
            -- PUBLIC ACL (grantee OID 0): Zero privileges allowed
            WHEN COALESCE(public_acl.public_priv_count, 0) > 0 THEN 'FAIL'
            -- Explicit grants check:
            WHEN COALESCE(exp_privs.anon_grants, 0) > 0 THEN 'FAIL'
            WHEN COALESCE(exp_privs.auth_grants, 0) > 0 THEN 'FAIL'
            WHEN COALESCE(exp_privs.public_grants, 0) > 0 THEN 'FAIL'
            WHEN COALESCE(exp_privs.service_role_select, 0) = 0 OR COALESCE(exp_privs.service_role_insert, 0) = 0 THEN 'FAIL'
            WHEN COALESCE(exp_privs.service_role_unintended, 0) > 0 THEN 'FAIL'
            -- Effective privileges check:
            WHEN COALESCE(eff_privs.anon_has_any, false) = true THEN 'FAIL'
            WHEN COALESCE(eff_privs.auth_has_any, false) = true THEN 'FAIL'
            WHEN COALESCE(eff_privs.service_role_has_select, false) = false OR COALESCE(eff_privs.service_role_has_insert, false) = false THEN 'FAIL'
            WHEN COALESCE(eff_privs.service_role_has_update, false) = true 
              OR COALESCE(eff_privs.service_role_has_delete, false) = true 
              OR COALESCE(eff_privs.service_role_has_truncate, false) = true THEN 'FAIL'
            ELSE 'PASS'
        END AS status,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL 
                THEN 'FAIL: Target table public.v2_crop_recommendations does not exist'
            WHEN COALESCE(roles_audit.missing_roles_count, 0) > 0 
                THEN format('FAIL: Required database roles missing in pg_roles: %s', roles_audit.missing_role_names)
            WHEN COALESCE(public_acl.public_priv_count, 0) > 0 
                THEN format('FAIL: PUBLIC possesses direct table privileges in relacl (grantee OID 0): %s', public_acl.public_privileges)
            WHEN COALESCE(exp_privs.anon_grants, 0) > 0 OR COALESCE(exp_privs.auth_grants, 0) > 0 OR COALESCE(exp_privs.public_grants, 0) > 0 
                THEN format('FAIL: Unauthorized explicit grants detected: anon=%s, auth=%s, public=%s',
                            exp_privs.anon_grants, exp_privs.auth_grants, exp_privs.public_grants)
            WHEN COALESCE(exp_privs.service_role_select, 0) = 0 OR COALESCE(exp_privs.service_role_insert, 0) = 0 
                THEN 'FAIL: service_role lacks explicit SELECT or INSERT grant'
            WHEN COALESCE(exp_privs.service_role_unintended, 0) > 0 
                THEN format('FAIL: service_role possesses unintended explicit grants: %s', exp_privs.service_role_unintended_privs)
            WHEN COALESCE(eff_privs.anon_has_any, false) = true 
                THEN format('FAIL: Role anon possesses effective table privileges: %s', eff_privs.anon_effective_list)
            WHEN COALESCE(eff_privs.auth_has_any, false) = true 
                THEN format('FAIL: Role authenticated possesses effective table privileges: %s', eff_privs.auth_effective_list)
            WHEN COALESCE(eff_privs.service_role_has_update, false) = true 
              OR COALESCE(eff_privs.service_role_has_delete, false) = true 
              OR COALESCE(eff_privs.service_role_has_truncate, false) = true 
                THEN format('FAIL: service_role possesses unintended effective mutation privileges (UPDATE=%s, DELETE=%s, TRUNCATE=%s)',
                            eff_privs.service_role_has_update, eff_privs.service_role_has_delete, eff_privs.service_role_has_truncate)
            ELSE format('PASS: Hardened privilege model verified. PUBLIC ACL (OID 0): 0 privs; anon effective: 0 privs; auth effective: 0 privs; service_role: (SELECT=%s, INSERT=%s, UPDATE=%s, DELETE=%s, TRUNCATE=%s)',
                        eff_privs.service_role_has_select, eff_privs.service_role_has_insert, eff_privs.service_role_has_update, eff_privs.service_role_has_delete, eff_privs.service_role_has_truncate)
        END AS details,
        'REVOKE ALL ON public.v2_crop_recommendations FROM anon, authenticated, public; GRANT SELECT, INSERT ON public.v2_crop_recommendations TO service_role;' AS remediation
    FROM (SELECT 1) AS dummy
    -- 1. Check required roles exist
    LEFT JOIN (
        SELECT 
            COUNT(*) FILTER (WHERE r.rolname IS NULL) AS missing_roles_count,
            string_agg(expected.rolname, ', ') FILTER (WHERE r.rolname IS NULL) AS missing_role_names
        FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS expected(rolname)
        LEFT JOIN pg_roles r ON r.rolname = expected.rolname
    ) roles_audit ON true
    -- 2. Inspect PUBLIC ACL (grantee OID 0 in aclexplode)
    LEFT JOIN (
        SELECT 
            COUNT(*) AS public_priv_count,
            string_agg(a.privilege_type, ', ') AS public_privileges
        FROM pg_class c
        CROSS JOIN LATERAL aclexplode(c.relacl) a
        WHERE c.oid = to_regclass('public.v2_crop_recommendations')
          AND a.grantee = 0
    ) public_acl ON true
    -- 3. Explicit grants in information_schema.role_table_grants
    LEFT JOIN (
        SELECT 
            COUNT(*) FILTER (WHERE grantee = 'anon') AS anon_grants,
            COUNT(*) FILTER (WHERE grantee = 'authenticated') AS auth_grants,
            COUNT(*) FILTER (WHERE grantee = 'PUBLIC') AS public_grants,
            COUNT(*) FILTER (WHERE grantee = 'service_role' AND privilege_type = 'SELECT') AS service_role_select,
            COUNT(*) FILTER (WHERE grantee = 'service_role' AND privilege_type = 'INSERT') AS service_role_insert,
            COUNT(*) FILTER (WHERE grantee = 'service_role' AND privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')) AS service_role_unintended,
            string_agg(CASE WHEN grantee = 'service_role' AND privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER') THEN privilege_type END, ', ') AS service_role_unintended_privs
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = 'v2_crop_recommendations'
    ) exp_privs ON true
    -- 4. Effective privileges via has_table_privilege(role_oid, table_oid, priv)
    LEFT JOIN (
        SELECT 
            -- anon effective
            bool_or(CASE WHEN r.rolname = 'anon' THEN 
                has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'SELECT') OR
                has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'INSERT') OR
                has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'UPDATE') OR
                has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'DELETE') OR
                has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'TRUNCATE') OR
                has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'REFERENCES') OR
                has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'TRIGGER')
            END) AS anon_has_any,
            string_agg(CASE WHEN r.rolname = 'anon' AND has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), priv) THEN priv END, ', ') AS anon_effective_list,
            -- authenticated effective
            bool_or(CASE WHEN r.rolname = 'authenticated' THEN 
                has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'SELECT') OR
                has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'INSERT') OR
                has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'UPDATE') OR
                has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'DELETE') OR
                has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'TRUNCATE') OR
                has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'REFERENCES') OR
                has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'TRIGGER')
            END) AS auth_has_any,
            string_agg(CASE WHEN r.rolname = 'authenticated' AND has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), priv) THEN priv END, ', ') AS auth_effective_list,
            -- service_role effective
            bool_or(CASE WHEN r.rolname = 'service_role' THEN has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'SELECT') END) AS service_role_has_select,
            bool_or(CASE WHEN r.rolname = 'service_role' THEN has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'INSERT') END) AS service_role_has_insert,
            bool_or(CASE WHEN r.rolname = 'service_role' THEN has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'UPDATE') END) AS service_role_has_update,
            bool_or(CASE WHEN r.rolname = 'service_role' THEN has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'DELETE') END) AS service_role_has_delete,
            bool_or(CASE WHEN r.rolname = 'service_role' THEN has_table_privilege(r.oid, to_regclass('public.v2_crop_recommendations'), 'TRUNCATE') END) AS service_role_has_truncate
        FROM pg_roles r
        CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p(priv)
        WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
          AND to_regclass('public.v2_crop_recommendations') IS NOT NULL
    ) eff_privs ON true
),

-- -----------------------------------------------------------------------------
-- Gate 6B: Aggregate Numeric Measurement Constraints (11 Columns)
-- Exact column attachment (conkey = ARRAY[attnum]) and regex-anchored semantics
-- -----------------------------------------------------------------------------
gate_6b_num_env AS (
    SELECT 
        '6B_NUM_ENV' AS gate_id,
        '6. Aggregate Numeric Measurement Constraints' AS check_name,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL THEN 'FAIL'
            WHEN COALESCE(agg.passed_cols, 0) = 11 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL 
                THEN 'FAIL: Target table public.v2_crop_recommendations does not exist'
            WHEN COALESCE(agg.passed_cols, 0) = 11 
                THEN 'PASS: All 11 numeric measurement columns possess column-specific NaN rejection, exact finite/unbounded rules, and NULL handling'
            ELSE format('FAIL: Only %s of 11 numeric measurement columns passed semantic validation (Failing: %s)', 
                        COALESCE(agg.passed_cols, 0), COALESCE(agg.failing_cols, 'all'))
        END AS details,
        'Ensure each numeric column definition matches V2_Persistence_Migration_Final_v3.sql with exact column-specific CHECK constraints' AS remediation
    FROM (SELECT 1) AS dummy
    LEFT JOIN (
        WITH expected_numeric_cols AS (
            SELECT * FROM (VALUES
                -- col_name, min_bound_str, max_bound_str (NULL = unbounded above)
                ('temperature',                  '-20', '60'),
                ('humidity',                     '0',   '100'),
                ('soil_ph',                      '2',   '12'),
                ('nitrogen',                     '0',   NULL),
                ('phosphorus',                   '0',   NULL),
                ('potassium',                    '0',   NULL),
                ('organic_carbon',               '0',   '100'),
                ('seasonal_rainfall_mm',         '0',   NULL),
                ('seasonal_rainfall_amount',     '0',   NULL),
                ('irrigation_water_quantity_mm', '0',   NULL),
                ('irrigation_depth_mm',          '0',   NULL)
            ) AS t(col_name, min_bound_str, max_bound_str)
        ),
        col_eval AS (
            SELECT 
                e.col_name,
                -- Combined definitions across all CHECK constraints attached specifically to this column
                string_agg(pg_get_constraintdef(c.oid), ' AND ') AS combined_defs,
                -- 1. Exact Column Reference: constraint references this column specifically via conkey
                bool_or(c.oid IS NOT NULL) AS has_constraint,
                -- 2. NULL handling: col IS NULL
                bool_or(pg_get_constraintdef(c.oid) ~* ('\y' || e.col_name || '\s+IS\s+NULL\y')) AS has_null_handling,
                -- 3. NaN rejection: col <> 'NaN'::numeric or col != 'NaN'::numeric
                bool_or(pg_get_constraintdef(c.oid) ~* ('\y' || e.col_name || '\s*(<>|!=)\s*''NaN''::numeric\y')) AS has_nan_guard,
                -- 4. Exact lower bound: col >= min_bound
                bool_or(pg_get_constraintdef(c.oid) ~* ('\y' || e.col_name || '\s*>=\s*''?' || e.min_bound_str || '(\.0+)?''?(::numeric)?\y')) AS has_lower_bound,
                -- 5. Exact upper bound: col <= max_bound if specified; if NULL, strictly unbounded above
                CASE 
                    WHEN e.max_bound_str IS NOT NULL 
                        THEN bool_or(pg_get_constraintdef(c.oid) ~* ('\y' || e.col_name || '\s*<=\s*''?' || e.max_bound_str || '(\.0+)?''?(::numeric)?\y'))
                    ELSE true 
                END AS has_upper_bound
            FROM expected_numeric_cols e
            LEFT JOIN pg_attribute a 
                ON a.attrelid = to_regclass('public.v2_crop_recommendations')
               AND a.attname = e.col_name
               AND NOT a.attisdropped
            LEFT JOIN pg_constraint c 
                ON c.conrelid = to_regclass('public.v2_crop_recommendations')
               AND c.contype = 'c'
               AND c.conkey = ARRAY[a.attnum]
            GROUP BY e.col_name, e.min_bound_str, e.max_bound_str
        )
        SELECT 
            COUNT(*) FILTER (WHERE has_constraint AND has_null_handling AND has_nan_guard AND has_lower_bound AND has_upper_bound) AS passed_cols,
            string_agg(CASE WHEN NOT (has_constraint AND has_null_handling AND has_nan_guard AND has_lower_bound AND has_upper_bound) THEN col_name END, ', ') AS failing_cols
        FROM col_eval
    ) agg ON true
),

-- -----------------------------------------------------------------------------
-- Gate 6C: Recommendation Score Numeric Constraints (3 Ranking Metrics)
-- Exact column attachment (conkey = ARRAY[attnum]) and regex-anchored semantics
-- -----------------------------------------------------------------------------
gate_6c_num_score AS (
    SELECT 
        '6C_NUM_SCORE' AS gate_id,
        '6C. Recommendation Score Metrics' AS check_name,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL THEN 'FAIL'
            WHEN COALESCE(agg.passed_cols, 0) = 3 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL 
                THEN 'FAIL: Target table public.v2_crop_recommendations does not exist'
            WHEN COALESCE(agg.passed_cols, 0) = 3 
                THEN 'PASS: All 3 recommendation score metrics possess column-specific NaN rejection, finite [0, 100]/[0, 1] bounds, and NULL handling'
            ELSE format('FAIL: Only %s of 3 recommendation score metrics passed semantic validation (Failing: %s)', 
                        COALESCE(agg.passed_cols, 0), COALESCE(agg.failing_cols, 'all'))
        END AS details,
        'Ensure suitability_score, top_suitability_score, and dci_confidence have column-specific CHECK constraints matching migration' AS remediation
    FROM (SELECT 1) AS dummy
    LEFT JOIN (
        WITH expected_score_cols AS (
            SELECT * FROM (VALUES
                ('suitability_score',     '0', '100'),
                ('top_suitability_score', '0', '100'),
                ('dci_confidence',        '0', '1')
            ) AS t(col_name, min_bound_str, max_bound_str)
        ),
        col_eval AS (
            SELECT 
                e.col_name,
                bool_or(c.oid IS NOT NULL) AS has_constraint,
                bool_or(pg_get_constraintdef(c.oid) ~* ('\y' || e.col_name || '\s+IS\s+NULL\y')) AS has_null_handling,
                bool_or(pg_get_constraintdef(c.oid) ~* ('\y' || e.col_name || '\s*(<>|!=)\s*''NaN''::numeric\y')) AS has_nan_guard,
                bool_or(pg_get_constraintdef(c.oid) ~* ('\y' || e.col_name || '\s*>=\s*''?' || e.min_bound_str || '(\.0+)?''?(::numeric)?\y')) AS has_lower_bound,
                bool_or(pg_get_constraintdef(c.oid) ~* ('\y' || e.col_name || '\s*<=\s*''?' || e.max_bound_str || '(\.0+)?''?(::numeric)?\y')) AS has_upper_bound
            FROM expected_score_cols e
            LEFT JOIN pg_attribute a 
                ON a.attrelid = to_regclass('public.v2_crop_recommendations')
               AND a.attname = e.col_name
               AND NOT a.attisdropped
            LEFT JOIN pg_constraint c 
                ON c.conrelid = to_regclass('public.v2_crop_recommendations')
               AND c.contype = 'c'
               AND c.conkey = ARRAY[a.attnum]
            GROUP BY e.col_name, e.min_bound_str, e.max_bound_str
        )
        SELECT 
            COUNT(*) FILTER (WHERE has_constraint AND has_null_handling AND has_nan_guard AND has_lower_bound AND has_upper_bound) AS passed_cols,
            string_agg(CASE WHEN NOT (has_constraint AND has_null_handling AND has_nan_guard AND has_lower_bound AND has_upper_bound) THEN col_name END, ', ') AS failing_cols
        FROM col_eval
    ) agg ON true
),

-- -----------------------------------------------------------------------------
-- Gate 7B: Aggregate Nullability and Column-Presence Audit (All 39 Expected Columns)
-- -----------------------------------------------------------------------------
gate_7b_nullability AS (
    SELECT 
        '7B_NULLABILITY' AS gate_id,
        '7. Nullability and Column-Presence Audit (All 39 Expected Columns)' AS check_name,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL THEN 'FAIL'
            WHEN COALESCE(agg.passed_cols, 0) = 39 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        CASE 
            WHEN to_regclass('public.v2_crop_recommendations') IS NULL 
                THEN 'FAIL: Target table public.v2_crop_recommendations does not exist'
            WHEN COALESCE(agg.passed_cols, 0) = 39 
                THEN 'PASS: All 39 expected columns present with exact nullability (14 mandatory NOT NULL, 25 optional NULLable including sowing_month & has_soil_test)'
            ELSE format('FAIL: Only %s of 39 columns passed nullability/presence audit (Failing/Missing: %s)', 
                        COALESCE(agg.passed_cols, 0), COALESCE(agg.failing_cols, 'all'))
        END AS details,
        'Ensure public.v2_crop_recommendations schema matches V2_Persistence_Migration_Final_v3.sql exactly' AS remediation
    FROM (SELECT 1) AS dummy
    LEFT JOIN (
        WITH expected_columns AS (
            SELECT * FROM (VALUES
                ('id', 'NO'), ('farmer_id', 'NO'), ('idempotency_key', 'NO'), ('request_hash', 'NO'),
                ('engine_version', 'NO'), ('engine_status', 'NO'), ('state', 'NO'), ('request_payload', 'NO'),
                ('response_payload', 'NO'), ('input_provenance', 'NO'), ('recommendations', 'NO'),
                ('excluded_candidates', 'NO'), ('diagnostics', 'NO'), ('created_at', 'NO'),
                ('execution_time_ms', 'YES'), ('recommended_crop', 'YES'), ('top_crop', 'YES'),
                ('suitability_score', 'YES'), ('top_suitability_score', 'YES'), ('dci_confidence', 'YES'),
                ('top_confidence_tier', 'YES'), ('district', 'YES'), ('sowing_month', 'YES'),
                ('season', 'YES'), ('irrigation_access', 'YES'), ('soil_texture', 'YES'),
                ('has_soil_test', 'YES'), ('soil_test_declaration_status', 'YES'), ('temperature', 'YES'),
                ('humidity', 'YES'), ('soil_ph', 'YES'), ('nitrogen', 'YES'), ('phosphorus', 'YES'),
                ('potassium', 'YES'), ('organic_carbon', 'YES'), ('seasonal_rainfall_mm', 'YES'),
                ('seasonal_rainfall_amount', 'YES'), ('irrigation_water_quantity_mm', 'YES'),
                ('irrigation_depth_mm', 'YES')
            ) AS t(col_name, expected_nullable)
        ),
        eval_cols AS (
            SELECT 
                e.col_name,
                (c.is_nullable IS NOT NULL AND c.is_nullable = e.expected_nullable) AS is_correct
            FROM expected_columns e
            LEFT JOIN information_schema.columns c 
                ON c.table_schema = 'public' 
               AND c.table_name = 'v2_crop_recommendations' 
               AND c.column_name = e.col_name
        )
        SELECT 
            COUNT(*) FILTER (WHERE is_correct = true) AS passed_cols,
            string_agg(CASE WHEN NOT is_correct OR is_correct IS NULL THEN col_name END, ', ') AS failing_cols
        FROM eval_cols
    ) agg ON true
)

-- Combine all 8 core gates into single view
SELECT * FROM gate_1_fk
UNION ALL SELECT * FROM gate_2_uq
UNION ALL SELECT * FROM gate_3_trg
UNION ALL SELECT * FROM gate_4_rls
UNION ALL SELECT * FROM gate_5_priv
UNION ALL SELECT * FROM gate_6b_num_env
UNION ALL SELECT * FROM gate_6c_num_score
UNION ALL SELECT * FROM gate_7b_nullability;

-- -----------------------------------------------------------------------------
-- Query 1: Foreign-Key Definition, Cardinality, and Delete Action
-- -----------------------------------------------------------------------------
SELECT check_name, status, details, remediation 
FROM _v2_staging_verification_gates 
WHERE gate_id = '1_FK';

-- -----------------------------------------------------------------------------
-- Query 2: Exact Composite Unique Constraint
-- -----------------------------------------------------------------------------
SELECT check_name, status, details, remediation 
FROM _v2_staging_verification_gates 
WHERE gate_id = '2_UQ';

-- -----------------------------------------------------------------------------
-- Query 3: Immutability Trigger Timing, Level, Events, Enabled State, Function
-- -----------------------------------------------------------------------------
SELECT check_name, status, details, remediation 
FROM _v2_staging_verification_gates 
WHERE gate_id = '3_TRIGGER';

-- -----------------------------------------------------------------------------
-- Query 4: Row Level Security (RLS) & Policies Assessment
-- -----------------------------------------------------------------------------
SELECT check_name, status, details, remediation 
FROM _v2_staging_verification_gates 
WHERE gate_id = '4_RLS';

-- -----------------------------------------------------------------------------
-- Query 5: Explicit Grants & Effective Privileges
-- -----------------------------------------------------------------------------
SELECT check_name, status, details, remediation 
FROM _v2_staging_verification_gates 
WHERE gate_id = '5_PRIVILEGES';

-- -----------------------------------------------------------------------------
-- Query 6A: Per-Column Detailed Numeric Constraint Audit (11 Measurement Columns)
-- Returns 11 rows: per-column breakdown of column-specific constraints
-- -----------------------------------------------------------------------------
\x off
\echo '-----------------------------------------------------------------------------'
\echo 'Query 6A: Per-Column Detailed Numeric Constraint Audit (11 Measurement Columns)'
\echo '-----------------------------------------------------------------------------'

WITH expected_numeric_cols AS (
    SELECT * FROM (VALUES
        ('temperature',                  '-20', '60',   '[-20.0, 60.0]'),
        ('humidity',                     '0',   '100',  '[0.0, 100.0]'),
        ('soil_ph',                      '2',   '12',   '[2.0, 12.0]'),
        ('nitrogen',                     '0',   NULL,   '[0.0, INF) [Unbounded above]'),
        ('phosphorus',                   '0',   NULL,   '[0.0, INF) [Unbounded above]'),
        ('potassium',                    '0',   NULL,   '[0.0, INF) [Unbounded above]'),
        ('organic_carbon',               '0',   '100',  '[0.0, 100.0]'),
        ('seasonal_rainfall_mm',         '0',   NULL,   '[0.0, INF) [Unbounded above]'),
        ('seasonal_rainfall_amount',     '0',   NULL,   '[0.0, INF) [Unbounded above]'),
        ('irrigation_water_quantity_mm', '0',   NULL,   '[0.0, INF) [Unbounded above]'),
        ('irrigation_depth_mm',          '0',   NULL,   '[0.0, INF) [Unbounded above]')
    ) AS t(col_name, min_bound_str, max_bound_str, agronomic_domain)
),
col_analysis AS (
    SELECT 
        e.col_name,
        e.agronomic_domain,
        bool_or(c.oid IS NOT NULL) AS has_column_constraint,
        bool_or(pg_get_constraintdef(c.oid) ~* ('\y' || e.col_name || '\s+IS\s+NULL\y')) AS has_null_handling,
        bool_or(pg_get_constraintdef(c.oid) ~* ('\y' || e.col_name || '\s*(<>|!=)\s*''NaN''::numeric\y')) AS has_nan_guard,
        bool_or(pg_get_constraintdef(c.oid) ~* ('\y' || e.col_name || '\s*>=\s*''?' || e.min_bound_str || '(\.0+)?''?(::numeric)?\y')) AS has_lower_bound,
        CASE 
            WHEN e.max_bound_str IS NOT NULL 
                THEN bool_or(pg_get_constraintdef(c.oid) ~* ('\y' || e.col_name || '\s*<=\s*''?' || e.max_bound_str || '(\.0+)?''?(::numeric)?\y'))
            ELSE true 
        END AS has_upper_bound,
        COALESCE(string_agg(pg_get_constraintdef(c.oid), ' | '), 'FAIL: No constraint attached to column') AS constraint_definitions
    FROM expected_numeric_cols e
    LEFT JOIN pg_attribute a 
        ON a.attrelid = to_regclass('public.v2_crop_recommendations')
       AND a.attname = e.col_name
       AND NOT a.attisdropped
    LEFT JOIN pg_constraint c 
        ON c.conrelid = to_regclass('public.v2_crop_recommendations')
       AND c.contype = 'c'
       AND c.conkey = ARRAY[a.attnum]
    GROUP BY e.col_name, e.agronomic_domain, e.min_bound_str, e.max_bound_str
)
SELECT 
    col_name,
    CASE 
        WHEN to_regclass('public.v2_crop_recommendations') IS NULL THEN 'FAIL'
        WHEN has_column_constraint AND has_null_handling AND has_nan_guard AND has_lower_bound AND has_upper_bound THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    has_nan_guard AS nan_rejected,
    has_null_handling AS null_handled,
    has_lower_bound AS lower_bounded,
    has_upper_bound AS upper_bounded,
    agronomic_domain,
    constraint_definitions
FROM col_analysis
ORDER BY col_name;

-- -----------------------------------------------------------------------------
-- Query 6B: Aggregate Numeric Measurement Constraints Gate
-- -----------------------------------------------------------------------------
\x on
SELECT check_name, status, details, remediation 
FROM _v2_staging_verification_gates 
WHERE gate_id = '6B_NUM_ENV';

-- -----------------------------------------------------------------------------
-- Query 6C: Recommendation Score Numeric Constraints Gate
-- -----------------------------------------------------------------------------
SELECT check_name, status, details, remediation 
FROM _v2_staging_verification_gates 
WHERE gate_id = '6C_NUM_SCORE';

-- -----------------------------------------------------------------------------
-- Query 7A: Per-Column Detailed Nullability and Presence Audit (39 Table Columns)
-- Returns 39 rows: comprehensive audit of column presence, nullability, and purpose
-- -----------------------------------------------------------------------------
\x off
\echo '-----------------------------------------------------------------------------'
\echo 'Query 7A: Per-Column Detailed Nullability and Presence Audit (39 Columns)'
\echo '-----------------------------------------------------------------------------'

WITH expected_columns AS (
    SELECT * FROM (VALUES
        -- Mandatory Primary Identity & Engine Metadata (14 columns)
        ('id',                           'NO',  'UUID PRIMARY KEY'),
        ('farmer_id',                    'NO',  'TEXT NOT NULL REFERENCES public.farmers(id)'),
        ('idempotency_key',              'NO',  'TEXT NOT NULL'),
        ('request_hash',                 'NO',  'CHAR(64) NOT NULL'),
        ('engine_version',               'NO',  'TEXT NOT NULL'),
        ('engine_status',                'NO',  'TEXT NOT NULL'),
        ('state',                        'NO',  'TEXT NOT NULL (Mandatory regional parameter)'),
        ('request_payload',              'NO',  'JSONB NOT NULL'),
        ('response_payload',             'NO',  'JSONB NOT NULL'),
        ('input_provenance',             'NO',  'JSONB NOT NULL'),
        ('recommendations',              'NO',  'JSONB NOT NULL'),
        ('excluded_candidates',          'NO',  'JSONB NOT NULL'),
        ('diagnostics',                  'NO',  'JSONB NOT NULL'),
        ('created_at',                   'NO',  'TIMESTAMPTZ NOT NULL DEFAULT NOW()'),
        -- Optional Execution & Recommendation Fields (7 columns)
        ('execution_time_ms',            'YES', 'INTEGER NULL'),
        ('recommended_crop',             'YES', 'TEXT NULL'),
        ('top_crop',                     'YES', 'TEXT NULL'),
        ('suitability_score',            'YES', 'NUMERIC(5,2) NULL'),
        ('top_suitability_score',        'YES', 'NUMERIC(5,2) NULL'),
        ('dci_confidence',               'YES', 'NUMERIC(4,3) NULL'),
        ('top_confidence_tier',          'YES', 'TEXT NULL'),
        -- Optional Context & Agronomic Inputs (7 columns - MUST be NULLable)
        ('district',                     'YES', 'TEXT NULL'),
        ('sowing_month',                 'YES', 'SMALLINT NULL (Enforces unselected input compatibility)'),
        ('season',                       'YES', 'TEXT NULL'),
        ('irrigation_access',            'YES', 'TEXT NULL'),
        ('soil_texture',                 'YES', 'TEXT NULL'),
        ('has_soil_test',                'YES', 'BOOLEAN NULL (Enforces 3-state boolean semantics)'),
        ('soil_test_declaration_status', 'YES', 'TEXT NULL'),
        -- Optional Environmental & Chemical Measurements (11 columns)
        ('temperature',                  'YES', 'NUMERIC NULL'),
        ('humidity',                     'YES', 'NUMERIC NULL'),
        ('soil_ph',                      'YES', 'NUMERIC NULL'),
        ('nitrogen',                     'YES', 'NUMERIC NULL'),
        ('phosphorus',                   'YES', 'NUMERIC NULL'),
        ('potassium',                    'YES', 'NUMERIC NULL'),
        ('organic_carbon',               'YES', 'NUMERIC NULL'),
        ('seasonal_rainfall_mm',         'YES', 'NUMERIC NULL'),
        ('seasonal_rainfall_amount',     'YES', 'NUMERIC NULL'),
        ('irrigation_water_quantity_mm', 'YES', 'NUMERIC NULL'),
        ('irrigation_depth_mm',          'YES', 'NUMERIC NULL')
    ) AS t(col_name, expected_nullable, purpose)
)
SELECT 
    e.col_name,
    e.expected_nullable,
    COALESCE(c.is_nullable, 'MISSING') AS actual_nullable,
    CASE 
        WHEN to_regclass('public.v2_crop_recommendations') IS NULL THEN 'FAIL'
        WHEN c.is_nullable IS NULL THEN 'FAIL'
        WHEN c.is_nullable = e.expected_nullable THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    e.purpose
FROM expected_columns e
LEFT JOIN information_schema.columns c 
    ON c.table_schema = 'public' 
   AND c.table_name = 'v2_crop_recommendations' 
   AND c.column_name = e.col_name
ORDER BY e.expected_nullable DESC, e.col_name;

-- -----------------------------------------------------------------------------
-- Query 7B: Aggregate Nullability and Column-Presence Gate
-- -----------------------------------------------------------------------------
\x on
SELECT check_name, status, details, remediation 
FROM _v2_staging_verification_gates 
WHERE gate_id = '7B_NULLABILITY';

-- -----------------------------------------------------------------------------
-- Query 8: Unified Staging Gateway Verdict
-- Aggregates directly from _v2_staging_verification_gates. Zero logic drift.
-- -----------------------------------------------------------------------------
SELECT 
    '8. Unified Staging Gateway Verdict' AS check_name,
    CASE 
        WHEN to_regclass('public.v2_crop_recommendations') IS NULL THEN 'FAIL'
        WHEN to_regclass('public.farmers') IS NULL THEN 'FAIL'
        WHEN bool_and(status = 'PASS') AND count(*) = 8 THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    CASE 
        WHEN to_regclass('public.v2_crop_recommendations') IS NULL 
            THEN 'GATEWAY BLOCKED: Target table public.v2_crop_recommendations does not exist'
        WHEN to_regclass('public.farmers') IS NULL 
            THEN 'GATEWAY BLOCKED: Parent table public.farmers does not exist'
        WHEN bool_and(status = 'PASS') AND count(*) = 8 
            THEN 'GATEWAY VERIFIED: All 8 core staging catalog verification gates PASSED without errors. Target schema approved for Phase 3C.6.7 testing.'
        ELSE format('GATEWAY BLOCKED: Verification failed (%s of %s gates passed). Failing gates: %s',
                    count(*) FILTER (WHERE status = 'PASS'),
                    count(*),
                    string_agg(CASE WHEN status != 'PASS' THEN format('[%s: %s]', gate_id, details) END, '; '))
    END AS details,
    CASE 
        WHEN bool_and(status = 'PASS') AND count(*) = 8 
            THEN 'None. Staging schema verified for Phase 3C.6.7 deployment verification.'
        ELSE 'Review diagnostic outputs in Queries 1-7 above and resolve indicated schema failures.'
    END AS remediation
FROM _v2_staging_verification_gates;

-- -----------------------------------------------------------------------------
-- Step Cleanup: Drop Temporary View
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS _v2_staging_verification_gates;

\echo '============================================================================='
\echo 'FieldWise Phase 3C.6.8.2: Staging Catalog Verification Gateway Complete'
\echo '============================================================================='
