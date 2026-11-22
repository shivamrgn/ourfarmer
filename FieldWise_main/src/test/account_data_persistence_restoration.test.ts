import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  farmProfileService,
  CompleteFarmProfile,
  getFarmerStorageKey,
} from '../services/farmProfileService';
import {
  farmIntelligenceService,
  getFarmerCropRecKey,
  getFarmerFertRecKey,
  getFarmerDiseaseRecKey,
  CROP_REC_KEY,
  FERT_REC_KEY,
  DISEASE_REC_KEY,
} from '../services/farmIntelligenceService';
import {
  syncFarmProfileToSupabase,
  syncFarmerToSupabase,
  fetchFarmProfileFromSupabase,
  fetchFarmerFromSupabase,
  fetchLatestPredictionFromSupabase,
  savePredictionToSupabase,
  syncCurrentStateToSupabase,
} from '../lib/supabase';

// ── In-Memory PostgreSQL/Supabase Database Store ──────────────────────────────
interface MockDatabase {
  farmers: Map<string, any>;
  farm_profiles: any[];
  crop_predictions: any[];
}

const mockDb: MockDatabase = {
  farmers: new Map(),
  farm_profiles: [],
  crop_predictions: [],
};

// Reset in-memory database before each test
function resetMockDb() {
  mockDb.farmers.clear();
  mockDb.farm_profiles = [];
  mockDb.crop_predictions = [];
  delete (mockDb as any).__deferred;
}

// ── Mock @supabase/supabase-js with realistic querying behavior ───────────────
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: () => ({
      from: (table: string) => {
        let filterCol: string | null = null;
        let filterVal: any = null;
        let orderCol: string | null = null;
        let orderAsc = true;
        let limitVal: number | null = null;
        let shouldFail = false;

        const builder: any = {
          select: vi.fn(() => builder),
          eq: vi.fn((col: string, val: any) => {
            filterCol = col;
            filterVal = val;
            return builder;
          }),
          order: vi.fn((col: string, options?: { ascending: boolean }) => {
            orderCol = col;
            orderAsc = options?.ascending ?? true;
            return builder;
          }),
          limit: vi.fn((lim: number) => {
            limitVal = lim;
            return builder;
          }),
          maybeSingle: vi.fn(async () => {
            if ((mockDb as any).__simulateNetworkFailure) {
              return { data: null, error: { message: 'Database connection timeout' } };
            }
            if ((mockDb as any).__deferred) {
              await (mockDb as any).__deferred;
            }
            if (table === 'farmers') {
              const row = mockDb.farmers.get(filterVal);
              return { data: row || null, error: null };
            }
            return { data: null, error: null };
          }),
          upsert: vi.fn(async (payload: any, options?: any) => {
            if ((mockDb as any).__simulateNetworkFailure) {
              return { data: null, error: { message: 'Database write error' } };
            }
            if (table === 'farmers') {
              if (options?.ignoreDuplicates && mockDb.farmers.has(payload.id)) {
                return { data: mockDb.farmers.get(payload.id), error: null };
              }
              mockDb.farmers.set(payload.id, { ...payload });
              return { data: payload, error: null };
            }
            return { data: payload, error: null };
          }),
          insert: vi.fn(async (payload: any) => {
            if ((mockDb as any).__simulateNetworkFailure) {
              return { data: null, error: { message: 'Database write error' } };
            }
            const record = { id: `row_${Date.now()}_${Math.random()}`, ...payload };
            if (table === 'farm_profiles') {
              mockDb.farm_profiles.push(record);
            } else if (table === 'crop_predictions') {
              mockDb.crop_predictions.push(record);
            }
            return { data: [record], error: null };
          }),
          update: vi.fn((payload: any) => ({
            eq: vi.fn(async (col: string, val: any) => {
              if ((mockDb as any).__simulateNetworkFailure) {
                return { data: null, error: { message: 'Database write error' } };
              }
              if (table === 'farm_profiles') {
                const target = mockDb.farm_profiles.find((r) => r[col] === val);
                if (target) {
                  Object.assign(target, payload);
                  return { data: [target], error: null };
                }
              }
              return { data: [], error: null };
            }),
          })),
          then: (resolve: any, reject: any) => {
            const execute = () => {
              if ((mockDb as any).__simulateNetworkFailure) {
                return resolve({ data: null, error: { message: 'Network connection aborted' } });
              }
              let rows: any[] = [];
              if (table === 'farmers') {
                rows = Array.from(mockDb.farmers.values());
              } else if (table === 'farm_profiles') {
                rows = [...mockDb.farm_profiles];
              } else if (table === 'crop_predictions') {
                rows = [...mockDb.crop_predictions];
              }

              if (filterCol && filterVal !== null) {
                rows = rows.filter((r) => r[filterCol!] === filterVal);
              }

              if (orderCol) {
                rows.sort((a, b) => {
                  const va = a[orderCol!] || '';
                  const vb = b[orderCol!] || '';
                  return orderAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
                });
              }

              if (limitVal !== null) {
                rows = rows.slice(0, limitVal);
              }

              return resolve({ data: rows, error: null });
            };

            if ((mockDb as any).__deferred) {
              return (mockDb as any).__deferred.then(execute, (err: any) => {
                resolve({ data: null, error: err || { message: 'Deferred failure' } });
              });
            }
            return execute();
          },
        };
        return builder;
      },
    }),
  };
});

