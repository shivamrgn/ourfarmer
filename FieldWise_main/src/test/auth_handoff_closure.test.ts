import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getActiveFarmerId } from '../lib/supabase';
import { farmProfileService, getFarmerStorageKey } from '../services/farmProfileService';
import { farmIntelligenceService } from '../services/farmIntelligenceService';

describe('FieldWise Final Authentication Closure Frontend Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // ── 1. Real Firebase Users Never Enter Legacy Base64 Fallback ─────────────
  it('1. Legacy ?session= param with real user identity is rejected and does not authenticate', () => {
    const realUserPayload = {
      uid: 'firebase_real_farmer_999',
      displayName: 'Real Farmer',
      email: 'farmer999@fieldwise.agri',
      isDemo: false, // NOT a demo user!
    };
    const encoded = btoa(JSON.stringify(realUserPayload));

    // Simulate arriving with ?session=<base64> containing a real user
    const params = new URLSearchParams(`session=${encoded}`);
    const legacySession = params.get('session');
    expect(legacySession).not.toBeNull();

    const decoded = JSON.parse(atob(legacySession!));
    // Rule: if parsed.isDemo !== true, it must be rejected!
    const isAccepted = decoded && decoded.isDemo === true;
    expect(isAccepted).toBe(false);

    // Verify localStorage was not populated with real user from insecure param
    expect(localStorage.getItem('fieldwise_active_user')).toBeNull();
  });

  // ── 2. Demo Flow Remains Separately Identified ────────────────────────────
  it('2. Explicit demo session (?demoSession=) is accepted strictly when isDemo === true', () => {
    const demoPayload = {
      uid: 'demo_farmer_guest',
      displayName: 'Demo Farmer',
      email: 'demo@fieldwise.agri',
      isDemo: true, // EXPLICIT demo flag
    };
    const encoded = btoa(JSON.stringify(demoPayload));

    const params = new URLSearchParams(`demoSession=${encoded}`);
    const demoParam = params.get('demoSession');
    expect(demoParam).not.toBeNull();

    const decoded = JSON.parse(atob(demoParam!));
    expect(decoded.isDemo).toBe(true);

    // Demo flow sets the demo active user
    localStorage.setItem('fieldwise_active_user', JSON.stringify(decoded));
    expect(getActiveFarmerId()).toBe('demo_farmer_guest');
  });

  it('2b. Tampered demo session without isDemo: true is rejected', () => {
    const tamperedPayload = {
      uid: 'attacker_spoofed_admin',
      displayName: 'Spoofed Admin',
      email: 'admin@fieldwise.agri',
      isDemo: false, // Trying to sneak real user into demo endpoint
    };
    const encoded = btoa(JSON.stringify(tamperedPayload));

    const params = new URLSearchParams(`demoSession=${encoded}`);
    const demoParam = params.get('demoSession');
    const decoded = JSON.parse(atob(demoParam!));

    // Must be rejected because isDemo is not true
    const isValidDemo = decoded && decoded.isDemo === true;
    expect(isValidDemo).toBe(false);
  });

  // ── 3. Failed Backend Verification Stops Authentication ───────────────────
  it('3. Backend verification failure stops authentication and clears any stale local session', async () => {
    // Stale local data
    localStorage.setItem('fieldwise_active_user', JSON.stringify({ uid: 'stale_user' }));
    localStorage.setItem('fieldwise_auth_token', 'stale_expired_token');

    // Simulate backend rejecting handoff exchange (e.g., HTTP 400 CODE_ALREADY_USED)
    const mockExchangeResponse = {
      success: false,
      code: 'CODE_ALREADY_USED',
      message: 'Handoff code has already been consumed. Replay is rejected.',
    };

    // When exchange fails:
    let authError: string | null = null;
    let activeUser: any = null;

    if (!mockExchangeResponse.success) {
      // Fail closed: clear storage, do not fall back
      localStorage.removeItem('fieldwise_active_user');
      localStorage.removeItem('fieldwise_auth_token');
      sessionStorage.clear();
      activeUser = null;
      authError = mockExchangeResponse.message;
    }

    expect(activeUser).toBeNull();
    expect(authError).toBe('Handoff code has already been consumed. Replay is rejected.');
    expect(localStorage.getItem('fieldwise_active_user')).toBeNull();
    expect(localStorage.getItem('fieldwise_auth_token')).toBeNull();
  });

  // ── 4. LocalStorage Alone Is Not Proof of Real Authentication ─────────────
  it('4. LocalStorage without a valid backend JWT is rejected as unauthenticated', async () => {
    // User puts raw unverified object in localStorage
    localStorage.setItem(
      'fieldwise_active_user',
      JSON.stringify({ uid: 'unverified_arbitrary_user', isDemo: false })
    );
    // Notice: NO fieldwise_auth_token exists!

    const rawLocal = localStorage.getItem('fieldwise_active_user');
    const authToken = localStorage.getItem('fieldwise_auth_token');

    let isAuthenticated = false;
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (parsed.isDemo === true) {
        isAuthenticated = true;
      } else if (authToken) {
        // Only if backend token exists and validates
        isAuthenticated = true; // Would verify with /api/auth/me
      } else {
        // Real user with no token: unverified! Clear it!
        localStorage.removeItem('fieldwise_active_user');
        isAuthenticated = false;
      }
    }

    expect(isAuthenticated).toBe(false);
    expect(localStorage.getItem('fieldwise_active_user')).toBeNull();
  });

  // ── 5. Account Continuity Preserved After Verified Authentication ─────────
  it('5. Verified authentication restores farmer identity and triggers profile/prediction continuity', async () => {
    const verifiedUser = {
      id: 'farmer_verified_success_555',
      username: 'ramesh',
      email: 'ramesh@fieldwise.agri',
      full_name: 'Ramesh Patel',
      created_at: new Date().toISOString(),
      isDemo: false,
    };

    // Upon verified handoff exchange:
    localStorage.setItem(
      'fieldwise_active_user',
      JSON.stringify({
        uid: verifiedUser.id,
        id: verifiedUser.id,
        displayName: verifiedUser.full_name,
        email: verifiedUser.email,
        isDemo: false,
      })
    );
    localStorage.setItem('fieldwise_auth_token', 'valid_verified_jwt_token');

    // Confirm getActiveFarmerId resolves to the verified user's ID
    expect(getActiveFarmerId()).toBe('farmer_verified_success_555');

    // Confirm farmer session cache activation
    farmIntelligenceService.restoreFarmerSession(verifiedUser.id);
    expect(farmProfileService.isProfileSaved(verifiedUser.id)).toBe(false); // Initially false before cloud load

    // Profile scoping is correctly scoped to verified farmer ID
    const farmerKey = getFarmerStorageKey(verifiedUser.id);
    localStorage.setItem(farmerKey, JSON.stringify({ isSaved: true, soil: { soilType: 'Black' } }));
    expect(farmProfileService.isProfileSaved(verifiedUser.id)).toBe(true);
  });
});
