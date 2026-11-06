// Superpositions de la grille : objets (graphiques, images), liste deroulante de validation, message de saisie, info-bulle de note,
// zone de saisie de la cellule en cours de modification.
import type { KeyboardEvent, Ref } from 'react';
import { Icon, type MenuItem } from '@forgeoffice/ui';
import type { Scalar } from '@forgeoffice/formulas';
import { cellName, type Sheet, type Workbook } from '@forgeoffice/xlsx';
import { commitEntry, parseEntry } from '../logic/cells.ts';
import { rangeValues } from '../logic/engine.ts';
import type { FnInfo } from '../logic/formula-ui.ts';
import { cellLook } from '../logic/look.ts';
import { mergeAt } from '../logic/styles.ts';
import { listItems, validationAt } from '../logic/validation.ts';
import { rangeRect, type Viewport } from '../logic/viewport.ts';
import type { Selection } from '../logic/selection.ts';
import { Drawings } from './Drawings.tsx';
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
  textOf: (v: Scalar) => string;
  hover: { row: number; col: number; x: number; y: number } | null;
  zoom: number;
  cellRef: Ref<FormulaInputHandle>;
  onEditChange: (text: string, caret: number) => void;
  onEditKey: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCaret: (caret: number) => void;
  onFunctionHelp: (fn: FnInfo) => void;
  openMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuItem[]) => void;
}

export function GridOverlay(p: GridOverlayProps) {
  const { v, wb, sheet, si, store, edit, hover, zoom } = p;
  const active = p.selection.active;
  const activeMerge = mergeAt(sheet.merges, active.row, active.col);
  const dv = validationAt(sheet, active.row, active.col);
  const note = hover ? sheet.notes.find((n) => n.ref.row === hover.row && n.ref.col === hover.col) ?? sheet.threadedComments.find((n) => n.ref.row === hover.row && n.ref.col === hover.col) : undefined;
  const editRect = edit && edit.sheet === si ? rangeRect(v, mergeAt(sheet.merges, edit.row, edit.col) ?? { r1: edit.row, c1: edit.col, r2: edit.row, c2: edit.col }) : null;
  const editLook = edit ? cellLook(wb, sheet.cells.get(edit.row)?.get(edit.col), null, { colPx: 64 }) : null;
  const activeRect = rangeRect(v, activeMerge ?? { r1: active.row, c1: active.col, r2: active.row, c2: active.col });
  return (
    <>
      <Drawings v={v} sheet={sheet} selected={p.drawing} onSelect={p.onSelectDrawing} onMove={p.onMoveDrawing} read={(ref) => rangeValues(store.engine, ref, sheet.name)} text={p.textOf} />
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
      {dv?.prompt && !edit && (
        <div className="xl-dvprompt" style={{ left: activeRect.x + 8, top: activeRect.y + activeRect.h + 4 }}>
          {dv.promptTitle && <strong>{dv.promptTitle}</strong>}
          <span>{dv.prompt}</span>
        </div>
      )}
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
