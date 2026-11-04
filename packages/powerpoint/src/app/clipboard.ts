// Presse-papiers : formes et diapositives (copie riche interne, texte brut dans le presse-papiers du systeme),
// collage d'images et de texte venus d'autres applications, reproduction de la mise en forme.
import { textOfShape, nextSlideId, type Deck, type Effects, type Fill, type Line, type MediaItem, type RunProps, type Shape, type Slide } from '@forgeoffice/pptx';
import { flattenWithBoxes, insertCopies, locate, deleteShapes } from '../canvas/ops.ts';
import { applyRunProps, endPos } from '../canvas/text.ts';
import { editDeck } from './deck-ops.ts';
import type { Editor } from './editor.ts';
import { insertPictureBytes, insertTextBoxAtCenter } from './insert.ts';
import { S } from '../strings.ts';

type Clip =
  | { kind: 'shapes'; shapes: Shape[]; media: Record<string, MediaItem>; plain: string; pastes: number }
  | { kind: 'slides'; slides: Slide[]; media: Record<string, MediaItem>; plain: string };

let clip: Clip | null = null;

/** Medias references par des formes (images, remplissages, puces, sons). */
function mediaOf(deck: Deck, shapes: Shape[]): Record<string, MediaItem> {
  const json = JSON.stringify(shapes, (_k, v: unknown) => (v instanceof Uint8Array ? undefined : v));
  const out: Record<string, MediaItem> = {};
  for (const [id, item] of Object.entries(deck.media)) if (json.includes(`"${id}"`)) out[id] = item;
  return out;
}

/** Remplace les identifiants de medias (cles mediaId, svgMediaId, posterMediaId...) dans un objet. */
function remapMedia(value: unknown, map: ReadonlyMap<string, string>): void {
  if (!value || typeof value !== 'object' || value instanceof Uint8Array) return;
  const obj = value as Record<string, unknown>;
  for (const [key, v] of Object.entries(obj)) {
    if ((key === 'mediaId' || key.endsWith('MediaId')) && typeof v === 'string' && map.has(v)) obj[key] = map.get(v);
    else remapMedia(v, map);
  }
}

/** Ajoute des medias d'une autre presentation (memes identifiants s'ils sont libres, sinon renommes). */
function mergeMedia(deck: Deck, media: Record<string, MediaItem>, source: Shape[]): { media: Record<string, MediaItem>; shapes: Shape[] } {
  const merged = { ...deck.media };
  const shapes = structuredClone(source);
  const map = new Map<string, string>();
  for (const [id, item] of Object.entries(media)) {
    if (merged[id]?.bytes === item.bytes) continue;
    let target = id;
    let n = Object.keys(merged).length + 1;
    while (merged[target]) target = `media${n++}`;
    merged[target] = { ...item, id: target };
    if (target !== id) map.set(id, target);
  }
  if (map.size) remapMedia(shapes, map);
  return { media: Object.keys(merged).length === Object.keys(deck.media).length ? deck.media : merged, shapes };
}

export function hasClip(): boolean {
  return clip !== null;
}

/** Copie les formes selectionnees (ou les diapositives si `slides`). Renvoie le texte brut pour le presse-papiers du systeme. */
export function copySelection(ed: Editor, slides = false): string {
  if (slides || !ed.selection.ids.length) {
    const ids = ed.selectedSlides.length ? ed.selectedSlides : ed.slide ? [ed.slide.id] : [];
    const list = ed.deck.slides.filter((s) => ids.includes(s.id));
    const plain = list.map((s) => s.shapes.map(textOfShape).filter(Boolean).join('\n')).join('\n\n');
    clip = { kind: 'slides', slides: structuredClone(list), media: mediaOf(ed.deck, list.flatMap((s) => s.shapes)), plain };
    return plain;
  }
  const shapes = ed.selection.ids.map((id) => locate(ed.pageShapes, id)?.shape).filter((s): s is Shape => !!s);
  // Les espaces reserves copies gardent leur position effective et deviennent des formes libres.
  const copies = shapes.map((s) => {
    const eff = ed.ctx.resolve(s);
    const c = structuredClone(s.placeholder ? eff : s);
    delete c.placeholder;
    if (c.kind === 'shape' && s.placeholder) c.textBox = true;
    return c;
  });
  const plain = copies.map(textOfShape).filter(Boolean).join('\n');
  clip = { kind: 'shapes', shapes: copies, media: mediaOf(ed.deck, copies), plain, pastes: 0 };
  return plain;
}

export function cutSelection(ed: Editor, slides = false): string {
  const plain = copySelection(ed, slides);
  if (clip?.kind === 'slides') ed.deleteSlides(clip.slides.map((s) => s.id));
  else if (ed.selection.ids.length) {
    const ids = ed.selection.ids;
    ed.editShapes((shapes) => deleteShapes(shapes, ids), 'cut');
    ed.setSelection({ ids: [] });
  }
  return plain;
}

