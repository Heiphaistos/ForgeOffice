// Actions sur les formes de la feuille : insertion depuis la galerie, modification du texte.
import type { CellAddress } from '@forgeoffice/xlsx';
import { newShape, shapeLabel, shapeName } from '../logic/shapes.ts';
import { S } from '../strings/index.ts';
import type { DocStore } from './store.ts';

/** Insere une forme (ou une zone de texte) sur `at` ; renvoie l'indice du dessin cree. */
export function insertShape(store: DocStore, si: number, at: CellAddress, geometry: string, textBox = false): number {
  let index = 0;
  store.commit((d) => {
    const sh = d.sheet(si);
    const name = shapeName(textBox ? S.shapes.textBox : shapeLabel(geometry), sh.drawings);
    index = sh.drawings.length;
    sh.drawings = [...sh.drawings, newShape(geometry, at, name, textBox)];
  });
  return index;
}

export function setShapeText(store: DocStore, si: number, index: number, text: string): void {
  store.commit((d) => {
    const sh = d.sheet(si);
    sh.drawings = sh.drawings.map((x, i) => (i === index && x.kind === 'shape' ? { ...x, text } : x));
  });
}
