-- =============================================================================
-- FieldWise Phase 3C.6.6.2: Final V2 Crop Recommendations Persistence Migration
-- File Reference: migrations/V2_Persistence_Migration_Final_v3.sql
-- =============================================================================
-- Target Database: PostgreSQL / Supabase
-- Target Table: public.v2_crop_recommendations
--
-- Security & Operational Invariants:
--   1. Indefinite Retention: Append-only ledger for local agronomic reproducibility.
--   2. Strict Immutability: Rejects all UPDATE and DELETE mutations via trigger.
--   3. Backend Mediation Only: Direct access REVOKED from anon, authenticated, and public.
--      All operations are conducted via Express backend using service-role credentials.
--   4. Idempotency Invariant: Scoped strictly to (farmer_id, idempotency_key).
--   5. Agronomic Data Integrity: Finite numeric constraints mirror frozen V2 schemas.
--      Rejects NaN on all numeric metrics. Rejects non-finite numbers.
--   6. Foreign Key Safety: ON DELETE RESTRICT on public.farmers(id) [TEXT].
--   7. Optional Input Compatibility:
--      - sowing_month is NULLable (preserves unselected/unknown sowing month without fabricated defaults).
--      - district, irrigation_access, soil_texture, and measurements are NULLable.
--      - has_soil_test is a three-state boolean (TRUE, FALSE, NULL).
--      - state is the only mandatory input parameter.
--   8. Comprehensive Catalog-Based Preflight Assertions:
--      - Validates schema-qualified public.farmers exists with id TEXT.
--      - If public.v2_crop_recommendations exists, validates:
--          * Exact column types and nullability (enforcing sowing_month is NULLable).
--          * FK originates from farmer_id, references public.farmers(id), delete action RESTRICT.
--          * Unique constraint columns are exactly (farmer_id, idempotency_key).
--          * Trigger attached to public.v2_crop_recommendations covers UPDATE & DELETE, is enabled.
--          * RLS is enabled.
--          * Direct mutation privileges for anon, authenticated, and PUBLIC are revoked (including authenticated INSERT).
--      - ABORTS with explicit diagnostic error if an existing table has an incompatible schema.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Step 1: Migration Preflight Assertions
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_is_nullable TEXT;
    v_col_type TEXT;
    v_has_fk BOOLEAN;
    v_has_unique BOOLEAN;
    v_has_trigger BOOLEAN;
    v_has_rls BOOLEAN;
    v_anon_privs INTEGER;
    v_auth_privs INTEGER;
    v_public_privs INTEGER;
