// Informations du document (lecture seule) et réglages d'accessibilité de base : langue (/Lang), titre affiché dans la barre de titre
// (DisplayDocTitle), PDF balisé ou non. Sans DOM, testé.
import { PDFBool, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from '@cantoo/pdf-lib';

export interface DocInfo {
  /** Version lue dans l'en-tête, ex. « 1.7 ». */
  version: string;
  bytes: number;
  pages: number;
  /** Taille de la première page en points (rotation appliquée). */
  pageWidth: number;
  pageHeight: number;
  created: Date | null;
  modified: Date | null;
  /** Le fichier contient une structure logique (PDF balisé, lisible par les lecteurs d'écran). */
  tagged: boolean;
  /** Code de langue du document (« fr-FR »), vide si absent. */
  lang: string;
  displayTitle: boolean;
}

const FORMATS: readonly { name: string; w: number; h: number }[] = [
  { name: 'A3', w: 297, h: 420 }, { name: 'A4', w: 210, h: 297 }, { name: 'A5', w: 148, h: 210 }, { name: 'A6', w: 105, h: 148 },
  { name: 'Lettre', w: 215.9, h: 279.4 }, { name: 'Légal', w: 215.9, h: 355.6 },
];

/** « A4 (210 × 297 mm), portrait » : format nommé à 1 mm près, sinon les dimensions seules. */
export function describePageSize(widthPt: number, heightPt: number): string {
  const mm = (pt: number): number => (pt * 25.4) / 72;
  const [w, h] = [mm(widthPt), mm(heightPt)];
  const [small, big] = w <= h ? [w, h] : [h, w];
  const named = FORMATS.find((f) => Math.abs(f.w - small) <= 1.5 && Math.abs(f.h - big) <= 1.5);
  const size = `${Math.round(w)} × ${Math.round(h)} mm`;
  const orientation = Math.abs(w - h) < 1 ? 'carré' : w < h ? 'portrait' : 'paysage';
  return `${named ? `${named.name} (${size})` : size}, ${orientation}`;
}

const text = (v: unknown): string => (v instanceof PDFString || v instanceof PDFHexString ? v.decodeText() : '');

export async function readDocInfo(bytes: Uint8Array): Promise<DocInfo> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 16));
  const first = doc.getPageCount() > 0 ? doc.getPage(0) : null;
  const size = first?.getSize() ?? { width: 0, height: 0 };
  const turned = (first?.getRotation().angle ?? 0) % 180 === 90;
  const prefs = doc.catalog.lookupMaybe(PDFName.of('ViewerPreferences'), PDFDict);
  return {
    version: head.match(/%PDF-(\d\.\d)/)?.[1] ?? '?',
    bytes: bytes.length,
    pages: doc.getPageCount(),
    pageWidth: turned ? size.height : size.width,
    pageHeight: turned ? size.width : size.height,
    created: doc.getCreationDate() ?? null,
    modified: doc.getModificationDate() ?? null,
    tagged: doc.catalog.has(PDFName.of('StructTreeRoot')),
    lang: text(doc.catalog.get(PDFName.of('Lang'))),
    displayTitle: prefs?.lookup(PDFName.of('DisplayDocTitle')) === PDFBool.True,
  };
}

/** Écrit la langue et l'option « afficher le titre » ; langue vide = champ retiré. */
export async function writeAccess(bytes: Uint8Array, a: { lang: string; displayTitle: boolean }): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const lang = a.lang.trim();
  if (lang === '') doc.catalog.delete(PDFName.of('Lang'));
  else doc.catalog.set(PDFName.of('Lang'), PDFString.of(lang));
  const existing = doc.catalog.lookupMaybe(PDFName.of('ViewerPreferences'), PDFDict);
  const prefs = existing ?? doc.context.obj({});
  if (!existing) doc.catalog.set(PDFName.of('ViewerPreferences'), prefs);
  prefs.set(PDFName.of('DisplayDocTitle'), a.displayTitle ? PDFBool.True : PDFBool.False);
  return doc.save({ useObjectStreams: false });
}

/** Code de langue plausible (BCP 47 simplifié : « fr », « fr-FR », « en-GB ») ; vide accepté. */
export const validLang = (s: string): boolean => s.trim() === '' || /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(s.trim());

export function formatBytes(n: number): string {
  return n < 1024 ? `${n} o` : n < 1048576 ? `${(n / 1024).toFixed(1).replace('.', ',')} Ko` : `${(n / 1048576).toFixed(2).replace('.', ',')} Mo`;
}
