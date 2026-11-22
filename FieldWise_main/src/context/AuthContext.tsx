import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { syncFarmerToSupabase, syncCurrentStateToSupabase } from "../lib/supabase";
import { farmProfileService } from "../services/farmProfileService";
import { farmIntelligenceService } from "../services/farmIntelligenceService";

// ── Session TTL (must match firebase.js in FieldWise_landing) ─────────────────
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  full_name: string;
  phone?: string;
  location?: string;
  farm_size?: string;
  photoURL?: string;
  created_at: string;
  isDemo?: boolean;
};

const DEFAULT_FARMER: AuthUser = {
  id: 'farmer_main',
  username: 'farmer',
  email: 'farmer@fieldwise.agri',
  full_name: 'Farmer Partner',
  phone: '+91 98765 43210',
  location: 'Vadodara, Gujarat',
  farm_size: '15 Acres',
  created_at: new Date().toISOString()
};

type AuthContextValue = {
  user: AuthUser;
  login: (username: string, password: string) => Promise<boolean>;
  register: (
    username: string,
    email: string,
    password: string,
    full_name: string,
    phone?: string,
    location?: string,
    farm_size?: string
  ) => Promise<boolean>;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => Promise<boolean>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Storage Keys ─────────────────────────────────────────────────────────────
const LANDING_STORAGE_KEY = "fieldwise_active_user";
const EXPIRY_STORAGE_KEY  = "fieldwise_session_expiry";
const TAB_SESSION_KEY     = "fieldwise_tab_session";
const AUTH_TOKEN_KEY      = "fieldwise_auth_token";

/** Clear session keys from localStorage and sessionStorage. */
function clearStoredSession() {
  try {
    sessionStorage.removeItem(TAB_SESSION_KEY);
  } catch { /* ignore */ }
  localStorage.removeItem(LANDING_STORAGE_KEY);
  localStorage.removeItem(EXPIRY_STORAGE_KEY);
}

// ── FieldWise_landing URL (override in .env as VITE_LANDING_APP_URL) ──────────
const LANDING_APP_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_LANDING_APP_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname || "localhost"}:5173`
    : "http://localhost:5173");

// ── Backend API base URL ───────────────────────────────────────────────────────
const API_BASE_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL || "http://localhost:3001";

// ── Map profile shape → AuthUser ──────────────────────────────────────────────
function mapFirebaseProfile(raw: Record<string, unknown>): AuthUser {
  return {
    id:        String(raw.uid         || raw.id         || "farmer_main"),
    username:  String(raw.displayName || raw.username   || raw.email || "farmer"),
    email:     String(raw.email       || ""),
    full_name: String(raw.displayName || raw.full_name  || raw.name  || "Farmer"),
    phone:     raw.contact_no ? String(raw.contact_no) : (raw.phone ? String(raw.phone) : undefined),
    location:  raw.address    ? String(raw.address)    : (raw.location ? String(raw.location) : undefined),
    farm_size: raw.farm_size  ? String(raw.farm_size)  : undefined,
    photoURL:  raw.photoURL   ? String(raw.photoURL)   : undefined,
    created_at: String(raw.created_at || new Date().toISOString()),
    isDemo:    Boolean(raw.isDemo),
  };
}

// ── Robust base64 UTF-8 decoder ──────────────────────────────────────────────
function decodeSessionString(encoded: string): Record<string, unknown> | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    try {
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decoded = new TextDecoder().decode(bytes);
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

/**
 * Exchange a single-use handoff code with the backend for verified identity.
 * The handoff code is invalidated immediately by the backend upon consumption.
 */
async function exchangeHandoffCode(handoffCode: string): Promise<{
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/handoff/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handoffCode }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      token?: string;
      user?: Record<string, unknown>;
      code?: string;
      message?: string;
    };

    if (!res.ok || !data.success || !data.user) {
      return {
        success: false,
        error: data.message || `Handoff exchange rejected (HTTP ${res.status}).`,
      };
    }

    return {
      success: true,
      token: data.token,
      user: mapFirebaseProfile(data.user),
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error during authentication verification: ${(err as Error).message}`,
    };
  }
}

/**
 * Verify an existing backend session token against /api/auth/me.
 * Used to validate page reloads without treating raw localStorage as proof of authentication.
 */
