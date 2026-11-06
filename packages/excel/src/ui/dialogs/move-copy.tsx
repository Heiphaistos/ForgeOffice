// « Deplacer ou copier une feuille » : position dans le classeur et case « Creer une copie » (menu de l'onglet de feuille).
import { useState } from 'react';
import { Checkbox, Dialog } from '@forgeoffice/ui';
import { duplicateSheet, moveSheet } from '../../logic/structure.ts';
import { S } from '../../strings/index.ts';
import type { DlgEnv } from './basic.tsx';

export function MoveCopyDialog({ x, sheet, setSheet }: { x: DlgEnv; sheet: number; setSheet: (i: number) => void }) {
  const sheets = x.store.wb.sheets;
  const source = sheets[sheet];
  // Valeur : nom de la feuille devant laquelle placer ; '' = en dernier.
  const [before, setBefore] = useState<string>(sheets[sheet + 1]?.name ?? '');
  const [copy, setCopy] = useState(false);
  if (!source) return null;
  const apply = (): void => {
    let landed = sheet;
    x.store.commit((d) => {
      let idx = sheet;
      if (copy) idx = duplicateSheet(d, sheet);
      const list = d.wb.sheets;
      const at = before === '' ? list.length : list.findIndex((s, k) => k !== idx && s.name === before);
      const to = before === '' ? list.length - 1 : at > idx ? at - 1 : at;
      if (to !== idx) moveSheet(d, idx, to);
      landed = to;
    });
    setSheet(landed);
    x.close();
  };
  return (
    <Dialog open title={S.sheetMenu.move} onClose={x.close} onConfirm={apply} width={400}>
      <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
        <label>{S.moveCopy.before}</label>
        <select value={before} onChange={(e) => setBefore(e.target.value)} aria-label={S.moveCopy.before} data-autofocus>
          {sheets.filter((s) => s.state === 'visible' && s.name !== source.name).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          <option value="">{S.moveCopy.last}</option>
        </select>
      </div>
      <Checkbox checked={copy} onChange={setCopy} label={S.moveCopy.copy} />
    </Dialog>
  );
}
