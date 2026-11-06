// Boites « Inserer des cellules » et « Supprimer des cellules » (Ctrl+Maj++, Ctrl+-, menus Inserer / Supprimer du ruban).
import { useState } from 'react';
import { Dialog } from '@forgeoffice/ui';
import { S } from '../../strings/index.ts';
import type { DlgEnv } from './basic.tsx';

type Choice<T extends string> = { id: T; label: string };

function Choices<T extends string>({ x, title, choices, initial, apply }: { x: DlgEnv; title: string; choices: readonly Choice<T>[]; initial: T; apply: (c: T) => void }) {
  const [value, setValue] = useState<T>(initial);
  const ok = (): void => {
    apply(value);
    x.close();
  };
  return (
    <Dialog open title={title} onClose={x.close} onConfirm={ok} width={380}>
      <div role="radiogroup" aria-label={title} style={{ display: 'grid', gap: 8 }}>
        {choices.map((c) => (
          <label key={c.id} className="xl-radio">
            <input type="radio" name="cells-choice" checked={value === c.id} onChange={() => setValue(c.id)} data-autofocus={value === c.id ? true : undefined} />
            {c.label}
          </label>
        ))}
      </div>
    </Dialog>
  );
}

export function InsertCellsDialog({ x }: { x: DlgEnv }) {
  const D = S.cellsDlg;
  return (
    <Choices
      x={x}
      title={D.insertTitle}
      initial="cellsDown"
      choices={[
        { id: 'cellsRight', label: D.insertRight },
        { id: 'cellsDown', label: D.insertDown },
        { id: 'rows', label: D.insertRow },
        { id: 'cols', label: D.insertCol },
      ]}
      apply={(c) => x.cmd.insert(c)}
    />
  );
}

export function DeleteCellsDialog({ x }: { x: DlgEnv }) {
  const D = S.cellsDlg;
  return (
    <Choices
      x={x}
      title={D.deleteTitle}
      initial="cellsUp"
      choices={[
        { id: 'cellsLeft', label: D.deleteLeft },
        { id: 'cellsUp', label: D.deleteUp },
        { id: 'rows', label: D.deleteRow },
        { id: 'cols', label: D.deleteCol },
      ]}
      apply={(c) => x.cmd.remove(c)}
    />
  );
}
