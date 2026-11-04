// Barre de formule : zone Nom (adresse, plages nommees, saisie d'une reference), boutons Annuler / Entrer /
// Inserer une fonction, champ de saisie extensible.
import { forwardRef, useEffect, useState, type KeyboardEvent } from 'react';
import { Icon, Tooltip } from '@forgeoffice/ui';
import { FormulaInput, type FormulaInputHandle } from './FormulaInput.tsx';
import type { FnInfo } from '../logic/formula-ui.ts';
import { S } from '../strings.ts';

export interface FormulaBarProps {
  address: string;
  names: readonly string[];
  onGo: (ref: string) => void;
  text: string;
  editing: boolean;
  onFocusEdit: () => void;
  onChange: (text: string, caret: number) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCaret: (caret: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
  onInsertFunction: () => void;
  onFunctionHelp: (fn: FnInfo) => void;
}

export const FormulaBar = forwardRef<FormulaInputHandle, FormulaBarProps>(function FormulaBar(p, ref) {
  const [box, setBox] = useState(p.address);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setBox(p.address), [p.address]);
  return (
    <div className={`xl-fbar${expanded ? ' is-expanded' : ''}`}>
      <div className="xl-namebox">
        <input
          value={box}
          aria-label={S.nameBox}
          list="xl-names"
          onChange={(e) => setBox(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              p.onGo(box);
            } else if (e.key === 'Escape') setBox(p.address);
          }}
        />
        <datalist id="xl-names">{p.names.map((n) => <option key={n} value={n} />)}</datalist>
      </div>
      <div className="xl-fbar__btns">
        <Tooltip content={{ title: S.cancelEdit }}>
          <button type="button" aria-label={S.cancelEdit} disabled={!p.editing} onClick={p.onCancel}><Icon name="dismiss" size={16} /></button>
        </Tooltip>
        <Tooltip content={{ title: S.confirmEdit }}>
          <button type="button" aria-label={S.confirmEdit} disabled={!p.editing} onClick={p.onConfirm}><Icon name="checkmark" size={16} /></button>
        </Tooltip>
        <Tooltip content={{ title: S.insertFunction, shortcut: 'Maj+F3' }}>
          <button type="button" className="xl-fx" aria-label={S.insertFunction} onClick={p.onInsertFunction}><i>fx</i></button>
        </Tooltip>
      </div>
      <FormulaInput
        ref={ref}
        className="xl-fbar__input"
        value={p.text}
        ariaLabel={S.formulaBar}
        assist={p.editing}
        multiline
        onFocus={p.onFocusEdit}
        onChange={p.onChange}
        onKeyDown={p.onKeyDown}
        onCaret={p.onCaret}
        onFunctionHelp={p.onFunctionHelp}
      />
      <button type="button" className="xl-fbar__expand" aria-label={S.expandFormulaBar} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        <Icon name={expanded ? 'chevron_up' : 'chevron_down'} size={16} />
      </button>
    </div>
  );
});
