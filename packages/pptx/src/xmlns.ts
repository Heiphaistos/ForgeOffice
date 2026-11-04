// Espaces de noms, types de contenu et de relations PresentationML ; normalisation des prefixes.
import { isElement, type XmlElement, type XmlNode } from '@forgeoffice/opc';

/** Prefixe canonique -> URI. Les fichiers lus sont ramenes a ces prefixes. */
export const NS: Readonly<Record<string, string>> = {
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  c: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
  dgm: 'http://schemas.openxmlformats.org/drawingml/2006/diagram',
  mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
  p14: 'http://schemas.microsoft.com/office/powerpoint/2010/main',
  p15: 'http://schemas.microsoft.com/office/powerpoint/2012/main',
  p159: 'http://schemas.microsoft.com/office/powerpoint/2015/09/main',
  p188: 'http://schemas.microsoft.com/office/powerpoint/2018/8/main',
  a14: 'http://schemas.microsoft.com/office/drawing/2010/main',
  a16: 'http://schemas.microsoft.com/office/drawing/2014/main',
  asvg: 'http://schemas.microsoft.com/office/drawing/2016/SVG/main',
  v: 'urn:schemas-microsoft-com:vml',
  dsp: 'http://schemas.microsoft.com/office/drawing/2008/diagram',
  c14: 'http://schemas.microsoft.com/office/drawing/2007/8/2/chart',
  c16r2: 'http://schemas.microsoft.com/office/drawing/2015/06/chart',
};

const URI_TO_PREFIX = new Map<string, string>(Object.entries(NS).map(([prefix, uri]) => [uri, prefix]));
// Variantes « strict » (ISO 29500) ramenees aux prefixes transitionnels.
URI_TO_PREFIX.set('http://purl.oclc.org/ooxml/drawingml/main', 'a');
URI_TO_PREFIX.set('http://purl.oclc.org/ooxml/officeDocument/relationships', 'r');
URI_TO_PREFIX.set('http://purl.oclc.org/ooxml/presentationml/main', 'p');
URI_TO_PREFIX.set('http://purl.oclc.org/ooxml/drawingml/chart', 'c');

/** Declarations posees sur chaque racine ecrite (prefixes reconnus par PowerPoint). */
export function rootNamespaces(...prefixes: string[]): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const prefix of prefixes) {
    const uri = NS[prefix];
    if (uri) attrs[`xmlns:${prefix}`] = uri;
  }
  return attrs;
}

export const CT = {
  presentation: 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
  presentationMacro: 'application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml',
  template: 'application/vnd.openxmlformats-officedocument.presentationml.template.main+xml',
  templateMacro: 'application/vnd.ms-powerpoint.template.macroEnabled.main+xml',
  slideshow: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml',
  slideshowMacro: 'application/vnd.ms-powerpoint.slideshow.macroEnabled.main+xml',
  slide: 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml',
  layout: 'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml',
  master: 'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml',
  notesMaster: 'application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml',
  notesSlide: 'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml',
  theme: 'application/vnd.openxmlformats-officedocument.theme+xml',
  presProps: 'application/vnd.openxmlformats-officedocument.presentationml.presProps+xml',
  viewProps: 'application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml',
  tableStyles: 'application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml',
  comments: 'application/vnd.openxmlformats-officedocument.presentationml.comments+xml',
  commentAuthors: 'application/vnd.openxmlformats-officedocument.presentationml.commentAuthors+xml',
  modernComments: 'application/vnd.ms-powerpoint.comments+xml',
  authors: 'application/vnd.ms-powerpoint.authors+xml',
  chart: 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml',
  core: 'application/vnd.openxmlformats-package.core-properties+xml',
  app: 'application/vnd.openxmlformats-officedocument.extended-properties+xml',
  custom: 'application/vnd.openxmlformats-officedocument.custom-properties+xml',
  vba: 'application/vnd.ms-office.vbaProject',
} as const;

