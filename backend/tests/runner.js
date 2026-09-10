const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const testSuites = [
  { name: 'Phase 1: Core Authentication & Architecture', file: 'phase1-auth.test.js', expected: 17 },
  { name: 'Phase 2: RBAC & Profiles', file: 'phase2-profile.test.js', expected: 10 },
  { name: 'Phase 3: Doctor Verification & Admin Approval', file: 'phase3-doctor-verification.test.js', expected: 24 },
  { name: 'Phase 4: Patient AI Assistant & Safety', file: 'phase4-ai.test.js', expected: 27 },
  { name: 'Phase 5: Verified Doctor Discovery & Slots', file: 'phase5-appointments.test.js', expected: 31 },
  { name: 'Phase 6: Consultations & Real-Time Comms', file: 'phase6-consultations.test.js', expected: 22 },
  { name: 'Phase 7: Medical Records, Prescriptions & Reports', file: 'phase7-medical.test.js', expected: 50 },
  { name: 'Phase 8: Medicine Orders & Delivery Tracking', file: 'phase8-orders.test.js', expected: 59 },
  { name: 'Phase 9: Notifications, Reviews & Analytics', file: 'phase9-full.test.js', expected: 56 }
];

const runAll = async () => {
  const filterArg = process.argv[2];
  const suitesToRun = filterArg
    ? testSuites.filter(s => s.file.includes(filterArg) || s.name.toLowerCase().includes(filterArg.toLowerCase()))
    : testSuites;

  console.log('====================================================');
  console.log('       VitaLink Unified Automated Test Runner       ');
  console.log('====================================================');
  console.log(`Executing ${suitesToRun.length} test suite(s)...\n`);

  const results = [];
  let totalSuitesPassed = 0;
  let totalSuitesFailed = 0;

  for (const suite of suitesToRun) {
    const testPath = path.join(__dirname, suite.file);
    if (!fs.existsSync(testPath)) {
      console.error(`[Runner Error] File not found: ${suite.file}`);
      results.push({ ...suite, status: 'NOT_FOUND', exitCode: 1 });
      totalSuitesFailed++;
      continue;
    }

    console.log(`\n>>> Running: ${suite.name} (${suite.file})`);
    const startTime = Date.now();
    const child = spawnSync(process.execPath, [testPath], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: process.env
    });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (child.status === 0) {
      console.log(`>>> PASS: ${suite.name} (${duration}s)\n`);
      results.push({ ...suite, status: 'PASSED', duration, exitCode: 0 });
      totalSuitesPassed++;
    } else {
      console.error(`>>> FAIL: ${suite.name} (exit code ${child.status}, ${duration}s)\n`);
      results.push({ ...suite, status: 'FAILED', duration, exitCode: child.status || 1 });
      totalSuitesFailed++;
    }
  }

  console.log('\n====================================================');
  console.log('          VITALINK TEST EXECUTION SUMMARY           ');
  console.log('====================================================');
  results.forEach((r) => {
    const icon = r.status === 'PASSED' ? '✓ PASS' : '✗ FAIL';
    console.log(` ${icon} [${r.status}] ${r.name.padEnd(48)} (${r.duration}s)`);
  });
  console.log('====================================================');
  console.log(` Total Suites: ${results.length} | Passed: ${totalSuitesPassed} | Failed: ${totalSuitesFailed}`);
  console.log('====================================================\n');

  if (totalSuitesFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runAll();
