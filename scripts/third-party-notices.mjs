// Genere THIRD_PARTY_NOTICES.md : licences des dependances npm (racine + workspaces) et Rust (Cargo).
//   node scripts/third-party-notices.mjs           ecrit THIRD_PARTY_NOTICES.md
//   node scripts/third-party-notices.mjs --stdout  affiche sans ecrire
// Les paquets npm sont lus dans node_modules (fermeture transitive de dependencies / optionalDependencies /
// peerDependencies installees). Les crates viennent de `cargo metadata --format-version 1 --offline` ; ce qui n'est pas
// resolu par cargo (autre plateforme, sources non telechargees) est complete depuis Cargo.lock + ~/.cargo/registry.
// Sortie deterministe (pas de date) pour que le fichier se compare au diff.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'THIRD_PARTY_NOTICES.md');
const RUST_MANIFESTS = ['apps/desktop/src-tauri', 'crates/forge-base', 'crates/forge-convert'];
const COPYLEFT = /(?:^|[^A-Za-z])(?:A?GPL|LGPL|MPL|EPL|CDDL|CC-BY-SA|SSPL|OSL|EUPL|CPL|MS-RL)/i;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Lance un programme sans shell ; leve une erreur si le code de sortie n'est pas 0. */
function run(command, args) {
  const r = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(r.error?.message ?? r.stderr);
  return r.stdout;
}

// ---------- licences ----------
function normalizeLicense(raw) {
  if (!raw) return '';
  if (Array.isArray(raw)) return raw.map(normalizeLicense).filter(Boolean).join(' OR ');
  if (typeof raw === 'object') return normalizeLicense(raw.type ?? raw.name);
  return String(raw).trim().replace(/\s*\/\s*/g, ' OR ');
}

/** 'ok' | 'copyleft' | 'inconnue'. Une expression `A OR B` est acceptable si une alternative l'est. */
function classify(license) {
  if (!license || /^(SEE LICENSE|UNLICENSED|NONE)/i.test(license)) return 'inconnue';
  const alternatives = license.replace(/[()]/g, ' ').split(/\s+OR\s+/i);
  return alternatives.some((alt) => !COPYLEFT.test(alt)) ? 'ok' : 'copyleft';
}

function copyrightLine(dir) {
  if (!dir || !existsSync(dir)) return '';
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying|notice)/i.test(f));
  if (!file) return '';
  try {
    const line = readFileSync(join(dir, file), 'utf8').split(/\r?\n/).find((l) => /copyright/i.test(l) && /\d{4}|\(c\)|©/i.test(l));
    return line ? line.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
  } catch {
    return ''; // entree de dossier (LICENSES/) ou fichier illisible : pas de ligne de copyright
  }
}

function repoUrl(pkg) {
  let url = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  if (url) {
    url = url.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/^ssh:\/\/git@/, 'https://').replace(/\.git$/, '');
    if (/^github:/.test(url)) url = `https://github.com/${url.slice(7)}`;
    else if (/^[\w.-]+\/[\w.-]+$/.test(url)) url = `https://github.com/${url}`;
  }
  return url || pkg.homepage || '';
}

// ---------- npm ----------
function findPackageDir(name, fromDir) {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
    if (dirname(dir) === dir || dir === dirname(ROOT)) return null;
  }
}

function workspaceManifests() {
  const root = readJson(join(ROOT, 'package.json'));
  const dirs = [];
  for (const pattern of root.workspaces ?? []) {
    if (pattern.endsWith('/*')) {
      const base = join(ROOT, pattern.slice(0, -2));
      for (const entry of readdirSync(base, { withFileTypes: true })) {
        if (entry.isDirectory() && existsSync(join(base, entry.name, 'package.json'))) dirs.push(join(base, entry.name));
      }
    } else if (existsSync(join(ROOT, pattern, 'package.json'))) dirs.push(join(ROOT, pattern));
  }
  const desktop = join(ROOT, 'apps/desktop');
  if (existsSync(join(desktop, 'package.json')) && !dirs.includes(desktop)) dirs.push(desktop);
  return [ROOT, ...dirs].map((d) => ({ dir: d, pkg: readJson(join(d, 'package.json')) }));
}

