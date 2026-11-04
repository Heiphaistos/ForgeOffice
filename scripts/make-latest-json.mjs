// Assemble latest.json (manifeste de mise a jour Tauri) a partir des fichiers d'une release.
//   node scripts/make-latest-json.mjs --dir release --version 0.1.0 --base-url https://github.com/<org>/<depot>/releases/download/v0.1.0
//        [--changelog CHANGELOG.md | --notes-file notes.md] [--notes-out notes.md] [--out release/latest.json] [--strict]
// Chaque fichier d'installation doit avoir son `.sig` (minisign, produit par `tauri build` ou `tauri signer sign`) a cote.
// Entrees produites : windows-x86_64, windows-i686, windows-x86_64-portable, windows-i686-portable, linux-x86_64,
// darwin-aarch64, darwin-x86_64. `--strict` : echec si une entree manque (publication reelle) ; sinon elle est ignoree.
// Relais prive : passer `--base-url https://heiphaistos.org/gh/<depot>/releases/download/v<version>`.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Motifs de nom par entree de plateforme (la version est injectee). */
export const PLATFORMS = {
  'windows-x86_64': (v) => new RegExp(`^ForgeOffice_${v}_x64-setup\\.exe$`),
  'windows-i686': (v) => new RegExp(`^ForgeOffice_${v}_x86-setup\\.exe$`),
  'windows-x86_64-portable': (v) => new RegExp(`^ForgeOffice_${v}_x64_portable\\.exe$`),
  'windows-i686-portable': (v) => new RegExp(`^ForgeOffice_${v}_x86_portable\\.exe$`),
  'linux-x86_64': (v) => new RegExp(`^ForgeOffice_${v}_amd64\\.AppImage$`),
  'darwin-aarch64': (v) => new RegExp(`^ForgeOffice_${v}_aarch64\\.app\\.tar\\.gz$`),
  'darwin-x86_64': (v) => new RegExp(`^ForgeOffice_${v}_x64\\.app\\.tar\\.gz$`),
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Section `## [version]` (ou `## version`) d'un CHANGELOG, sans son titre. */
export function changelogSection(text, version) {
  const lines = text.split(/\r?\n/);
  const head = new RegExp(`^##\\s+\\[?${escapeRe(version)}\\]?(\\s|$)`);
  const start = lines.findIndex((l) => head.test(l));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

/** Construit le manifeste ; `files` = noms presents dans le dossier, `readSig(nom)` renvoie le contenu du .sig ou null. */
export function buildManifest({ version, baseUrl, notes, files, readSig, strict, now = new Date() }) {
  const platforms = {};
  const missing = [];
  const base = baseUrl.replace(/\/+$/, '');
  for (const [key, pattern] of Object.entries(PLATFORMS)) {
    const re = pattern(escapeRe(version));
    const matches = files.filter((f) => re.test(f));
    if (matches.length === 0) { missing.push(`${key} (fichier absent)`); continue; }
    if (matches.length > 1) throw new Error(`${key} : plusieurs fichiers correspondent (${matches.join(', ')})`);
    const name = matches[0];
    const signature = readSig(name)?.trim();
    if (!signature) { missing.push(`${key} (${name}.sig absent ou vide)`); continue; }
    platforms[key] = { signature, url: `${base}/${encodeURIComponent(name)}` };
  }
  if (strict && missing.length) throw new Error(`Entrées manquantes : ${missing.join(' ; ')}`);
  if (Object.keys(platforms).length === 0) throw new Error('Aucune plateforme trouvée : latest.json vide');
  return { manifest: { version, notes, pub_date: now.toISOString(), platforms }, missing };
}

function parseArgs(argv) {
  const opts = { strict: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--strict') opts.strict = true;
    else if (arg.startsWith('--')) {
      const value = argv[++i];
      if (value === undefined) throw new Error(`Valeur manquante pour ${arg}`);
      opts[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    } else throw new Error(`Argument inattendu : ${arg}`);
  }
  for (const required of ['dir', 'version', 'baseUrl']) {
    if (!opts[required]) throw new Error(`--${required.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} est obligatoire`);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  let notes = `ForgeOffice ${opts.version}`;
  if (opts.notesFile) notes = readFileSync(opts.notesFile, 'utf8').trim();
  else if (opts.changelog) {
    const section = changelogSection(readFileSync(opts.changelog, 'utf8'), opts.version);
    if (!section) throw new Error(`Aucune section ${opts.version} dans ${opts.changelog}`);
    notes = section;
  }
  const files = readdirSync(opts.dir);
  const { manifest, missing } = buildManifest({
    version: opts.version, baseUrl: opts.baseUrl, notes, files, strict: opts.strict,
    readSig: (name) => (existsSync(join(opts.dir, `${name}.sig`)) ? readFileSync(join(opts.dir, `${name}.sig`), 'utf8') : null),
  });
  const out = opts.out ?? join(opts.dir, 'latest.json');
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  if (opts.notesOut) writeFileSync(opts.notesOut, `${notes}\n`);
  console.log(`écrit ${out} : ${Object.keys(manifest.platforms).join(', ')}`);
  if (missing.length) console.warn(`ignoré : ${missing.join(' ; ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
