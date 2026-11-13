// Panneau « Rechercher et remplacer » du profil OnlyOffice : colonne de 300 px a droite du rail gauche (pas une boite modale), comme l'application reelle.
// Memes moteurs que la boite d'origine (findMatches / replaceMatches) ; le document est decale a droite tant que le panneau est ouvert.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { TextSelection } from 'prosemirror-state';
import { Icon } from '@forgeoffice/ui';
import type { Ctl } from '../app/types.ts';
import { findMatches, nextMatch, replaceMatches, buildRegex, type FindOptions } from '../editor/find.ts';
import { searchKey } from '../editor/plugins.ts';

const WIDTH = 300;

export function OoSearchPanel({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const [q, setQ] = useState(c.sel.text.split('\n')[0] ?? '');
  const [rep, setRep] = useState('');
  const [opts, setOpts] = useState<FindOptions>({});
  const [cur, setCur] = useState(-1);
  const [msg, setMsg] = useState('');
  const doc = c.state()?.doc;
  const matches = useMemo(() => (doc && q ? findMatches(doc, q, opts) : []), [doc, q, opts]);
  const bad = !!q && !!opts.regex && !buildRegex(q, opts);
  const rail = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.fo-oo-rail--left');
  const left = rail?.offsetWidth ?? 40;
  const top = rail ? Math.round(rail.getBoundingClientRect().top) : 0;
  const bottom = rail ? Math.max(0, window.innerHeight - Math.round(rail.getBoundingClientRect().bottom)) : 0;

  // Reserve la place du panneau a gauche du document.
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('[data-oo-dock]');
    shell?.style.setProperty('--fo-oo-left', `${left + WIDTH}px`);
    return () => { shell?.style.setProperty('--fo-oo-left', `${left}px`); };
  }, [left]);

  // Echap ferme le panneau meme quand le focus est ailleurs (une boite modale le fait deja).
  useEffect(() => {
    const on = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [onClose]);

  const paint = (list = matches, i = cur): void => {
    const v = c.view();
    if (!v) return;
    const tr = v.state.tr.setMeta(searchKey, { matches: list, current: i });
    const m = list[i];
    if (m) tr.setSelection(TextSelection.create(v.state.doc, m.from, m.to)).scrollIntoView();
    v.dispatch(tr);
  };
  // Surlignage en direct pendant la frappe.
  useEffect(() => { paint(matches, -1); setCur(-1); setMsg(''); }, [matches]);
  useEffect(() => () => { const v = c.view(); v?.dispatch(v.state.tr.setMeta(searchKey, { matches: [], current: -1 })); }, []);

  const go = (back: boolean): void => {
    const v = c.view();
    if (!v || !matches.length) return;
    const i = nextMatch(matches, back ? v.state.selection.from : v.state.selection.to, back);
    setCur(i);
    paint(matches, i);
  };
  const replaceOne = (): void => {
    const v = c.view();
    const m = v && matches.find((x) => x.from === v.state.selection.from && x.to === v.state.selection.to);
    if (v && m) {
      const tr = v.state.tr;
      replaceMatches(tr, [m], q, rep, opts);
      v.dispatch(tr);
    }
    go(false);
  };
  const replaceAll = (): void => {
    const v = c.view();
    if (!v) return;
    const tr = v.state.tr;
    const n = replaceMatches(tr, matches, q, rep, opts);
    v.dispatch(tr.setMeta(searchKey, { matches: [], current: -1 }));
    setMsg(`${n} éléments remplacés avec succès.`);
  };
  const flag = (k: 'caseSensitive' | 'wholeWord' | 'regex', label: string) => (
    <label className="fo-oo-chk"><input type="checkbox" checked={!!opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} />{label}</label>
  );
  const status = bad ? 'Expression régulière invalide' : msg || (!q ? '' : matches.length ? `Résultats de la recherche : ${cur + 1}/${matches.length}` : 'Aucune correspondance');
  // Portail : l'ancetre du module a un contexte de positionnement propre qui decalerait un element fixe.
  return createPortal(
    <aside className="fo-oo-search" style={{ left, top, bottom, width: WIDTH }} aria-label="Rechercher et remplacer" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <header className="fo-oo-search__head">
        <h2>Rechercher et remplacer</h2>
        <button type="button" title="Fermer la recherche" aria-label="Fermer la recherche" onClick={onClose}><Icon name="dismiss" size={16} /></button>
      </header>
      <div className="fo-oo-search__body">
        <div className="fo-oo-search__row">
          <input autoFocus value={q} placeholder="Rechercher" aria-label="Rechercher" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(e.shiftKey); }} />
          <button type="button" title="Résultat précédent" aria-label="Résultat précédent" disabled={!matches.length} onClick={() => go(true)}><Icon name="chevron_up" size={16} /></button>
          <button type="button" title="Résultat suivant" aria-label="Résultat suivant" disabled={!matches.length} onClick={() => go(false)}><Icon name="chevron_down" size={16} /></button>
        </div>
        <input value={rep} placeholder="Remplacer par" aria-label="Remplacer par" onChange={(e) => setRep(e.target.value)} />
        <div className="fo-oo-search__btns">
          <button type="button" className="fo-oo-search__btn" disabled={!matches.length} onClick={replaceOne}>Remplacer</button>
          <button type="button" className="fo-oo-search__btn" disabled={!matches.length} onClick={replaceAll}>Remplacer tout</button>
        </div>
        {flag('caseSensitive', 'Sensible à la casse')}
        {flag('wholeWord', 'Mots entiers uniquement')}
        {flag('regex', "Correspondance à l'aide d'expressions régulières")}
        <p className="fo-oo-search__status" role="status">{status}</p>
      </div>
    </aside>,
    document.body,
  );
}