function collectNpm() {
  const manifests = workspaceManifests();
  const internal = new Set(manifests.map((m) => m.pkg.name));
  const seen = new Map(); // dossier reel -> entree
  const missing = new Set();

  const walk = (names, fromDir, dev) => {
    for (const name of names) {
      if (internal.has(name)) continue;
      const dir = findPackageDir(name, fromDir);
      if (!dir) { missing.add(name); continue; }
      const prior = seen.get(dir);
      if (prior && (prior.dev === false || dev)) continue; // deja vu en production, ou deja vu en dev
      const pkg = readJson(join(dir, 'package.json'));
      seen.set(dir, { dir, pkg, dev });
      const next = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.optionalDependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})];
      walk(next, dir, dev);
    }
  };
  for (const { dir, pkg } of manifests) walk(Object.keys(pkg.dependencies ?? {}), dir, false);
  for (const { dir, pkg } of manifests) walk(Object.keys(pkg.devDependencies ?? {}), dir, true);
  const toEntry = ({ dir, pkg, dev }) => ({
    name: pkg.name, version: pkg.version, license: normalizeLicense(pkg.license ?? pkg.licenses),
    url: repoUrl(pkg), copyright: copyrightLine(dir), dev,
  });
  return { entries: [...seen.values()].map(toEntry), missing: [...missing].sort() };
}

// ---------- Rust ----------
function hostTriple() {
  return /host:\s*(\S+)/.exec(run('rustc', ['-vV']))?.[1] ?? '';
}

function runMetadata(manifest) {
  const base = ['metadata', '--format-version', '1', '--offline', '--manifest-path', join(ROOT, manifest, 'Cargo.toml')];
  for (const extra of [[], ['--filter-platform', hostTriple()]]) {
    try {
      return JSON.parse(run('cargo', [...base, ...extra]));
    } catch {
      // essai suivant : `cargo --offline` echoue si les sources d'une autre plateforme ne sont pas telechargees
    }
  }
  return null;
}

/** Crates utilisees (hors dev-dependencies) d'un manifeste. */
function reachable(meta) {
  const byId = new Map(meta.packages.map((p) => [p.id, p]));
  const nodes = new Map((meta.resolve?.nodes ?? []).map((n) => [n.id, n]));
  const root = meta.resolve?.root ?? meta.workspace_members[0];
  const seen = new Set();
  const queue = [root];
  while (queue.length) {
    const id = queue.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const dep of nodes.get(id)?.deps ?? []) {
      if (dep.dep_kinds.some((k) => k.kind !== 'dev')) queue.push(dep.pkg);
    }
  }
  return [...seen].map((id) => byId.get(id)).filter(Boolean);
}

function registrySources() {
  const base = join(process.env.CARGO_HOME ?? join(homedir(), '.cargo'), 'registry', 'src');
  return existsSync(base) ? readdirSync(base).map((d) => join(base, d)) : [];
}

function lockPackages(manifest) {
  const file = join(ROOT, manifest, 'Cargo.lock');
  if (!existsSync(file)) return [];
  const list = [];
  for (const block of readFileSync(file, 'utf8').split(/\n\[\[package\]\]\n/).slice(1)) {
    const name = /^name = "([^"]+)"/m.exec(block)?.[1];
    const version = /^version = "([^"]+)"/m.exec(block)?.[1];
    if (name && version && /^source = "registry/m.test(block)) list.push({ name, version });
  }
  return list;
}

