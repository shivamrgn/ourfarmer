/**
 * FieldWise Phase 3C.6.2.2.1: Node.js Backend Bridge Configuration
 * ===============================================================
 * Centralized, immutable configuration for spawning the Python recommendation engine CLI.
 *
 * Security Mandate:
 *   - Process execution paths are resolved server-side from fixed repository structure.
 *   - Client input is strictly prohibited from altering executable, script path, or arguments.
 *   - Buffer limits are independently configured and enforced for stdout (10MB) and stderr (1MB).
 *
 * Environment Variables:
 *   - FIELDWISE_PYTHON_PATH: Python binary path (fallback: PYTHON_PATH, default: 'python3')
 *   - FIELDWISE_BRIDGE_TIMEOUT_MS: Execution timeout in ms (fallback: RECOMMENDATION_ENGINE_TIMEOUT_MS, default: 10000)
 *   - FIELDWISE_BRIDGE_MAX_STDOUT_BYTES: Max stdout buffer capacity (fallback: RECOMMENDATION_ENGINE_MAX_BUFFER_BYTES, default: 10485760 [10MB])
 *   - FIELDWISE_BRIDGE_MAX_STDERR_BYTES: Max stderr buffer capacity (default: 1048576 [1MB])
 */

const path = require('path');

// Resolve repository root and Python pipeline directories
const PROJECT_ROOT = path.resolve(__dirname, '../../../../..');
const ML_PIPELINE_DIR = path.resolve(PROJECT_ROOT, 'FieldWise_main/model/ml_pipeline');
const ADAPTER_CLI_PATH = path.resolve(ML_PIPELINE_DIR, 'recommendation_engine/adapter_cli.py');

const bridgeConfig = Object.freeze({
    PROJECT_ROOT,
    ML_PIPELINE_DIR,
    ADAPTER_CLI_PATH,
    // Server-configured Python executable (never client-supplied)
    PYTHON_PATH: process.env.FIELDWISE_PYTHON_PATH || process.env.PYTHON_PATH || 'python3',
    // Bounded execution timeout (default 10s, configurable via env)
    TIMEOUT_MS: parseInt(process.env.FIELDWISE_BRIDGE_TIMEOUT_MS || process.env.RECOMMENDATION_ENGINE_TIMEOUT_MS, 10) || 10000,
    // Independent stdout buffer capacity (default 10MB)
    MAX_STDOUT_BYTES: parseInt(process.env.FIELDWISE_BRIDGE_MAX_STDOUT_BYTES || process.env.RECOMMENDATION_ENGINE_MAX_BUFFER_BYTES, 10) || (10 * 1024 * 1024),
    // Independent stderr buffer capacity (default 1MB)
    MAX_STDERR_BYTES: parseInt(process.env.FIELDWISE_BRIDGE_MAX_STDERR_BYTES, 10) || (1 * 1024 * 1024),
    // Legacy compatibility alias
    MAX_BUFFER_BYTES: (10 * 1024 * 1024),
    // SIGTERM-to-SIGKILL grace period in milliseconds
    SIGTERM_GRACE_PERIOD_MS: 1000,
});

module.exports = bridgeConfig;
