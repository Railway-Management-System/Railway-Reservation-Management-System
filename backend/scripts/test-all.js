/**
 * Railway Reservation System - Master Test Runner (test-all)
 * Runs all test suites sequentially with clean quiet DB reloads between suites:
 * test:d1, test:d2, test:d3a, test:d3b1, test:d3b2, test:d3b3, test:d3c1, test:d3c2
 */

const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '../../');
const backendDir = path.resolve(__dirname, '../');

const SUITES = [
  { name: 'test:d1', script: 'scripts/test-d1.js', desc: 'Geography, Trains, Availability & Fallback' },
  { name: 'test:d2', script: 'scripts/test-d2.js', desc: 'Hold Window, Quotas, Fares & Payments' },
  { name: 'test:d3a', script: 'scripts/test-d3a.js', desc: 'Cancellations, Refunds & Counter Bookings' },
  { name: 'test:d3b1', script: 'scripts/test-d3b1.js', desc: 'My Bookings, PNR Lookup & Security' },
  { name: 'test:d3b2', script: 'scripts/test-d3b2.js', desc: 'Staff Verification, Boarding & No-Show' },
  { name: 'test:d3b3', script: 'scripts/test-d3b3.js', desc: 'TDR Filing, Review & Audit Assertions' },
  { name: 'test:d3c1', script: 'scripts/test-d3c1.js', desc: 'Chart Prep, Settings, Maintenance & Manifest' },
  { name: 'test:d3c2', script: 'scripts/test-d3c2.js', desc: 'Fines, Incidents, Live Reports, Reports & Staff' },
  { name: 'test:d4', script: 'scripts/test-d4.js', desc: 'Daily Operations Simulator & Idempotency' }
];

function runQuietly(cmd, args, cwd) {
  const res = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
    maxBuffer: 64 * 1024 * 1024
  });
  return res;
}

function runDatabaseReload() {
  process.stdout.write('  [Database] Reloading seed dataset via database/load/run-all.js... ');
  const res = runQuietly('node', ['database/load/run-all.js'], rootDir);
  if (res.status !== 0) {
    process.stdout.write('FAILED!\n');
    console.error('\nDatabase reload failed:');
    console.error(res.stderr || res.stdout);
    throw new Error('Database reload failed');
  }
  process.stdout.write('done.\n');
}

function extractAssertions(output) {
  // Try pattern: "157/157 TESTS PASSED" or "ALL 52/52 TESTS PASSED" or "ALL TESTS PASSED: 38/38"
  const m1 = output.match(/(\d+)\s*\/\s*(\d+)\s+TESTS?\s+PASSED/i);
  if (m1) {
    return { passed: parseInt(m1[1], 10), total: parseInt(m1[2], 10) };
  }
  const m2 = output.match(/ALL\s+TESTS\s+PASSED:\s*(\d+)\/(\d+)/i);
  if (m2) {
    return { passed: parseInt(m2[1], 10), total: parseInt(m2[2], 10) };
  }
  const m3 = output.match(/ALL\s+(\d+)\/(\d+)\s+TESTS/i);
  if (m3) {
    return { passed: parseInt(m3[1], 10), total: parseInt(m3[2], 10) };
  }
  // Fallback: count lines matching PASS:
  const passLines = (output.match(/^\s*PASS:/gm) || []).length;
  if (passLines > 0) {
    return { passed: passLines, total: passLines };
  }
  return { passed: 0, total: 0 };
}

async function main() {
  console.log('========================================================================================');
  console.log(' MASTER TEST RUNNER: ALL SUITES (test:d1 -> test:d3c2)');
  console.log('========================================================================================\n');

  const results = [];
  const startAllTime = Date.now();

  for (const suite of SUITES) {
    console.log(`\n>>> EXECUTING SUITE: ${suite.name} (${suite.desc})`);
    
    // 1. Run database reload quietly
    try {
      runDatabaseReload();
    } catch (err) {
      results.push({
        suite: suite.name,
        desc: suite.desc,
        status: 'FAIL',
        passed: 0,
        total: 0,
        duration: '0.0s',
        error: err.message
      });
      continue;
    }

    // 2. Run the test suite
    process.stdout.write(`  [Running] node ${suite.script}... `);
    const suiteStartTime = Date.now();
    const suiteRes = runQuietly('node', [suite.script], backendDir);
    const suiteDuration = ((Date.now() - suiteStartTime) / 1000).toFixed(1) + 's';

    const fullOutput = (suiteRes.stdout || '') + (suiteRes.stderr || '');
    const assertions = extractAssertions(fullOutput);

    if (suiteRes.status === 0) {
      process.stdout.write(`PASSED (${assertions.passed}/${assertions.total} tests in ${suiteDuration})\n`);
      results.push({
        suite: suite.name,
        desc: suite.desc,
        status: 'PASS',
        passed: assertions.passed,
        total: assertions.total,
        duration: suiteDuration
      });
    } else {
      process.stdout.write(`FAILED in ${suiteDuration}\n`);
      results.push({
        suite: suite.name,
        desc: suite.desc,
        status: 'FAIL',
        passed: assertions.passed,
        total: assertions.total,
        duration: suiteDuration,
        output: fullOutput
      });

      console.error('\n----------------------------- FAILING SUITE RAW OUTPUT -----------------------------');
      console.error(fullOutput);
      console.error('------------------------------------------------------------------------------------\n');
    }
  }

  // Final database reload to leave database clean
  console.log('\n>>> FINAL CLEANUP: Restoring database state');
  try {
    runDatabaseReload();
  } catch (_) {}

  const totalTime = ((Date.now() - startAllTime) / 1000).toFixed(1) + 's';

  // Print Summary Table
  console.log('\n========================================================================================');
  console.log(' MASTER TEST EXECUTION SUMMARY');
  console.log('========================================================================================');
  console.log(
    '| ' + 'Suite'.padEnd(12) +
    '| ' + 'Description'.padEnd(46) +
    '| ' + 'Result'.padEnd(8) +
    '| ' + 'Assertions'.padEnd(14) +
    '| ' + 'Duration'.padEnd(10) + '|'
  );
  console.log('|-' + '-'.repeat(12) + '+-' + '-'.repeat(46) + '+-' + '-'.repeat(8) + '+-' + '-'.repeat(14) + '+-' + '-'.repeat(10) + '-|');

  let totalPassedAssertions = 0;
  let totalTotalAssertions = 0;
  let allPassed = true;

  for (const r of results) {
    totalPassedAssertions += r.passed;
    totalTotalAssertions += r.total;
    if (r.status !== 'PASS') allPassed = false;

    const assertStr = `${r.passed}/${r.total}`;
    console.log(
      '| ' + r.suite.padEnd(12) +
      '| ' + r.desc.padEnd(46) +
      '| ' + r.status.padEnd(8) +
      '| ' + assertStr.padEnd(14) +
      '| ' + r.duration.padEnd(10) + '|'
    );
  }

  console.log('========================================================================================');
  console.log(`TOTAL SUITES: ${results.length} | PASSED: ${results.filter(r => r.status === 'PASS').length} | FAILED: ${results.filter(r => r.status !== 'PASS').length}`);
  console.log(`TOTAL ASSERTIONS: ${totalPassedAssertions}/${totalTotalAssertions} (${allPassed ? '100%' : 'INCOMPLETE'}) | TOTAL TIME: ${totalTime}`);
  console.log('========================================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Master test runner fatal error:', err);
  process.exit(1);
});
