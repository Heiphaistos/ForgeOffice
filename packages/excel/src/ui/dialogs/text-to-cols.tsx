// Assistant Convertir le texte en colonnes (donnees de la selection) : ecrit le resultat a la destination choisie.
import { columnName } from '@forgeoffice/xlsx';
import { rangeSelection } from '../../logic/selection.ts';
import { convertText } from '../../logic/text-split.ts';
import { TW } from '../../strings/index.ts';
import { readRange, type DlgEnv } from './basic.tsx';
import { SplitWizard } from './split-wizard.tsx';

export function TextToColsDialog({ x }: { x: DlgEnv }) {
  const range = x.sel.ranges[x.sel.ranges.length - 1] ?? { r1: x.sel.active.row, c1: x.sel.active.col, r2: x.sel.active.row, c2: x.sel.active.col };
  const lines: (string | null)[] = [];
  for (let r = range.r1; r <= range.r2; r++) lines.push(x.display(r, range.c1) || null);
  return (
    <SplitWizard
      lines={lines} initialDelimiters={[';']} destination={`$${columnName(range.c1)}$${range.r1 + 1}`} onClose={x.close}
      onFinish={(options, formats, destination) => {
        const at = readRange(destination);
        if (!at) return TW.badDestination;
        x.store.commit((d) => {
          x.setSel(rangeSelection(convertText(d, x.si, range, options, formats, { row: at.r1, col: at.c1 }, (r) => lines[r - range.r1] ?? null)));
        });
        x.close();
        return null;
      }}
    />
  );
}
