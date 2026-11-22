import { createClient } from '@supabase/supabase-js';

// Environment Isolation:
// In staging and production, explicit configuration is mandatory.
// Silent fallback to development Supabase instance is strictly prohibited.
const isProdOrStaging = Boolean(
  import.meta.env.PROD ||
  import.meta.env.MODE === 'production' ||
  import.meta.env.MODE === 'staging'
);

const DEV_FALLBACK_URL = 'https://fweunjznkrscuwandfsy.supabase.co';
const DEV_FALLBACK_ANON_KEY = 'sb_publishable_1KlghiB6d-skyTukC2cmFg_Errl9CTC';

let rawUrl = import.meta.env.VITE_SUPABASE_URL;
let rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (isProdOrStaging) {
  if (!rawUrl || !rawKey || rawKey.includes('placeholder')) {
    console.error('CRITICAL: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured in staging/production. Silent fallback to dev database is blocked.');
    rawUrl = '';
    rawKey = '';
  }
} else {
  // Local development fallback
  rawUrl = rawUrl || DEV_FALLBACK_URL;
  rawKey = rawKey || DEV_FALLBACK_ANON_KEY;
}

export const supabaseUrl = rawUrl || '';
export const supabaseAnonKey = rawKey || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseAnonKey.includes('placeholder')
);

// Initialize Supabase client safely
export const supabase = createClient(
  supabaseUrl || 'https://unconfigured.supabase.co',
  supabaseAnonKey || 'unconfigured-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// Backend API URL for authenticated persistence mediation
const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

// Helper to retrieve active backend JWT token from authentication stores
export function getAuthToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('fieldwise_auth_token') ||
         localStorage.getItem('croppredict_token') ||
         localStorage.getItem('token') ||
         null;
}

// Helper to get active farmer ID reliably from localStorage
export function getActiveFarmerId(): string {
  if (typeof localStorage === 'undefined') return 'farmer_main';
  try {
    const rawLanding = localStorage.getItem('fieldwise_active_user');
    if (rawLanding) {
      const parsed = JSON.parse(rawLanding);
      if (parsed?.uid || parsed?.id) return String(parsed.uid || parsed.id);
    }
    const rawLocal = localStorage.getItem('fieldwise_current_user');
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (parsed?.id) return String(parsed.id);
    }
  } catch {}
  return 'farmer_main';
}

// ── Supabase Database Interfaces ─────────────────────────────────────────────
export interface DbFarmer {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  location?: string;
  farm_size?: string;
  created_at?: string;
}

export interface DbFarmProfile {
  id?: string;
  farmer_id: string;
  state?: string;
  district?: string;
  soil_type?: string;
  ph?: number | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  rainfall?: number | null;
  irrigation_type?: string;
  village_name?: string | null;
  farm_name?: string | null;
  current_crops?: string | null;
  previous_crops?: string | null;
  agro_climatic_zone?: string | null;
  updated_at?: string;
}

export interface DbCropPrediction {
  id?: string;
  farmer_id?: string;
  recommended_crop: string;
  confidence?: string;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  ph?: number | null;
  rainfall?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  created_at?: string;
}

