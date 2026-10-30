#!/usr/bin/env node
/** Fail-Closed-Pipeline: Autofix vor den harten Gates, jeder Fehler indiziert. */
import { spawnSync } from 'node:child_process';
import { line, ROOT } from './lib/report.mjs';

const steps = [
  ['lint', 'npm', ['run', 'lint'], 'ERR-4011'],
  ['check:loc', 'npm', ['run', 'check:loc'], 'ERR-4012'],
  ['typecheck', 'npm', ['run', 'typecheck'], 'ERR-1005'],
  ['test-quality', process.execPath, ['scripts/verify-test-quality.mjs'], 'ERR-4002'],
  ['dead-code', process.execPath, ['scripts/verify-dead-code.mjs'], 'ERR-4003'],
  ['dependency-matrix', process.execPath, ['scripts/sync-dependency-matrix.mjs', '--check'], 'ERR-4013'],
  ['audit', 'npm', ['run', 'audit:gate'], 'ERR-4004'],
  ['tests', 'npm', ['run', 'test:ci'], 'ERR-2001'],
  ['build', 'npm', ['run', 'build'], 'ERR-1005'],
];

console.log('=== ERR-0911 Autofix ===');
const autofix = spawnSync(process.execPath, ['scripts/autofix-0911.mjs'], { cwd: ROOT, stdio: 'inherit' });
if (autofix.status !== 0) {
  console.error(line(1, 'ERR-0911', 'pipeline', 'Autofix konnte nicht vollstaendig laufen'));
}

let failed = 0;
let index = 0;
for (const [name, command, args, code] of steps) {
  console.log(`=== Gate: ${name} ===`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: command === 'npm' && process.platform === 'win32' });
  if (result.status !== 0) {
    failed += 1;
    index += 1;
    console.error(line(index, code, `pipeline/${name}`, 'Gate fehlgeschlagen; Details oben'));
  }
}

if (failed > 0) {
  console.error(`verify:all: ${failed} Gate(s) rot`);
  process.exit(1);
}
console.log('verify:all: PASS (alle Gates gruen)');
process.exit(0);
