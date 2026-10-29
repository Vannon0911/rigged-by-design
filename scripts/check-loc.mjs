#!/usr/bin/env node
/**
 * LOC-Guard fuer VaCoin Casino Roguelite.
 *
 * Regel: jede .ts/.tsx Datei unter src/ darf maximal 200 Zeilen haben.
 * Ausnahme: 350 Zeilen, aber nur wenn Zeile 1 ein begruendeter Header ist:
 *   // @loc-exception: <Begruendung>
 *
 * Exit-Code 1 bei Verstoessen, sonst 0.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_DIR = join(ROOT, 'src');
const DEFAULT_LIMIT = 200;
const EXCEPTION_LIMIT = 350;
const EXCEPTION_TAG = '// @loc-exception:';

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}

function countLines(text) {
  if (text.length === 0) return 0;
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.length;
}

function hasExceptionHeader(text) {
  const firstLine = text.split(/\r?\n/, 1)[0].trimStart();
  if (!firstLine.startsWith(EXCEPTION_TAG)) return false;
  return firstLine.slice(EXCEPTION_TAG.length).trim().length > 0;
}

if (!existsSync(SRC_DIR)) {
  console.error(`check:loc - Verzeichnis fehlt: ${relative(ROOT, SRC_DIR) || 'src'}`);
  process.exit(1);
}

const files = walk(SRC_DIR)
  .map((file) => {
    const text = readFileSync(file, 'utf8');
    const exception = hasExceptionHeader(text);
    return {
      name: relative(ROOT, file),
      lines: countLines(text),
      limit: exception ? EXCEPTION_LIMIT : DEFAULT_LIMIT,
      exception,
    };
  })
  .sort((a, b) => b.lines - a.lines);

const violations = files.filter((file) => file.lines > file.limit);

console.log(`check:loc - ${files.length} Datei(en) unter src/ geprueft`);
for (const file of files) {
  const mark = file.lines > file.limit ? 'FAIL' : ' ok ';
  const note = file.exception ? ` (Exception, max ${file.limit})` : '';
  console.log(`  ${mark} ${String(file.lines).padStart(4)}/${file.limit}  ${file.name}${note}`);
}

if (violations.length > 0) {
  console.error(`\ncheck:loc - ${violations.length} Datei(en) ueberschreiten das LOC-Cap:`);
  for (const file of violations) {
    console.error(`  - ${file.name}: ${file.lines} LOC (erlaubt ${file.limit}, Regel 200 / Exception 350)`);
  }
  process.exit(1);
}

console.log('\ncheck:loc - OK, alle Dateien im LOC-Cap');