BEGIN
    -- 1. Verify schema-qualified parent table public.farmers exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'farmers' AND c.relkind = 'r'
    ) THEN
        RAISE EXCEPTION 'Preflight Failure: Schema-qualified parent table public.farmers does not exist.';
    END IF;

    -- 2. Verify public.farmers.id is type TEXT
    IF NOT EXISTS (
        SELECT 1 FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_type t ON t.oid = a.atttypid
        WHERE n.nspname = 'public' 
          AND c.relname = 'farmers' 
          AND a.attname = 'id' 
          AND t.typname = 'text' 
          AND a.attnum > 0 
          AND NOT a.attisdropped
    ) THEN
        RAISE EXCEPTION 'Preflight Failure: Parent column public.farmers.id is not of type text.';
    END IF;

    -- 3. Check if target table public.v2_crop_recommendations already exists
    SELECT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'v2_crop_recommendations' AND c.relkind = 'r'
    ) INTO v_table_exists;

    IF v_table_exists THEN
        -- Table already exists: Perform strict schema compatibility validation.
        -- Do NOT assume CREATE TABLE IF NOT EXISTS upgrades an incompatible schema!

        -- Validate sowing_month nullability: MUST BE NULLABLE
        SELECT is_nullable, data_type INTO v_is_nullable, v_col_type
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'v2_crop_recommendations' 
          AND column_name = 'sowing_month';

        IF v_is_nullable IS NULL THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations is missing required column sowing_month.';
        ELSIF v_is_nullable = 'NO' THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations has sowing_month as NOT NULL. Sowing month must be NULLable to support unselected/optional inputs without fabricated defaults. Run: ALTER TABLE public.v2_crop_recommendations ALTER COLUMN sowing_month DROP NOT NULL; before applying this migration.';
        END IF;

        -- Validate district nullability: MUST BE NULLABLE
        SELECT is_nullable INTO v_is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'v2_crop_recommendations' 
          AND column_name = 'district';

        IF v_is_nullable = 'NO' THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations has district as NOT NULL. District must be NULLable.';
        END IF;

        -- Validate irrigation_access nullability: MUST BE NULLABLE
        SELECT is_nullable INTO v_is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'v2_crop_recommendations' 
          AND column_name = 'irrigation_access';

        IF v_is_nullable = 'NO' THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations has irrigation_access as NOT NULL. Irrigation access must be NULLable.';
        END IF;

        -- Validate soil_texture nullability: MUST BE NULLABLE
        SELECT is_nullable INTO v_is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'v2_crop_recommendations' 
          AND column_name = 'soil_texture';

        IF v_is_nullable = 'NO' THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations has soil_texture as NOT NULL. Soil texture must be NULLable.';
        END IF;

        -- Validate has_soil_test nullability: MUST BE NULLABLE
        SELECT is_nullable INTO v_is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'v2_crop_recommendations' 
          AND column_name = 'has_soil_test';

        IF v_is_nullable = 'NO' THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations has has_soil_test as NOT NULL. Three-state boolean requires NULLable has_soil_test.';
        END IF;

        -- Validate state nullability: MUST BE NOT NULL
        SELECT is_nullable INTO v_is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'v2_crop_recommendations' 
          AND column_name = 'state';

        IF v_is_nullable != 'NO' THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations has state as NULLable. State is mandatory and must be NOT NULL.';
        END IF;

        -- Validate foreign key constraint to public.farmers(id) with ON DELETE RESTRICT (catalog query, not name-dependent)
        SELECT EXISTS (
            SELECT 1 
            FROM pg_constraint con
            JOIN pg_class c_from ON c_from.oid = con.conrelid
            JOIN pg_namespace n_from ON n_from.oid = c_from.relnamespace
            JOIN pg_class c_to ON c_to.oid = con.confrelid
            JOIN pg_namespace n_to ON n_to.oid = c_to.relnamespace
            JOIN pg_attribute a_from ON a_from.attrelid = c_from.oid AND a_from.attnum = con.conkey[1]
            JOIN pg_attribute a_to ON a_to.attrelid = c_to.oid AND a_to.attnum = con.confkey[1]
            WHERE con.contype = 'f'
              AND n_from.nspname = 'public'
              AND c_from.relname = 'v2_crop_recommendations'
              AND a_from.attname = 'farmer_id'
              AND n_to.nspname = 'public'
              AND c_to.relname = 'farmers'
              AND a_to.attname = 'id'
              AND con.confdeltype = 'r'
        ) INTO v_has_fk;

        IF NOT v_has_fk THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations is missing foreign key constraint from farmer_id REFERENCES public.farmers(id) ON DELETE RESTRICT.';
        END IF;

        -- Validate composite unique constraint on exactly (farmer_id, idempotency_key) (not name-dependent)
        SELECT EXISTS (
            SELECT 1 
            FROM pg_constraint con
            JOIN pg_class c ON c.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE con.contype = 'u'
              AND n.nspname = 'public'
              AND c.relname = 'v2_crop_recommendations'
              AND array_length(con.conkey, 1) = 2
              AND (
                  SELECT array_agg(a.attname ORDER BY array_position(con.conkey, a.attnum))
                  FROM pg_attribute a
                  WHERE a.attrelid = c.oid AND a.attnum = ANY(con.conkey)
              ) = ARRAY['farmer_id', 'idempotency_key']
        ) INTO v_has_unique;

        IF NOT v_has_unique THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations is missing composite unique constraint on exactly (farmer_id, idempotency_key).';
        END IF;

        -- Validate immutability trigger attached to public.v2_crop_recommendations covering UPDATE & DELETE, enabled, invoking function
        SELECT EXISTS (
            SELECT 1 
            FROM pg_trigger tg
            JOIN pg_class c ON c.oid = tg.tgrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_proc p ON p.oid = tg.tgfoid
            WHERE n.nspname = 'public'
              AND c.relname = 'v2_crop_recommendations'
              AND NOT tg.tgisinternal
              AND (tg.tgtype & 4) != 0   -- Covers UPDATE
              AND (tg.tgtype & 8) != 0   -- Covers DELETE
              AND tg.tgenabled = 'O'     -- Enabled
              AND p.proname IN ('fn_prevent_v2_recommendations_mutation', 'trg_prevent_v2_recommendations_mutation')
        ) INTO v_has_trigger;

        IF NOT v_has_trigger THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations is missing active immutability trigger covering BEFORE UPDATE OR DELETE.';
        END IF;

        -- Validate Row Level Security is enabled
        SELECT c.relrowsecurity INTO v_has_rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'v2_crop_recommendations';

        IF NOT v_has_rls THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations does not have Row Level Security enabled.';
        END IF;

        -- Validate direct client access privileges are completely revoked
        -- Role 'anon' must possess zero privileges
        SELECT COUNT(*) INTO v_anon_privs
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND table_name = 'v2_crop_recommendations'
          AND grantee = 'anon';

        IF v_anon_privs > 0 THEN
            RAISE EXCEPTION 'Preflight Failure: Role "anon" possesses direct table privileges on public.v2_crop_recommendations.';
        END IF;

        -- Role 'authenticated' must NOT possess INSERT, UPDATE, DELETE, or TRUNCATE privileges
        SELECT COUNT(*) INTO v_auth_privs
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND table_name = 'v2_crop_recommendations'
          AND grantee = 'authenticated'
          AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

        IF v_auth_privs > 0 THEN
            RAISE EXCEPTION 'Preflight Failure: Role "authenticated" possesses direct mutation privileges (including INSERT) on public.v2_crop_recommendations. Backend-mediated persistence requires all direct client mutations to be revoked.';
        END IF;

        -- Pseudo-role 'PUBLIC' must NOT possess mutation privileges
        SELECT COUNT(*) INTO v_public_privs
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND table_name = 'v2_crop_recommendations'
          AND grantee = 'PUBLIC'
          AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

        IF v_public_privs > 0 THEN
            RAISE EXCEPTION 'Preflight Failure: Pseudo-role PUBLIC possesses mutation privileges on public.v2_crop_recommendations.';
        END IF;

        RAISE NOTICE 'Preflight Check: Existing table public.v2_crop_recommendations passed all compatibility assertions.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Step 2: Table Creation (Executed when table does not exist)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.v2_crop_recommendations (
    -- Primary Identity & Provenance
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id TEXT NOT NULL REFERENCES public.farmers(id) ON DELETE RESTRICT,
    idempotency_key TEXT NOT NULL,
    request_hash CHAR(64) NOT NULL,

    -- Engine Execution Metadata
    engine_version TEXT NOT NULL,
    engine_status TEXT NOT NULL CHECK (engine_status IN ('SUCCESS', 'INSUFFICIENT_DATA', 'NO_RECOMMENDATION_SUITABLE')),
    execution_time_ms INTEGER NULL CHECK (execution_time_ms IS NULL OR execution_time_ms >= 0),

    -- Top-Ranked Crop Recommendation Metrics (NULL on INSUFFICIENT_DATA / NO_RECOMMENDATION_SUITABLE)
    recommended_crop TEXT NULL,
    top_crop TEXT NULL,
    suitability_score NUMERIC(5, 2) NULL CHECK (
        suitability_score IS NULL OR (
            suitability_score >= 0.0 AND 
            suitability_score <= 100.0 AND 
            suitability_score != 'NaN'::numeric
        )
    ),
    top_suitability_score NUMERIC(5, 2) NULL CHECK (
        top_suitability_score IS NULL OR (
            top_suitability_score >= 0.0 AND 
            top_suitability_score <= 100.0 AND 
            top_suitability_score != 'NaN'::numeric
        )
    ),
    dci_confidence NUMERIC(4, 3) NULL CHECK (
        dci_confidence IS NULL OR (
            dci_confidence >= 0.0 AND 
            dci_confidence <= 1.0 AND 
            dci_confidence != 'NaN'::numeric
        )
    ),
    top_confidence_tier TEXT NULL,

    -- Agronomic Context Snapshot (Relational Indexing & Filtering Columns)
    state TEXT NOT NULL,
    district TEXT NULL,
    sowing_month SMALLINT NULL CHECK (
        sowing_month IS NULL OR (sowing_month BETWEEN 1 AND 12)
    ),
    season TEXT NULL,
    irrigation_access TEXT NULL,
    soil_texture TEXT NULL,
    has_soil_test BOOLEAN NULL,
    soil_test_declaration_status TEXT NULL DEFAULT 'USER_DECLARED',

    -- Environmental & Chemical Measurements (Finite numbers only, NaN explicitly rejected)
    temperature NUMERIC NULL CHECK (
        temperature IS NULL OR (
            temperature >= -20.0 AND 
            temperature <= 60.0 AND 
            temperature != 'NaN'::numeric
        )
    ),
    humidity NUMERIC NULL CHECK (
        humidity IS NULL OR (
            humidity >= 0.0 AND 
            humidity <= 100.0 AND 
            humidity != 'NaN'::numeric
        )
    ),
    soil_ph NUMERIC NULL CHECK (
        soil_ph IS NULL OR (
            soil_ph >= 2.0 AND 
            soil_ph <= 12.0 AND 
            soil_ph != 'NaN'::numeric
        )
    ),
    nitrogen NUMERIC NULL CHECK (
        nitrogen IS NULL OR (
            nitrogen >= 0.0 AND 
            nitrogen != 'NaN'::numeric
        )
    ),
    phosphorus NUMERIC NULL CHECK (
        phosphorus IS NULL OR (
            phosphorus >= 0.0 AND 
            phosphorus != 'NaN'::numeric
        )
    ),
    potassium NUMERIC NULL CHECK (
        potassium IS NULL OR (
            potassium >= 0.0 AND 
            potassium != 'NaN'::numeric
        )
    ),
    organic_carbon NUMERIC NULL CHECK (
        organic_carbon IS NULL OR (
            organic_carbon >= 0.0 AND 
            organic_carbon <= 100.0 AND 
            organic_carbon != 'NaN'::numeric
        )
    ),
    seasonal_rainfall_mm NUMERIC NULL CHECK (
        seasonal_rainfall_mm IS NULL OR (
            seasonal_rainfall_mm >= 0.0 AND 
            seasonal_rainfall_mm != 'NaN'::numeric
        )
    ),
    seasonal_rainfall_amount NUMERIC NULL CHECK (
        seasonal_rainfall_amount IS NULL OR (
            seasonal_rainfall_amount >= 0.0 AND 
            seasonal_rainfall_amount != 'NaN'::numeric
        )
    ),
    irrigation_water_quantity_mm NUMERIC NULL CHECK (
        irrigation_water_quantity_mm IS NULL OR (
            irrigation_water_quantity_mm >= 0.0 AND 
            irrigation_water_quantity_mm != 'NaN'::numeric
        )
    ),
    irrigation_depth_mm NUMERIC NULL CHECK (
        irrigation_depth_mm IS NULL OR (
            irrigation_depth_mm >= 0.0 AND 
            irrigation_depth_mm != 'NaN'::numeric
        )
    ),

    -- Complete JSON Snapshots for Full Lossless Reproducibility
    request_payload JSONB NOT NULL,
    response_payload JSONB NOT NULL,
    input_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    excluded_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
    diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Immutable Creation Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Idempotency Constraint: Exactly one response per farmer per idempotency key
    CONSTRAINT uq_v2_rec_farmer_idempotency UNIQUE (farmer_id, idempotency_key),

    -- Agronomic Status Coherence: Metric presence strictly aligns with engine status
    CONSTRAINT chk_status_metrics_coherence CHECK (
        (engine_status = 'SUCCESS' AND (recommended_crop IS NOT NULL OR top_crop IS NOT NULL) AND (suitability_score IS NOT NULL OR top_suitability_score IS NOT NULL)) OR
        (engine_status IN ('INSUFFICIENT_DATA', 'NO_RECOMMENDATION_SUITABLE') AND recommended_crop IS NULL AND top_crop IS NULL AND suitability_score IS NULL AND top_suitability_score IS NULL)
    )
);

