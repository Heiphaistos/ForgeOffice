// Plan (regroupement de lignes) : groupes par niveau, bouton +/- de la marge, boutons de niveau 1, 2, 3...
import type { RowInfo, Sheet } from '@forgeoffice/xlsx';
import { setColInfo } from './styles.ts';

export interface OutlineGroup {
  start: number;
  end: number;
  level: number;
  /** Ligne de synthese portant le bouton (sous le groupe, comme Excel par defaut). */
  summary: number;
  collapsed: boolean;
}

type Rows = Map<number, RowInfo>;

const levelOf = (rows: Rows, i: number): number => rows.get(i)?.outlineLevel ?? 0;

/** Groupes de lignes contigues de niveau >= L, pour chaque niveau L. */
export function rowGroups(rows: Rows): OutlineGroup[] {
  const lines = [...rows.entries()].filter(([, v]) => (v.outlineLevel ?? 0) > 0).map(([i]) => i).sort((a, b) => a - b);
  const max = lines.reduce((m, i) => Math.max(m, levelOf(rows, i)), 0);
  const out: OutlineGroup[] = [];
  for (let level = 1; level <= max; level++) {
    let start = -1;
    let prev = -2;
    const close = (): void => {
      if (start >= 0) out.push({ start, end: prev, level, summary: prev + 1, collapsed: rows.get(prev + 1)?.collapsed === true });
    };
    for (const i of lines) {
      if (levelOf(rows, i) < level) continue;
      if (i !== prev + 1) {
        close();
        start = i;
      }
      prev = i;
    }
    close();
  }
  return out.sort((a, b) => a.start - b.start || a.level - b.level);
}

export const maxLevel = (rows: Rows): number => [...rows.values()].reduce((m, v) => Math.max(m, v.outlineLevel ?? 0), 0);

const patch = (rows: Rows, i: number, p: Partial<RowInfo>): void => {
  rows.set(i, { ...rows.get(i), ...p });
};

/** Replie (masque) ou deplie le groupe ; les sous-groupes replies restent masques. Modifie `rows`. */
export function setGroupCollapsed(rows: Rows, g: OutlineGroup, collapse: boolean): void {
  const inner = rowGroups(rows).filter((x) => x.level > g.level && x.start >= g.start && x.end <= g.end && x.collapsed);
  for (let i = g.start; i <= g.end; i++) patch(rows, i, { hidden: collapse || inner.some((x) => i >= x.start && i <= x.end) });
  patch(rows, g.summary, { collapsed: collapse });
}

/** Bouton de niveau n (1 = tout replie) : les lignes de niveau >= n sont masquees, les autres affichees. */
export function showLevel(rows: Rows, n: number): void {
  for (const g of rowGroups(rows)) patch(rows, g.summary, { collapsed: g.level >= n });
  for (const [i, v] of [...rows.entries()]) {
    if ((v.outlineLevel ?? 0) > 0) patch(rows, i, { hidden: (v.outlineLevel ?? 0) >= n });
  }
}

// ---------------------------------------------------------------- Colonnes

type Cols = Sheet['cols'];
const COL_LIMIT = 2000;

/** Colonnes ayant un niveau de plan, une entree par colonne, pour reutiliser les fonctions des lignes. */
export function colsAsRows(cols: Cols): Rows {
  const m: Rows = new Map();
  for (const c of cols) {
    if (!c.outlineLevel && !c.collapsed) continue;
    for (let i = c.min; i <= Math.min(c.max, c.min + COL_LIMIT); i++) m.set(i, { ...(c.outlineLevel ? { outlineLevel: c.outlineLevel } : {}), ...(c.hidden ? { hidden: true } : {}), ...(c.collapsed ? { collapsed: true } : {}) });
  }
  return m;
}

/** Reporte l'etat masque/replie d'une table « colonnes vues comme lignes » dans la liste de colonnes (les plages sont scindees au besoin). */
export function writeColsBack(cols: Cols, m: Rows): void {
  for (const [i, v] of m) setColInfo(cols, i, { hidden: v.hidden === true, collapsed: v.collapsed === true });
}

// ---------------------------------------------------------------- Plan automatique

/**
 * Plan automatique des lignes : une ligne dont une formule fait la SOMME ou le SOUS.TOTAL d'une plage de lignes situee juste au-dessus
 * devient la ligne de synthese de ce groupe (niveau +1). Renvoie le nombre de groupes crees.
 */
export function autoOutlineRows(sheet: Pick<Sheet, 'cells' | 'rows'>): number {
  let created = 0;
  for (const [row, line] of [...sheet.cells.entries()].sort((a, b) => a[0] - b[0])) {
    const groups = new Set<string>();
    for (const cell of line.values()) {
      if (!cell.formula) continue;
      for (const m of cell.formula.matchAll(/(?:SUM|SUBTOTAL)\([^)]*?\$?[A-Z]{1,3}\$?(\d+):\$?[A-Z]{1,3}\$?(\d+)/g)) {
        const r1 = Number(m[1]) - 1;
        const r2 = Number(m[2]) - 1;
        if (r2 === row - 1 && r1 < r2) groups.add(`${r1}:${r2}`);
      }
    }
    for (const g of groups) {
      const [a, b] = g.split(':').map(Number) as [number, number];
      for (let i = a; i <= b; i++) {
        const info = sheet.rows.get(i);
        sheet.rows.set(i, { ...info, outlineLevel: Math.min(7, (info?.outlineLevel ?? 0) + 1) });
      }
      created++;
    }
  }
  return created;
}
