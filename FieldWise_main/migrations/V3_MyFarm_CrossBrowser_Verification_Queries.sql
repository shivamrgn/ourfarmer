-- =============================================================================
-- Verification Queries: V3_MyFarm_CrossBrowser_Verification_Queries.sql
-- Purpose: Read-only verification queries for DBA inspection after V3 migration
-- =============================================================================

-- Query 1: Verify all 5 new columns exist with TEXT type and are NULLable
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'farm_profiles'
  AND column_name IN (
    'village_name', 
    'farm_name', 
    'current_crops', 
    'previous_crops', 
    'agro_climatic_zone'
  )
ORDER BY column_name;

-- Query 2: Confirm table public.farm_profiles RLS is enabled and active
SELECT 
    relname, 
    relrowsecurity, 
    relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relname = 'farm_profiles';

-- Query 3: Inspect existing row count to confirm zero data loss
SELECT COUNT(*) AS total_farm_profiles_count FROM public.farm_profiles;
