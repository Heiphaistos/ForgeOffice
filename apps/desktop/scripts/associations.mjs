// Regenere `bundle.fileAssociations` de src-tauri/tauri.conf.json depuis packages/core/src/modules.ts.
// Lancer apres tout ajout d'extension : `npm run associations -w ...` ou `node scripts/associations.mjs`.
// Le test Rust `modules::tests::associations_de_fichiers_completes` echoue tant que ce n'est pas fait.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const modulesTs = join(here, '../../../packages/core/src/modules.ts');
const confPath = join(here, '../src-tauri/tauri.conf.json');
const hooksPath = join(here, '../src-tauri/windows/hooks.nsh');
const wixPath = join(here, '../src-tauri/windows/associations.wxs');

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
conf.bundle.windows.nsis.installerHooks = 'windows/hooks.nsh';
conf.bundle.fileAssociations = associations;
writeFileSync(confPath, `${JSON.stringify(conf, null, 2)}\n`);

// Crochets NSIS (Windows, src-tauri/windows/hooks.nsh). Le modele de Tauri prend le defaut de TOUTES les
// extensions puis, a la desinstallation, ecrit un defaut VIDE qui masque l'association du systeme
// (HKCR\.docx vide au lieu de Word.Document.12, .txt sans txtfile...). Les crochets :
// - avant installation : si une version precedente est le defaut, remettent le defaut d'origine (sinon la
//   sauvegarde du modele enregistrerait « ForgeOffice.<ext> » et l'original serait perdu a la mise a jour) ;
// - apres installation : verbe francais, ForgeOffice dans « Ouvrir avec » (OpenWithProgids) ; les formats
//   generiques (rang Alternate : .txt, .json, .csv...) retrouvent leur defaut d'origine (proposes, pas imposes) ;
// - apres desinstallation : defaut vide ou pointant sur ForgeOffice supprime, sauvegarde effacee, cles vides retirees.
const NSIS_MACROS = String.raw`; GENERE par scripts/associations.mjs : ne pas modifier a la main.

!macro FO_PRE EXT
  ReadRegStr $R0 SHCTX "Software\Classes\.@{EXT}" ""
  @{If} $R0 == "ForgeOffice.@{EXT}"
    ReadRegStr $R1 SHCTX "Software\Classes\.@{EXT}" "ForgeOffice.@{EXT}_backup"
    @{If} $R1 == ""
      DeleteRegValue SHCTX "Software\Classes\.@{EXT}" ""
    @{Else}
      WriteRegStr SHCTX "Software\Classes\.@{EXT}" "" $R1
    @{EndIf}
  @{EndIf}
!macroend

!macro FO_POST EXT GENERIC
  WriteRegStr SHCTX "Software\Classes\ForgeOffice.@{EXT}\shell\open" "" "Ouvrir avec ForgeOffice"
  WriteRegStr SHCTX "Software\Classes\.@{EXT}\OpenWithProgids" "ForgeOffice.@{EXT}" ""
  !if @{GENERIC} == 1
    !insertmacro FO_PRE @{EXT}
  !endif
!macroend

!macro FO_UN EXT
  DeleteRegValue SHCTX "Software\Classes\.@{EXT}\OpenWithProgids" "ForgeOffice.@{EXT}"
  DeleteRegKey /ifempty SHCTX "Software\Classes\.@{EXT}\OpenWithProgids"
  ReadRegStr $R0 SHCTX "Software\Classes\.@{EXT}" ""
  @{If} $R0 == ""
  @{OrIf} $R0 == "ForgeOffice.@{EXT}"
    DeleteRegValue SHCTX "Software\Classes\.@{EXT}" ""
  @{EndIf}
  DeleteRegValue SHCTX "Software\Classes\.@{EXT}" "ForgeOffice.@{EXT}_backup"
  DeleteRegKey /ifempty SHCTX "Software\Classes\.@{EXT}"
!macroend

; Desinstallation complete (pas une mise a jour) : oublie le dossier d'installation, sinon un .msi installe
; ensuite le reprendrait (recherche PrevInstallDirNoName du modele WiX : .msi par machine dans AppData).
!macro FO_FORGET_INSTDIR
  @{If} $UpdateMode <> 1
    DeleteRegValue SHCTX "@{MANUPRODUCTKEY}" ""
    DeleteRegKey /ifempty SHCTX "@{MANUPRODUCTKEY}"
  @{EndIf}
!macroend

!macro FO_NOTIFY
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
`.replaceAll('@{', '${');

