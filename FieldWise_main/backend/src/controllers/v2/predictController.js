/**
 * FieldWise Phase 3C.6.2.2.3: V2 Crop Recommendation Controller
 * ==============================================================
 * Dispatches validated V2 recommendation queries to the Python bridge service
 * and formats standardized, versioned HTTP responses.
 *
 * Status Codes:
 *   200 OK                   - Successful recommendation engine evaluation
 *                              (status: SUCCESS, INSUFFICIENT_DATA, NO_RECOMMENDATION_SUITABLE)
 *   400 Bad Request          - Outer schema validation failure (handled by route middleware)
 *   422 Unprocessable Entity - Agronomic validation error rejected by recommendation engine
 *   502 Bad Gateway          - Engine emitted invalid, empty, malformed, or oversized output
 *   503 Service Unavailable  - Python executable / child process could not be spawned
 *   504 Gateway Timeout      - Child process exceeded maximum execution timeout
 *   500 Internal Error       - Unexpected engine crash or execution exception
 */

const {
    executeRecommendationEngine,
    EngineValidationError,
    ProcessTimeoutError,
    ProcessSpawnError,
    ProcessSignalError,
    OversizedOutputError,
    MalformedJsonOutputError,
    InvalidEngineOutputError,
    EmptyOutputError,
} = require('../../services/v2/recommendationBridgeService');