/** Colle le contenu interne. `plain` = texte du presse-papiers du systeme (s'il differe, on colle ce texte). */
export function pasteInternal(ed: Editor, plain: string | null, mode: 'keep' | 'text' | 'picture' = 'keep'): boolean {
  if (!clip) return false;
  if (plain !== null && plain.replace(/\r\n?/g, '\n') !== clip.plain.replace(/\r\n?/g, '\n') && plain.trim()) return false;
  if (mode === 'text') {
    insertTextBoxAtCenter(ed, clip.plain);
    return true;
  }
  if (clip.kind === 'slides') {
    const source = clip;
    let pos = ed.slideIndex + 1;
    let last = 0;
    const { media, shapes } = mergeMedia(ed.deck, source.media, source.slides.flatMap((s) => s.shapes));
    let offset = 0;
    const next = editDeck({ ...ed.deck, media }, (d) => {
      const copies = source.slides.map((s) => {
        const copy: Slide = { ...structuredClone(s), shapes: shapes.slice(offset, offset + s.shapes.length) };
        offset += s.shapes.length;
        copy.id = nextSlideId(d);
        if (!d.masters.some((m) => m.layouts.some((l) => l.id === copy.layoutId))) copy.layoutId = d.masters[0]?.layouts[0]?.id ?? copy.layoutId;
        d.slides.splice(pos++, 0, copy);
        last = copy.id;
        return copy;
      });
      const section = ed.slide && d.sections.find((s) => s.slideIds.includes(ed.slide?.id ?? -1));
      if (section && ed.slide) section.slideIds.splice(section.slideIds.indexOf(ed.slide.id) + 1, 0, ...copies.map((c) => c.id));
    });
    ed.commit(next, 'paste');
    if (last) ed.goto(last);
    return true;
  }
  const source = clip;
  source.pastes++;
  const { media, shapes } = mergeMedia(ed.deck, source.media, source.shapes);
  const sameSlide = ed.pageShapes.some((s) => source.shapes.some((c) => c.name === s.name));
  const shift = sameSlide ? 12 * source.pastes : 0;
  let created: number[] = [];
  if (media !== ed.deck.media) ed.commit({ ...ed.deck, media });
  ed.editShapes((list) => {
    created = insertCopies(list, shapes, { x: shift, y: shift });
  }, 'paste');
  ed.setSelection({ ids: created });
  return true;
}

/** Colle un evenement « paste » du systeme : images, puis contenu interne, puis texte. */
export async function pasteFromEvent(ed: Editor, data: DataTransfer | null, mode: 'keep' | 'text' | 'picture' = 'keep'): Promise<void> {
  const files = data ? Array.from(data.files) : [];
  const image = files.find((f) => f.type.startsWith('image/'));
  if (image && mode !== 'text') {
    await insertPictureBytes(ed, new Uint8Array(await image.arrayBuffer()), image.name || `image.${image.type.split('/')[1] ?? 'png'}`);
    return;
  }
  const plain = data?.getData('text/plain') ?? null;
  if (pasteInternal(ed, plain, mode)) return;
  if (plain?.trim()) insertTextBoxAtCenter(ed, plain.slice(0, 100_000));
}

/** Collage depuis le ruban : lecture du presse-papiers du systeme si autorisee, sinon contenu interne. */
export async function pasteFromRibbon(ed: Editor, mode: 'keep' | 'text' | 'picture' = 'keep'): Promise<void> {
  let plain: string | null = null;
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type && mode !== 'text') {
          const blob = await item.getType(type);
          await insertPictureBytes(ed, new Uint8Array(await blob.arrayBuffer()), `image.${type.split('/')[1] ?? 'png'}`);
          return;
        }
        if (item.types.includes('text/plain')) plain = await (await item.getType('text/plain')).text();
      }
    }
  } catch (err) {
    // Lecture refusee par le navigateur : on se rabat sur le contenu interne.
    if (!(err instanceof DOMException)) throw err;
  }
  if (pasteInternal(ed, plain, mode)) return;
  if (plain?.trim()) insertTextBoxAtCenter(ed, plain);
  else if (!clip) ed.notify(S.common.clipboardEmpty, 'info');
}

// ---- Reproduire la mise en forme ----

interface FormatClip {
  fill?: Fill;
  line?: Line;
  effects?: Effects;
  run?: RunProps;
}

let formatClip: FormatClip | null = null;

export function pickFormat(ed: Editor): boolean {
  const raw = ed.selectedShapes[0];
  if (!raw) return false;
  const shape = ed.ctx.resolve(raw);
  const run = shape.kind === 'shape' ? shape.text?.paragraphs[0]?.runs[0]?.props : undefined;
  formatClip = {
    fill: shape.kind === 'shape' ? shape.fill : undefined,
    line: 'line' in shape ? shape.line : undefined,
    effects: 'effects' in shape ? shape.effects : undefined,
    run: run ? { ...run, link: undefined } : undefined,
  };
  return true;
}

export function applyFormat(ed: Editor, ids: readonly number[]): void {
  const f = formatClip;
  if (!f) return;
  ed.editShapes((shapes) => {
    for (const item of flattenWithBoxes(shapes)) {
      if (!ids.includes(item.shape.id)) continue;
      const s = item.shape;
      if (s.kind === 'shape') {
        if (f.fill) s.fill = structuredClone(f.fill);
        if (f.line) s.line = structuredClone(f.line);
        if (f.effects) s.effects = structuredClone(f.effects);
        if (f.run && s.text) {
          const patch = Object.fromEntries(Object.entries(f.run).filter(([k]) => k !== 'lang' && k !== 'link'));
          applyRunProps(s.text, { start: { p: 0, o: 0 }, end: endPos(s.text) }, patch);
        }
      } else if (s.kind === 'picture' || s.kind === 'connector') {
        if (f.line) s.line = structuredClone(f.line);
        if (f.effects) s.effects = structuredClone(f.effects);
      }
    }
  }, 'painter');
}