const exts = associations.map((a) => ({ ext: a.ext[0], generic: a.rank === 'Alternate' ? 1 : 0 }));
const hook = (name, body) => `!macro ${name}\n${body.join('\n')}\n!macroend\n`;
writeFileSync(hooksPath, [
  NSIS_MACROS,
  hook('NSIS_HOOK_PREINSTALL', exts.map((e) => `  !insertmacro FO_PRE ${e.ext}`)),
  hook('NSIS_HOOK_POSTINSTALL', [...exts.map((e) => `  !insertmacro FO_POST ${e.ext} ${e.generic}`), '  !insertmacro FO_NOTIFY']),
  hook('NSIS_HOOK_POSTUNINSTALL', [...exts.map((e) => `  !insertmacro FO_UN ${e.ext}`), '  !insertmacro FO_FORGET_INSTDIR', '  !insertmacro FO_NOTIFY']),
].join('\n'));

// MSI (WiX) : les extensions « annoncees » du modele de Tauri prennent le defaut de HKLM\Software\Classes\.<ext>
// et, a la desinstallation, Windows Installer SUPPRIME la cle entiere (Word, Excel, Bloc-notes perdent leur
// association, constate le 2026-11-04). Le .msi est donc construit sans `fileAssociations` (windows/msi.conf.json)
// et enregistre seulement les ProgID ForgeOffice + « Ouvrir avec » (OpenWithProgids) : des valeurs a lui, que
// la desinstallation retire sans toucher au reste. Le defaut des extensions reste a l'administrateur, sauf
// pour les formats propres a ForgeOffice (.fodb, .fopub).
const xml = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const EXE = '&quot;[INSTALLDIR]forgeoffice.exe&quot;';
const path = (...parts) => parts.join('\\');
const reg = (key, value, name) =>
  `        <RegistryValue Root="HKLM" Key="${path('Software', 'Classes', key)}"${name ? ` Name="${name}"` : ''} Type="string" Value="${value}" />`;
const wix = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<!-- GENERE par scripts/associations.mjs : ne pas modifier a la main. -->',
  '<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">',
  '  <Fragment>',
  '    <DirectoryRef Id="INSTALLDIR">',
  '      <Component Id="FoAssociations" Guid="CEC4C296-C492-4FD2-9773-FE6225954F72">',
  `        <RegistryValue Root="HKLM" Key="${path('Software', 'Heiphaistos', 'ForgeOffice')}" Name="Associations" Type="integer" Value="1" KeyPath="yes" />`,
  ...associations.flatMap((a) => {
    const id = a.name;
    return [
      reg(id, xml(a.description)),
      reg(path(id, 'DefaultIcon'), `${EXE},0`),
      reg(path(id, 'shell', 'open'), 'Ouvrir avec ForgeOffice'),
      reg(path(id, 'shell', 'open', 'command'), `${EXE} &quot;%1&quot;`),
      reg(path(`.${a.ext[0]}`, 'OpenWithProgids'), 'ForgeOffice', id),
      // Formats propres a ForgeOffice : personne d'autre ne les ouvre, ForgeOffice en est le defaut.
      ...(NATIVE.has(a.ext[0]) ? [reg(`.${a.ext[0]}`, id)] : []),
    ];
  }),
  '      </Component>',
  '    </DirectoryRef>',
  '  </Fragment>',
  '</Wix>',
  '',
].join('\r\n');
writeFileSync(wixPath, wix);
console.info(`${associations.length} associations ecrites dans tauri.conf.json, windows/hooks.nsh et windows/associations.wxs`);
