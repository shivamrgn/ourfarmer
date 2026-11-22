/**
 * FieldWise Phase 3C.6.4.2.2: Trusted V2 Recommendation Persistence Service
 * =========================================================================
 * Manages atomic, transaction-safe, idempotent persistence of Engine V2 recommendations.
 *
 * Security Invariants:
 *   1. NEVER trusts client-supplied farmer_id, score, crop, status, or response payload.
 *   2. Persistence is executed exclusively with verified farmer identity (req.verifiedFarmerId).
 *   3. All response fields are populated directly from the trusted recommendation engine output.
 *   4. Replay and conflict detection are enforced via composite (farmer_id, idempotency_key) scoping.
 *   5. Concurrent duplicate submissions are safely resolved via database constraint (23505).
 */

const crypto = require('crypto');

class IdempotencyConflictError extends Error {
    constructor(message = 'Idempotency key has already been used with different input parameters.') {
        super(message);
        this.name = 'IdempotencyConflictError';
        this.code = 'IDEMPOTENCY_KEY_MUTATION';
        this.statusCode = 409;
    }
}

class UnauthenticatedPersistenceError extends Error {
    constructor(message = 'Persistence rejected: verified farmer identity is required.') {
        super(message);
        this.name = 'UnauthenticatedPersistenceError';
        this.code = 'FARMER_IDENTITY_REQUIRED';
        this.statusCode = 401;
    }
}

