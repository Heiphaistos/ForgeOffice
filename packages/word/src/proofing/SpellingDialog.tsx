// Boite « Orthographe » : mots suspects du document, Changer / Changer tout / Ignorer / Ignorer tout / Ajouter au dictionnaire, langue.
import { useMemo, useState } from 'react';
import { Button, Dialog } from '@forgeoffice/ui';
import { TextSelection } from 'prosemirror-state';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { Check, Row, Select } from '../dialogs/common.tsx';
import { ignoreWord, setParagraphLanguage, paragraphLanguage } from '../editor/lang.ts';
import { addToDictionary, changeAll, DICTIONARY_SETTING, ignoreAll, personalWords, scanSuspects } from '../features/dictionary.ts';
import { LANGUAGES } from '../features/spelling.ts';
import { checkDocument, type GrammarIssue } from '../features/grammar.ts';

const D = T.dialogs;
const P = X.proofing;

export function SpellingDialog({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const [tick, setTick] = useState(0);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState(0);
  const [gi, setGi] = useState(0);
  const stored = c.services.settings.get<string[]>(DICTIONARY_SETTING, []);
  const suspects = useMemo(() => {
    const state = c.state();
    return state ? scanSuspects(state.doc, personalWords(stored)) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcule apres chaque action
  }, [tick]);
  const issues = useMemo<GrammarIssue[]>(() => {
    const state = c.state();
    return state ? checkDocument(state.doc) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcule apres chaque action
  }, [tick]);
  const issue = issues[Math.min(gi, issues.length - 1)];
  const fixIssue = (i: GrammarIssue): void => { c.run((s, d) => { if (d) d(s.tr.insertText(i.fix, i.from, i.to)); return true; }); };
  const fixAll = (): void => {
    c.run((s, d) => {
      if (d) {
        const tr = s.tr;
        for (const i of [...issues].reverse()) tr.insertText(i.fix, i.from, i.to);
        d(tr);
      }
      return true;
    });
  };
  const cur = suspects[Math.min(index, suspects.length - 1)];
  const langState = c.state();
  const lang = langState ? paragraphLanguage(langState) : undefined;
  const after = (): void => { setTick((t) => t + 1); setIndex(0); setChoice(0); };
  const goTo = (): void => {
    const v = c.view();
    const r = cur?.ranges[0];
    if (v && r) v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, r.from, r.to)).scrollIntoView());
  };
  const replacement = cur?.suggestions[choice] ?? '';
  const addWord = (): void => {
    if (!cur) return;
    c.services.settings.set(DICTIONARY_SETTING, addToDictionary(stored, cur.word));
    c.run(ignoreAll(cur.word));
    after();
  };
  return (
    <Dialog open title={D.spellingTitle} onClose={onClose} width={520} actions={[{ label: D.close, primary: true, onClick: onClose }]}>
      <Check label={c.ui.spell ? D.spellOn : D.spellOff} checked={c.ui.spell} onChange={(spell) => c.setUi({ spell })} />
      <div className="fo-word-form">
        <Row label={P.unknown}>
          <select className="fo-word-select fo-word-listbox" size={5} aria-label={P.unknown} value={String(Math.min(index, Math.max(0, suspects.length - 1)))} onChange={(e) => { setIndex(Number(e.target.value)); setChoice(0); }}>
            {suspects.map((s, i) => <option key={s.word} value={i}>{`${s.word} (${s.ranges.length})`}</option>)}
          </select>
        </Row>
        {suspects.length === 0 && <p className="fo-word-hint">{P.none}</p>}
        {cur && (
          <Row label={P.suggestions}>
            <Select value={String(choice)} label={P.suggestions} options={cur.suggestions.map((s, i): [string, string] => [String(i), s])} onChange={(v) => setChoice(Number(v))} />
          </Row>
        )}
      </div>
      <div className="fo-word-tabbtns fo-word-spellbtns">
        <Button disabled={!cur} onClick={goTo}>{P.goTo}</Button>
        <Button disabled={!cur || !replacement} onClick={() => { const r = cur!.ranges[0]!; c.run((s, d) => { if (d) d(s.tr.insertText(replacement, r.from, r.to)); return true; }); after(); }}>{P.change}</Button>
        <Button disabled={!cur || !replacement} onClick={() => { c.run(changeAll(cur!.word, replacement)); after(); }}>{P.changeAll}</Button>
        <Button disabled={!cur} onClick={() => { const r = cur!.ranges[0]!; c.run(ignoreWord(r.from, r.to)); after(); }}>{P.ignoreOnce}</Button>
        <Button disabled={!cur} onClick={() => { if (cur) c.run(ignoreAll(cur.word)); after(); }}>{P.ignoreAll}</Button>
        <Button disabled={!cur} onClick={addWord}>{P.addToDictionary}</Button>
      </div>
      <fieldset className="fo-word-fieldset">
        <legend>{P.grammar}</legend>
        <select className="fo-word-select fo-word-listbox fo-word-listbox--short" size={4} aria-label={P.grammar} value={String(Math.min(gi, Math.max(0, issues.length - 1)))} onChange={(e) => setGi(Number(e.target.value))}>
          {issues.map((i, k) => <option key={`${i.from}-${i.rule}`} value={k}>{`${i.message} — ${c.state()?.doc.textBetween(Math.max(0, i.from - 12), Math.min(c.state()!.doc.content.size, i.to + 12), ' ', ' ') ?? ''}`}</option>)}
        </select>
        {issues.length === 0 && <p className="fo-word-hint">{P.grammarNone}</p>}
        <div className="fo-word-tabbtns fo-word-spellbtns">
          <Button disabled={!issue} onClick={() => { if (issue) fixIssue(issue); after(); }}>{P.fix}</Button>
          <Button disabled={issues.length === 0} onClick={() => { fixAll(); after(); }}>{P.fixAll}</Button>
        </div>
        <p className="fo-word-hint">{P.grammarLimit}</p>
      </fieldset>
      <Row label={P.language}>
        <Select value={lang === null ? 'none' : lang ?? 'fr-FR'} label={P.language}
          options={[...LANGUAGES.map((l): [string, string] => [l.tag, l.name]), ['none', T.ctx.noProof]]}
          onChange={(v) => { c.run(setParagraphLanguage(v === 'none' ? null : v)); setTick((t) => t + 1); }} />
      </Row>
      <p className="fo-word-hint">{P.dictionaryCount(stored.length)}{stored.length > 0 && <> <Button onClick={() => { c.services.settings.set(DICTIONARY_SETTING, []); setTick((t) => t + 1); }}>{P.clearDictionary}</Button></>}</p>
    </Dialog>
  );
}