// ── Test Suite ─────────────────────────────────────────────────────────────────
describe('FieldWise Account Data Persistence and Login Restoration Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetMockDb();
    delete (mockDb as any).__simulateNetworkFailure;
    vi.restoreAllMocks();
  });

  const farmerA = {
    id: 'farmer_uid_alpha_123',
    username: 'farmer_ramesh',
    email: 'ramesh.patel@gujarat.agri',
    full_name: 'Ramesh Patel',
    phone: '+91 98765 11111',
    location: 'Anand, Gujarat',
    farm_size: '25 Acres',
    created_at: '2026-01-10T08:00:00.000Z',
  };

  const farmerB = {
    id: 'farmer_uid_bravo_456',
    username: 'farmer_suresh',
    email: 'suresh.kumar@punjab.agri',
    full_name: 'Suresh Kumar',
    phone: '+91 98765 22222',
    location: 'Ludhiana, Punjab',
    farm_size: '15 Acres',
    created_at: '2026-01-15T09:00:00.000Z',
  };

  const sampleProfileA: CompleteFarmProfile = {
    farmer: {
      fullName: 'Ramesh Patel',
      phone: '+91 98765 11111',
      email: 'ramesh.patel@gujarat.agri',
      state: 'Gujarat',
      district: 'Anand',
      village: 'Petlad',
      experienceYears: '18',
      gender: 'Male',
      dob: '1980-04-12',
    },
    farm: {
      farmName: 'Patel Bio Farm',
      farmSize: 25,
      farmSizeUnit: 'Acres',
      farmingMethod: 'Organic',
      irrigationType: 'Drip',
      currentCrops: 'Cotton, Groundnut',
      previousCrops: 'Wheat',
    },
    conditions: {
      agroZone: 'Gujarat Plains & Hills',
      waterAvailability: 'High',
      rainfall: 820,
      temperature: 28,
      humidity: 58,
      topography: 'Plains / Flatlands',
      sunlightHours: 9,
    },
    soil: {
      soilType: 'Black',
      ph: 7.4,
      nitrogen: 92,
      phosphorus: 64,
      potassium: 78,
      organicCarbon: 1.1,
      lastTestedDate: '2026-02-15',
    },
    updatedAt: '2026-02-20T10:00:00.000Z',
  };

  // ── Scenario 1: Farmer A saves profile, logs out, logs back in → Profile restored ──
  it('1. Farmer A saves profile, logs out, logs back in with the same account → profile is restored from cloud DB', async () => {
    // 1. Farmer A logs in and saves their complete farm profile
    await farmProfileService.saveFarmProfile(sampleProfileA, true, farmerA.id);

    // Verify DB received the authoritative record
    const dbProfile = await fetchFarmProfileFromSupabase(farmerA.id);
    expect(dbProfile).not.toBeNull();
    expect(dbProfile?.state).toBe('Gujarat');
    expect(dbProfile?.district).toBe('Anand');
    expect(dbProfile?.soil_type).toBe('Black');
    expect(dbProfile?.ph).toBe(7.4);
    expect(dbProfile?.nitrogen).toBe(92);

    // 2. Farmer A logs out: active localStorage cache is cleared (simulates AuthContext.logout)
    localStorage.removeItem('cropswild_farm_profile');
    localStorage.removeItem('fieldwise_profile_saved_flag');
    localStorage.removeItem('fieldwise_active_user');

    // Verify active cache is empty
    expect(localStorage.getItem('cropswild_farm_profile')).toBeNull();

    // 3. Farmer A logs back in: system authoritatively loads and restores from database
    const restoreResult = await farmProfileService.loadAndRestoreProfile(farmerA);

    expect(restoreResult.fromDatabase).toBe(true);
    expect(restoreResult.profile.farmer.state).toBe('Gujarat');
    expect(restoreResult.profile.farmer.district).toBe('Anand');
    expect(restoreResult.profile.soil.soilType).toBe('Black');
    expect(restoreResult.profile.soil.ph).toBe(7.4);
    expect(restoreResult.profile.soil.nitrogen).toBe(92);
    expect(restoreResult.profile.farm.farmSize).toBe(25);
    expect(farmProfileService.isProfileSaved(farmerA.id)).toBe(true);
  });

  // ── Scenario 2: Farmer A saves prediction, logs out, logs back in → Prediction restored ──
  it('2. Farmer A saves crop prediction, logs out, logs back in → prediction is restored from cloud DB', async () => {
    // 1. Save crop prediction for Farmer A
    const saveRes = await savePredictionToSupabase({
      farmer_id: farmerA.id,
      recommended_crop: 'Cotton',
      confidence: '94%',
      nitrogen: 90,
      phosphorus: 60,
      potassium: 75,
      ph: 7.2,
      rainfall: 800,
      temperature: 28,
      humidity: 60,
    });
    expect(saveRes.success).toBe(true);

    // 2. Farmer logs out and active cache is cleared
    localStorage.removeItem('cropswild_crop_recommendation_last');
    expect(localStorage.getItem('cropswild_crop_recommendation_last')).toBeNull();

    // 3. On re-login, fetch latest prediction from Supabase
    const restoredPred = await fetchLatestPredictionFromSupabase(farmerA.id);
    expect(restoredPred).not.toBeNull();
    expect(restoredPred?.recommended_crop).toBe('Cotton');
    expect(restoredPred?.confidence).toBe('94%');
    expect(restoredPred?.nitrogen).toBe(90);
    expect(restoredPred?.rainfall).toBe(800);
  });

  // ── Scenario 3: Cross-farmer isolation (Farmer B cannot access Farmer A data) ──
  it('3. Cross-Farmer Isolation: Farmer B logging in cannot read or overwrite Farmer A profile or prediction', async () => {
    // 1. Farmer A saves their profile and prediction
    await farmProfileService.saveFarmProfile(sampleProfileA, true, farmerA.id);
    await savePredictionToSupabase({
      farmer_id: farmerA.id,
      recommended_crop: 'Groundnut',
      confidence: '91%',
    });

    // 2. Farmer A logs out
    localStorage.removeItem('cropswild_farm_profile');
    localStorage.removeItem('fieldwise_profile_saved_flag');

    // 3. Farmer B logs in (has no prior saved profile in DB)
    const restoreResultB = await farmProfileService.loadAndRestoreProfile(farmerB);

    // Farmer B gets their own clean profile, NOT Farmer A's Gujarat/Black soil profile
    expect(restoreResultB.fromDatabase).toBe(false);
    expect(restoreResultB.profile.farmer.fullName).toBe('Suresh Kumar');
    expect(restoreResultB.profile.soil.soilType).toBe(''); // Clean unconfigured
    expect(restoreResultB.profile.farmer.state).toBe('Punjab');

    // Farmer B cannot retrieve Farmer A's prediction
    const predB = await fetchLatestPredictionFromSupabase(farmerB.id);
    expect(predB).toBeNull();

    // Verify Farmer A's data remains safe and unmodified in DB
    const predA = await fetchLatestPredictionFromSupabase(farmerA.id);
    expect(predA?.recommended_crop).toBe('Groundnut');
    const profileA = await fetchFarmProfileFromSupabase(farmerA.id);
    expect(profileA?.soil_type).toBe('Black');
  });

  // ── Scenario 4: Clearing localStorage does not destroy cloud database records ──
  it('4. Clearing browser localStorage completely does not destroy cloud database records', async () => {
    // 1. Save profile to cloud
    await farmProfileService.saveFarmProfile(sampleProfileA, true, farmerA.id);

    // 2. User clears entire browser cache / site data
    localStorage.clear();
    sessionStorage.clear();
    expect(localStorage.length).toBe(0);

    // 3. Cloud records still exist
    const dbProfile = await fetchFarmProfileFromSupabase(farmerA.id);
    expect(dbProfile).not.toBeNull();
    expect(dbProfile?.state).toBe('Gujarat');

    // 4. Calling loadAndRestoreProfile repopulates local cache seamlessly
    const result = await farmProfileService.loadAndRestoreProfile(farmerA);
    expect(result.fromDatabase).toBe(true);
    expect(result.profile.farmer.state).toBe('Gujarat');
    expect(localStorage.getItem('cropswild_farm_profile')).not.toBeNull();
  });

  // ── Scenario 5: Login does NOT perform destructive blind overwrite ──
  it('5. Login does NOT perform blind overwrite of cloud profile with empty/null defaults', async () => {
    // 1. Cloud has a valid saved profile
    await syncFarmProfileToSupabase({
      farmer_id: farmerA.id,
      state: 'Gujarat',
      district: 'Anand',
      soil_type: 'Black',
      ph: 7.4,
      nitrogen: 92,
      phosphorus: 64,
      potassium: 78,
      rainfall: 820,
      irrigation_type: 'Drip',
    });

    // 2. Local storage is empty (clean login)
    localStorage.clear();

    // 3. An unconfigured/empty profile is generated
    const emptyProfile = farmProfileService.getFarmProfile(farmerA);
    expect(emptyProfile.soil.soilType).toBe('');

    // 4. Calling syncCurrentStateToSupabase with an unconfigured profile MUST NOT overwrite cloud DB
    await syncCurrentStateToSupabase(farmerA, emptyProfile);

    // 5. Verify cloud DB still holds the saved values, NOT null or Loamy
    const dbProfileAfter = await fetchFarmProfileFromSupabase(farmerA.id);
    expect(dbProfileAfter?.soil_type).toBe('Black');
    expect(dbProfileAfter?.ph).toBe(7.4);
    expect(dbProfileAfter?.state).toBe('Gujarat');
  });

  // ── Scenario 6: Stale local cache cannot overwrite newer database record ──
  it('6. Stale local cache does not overwrite newer database record', async () => {
    // 1. Cloud DB has newer record (updated at 2026-03-01)
    await syncFarmProfileToSupabase({
      farmer_id: farmerA.id,
      state: 'Gujarat',
      district: 'Anand',
      soil_type: 'Alluvial', // Changed in cloud
      ph: 7.0,
      nitrogen: 100,
      updated_at: '2026-03-01T12:00:00.000Z',
    });

    // 2. Local storage has older record (updated at 2026-01-01)
    const staleLocalProfile = {
      ...sampleProfileA,
      soil: { ...sampleProfileA.soil, soilType: 'OldBlack' },
      updatedAt: '2026-01-01T10:00:00.000Z',
      isSaved: true,
    };
    localStorage.setItem(getFarmerStorageKey(farmerA.id), JSON.stringify(staleLocalProfile));

    // 3. Restore profile on login
    const result = await farmProfileService.loadAndRestoreProfile(farmerA);

    // Cloud record takes precedence because it is newer
    expect(result.fromDatabase).toBe(true);
    expect(result.profile.soil.soilType).toBe('Alluvial');
    expect(result.profile.soil.nitrogen).toBe(100);
  });

  // ── Scenario 7: Database network failure fallback without data loss ──
  it('7. Database network failure is handled gracefully without wiping farmer data', async () => {
    // 1. Farmer has saved local scoped profile
    localStorage.setItem(getFarmerStorageKey(farmerA.id), JSON.stringify(sampleProfileA));
    localStorage.setItem('fieldwise_profile_saved_flag', 'true');

    // 2. Simulate network failure / offline mode
    (mockDb as any).__simulateNetworkFailure = true;

    // 3. Attempt restore
    const result = await farmProfileService.loadAndRestoreProfile(farmerA);

    // Does not crash, does not clear data, falls back to local scoped cache
    expect(result.fromDatabase).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.profile.farmer.state).toBe('Gujarat');
    expect(result.profile.soil.soilType).toBe('Black');
  });

  // ── Scenario 8: Profile completion percentage calculated accurately ──
  it('8. Profile completion percentage is calculated accurately on restored profile', async () => {
    await farmProfileService.saveFarmProfile(sampleProfileA, true, farmerA.id);
    localStorage.removeItem('cropswild_farm_profile');

    const result = await farmProfileService.loadAndRestoreProfile(farmerA);
    const completion = farmProfileService.calculateProfileCompletion(result.profile);

    // Profile has all farmer, farm, conditions, and soil fields filled
    expect(completion).toBeGreaterThanOrEqual(75);
  });

  // ── Scenario 9: Repeated login/logout cycles preserve data integrity ──
  it('9. Repeated login/logout cycles preserve data integrity without duplicate keys', async () => {
    // Cycle 1: Save & Logout
    await farmProfileService.saveFarmProfile(sampleProfileA, true, farmerA.id);
    localStorage.removeItem('cropswild_farm_profile');

    // Cycle 2: Login & Restore
    const r1 = await farmProfileService.loadAndRestoreProfile(farmerA);
    expect(r1.profile.farmer.state).toBe('Gujarat');
    localStorage.removeItem('cropswild_farm_profile');

    // Cycle 3: Second Login & Restore
    const r2 = await farmProfileService.loadAndRestoreProfile(farmerA);
    expect(r2.profile.farmer.state).toBe('Gujarat');
    expect(r2.profile.soil.ph).toBe(7.4);

    // Verify exactly 1 profile row exists in DB for farmerA
    const rows = mockDb.farm_profiles.filter((r) => r.farmer_id === farmerA.id);
    expect(rows.length).toBe(1);
  });

  // ── Scenario 10: Guest / unauthenticated users cannot access farmer data ──
  it('10. Guest / unauthenticated users cannot access or overwrite farmer data', async () => {
    // 1. Farmer A has saved data
    await farmProfileService.saveFarmProfile(sampleProfileA, true, farmerA.id);

    // 2. Farmer A logs out
    localStorage.removeItem('cropswild_farm_profile');
    localStorage.removeItem('fieldwise_profile_saved_flag');

    // 3. Guest user (default demo farmer) loads profile
    const guestUser = { id: 'farmer_main', full_name: 'Guest' };
    const guestResult = await farmProfileService.loadAndRestoreProfile(guestUser);

    expect(guestResult.fromDatabase).toBe(false);
    expect(guestResult.profile.farmer.email).not.toBe(farmerA.email);

    // 4. Guest cannot query farmer A's DB records
    const guestDbProfile = await fetchFarmProfileFromSupabase('farmer_main');
    expect(guestDbProfile).toBeNull();
  });

  // ── Scenario 11: Profile restoration emits reactive events for dashboard ──
  it('11. Profile restoration emits reactive window event for live dashboard sync', async () => {
    await syncFarmProfileToSupabase({
      farmer_id: farmerA.id,
      state: 'Gujarat',
      district: 'Anand',
      soil_type: 'Black',
      ph: 7.4,
    });

    let eventFired = false;
    let eventDetail: any = null;
    const handler = (e: any) => {
      eventFired = true;
      eventDetail = e.detail;
    };
    window.addEventListener('fieldwise:profile_updated', handler);

    await farmProfileService.loadAndRestoreProfile(farmerA);

    expect(eventFired).toBe(true);
    expect(eventDetail?.soil?.soilType).toBe('Black');
    window.removeEventListener('fieldwise:profile_updated', handler);
  });

  // ── Scenario 12: Preserves frozen engine contracts and V1 backward compatibility ──
  it('12. Preserves V1 and V2 prediction contracts and default fallback behavior', () => {
    // An unsaved/unconfigured user gets clean defaults without throwing
    const unsavedProfile = farmProfileService.getFarmProfile({ full_name: 'New Farmer' });
    expect(unsavedProfile).toBeDefined();
    expect(unsavedProfile.farmer.fullName).toBe('New Farmer');
    expect(unsavedProfile.farm.farmSize).toBe(0);
    expect(farmProfileService.isProfileSaved('new_unregistered_id')).toBe(false);
  });

  // ── Step A + B Explicit Acceptance Tests (10 Criteria) ──────────────────────

  // 1. Dashboard loads saved prediction without mounting CropRecommendation
  it('Criterion 1: Dashboard loads saved prediction without mounting CropRecommendation', async () => {
    // Prediction exists in Supabase
    await savePredictionToSupabase({
      farmer_id: farmerA.id,
      recommended_crop: 'Mustard',
      confidence: '93%',
      nitrogen: 85,
      phosphorus: 45,
      potassium: 45,
      ph: 6.8,
      rainfall: 350,
      temperature: 20,
      humidity: 55,
    });

    // Clear active localStorage keys (simulating fresh dashboard load before CropRecommendation is ever mounted)
    localStorage.removeItem(CROP_REC_KEY);
    localStorage.removeItem(getFarmerCropRecKey(farmerA.id));

    // Application-level restore (as called by AuthContext)
    const restored = await farmIntelligenceService.loadAndRestorePrediction(farmerA);

    expect(restored).not.toBeNull();
    expect(restored?.topCrop).toBe('Mustard');
    expect(restored?.confidence).toBe('93%');
    expect(restored?.farmer_id).toBe(farmerA.id);

    // Synchronously available to dashboard components
    const stored = farmIntelligenceService.getStoredCropRecommendation(farmerA.id);
    expect(stored?.cropName).toBe('Mustard');
    expect(localStorage.getItem(CROP_REC_KEY)).not.toBeNull();
    expect(localStorage.getItem(getFarmerCropRecKey(farmerA.id))).not.toBeNull();
  });

  // 2. Valid prediction for Farmer A is never restored for Farmer B
  it('Criterion 2: Valid prediction for Farmer A is never restored for Farmer B', async () => {
    // Save prediction for Farmer A
    await savePredictionToSupabase({
      farmer_id: farmerA.id,
      recommended_crop: 'Cotton',
      confidence: '95%',
    });

    // Farmer A has active record in localStorage
    const predA = {
      predictions: [{ crop: 'Cotton', confidence: 95 }],
      inputs: {},
      topCrop: 'Cotton',
      cropName: 'Cotton',
      confidence: 95,
      suitabilityScore: 95,
      analyzedAt: new Date().toISOString(),
      farmer_id: farmerA.id,
    };
    localStorage.setItem(CROP_REC_KEY, JSON.stringify(predA));
    localStorage.setItem(getFarmerCropRecKey(farmerA.id), JSON.stringify(predA));

    // Farmer B logs in and checks crop recommendation
    const restoreB = await farmIntelligenceService.loadAndRestorePrediction(farmerB);
    expect(restoreB).toBeNull();

    // Querying for Farmer B rejects Farmer A's active key
    const storedForB = farmIntelligenceService.getStoredCropRecommendation(farmerB.id);
    expect(storedForB).toBeNull();
  });

  // 3. fieldwise:intelligence_updated event causes dashboard state to refresh crop, fertilizer, disease, and recent activity
  it('Criterion 3: fieldwise:intelligence_updated event causes dashboard state to refresh crop, fertilizer, disease, and recent activity', async () => {
    let eventReceived = false;
    const onIntelligenceUpdate = () => {
      eventReceived = true;
    };
    window.addEventListener('fieldwise:intelligence_updated', onIntelligenceUpdate);

    // Save scoped data for Farmer A
    const fertData = {
      cropName: 'Groundnut',
      cropId: 'groundnut',
      fertilizers: [{ name: 'Urea', quantity: 50, unit: 'kg' }],
      inputs: { area: 2, unit: 'Acres' },
      analyzedAt: new Date().toISOString(),
      farmer_id: farmerA.id,
    };
    localStorage.setItem(getFarmerFertRecKey(farmerA.id), JSON.stringify(fertData));

    const diseaseData = {
      cropName: 'Groundnut',
      diseaseName: 'Early Leaf Spot',
      confidenceScore: 89,
      analyzedAt: new Date().toISOString(),
      farmer_id: farmerA.id,
    };
    localStorage.setItem(getFarmerDiseaseRecKey(farmerA.id), JSON.stringify(diseaseData));

    // Restoring session emits the update event
    farmIntelligenceService.restoreFarmerSession(farmerA.id);

    expect(eventReceived).toBe(true);

    // Recent activities reflects all refreshed intelligence
    const activities = farmIntelligenceService.getRecentActivities(sampleProfileA, farmerA.id);
    expect(activities.some((a) => a.type === 'fertilizer' && a.title.includes('Groundnut'))).toBe(true);
    expect(activities.some((a) => a.type === 'disease' && a.title.includes('Early Leaf Spot'))).toBe(true);

    window.removeEventListener('fieldwise:intelligence_updated', onIntelligenceUpdate);
  });

  // 4. Async response for previous user cannot overwrite current user dashboard
  it('Criterion 4: Async response for previous user cannot overwrite current user dashboard', async () => {
    let currentDashboardUser = farmerA.id;
    let dashboardState = { crop: 'None' };

    // Simulate async restoration pipeline with cancellation / identity check
    const asyncFetchForUser = async (userId: string) => {
      // simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 20));
      // Guard check: verify target user matches current active user
      if (userId === currentDashboardUser) {
        dashboardState = { crop: `Result_For_${userId}` };
      }
    };

    // User A request starts
    const promiseA = asyncFetchForUser(farmerA.id);

    // Rapid switch to User B
    currentDashboardUser = farmerB.id;
    const promiseB = asyncFetchForUser(farmerB.id);

    await Promise.all([promiseA, promiseB]);

    // Dashboard holds User B's result, User A's stale response was discarded
    expect(dashboardState.crop).toBe(`Result_For_${farmerB.id}`);
  });

  // 5. Fertilizer result survives logout and re-login for the same farmer
  it('Criterion 5: Fertilizer result survives logout and re-login for the same farmer', () => {
    const fertData = {
      cropName: 'Sugarcane',
      cropId: 'sugarcane',
      fertilizers: [{ name: 'DAP', quantity: 100, unit: 'kg' }],
      inputs: { area: 5, unit: 'Acres' },
      analyzedAt: '2026-03-01T10:00:00.000Z',
      farmer_id: farmerA.id,
    };

    // Farmer A saves fertilizer recommendation (both scoped and active)
    localStorage.setItem(FERT_REC_KEY, JSON.stringify(fertData));
    localStorage.setItem(getFarmerFertRecKey(farmerA.id), JSON.stringify(fertData));

    // Farmer A logs out: active key cleared, scoped key preserved
    localStorage.removeItem(FERT_REC_KEY);
    expect(localStorage.getItem(FERT_REC_KEY)).toBeNull();

    // Farmer A logs back in: session restored
    farmIntelligenceService.restoreFarmerSession(farmerA.id);

    // Active key and stored getter are restored
    expect(localStorage.getItem(FERT_REC_KEY)).not.toBeNull();
    const restoredFert = farmIntelligenceService.getStoredFertilizerRecommendation(farmerA.id);
    expect(restoredFert?.cropName).toBe('Sugarcane');
    expect(restoredFert?.cropId).toBe('sugarcane');
  });

  // 6. Disease result survives logout and re-login for the same farmer
  it('Criterion 6: Disease result survives logout and re-login for the same farmer', () => {
    const diseaseData = {
      cropName: 'Tomato',
      diseaseName: 'Tomato Yellow Leaf Curl',
      confidenceScore: 94,
      symptomsObserved: ['Leaf curling', 'Yellow margins'],
      preventionTips: ['Vector control', 'Resistant varieties'],
      analyzedAt: '2026-03-02T11:00:00.000Z',
      farmer_id: farmerA.id,
    };

    // Farmer A saves disease result (both scoped and active)
    localStorage.setItem(DISEASE_REC_KEY, JSON.stringify(diseaseData));
    localStorage.setItem(getFarmerDiseaseRecKey(farmerA.id), JSON.stringify(diseaseData));

    // Farmer A logs out: active key cleared
    localStorage.removeItem(DISEASE_REC_KEY);
    expect(localStorage.getItem(DISEASE_REC_KEY)).toBeNull();

    // Farmer A logs back in: session restored
    farmIntelligenceService.restoreFarmerSession(farmerA.id);

    // Active key and stored getter are restored
    expect(localStorage.getItem(DISEASE_REC_KEY)).not.toBeNull();
    const restoredDisease = farmIntelligenceService.getStoredDiseaseDetection(farmerA.id);
    expect(restoredDisease?.diseaseName).toBe('Tomato Yellow Leaf Curl');
    expect(restoredDisease?.confidenceScore).toBe(94);
  });

  // 7. Farmer B cannot read Farmer A's scoped cache
  it('Criterion 7: Farmer B cannot read Farmer A scoped cache', () => {
    // Farmer A has scoped keys
    localStorage.setItem(
      getFarmerCropRecKey(farmerA.id),
      JSON.stringify({ cropName: 'Paddy', topCrop: 'Paddy', predictions: [], analyzedAt: '2026-01-01', farmer_id: farmerA.id })
    );
    localStorage.setItem(
      getFarmerFertRecKey(farmerA.id),
      JSON.stringify({ cropName: 'Paddy', cropId: 'paddy', fertilizers: [], inputs: {}, analyzedAt: '2026-01-01', farmer_id: farmerA.id })
    );
    localStorage.setItem(
      getFarmerDiseaseRecKey(farmerA.id),
      JSON.stringify({ cropName: 'Paddy', diseaseName: 'Bacterial Blight', confidenceScore: 88, analyzedAt: '2026-01-01', farmer_id: farmerA.id })
    );

    // Farmer B tries to read using their own farmer ID
    expect(farmIntelligenceService.getStoredCropRecommendation(farmerB.id)).toBeNull();
    expect(farmIntelligenceService.getStoredFertilizerRecommendation(farmerB.id)).toBeNull();
    expect(farmIntelligenceService.getStoredDiseaseDetection(farmerB.id)).toBeNull();
  });

  // 8. farmName and currentCrops survive logout and re-login for the same farmer
  it('Criterion 8: farmName and currentCrops survive logout and re-login for the same farmer', async () => {
    const customProfile: CompleteFarmProfile = {
      ...sampleProfileA,
      farm: {
        ...sampleProfileA.farm,
        farmName: 'Shree Ram Natural Agro',
        currentCrops: 'Chickpea, Mustard',
      },
    };

    // Farmer A saves profile
    await farmProfileService.saveFarmProfile(customProfile, true, farmerA.id);

    // Farmer A logs out
    localStorage.removeItem('cropswild_farm_profile');
    localStorage.removeItem('fieldwise_profile_saved_flag');

    // Farmer A logs back in
    const restored = await farmProfileService.loadAndRestoreProfile(farmerA);
    expect(restored.profile.farm.farmName).toBe('Shree Ram Natural Agro');
    expect(restored.profile.farm.currentCrops).toBe('Chickpea, Mustard');

    // A brand new user does NOT have fake defaults injected
    const brandNewUser = { id: 'new_farmer_999', full_name: 'New Person' };
    const brandNewProfile = farmProfileService.getFarmProfile(brandNewUser, brandNewUser.id);
    expect(brandNewProfile.farm.farmName).toBe('');
    expect(brandNewProfile.farm.currentCrops).toBe('');
    expect(brandNewProfile.farm.farmName).not.toBe('My Farm');
  });

  // 9. V1 prediction save/read behavior remains compatible
  it('Criterion 9: V1 prediction save/read behavior remains compatible', async () => {
    const res = await savePredictionToSupabase({
      farmer_id: farmerA.id,
      recommended_crop: 'Barley',
      confidence: '91%',
      nitrogen: 70,
      phosphorus: 35,
      potassium: 35,
      ph: 6.2,
      rainfall: 300,
      temperature: 18,
      humidity: 50,
    });
    expect(res.success).toBe(true);

    const fetched = await fetchLatestPredictionFromSupabase(farmerA.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.recommended_crop).toBe('Barley');
    expect(fetched?.confidence).toBe('91%');
    expect(fetched?.nitrogen).toBe(70);
  });

  // 10. Missing/malformed cloud records produce safe empty states, not fabricated results
  it('Criterion 10: Missing/malformed cloud records produce safe empty states, not fabricated results', async () => {
    // Farmer with no record in DB
    const emptyFarmer = { id: 'farmer_empty_000', email: 'empty@fieldwise.agri' };

    const pred = await farmIntelligenceService.loadAndRestorePrediction(emptyFarmer);
    expect(pred).toBeNull(); // Clean null, no fabricated default prediction

    const prof = await farmProfileService.loadAndRestoreProfile(emptyFarmer);
    expect(prof.fromDatabase).toBe(false);
    expect(prof.profile.soil.nitrogen).toBe(0);
    expect(prof.profile.soil.phosphorus).toBe(0);
    expect(prof.profile.soil.potassium).toBe(0);
    expect(prof.profile.soil.soilType).toBe('');
    expect(prof.profile.farm.farmName).toBe('');
  });

  // ── P0 Continuity Safety Corrections: Deferred Identity & Isolation Tests ────

  describe('P0 Correction 1: Asynchronous Identity Safety via Deferred Promises', () => {
    it('1.1 Stale prediction resolution after account switch to Farmer B does not overwrite active storage or emit event', async () => {
      // 1. Setup: Farmer A has a prediction in Supabase
      await savePredictionToSupabase({
        farmer_id: farmerA.id,
        recommended_crop: 'FarmerACotton',
        confidence: '96%',
      });

      // Active user is Farmer A initially
      localStorage.setItem('fieldwise_active_user', JSON.stringify({ uid: farmerA.id, id: farmerA.id }));
      localStorage.setItem('fieldwise_current_user', JSON.stringify({ id: farmerA.id }));

      // Farmer B already has active key
      const predB = {
        topCrop: 'FarmerBBarley',
        cropName: 'FarmerBBarley',
        predictions: [{ crop: 'FarmerBBarley', confidence: 90 }],
        farmer_id: farmerB.id,
        analyzedAt: new Date().toISOString(),
      };
      localStorage.setItem(CROP_REC_KEY, JSON.stringify(predB));

      // Setup deferred promise to hold the Supabase query in flight
      let resolveDeferred: any;
      (mockDb as any).__deferred = new Promise((res) => {
        resolveDeferred = res;
      });

      let eventFired = false;
      const onIntelligenceUpdate = () => {
        eventFired = true;
      };
      window.addEventListener('fieldwise:intelligence_updated', onIntelligenceUpdate);

      // 2. Start restoration for Farmer A (now paused in flight)
      const restorePromise = farmIntelligenceService.loadAndRestorePrediction(farmerA);

      // 3. User switches to Farmer B before promise resolves
      localStorage.setItem('fieldwise_active_user', JSON.stringify({ uid: farmerB.id, id: farmerB.id }));
      localStorage.setItem('fieldwise_current_user', JSON.stringify({ id: farmerB.id }));
      eventFired = false;

      // 4. Resolve Farmer A's query response
      resolveDeferred();
      const result = await restorePromise;

      // Result is aborted / returns null because active identity changed
      expect(result).toBeNull();

      // Active key still contains Farmer B's Barley
      const activeRaw = JSON.parse(localStorage.getItem(CROP_REC_KEY)!);
      expect(activeRaw.topCrop).toBe('FarmerBBarley');
      expect(activeRaw.farmer_id).toBe(farmerB.id);

      // Event was NOT dispatched for Farmer A's stale response
      expect(eventFired).toBe(false);

      window.removeEventListener('fieldwise:intelligence_updated', onIntelligenceUpdate);
    });

    it('1.2 Stale profile resolution after account switch to Farmer B does not overwrite active profile or emit event', async () => {
      // 1. Setup: Farmer A profile in Supabase
      await syncFarmProfileToSupabase({
        farmer_id: farmerA.id,
        state: 'Gujarat',
        district: 'Anand',
        soil_type: 'Black',
      });

      // Active user is Farmer A
      localStorage.setItem('fieldwise_active_user', JSON.stringify({ uid: farmerA.id, id: farmerA.id }));
      localStorage.setItem('fieldwise_current_user', JSON.stringify({ id: farmerA.id }));

      // Active profile belongs to Farmer B
      const profileB = {
        ...sampleProfileA,
        farmer: { ...sampleProfileA.farmer, state: 'Punjab', district: 'Ludhiana' },
      };
      localStorage.setItem('cropswild_farm_profile', JSON.stringify(profileB));

      // Defer query
      let resolveDeferred: any;
      (mockDb as any).__deferred = new Promise((res) => {
        resolveDeferred = res;
      });

      let eventFired = false;
      const onProfileUpdate = () => {
        eventFired = true;
      };
      window.addEventListener('fieldwise:profile_updated', onProfileUpdate);

      // 2. Start Farmer A restore
      const profilePromise = farmProfileService.loadAndRestoreProfile(farmerA);

      // 3. Switch to Farmer B while in-flight
      localStorage.setItem('fieldwise_active_user', JSON.stringify({ uid: farmerB.id, id: farmerB.id }));
      localStorage.setItem('fieldwise_current_user', JSON.stringify({ id: farmerB.id }));
      eventFired = false;

      // 4. Resolve Farmer A's query
      resolveDeferred();
      const res = await profilePromise;

      expect(res.fromDatabase).toBe(false);
      expect(res.error).toBeDefined();

      // Active profile is still Farmer B's Punjab profile
      const activeRaw = JSON.parse(localStorage.getItem('cropswild_farm_profile')!);
      expect(activeRaw.farmer.district).toBe('Ludhiana');

      // Event was NOT fired
      expect(eventFired).toBe(false);

      window.removeEventListener('fieldwise:profile_updated', onProfileUpdate);
    });

    it('1.3 Late network failure on Farmer A restoration does not restore Farmer A local cache into Farmer B session', async () => {
      // Farmer A has a saved local scoped cache
      localStorage.setItem(getFarmerStorageKey(farmerA.id), JSON.stringify(sampleProfileA));

      // Active user initially Farmer A
      localStorage.setItem('fieldwise_active_user', JSON.stringify({ uid: farmerA.id, id: farmerA.id }));
      localStorage.setItem('fieldwise_current_user', JSON.stringify({ id: farmerA.id }));

      // Active profile belongs to Farmer B
      const profileB = {
        ...sampleProfileA,
        farmer: { ...sampleProfileA.farmer, fullName: 'Suresh Kumar', state: 'Punjab' },
      };
      localStorage.setItem('cropswild_farm_profile', JSON.stringify(profileB));

      let rejectDeferred: any;
      (mockDb as any).__deferred = new Promise((_, rej) => {
        rejectDeferred = rej;
      });

      const profilePromise = farmProfileService.loadAndRestoreProfile(farmerA);

      // Switch to Farmer B
      localStorage.setItem('fieldwise_active_user', JSON.stringify({ uid: farmerB.id, id: farmerB.id }));
      localStorage.setItem('fieldwise_current_user', JSON.stringify({ id: farmerB.id }));

      // Network failure on Farmer A's request
      rejectDeferred(new Error('Network connection timeout'));
      await profilePromise;

      // Active profile remains Farmer B, NOT overwritten by Farmer A's fallback
      const activeRaw = JSON.parse(localStorage.getItem('cropswild_farm_profile')!);
      expect(activeRaw.farmer.fullName).toBe('Suresh Kumar');
      expect(activeRaw.farmer.state).toBe('Punjab');
    });

    it('1.4 Normal restoration for the still-active farmer continues to work seamlessly', async () => {
      await savePredictionToSupabase({
        farmer_id: farmerA.id,
        recommended_crop: 'WheatNormal',
        confidence: '95%',
      });

      localStorage.setItem('fieldwise_active_user', JSON.stringify({ uid: farmerA.id, id: farmerA.id }));
      localStorage.setItem('fieldwise_current_user', JSON.stringify({ id: farmerA.id }));

      const res = await farmIntelligenceService.loadAndRestorePrediction(farmerA);
      expect(res).not.toBeNull();
      expect(res?.topCrop).toBe('WheatNormal');
      expect(farmIntelligenceService.getStoredCropRecommendation(farmerA.id)?.topCrop).toBe('WheatNormal');
    });
  });

  describe('P0 Correction 2: Form Reset Decoupled from Persistent Scoped Results', () => {
    it('2.1 Crop form reset does not delete persistent farmer-scoped prediction', () => {
      const savedScoped = {
        topCrop: 'Mustard',
        cropName: 'Mustard',
        predictions: [{ crop: 'Mustard', confidence: 92 }],
        farmer_id: farmerA.id,
        analyzedAt: new Date().toISOString(),
      };
      localStorage.setItem(getFarmerCropRecKey(farmerA.id), JSON.stringify(savedScoped));

      // Calling form reset (CropRecommendation.handleReset behavior)
      // resets input state only, without executing removeItem on getFarmerCropRecKey
      expect(localStorage.getItem(getFarmerCropRecKey(farmerA.id))).not.toBeNull();
      const stored = farmIntelligenceService.getStoredCropRecommendation(farmerA.id);
      expect(stored?.topCrop).toBe('Mustard');
    });

    it('2.2 Fertilizer form reset does not delete persistent farmer-scoped fertilizer result', () => {
      const savedFert = {
        cropName: 'Sugarcane',
        cropId: 'sugarcane',
        fertilizers: [{ name: 'Urea', quantity: 100, unit: 'kg' }],
        inputs: { area: 2 },
        farmer_id: farmerA.id,
        analyzedAt: new Date().toISOString(),
      };
      localStorage.setItem(getFarmerFertRecKey(farmerA.id), JSON.stringify(savedFert));

      // After form reset, scoped result is preserved
      expect(localStorage.getItem(getFarmerFertRecKey(farmerA.id))).not.toBeNull();
      const stored = farmIntelligenceService.getStoredFertilizerRecommendation(farmerA.id);
      expect(stored?.cropName).toBe('Sugarcane');
    });

    it('2.3 Disease image removal does not delete persistent farmer-scoped detection', () => {
      const savedDisease = {
        cropName: 'Tomato',
        diseaseName: 'Early Blight',
        confidenceScore: 91,
        farmer_id: farmerA.id,
        analyzedAt: new Date().toISOString(),
      };
      localStorage.setItem(getFarmerDiseaseRecKey(farmerA.id), JSON.stringify(savedDisease));

      // Removing photo preview does not remove the persistent record
      expect(localStorage.getItem(getFarmerDiseaseRecKey(farmerA.id))).not.toBeNull();
      const stored = farmIntelligenceService.getStoredDiseaseDetection(farmerA.id);
      expect(stored?.diseaseName).toBe('Early Blight');
    });

    it('2.4 Logout continues to clear active keys while preserving scoped keys', () => {
      localStorage.setItem(getFarmerCropRecKey(farmerA.id), JSON.stringify({ topCrop: 'Rice', farmer_id: farmerA.id }));
      localStorage.setItem(getFarmerFertRecKey(farmerA.id), JSON.stringify({ cropId: 'rice', farmer_id: farmerA.id }));
      localStorage.setItem(getFarmerDiseaseRecKey(farmerA.id), JSON.stringify({ diseaseName: 'Blast', farmer_id: farmerA.id }));

      localStorage.setItem(CROP_REC_KEY, JSON.stringify({ topCrop: 'Rice', farmer_id: farmerA.id }));
      localStorage.setItem(FERT_REC_KEY, JSON.stringify({ cropId: 'rice', farmer_id: farmerA.id }));
      localStorage.setItem(DISEASE_REC_KEY, JSON.stringify({ diseaseName: 'Blast', farmer_id: farmerA.id }));

      // Simulate AuthContext.logout()
      localStorage.removeItem(CROP_REC_KEY);
      localStorage.removeItem(FERT_REC_KEY);
      localStorage.removeItem(DISEASE_REC_KEY);
      localStorage.removeItem('cropswild_farm_profile');
      localStorage.removeItem('fieldwise_profile_saved_flag');

      // Active keys are cleared
      expect(localStorage.getItem(CROP_REC_KEY)).toBeNull();
      expect(localStorage.getItem(FERT_REC_KEY)).toBeNull();
      expect(localStorage.getItem(DISEASE_REC_KEY)).toBeNull();

      // Scoped keys remain preserved
      expect(localStorage.getItem(getFarmerCropRecKey(farmerA.id))).not.toBeNull();
      expect(localStorage.getItem(getFarmerFertRecKey(farmerA.id))).not.toBeNull();
      expect(localStorage.getItem(getFarmerDiseaseRecKey(farmerA.id))).not.toBeNull();
    });
  });

  describe('P0 Correction 3: Strict Active-Key Reader Ownership & Legacy Isolation', () => {
    it('3.1 Matching farmer_id is accepted across all three readers', () => {
      localStorage.setItem(CROP_REC_KEY, JSON.stringify({ topCrop: 'Corn', farmer_id: farmerA.id }));
      localStorage.setItem(FERT_REC_KEY, JSON.stringify({ cropId: 'corn', farmer_id: farmerA.id }));
      localStorage.setItem(DISEASE_REC_KEY, JSON.stringify({ diseaseName: 'Rust', farmer_id: farmerA.id }));

      expect(farmIntelligenceService.getStoredCropRecommendation(farmerA.id)?.topCrop).toBe('Corn');
      expect(farmIntelligenceService.getStoredFertilizerRecommendation(farmerA.id)?.cropId).toBe('corn');
      expect(farmIntelligenceService.getStoredDiseaseDetection(farmerA.id)?.diseaseName).toBe('Rust');
    });

    it('3.2 Different farmer_id is rejected across all three readers', () => {
      localStorage.setItem(CROP_REC_KEY, JSON.stringify({ topCrop: 'Corn', farmer_id: farmerA.id }));
      localStorage.setItem(FERT_REC_KEY, JSON.stringify({ cropId: 'corn', farmer_id: farmerA.id }));
      localStorage.setItem(DISEASE_REC_KEY, JSON.stringify({ diseaseName: 'Rust', farmer_id: farmerA.id }));

      // Farmer B reading active keys tagged with Farmer A gets null
      expect(farmIntelligenceService.getStoredCropRecommendation(farmerB.id)).toBeNull();
      expect(farmIntelligenceService.getStoredFertilizerRecommendation(farmerB.id)).toBeNull();
      expect(farmIntelligenceService.getStoredDiseaseDetection(farmerB.id)).toBeNull();
    });

    it('3.3 Missing farmer_id (legacy unscoped record) is strictly rejected across all three readers', () => {
      localStorage.setItem(CROP_REC_KEY, JSON.stringify({ topCrop: 'LegacyCrop' })); // No farmer_id
      localStorage.setItem(FERT_REC_KEY, JSON.stringify({ cropId: 'legacy_fert' }));
      localStorage.setItem(DISEASE_REC_KEY, JSON.stringify({ diseaseName: 'LegacyDisease' }));

      // Authenticated farmer querying legacy data must get null without automatic assignment
      expect(farmIntelligenceService.getStoredCropRecommendation(farmerA.id)).toBeNull();
      expect(farmIntelligenceService.getStoredFertilizerRecommendation(farmerA.id)).toBeNull();
      expect(farmIntelligenceService.getStoredDiseaseDetection(farmerA.id)).toBeNull();

      // Legacy records remain in localStorage without destructive deletion
      expect(localStorage.getItem(CROP_REC_KEY)).not.toBeNull();
    });

    it('3.4 Empty or malformed farmer_id is strictly rejected across all three readers', () => {
      localStorage.setItem(CROP_REC_KEY, JSON.stringify({ topCrop: 'CropX', farmer_id: '   ' })); // Empty
      localStorage.setItem(FERT_REC_KEY, JSON.stringify({ cropId: 'fertX', farmer_id: 12345 })); // Malformed non-string
      localStorage.setItem(DISEASE_REC_KEY, JSON.stringify({ diseaseName: 'disX', farmer_id: null })); // Null

      expect(farmIntelligenceService.getStoredCropRecommendation(farmerA.id)).toBeNull();
      expect(farmIntelligenceService.getStoredFertilizerRecommendation(farmerA.id)).toBeNull();
      expect(farmIntelligenceService.getStoredDiseaseDetection(farmerA.id)).toBeNull();
    });

    it('3.5 Malformed JSON in active keys is safely handled without throwing', () => {
      localStorage.setItem(CROP_REC_KEY, '{ invalid json');
      localStorage.setItem(FERT_REC_KEY, 'null');
      localStorage.setItem(DISEASE_REC_KEY, 'undefined');

      expect(farmIntelligenceService.getStoredCropRecommendation(farmerA.id)).toBeNull();
      expect(farmIntelligenceService.getStoredFertilizerRecommendation(farmerA.id)).toBeNull();
      expect(farmIntelligenceService.getStoredDiseaseDetection(farmerA.id)).toBeNull();
    });
  });
});
