// Composants hotes : Backstage du Tableur, aiguillage des dialogues, onglets des feuilles, document imprime.
import { createPortal } from 'react-dom';
import { Backstage } from '@forgeoffice/ui';
import { MODULES, type NoticeKind } from '@forgeoffice/core';
import type { Scalar } from '@forgeoffice/formulas';
import { isValidSheetName, type Sheet, type Workbook } from '@forgeoffice/xlsx';
import { duplicateSheet, moveSheet, renameSheet } from '../logic/structure.ts';
import { backstagePages, type BackstageEnv } from './BackstagePages.tsx';
import type { Commands, DialogState } from './commands.ts';
import {
  FindDialog, GoToDialog, LinkDialog, NoteDialog, PasteSpecialDialog, ProtectDialog, SeriesDialog, SizeDialog, SparklineDialog, SymbolDialog, UnhideSheetDialog, ZoomDialog,
  type DlgEnv,
} from './dialogs/basic.tsx';
import { CfManageDialog, CfRuleDialog, PivotCreateDialog, RemoveDupDialog, SortDialog, SubtotalDialog, TextToColsDialog, ValidationDialog } from './dialogs/data.tsx';
import { EvaluateDialog, FnWizardDialog, FormatCellsDialog, NamesDialog } from './dialogs/formula.tsx';
import { PageView, paginate, printRange } from './print.tsx';
import { SheetTabs } from './SheetTabs.tsx';
import type { DocStore } from './store.ts';
import { S } from '../strings.ts';

export function BackstagePages({ open, page, onPage, onClose, env }: { open: boolean; page: string; onPage: (p: string) => void; onClose: () => void; env: BackstageEnv }) {
  return <Backstage open={open} appName={MODULES.excel.name} pages={backstagePages(env)} activePage={page} onPageChange={onPage} onClose={onClose} />;
}

export function DialogHost({ dialog, x, zoom, onZoom, onCreatePivot, onInsertFormula }: {
  dialog: DialogState;
  x: DlgEnv;
  zoom: number;
  onZoom: (z: number) => void;
  onCreatePivot: (source: string, newSheet: boolean) => void;
  onInsertFormula: (formula: string) => void;
}) {
  switch (dialog.kind) {
    case 'pasteSpecial': return <PasteSpecialDialog x={x} />;
    case 'find': return <FindDialog x={x} replace={dialog.replace} />;
    case 'goto': return <GoToDialog x={x} />;
    case 'names': return <NamesDialog x={x} />;
    case 'fnWizard': return <FnWizardDialog x={x} {...(dialog.fn ? { initial: dialog.fn } : {})} onInsert={onInsertFormula} />;
    case 'evaluate': return <EvaluateDialog x={x} />;
    case 'validation': return <ValidationDialog x={x} />;
    case 'sort': return <SortDialog x={x} />;
    case 'removeDup': return <RemoveDupDialog x={x} />;
    case 'textToCols': return <TextToColsDialog x={x} />;
    case 'subtotal': return <SubtotalDialog x={x} />;
    case 'cfRule': return <CfRuleDialog x={x} {...(dialog.preset ? { preset: dialog.preset } : {})} />;
    case 'cfManage': return <CfManageDialog x={x} />;
    case 'pivotCreate': return <PivotCreateDialog x={x} onCreate={onCreatePivot} />;
    case 'link': return <LinkDialog x={x} />;
    case 'symbol': return <SymbolDialog x={x} />;
    case 'size': return <SizeDialog x={x} axis={dialog.axis} />;
    case 'series': return <SeriesDialog x={x} />;
    case 'formatCells': return <FormatCellsDialog x={x} {...(dialog.tab ? { tab: dialog.tab } : {})} />;
    case 'protect': return <ProtectDialog x={x} target={dialog.target} />;
    case 'sparkline': return <SparklineDialog x={x} type={dialog.type} />;
    case 'unhideSheet': return <UnhideSheetDialog x={x} />;
    case 'note': return <NoteDialog x={x} />;
    case 'zoom': return <ZoomDialog x={x} zoom={zoom} onZoom={onZoom} />;
  }
}

export interface TabsEnv {
  wb: Workbook;
  si: number;
  setSi: (i: number) => void;
  store: DocStore;
  addSheet: () => void;
  removeSheet: (i: number) => void;
  setDialog: (d: DialogState) => void;
  notify: (m: string, kind?: NoticeKind) => void;
  cmd: Commands;
}

export function SheetTabsHost({ env }: { env: TabsEnv }) {
  const { wb, store } = env;
  const locked = (): boolean => {
    if (!wb.protection?.lockStructure) return false;
    env.notify(S.protectedBook, 'warning');
    return true;
  };
  return (
    <div className="xl-bottom">
      <SheetTabs
        wb={wb}
        active={env.si}
        onSelect={env.setSi}
        onAdd={env.addSheet}
        onRename={(i, name) => {
          if (locked()) return false;
          if (!isValidSheetName(name) || wb.sheets.some((s, k) => k !== i && s.name.toLowerCase() === name.toLowerCase())) {
            env.notify(S.badSheetName, 'error');
            return false;
          }
          store.commit((d) => renameSheet(d, i, name));
          return true;
        }}
        onDelete={env.removeSheet}
        onMove={(from, to) => {
          if (locked()) return;
          store.commit((d) => moveSheet(d, from, to));
          env.setSi(to);
        }}
        onDuplicate={(i) => {
          if (locked()) return;
          let idx = i;
          store.commit((d) => {
            idx = duplicateSheet(d, i);
          });
          env.setSi(idx);
        }}
        onColor={(i, rgb) => store.commit((d) => {
          const s = d.sheet(i);
          if (rgb) s.tabColor = { rgb: `FF${rgb.toUpperCase()}` };
          else delete s.tabColor;
        })}
        onHide={(i) => {
          env.cmd.sheetState(i, 'hidden');
          const next = wb.sheets.findIndex((s, k) => k !== i && s.state === 'visible');
          if (next >= 0) env.setSi(next);
        }}
        onUnhide={() => env.setDialog({ kind: 'unhideSheet' })}
        onProtect={() => env.setDialog({ kind: 'protect', target: 'sheet' })}
      />
    </div>
  );
}

/** Pages imprimees, rendues hors ecran puis imprimees par le navigateur / la coquille. */
export function PrintRoot({ wb, sheet, value }: { wb: Workbook; sheet: Sheet; value: (row: number, col: number) => Scalar }) {
  const range = printRange(sheet);
  const { pages, scale } = range ? paginate(sheet, range) : { pages: [], scale: 1 };
  return createPortal(
    <div className="xl-print-root">
      {pages.map((p, i) => <PageView key={i} wb={wb} sheet={sheet} page={p} scale={scale} value={value} />)}
    </div>,
    document.body,
  );
}

