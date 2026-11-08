// Superpositions de la grille : objets (graphiques, images), liste deroulante de validation, message de saisie, info-bulle de note,
// zone de saisie de la cellule en cours de modification.
import { useEffect, useRef, type KeyboardEvent, type Ref } from 'react';
import { Icon, type MenuItem } from '@forgeoffice/ui';
import type { Scalar } from '@forgeoffice/formulas';
import { cellName, type CellRange, type Sheet, type Workbook } from '@forgeoffice/xlsx';
import { TOTAL_CODES, setTotalFunction, tableAt, type TotalFn } from '../logic/tables.ts';
import { FILL_MODES, type FillMode } from '../logic/fill-options.ts';
import { commitEntry, parseEntry } from '../logic/cells.ts';
import { rangeValues } from '../logic/engine.ts';
import type { FnInfo } from '../logic/formula-ui.ts';
import { cellLook } from '../logic/look.ts';
import { mergeAt } from '../logic/styles.ts';
import { listItems, validationAt } from '../logic/validation.ts';
import { rangeRect, type Viewport } from '../logic/viewport.ts';
import { activeRange, type Selection } from '../logic/selection.ts';
import { QUICK_ANALYSIS_EVENT } from './quick-analysis.ts';
import { Drawings } from './Drawings.tsx';
import { arrangeDrawing, type Arrange } from '../logic/shapes.ts';
import type { DialogState } from './registry.ts';
import { FormulaInput, type FormulaInputHandle } from './FormulaInput.tsx';
import type { Edit } from './keys-types.ts';
import type { DocStore } from './store.ts';
import { S } from '../strings/index.ts';

export interface GridOverlayProps {
  v: Viewport;
  wb: Workbook;
  sheet: Sheet;
  si: number;
  store: DocStore;
  selection: Selection;
  edit: Edit | null;
  drawing: number | null;
  onSelectDrawing: (i: number | null) => void;
  onMoveDrawing: Parameters<typeof Drawings>[0]['onMove'];
  onShapeText: (index: number, text: string) => void;
  textOf: (v: Scalar) => string;
  hover: { row: number; col: number; x: number; y: number } | null;
  zoom: number;
  cellRef: Ref<FormulaInputHandle>;
  onEditChange: (text: string, caret: number) => void;
  onEditKey: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCaret: (caret: number) => void;
  onFunctionHelp: (fn: FnInfo) => void;
  /** Bouton « Options de recopie incrementee » : zone recopiee, mode courant, choix d'un autre mode. */
  fillOpts: { range: CellRange; mode: FillMode; pick: (m: FillMode) => void } | null;
  /** Ouverture d'une boite de dialogue (menus contextuels des objets). */
  openDialog: (d: DialogState) => void;
  /** Entrees de l'Analyse rapide (bouton sous une selection de plusieurs cellules et Ctrl+Q). */
  quickItems: MenuItem[];
  openMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuItem[]) => void;
}

