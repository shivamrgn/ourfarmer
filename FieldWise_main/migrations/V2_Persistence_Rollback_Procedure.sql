-- =============================================================================
-- FieldWise Phase 3C.6.8.2 / Phase 2: V2 Persistence Rollback & Recovery Procedure
-- File Reference: migrations/V2_Persistence_Rollback_Procedure.sql
-- =============================================================================
-- Target Database: PostgreSQL 15+ / Supabase
-- Target Table: public.v2_crop_recommendations
--
-- CRITICAL OPERATIONAL WARNING:
--   1. DO NOT EXECUTE THIS SCRIPT WITHOUT AN AUTHORITATIVE PG_DUMP BACKUP CONFIRMED.
--   2. DATA LOSS WARNING: Rolling back public.v2_crop_recommendations removes
--      persisted audit records of V2 crop recommendations.
--   3. This script is guarded with a safety switch (v_confirmed). By default,
--      it runs in SIMULATION / DRY-RUN mode.
--   4. To execute a live rollback, an authorized DBA must set:
--        SET fieldwise.confirm_destructive_rollback = 'CONFIRMED';
--      within the transaction before running this script.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Step 0: Execution Safety Gate
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_confirm TEXT;
BEGIN
    v_confirm := current_setting('fieldwise.confirm_destructive_rollback', true);
    IF v_confirm IS DISTINCT FROM 'CONFIRMED' THEN
        RAISE EXCEPTION 'Rollback Aborted by Safety Gate: To execute destructive rollback, the DBA must explicitly run: SET fieldwise.confirm_destructive_rollback = ''CONFIRMED''; before this script.';
    END IF;
    RAISE NOTICE 'Rollback Gate Acknowledged: Proceeding with controlled V2 persistence rollback.';
END $$;

-- -----------------------------------------------------------------------------
-- Step 1: Revoke Privileges
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.v2_crop_recommendations') IS NOT NULL THEN
        REVOKE ALL ON public.v2_crop_recommendations FROM service_role;
        REVOKE ALL ON public.v2_crop_recommendations FROM anon;
        REVOKE ALL ON public.v2_crop_recommendations FROM authenticated;
        REVOKE ALL ON public.v2_crop_recommendations FROM public;
        RAISE NOTICE 'Step 1 Complete: All privileges revoked from public.v2_crop_recommendations.';
    ELSE
        RAISE NOTICE 'Step 1 Skipped: Table public.v2_crop_recommendations does not exist.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Step 2: Drop Immutability Trigger & Function
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_prevent_v2_recommendations_mutation ON public.v2_crop_recommendations;
DROP FUNCTION IF EXISTS public.fn_prevent_v2_recommendations_mutation();

RAISE NOTICE 'Step 2 Complete: Immutability trigger and function removed.';

-- -----------------------------------------------------------------------------
-- Step 3: Drop Indexes
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_v2_rec_farmer_created;
DROP INDEX IF EXISTS public.idx_v2_rec_state_district_crop;
DROP INDEX IF EXISTS public.idx_v2_rec_created_at;
DROP INDEX IF EXISTS public.idx_v2_rec_request_hash;
DROP INDEX IF EXISTS public.idx_v2_rec_recommendations_gin;

RAISE NOTICE 'Step 3 Complete: V2 performance indexes dropped.';

-- -----------------------------------------------------------------------------
-- Step 4: Safe Table Archiving or Removal
-- Option A (Default Recommended): Archive table with timestamp suffix.
-- Option B: Permanent DROP TABLE (Uncomment only if full purge is authorized).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_archive_table TEXT;
BEGIN
    IF to_regclass('public.v2_crop_recommendations') IS NOT NULL THEN
        -- Option A: Safe archive (preserves records from accidental destruction)
        v_archive_table := 'v2_crop_recommendations_archived_' || to_char(NOW(), 'YYYYMMDD_HH24MISS');
        EXECUTE format('ALTER TABLE public.v2_crop_recommendations RENAME TO %I', v_archive_table);
        RAISE NOTICE 'Step 4 Complete: Table public.v2_crop_recommendations renamed to public.% for safe preservation.', v_archive_table;

        -- Option B (Purge): To permanently drop, the DBA must explicitly uncomment:
        -- DROP TABLE IF EXISTS public.v2_crop_recommendations CASCADE;
    ELSE
        RAISE NOTICE 'Step 4 Skipped: Table public.v2_crop_recommendations does not exist.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Step 5: Post-Rollback Verification
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.v2_crop_recommendations') IS NULL THEN
        RAISE NOTICE 'Step 5 Verified: public.v2_crop_recommendations is no longer active in schema public.';
    ELSE
        RAISE WARNING 'Step 5 Incomplete: public.v2_crop_recommendations still exists!';
    END IF;
END $$;

COMMIT;