// Helper to parse numeric safely for PostgreSQL numeric columns
function safeNumeric(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

// ── Supabase Helper Functions ─────────────────────────────────────────────────

/**
 * Ensures parent farmer row exists in public.farmers so foreign key constraints never fail.
 */
export async function ensureParentFarmerExists(farmerId: string, email?: string, name?: string): Promise<void> {
  if (!isSupabaseConfigured || !farmerId || farmerId === 'farmer_main') return;
  try {
    const { error } = await supabase
      .from('farmers')
      .upsert({
        id: farmerId,
        email: email || `${farmerId}@fieldwise.agri`,
        full_name: name || 'Farmer Partner',
        location: 'Gujarat, India',
        created_at: new Date().toISOString()
      }, { onConflict: 'id', ignoreDuplicates: true });

    if (error) {
      console.warn('[Supabase] ensureParentFarmer error:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase] ensureParentFarmer exception:', err?.message || err);
  }
}

/**
 * Upserts a farmer record in Supabase.
 */
export async function syncFarmerToSupabase(farmer: DbFarmer): Promise<{ success: boolean; error?: string }> {
  const token = getAuthToken();
  if (token && typeof fetch !== 'undefined') {
    try {
      const res = await fetch(`${API_URL}/api/farmer/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(farmer)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          console.log('✅ [Backend-Mediation] Synced farmer via backend:', farmer.id);
          return { success: true };
        }
      }
      const errJson = await res.json().catch(() => ({}));
      console.warn('[Backend-Mediation] syncFarmer error:', errJson.message || res.statusText);
      return { success: false, error: errJson.message || `Backend sync failed (${res.status})` };
    } catch (networkErr: any) {
      console.warn('[Backend-Mediation] Network error reaching backend, attempting direct fallback:', networkErr.message);
    }
  }

  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
  try {
    const { error } = await supabase
      .from('farmers')
      .upsert({
        id: farmer.id,
        email: farmer.email || `${farmer.id}@fieldwise.agri`,
        full_name: farmer.full_name || 'Farmer Partner',
        phone: farmer.phone || '',
        location: farmer.location || '',
        farm_size: farmer.farm_size || '',
        created_at: farmer.created_at || new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      console.warn('[Supabase] syncFarmer error:', error.message);
      return { success: false, error: error.message };
    }
    console.log('✅ [Supabase] Synced farmer to Supabase:', farmer.id);
    return { success: true };
  } catch (err: any) {
    console.warn('[Supabase] syncFarmer exception:', err?.message || err);
    return { success: false, error: err?.message };
  }
}

/**
 * Saves a farm profile (soil, conditions, location) to Supabase without relying on onConflict constraints.
 */
export async function syncFarmProfileToSupabase(profile: DbFarmProfile): Promise<{ success: boolean; error?: string }> {
  const token = getAuthToken();
  if (token && typeof fetch !== 'undefined') {
    try {
      const res = await fetch(`${API_URL}/api/farm-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          console.log('✅ [Backend-Mediation] Synced farm profile via backend for farmer:', profile.farmer_id);
          return { success: true };
        }
      }
      const errJson = await res.json().catch(() => ({}));
      console.warn('[Backend-Mediation] syncFarmProfile error:', errJson.message || res.statusText);
      return { success: false, error: errJson.message || `Backend sync failed (${res.status})` };
    } catch (networkErr: any) {
      console.warn('[Backend-Mediation] Network error reaching backend, attempting direct fallback:', networkErr.message);
    }
  }

  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
  try {
    const farmerId = profile.farmer_id || getActiveFarmerId();
    await ensureParentFarmerExists(farmerId);

    const payload = {
      farmer_id: farmerId,
      state: profile.state || null,
      district: profile.district || null,
      soil_type: profile.soil_type || 'Loamy',
      ph: safeNumeric(profile.ph),
      nitrogen: safeNumeric(profile.nitrogen),
      phosphorus: safeNumeric(profile.phosphorus),
      potassium: safeNumeric(profile.potassium),
      rainfall: safeNumeric(profile.rainfall),
      irrigation_type: profile.irrigation_type || null,
      village_name: profile.village_name !== undefined ? (profile.village_name || null) : null,
      farm_name: profile.farm_name !== undefined ? (profile.farm_name || null) : null,
      current_crops: profile.current_crops !== undefined ? (profile.current_crops || null) : null,
      previous_crops: profile.previous_crops !== undefined ? (profile.previous_crops || null) : null,
      agro_climatic_zone: profile.agro_climatic_zone !== undefined ? (profile.agro_climatic_zone || null) : null,
      updated_at: new Date().toISOString()
    };

    // Check if row already exists for this farmer to avoid onConflict constraint requirements
    const { data: existingRows } = await supabase
      .from('farm_profiles')
      .select('id')
      .eq('farmer_id', farmerId)
      .limit(1);

    let opError = null;
    if (existingRows && existingRows.length > 0) {
      const { error } = await supabase
        .from('farm_profiles')
        .update(payload)
        .eq('id', existingRows[0].id);
      opError = error;
    } else {
      const { error } = await supabase
        .from('farm_profiles')
        .insert(payload);
      opError = error;
    }

    if (opError) {
      console.warn('[Supabase] syncFarmProfile error:', opError.message);
      return { success: false, error: opError.message };
    }
    console.log('✅ [Supabase] Synced farm profile to Supabase for farmer:', farmerId);
    return { success: true };
  } catch (err: any) {
    console.warn('[Supabase] syncFarmProfile exception:', err?.message || err);
    return { success: false, error: err?.message };
  }
}

/**
 * Fetches farmer row from public.farmers by farmerId.
 */
export async function fetchFarmerFromSupabase(farmerId: string): Promise<DbFarmer | null> {
  if (!farmerId || farmerId === 'farmer_main') return null;
  const token = getAuthToken();
  if (token && typeof fetch !== 'undefined') {
    try {
      const res = await fetch(`${API_URL}/api/farmer/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.farmer) {
          return json.farmer as DbFarmer;
        }
      }
    } catch (networkErr: any) {
      console.warn('[Backend-Mediation] Network error fetching farmer, attempting fallback:', networkErr.message);
    }
  }

  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('farmers')
      .select('*')
      .eq('id', farmerId)
      .maybeSingle();

    if (error) {
      console.warn('[Supabase] fetchFarmer error:', error.message);
      throw new Error(error.message);
    }
    return data as DbFarmer | null;
  } catch (err: any) {
    console.warn('[Supabase] fetchFarmer exception:', err?.message || err);
    throw err;
  }
}

/**
 * Fetches the latest farm profile for a farmer from public.farm_profiles.
 */
export async function fetchFarmProfileFromSupabase(farmerId: string): Promise<DbFarmProfile | null> {
  if (!farmerId || farmerId === 'farmer_main') return null;
  const token = getAuthToken();
  if (token && typeof fetch !== 'undefined') {
    try {
      const res = await fetch(`${API_URL}/api/farm-profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.profile) {
          return json.profile as DbFarmProfile;
        }
      }
    } catch (networkErr: any) {
      console.warn('[Backend-Mediation] Network error fetching farm profile, attempting fallback:', networkErr.message);
    }
  }

  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('farm_profiles')
      .select('*')
      .eq('farmer_id', farmerId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('[Supabase] fetchFarmProfile error:', error.message);
      throw new Error(error.message);
    }
    if (data && data.length > 0) {
      return data[0] as DbFarmProfile;
    }
    return null;
  } catch (err: any) {
    console.warn('[Supabase] fetchFarmProfile exception:', err?.message || err);
    throw err;
  }
}

