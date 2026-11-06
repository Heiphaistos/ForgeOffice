// Bordures de la boite « Format de cellule » (sans DOM) : lecture de l'etat d'une selection et application d'un
// ensemble de modifications (bord par bord, bords interieurs, diagonales). Seuls les bords modifies sont touches.
import { MAX_COLS, MAX_ROWS, styleIdFor, type Border, type BorderEdge, type BorderStyle, type CellRange, type Sheet, type Workbook } from '@forgeoffice/xlsx';
import type { Draft } from './draft.ts';
import { cellFormat, restyle, styleAt } from './styles.ts';

export type BorderKey = 'top' | 'bottom' | 'left' | 'right' | 'innerH' | 'innerV' | 'diagUp' | 'diagDown';
export const BORDER_KEYS: readonly BorderKey[] = ['top', 'innerH', 'bottom', 'left', 'innerV', 'right', 'diagUp', 'diagDown'];

/** Valeur d'un bord : trait, null = aucun trait, absent = non modifie (ou, en lecture, differe d'une cellule a l'autre). */
export type BorderSpec = Partial<Record<BorderKey, BorderEdge | null>>;

/** Les 13 styles de trait d'Excel, dans l'ordre de la boite (colonne de gauche : Aucun puis les traits fins, colonne de droite : epais). */
export const BORDER_STYLES: readonly BorderStyle[] = [
  'hair', 'dotted', 'dashDotDot', 'dashDot', 'dashed', 'thin',
  'mediumDashDotDot', 'slantDashDot', 'mediumDashDot', 'mediumDashed', 'medium', 'double', 'thick',
];

const same = (a: BorderEdge | null | undefined, b: BorderEdge | null | undefined): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function borderAt(wb: Workbook, sh: Sheet, row: number, col: number): Border {
  return wb.styles.borders[cellFormat(wb, styleAt(sh, row, col)).borderId] ?? {};
}

/** Valeur commune d'une liste de bords, ou undefined si elle differe. */
function common(list: (BorderEdge | null)[]): BorderEdge | null | undefined {
  const first = list[0] ?? null;
  return list.every((e) => same(e, first)) ? first : undefined;
}

const MAX_SCAN = 20_000;

/** Etat des bords de la plage : bords exterieurs, interieurs et diagonales (undefined = valeurs differentes). */
export function readBorders(wb: Workbook, sh: Sheet, r: CellRange): BorderSpec {
  const clip = (a: number, b: number): number => Math.min(b, a + 999);
  const r2 = clip(r.r1, r.r2);
  const c2 = clip(r.c1, r.c2);
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = r.r1; i <= r2; i++) rows.push(i);
  for (let i = r.c1; i <= c2; i++) cols.push(i);
  if (rows.length * cols.length > MAX_SCAN) return {};
  const at = (row: number, col: number): Border => borderAt(wb, sh, row, col);
  const out: BorderSpec = {};
  const edge = (e: BorderEdge | undefined): BorderEdge | null => e ?? null;
  out.top = common(cols.map((c) => edge(at(r.r1, c).top)));
  out.bottom = common(cols.map((c) => edge(at(r.r2, c).bottom)));
  out.left = common(rows.map((row) => edge(at(row, r.c1).left)));
  out.right = common(rows.map((row) => edge(at(row, r.c2).right)));
  if (r.r2 > r.r1) out.innerH = common(rows.slice(1).flatMap((row) => cols.map((c) => edge(at(row, c).top))));
  if (r.c2 > r.c1) out.innerV = common(cols.slice(1).flatMap((c) => rows.map((row) => edge(at(row, c).left))));
  const all = rows.flatMap((row) => cols.map((c) => at(row, c)));
  const diag = (up: boolean): BorderEdge | null | undefined => common(all.map((b) => (up ? b.diagonalUp : b.diagonalDown) && b.diagonal ? b.diagonal : null));
  out.diagUp = diag(true);
  out.diagDown = diag(false);
  for (const k of BORDER_KEYS) if (out[k] === undefined) delete out[k];
  return out;
}

/** Bords visibles dans la boite : les modifications recouvrent l'etat lu. */
export function shownBorders(base: BorderSpec, edits: BorderSpec): BorderSpec {
  return { ...base, ...edits };
}

function withSide(b: Border, key: 'top' | 'bottom' | 'left' | 'right', e: BorderEdge | null | undefined): void {
  if (e === undefined) return;
  if (e === null) delete b[key];
  else b[key] = e;
}

/** Applique les modifications de bords a chaque plage ; les cellules voisines hors plage suivent pour le trait commun. */
export function applyBorderSpec(d: Draft, si: number, ranges: readonly CellRange[], spec: BorderSpec): void {
  if (BORDER_KEYS.every((k) => spec[k] === undefined)) return;
  for (const r of ranges) {
    restyle(d, si, [r], (s, row, col) => {
      const b: Border = { ...(d.wb.styles.borders[cellFormat(d.wb, s).borderId] ?? {}) };
      withSide(b, 'top', row === r.r1 ? spec.top : spec.innerH);
      withSide(b, 'bottom', row === r.r2 ? spec.bottom : spec.innerH);
      withSide(b, 'left', col === r.c1 ? spec.left : spec.innerV);
      withSide(b, 'right', col === r.c2 ? spec.right : spec.innerV);
      for (const [key, flag] of [['diagUp', 'diagonalUp'], ['diagDown', 'diagonalDown']] as const) {
        const e = spec[key];
        if (e === undefined) continue;
        if (e === null) delete b[flag];
        else {
          b.diagonal = e; // ponytail: un seul style de diagonale par cellule (modele xlsx), la derniere modification l'emporte
          b[flag] = true;
        }
      }
      if (!b.diagonalUp && !b.diagonalDown) {
        delete b.diagonal;
        delete b.diagonalUp;
        delete b.diagonalDown;
      }
      return styleIdFor(d.wb, { border: b }, s);
    });
    // Le trait commun avec la cellule voisine hors plage (son bord oppose) suit la modification.
    const strips: [CellRange, 'top' | 'bottom' | 'left' | 'right', BorderEdge | null | undefined][] = [];
    if (r.r1 > 0) strips.push([{ ...r, r1: r.r1 - 1, r2: r.r1 - 1 }, 'bottom', spec.top]);
    if (r.r2 < MAX_ROWS - 1) strips.push([{ ...r, r1: r.r2 + 1, r2: r.r2 + 1 }, 'top', spec.bottom]);
    if (r.c1 > 0) strips.push([{ ...r, c1: r.c1 - 1, c2: r.c1 - 1 }, 'right', spec.left]);
    if (r.c2 < MAX_COLS - 1) strips.push([{ ...r, c1: r.c2 + 1, c2: r.c2 + 1 }, 'left', spec.right]);
    for (const [strip, side, e] of strips) {
      if (e === undefined) continue;
      restyle(d, si, [strip], (s) => {
        const b: Border = { ...(d.wb.styles.borders[cellFormat(d.wb, s).borderId] ?? {}) };
        withSide(b, side, e);
        return styleIdFor(d.wb, { border: b }, s);
      });
    }
  }
}
