/**
 * FieldWise Phase 3A.2: Backend-Mediated V1 Persistence Service
 * ==============================================================
 * Provides secure server-side persistence for V1 operations:
 *   - Farmer profile sync and retrieval (public.farmers)
 *   - Farm profile upsert and retrieval (public.farm_profiles)
 *   - Legacy crop prediction ledger insert and history (public.crop_predictions)
 *
 * Security Invariants:
 *   1. Identity Ownership: The farmer ID is derived exclusively from the verified
 *      server-side authentication token (req.user). Caller-supplied IDs in body/params
 *      are never trusted.
 *   2. Zero-Trust Access: All database interactions utilize the backend Supabase
 *      client with service_role privileges. Table grants to anon/authenticated remain revoked.
 *   3. Foreign Key Integrity: Parent farmer records are automatically verified and
 *      anchored before inserting child records (farm_profiles, crop_predictions).
 *   4. Fail-Fast Error Reporting: Cloud persistence failures return explicit error
 *      responses. Never silently report a cloud save as successful.
 */

const { getSupabaseClient } = require('../../config/supabaseClient');
const {
    ensureParentFarmerRecord,
    resolveVerifiedFarmerIdentity,
    FarmerIdentityError,
    UnauthenticatedPersistenceError,
} = require('../v2/recommendationPersistenceService');

function safeNumeric(val) {
    if (val === undefined || val === null || val === '') return null;
    const num = Number(val);
    return Number.isFinite(num) ? num : null;
}

class V1PersistenceService {
    constructor(clientGetter = getSupabaseClient) {
        this.getClient = clientGetter;
    }

    _getClient() {
        const client = this.getClient();
        if (!client || typeof client.from !== 'function') {
            throw new Error('Supabase database client is not configured or unavailable on the server.');
        }
        return client;
    }

    /**
     * Synchronizes a farmer identity record into public.farmers.
     */
    async syncFarmer(userAuth, farmerData = {}) {
        const verifiedFarmerId = resolveVerifiedFarmerIdentity(userAuth);
        if (!verifiedFarmerId) {
            throw new UnauthenticatedPersistenceError('Verified farmer authentication is required.');
        }

        const client = this._getClient();
        const email = userAuth.email || farmerData.email;
        const fullName = farmerData.full_name || farmerData.name || userAuth.name || userAuth.full_name || 'Farmer Partner';

        // Anchor parent farmer record
        await ensureParentFarmerRecord(client, verifiedFarmerId, email, fullName);

        // Update optional profile details if provided
        const updatePayload = {
            full_name: fullName,
        };
        if (farmerData.phone !== undefined) updatePayload.phone = farmerData.phone;
        if (farmerData.location !== undefined) updatePayload.location = farmerData.location;
        if (farmerData.farm_size !== undefined) updatePayload.farm_size = farmerData.farm_size;

        const { data, error } = await client
            .from('farmers')
            .update(updatePayload)
            .eq('id', verifiedFarmerId)
            .select('*');

        if (error) {
            throw new Error(`Failed to update farmer record: ${error.message}`);
        }

        return data && data.length > 0 ? data[0] : { id: verifiedFarmerId, email, full_name: fullName, ...updatePayload };
    }

    /**
     * Retrieves the authenticated farmer's record from public.farmers.
     */
    async getFarmer(userAuth) {
        const verifiedFarmerId = resolveVerifiedFarmerIdentity(userAuth);
        if (!verifiedFarmerId) {
            throw new UnauthenticatedPersistenceError('Verified farmer authentication is required.');
        }

        const client = this._getClient();
        const { data, error } = await client
            .from('farmers')
            .select('*')
            .eq('id', verifiedFarmerId)
            .maybeSingle();

        if (error) {
            throw new Error(`Failed to fetch farmer record: ${error.message}`);
        }

        return data || null;
    }

