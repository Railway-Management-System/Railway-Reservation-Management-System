/**
 * Demo Refresh Pipeline
 * Runs database/load/run-all.js quietly, followed by simulate:daily
 */

const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '../../');
const backendDir = path.resolve(__dirname, '../');

console.log('================================================================================');
console.log(' RAILWAY RESERVATION SYSTEM - DEMO REFRESH PIPELINE');
console.log('================================================================================\n');

console.log('>>> [demo:refresh] Step 1: Reloading seed dataset via database/load/run-all.js...');
const reloadRes = spawnSync('node', ['database/load/run-all.js'], {
  cwd: rootDir,
  encoding: 'utf8',
  stdio: 'inherit'
});

if (reloadRes.status !== 0) {
  console.error('\n[demo:refresh ERROR]: Database reload failed with exit code', reloadRes.status);
  process.exit(1);
}

console.log('\n>>> [demo:refresh] Step 2: Executing daily operations simulator (simulate-daily.js)...');
const simRes = spawnSync('node', ['scripts/simulate-daily.js'], {
  cwd: backendDir,
  encoding: 'utf8',
  stdio: 'inherit'
});

if (simRes.status !== 0) {
  console.error('\n[demo:refresh ERROR]: Simulator failed with exit code', simRes.status);
  process.exit(1);
}

console.log('\n✓ Demo refresh completed successfully.');
