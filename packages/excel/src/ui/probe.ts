// Crochet de test (banc de conformite) : modele du classeur et selections preparees. Appele seulement en developpement.
import type { ModuleProbe } from '@forgeoffice/core';
import { numberFormatCode, type Sheet, type Workbook } from '@forgeoffice/xlsx';
import { cellSelection, rangeSelection, selectAll, selectCols, selectRows, type Selection } from '../logic/selection.ts';
import type { DocStore } from './store.ts';

/** Compteurs d'actions sans trace visible dans le document (F9 : recalcul) : le banc les lit dans `ui`. */
export const probeCounters = { recalc: 0, arrows: 0 };

export interface ExcelSources {
  store: DocStore;
  selection: Selection;
  setSel: (s: Selection) => void;
  si: number;
  setSi: (i: number) => void;
  setDrawing: (i: number | null) => void;
}

const plain = (v: unknown): unknown => {
  if (v instanceof Map) return [...v.entries()].map(([k, x]) => [k, plain(x)]);
  if (v instanceof Uint8Array) return `bytes(${v.length})`;
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
};

function sheetSnapshot(wb: Workbook, store: DocStore, s: Sheet): unknown {
  const cells: unknown[] = [];
  for (const [r, row] of [...s.cells].sort(([a], [b]) => a - b)) {
    for (const [c, cell] of [...row].sort(([a], [b]) => a - b)) {
      const xf = wb.styles.cellXfs[cell.styleId ?? 0];
      let shown: unknown = null;
      if (cell.formula !== undefined) {
        try {
          shown = plain(store.engine.value(s.name, r, c));
        } catch {
          shown = 'erreur-moteur';
        }
      }
      cells.push([r, c, cell.value, cell.formula ?? null, shown, cell.rich ? 'riche' : 0, xf ? {
        font: wb.styles.fonts[xf.fontId], fill: wb.styles.fills[xf.fillId], border: wb.styles.borders[xf.borderId], fmt: numberFormatCode(wb.styles, xf.numFmtId),
        align: xf.alignment ?? null, protect: xf.protection ?? null,
      } : null]);
    }
  }
  return plain({
    name: s.name, state: s.state, tabColor: s.tabColor, cells, merges: s.merges, cols: s.cols, rows: s.rows, view: s.view,
    conditionalFormats: s.conditionalFormats, dataValidations: s.dataValidations, tables: s.tables, autoFilter: s.autoFilter,
    hyperlinks: s.hyperlinks, notes: s.notes, threadedComments: s.threadedComments, protection: s.protection, pageSetup: s.pageSetup,
    drawings: s.drawings.map((d) => ({ ...d, data: undefined })), sparklineGroups: s.sparklineGroups,
  });
}

export function excelSnapshot(src: ExcelSources): unknown {
  const wb = src.store.wb;
  return {
    sheets: wb.sheets.map((s) => sheetSnapshot(wb, src.store, s)),
    activeSheet: src.si,
    definedNames: wb.definedNames,
    calc: wb.calc,
    properties: { ...wb.properties, modified: undefined },
    styleCounts: undefined,
    selection: { ranges: src.selection.ranges, active: src.selection.active },
    ui: { recalcs: probeCounters.recalc, arrows: probeCounters.arrows },
  };
}

const tick = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function excelProbe(get: () => ExcelSources): ModuleProbe {
  return {
    presets: ['plage', 'formule', 'filtre', 'cellule', 'texte', 'colonne', 'ligne', 'tout', 'tableau', 'graphique'],
    snapshot: () => excelSnapshot(get()),
    async select(preset) {
      const s = get();
      s.setDrawing(null);
      const onFirstSheet = async (): Promise<void> => {
        if (get().si !== 0) {
          get().setSi(0);
          await tick(120);
        }
      };
      switch (preset) {
        case 'plage':
          await onFirstSheet();
          get().setSel(rangeSelection({ r1: 0, c1: 0, r2: 4, c2: 3 }));
          return true;
        case 'formule':
          // D2 = B2*C2 : a des antecedents (fleches de trace).
          await onFirstSheet();
          get().setSel(cellSelection(1, 3));
          return true;
        case 'filtre': {
          // Filtre automatique avec un critere pose mais pas encore applique : Effacer et Reappliquer ont alors un effet.
          await onFirstSheet();
          get().store.commit((d) => {
            d.sheet(0).autoFilter = { ref: { r1: 0, c1: 0, r2: 4, c2: 3 }, columns: [{ colId: 0, filter: { kind: 'values', values: ['Pomme'] } }] };
          });
          get().setSel(rangeSelection({ r1: 0, c1: 0, r2: 4, c2: 3 }));
          return true;
        }
        case 'cellule':
          await onFirstSheet();
          get().setSel(cellSelection(1, 1));
          return true;
        case 'texte':
          await onFirstSheet();
          get().setSel(cellSelection(1, 0));
          return true;
        case 'colonne':
          await onFirstSheet();
          get().setSel(selectCols(1, 1));
          return true;
        case 'ligne':
          await onFirstSheet();
          get().setSel(selectRows(1, 1));
          return true;
        case 'tout':
          await onFirstSheet();
          get().setSel(selectAll());
          return true;
        case 'tableau':
          if (s.store.wb.sheets.length < 2) return false;
          get().setSi(1);
          await tick(150);
          get().setSel(cellSelection(1, 0));
          return true;
        case 'graphique': {
          await onFirstSheet();
          const idx = s.store.wb.sheets[0]?.drawings.findIndex((d) => d.kind === 'chart') ?? -1;
          if (idx < 0) return false;
          get().setDrawing(idx);
          return true;
        }
        default:
          return false;
      }
    },
  };
}
