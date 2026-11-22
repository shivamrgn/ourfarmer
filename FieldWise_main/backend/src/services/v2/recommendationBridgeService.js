/**
 * FieldWise Phase 3C.6.2.2.2: Recommendation Engine Bridge Service
 * ================================================================
 * Secure child_process bridge connecting the Node.js Express backend
 * to the standalone Python Recommendation Engine adapter CLI (adapter_cli.py).
 *
 * Security & Reliability Guarantees:
 *   1. Zero shell execution: child_process.spawn with argument array and shell: false.
 *   2. Server-controlled paths: executable and script paths are resolved from configuration.
 *   3. Unified termination & escalation: one reusable child-process termination mechanism
 *      for all forced-termination paths (timeout, disconnect, stdout overflow, stderr overflow).
 *      Sends SIGTERM -> waits configured grace period (default 1,000 ms) -> sends SIGKILL if still open.
 *   4. Independent bounded stream limits: independent stdout (10MB) and stderr (1MB) limits;
 *      non-retention of chunks beyond limits to prevent memory exhaustion.
 *   5. Preserved error precedence: recorded termination reason determines the final error type;
 *      SIGTERM/SIGKILL signals never overwrite the original termination classification.
 *   6. Strict stdout/stderr separation: stdout parsed as strict JSON; stderr logged exclusively.
 *   7. Comprehensive response validation: validates Python output schema against frozen adapter contract
 *      before returning success. Converts invalid engine output to controlled 502 bridge error.
 *   8. Sanitized diagnostics: internal paths and tracebacks are hidden from external callers.
 *   9. Zero silent retries: failed executions immediately return deterministic error states.
 */

const { spawn } = require('child_process');
const bridgeConfig = require('../../config/v2/bridgeConfig');

// ─── Custom Bridge Error Hierarchy ──────────────────────────────────────────

class BridgeError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = this.constructor.name;
        this.details = details;
    }
}

class ProcessSpawnError extends BridgeError {}
class ProcessTimeoutError extends BridgeError {}
class ProcessSignalError extends BridgeError {}
class OversizedOutputError extends BridgeError {}
class EmptyOutputError extends BridgeError {}
class MalformedJsonOutputError extends BridgeError {}
class InvalidEngineOutputError extends BridgeError {}
class EngineValidationError extends BridgeError {}
class EngineExecutionError extends BridgeError {}

// ─── Termination Reason Enumeration ─────────────────────────────────────────

const TerminationReason = Object.freeze({
    TIMEOUT: 'TIMEOUT',
    CLIENT_DISCONNECT: 'CLIENT_DISCONNECT',
    STDOUT_OVERFLOW: 'STDOUT_OVERFLOW',
    STDERR_OVERFLOW: 'STDERR_OVERFLOW',
});

// ─── Valid Engine Status Set ────────────────────────────────────────────────

const VALID_ENGINE_STATUSES = Object.freeze(new Set([
    'SUCCESS',
    'INSUFFICIENT_DATA',
    'NO_RECOMMENDATION_SUITABLE',
]));

// ─── Error Message Sanitizer ────────────────────────────────────────────────

function sanitizeErrorMessage(rawMsg) {
    if (!rawMsg || typeof rawMsg !== 'string') {
        return 'An error occurred during recommendation engine execution.';
    }
    // Remove absolute filesystem paths from user-facing error messages
    const sanitized = rawMsg
        .replace(new RegExp(bridgeConfig.PROJECT_ROOT, 'g'), '[REPO_ROOT]')
        .replace(new RegExp('/[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+', 'g'), '[PATH]');
    return sanitized.trim();
}

// ─── Engine Output Contract Validator ───────────────────────────────────────

/**
 * Validates that parsed JSON from the recommendation engine adheres strictly
 * to the frozen adapter output contract (RecommendationResult).
 *
 * @param {*} result - Parsed JSON object from engine stdout
 * @throws {InvalidEngineOutputError} If output is malformed or violates the contract
 * @returns {Object} Validated result object
 */
