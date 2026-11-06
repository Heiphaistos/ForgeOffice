// Commandes du Tableur (ruban, menus contextuels, raccourcis) : toutes passent par DocStore.commit
// pour etre annulables. Le contexte fournit l'etat d'interface courant (feuille, selection, services).
import type { NoticeKind, Services } from '@forgeoffice/core';
import { formatValue, type Scalar } from '@forgeoffice/formulas';
import { nextFontSize } from '@forgeoffice/ui';
import {
  MAX_COLS, MAX_ROWS, columnName, parseRange, usedRange, type CellRange, type Hyperlink, type CfRule, type SheetProtection, type ConditionalFormat, type DifferentialFormat, type Font,
  type HorizontalAlignment, type IconSetName, type Sheet, type VerticalAlignment, type Workbook,
} from '@forgeoffice/xlsx';
import { clearRanges, type ClearWhat } from '../logic/cells.ts';
import { captureRange, type ClipData } from '../logic/clipboard.ts';
import { applyAutoFilter, currentRegion, guessHeader, sortRange } from '../logic/data.ts';
import { fillDirection } from '../logic/fill.ts';
import { activeRange, clipRange, rangeSelection, type Selection } from '../logic/selection.ts';
import { shiftStructure, setColumnWidths, setRowHeights } from '../logic/structure.ts';
import {
  applyBorders, applyPatch, CELL_STYLE_PRESETS, fontOf, mergeCells, numFmtOf, restyle, patchStyleId, styleAt, type BorderPreset, type MergeMode,
} from '../logic/styles.ts';
import { makeTable } from '../logic/tables.ts';
import { pxToColWidth, pxToRowHeight } from '../logic/geometry.ts';
import type { DialogState } from './registry.ts';
import type { DocStore } from './store.ts';
import { S } from '../strings/index.ts';

export type { DialogState } from './registry.ts';

/** Actions que la protection d'une feuille peut autoriser (cases « Autoriser tous les utilisateurs de cette feuille a »). */
export type AllowKey = keyof SheetProtection['allow'];

export interface Ctx {
  store: DocStore;
  services: Services;
  si: number;
  sheet: Sheet;
  sel: Selection;
  setSel: (s: Selection) => void;
  value: (row: number, col: number) => Scalar;
  display: (row: number, col: number) => string;
  open: (d: DialogState) => void;
  notify: (message: string, kind?: NoticeKind) => void;
  clip: ClipData | null;
  setClip: (c: ClipData | null) => void;
  /** Annule l'operation si la feuille protegee l'interdit (message affiche). */
  guard: (need?: AllowKey) => boolean;
  /** Apres un changement de format de nombre : elargit les colonnes de largeur standard (comme Excel). */
  widen?: () => void;
}

const RGB = (hex: string | null): string | undefined => (hex ? `FF${hex.replace('#', '').toUpperCase()}` : undefined);

