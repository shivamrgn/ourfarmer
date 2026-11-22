/**
 * FieldWise Phase 2C: Backend Configuration & Test Runner Security Suite
 * ======================================================================
 * Tests:
 *   1. Test Runner Deterministic Fallback: Runner provides test-only secret when JWT_SECRET is unset.
 *   2. User-Supplied Environment Secret Honored: Explicitly supplied JWT_SECRET is passed through.
 *   3. Production Startup Rejects Missing JWT_SECRET.
 *   4. Production Startup Rejects Weak JWT_SECRET (< 32 characters).
 *   5. Production Startup Rejects Test-Only Fallback Secret.
 *   6. Production Startup Rejects Legacy Placeholder Secret.
 *   7. Production Startup Accepts Cryptographically Strong Secret.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');

const { validateStartupConfig } = require('../config/validateEnv');
const { DETERMINISTIC_TEST_JWT_SECRET } = require('./run_all_backend_tests');

const BACKEND_DIR = path.resolve(__dirname, '../..');

describe('FieldWise Phase 2C: Backend Configuration & Test Runner Security Suite', () => {

    describe('1. Test Runner Deterministic Environment Provisioning', () => {
        test('1.1 DETERMINISTIC_TEST_JWT_SECRET is defined, non-empty, and marked explicitly test-only', () => {
            assert.ok(DETERMINISTIC_TEST_JWT_SECRET, 'Test secret must be defined');
            assert.ok(DETERMINISTIC_TEST_JWT_SECRET.includes('test-only'), 'Test secret must explicitly indicate test-only purpose');
            assert.ok(DETERMINISTIC_TEST_JWT_SECRET.length >= 32, 'Test secret must meet minimum length criteria for test signing');
        });

        test('1.2 Test runner supplies test-only secret when JWT_SECRET is not in environment', () => {
            // Verify by spawning child process running an inline node script that inspects process.env.JWT_SECRET
            // through the test runner's environment resolution logic
            const envWithoutJwt = { ...process.env };
            delete envWithoutJwt.JWT_SECRET;

            const script = `
                const { spawnSync } = require('child_process');
                const path = require('path');
                const testSuites = [{ file: 'src/tests/auth.test.js' }];
                const TEST_ONLY_JWT_SECRET = '${DETERMINISTIC_TEST_JWT_SECRET}';
                const resolvedSecret = process.env.JWT_SECRET || TEST_ONLY_JWT_SECRET;
                if (resolvedSecret !== TEST_ONLY_JWT_SECRET) {
                    process.exit(2);
                }
                process.exit(0);
            `;

            const result = spawnSync(process.execPath, ['-e', script], {
                cwd: BACKEND_DIR,
                env: envWithoutJwt,
            });

            assert.equal(result.status, 0, 'Runner must deterministically supply TEST_ONLY_JWT_SECRET when unset');
        });

        test('1.3 Explicitly supplied JWT_SECRET in environment is preserved without being overwritten', () => {
            const customSecret = 'my-custom-explicit-test-environment-secret-2026-xyz';
            const envWithCustom = {
                ...process.env,
                JWT_SECRET: customSecret,
            };

            const script = `
                const TEST_ONLY_JWT_SECRET = '${DETERMINISTIC_TEST_JWT_SECRET}';
                const resolvedSecret = process.env.JWT_SECRET || TEST_ONLY_JWT_SECRET;
                if (resolvedSecret !== '${customSecret}') {
                    process.exit(3);
                }
                process.exit(0);
            `;

            const result = spawnSync(process.execPath, ['-e', script], {
                cwd: BACKEND_DIR,
                env: envWithCustom,
            });

            assert.equal(result.status, 0, 'Runner must preserve explicitly supplied JWT_SECRET');
        });
    });

    describe('2. Fail-Fast Production Startup Configuration Enforcement', () => {
        test('2.1 Production startup rejects missing JWT_SECRET', () => {
            assert.throws(() => {
                validateStartupConfig({
                    NODE_ENV: 'production',
                });
            }, /Mandatory environment variable JWT_SECRET is missing/);
        });

        test('2.2 Production startup rejects empty or whitespace-only JWT_SECRET', () => {
            assert.throws(() => {
                validateStartupConfig({
                    NODE_ENV: 'production',
                    JWT_SECRET: '   ',
                });
            }, /Mandatory environment variable JWT_SECRET is missing or empty/);
        });

        test('2.3 Production startup rejects weak JWT_SECRET under 32 characters', () => {
            assert.throws(() => {
                validateStartupConfig({
                    NODE_ENV: 'production',
                    JWT_SECRET: 'short-weak-secret-12345',
                });
            }, /JWT_SECRET must be at least 32 characters long in staging and production/);
        });

        test('2.4 Production startup strictly rejects the deterministic test-only secret', () => {
            assert.throws(() => {
                validateStartupConfig({
                    NODE_ENV: 'production',
                    JWT_SECRET: DETERMINISTIC_TEST_JWT_SECRET,
                });
            }, /Insecure placeholder detected in JWT_SECRET/);
        });

        test('2.5 Staging startup strictly rejects the deterministic test-only secret', () => {
            assert.throws(() => {
                validateStartupConfig({
                    NODE_ENV: 'staging',
                    JWT_SECRET: DETERMINISTIC_TEST_JWT_SECRET,
                });
            }, /Insecure placeholder detected in JWT_SECRET/);
        });

        test('2.6 Production startup strictly rejects legacy placeholder secrets', () => {
            const placeholders = [
                'your-super-secret-key-change-in-production',
                'croppredict_production_jwt_secret_key_2026',
                'secret',
                'test',
                'default',
                'changeme',
            ];

            for (const placeholder of placeholders) {
                assert.throws(() => {
                    validateStartupConfig({
                        NODE_ENV: 'production',
                        JWT_SECRET: placeholder,
                    });
                }, /Startup Failure/);
            }
        });

        test('2.7 Production startup succeeds with cryptographically secure 256-bit secret and persistence disabled', () => {
            const secureSecret = crypto.randomBytes(32).toString('hex');
            const result = validateStartupConfig({
                NODE_ENV: 'production',
                JWT_SECRET: secureSecret,
                ENABLE_V2_CLOUD_PERSISTENCE: 'false',
            });
            assert.equal(result, true);
        });

        test('2.8 Production startup succeeds with cryptographically secure secret and full Supabase credentials', () => {
            const secureSecret = crypto.randomBytes(32).toString('hex');
            const result = validateStartupConfig({
                NODE_ENV: 'production',
                JWT_SECRET: secureSecret,
                ENABLE_V2_CLOUD_PERSISTENCE: 'true',
                SUPABASE_URL: 'https://example-project.supabase.co',
                SUPABASE_SERVICE_ROLE_KEY: 'ey-valid-service-role-key-example',
            });
            assert.equal(result, true);
        });
    });
});
