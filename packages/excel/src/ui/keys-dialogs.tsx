// Boites ouvertes au clavier : F3 (Coller un nom) et Ctrl+Maj+F3 (Creer des noms a partir de la selection).
import { useState } from 'react';
import { Checkbox, Dialog } from '@forgeoffice/ui';
import { defaultNameSides, mergeNames, namesFromSelection, type NameSides } from '../logic/keys-logic.ts';
import { activeRange } from '../logic/selection.ts';
import { S } from '../strings/index.ts';
import { registerDialog, type DialogEnv, type DialogHostApi } from './registry.ts';

declare module './registry.ts' {
  interface DialogMap {
    keysPasteName: Record<never, never>;
    keysNamesFromSelection: Record<never, never>;
  }
}

/** F3 : liste des noms du classeur ; le choix est insere dans la formule en cours (ou ouvre une saisie « =nom »). */
function PasteNameDialog({ x, host }: { x: DialogEnv; host: DialogHostApi }) {
  const names = x.store.wb.definedNames.filter((n) => !n.name.startsWith('_xlnm') && !n.hidden && (n.localSheet === undefined || n.localSheet === x.si));
  return (
    <Dialog open title={S.keys.pasteName} onClose={x.close} width={420} actions={[{ label: S.close, onClick: x.close }]}>
      <p>{names.length ? S.keys.pasteNameHint : S.keys.noNames}</p>
      <ul className="xl-hits">
        {names.map((n) => (
          <li key={`${n.name}|${n.localSheet ?? ''}`}>
            <button type="button" onClick={() => { host.insertAtCaret(n.name); x.close(); }}>
              <span>{n.name}</span>
              <span>{n.formula}</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

/** Ctrl+Maj+F3 : quatre cotes de la selection (ligne du haut, colonne de gauche, ligne du bas, colonne de droite) servent d'etiquettes. */
function NamesFromSelectionDialog({ x }: { x: DialogEnv }) {
  const range = activeRange(x.sel);
  const [sides, setSides] = useState<NameSides>(() => defaultNameSides(x.sheet, range));
  const apply = (): void => {
    const added = namesFromSelection(x.sheet.name, range, sides, (r, c) => x.display(r, c));
    if (!added.length) {
      x.notify(S.keys.noNameCreated, 'warning');
      return;
    }
    x.store.commit((d) => {
      d.wb.definedNames = mergeNames(d.wb.definedNames, added);
    });
    x.notify(S.keys.namesCreated(added.length), 'success');
    x.close();
  };
  const box = (key: keyof NameSides, label: string) => <Checkbox checked={sides[key]} onChange={(v) => setSides({ ...sides, [key]: v })} label={label} />;
  return (
    <Dialog open title={S.keys.createNames} onClose={x.close} onConfirm={apply} width={380}>
      <p>{S.keys.createNamesHint}</p>
      <div className="xl-form xl-form--stack">
        {box('top', S.keys.topRow)}
        {box('left', S.keys.leftCol)}
        {box('bottom', S.keys.bottomRow)}
        {box('right', S.keys.rightCol)}
      </div>
    </Dialog>
  );
}

registerDialog({ id: 'keysPasteName', title: S.keys.pasteName, render: (_d, x, h) => <PasteNameDialog x={x} host={h} /> });
registerDialog({ id: 'keysNamesFromSelection', title: S.keys.createNames, render: (_d, x) => <NamesFromSelectionDialog x={x} /> });
