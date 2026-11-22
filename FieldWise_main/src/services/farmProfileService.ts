// Service to manage complete Farm Profile data
import {
  syncFarmProfileToSupabase,
  syncFarmerToSupabase,
  fetchFarmProfileFromSupabase,
  fetchFarmerFromSupabase,
  getActiveFarmerId,
  isSupabaseConfigured
} from '../lib/supabase';
export interface FarmerInfo {
  fullName: string;
  phone: string;
  email: string;
  state: string;
  district: string;
  village?: string;
  experienceYears: string;
  gender?: string;
  dob?: string;
}

export interface FarmDetails {
  farmName: string;
  farmSize: number;
  farmSizeUnit: 'Acres' | 'Hectares' | 'Bighas';
  farmingMethod: 'Organic' | 'Conventional' | 'Natural / ZBNF' | 'Mixed';
  irrigationType: 'Drip' | 'Sprinkler' | 'Canal' | 'Borewell / Tube-well' | 'Rainfed';
  currentCrops: string;
  previousCrops: string;
}

export interface FarmConditions {
  agroZone: string;
  waterAvailability: 'High' | 'Moderate' | 'Low / Rainfed';
  rainfall: number; // annual average in mm
  temperature: number; // average in °C
  humidity: number; // relative humidity %
  topography: 'Plains / Flatlands' | 'Gentle Slopes' | 'Terraced / Hilly' | 'Plateau';
  sunlightHours: number;
}

export interface SoilInfo {
  soilType: string; // 'Loamy' | 'Alluvial' | 'Black' | 'Red' | 'Laterite' | 'Clay' | 'Sandy Loam' | 'Clay Loam'
  ph: number; // 0 - 14
  nitrogen: number; // kg/ha (0 - 200)
  phosphorus: number; // kg/ha (0 - 150)
  potassium: number; // kg/ha (0 - 200)
  organicCarbon: number; // % (0.1 - 3.0)
  lastTestedDate?: string;
}

export interface CompleteFarmProfile {
  farmer: FarmerInfo;
  farm: FarmDetails;
  conditions: FarmConditions;
  soil: SoilInfo;
  updatedAt: string;
}

const STORAGE_KEY = 'cropswild_farm_profile';
const SAVED_FLAG_KEY = 'fieldwise_profile_saved_flag';

export function getFarmerStorageKey(farmerId?: string): string {
  const cleanId = (farmerId && farmerId.trim()) ? farmerId.trim() : getActiveFarmerId();
  return `cropswild_farm_profile_${cleanId}`;
}

export const defaultFarmProfile: CompleteFarmProfile = {
  farmer: {
    fullName: 'Farmer Partner',
    phone: '+91 98765 43210',
    email: 'farmer@fieldwise.ai',
    state: 'Punjab',
    district: 'Ludhiana',
    village: 'Samrala',
    experienceYears: '12',
    gender: 'Male',
    dob: '1985-05-15',
  },
  farm: {
    farmName: 'Green Valley Organic Farm',
    farmSize: 15,
    farmSizeUnit: 'Acres',
    farmingMethod: 'Conventional',
    irrigationType: 'Drip',
    currentCrops: 'Wheat, Rice',
    previousCrops: 'Rice, Mustard',
  },
  conditions: {
    agroZone: 'Trans-Gangetic Plains',
    waterAvailability: 'High',
    rainfall: 650,
    temperature: 25,
    humidity: 65,
    topography: 'Plains / Flatlands',
    sunlightHours: 8,
  },
  soil: {
    soilType: 'Loamy',
    ph: 6.8,
    nitrogen: 85,
    phosphorus: 52,
    potassium: 60,
    organicCarbon: 0.75,
    lastTestedDate: '2024-02-10',
  },
  updatedAt: new Date().toISOString(),
};

const KNOWN_INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana",
  "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

function matchIndianState(raw: string): string {
  if (!raw) return 'Biihar';
  const found = KNOWN_INDIAN_STATES.find(s => s.toLowerCase() === raw.trim().toLowerCase());
  return found || raw.trim();
}

