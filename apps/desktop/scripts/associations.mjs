// Regenere `bundle.fileAssociations` de src-tauri/tauri.conf.json depuis packages/core/src/modules.ts.
// Lancer apres tout ajout d'extension : `npm run associations -w ...` ou `node scripts/associations.mjs`.
// Le test Rust `modules::tests::associations_de_fichiers_completes` echoue tant que ce n'est pas fait.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const modulesTs = join(here, '../../../packages/core/src/modules.ts');
const confPath = join(here, '../src-tauri/tauri.conf.json');

// Formats executables (double-clic = execution) ou ambigus (.ts = video MPEG-TS) : jamais associes.
// Meme liste que `NEVER_ASSOCIATE` dans src-tauri/src/modules.rs.
const NEVER = new Set(['bat', 'cmd', 'ps1', 'sh', 'bash', 'js', 'mjs', 'vbs', 'py', 'ts']);
// Formats generiques deja geres par d'autres logiciels : proposes (macOS : rang Alternate), pas imposes.
const GENERIC_APPS = new Set(['notes']);
const GENERIC_EXTS = new Set(['html', 'htm', 'csv', 'tsv', 'db', 'sqlite']);
const NATIVE = new Set(['fopub', 'fodb']);

const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  docm: 'application/vnd.ms-word.document.macroEnabled.12',
  dotx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  doc: 'application/msword', odt: 'application/vnd.oasis.opendocument.text', rtf: 'application/rtf',
  html: 'text/html', htm: 'text/html',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  xltx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  xls: 'application/vnd.ms-excel', ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv', tsv: 'text/tab-separated-values',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pptm: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  potx: 'application/vnd.openxmlformats-officedocument.presentationml.template',
  ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  ppt: 'application/vnd.ms-powerpoint', odp: 'application/vnd.oasis.opendocument.presentation',
  fopub: 'application/x-forgeoffice-publication', pub: 'application/x-mspublisher',
  fodb: 'application/x-forgeoffice-database', sqlite: 'application/vnd.sqlite3', db: 'application/vnd.sqlite3',
  accdb: 'application/msaccess', mdb: 'application/x-msaccess', pdf: 'application/pdf',
  md: 'text/markdown', markdown: 'text/markdown', json: 'application/json', xml: 'application/xml',
  yaml: 'application/yaml', yml: 'application/yaml', toml: 'application/toml', css: 'text/css', sql: 'application/sql',
};

/** [{ id, name, extensions }] lus dans le TypeScript (meme analyse que build.rs). */
function parseModules(source) {
  const out = [];
  const re = /id: '([^']+)', name: '([^']*)'[\s\S]*?extensions: \[([^\]]*)\]/g;
  for (const m of source.matchAll(re)) {
    const exts = m[3].split(',').map((e) => e.trim().replace(/^'|'$/g, '')).filter(Boolean);
    out.push({ id: m[1], name: m[2], extensions: exts });
  }
  return out;
}

const modules = parseModules(readFileSync(modulesTs, 'utf8'));
const associations = [];
for (const mod of modules) {
  for (const ext of mod.extensions) {
    if (NEVER.has(ext)) continue;
    const entry = {
      ext: [ext],
      name: `ForgeOffice.${ext}`,
      description: `${mod.name} (${ext.toUpperCase()})`,
      role: mod.id === 'pdf' ? 'Viewer' : 'Editor',
      mimeType: MIME[ext] ?? (mod.id === 'notes' ? 'text/plain' : 'application/octet-stream'),
    };
    if (GENERIC_APPS.has(mod.id) || GENERIC_EXTS.has(ext)) entry.rank = 'Alternate';
    if (NATIVE.has(ext)) entry.exportedType = { identifier: `org.heiphaistos.forgeoffice.${ext}`, conformsTo: ['public.data'] };
    associations.push(entry);
  }
}

const conf = JSON.parse(readFileSync(confPath, 'utf8'));
conf.bundle.fileAssociations = associations;
writeFileSync(confPath, `${JSON.stringify(conf, null, 2)}\n`);
console.info(`${associations.length} associations ecrites dans tauri.conf.json`);