const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export const RT = {
  officeDocument: `${R}/officeDocument`,
  slide: `${R}/slide`,
  layout: `${R}/slideLayout`,
  master: `${R}/slideMaster`,
  notesMaster: `${R}/notesMaster`,
  notesSlide: `${R}/notesSlide`,
  theme: `${R}/theme`,
  presProps: `${R}/presProps`,
  viewProps: `${R}/viewProps`,
  tableStyles: `${R}/tableStyles`,
  image: `${R}/image`,
  video: `${R}/video`,
  audio: `${R}/audio`,
  media: 'http://schemas.microsoft.com/office/2007/relationships/media',
  hyperlink: `${R}/hyperlink`,
  chart: `${R}/chart`,
  comments: `${R}/comments`,
  commentAuthors: `${R}/commentAuthors`,
  modernComments: 'http://schemas.microsoft.com/office/2018/10/relationships/comments',
  authors: 'http://schemas.microsoft.com/office/2018/10/relationships/authors',
  coreProps: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  appProps: `${R}/extended-properties`,
  customProps: `${R}/custom-properties`,
  thumbnail: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail',
  vba: 'http://schemas.microsoft.com/office/2006/relationships/vbaProject',
} as const;

/** Types de contenu des medias courants (par extension). */
export const MEDIA_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
  emf: 'image/x-emf',
  wmf: 'image/x-wmf',
  wdp: 'image/vnd.ms-photo',
  webp: 'image/webp',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  wmv: 'video/x-ms-wmv',
  avi: 'video/avi',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  wma: 'audio/x-ms-wma',
  mid: 'audio/midi',
  ogg: 'audio/ogg',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  bin: 'application/vnd.openxmlformats-officedocument.oleObject',
  xml: 'application/xml',
};

export function extensionOf(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot >= 0 ? path.slice(dot + 1).toLowerCase() : '';
}

// ---- Normalisation des prefixes ----

function splitName(name: string): [string, string] {
  const colon = name.indexOf(':');
  return colon < 0 ? ['', name] : [name.slice(0, colon), name.slice(colon + 1)];
}

function canonicalPrefix(prefix: string, scope: ReadonlyMap<string, string>): string {
  const uri = scope.get(prefix);
  if (uri === undefined) return prefix;
  return URI_TO_PREFIX.get(uri) ?? prefix;
}

function canonicalizeElement(node: XmlElement, parentScope: ReadonlyMap<string, string>): void {
  let scope = parentScope;
  for (const [key, value] of Object.entries(node.attrs)) {
    if (key === 'xmlns' || key.startsWith('xmlns:')) {
      if (scope === parentScope) scope = new Map(parentScope);
      (scope as Map<string, string>).set(key === 'xmlns' ? '' : key.slice(6), value);
    }
  }
  const [prefix, local] = splitName(node.name);
  const canon = canonicalPrefix(prefix, scope);
  if (canon !== prefix) node.name = `${canon}:${local}`;
  const attrs: Record<string, string> = {};
  for (const [key, value] of Object.entries(node.attrs)) {
    if (key === 'xmlns' || key.startsWith('xmlns:')) {
      const declared = key === 'xmlns' ? '' : key.slice(6);
      const known = URI_TO_PREFIX.get(value);
      // Les declarations connues sont reposees a l'ecriture ; les autres sont gardees telles quelles.
      if (known === undefined) attrs[key] = value;
      else if (known !== declared && declared !== '') attrs[`xmlns:${known}`] = NS[known] ?? value;
      continue;
    }
    const [attrPrefix, attrLocal] = splitName(key);
    attrs[attrPrefix ? `${canonicalPrefix(attrPrefix, scope)}:${attrLocal}` : key] = value;
  }
  node.attrs = attrs;
  for (const kid of node.children) if (isElement(kid)) canonicalizeElement(kid, scope);
}

/** Ramene les elements et attributs aux prefixes canoniques (a:, p:, r:...), quel que soit le prefixe du fichier. */
export function canonicalize(root: XmlElement): XmlElement {
  canonicalizeElement(root, new Map());
  return root;
}

/** Copie profonde d'un arbre XML. */
export function cloneXml<T extends XmlNode>(node: T): T {
  if (typeof node === 'string') return node;
  const element = node as XmlElement;
  return { name: element.name, attrs: { ...element.attrs }, children: element.children.map((kid) => cloneXml(kid)) } as T;
}

/** Prefixes utilises dans un fragment (pour reposer leurs declarations). */
export function usedPrefixes(node: XmlElement, out = new Set<string>()): Set<string> {
  const [prefix] = splitName(node.name);
  if (prefix) out.add(prefix);
  for (const key of Object.keys(node.attrs)) {
    const [attrPrefix] = splitName(key);
    if (attrPrefix && attrPrefix !== 'xmlns') out.add(attrPrefix);
  }
  for (const kid of node.children) if (isElement(kid)) usedPrefixes(kid, out);
  return out;
}
