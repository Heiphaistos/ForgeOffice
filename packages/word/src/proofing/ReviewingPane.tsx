// Volet « Vérifications » : toutes les modifications suivies, avec Accepter / Refuser / Aller par relecteur.
import { useState } from 'react';
import { Button } from '@forgeoffice/ui';
import { TextSelection } from 'prosemirror-state';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { Select } from '../dialogs/common.tsx';
import { resolveRevisions } from '../editor/track.ts';
import { countByKind, listRevisions, reviewers } from './revisions.ts';

const R = X.reviewing;

export function ReviewingPane({ c }: { c: Ctl }) {
  const [who, setWho] = useState('');
  const state = c.state();
  if (!state) return null;
  const all = listRevisions(state.doc);
  const items = who ? all.filter((i) => i.author === who) : all;
  const n = countByKind(items);
  const go = (from: number, to: number): void => {
    const v = c.view();
    if (v) v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, from, to)).scrollIntoView());
  };
  const decide = (decision: 'accept' | 'reject', from: number, to: number): void => {
    const v = c.view();
    if (v) v.dispatch(resolveRevisions(v.state, decision, from, to));
  };
  return (
    <div className="fo-word-reviewing">
      <p className="fo-word-reviewing__count" role="status">{R.summary(n.insert, n.delete)}</p>
      <Select value={who} label={R.reviewer} options={[['', R.everyone], ...reviewers(all).map((a): [string, string] => [a, a])]} onChange={setWho} />
      {items.length === 0 && <p className="fo-word-pane__empty">{R.none}</p>}
      <ul className="fo-word-revlist">
        {items.map((i) => (
          <li key={`${i.id}-${i.from}`} className={`is-${i.kind}`}>
            <button type="button" className="fo-word-revlist__go" onClick={() => go(i.from, i.to)}>
              <strong>{i.kind === 'insert' ? R.inserted : i.kind === 'delete' ? R.deleted : R.moved}</strong> · {i.author}
              <span className="fo-word-revlist__text">{i.text}</span>
            </button>
            <span className="fo-word-revlist__btns">
              <Button onClick={() => decide('accept', i.from, i.to)}>{R.accept}</Button>
              <Button onClick={() => decide('reject', i.from, i.to)}>{R.reject}</Button>
            </span>
          </li>
        ))}
      </ul>
      {items.length > 0 && (
        <div className="fo-word-tabbtns">
          <Button onClick={() => decide('accept', 0, state.doc.content.size)}>{R.acceptAll}</Button>
          <Button onClick={() => decide('reject', 0, state.doc.content.size)}>{R.rejectAll}</Button>
        </div>
      )}
    </div>
  );
}
