// Espaces de noms, types de relations et types de contenu WordprocessingML.

export const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  m: 'http://schemas.openxmlformats.org/officeDocument/2006/math',
  v: 'urn:schemas-microsoft-com:vml',
  o: 'urn:schemas-microsoft-com:office:office',
  w10: 'urn:schemas-microsoft-com:office:word',
  mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
  wps: 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape',
  wpg: 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup',
  w14: 'http://schemas.microsoft.com/office/word/2010/wordml',
  w15: 'http://schemas.microsoft.com/office/word/2012/wordml',
  wp14: 'http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing',
  a14: 'http://schemas.microsoft.com/office/drawing/2010/main',
  cp: 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
  dc: 'http://purl.org/dc/elements/1.1/',
  dcterms: 'http://purl.org/dc/terms/',
  dcmitype: 'http://purl.org/dc/dcmitype/',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
  ep: 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties',
  vt: 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes',
  custom: 'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties',
} as const;

/** Declarations xmlns pour la racine des parties de contenu (document, en-tetes, notes, commentaires). */
export const CONTENT_NS: Record<string, string> = {
  'xmlns:wpc': 'http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas',
  'xmlns:mc': NS.mc,
  'xmlns:o': NS.o,
  'xmlns:r': NS.r,
  'xmlns:m': NS.m,
  'xmlns:v': NS.v,
  'xmlns:wp14': NS.wp14,
  'xmlns:wp': NS.wp,
  'xmlns:w10': NS.w10,
  'xmlns:w': NS.w,
  'xmlns:w14': NS.w14,
  'xmlns:w15': NS.w15,
  'xmlns:wpg': NS.wpg,
  'xmlns:wps': NS.wps,
  'xmlns:a': NS.a,
  'xmlns:pic': NS.pic,
  'xmlns:a14': NS.a14,
  'mc:Ignorable': 'w14 w15 wp14',
};

const OD = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export const REL = {
  officeDocument: `${OD}/officeDocument`,
  coreProps: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  extendedProps: `${OD}/extended-properties`,
  customProps: `${OD}/custom-properties`,
  thumbnail: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail',
  styles: `${OD}/styles`,
  numbering: `${OD}/numbering`,
  theme: `${OD}/theme`,
  settings: `${OD}/settings`,
  webSettings: `${OD}/webSettings`,
  fontTable: `${OD}/fontTable`,
  header: `${OD}/header`,
  footer: `${OD}/footer`,
  footnotes: `${OD}/footnotes`,
  endnotes: `${OD}/endnotes`,
  comments: `${OD}/comments`,
  commentsExtended: 'http://schemas.microsoft.com/office/2011/relationships/commentsExtended',
  image: `${OD}/image`,
  hyperlink: `${OD}/hyperlink`,
  vbaProject: 'http://schemas.microsoft.com/office/2006/relationships/vbaProject',
} as const;

const WML = 'application/vnd.openxmlformats-officedocument.wordprocessingml';

export const CT = {
  document: `${WML}.document.main+xml`,
  documentMacro: 'application/vnd.ms-word.document.macroEnabled.main+xml',
  template: `${WML}.template.main+xml`,
  templateMacro: 'application/vnd.ms-word.template.macroEnabledTemplate.main+xml',
  styles: `${WML}.styles+xml`,
  numbering: `${WML}.numbering+xml`,
  settings: `${WML}.settings+xml`,
  webSettings: `${WML}.webSettings+xml`,
  fontTable: `${WML}.fontTable+xml`,
  header: `${WML}.header+xml`,
  footer: `${WML}.footer+xml`,
  footnotes: `${WML}.footnotes+xml`,
  endnotes: `${WML}.endnotes+xml`,
  comments: `${WML}.comments+xml`,
  commentsExtended: `${WML}.commentsExtended+xml`,
  theme: 'application/vnd.openxmlformats-officedocument.theme+xml',
  core: 'application/vnd.openxmlformats-package.core-properties+xml',
  app: 'application/vnd.openxmlformats-officedocument.extended-properties+xml',
  custom: 'application/vnd.openxmlformats-officedocument.custom-properties+xml',
  vba: 'application/vnd.ms-office.vbaProject',
} as const;

/** Types MIME des images par extension. */
export const IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp',
  tif: 'image/tiff', tiff: 'image/tiff', svg: 'image/svg+xml', emf: 'image/x-emf', wmf: 'image/x-wmf',
  webp: 'image/webp', ico: 'image/x-icon',
};

export function extensionOf(contentType: string, fallbackName = ''): string {
  for (const [ext, type] of Object.entries(IMAGE_TYPES)) if (type === contentType && ext !== 'jpg' && ext !== 'tif') return ext;
  const dot = fallbackName.lastIndexOf('.');
  return dot >= 0 ? fallbackName.slice(dot + 1).toLowerCase() : 'bin';
}

/** Detecte le type d'une image d'apres ses premiers octets. */
export function sniffImageType(bytes: Uint8Array): string | undefined {
  const b = (i: number): number => bytes[i] ?? -1;
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return 'image/png';
  if (b(0) === 0xff && b(1) === 0xd8) return 'image/jpeg';
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46) return 'image/gif';
  if (b(0) === 0x42 && b(1) === 0x4d) return 'image/bmp';
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57) return 'image/webp';
  if (b(0) === 0x01 && b(1) === 0x00 && b(2) === 0x00 && b(3) === 0x00 && b(40) === 0x20 && b(41) === 0x45) return 'image/x-emf';
  if (b(0) === 0xd7 && b(1) === 0xcd && b(2) === 0xc6 && b(3) === 0x9a) return 'image/x-wmf';
  if ((b(0) === 0x49 && b(1) === 0x49) || (b(0) === 0x4d && b(1) === 0x4d)) return 'image/tiff';
  if (b(0) === 0x3c) return 'image/svg+xml';
  return undefined;
}