function collectRust() {
  const crates = new Map(); // nom@version -> entree
  const notes = [];
  const sources = registrySources();
  const sourceDir = (name, version) => sources.map((s) => join(s, `${name}-${version}`)).find(existsSync) ?? null;
  for (const manifest of RUST_MANIFESTS) {
    const meta = runMetadata(manifest);
    if (meta) {
      for (const p of reachable(meta)) {
        if (!p.source) continue; // crate du depot
        crates.set(`${p.name}@${p.version}`, {
          name: p.name, version: p.version, license: normalizeLicense(p.license), url: p.repository || p.homepage || '',
          copyright: '', dev: false, dir: sourceDir(p.name, p.version),
        });
      }
    } else notes.push(`${manifest} : cargo metadata impossible hors ligne`);
    // Cargo.lock couvre toutes les plateformes : complete ce que cargo n'a pas pu resoudre.
    for (const { name, version } of lockPackages(manifest)) {
      const key = `${name}@${version}`;
      if (crates.has(key)) continue;
      const dir = sourceDir(name, version);
      let license = '';
      let url = '';
      if (dir && existsSync(join(dir, 'Cargo.toml'))) {
        const toml = readFileSync(join(dir, 'Cargo.toml'), 'utf8');
        license = normalizeLicense(/^license\s*=\s*"([^"]+)"/m.exec(toml)?.[1]);
        url = /^repository\s*=\s*"([^"]+)"/m.exec(toml)?.[1] ?? '';
      }
      crates.set(key, { name, version, license, url, copyright: '', dev: false, dir, fromLock: true });
    }
  }
  for (const c of crates.values()) c.copyright = copyrightLine(c.dir);
  return { entries: [...crates.values()], notes };
}

// ---------- rendu ----------
const cmp = (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version, undefined, { numeric: true });
const esc = (s) => String(s).replace(/\|/g, '\\|');

function renderGroup(title, entries) {
  if (!entries.length) return `## ${title}\n\n_Aucune._\n`;
  const byLicense = new Map();
  for (const e of entries) {
    const key = e.license || 'Licence non déterminée';
    if (!byLicense.has(key)) byLicense.set(key, []);
    byLicense.get(key).push(e);
  }
  let out = `## ${title} (${entries.length})\n\n`;
  for (const license of [...byLicense.keys()].sort((a, b) => byLicense.get(b).length - byLicense.get(a).length || a.localeCompare(b))) {
    const list = byLicense.get(license).sort(cmp);
    out += `### ${license} (${list.length})\n\n| Paquet | Version | Copyright | Source |\n|---|---|---|---|\n`;
    for (const e of list) out += `| ${esc(e.name)} | ${e.version} | ${esc(e.copyright)} | ${e.url} |\n`;
    out += '\n';
  }
  return out;
}

/** Section « Polices » : familles embarquees dans packages/ui/fonts (installees par scripts/fetch-fonts.mjs) + texte integral des licences OFL. */
function fontsSection() {
  const families = [
    ['Carlito 1.104', 'OFL-Carlito.txt', 'https://github.com/googlefonts/carlito', 'substitut de Calibri (mêmes métriques)'],
    ['Liberation Sans, Serif et Mono 2.1.5', 'OFL-Liberation.txt', 'https://github.com/liberationfonts/liberation-fonts', 'substituts de Arial, Times New Roman et Courier New (mêmes métriques)'],
    ['Selawik 1.01', 'OFL-Selawik.txt', 'https://github.com/microsoft/Selawik', 'substitut libre de Segoe UI (Microsoft)'],
  ];
  const fence = '```';
  let out = '## Polices\n\nForgeOffice embarque des polices libres (SIL Open Font License 1.1, redistribuables) dans `packages/ui/fonts/`, déclarées dans `packages/ui/src/fonts.css`. Les polices du système restent prioritaires (`local()` en premier). Aptos, Calibri, Segoe UI et Cambria (propriétaires) ne sont pas embarquées.\n';
  for (const [name, file, url, role] of families) {
    const text = readFileSync(join(ROOT, 'packages', 'ui', 'fonts', file), 'utf8').replace(/\r\n/g, '\n').trimEnd();
    out += `\n### ${name}\n\n${role} — ${url}\n\n${fence}\n${text}\n${fence}\n`;
  }
  return out;
}

const FLUENT_MIT = `MIT License

Copyright (c) 2020 Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

export function render(npm, rust) {
  const prod = npm.entries.filter((e) => !e.dev);
  const dev = npm.entries.filter((e) => e.dev);
  const flagged = [...prod, ...rust.entries, ...dev].filter((e) => classify(e.license) !== 'ok');
  const copyleft = flagged.filter((e) => classify(e.license) === 'copyleft');
  const unknown = flagged.filter((e) => classify(e.license) === 'inconnue');
  const unresolved = rust.entries.filter((e) => !e.license);

  let md = `# Avis de tiers (THIRD PARTY NOTICES)

