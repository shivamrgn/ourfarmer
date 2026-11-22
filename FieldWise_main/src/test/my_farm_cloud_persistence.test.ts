import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  farmProfileService,
  CompleteFarmProfile,
  getFarmerStorageKey,
} from '../services/farmProfileService';
import {
  syncFarmProfileToSupabase,
  syncFarmerToSupabase,
  fetchFarmProfileFromSupabase,
  fetchFarmerFromSupabase,
  getActiveFarmerId,
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

function resetMockDb() {
  mockDb.farmers.clear();
  mockDb.farm_profiles = [];
  mockDb.crop_predictions = [];
  delete (mockDb as any).__simulateNetworkFailure;
  delete (mockDb as any).__deferred;
}

// ── Mock @supabase/supabase-js with realistic PostgreSQL behavior ────────────
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: () => ({
      from: (table: string) => {
        let filterCol: string | null = null;
        let filterVal: any = null;
        let orderCol: string | null = null;
        let orderAsc = true;
        let limitVal: number | null = null;

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
              (mockDb as any).__deferred.then(execute);
            } else {
              execute();
            }
          },
        };
        return builder;
      },
    }),
  };
});

describe('FieldWise — P0 My Farm Cross-Browser Cloud Persistence & Safari Recovery', () => {
  const farmerA = {
    id: 'firebase_uid_farmer_safari_001',
    email: 'safari.farmer@fieldwise.agri',
    full_name: 'Rajesh Patel',
    phone: '+919876543210',
  };

  const farmerB = {
    id: 'firebase_uid_farmer_brave_002',
    email: 'brave.farmer@fieldwise.agri',
    full_name: 'Suresh Kumar',
    phone: '+919123456789',
  };

  const sampleCompleteProfile: CompleteFarmProfile = {
    farmer: {
      fullName: 'Rajesh Patel',
      phone: '+919876543210',
      email: 'safari.farmer@fieldwise.agri',
      state: 'Gujarat',
      district: 'Anand',
      village: 'Borsad Khurd',
      experienceYears: '15',
    },
    farm: {
      farmName: 'Patel Organic Sanctuary',
      farmSize: 7.5,
      farmSizeUnit: 'Acres',
      farmingMethod: 'Natural / ZBNF',
      irrigationType: 'Drip',
      currentCrops: 'Wheat, Mustard, Chickpea',
      previousCrops: 'Paddy, Groundnut',
    },
    conditions: {
      agroZone: 'Gujarat Plains and Hills (Zone 13)',
      waterAvailability: 'Moderate',
      rainfall: 850,
      temperature: 28,
      humidity: 62,
      topography: 'Plains / Flatlands',
      sunlightHours: 8,
    },
    soil: {
      soilType: 'Alluvial',
      ph: 7.2,
      nitrogen: 120,
      phosphorus: 55,
      potassium: 80,
      organicCarbon: 1.2,
    },
    updatedAt: '2026-03-10T10:00:00.000Z',
  };

  function setActiveFarmer(id: string) {
    localStorage.setItem('fieldwise_active_user', JSON.stringify({ uid: id, id }));
  }

  beforeEach(() => {
    resetMockDb();
    localStorage.clear();
    setActiveFarmer(farmerA.id);
  });

  // ── 1. Saving all five fields writes to cloud storage (mockDb.farm_profiles) ──
  it('1. Saving all five fields writes to cloud storage (mockDb.farm_profiles)', async () => {
    const saveResult = await farmProfileService.saveFarmProfile(sampleCompleteProfile, true, farmerA.id);
    expect(saveResult.success).toBe(true);

    // Verify row in cloud table
    const dbRow = mockDb.farm_profiles.find((r) => r.farmer_id === farmerA.id);
    expect(dbRow).toBeDefined();
    expect(dbRow.village_name).toBe('Borsad Khurd');
    expect(dbRow.farm_name).toBe('Patel Organic Sanctuary');
    expect(dbRow.current_crops).toBe('Wheat, Mustard, Chickpea');
    expect(dbRow.previous_crops).toBe('Paddy, Groundnut');
    expect(dbRow.agro_climatic_zone).toBe('Gujarat Plains and Hills (Zone 13)');
    expect(dbRow.soil_type).toBe('Alluvial');
    expect(dbRow.ph).toBe(7.2);
    expect(dbRow.nitrogen).toBe(120);
    expect(dbRow.rainfall).toBe(850);
  });

  // ── 2. Same Firebase UID restores all five fields in a clean browser session (simulating Brave) ──
  it('2. Same Firebase UID restores all five fields in a clean browser session (simulating Brave)', async () => {
    // 1. Saved in Safari
    await farmProfileService.saveFarmProfile(sampleCompleteProfile, true, farmerA.id);

    // 2. Simulate opening Brave: localStorage is completely empty
    localStorage.clear();
    expect(localStorage.getItem(getFarmerStorageKey(farmerA.id))).toBeNull();
    expect(localStorage.getItem('cropswild_farm_profile')).toBeNull();

    // 3. Farmer A logs into Brave with same Firebase UID
    const restoreResult = await farmProfileService.loadAndRestoreProfile(farmerA);

    expect(restoreResult.fromDatabase).toBe(true);
    expect(restoreResult.profile.farmer.village).toBe('Borsad Khurd');
    expect(restoreResult.profile.farm.farmName).toBe('Patel Organic Sanctuary');
    expect(restoreResult.profile.farm.currentCrops).toBe('Wheat, Mustard, Chickpea');
    expect(restoreResult.profile.farm.previousCrops).toBe('Paddy, Groundnut');
    expect(restoreResult.profile.conditions.agroZone).toBe('Gujarat Plains and Hills (Zone 13)');

    // 4. Verify Brave local storage is hydrated with scoped key
    const braveScoped = localStorage.getItem(getFarmerStorageKey(farmerA.id));
    expect(braveScoped).not.toBeNull();
    const parsedBrave = JSON.parse(braveScoped!);
    expect(parsedBrave.farmer.village).toBe('Borsad Khurd');
    expect(parsedBrave.farm.farmName).toBe('Patel Organic Sanctuary');
  });

  // ── 3. Empty fields do not overwrite existing cloud values accidentally on login ──
  it('3. Empty fields do not overwrite existing cloud values accidentally on login', async () => {
    // Cloud has existing full data
    await farmProfileService.saveFarmProfile(sampleCompleteProfile, true, farmerA.id);

    // Clean session: user object has empty/no farm data
    localStorage.clear();
    const userWithNoData = { id: farmerA.id, email: farmerA.email };

    // Login runs loadAndRestoreProfile
    const result = await farmProfileService.loadAndRestoreProfile(userWithNoData);

    // Cloud record remains intact
    const dbRow = mockDb.farm_profiles.find((r) => r.farmer_id === farmerA.id);
    expect(dbRow.village_name).toBe('Borsad Khurd');
    expect(dbRow.farm_name).toBe('Patel Organic Sanctuary');
    expect(result.profile.farmer.village).toBe('Borsad Khurd');
  });

  // ── 4. Explicitly clearing a field persists correctly to cloud as null/cleared ──
  it('4. Explicitly clearing a field persists correctly to cloud as null/cleared', async () => {
    // 1. Initial save with all fields
    await farmProfileService.saveFarmProfile(sampleCompleteProfile, true, farmerA.id);

    // 2. Farmer intentionally clears village and previousCrops in the form
    const updatedWithClearedFields: CompleteFarmProfile = {
      ...sampleCompleteProfile,
      farmer: { ...sampleCompleteProfile.farmer, village: '' },
      farm: { ...sampleCompleteProfile.farm, previousCrops: '' },
    };

    const saveRes = await farmProfileService.saveFarmProfile(updatedWithClearedFields, true, farmerA.id);
    expect(saveRes.success).toBe(true);

    // Cloud DB must reflect cleared fields as null
    const dbRow = mockDb.farm_profiles.find((r) => r.farmer_id === farmerA.id);
    expect(dbRow.village_name).toBeNull();
    expect(dbRow.previous_crops).toBeNull();
    // Non-cleared fields must remain intact
    expect(dbRow.farm_name).toBe('Patel Organic Sanctuary');
    expect(dbRow.current_crops).toBe('Wheat, Mustard, Chickpea');

    // Restore in clean session preserves the cleared state
    localStorage.clear();
    const restored = await farmProfileService.loadAndRestoreProfile(farmerA);
    expect(restored.profile.farmer.village).toBe('');
    expect(restored.profile.farm.previousCrops).toBe('');
    expect(restored.profile.farm.farmName).toBe('Patel Organic Sanctuary');
  });

  // ── 5. Safari legacy cache is migrated only for verified owner ──
  it('5. Safari legacy cache is migrated only for verified owner', async () => {
    // 1. Pre-migration cloud record: 5 fields are null in Supabase
    await syncFarmerToSupabase({
      id: farmerA.id,
      email: farmerA.email,
      full_name: farmerA.full_name,
    });
    mockDb.farm_profiles.push({
      id: 'legacy_row_001',
      farmer_id: farmerA.id,
      state: 'Gujarat',
      district: 'Anand',
      village_name: null,
      farm_name: null,
      current_crops: null,
      previous_crops: null,
      agro_climatic_zone: null,
      soil_type: 'Alluvial',
      ph: 7.0,
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    // 2. Safari local cache has legacy data with verified owner email/id
    const legacySafariCache = {
      farmerId: farmerA.id,
      farmer: { ...sampleCompleteProfile.farmer, village: 'Legacy Village' },
      farm: { ...sampleCompleteProfile.farm, farmName: 'Legacy Farm' },
      conditions: { ...sampleCompleteProfile.conditions, agroZone: 'Legacy Zone' },
      soil: sampleCompleteProfile.soil,
      isSaved: true,
      updatedAt: '2026-01-01T10:00:00.000Z',
    };
    localStorage.setItem('cropswild_farm_profile', JSON.stringify(legacySafariCache));

    // 3. Farmer A logs in on Safari: migrates legacy data
    const restoreRes = await farmProfileService.loadAndRestoreProfile(farmerA);
    expect(restoreRes.profile.farmer.village).toBe('Legacy Village');
    expect(restoreRes.profile.farm.farmName).toBe('Legacy Farm');

    // 4. Untagged cache test: another session with untagged/mismatched cache
    localStorage.clear();
    const untaggedCache = {
      farmer: { fullName: 'Stranger', email: 'stranger@other.com', village: 'Hacker Village' },
      farm: { farmName: 'Stranger Farm' },
      isSaved: true,
    };
    localStorage.setItem('cropswild_farm_profile', JSON.stringify(untaggedCache));

    const freshUser = { id: 'new_unique_uid_777', email: 'new.farmer@fieldwise.agri' };
    setActiveFarmer(freshUser.id);
    const freshRestore = await farmProfileService.loadAndRestoreProfile(freshUser);

    // Must NOT adopt stranger/untagged cache
    expect(freshRestore.profile.farmer.village).toBe('');
    expect(freshRestore.profile.farm.farmName).toBe('');
    expect(freshRestore.profile.farm.farmName).not.toBe('Stranger Farm');
  });

  // ── 6. Existing cloud values are not overwritten by stale cache ──
  it('6. Existing cloud values are not overwritten by stale cache', async () => {
    // 1. Cloud has newer record (updated 2026-03-15)
    mockDb.farm_profiles.push({
      id: 'cloud_row_newer',
      farmer_id: farmerA.id,
      state: 'Gujarat',
      district: 'Anand',
      village_name: 'Authoritative Cloud Village',
      farm_name: 'Authoritative Cloud Farm',
      current_crops: 'Cotton',
      previous_crops: 'Wheat',
      agro_climatic_zone: 'Zone 13',
      soil_type: 'Black',
      updated_at: '2026-03-15T12:00:00.000Z',
    });

    // 2. Local cache has stale record (updated 2026-01-01)
    const staleLocalProfile = {
      ...sampleCompleteProfile,
      farmer: { ...sampleCompleteProfile.farmer, village: 'Stale Local Village' },
      farm: { ...sampleCompleteProfile.farm, farmName: 'Stale Local Farm' },
      updatedAt: '2026-01-01T00:00:00.000Z',
      isSaved: true,
    };
    localStorage.setItem(getFarmerStorageKey(farmerA.id), JSON.stringify(staleLocalProfile));

    // 3. Restore on login
    const result = await farmProfileService.loadAndRestoreProfile(farmerA);

    expect(result.fromDatabase).toBe(true);
    expect(result.profile.farmer.village).toBe('Authoritative Cloud Village');
    expect(result.profile.farm.farmName).toBe('Authoritative Cloud Farm');
  });

  // ── 7. Conflicting local and cloud values are preserved and reported in conflicts ──
  it('7. Conflicting local and cloud values are preserved and reported in conflicts', async () => {
    // 1. Cloud has value A
    mockDb.farm_profiles.push({
      id: 'cloud_row_conflict',
      farmer_id: farmerA.id,
      state: 'Gujarat',
      district: 'Anand',
      village_name: 'Cloud Village Alpha',
      farm_name: 'Cloud Farm Alpha',
      current_crops: 'Soybean',
      previous_crops: 'Barley',
      agro_climatic_zone: 'Zone Alpha',
      updated_at: '2026-03-01T00:00:00.000Z',
    });

    // 2. Local cache has value B (with matching timestamp)
    const localWithDifferentValues = {
      ...sampleCompleteProfile,
      farmer: { ...sampleCompleteProfile.farmer, village: 'Local Village Beta' },
      farm: { ...sampleCompleteProfile.farm, farmName: 'Local Farm Beta' },
      updatedAt: '2026-03-01T00:00:00.000Z',
      isSaved: true,
    };
    localStorage.setItem(getFarmerStorageKey(farmerA.id), JSON.stringify(localWithDifferentValues));

    // 3. Restore
    const result = await farmProfileService.loadAndRestoreProfile(farmerA);

    // Cloud value wins for active profile
    expect(result.profile.farmer.village).toBe('Cloud Village Alpha');
    expect(result.profile.farm.farmName).toBe('Cloud Farm Alpha');

    // Conflicts are documented
    expect(result.conflicts).toBeDefined();
    expect(result.conflicts?.village_name).toEqual({
      cloud: 'Cloud Village Alpha',
      local: 'Local Village Beta',
    });
    expect(result.conflicts?.farm_name).toEqual({
      cloud: 'Cloud Farm Alpha',
      local: 'Local Farm Beta',
    });
  });

  // ── 8. Farmer A cannot read or update Farmer B farm profile (cross-farmer isolation) ──
  it('8. Farmer A cannot read or update Farmer B farm profile (cross-farmer isolation)', async () => {
    // Farmer A saves profile
    setActiveFarmer(farmerA.id);
    await farmProfileService.saveFarmProfile(sampleCompleteProfile, true, farmerA.id);

    // Farmer B saves different profile
    setActiveFarmer(farmerB.id);
    const farmerBProfile: CompleteFarmProfile = {
      ...sampleCompleteProfile,
      farmer: { ...sampleCompleteProfile.farmer, fullName: farmerB.full_name, email: farmerB.email, village: 'Brave Village B' },
      farm: { ...sampleCompleteProfile.farm, farmName: 'Brave Land B' },
    };
    await farmProfileService.saveFarmProfile(farmerBProfile, true, farmerB.id);

    // Verify isolation in mockDb
    const rowA = mockDb.farm_profiles.find((r) => r.farmer_id === farmerA.id);
    const rowB = mockDb.farm_profiles.find((r) => r.farmer_id === farmerB.id);

    expect(rowA.village_name).toBe('Borsad Khurd');
    expect(rowB.village_name).toBe('Brave Village B');
    expect(rowA.farm_name).toBe('Patel Organic Sanctuary');
    expect(rowB.farm_name).toBe('Brave Land B');

    // Farmer B restores: only sees Farmer B data
    localStorage.clear();
    setActiveFarmer(farmerB.id);
    const resultB = await farmProfileService.loadAndRestoreProfile(farmerB);
    expect(resultB.profile.farmer.village).toBe('Brave Village B');
    expect(resultB.profile.farm.farmName).toBe('Brave Land B');
  });

  // ── 9. Async identity changes cannot write Farmer A data under Farmer B ──
  it('9. Async identity changes cannot write Farmer A data under Farmer B', async () => {
    setActiveFarmer(farmerA.id);

    // Save profile for Farmer A
    await farmProfileService.saveFarmProfile(sampleCompleteProfile, true, farmerA.id);

    // Start restore for Farmer A, but simulate deferred resolution during which user switches to Farmer B
    let finishDeferred: () => void = () => {};
    (mockDb as any).__deferred = new Promise<void>((resolve) => {
      finishDeferred = resolve;
    });

    const restorePromise = farmProfileService.loadAndRestoreProfile(farmerA);

    // User switches to Farmer B while query is pending
    setActiveFarmer(farmerB.id);

    // Now complete the DB query
    finishDeferred();
    delete (mockDb as any).__deferred;

    const result = await restorePromise;

    // Stale operation must abort and not write Farmer A's data under Farmer B
    expect(result.error).toMatch(/Identity changed/);
    expect(localStorage.getItem(getFarmerStorageKey(farmerB.id))).toBeNull();
  });

  // ── 10. Logout and re-login preserve cloud profile information across clean sessions ──
  it('10. Logout and re-login preserve cloud profile information across clean sessions', async () => {
    // 1. Initial save in Safari
    await farmProfileService.saveFarmProfile(sampleCompleteProfile, true, farmerA.id);

    // 2. Farmer logs out
    farmProfileService.resetProfile(farmerA.id);
    localStorage.clear();

    // 3. Farmer logs in again (new clean session)
    const reLoginResult = await farmProfileService.loadAndRestoreProfile(farmerA);

    expect(reLoginResult.fromDatabase).toBe(true);
    expect(reLoginResult.profile.farmer.village).toBe('Borsad Khurd');
    expect(reLoginResult.profile.farm.farmName).toBe('Patel Organic Sanctuary');
    expect(reLoginResult.profile.farm.currentCrops).toBe('Wheat, Mustard, Chickpea');
    expect(reLoginResult.profile.farm.previousCrops).toBe('Paddy, Groundnut');
    expect(reLoginResult.profile.conditions.agroZone).toBe('Gujarat Plains and Hills (Zone 13)');
  });
});
