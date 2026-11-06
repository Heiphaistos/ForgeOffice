// Enregistrement des dialogues du Tableur dans le registre (registry.ts). Un lot ajoute les siens dans son propre fichier,
// puis une ligne d'import dans ui/register.ts.
import { registerDialog } from '../registry.ts';
import {
  FindDialog, GoToDialog, LinkDialog, NoteDialog, PasteSpecialDialog, ProtectDialog, SeriesDialog, SizeDialog, SparklineDialog, SymbolDialog, UnhideSheetDialog, ZoomDialog,
} from './basic.tsx';
import { CfManageDialog } from './cf-manager.tsx';
import { CfRuleDialog } from './cf-rule.tsx';
import { InsertCellsDialog, DeleteCellsDialog } from './cells.tsx';
import { MoveCopyDialog } from './move-copy.tsx';
import { CreateTableDialog } from './table.tsx';
import { PivotCreateDialog, RemoveDupDialog, SortDialog, SubtotalDialog, TextToColsDialog, ValidationDialog } from './data.tsx';
import { NewCommentDialog } from './comments.tsx';
import { S } from '../../strings/index.ts';

registerDialog({ id: 'pasteSpecial', title: S.pasteSpecial, render: (_d, x) => <PasteSpecialDialog x={x} /> });
registerDialog({ id: 'find', title: S.find, render: (d, x, h) => <FindDialog x={x} goToCell={h.goToCell} replace={d.replace} /> });
registerDialog({ id: 'goto', title: S.goTo, render: (_d, x) => <GoToDialog x={x} /> });
registerDialog({ id: 'validation', title: S.validation, render: (_d, x) => <ValidationDialog x={x} /> });
registerDialog({ id: 'sort', title: S.sort, render: (_d, x) => <SortDialog x={x} /> });
registerDialog({ id: 'removeDup', title: S.removeDup, render: (_d, x) => <RemoveDupDialog x={x} /> });
registerDialog({ id: 'textToCols', title: S.textToCols, render: (_d, x) => <TextToColsDialog x={x} /> });
registerDialog({ id: 'subtotal', title: S.subtotal, render: (_d, x) => <SubtotalDialog x={x} /> });
registerDialog({ id: 'cfRule', title: S.cf, render: (d, x) => <CfRuleDialog x={x} {...(d.preset ? { preset: d.preset } : {})} {...(d.edit ? { edit: d.edit } : {})} /> });
registerDialog({ id: 'cfManage', title: S.cfManage, render: (_d, x) => <CfManageDialog x={x} /> });
registerDialog({ id: 'createTable', title: S.createTable.title, render: (d, x) => <CreateTableDialog x={x} style={d.style} /> });
registerDialog({ id: 'moveCopy', title: S.sheetMenu.move, render: (d, x, h) => <MoveCopyDialog x={x} sheet={d.sheet} setSheet={h.setSheet} /> });
registerDialog({ id: 'insertCells', title: S.cellsDlg.insertTitle, render: (_d, x) => <InsertCellsDialog x={x} /> });
registerDialog({ id: 'deleteCells', title: S.cellsDlg.deleteTitle, render: (_d, x) => <DeleteCellsDialog x={x} /> });
registerDialog({ id: 'pivotCreate', title: S.pivot.title, render: (_d, x, h) => <PivotCreateDialog x={x} onCreate={h.createPivot} /> });
registerDialog({ id: 'link', title: S.link, render: (_d, x) => <LinkDialog x={x} /> });
registerDialog({ id: 'symbol', title: S.symbols, render: (_d, x) => <SymbolDialog x={x} /> });
registerDialog({ id: 'size', title: (d) => (d.axis === 'col' ? S.columnWidth : S.rowHeight), render: (d, x) => <SizeDialog x={x} axis={d.axis} /> });
registerDialog({ id: 'series', title: S.series, render: (_d, x) => <SeriesDialog x={x} /> });
registerDialog({ id: 'protect', title: (d) => (d.target === 'sheet' ? S.protectSheet : S.protectBook), render: (d, x) => <ProtectDialog x={x} target={d.target} /> });
registerDialog({ id: 'sparkline', title: S.sparkline, render: (d, x) => <SparklineDialog x={x} type={d.type} /> });
registerDialog({ id: 'unhideSheet', title: S.unhideTitle, render: (_d, x) => <UnhideSheetDialog x={x} /> });
registerDialog({ id: 'note', title: S.note, render: (_d, x) => <NoteDialog x={x} /> });
registerDialog({ id: 'newComment', title: S.newComment, render: (_d, x, h) => <NewCommentDialog x={x} host={h} /> });
registerDialog({ id: 'zoom', title: S.zoomTitle, render: (_d, x, h) => <ZoomDialog x={x} zoom={h.zoom} onZoom={h.setZoom} /> });
