// Masques et dispositions : insertion d'espaces réservés (contenu, texte, image, graphique, tableau, média, SmartArt), conservation.
import type { AutoShape, PlaceholderType, Shape, SlideSize } from '@forgeoffice/pptx';
import { locate } from '../canvas/ops.ts';
import { editMasters } from './deck-ops.ts';
import type { Editor } from './editor.ts';
import { S3 } from './strings-text.ts';

export type PlaceholderKind = Extract<PlaceholderType, 'obj' | 'body' | 'pic' | 'chart' | 'tbl' | 'media' | 'dgm'>;
export const PLACEHOLDER_KINDS: readonly PlaceholderKind[] = ['obj', 'body', 'pic', 'chart', 'tbl', 'dgm', 'media'];

/** Premier indice libre (les indices 10 a 12 restent aux pieds de page ; on part de 13). */
export function nextPlaceholderIndex(shapes: readonly Shape[]): number {
  const used = shapes.map((s) => s.placeholder?.index ?? 0);
  return Math.max(12, ...used) + 1;
}

/** Nouvel espace réservé de la disposition, au centre de la diapositive. */
export function newPlaceholder(kind: PlaceholderKind, id: number, index: number, size: SlideSize, count: number): AutoShape {
  const width = Math.round(size.width * 0.5);
  const height = Math.round(size.height * 0.4);
  const label = S3.master.kinds[kind];
  return {
    kind: 'shape',
    id,
    name: `${label} ${count + 1}`,
    placeholder: { type: kind, index },
    locks: { noGrp: true },
    geometry: { type: 'preset', preset: 'rect' },
    xfrm: { x: Math.round((size.width - width) / 2), y: Math.round((size.height - height) / 2), width, height },
    text: { props: {}, paragraphs: [{ props: {}, runs: [{ type: 'text', text: S3.master.prompts[kind], props: {} }] }] },
  };
}

/** Espaces réservés d'une page de masque/disposition (hors titre et pieds de page) : leur nombre numérote le nom. */
const countOf = (shapes: readonly Shape[], kind: PlaceholderKind): number => shapes.filter((s) => s.placeholder?.type === kind).length;

export function insertPlaceholder(ed: Editor, kind: PlaceholderKind): void {
  let newId = 0;
  ed.editShapes((shapes) => {
    newId = Math.max(0, ...shapes.map((s) => s.id)) + 1;
    shapes.push(newPlaceholder(kind, newId, nextPlaceholderIndex(shapes), ed.deck.size, countOf(shapes, kind)));
  }, 'placeholder');
  if (newId) ed.setSelection({ ids: [newId] });
}

/** Renomme l'espace reserve selectionne. */
export function renameSelectedShape(ed: Editor, name: string): void {
  const id = ed.selection.ids[0];
  if (id === undefined || !name.trim()) return;
  ed.editShapes((shapes) => {
    const found = locate(shapes, id);
    if (found) found.shape.name = name.trim();
  }, 'rename-shape');
}

/** Conserver la disposition meme quand aucune diapositive ne l'utilise. */
export function setPreserve(ed: Editor, masterIndex: number, layoutId: string, on: boolean): void {
  ed.commit(editMasters(ed.deck, (masters) => {
    const l = masters[masterIndex]?.layouts.find((x) => x.id === layoutId);
    if (l) l.preserve = on || undefined;
  }));
}