class FarmerIdentityError extends Error {
    constructor(message, code = 'INVALID_FARMER_IDENTITY', statusCode = 401) {
        super(message);
        this.name = 'FarmerIdentityError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

class AmbiguousFarmerIdentityError extends FarmerIdentityError {
    constructor(message = 'Ambiguous identity claims detected in authentication token') {
        super(message, 'AMBIGUOUS_FARMER_IDENTITY', 401);
    }
}

class UnknownFarmerIdentityError extends FarmerIdentityError {
    constructor(message = 'Unknown or unresolvable farmer identity in authentication token') {
        super(message, 'UNKNOWN_FARMER_IDENTITY', 401);
    }
}

class UnmappedProviderIdentityError extends FarmerIdentityError {
    constructor(message = 'Authentication-provider UID is not a verified farmer ID. Missing farmer mapping.') {
        super(message, 'UNMAPPED_PROVIDER_UID', 401);
    }
}

class ParentFarmerSynchronizationError extends FarmerIdentityError {
    constructor(message = 'Parent farmer synchronization failed.', cause = null) {
        super(message, 'PARENT_FARMER_SYNC_FAILED', 500);
        this.cause = cause;
    }
}

class FarmerIdentityConflictError extends FarmerIdentityError {
    constructor(message = 'Farmer identity conflict: local user ID maps to an existing unrelated farmer record.') {
        super(message, 'FARMER_IDENTITY_CONFLICT', 409);
    }
}

/**
 * Resolves a verified farmer ID from authenticated token claims.
 * Security Invariants:
 *   - Uses ONLY proven identity claims (farmer_id, id sourced from trusted user record).
 *   - Does NOT treat external auth-provider UIDs (e.g. Firebase uid, Auth0 sub) as farmer IDs.
 *   - Rejects unmapped provider UIDs with UNMAPPED_PROVIDER_UID.
 *   - Rejects ambiguous conflicting claims across fields.
 *   - Rejects unknown / missing claims.
 *   - Rejects invalid placeholders ('null', 'undefined', 'guest', 'anonymous', etc.).
 *   - Completely ignores any client-supplied body/query farmer_id.
 */
function resolveVerifiedFarmerIdentity(user) {
    if (!user) {
        return null; // Guest user: valid prediction without cloud persistence
    }
    if (typeof user !== 'object' || Array.isArray(user)) {
        throw new FarmerIdentityError('Malformed token claims object');
    }

    // 1. Guard against treating raw auth-provider UID as farmer ID
    const hasFarmerClaim = (user.farmer_id !== undefined && user.farmer_id !== null) ||
                          (user.id !== undefined && user.id !== null);

    if (!hasFarmerClaim && (user.uid || user.sub)) {
        const providerUid = user.uid || user.sub;
        throw new UnmappedProviderIdentityError(
            `Authentication-provider UID '${providerUid}' is not a verified farmer ID. Missing farmer mapping.`
        );
    }

    if (!hasFarmerClaim) {
        throw new UnknownFarmerIdentityError('Authentication token contains no recognizable farmer identity claim.');
    }

    // 2. Reject conflicting / ambiguous claims
    if (user.farmer_id && user.id && String(user.farmer_id).trim() !== String(user.id).trim()) {
        throw new AmbiguousFarmerIdentityError(
            `Conflicting claims in token: farmer_id='${user.farmer_id}' does not match id='${user.id}'`
        );
    }
    if (user.sub && user.farmer_id && String(user.sub).trim() !== String(user.farmer_id).trim() && user.sub !== user.email) {
        throw new AmbiguousFarmerIdentityError(
            `Conflicting claims in token: sub='${user.sub}' does not match farmer_id='${user.farmer_id}'`
        );
    }

    // 3. Extract proven farmer identity claim (farmer_id or id from backend users record)
    const rawFarmerId = user.farmer_id !== undefined && user.farmer_id !== null
        ? String(user.farmer_id).trim()
        : String(user.id).trim();

    if (!rawFarmerId || rawFarmerId.length === 0) {
        throw new UnknownFarmerIdentityError('Farmer identity claim is empty.');
    }

    const lower = rawFarmerId.toLowerCase();
    if (['null', 'undefined', 'anonymous', 'guest', '[object object]'].includes(lower)) {
        throw new FarmerIdentityError(`Invalid farmer identity value '${rawFarmerId}'.`);
    }

    return rawFarmerId;
}

/**
 * Computes deterministic canonical SHA-256 hash of the request payload.
 * Sorts object keys recursively to ensure consistent hashing across key orders.
 */
function computeRequestHash(payload) {
    function canonicalize(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(canonicalize);
        }
        const sorted = {};
        for (const key of Object.keys(obj).sort()) {
            sorted[key] = canonicalize(obj[key]);
        }
        return sorted;
    }

    const canonicalJson = JSON.stringify(canonicalize(payload || {}));
    return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}

/**
 * Ensures parent farmer record exists in public.farmers so foreign key constraints succeed.
 * Uses ONLY verified server-side identity claims (farmer_id, email, name).
 *
 * Invariants & Race Safety:
 *   1. Identity Namespace & Policy:
 *      - SQLite users.id is the authoritative local account store.
 *      - public.farmers is an on-demand projection provisioned solely to satisfy
 *        the relational foreign-key constraint ON DELETE RESTRICT.
 *      - Verified email (farmerEmail) acts as the mandatory verification anchor.
 *      - Fails closed if authenticated caller has no email (farmerEmail is null/empty).
 *   2. Unverifiable Existing Identity Guard:
 *      - If public.farmers row has null email, its identity cannot be verified. Fails closed.
 *   3. Collision Detection:
 *      - If public.farmers row has an email differing from caller's email, rejects with
 *        FarmerIdentityConflictError (HTTP 409).
 *   4. Concurrent Provisioning & Upsert Re-Read Verification:
 *      - Executes upsert with { onConflict: 'id', ignoreDuplicates: true } to prevent
 *        duplicate-key errors or clobbering under concurrent races.
 *      - IMMEDIATELY re-reads the row from public.farmers and verifies that the winning
 *        row's email matches the caller's verified email.
 *      - Rejection terminates execution before any recommendation record can be inserted.
 *   5. Non-Atomicity Disclosure:
 *      - Supabase JS client operations are distinct HTTP requests and NOT transactionally atomic.
 *        Race safety is achieved via database constraints (PRIMARY KEY) and post-upsert
 *        verification re-read rather than ambient interactive transactions.
 */
async function ensureParentFarmerRecord(supabaseClient, verifiedFarmerId, farmerEmail = null, farmerName = null) {
    if (!supabaseClient || typeof supabaseClient.from !== 'function') {
        throw new ParentFarmerSynchronizationError('Supabase client is not available or invalid.');
    }
    if (!verifiedFarmerId) {
        throw new UnauthenticatedPersistenceError('Verified farmer ID is required for parent synchronization.');
    }

    // 1. Mandatory Identity Anchor: Authenticated user must have a verified email
    const normFarmerEmail = farmerEmail ? String(farmerEmail).trim().toLowerCase() : null;
    if (!normFarmerEmail) {
        throw new FarmerIdentityConflictError(
            `Cannot synchronize parent farmer '${verifiedFarmerId}': authenticated user has no verified email address to establish an identity anchor.`
        );
    }

    try {
        const query = supabaseClient.from('farmers');
        if (!query || typeof query.upsert !== 'function' || typeof query.select !== 'function') {
            throw new ParentFarmerSynchronizationError('Supabase farmers table interface is unavailable.');
        }

        // 2. Provisioning via upsert with ignoreDuplicates: true
        // If row does not exist, it inserts this record.
        // If row already exists (or another concurrent request created it), ignoreDuplicates leaves it untouched.
        const farmerRecord = {
            id: verifiedFarmerId,
            email: normFarmerEmail,
            full_name: farmerName ? String(farmerName).trim() : null,
            created_at: new Date().toISOString(),
        };

        const { data: upsertData, error: upsertError } = await query.upsert(
            farmerRecord,
            { onConflict: 'id', ignoreDuplicates: true }
        );

        if (upsertError) {
            throw new ParentFarmerSynchronizationError(
                `Database error while provisioning parent farmer '${verifiedFarmerId}': ${upsertError.message || JSON.stringify(upsertError)}`,
                upsertError
            );
        }

        // 3. Mandatory Post-Upsert Verification Re-Read
        // Re-read authoritative row from public.farmers to verify ownership and identity.
        const { data: verifyRows, error: verifyError } = await query
            .select('id, email, full_name')
            .eq('id', verifiedFarmerId)
            .limit(1);

        if (verifyError) {
            throw new ParentFarmerSynchronizationError(
                `Database error during post-upsert verification of parent farmer '${verifiedFarmerId}': ${verifyError.message || JSON.stringify(verifyError)}`,
                verifyError
            );
        }

        if (!verifyRows || verifyRows.length === 0) {
            throw new ParentFarmerSynchronizationError(
                `Post-upsert verification failed: parent farmer row '${verifiedFarmerId}' not found after provisioning.`
            );
        }

        const verifiedRow = verifyRows[0];
        const normVerifiedEmail = verifiedRow.email ? String(verifiedRow.email).trim().toLowerCase() : null;

        // 4. Verification Check: Reject existing row with null email (unverifiable identity)
        if (!normVerifiedEmail) {
            throw new FarmerIdentityConflictError(
                `Parent farmer identity unverifiable: Supabase farmer '${verifiedFarmerId}' has null email and cannot be verified against authenticated user '${normFarmerEmail}'.`
            );
        }

        // 5. Verification Check: Reject identity collision / race conflict
        if (normVerifiedEmail !== normFarmerEmail) {
            throw new FarmerIdentityConflictError(
                `Parent farmer identity collision: ID '${verifiedFarmerId}' is bound to email '${verifiedRow.email}', which conflicts with authenticated user '${normFarmerEmail}'.`
            );
        }

        return verifiedRow;
    } catch (err) {
        if (err instanceof FarmerIdentityError || err instanceof UnauthenticatedPersistenceError) {
            throw err;
        }
        throw new ParentFarmerSynchronizationError(
            `Database exception while synchronizing parent farmer '${verifiedFarmerId}': ${err.message}`,
            err
        );
    }
}

/**
 * Unpacks relational fast-path fields and validates types from request and engine output.
 */
function buildPersistenceRecord({
    verifiedFarmerId,
    idempotencyKey,
    requestPayload,
    engineResult,
    executionTimeMs = null,
}) {
    if (!verifiedFarmerId || typeof verifiedFarmerId !== 'string') {
        throw new UnauthenticatedPersistenceError();
    }
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        throw new Error('Valid idempotencyKey string is required for V2 persistence.');
    }
    if (!engineResult || typeof engineResult !== 'object') {
        throw new Error('Valid engineResult object is required for V2 persistence.');
    }