function validateEngineOutput(result) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw new InvalidEngineOutputError('Engine output must be a non-null plain JSON object.');
    }

    // 1. Mandatory 'status' validation
    if (!result.status || typeof result.status !== 'string') {
        throw new InvalidEngineOutputError("Engine output missing mandatory 'status' field.");
    }

    if (!VALID_ENGINE_STATUSES.has(result.status)) {
        throw new InvalidEngineOutputError(
            `Unknown engine status '${result.status}'. Must be exactly one of: SUCCESS, INSUFFICIENT_DATA, NO_RECOMMENDATION_SUITABLE.`
        );
    }

    // 2. Mandatory 'engine_version' and 'execution_timestamp'
    if (!result.engine_version || typeof result.engine_version !== 'string' || !result.engine_version.trim()) {
        throw new InvalidEngineOutputError("Engine output missing or invalid 'engine_version'.");
    }

    if (!result.execution_timestamp || typeof result.execution_timestamp !== 'string' || !result.execution_timestamp.trim()) {
        throw new InvalidEngineOutputError("Engine output missing or invalid 'execution_timestamp'.");
    }

    // 3. Mandatory 'query_summary' object
    if (!result.query_summary || typeof result.query_summary !== 'object' || Array.isArray(result.query_summary)) {
        throw new InvalidEngineOutputError("Engine output missing or invalid 'query_summary' object.");
    }

    // 4. Mandatory 'recommendations' array
    if (!Array.isArray(result.recommendations)) {
        throw new InvalidEngineOutputError("Engine output missing or invalid 'recommendations' array.");
    }

    for (let i = 0; i < result.recommendations.length; i++) {
        const rec = result.recommendations[i];
        if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
            throw new InvalidEngineOutputError(`Recommendation entry at index ${i} is not a valid object.`);
        }
        if (typeof rec.crop_id !== 'string' || !rec.crop_id.trim()) {
            throw new InvalidEngineOutputError(`Recommendation entry at index ${i} missing required string 'crop_id'.`);
        }
        if (typeof rec.canonical_name !== 'string' || !rec.canonical_name.trim()) {
            throw new InvalidEngineOutputError(`Recommendation entry at index ${i} missing required string 'canonical_name'.`);
        }
        if (typeof rec.suitability_score !== 'number' || !Number.isFinite(rec.suitability_score)) {
            throw new InvalidEngineOutputError(`Recommendation entry at index ${i} missing or invalid numeric 'suitability_score'.`);
        }
        if (typeof rec.rank !== 'number' || !Number.isInteger(rec.rank)) {
            throw new InvalidEngineOutputError(`Recommendation entry at index ${i} missing or invalid integer 'rank'.`);
        }
    }

    // 5. Mandatory 'excluded_candidates' array
    if (!Array.isArray(result.excluded_candidates)) {
        throw new InvalidEngineOutputError("Engine output missing or invalid 'excluded_candidates' array.");
    }

    return result;
}

// ─── Core Child Process Execution Bridge ────────────────────────────────────

/**
 * Spawns adapter_cli.py as an isolated child process, pipes query JSON via stdin,
 * captures stdout/stderr, enforces unified termination & stream limits, and returns the validated result.
 *
 * @param {Object} queryPayload - The JSON-serializable request payload dictionary
 * @param {Object} [options] - Optional execution overrides for testing / lifecycle
 * @param {Function} [options.spawnFn] - Custom spawn function (for unit testing mocks)
 * @param {string} [options.pythonPath] - Python binary path override (server-configured only)
 * @param {string} [options.scriptPath] - Python script path override (server-configured only)
 * @param {number} [options.timeoutMs] - Maximum execution timeout in milliseconds
 * @param {number} [options.gracePeriodMs] - Grace period in ms between SIGTERM and SIGKILL (default 1000)
 * @param {number} [options.maxStdoutBytes] - Maximum stdout buffer capacity in bytes (default: 10MB)
 * @param {number} [options.maxStderrBytes] - Maximum stderr buffer capacity in bytes (default: 1MB)
 * @param {number} [options.maxBufferBytes] - Legacy alias for maxStdoutBytes
 * @param {Function} [options.setTimeoutFn] - Injected setTimeout function (for deterministic testing)
 * @param {Function} [options.clearTimeoutFn] - Injected clearTimeout function (for deterministic testing)
 * @param {AbortSignal} [options.abortSignal] - AbortSignal triggered on client disconnect
 * @returns {Promise<Object>} The validated RecommendationResult dictionary
 */
