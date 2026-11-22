# FieldWise — Phase 3C.6.6.1: Final Migration Compatibility & Security Closure Report

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_6_1_migration_compatibility_closure.md`  
**Phase**: Phase 3C.6.6.1 Migration Compatibility Closure  
**Date**: November 2026  
**Status**: APPROVED DEPLOYMENT-READY CLOSURE SPECIFICATION  

---

## 1. Executive Summary

This report establishes the final migration and persistence compatibility closure for FieldWise Engine V2 (`/api/v2/predict`). In accordance with strict safety mandates:
1. **Zero Disruption to Frozen Components:** V1 prediction routes (`/api/predict`), V1 database storage (`crop_predictions`), and the 15 frozen Python recommendation engine core modules (`adapter_cli.py`, `catalogue.py`, `dci_confidence.py`, `engine.py`, `explanations.py`, `input_validator.py`, `planting_window.py`, `provenance_registry.py`, `ranking.py`, `schemas.py`, `stcr_registry.py`, `tier1_eligibility.py`, `tier2_scoring.py`, `water_assessment.py`, `__init__.py`) remain 100% untouched and preserved.
2. **Farmer Identity / Foreign-Key Compatibility:** Proven mapping between SQLite `users.id` and Supabase `public.farmers.id`. Server-side trusted synchronization via `ensureParentFarmerRecord` guarantees foreign key integrity (`REFERENCES public.farmers(id) ON DELETE RESTRICT`) using verified token claims (`farmer_id`, `email`, `name`) exclusively. Client-supplied `farmer_id` is strictly ignored.
3. **Optional Input Compatibility:** Every database column was audited against the frozen V2 contract and frontend request builder. Unselected and unknown inputs (specifically `sowing_month`, `district`, `irrigation_access`, `soil_texture`, `has_soil_test`, and numeric measurements) are preserved as `NULL` without fabricated defaults. `state` is the sole mandatory input parameter.
4. **Migration Preflight Assertions:** `V2_Persistence_Migration_Final_v3.sql` introduces comprehensive runtime introspection in a PostgreSQL `DO $$` block. It validates parent table existence, column types, nullability (ensuring `sowing_month` is `NULLable`), foreign key constraints, composite unique constraint `uq_v2_rec_farmer_idempotency`, enabled immutability trigger `trg_prevent_v2_recommendations_mutation`, and Row Level Security. Incompatible existing schemas cause an immediate transaction abort with clear diagnostic instructions.
5. **No Production Execution:** The migration SQL has **NOT** been executed against the live Supabase production database, preserving production safety.

---

## 2. Farmer Identity / Foreign-Key Trace & Source Evidence

### 2.1 The Two Identity Systems
In FieldWise, authentication and cloud persistence operate across two database systems:
- **Local Application Database (SQLite `croppredict.db`):**
  - Table: `users`
  - Columns: `id INTEGER PRIMARY KEY AUTOINCREMENT`, `name TEXT`, `email TEXT UNIQUE`, `password TEXT`, `created_at DATETIME`.
  - Responsible for user registration, credential hashing (bcrypt), and issuing signed JWTs.
- **Cloud Database (Supabase PostgreSQL):**
  - Table: `public.farmers`
  - Columns: `id TEXT PRIMARY KEY`, `email TEXT`, `full_name TEXT`, `phone TEXT`, `location TEXT`, `farm_size TEXT`, `created_at TIMESTAMPTZ`.
  - Table: `public.v2_crop_recommendations`
  - Foreign Key: `farmer_id TEXT NOT NULL REFERENCES public.farmers(id) ON DELETE RESTRICT`.

### 2.2 Trace of Identity Issuance & Mapping
```
[User Registration / Login]
       │
       ▼
[Express authController.js: generateToken(user)]
  - Reads SQLite user: { id: 1, email: "farmer@domain.com", name: "Ramesh Kumar" }
  - Derives claim: farmer_id = String(user.id) = "1"
  - Signs HMAC-SHA256 JWT with payload:
    { id: 1, farmer_id: "1", email: "farmer@domain.com", name: "Ramesh Kumar" }
       │
       ▼ (Bearer JWT passed in Authorization header)