    /**
     * Saves or updates the farm profile for the authenticated farmer in public.farm_profiles.
     */
    async saveFarmProfile(userAuth, profileData = {}) {
        const verifiedFarmerId = resolveVerifiedFarmerIdentity(userAuth);
        if (!verifiedFarmerId) {
            throw new UnauthenticatedPersistenceError('Verified farmer authentication is required.');
        }

        const client = this._getClient();
        const email = userAuth.email || profileData.email;
        const fullName = userAuth.name || userAuth.full_name || profileData.fullName || 'Farmer Partner';

        // 1. Ensure foreign key anchor in public.farmers exists
        await ensureParentFarmerRecord(client, verifiedFarmerId, email, fullName);

        // 2. Prepare normalized farm profile record
        const payload = {
            farmer_id: verifiedFarmerId,
            state: profileData.state || null,
            district: profileData.district || null,
            soil_type: profileData.soil_type || profileData.soilType || null,
            ph: safeNumeric(profileData.ph),
            nitrogen: safeNumeric(profileData.nitrogen),
            phosphorus: safeNumeric(profileData.phosphorus),
            potassium: safeNumeric(profileData.potassium),
            rainfall: safeNumeric(profileData.rainfall),
            irrigation_type: profileData.irrigation_type || profileData.irrigationType || null,
            village_name: profileData.village_name || profileData.village || null,
            farm_name: profileData.farm_name || profileData.farmName || null,
            current_crops: profileData.current_crops || profileData.currentCrops || null,
            previous_crops: profileData.previous_crops || profileData.previousCrops || null,
            agro_climatic_zone: profileData.agro_climatic_zone || profileData.agroZone || null,
            updated_at: new Date().toISOString(),
        };

        // 3. Upsert: Check if row exists for this farmer
        const { data: existingRows, error: checkError } = await client
            .from('farm_profiles')
            .select('id')
            .eq('farmer_id', verifiedFarmerId)
            .limit(1);

        if (checkError) {
            throw new Error(`Failed to verify existing farm profile: ${checkError.message}`);
        }

        let savedData = null;
        if (existingRows && existingRows.length > 0) {
            const { data, error } = await client
                .from('farm_profiles')
                .update(payload)
                .eq('id', existingRows[0].id)
                .select('*');

            if (error) {
                throw new Error(`Failed to update farm profile: ${error.message}`);
            }
            savedData = data && data.length > 0 ? data[0] : payload;
        } else {
            const { data, error } = await client
                .from('farm_profiles')
                .insert(payload)
                .select('*');

            if (error) {
                throw new Error(`Failed to insert farm profile: ${error.message}`);
            }
            savedData = data && data.length > 0 ? data[0] : payload;
        }

        return savedData;
    }

    /**
     * Fetches the latest farm profile for the authenticated farmer.
     */
    async getFarmProfile(userAuth) {
        const verifiedFarmerId = resolveVerifiedFarmerIdentity(userAuth);
        if (!verifiedFarmerId) {
            throw new UnauthenticatedPersistenceError('Verified farmer authentication is required.');
        }

        const client = this._getClient();
        const { data, error } = await client
            .from('farm_profiles')
            .select('*')
            .eq('farmer_id', verifiedFarmerId)
            .order('updated_at', { ascending: false })
            .limit(1);

        if (error) {
            throw new Error(`Failed to fetch farm profile: ${error.message}`);
        }

        return data && data.length > 0 ? data[0] : null;
    }

    /**
     * Saves a V1 crop prediction record to public.crop_predictions.
     */
    async saveCropPrediction(userAuth, predictionData = {}) {
        const verifiedFarmerId = resolveVerifiedFarmerIdentity(userAuth);
        if (!verifiedFarmerId) {
            throw new UnauthenticatedPersistenceError('Verified farmer authentication is required.');
        }

        const recommendedCrop = predictionData.recommended_crop || predictionData.predicted_crop || predictionData.crop;
        if (!recommendedCrop || typeof recommendedCrop !== 'string') {
            throw new Error('Mandatory field recommended_crop is missing or invalid.');
        }

        const client = this._getClient();
        const email = userAuth.email;
        const fullName = userAuth.name || userAuth.full_name;

        // Ensure parent farmer exists
        await ensureParentFarmerRecord(client, verifiedFarmerId, email, fullName);

        const payload = {
            farmer_id: verifiedFarmerId,
            recommended_crop: String(recommendedCrop).trim(),
            confidence: predictionData.confidence ? String(predictionData.confidence).trim() : '95%',
            nitrogen: safeNumeric(predictionData.nitrogen),
            phosphorus: safeNumeric(predictionData.phosphorus),
            potassium: safeNumeric(predictionData.potassium),
            ph: safeNumeric(predictionData.ph),
            rainfall: safeNumeric(predictionData.rainfall),
            temperature: safeNumeric(predictionData.temperature),
            humidity: safeNumeric(predictionData.humidity),
            created_at: new Date().toISOString(),
        };

        const { data, error } = await client
            .from('crop_predictions')
            .insert(payload)
            .select('*');

        if (error) {
            throw new Error(`Failed to persist crop prediction: ${error.message}`);
        }

        return data && data.length > 0 ? data[0] : payload;
    }

    /**
     * Fetches historical crop predictions for the authenticated farmer.
     */
    async getCropPredictionHistory(userAuth, limit = 20) {
        const verifiedFarmerId = resolveVerifiedFarmerIdentity(userAuth);
        if (!verifiedFarmerId) {
            throw new UnauthenticatedPersistenceError('Verified farmer authentication is required.');
        }

        const client = this._getClient();
        const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));

        const { data, error } = await client
            .from('crop_predictions')
            .select('*')
            .eq('farmer_id', verifiedFarmerId)
            .order('created_at', { ascending: false })
            .limit(boundedLimit);

        if (error) {
            throw new Error(`Failed to fetch prediction history: ${error.message}`);
        }

        return data || [];
    }
}

const v1PersistenceService = new V1PersistenceService();

module.exports = {
    V1PersistenceService,
    v1PersistenceService,
};
