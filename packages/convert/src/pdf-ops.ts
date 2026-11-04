// Operations PDF en TypeScript (pdf-lib) : fonctionnent partout, sans la coquille. Partagees par le
// Convertisseur (traitements par lots) et le module PDF (organisation des pages, tampons, metadonnees).
// Code sans DOM, teste.
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export type Stamp = 'haut_gauche' | 'haut_centre' | 'haut_droite' | 'bas_gauche' | 'bas_centre' | 'bas_droite';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Ouvre un PDF modifiable (les PDF chiffres sont refuses par pdf-lib : passer par le moteur natif). */
export function load(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { updateMetadata: false });
}

export function save(doc: PDFDocument, compact = true): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: compact });
}

const RANGE = /^(\d*)\s*-\s*(\d*)$/;

/** Selection « 1-3, 5, 8- » (1-based) en indices 0-based tries, sans doublon. Leve une erreur francaise. */
export function parsePageRange(text: string, total: number): number[] {
  const pages = new Set<number>();
  for (const raw of text.split(/[,;]/)) {
    const part = raw.trim();
    if (!part) continue;
    const m = part.match(RANGE);
    let from: number;
    let to: number;
    if (m) {
      from = m[1] ? Number(m[1]) : 1;
      to = m[2] ? Number(m[2]) : total;
    } else if (/^\d+$/.test(part)) {
      from = to = Number(part);
    } else {
      throw new Error(`Sélection de pages invalide : « ${part} »`);
    }
    if (from < 1 || to > total || from > to) throw new Error(`Pages hors limites : « ${part} » (1 à ${total})`);
    for (let p = from; p <= to; p++) pages.add(p - 1);
  }
  if (pages.size === 0) throw new Error('Aucune page sélectionnée');
  return [...pages].sort((a, b) => a - b);
}

/** Texte limite aux caracteres de la police standard (WinAnsi) : les autres deviennent « ? ». */
export function encodable(font: PDFFont, text: string): string {
  const set = new Set(font.getCharacterSet());
  return [...text].map((c) => (set.has(c.codePointAt(0) ?? 0) ? c : '?')).join('');
}

export async function merge(files: readonly Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const bytes of files) {
    const src = await load(bytes);
    for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page);
  }
  return save(out);
}

/** Nouveau document avec les pages `indices` (0-based, doublons permis). */
export async function extract(bytes: Uint8Array, indices: readonly number[]): Promise<Uint8Array> {
  const src = await load(bytes);
  const out = await PDFDocument.create();
  for (const page of await out.copyPages(src, [...indices])) out.addPage(page);
  return save(out);
}

/** Decoupe : un fichier par groupe d'indices. */
export async function split(bytes: Uint8Array, groups: readonly (readonly number[])[]): Promise<Uint8Array[]> {
  const parts: Uint8Array[] = [];
  for (const g of groups) parts.push(await extract(bytes, g));
  return parts;
}

/** Groupes de `n` pages consecutives. */
export function chunks(total: number, n: number): number[][] {
  const size = Math.max(1, Math.floor(n));
  const out: number[][] = [];
  for (let i = 0; i < total; i += size) out.push(Array.from({ length: Math.min(size, total - i) }, (_, k) => i + k));
  return out;
}

/** Modifie le document (ordre, suppression, rotation, insertion, dessin) puis l'enregistre. */
export async function editPages(bytes: Uint8Array, edit: (doc: PDFDocument) => void | Promise<void>): Promise<Uint8Array> {
  const doc = await load(bytes);
  await edit(doc);
  return save(doc);
}

/** Pivote les pages (0-based ; toutes si absent) d'un multiple de 90 degres, en tenant compte de /Rotate. */
export function rotate(bytes: Uint8Array, by: number, pages?: readonly number[]): Promise<Uint8Array> {
  return editPages(bytes, (doc) => {
    for (const i of pages ?? doc.getPageIndices()) {
      const p = doc.getPage(i);
      p.setRotation(degrees((((p.getRotation().angle + by) % 360) + 360) % 360));
    }
  });
}

/** Remplace l'ordre des pages par `order` (indices 0-based de l'ordre actuel, sans doublon), sans recopie. */
export function reorder(bytes: Uint8Array, order: readonly number[]): Promise<Uint8Array> {
  return editPages(bytes, (doc) => {
    const pages = doc.getPages();
    if (order.length !== pages.length || new Set(order).size !== order.length) throw new Error('Ordre de pages invalide');
    for (let i = pages.length - 1; i >= 0; i--) doc.removePage(i);
    order.forEach((src, i) => {
      const page = pages[src];
      if (!page) throw new Error('Ordre de pages invalide');
      doc.insertPage(i, page);
    });
  });
}

export function removePages(bytes: Uint8Array, indices: readonly number[]): Promise<Uint8Array> {
  return editPages(bytes, (doc) => {
    if (indices.length >= doc.getPageCount()) throw new Error('Un PDF doit garder au moins une page');
    [...indices].sort((a, b) => b - a).forEach((i) => doc.removePage(i));
  });
}

/** Insere une page blanche de la taille de sa voisine a la position `at`. */
export function insertBlank(bytes: Uint8Array, at: number): Promise<Uint8Array> {
  return editPages(bytes, (doc) => {
    const ref = doc.getPage(Math.min(Math.max(at - 1, 0), doc.getPageCount() - 1));
    doc.insertPage(at, [ref.getWidth(), ref.getHeight()]);
  });
}

