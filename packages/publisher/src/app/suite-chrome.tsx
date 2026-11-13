// Habillage Draw des dispositions LibreOffice / OpenOffice : barre laterale « Proprietes », onglets de calques et cellules de la barre d'etat.
import { useState } from 'react';
import { Icon, type StatusBarProps } from '@forgeoffice/ui';
import { SIZE_NAMES, SLIDE_SIZES, type SlideSizePreset } from '@forgeoffice/pptx';
import type { Editor } from './editor.ts';
import { insertPicture } from './ops.ts';
import { resize } from './ribbon/design.tsx';
import { ShapeIcon } from './ribbon/common.tsx';
import { DRAW_PANELS, DrawPanelBody, type DrawPanel } from './suite-draw-panels.tsx';

const PANEL_ICONS: Record<DrawPanel, 'options' | 'paint_brush' | 'image_multiple' | 'navigation' | 'shapes'> = { props: 'options', styles: 'paint_brush', gallery: 'image_multiple', navigator: 'navigation', shapes: 'shapes' };

/** Boutons du deck « Inserer des formes » d'OpenOffice Draw : deux rangees (traits et texte, puis formes), l'outil s'arme comme dans le ruban. */
const OO_SHAPES: ReadonlyArray<ReadonlyArray<readonly [string, string]>> = [
  [['line', 'Ligne'], ['straightConnector1', 'Ligne terminée par une flèche'], ['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['textbox', 'Texte'], ['curvedConnector3', 'Courbe'], ['bentConnector3', 'Connecteur'], ['rightArrow', 'Flèche pleine']],
  [['diamond', 'Formes de base'], ['smileyFace', 'Formes des symboles'], ['leftRightArrow', 'Flèches pleines'], ['flowChartProcess', 'Organigramme'], ['wedgeRectCallout', 'Légendes'], ['star5', 'Étoiles et bannières']],
];

const PAPER: readonly SlideSizePreset[] = ['a4', 'a3', 'a5', 'letter', 'legal', 'tabloid', 'businessCard', 'banner', 'square'];
const long = (w: number, h: number): number => Math.max(w, h);
const short = (w: number, h: number): number => Math.min(w, h);

/** Panneau « Proprietes » : format, orientation, image d'arriere-plan, page maitresse (les memes commandes que le ruban). */
export function DrawSidebar({ ed, kind }: { ed: Editor; kind: 'lo' | 'oo' }) {
  const [open, setOpen] = useState(true);
  const [panel, setPanel] = useState<DrawPanel>('props');
  const [fold, setFold] = useState(true);
  const { width: w, height: h } = ed.deck.size;
  const portrait = h >= w;
  const key = PAPER.find((p) => Math.abs(long(SLIDE_SIZES[p].width, SLIDE_SIZES[p].height) - long(w, h)) < 1 && Math.abs(short(SLIDE_SIZES[p].width, SLIDE_SIZES[p].height) - short(w, h)) < 1) ?? 'custom';
  const orient = (p: boolean, size: { width: number; height: number }): { width: number; height: number } => (p ? { width: short(size.width, size.height), height: long(size.width, size.height) } : { width: long(size.width, size.height), height: short(size.width, size.height) });
  return (
    <div className={`fo-ssb fo-ssb--${kind}`} data-suite-sidebar>
      {open && (
        <aside className="fo-ssb__panel" aria-label={DRAW_PANELS.find((p) => p.id === panel)?.label}>
          <header className="fo-ssb__title">
            <span className="fo-ssb__grip" aria-hidden />
            <h2>{DRAW_PANELS.find((p) => p.id === panel)?.label}</h2>
            {kind === 'lo' && <span className="fo-ssb__help" aria-hidden>?</span>}
            <button type="button" className="fo-ssb__close" aria-label="Fermer la barre latérale" onClick={() => setOpen(false)}>×</button>
          </header>
          <div className="fo-ssb__body">
            {panel !== 'props' ? <DrawPanelBody panel={panel} ed={ed} /> : <>
            {kind === 'oo' && (
              <section className="fo-ssb__deck">
                <h3 className="fo-ssb__deckhead"><span className="fo-ssb__fold">−</span>Insérer des formes</h3>
                {OO_SHAPES.map((row, r) => (
                  <div key={r} className="fo-ssb__tools">
                    {row.map(([id, name]) => (
                      <button key={id} type="button" title={name} aria-label={name} onClick={() => ed.setUi({ tool: id === 'textbox' ? { kind: 'textbox' } : { kind: 'shape', preset: id } })}>
                        {id === 'textbox' ? <b aria-hidden>T</b> : <ShapeIcon preset={id} size={18} />}
                      </button>
                    ))}
                  </div>
                ))}
              </section>
            )}
            <section className="fo-ssb__deck">
              <h3 className="fo-ssb__deckhead"><button type="button" aria-expanded={fold} onClick={() => setFold(!fold)}><span className="fo-ssb__fold">{fold ? '−' : '+'}</span>Page</button></h3>
              {fold && (
                <div className="fo-ssb__form">
                  <label>Format :</label>
                  <select aria-label="Format" value={key} onChange={(e) => (e.target.value === 'custom' ? ed.setUi({ dialog: 'pageSetup' }) : resize(ed, orient(portrait, SLIDE_SIZES[e.target.value as SlideSizePreset])))}>
                    {PAPER.map((p) => <option key={p} value={p}>{SIZE_NAMES[p]}</option>)}
                    <option value="custom">Personnalisé…</option>
                  </select>
                  <label>Orientation :</label>
                  <select aria-label="Orientation" value={portrait ? 'p' : 'l'} onChange={(e) => { if ((e.target.value === 'p') !== portrait) resize(ed, { width: h, height: w }); }}>
                    <option value="p">Portrait</option>
                    <option value="l">Paysage</option>
                  </select>
                  <span />
                  <button type="button" className="fo-ssb__btn" onClick={() => void insertPicture(ed)}>Insérer une image…</button>
                  <label>Page maîtresse :</label>
                  <select aria-label="Page maîtresse" value="0" onChange={() => undefined}>
                    {(ed.deck.masters[0]?.layouts ?? []).map((l, i) => <option key={l.id} value={i}>{l.name}</option>)}
                  </select>
                </div>
              )}
            </section>
            </>}
          </div>
        </aside>
      )}
      <nav className="fo-ssb__rail" aria-label="Onglets de la barre latérale">
        <button type="button" className="fo-ssb__tab fo-ssb__menu" title="Afficher ou masquer le panneau" aria-label="Afficher ou masquer le panneau" onClick={() => setOpen(!open)}><span aria-hidden>≡</span></button>
        {(kind === 'lo' ? DRAW_PANELS : DRAW_PANELS.slice(0, 1)).map((p) => {
          const on = open && panel === p.id;
          return <button key={p.id} type="button" className={`fo-ssb__tab${on ? ' is-active' : ''}`} title={p.label} aria-label={p.label} aria-pressed={on} onClick={() => { if (on) setOpen(false); else { setPanel(p.id); setOpen(true); } }}><Icon name={PANEL_ICONS[p.id]} size={20} /></button>;
        })}
      </nav>
    </div>
  );
}

/** Onglets de calques sous la page (Mise en page / Controles / Lignes de cote) : ForgeOffice n'a qu'un calque, les deux autres sont grises. */
export function LayerTabs() {
  return (
    <div className="pub-layers" role="tablist" aria-label="Calques">
      <button type="button" role="tab" aria-selected className="pub-layers__tab is-active">Mise en page</button>
      <button type="button" role="tab" aria-selected={false} disabled title="Pas d'équivalent dans ForgeOffice" className="pub-layers__tab">Contrôles</button>
      <button type="button" role="tab" aria-selected={false} disabled title="Pas d'équivalent dans ForgeOffice" className="pub-layers__tab">Lignes de cote</button>
    </div>
  );
}

const CM = 28.3465;
const fr = (pt: number): string => (pt / CM).toFixed(2).replace('.', ',');

export function drawStatus(kind: 'lo' | 'oo', page: number, total: number, sel: { x: number; y: number; width: number; height: number } | undefined, master: string): Pick<StatusBarProps, 'left' | 'right' | 'views'> {
  const pos = { id: 'sb-pos', label: sel ? `${fr(sel.x)} / ${fr(sel.y)}` : '0,00 / 0,00', title: "Position de l'objet sélectionné" };
  const size = { id: 'sb-size', label: sel ? `${fr(sel.width)} x ${fr(sel.height)}` : '0,00 x 0,00', title: "Taille de l'objet sélectionné" };
  if (kind === 'lo') {
    return {
      left: [{ id: 'sb-save', label: '', icon: 'save' as const, title: 'Le document n’a pas été modifié depuis la dernière sauvegarde.' }, { id: 'sb-slide', label: `Page ${page} de ${total}`, title: 'Numéro de page' }, { id: 'sb-master', label: master, title: 'Page maîtresse' }, pos, size],
      right: [{ id: 'sb-scale', label: '1:1', title: 'Échelle' }],
      views: [],
    };
  }
  return { left: [pos, size, { id: 'sb-mod', label: '', title: 'Document modifié' }, { id: 'sb-slide', label: `Diapo ${page} / ${total}`, title: 'Numéro de page' }, { id: 'sb-master', label: master, title: 'Page maîtresse' }], right: [], views: [] };
}