class FarmProfileService {
  public isProfileSaved(farmerId?: string): boolean {
    if (typeof localStorage === 'undefined') return false;

    const targetFarmerId = (farmerId && farmerId.trim()) ? farmerId.trim() : undefined;

    // 1. If checking for a specific farmer, check their scoped key
    if (targetFarmerId && targetFarmerId !== 'farmer_main') {
      const scoped = localStorage.getItem(getFarmerStorageKey(targetFarmerId));
      if (scoped) {
        try {
          const parsed = JSON.parse(scoped);
          if (parsed && parsed.isSaved === true) return true;
          if (Boolean(
            parsed &&
            parsed.updatedAt &&
            parsed.soil?.soilType &&
            parsed.soil.soilType.trim() !== ''
          )) return true;
        } catch { }
      }
      return false;
    }

    // 2. Unscoped active profile check
    if (localStorage.getItem(SAVED_FLAG_KEY) === 'true') return true;

    // Check active profile key
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.isSaved === true) return true;
        if (Boolean(
          parsed &&
          parsed.updatedAt &&
          parsed.farm?.farmName &&
          parsed.farm?.farmName !== 'Green Valley Organic Farm' &&
          parsed.farmer?.fullName &&
          parsed.farmer?.fullName !== 'Farmer Partner' &&
          parsed.soil?.soilType &&
          parsed.soil.soilType.trim() !== ''
        )) return true;
      } catch { }
    }

    return false;
  }

  public getFarmProfile(fallbackUser?: any, farmerId?: string): CompleteFarmProfile {
    const targetFarmerId = (farmerId && farmerId.trim()) || fallbackUser?.id || fallbackUser?.uid;
    const isSaved = this.isProfileSaved(targetFarmerId);

    // 1. If profile has been explicitly saved by user, load it
    if (isSaved) {
      try {
        if (typeof localStorage !== 'undefined') {
          // If a specific farmer, check their scoped key first
          if (targetFarmerId && targetFarmerId !== 'farmer_main') {
            const scoped = localStorage.getItem(getFarmerStorageKey(targetFarmerId));
            if (scoped) {
              const parsed = JSON.parse(scoped);
              if (parsed && parsed.farmer && parsed.farm && parsed.conditions && parsed.soil) {
                return parsed;
              }
            }
          }

          // Otherwise try active key
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.farmer && parsed.farm && parsed.conditions && parsed.soil) {
              return parsed;
            }
          }
        }
      } catch (e) {
        console.error('Failed to load farm profile from localStorage', e);
      }
    }

    // 2. Unsaved / configuration mode: initialize clean profile with user's registration data
    // Farm, climate, and soil fields start unconfigured so farmer sees actual real-time progress (0% - 100%)
    const base: CompleteFarmProfile = {
      farmer: {
        fullName: fallbackUser?.full_name || fallbackUser?.username || '',
        phone: fallbackUser?.phone || fallbackUser?.contact_no || '',
        email: fallbackUser?.email || '',
        state: '',
        district: '',
        village: '',
        experienceYears: '',
        gender: '',
        dob: '',
      },
      farm: {
        farmName: '',
        farmSize: 0,
        farmSizeUnit: 'Acres',
        farmingMethod: '' as any,
        irrigationType: '' as any,
        currentCrops: '',
        previousCrops: '',
      },
      conditions: {
        agroZone: '',
        waterAvailability: '' as any,
        rainfall: 0,
        temperature: 0,
        humidity: 0,
        topography: '' as any,
        sunlightHours: 0,
      },
      soil: {
        soilType: '',
        ph: 0,
        nitrogen: 0,
        phosphorus: 0,
        potassium: 0,
        organicCarbon: 0,
        lastTestedDate: '',
      },
      updatedAt: new Date().toISOString(),
    };

    if (fallbackUser) {
      if (fallbackUser.full_name || fallbackUser.username) {
        base.farmer.fullName = fallbackUser.full_name || fallbackUser.username;
      }
      if (fallbackUser.email) {
        base.farmer.email = fallbackUser.email;
      }
      if (fallbackUser.phone || fallbackUser.contact_no) {
        base.farmer.phone = fallbackUser.phone || fallbackUser.contact_no;
      }
      if (fallbackUser.location) {
        const parts = String(fallbackUser.location).split(',').map((s: string) => s.trim()).filter(Boolean);
        if (parts.length >= 3) {
          base.farmer.village = parts[0];
          base.farmer.district = parts[1];
          base.farmer.state = matchIndianState(parts[2]);
        } else if (parts.length === 2) {
          base.farmer.district = parts[0];
          base.farmer.state = matchIndianState(parts[1]);
        } else if (parts.length === 1) {
          base.farmer.district = parts[0];
          base.farmer.state = matchIndianState(parts[0]);
        }
      }
      if (fallbackUser.farm_size) {
        const sizeNum = parseFloat(fallbackUser.farm_size);
        if (!isNaN(sizeNum) && sizeNum > 0) base.farm.farmSize = sizeNum;
      }
    }

    return base;
  }

  public async saveFarmProfile(
    profile: CompleteFarmProfile,
    markAsSaved: boolean = true,
    farmerId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const effectiveFarmerId = (farmerId && farmerId.trim()) ? farmerId.trim() : getActiveFarmerId();
      const isRealUser = Boolean(effectiveFarmerId && effectiveFarmerId !== 'farmer_main');

      const updated: CompleteFarmProfile = {
        ...profile,
        updatedAt: new Date().toISOString(),
      };
      if (markAsSaved) {
        (updated as any).isSaved = true;
      }

      // Sync to Supabase cloud database FIRST if authenticated real farmer
      if (isRealUser && isSupabaseConfigured) {
        try {
          const [profileSyncRes, farmerSyncRes] = await Promise.all([
            syncFarmProfileToSupabase({
              farmer_id: effectiveFarmerId,
              state: updated.farmer?.state,
              district: updated.farmer?.district,
              village_name: updated.farmer?.village,
              farm_name: updated.farm?.farmName,
              current_crops: updated.farm?.currentCrops,
              previous_crops: updated.farm?.previousCrops,
              agro_climatic_zone: updated.conditions?.agroZone,
              soil_type: updated.soil?.soilType,
              ph: Number(updated.soil?.ph) || undefined,
              nitrogen: Number(updated.soil?.nitrogen) || undefined,
              phosphorus: Number(updated.soil?.phosphorus) || undefined,
              potassium: Number(updated.soil?.potassium) || undefined,
              rainfall: Number(updated.conditions?.rainfall) || undefined,
              irrigation_type: updated.farm?.irrigationType
            }),
            syncFarmerToSupabase({
              id: effectiveFarmerId,
              email: updated.farmer?.email || `${effectiveFarmerId}@fieldwise.agri`,
              full_name: updated.farmer?.fullName || 'Farmer Partner',
              phone: updated.farmer?.phone || '',
              location: `${updated.farmer?.district || ''}, ${updated.farmer?.state || ''}`.trim(),
              farm_size: updated.farm?.farmSize ? `${updated.farm.farmSize} ${updated.farm.farmSizeUnit || 'Acres'}` : undefined
            })
          ]);

          if (!profileSyncRes.success) {
            console.error('[FarmProfileService] Supabase profile sync failed:', profileSyncRes.error);
            return { success: false, error: profileSyncRes.error || 'Failed to persist farm profile to cloud database' };
          }
        } catch (syncErr: any) {
          console.error('[FarmProfileService] Supabase sync exception:', syncErr);
          return { success: false, error: syncErr?.message || 'Failed to connect to cloud database' };
        }
      }

      // Update local storage ONLY after cloud persistence succeeds (or in offline/demo mode)
      if (typeof localStorage !== 'undefined') {
        if (markAsSaved) {
          localStorage.setItem(SAVED_FLAG_KEY, 'true');
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        if (isRealUser) {
          localStorage.setItem(getFarmerStorageKey(effectiveFarmerId), JSON.stringify(updated));
        }
      }

      // Dispatch custom event for reactive dashboard updates across components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fieldwise:profile_updated', { detail: updated }));
        window.dispatchEvent(new CustomEvent('farmiq:profile_updated', { detail: updated }));
      }

      return { success: true };
    } catch (e: any) {
      console.error('Failed to save farm profile to localStorage', e);
      return { success: false, error: e?.message || 'Failed to save farm profile' };
    }
  }

  /**
   * Authoritatively restores a farmer's farm profile from Supabase on login.
   * If offline or no DB record exists, falls back to the farmer-scoped local cache.
   * Prevents destructive blind overwrites of existing cloud data.
   */
  public async loadAndRestoreProfile(user: any): Promise<{
    profile: CompleteFarmProfile;
    fromDatabase: boolean;
    error?: string;
    conflicts?: Record<string, { cloud: any; local: any }>;
  }> {
    const farmerId = user?.id || user?.uid || (typeof user === 'string' ? user : undefined);
    if (!farmerId || farmerId === 'farmer_main') {
      const fallback = this.getFarmProfile(user);
      return { profile: fallback, fromDatabase: false };
    }

    const activeAtStart = getActiveFarmerId();
    const isIdentityStale = (): boolean => {
      const current = getActiveFarmerId();
      if (activeAtStart !== 'farmer_main' && current !== activeAtStart) return true;
      if (current !== 'farmer_main' && current !== farmerId) return true;
      return false;
    };

    const scopedKey = getFarmerStorageKey(farmerId);
    let localAux: any = {};
    let isVerifiedOwnerCache = false;

    // Check farmer-scoped storage first
    try {
      const rawScoped = typeof localStorage !== 'undefined' ? localStorage.getItem(scopedKey) : null;
      if (rawScoped) {
        localAux = JSON.parse(rawScoped);
        isVerifiedOwnerCache = true;
      }
    } catch {}

    // If scoped storage is empty, inspect legacy global cache for Safari migration
    if (!isVerifiedOwnerCache && typeof localStorage !== 'undefined') {
      try {
        const rawGlobal = localStorage.getItem(STORAGE_KEY);
        if (rawGlobal) {
          const parsed = JSON.parse(rawGlobal);
          const cacheEmail = parsed?.farmer?.email;
          const cachePhone = parsed?.farmer?.phone;
          const userEmail = user?.email;
          const userPhone = user?.phone || user?.contact_no;

          // STRICT OWNERSHIP VERIFICATION:
          // Never migrate untagged cache. Only migrate if cache explicitly matches user's UID, email, or phone.
          const isOwner = Boolean(
            (parsed?.farmerId && parsed.farmerId === farmerId) ||
            (parsed?.id && parsed.id === farmerId) ||
            (cacheEmail && userEmail && cacheEmail.toLowerCase().trim() === userEmail.toLowerCase().trim()) ||
            (cachePhone && userPhone && cachePhone.trim() === userPhone.trim())
          );

          if (isOwner) {
            localAux = parsed;
            isVerifiedOwnerCache = true;
          }
        }
      } catch {}
    }

    // 1. If Supabase is configured, fetch authoritative remote record
    if (isSupabaseConfigured) {
      try {
        const [dbProfile, dbFarmer] = await Promise.all([
          fetchFarmProfileFromSupabase(farmerId),
          fetchFarmerFromSupabase(farmerId)
        ]);

        // Identity safety check: verify current authenticated farmer immediately after await
        if (isIdentityStale()) {
          return { profile: this.getFarmProfile(user, farmerId), fromDatabase: false, error: 'Identity changed during profile fetch' };
        }

        if (dbProfile) {
          const conflicts: Record<string, { cloud: any; local: any }> = {};
          let needsLegacyCloudSync = false;

          // Helper to reconcile field: cloud is authoritative; if cloud is missing, migrate local legacy value
          const reconcileField = (
            fieldKey: string,
            cloudVal: string | null | undefined,
            localVal: string | null | undefined
          ): string => {
            const cleanCloud = (cloudVal !== null && cloudVal !== undefined) ? String(cloudVal).trim() : '';
            const cleanLocal = (isVerifiedOwnerCache && localVal !== null && localVal !== undefined) ? String(localVal).trim() : '';

            if (cleanCloud) {
              if (cleanLocal && cleanLocal !== cleanCloud) {
                conflicts[fieldKey] = { cloud: cleanCloud, local: cleanLocal };
              }
              return cleanCloud;
            }

            if (cleanLocal) {
              needsLegacyCloudSync = true;
              return cleanLocal;
            }

            return '';
          };

          // Check if local cache has a strictly newer timestamp than database
          const dbTime = new Date(dbProfile.updated_at || 0).getTime();
          const localTime = new Date(localAux.updatedAt || 0).getTime();
          const isLocalNewer = Boolean(isVerifiedOwnerCache && localAux.isSaved && localTime > dbTime);

          let finalProfile: CompleteFarmProfile;

          if (isLocalNewer && localAux.farmer && localAux.farm && localAux.soil) {
            finalProfile = localAux;
            // Background sync newer local cache back to Supabase
            this.saveFarmProfile(finalProfile, true, farmerId);
          } else {
            // Construct restored profile from authoritative DB record + farmer profile + reconciled 5 fields
            finalProfile = {
              farmer: {
                fullName: dbFarmer?.full_name || user?.full_name || user?.name || (isVerifiedOwnerCache ? localAux.farmer?.fullName : '') || 'Farmer Partner',
                phone: dbFarmer?.phone || user?.phone || user?.contact_no || (isVerifiedOwnerCache ? localAux.farmer?.phone : '') || '',
                email: dbFarmer?.email || user?.email || (isVerifiedOwnerCache ? localAux.farmer?.email : '') || '',
                state: dbProfile.state || (isVerifiedOwnerCache ? localAux.farmer?.state : '') || '',
                district: dbProfile.district || (isVerifiedOwnerCache ? localAux.farmer?.district : '') || '',
                village: reconcileField('village_name', dbProfile.village_name, localAux.farmer?.village),
                experienceYears: (isVerifiedOwnerCache ? localAux.farmer?.experienceYears : '') || '',
                gender: (isVerifiedOwnerCache ? localAux.farmer?.gender : '') || '',
                dob: (isVerifiedOwnerCache ? localAux.farmer?.dob : '') || '',
              },
              farm: {
                farmName: reconcileField('farm_name', dbProfile.farm_name, localAux.farm?.farmName),
                farmSize: (dbFarmer?.farm_size ? parseFloat(dbFarmer.farm_size) : undefined) || (isVerifiedOwnerCache ? localAux.farm?.farmSize : undefined) || (user?.farm_size ? parseFloat(user.farm_size) : 0),
                farmSizeUnit: (isVerifiedOwnerCache ? localAux.farm?.farmSizeUnit : 'Acres') || 'Acres',
                farmingMethod: (isVerifiedOwnerCache ? localAux.farm?.farmingMethod : '') || '',
                irrigationType: (dbProfile.irrigation_type as any) || (isVerifiedOwnerCache ? localAux.farm?.irrigationType : '') || '',
                currentCrops: reconcileField('current_crops', dbProfile.current_crops, localAux.farm?.currentCrops),
                previousCrops: reconcileField('previous_crops', dbProfile.previous_crops, localAux.farm?.previousCrops),
              },
              conditions: {
                agroZone: reconcileField('agro_climatic_zone', dbProfile.agro_climatic_zone, localAux.conditions?.agroZone),
                waterAvailability: (isVerifiedOwnerCache ? localAux.conditions?.waterAvailability : '') || '',
                rainfall: dbProfile.rainfall !== null && dbProfile.rainfall !== undefined ? dbProfile.rainfall : (isVerifiedOwnerCache ? localAux.conditions?.rainfall || 0 : 0),
                temperature: (isVerifiedOwnerCache ? localAux.conditions?.temperature || 0 : 0),
                humidity: (isVerifiedOwnerCache ? localAux.conditions?.humidity || 0 : 0),
                topography: (isVerifiedOwnerCache ? localAux.conditions?.topography : '') || '',
                sunlightHours: (isVerifiedOwnerCache ? localAux.conditions?.sunlightHours || 0 : 0),
              },
              soil: {
                soilType: dbProfile.soil_type || (isVerifiedOwnerCache ? localAux.soil?.soilType : '') || '',
                ph: dbProfile.ph !== null && dbProfile.ph !== undefined ? dbProfile.ph : (isVerifiedOwnerCache ? localAux.soil?.ph || 0 : 0),
                nitrogen: dbProfile.nitrogen !== null && dbProfile.nitrogen !== undefined ? dbProfile.nitrogen : (isVerifiedOwnerCache ? localAux.soil?.nitrogen || 0 : 0),
                phosphorus: dbProfile.phosphorus !== null && dbProfile.phosphorus !== undefined ? dbProfile.phosphorus : (isVerifiedOwnerCache ? localAux.soil?.phosphorus || 0 : 0),
                potassium: dbProfile.potassium !== null && dbProfile.potassium !== undefined ? dbProfile.potassium : (isVerifiedOwnerCache ? localAux.soil?.potassium || 0 : 0),
                organicCarbon: (isVerifiedOwnerCache ? localAux.soil?.organicCarbon || 0 : 0),
                lastTestedDate: (isVerifiedOwnerCache ? localAux.soil?.lastTestedDate : '') || '',
              },
              updatedAt: dbProfile.updated_at || new Date().toISOString(),
            };
            (finalProfile as any).isSaved = true;

            // If legacy Safari fields were restored into an existing cloud record missing them,
            // migrate them to Supabase so other browsers can immediately access them.
            if (needsLegacyCloudSync && !isIdentityStale()) {
              this.saveFarmProfile(finalProfile, true, farmerId).catch(err => {
                console.warn('[FarmProfileService] Legacy Safari fields cloud migration warning:', err);
              });
            }
          }

          // Identity safety check: verify current authenticated farmer immediately before localStorage writes
          if (isIdentityStale()) {
            return { profile: this.getFarmProfile(user, farmerId), fromDatabase: false, error: 'Identity changed before profile storage write' };
          }

          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(finalProfile));
            localStorage.setItem(scopedKey, JSON.stringify(finalProfile));
            localStorage.setItem(SAVED_FLAG_KEY, 'true');
          }

          // Identity safety check: verify current authenticated farmer immediately before event dispatch
          if (!isIdentityStale() && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('fieldwise:profile_updated', { detail: finalProfile }));
            window.dispatchEvent(new CustomEvent('farmiq:profile_updated', { detail: finalProfile }));
          }

          return {
            profile: finalProfile,
            fromDatabase: true,
            conflicts: Object.keys(conflicts).length > 0 ? conflicts : undefined
          };
        }
      } catch (err: any) {
        console.warn('[FarmProfileService] Error restoring from Supabase:', err?.message || err);
        const localFallback = this.getFarmProfile(user, farmerId);
        // Identity safety check: do not write to active storage or emit events if identity changed
        if (isIdentityStale()) {
          return { profile: localFallback, fromDatabase: false, error: 'Identity changed during profile restoration failure' };
        }
        if (this.isProfileSaved(farmerId)) {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(localFallback));
            localStorage.setItem(SAVED_FLAG_KEY, 'true');
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('fieldwise:profile_updated', { detail: localFallback }));
          }
        }
        return { profile: localFallback, fromDatabase: false, error: err?.message || 'Database fetch failed' };
      }
    }

    // 2. If no DB record was returned (or Supabase not configured), check farmer-scoped local cache
    if (isIdentityStale()) {
      return { profile: this.getFarmProfile(user, farmerId), fromDatabase: false, error: 'Identity changed before local scoped profile restore' };
    }

    if (isVerifiedOwnerCache && (localAux.isSaved || localAux.updatedAt)) {
      (localAux as any).isSaved = true;
      if (isIdentityStale()) {
        return { profile: localAux, fromDatabase: false };
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localAux));
        localStorage.setItem(SAVED_FLAG_KEY, 'true');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fieldwise:profile_updated', { detail: localAux }));
        window.dispatchEvent(new CustomEvent('farmiq:profile_updated', { detail: localAux }));
      }
      // Migrate to cloud in background if Supabase is configured
      if (isSupabaseConfigured && !isIdentityStale()) {
        this.saveFarmProfile(localAux, true, farmerId).catch(err => {
          console.warn('[FarmProfileService] Background initial cloud sync warning:', err);
        });
      }
      return { profile: localAux, fromDatabase: false };
    }

    // 3. Brand new farmer: clean initialization from user registration info
    const initial = this.getFarmProfile(user, farmerId);
    return { profile: initial, fromDatabase: false };
  }

  public resetProfile(farmerId ?: string): void {
  if(typeof localStorage !== 'undefined') {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SAVED_FLAG_KEY);
  const targetFarmerId = (farmerId && farmerId.trim()) || getActiveFarmerId();
  if (targetFarmerId && targetFarmerId !== 'farmer_main') {
    localStorage.removeItem(getFarmerStorageKey(targetFarmerId));
  }
}
  }

  public calculateProfileCompletion(profile: CompleteFarmProfile): number {
  if (!profile) return 0;
  let filled = 0;
  const total = 20;

  // 1. Farmer Info fields (6)
  if (profile.farmer?.fullName && profile.farmer.fullName.trim()) filled++;
  if (profile.farmer?.phone && profile.farmer.phone.trim()) filled++;
  if (profile.farmer?.email && profile.farmer.email.trim()) filled++;
  if (profile.farmer?.state && profile.farmer.state.trim()) filled++;
  if (profile.farmer?.district && profile.farmer.district.trim()) filled++;
  if (profile.farmer?.experienceYears && String(profile.farmer.experienceYears).trim()) filled++;

  // 2. Farm Details fields (5)
  if (profile.farm?.farmName && profile.farm.farmName.trim()) filled++;
  if (profile.farm?.farmSize && profile.farm.farmSize > 0) filled++;
  if (profile.farm?.farmingMethod && profile.farm.farmingMethod.trim()) filled++;
  if (profile.farm?.irrigationType && profile.farm.irrigationType.trim()) filled++;
  if (profile.farm?.currentCrops && profile.farm.currentCrops.trim()) filled++;

  // 3. Conditions fields (4)
  if (profile.conditions?.agroZone && profile.conditions.agroZone.trim()) filled++;
  if (profile.conditions?.waterAvailability && profile.conditions.waterAvailability.trim()) filled++;
  if (profile.conditions?.rainfall && profile.conditions.rainfall > 0) filled++;
  if (profile.conditions?.temperature && profile.conditions.temperature > 0) filled++;

  // 4. Soil Information fields (5)
  if (profile.soil?.soilType && profile.soil.soilType.trim()) filled++;
  if (profile.soil?.ph && profile.soil.ph > 0) filled++;
  if (profile.soil?.nitrogen && profile.soil.nitrogen > 0) filled++;
  if (profile.soil?.phosphorus && profile.soil.phosphorus > 0) filled++;
  if (profile.soil?.potassium && profile.soil.potassium > 0) filled++;

  return Math.round((filled / total) * 100);
}

  public onProfileChange(callback: (profile: CompleteFarmProfile) => void): () => void {
  if(typeof window === 'undefined') return () => { };
const handler = (e: any) => {
  if (e.detail) callback(e.detail);
};
window.addEventListener('fieldwise:profile_updated', handler);
window.addEventListener('farmiq:profile_updated', handler);
return () => {
  window.removeEventListener('fieldwise:profile_updated', handler);
  window.removeEventListener('farmiq:profile_updated', handler);
};
  }
}

export const farmProfileService = new FarmProfileService();