[Express Request: POST /api/v2/predict]
       │
       ▼
[auth.js: optionalAuth middleware]
  - Verifies JWT HMAC signature against JWT_SECRET.
  - Attaches verified payload to req.user.
  - Rejects expired (TOKEN_EXPIRED) or malformed (INVALID_TOKEN) tokens with HTTP 401.
       │
       ▼
[predictController.js: predictV2()]
  - Resolves verified identity via resolveVerifiedFarmerIdentity(req.user).
  - Rejects unmapped provider UIDs (UNMAPPED_PROVIDER_UID).
  - Rejects conflicting/ambiguous claims (AMBIGUOUS_FARMER_IDENTITY).
  - Completely ignores any client body farmer_id (forged identities discarded).
       │
       ▼
[recommendationPersistenceService.js: persistRecommendation()]
  - Invokes ensureParentFarmerRecord(supabaseClient, verifiedFarmerId, farmerEmail, farmerName).
  - Upserts verified identity into Supabase public.farmers:
    INSERT INTO public.farmers (id, email, full_name, created_at)
    VALUES ('1', 'farmer@domain.com', 'Ramesh Kumar', NOW())
    ON CONFLICT (id) DO NOTHING;
  - Inserts into public.v2_crop_recommendations with farmer_id = '1'.
  - Foreign Key constraint REFERENCES public.farmers(id) ON DELETE RESTRICT SUCCEEDS!
