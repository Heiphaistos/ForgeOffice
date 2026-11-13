// Panneaux « Styles », « Galerie », « Navigateur » et « Formes » de la barre laterale de Draw (disposition LibreOffice) : les memes commandes que le ruban,
// presentees comme dans la vraie fenetre (classes `fo-ssb__*` partagees avec Impress).
import { useState } from 'react';
import { SHAPE_GALLERY } from '@forgeoffice/pptx';
import type { Editor } from './editor.ts';
import { insertPicture } from './ops.ts';
import { ShapeIcon } from './ribbon/common.tsx';
import { applyStyle } from './stylesops.ts';

export type DrawPanel = 'props' | 'styles' | 'gallery' | 'navigator' | 'shapes';
export const DRAW_PANELS: ReadonlyArray<{ id: DrawPanel; label: string }> = [
  { id: 'props', label: 'Propriétés' }, { id: 'styles', label: 'Styles' }, { id: 'gallery', label: 'Galerie' }, { id: 'navigator', label: 'Navigateur' }, { id: 'shapes', label: 'Formes' },
];

/** Styles de texte nommes de la publication : un clic applique le style a la selection ; « Gerer » ouvre la boite des styles. */
function StylesPanel({ ed }: { ed: Editor }) {
  const [cur, setCur] = useState('');
  const styles = ed.pub.styles;
  return (
    <div className="fo-ssb__form">
      <button type="button" className="fo-ssb__btn" onClick={() => ed.setUi({ dialog: 'styles' })}>Gérer les styles…</button>
      <div className="fo-ssb__list" role="listbox" aria-label="Styles" style={{ gridColumn: '1 / -1' }}>
        {styles.length === 0 && <span className="fo-ssb__row is-empty">Aucun style</span>}
        {styles.map((s) => <button key={s.id} type="button" role="option" aria-selected={cur === s.id} className={`fo-ssb__row${cur === s.id ? ' is-current' : ''}`} onClick={() => { setCur(s.id); applyStyle(ed, s); }}>{s.name}</button>)}
      </div>
    </div>
  );
}

/** Galerie : categories puis contenu (ce que ForgeOffice sait inserer : image, icones). */
function GalleryPanel({ ed }: { ed: Editor }) {
  return (
    <div className="fo-ssb__form">
      <button type="button" className="fo-ssb__btn" onClick={() => void insertPicture(ed)}>Insérer une image…</button>
      <button type="button" className="fo-ssb__btn" onClick={() => ed.setUi({ dialog: 'icons' })}>Insérer des icônes…</button>
    </div>
  );
}

/** Pages de la publication ; un clic va a la page. */
function NavigatorPanel({ ed }: { ed: Editor }) {
  return (
    <div className="fo-ssb__tree" role="tree" aria-label="Navigateur">
      {ed.deck.slides.map((s, i) => <button key={s.id} type="button" role="treeitem" aria-selected={i === ed.pageIndex} className={`fo-ssb__node fo-ssb__leaf${i === ed.pageIndex ? ' is-current' : ''}`} onClick={() => ed.goto(i)}>{`Page ${i + 1}`}</button>)}
    </div>
  );
}

/** Formes par categorie ; un clic arme l'outil comme dans le ruban. */
function ShapesPanel({ ed }: { ed: Editor }) {
  return (
    <div className="fo-ssb__shapes">
      {SHAPE_GALLERY.map((cat) => (
        <section key={cat.category}>
          <h4>{cat.category}</h4>
          <div>{cat.shapes.map(([id, name]) => <button key={id} type="button" title={name} aria-label={name} onClick={() => ed.setUi({ tool: { kind: 'shape', preset: id } })}><ShapeIcon preset={id} size={18} /></button>)}</div>
        </section>
      ))}
    </div>
  );
}

export function DrawPanelBody({ panel, ed }: { panel: Exclude<DrawPanel, 'props'>; ed: Editor }) {
  return panel === 'styles' ? <StylesPanel ed={ed} /> : panel === 'gallery' ? <GalleryPanel ed={ed} /> : panel === 'navigator' ? <NavigatorPanel ed={ed} /> : <ShapesPanel ed={ed} />;
}
