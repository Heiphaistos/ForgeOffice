// Import d'un fichier texte/CSV avec l'assistant : encodage, ligne de depart, delimiteur ou largeur fixe, format des colonnes ; resultat dans une nouvelle feuille.
import { useMemo, useState } from 'react';
import { ENCODINGS, decodeLines, detectDelimiter, detectEncoding, type TextEncoding } from '../../logic/csv-import.ts';
import { convertText } from '../../logic/text-split.ts';
import { addSheetAt } from '../../logic/structure.ts';
import { baseName } from '../io.ts';
import { S, TW } from '../../strings/index.ts';
import type { DialogHostApi } from '../registry.ts';
import type { DlgEnv } from './basic.tsx';
import { SplitWizard } from './split-wizard.tsx';

export function CsvImportDialog({ x, host, name, bytes }: { x: DlgEnv; host: DialogHostApi; name: string; bytes: Uint8Array }) {
  const [encoding, setEncoding] = useState<TextEncoding>(() => detectEncoding(bytes));
  const [start, setStart] = useState(1);
  const all = useMemo(() => decodeLines(bytes, encoding), [bytes, encoding]);
  const lines = all.slice(Math.max(0, start - 1));
  const initial = useMemo(() => [detectDelimiter(all)], []); // ponytail : delimiteur propose a l'ouverture seulement
  return (
    <SplitWizard
      title={TW.importTitle(name)} lines={lines} initialDelimiters={initial} onClose={x.close}
      step1Extra={(
        <div className="xl-form">
          <label htmlFor="csv-enc">{TW.origin}</label>
          <select id="csv-enc" value={encoding} onChange={(e) => setEncoding(e.target.value as TextEncoding)}>
            {ENCODINGS.map((k) => <option key={k} value={k}>{TW.encodings[k]}</option>)}
          </select>
          <label htmlFor="csv-start">{TW.startAtLine}</label>
          <input id="csv-start" className="ps-count" type="number" min={1} value={start} onChange={(e) => setStart(Math.max(1, Math.round(Number(e.target.value)) || 1))} />
        </div>
      )}
      onFinish={(options, formats) => {
        const at = x.si + 1;
        x.store.commit((d) => {
          const idx = addSheetAt(d, at, baseName(name));
          convertText(d, idx, { r1: 0, c1: 0, r2: Math.max(0, lines.length - 1), c2: 0 }, options, formats, { row: 0, col: 0 }, (r) => lines[r] ?? null);
        });
        host.setSheet(at);
        x.notify(S.csvImported(name), 'success');
        x.close();
        return null;
      }}
    />
  );
}
