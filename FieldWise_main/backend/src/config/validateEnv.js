/**
 * FieldWise Release Hardening: Environment Startup Validation
 * ============================================================
 * Enforces mandatory configuration checks before the server begins serving traffic.
 * Prevents running staging/production with missing, weak, or default placeholder secrets.
 */

function validateStartupConfig(env = process.env) {
    const nodeEnv = env.NODE_ENV || 'development';
    const isProdOrStaging = nodeEnv === 'production' || nodeEnv === 'staging';

    const jwtSecret = env.JWT_SECRET;
    const knownInsecureSecrets = [
        'your-super-secret-key-change-in-production',
        'croppredict_production_jwt_secret_key_2026',
        'secret',
        'test',
        'default',
        'changeme',
        '123456',
    ];

    if (!jwtSecret || typeof jwtSecret !== 'string' || jwtSecret.trim().length === 0) {
        throw new Error('Startup Failure: Mandatory environment variable JWT_SECRET is missing or empty.');
    }

    if (isProdOrStaging) {
        if (jwtSecret.trim().length < 32) {
            throw new Error('Startup Failure: JWT_SECRET must be at least 32 characters long in staging and production.');
        }
        if (knownInsecureSecrets.includes(jwtSecret.trim().toLowerCase())) {
            throw new Error('Startup Failure: Insecure placeholder detected in JWT_SECRET. Use a cryptographically generated 256-bit secret.');
        }

        // If cloud persistence is enabled, ensure required Supabase credentials exist
        if (env.ENABLE_V2_CLOUD_PERSISTENCE !== 'false') {
            if (!env.SUPABASE_URL || !env.SUPABASE_URL.trim()) {
                throw new Error('Startup Failure: SUPABASE_URL must be configured when ENABLE_V2_CLOUD_PERSISTENCE is active in staging/production.');
            }
            if (!env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_SECRET_KEY) {
                throw new Error('Startup Failure: SUPABASE_SERVICE_ROLE_KEY must be configured for privileged backend mediation in staging/production.');
            }
        }
    }

    return true;
}

module.exports = {
    validateStartupConfig,
};