    const requestHash = computeRequestHash(requestPayload);

    // Extract status and top recommendation safely
    const status = engineResult.status;
    const recommendations = Array.isArray(engineResult.recommendations) ? engineResult.recommendations : [];
    const topRec = status === 'SUCCESS' && recommendations.length > 0 ? recommendations[0] : null;

    // Helper to safely extract edaphic / climatic values
    const ed = requestPayload.edaphic || {};
    const cw = requestPayload.climate_and_water || {};
    const loc = requestPayload.location || {};
    const temp = requestPayload.temporal || {};

    const topCropVal = topRec ? (topRec.crop || topRec.name || null) : null;
    const topScoreVal = topRec ? (typeof topRec.suitability_score === 'number' ? topRec.suitability_score : null) : null;
    const topTierVal = topRec ? (topRec.confidence_tier || null) : null;
    const seasonalRainfallVal = cw.seasonal_rainfall_amount !== undefined
        ? cw.seasonal_rainfall_amount
        : (requestPayload.seasonal_rainfall_amount ?? requestPayload.seasonal_rainfall_mm ?? null);
    const irrigationWaterVal = cw.irrigation_water_quantity_mm !== undefined
        ? cw.irrigation_water_quantity_mm
        : (requestPayload.irrigation_water_quantity_mm ?? requestPayload.irrigation_depth_mm ?? null);