export function makeCommands(c: Ctx) {
  const { store, si } = c;
  const ranges = (): CellRange[] => [...c.sel.ranges];
  const wb = (): Workbook => store.wb;
  /** `need` : action que la protection de la feuille peut autoriser (liste « Autoriser tous les utilisateurs a »). */
  const commit = (fn: Parameters<DocStore['commit']>[0], group: string | null = null, need?: AllowKey): boolean => (c.guard(need) ? store.commit(fn, group) : false);
  const fmtCommit = (fn: Parameters<DocStore['commit']>[0], group: string | null = null): boolean => commit(fn, group, 'formatCells');
  const activeStyle = (): number => styleAt(c.sheet, c.sel.active.row, c.sel.active.col);
  const activeFont = (): Font => fontOf(wb(), activeStyle());
  const used = (): CellRange | undefined => usedRange(c.sheet);
  /** Plage de donnees pour tri/filtre/tableau : la selection, ou la zone courante si une seule cellule. */
  const dataRange = (): CellRange => {
    const r = activeRange(c.sel);
    if (r.r1 === r.r2 && r.c1 === r.c2) return currentRegion(c.sheet, r.r1, r.c1);
    return clipRange(r, used()) ?? r;
  };

  const font = (patch: Partial<Font>): void => {
    commit((d) => applyPatch(d, si, ranges(), { font: patch }));
  };

  const cmd = {
    activeFont,
    activeStyle,
    dataRange,
    // ------------------------------------------------ Presse-papiers
    copy(cut = false): void {
      if (c.sel.ranges.length > 1) {
        c.notify(S.cannotMultiple, 'warning');
        return;
      }
      const r = clipRange(activeRange(c.sel), used()) ?? activeRange(c.sel);
      c.setClip(captureRange(wb(), si, r, cut));
    },
    // ------------------------------------------------ Police
    fontName: (name: string): void => font({ name }),
    fontSize: (size: number): void => font({ size }),
    growFont: (dir: 1 | -1): void => font({ size: nextFontSize(activeFont().size, dir) }),
    bold: (): void => font({ bold: !activeFont().bold }),
    italic: (): void => font({ italic: !activeFont().italic }),
    underline: (kind: 'single' | 'double' = 'single'): void => {
      const cur = activeFont().underline;
      fmtCommit((d) => restyle(d, si, ranges(), (s) => {
        const f = fontOf(d.wb, s);
        const next = { ...f };
        if (cur === kind) delete next.underline;
        else next.underline = kind;
        return patchStyleId(d.wb, s, { font: next });
      }));
    },
    strike: (): void => font({ strike: !activeFont().strike }),
    fontColor: (hex: string | null): void => font({ color: hex ? { rgb: RGB(hex) } : { theme: 1 } }),
    fillColor: (hex: string | null): void => {
      fmtCommit((d) => applyPatch(d, si, ranges(), { fill: hex ? { type: 'pattern', pattern: 'solid', fg: { rgb: RGB(hex) } } : null }));
    },
    borders: (preset: BorderPreset, hex = '000000'): void => {
      fmtCommit((d) => applyBorders(d, si, ranges(), preset, hex.replace('#', '')));
    },
    clearFormatting: (): void => {
      fmtCommit((d) => clearRanges(d, si, ranges(), 'formats'));
    },
    // ------------------------------------------------ Alignement
    align: (horizontal: HorizontalAlignment): void => {
      const cur = wb().styles.cellXfs[activeStyle()]?.alignment?.horizontal;
      fmtCommit((d) => applyPatch(d, si, ranges(), { alignment: { horizontal: cur === horizontal ? 'general' : horizontal } }));
    },
    valign: (vertical: VerticalAlignment): void => {
      fmtCommit((d) => applyPatch(d, si, ranges(), { alignment: { vertical } }));
    },
    wrap: (): void => {
      const cur = !!wb().styles.cellXfs[activeStyle()]?.alignment?.wrapText;
      fmtCommit((d) => applyPatch(d, si, ranges(), { alignment: { wrapText: !cur } }));
    },
    indent: (dir: 1 | -1): void => {
      const cur = wb().styles.cellXfs[activeStyle()]?.alignment?.indent ?? 0;
      const next = Math.max(0, Math.min(15, cur + dir));
      fmtCommit((d) => applyPatch(d, si, ranges(), { alignment: { indent: next, horizontal: next ? 'left' : 'general' } }));
    },
    rotate: (deg: number): void => {
      fmtCommit((d) => applyPatch(d, si, ranges(), { alignment: { textRotation: deg } }));
    },
    merge: (mode: MergeMode): void => {
      let lost = false;
      fmtCommit((d) => {
        lost = mergeCells(d, si, ranges(), mode);
      });
      if (lost) c.notify(S.mergeLoss, 'warning');
    },
    // ------------------------------------------------ Nombres
    numberFormat: (code: string): void => {
      if (fmtCommit((d) => applyPatch(d, si, ranges(), { numberFormat: code }))) c.widen?.();
    },
    decimals: (dir: 1 | -1): void => {
      const code = numFmtOf(wb(), activeStyle());
      if (fmtCommit((d) => applyPatch(d, si, ranges(), { numberFormat: shiftDecimals(code, dir, c.value(c.sel.active.row, c.sel.active.col)) }))) c.widen?.();
    },
    cellStyle: (id: string): void => {
      const preset = CELL_STYLE_PRESETS.find((p) => p.id === id);
      if (preset && fmtCommit((d) => applyPatch(d, si, ranges(), preset.patch))) c.widen?.();
    },
    // ------------------------------------------------ Cellules
    insert: (what: 'rows' | 'cols' | 'cellsDown' | 'cellsRight'): void => {
      const r = activeRange(c.sel);
      commit((d) => {
        if (what === 'rows' || (what === 'cellsDown' && r.c1 === 0 && r.c2 === MAX_COLS - 1)) shiftStructure(d, si, 'row', r.r1, r.r2 - r.r1 + 1);
        else if (what === 'cols' || (what === 'cellsRight' && r.r1 === 0 && r.r2 === MAX_ROWS - 1)) shiftStructure(d, si, 'col', r.c1, r.c2 - r.c1 + 1);
        else shiftCells(d, si, r, what === 'cellsDown' ? 'down' : 'right', 1);
      }, null, what === 'rows' || what === 'cellsDown' ? 'insertRows' : 'insertColumns');
    },
    remove: (what: 'rows' | 'cols' | 'cellsUp' | 'cellsLeft'): void => {
      const r = activeRange(c.sel);
      commit((d) => {
        if (what === 'rows') shiftStructure(d, si, 'row', r.r1, -(r.r2 - r.r1 + 1));
        else if (what === 'cols') shiftStructure(d, si, 'col', r.c1, -(r.c2 - r.c1 + 1));
        else shiftCells(d, si, r, what === 'cellsUp' ? 'down' : 'right', -1);
      }, null, what === 'rows' || what === 'cellsUp' ? 'deleteRows' : 'deleteColumns');
    },
    hide: (axis: 'row' | 'col', hidden: boolean): void => {
      commit((d) => {
        for (const r of ranges()) {
          if (axis === 'col') setColumnWidths(d, si, r.c1, r.c2, undefined, hidden);
          else setRowHeights(d, si, r.r1, hidden ? r.r2 : Math.min(r.r2, Math.max(r.r1, (used()?.r2 ?? r.r1) + 1000)), undefined, hidden);
        }
      }, null, axis === 'col' ? 'formatColumns' : 'formatRows');
    },
    resize: (axis: 'row' | 'col', first: number, last: number, px: number): void => {
      commit((d) => {
        if (axis === 'col') setColumnWidths(d, si, first, last, pxToColWidth(px), px === 0 ? true : undefined);
        else setRowHeights(d, si, first, last, pxToRowHeight(px), px === 0 ? true : undefined);
      }, `resize-${axis}-${first}`, axis === 'col' ? 'formatColumns' : 'formatRows');
    },
    clear: (what: ClearWhat): void => {
      commit((d) => clearRanges(d, si, ranges(), what));
    },
    fill: (dir: 'down' | 'right' | 'up' | 'left'): void => {
      commit((d) => {
        for (const r of ranges()) fillDirection(d, si, r, dir);
      });
    },
    // ------------------------------------------------ Somme automatique
    autoSum: (fn: 'SUM' | 'AVERAGE' | 'COUNT' | 'MAX' | 'MIN'): void => {
      const r = activeRange(c.sel);
      commit((d) => {
        if (r.r1 === r.r2 && r.c1 === r.c2) {
          const target = autoSumSource(c.sheet, r.r1, r.c1);
          if (!target) return false;
          d.set(si, r.r1, r.c1, { value: null, formula: `${fn}(${target})`, ...(c.sheet.cells.get(r.r1)?.get(r.c1)?.styleId ? { styleId: c.sheet.cells.get(r.r1)?.get(r.c1)?.styleId } : {}) });
          return true;
        }
        // Plage : total sous chaque colonne (ou a droite si une seule colonne remplie).
        const below = r.r2 + 1;
        for (let col = r.c1; col <= r.c2; col++) d.set(si, below, col, { value: null, formula: `${fn}(${columnName(col)}${r.r1 + 1}:${columnName(col)}${r.r2 + 1})` });
        return true;
      });
    },
    // ------------------------------------------------ Tri et filtre
    sortQuick: (descending: boolean): void => {
      const r = dataRange();
      const header = guessHeader(r, c.value);
      commit((d) => sortRange(d, si, r, [{ index: c.sel.active.col, descending }], header, c.value), null, 'sort');
    },
    toggleFilter: (): void => {
      commit((d) => {
        const sh = d.sheet(si);
        if (sh.autoFilter) {
          for (let row = sh.autoFilter.ref.r1; row <= sh.autoFilter.ref.r2; row++) {
            const info = sh.rows.get(row);
            if (info?.hidden) {
              const next = { ...info };
              delete next.hidden;
              sh.rows.set(row, next);
            }
          }
          delete sh.autoFilter;
        } else sh.autoFilter = { ref: dataRange(), columns: [] };
      });
    },
    clearFilters: (): void => {
      commit((d) => {
        const sh = d.sheet(si);
        if (!sh.autoFilter) return false;
        sh.autoFilter = { ...sh.autoFilter, columns: [] };
        applyAutoFilter(d, si, sh.autoFilter, c.value, c.display);
        return true;
      }, null, 'autoFilter');
    },
    reapplyFilter: (): void => {
      commit((d) => applyAutoFilter(d, si, d.sheet(si).autoFilter, c.value, c.display), null, 'autoFilter');
    },
    // ------------------------------------------------ Liens hypertexte
    linkAt: (): Hyperlink | undefined => {
      const a = c.sel.active;
      return c.sheet.hyperlinks.find((h) => a.row >= h.ref.r1 && a.row <= h.ref.r2 && a.col >= h.ref.c1 && a.col <= h.ref.c2);
    },
    /** Suit le lien de la cellule active : adresse web ou e-mail dans le navigateur, destination interne dans la feuille. */
    openLink: (): void => {
      const h = cmd.linkAt();
      if (!h) return;
      if (h.target) {
        if (/^(https?|mailto|tel):/i.test(h.target)) window.open(h.target, '_blank', 'noopener,noreferrer');
        else c.notify(S.linkBlocked, 'error');
      } else if (h.location) {
        const m = h.location.replace(/\$/g, '').match(/^(?:'?([^'!]+)'?!)?([A-Za-z]{1,3}\d+(?::[A-Za-z]{1,3}\d+)?)$/);
        const range = m?.[2] ? parseRange(m[2].toUpperCase()) : undefined;
        if (range && (!m?.[1] || m[1] === c.sheet.name)) c.setSel(rangeSelection(range));
        else c.notify(S.invalidRef, 'info');
      }
    },
    removeLink: (): void => {
      const h = cmd.linkAt();
      if (h) commit((d) => { const s = d.sheet(si); s.hyperlinks = s.hyperlinks.filter((x) => x.ref !== h.ref && x !== h); });
    },
    // ------------------------------------------------ Tableaux
    formatAsTable: (style: string, opts?: { range?: CellRange; header?: boolean }): void => {
      const r = opts?.range ?? dataRange();
      const header = opts?.header ?? (guessHeader(r, c.value) || typeof c.value(r.r1, r.c1) === 'string');
      commit((d) => {
        const sh = d.sheet(si);
        if (sh.tables.some((t) => !(t.ref.r2 < r.r1 || t.ref.r1 > r.r2 || t.ref.c2 < r.c1 || t.ref.c1 > r.c2))) return false;
        let range = r;
        if (!header) {
          shiftCells(d, si, { ...r, r2: r.r2 }, 'down', 1);
          range = { ...r, r2: r.r2 + 1 };
        }
        const t = makeTable(d.wb, range, true, style, header ? c.value : () => null, S.column);
        if (!header) t.columns.forEach((col, i) => d.set(si, range.r1, range.c1 + i, { value: col.name }));
        sh.tables = [...sh.tables, t];
        if (sh.autoFilter && !(sh.autoFilter.ref.r2 < r.r1 || sh.autoFilter.ref.r1 > r.r2)) delete sh.autoFilter;
        return true;
      });
      c.setSel(rangeSelection(r, c.sel.active));
    },
    // ------------------------------------------------ Mise en forme conditionnelle
    addCf: (rule: Omit<CfRule, 'priority'>, dxf?: DifferentialFormat): void => {
      commit((d) => {
        const sh = d.sheet(si);
        const dxfId = dxf ? d.wb.styles.dxfs.push(dxf) - 1 : undefined;
        // Comme Excel : une nouvelle regle est la plus prioritaire (1), les autres descendent d'un cran.
        for (const f of sh.conditionalFormats) for (const x of f.rules) x.priority += 1;
        const cf: ConditionalFormat = { ranges: ranges(), rules: [{ ...rule, priority: 1, ...(dxfId !== undefined ? { dxfId } : {}) }] };
        sh.conditionalFormats = [...sh.conditionalFormats, cf];
      });
    },
    clearCf: (scope: 'selection' | 'sheet'): void => {
      commit((d) => {
        const sh = d.sheet(si);
        if (scope === 'sheet') sh.conditionalFormats = [];
        else {
          const sel = ranges();
          sh.conditionalFormats = sh.conditionalFormats.filter((f) => !f.ranges.some((r) => sel.some((s) => !(s.r2 < r.r1 || s.r1 > r.r2 || s.c2 < r.c1 || s.c1 > r.c2))));
        }
      });
    },
    dataBar: (hex: string, gradient: boolean): void => {
      cmd.addCf({ type: 'dataBar', dataBar: { cfvos: [{ type: 'min' }, { type: 'max' }], color: { rgb: RGB(hex) }, gradient } });
    },
    colorScale: (colors: readonly string[]): void => {
      const cfvos = colors.length === 3
        ? [{ type: 'min' as const }, { type: 'percentile' as const, value: '50' }, { type: 'max' as const }]
        : [{ type: 'min' as const }, { type: 'max' as const }];
      cmd.addCf({ type: 'colorScale', colorScale: { cfvos, colors: colors.map((h) => ({ rgb: RGB(h) })) } });
    },
    iconSet: (set: IconSetName): void => {
      const n = Number(set.charAt(0)) || 3;
      const cfvos = Array.from({ length: n }, (_, i) => (i === 0 ? { type: 'percent' as const, value: '0' } : { type: 'percent' as const, value: String(Math.round((i * 100) / n)) }));
      cmd.addCf({ type: 'iconSet', iconSet: { iconSet: set, cfvos } });
    },
    // ------------------------------------------------ Affichage
    view: (patch: Partial<Sheet['view']>): void => {
      store.commit((d) => {
        const sh = d.sheet(si);
        sh.view = { ...sh.view, ...patch };
      });
    },
    freeze: (mode: 'panes' | 'row' | 'col' | 'none'): void => {
      const a = c.sel.active;
      const frozen = mode === 'none' ? undefined : mode === 'row' ? { rows: 1, cols: 0 } : mode === 'col' ? { rows: 0, cols: 1 } : { rows: a.row, cols: a.col };
      store.commit((d) => {
        const sh = d.sheet(si);
        const view = { ...sh.view };
        if (frozen && (frozen.rows || frozen.cols)) view.frozen = frozen;
        else delete view.frozen;
        sh.view = view;
      });
    },
    pageSetup: (patch: Partial<Sheet['pageSetup']>): void => {
      store.commit((d) => {
        const sh = d.sheet(si);
        sh.pageSetup = { ...sh.pageSetup, ...patch };
      });
    },
    // ------------------------------------------------ Feuilles
    sheetState: (index: number, state: Sheet['state']): void => {
      if (wb().protection?.lockStructure) {
        c.notify(S.protectedBook, 'warning');
        return;
      }
      store.commit((d) => {
        const sh = d.sheet(index);
        sh.state = state;
      });
    },
  };
  return cmd;
}

