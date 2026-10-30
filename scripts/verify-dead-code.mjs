#!/usr/bin/env node
/**
 * Fail-Closed Dead-Artifact-Gate: jeder Export in src/ muss in einem echten
 * Import oder Re-Export vorkommen. main.tsx ist der einzige Einstiegspunkt.
 */
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fail, ROOT, walk } from './lib/report.mjs';

const SRC = resolve(ROOT, 'src');
const files = walk(SRC, (file) => /\.(ts|tsx)$/.test(file) && !file.endsWith('.d.ts'));
const extra = [resolve(ROOT, 'vite.config.ts')].filter((file) => {
  try { readFileSync(file); return true; } catch { return false; }
});
const sources = [...files, ...extra];
const exportsFound = [];
const used = new Set();

const exportPatterns = [
  [/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g, true],
  [/export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g, true],
  [/export\s+(?:class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g, true],
];

for (const file of sources) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  for (const match of text.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s*from/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim();
      if (name) used.add(name);
    }
  }
  for (const match of text.matchAll(/export\s*\{([^}]+)\}\s*from/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0]?.trim();
      if (name) used.add(name);
    }
  }
  lines.forEach((line, lineIndex) => {
    for (const [pattern] of exportPatterns) {
      for (const match of line.matchAll(pattern)) {
        exportsFound.push({ name: match[1], file, line: lineIndex + 1 });
      }
    }
    for (const match of line.matchAll(/export\s*\{([^}]+)\}/g)) {
      for (const part of match[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name) exportsFound.push({ name, file, line: lineIndex + 1 });
      }
    }
  });
}

// Default-Exports und der Einstiegspunkt sind keine benannten Artefakte.
const entry = resolve(SRC, 'main.tsx');
const dead = exportsFound.filter((item) => !used.has(item.name) && item.file !== entry);
let index = 0;
for (const item of dead) {
  index += 1;
  fail(index, 'ERR-4003', relative(ROOT, item.file), `Export ${item.name} (Zeile ${item.line}) wird nirgendwo importiert`);
}

if (dead.length > 0) {
  console.error(`verify-dead-code: ${dead.length} tote Exporte`);
  process.exit(1);
}
console.log(`verify-dead-code: PASS (${exportsFound.length} Exporte, ${sources.length} Dateien)`);
