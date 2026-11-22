# FieldWise — Phase 3C.6.2.2.3: Process Security, Unified Execution Governance & Client Disconnect Response Closure Report

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_2_2_process_security_report.md`  
**Phase**: 3C.6.2.2.3 Client Disconnect Response Closure  
**Execution Timestamp**: November 2026  
**Status**: APPROVED PROCESS SECURITY AUDIT  

---

## 1. Executive Summary

This report documents the unified child-process termination architecture, process lifecycle controls, independent stream buffer bounds, error precedence guarantees, and client disconnect response closure implemented across the Node.js backend bridge (`FieldWise_main/backend/src/services/v2/recommendationBridgeService.js`), its configuration (`FieldWise_main/backend/src/config/v2/bridgeConfig.js`), and its V2 HTTP controller (`FieldWise_main/backend/src/controllers/v2/predictController.js`).

Phase 3C.6.2.2.3 completes the final controller-level lifecycle closure:
1. Retains child-process termination on client disconnect (`res.on('close')` $\rightarrow$ `abortController.abort()`).
2. Introduces strict pre-write response guards checking `res.writableEnded || res.destroyed || abortController.signal.aborted`.
3. Guarantees that when a client disconnects prematurely, subsequent process rejections (e.g. `ProcessSignalError`) do NOT attempt an HTTP response write, log spurious error stacks, or leak resources.
4. Preserves all standard error-to-HTTP status code mappings (422, 504, 503, 502, 500) for active, connected clients without suppression.

---

## 2. Server Environment Variables & Configuration

The backend bridge exposes four standardized environment variables with established defaults and fallbacks:

| Variable Name | Fallback Name | Default Value | Functional Scope |
| :--- | :--- | :---: | :--- |
| `FIELDWISE_PYTHON_PATH` | `PYTHON_PATH` | `'python3'` | Server-controlled path to Python 3 runtime. |
| `FIELDWISE_BRIDGE_TIMEOUT_MS` | `RECOMMENDATION_ENGINE_TIMEOUT_MS` | `10000` (10s) | Process execution timeout cap in milliseconds. |
| `FIELDWISE_BRIDGE_MAX_STDOUT_BYTES` | `RECOMMENDATION_ENGINE_MAX_BUFFER_BYTES` | `10485760` (10MB) | Independent maximum stdout buffer capacity. |
| `FIELDWISE_BRIDGE_MAX_STDERR_BYTES` | None | `1048576` (1MB) | Independent maximum stderr buffer capacity. |

---

## 3. Process Execution Architecture: `spawn` vs `exec`

### 3.1 Prohibition of Shell Execution
Using `child_process.exec` or passing `{ shell: true }` invokes an intermediate shell interpreter (e.g. `/bin/sh`). Shell parsing introduces critical vulnerabilities:
- Shell metacharacter injection (`;`, `&`, `|`, `` ` ``, `$()`).
- Uncontrolled environment variable substitution.
- Spawning of untracked subshells and orphaned processes.

### 3.2 Strict Non-Shell Spawning
The bridge strictly invokes `child_process.spawn` with `{ shell: false }`:
```javascript
const child = spawn(
    pythonPath,
    [adapterCliPath],
    {
        cwd: bridgeConfig.PROJECT_ROOT,
        env,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe']
    }
);
```
- Direct operating system binary execution via `execve`.
- Input parameters are transferred exclusively across the private `stdin` stream via `child.stdin.write(inputJson)` and ended with `child.stdin.end()`.
- Client inputs are never passed on command-line arguments.

---

## 4. Independent Stream Limits & Chunk Non-Retention

### 4.1 Independent Buffer Caps
The bridge configures and enforces independent buffer caps:
- **Stdout Buffer Cap**: `10 * 1024 * 1024` bytes (10 MB).
- **Stderr Buffer Cap**: `1 * 1024 * 1024` bytes (1 MB).

### 4.2 Non-Retention of Excess Chunks
To protect against memory exhaustion from runaway processes:
- When incoming stdout bytes exceed `maxStdoutBytes`, `terminateChild(TerminationReason.STDOUT_OVERFLOW)` is called immediately.
- When incoming stderr bytes exceed `maxStderrBytes`, `terminateChild(TerminationReason.STDERR_OVERFLOW)` is called immediately.
- Excess chunks are dropped immediately and not retained in memory.
- The process is escalated to SIGKILL if it does not exit within the 1,000 ms grace window.