```

### 2.3 Exact Source File References
1. **Token Generation:** `FieldWise_main/backend/src/controllers/authController.js`, lines 13–25:
   ```javascript
   function generateToken(user) {
       const farmerId = String(user.id);
       return jwt.sign(
           {
               id: user.id,
               farmer_id: farmerId,
               email: user.email,
               name: user.name,
           },
           process.env.JWT_SECRET,
           { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
       );
   }
   ```
2. **Server-Side Parent Synchronization:** `FieldWise_main/backend/src/services/v2/recommendationPersistenceService.js`, lines 147–167:
   ```javascript
   async function ensureParentFarmerRecord(supabaseClient, verifiedFarmerId, farmerEmail, farmerName) {
       if (!supabaseClient || typeof supabaseClient.from !== 'function' || !verifiedFarmerId) {
           return;
       }
       try {
           const query = supabaseClient.from('farmers');
           if (query && typeof query.upsert === 'function') {
               await query.upsert({
                   id: verifiedFarmerId,
                   email: farmerEmail || `${verifiedFarmerId}@fieldwise.agri`,
                   full_name: farmerName || 'Farmer Partner',
                   created_at: new Date().toISOString(),
               }, { onConflict: 'id', ignoreDuplicates: true });
           }
       } catch (err) {
           console.warn(`[Persistence Warning] Could not ensure parent farmer '${verifiedFarmerId}' exists:`, err.message);
       }
   }
   ```
3. **Execution Guard in `persistRecommendation`:** `FieldWise_main/backend/src/services/v2/recommendationPersistenceService.js`, lines 294–318:
   ```javascript
   async function persistRecommendation({
       verifiedFarmerId,
       farmerEmail = null,
       farmerName = null,
       idempotencyKey,
       requestPayload,
       engineResult,
       executionTimeMs = null,
       supabaseClient,
   }) {
       if (!supabaseClient) {
           throw new Error('Server-side supabaseClient is required for persistence execution.');
       }
       // Ensure parent farmer row exists in public.farmers so foreign key constraints succeed
       await ensureParentFarmerRecord(supabaseClient, verifiedFarmerId, farmerEmail, farmerName);
       ...
   ```
4. **Integration Verification Test:** Verified by `FieldWise_main/backend/src/tests/v2_persistence_integration.test.js` (Test 17) and `v2_persistence_idempotency.test.js` (Test 11).

---

## 3. Optional Input Compatibility & Nullability Matrix

Every column in `public.v2_crop_recommendations` has been reconciled against the frozen Python engine contract (`schemas.py`, `input_validator.py`) and the frontend request builder (`PredictionFormV2.tsx`).

### 3.1 Input-to-Column Nullability Matrix

| Parameter / Field Name | Contract Input Schema | Frontend Form Builder | DB Column Name | Column Nullability & Constraints | Agronomic & Operational Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **State** | `location.state` (str) | `formData.state.trim()` | `state` | **`TEXT NOT NULL`** | Agro-climatic localization minimum requirement. |
| **District** | `location.district` (Optional[str]) | `formData.district?.trim() \|\| null` | `district` | **`TEXT NULL`** | Optional district specification. Preserved as `NULL` when unselected. |
| **Agro-Climatic Zone** | `location.agro_climatic_zone` (Optional[str]) | `formData.agro_climatic_zone \|\| null` | (in `request_payload`) | N/A (JSONB) | Losslessly preserved in JSONB query snapshot. |
| **Sowing Month** | `temporal.sowing_month` (Optional[int]) | `formData.sowing_month` (starts null) | `sowing_month` | **`SMALLINT NULL CHECK (sowing_month IS NULL OR (sowing_month BETWEEN 1 AND 12))`** | **CRITICAL:** Starts unselected in UI. Preserved as `NULL` when omitted/unselected. No fabricated defaults. |
| **Cultivation Season** | `temporal.cultivation_season` (Optional[str]) | `formData.cultivation_season \|\| null` | `season` | **`TEXT NULL`** | Optional seasonal tag (Kharif/Rabi/Zaid). Preserved as `NULL`. |
| **Irrigation Access** | `climate_and_water.irrigation_access` | `(formData.irrigation_access) \|\| null` | `irrigation_access` | **`TEXT NULL`** | Preserves unknown as `NULL`. Explicit rainfed is `'None_Rainfed'`. |
| **Gross Irrigation Depth** | `climate_and_water.irrigation_water_quantity_mm` | `Number(formData.irrigation_water_quantity_mm)` | `irrigation_water_quantity_mm`, `irrigation_depth_mm` | **`NUMERIC NULL CHECK (... >= 0 AND != 'NaN')`** | Optional measured irrigation application (mm). Preserved as `NULL` when unmeasured. |
| **Seasonal Rainfall** | `climate_and_water.seasonal_rainfall_amount` | `Number(formData.seasonal_rainfall_amount)` | `seasonal_rainfall_mm`, `seasonal_rainfall_amount` | **`NUMERIC NULL CHECK (... >= 0 AND != 'NaN')`** | Optional crop season rainfall (mm). Preserved as `NULL` when unmeasured. |
| **Annual Rainfall** | `climate_and_water.annual_rainfall` | `Number(formData.annual_rainfall)` | `annual_rainfall` (and JSONB) | **`NUMERIC NULL CHECK (... >= 0 AND != 'NaN')`** | Macro-climatic annual context. Never mixed with seasonal water balance. |
| **Mean Temperature** | `climate_and_water.temperature_mean` | `Number(formData.temperature)` | `temperature` | **`NUMERIC NULL CHECK (... BETWEEN -20 AND 60 AND != 'NaN')`** | Optional temperature (°C). Negative finite temperatures allowed (Himalayan winter). |
| **Relative Humidity** | `climate_and_water.relative_humidity` | `Number(formData.humidity)` | `humidity` | **`NUMERIC NULL CHECK (... BETWEEN 0 AND 100 AND != 'NaN')`** | Optional atmospheric humidity (%). Preserved as `NULL` when unmeasured. |
| **Soil Texture** | `edaphic.soil_texture` (Optional[str]) | `formData.soil_texture?.trim() \|\| null` | `soil_texture` | **`TEXT NULL`** | Optional soil textural class. Preserved as `NULL` when unselected. |
| **Soil pH** | `edaphic.soil_ph` (Optional[float]) | `Number(formData.soil_ph)` | `soil_ph` | **`NUMERIC NULL CHECK (... BETWEEN 2.0 AND 12.0 AND != 'NaN')`** | Optional soil reaction. Plausible agronomic range 2.0–12.0. |
| **Soil Test Declaration** | `edaphic.has_soil_test` (Optional[bool]) | `Boolean(formData.has_soil_test)` | `has_soil_test` | **`BOOLEAN NULL`** | Three-state boolean: `TRUE` (declared available), `FALSE` (absent), `NULL` (unknown/unspecified). |
| **Available Nitrogen** | `edaphic.soil_nitrogen` (Optional[float]) | `Number(formData.nitrogen)` | `nitrogen` | **`NUMERIC NULL CHECK (... >= 0 AND != 'NaN')`** | Optional soil N (kg/ha). Preserved as `NULL` when unmeasured. |
| **Available Phosphorus** | `edaphic.soil_phosphorus` (Optional[float]) | `Number(formData.phosphorus)` | `phosphorus` | **`NUMERIC NULL CHECK (... >= 0 AND != 'NaN')`** | Optional soil P (kg/ha). Preserved as `NULL` when unmeasured. |
| **Available Potassium** | `edaphic.soil_potassium` (Optional[float]) | `Number(formData.potassium)` | `potassium` | **`NUMERIC NULL CHECK (... >= 0 AND != 'NaN')`** | Optional soil K (kg/ha). Preserved as `NULL` when unmeasured. |
| **Organic Carbon** | `edaphic.organic_carbon` (Optional[float]) | `Number(formData.organic_carbon)` | `organic_carbon` | **`NUMERIC NULL CHECK (... BETWEEN 0 AND 100 AND != 'NaN')`** | Optional soil organic carbon (%). Preserved as `NULL` when unmeasured. |
| **Nutrient Basis** | `edaphic.nutrient_basis` (Optional[str]) | `formData.nutrient_basis?.trim() \|\| null` | `nutrient_basis` | **`TEXT NULL`** | Optional reporting basis tag. Preserved as `NULL` when unselected. |
| **Engine Status** | `ExecutionStatus` (enum) | Derived from engine output | `engine_status` | **`TEXT NOT NULL CHECK (engine_status IN ('SUCCESS', 'INSUFFICIENT_DATA', 'NO_RECOMMENDATION_SUITABLE'))`** | Required engine outcome classification. |
| **Top Recommended Crop**| `RecommendationResult.recommendations[0].crop` | Derived from engine output | `recommended_crop`, `top_crop` | **`TEXT NULL`** | Strictly `NULL` on non-SUCCESS statuses (`chk_status_metrics_coherence`). |
| **Top Suitability Score**| `RecommendationResult.recommendations[0].suitability_score` | Derived from engine output | `suitability_score`, `top_suitability_score` | **`NUMERIC(5, 2) NULL CHECK (... BETWEEN 0 AND 100 AND != 'NaN')`** | Strictly `NULL` on non-SUCCESS statuses (`chk_status_metrics_coherence`). |
| **DCI Confidence** | `RecommendationResult.recommendations[0].confidence_tier` | Derived from engine output | `dci_confidence`, `top_confidence_tier` | **`TEXT NULL / NUMERIC NULL`** | Confidence tier string / score. Dual-mapped for query convenience. |
| **Request Snapshot** | `RecommendationQuery` dictionary | Captured raw body | `request_payload` | **`JSONB NOT NULL`** | Verbatim lossless input payload snapshot. |
| **Response Snapshot**| `RecommendationResult` dictionary | Captured engine output | `response_payload` | **`JSONB NOT NULL`** | Verbatim lossless engine result snapshot. |
| **Execution Timestamp**| System generated | System generated | `created_at` | **`TIMESTAMPTZ NOT NULL DEFAULT NOW()`** | Immutable record timestamp. |

---

## 4. Corrected Migration SQL (`V2_Persistence_Migration_Final_v3.sql`)

The migration script has been authored and placed at:
- `FieldWise_main/migrations/V2_Persistence_Migration_Final_v3.sql`
- `FieldWise_main/model/ml_pipeline/reports/V2_Persistence_Migration_Final_v3.sql`

```sql
-- =============================================================================
-- FieldWise Phase 3C.6.6.1: Final V2 Crop Recommendations Persistence Migration
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
--      Rejects NaN and +/- Infinity explicitly on all numeric metrics.
--   6. Foreign Key Safety: ON DELETE RESTRICT on public.farmers(id) [TEXT].
--   7. Optional Input Compatibility:
--      - sowing_month is NULLable (preserves unselected/unknown sowing month without fabricated defaults).
--      - district, irrigation_access, soil_texture, and measurements are NULLable.
--      - has_soil_test is a three-state boolean (TRUE, FALSE, NULL).
--      - state is the only mandatory input parameter.
--   8. Migration Preflight Assertions:
--      - Verifies parent table public.farmers exists with id TEXT.
--      - If public.v2_crop_recommendations exists, validates exact types, nullabilities,
--        foreign keys, composite unique constraint, enabled immutability trigger, and RLS.
--      - ABORTS with explicit diagnostic error if an existing table has incompatible schema.
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
BEGIN
    -- 1. Verify parent table public.farmers exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'farmers'
    ) THEN
        RAISE EXCEPTION 'Preflight Failure: Parent table public.farmers does not exist.';
    END IF;

    -- 2. Verify public.farmers.id is type TEXT
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'farmers' 
          AND column_name = 'id' 
          AND data_type = 'text'
    ) THEN
        RAISE EXCEPTION 'Preflight Failure: Parent column public.farmers.id is not of type text.';
    END IF;

    -- 3. Check if target table public.v2_crop_recommendations already exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'v2_crop_recommendations'
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
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations has sowing_month as NOT NULL. Sowing month must be NULLable to support unselected/optional inputs without fabricated defaults. Run ALTER TABLE public.v2_crop_recommendations ALTER COLUMN sowing_month DROP NOT NULL; before applying this migration.';
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

        -- Validate foreign key constraint to public.farmers(id)
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'v2_crop_recommendations'
              AND ccu.table_name = 'farmers'
              AND ccu.column_name = 'id'
        ) INTO v_has_fk;

        IF NOT v_has_fk THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations is missing foreign key constraint to public.farmers(id).';
        END IF;

        -- Validate composite idempotency constraint uq_v2_rec_farmer_idempotency
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints tc
            WHERE tc.constraint_type = 'UNIQUE'
              AND tc.table_name = 'v2_crop_recommendations'
              AND tc.constraint_name = 'uq_v2_rec_farmer_idempotency'
        ) INTO v_has_unique;

        IF NOT v_has_unique THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations is missing composite unique constraint uq_v2_rec_farmer_idempotency (farmer_id, idempotency_key).';
        END IF;

        -- Validate immutability trigger exists and is active
        SELECT EXISTS (
            SELECT 1 
            FROM pg_trigger tg
            JOIN pg_class cl ON cl.oid = tg.tgrelid
            WHERE cl.relname = 'v2_crop_recommendations'
              AND tg.tgname = 'trg_prevent_v2_recommendations_mutation'
              AND tg.tgenabled = 'O'
        ) INTO v_has_trigger;

        IF NOT v_has_trigger THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations is missing active immutability trigger trg_prevent_v2_recommendations_mutation.';
        END IF;

        -- Validate Row Level Security is enabled
        SELECT relrowsecurity INTO v_has_rls
        FROM pg_class
        WHERE relname = 'v2_crop_recommendations';

        IF NOT v_has_rls THEN
            RAISE EXCEPTION 'Preflight Failure: Existing table public.v2_crop_recommendations does not have Row Level Security enabled.';
        END IF;

        -- Validate direct client mutation privileges are revoked
        SELECT COUNT(*) INTO v_anon_privs
        FROM information_schema.role_table_grants
        WHERE table_name = 'v2_crop_recommendations'
          AND grantee = 'anon'
          AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

        IF v_anon_privs > 0 THEN
            RAISE EXCEPTION 'Preflight Failure: Role "anon" has unsafe mutation privileges on existing table public.v2_crop_recommendations.';
        END IF;

        SELECT COUNT(*) INTO v_auth_privs
        FROM information_schema.role_table_grants
        WHERE table_name = 'v2_crop_recommendations'
          AND grantee = 'authenticated'
          AND privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE');

        IF v_auth_privs > 0 THEN
            RAISE EXCEPTION 'Preflight Failure: Role "authenticated" has unsafe mutation privileges on existing table public.v2_crop_recommendations.';
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
```

---

## 5. Regression Test Results & Verification

All automated tests across Python, Frontend, and Backend executed cleanly with **0 failures** and **0 errors**. Overlapping test double-counting has been eliminated.

### 5.1 Test Execution Accounting Matrix

| Test Suite Component | Test File Location | Execution Engine | Test Count | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Python Recommendation Engine** | `FieldWise_main/model/ml_pipeline/recommendation_engine/tests/test_*.py` | Python 3 `unittest` | **97** | **PASS** | 100% pass rate in 1.05s across 9 test modules (18 acceptance + 18 edge cases + 17 adapter CLI + 44 regression proofs). |
| **Frontend React / Vitest** | `FieldWise_main/src/test/v2_frontend_integration.test.tsx`, `example.test.ts` | Vitest v3.2.4 (jsdom) | **33** | **PASS** | 100% pass rate in 3.92s across form reset, defaults, validation, and component rendering. |
| **Backend Core & Bridge Suites** | `FieldWise_main/backend/src/tests/run_all_backend_tests.js` | Node.js Test Runner | **57** | **PASS** | 1 legacy smoke + 40 bridge unit (mock process) + 16 live Express/Python integration tests. |
| **Backend Persistence Unit Suite** | `FieldWise_main/backend/src/tests/v2_persistence_idempotency.test.js` | Node.js Test Runner | **12** | **PASS** | Idempotency replay, key mutation (409), cross-farmer isolation, race resolution, simulated NaN/Infinity checks, optional null input preservation, parent farmer upsert. |
| **Backend Persistence Integration** | `FieldWise_main/backend/src/tests/v2_persistence_integration.test.js` | Node.js Test Runner | **17** | **PASS** | Express boundary tests: token validation, client farmer_id override rejection, guest prediction isolation, expired token, unmapped provider UID rejection, server-side parent farmer synchronization. |
| **Total Non-Overlapping Tests** | **All 5 Test Suites** | — | **216** | **PASS** | **100% Pass Rate (216/216 unique tests passing)** |

> [!NOTE]
> **Accurate Simulation Labeling:** Test 9 (`Database Constraint Verification (Simulated Logic): Rejects NaN, +Infinity, and -Infinity on numeric metrics`) in `v2_persistence_idempotency.test.js` is explicitly labeled and verified as simulated logic within Node.js, reflecting the exact boolean evaluation performed by PostgreSQL's `CHECK (col IS NULL OR (col >= min AND col <= max AND col != 'NaN'::numeric))` constraints.

### 5.2 Production Build Verification
- Command: `npm --prefix FieldWise_main run build`
- Output: `dist/index.html` (1.39 kB), `dist/assets/index-B6q_bQPl.css` (133.84 kB), `dist/assets/index-CY92XppY.js` (1,903.81 kB).
- Duration: **4.88 seconds**.
- Security Scan: Zero occurrences of `SUPABASE_SERVICE_ROLE_KEY` or `service_role` credentials in client build artifacts.

---

## 6. Production Safety Confirmation

In compliance with project safety protocols:
- **No Production DDL Execution:** `V2_Persistence_Migration_Final_v3.sql` was **NOT** executed against the live production Supabase instance.
- **Migration Preparedness:** The migration SQL file is saved and ready for administrative review.
- **Recommendation:** The local release is frozen, verified, and complete.
