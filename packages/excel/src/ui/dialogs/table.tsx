// Creation d'un tableau : plage des donnees et presence d'en-tetes (comme Excel : Accueil > Mettre sous forme de tableau, Ctrl+L).
import { useState } from 'react';
import { Checkbox, Dialog, TextField } from '@forgeoffice/ui';
import { rangeName } from '@forgeoffice/xlsx';
import { guessHeader } from '../../logic/data.ts';
import { S } from '../../strings/index.ts';
import { readRange, type DlgEnv } from './basic.tsx';

export function CreateTableDialog({ x, style }: { x: DlgEnv; style: string }) {
  const initial = x.cmd.dataRange();
  const [where, setWhere] = useState(rangeName(initial, true));
  const [header, setHeader] = useState(guessHeader(initial, x.value) || typeof x.value(initial.r1, initial.c1) === 'string');
  const apply = (): void => {
    const range = readRange(where);
    if (!range) {
      x.notify(S.invalidRef, 'error');
      return;
    }
    const tables = x.store.wb.sheets[x.si]?.tables ?? [];
    if (tables.some((t) => !(t.ref.r2 < range.r1 || t.ref.r1 > range.r2 || t.ref.c2 < range.c1 || t.ref.c1 > range.c2))) {
      x.notify(S.createTable.overlap, 'error');
      return;
    }
    x.cmd.formatAsTable(style, { range, header });
    x.close();
  };
  return (
    <Dialog open title={S.createTable.title} onClose={x.close} onConfirm={apply} width={440}>
      <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
        <label>{S.createTable.where}</label>
        <TextField value={where} onChange={(e) => setWhere(e.target.value)} aria-label={S.createTable.where} data-autofocus />
      </div>
      <Checkbox checked={header} onChange={setHeader} label={S.createTable.hasHeaders} />
    </Dialog>
  );
}