export type Commands = ReturnType<typeof makeCommands>;

/** Decale les cellules d'une plage vers le bas/la droite (insertion) ou vers le haut/la gauche (suppression). */
function shiftCells(d: Parameters<Parameters<DocStore['commit']>[0]>[0], si: number, r: CellRange, dir: 'down' | 'right', sign: 1 | -1): void {
  const sh = d.wb.sheets[si];
  if (!sh) return;
  const n = dir === 'down' ? r.r2 - r.r1 + 1 : r.c2 - r.c1 + 1;
  const lastRow = Math.max(r.r2, ...[...sh.cells.keys()]);
  if (dir === 'down') {
    const order = sign > 0 ? range(lastRow, r.r1, -1) : range(r.r1, lastRow, 1);
    for (const row of order) {
      for (let col = r.c1; col <= r.c2; col++) {
        const src = sign > 0 ? row : row + n;
        const dst = sign > 0 ? row + n : row;
        d.set(si, dst, col, sh.cells.get(src)?.get(col));
        if (sign > 0 && row < r.r1 + n) d.set(si, row, col, undefined);
      }
    }
  } else {
    const lastCol = Math.max(r.c2, ...[...sh.cells.values()].flatMap((l) => [...l.keys()]));
    for (let row = r.r1; row <= r.r2; row++) {
      const order = sign > 0 ? range(lastCol, r.c1, -1) : range(r.c1, lastCol, 1);
      for (const col of order) {
        const src = sign > 0 ? col : col + n;
        const dst = sign > 0 ? col + n : col;
        d.set(si, row, dst, sh.cells.get(row)?.get(src));
        if (sign > 0 && col < r.c1 + n) d.set(si, row, col, undefined);
      }
    }
  }
}

