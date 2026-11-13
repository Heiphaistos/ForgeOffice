// Barre laterale d'Impress en disposition LibreOffice / OpenOffice : panneau (Proprietes, Transition, Animation, Pages maitres) + rail d'onglets
// a droite, dans le flux de la fenetre (comme la vraie suite). Les memes commandes que le ruban, une autre presentation.
import { useState } from 'react';
import { Icon, RibbonGroupView, type RibbonTab } from '@forgeoffice/ui';
import type { IconName } from '@forgeoffice/ui';
import { SIZE_NAMES, SLIDE_SIZES, type Deck, type Layout, type SlideSizePreset } from '@forgeoffice/pptx';
import { editSlides, resizeDeck } from './deck-ops.ts';
import type { Editor } from './editor.ts';
import { insertPicture } from './insert.ts';
import { openView } from './ribbon/views.tsx';
import { GalleryPanel, NavigatorPanel, ShapesPanel, StylesPanel } from './SuiteSidebarPanels.tsx';

type PanelId = 'props' | 'styles' | 'gallery' | 'navigator' | 'shapes' | 'transition' | 'animation' | 'master';
const CTX = { keytips: new Map(), onCommand: () => undefined };

const TABS: ReadonlyArray<{ id: PanelId; icon: IconName; tab?: string; lo?: boolean }> = [
  { id: 'props', icon: 'options' },
  { id: 'styles', icon: 'paint_brush', lo: true },
  { id: 'gallery', icon: 'image_multiple', lo: true },
  { id: 'navigator', icon: 'navigation', lo: true },
  { id: 'shapes', icon: 'shapes', lo: true },
  { id: 'transition', icon: 'slide_transition', tab: 'transitions' },
  { id: 'animation', icon: 'sparkle', tab: 'animations' },
  { id: 'master', icon: 'slide_layout' },
];

const T = {
  lo: { props: 'Propriétés', transition: 'Transition de diapo', animation: 'Animation', master: 'Diapositives maîtres', styles: 'Styles', gallery: 'Galerie', navigator: 'Navigateur', shapes: 'Formes' },
  oo: { props: 'Propriétés', transition: 'Transition de diapo', animation: 'Animation personnalisée', master: 'Pages maîtres', styles: 'Styles et formatage', gallery: 'Galerie', navigator: 'Navigateur', shapes: 'Formes' },
} as const;

/** Icone schematique d'une disposition : titre en barre, zones de contenu en cadres (placement deduit du nombre de zones). */
function LayoutIcon({ layout }: { layout: Layout }) {
  const holders = layout.shapes.filter((s) => s.placeholder && !['dt', 'ftr', 'sldNum', 'hdr'].includes(s.placeholder.type));
  const title = holders.find((s) => s.placeholder?.type === 'title' || s.placeholder?.type === 'ctrTitle');
  const body = holders.filter((s) => s !== title);
  const W = 60, H = 45, g = 4;
  const bars: React.ReactNode[] = [];
  let top = g;
  if (title) {
    const centered = layout.type === 'title' || layout.type === 'secHead';
    bars.push(<rect key="t" x={g + 6} y={centered ? H / 2 - 7 : top + 1} width={W - 2 * g - 12} height={2} className="is-bar" />);
    if (!centered) top += 10;
    else return <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>{bars}{body.length > 0 && <rect x={g + 12} y={H / 2 + 1} width={W - 2 * g - 24} height={2} className="is-bar" />}</svg>;
  }
  const n = body.length;
  const area = { x: g, y: top, w: W - 2 * g, h: H - top - g };
  const cell = (key: string, x: number, y: number, w: number, h: number) => <rect key={key} x={x} y={y} width={w} height={h} className="is-box" />;
  if (n === 1) bars.push(cell('b0', area.x, area.y, area.w, area.h));
  else if (n === 2) { const w = (area.w - g) / 2; bars.push(cell('b0', area.x, area.y, w, area.h), cell('b1', area.x + w + g, area.y, w, area.h)); }
  else if (n === 3) { const w = (area.w - g) / 2; const h = (area.h - g) / 2; bars.push(cell('b0', area.x, area.y, w, area.h), cell('b1', area.x + w + g, area.y, w, h), cell('b2', area.x + w + g, area.y + h + g, w, h)); }
  else if (n >= 4) { const w = (area.w - g) / 2; const h = (area.h - g) / 2; for (let i = 0; i < 4; i++) bars.push(cell(`b${i}`, area.x + (i % 2) * (w + g), area.y + Math.floor(i / 2) * (h + g), w, h)); }
  return <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>{bars}</svg>;
}

