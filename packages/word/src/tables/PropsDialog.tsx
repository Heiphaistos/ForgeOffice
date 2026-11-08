// Boite « Propriétés du tableau » : onglets Tableau, Ligne, Colonne, Cellule, Texte de remplacement.
import { useState } from 'react';
import { Dialog, NumberField, TextField } from '@forgeoffice/ui';
import type { TableCellProps, TableProps, TableRowProps } from '@forgeoffice/docx';
import type { Node as PMNode } from 'prosemirror-model';
import { X } from '../strings-extra.ts';
import { T } from '../strings.ts';
import type { Ctl } from '../app/types.ts';
import { Check, Row, Select } from '../dialogs/common.tsx';
import { cmToPt, ptToCm } from '../ribbon/shared.ts';
import { setCellProps, setColumnWidth, setRowProps, setTableProps, tableRect } from './commands.ts';

const P = X.tableProps;
type Tab = 'table' | 'row' | 'column' | 'cell' | 'alt';
type WidthMode = 'auto' | 'pt' | 'pct';

/** Premiere cellule de la selection (valeurs affichees). */
function currentCell(c: Ctl): { table: PMNode; row: PMNode | null; cell: PMNode | null; col: number } | null {
  const state = c.state();
  const r = state && tableRect(state);
  if (!r) return null;
  const cellPos = r.map.map[r.top * r.map.width + r.left]!;
  return { table: r.table, row: r.table.maybeChild(r.top), cell: r.table.nodeAt(cellPos), col: r.left };
}

export function TablePropsDialog({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const cur = currentCell(c);
  const tp = (cur?.table.attrs.props ?? {}) as TableProps;
  const rp = (cur?.row?.attrs.props ?? {}) as TableRowProps;
  const cp = (cur?.cell?.attrs.props ?? {}) as TableCellProps;
  const grid = (cur?.table.attrs.grid ?? []) as number[];
  const [tab, setTab] = useState<Tab>('table');
  const [wMode, setWMode] = useState<WidthMode>(tp.width?.type === 'pt' ? 'pt' : tp.width?.type === 'pct' ? 'pct' : 'auto');
  const [wVal, setWVal] = useState(tp.width?.type === 'pct' ? tp.width.value : ptToCm(tp.width?.type === 'pt' ? tp.width.value : grid.reduce((a, b) => a + b, 0)));
  const [align, setAlign] = useState<NonNullable<TableProps['alignment']>>(tp.alignment ?? 'left');
  const [hRule, setHRule] = useState<NonNullable<TableRowProps['height']>['rule']>(rp.height?.rule ?? 'auto');
  const [hVal, setHVal] = useState(ptToCm(rp.height?.value ?? 0.5 * 28.35));
  const [cantSplit, setCantSplit] = useState(!!rp.cantSplit);
  const [header, setHeader] = useState(!!rp.header);
  const [colW, setColW] = useState(ptToCm(grid[cur?.col ?? 0] ?? 0));
  const [vAlign, setVAlign] = useState<NonNullable<TableCellProps['verticalAlign']>>(cp.verticalAlign ?? 'top');
  const [caption, setCaption] = useState(tp.caption ?? '');
  const [desc, setDesc] = useState(tp.description ?? '');
  if (!cur) {
    return <Dialog open title={P.title} onClose={onClose} width={360} actions={[{ label: T.dialogs.close, primary: true, onClick: onClose }]}><p>{P.noTable}</p></Dialog>;
  }
  const ok = (): void => {
    const width = wMode === 'auto' ? { value: 0, type: 'auto' as const } : wMode === 'pct' ? { value: wVal, type: 'pct' as const } : { value: cmToPt(wVal), type: 'pt' as const };
    c.run(setTableProps({ width, alignment: align === 'left' ? undefined : align, caption: caption || undefined, description: desc || undefined }));
    c.run(setRowProps({ height: hRule === 'auto' ? undefined : { value: cmToPt(hVal), rule: hRule }, cantSplit: cantSplit || undefined, header: header || undefined }));
    if (colW > 0 && Math.abs(colW - ptToCm(grid[cur.col] ?? 0)) > 0.005) c.run(setColumnWidth(cmToPt(colW)));
    c.run(setCellProps({ verticalAlign: vAlign === 'top' ? undefined : vAlign }));
    onClose();
  };
  const tabs: [Tab, string][] = [['table', P.table], ['row', P.row], ['column', P.column], ['cell', P.cell], ['alt', P.alt]];
  return (
    <Dialog open title={P.title} onClose={onClose} onConfirm={ok} width={480} actions={[{ label: T.dialogs.ok, primary: true, onClick: ok }, { label: T.dialogs.cancel, onClick: onClose }]}>
      <div className="fo-word-tabs" role="tablist">
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      <div className="fo-word-tabpanel" role="tabpanel">
        {tab === 'table' && (
          <div className="fo-word-form">
            <Row label={P.useWidth}>
              <Select value={wMode} label={P.useWidth} options={[['auto', P.auto], ['pt', 'cm'], ['pct', '%']]} onChange={setWMode} />
              <NumberField value={wVal} min={0} max={wMode === 'pct' ? 100 : 100} step={wMode === 'pct' ? 5 : 0.5} label={P.width} width={90} disabled={wMode === 'auto'} onChange={setWVal} />
            </Row>
            <Row label={P.alignment}><Select value={align} label={P.alignment} options={[['left', P.left], ['center', P.center], ['right', P.right]]} onChange={setAlign} /></Row>
          </div>
        )}
        {tab === 'row' && (
          <div className="fo-word-form">
            <Row label={P.heightRule}>
              <Select value={hRule} label={P.heightRule} options={[['auto', P.auto], ['atLeast', P.atLeast], ['exact', P.exactly]]} onChange={setHRule} />
              <NumberField value={hVal} min={0.1} max={55} step={0.1} label={P.height} width={90} disabled={hRule === 'auto'} onChange={setHVal} />
            </Row>
            <Check label={P.cantSplit} checked={cantSplit} onChange={setCantSplit} />
            <Check label={P.repeatHeader} checked={header} onChange={setHeader} />
          </div>
        )}
        {tab === 'column' && (
          <div className="fo-word-form"><Row label={P.colWidth}><NumberField value={colW} min={0.1} max={55} step={0.1} label={P.colWidth} width={90} onChange={setColW} /></Row></div>
        )}
        {tab === 'cell' && (
          <div className="fo-word-form"><Row label={P.vAlign}><Select value={vAlign} label={P.vAlign} options={[['top', P.top], ['center', P.middle], ['bottom', P.bottom]]} onChange={setVAlign} /></Row></div>
        )}
        {tab === 'alt' && (
          <div className="fo-word-form">
            <TextField label={P.altTitle} value={caption} maxLength={200} onChange={(e) => setCaption(e.target.value)} />
            <TextField label={P.altDesc} value={desc} maxLength={1000} onChange={(e) => setDesc(e.target.value)} />
          </div>
        )}
      </div>
    </Dialog>
  );
}