    const sowingMonthVal = temp.sowing_month !== undefined && temp.sowing_month !== null
        ? temp.sowing_month
        : (requestPayload.sowing_month !== undefined && requestPayload.sowing_month !== null ? requestPayload.sowing_month : null);

    return {
        farmer_id: verifiedFarmerId,
        idempotency_key: idempotencyKey,
        request_hash: requestHash,

        engine_version: engineResult.engine_version || 'v2.0.0',
        api_version: 'v2',
        engine_status: status,
        execution_time_ms: executionTimeMs,

        // Relational search & indexing columns (no fabricated defaults)
        state: loc.state || requestPayload.state || null,
        district: loc.district || requestPayload.district || null,
        sowing_month: sowingMonthVal,
        season: temp.season || requestPayload.season || null,
        irrigation_access: cw.irrigation_access || requestPayload.irrigation_access || null,

        has_soil_test: typeof ed.has_soil_test === 'boolean'
            ? ed.has_soil_test
            : (typeof requestPayload.has_soil_test === 'boolean' ? requestPayload.has_soil_test : null),
        soil_test_declaration_status: requestPayload.soil_test_declaration_status || null,

        // Status-gated metrics (strictly NULL if status is not SUCCESS)
        // Dual-aliased to guarantee schema compatibility
        top_crop: topCropVal,
        recommended_crop: topCropVal,
        top_suitability_score: topScoreVal,
        suitability_score: topScoreVal,
        top_confidence_tier: topTierVal,
        dci_confidence: topTierVal,

        // Measured inputs with finite validation
        seasonal_rainfall_amount: seasonalRainfallVal,
        seasonal_rainfall_mm: seasonalRainfallVal,
        annual_rainfall: cw.annual_rainfall !== undefined ? cw.annual_rainfall : (requestPayload.annual_rainfall ?? null),
        temperature: cw.temperature_mean !== undefined ? cw.temperature_mean : (requestPayload.temperature ?? null),
        humidity: cw.relative_humidity !== undefined ? cw.relative_humidity : (requestPayload.humidity ?? null),
        temperature_min_night: cw.temperature_min_night !== undefined ? cw.temperature_min_night : (requestPayload.temperature_min_night ?? null),
        temperature_max_day: cw.temperature_max_day !== undefined ? cw.temperature_max_day : (requestPayload.temperature_max_day ?? null),
        irrigation_depth_mm: irrigationWaterVal,
        irrigation_water_quantity_mm: irrigationWaterVal,
        irrigation_period_days: cw.irrigation_period_days !== undefined ? cw.irrigation_period_days : (requestPayload.irrigation_period_days ?? null),
        soil_texture: ed.soil_texture || requestPayload.soil_texture || null,
        soil_ph: ed.soil_ph !== undefined ? ed.soil_ph : (requestPayload.ph ?? requestPayload.soil_ph ?? null),
        nitrogen: ed.soil_nitrogen !== undefined ? ed.soil_nitrogen : (requestPayload.nitrogen ?? null),
        phosphorus: ed.soil_phosphorus !== undefined ? ed.soil_phosphorus : (requestPayload.phosphorus ?? null),
        potassium: ed.soil_potassium !== undefined ? ed.soil_potassium : (requestPayload.potassium ?? null),
        organic_carbon: ed.organic_carbon !== undefined ? ed.organic_carbon : (requestPayload.organic_carbon ?? null),
        nutrient_basis: ed.nutrient_basis || requestPayload.nutrient_basis || null,

        // Verbatim lossless JSONB documents
        request_payload: requestPayload,
        response_payload: engineResult,
        input_provenance: engineResult.provenance || requestPayload.input_provenance || {},
        recommendations: recommendations,
        excluded_candidates: Array.isArray(engineResult.excluded_candidates) ? engineResult.excluded_candidates : [],
        diagnostics: engineResult.diagnostics || engineResult.water_assessment || {},
    };
}