async function predictV2(req, res, options = {}) {
    // Setup abort controller for client disconnects
    const abortController = new AbortController();
    res.on('close', () => {
        if (!res.writableEnded) {
            abortController.abort();
        }
    });

    try {
        const bridgeOptions = Object.assign({}, options, {
            abortSignal: abortController.signal,
        });

        const persistenceService = options.persistenceService || require('../../services/v2/recommendationPersistenceService');
        const supabaseClient = options.supabaseClient || require('../../config/supabaseClient').getSupabaseClient();

        // ── 1. Derive verified farmer identity from authenticated token ──────
        // Invariant: Never trust client-supplied farmer_id from req.body or query
        // Explicitly rejects unknown, invalid, or ambiguous identity claims
        let verifiedFarmerId = null;
        if (req.user) {
            try {
                verifiedFarmerId = persistenceService.resolveVerifiedFarmerIdentity(req.user);
            } catch (identityErr) {
                if (identityErr instanceof persistenceService.FarmerIdentityError) {
                    return res.status(401).json({
                        success: false,
                        error: {
                            code: identityErr.code,
                            message: identityErr.message,
                        },
                    });
                }
                throw identityErr;
            }
        }

        const idempotencyKey = (req.headers && req.headers['idempotency-key']) || (req.body && req.body.idempotency_key) || null;

        // ── 2. Idempotency Pre-Check (Transaction-Safe Replay / Conflict) ─────
        if (verifiedFarmerId && idempotencyKey && supabaseClient && process.env.ENABLE_V2_CLOUD_PERSISTENCE !== 'false') {
            try {
                const cached = await persistenceService.checkCachedRecommendation({
                    verifiedFarmerId,
                    idempotencyKey,
                    requestPayload: req.body,
                    supabaseClient,
                });
                if (cached) {
                    if (res.writableEnded || res.destroyed || abortController.signal.aborted) {
                        return;
                    }
                    if (res.setHeader) {
                        res.setHeader('X-Idempotency-Status', 'REPLAY');
                    }
                    return res.status(200).json({
                        success: true,
                        version: cached.record.engine_version || '2.2.0-CLOSURE',
                        status: cached.record.engine_status,
                        is_replay: true,
                        persisted_record_id: cached.record.id,
                        data: cached.record.response_payload,
                    });
                }
            } catch (idempErr) {
                if (idempErr instanceof persistenceService.IdempotencyConflictError) {
                    return res.status(409).json({
                        success: false,
                        error: {
                            code: idempErr.code,
                            message: idempErr.message,
                        },
                    });
                }
                console.warn('[Persistence Pre-Check Warning] Database unreachable for idempotency pre-check:', idempErr.message);
            }
        }

        const startTime = Date.now();
        const result = await executeRecommendationEngine(req.body, bridgeOptions);
        const executionTimeMs = Date.now() - startTime;

        // Before sending 200 OK, verify client connection is still active
        if (res.writableEnded || res.destroyed || abortController.signal.aborted) {
            return;
        }

        let persistedRecordId = null;

        // ── 3. Trusted Server-Side Persistence ───────────────────────────────
        if (verifiedFarmerId && supabaseClient && process.env.ENABLE_V2_CLOUD_PERSISTENCE !== 'false') {
            try {
                const persistResult = await persistenceService.persistRecommendation({
                    verifiedFarmerId,
                    farmerEmail: req.user?.email,
                    farmerName: req.user?.name,
                    idempotencyKey: idempotencyKey || require('crypto').randomUUID(),
                    requestPayload: req.body,
                    engineResult: result,
                    executionTimeMs,
                    supabaseClient,
                });
                persistedRecordId = persistResult.record ? persistResult.record.id : null;
            } catch (pErr) {
                if (
                    pErr instanceof persistenceService.IdempotencyConflictError ||
                    pErr instanceof persistenceService.FarmerIdentityConflictError
                ) {
                    return res.status(409).json({
                        success: false,
                        error: {
                            code: pErr.code,
                            message: pErr.message,
                        },
                    });
                }
                console.warn('[Persistence Warning] Recommendation generated but cloud persistence failed:', pErr.message);
            }
        }

        // 200 OK: Engine completed evaluation
        // Preserves engine status (SUCCESS, INSUFFICIENT_DATA, NO_RECOMMENDATION_SUITABLE)
        // Does NOT convert suitability scores to legacy confidence or probabilities.
        const responseJson = {
            success: true,
            version: result.engine_version || '2.2.0-CLOSURE',
            status: result.status,
            data: result,
        };
        if (persistedRecordId) {
            responseJson.persisted_record_id = persistedRecordId;
        }

        return res.status(200).json(responseJson);
    } catch (err) {
        // Guard: check if connection is closed, response is destroyed, or abort was signaled
        // Do not attempt to write an HTTP response or log if client disconnected
        if (res.writableEnded || res.destroyed || abortController.signal.aborted) {
            return;
        }

        console.error('[PredictV2 Error]', err.name, err.message);

        // 422: Engine-level agronomic validation error (e.g. invalid soil pH bounds, contradictory inputs)
        if (err instanceof EngineValidationError) {
            return res.status(422).json({
                success: false,
                error: {
                    code: 'ENGINE_VALIDATION_ERROR',
                    message: err.message,
                },
            });
        }

        // 504: Engine child process timed out
        if (err instanceof ProcessTimeoutError) {
            return res.status(504).json({
                success: false,
                error: {
                    code: 'EXECUTION_TIMEOUT',
                    message: 'Recommendation engine timed out while processing request.',
                },
            });
        }

        // 503: Python executable or spawn error
        if (err instanceof ProcessSpawnError) {
            return res.status(503).json({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Recommendation engine service is temporarily unavailable.',
                },
            });
        }

        // 502: Buffer limit exceeded (stdout or stderr)
        if (err instanceof OversizedOutputError) {
            return res.status(502).json({
                success: false,
                error: {
                    code: 'OUTPUT_LIMIT_EXCEEDED',
                    message: 'Recommendation engine output exceeded maximum buffer capacity.',
                },
            });
        }

        // 502: Malformed JSON, empty stdout, or invalid engine response structure
        if (
            err instanceof MalformedJsonOutputError ||
            err instanceof EmptyOutputError ||
            err instanceof InvalidEngineOutputError
        ) {
            return res.status(502).json({
                success: false,
                error: {
                    code: 'INVALID_ENGINE_OUTPUT',
                    message: 'Recommendation engine returned invalid or unparseable output.',
                },
            });
        }

        // 500: Unexpected termination by signal
        if (err instanceof ProcessSignalError) {
            return res.status(500).json({
                success: false,
                error: {
                    code: 'PROCESS_TERMINATED',
                    message: 'Recommendation engine process was unexpectedly terminated.',
                },
            });
        }

        // 500: General internal / unhandled execution error
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ENGINE_ERROR',
                message: 'An unexpected internal error occurred while executing the recommendation engine.',
            },
        });
    }
}

module.exports = {
    predictV2,
};