export function GridOverlay(p: GridOverlayProps) {
  const { v, wb, sheet, si, store, edit, hover, zoom } = p;
  const active = p.selection.active;
  const activeMerge = mergeAt(sheet.merges, active.row, active.col);
  const dv = validationAt(sheet, active.row, active.col);
  const link = hover ? sheet.hyperlinks.find((h) => hover.row >= h.ref.r1 && hover.row <= h.ref.r2 && hover.col >= h.ref.c1 && hover.col <= h.ref.c2) : undefined;
  const note = hover ? sheet.notes.find((n) => n.ref.row === hover.row && n.ref.col === hover.col) ?? sheet.threadedComments.find((n) => n.ref.row === hover.row && n.ref.col === hover.col) : undefined;
  const editRect = edit && edit.sheet === si ? rangeRect(v, mergeAt(sheet.merges, edit.row, edit.col) ?? { r1: edit.row, c1: edit.col, r2: edit.row, c2: edit.col }) : null;
  const editLook = edit ? cellLook(wb, sheet.cells.get(edit.row)?.get(edit.col), null, { colPx: 64 }) : null;
  const quickBtn = useRef<HTMLButtonElement | null>(null);
  const selRange = activeRange(p.selection);
  const multi = p.selection.ranges.length === 1 && (selRange.r1 !== selRange.r2 || selRange.c1 !== selRange.c2) && selRange.r2 < 1_000_000 && selRange.c2 < 16_000;
  const quickRect = rangeRect(v, selRange);
  useEffect(() => {
    const open = (): void => {
      const r = quickBtn.current?.getBoundingClientRect();
      if (r) p.openMenu({ clientX: r.left, clientY: r.bottom + 2 }, p.quickItems);
    };
    window.addEventListener(QUICK_ANALYSIS_EVENT, open);
    return () => window.removeEventListener(QUICK_ANALYSIS_EVENT, open);
  }, [p.openMenu, p.quickItems]);
  const activeRect = rangeRect(v, activeMerge ?? { r1: active.row, c1: active.col, r2: active.row, c2: active.col });
  return (
    <>
      <Drawings v={v} sheet={sheet} selected={p.drawing} onSelect={p.onSelectDrawing} onMove={p.onMoveDrawing} onText={p.onShapeText} onRotate={(i, deg) => p.store.commit((d) => { const sh = d.sheet(p.si); sh.drawings = sh.drawings.map((o, k) => (k === i ? { ...o, rotation: deg } : o)); })} openMenu={p.openMenu} menu={(i) => drawingMenu(p, i)} onChartText={(i, part) => chartTextDialog(p, i, part)} read={(ref) => rangeValues(store.engine, ref, sheet.name)} text={p.textOf} />
      {dv?.type === 'list' && dv.inCellDropdown !== false && !edit && (
        <button type="button" className="xl-dvbtn" style={{ left: activeRect.x + activeRect.w + 1, top: activeRect.y + activeRect.h - 18 }} aria-label={S.validationList}
          onPointerDown={(e) => {
            e.stopPropagation();
            const items = listItems(dv, (f) => rangeValues(store.engine, f, sheet.name).flat());
            p.openMenu(e, items.map((it) => ({ id: it, label: it, onClick: () => {
              const entry = parseEntry(it, wb.date1904);
              if (entry.ok) store.commit((d) => commitEntry(d, si, active.row, active.col, entry));
            } })));
          }}>
          <Icon name="chevron_down" size={12} />
        </button>
      )}
      {(() => {
        const t = tableAt(sheet, active.row, active.col);
        if (!t || t.totalsRowCount === 0 || active.row !== t.ref.r2 || edit) return null;
        const current = t.columns[active.col - t.ref.c1]?.totalsRowFunction ?? 'none';
        const fns: TotalFn[] = ['none', ...(Object.keys(TOTAL_CODES) as TotalFn[])];
        return (
          <button type="button" className="xl-dvbtn" style={{ left: activeRect.x + activeRect.w + 1, top: activeRect.y + activeRect.h - 18 }} aria-label={S.tableTotal.title}
            onPointerDown={(e) => {
              e.stopPropagation();
              p.openMenu(e, fns.map((fn) => ({ id: fn, label: fn === 'none' ? S.tableTotal.none : S.pivot.fn[fn] ?? fn, checked: current === fn, onClick: () => store.commit((d) => void setTotalFunction(d, si, t, active.col, fn)) })));
            }}>
            <Icon name="chevron_down" size={12} />
          </button>
        );
      })()}
      {multi && !edit && (
        <button ref={quickBtn} type="button" className="xl-fillopt xl-quick" style={{ left: quickRect.x + quickRect.w + 2, top: quickRect.y + quickRect.h + 24 }} aria-label={S.quick.title}
          onPointerDown={(e) => { e.stopPropagation(); p.openMenu(e, p.quickItems); }}>
          <Icon name="table_lightning" size={12} />
        </button>
      )}
      {p.fillOpts && !edit && (() => {
        const fr = rangeRect(v, p.fillOpts.range);
        const { mode, pick } = p.fillOpts;
        return (
          <button type="button" className="xl-fillopt" style={{ left: fr.x + fr.w + 2, top: fr.y + fr.h + 2 }} aria-label={S.fillOpts.title}
            onPointerDown={(e) => {
              e.stopPropagation();
              p.openMenu(e, FILL_MODES.map((m) => ({ id: m, label: S.fillOpts[m], checked: m === mode, onClick: () => pick(m) })));
            }}>
            <Icon name="table_cells_merge" size={12} />
          </button>
        );
      })()}
      {dv && dv.showInputMessage !== false && (dv.prompt || dv.promptTitle) && !edit && (
        <div className="xl-dvprompt" style={{ left: activeRect.x + 8, top: activeRect.y + activeRect.h + 4 }}>
          {dv.promptTitle && <strong>{dv.promptTitle}</strong>}
          <span>{dv.prompt}</span>
        </div>
      )}
      {link && hover && !note && (
        <div className="xl-notetip" style={{ left: rangeRect(v, { r1: hover.row, c1: hover.col, r2: hover.row, c2: hover.col }).x + 8, top: rangeRect(v, { r1: hover.row, c1: hover.col, r2: hover.row, c2: hover.col }).y + rangeRect(v, { r1: hover.row, c1: hover.col, r2: hover.row, c2: hover.col }).h + 4 }}>
          <strong>{link.tooltip || link.target || link.location}</strong>
          {!link.tooltip && <span>{S.linkHint}</span>}
        </div>
      )}
      {sheet.notes.filter((n) => n.visible && !(hover && n.ref.row === hover.row && n.ref.col === hover.col)).map((n) => {
        const r = rangeRect(v, { r1: n.ref.row, c1: n.ref.col, r2: n.ref.row, c2: n.ref.col });
        if (r.x > v.width || r.y > v.height || r.x + r.w < 0 || r.y + r.h < 0) return null;
        return (
          <div key={`${n.ref.row}:${n.ref.col}`} className="xl-notetip xl-notetip--fixed" style={{ left: r.x + r.w + 6, top: r.y }}>
            <strong>{n.author} :</strong>
            <span>{n.text}</span>
          </div>
        );
      })}
      {note && hover && (
        <div className="xl-notetip" style={{ left: rangeRect(v, { r1: hover.row, c1: hover.col, r2: hover.row, c2: hover.col }).x + rangeRect(v, { r1: hover.row, c1: hover.col, r2: hover.row, c2: hover.col }).w + 6, top: rangeRect(v, { r1: hover.row, c1: hover.col, r2: hover.row, c2: hover.col }).y }}>
          {'author' in note ? <strong>{note.author} :</strong> : <strong>{S.author} :</strong>}
          <span>{note.text}</span>
        </div>
      )}
      {editRect && editLook && edit && (
        <FormulaInput
          ref={p.cellRef}
          className="xl-celledit"
          style={{ left: editRect.x, top: editRect.y, minWidth: editRect.w, minHeight: editRect.h, maxWidth: Math.max(editRect.w, v.width - editRect.x - 4), font: editLook.font.replace(/([\d.]+)px/, (_m, n: string) => `${(Number(n) * zoom).toFixed(2)}px`), color: editLook.color, background: editLook.fill ?? '#FFFFFF' }}
          value={edit.text}
          ariaLabel={cellName(edit.row, edit.col)}
          assist
          onChange={p.onEditChange}
          onKeyDown={p.onEditKey}
          onCaret={p.onCaret}
          onFunctionHelp={p.onFunctionHelp}
        />
      )}
    </>
  );
}

