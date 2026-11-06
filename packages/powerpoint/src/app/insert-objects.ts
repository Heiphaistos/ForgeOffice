// Insertion d'equations (SVG + repli PNG, saisie conservee) et de SmartArt simples.
import { addMedia, addPicture, nextShapeId, type Deck, type Picture, type Shape, type Slide } from '@forgeoffice/pptx';
import { locate } from '../canvas/ops.ts';
import { editPage } from './deck-ops.ts';
import type { Editor } from './editor.ts';
import { renderEquation, type TextMeasure } from './equation.ts';
import { placeShape, targetFrame } from './insert.ts';
import { buildSmartArt, readSmartArt, SMARTART_NAME, type SmartArtItem, type SmartArtKind } from './smartart.ts';

export const EQUATION_NAME = 'Équation';

/** Mesure du texte d'une equation avec le canvas 2D du navigateur. */
export function canvasEquationMeasure(): TextMeasure {
  const g = document.createElement('canvas').getContext('2d');
  return (text, size, italic, bold) => {
    if (!g) return text.length * size * 0.55;
    g.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px "Cambria Math","STIX Two Math","Times New Roman",serif`;
    return g.measureText(text).width;
  };
}

async function svgToPng(svg: string, width: number, height: number, scale: number): Promise<Uint8Array> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG impossible');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Equation selectionnee (image nommee « Équation » dont la description est la saisie). */
export function selectedEquation(ed: Editor): Picture | undefined {
  return ed.selectedShapes.find((s): s is Picture => s.kind === 'picture' && s.name.startsWith(EQUATION_NAME) && !!s.description);
}

/** Insere une equation, ou remplace celle qui est selectionnee (`replace`). Leve EquationError si la saisie est invalide. */
export async function insertEquation(ed: Editor, source: string, size: number, replace?: Picture): Promise<void> {
  const eq = renderEquation(source, { size, measure: canvasEquationMeasure() });
  const png = await svgToPng(eq.svg, eq.width, eq.height, 3);
  const svgBytes = new TextEncoder().encode(eq.svg);
  if (replace) {
    const deck = { ...ed.deck, media: { ...ed.deck.media } };
    const pngId = addMedia(deck, png, 'png');
    const svgId = addMedia(deck, svgBytes, 'svg', 'image/svg+xml');
    const next = editPage(deck, ed.page, (shapes) => {
      const found = locate(shapes, replace.id);
      if (found?.shape.kind !== 'picture' || !found.shape.xfrm) return;
      const old = found.shape.xfrm;
      found.shape.mediaId = pngId;
      found.shape.svgMediaId = svgId;
      found.shape.description = source;
      found.shape.xfrm = { ...old, x: old.x + (old.width - eq.width) / 2, y: old.y + (old.height - eq.height) / 2, width: eq.width, height: eq.height };
    });
    ed.commit({ ...next, media: deck.media }, 'equation');
    return;
  }
  const frame = targetFrame(ed, eq.width, eq.height);
  placeShape(
    ed,
    (holder, deck) => {
      const pic = addPicture(deck, holder, png, 'png', { ...frame.xfrm, width: eq.width, height: eq.height, x: frame.xfrm.x + (frame.xfrm.width - eq.width) / 2, y: frame.xfrm.y + (frame.xfrm.height - eq.height) / 2 }, source);
      pic.svgMediaId = addMedia(deck, svgBytes, 'svg', 'image/svg+xml');
      pic.name = `${EQUATION_NAME} ${pic.id - 1}`;
      return pic;
    },
    frame.replace,
  );
}

/** SmartArt selectionne (groupe cree par `insertSmartArt`). */
export function selectedSmartArt(ed: Editor): { shape: Shape; kind: SmartArtKind; items: SmartArtItem[] } | undefined {
  for (const s of ed.selectedShapes) {
    const read = readSmartArt(s);
    if (read) return { shape: s, ...read };
  }
  return undefined;
}

/** Insere un SmartArt au centre de la diapositive, ou regenere celui qui est selectionne (meme emplacement). */
export function insertSmartArt(ed: Editor, kind: SmartArtKind, items: readonly SmartArtItem[], replace?: Shape): void {
  const page = ed.deck.size;
  const area = replace?.xfrm ? { ...replace.xfrm, rotation: undefined } : { x: page.width * 0.1, y: page.height * 0.22, width: page.width * 0.8, height: page.height * 0.62 };
  let created = 0;
  ed.editShapes((shapes) => {
    const holder = { shapes } as Slide;
    const id = nextShapeId(holder.shapes);
    const group = buildSmartArt(kind, items, { x: area.x, y: area.y, width: area.width, height: area.height }, id);
    created = group.id;
    if (replace) {
      const found = locate(shapes, replace.id);
      if (found) {
        found.list.splice(found.index, 1, group);
        return;
      }
    }
    shapes.push(group);
  }, 'insert');
  ed.setSelection({ ids: [created], text: null });
}

export { SMARTART_NAME };
export type { Deck };
