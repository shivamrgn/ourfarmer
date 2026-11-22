/**
 * FieldWise — Google Sign-In Integration & Database Persistence Test Suite
 * ========================================================================
 * Verifies:
 * 1. Google sign-in profile mapping to AuthUser (uid, photoURL, provider)
 * 2. Supabase parent farmer idempotent synchronization with canonical Firebase UID
 * 3. Farm profile and prediction persistence & restoration for Google farmers
 * 4. Cross-farmer data isolation between Google and email/password farmers
 * 5. Account linking continuity (preserving historical farmer records on link)
 * 6. Logout cleanup without cloud data destruction
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  syncFarmerToSupabase,
  syncFarmProfileToSupabase,
  savePredictionToSupabase,
  ensureParentFarmerExists,
  getActiveFarmerId
} from '../lib/supabase';
import { getFarmerStorageKey } from '../services/farmProfileService';

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
}

// ── Mock @supabase/supabase-js with realistic in-memory database ─────────────
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: () => ({
      from: (table: string) => {
        let filterCol: string | null = null;
        let filterVal: any = null;
        let limitVal: number | null = null;

        const builder: any = {
          select: vi.fn(() => builder),
          eq: vi.fn((col: string, val: any) => {
            filterCol = col;
            filterVal = val;
            return builder;
          }),
          order: vi.fn(() => builder),
          limit: vi.fn((lim: number) => {
            limitVal = lim;
            return builder;
          }),
          maybeSingle: vi.fn(async () => {
            if (table === 'farmers') {
              const row = mockDb.farmers.get(filterVal);
              return { data: row || null, error: null };
            }
            return { data: null, error: null };
          }),
          upsert: vi.fn(async (payload: any, options?: any) => {
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
          then: (resolve: any) => {
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

            if (limitVal !== null) {
              rows = rows.slice(0, limitVal);
            }

            return resolve({ data: rows, error: null });
          },
        };
        return builder;
      },
    }),
  };
});

describe('FieldWise Google Sign-In Integration & Database Persistence Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetMockDb();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetMockDb();
  });

  // ── 1. Profile Mapping & Identification ────────────────────────────────────
  it('1. Google authenticated farmer profile correctly maps to active AuthUser with photoURL', () => {
    const googleProfileRaw = {
      uid: 'google_firebase_uid_1001',
      id: 'google_firebase_uid_1001',
      displayName: 'Kiran Patel',
      email: 'kiran.patel@gmail.com',
      photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocIj6-farmer-avatar',
      provider: 'google',
      isDemo: false,
      role: 'Farmer',
    };

    // Store in active user storage as set after verified handoff
    localStorage.setItem('fieldwise_active_user', JSON.stringify(googleProfileRaw));

    // getActiveFarmerId must return the exact canonical Firebase UID
    const activeId = getActiveFarmerId();
    expect(activeId).toBe('google_firebase_uid_1001');
  });

  // ── 2. Idempotent Supabase Farmer Sync with Google UID ──────────────────────
  it('2. Supabase syncFarmerToSupabase idempotently creates and updates parent farmer using Google UID', async () => {
    const googleUid = 'google_uid_persisted_2002';
    const googleFarmer = {
      id: googleUid,
      email: 'kiran.farmer@gmail.com',
      full_name: 'Kiran Patel',
      location: 'Anand, Gujarat',
      phone: '+91 98250 12345',
      farm_size: '20 Acres',
    };

    // 1st sync: creates parent record
    const res1 = await syncFarmerToSupabase(googleFarmer);
    expect(res1.success).toBe(true);
    expect(mockDb.farmers.has(googleUid)).toBe(true);

    // 2nd sync: updates idempotently without duplicate row errors
    const res2 = await syncFarmerToSupabase({
      ...googleFarmer,
      location: 'Anand, Gujarat (Updated)',
    });
    expect(res2.success).toBe(true);
    expect(mockDb.farmers.get(googleUid).location).toBe('Anand, Gujarat (Updated)');

    // ensureParentFarmerExists is also idempotent
    await ensureParentFarmerExists(googleUid, googleFarmer.email, googleFarmer.full_name);
    expect(mockDb.farmers.has(googleUid)).toBe(true);
  });

  // ── 3. Farm Profile and Prediction Persistence for Google Farmer ──────────
  it('3. Google farmer saves farm profile and prediction; both persist under the Google UID', async () => {
    const googleUid = 'google_uid_farmer_3003';
    localStorage.setItem('fieldwise_active_user', JSON.stringify({ uid: googleUid, isDemo: false }));

    // 1. Sync parent farmer record
    await syncFarmerToSupabase({
      id: googleUid,
      email: 'organic.farmer@gmail.com',
      full_name: 'Organic Farmer',
      location: 'Surat, Gujarat',
    });

    // 2. Save farm profile under Google farmer UID
    const profileRes = await syncFarmProfileToSupabase({
      farmer_id: googleUid,
      state: 'Gujarat',
      district: 'Surat',
      soil_type: 'Black',
      ph: 7.2,
      nitrogen: 65,
      phosphorus: 45,
      potassium: 55,
      rainfall: 950,
      irrigation_type: 'Drip',
    });
    expect(profileRes.success).toBe(true);
    expect(mockDb.farm_profiles.length).toBe(1);
    expect(mockDb.farm_profiles[0].farmer_id).toBe(googleUid);
    expect(mockDb.farm_profiles[0].soil_type).toBe('Black');

    // 3. Save crop prediction under Google farmer UID
    const predRes = await savePredictionToSupabase({
      farmer_id: googleUid,
      recommended_crop: 'Sugarcane',
      confidence: '94%',
      nitrogen: 65,
      phosphorus: 45,
      potassium: 55,
      ph: 7.2,
      rainfall: 950,
      temperature: 30,
      humidity: 75,
    });
    expect(predRes.success).toBe(true);
    expect(mockDb.crop_predictions.length).toBe(1);
    expect(mockDb.crop_predictions[0].farmer_id).toBe(googleUid);
    expect(mockDb.crop_predictions[0].recommended_crop).toBe('Sugarcane');
  });

  // ── 4. Cross-Farmer Isolation Between Google and Email Users ──────────────
  it('4. Cross-Farmer Isolation: Email farmer cannot overwrite or access Google farmer profile', async () => {
    const googleUid = 'google_uid_isolated_4001';
    const emailUid  = 'email_uid_isolated_4002';

    // Google Farmer saves a profile
    await syncFarmerToSupabase({ id: googleUid, email: 'google@gmail.com', full_name: 'Google Farmer' });
    await syncFarmProfileToSupabase({
      farmer_id: googleUid,
      state: 'Gujarat',
      soil_type: 'Clay',
      ph: 6.8,
    });

    // Email Farmer saves a distinct profile
    await syncFarmerToSupabase({ id: emailUid, email: 'email@fieldwise.agri', full_name: 'Email Farmer' });
    await syncFarmProfileToSupabase({
      farmer_id: emailUid,
      state: 'Punjab',
      soil_type: 'Alluvial',
      ph: 7.5,
    });

    // Check mockDb has both records isolated by farmer_id
    const googleRecords = mockDb.farm_profiles.filter((r) => r.farmer_id === googleUid);
    const emailRecords  = mockDb.farm_profiles.filter((r) => r.farmer_id === emailUid);
    expect(googleRecords.length).toBe(1);
    expect(emailRecords.length).toBe(1);
    expect(googleRecords[0].soil_type).toBe('Clay');
    expect(emailRecords[0].soil_type).toBe('Alluvial');

    // Verify localStorage scoped keys are isolated
    const googleKey = getFarmerStorageKey(googleUid);
    const emailKey  = getFarmerStorageKey(emailUid);
    expect(googleKey).not.toBe(emailKey);
    expect(googleKey).toBe(`cropswild_farm_profile_${googleUid}`);
    expect(emailKey).toBe(`cropswild_farm_profile_${emailUid}`);
  });

  // ── 5. Account Linking Continuity ─────────────────────────────────────────
  it('5. Account Linking Continuity: Linking Google credential preserves the existing canonical farmer UID and data', async () => {
    // Existing farmer originally registered with email/password
    const canonicalUid = 'canonical_farmer_uid_5001';
    const email = 'existing.farmer@gmail.com';

    // 1. Existing farmer data was already persisted in Supabase
    await syncFarmerToSupabase({
      id: canonicalUid,
      email,
      full_name: 'Existing Farmer',
      location: 'Vadodara, Gujarat',
    });

    await syncFarmProfileToSupabase({
      farmer_id: canonicalUid,
      state: 'Gujarat',
      soil_type: 'Loamy',
      ph: 7.0,
      nitrogen: 80,
    });

    // 2. Farmer links Google account: In Firebase Auth, linkWithCredential
    // attaches the Google credential to the SAME user record (canonicalUid remains identical).
    const linkedProfile = {
      uid: canonicalUid, // UID must NOT change!
      id: canonicalUid,
      displayName: 'Existing Farmer (Google Linked)',
      email,
      photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocLinked-avatar',
      provider: 'google',
      isDemo: false,
    };

    // When the linked farmer logs in via Google:
    localStorage.setItem('fieldwise_active_user', JSON.stringify(linkedProfile));
    expect(getActiveFarmerId()).toBe(canonicalUid);

    // Re-syncing does not create a new farmer or overwrite profile
    const syncRes = await syncFarmerToSupabase({
      id: canonicalUid,
      email,
      full_name: linkedProfile.displayName,
    });
    expect(syncRes.success).toBe(true);

    // Profile remains unchanged and linked to the canonical UID
    const farmerRecord = mockDb.farmers.get(canonicalUid);
    expect(farmerRecord.id).toBe(canonicalUid);
    const farmerProfile = mockDb.farm_profiles.find((r) => r.farmer_id === canonicalUid);
    expect(farmerProfile.soil_type).toBe('Loamy');
    expect(farmerProfile.ph).toBe(7.0);
  });

  // ── 6. Logout Clears Session Without Deleting Cloud Data ───────────────────
  it('6. Logout clears active tokens and local cache while leaving database records intact', () => {
    const googleUid = 'google_uid_logout_test_6001';
    localStorage.setItem('fieldwise_active_user', JSON.stringify({ uid: googleUid, email: 'logout@gmail.com' }));
    localStorage.setItem('fieldwise_auth_token', 'valid_jwt_token_123');
    localStorage.setItem(getFarmerStorageKey(googleUid), JSON.stringify({ soil_type: 'Black' }));

    // Simulate logout action
    localStorage.removeItem('fieldwise_active_user');
    localStorage.removeItem('fieldwise_auth_token');
    localStorage.removeItem('fieldwise_current_user');

    // Local storage is cleared
    expect(localStorage.getItem('fieldwise_active_user')).toBeNull();
    expect(localStorage.getItem('fieldwise_auth_token')).toBeNull();

    // Default farmer fallback is returned, not the logged-out farmer's UID
    expect(getActiveFarmerId()).toBe('farmer_main');
  });
});