async function verifyBackendSession(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      user?: Record<string, unknown>;
    };
    if (!data.success || !data.user) return null;
    return mapFirebaseProfile(data.user);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);

  // ── Authentication Bootstrap Effect (Runs once on mount) ─────────────────────
  useEffect(() => {
    let isCancelled = false;

    async function bootstrapAuth() {
      const params = new URLSearchParams(window.location.search);
      const handoffCode = params.get("handoffCode");
      const demoSession = params.get("demoSession");
      const legacySession = params.get("session");

      // ── Priority 1: Secure Single-Use Handoff Code (Real Firebase Users) ───
      if (handoffCode) {
        // Immediately scrub the code from browser URL and history
        window.history.replaceState({}, "", window.location.pathname);

        const result = await exchangeHandoffCode(handoffCode);
        if (isCancelled) return;

        if (result.success && result.user) {
          // Store verified backend token and active farmer session
          if (result.token) {
            localStorage.setItem(AUTH_TOKEN_KEY, result.token);
          }
          const rawSession = {
            uid: result.user.id,
            id: result.user.id,
            displayName: result.user.full_name,
            email: result.user.email,
            photoURL: result.user.photoURL,
            isDemo: false,
          };
          localStorage.setItem(LANDING_STORAGE_KEY, JSON.stringify(rawSession));
          localStorage.setItem(EXPIRY_STORAGE_KEY, String(Date.now() + SESSION_TTL_MS));
          try {
            sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify(rawSession));
          } catch { /* ignore */ }

          setUser(result.user);
          setAuthError(null);
          setInitializing(false);
          return;
        }

        // FAIL CLOSED: If handoff code exchange fails, stop authentication completely!
        // Never fall back to localStorage or ?session=<base64>!
        clearStoredSession();
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setUser(null);
        setAuthError(result.error || "Authentication verification failed. Please log in again.");
        setInitializing(false);
        return;
      }

      // ── Priority 2: Explicit Demo Session (Demo Flow Only) ──────────────────
      if (demoSession) {
        window.history.replaceState({}, "", window.location.pathname);
        const demoData = decodeSessionString(demoSession);

        if (demoData && demoData.isDemo === true) {
          const mappedDemo = mapFirebaseProfile(demoData);
          localStorage.setItem(LANDING_STORAGE_KEY, JSON.stringify(demoData));
          localStorage.setItem(EXPIRY_STORAGE_KEY, String(Date.now() + SESSION_TTL_MS));
          try {
            sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify(demoData));
          } catch { /* ignore */ }

          setUser(mappedDemo);
          setAuthError(null);
          setInitializing(false);
          return;
        }

        // Demo endpoint attempted with non-demo payload
        clearStoredSession();
        setUser(null);
        setAuthError("Unauthorized session: demo flow requires explicitly identified demo credentials.");
        setInitializing(false);
        return;
      }

      // ── Priority 3: Legacy ?session= param (Reject for Real Firebase Users) ─
      if (legacySession) {
        window.history.replaceState({}, "", window.location.pathname);
        const parsed = decodeSessionString(legacySession);

        // Allow strictly if explicitly a demo user
        if (parsed && parsed.isDemo === true) {
          const mappedDemo = mapFirebaseProfile(parsed);
          localStorage.setItem(LANDING_STORAGE_KEY, JSON.stringify(parsed));
          localStorage.setItem(EXPIRY_STORAGE_KEY, String(Date.now() + SESSION_TTL_MS));
          setUser(mappedDemo);
          setAuthError(null);
          setInitializing(false);
          return;
        }

        // FAIL CLOSED: Real users must never authenticate via legacy Base64 URL param
        clearStoredSession();
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setUser(null);
        setAuthError("Insecure session rejected: real accounts must authenticate via secure handoff from the login portal.");
        setInitializing(false);
        return;
      }

      // ── Priority 4: Existing Session Check (Page Reload) ────────────────────
      // Do not treat localStorage alone as proof of real authentication.
      const rawLocal = localStorage.getItem(LANDING_STORAGE_KEY);
      const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
      const expiry = Number(localStorage.getItem(EXPIRY_STORAGE_KEY) || 0);

      if (rawLocal && (!expiry || Date.now() < expiry)) {
        try {
          const parsed = JSON.parse(rawLocal);

          // Explicit demo users can maintain active demo session without backend JWT
          if (parsed && parsed.isDemo === true) {
            setUser(mapFirebaseProfile(parsed));
            setInitializing(false);
            return;
          }

          // Real users MUST have a verified backend session token
          if (authToken) {
            const verifiedUser = await verifyBackendSession(authToken);
            if (isCancelled) return;

            if (verifiedUser) {
              setUser(verifiedUser);
              setInitializing(false);
              return;
            }
          }

          // LocalStorage exists without a valid backend token -> cannot be trusted
          clearStoredSession();
          localStorage.removeItem(AUTH_TOKEN_KEY);
          setUser(null);
        } catch {
          clearStoredSession();
          localStorage.removeItem(AUTH_TOKEN_KEY);
          setUser(null);
        }
      }

      setInitializing(false);
    }

    bootstrapAuth();

    return () => {
      isCancelled = true;
    };
  }, []);

  // ── Redirect unauthenticated visitors to FieldWise_landing login page ────────
  useEffect(() => {
    if (!initializing && !user && !authError) {
      const publicPaths = ["/terms", "/privacy"];
      if (!publicPaths.includes(window.location.pathname)) {
        window.location.replace(`${LANDING_APP_URL}?auth=login`);
      }
    }
  }, [initializing, user, authError]);

  // ── Authoritatively restore farmer profile & prediction from Supabase ────────
  // Preserves existing account data continuity behavior after verified authentication
  useEffect(() => {
    if (user && user.id && user.id !== DEFAULT_FARMER.id) {
      // 1. Activate local farmer-scoped session cache
      farmIntelligenceService.restoreFarmerSession(user.id);

      // 2. Authoritatively restore cloud profile and prediction in parallel
      Promise.allSettled([
        farmProfileService.loadAndRestoreProfile(user),
        farmIntelligenceService.loadAndRestorePrediction(user),
      ]).catch((err) => console.warn("[AuthContext] Background restore notice:", err));
    }
  }, [user?.id]);

  const login    = async (): Promise<boolean> => true;
  const register = async (): Promise<boolean> => true;

  /** Clear the session, tokens, and storage, then redirect to landing page */
  const logout = () => {
    clearStoredSession();
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem("fieldwise_current_user");
    localStorage.removeItem("farmiq_current_user");
    localStorage.removeItem("smartfarm_user");
    localStorage.removeItem("cropswild_farm_profile");
    localStorage.removeItem("fieldwise_profile_saved_flag");
    localStorage.removeItem("cropswild_crop_recommendation_last");
    localStorage.removeItem("cropswild_fertilizer_recommendation_last");
    localStorage.removeItem("cropswild_disease_detection_last");
    window.location.href = `${LANDING_APP_URL}?logout=true`;
  };

  // ── Auto-expire session when 24-hour TTL expires ────────────────────────────
  useEffect(() => {
    if (!user || user.id === DEFAULT_FARMER.id) return;
    const expiry = Number(localStorage.getItem(EXPIRY_STORAGE_KEY) || 0);
    if (!expiry) {
      localStorage.setItem(EXPIRY_STORAGE_KEY, String(Date.now() + SESSION_TTL_MS));
      return;
    }
    const remaining = expiry - Date.now();
    if (remaining <= 0) {
      logout();
      return;
    }
    const timer = setTimeout(() => {
      logout();
    }, remaining);
    return () => clearTimeout(timer);
  }, [user]);

  const updateUser = async (updates: Partial<AuthUser>): Promise<boolean> => {
    try {
      setUser((prev) => {
        const updated = { ...(prev || DEFAULT_FARMER), ...updates };
        localStorage.setItem("fieldwise_current_user", JSON.stringify(updated));
        localStorage.setItem("smartfarm_user", JSON.stringify(updated));
        return updated;
      });
      return true;
    } catch (error) {
      console.error("Update failed:", error);
      return false;
    }
  };

  const value = useMemo(
    () => ({ user: user || DEFAULT_FARMER, login, register, logout, updateUser, isLoading: initializing }),
    [user, initializing]
  );

  // ── View A: Authentication Error Screen (Stop Authentication & Fail Closed) ──
  if (authError) {
    return (
      <div className="min-h-screen bg-[#071a10] flex flex-col items-center justify-center text-white px-4" role="alert">
        <div className="h-14 w-14 rounded-2xl bg-rose-600 flex items-center justify-center shadow-lg mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight mb-2 text-rose-400">Authentication Verification Failed</h2>
        <p className="text-zinc-300 text-sm mb-6 text-center max-w-md bg-rose-950/40 border border-rose-800/50 p-3 rounded-lg">
          {authError}
        </p>
        <a
          href={`${LANDING_APP_URL}?auth=login`}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors shadow-md"
        >
          Return to Login →
        </a>
      </div>
    );
  }

  // ── View B: Initializing or Unauthenticated Redirect Screen ─────────────────
  if (!user) {
    const publicPaths = ["/terms", "/privacy"];
    if (typeof window !== "undefined" && publicPaths.includes(window.location.pathname)) {
      return (
        <AuthContext.Provider value={value}>
          {children}
        </AuthContext.Provider>
      );
    }

    return (
      <div className="min-h-screen bg-[#071a10] flex flex-col items-center justify-center text-white px-4">
        <div className="h-14 w-14 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg mb-4 animate-bounce">
          <span className="text-2xl">🌾</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight mb-2">Redirecting to Crops Wild...</h2>
        <p className="text-emerald-300/80 text-sm mb-6 text-center max-w-sm">
          Please log in or explore demo mode on the landing page to access your farm intelligence hub.
        </p>
        <a
          href={`${LANDING_APP_URL}?auth=login`}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors shadow-md"
        >
          Go to Login →
        </a>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