/**
 * Fetches the latest crop prediction for a farmer from public.crop_predictions.
 */
export async function fetchLatestPredictionFromSupabase(farmerId: string): Promise<DbCropPrediction | null> {
  if (!farmerId || farmerId === 'farmer_main') return null;
  const token = getAuthToken();
  if (token && typeof fetch !== 'undefined') {
    try {
      const res = await fetch(`${API_URL}/api/predict/history?limit=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.history && json.history.length > 0) {
          return json.history[0] as DbCropPrediction;
        }
      }
    } catch (networkErr: any) {
      console.warn('[Backend-Mediation] Network error fetching latest prediction, attempting fallback:', networkErr.message);
    }
  }

  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('crop_predictions')
      .select('*')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('[Supabase] fetchLatestPrediction error:', error.message);
      throw new Error(error.message);
    }
    if (data && data.length > 0) {
      return data[0] as DbCropPrediction;
    }
    return null;
  } catch (err: any) {
    console.warn('[Supabase] fetchLatestPrediction exception:', err?.message || err);
    throw err;
  }
}

/**
 * Saves a crop prediction to Supabase history.
 */
export async function savePredictionToSupabase(prediction: DbCropPrediction): Promise<{ success: boolean; error?: string }> {
  const token = getAuthToken();
  if (token && typeof fetch !== 'undefined') {
    try {
      const res = await fetch(`${API_URL}/api/predict/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(prediction)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          console.log('✅ [Backend-Mediation] Saved crop prediction via backend:', prediction.recommended_crop);
          return { success: true };
        }
      }
      const errJson = await res.json().catch(() => ({}));
      console.warn('[Backend-Mediation] savePrediction error:', errJson.message || res.statusText);
      return { success: false, error: errJson.message || `Backend save failed (${res.status})` };
    } catch (networkErr: any) {
      console.warn('[Backend-Mediation] Network error saving prediction, attempting fallback:', networkErr.message);
    }
  }

  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
  try {
    const farmerId = prediction.farmer_id || getActiveFarmerId();
    await ensureParentFarmerExists(farmerId);

    const payload = {
      farmer_id: farmerId,
      recommended_crop: prediction.recommended_crop,
      confidence: prediction.confidence || '95%',
      nitrogen: safeNumeric(prediction.nitrogen),
      phosphorus: safeNumeric(prediction.phosphorus),
      potassium: safeNumeric(prediction.potassium),
      ph: safeNumeric(prediction.ph),
      rainfall: safeNumeric(prediction.rainfall),
      temperature: safeNumeric(prediction.temperature),
      humidity: safeNumeric(prediction.humidity),
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('crop_predictions')
      .insert(payload);

    if (error) {
      console.warn('[Supabase] savePrediction error:', error.message);
      return { success: false, error: error.message };
    }
    console.log('✅ [Supabase] Saved crop prediction to Supabase:', prediction.recommended_crop);
    return { success: true };
  } catch (err: any) {
    console.warn('[Supabase] savePrediction exception:', err?.message || err);
    return { success: false, error: err?.message };
  }
}

