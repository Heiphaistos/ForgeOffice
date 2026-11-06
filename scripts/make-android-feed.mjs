// Flux de mise a jour de l'APK (lu par `Updater.kt`, signe ensuite par `tauri signer sign`) :
//   node scripts/make-android-feed.mjs --dir release --version 0.2.0 [--changelog CHANGELOG.md] [--out release/ForgeOffice-android.json]
// Une entree par architecture trouvee (`ForgeOffice_<version>_<abi>.apk`, signe : les `-unsigned` sont ignores) avec taille et SHA-256.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changelogSection } from './make-latest-json.mjs';

export const ABIS = ['arm64-v8a', 'x86_64'];

/** `files` = [{ name, size, sha256 }] ; echec si aucune architecture n'est livree. */
export function buildFeed({ version, notes, files }) {
  const apks = {};
  for (const abi of ABIS) {
    const name = `ForgeOffice_${version}_${abi}.apk`;
    const f = files.find((x) => x.name === name);
    if (f) apks[abi] = { name, size: f.size, sha256: f.sha256 };
  }
  if (Object.keys(apks).length === 0) throw new Error(`aucun APK signe ForgeOffice_${version}_<abi>.apk`);
  return { version, notes: notes ?? '', apks };
}

function main() {
  const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
  const dir = resolve(args.dir ?? 'release');
  const version = args.version;
  if (!version) throw new Error('--version requis');
  const files = readdirSync(dir)
    .filter((n) => n.endsWith('.apk'))
    .map((name) => ({ name, size: statSync(join(dir, name)).size, sha256: createHash('sha256').update(readFileSync(join(dir, name))).digest('hex') }));
  const notes = args.changelog ? (changelogSection(readFileSync(args.changelog, 'utf8'), version) ?? '') : '';
  const out = args.out ?? join(dir, 'ForgeOffice-android.json');
  writeFileSync(out, `${JSON.stringify(buildFeed({ version, notes, files }), null, 2)}\n`);
  console.log(`flux Android ecrit : ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
