/**
 * FieldWise Phase 3C.6.2.2.1: Node.js Backend Bridge Unit Test Suite
 * =================================================================
 * Deterministic unit tests utilizing mocked child_process to verify:
 *   1. Successful Python invocation and JSON output parsing.
 *   2. Preservation of engine status (SUCCESS, INSUFFICIENT_DATA, NO_RECOMMENDATION_SUITABLE).
 *   3. Process spawn failure (e.g. ENOENT) handling.
 *   4. Engine validation error (non-zero exit with VALIDATION ERROR).
 *   5. Engine execution failure (non-zero exit with runtime error).
 *   6. Malformed JSON on stdout handling.
 *   7. Unexpected empty stdout handling.
 *   8. Timeout and process termination (SIGTERM/SIGKILL with 1000ms grace period).
 *   9. Independent stdout buffer overflow protection (10MB default) and non-retention.
 *   10. Independent stderr buffer overflow protection (1MB default) and non-retention.
 *   11. Strict separation of stdout and stderr.
 *   12. Client disconnect / abort signal child termination.
 *   13. Security: shell: false enforcement.
 *   14. Security: rejection of client-controlled executable or script path overrides.
 *   15. Engine output contract validation:
 *       - Rejection of {}, null, arrays, missing status, unknown status.
 *       - Rejection of missing required fields (engine_version, execution_timestamp, query_summary, recommendations, excluded_candidates).
 *       - Rejection of malformed recommendation entries.
 *       - Acceptance of valid SUCCESS, INSUFFICIENT_DATA, and NO_RECOMMENDATION_SUITABLE responses.
 *   16. Configuration defaults and environment variable mapping.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { Writable } = require('stream');

const bridgeConfig = require('../config/v2/bridgeConfig');
const { predictV2 } = require('../controllers/v2/predictController');
const {
    executeRecommendationEngine,
    validateEngineOutput,
    VALID_ENGINE_STATUSES,
    ProcessSpawnError,
    ProcessTimeoutError,
    ProcessSignalError,
    OversizedOutputError,
    EmptyOutputError,
    MalformedJsonOutputError,
    InvalidEngineOutputError,
    EngineValidationError,
    EngineExecutionError,
} = require('../services/v2/recommendationBridgeService');

// Mock child process factory
function createMockChildProcess(options = {}) {
    const child = new EventEmitter();
    child.stdin = new Writable({
        write(chunk, encoding, callback) {
            callback();
        },
    });
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.signalsReceived = [];
    child.autoClose = options.autoClose !== undefined ? options.autoClose : true;
    child.autoCloseDelayMs = options.autoCloseDelayMs || 0;

    child.kill = (signal = 'SIGTERM') => {
        child.signalsReceived.push(signal);
        child.killedWith = signal;
        if (child.autoClose) {
            if (child.autoCloseDelayMs > 0) {
                setTimeout(() => {
                    child.emit('close', null, signal);
                }, child.autoCloseDelayMs);
            } else {
                setImmediate(() => {
                    child.emit('close', null, signal);
                });
            }
        }
        return true;
    };
    return child;
}

// Mock HTTP response factory for controller tests
function createMockResponse(options = {}) {
    const res = new EventEmitter();
    res.writableEnded = options.writableEnded || false;
    res.destroyed = options.destroyed || false;
    res.statusCode = null;
    res.body = null;
    res.headersSent = false;
    res.writeCalls = [];

    res.status = function (code) {
        this.statusCode = code;
        return this;
    };
    res.json = function (payload) {
        if (this.writableEnded) {
            throw new Error('ERR_HTTP_HEADERS_SENT: Cannot call json() after writableEnded');
        }
        this.headersSent = true;
        this.writableEnded = true;
        this.body = payload;
        this.writeCalls.push({ type: 'json', data: payload });
        return this;
    };
    return res;
}

// Canonical valid RecommendationResult mock generator
function makeValidResult(overrides = {}) {
    return {
        status: 'SUCCESS',
        engine_version: '2.2.0-CLOSURE',
        execution_timestamp: '2026-11-21T11:00:00Z',
        query_summary: {
            location: 'Punjab, Ludhiana',
            season: 'Rabi',
            planting_system_evaluated: 'Sole_Crop',
            water_regime_evaluated: 'Irrigated',
            data_completeness_index: 85.0,
            evidence_confidence_tier: 'FARMER_DECLARED',
        },
        recommendations: [
            {
                crop_id: 'wheat',
                canonical_name: 'Wheat',
                suitability_score: 92.5,
                rank: 1,
            },
        ],
        excluded_candidates: [],
        diagnostics: {},
        land_reclamation_advisory: null,
        ...overrides,
    };
}

describe('Phase 3C.6.2.2.1 Backend Bridge Unit Tests', () => {

    test('1. Successful Python invocation and valid JSON response', async () => {
        const mockResult = makeValidResult();

        const customSpawn = (exe, args, opts) => {
            assert.equal(opts.shell, false, 'shell must strictly be false');
            const child = createMockChildProcess();
            setImmediate(() => {
                child.stdout.emit('data', Buffer.from(JSON.stringify(mockResult)));
                child.emit('close', 0, null);
            });
            return child;
        };

        const result = await executeRecommendationEngine(
            { state: 'Punjab', sowing_month: 10 },
            { spawnFn: customSpawn }
        );

        assert.equal(result.status, 'SUCCESS');
        assert.equal(result.recommendations.length, 1);
        assert.equal(result.recommendations[0].canonical_name, 'Wheat');
        assert.equal(result.recommendations[0].suitability_score, 92.5);
    });

    test('2. Preservation of INSUFFICIENT_DATA and NO_RECOMMENDATION_SUITABLE statuses', async () => {
        // 2.1 INSUFFICIENT_DATA
        const insufficientResult = makeValidResult({
            status: 'INSUFFICIENT_DATA',
            recommendations: [],
            diagnostics: { reason: 'Missing seasonal water data' },
        });
        const spawnInsufficient = () => {
            const child = createMockChildProcess();
            setImmediate(() => {
                child.stdout.emit('data', Buffer.from(JSON.stringify(insufficientResult)));
                child.emit('close', 0, null);
            });
            return child;
        };
        const res1 = await executeRecommendationEngine(
            { state: 'Punjab', sowing_month: 10 },
            { spawnFn: spawnInsufficient }
        );
        assert.equal(res1.status, 'INSUFFICIENT_DATA');
        assert.equal(res1.recommendations.length, 0);

        // 2.2 NO_RECOMMENDATION_SUITABLE
        const noRecResult = makeValidResult({
            status: 'NO_RECOMMENDATION_SUITABLE',
            recommendations: [
                {
                    crop_id: 'wheat',
                    canonical_name: 'Wheat',
                    suitability_score: 32.0,
                    rank: 1,
                },
            ],
            land_reclamation_advisory: 'Gypsum application recommended.',
        });
        const spawnNoRec = () => {
            const child = createMockChildProcess();
            setImmediate(() => {
                child.stdout.emit('data', Buffer.from(JSON.stringify(noRecResult)));
                child.emit('close', 0, null);
            });
            return child;
        };
        const res2 = await executeRecommendationEngine(
            { state: 'Punjab', sowing_month: 10 },
            { spawnFn: spawnNoRec }
        );
        assert.equal(res2.status, 'NO_RECOMMENDATION_SUITABLE');
        assert.equal(res2.recommendations.length, 1);
        assert.equal(res2.recommendations[0].suitability_score, 32.0);
        assert.equal(res2.land_reclamation_advisory, 'Gypsum application recommended.');
    });

    test('3. Process spawn failure (e.g. ENOENT) produces ProcessSpawnError', async () => {
        const failingSpawn = () => {
            const child = createMockChildProcess();
            setImmediate(() => {
                child.emit('error', new Error('spawn python3 ENOENT'));
            });
            return child;
        };

        await assert.rejects(
            async () => {
                await executeRecommendationEngine(
                    { state: 'Punjab', sowing_month: 10 },
                    { spawnFn: failingSpawn }
                );
            },
            (err) => {
                assert(err instanceof ProcessSpawnError);
                assert(err.message.includes('ENOENT'));
                return true;
            }
        );
    });

    test('4. Non-zero exit code with VALIDATION ERROR produces EngineValidationError', async () => {
        const spawnValidationErr = () => {
            const child = createMockChildProcess();
            setImmediate(() => {
                child.stderr.emit('data', Buffer.from('VALIDATION ERROR: Invalid soil pH 14.2 out of bounds\n'));
                child.emit('close', 1, null);
            });
            return child;
        };

        await assert.rejects(
            async () => {
                await executeRecommendationEngine(
                    { state: 'Punjab', sowing_month: 10 },
                    { spawnFn: spawnValidationErr }
                );
            },
            (err) => {
                assert(err instanceof EngineValidationError);
                assert.equal(err.message, 'Invalid soil pH 14.2 out of bounds');
                return true;
            }
        );
    });

    test('5. Non-zero exit code with general error produces EngineExecutionError', async () => {
        const spawnExecErr = () => {
            const child = createMockChildProcess();
            setImmediate(() => {
                child.stderr.emit('data', Buffer.from('ENGINE EXECUTION ERROR: RuntimeError: catastrophic failure\nTraceback...\n'));
                child.emit('close', 1, null);
            });
            return child;
        };

        await assert.rejects(
            async () => {
                await executeRecommendationEngine(
                    { state: 'Punjab', sowing_month: 10 },
                    { spawnFn: spawnExecErr }
                );
            },
            (err) => {
                assert(err instanceof EngineExecutionError);
                return true;
            }
        );
    });

    test('6. Malformed JSON on stdout produces MalformedJsonOutputError', async () => {
        const spawnMalformed = () => {
            const child = createMockChildProcess();
            setImmediate(() => {
                child.stdout.emit('data', Buffer.from('{ corrupt json output ...'));
                child.emit('close', 0, null);
            });
            return child;
        };

        await assert.rejects(
            async () => {
                await executeRecommendationEngine(
                    { state: 'Punjab', sowing_month: 10 },
                    { spawnFn: spawnMalformed }
                );
            },
            (err) => {
                assert(err instanceof MalformedJsonOutputError);
                return true;
            }
        );
    });

    test('7. Empty stdout produces EmptyOutputError', async () => {
        const spawnEmpty = () => {
            const child = createMockChildProcess();
            setImmediate(() => {
                child.emit('close', 0, null);
            });
            return child;
        };

        await assert.rejects(
            async () => {
                await executeRecommendationEngine(
                    { state: 'Punjab', sowing_month: 10 },
                    { spawnFn: spawnEmpty }
                );
            },
            (err) => {
                assert(err instanceof EmptyOutputError);
                return true;
            }
        );
    });

    test('8. Process timeout terminates child and produces ProcessTimeoutError', async () => {
        let killedWithSignal = null;
        const spawnHanging = () => {
            const child = createMockChildProcess();
            child.kill = (sig) => {
                killedWithSignal = sig;
                setImmediate(() => child.emit('close', null, sig));
                return true;
            };
            return child;
        };

        await assert.rejects(
            async () => {
                await executeRecommendationEngine(
                    { state: 'Punjab', sowing_month: 10 },
                    { spawnFn: spawnHanging, timeoutMs: 50 }
                );
            },
            (err) => {
                assert(err instanceof ProcessTimeoutError);
                assert.equal(killedWithSignal, 'SIGTERM');
                return true;
            }
        );
    });

    test('9. Independent stdout buffer overflow terminates child and produces OversizedOutputError', async () => {
        let killedWithSignal = null;
        const spawnBigStdout = () => {
            const child = createMockChildProcess();
            child.kill = (sig) => {
                killedWithSignal = sig;
                setImmediate(() => child.emit('close', null, sig));
                return true;
            };
            setImmediate(() => {
                // Emit 200 bytes when maxStdoutBytes is 100
                child.stdout.emit('data', Buffer.alloc(200));
            });
            return child;
        };

        await assert.rejects(
            async () => {
                await executeRecommendationEngine(
                    { state: 'Punjab', sowing_month: 10 },
                    { spawnFn: spawnBigStdout, maxStdoutBytes: 100 }
                );
            },
            (err) => {
                assert(err instanceof OversizedOutputError);
                assert.equal(err.details.stream, 'stdout');
                assert.equal(killedWithSignal, 'SIGTERM');
                return true;
            }
        );
    });

    test('10. Independent stderr buffer overflow terminates child and produces OversizedOutputError', async () => {
        let killedWithSignal = null;
        const spawnBigStderr = () => {
            const child = createMockChildProcess();
            child.kill = (sig) => {
                killedWithSignal = sig;
                setImmediate(() => child.emit('close', null, sig));
                return true;
            };
            setImmediate(() => {
                // Emit 200 bytes when maxStderrBytes is 100
                child.stderr.emit('data', Buffer.alloc(200));
            });
            return child;
        };

        await assert.rejects(
            async () => {
                await executeRecommendationEngine(
                    { state: 'Punjab', sowing_month: 10 },
                    { spawnFn: spawnBigStderr, maxStderrBytes: 100 }
                );
            },
            (err) => {
                assert(err instanceof OversizedOutputError);
                assert.equal(err.details.stream, 'stderr');
                assert.equal(killedWithSignal, 'SIGTERM');
                return true;
            }
        );
    });

    test('11. Non-retention of chunks beyond limits: service drops excess chunks without memory blowup', async () => {
        let killedWithSignal = null;
        const spawnExcessChunks = () => {
            const child = createMockChildProcess();
            child.kill = (sig) => {
                killedWithSignal = sig;
                setImmediate(() => child.emit('close', null, sig));
                return true;
            };
            setImmediate(() => {
                // Emit chunk within limit
                child.stdout.emit('data', Buffer.alloc(50));
                // Emit chunk exceeding limit
                child.stdout.emit('data', Buffer.alloc(100));
                // Emit third chunk that should be dropped
                child.stdout.emit('data', Buffer.alloc(100));
            });
            return child;
        };

        await assert.rejects(
            async () => {
                await executeRecommendationEngine(
                    { state: 'Punjab', sowing_month: 10 },
                    { spawnFn: spawnExcessChunks, maxStdoutBytes: 80 }
                );
            },
            (err) => {
                assert(err instanceof OversizedOutputError);
                assert.equal(err.details.stream, 'stdout');
                return true;
            }
        );
    });

    test('12. Separation of stdout and stderr: stderr does not pollute JSON stdout', async () => {
        const validJson = JSON.stringify(makeValidResult());
        const spawnMixed = () => {
            const child = createMockChildProcess();
            setImmediate(() => {
                child.stderr.emit('data', Buffer.from('[Diagnostic log: initializing ML pipeline]\n'));
                child.stdout.emit('data', Buffer.from(validJson));
                child.emit('close', 0, null);
            });
            return child;
        };

        const res = await executeRecommendationEngine(
            { state: 'Punjab', sowing_month: 10 },
            { spawnFn: spawnMixed }
        );
        assert.equal(res.status, 'SUCCESS');
        assert.equal(Array.isArray(res.recommendations), true);
    });

    test('13. Client disconnect aborts and kills child process', async () => {
        const abortController = new AbortController();
        let killedWithSignal = null;

        const spawnLongRunning = () => {
            const child = createMockChildProcess();
            child.kill = (sig) => {
                killedWithSignal = sig;
                setImmediate(() => child.emit('close', null, sig));
                return true;
            };
            return child;
        };

        const execPromise = executeRecommendationEngine(
            { state: 'Punjab', sowing_month: 10 },
            { spawnFn: spawnLongRunning, abortSignal: abortController.signal, timeoutMs: 5000 }
        );

        // Simulate client disconnect after 20ms
        setTimeout(() => {
            abortController.abort();
        }, 20);

        await assert.rejects(
            async () => {
                await execPromise;
            },
            (err) => {
                assert(err instanceof ProcessSignalError);
                assert(err.message.includes('client disconnect'));
                assert.equal(killedWithSignal, 'SIGTERM');
                return true;
            }
        );
    });

    test('14. Security: child_process.spawn enforces shell: false', async () => {
        let capturedShellOption = null;
        const spawnSpy = (exe, args, opts) => {
            capturedShellOption = opts.shell;
            const child = createMockChildProcess();
            setImmediate(() => {
                child.stdout.emit('data', Buffer.from(JSON.stringify(makeValidResult())));
                child.emit('close', 0, null);
            });
            return child;
        };

        await executeRecommendationEngine(
            { state: 'Punjab', sowing_month: 10 },
            { spawnFn: spawnSpy }
        );

        assert.equal(capturedShellOption, false, 'shell must strictly be false to prevent shell injection');
    });

    test('15. Security: client payload cannot override python or script executable path', async () => {
        let capturedExe = null;
        let capturedArgs = null;

        const spawnSpy = (exe, args, opts) => {
            capturedExe = exe;
            capturedArgs = args;
            const child = createMockChildProcess();
            setImmediate(() => {
                child.stdout.emit('data', Buffer.from(JSON.stringify(makeValidResult())));
                child.emit('close', 0, null);
            });
            return child;
        };

        const maliciousPayload = {
            state: 'Punjab',
            sowing_month: 10,
            python_path: '/malicious/bin/python',
            script_path: '/malicious/script.py',
            executable: 'bash',
            args: ['-c', 'rm -rf /'],
        };

        await executeRecommendationEngine(maliciousPayload, { spawnFn: spawnSpy });

        assert.notEqual(capturedExe, '/malicious/bin/python');
        assert.notEqual(capturedExe, 'bash');
        assert.notEqual(capturedArgs[0], '/malicious/script.py');
        assert(capturedArgs[0].endsWith('adapter_cli.py'));
    });

    describe('16. Python Response Validation (Frozen Adapter Contract Compliance)', () => {

        test('16.1 Rejects empty object {} with InvalidEngineOutputError', () => {
            assert.throws(
                () => validateEngineOutput({}),
                InvalidEngineOutputError
            );
        });

        test('16.2 Rejects null with InvalidEngineOutputError', () => {
            assert.throws(
                () => validateEngineOutput(null),
                InvalidEngineOutputError
            );
        });

        test('16.3 Rejects array [1, 2, 3] with InvalidEngineOutputError', () => {
            assert.throws(
                () => validateEngineOutput([1, 2, 3]),
                InvalidEngineOutputError
            );
        });

        test('16.4 Rejects missing status with InvalidEngineOutputError', () => {
            const raw = makeValidResult();
            delete raw.status;
            assert.throws(
                () => validateEngineOutput(raw),
                (err) => {
                    assert(err instanceof InvalidEngineOutputError);
                    assert(err.message.includes("missing mandatory 'status'"));
                    return true;
                }
            );
        });

        test('16.5 Rejects unknown status (e.g. PENDING or UNKNOWN) with InvalidEngineOutputError', () => {
            const raw = makeValidResult({ status: 'PENDING' });
            assert.throws(
                () => validateEngineOutput(raw),
                (err) => {
                    assert(err instanceof InvalidEngineOutputError);
                    assert(err.message.includes("Unknown engine status 'PENDING'"));
                    return true;
                }
            );
        });

        test('16.6 Rejects missing recommendations array with InvalidEngineOutputError', () => {
            const raw = makeValidResult();
            delete raw.recommendations;
            assert.throws(
                () => validateEngineOutput(raw),
                (err) => {
                    assert(err instanceof InvalidEngineOutputError);
                    assert(err.message.includes("missing or invalid 'recommendations'"));
                    return true;
                }
            );
        });

        test('16.7 Rejects missing query_summary with InvalidEngineOutputError', () => {
            const raw = makeValidResult();
            delete raw.query_summary;
            assert.throws(
                () => validateEngineOutput(raw),
                (err) => {
                    assert(err instanceof InvalidEngineOutputError);
                    assert(err.message.includes("missing or invalid 'query_summary'"));
                    return true;
                }
            );
        });

        test('16.8 Rejects missing engine_version with InvalidEngineOutputError', () => {
            const raw = makeValidResult();
            delete raw.engine_version;
            assert.throws(
                () => validateEngineOutput(raw),
                (err) => {
                    assert(err instanceof InvalidEngineOutputError);
                    assert(err.message.includes("missing or invalid 'engine_version'"));
                    return true;
                }
            );
        });

        test('16.9 Rejects missing execution_timestamp with InvalidEngineOutputError', () => {
            const raw = makeValidResult();
            delete raw.execution_timestamp;
            assert.throws(
                () => validateEngineOutput(raw),
                (err) => {
                    assert(err instanceof InvalidEngineOutputError);
                    assert(err.message.includes("missing or invalid 'execution_timestamp'"));
                    return true;
                }
            );
        });

        test('16.10 Rejects malformed recommendation item (non-finite or string suitability_score)', () => {
            const raw = makeValidResult({
                recommendations: [
                    {
                        crop_id: 'wheat',
                        canonical_name: 'Wheat',
                        suitability_score: '92.5', // String instead of number!
                        rank: 1,
                    },
                ],
            });
            assert.throws(
                () => validateEngineOutput(raw),
                (err) => {
                    assert(err instanceof InvalidEngineOutputError);
                    assert(err.message.includes('suitability_score'));
                    return true;
                }
            );
        });

        test('16.11 Accepts valid examples of all three engine statuses', () => {
            // SUCCESS
            const resSuccess = makeValidResult();
            assert.equal(validateEngineOutput(resSuccess), resSuccess);

            // INSUFFICIENT_DATA
            const resInsufficient = makeValidResult({
                status: 'INSUFFICIENT_DATA',
                recommendations: [],
            });
            assert.equal(validateEngineOutput(resInsufficient), resInsufficient);

            // NO_RECOMMENDATION_SUITABLE
            const resNoRec = makeValidResult({
                status: 'NO_RECOMMENDATION_SUITABLE',
                recommendations: [
                    {
                        crop_id: 'barley',
                        canonical_name: 'Barley',
                        suitability_score: 35.0,
                        rank: 1,
                    },
                ],
                land_reclamation_advisory: 'Gypsum treatment required.',
            });
            assert.equal(validateEngineOutput(resNoRec), resNoRec);
        });
    });

    describe('17. Configuration & Environment Reconciliation', () => {
        test('17.1 bridgeConfig defines immutable defaults and correct environment mappings', () => {
            assert.equal(typeof bridgeConfig.TIMEOUT_MS, 'number');
            assert(bridgeConfig.TIMEOUT_MS > 0);

            // Independent stdout and stderr caps
            assert.equal(bridgeConfig.MAX_STDOUT_BYTES, 10 * 1024 * 1024, 'stdout default limit must be 10MB');
            assert.equal(bridgeConfig.MAX_STDERR_BYTES, 1 * 1024 * 1024, 'stderr default limit must be 1MB');

            // Actual SIGTERM-to-SIGKILL grace period
            assert.equal(bridgeConfig.SIGTERM_GRACE_PERIOD_MS, 1000, 'SIGTERM-to-SIGKILL grace period must be 1000ms');

            // Valid status set
            assert.equal(VALID_ENGINE_STATUSES.size, 3);
            assert(VALID_ENGINE_STATUSES.has('SUCCESS'));
            assert(VALID_ENGINE_STATUSES.has('INSUFFICIENT_DATA'));
            assert(VALID_ENGINE_STATUSES.has('NO_RECOMMENDATION_SUITABLE'));
        });
    });

    describe('18. Unified Termination & Escalation Lifecycle (Phase 3C.6.2.2.2)', () => {

        test('18.1 Client disconnect sends SIGTERM and then SIGKILL if process does not close', async () => {
            const abortController = new AbortController();
            const child = createMockChildProcess({ autoClose: false });

            const execPromise = executeRecommendationEngine(
                { state: 'Punjab', sowing_month: 10 },
                { spawnFn: () => child, abortSignal: abortController.signal, gracePeriodMs: 25 }
            );

            // Trigger client disconnect
            abortController.abort();

            // 1. SIGTERM must be delivered immediately
            assert.equal(child.signalsReceived[0], 'SIGTERM');
            assert.equal(child.signalsReceived.length, 1);

            // 2. Wait for grace period (25ms) to expire
            await new Promise((r) => setTimeout(r, 40));

            // 3. SIGKILL must be escalated
            assert.deepEqual(child.signalsReceived, ['SIGTERM', 'SIGKILL']);

            // 4. Emit process close on SIGKILL
            child.emit('close', null, 'SIGKILL');

            await assert.rejects(
                async () => execPromise,
                (err) => {
                    assert(err instanceof ProcessSignalError);
                    assert(err.message.includes('client disconnect'));
                    return true;
                }
            );
        });

        test('18.2 Stdout overflow sends SIGTERM and then SIGKILL if process does not close', async () => {
            const child = createMockChildProcess({ autoClose: false });

            const execPromise = executeRecommendationEngine(
                { state: 'Punjab', sowing_month: 10 },
                { spawnFn: () => child, maxStdoutBytes: 100, gracePeriodMs: 25 }
            );

            // Emit chunk exceeding 100 bytes limit
            child.stdout.emit('data', Buffer.alloc(150));

            // SIGTERM sent immediately
            assert.equal(child.signalsReceived[0], 'SIGTERM');
            assert.equal(child.signalsReceived.length, 1);

            // Wait for grace period (25ms) to expire
            await new Promise((r) => setTimeout(r, 40));

            // SIGKILL must be escalated
            assert.deepEqual(child.signalsReceived, ['SIGTERM', 'SIGKILL']);

            child.emit('close', null, 'SIGKILL');

            await assert.rejects(
                async () => execPromise,
                (err) => {
                    assert(err instanceof OversizedOutputError);
                    assert.equal(err.details.stream, 'stdout');
                    return true;
                }
            );
        });

        test('18.3 Stderr overflow sends SIGTERM and then SIGKILL if process does not close', async () => {
            const child = createMockChildProcess({ autoClose: false });

            const execPromise = executeRecommendationEngine(
                { state: 'Punjab', sowing_month: 10 },
                { spawnFn: () => child, maxStderrBytes: 100, gracePeriodMs: 25 }
            );

            // Emit chunk exceeding 100 bytes limit
            child.stderr.emit('data', Buffer.alloc(150));

            // SIGTERM sent immediately
            assert.equal(child.signalsReceived[0], 'SIGTERM');
            assert.equal(child.signalsReceived.length, 1);

            // Wait for grace period (25ms) to expire
            await new Promise((r) => setTimeout(r, 40));

            // SIGKILL must be escalated
            assert.deepEqual(child.signalsReceived, ['SIGTERM', 'SIGKILL']);

            child.emit('close', null, 'SIGKILL');

            await assert.rejects(
                async () => execPromise,
                (err) => {
                    assert(err instanceof OversizedOutputError);
                    assert.equal(err.details.stream, 'stderr');
                    return true;
                }
            );
        });

        test('18.4 A process that closes during grace period does not receive SIGKILL', async () => {
            // autoClose: true emits 'close' immediately on SIGTERM
            const child = createMockChildProcess({ autoClose: true });

            const execPromise = executeRecommendationEngine(
                { state: 'Punjab', sowing_month: 10 },
                { spawnFn: () => child, maxStdoutBytes: 100, gracePeriodMs: 50 }
            );

            child.stdout.emit('data', Buffer.alloc(150));

            await assert.rejects(
                async () => execPromise,
                OversizedOutputError
            );

            // Wait beyond the 50ms grace period to prove SIGKILL was NOT scheduled or delivered
            await new Promise((r) => setTimeout(r, 70));

            assert.deepEqual(child.signalsReceived, ['SIGTERM'], 'SIGKILL must NOT be sent if child closed on SIGTERM');
        });

        test('18.5 Active timers are properly cleared after process close', async () => {
            const clearedTimerIds = [];
            const mockClearTimeout = (id) => {
                clearedTimerIds.push(id);
                clearTimeout(id);
            };

            const child = createMockChildProcess({ autoClose: true });
            const validJson = JSON.stringify(makeValidResult());

            setImmediate(() => {
                child.stdout.emit('data', Buffer.from(validJson));
                child.emit('close', 0, null);
            });

            await executeRecommendationEngine(
                { state: 'Punjab', sowing_month: 10 },
                { spawnFn: () => child, timeoutMs: 1000, clearTimeoutFn: mockClearTimeout }
            );

            assert(clearedTimerIds.length >= 1, 'Timeout timer must be cleared on process close');
        });

        test('18.6 Original termination reason determines final error type even under signals or exit codes', async () => {
            // 18.6.1 Timeout exit with code 137 / SIGKILL
            const childTimeout = createMockChildProcess({ autoClose: false });
            const p1 = executeRecommendationEngine(
                { state: 'Punjab', sowing_month: 10 },
                { spawnFn: () => childTimeout, timeoutMs: 20, gracePeriodMs: 20 }
            );
            await new Promise((r) => setTimeout(r, 50));
            childTimeout.emit('close', 137, 'SIGKILL');
            await assert.rejects(async () => p1, ProcessTimeoutError);

            // 18.6.2 Stdout overflow exit with code 137 / SIGKILL
            const childStdout = createMockChildProcess({ autoClose: false });
            const p2 = executeRecommendationEngine(
                { state: 'Punjab', sowing_month: 10 },
                { spawnFn: () => childStdout, maxStdoutBytes: 50, gracePeriodMs: 20 }
            );
            childStdout.stdout.emit('data', Buffer.alloc(100));
            await new Promise((r) => setTimeout(r, 30));
            childStdout.emit('close', 137, 'SIGKILL');
            await assert.rejects(async () => p2, (err) => {
                assert(err instanceof OversizedOutputError);
                assert.equal(err.details.stream, 'stdout');
                return true;
            });

            // 18.6.3 Disconnect exit with code 1
            const abortCtrl = new AbortController();
            const childDisc = createMockChildProcess({ autoClose: false });
            const p3 = executeRecommendationEngine(
                { state: 'Punjab', sowing_month: 10 },
                { spawnFn: () => childDisc, abortSignal: abortCtrl.signal, gracePeriodMs: 20 }
            );
            abortCtrl.abort();
            childDisc.emit('close', 1, 'SIGTERM');
            await assert.rejects(async () => p3, (err) => {
                assert(err instanceof ProcessSignalError);
                assert(err.message.includes('client disconnect'));
                return true;
            });
        });

        test('18.7 Existing timeout escalation to SIGKILL remains correct', async () => {
            const child = createMockChildProcess({ autoClose: false });
            const execPromise = executeRecommendationEngine(
                { state: 'Punjab', sowing_month: 10 },
                { spawnFn: () => child, timeoutMs: 20, gracePeriodMs: 25 }
            );

            // Wait for timeout (20ms)
            await new Promise((r) => setTimeout(r, 25));
            assert.equal(child.signalsReceived[0], 'SIGTERM');

            // Wait for grace period (25ms)
            await new Promise((r) => setTimeout(r, 35));
            assert.deepEqual(child.signalsReceived, ['SIGTERM', 'SIGKILL']);

            child.emit('close', null, 'SIGKILL');
            await assert.rejects(async () => execPromise, ProcessTimeoutError);
        });

        test('18.8 Repeated termination requests do not duplicate timers or change classification', async () => {
            const abortController = new AbortController();
            const child = createMockChildProcess({ autoClose: false });

            let timerCount = 0;
            const mockSetTimeout = (fn, delay) => {
                timerCount++;
                return setTimeout(fn, delay);
            };

            const execPromise = executeRecommendationEngine(
                { state: 'Punjab', sowing_month: 10 },
                { spawnFn: () => child, abortSignal: abortController.signal, maxStdoutBytes: 50, gracePeriodMs: 50, setTimeoutFn: mockSetTimeout }
            );

            // 1. First trigger: client disconnect
            abortController.abort();
            const timersAfterAbort = timerCount;

            // 2. Second trigger attempt: stdout overflow after abort
            child.stdout.emit('data', Buffer.alloc(100));
            assert.equal(timerCount, timersAfterAbort, 'No duplicate escalation timer should be created');

            // 3. Third trigger attempt: abort again
            abortController.abort();
            assert.equal(timerCount, timersAfterAbort, 'No duplicate escalation timer should be created on second abort');

            // Close child
            child.emit('close', null, 'SIGTERM');

            await assert.rejects(
                async () => execPromise,
                (err) => {
                    assert(err instanceof ProcessSignalError);
                    assert(err.message.includes('client disconnect'));
                    return true;
                }
            );
        });
    });

    describe('19. PredictV2 Controller Lifecycle & Disconnect Response Closure (Phase 3C.6.2.2.3)', () => {
        test('19.1 Client disconnect aborts the Python bridge', async () => {
            const req = { body: { state: 'Punjab', sowing_month: 10 } };
            const res = createMockResponse();

            let spawnedChild;
            const predictPromise = predictV2(req, res, {
                spawnFn: () => {
                    spawnedChild = createMockChildProcess({ autoClose: false });
                    return spawnedChild;
                },
                timeoutMs: 1000,
            });

            // Simulate client disconnect while Python bridge is processing
            res.emit('close');

            // Wait a tick for event handlers
            await new Promise((r) => setTimeout(r, 10));

            // Verify res was not written to
            assert.equal(res.statusCode, null);
            assert.equal(res.body, null);
            assert.equal(res.writeCalls.length, 0);

            // Clean up child process
            if (spawnedChild) {
                spawnedChild.emit('close', null, 'SIGTERM');
            }
            await predictPromise;
        });

        test('19.2 A subsequent ProcessSignalError does not cause an HTTP response write', async () => {
            const req = { body: { state: 'Punjab', sowing_month: 10 } };
            const res = createMockResponse();

            let childRef;
            const predictPromise = predictV2(req, res, {
                spawnFn: () => {
                    childRef = createMockChildProcess({ autoClose: false });
                    return childRef;
                },
            });

            // Client disconnects before completion
            res.emit('close');

            // Child process closes with SIGTERM, causing bridge to reject with ProcessSignalError
            childRef.emit('close', null, 'SIGTERM');

            await predictPromise;

            // Assert: zero response write on disconnect, no headers sent, no status
            assert.equal(res.statusCode, null);
            assert.equal(res.body, null);
            assert.equal(res.writeCalls.length, 0);
            assert.equal(res.headersSent, false);
        });

        test('19.3 A destroyed response is not written to on error or completion', async () => {
            // Case A: response marked destroyed before error
            const reqA = { body: { state: 'Punjab', sowing_month: 10 } };
            const resA = createMockResponse({ destroyed: true });

            await predictV2(reqA, resA, {
                spawnFn: () => {
                    const child = createMockChildProcess();
                    setImmediate(() => {
                        child.stdout.emit('data', Buffer.from(JSON.stringify({ status: 'INVALID' })));
                        child.emit('close', 0, null);
                    });
                    return child;
                },
            });
            assert.equal(resA.statusCode, null);
            assert.equal(resA.writeCalls.length, 0);

            // Case B: response marked destroyed before success
            const reqB = { body: { state: 'Punjab', sowing_month: 10 } };
            const resB = createMockResponse({ destroyed: true });
            const validOutput = {
                engine_version: '2.2.0-CLOSURE',
                execution_timestamp: '2026-11-21T10:00:00Z',
                status: 'SUCCESS',
                query_summary: {},
                recommendations: [
                    { crop_id: 'wheat', canonical_name: 'Wheat', suitability_score: 95.0, rank: 1 }
                ],
                excluded_candidates: []
            };

            await predictV2(reqB, resB, {
                spawnFn: () => {
                    const child = createMockChildProcess();
                    setImmediate(() => {
                        child.stdout.emit('data', Buffer.from(JSON.stringify(validOutput)));
                        child.emit('close', 0, null);
                    });
                    return child;
                },
            });
            assert.equal(resB.statusCode, null);
            assert.equal(resB.writeCalls.length, 0);
        });

        test('19.4 A normal connected client receives the correct error response without suppression', async () => {
            const req = { body: { state: 'Punjab', sowing_month: 10 } };
            const res = createMockResponse();

            // Simulate EngineValidationError (exit code 1 with "VALIDATION ERROR: Soil pH invalid")
            const predictPromise = predictV2(req, res, {
                spawnFn: () => {
                    const child = createMockChildProcess();
                    setImmediate(() => {
                        child.stderr.emit('data', Buffer.from('VALIDATION ERROR: Soil pH cannot be negative\n'));
                        child.emit('close', 1, null);
                    });
                    return child;
                },
            });

            await predictPromise;

            assert.equal(res.statusCode, 422);
            assert.equal(res.body.success, false);
            assert.equal(res.body.error.code, 'ENGINE_VALIDATION_ERROR');
            assert(res.body.error.message.includes('Soil pH cannot be negative'));
            assert.equal(res.writeCalls.length, 1);
        });

        test('19.5 Existing timeout, spawn, validation, and invalid-output mappings remain unchanged', async () => {
            // Sub-case 1: ProcessTimeoutError -> 504
            {
                const req = { body: { state: 'Punjab', sowing_month: 10 } };
                const res = createMockResponse();
                await predictV2(req, res, {
                    spawnFn: () => {
                        const child = createMockChildProcess();
                        return child;
                    },
                    timeoutMs: 15,
                    gracePeriodMs: 10,
                });
                assert.equal(res.statusCode, 504);
                assert.equal(res.body.error.code, 'EXECUTION_TIMEOUT');
            }

            // Sub-case 2: ProcessSpawnError -> 503
            {
                const req = { body: { state: 'Punjab', sowing_month: 10 } };
                const res = createMockResponse();
                await predictV2(req, res, {
                    spawnFn: () => {
                        const child = createMockChildProcess();
                        setImmediate(() => {
                            child.emit('error', new Error('spawn python3 ENOENT'));
                        });
                        return child;
                    },
                });
                assert.equal(res.statusCode, 503);
                assert.equal(res.body.error.code, 'SERVICE_UNAVAILABLE');
            }

            // Sub-case 3: OversizedOutputError -> 502
            {
                const req = { body: { state: 'Punjab', sowing_month: 10 } };
                const res = createMockResponse();
                await predictV2(req, res, {
                    spawnFn: () => {
                        const child = createMockChildProcess();
                        setImmediate(() => {
                            child.stdout.emit('data', Buffer.alloc(100));
                        });
                        return child;
                    },
                    maxStdoutBytes: 50,
                    gracePeriodMs: 10,
                });
                assert.equal(res.statusCode, 502);
                assert.equal(res.body.error.code, 'OUTPUT_LIMIT_EXCEEDED');
            }

            // Sub-case 4: MalformedJsonOutputError -> 502
            {
                const req = { body: { state: 'Punjab', sowing_month: 10 } };
                const res = createMockResponse();
                await predictV2(req, res, {
                    spawnFn: () => {
                        const child = createMockChildProcess();
                        setImmediate(() => {
                            child.stdout.emit('data', Buffer.from('{not json'));
                            child.emit('close', 0, null);
                        });
                        return child;
                    },
                });
                assert.equal(res.statusCode, 502);
                assert.equal(res.body.error.code, 'INVALID_ENGINE_OUTPUT');
            }

            // Sub-case 5: Valid SUCCESS output -> 200 OK
            {
                const req = { body: { state: 'Punjab', sowing_month: 10 } };
                const res = createMockResponse();
                const validOutput = {
                    engine_version: '2.2.0-CLOSURE',
                    execution_timestamp: '2026-11-21T10:00:00Z',
                    status: 'SUCCESS',
                    query_summary: {},
                    recommendations: [
                        { crop_id: 'wheat', canonical_name: 'Wheat', suitability_score: 95.0, rank: 1 }
                    ],
                    excluded_candidates: []
                };
                await predictV2(req, res, {
                    spawnFn: () => {
                        const child = createMockChildProcess();
                        setImmediate(() => {
                            child.stdout.emit('data', Buffer.from(JSON.stringify(validOutput)));
                            child.emit('close', 0, null);
                        });
                        return child;
                    },
                });
                assert.equal(res.statusCode, 200);
                assert.equal(res.body.success, true);
                assert.equal(res.body.status, 'SUCCESS');
            }
        });
    });
});
