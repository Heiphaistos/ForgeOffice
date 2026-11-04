// Publication = presentation sans espaces reserves : pages (diapositives), pages maitres (dispositions du masque).
import { addSlide, createBlankDeck, duplicateSlide, moveSlide, nextSlideId, removeSlide, type Deck, type Layout, type Slide, type SlideSize } from '@forgeoffice/pptx';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const masterName = (index: number): string => `Page maître ${LETTERS[index % 26] ?? 'A'}`;

export function masterLayout(index: number): Layout {
  return { id: `pm${index + 1}`, name: masterName(index), type: 'blank', shapes: [], showMasterShapes: true };
}

/** Publication vierge : masque sans espaces reserves, une page maitre, `pages` pages. */
export function createPublication(size: SlideSize, pages = 1): Deck {
  const deck = createBlankDeck({ ...size, type: 'custom' }, { titleSlide: false });
  const master = deck.masters[0];
  if (master) {
    master.shapes = [];
    master.name = 'Publication';
    master.layouts = [masterLayout(0)];
  }
  deck.properties.application = 'ForgeOffice Publication';
  for (let i = 0; i < pages; i++) addSlide(deck, 'pm1');
  return deck;
}

export const masterPages = (deck: Deck): Layout[] => deck.masters[0]?.layouts ?? [];

/** Ajoute des pages (brouillon modifie) apres l'indice donne ; renvoie les nouvelles pages. */
export function insertPages(deck: Deck, after: number, count: number, layoutId?: string): Slide[] {
  const layout = layoutId ?? deck.slides[after]?.layoutId ?? masterPages(deck)[0]?.id ?? 'pm1';
  const out: Slide[] = [];
  for (let i = 0; i < count; i++) out.push(addSlide(deck, layout, after + 1 + i));
  return out;
}

export function duplicatePage(deck: Deck, slideId: number): Slide | undefined {
  return duplicateSlide(deck, slideId);
}

export function deletePages(deck: Deck, ids: readonly number[]): void {
  if (ids.length >= deck.slides.length) return;
  for (const id of ids) removeSlide(deck, id);
}

export function movePage(deck: Deck, slideId: number, toIndex: number): void {
  moveSlide(deck, slideId, toIndex);
}

/** Nouvelle page maitre (copie de la page maitre `from` si donnee). */
export function addMasterPage(deck: Deck, from?: string): Layout | undefined {
  const master = deck.masters[0];
  if (!master) return undefined;
  const index = master.layouts.length;
  const layout = masterLayout(index);
  let n = index + 1;
  while (master.layouts.some((l) => l.id === layout.id)) layout.id = `pm${++n}`;
  const source = master.layouts.find((l) => l.id === from);
  if (source) {
    layout.shapes = structuredClone(source.shapes);
    if (source.background) layout.background = structuredClone(source.background);
  }
  master.layouts.push(layout);
  return layout;
}

/** Supprime une page maitre ; ses pages passent sur la premiere page maitre restante. */
export function removeMasterPage(deck: Deck, layoutId: string): boolean {
  const master = deck.masters[0];
  if (!master || master.layouts.length < 2) return false;
  master.layouts = master.layouts.filter((l) => l.id !== layoutId);
  const fallback = master.layouts[0]?.id ?? 'pm1';
  for (const s of deck.slides) if (s.layoutId === layoutId) s.layoutId = fallback;
  return true;
}

export { nextSlideId };
