// Bibliotheque personnelle de blocs : objets enregistres une fois, reutilisables dans toutes les publications (reglages de l'application).
// Les objets qui reference une image du fichier (images, remplissages par image) ne sont pas enregistres : l'image ne suivrait pas.
import type { Shape } from '@forgeoffice/pptx';

export interface LibraryBlock {
  id: string;
  name: string;
  /** Taille naturelle du bloc (pt). */
  width: number;
  height: number;
  /** Formes dont le coin haut gauche du cadre englobant est a l'origine. */
  shapes: Shape[];
}

export const LIBRARY_SETTING = 'publisher.library';
export const MAX_BLOCKS = 50;
export const MAX_SHAPES = 200;
const MAX_NAME = 60;

const usesMedia = (shape: Shape): boolean => /"(mediaId|embed|blip)"/.test(JSON.stringify(shape)) || shape.kind === 'picture';

function bounds(shapes: readonly Shape[]): { x: number; y: number; width: number; height: number } | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of shapes) {
    if (!s.xfrm) continue;
    x0 = Math.min(x0, s.xfrm.x);
    y0 = Math.min(y0, s.xfrm.y);
    x1 = Math.max(x1, s.xfrm.x + s.xfrm.width);
    y1 = Math.max(y1, s.xfrm.y + s.xfrm.height);
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

export interface Captured {
  block: LibraryBlock | null;
  /** Nombre d'objets non enregistres (images). */
  skipped: number;
}

/** Bloc a partir des formes selectionnees (copies deplacees a l'origine) ; null si rien n'est enregistrable. */
export function captureBlock(name: string, shapes: readonly Shape[], existing: readonly LibraryBlock[]): Captured {
  const keep = shapes.filter((s) => !usesMedia(s) && s.xfrm).slice(0, MAX_SHAPES);
  const skipped = shapes.length - keep.length;
  const box = bounds(keep);
  const clean = name.trim().slice(0, MAX_NAME);
  if (!box || !clean) return { block: null, skipped };
  const moved = keep.map((s) => {
    const copy = structuredClone(s);
    if (copy.xfrm) copy.xfrm = { ...copy.xfrm, x: copy.xfrm.x - box.x, y: copy.xfrm.y - box.y };
    return copy;
  });
  let n = 1;
  while (existing.some((b) => b.id === `bloc${n}`)) n++;
  const id = `bloc${n}`;
  return { block: { id, name: clean, width: Math.max(1, box.width), height: Math.max(1, box.height), shapes: moved }, skipped };
}

/** Ajoute le bloc (ou remplace celui de meme nom). */
export function addBlock(library: readonly LibraryBlock[], block: LibraryBlock): LibraryBlock[] {
  const at = library.findIndex((b) => b.name === block.name);
  if (at >= 0) return library.map((b, i) => (i === at ? { ...block, id: b.id } : b));
  return library.length >= MAX_BLOCKS ? [...library] : [...library, block];
}

export const removeBlock = (library: readonly LibraryBlock[], id: string): LibraryBlock[] => library.filter((b) => b.id !== id);

const isShape = (v: unknown): v is Shape => !!v && typeof v === 'object' && typeof (v as { kind?: unknown }).kind === 'string' && typeof (v as { id?: unknown }).id === 'number';
const finite = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e5 ? v : fallback);

/** Bibliotheque lue depuis les reglages : entrees invalides ignorees. */
export function parseLibrary(value: unknown): LibraryBlock[] {
  const out: LibraryBlock[] = [];
  for (const item of (Array.isArray(value) ? value : []).slice(0, MAX_BLOCKS)) {
    const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, MAX_NAME) : '';
    const shapes = (Array.isArray(o.shapes) ? o.shapes : []).filter(isShape).slice(0, MAX_SHAPES);
    if (!name || !shapes.length || out.some((b) => b.name === name)) continue;
    const id = typeof o.id === 'string' && /^[a-z0-9-]{1,30}$/.test(o.id) && !out.some((b) => b.id === o.id) ? o.id : `bloc${out.length + 1}-${out.length}`;
    out.push({ id, name, width: finite(o.width, 100), height: finite(o.height, 100), shapes });
  }
  return out;
}