function sizeKey(deck: Deck): string {
  const { width: w, height: h } = deck.size;
  const long = Math.max(w, h), short = Math.min(w, h);
  const hit = (Object.keys(SLIDE_SIZES) as SlideSizePreset[]).find((p) => Math.abs(Math.max(SLIDE_SIZES[p].width, SLIDE_SIZES[p].height) - long) < 1 && Math.abs(Math.min(SLIDE_SIZES[p].width, SLIDE_SIZES[p].height) - short) < 1);
  return hit ?? 'custom';
}

function Props({ ed, kind, onDialog, onLayout }: { ed: Editor; kind: 'lo' | 'oo'; onDialog: (d: 'slideSize') => void; onLayout: (id: string) => void }) {
  const { deck, slide } = ed;
  const landscape = deck.size.width >= deck.size.height;
  const layouts = deck.masters[0]?.layouts ?? [];
  const [open, setOpen] = useState({ slide: true, layouts: true });
  const sel = slide?.layoutId;
  const presets = Object.keys(SIZE_NAMES) as SlideSizePreset[];
  const key = sizeKey(deck);
  const slideDeck = (
    <section className="fo-ssb__deck">
      <h3 className="fo-ssb__deckhead"><button type="button" aria-expanded={open.slide} onClick={() => setOpen({ ...open, slide: !open.slide })}><span className="fo-ssb__fold">{open.slide ? '−' : '+'}</span>Diapo</button></h3>
      {open.slide && (
        <div className="fo-ssb__form">
          <label>Format :</label>
          <select aria-label="Format" value={key} onChange={(e) => (e.target.value === 'custom' ? onDialog('slideSize') : ed.commit(resizeDeck(deck, landscape ? { ...SLIDE_SIZES[e.target.value as SlideSizePreset] } : { width: SLIDE_SIZES[e.target.value as SlideSizePreset].height, height: SLIDE_SIZES[e.target.value as SlideSizePreset].width }, 'fit')))}>
            {presets.map((p) => <option key={p} value={p}>{SIZE_NAMES[p]}</option>)}
            <option value="custom">Personnalisé…</option>
          </select>
          <label>Orientation :</label>
          <select aria-label="Orientation" value={landscape ? 'l' : 'p'} onChange={(e) => { if ((e.target.value === 'l') !== landscape) ed.commit(resizeDeck(deck, { width: deck.size.height, height: deck.size.width }, 'fit')); }}>
            <option value="l">Paysage</option>
            <option value="p">Portrait</option>
          </select>
          <label>Arrière-plan :</label>
          <select aria-label="Arrière-plan" value={slide?.background ? 'own' : 'none'} onChange={() => ed.setUi({ pane: 'format' })}>
            <option value="none">Aucun(e)</option>
            <option value="own">Couleur</option>
          </select>
          <span />
          <button type="button" className="fo-ssb__btn" onClick={() => void insertPicture(ed)}>Insérer une image…</button>
          <label>{kind === 'lo' ? 'Diapositive maîtresse :' : 'Page maître :'}</label>
          <select aria-label="Diapositive maîtresse" value="0" onChange={() => undefined}>
            {deck.masters.map((m, i) => <option key={i} value={i}>{m.name ?? 'Standard'}</option>)}
          </select>
          <span />
          <label className="fo-ssb__check"><input type="checkbox" checked={!slide?.background} disabled title="Pas d'équivalent dans ForgeOffice" readOnly />Arrière-plan du masque</label>
          <span />
          <label className="fo-ssb__check"><input type="checkbox" checked={slide?.showMasterShapes !== false} onChange={(e) => slide && ed.commit(editSlides(deck, new Set([slide.id]), (s) => { if (e.target.checked) delete s.showMasterShapes; else s.showMasterShapes = false; }))} />Objets du masque</label>
          <span />
          <button type="button" className="fo-ssb__btn" onClick={() => openView(ed, 'master')}>Affichage maître</button>
        </div>
      )}
    </section>
  );
  const grid = (
    <section className="fo-ssb__deck">
      <h3 className="fo-ssb__deckhead"><button type="button" aria-expanded={open.layouts} onClick={() => setOpen({ ...open, layouts: !open.layouts })}><span className="fo-ssb__fold">{open.layouts ? '−' : '+'}</span>Mises en page</button></h3>
      {open.layouts && (
        <div className="fo-ssb__grid" role="listbox" aria-label="Mises en page">
          {layouts.map((l) => (
            <button key={l.id} type="button" role="option" aria-selected={l.id === sel} className={`fo-ssb__layout${l.id === sel ? ' is-current' : ''}`} title={l.name} onClick={() => onLayout(l.id)}>
              <LayoutIcon layout={l} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
  return <>{kind === 'oo' ? grid : <>{slideDeck}{grid}</>}</>;
}

function MasterList({ ed }: { ed: Editor }) {
  const { deck, ui } = ed;
  return (
    <div className="fo-ssb__masters">
      {deck.masters.flatMap((m, mi) => [{ key: `m${mi}`, label: m.name ?? 'Standard', ref: { kind: 'master' as const, masterIndex: mi } }, ...m.layouts.map((l) => ({ key: `l${mi}-${l.id}`, label: l.name, ref: { kind: 'layout' as const, masterIndex: mi, layoutId: l.id } }))]).map((p) => (
        <button key={p.key} type="button" className={`fo-ssb__master${p.ref.kind === 'layout' ? ' is-layout' : ''}${ui.view === 'master' && JSON.stringify(ui.masterPage) === JSON.stringify(p.ref) ? ' is-current' : ''}`} onClick={() => { if (ui.view !== 'master') openView(ed, 'master'); ed.setUi({ masterPage: p.ref }); }}>{p.label}</button>
      ))}
    </div>
  );
}

export interface SuiteSidebarProps {
  ed: Editor;
  tabs: readonly RibbonTab[];
  kind: 'lo' | 'oo';
  onDialog: (dialog: 'slideSize') => void;
  /** Applique une disposition aux diapositives selectionnees. */
  onLayout: (layoutId: string) => void;
  /** Arme l'outil de dessin d'une forme. */
  onShape: (preset: string) => void;
}

export function SuiteSidebar({ ed, tabs, kind, onDialog, onLayout, onShape }: SuiteSidebarProps) {
  const [open, setOpen] = useState<PanelId | ''>('props');
  const L = T[kind];
  const tab = (id?: string) => tabs.find((t) => t.id === id);
  const groups = open === 'transition' || open === 'animation' ? (tab(TABS.find((t) => t.id === open)?.tab)?.groups ?? []).filter((g) => !g.hidden) : [];
  return (
    <div className={`fo-ssb fo-ssb--${kind}`} data-suite-sidebar>
      {open && (
        <aside className="fo-ssb__panel" aria-label={L[open]}>
          <header className="fo-ssb__title">
            <span className="fo-ssb__grip" aria-hidden />
            <h2>{L[open]}</h2>
            {kind === 'lo' && <span className="fo-ssb__help" aria-hidden>?</span>}
            <button type="button" className="fo-ssb__close" aria-label="Fermer la barre latérale" onClick={() => setOpen('')}>×</button>
          </header>
          <div className="fo-ssb__body">
            {open === 'props' && <Props ed={ed} kind={kind} onDialog={onDialog} onLayout={onLayout} />}
            {open === 'master' && <MasterList ed={ed} />}
            {open === 'styles' && <StylesPanel ed={ed} />}
            {open === 'shapes' && <ShapesPanel onShape={onShape} />}
            {open === 'navigator' && <NavigatorPanel ed={ed} />}
            {open === 'gallery' && <GalleryPanel ed={ed} layouts={ed.deck.masters[0]?.layouts ?? []} onLayout={onLayout} current={ed.slide?.layoutId} />}
            {groups.map((g) => <RibbonGroupView key={g.id} group={g} level={1} ctx={CTX} />)}
          </div>
        </aside>
      )}
      <nav className="fo-ssb__rail" aria-label="Onglets de la barre latérale">
        <button type="button" className="fo-ssb__tab fo-ssb__menu" title="Afficher ou masquer le panneau" aria-label="Afficher ou masquer le panneau" onClick={() => setOpen(open ? '' : 'props')}>
          <span aria-hidden>≡</span>
        </button>
        {TABS.filter((t) => !t.lo || kind === 'lo').map((t) => (
          <button key={t.id} type="button" className={`fo-ssb__tab${open === t.id ? ' is-active' : ''}`} title={L[t.id]} aria-label={L[t.id]} aria-pressed={open === t.id} onClick={() => setOpen(open === t.id ? '' : t.id)}>
            <Icon name={t.icon} size={20} />
          </button>
        ))}
      </nav>
    </div>
  );
}
