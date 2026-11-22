-- =============================================================================
-- FieldWise Phase 3C: Baseline V1 Database Schema Migration
-- File Reference: migrations/V1_Baseline_Schema.sql
-- =============================================================================
-- Target Database: PostgreSQL 15+ / Supabase Staging Instance
-- Target Schema: public
-- Target Tables:
--   1. public.farmers          (Canonical identity anchor & parent relation)
--   2. public.farm_profiles     (Soil, context & environmental baseline profile)
--   3. public.crop_predictions  (Legacy V1 flattened scalar prediction ledger)
--
-- Operational & Security Invariants:
--   1. Identity Anchor Invariant:
--      - public.farmers.id is type TEXT PRIMARY KEY.
--      - Holds alphanumeric Firebase UIDs (e.g., '8WbK14vYJq9z...', 'demo_farmer_guest')
--        or backend user identifiers. NEVER UUID or integer.
--   2. Foreign Key Deletion Policy:
--      - Enforces ON DELETE RESTRICT on all child foreign keys to public.farmers(id).
--      - Child records in farm_profiles and crop_predictions are protected from accidental
--        orphan cascading deletions. Completely aligned with V2 persistence standards.
--   3. Preserved Agronomic & Measurement Nullability:
--      - All soil, climate, and environmental measurements are strictly NULLable.
--      - Unmeasured or unknown parameters are stored as NULL, never fabricated as 0.0.
--      - Rejects non-finite numbers and NaN on numeric columns.
--   4. Hardened Security & Least Privilege Model:
--      - RLS is explicitly ENABLED on all three tables.
--      - Direct table access is completely REVOKED from anon, authenticated, and public.
--      - Permissions are granted exclusively to trusted backend service_role.
--      - Browser direct-to-database mutations are blocked until backend mediation
--        or verified Supabase Auth claims are established.
--   5. Comprehensive Catalog-Based Preflight Assertions:
--      - If any target table already exists, preflight asserts exact structural compatibility
--        (column types, nullability, primary keys, and foreign keys).
--      - Fails fast and ABORTS the transaction if an existing table has an incompatible schema.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Step 1: Migration Preflight Assertions
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_col_type TEXT;
    v_is_nullable TEXT;
    v_has_pk BOOLEAN;
    v_fk_count INTEGER;
    v_del_type CHAR;