> Fichier GÉNÉRÉ par \`node scripts/third-party-notices.mjs\` : ne pas le modifier à la main. À régénérer après tout ajout ou mise à jour de dépendance (\`npm install\`, \`cargo update\`) et avant chaque publication.

ForgeOffice est écrit de A à Z ; il inclut ou utilise les composants tiers ci-dessous. Le texte complet de chaque licence se trouve dans le dossier du paquet (\`node_modules/<paquet>/LICENSE\`, sources de la crate dans \`~/.cargo/registry\`) et sur https://spdx.org/licenses/. Une expression « A OR B » laisse le choix de la licence : ForgeOffice retient l'alternative permissive.

## Synthèse

| | Paquets |
|---|---|
| npm distribués (production) | ${prod.length} |
| Crates Rust distribuées | ${rust.entries.length} |
| npm outils de développement (non distribués) | ${dev.length} |
| Licence copyleft (à examiner) | ${copyleft.length} |
| Licence inconnue ou non résolue | ${unknown.length} |

`;
  if (!flagged.length) md += '**Aucune licence copyleft ni inconnue : toutes les dépendances sont sous licences permissives.**\n\n';
  else {
    md += '## ⚠ À examiner\n\n';
    if (copyleft.length) {
      md += 'Licences à copyleft (faible ou fort) sans alternative permissive :\n\n';
      for (const e of copyleft.sort(cmp)) md += `- ${e.name} ${e.version} : ${e.license} (${e.url})\n`;
      md += '\n';
    }
    if (unknown.length) {
      md += `Licence inconnue ou non résolue (${unknown.length}) :\n\n`;
      for (const e of unknown.sort(cmp).slice(0, 80)) md += `- ${e.name} ${e.version}${e.fromLock ? ' (dans Cargo.lock, sources non téléchargées sur la machine de génération)' : ''}\n`;
      if (unknown.length > 80) md += `- … et ${unknown.length - 80} autres\n`;
      md += '\n';
    }
  }
  if (rust.notes.length) md += `Limites de la génération : ${rust.notes.join(' ; ')}.\n\n`;
  if (unresolved.length) {
    md += `Génération sur une machine sans accès au réseau : ${unresolved.length} crate(s) de Cargo.lock (cibles Linux, macOS, Android surtout) n'ont pas leurs sources en local, leur licence n'a donc pas pu être lue. Relancer le script après \`cargo fetch\` dans chaque crate pour les compléter.\n\n`;
  }

  md += `## Fluent UI System Icons

- Paquet : \`@fluentui/svg-icons\` (https://github.com/microsoft/fluentui-system-icons), Microsoft
- Utilisation : chemins SVG extraits dans \`packages/ui/src/icons/generated.ts\` par \`packages/ui/scripts/extract-icons.mjs\` (302 icônes embarquées)
- Licence : MIT

\`\`\`
${FLUENT_MIT}
\`\`\`

${fontsSection()}
`;
  md += renderGroup('Paquets npm distribués avec l\'application', prod) + '\n';
  md += renderGroup('Crates Rust distribuées avec l\'application', rust.entries) + '\n';
  md += renderGroup('Outils de développement npm (non distribués)', dev);
  return { md: md.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', flagged };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const npm = collectNpm();
  const rust = collectRust();
  const { md, flagged } = render(npm, rust);
  if (process.argv.includes('--stdout')) process.stdout.write(md);
  else {
    writeFileSync(OUT, md);
    console.log(`écrit ${OUT} : ${npm.entries.length} paquets npm, ${rust.entries.length} crates`);
  }
  if (npm.missing.length) console.warn(`npm : ${npm.missing.length} dépendance(s) optionnelle(s) non installée(s) sur cette machine (binaires d'autres plateformes, ignorées)`);
  if (flagged.length) console.warn(`${flagged.length} dépendance(s) copyleft ou à licence inconnue : voir la section « À examiner ».`);
}
