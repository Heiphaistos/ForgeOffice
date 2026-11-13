// Barre de formule : zone Nom (adresse, plages nommees, saisie d'une reference), boutons Annuler / Entrer /
// Inserer une fonction, champ de saisie extensible.
import { forwardRef, useEffect, useState, type KeyboardEvent } from 'react';
import { Icon, Tooltip } from '@forgeoffice/ui';
import { FormulaInput, type FormulaInputHandle } from './FormulaInput.tsx';
import type { FnInfo } from '../logic/formula-ui.ts';
import { S, RB } from '../strings/index.ts';
import { TOGGLE_FORMULA_BAR } from './keys-zones.ts';
import { useSuiteKind } from './suiteKind.ts';

export interface FormulaBarProps {
  address: string;
  /** Dispositions LibreOffice / OpenOffice : la zone Nom affiche la plage selectionnee (« B3:D5 »). */
  rangeAddress?: string;
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
  /** Dispositions LibreOffice / OpenOffice : bouton Somme (et sa liste) et bouton « = » de la barre de formule. */
  onSum?: (fn: 'SUM' | 'AVERAGE' | 'COUNT' | 'MAX' | 'MIN') => void;
  onEqual?: () => void;
}

export const FormulaBar = forwardRef<FormulaInputHandle, FormulaBarProps>(function FormulaBar(p, ref) {
  const [box, setBox] = useState(p.address);
  const [expanded, setExpanded] = useState(false);
  const suiteNow = useSuiteKind();
  const shown = suiteNow && !p.editing && p.rangeAddress ? p.rangeAddress : p.address;
  useEffect(() => setBox(shown), [shown]);
  // Ctrl+Maj+U (raccourci de la grille ou de la saisie) : developper / reduire la barre de formule.
  useEffect(() => {
    const on = (): void => setExpanded((v) => !v);
    window.addEventListener(TOGGLE_FORMULA_BAR, on);
    return () => window.removeEventListener(TOGGLE_FORMULA_BAR, on);
  }, []);
  const suite = useSuiteKind();
  const [sumMenu, setSumMenu] = useState(false);
  const wand = suite === 'openoffice';
  return (
    <div className={`xl-fbar${expanded ? ' is-expanded' : ''}${suite ? ' xl-fbar--suite' : ''}`}>
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
            } else if (e.key === 'Escape') setBox(shown);
          }}
        />
        <datalist id="xl-names">{p.names.map((n) => <option key={n} value={n} />)}</datalist>
        {suite && <span className="xl-namebox__drop" aria-hidden="true"><Icon name="chevron_down" size={12} /></span>}
      </div>
      <div className="xl-fbar__btns">
        {suite && (
          <Tooltip content={{ title: S.insertFunction, shortcut: 'Maj+F3' }}>
            <button type="button" className={`xl-fx xl-fx--suite${wand ? ' is-wand' : ''}`} aria-label={S.insertFunction} onClick={p.onInsertFunction}><i>fx</i></button>
          </Tooltip>
        )}
        {suite && !p.editing && (
          <>
            <span className="xl-fsum">
              <button type="button" className="xl-fsum__btn" aria-label={RB.autoSum} title={RB.autoSum} onClick={() => p.onSum?.('SUM')}>{'Σ'}</button>
              <button type="button" className="xl-fsum__caret" aria-label={RB.autoSum} aria-expanded={sumMenu} onClick={() => setSumMenu(!sumMenu)}><Icon name="chevron_down" size={10} /></button>
              {sumMenu && (
                <span className="xl-fsum__menu" role="menu" onMouseLeave={() => setSumMenu(false)}>
                  {([['SUM', RB.sum], ['AVERAGE', RB.average], ['COUNT', RB.countNumbers], ['MAX', RB.max], ['MIN', RB.min]] as const).map(([fn, label]) => (
                    <button key={fn} type="button" role="menuitem" onClick={() => { setSumMenu(false); p.onSum?.(fn); }}>{label}</button>
                  ))}
                </span>
              )}
            </span>
            <button type="button" className="xl-feq" aria-label={S.formulaBar} title={S.formulaBar} onClick={p.onEqual}>=</button>
          </>
        )}
        <Tooltip content={{ title: S.cancelEdit }}>
          <button type="button" className="xl-fbar__cancel" aria-label={S.cancelEdit} disabled={!p.editing} onClick={p.onCancel}><Icon name="dismiss" size={16} /></button>
        </Tooltip>
        <Tooltip content={{ title: S.confirmEdit }}>
          <button type="button" className="xl-fbar__confirm" aria-label={S.confirmEdit} disabled={!p.editing} onClick={p.onConfirm}><Icon name="checkmark" size={16} /></button>
        </Tooltip>
        {!suite && (
          <Tooltip content={{ title: S.insertFunction, shortcut: 'Maj+F3' }}>
            <button type="button" className="xl-fx" aria-label={S.insertFunction} onClick={p.onInsertFunction}><i>fx</i></button>
          </Tooltip>
        )}
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
