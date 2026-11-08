// Volet Styles : liste avec apercu, Nouveau style, Modifier, Supprimer, Mettre a jour d'apres la selection, Effacer tout.
import { useState } from 'react';
import { Button, Icon } from '@forgeoffice/ui';
import { readDocx, styleDisplayName, writeDocx, type Style } from '@forgeoffice/docx';
import { mergeStyles, stylesDocument } from './transfer.ts';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { runCss } from '../editor/css.ts';
import { setParagraph, clearRunFormatting } from '../editor/commands.ts';
import { styleObject } from '../dialogs/text.tsx';
import { describeParagraph, describeRun } from './inspect.ts';
import { canDelete, removeStyle, updateStyle } from './ops.ts';
import { resetStyleUsers, styleFromSelection } from './fromSelection.ts';

const S = X.styles;
const styleName = (s: Style | undefined): string | undefined => (s ? styleDisplayName(s) : undefined);

export function StylesPane({ c }: { c: Ctl }) {
  const [preview, setPreview] = useState(true);
  const current = c.sel.charStyle ?? c.sel.styleId;
  const styles = c.meta.styles.styles.filter((s) => (s.type === 'paragraph' || s.type === 'character') && !s.hidden && (!s.semiHidden || s.quickFormat))
    .sort((a, b) => styleDisplayName(a).localeCompare(styleDisplayName(b), 'fr'));
  const clearAll = (): void => {
    c.run(clearRunFormatting);
    c.run(setParagraph({ styleId: null, props: (p) => (p.numbering ? { numbering: p.numbering } : {}) }));
  };
  const update = (id: string): void => {
    const state = c.state();
    if (!state) return;
    const { paragraph, run } = styleFromSelection(state);
    const { numbering: _n, tabs: _t, ...para } = paragraph;
    c.updateMeta((m) => updateStyle(m, id, { paragraph: para, run }));
    c.notify(S.updated, 'success');
  };
  const remove = (id: string): void => {
    c.run(resetStyleUsers(id));
    c.updateMeta((m) => removeStyle(m, id));
    c.notify(S.removed, 'info');
  };
  const exportStyles = async (): Promise<void> => {
    try {
      const bytes = await writeDocx(stylesDocument(c.meta));
      const saved = await c.services.saveFile(bytes, `${S.exportName}.docx`, [{ name: S.fileKind, extensions: ['docx'] }], null);
      if (saved) c.notify(S.exported(saved.name), 'success');
    } catch (err) {
      c.notify(String(err instanceof Error ? err.message : err), 'error');
    }
  };
  const importStyles = async (): Promise<void> => {
    try {
      const file = await c.services.openFile([{ name: S.fileKind, extensions: ['docx', 'dotx'] }]);
      if (!file) return;
      const { document } = await readDocx(file.bytes);
      const out = mergeStyles(c.meta, document, 'replace');
      c.updateMeta(() => out.meta);
      c.notify(S.imported(out.added, out.replaced), 'success');
    } catch (err) {
      c.notify(String(err instanceof Error ? err.message : err), 'error');
    }
  };
  return (
    <div className="fo-word-styles-pane">
      <div className="fo-word-styles__bar">
        <Button onClick={() => c.openDialog('style')}>{S.newStyle}</Button>
        <Button onClick={clearAll}>{S.clearAll}</Button>
        <Button onClick={() => void importStyles()}>{S.import}</Button>
        <Button onClick={() => void exportStyles()}>{S.export}</Button>
      </div>
      <section className="fo-word-inspector" aria-label={S.inspector}>
        <h3>{S.inspector}</h3>
        <dl>
          <dt>{S.paraStyle}</dt><dd data-testid="insp-style">{styleName(c.meta.styles.styles.find((s) => s.id === c.sel.styleId)) ?? c.sel.styleId}</dd>
          <dt>{S.paraDirect}</dt><dd data-testid="insp-para">{describeParagraph(c.sel.directPara).join(' ; ') || S.nothing}</dd>
          <dt>{S.charStyle}</dt><dd>{c.sel.charStyle ? styleName(c.meta.styles.styles.find((s) => s.id === c.sel.charStyle)) ?? c.sel.charStyle : S.nothing}</dd>
          <dt>{S.charDirect}</dt><dd data-testid="insp-run">{describeRun(c.sel.directRun).join(' ; ') || S.nothing}</dd>
        </dl>
      </section>
      <label className="fo-word-check"><input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />{S.preview}</label>
      <ul className="fo-word-styles">
        {styles.map((s) => (
          <li key={s.id} data-style-id={s.id}>
            <button type="button" className={s.id === current ? 'is-active' : ''} onClick={() => c.act.applyStyle(s.id)}>
              <span style={preview ? styleObject(runCss({ ...s.run, size: Math.min(s.run?.size ?? 11, 16) }).replace(/display:none/, '')) : undefined}>{styleDisplayName(s)}</span>
              <span className="fo-word-styles__kind" aria-hidden="true">{s.type === 'paragraph' ? '¶' : 'a'}</span>
            </button>
            <span className="fo-word-styles__tools">
              <button type="button" aria-label={`${S.modify} ${styleDisplayName(s)}`} title={S.modify} onClick={() => { c.setUi({ styleEdit: s.id }); c.openDialog('styleEdit'); }}><Icon name="edit" size={14} /></button>
              <button type="button" aria-label={`${S.updateFromSel} ${styleDisplayName(s)}`} title={S.updateFromSel} onClick={() => update(s.id)}><Icon name="arrow_sync" size={14} /></button>
              {canDelete(s) && <button type="button" aria-label={`${S.remove} ${styleDisplayName(s)}`} title={S.remove} onClick={() => remove(s.id)}><Icon name="delete" size={14} /></button>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
