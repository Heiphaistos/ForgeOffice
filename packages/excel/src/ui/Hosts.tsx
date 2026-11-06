// Composants hotes : Backstage du Tableur, dialogue ouvert (registre), onglets des feuilles, document imprime.
import { Backstage } from '@forgeoffice/ui';
import { MODULES, type NoticeKind } from '@forgeoffice/core';
import { isValidSheetName, type Sheet, type Workbook } from '@forgeoffice/xlsx';
import { duplicateSheet, moveSheet, renameSheet } from '../logic/structure.ts';
import { backstagePages, type BackstageEnv } from './BackstagePages.tsx';
import type { Commands } from './commands.ts';
import { renderDialog, type DialogEnv, type DialogHostApi, type DialogState } from './registry.ts';
import { SheetTabs } from './SheetTabs.tsx';
import type { DocStore } from './store.ts';
import { S } from '../strings/index.ts';

export { PrintRoot } from './print.tsx';

export function BackstagePages({ open, page, onPage, onClose, env }: { open: boolean; page: string; onPage: (p: string) => void; onClose: () => void; env: BackstageEnv }) {
  return <Backstage open={open} appName={MODULES.excel.name} pages={backstagePages(env)} activePage={page} onPageChange={onPage} onClose={onClose} />;
}

/** Dialogue ouvert : rendu par le registre (dialogs/register.tsx et lots suivants). */
export function DialogHost({ dialog, x, host }: { dialog: DialogState; x: DialogEnv; host: DialogHostApi }) {
  return <>{renderDialog(dialog, x, host)}</>;
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
        onMoveCopy={(i) => {
          if (!locked()) env.setDialog({ kind: 'moveCopy', sheet: i });
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

