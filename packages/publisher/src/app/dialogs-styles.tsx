// Volet Styles : styles de texte nommes de la publication (creer d'apres la selection, appliquer, mettre a jour, renommer, supprimer).
import { useState } from 'react';
import { Button, Dialog, TextField } from '@forgeoffice/ui';
import { readFopub } from '../fopub.ts';
import { mergeStyles, removeStyle, renameStyle, saveStyle, setBasedOn, updateStyle, type NamedStyle } from '../styles.ts';
import { S } from '../strings.ts';
import type { Editor } from './editor.ts';
import { applyStyle } from './stylesops.ts';
import { currentParagraph, currentRun } from './ops.ts';

function Row({ ed, style }: { ed: Editor; style: NamedStyle }) {
  const [name, setName] = useState(style.name);
  const commit = (styles: NamedStyle[]): void => ed.commitPub({ ...ed.pub, styles }, 'styles');
  return (
    <div className="pub-stylerow" data-testid={`style-row-${style.id}`}>
      <TextField value={name} aria-label={S.dialogs.styles.name} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name !== style.name) commit(renameStyle(ed.pub.styles, style.id, name)); }} />
      <select value={style.basedOn ?? ''} aria-label={S.dialogs.styles.basedOn} title={S.dialogs.styles.basedOn} onChange={(e) => commit(setBasedOn(ed.pub.styles, style.id, e.target.value || null))}>
        <option value="">{S.dialogs.styles.noBase}</option>
        {ed.pub.styles.filter((s) => s.id !== style.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <Button size="small" onClick={() => applyStyle(ed, style)}>{S.dialogs.styles.apply}</Button>
      <Button size="small" onClick={() => commit(updateStyle(ed.pub.styles, style.id, currentRun(ed), currentParagraph(ed)))}>{S.dialogs.styles.update}</Button>
      <Button size="small" onClick={() => commit(removeStyle(ed.pub.styles, style.id))}>{S.dialogs.styles.remove}</Button>
    </div>
  );
}

export function StylesDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [name, setName] = useState('');
  const create = (): void => {
    if (!name.trim()) return;
    ed.commitPub({ ...ed.pub, styles: saveStyle(ed.pub.styles, name, currentRun(ed), currentParagraph(ed)) }, 'styles');
    setName('');
  };
  const importStyles = async (): Promise<void> => {
    const file = await ed.services.openFile([{ name: S.file.openFilter, extensions: ['fopub'] }]);
    if (!file) return;
    try {
      const doc = await readFopub(file.bytes);
      if (!doc.pub.styles.length) {
        ed.notify(S.dialogs.styles.importNone(file.name), 'warning');
        return;
      }
      ed.commitPub({ ...ed.pub, styles: mergeStyles(ed.pub.styles, doc.pub.styles) }, 'styles');
      ed.notify(S.dialogs.styles.imported(doc.pub.styles.length, file.name), 'success');
    } catch (err) {
      ed.notify(`${S.app.openFailed(file.name)} ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };
  const exists = ed.pub.styles.some((s) => s.name === name.trim());
  return (
    <Dialog open title={S.dialogs.styles.title} onClose={onClose} onConfirm={onClose} width={640}>
      <div className="pub-form" data-testid="styles-dialog">
        <div className="pub-stylerow">
          <TextField value={name} placeholder={S.dialogs.styles.name} aria-label={S.dialogs.styles.name} onChange={(e) => setName(e.target.value)} data-autofocus />
          <Button appearance="primary" size="small" disabled={!name.trim()} onClick={create}>{S.dialogs.styles.create}</Button>
        </div>
        {exists && <small>{S.dialogs.styles.exists}</small>}
        <div className="pub-stylerow"><strong>{S.dialogs.styles.custom}</strong><Button size="small" onClick={() => void importStyles()}>{S.dialogs.styles.import}</Button></div>
        {ed.pub.styles.length ? ed.pub.styles.map((s) => <Row key={s.id} ed={ed} style={s} />) : <small>{S.dialogs.styles.none}</small>}
      </div>
    </Dialog>
  );
}