/**
 * Persists recommendation record to Supabase with strict idempotency and concurrency guards.
 *
 * @param {Object} options
 * @param {string} options.verifiedFarmerId - Authenticated farmer ID from verified token
 * @param {string} [options.farmerEmail] - Authenticated user email for foreign-key synchronization
 * @param {string} [options.farmerName] - Authenticated user full name
 * @param {string} options.idempotencyKey - Client UUID idempotency key
 * @param {Object} options.requestPayload - Original validated input body
 * @param {Object} options.engineResult - Trusted result directly from recommendation engine
 * @param {number} [options.executionTimeMs] - Engine execution duration
 * @param {Object} options.supabaseClient - Server-side Supabase client instance
 * @returns {Promise<{ isReplay: boolean, record: Object }>}
 */
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

    // 0. Ensure parent farmer row exists in public.farmers so foreign key constraints succeed
    await ensureParentFarmerRecord(supabaseClient, verifiedFarmerId, farmerEmail, farmerName);

    const recordToInsert = buildPersistenceRecord({
        verifiedFarmerId,
        idempotencyKey,
        requestPayload,
        engineResult,
        executionTimeMs,
    });

    const requestHash = recordToInsert.request_hash;

    // 1. Query for existing record with same (farmer_id, idempotency_key)
    const { data: existingRecords, error: selectError } = await supabaseClient
        .from('v2_crop_recommendations')
        .select('*')
        .eq('farmer_id', verifiedFarmerId)
        .eq('idempotency_key', idempotencyKey)
        .limit(1);

    if (selectError) {
        throw new Error(`Database error during idempotency check: ${selectError.message}`);
    }

    if (existingRecords && existingRecords.length > 0) {
        const existing = existingRecords[0];
        if (existing.request_hash === requestHash) {
            // Idempotent replay: return existing record without modification
            return {
                isReplay: true,
                record: existing,
            };
        } else {
            // Key collision / parameter mutation: reject with 409
            throw new IdempotencyConflictError();
        }
    }

    // 2. Insert new record
    const { data: insertedRecords, error: insertError } = await supabaseClient
        .from('v2_crop_recommendations')
        .insert(recordToInsert)
        .select('*');

    if (insertError) {
        // Handle PostgreSQL unique_violation (code 23505) from concurrent race
        if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
            // Fetch winning record from concurrent transaction
            const { data: winningRows, error: fetchWinError } = await supabaseClient
                .from('v2_crop_recommendations')
                .select('*')
                .eq('farmer_id', verifiedFarmerId)
                .eq('idempotency_key', idempotencyKey)
                .limit(1);

            if (!fetchWinError && winningRows && winningRows.length > 0) {
                const winning = winningRows[0];
                if (winning.request_hash === requestHash) {
                    return {
                        isReplay: true,
                        record: winning,
                    };
                }
                throw new IdempotencyConflictError();
            }
        }
        throw new Error(`Database insertion failed: ${insertError.message}`);
    }

    return {
        isReplay: false,
        record: insertedRecords ? insertedRecords[0] : recordToInsert,
    };
}

/**
 * Checks whether an idempotent record already exists for the verified farmer.
 * Returns { isReplay: true, record } on matching hash.
 * Throws IdempotencyConflictError on conflicting hash.
 * Returns null if no record found.
 */
async function checkCachedRecommendation({
    verifiedFarmerId,
    idempotencyKey,
    requestPayload,
    supabaseClient,
}) {
    if (!supabaseClient || !verifiedFarmerId || !idempotencyKey) {
        return null;
    }

    const requestHash = computeRequestHash(requestPayload);

    const { data: existingRecords, error: selectError } = await supabaseClient
        .from('v2_crop_recommendations')
        .select('*')
        .eq('farmer_id', verifiedFarmerId)
        .eq('idempotency_key', idempotencyKey)
        .limit(1);

    if (selectError) {
        throw new Error(`Database error during idempotency check: ${selectError.message}`);
    }

    if (existingRecords && existingRecords.length > 0) {
        const existing = existingRecords[0];
        if (existing.request_hash === requestHash) {
            return {
                isReplay: true,
                record: existing,
            };
        } else {
            throw new IdempotencyConflictError();
        }
    }

    return null;
}

module.exports = {
    ensureParentFarmerRecord,
    checkCachedRecommendation,
    persistRecommendation,
    buildPersistenceRecord,
    computeRequestHash,
    resolveVerifiedFarmerIdentity,
    IdempotencyConflictError,
    UnauthenticatedPersistenceError,
    FarmerIdentityError,
    AmbiguousFarmerIdentityError,
    UnknownFarmerIdentityError,
    UnmappedProviderIdentityError,
    ParentFarmerSynchronizationError,
    FarmerIdentityConflictError,
};
