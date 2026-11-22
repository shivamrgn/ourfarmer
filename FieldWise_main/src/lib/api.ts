/**
 * CropPredict AI — Axios API Client
 * Base URL points to backend. Interceptor auto-attaches JWT from localStorage.
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * Resolves the backend-issued JWT token.
 * Storage location: localStorage.getItem('croppredict_token')
 * Format: HMAC-SHA256 JWT issued by Express /api/auth/login or /api/auth/register.
 *
 * Invariant: Forwards ONLY the proven backend-issued JWT.
 * Does NOT select arbitrary Firebase or Supabase tokens as backend JWTs.
 */
export function getBackendToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    const token = localStorage.getItem('croppredict_token');
    return token && typeof token === 'string' && token.trim().length > 0 ? token.trim() : null;
}

export const getSessionToken = getBackendToken;

// ── Request interceptor: attach backend JWT Bearer token ─────────────────────
api.interceptors.request.use(
    (config) => {
        if (!config.headers['Authorization']) {
            const token = getBackendToken();
            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Response interceptor: handle responses and errors ─────────────────────────────
api.interceptors.response.use(
    (response) => response,
    (error) => {
        return Promise.reject(error);
    }
);


// ── Auth helpers ─────────────────────────────────────────────────────────────

export const authApi = {
    login: (email: string, password: string) =>
        api.post('/api/auth/login', { email, password }),

    register: (name: string, email: string, password: string) =>
        api.post('/api/auth/register', { name, email, password }),

    getMe: () => api.get('/api/auth/me'),
};

import { predictCropsEngine } from './predictorEngine';
import { V2PredictRequest, V2PredictResponse } from '../types/v2Prediction';

export class V2ApiError extends Error {
    code: string;
    status: number;
    details?: any;

    constructor(message: string, status: number, code?: string, details?: any) {
        super(message);
        this.name = 'V2ApiError';
        this.status = status;
        this.code = code || `HTTP_${status}`;
        this.details = details;
        Object.setPrototypeOf(this, V2ApiError.prototype);
    }
}

export class V2NetworkError extends Error {
    code: string;
    status: number;

    constructor(message = 'FieldWise Recommendation Service is unreachable. Please verify network connectivity or that the backend server is active.') {
        super(message);
        this.name = 'V2NetworkError';
        this.code = 'NETWORK_ERROR';
        this.status = 0;
        Object.setPrototypeOf(this, V2NetworkError.prototype);
    }
}

export const predictApi = {
    // ── V1 Predictor Method (Preserved Unchanged) ─────────────────────────────
    predict: async (data: {
        rainfall: number;
        temperature: number;
        humidity: number;
        soilType: string;
        nitrogen: number;
        phosphorus: number;
        potassium: number;
        ph: number;
        state: string;
    }) => {
        try {
            const res = await api.post('/api/predict', data);
            return res;
        } catch (err: any) {
            // Rethrow client-side 4xx errors (validation failures from express-validator)
            if (err?.response && err.response.status >= 400 && err.response.status < 500) {
                throw err;
            }
            // When backend is not running or unreachable, run the local Gaussian prediction engine
            const localPredictions = predictCropsEngine(data);
            return {
                data: {
                    success: true,
                    mode: 'offline_ml_engine',
                    predictions: localPredictions,
                }
            };
        }
    },

    // ── V2 Recommendation Engine Bridge Client (Phase 3C.6.3 / Phase 3C.6.5) ─
    predictV2: async (data: V2PredictRequest, options?: { token?: string }): Promise<V2PredictResponse> => {
        try {
            const token = options?.token !== undefined ? options.token : getSessionToken();
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const res = await api.post<V2PredictResponse>('/api/v2/predict', data, {
                headers,
            });
            return res.data;
        } catch (err: any) {
            // Distinguish HTTP 400, 401, 409, 422, 502, 503, 504 and Network Errors
            // CRITICAL: Never silently fall back to V1 on a V2 error!
            if (err?.response) {
                const status = err.response.status;
                const errData = err.response.data?.error || err.response.data || {};
                const message =
                    errData.message ||
                    (typeof err.response.data === 'string'
                        ? err.response.data
                        : `V2 API request failed with status ${status}`);
                const code = errData.code || `HTTP_${status}`;
                if (status === 401) {
                    throw new V2ApiError(
                        message || 'Your session has expired or is invalid. Please log in again to save recommendations to your farm history.',
                        401,
                        code || 'UNAUTHORIZED',
                        errData
                    );
                }
                throw new V2ApiError(message, status, code, errData);
            } else if (err?.request) {
                throw new V2NetworkError();
            }
            throw err;
        }
    },
};