function executeRecommendationEngine(queryPayload, options = {}) {
    return new Promise((resolve, reject) => {
        if (!queryPayload || typeof queryPayload !== 'object' || Array.isArray(queryPayload)) {
            return reject(new BridgeError('Request payload must be a JSON object dictionary.'));
        }

        let inputJson;
        try {
            inputJson = JSON.stringify(queryPayload);
        } catch (err) {
            return reject(new BridgeError(`Failed to serialize request payload to JSON: ${err.message}`));
        }

        const spawnFn = options.spawnFn || spawn;
        const pythonPath = options.pythonPath || bridgeConfig.PYTHON_PATH;
        const scriptPath = options.scriptPath || bridgeConfig.ADAPTER_CLI_PATH;
        const timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : bridgeConfig.TIMEOUT_MS;
        const gracePeriodMs = options.gracePeriodMs !== undefined
            ? options.gracePeriodMs
            : (bridgeConfig.SIGTERM_GRACE_PERIOD_MS || 1000);
        const maxStdoutBytes = options.maxStdoutBytes !== undefined
            ? options.maxStdoutBytes
            : (options.maxBufferBytes !== undefined ? options.maxBufferBytes : bridgeConfig.MAX_STDOUT_BYTES);
        const maxStderrBytes = options.maxStderrBytes !== undefined
            ? options.maxStderrBytes
            : bridgeConfig.MAX_STDERR_BYTES;

        const setTimeoutFn = options.setTimeoutFn || setTimeout;
        const clearTimeoutFn = options.clearTimeoutFn || clearTimeout;

        const env = Object.assign({}, process.env, {
            PYTHONPATH: `${bridgeConfig.PROJECT_ROOT}:${bridgeConfig.ML_PIPELINE_DIR}:${bridgeConfig.PROJECT_ROOT}/FieldWise_main`,
            PYTHONUNBUFFERED: '1',
        });

        const spawnOptions = {
            cwd: bridgeConfig.PROJECT_ROOT,
            env,
            shell: false, // Strict: never invoke shell interpreter
            stdio: ['pipe', 'pipe', 'pipe'],
        };

        let child;
        try {
            child = spawnFn(pythonPath, [scriptPath], spawnOptions);
        } catch (spawnErr) {
            console.error('[Bridge] Process spawn error:', spawnErr);
            return reject(new ProcessSpawnError(`Failed to spawn recommendation engine: ${spawnErr.message}`, { originalError: spawnErr }));
        }

        // Unified termination state tracking
        let terminationReason = null;
        let terminationDetails = null;
        let forceKillTimer = null;
        let timeoutTimer = null;
        let childClosed = false;

        /**
         * Unified child-process termination mechanism.
         * Enforces the following lifecycle across all forced-termination paths:
         *   1. Record termination reason (idempotent; first reason wins; prevents duplicate timers).
         *   2. Send SIGTERM to initiate graceful process termination.
         *   3. Start configured grace period timer (1,000 ms default).
         *   4. Escalate to SIGKILL if child has not exited before grace period expires.
         *   5. Clear escalation timer when child closes.
         *   6. Preserve final error classification.
         *
         * @param {string} reason - One of TerminationReason values
         * @param {Object} [details={}] - Contextual details (stream, limits, etc.)
         */
        function terminateChild(reason, details = {}) {
            if (terminationReason !== null || childClosed) {
                // Idempotent: first termination reason wins; prevent duplicate timers
                return;
            }

            terminationReason = reason;
            terminationDetails = details;

            console.warn(`[Bridge] Terminating recommendation engine child process. Reason: ${reason}. Sending SIGTERM.`);
            try {
                child.kill('SIGTERM');
            } catch (killErr) {
                console.warn(`[Bridge] Failed to deliver SIGTERM to child process: ${killErr.message}`);
            }

            // Start grace period timer before escalating to SIGKILL
            forceKillTimer = setTimeoutFn(() => {
                if (!childClosed) {
                    console.warn(`[Bridge] Child process did not exit within ${gracePeriodMs}ms grace period after SIGTERM. Sending SIGKILL.`);
                    try {
                        child.kill('SIGKILL');
                    } catch (killErr) {
                        console.warn(`[Bridge] Failed to deliver SIGKILL to child process: ${killErr.message}`);
                    }
                }
            }, gracePeriodMs);
        }

        // Set execution timeout using unified termination
        if (timeoutMs > 0) {
            timeoutTimer = setTimeoutFn(() => {
                terminateChild(TerminationReason.TIMEOUT, { timeoutMs });
            }, timeoutMs);
        }

        // Handle client disconnect / abort signal using unified termination
        if (options.abortSignal) {
            const onAbort = () => {
                terminateChild(TerminationReason.CLIENT_DISCONNECT);
            };
            if (options.abortSignal.aborted) {
                onAbort();
            } else {
                options.abortSignal.addEventListener('abort', onAbort, { once: true });
            }
        }

        const stdoutChunks = [];
        let stdoutLen = 0;
        const stderrChunks = [];
        let stderrLen = 0;

        // Independent stdout limit enforcement with unified termination and non-retention of excess chunks
        child.stdout.on('data', (chunk) => {
            stdoutLen += chunk.length;
            if (stdoutLen > maxStdoutBytes) {
                terminateChild(TerminationReason.STDOUT_OVERFLOW, {
                    stream: 'stdout',
                    limitBytes: maxStdoutBytes,
                    receivedBytes: stdoutLen,
                });
                // Do not retain chunks beyond the stdout limit
            } else if (terminationReason === null) {
                stdoutChunks.push(chunk);
            }
        });

        // Independent stderr limit enforcement with unified termination and non-retention of excess chunks
        child.stderr.on('data', (chunk) => {
            stderrLen += chunk.length;
            if (stderrLen > maxStderrBytes) {
                terminateChild(TerminationReason.STDERR_OVERFLOW, {
                    stream: 'stderr',
                    limitBytes: maxStderrBytes,
                    receivedBytes: stderrLen,
                });
                // Do not retain chunks beyond the stderr limit
            } else if (terminationReason === null) {
                stderrChunks.push(chunk);
            }
        });

        // Safely write JSON payload to stdin
        child.stdin.on('error', (err) => {
            // May occur if child process exits immediately (EPIPE)
            console.warn('[Bridge] Stdin write error:', err.message);
        });

        try {
            child.stdin.write(inputJson, 'utf8', () => {
                try {
                    child.stdin.end();
                } catch (_) {}
            });
        } catch (writeErr) {
            console.warn('[Bridge] Stdin exception:', writeErr.message);
        }

        // Handle spawn errors emitted via event
        child.on('error', (err) => {
            childClosed = true;
            if (timeoutTimer) clearTimeoutFn(timeoutTimer);
            if (forceKillTimer) clearTimeoutFn(forceKillTimer);
            console.error('[Bridge] Child process error event:', err);
            return reject(new ProcessSpawnError(`Recommendation engine process error: ${err.message}`, { originalError: err }));
        });

        // Process exit lifecycle
        child.on('close', (code, signal) => {
            childClosed = true;

            // Clear all pending timers immediately upon process close
            if (timeoutTimer) {
                clearTimeoutFn(timeoutTimer);
                timeoutTimer = null;
            }
            if (forceKillTimer) {
                clearTimeoutFn(forceKillTimer);
                forceKillTimer = null;
            }

            const stdoutStr = Buffer.concat(stdoutChunks, Math.min(stdoutLen, maxStdoutBytes)).toString('utf8');
            const stderrStr = Buffer.concat(stderrChunks, Math.min(stderrLen, maxStderrBytes)).toString('utf8');

            // Preserve error precedence using the recorded termination reason
            if (terminationReason !== null) {
                switch (terminationReason) {
                    case TerminationReason.TIMEOUT:
                        return reject(new ProcessTimeoutError(
                            `Recommendation engine exceeded execution timeout of ${timeoutMs}ms.`,
                            { timeoutMs, signal, code }
                        ));
                    case TerminationReason.STDOUT_OVERFLOW:
                        return reject(new OversizedOutputError(
                            `Recommendation engine stdout exceeded maximum buffer limit of ${maxStdoutBytes} bytes.`,
                            { stream: 'stdout', limitBytes: maxStdoutBytes, receivedBytes: stdoutLen, signal, code }
                        ));
                    case TerminationReason.STDERR_OVERFLOW:
                        return reject(new OversizedOutputError(
                            `Recommendation engine stderr exceeded maximum buffer limit of ${maxStderrBytes} bytes.`,
                            { stream: 'stderr', limitBytes: maxStderrBytes, receivedBytes: stderrLen, signal, code }
                        ));
                    case TerminationReason.CLIENT_DISCONNECT:
                        return reject(new ProcessSignalError(
                            'Recommendation engine process terminated due to client disconnect.',
                            { signal, code }
                        ));
                    default:
                        return reject(new ProcessSignalError(
                            `Recommendation engine terminated due to ${terminationReason}.`,
                            { terminationReason, signal, code }
                        ));
                }
            }

            // If there was no forced termination reason, check unhandled external signal
            if (signal && signal !== 'SIGTERM') {
                return reject(new ProcessSignalError(`Recommendation engine process terminated by signal: ${signal}`, { signal, code }));
            }

            if (code !== 0) {
                console.error(`[Bridge] Recommendation engine exited with code ${code}. Stderr: ${stderrStr.trim()}`);

                // Identify if this is an engine-level validation error
                const isValidationError =
                    stderrStr.includes('VALIDATION ERROR:') ||
                    stderrStr.includes('ENGINE VALIDATION ERROR:');

                if (isValidationError) {
                    const match = stderrStr.match(/(?:ENGINE )?VALIDATION ERROR:\s*(.+)/);
                    const cleanMsg = match ? match[1].trim() : 'Input validation rejected by recommendation engine.';
                    return reject(new EngineValidationError(sanitizeErrorMessage(cleanMsg), {
                        rawStderr: stderrStr,
                        exitCode: code,
                    }));
                }

                // General engine execution / runtime failure
                const matchErr = stderrStr.match(/ERROR:\s*(.+)/);
                const genericMsg = matchErr ? matchErr[1].trim() : 'Recommendation engine execution failed.';
                return reject(new EngineExecutionError(sanitizeErrorMessage(genericMsg), {
                    rawStderr: stderrStr,
                    exitCode: code,
                }));
            }

            // Normal exit (code 0)
            if (!stdoutStr || !stdoutStr.trim()) {
                console.error('[Bridge] Recommendation engine exited with code 0 but emitted zero stdout bytes.');
                return reject(new EmptyOutputError('Recommendation engine emitted empty output.'));
            }

            let parsedResult;
            try {
                parsedResult = JSON.parse(stdoutStr);
            } catch (jsonErr) {
                console.error('[Bridge] Failed to parse stdout as JSON:', jsonErr.message, 'Raw output head:', stdoutStr.slice(0, 200));
                return reject(new MalformedJsonOutputError(`Failed to parse engine output as valid JSON: ${jsonErr.message}`, {
                    rawStdout: stdoutStr.slice(0, 500),
                }));
            }

            // Strict response structure and status validation against frozen adapter contract
            try {
                validateEngineOutput(parsedResult);
            } catch (valErr) {
                console.error('[Bridge] Engine output validation failed:', valErr.message);
                return reject(valErr);
            }

            return resolve(parsedResult);
        });
    });
}

module.exports = {
    executeRecommendationEngine,
    validateEngineOutput,
    VALID_ENGINE_STATUSES,
    TerminationReason,
    BridgeError,
    ProcessSpawnError,
    ProcessTimeoutError,
    ProcessSignalError,
    OversizedOutputError,
    EmptyOutputError,
    MalformedJsonOutputError,
    InvalidEngineOutputError,
    EngineValidationError,
    EngineExecutionError,
};