---

## 5. Unified Termination & Escalation Mechanism

### 5.1 Architecture of `terminateChild(reason, details)`
Phase 3C.6.2.2.2 implements **one unified, reusable child-process termination mechanism** across all four forced-termination pathways:
1. **Execution timeout** (`TerminationReason.TIMEOUT`)
2. **Client disconnect** (`TerminationReason.CLIENT_DISCONNECT`)
3. **Stdout buffer overflow** (`TerminationReason.STDOUT_OVERFLOW`)
4. **Stderr buffer overflow** (`TerminationReason.STDERR_OVERFLOW`)

```javascript
function terminateChild(reason, details = {}) {
    if (terminationReason !== null || childClosed) {
        // Idempotent: first termination reason wins; prevents duplicate timers
        return;
    }

    terminationReason = reason;
    terminationDetails = details;

    console.warn(`[Bridge] Terminating recommendation engine child process. Reason: ${reason}. Sending SIGTERM.`);
    try {
        child.kill('SIGTERM');
    } catch (killErr) {
        console.warn(`[Bridge] Failed to deliver SIGTERM: ${killErr.message}`);
    }

    // Start grace period timer before escalating to SIGKILL
    forceKillTimer = setTimeoutFn(() => {
        if (!childClosed) {
            console.warn(`[Bridge] Child process did not exit within ${gracePeriodMs}ms grace period. Sending SIGKILL.`);
            try {
                child.kill('SIGKILL');
            } catch (killErr) {
                console.warn(`[Bridge] Failed to deliver SIGKILL: ${killErr.message}`);
            }
        }
    }, gracePeriodMs);
}
```

### 5.2 Six Lifecycle Guarantees
1. **Idempotence & No Duplicate Timers**: The check `if (terminationReason !== null || childClosed) return;` guarantees that the first termination event locks in the reason. Repeated or concurrent abort triggers (e.g. client disconnect followed by buffer overflow or timeout) cannot create duplicate timers or alter the classification.
2. **Immediate Graceful Termination**: Delivers `SIGTERM` on the exact tick the termination condition occurs.
3. **Configured Grace Escalation**: Starts a timer for `bridgeConfig.SIGTERM_GRACE_PERIOD_MS` (default: **1,000 ms / 1.0 second**).
4. **Uncatchable Escalation (`SIGKILL`)**: If the child process does not emit `close` within 1,000 ms of `SIGTERM`, `SIGKILL` is delivered.
5. **Timer Cleanup on Close**: When the child process exits (via `SIGTERM`, normal exit, or `SIGKILL`), all active timers (`timeoutTimer`, `forceKillTimer`) are immediately cleared via `clearTimeoutFn`. If the process exits during the grace period, `forceKillTimer` is cancelled and `SIGKILL` is never sent.
6. **Error Precedence Preservation**: When `child.on('close')` fires, the bridge classifies the rejection strictly using the recorded `terminationReason`:
   - `TIMEOUT` $\rightarrow$ `ProcessTimeoutError`
   - `STDOUT_OVERFLOW` $\rightarrow$ `OversizedOutputError` (`stream: 'stdout'`)
   - `STDERR_OVERFLOW` $\rightarrow$ `OversizedOutputError` (`stream: 'stderr'`)
   - `CLIENT_DISCONNECT` $\rightarrow$ `ProcessSignalError` (`'Recommendation engine process terminated due to client disconnect.'`)
   The exit signal (`SIGTERM` or `SIGKILL`) or exit code (e.g. `137` or `1`) is recorded in error details but **never** overwrites the original termination reason.

### 5.3 Controller Disconnect & Destroyed Response Guard (Phase 3C.6.2.2.3 Closure)
In `FieldWise_main/backend/src/controllers/v2/predictController.js`, Express socket lifecycle state is actively coordinated with the Python execution lifecycle:
1. **Client Disconnect Listener**: `res.on('close', () => { if (!res.writableEnded) abortController.abort(); })` triggers immediate graceful termination of the Python child process.
2. **Pre-Write Guards in `try` and `catch`**:
   ```javascript
   if (res.writableEnded || res.destroyed || abortController.signal.aborted) {
       return;
   }
   ```
