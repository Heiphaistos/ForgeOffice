// Volet « Sélection » : liste des formes, zones de texte et images ; sélection, ordre d'empilement des objets flottants.
import { Button } from '@forgeoffice/ui';
import { NodeSelection } from 'prosemirror-state';
import type { Inline } from '@forgeoffice/docx';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { updateAtom } from '../editor/commands.ts';
import { listObjects } from './list.ts';

const O = X.objects;

export function SelectionPane({ c }: { c: Ctl }) {
  const state = c.state();
  if (!state) return null;
  const objects = listObjects(state.doc);
  const current = c.sel.shape?.pos ?? c.sel.image?.pos;
  const pick = (pos: number): void => {
    const v = c.view();
    if (v) v.dispatch(v.state.tr.setSelection(NodeSelection.create(v.state.doc, pos)).scrollIntoView());
  };
  const z = (pos: number, delta: number): void => {
    const d = state.doc.nodeAt(pos)?.attrs.data as Inline | undefined;
    if (d && (d.type === 'shape' || d.type === 'image') && d.floating) c.run(updateAtom(pos, { ...d, floating: { ...d.floating, zIndex: Math.max(0, d.floating.zIndex + delta) } }));
  };
  return (
    <div className="fo-word-objects">
      {objects.length === 0 && <p className="fo-word-pane__empty">{O.noObjects}</p>}
      <ul className="fo-word-objlist">
        {objects.map((o) => (
          <li key={o.pos} className={o.pos === current ? 'is-active' : ''}>
            <button type="button" className="fo-word-objlist__go" onClick={() => pick(o.pos)}>{o.label}<span>{o.floating ? O.floatingTag : O.inlineTag}</span></button>
            {o.floating && <span className="fo-word-objlist__btns"><Button onClick={() => z(o.pos, 1)}>{O.bringForward}</Button><Button onClick={() => z(o.pos, -1)}>{O.sendBackward}</Button></span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