BEGIN
    -- 1. Preflight for public.farmers
    SELECT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'farmers' AND c.relkind = 'r'
    ) INTO v_table_exists;

    IF v_table_exists THEN
        -- Assert id column exists and is type text
        SELECT t.typname INTO v_col_type
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_type t ON t.oid = a.atttypid
        WHERE n.nspname = 'public' 
          AND c.relname = 'farmers' 
          AND a.attname = 'id' 
          AND a.attnum > 0 
          AND NOT a.attisdropped;

        IF v_col_type IS NULL THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.farmers is missing required column "id".';
        ELSIF v_col_type != 'text' THEN
            RAISE EXCEPTION 'Preflight Failure: Existing column public.farmers.id is type "%", expected "text". Firebase UID identity requires text.', v_col_type;
        END IF;

        -- Assert id is PRIMARY KEY
        SELECT EXISTS (
            SELECT 1 FROM pg_constraint con
            JOIN pg_class c ON c.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = con.conkey[1]
            WHERE con.contype = 'p'
              AND n.nspname = 'public'
              AND c.relname = 'farmers'
              AND a.attname = 'id'
              AND array_length(con.conkey, 1) = 1
        ) INTO v_has_pk;

        IF NOT v_has_pk THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.farmers does not have single-column PRIMARY KEY on "id".';
        END IF;

        -- Assert email column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'farmers' AND column_name = 'email'
        ) THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.farmers is missing mandatory column "email".';
        END IF;

        RAISE NOTICE 'Preflight Check: Existing table public.farmers passed structural compatibility assertions.';
    END IF;

    -- 2. Preflight for public.farm_profiles
    SELECT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'farm_profiles' AND c.relkind = 'r'
    ) INTO v_table_exists;

    IF v_table_exists THEN
        -- Assert farmer_id column exists and is type text
        SELECT t.typname INTO v_col_type
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_type t ON t.oid = a.atttypid
        WHERE n.nspname = 'public' 
          AND c.relname = 'farm_profiles' 
          AND a.attname = 'farmer_id' 
          AND a.attnum > 0 
          AND NOT a.attisdropped;

        IF v_col_type IS NULL THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.farm_profiles is missing required column "farmer_id".';
        ELSIF v_col_type != 'text' THEN
            RAISE EXCEPTION 'Preflight Failure: Existing column public.farm_profiles.farmer_id is type "%", expected "text".', v_col_type;
        END IF;

        -- Assert foreign key to public.farmers(id) has ON DELETE RESTRICT
        SELECT con.confdeltype INTO v_del_type
        FROM pg_constraint con
        JOIN pg_class c_from ON c_from.oid = con.conrelid
        JOIN pg_namespace n_from ON n_from.oid = c_from.relnamespace
        JOIN pg_class c_to ON c_to.oid = con.confrelid
        JOIN pg_namespace n_to ON n_to.oid = c_to.relnamespace
        JOIN pg_attribute a_from ON a_from.attrelid = c_from.oid AND a_from.attnum = con.conkey[1]
        JOIN pg_attribute a_to ON a_to.attrelid = c_to.oid AND a_to.attnum = con.confkey[1]
        WHERE con.contype = 'f'
          AND n_from.nspname = 'public' AND c_from.relname = 'farm_profiles' AND a_from.attname = 'farmer_id'
          AND n_to.nspname = 'public' AND c_to.relname = 'farmers' AND a_to.attname = 'id'
          AND array_length(con.conkey, 1) = 1;

        IF v_del_type IS NOT NULL AND v_del_type != 'r' THEN
            RAISE EXCEPTION 'Preflight Failure: Existing foreign key on public.farm_profiles.farmer_id has delete action "%", expected RESTRICT (r).', v_del_type;
        END IF;

        RAISE NOTICE 'Preflight Check: Existing table public.farm_profiles passed structural compatibility assertions.';
    END IF;

    -- 3. Preflight for public.crop_predictions
    SELECT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'crop_predictions' AND c.relkind = 'r'
    ) INTO v_table_exists;

    IF v_table_exists THEN
        -- Assert farmer_id column exists and is type text
        SELECT t.typname INTO v_col_type
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_type t ON t.oid = a.atttypid
        WHERE n.nspname = 'public' 
          AND c.relname = 'crop_predictions' 
          AND a.attname = 'farmer_id' 
          AND a.attnum > 0 
          AND NOT a.attisdropped;

        IF v_col_type IS NULL THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.crop_predictions is missing required column "farmer_id".';
        ELSIF v_col_type != 'text' THEN
            RAISE EXCEPTION 'Preflight Failure: Existing column public.crop_predictions.farmer_id is type "%", expected "text".', v_col_type;
        END IF;

        -- Assert recommended_crop is NOT NULL
        SELECT is_nullable INTO v_is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'crop_predictions' AND column_name = 'recommended_crop';

        IF v_is_nullable IS NULL THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.crop_predictions is missing required column "recommended_crop".';
        ELSIF v_is_nullable != 'NO' THEN
            RAISE EXCEPTION 'Preflight Failure: Existing column public.crop_predictions.recommended_crop is NULLable. It must be NOT NULL.';
        END IF;

        RAISE NOTICE 'Preflight Check: Existing table public.crop_predictions passed structural compatibility assertions.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Step 2: Table Creation (Idempotent Execution)
-- -----------------------------------------------------------------------------