3. **Zero-Write Guarantee**: If a client socket disconnects, is destroyed, or ends prematurely:
   - The controller terminates early without attempting an HTTP response write (`res.status(...).json(...)`).
   - Suppresses misleading `[PredictV2 Error]` console logs and stack traces on aborted client sockets.
   - Prevents `ERR_HTTP_HEADERS_SENT` and unhandled promise rejections on dead connections.
4. **Preservation of Connected Client Errors**: When the client socket remains open and connected, normal engine errors (422, 504, 503, 502, 500) are delivered with full diagnostic fidelity and without suppression.

---

## 6. Python Response Validation Before Returning Success

After JSON parsing of stdout, `validateEngineOutput` validates the result against the frozen adapter output contract before resolving:
1. **Plain Object Requirement**: Rejects `null`, arrays, primitives, and empty objects (`{}`).
2. **Status Requirement**: `status` must be exactly one of: `SUCCESS`, `INSUFFICIENT_DATA`, `NO_RECOMMENDATION_SUITABLE`.
3. **Required Fields**: `engine_version`, `execution_timestamp`, `query_summary` (plain object), `recommendations` (array), `excluded_candidates` (array).
4. **Recommendation Object Invariants**: `crop_id` (string), `canonical_name` (string), `suitability_score` (strict finite number), `rank` (integer).
5. **Zero Fabrication**: The bridge never defaults missing statuses or manufactures empty recommendation arrays. Any contract violation rejects with `InvalidEngineOutputError`, returning HTTP 502 Bad Gateway.

---

## 7. Error Sanitization & Information Leakage Prevention

- Full stderr tracebacks and diagnostic messages are logged to server console (`console.error`) for operator inspection.
- Client responses contain sanitized messages with all absolute repository paths (`/Users/...`) stripped and replaced with `[REPO_ROOT]` or `[PATH]`.
- Internal tracebacks and database connection details are strictly suppressed.

---

## 8. Verification Results

| Test ID | Security Invariant Verified | Outcome |
| :---: | :--- | :---: |
| **Unit 8** | Execution timeout aborts child process (`SIGTERM`) | **PASS** |
| **Unit 9** | Independent stdout overflow (> 10MB) terminates child and rejects | **PASS** |
| **Unit 10** | Independent stderr overflow (> 1MB) terminates child and rejects | **PASS** |
| **Unit 11** | Non-retention of chunks drops excess data without memory blowup | **PASS** |
| **Unit 13** | Premature client disconnect aborts child process cleanly | **PASS** |
| **Unit 14** | `child_process.spawn` enforces `shell: false` strictly | **PASS** |
| **Unit 15** | Client payload cannot override Python or script paths | **PASS** |
| **Unit 16.1-16.11** | Output contract validation rejects `{}`, `null`, arrays, missing status, unknown status | **PASS** |
| **Unit 17.1** | Immutable defaults: stdout=10MB, stderr=1MB, grace period=1000ms | **PASS** |
| **Unit 18.1** | Client disconnect delivers SIGTERM then escalates to SIGKILL if child remains open | **PASS** |
| **Unit 18.2** | Stdout overflow delivers SIGTERM then escalates to SIGKILL if child remains open | **PASS** |
| **Unit 18.3** | Stderr overflow delivers SIGTERM then escalates to SIGKILL if child remains open | **PASS** |
| **Unit 18.4** | Child closing during grace period cancels escalation timer (no SIGKILL sent) | **PASS** |
| **Unit 18.5** | Timers are cleared on child process close | **PASS** |
| **Unit 18.6** | Original termination reason strictly determines final error type under SIGKILL / exit codes | **PASS** |
| **Unit 18.7** | Existing timeout escalation to SIGKILL verified | **PASS** |
| **Unit 18.8** | Repeated termination requests are idempotent, create no duplicate timers, preserve reason | **PASS** |
| **Unit 19.1** | Client disconnect aborts Python bridge child process | **PASS** |
| **Unit 19.2** | Subsequent ProcessSignalError causes zero HTTP response write on disconnect | **PASS** |
| **Unit 19.3** | Destroyed response (`res.destroyed`) is not written to on error or completion | **PASS** |
| **Unit 19.4** | Normal connected client receives full error response (422) without suppression | **PASS** |
| **Unit 19.5** | Mappings for 504 (timeout), 503 (spawn), 502 (buffer/invalid), 200 (success) remain intact | **PASS** |
| **Integ 4.1-4.7** | Strict JSON numeric type validation rejects strings, booleans, objects, arrays, NaN, Inf | **PASS** |
