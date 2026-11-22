
const { spawnSync } = require('child_process');
const path = require('path');

const BACKEND_DIR = path.resolve(__dirname, '../..');

console.log('================================================================================');
console.log('FieldWise Phase 3C.6.2.2: Unified Backend Test Execution Suite');
console.log('================================================================================');

const testSuites = [
    {
        name: 'Legacy Auth & Predictor Smoke Tests',
        file: 'src/tests/auth.test.js',
        useNodeTest: false,
    },
    {
        name: 'V2 Bridge Deterministic Unit Tests (Mock Child Process)',
        file: 'src/tests/v2_bridge_unit.test.js',
        useNodeTest: true,
    },
    {
        name: 'V2 Bridge Live Integration Tests (Live Express & Python Adapter)',
        file: 'src/tests/v2_bridge_integration.test.js',
        useNodeTest: true,
    },
    {
        name: 'V2 Persistence & Idempotency Tests',
        file: 'src/tests/v2_persistence_idempotency.test.js',
        useNodeTest: true,
    },
    {
        name: 'V2 Persistence & Security Integration Tests',
        file: 'src/tests/v2_persistence_integration.test.js',
        useNodeTest: true,
    },
    {
        name: 'Phase 2: Security Remediation Tests (CORS, JWT, Rate Limiting)',
        file: 'src/tests/security_remediation.test.js',
        useNodeTest: true,
    },
    {
        name: 'Final Authentication Closure Tests (Firebase & Handoff Security)',
        file: 'src/tests/firebase_handoff_security.test.js',
        useNodeTest: true,
    },
];

let totalPassedSuites = 0;
let totalFailedSuites = 0;

for (const suite of testSuites) {
    console.log(`\n▶ Running: ${suite.name} (${suite.file})...`);
    const filePath = path.resolve(BACKEND_DIR, suite.file);
    const args = suite.useNodeTest ? ['--test', filePath] : [filePath];

    const result = spawnSync(process.execPath, args, {
        cwd: BACKEND_DIR,
        stdio: 'inherit',
        env: process.env,
    });

    if (result.status === 0) {
        console.log(`✔ ${suite.name}: PASSED`);
        totalPassedSuites++;
    } else {
        console.error(`✖ ${suite.name}: FAILED (exit code ${result.status})`);
        totalFailedSuites++;
    }
}

console.log('\n================================================================================');
console.log(`Backend Test Summary: ${totalPassedSuites}/${testSuites.length} Suites Passed`);
console.log('================================================================================');

if (totalFailedSuites > 0) {
    process.exit(1);
} else {
    console.log('🎉 All backend tests executed cleanly and successfully!');
    process.exit(0);
}
