// Panneaux « Styles », « Galerie » et « Navigateur » de la barre laterale de Calc en disposition LibreOffice : les memes commandes que le ruban
// (styles de cellules, insertion d'objets, feuilles), presentees comme dans la vraie fenetre. Aucun element graphique de la suite n'est copie.
import { useState } from 'react';
import type { GalleryControl, RibbonControl, RibbonTab } from '../../ribbon-types.ts';
import { loCellStyleItems } from '../../logic/suite/loCellStyles.ts';

/** Evenement qui ouvre un panneau de la barre laterale du dock (Calc, disposition LibreOffice). */
export const SIDEBAR_EVENT = 'fo-sidebar-panel';

const flat = (cs: readonly RibbonControl[]): RibbonControl[] => cs.flatMap((c) => (c.kind === 'row' ? flat(c.controls) : [c]));
const invoke = (c: RibbonControl): void => {
  if (c.kind === 'button' || c.kind === 'split') c.onClick();
  else if (c.kind === 'toggle') c.onToggle(!c.pressed);
};
const allControls = (tabs: readonly RibbonTab[]): RibbonControl[] => tabs.flatMap((t) => t.groups.flatMap((g) => flat(g.controls)));

/** Styles de cellules : liste complete du ruban, filtre, « Apercu » (vignette du style) ; un clic applique le style. */
export function CalcStylesPanel({ tabs }: { tabs: readonly RibbonTab[] }) {
  const gallery = allControls(tabs).find((c): c is GalleryControl => c.kind === 'gallery' && c.id === 'cellStyles');
  const [filter, setFilter] = useState('all');
  const [preview, setPreview] = useState(true);
  const [cur, setCur] = useState('normal');
  if (!gallery) return null;
  const current = gallery.selectedId ?? cur;
  const shown = loCellStyleItems(gallery.items).filter((it) => filter === 'all' || (filter === 'accent' ? /accent/i.test(it.label) : /titre/i.test(it.label)));
  // Deux noms de LibreOffice peuvent viser le meme style du ruban : une seule ligne est surlignee.
  const curIdx = shown.findIndex((it) => it.id === current);
  return (
    <div className="fo-lcp">
      <div className="fo-lcp__tools">
        <button type="button" className="fo-lcp__tool is-on" aria-label="Styles de cellule" aria-pressed="true">▦</button>
        <button type="button" className="fo-lcp__tool" disabled aria-label="Styles de page" title="Styles de page : pas d'équivalent dans ForgeOffice">▭</button>
      </div>
      <div className="fo-lcp__filter">
        <label>Filtrer <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrer">
          <option value="all">Tous les styles</option><option value="accent">Accents</option><option value="head">Titres et totaux</option>
        </select></label>
        <label><input type="checkbox" disabled /> Hiérarchie</label>
        <label><input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> Aperçu</label>
      </div>
      <div className="fo-lcp__list" role="listbox" aria-label="Styles">
        {shown.map((it, n) => (
          <button key={it.label} type="button" role="option" aria-selected={n === curIdx} className={`fo-lcp__row${n === curIdx ? ' is-current' : ''}`} onClick={() => { setCur(it.id); gallery.onSelect(it.id); }}>
            {preview && it.style ? <span className="fo-lcp__sample" style={n === curIdx ? undefined : { ...it.style, color: it.style.color ?? (it.style.background ? '#000' : undefined) }}>{it.label}</span> : it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Galerie : categories en liste, contenu dessous ; ici les objets que ForgeOffice sait inserer (groupe d'illustrations du ruban). */
export function CalcGalleryPanel({ tabs }: { tabs: readonly RibbonTab[] }) {
  const groups = tabs.filter((t) => !t.contextual).flatMap((t) => t.groups.filter((g) => !g.hidden && /illus|image|picture|graph|chart/i.test(`${g.id} ${g.label}`)));
  const [cat, setCat] = useState(groups[0]?.id ?? '');
  const group = groups.find((g) => g.id === cat) ?? groups[0];
  const items = group ? flat(group.controls).filter((c): c is Exclude<RibbonControl, { kind: 'separator' | 'row' }> => c.kind !== 'separator' && c.kind !== 'row' && !c.hidden && (c.kind === 'button' || c.kind === 'split' || c.kind === 'menu' || c.kind === 'toggle' || c.kind === 'gallery')) : [];
  return (
    <div className="fo-lcp">
      <div className="fo-lcp__cats" role="listbox" aria-label="Catégories">
        {groups.map((g) => <button key={g.id} type="button" role="option" aria-selected={g.id === group?.id} className={g.id === group?.id ? 'is-current' : ''} onClick={() => setCat(g.id)}>{g.label}</button>)}
      </div>
      <div className="fo-lcp__list" role="listbox" aria-label="Objets">
        {items.map((c) => <button key={c.id} type="button" role="option" aria-selected="false" className="fo-lcp__row" disabled={c.disabled} onClick={() => invoke(c)}>{c.label}</button>)}
      </div>
    </div>
  );
}

const NAV_KINDS = ['Noms de plage', 'Plages de base de données', 'Plages liées', 'Images', 'Objets OLE', 'Commentaires', 'Objets de dessin'];

/** Navigateur : Colonne / Ligne (acces direct) puis arbre « Feuilles » (un clic va a la feuille) ; les categories vides sont grisees comme dans la vraie fenetre. */
export function CalcNavigatorPanel({ tabs }: { tabs: readonly RibbonTab[] }) {
  const nav = allControls(tabs).find((c) => c.kind === 'custom' && c.id === 'sheetNav');
  const [col, setCol] = useState('A');
  const [row, setRow] = useState('1');
  const [shut, setShut] = useState(false);
  if (!nav || nav.kind !== 'custom') return null;
  const go = (): void => { if (/^[A-Za-z]{1,3}$/.test(col) && /^[1-9]\d{0,6}$/.test(row)) nav.go?.(`${col.toUpperCase()}${row}`); };
  const onKey = (e: React.KeyboardEvent): void => { if (e.key === 'Enter') go(); };
  return (
    <div className="fo-lcp">
      <div className="fo-lcp__nav">
        <label>Colonne : <input value={col} onChange={(e) => setCol(e.target.value)} onKeyDown={onKey} aria-label="Colonne" size={6} /></label>
        <label>Ligne : <input value={row} onChange={(e) => setRow(e.target.value)} onKeyDown={onKey} aria-label="Ligne" size={6} /></label>
      </div>
      <div className="fo-lcp__tree" role="tree" aria-label="Navigateur">
        <div role="treeitem" aria-expanded={!shut}>
          <button type="button" className="fo-lcp__node is-head" onClick={() => setShut(!shut)}><b className="fo-lcp__fold">{shut ? '+' : '−'}</b>Feuilles</button>
          {!shut && (nav.commands ?? []).map((s) => <button key={s.id} type="button" className={`fo-lcp__node fo-lcp__leaf${s.checked ? ' is-current' : ''}`} onClick={s.onClick}>{s.label}</button>)}
        </div>
        {NAV_KINDS.map((k) => <div key={k} className="fo-lcp__node fo-lcp__leaf is-off" aria-disabled="true" title="Aucun élément de ce type dans le classeur">{k}</div>)}
      </div>
    </div>
  );
}
