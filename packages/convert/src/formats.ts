// Table des formats : ce que savent faire les paquets de la suite (TypeScript, partout), le navigateur
// (canvas, pdf.js, pdf-lib) et le moteur natif forge-convert (coquille de bureau). Code sans DOM, teste.

/** Moteur retenu pour une conversion. */
export type Engine = 'texte' | 'tableur' | 'presentation' | 'canvas' | 'images-pdf' | 'pdf-images' | 'pdf-texte' | 'native';

export type Category = 'texte' | 'tableur' | 'presentation' | 'image' | 'pdf' | 'donnees' | 'soustitres' | 'archive' | 'audio' | 'autre';

// Paquets de la suite (@forgeoffice/docx, xlsx, pptx).
const TEXT_IN = ['docx', 'docm', 'dotx', 'dotm', 'doc', 'rtf', 'odt', 'html', 'htm', 'md', 'markdown', 'txt'];
const TEXT_OUT = ['docx', 'odt', 'rtf', 'html', 'md', 'txt'];
const SHEET_IN = ['xlsx', 'xlsm', 'xltx', 'xltm', 'xls', 'ods', 'csv', 'tsv'];
const SHEET_OUT = ['xlsx', 'ods', 'csv', 'tsv'];
const DECK_IN = ['pptx', 'pptm', 'potx', 'potm', 'ppsx', 'ppsm', 'odp', 'ppt'];
const DECK_OUT = ['pptx', 'ppsx', 'potx'];
// Navigateur.
const CANVAS_IN = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg'];
const CANVAS_OUT = ['png', 'jpg', 'webp'];

// Miroir de forge-convert `conv::prise_en_charge` (crates/forge-convert/src/conv/mod.rs).
const IMAGES_ENTREE = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff', 'tif', 'tga', 'pnm', 'ppm', 'hdr', 'ico', 'qoi', 'exr', 'dds', 'ff'];
const IMAGES_SORTIE = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff', 'tga', 'ico', 'avif', 'qoi', 'exr', 'ppm', 'ff'];
const DOCS_ENTREE = ['pdf', 'txt', 'md', 'markdown', 'html', 'htm', 'docx', 'doc', 'rtf', 'epub', 'odt', 'pptx', 'ppt', 'odp'];
const DOCS_SORTIE = ['txt', 'md', 'html', 'pdf', 'docx', 'epub', 'rtf', 'odt'];
const DONNEES = ['json', 'yaml', 'yml', 'toml', 'xml', 'csv'];
const TABLEURS = ['xlsx', 'xls', 'ods'];
const TABLEURS_SORTIE = ['csv', 'json', 'txt', 'pdf', 'yaml', 'html', 'md', 'toml', 'xml', 'xlsx'];
const DONNEES_SORTIE = ['json', 'yaml', 'toml', 'xml', 'csv', 'txt', 'pdf', 'xlsx', 'md', 'html'];
const SOUS_TITRES = ['srt', 'vtt'];
const ARCHIVES = ['zip', 'tar', 'tgz', 'gz', '7z'];
const AUDIO = ['mp3', 'ogg', 'm4a', 'aac', 'wav', 'flac'];

const has = (list: readonly string[], x: string): boolean => list.includes(x);

/** Extension en minuscules sans point (« » si aucune). */
export function extensionOf(name: string): string {
  const base = name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** Conversion prise en charge par forge-convert (miroir exact de `prise_en_charge`). */
export function nativeSupports(from: string, to: string): boolean {
  const d = from.toLowerCase();
  const v = to.toLowerCase();
  return (has(IMAGES_ENTREE, d) && (has(IMAGES_SORTIE, v) || v === 'pdf'))
    || (d === 'svg' && ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'avif', 'qoi', 'pdf'].includes(v))
    || (has(DOCS_ENTREE, d) && has(DOCS_SORTIE, v))
    || (has(TABLEURS, d) && has(TABLEURS_SORTIE, v))
    || (has(DONNEES, d) && has(DONNEES_SORTIE, v))
    || (has(SOUS_TITRES, d) && ['srt', 'vtt', 'txt'].includes(v))
    || (has(ARCHIVES, d) && ['zip', 'tar', 'tgz'].includes(v))
    || (has(AUDIO, d) && ['wav', 'flac'].includes(v));
}

/** Moteurs sans coquille, par ordre de preference (fidelite des paquets de la suite d'abord). */
function webEngine(from: string, to: string): Engine | null {
  if (has(TEXT_IN, from) && has(TEXT_OUT, to)) return 'texte';
  if (has(SHEET_IN, from) && has(SHEET_OUT, to)) return 'tableur';
  if (has(DECK_IN, from) && has(DECK_OUT, to)) return 'presentation';
  if (from === 'pdf' && (to === 'png' || to === 'jpg')) return 'pdf-images';
  if (from === 'pdf' && to === 'txt') return 'pdf-texte';
  if (has(CANVAS_IN, from) && to === 'pdf') return 'images-pdf';
  if (has(CANVAS_IN, from) && has(CANVAS_OUT, to)) return 'canvas';
  return null;
}

/** Moteur d'une conversion, ou null si impossible ici. Le natif ne sert que si la suite ne sait pas faire,
 *  sauf pour les images (plus de formats et d'options) et les PDF vers texte (extraction plus riche). */
