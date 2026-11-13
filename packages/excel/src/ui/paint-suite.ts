// Dessin de la grille a la maniere de LibreOffice Calc / OpenOffice Calc 4 (couleurs et traits releves sur les vraies fenetres) :
// en-tetes, coin, curseur de cellule, plage selectionnee, poignee de recopie. Appele par paint.ts seulement quand la palette porte `suite`.
import type { Viewport } from '../logic/viewport.ts';
import type { SuiteKind } from './suiteKind.ts';

export interface SuitePalette {
  suite: SuiteKind;
  /** Fond, trait, texte et selection des en-tetes ; couleur du curseur ; remplissage de plage. */
  hdr: string;
  corner: string;
  hdrTop: string;
  hdrLine: string;
  hdrText: string;
  hdrSel: string;
  hdrSelTop: string;
  hdrSelLine: string;
  hdrSelText: string;
  cursor: string;
  range: string;
  rangeLine: string;
}

type Ctx = CanvasRenderingContext2D;

/** Un en-tete (colonne si `horizontal`) : fond, filet de separation, libelle ; `state` = dans la selection. */
export function suiteBand(ctx: Ctx, P: SuitePalette, x: number, y: number, w: number, h: number, label: string, horizontal: boolean, selected: boolean, z: number): void {
  const oo = P.suite === 'openoffice';
  if (oo) {
    // OpenOffice : degrade a relief (clair en haut) ; la selection est un degrade bleu.
    const g = horizontal ? ctx.createLinearGradient(0, y, 0, y + h) : ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, selected ? P.hdrSelTop : P.hdrTop);
    g.addColorStop(selected ? 0.47 : 0, selected ? P.hdrSelTop : P.hdrTop);
    g.addColorStop(selected ? 0.53 : 1, selected ? P.hdrSel : P.hdr);
    g.addColorStop(1, selected ? P.hdrSel : P.hdr);
    ctx.fillStyle = g;
  } else ctx.fillStyle = selected ? P.hdrSel : P.hdr;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = selected ? P.hdrSelLine : P.hdrLine;
  if (horizontal) {
    ctx.fillRect(Math.round(x + w) - 1, y, 1, h);
    if (selected) ctx.fillRect(Math.round(x), y, 1, h);
  } else {
    ctx.fillRect(x, Math.round(y + h) - 1, w, 1);
    if (selected) ctx.fillRect(x, Math.round(y), w, 1);
  }
  ctx.font = `${selected ? '600 ' : ''}${(12 * z).toFixed(1)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = selected ? P.hdrSelText : P.hdrText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
}

/** Coin « Tout selectionner » et filets du pourtour des en-tetes. */
export function suiteCorner(ctx: Ctx, P: SuitePalette, v: Viewport): void {
  ctx.fillStyle = P.corner;
  ctx.fillRect(0, 0, v.headerW, v.headerH);
  ctx.fillStyle = P.hdrLine;
  ctx.fillRect(0, v.headerH - 1, v.width, 1);
  ctx.fillRect(v.headerW - 1, 0, 1, v.height);
  if (P.suite === 'openoffice') {
    // Relief OpenOffice : filet sombre au-dessus des en-tetes de colonnes et a gauche des en-tetes de lignes.
    ctx.fillRect(0, 0, v.width, 1);
    ctx.fillRect(0, 0, 1, v.height);
  }
}

/** Curseur de cellule. LibreOffice : 2 px bleus a cheval sur le quadrillage, poignee de 5 px a liseré blanc. OpenOffice : cadre noir de 2 px et poignee noire. */
export function suiteCursor(ctx: Ctx, P: SuitePalette, r: { x: number; y: number; w: number; h: number }, handle: { x: number; y: number; w: number; h: number } | null, inRange: boolean): void {
  const { x, y, w, h } = r;
  const oo = P.suite === 'openoffice';
  ctx.strokeStyle = P.cursor;
  ctx.lineWidth = 2;
  if (oo) ctx.strokeRect(Math.round(x), Math.round(y), Math.round(w) - 1, Math.round(h) - 1);
  else ctx.strokeRect(Math.round(x) - 1, Math.round(y) - 1, Math.round(w) + 1, Math.round(h) + 1);
  if (inRange && !oo) {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 2, Math.round(h) - 2);
  }
  if (handle) {
    const hx = Math.round(handle.x + handle.w) - (oo ? 2 : 3);
    const hy = Math.round(handle.y + handle.h) - (oo ? 2 : 3);
    if (!oo) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(hx - 1, hy - 1, 7, 7);
    }
    ctx.fillStyle = P.cursor;
    ctx.fillRect(hx, hy, 5, 5);
  }
}

/** Plage : voile bleu translucide (le quadrillage dessous prend la teinte) et filet exterieur de 1 px ; */
export function suiteRange(ctx: Ctx, P: SuitePalette, r: { x: number; y: number; w: number; h: number }): void {
  const oo = P.suite === 'openoffice';
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = P.range;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = P.rangeLine;
  ctx.lineWidth = 1;
  if (oo) ctx.strokeRect(Math.round(r.x) - 0.5, Math.round(r.y) - 0.5, Math.round(r.w), Math.round(r.h));
  else ctx.strokeRect(Math.round(r.x) - 1.5, Math.round(r.y) - 1.5, Math.round(r.w) + 2, Math.round(r.h) + 2);
}
