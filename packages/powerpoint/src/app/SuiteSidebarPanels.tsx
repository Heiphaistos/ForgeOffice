// Panneaux « Styles », « Galerie », « Navigateur » et « Formes » de la barre laterale d'Impress (disposition LibreOffice) : les memes commandes
// que le ruban (styles rapides, formes, dispositions, selection), presentees comme dans la vraie fenetre.
import { useState } from 'react';
import { SHAPE_GALLERY, type Shape } from '@forgeoffice/pptx';
import type { Editor } from './editor.ts';
import { applyQuickStyle, quickStyleItems } from './ribbon/galleries.tsx';
import { ShapeIcon } from './ribbon/common.tsx';

export function StylesPanel({ ed }: { ed: Editor }) {
  const [cur, setCur] = useState('');
  return (
    <div className="fo-ssb__list" role="listbox" aria-label="Styles">
      {quickStyleItems(ed).map((it) => (
        <button key={it.id} type="button" role="option" aria-selected={cur === it.id} className={`fo-ssb__row${cur === it.id ? ' is-current' : ''}`} onClick={() => { setCur(it.id); applyQuickStyle(ed, it.id); }}>{it.label}</button>
      ))}
    </div>
  );
}

/** Formes de la page courante, regroupees par categorie comme dans la vraie barre laterale. */
export function ShapesPanel({ onShape }: { onShape: (preset: string) => void }) {
  return (
    <div className="fo-ssb__shapes">
      {SHAPE_GALLERY.map((cat) => (
        <section key={cat.category}>
          <h4>{cat.category}</h4>
          <div>{cat.shapes.map(([id, name]) => <button key={id} type="button" title={name} aria-label={name} onClick={() => onShape(id)}><ShapeIcon preset={id} size={18} /></button>)}</div>
        </section>
      ))}
    </div>
  );
}

const shapeLabel = (s: Shape, i: number): string => (s.name?.trim() ? s.name : `Forme ${i + 1}`);

/** Arbre diapositives > formes ; un clic va a la diapositive, un clic sur une forme la selectionne. */
export function NavigatorPanel({ ed }: { ed: Editor }) {
  const [shut, setShut] = useState<ReadonlySet<number>>(new Set());
  return (
    <div className="fo-ssb__tree" role="tree" aria-label="Navigateur">
      {ed.deck.slides.map((s, i) => {
        const open = !shut.has(s.id);
        const here = ed.slide?.id === s.id;
        return (
          <div key={s.id} role="treeitem" aria-expanded={open}>
            <div className={`fo-ssb__node${here && !ed.selection.ids.length ? ' is-current' : ''}`}>
              <button type="button" className="fo-ssb__fold" aria-label={open ? 'Réduire' : 'Développer'} onClick={() => setShut((p) => { const n = new Set(p); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}>{open ? '−' : '+'}</button>
              <button type="button" className="fo-ssb__label" onClick={() => ed.goto(s.id)}>{`Diapo ${i + 1}`}</button>
            </div>
            {open && s.shapes.map((sh, k) => (
              <button key={sh.id} type="button" className={`fo-ssb__node fo-ssb__leaf${here && ed.selection.ids.includes(sh.id) ? ' is-current' : ''}`} onClick={() => { ed.goto(s.id); ed.setSelection({ ids: [sh.id] }); }}>{shapeLabel(sh, k)}</button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Galerie : categories a gauche en liste, contenu dessous (dispositions et icones, ce que ForgeOffice sait inserer). */
export function GalleryPanel({ ed, layouts, onLayout, current }: { ed: Editor; layouts: ReadonlyArray<{ id: string; name: string }>; onLayout: (id: string) => void; current?: string }) {
  const [cat, setCat] = useState<'layouts' | 'icons'>('layouts');
  return (
    <div className="fo-ssb__gallery">
      <div className="fo-ssb__cats" role="listbox" aria-label="Catégories">
        <button type="button" role="option" aria-selected={cat === 'layouts'} className={cat === 'layouts' ? 'is-current' : ''} onClick={() => setCat('layouts')}>Dispositions</button>
        <button type="button" role="option" aria-selected={cat === 'icons'} className={cat === 'icons' ? 'is-current' : ''} onClick={() => setCat('icons')}>Icônes</button>
      </div>
      {cat === 'layouts'
        ? <div className="fo-ssb__list">{layouts.map((l) => <button key={l.id} type="button" className={`fo-ssb__row${l.id === current ? ' is-current' : ''}`} onClick={() => onLayout(l.id)}>{l.name}</button>)}</div>
        : <div className="fo-ssb__form"><button type="button" className="fo-ssb__btn" onClick={() => ed.setUi({ dialog: 'icons' })}>Insérer des icônes…</button></div>}
    </div>
  );
}