/** Menu contextuel d'un objet flottant (graphique, forme, image) : ordre, titre du graphique, suppression. */
function drawingMenu(p: GridOverlayProps, i: number): MenuItem[] {
  const d = p.sheet.drawings[i];
  if (!d) return [];
  const move = (how: Arrange): void => {
    p.store.commit((dr) => { const sh = dr.sheet(p.si); sh.drawings = arrangeDrawing(sh.drawings, i, how); });
    p.onSelectDrawing(how === 'front' ? p.sheet.drawings.length - 1 : how === 'back' ? 0 : how === 'forward' ? Math.min(p.sheet.drawings.length - 1, i + 1) : Math.max(0, i - 1));
  };
  return [
    ...(d.kind === 'chart' ? [
      { id: 'data', label: S.chart.data.select, onClick: () => p.openDialog({ kind: 'chartData', index: i }) },
      { id: 'title', label: S.chart.editTitle, onClick: () => p.openDialog({ kind: 'chartText', index: i, target: 'title' }) },
      { id: 'sep0', kind: 'separator' as const },
    ] : []),
    { id: 'front', label: S.arrange.front, onClick: () => move('front') },
    { id: 'forward', label: S.arrange.forward, onClick: () => move('forward') },
    { id: 'backward', label: S.arrange.backward, onClick: () => move('backward') },
    { id: 'back', label: S.arrange.back, onClick: () => move('back') },
    { id: 'sep1', kind: 'separator' as const },
    { id: 'delete', label: S.arrange.del, icon: 'delete', onClick: () => {
      p.store.commit((dr) => { const sh = dr.sheet(p.si); sh.drawings = sh.drawings.filter((_, k) => k !== i); });
      p.onSelectDrawing(null);
    } },
  ];
}

/** Ouvre la saisie du texte d'un titre de graphique : l'axe de gauche est l'axe de categories d'un graphique a barres horizontales, sinon l'axe des valeurs. */
function chartTextDialog(p: GridOverlayProps, i: number, part: 'title' | 'left' | 'bottom'): void {
  const d = p.sheet.drawings[i];
  if (d?.kind !== 'chart') return;
  if (part === 'title') return p.openDialog({ kind: 'chartText', index: i, target: 'title' });
  const axis = d.chart.axes.find((a) => a.position === (part === 'left' ? 'l' : 'b') && a.title?.text);
  p.openDialog({ kind: 'chartText', index: i, target: axis?.kind === 'value' ? 'value' : 'category' });
}