/**
 * Automatically syncs current farmer profile and any existing prediction to Supabase immediately.
 */
export async function syncCurrentStateToSupabase(farmerUser?: any, farmProfile?: any): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const farmerId = farmerUser?.id || getActiveFarmerId();
    
    // 1. Sync farmer
    await syncFarmerToSupabase({
      id: farmerId,
      email: farmerUser?.email || `${farmerId}@fieldwise.agri`,
      full_name: farmerUser?.full_name || farmerUser?.name || 'Farmer Partner',
      phone: farmerUser?.phone || '',
      location: farmerUser?.location || '',
      farm_size: farmerUser?.farm_size || ''
    });

    // 2. Sync farm profile ONLY if explicitly saved and contains meaningful configured soil data
    const isProfileMeaningful = Boolean(
      farmProfile &&
      farmProfile.isSaved &&
      farmProfile.soil?.soilType &&
      farmProfile.soil.soilType.trim() !== ''
    );

    if (isProfileMeaningful) {
      await syncFarmProfileToSupabase({
        farmer_id: farmerId,
        state: farmProfile.farmer?.state,
        district: farmProfile.farmer?.district,
        soil_type: farmProfile.soil?.soilType,
        ph: farmProfile.soil?.ph,
        nitrogen: farmProfile.soil?.nitrogen,
        phosphorus: farmProfile.soil?.phosphorus,
        potassium: farmProfile.soil?.potassium,
        rainfall: farmProfile.conditions?.rainfall,
        irrigation_type: farmProfile.farm?.irrigationType
      });
    }

    // 3. Sync existing cached prediction if present
    if (typeof localStorage !== 'undefined') {
      const cachedPredRaw = localStorage.getItem('cropswild_crop_recommendation_last');
      if (cachedPredRaw) {
        try {
          const cached = JSON.parse(cachedPredRaw);
          const topCrop = cached.topCrop || cached.cropName || (cached.predictions?.[0]?.crop?.name || cached.predictions?.[0]?.crop);
          if (topCrop) {
            await savePredictionToSupabase({
              farmer_id: farmerId,
              recommended_crop: String(topCrop),
              confidence: String(cached.confidence || '95%'),
              nitrogen: safeNumeric(cached.inputs?.nitrogen),
              phosphorus: safeNumeric(cached.inputs?.phosphorus),
              potassium: safeNumeric(cached.inputs?.potassium),
              ph: safeNumeric(cached.inputs?.ph),
              rainfall: safeNumeric(cached.inputs?.rainfall),
              temperature: safeNumeric(cached.inputs?.temperature),
              humidity: safeNumeric(cached.inputs?.humidity)
            });
          }
        } catch {}
      }
    }
  } catch (err: any) {
    console.warn('[Supabase] syncCurrentState error:', err?.message || err);
  }
}
