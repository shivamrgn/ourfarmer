-- =============================================================================
-- Migration: V3_MyFarm_CrossBrowser_Persistence_Migration.sql
-- Purpose: Add persistent storage for all 5 My Farm fields in public.farm_profiles
-- Target Columns:
--   1. village_name (TEXT NULL)
--   2. farm_name (TEXT NULL)
--   3. current_crops (TEXT NULL)
--   4. previous_crops (TEXT NULL)
--   5. agro_climatic_zone (TEXT NULL)
-- Safety: Additive, backwards-compatible, nullable, idempotent.
-- Note: Provide to DBA for execution. DO NOT EXECUTE AUTOMATICALLY.
-- =============================================================================

BEGIN;

-- Preflight structural validation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'farm_profiles'
    ) THEN
        RAISE EXCEPTION 'Preflight Failure: Required table public.farm_profiles does not exist.';
    END IF;
END $$;

-- 1. Additive column additions for My Farm fields
ALTER TABLE public.farm_profiles
    ADD COLUMN IF NOT EXISTS village_name TEXT NULL,
    ADD COLUMN IF NOT EXISTS farm_name TEXT NULL,
    ADD COLUMN IF NOT EXISTS current_crops TEXT NULL,
    ADD COLUMN IF NOT EXISTS previous_crops TEXT NULL,
    ADD COLUMN IF NOT EXISTS agro_climatic_zone TEXT NULL;

-- 2. Metadata column comments
COMMENT ON COLUMN public.farm_profiles.village_name IS 'Village or Gram Panchayat where the farm holding is situated';
COMMENT ON COLUMN public.farm_profiles.farm_name IS 'Farmer-designated farm holding name or land identifier';
COMMENT ON COLUMN public.farm_profiles.current_crops IS 'Current crops planted on the farm holding (string list)';
COMMENT ON COLUMN public.farm_profiles.previous_crops IS 'Previous crops grown / crop rotation history (string list)';
COMMENT ON COLUMN public.farm_profiles.agro_climatic_zone IS 'Agro-climatic classification zone (e.g. Trans-Gangetic Plains, Gujarat Plains)';

-- 3. Verify RLS grants remain strictly intact for service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_profiles TO service_role;

COMMIT;
