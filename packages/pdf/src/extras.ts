// Lecture de ce que pdf.js sait du document, sans DOM (teste dans Node) : liens d'une page, pieces jointes, calques (OCG).
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { safeUrl } from './links.ts';
import type { Rect } from './model.ts';

export interface LinkInfo {
  /** Rectangle normalise dans la page affichee (/Rotate compris, hors rotation de l'affichage). */
  rect: Rect;
  /** Adresse externe autorisee (http, https, mailto, tel) ; jamais javascript:. */
  url: string | null;
  /** Page de destination (0-based) d'un lien interne. */
  page: number | null;
}

interface RawLink {
  subtype?: string;
  rect?: number[];
  url?: string;
  unsafeUrl?: string;
  dest?: unknown;
}

/** Page de destination (0-based) d'un lien interne ; null si la destination est introuvable. */
async function destPage(pdf: PDFDocumentProxy, dest: unknown): Promise<number | null> {
  try {
    const explicit = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
    const ref = Array.isArray(explicit) ? (explicit[0] as unknown) : null;
    if (typeof ref === 'number') return ref;
    if (ref && typeof ref === 'object') return await pdf.getPageIndex(ref as Parameters<PDFDocumentProxy['getPageIndex']>[0]);
    return null;
  } catch {
    return null; // destination cassee : le lien reste inerte
  }
}

/** Liens cliquables d'une page. */
export async function pageLinks(pdf: PDFDocumentProxy, page: PDFPageProxy): Promise<LinkInfo[]> {
  const viewport = page.getViewport({ scale: 1 });
  const out: LinkInfo[] = [];
  for (const a of (await page.getAnnotations()) as RawLink[]) {
    if (a.subtype !== 'Link' || !a.rect || a.rect.length !== 4) continue;
    const [x1 = 0, y1 = 0] = viewport.convertToViewportPoint(a.rect[0] ?? 0, a.rect[1] ?? 0) as number[];
    const [x2 = 0, y2 = 0] = viewport.convertToViewportPoint(a.rect[2] ?? 0, a.rect[3] ?? 0) as number[];
    const rect: Rect = { x: Math.min(x1, x2) / viewport.width, y: Math.min(y1, y2) / viewport.height, w: Math.abs(x2 - x1) / viewport.width, h: Math.abs(y2 - y1) / viewport.height };
    const url = safeUrl(a.url ?? a.unsafeUrl ?? '');
    const target = a.dest !== undefined ? await destPage(pdf, a.dest) : null;
    if (url || target !== null) out.push({ rect, url, page: target });
  }
  return out;
}

export interface AttachmentInfo {
  id: string;
  name: string;
  description: string;
  size: number;
}

/** Pieces jointes (fichiers incorpores et annotations « fichier joint »). */
export async function listAttachments(pdf: PDFDocumentProxy): Promise<AttachmentInfo[]> {
  const map = await pdf.getAttachments();
  if (!map) return [];
  const out: AttachmentInfo[] = [];
  for (const [id, a] of map) {
    const content = a.content ?? (await pdf.getAttachmentContent(id));
    out.push({ id, name: a.filename || id, description: a.description ?? '', size: content?.length ?? 0 });
  }
  return out;
}

/** Contenu d'une piece jointe. */
export async function attachmentBytes(pdf: PDFDocumentProxy, id: string): Promise<Uint8Array> {
  const map = await pdf.getAttachments();
  const a = map?.get(id);
  const content = a?.content ?? (await pdf.getAttachmentContent(id));
  if (!content) throw new Error('Pièce jointe vide ou introuvable.');
  return Uint8Array.from(content);
}

export interface LayerInfo {
  id: string;
  name: string;
  visible: boolean;
}

export type OcConfig = Awaited<ReturnType<PDFDocumentProxy['getOptionalContentConfig']>>;

/** Calques (groupes de contenu optionnel) et leur visibilite courante. */
export async function listLayers(config: OcConfig): Promise<LayerInfo[]> {
  const out: LayerInfo[] = [];
  for (const [id, group] of config as unknown as Iterable<[string, { name?: string; visible?: boolean }]>) {
    out.push({ id: String(id), name: group.name ?? String(id), visible: group.visible !== false });
  }
  return out;
}

export function setLayerVisible(config: OcConfig, id: string, visible: boolean): void {
  config.setVisibility(id, visible);
}
