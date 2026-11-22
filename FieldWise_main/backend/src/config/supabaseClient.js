/**
 * FieldWise Phase 3C.6.4.2.3: Server-Only Supabase Client
 * =======================================================
 * Configures the backend Supabase connection.
 *
 * Security Invariants:
 *   1. This file is strictly server-side (Node.js runtime).
 *   2. Never imported or exposed to browser/frontend bundles.
 *   3. Uses SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) for privileged backend mediation.
 *   4. Bypasses client RLS only after Express middleware cryptographically verifies user identity.
 */

const { createClient } = require('@supabase/supabase-js');

const isProdOrStaging = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
const DEV_FALLBACK_URL = 'https://fweunjznkrscuwandfsy.supabase.co';

let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (isProdOrStaging) {
    if (!supabaseUrl) {
        console.error('CRITICAL: SUPABASE_URL must be explicitly configured in staging and production. Silent dev fallback is blocked.');
    }
    if (!supabaseKey) {
        console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY must be explicitly configured in staging and production.');
    }
} else {
    // Development fallback
    supabaseUrl = supabaseUrl || DEV_FALLBACK_URL;
    supabaseKey = supabaseKey || process.env.SUPABASE_ANON_KEY || '';
}

let supabaseClient = null;
let customClient = null;

if (supabaseUrl && supabaseKey) {
    try {
        supabaseClient = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
    } catch (err) {
        console.warn('⚠️ [Supabase Server] Client initialization notice:', err.message);
    }
}

function getSupabaseClient() {
    return customClient || supabaseClient;
}

function setSupabaseClient(client) {
    customClient = client;
}

function resetSupabaseClient() {
    customClient = null;
}

module.exports = {
    getSupabaseClient,
    setSupabaseClient,
    resetSupabaseClient,
};
