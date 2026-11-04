// Verifie make-latest-json.mjs sur des fichiers factices : node --test scripts/make-latest-json.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildManifest, changelogSection } from './make-latest-json.mjs';

const SCRIPT = fileURLToPath(new URL('./make-latest-json.mjs', import.meta.url));
const V = '1.2.3';
const NAMES = [
  `ForgeOffice_${V}_x64-setup.exe`, `ForgeOffice_${V}_x86-setup.exe`,
  `ForgeOffice_${V}_x64_portable.exe`, `ForgeOffice_${V}_x86_portable.exe`,
  `ForgeOffice_${V}_amd64.AppImage`, `ForgeOffice_${V}_aarch64.app.tar.gz`, `ForgeOffice_${V}_x64.app.tar.gz`,
];

function fakeDir(names) {
  const dir = mkdtempSync(join(tmpdir(), 'fo-latest-'));
  for (const n of names) {
    writeFileSync(join(dir, n), 'x');
    writeFileSync(join(dir, `${n}.sig`), `sig-${n}\n`);
  }
  writeFileSync(join(dir, 'ForgeOffice_1.2.3_amd64.deb'), 'x'); // sans entree dans le manifeste
  return dir;
}

test('les 7 entrees sont produites avec signature et URL encodee', () => {
  const dir = fakeDir(NAMES);
  const run = spawnSync(process.execPath, [SCRIPT, '--dir', dir, '--version', V, '--base-url', 'https://exemple.test/dl/v1.2.3/', '--strict'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const m = JSON.parse(readFileSync(join(dir, 'latest.json'), 'utf8'));
  assert.deepEqual(Object.keys(m.platforms).sort(), [
    'darwin-aarch64', 'darwin-x86_64', 'linux-x86_64', 'windows-i686', 'windows-i686-portable', 'windows-x86_64', 'windows-x86_64-portable',
  ]);
  assert.equal(m.platforms['windows-x86_64'].signature, `sig-ForgeOffice_${V}_x64-setup.exe`);
  assert.equal(m.platforms['linux-x86_64'].url, `https://exemple.test/dl/v1.2.3/ForgeOffice_${V}_amd64.AppImage`);
  assert.equal(m.version, V);
});

test('--strict echoue si une entree manque, sinon elle est ignoree', () => {
  const files = NAMES.slice(0, 6);
  const readSig = (n) => `sig-${n}`;
  assert.throws(() => buildManifest({ version: V, baseUrl: 'https://x', notes: 'n', files, readSig, strict: true }), /darwin-x86_64/);
  const { manifest, missing } = buildManifest({ version: V, baseUrl: 'https://x', notes: 'n', files, readSig, strict: false });
  assert.equal(Object.keys(manifest.platforms).length, 6);
  assert.equal(missing.length, 1);
});

test('signature absente = entree manquante ; plusieurs candidats = erreur', () => {
  const { missing } = buildManifest({ version: V, baseUrl: 'https://x', notes: 'n', files: NAMES, readSig: (n) => (n.includes('x86-setup') ? null : 's'), strict: false });
  assert.match(missing.join(), /windows-i686 \(.*\.sig absent/);
  assert.throws(() => buildManifest({ version: '1', baseUrl: 'https://x', notes: 'n', files: ['ForgeOffice_1_amd64.AppImage', 'ForgeOffice_1_amd64.AppImage'], readSig: () => 's' }), /plusieurs/);
});

test('section du CHANGELOG', () => {
  const log = '# Journal\n\n## [0.2.0] - 2026-12-01\n\n- B\n\n## [0.1.0] - 2026-11-04\n\n- A\n- A2\n';
  assert.equal(changelogSection(log, '0.1.0'), '- A\n- A2');
  assert.equal(changelogSection(log, '0.2.0'), '- B');
  assert.equal(changelogSection(log, '9.9.9'), null);
});
