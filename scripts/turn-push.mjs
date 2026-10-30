#!/usr/bin/env node
/** Turn-Abschluss: verify:all, deutscher Steam-Notes-Commit, sofortiger Push. */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const verify = spawnSync('npm', ['run', 'verify:all'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
if (verify.status !== 0) {
  fail(1, 'ERR-4006', 'turn:finish', 'verify:all ist rot; kein Commit und kein Push');
  process.exit(1);
}

git(['add', '-A']);
const staged = git(['diff', '--cached', '--name-only']);
if (!staged) {
  console.log('turn:finish: keine Aenderungen zu committen');
  process.exit(0);
}

const files = staged.split(/\r?\n/).filter(Boolean);
const notesPath = resolve(ROOT, '.turn-notes.md');
let message;
if (existsSync(notesPath)) {
  message = readFileSync(notesPath, 'utf8').trim();
} else {
  const shown = files.slice(0, 8).map((file) => `- ${file} aktualisiert.`).join('\n');
  const more = files.length > 8 ? `\n- Weitere ${files.length - 8} Dateien im selben Turn.` : '';
  message = [
    `Turn: ${files.length} Dateien aktualisiert`,
    '',
    '### Changes (Was ist neu)',
    shown + more,
    '',
    '### Technische Basis & Kausalität',
    '- Alle Änderungen laufen über den einen Store-, Ledger- und Snapshot-Vertrag; die Governance-Gates prüfen jede Stufe vor dem Commit.',
    '',
    '### Ausblick (Nächste Schritte)',
    '- Offene Spielsysteme und UI-Pfade nach den dokumentierten Prioritäten weiterführen.',
  ].join('\n');
}

const messageFile = resolve(ROOT, '.git', 'TURN_COMMIT_MSG');
writeFileSync(messageFile, `${message}\n`);
spawnSync(process.execPath, ['scripts/sanitize-commit.mjs', messageFile], { cwd: ROOT, stdio: 'inherit' });
const gate = spawnSync(process.execPath, ['scripts/verify-commit-msg.mjs', messageFile], { cwd: ROOT, stdio: 'inherit' });
if (gate.status !== 0) {
  fail(1, 'ERR-4006', 'turn:finish', 'Commit-Nachricht besteht das Notes-Gate nicht');
  process.exit(1);
}

git(['commit', '-F', messageFile]);
console.log(`turn:finish: Commit ${git(['rev-parse', '--short', 'HEAD'])} erstellt`);
const push = spawnSync('git', ['push', '-u', 'origin', 'HEAD'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
if (push.status !== 0) {
  fail(1, 'ERR-4008', 'turn:finish', 'Push auf den aktuellen Branch fehlgeschlagen');
  process.exit(1);
}
console.log('turn:finish: PASS, aktueller Branch gepusht');