-- -----------------------------------------------------------------------------
-- Step 3: Indexes for Query Performance & Analytics
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_v2_rec_farmer_created 
    ON public.v2_crop_recommendations (farmer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v2_rec_state_district_crop 
    ON public.v2_crop_recommendations (state, district, recommended_crop);

CREATE INDEX IF NOT EXISTS idx_v2_rec_created_at 
    ON public.v2_crop_recommendations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v2_rec_request_hash 
    ON public.v2_crop_recommendations (request_hash);

CREATE INDEX IF NOT EXISTS idx_v2_rec_recommendations_gin 
    ON public.v2_crop_recommendations USING GIN (recommendations);

-- -----------------------------------------------------------------------------
-- Step 4: Immutability Trigger (Strict Append-Only Guarantee)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_prevent_v2_recommendations_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit Violation: public.v2_crop_recommendations is strictly append-only. UPDATE and DELETE operations are prohibited (Record ID: %)', OLD.id
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_v2_recommendations_mutation ON public.v2_crop_recommendations;

CREATE TRIGGER trg_prevent_v2_recommendations_mutation
BEFORE UPDATE OR DELETE ON public.v2_crop_recommendations
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_v2_recommendations_mutation();

-- -----------------------------------------------------------------------------
-- Step 5: Database Privileges and Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.v2_crop_recommendations ENABLE ROW LEVEL SECURITY;

-- Revoke all direct client access (both anonymous and authenticated browser users)
REVOKE ALL ON public.v2_crop_recommendations FROM anon;
REVOKE ALL ON public.v2_crop_recommendations FROM authenticated;
REVOKE ALL ON public.v2_crop_recommendations FROM public;

-- Grant required permissions exclusively to trusted service_role
GRANT SELECT, INSERT ON public.v2_crop_recommendations TO service_role;

COMMIT;
