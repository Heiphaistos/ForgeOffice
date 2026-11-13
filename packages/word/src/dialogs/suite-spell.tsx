// Outils > Orthographe (dispositions LibreOffice / OpenOffice) : meme boite que la vraie suite (mot absent du dictionnaire, suggestions, colonne de boutons).
import { useMemo, useState } from 'react';
import { Dialog, suiteDialogKind } from '@forgeoffice/ui';
import { TextSelection } from 'prosemirror-state';
import type { Ctl } from '../app/types.ts';
import { ignoreWord, paragraphLanguage, setParagraphLanguage } from '../editor/lang.ts';
import { addToDictionary, changeAll, DICTIONARY_SETTING, ignoreAll, personalWords, scanSuspects } from '../features/dictionary.ts';
import { LANGUAGES } from '../features/spelling.ts';
import { SD } from '../strings-suite.ts';
import { Select } from './common.tsx';

const S = SD.spell;

export function SpellSuiteDialog({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const oo = suiteDialogKind() === 'openoffice';
  const [tick, setTick] = useState(0);
  const [choice, setChoice] = useState(0);
  const stored = c.services.settings.get<string[]>(DICTIONARY_SETTING, []);
  const suspects = useMemo(() => {
    const state = c.state();
    return state ? scanSuspects(state.doc, personalWords(stored)) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcule apres chaque action
  }, [tick]);
  const cur = suspects[0];
  const state = c.state();
  const lang = state ? paragraphLanguage(state) : undefined;
  const after = (): void => { setTick((t) => t + 1); setChoice(0); };
  const sentence = (): string => {
    const r = cur?.ranges[0];
    return r && state ? state.doc.textBetween(Math.max(0, r.from - 25), Math.min(state.doc.content.size, r.to + 25), ' ', ' ') : '';
  };
  const goTo = (): void => {
    const v = c.view();
    const r = cur?.ranges[0];
    if (v && r) v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, r.from, r.to)).scrollIntoView());
  };
  const replacement = cur?.suggestions[choice] ?? '';
  const btn = (label: string, on: () => void, disabled: boolean, title?: string) => <button type="button" className="fo-sbtn" disabled={disabled} title={title} onClick={on}>{label}</button>;
  const cols = (
    <div className="fo-sdlg__spell">
      <div>
        <div className="fo-sdlg__spelltitle">{S.unknown}</div>
        <div className="fo-sdlg__spellword" aria-live="polite" onMouseEnter={goTo}>{cur ? sentence() : S.done}</div>
        <div className="fo-sdlg__spelltitle">{S.suggestions}</div>
        <select size={6} className="fo-sdlg__list" aria-label={S.suggestions} value={String(choice)} onChange={(e) => setChoice(Number(e.target.value))} disabled={!cur}>
          {(cur?.suggestions ?? []).map((s, i) => <option key={s} value={i}>{s}</option>)}
        </select>
        <div className="fo-sdlg__field" style={{ ['--lw' as string]: '110px' }}>
          <span>{S.language}</span>
          <Select value={lang === null ? 'none' : lang ?? 'fr-FR'} label={S.language} options={LANGUAGES.map((l): [string, string] => [l.tag, l.name])} onChange={(v) => { c.run(setParagraphLanguage(v)); setTick((t) => t + 1); }} />
        </div>
      </div>
      <div className="fo-sdlg__findcol">
        {btn(S.ignoreOnce, () => { const r = cur?.ranges[0]; if (r) c.run(ignoreWord(r.from, r.to)); after(); }, !cur)}
        {btn(S.ignoreAll, () => { if (cur) c.run(ignoreAll(cur.word)); after(); }, !cur)}
        {btn(S.add, () => { if (!cur) return; c.services.settings.set(DICTIONARY_SETTING, addToDictionary(stored, cur.word)); c.run(ignoreAll(cur.word)); after(); }, !cur)}
        {btn(S.replace, () => { const r = cur?.ranges[0]; if (r && replacement) { c.run((s, d) => { if (d) d(s.tr.insertText(replacement, r.from, r.to)); return true; }); after(); } }, !cur || !replacement)}
        {btn(S.replaceAll, () => { if (cur && replacement) { c.run(changeAll(cur.word, replacement)); after(); } }, !cur || !replacement)}
        {btn(S.autoCorrect, () => undefined, true, SD.na)}
        {btn(S.options, () => undefined, true, SD.na)}
      </div>
    </div>
  );
  return (
    <Dialog open title={`${S.title} : ${LANGUAGES.find((l) => l.tag === (lang ?? 'fr-FR'))?.name ?? 'Français (France)'}`} onClose={onClose} width={oo ? 560 : 620} actions={[{ label: SD.close, primary: true, onClick: onClose }]}>
      {cols}
    </Dialog>
  );
}