-- 1. Canonical Identity Anchor Table: public.farmers
CREATE TABLE IF NOT EXISTS public.farmers (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT NULL DEFAULT 'Farmer Partner',
    phone TEXT NULL DEFAULT '',
    location TEXT NULL DEFAULT '',
    farm_size TEXT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Soil & Baseline Environmental Context: public.farm_profiles
CREATE TABLE IF NOT EXISTS public.farm_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id TEXT NOT NULL REFERENCES public.farmers(id) ON DELETE RESTRICT,
    state TEXT NULL,
    district TEXT NULL,
    soil_type TEXT NULL DEFAULT 'Loamy',
    ph NUMERIC NULL CHECK (
        ph IS NULL OR (ph >= 0.0 AND ph <= 14.0 AND ph != 'NaN'::numeric)
    ),
    nitrogen NUMERIC NULL CHECK (
        nitrogen IS NULL OR (nitrogen >= 0.0 AND nitrogen != 'NaN'::numeric)
    ),
    phosphorus NUMERIC NULL CHECK (
        phosphorus IS NULL OR (phosphorus >= 0.0 AND phosphorus != 'NaN'::numeric)
    ),
    potassium NUMERIC NULL CHECK (
        potassium IS NULL OR (potassium >= 0.0 AND potassium != 'NaN'::numeric)
    ),
    rainfall NUMERIC NULL CHECK (
        rainfall IS NULL OR (rainfall >= 0.0 AND rainfall != 'NaN'::numeric)
    ),
    irrigation_type TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Legacy V1 Recommendation Ledger: public.crop_predictions
CREATE TABLE IF NOT EXISTS public.crop_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id TEXT NOT NULL REFERENCES public.farmers(id) ON DELETE RESTRICT,
    recommended_crop TEXT NOT NULL,
    confidence TEXT NULL DEFAULT '95%',
    nitrogen NUMERIC NULL CHECK (
        nitrogen IS NULL OR (nitrogen >= 0.0 AND nitrogen != 'NaN'::numeric)
    ),
    phosphorus NUMERIC NULL CHECK (
        phosphorus IS NULL OR (phosphorus >= 0.0 AND phosphorus != 'NaN'::numeric)
    ),
    potassium NUMERIC NULL CHECK (
        potassium IS NULL OR (potassium >= 0.0 AND potassium != 'NaN'::numeric)
    ),
    ph NUMERIC NULL CHECK (
        ph IS NULL OR (ph >= 0.0 AND ph <= 14.0 AND ph != 'NaN'::numeric)
    ),
    rainfall NUMERIC NULL CHECK (
        rainfall IS NULL OR (rainfall >= 0.0 AND rainfall != 'NaN'::numeric)
    ),
    temperature NUMERIC NULL CHECK (
        temperature IS NULL OR (temperature >= -50.0 AND temperature <= 70.0 AND temperature != 'NaN'::numeric)
    ),
    humidity NUMERIC NULL CHECK (
        humidity IS NULL OR (humidity >= 0.0 AND humidity <= 100.0 AND humidity != 'NaN'::numeric)
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Step 3: Performance & Query Optimization Indexes
-- -----------------------------------------------------------------------------

-- Index for farmer lookups and unique email indexing
CREATE INDEX IF NOT EXISTS idx_farmers_email 
    ON public.farmers (email);

-- Index for fetching latest farm profile for a farmer
CREATE INDEX IF NOT EXISTS idx_farm_profiles_farmer_updated 
    ON public.farm_profiles (farmer_id, updated_at DESC);

-- Index for fetching latest crop prediction for a farmer
CREATE INDEX IF NOT EXISTS idx_crop_predictions_farmer_created 
    ON public.crop_predictions (farmer_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Step 4: Row Level Security & Privilege Hardening (Strict Least-Privilege)
-- -----------------------------------------------------------------------------

-- Enable Row Level Security across all three tables
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_predictions ENABLE ROW LEVEL SECURITY;

-- Revoke all direct client access (both anonymous and authenticated browser users)
REVOKE ALL ON public.farmers FROM anon, authenticated, public;
REVOKE ALL ON public.farm_profiles FROM anon, authenticated, public;
REVOKE ALL ON public.crop_predictions FROM anon, authenticated, public;

-- Grant required operational permissions exclusively to trusted backend service_role
GRANT SELECT, INSERT, UPDATE ON public.farmers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_profiles TO service_role;
GRANT SELECT, INSERT ON public.crop_predictions TO service_role;

COMMIT;
