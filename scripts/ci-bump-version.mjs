#!/usr/bin/env node
/**
 * Automatische Semver-Versionierung fuer Merges auf main.
 *   Major: "BREAKING CHANGE", "[major]" oder "#major"
 *   Minor: Zeile beginnt mit feat:/feature: oder "#minor"
 *   Sonst: Patch
 *
 * Aufruf: node scripts/ci-bump-version.mjs [--dry-run] [--message "text"]
 * Der Workflow ueberspringt Release-Commits zusaetzlich per if-Condition.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const messageIndex = args.indexOf('--message');

function git(argv) {
  return execFileSync('git', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function lastCommitMessage() {
  try {
    return git(['log', '-1', '--pretty=%B']);
  } catch {
    return '';
  }
}

const message = messageIndex >= 0 ? (args[messageIndex + 1] ?? '') : lastCommitMessage();

function detectBump(text) {
  if (/BREAKING[-\s]?CHANGE|\[major\]|#major/i.test(text)) return 'major';
  if (/^\s*(feat|feature)(\([^)]*\))?:/im.test(text) || /#minor/i.test(text)) return 'minor';
  return 'patch';
}

function nextVersion(version, kind) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Ungueltige Version in package.json: ${version}`);
  }
  const [major, minor, patch] = parts;
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function updateJson(file, mutate) {
  if (!existsSync(file)) return;
  const data = JSON.parse(readFileSync(file, 'utf8'));
  mutate(data);
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

const pkgPath = join(ROOT, 'package.json');
const lockPath = join(ROOT, 'package-lock.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
if (typeof pkg.version !== 'string') throw new Error('package.json hat keine version');

const kind = detectBump(message);
const version = nextVersion(pkg.version, kind);
const tag = `v${version}`;

if (dryRun) {
  console.log(`dry-run: ${kind} ${pkg.version} -> ${version} (${tag})`);
  process.exit(0);
}

if (message.includes('chore(release):') || message.includes('[skip ci]')) {
  console.log('Release-Commit erkannt - kein weiterer Bump.');
  process.exit(0);
}

updateJson(pkgPath, (data) => {
  data.version = version;
});
updateJson(lockPath, (lock) => {
  lock.version = version;
  if (lock.packages?.['']) lock.packages[''].version = version;
});

const files = ['package.json'];
if (existsSync(lockPath)) files.push('package-lock.json');
git(['add', ...files]);
// --no-verify: keine Git-Hooks im Release-Pfad.
git(['commit', '--no-verify', '-m', `chore(release): ${tag} [skip ci]`]);
git(['tag', tag]);
git(['push', 'origin', 'HEAD:main']);
git(['push', 'origin', tag]);

execFileSync('gh', ['release', 'create', tag, '--generate-notes', '--title', tag], { stdio: 'inherit' });
console.log(`Release ${tag} erstellt und gepusht.`);