function range(a: number, b: number, step: 1 | -1): number[] {
  const out: number[] = [];
  for (let i = a; step > 0 ? i <= b : i >= b; i += step) out.push(i);
  return out;
}

/** Plage proposee par la somme automatique : nombres contigus au-dessus, sinon a gauche. */
export function autoSumSource(sh: Sheet, row: number, col: number): string | null {
  const isNum = (r: number, c: number): boolean => {
    const cell = sh.cells.get(r)?.get(c);
    return !!cell && (typeof cell.value === 'number' || cell.formula !== undefined);
  };
  let r = row - 1;
  while (r >= 0 && !isNum(r, col) && r > row - 2) r--;
  if (r >= 0 && isNum(r, col)) {
    const end = r;
    while (r - 1 >= 0 && isNum(r - 1, col)) r--;
    return `${columnName(col)}${r + 1}:${columnName(col)}${end + 1}`;
  }
  let k = col - 1;
  if (k >= 0 && isNum(row, k)) {
    const end = k;
    while (k - 1 >= 0 && isNum(row, k - 1)) k--;
    return `${columnName(k)}${row + 1}:${columnName(end)}${row + 1}`;
  }
  return null;
}

/** Ajouter / reduire les decimales d'un format (Standard -> 0,0 selon la valeur). */
export function shiftDecimals(code: string, dir: 1 | -1, value: Scalar): string {
  if (code === 'General') {
    const text = typeof value === 'number' ? formatValue(value, 'General', 'en-US') : '';
    const dec = text.includes('.') ? text.length - text.indexOf('.') - 1 : 0;
    const n = Math.max(0, dec + dir);
    return n ? `0.${'0'.repeat(n)}` : '0';
  }
  return code.split(';').map((sec) => {
    const matches = [...sec.matchAll(/0(\.0+)?/g)];
    const m = matches[matches.length - 1];
    if (!m || m.index === undefined) return sec;
    const decs = m[1] ? m[1].length - 1 : 0;
    const next = Math.max(0, decs + dir);
    return `${sec.slice(0, m.index)}0${next ? `.${'0'.repeat(next)}` : ''}${sec.slice(m.index + m[0].length)}`;
  }).join(';');
}