/** Insere toutes les pages d'un autre PDF a la position `at`. */
export function insertDocument(bytes: Uint8Array, other: Uint8Array, at: number): Promise<Uint8Array> {
  return editPages(bytes, async (doc) => {
    const src = await load(other);
    const pages = await doc.copyPages(src, src.getPageIndices());
    pages.forEach((p, k) => doc.insertPage(at + k, p));
  });
}

/** Point de pose d'un texte de largeur `w` selon la position, dans une page visible de taille (pw, ph). */
export function stampOrigin(pos: Stamp, w: number, size: number, pw: number, ph: number, margin: number): { x: number; y: number } {
  const x = pos.endsWith('gauche') ? margin : pos.endsWith('droite') ? pw - margin - w : (pw - w) / 2;
  const y = pos.startsWith('haut') ? ph - margin - size : margin;
  return { x, y };
}

/** Remplace {page} et {total} ; `digits` ajoute des zeros de tete (Bates). */
export function fillTemplate(template: string, page: number, total: number, digits = 0): string {
  return template.replaceAll('{page}', String(page).padStart(digits, '0')).replaceAll('{total}', String(total));
}

/** Pose un texte droit a l'ecran meme si la page porte un /Rotate. */
function drawUpright(page: PDFPage, font: PDFFont, text: string, size: number, pos: Stamp, margin: number, color: RGB): void {
  const angle = page.getRotation().angle % 360;
  const { width: W, height: H } = page.getSize();
  const swap = angle === 90 || angle === 270;
  const [pw, ph] = swap ? [H, W] : [W, H];
  const { x, y } = stampOrigin(pos, font.widthOfTextAtSize(text, size), size, pw, ph, margin);
  // Coordonnees visibles -> coordonnees de la page non pivotee.
  const map: Readonly<Record<number, [number, number]>> = { 0: [x, y], 90: [W - y, x], 180: [W - x, H - y], 270: [y, H - x] };
  const [px, py] = map[angle] ?? [x, y];
  page.drawText(text, { x: px, y: py, size, font, color: rgb(color.r, color.g, color.b), rotate: degrees(angle) });
}

export interface PageTextOptions {
  template: string;
  position: Stamp;
  size: number;
  start: number;
  digits: number;
  margin: number;
  color: RGB;
  /** Pages concernees (0-based) ; toutes si absent. */
  pages?: readonly number[];
}

/** Numerotation, Bates, en-tete ou pied de page : texte pose sur chaque page avec {page} et {total}. */
export function stampPages(bytes: Uint8Array, o: PageTextOptions): Promise<Uint8Array> {
  return editPages(bytes, async (doc) => {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const list = o.pages ?? doc.getPageIndices();
    list.forEach((i, k) => {
      const text = encodable(font, fillTemplate(o.template, o.start + k, list.length + o.start - 1, o.digits));
      drawUpright(doc.getPage(i), font, text, o.size, o.position, o.margin, o.color);
    });
  });
}

export interface WatermarkOptions {
  text: string;
  size: number;
  opacity: number;
  angle: number;
  color: RGB;
  pages?: readonly number[];
}

export function watermark(bytes: Uint8Array, o: WatermarkOptions): Promise<Uint8Array> {
  return editPages(bytes, async (doc) => {
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const text = encodable(font, o.text);
    const w = font.widthOfTextAtSize(text, o.size);
    const rad = (o.angle * Math.PI) / 180;
    for (const i of o.pages ?? doc.getPageIndices()) {
      const page = doc.getPage(i);
      const { width, height } = page.getSize();
      // Centre du texte au centre de la page.
      const x = width / 2 - (Math.cos(rad) * w) / 2 + (Math.sin(rad) * o.size) / 3;
      const y = height / 2 - (Math.sin(rad) * w) / 2 - (Math.cos(rad) * o.size) / 3;
      page.drawText(text, { x, y, size: o.size, font, opacity: o.opacity, rotate: degrees(o.angle), color: rgb(o.color.r, o.color.g, o.color.b) });
    }
  });
}

export interface Metadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
}

export async function readMetadata(bytes: Uint8Array): Promise<Metadata & { pages: number }> {
  const doc = await load(bytes);
  return {
    title: doc.getTitle() ?? '', author: doc.getAuthor() ?? '', subject: doc.getSubject() ?? '',
    keywords: doc.getKeywords() ?? '', creator: doc.getCreator() ?? '', producer: doc.getProducer() ?? '', pages: doc.getPageCount(),
  };
}

export function writeMetadata(bytes: Uint8Array, m: Metadata): Promise<Uint8Array> {
  return editPages(bytes, (doc) => {
    doc.setTitle(m.title);
    doc.setAuthor(m.author);
    doc.setSubject(m.subject);
    doc.setKeywords(m.keywords.split(/[,;]/).map((k) => k.trim()).filter(Boolean));
    doc.setCreator(m.creator);
    doc.setProducer(m.producer);
    doc.setModificationDate(new Date());
  });
}

export type ImageKind = 'png' | 'jpg';

/** Une image par page, page a la taille de l'image (72 ppp). */
export async function imagesToPdf(images: readonly { bytes: Uint8Array; kind: ImageKind }[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const im of images) {
    const img = im.kind === 'png' ? await doc.embedPng(im.bytes) : await doc.embedJpg(im.bytes);
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return save(doc);
}
