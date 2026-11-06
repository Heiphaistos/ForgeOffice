// Selecteur de plage (bouton de reduction de boite de dialogue) : la boite modale est remplacee par une barre flottante, la grille
// reste utilisable ; la selection courante s'y affiche en direct et « OK » la rend a la boite.
import { createPortal } from 'react-dom';
import { Button } from '@forgeoffice/ui';
import { quoteSheetName } from '@forgeoffice/formulas';
import { rangeName } from '@forgeoffice/xlsx';
import { activeRange, type Selection } from '../../logic/selection.ts';
import { FM } from '../../strings/index.ts';
import './formulas.css';

/** Reference absolue de la selection courante : « Feuil1!$A$1:$B$4 ». */
export function selectionRef(sheetName: string, sel: Selection, withSheet = true): string {
  const body = rangeName(activeRange(sel), true);
  return withSheet ? `${quoteSheetName(sheetName)}!${body}` : body;
}

export function RangePickBar({ text, onOk, onCancel }: { text: string; onOk: () => void; onCancel: () => void }) {
  return createPortal(
    <div className="xlf-pick" role="group" aria-label={FM.pick.button} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}>
      <span className="xlf-pick__hint">{FM.pick.hint}</span>
      <div className="xlf-pick__row">
        <input readOnly value={text} aria-label={FM.pick.button} />
        <Button appearance="primary" onClick={onOk}>{FM.pick.ok}</Button>
        <Button onClick={onCancel}>{FM.pick.cancel}</Button>
      </div>
    </div>,
    document.body,
  );
}

/** Bouton « reduire la boite » place dans un champ de saisie. */
export function PickButton({ onClick }: { onClick: () => void }) {
  return <Button appearance="subtle" size="small" icon="cursor" aria-label={FM.pick.button} title={FM.pick.button} onClick={onClick} />;
}
