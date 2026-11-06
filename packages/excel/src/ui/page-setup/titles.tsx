// Onglet Feuille : zone d'impression, lignes/colonnes a repeter, quadrillage, noir et blanc, brouillon, en-tetes,
// commentaires, erreurs, ordre des pages.
import { Button, Checkbox } from '@forgeoffice/ui';
import { rangeName } from '@forgeoffice/xlsx';
import { printAreaText, titleColsText, titleRowsText } from '../../logic/pagesetup.ts';
import { activeRange } from '../../logic/selection.ts';
import type { DialogEnv } from '../registry.ts';
import type { TabProps } from './types.ts';
import { PS } from '../../strings/index.ts';

export interface SheetTexts { area: string; rows: string; cols: string }

interface Props extends TabProps {
  x: DialogEnv;
  /** Saisies en cours (null = valeurs enregistrees, non modifiees). */
  text: SheetTexts | null;
  setText: (t: SheetTexts) => void;
}

export function SheetTab({ d, up, x, text, setText }: Props) {
  const t: SheetTexts = text ?? { area: printAreaText(d.printArea), rows: titleRowsText(d.printTitleRows), cols: titleColsText(d.printTitleCols) };
  const field = (key: keyof SheetTexts, label: string, selectionText: () => string) => (
    <div className="ps-field">
      <label htmlFor={`ps-${key}`}>{label}</label>
      <div className="ps-pick">
        <input id={`ps-${key}`} className="xl-textarea ps-text" type="text" value={t[key]} spellCheck={false} onChange={(e) => setText({ ...t, [key]: e.target.value })} />
        <Button onClick={() => setText({ ...t, [key]: selectionText() })}>{PS.useSelection}</Button>
        <Button appearance="subtle" onClick={() => setText({ ...t, [key]: '' })}>{PS.clear}</Button>
      </div>
    </div>
  );
  const sel = () => activeRange(x.sel);
  return (
    <div className="ps-form">
      <div className="ps-sheetform">
        {field('area', PS.printArea, () => rangeName(sel(), true))}
        {field('rows', PS.titleRows, () => titleRowsText({ first: sel().r1, last: sel().r2 }))}
        {field('cols', PS.titleCols, () => titleColsText({ first: sel().c1, last: sel().c2 }))}
      </div>
      <fieldset className="xl-fs">
        <legend>{PS.print_}</legend>
        <Checkbox checked={!!d.printGridLines} onChange={(v) => up({ printGridLines: v || undefined })} label={PS.gridlines} />
        <Checkbox checked={!!d.blackAndWhite} onChange={(v) => up({ blackAndWhite: v || undefined })} label={PS.blackWhite} />
        <Checkbox checked={!!d.draft} onChange={(v) => up({ draft: v || undefined })} label={PS.draft} />
        <Checkbox checked={!!d.printHeadings} onChange={(v) => up({ printHeadings: v || undefined })} label={PS.headings} />
        <div className="xl-form">
          <label htmlFor="ps-comments">{PS.comments}</label>
          <select id="ps-comments" value={d.cellComments ?? 'none'} onChange={(e) => up({ cellComments: e.target.value === 'none' ? undefined : (e.target.value as 'asDisplayed' | 'atEnd') })}>
            <option value="none">{PS.commentsNone}</option>
            <option value="asDisplayed">{PS.commentsAsDisplayed}</option>
            <option value="atEnd">{PS.commentsAtEnd}</option>
          </select>
          <label htmlFor="ps-errors">{PS.errors}</label>
          <select id="ps-errors" value={d.errors ?? 'displayed'} onChange={(e) => up({ errors: e.target.value === 'displayed' ? undefined : (e.target.value as 'blank' | 'dash' | 'NA') })}>
            <option value="displayed">{PS.errorsDisplayed}</option>
            <option value="blank">{PS.errorsBlank}</option>
            <option value="dash">{PS.errorsDash}</option>
            <option value="NA">{PS.errorsNA}</option>
          </select>
        </div>
      </fieldset>
      <fieldset className="xl-fs">
        <legend>{PS.pageOrder}</legend>
        <label className="xl-radio"><input type="radio" name="ps-order" checked={d.pageOrder !== 'overThenDown'} onChange={() => up({ pageOrder: undefined })} />{PS.downThenOver}</label>
        <label className="xl-radio"><input type="radio" name="ps-order" checked={d.pageOrder === 'overThenDown'} onChange={() => up({ pageOrder: 'overThenDown' })} />{PS.overThenDown}</label>
      </fieldset>
    </div>
  );
}