export function planEngine(from: string, to: string, native: boolean): Engine | null {
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  if (f === t || (f === 'jpeg' && t === 'jpg') || (f === 'htm' && t === 'html')) return null;
  const web = webEngine(f, t);
  if (native && nativeSupports(f, t) && (web === null || web === 'canvas' || web === 'pdf-texte' || web === 'images-pdf')) return 'native';
  return web;
}

/** Tous les formats de sortie connus, dans l'ordre d'affichage. */
export const ALL_TARGETS: readonly string[] = [
  'pdf', 'docx', 'odt', 'rtf', 'html', 'md', 'txt', 'epub',
  'xlsx', 'ods', 'csv', 'tsv', 'json', 'yaml', 'toml', 'xml',
  'pptx', 'ppsx', 'potx',
  'png', 'jpg', 'webp', 'gif', 'bmp', 'tiff', 'avif', 'ico', 'tga', 'qoi', 'exr', 'ppm',
  'srt', 'vtt', 'zip', 'tar', 'tgz', 'wav', 'flac',
];

/** Formats de sortie possibles pour une extension. */
export function targetsFor(from: string, native: boolean): string[] {
  return ALL_TARGETS.filter((t) => planEngine(from, t, native) !== null);
}

/** Formats de sortie possibles sur la machine qui a la coquille, mais pas ici (pour l'info-bulle). */
export function desktopOnlyTargets(from: string): string[] {
  return ALL_TARGETS.filter((t) => planEngine(from, t, false) === null && planEngine(from, t, true) !== null);
}

/** Formats communs a tous les fichiers (« Tout convertir en »), au moins un fichier devant l'accepter. */
export function commonTargets(exts: readonly string[], native: boolean): string[] {
  return ALL_TARGETS.filter((t) => exts.some((e) => planEngine(e, t, native) !== null));
}

export function categoryOf(ext: string): Category {
  const e = ext.toLowerCase();
  if (e === 'pdf') return 'pdf';
  if (has(TEXT_IN, e) || e === 'epub') return 'texte';
  if (has(SHEET_IN, e)) return 'tableur';
  if (has(DECK_IN, e)) return 'presentation';
  if (has(IMAGES_ENTREE, e) || e === 'svg' || e === 'avif') return 'image';
  if (has(DONNEES, e)) return 'donnees';
  if (has(SOUS_TITRES, e)) return 'soustitres';
  if (has(ARCHIVES, e)) return 'archive';
  if (has(AUDIO, e)) return 'audio';
  return 'autre';
}

/** Format de sortie propose par defaut (le plus utile pour la famille). */
export function defaultTarget(from: string, native: boolean): string | null {
  const prefs: Readonly<Record<Category, readonly string[]>> = {
    texte: ['pdf', 'docx', 'odt'], tableur: ['xlsx', 'pdf', 'csv'], presentation: ['pdf', 'pptx'], image: ['png', 'jpg', 'pdf'],
    pdf: ['docx', 'txt', 'png'], donnees: ['json', 'xlsx', 'csv'], soustitres: ['srt', 'vtt'], archive: ['zip'], audio: ['wav', 'flac'], autre: [],
  };
  const list = targetsFor(from, native);
  return prefs[categoryOf(from)].find((t) => list.includes(t)) ?? list[0] ?? null;
}

/** Libelle d'un format pour les listes (« PDF », « Document Word (.docx) »). */
const LABELS: Readonly<Record<string, string>> = {
  pdf: 'PDF', docx: 'Document Word', odt: 'Texte OpenDocument', rtf: 'Texte enrichi', html: 'Page web', md: 'Markdown', txt: 'Texte brut',
  epub: 'Livre numérique', xlsx: 'Classeur Excel', ods: 'Classeur OpenDocument', csv: 'CSV (séparateur point-virgule)', tsv: 'Texte tabulé',
  json: 'JSON', yaml: 'YAML', toml: 'TOML', xml: 'XML', pptx: 'Présentation PowerPoint', ppsx: 'Diaporama PowerPoint', potx: 'Modèle PowerPoint',
  png: 'Image PNG', jpg: 'Image JPEG', webp: 'Image WebP', gif: 'Image GIF', bmp: 'Image BMP', tiff: 'Image TIFF', avif: 'Image AVIF',
  ico: 'Icône', tga: 'Image TGA', qoi: 'Image QOI', exr: 'Image EXR', ppm: 'Image PPM', srt: 'Sous-titres SRT', vtt: 'Sous-titres WebVTT',
  zip: 'Archive ZIP', tar: 'Archive TAR', tgz: 'Archive TAR.GZ', wav: 'Audio WAV', flac: 'Audio FLAC',
};

export function formatLabel(ext: string): string {
  const label = LABELS[ext];
  return label ? `${label} (.${ext})` : `.${ext}`;
}

/** Nom de sortie « rapport.pdf », dedoublonne (« rapport (2).pdf ») parmi les noms deja pris. */
export function outputName(input: string, target: string, taken: ReadonlySet<string>): string {
  const base = input.replace(/^.*[\\/]/, '');
  const dot = base.lastIndexOf('.');
  const stem = (dot > 0 ? base.slice(0, dot) : base) || 'fichier';
  let name = `${stem}.${target}`;
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${stem} (${i}).${target}`;
  return name;
}

/** Type MIME d'un format produit (enregistrement et ouverture). */
export function mimeOf(ext: string): string {
  const map: Readonly<Record<string, string>> = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
    txt: 'text/plain', html: 'text/html', md: 'text/markdown', csv: 'text/csv', json: 'application/json', zip: 'application/zip',
  };
  return map[ext] ?? 'application/octet-stream';
}
