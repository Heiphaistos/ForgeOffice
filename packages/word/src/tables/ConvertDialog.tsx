// Boite « Convertir le texte en tableau » (séparateur : tabulation, point-virgule, virgule, paragraphe).
import { useState } from 'react';
import { Dialog } from '@forgeoffice/ui';
import { X } from '../strings-extra.ts';
import { T } from '../strings.ts';
import type { Ctl } from '../app/types.ts';
import { Row, Select } from '../dialogs/common.tsx';
import { textToTable } from './commands.ts';

const C = X.tableCmd;
const SEPARATORS = { tab: '\t', semi: ';', comma: ',', para: '' } as const;

export function ConvertTextDialog({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const [sep, setSep] = useState<keyof typeof SEPARATORS>('tab');
  const ok = (): void => {
    if (!c.run(textToTable(SEPARATORS[sep]))) c.notify(T.dialogs.cancel, 'warning');
    onClose();
  };
  return (
    <Dialog open title={C.textToTableTitle} onClose={onClose} onConfirm={ok} width={380} actions={[{ label: T.dialogs.ok, primary: true, onClick: ok }, { label: T.dialogs.cancel, onClick: onClose }]}>
      <Row label={C.separator}>
        <Select value={sep} label={C.separator} options={[['tab', C.tabs], ['semi', C.semicolons], ['comma', C.commas], ['para', C.paragraphs]]} onChange={setSep} />
      </Row>
    </Dialog>
  );
}
