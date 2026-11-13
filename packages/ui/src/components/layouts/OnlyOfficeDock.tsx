// Barres laterales des dispositions OnlyOffice, LibreOffice et OpenOffice : rail droit dont le panneau (« Parametres » / « Proprietes »)
// reprend les groupes du ruban (texte, image, forme, tableau...) ; OnlyOffice ajoute un rail gauche (recherche, commentaires, navigation).
// Memes commandes, autre place.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Settings } from '@forgeoffice/core';
import type { LayoutId } from '../../logic/layouts.ts';
import { Icon } from '../../icons/Icon.tsx';
import type { IconName } from '../../icons/generated.ts';
import type { RibbonControl, RibbonGroup, RibbonTab } from '../../ribbon-types.ts';
import { usePersistentState } from '../../hooks.ts';
import { S } from '../../strings.ts';
import { Menu } from '../Menu.tsx';
import type { MenuItem } from '../../ribbon-types.ts';
import { RibbonGroupView } from '../ribbon/RibbonGroup.tsx';
import { RibbonControlView } from '../ribbon/RibbonControls.tsx';
import { GROUP_LABELS } from '../../logic/onlyofficeLayout.ts';
import type { ControlContext } from '../ribbon/RibbonControls.tsx';
import { ParagraphForm, hasParagraphForm } from './OnlyOfficeParagraphForm.tsx';
import { OoForm } from './OnlyOfficeForms.tsx';
import { calcSections } from './suiteCalcSections.tsx';
import './calc-panels.css';
import { CalcGalleryPanel, CalcNavigatorPanel, CalcStylesPanel, SIDEBAR_EVENT } from './CalcSidePanels.tsx';
import { OO_FORMS } from '../../logic/onlyofficeForms.ts';

const RAIL = 40;
const PANEL = 300;
/** Panneau OnlyOffice : carte de 224 px + 8 px de marge a gauche (cotes de l'application reelle). */
const PANEL_OO = 232;
const CTX: ControlContext = { keytips: new Map(), onCommand: () => undefined };
/** Groupes du premier onglet laisses de cote dans « Parametres » (presse-papiers, edition : deja a portee dans la barre d'outils). */
const SKIP_GROUP = /clip|presse|editing|modif|^edit$|styles|oo-more/i;

function flatten(controls: readonly RibbonControl[]): RibbonControl[] {
  return controls.flatMap((c) => (c.kind === 'row' ? flatten(c.controls) : [c]));
}

/** Premier bouton ou bascule du ruban dont l'intitule correspond. */
export function findControl(tabs: readonly RibbonTab[], label: RegExp): RibbonControl | null {
  for (const t of tabs) for (const g of t.groups) for (const c of flatten(g.controls)) if ((c.kind === 'button' || c.kind === 'toggle') && !c.hidden && label.test(c.label)) return c;
  return null;
}

export function invoke(c: RibbonControl): void {
  if (c.kind === 'button' || c.kind === 'split') c.onClick();
  else if (c.kind === 'toggle') c.onToggle(!c.pressed);
}

interface LeftItem {
  id: string;
  label: string;
  icon: IconName;
  run: () => void;
  disabled?: boolean;
}

/** Rail droit OnlyOffice : une icone par type d'objet, grisee tant qu'aucun objet de ce type n'est selectionne. `match` : onglet contextuel correspondant. */
interface ObjectType {
  id: 'paragraph' | 'cell' | 'slide' | 'pivot' | 'table' | 'image' | 'shape' | 'chart' | 'textart' | 'signature';
  icon: IconName;
  match: RegExp | null;
  /** Panneau toujours disponible (ouvert sans objet) : paragraphe, cellule ou diapositive selon le module. */
  settings?: boolean;
}
const NEVER = /(?!)/;
const WORD_TYPES: readonly ObjectType[] = [
  { id: 'paragraph', icon: 'text_paragraph', match: null, settings: true },
  { id: 'table', icon: 'table', match: /table/i },
  { id: 'image', icon: 'image', match: /picture|image/i },
  { id: 'shape', icon: 'shapes', match: /shape|forme/i },
  { id: 'chart', icon: 'chart_multiple', match: /chart/i },
  { id: 'textart', icon: 'text_effects', match: /textformat|wordart|textart/i },
  { id: 'signature', icon: 'document_signature', match: /signature/i },
];
// Rails reels : Tableur = cellule, forme, image, texte, Text Art, (signature), tableau croise ; Presentation = diapositive, forme, image, texte, tableau, Text Art.
const EXCEL_TYPES: readonly ObjectType[] = [
  { id: 'cell', icon: 'table_settings', match: null, settings: true },
  { id: 'shape', icon: 'shapes', match: /shape|forme/i },
  { id: 'image', icon: 'image', match: /picture|image/i },
  { id: 'paragraph', icon: 'text_paragraph', match: NEVER },
  { id: 'textart', icon: 'text_effects', match: /textformat|wordart|textart/i },
  { id: 'chart', icon: 'chart_multiple', match: /chart/i },
  { id: 'signature', icon: 'document_signature', match: /signature/i },
  { id: 'pivot', icon: 'table_lightning', match: /pivot/i },
];
const PPT_TYPES: readonly ObjectType[] = [
  { id: 'slide', icon: 'slide_layout', match: null, settings: true },
  { id: 'shape', icon: 'shapes', match: /shape|forme/i },
  { id: 'image', icon: 'image', match: /picture|image/i },
  { id: 'paragraph', icon: 'text_paragraph', match: NEVER },
  { id: 'table', icon: 'table', match: /table/i },
  { id: 'textart', icon: 'text_effects', match: /textformat|wordart|textart/i },
  { id: 'chart', icon: 'chart_multiple', match: /chart/i },
  { id: 'signature', icon: 'document_signature', match: /signature/i },
];
const typesOf = (app: string | undefined): readonly ObjectType[] => (app === 'excel' ? EXCEL_TYPES : app === 'powerpoint' ? PPT_TYPES : WORD_TYPES);

export interface OnlyOfficeDockProps {
  variant: LayoutId;
  tabs: readonly RibbonTab[];
  /** Ruban : le dock se cale sous lui et reserve la place sur les cotes du contenu qui le suit. */
  host: RefObject<HTMLElement | null>;
  settings?: Settings | null;
}

/** Fenetre assez large pour deux barres laterales (sinon le document passe en premier). */
function useWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const q = window.matchMedia('(min-width: 900px)');
    const on = (): void => setWide(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return wide;
}

export function OnlyOfficeDock(props: OnlyOfficeDockProps) {
  return useWide() ? <Dock {...props} /> : null;
}

function Dock({ variant, tabs, host, settings }: OnlyOfficeDockProps) {
  const L = S.layouts.oo;
  const oo = variant === 'onlyoffice';
  const app = document.documentElement.dataset.app;
  const OBJECT_TYPES = typesOf(app);
  const SB = S.layouts.sidebar;
  const main = tabs.find((t) => !t.contextual) ?? tabs[0];
  const contextual = useMemo(() => tabs.filter((t) => t.contextual && !t.hidden), [tabs]);
  // OnlyOffice et Calc : panneau ferme au depart (comme la vraie suite) ; LibreOffice et OpenOffice (autres modules) : barre laterale ouverte sur « Proprietes ».
  const [open, setOpen] = usePersistentState<string>(settings, oo ? 'ui.onlyoffice.panel' : 'ui.sidebar.panel', oo || document.documentElement.dataset.app === 'excel' ? '' : 'settings');
  const [top, setTop] = useState(0);
  const [bottom, setBottom] = useState(0);
  const seen = useRef(new Set<string>());

  // Un objet selectionne (image, forme, tableau...) ouvre son panneau, comme dans OnlyOffice.
  useEffect(() => {
    const fresh = contextual.find((t) => !seen.current.has(t.id));
    seen.current = new Set(contextual.map((t) => t.id));
    if (fresh) setOpen(fresh.id);
    else if (open && open !== 'settings' && open !== 'styles' && open !== 'gallery' && open !== 'navigator' && !contextual.some((t) => t.id === open)) setOpen('settings');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagit seulement aux onglets contextuels
  }, [contextual]);

  // Menu Affichage de la suite : ouvre un panneau de la barre laterale (Calc).
  useEffect(() => {
    if (oo || document.documentElement.dataset.app !== 'excel') return;
    const on = (e: Event): void => { const id = (e as CustomEvent<string>).detail; if (['settings', 'styles', 'gallery', 'navigator'].includes(id)) setOpen(id); };
    window.addEventListener(SIDEBAR_EVENT, on);
    return () => window.removeEventListener(SIDEBAR_EVENT, on);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setOpen suit settings
  }, [oo]);

  const stylesGroup = !oo ? main?.groups.find((g) => !g.hidden && /styl/i.test(`${g.id} ${g.label}`)) : undefined;
  const isCalc = !oo && document.documentElement.dataset.app === 'excel';
  const navControl = !oo && !isCalc ? findControl(tabs, /navigat|^plan$/i) : null;
  // Calc : le bouton « Fonctions » de la barre laterale ouvre l'assistant de fonctions.
  const fnControl = !oo && document.documentElement.dataset.app === 'excel' ? findControl(tabs, /^insérer une fonction$/i) : null;
  const panelTab = open === 'settings' || open === 'styles' || (isCalc && (open === 'gallery' || open === 'navigator')) ? main : contextual.find((t) => t.id === open);
  const rightWidth = RAIL + (panelTab ? (oo ? PANEL_OO : PANEL) : 0);

  // Place reservee de chaque cote du contenu qui suit le ruban ; position verticale sous le ruban.
  useEffect(() => {
    const ribbon = host.current;
    const shell = ribbon?.parentElement;
    if (!ribbon || !shell) return;
    shell.style.setProperty('--fo-oo-left', oo ? `${RAIL}px` : '0px');
    shell.style.setProperty('--fo-oo-right', `${rightWidth}px`);
    shell.dataset.ooDock = '1';
    // Les barres s'arretent au-dessus de la barre d'etat, qui garde toute la largeur.
    const place = (): void => {
      setTop(Math.max(0, Math.round(ribbon.getBoundingClientRect().bottom)));
      const sb = shell.querySelector<HTMLElement>('.fo-sb');
      setBottom(sb ? Math.round(sb.getBoundingClientRect().height) : 0);
      // Le bloc du shell qui porte la barre d'etat (elle peut etre dans un conteneur du module) garde toute la largeur.
      let block: HTMLElement | null = sb;
      while (block && block.parentElement !== shell) block = block.parentElement;
      if (block) block.dataset.ooFull = '1';
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(ribbon);
    window.addEventListener('resize', place);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
      shell.style.removeProperty('--fo-oo-left');
      shell.style.removeProperty('--fo-oo-right');
      delete shell.dataset.ooDock;
    };
  }, [host, rightWidth, oo]);

  const left: LeftItem[] = useMemo(() => {
    const find = findControl(tabs, /^rechercher$/i);
    const comments = findControl(tabs, /commentaire/i);
    const nav = findControl(tabs, /navigation|^plan$/i);
    const items: LeftItem[] = [
      { id: 'search', label: L.search, icon: 'search', run: () => (find ? invoke(find) : document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }))) },
    ];
    if (comments) items.push({ id: 'comments', label: L.comments, icon: 'comment_multiple', run: () => invoke(comments) });
    if (nav) items.push({ id: 'nav', label: L.navigation, icon: 'navigation', run: () => invoke(nav) });
    if (oo) {
      // PDF : bascules vignettes / signets quand le module a la fonction ; sinon bouton grise.
      const isPdf = document.documentElement.dataset.app === 'pdf';
      if (isPdf) {
        const thumbs = findControl(tabs, /miniatures|vignettes/i);
        const marks = findControl(tabs, /signets/i);
        items.push({ id: 'bookmarks', label: L.bookmarks, icon: 'text_paragraph', run: () => marks && invoke(marks), disabled: !marks });
        items.push({ id: 'thumbs', label: L.thumbs, icon: 'document_one_page_multiple', run: () => thumbs && invoke(thumbs), disabled: !thumbs });
      }
      // Annonces : pas de flux d'annonces dans la suite, le bouton reste present et grise (comme OnlyOffice hors ligne).
      items.push({ id: 'news', label: L.announcements, icon: 'megaphone', run: () => undefined, disabled: true });
    }
    return items;
  }, [tabs, L, oo]);

  const skip = oo ? SKIP_GROUP : /clip|presse|editing|modif|styl/i;
  // Plusieurs onglets contextuels d'un meme type (Creation + Disposition de tableau) : un seul panneau.
  const sibling = oo ? OBJECT_TYPES.find((t) => t.match && contextual.some((c) => c.id === open && t.match?.test(c.id))) : undefined;
  const panelTabs = sibling?.match ? contextual.filter((c) => sibling.match?.test(c.id)) : panelTab ? [panelTab] : [];
  const groups = !panelTab ? [] : sibling ? panelTabs.flatMap((t) => t.groups.filter((g) => !g.hidden)) : open === 'styles' ? (stylesGroup ? [stylesGroup] : []) : panelTab.groups.filter((g) => !g.hidden && (panelTab !== main || !skip.test(`${g.id} ${g.label}`)));
  // Formulaire exact d'OnlyOffice pour ce type d'objet (si decrit) ; sinon les groupes du ruban en sections.
  // Calc en LibreOffice : les cinq sections de la vraie barre laterale a la place des groupes du ruban.
  const loCalc = variant === 'libreoffice' && app === 'excel' && open === 'settings';
  const shown = loCalc ? calcSections(main, CTX) : groups;
  const formType = open === 'settings' ? OBJECT_TYPES.find((t) => t.settings)?.id : sibling?.id;
  const formSpec = oo && formType ? OO_FORMS[app ?? 'word']?.[formType === 'cell' || formType === 'slide' ? 'settings' : formType] : undefined;
  const title = open === 'styles' ? SB.styles : open === 'gallery' ? SB.gallery : open === 'navigator' ? SB.navigator : open === 'settings' ? (oo ? (formSpec?.title ?? L.settings) : SB.properties) : sibling ? (formSpec?.title ?? L.types[sibling.id]) : (panelTab?.label ?? '');
  // Lanceur du groupe Paragraphe : devient un bouton « oo-launcher-<onglet>-paragraph » dans la disposition OnlyOffice.
  const launchBtn = tabs.flatMap((t) => t.groups).flatMap((g) => flatten(g.controls)).find((c) => c.kind === 'button' && /^oo-launcher-.*-paragraph$/.test(c.id));
  const launchParagraph = launchBtn?.kind === 'button' ? launchBtn.onClick : tabs.flatMap((t) => t.groups).find((g) => g.id === 'paragraph' && g.launcher)?.launcher?.onClick;
  const style = { top, bottom };
  return (
    <>
      {oo && (
        <nav className={`fo-oo-rail fo-oo-rail--left fo-oo--${variant}`} style={style} aria-label={L.left}>
          {left.map((i) => (
            <button key={i.id} type="button" className="fo-oo-rail__btn" title={i.label} aria-label={i.label} disabled={i.disabled} onClick={i.run}>
              <Icon name={i.icon} size={20} />
            </button>
          ))}
        </nav>
      )}
      {panelTab && (
        <aside className={`fo-oo-panel fo-oo--${variant}`} style={{ ...style, right: RAIL }} aria-label={title}>
          <h2 className="fo-oo-panel__title">{title}</h2>
          <div className="fo-oo-panel__body">
            {formSpec ? (
              <OoForm spec={formSpec} tabs={tabs} ctx={CTX} />
            ) : oo && open === 'settings' && hasParagraphForm(tabs) ? (
              <ParagraphForm tabs={tabs} ctx={CTX} onAdvanced={launchParagraph} />
            ) : isCalc && open === 'styles' ? <CalcStylesPanel tabs={tabs} />
            : isCalc && open === 'gallery' ? <CalcGalleryPanel tabs={tabs} />
            : isCalc && open === 'navigator' ? <CalcNavigatorPanel tabs={tabs} />
            : shown.map((g) => (
              oo ? <PanelSection key={g.id} group={g} /> : <RibbonGroupView key={g.id} group={g} level={1} ctx={CTX} />
            ))}
          </div>
        </aside>
      )}
      <nav className={`fo-oo-rail fo-oo-rail--right fo-oo--${variant}`} style={style} aria-label={oo ? L.right : SB.tabs}>
        {oo ? (
          <>
            {OBJECT_TYPES.map((t) => {
              const tab = t.match ? contextual.find((c) => t.match?.test(c.id)) : undefined;
              const enabled = Boolean(t.settings) || Boolean(tab);
              const target = t.settings ? 'settings' : (tab?.id ?? '');
              const active = enabled && (t.settings ? open === 'settings' : Boolean(t.match && t.match.test(open)));
              const label = enabled ? L.types[t.id] : `${L.types[t.id]} (${L.none})`;
              return (
                <button key={t.id} type="button" className={`fo-oo-rail__btn${active ? ' is-active' : ''}`} title={label} aria-label={label} aria-pressed={active} disabled={!enabled} onClick={() => setOpen(active ? '' : target)}>
                  <Icon name={t.icon} size={20} />
                </button>
              );
            })}
            {contextual.filter((c) => !OBJECT_TYPES.some((t) => t.match?.test(c.id))).map((t) => (
              <button key={t.id} type="button" className={`fo-oo-rail__btn${open === t.id ? ' is-active' : ''}`} title={t.label} aria-label={t.label} aria-pressed={open === t.id} onClick={() => setOpen(open === t.id ? '' : t.id)}>
                <Icon name={contextIcon(t)} size={20} />
              </button>
            ))}
          </>
        ) : (
          <>
            <button type="button" className={`fo-oo-rail__btn${open === 'settings' ? ' is-active' : ''}`} title={SB.properties} aria-label={SB.properties} aria-pressed={open === 'settings'} onClick={() => setOpen(open === 'settings' ? '' : 'settings')}>
              <Icon name="options" size={20} />
            </button>
            {stylesGroup && (
              <button type="button" className={`fo-oo-rail__btn${open === 'styles' ? ' is-active' : ''}`} title={SB.styles} aria-label={SB.styles} aria-pressed={open === 'styles'} onClick={() => setOpen(open === 'styles' ? '' : 'styles')}>
                <Icon name="text_paragraph" size={20} />
              </button>
            )}
            {isCalc && (
              <button type="button" className={`fo-oo-rail__btn${open === 'gallery' ? ' is-active' : ''}`} title={SB.gallery} aria-label={SB.gallery} aria-pressed={open === 'gallery'} onClick={() => setOpen(open === 'gallery' ? '' : 'gallery')}>
                <Icon name="image_multiple" size={20} />
              </button>
            )}
            {isCalc && (
              <button type="button" className={`fo-oo-rail__btn${open === 'navigator' ? ' is-active' : ''}`} title={SB.navigator} aria-label={SB.navigator} aria-pressed={open === 'navigator'} onClick={() => setOpen(open === 'navigator' ? '' : 'navigator')}>
                <Icon name="navigation" size={20} />
              </button>
            )}
            {navControl && (
              <button type="button" className="fo-oo-rail__btn" title={SB.navigator} aria-label={SB.navigator} onClick={() => invoke(navControl)}>
                <Icon name="navigation" size={20} />
              </button>
            )}
            {fnControl && (
              <button type="button" className="fo-oo-rail__btn" title={SB.functions} aria-label={SB.functions} onClick={() => invoke(fnControl)}>
                <Icon name="math_formula" size={20} />
              </button>
            )}
            {contextual.map((t) => (
              <button key={t.id} type="button" className={`fo-oo-rail__btn${open === t.id ? ' is-active' : ''}`} title={t.label} aria-label={t.label} aria-pressed={open === t.id} onClick={() => setOpen(open === t.id ? '' : t.id)}>
                <Icon name={contextIcon(t)} size={20} />
              </button>
            ))}
          </>
        )}
      </nav>
    </>
  );
}

function contextIcon(t: RibbonTab): IconName {
  const id = t.id.toLowerCase();
  if (/table/.test(id)) return 'table';
  if (/picture|image/.test(id)) return 'image';
  if (/shape|draw|forme/.test(id)) return 'shapes';
  return 'settings';
}

/** Menu du mode du document, au bout de la rangee d'onglets (« Edition » avec crayon et fleche) : Texte bascule entre la vue Page et le Mode Lecture ; absent ailleurs. */
export function OoModeMenu({ tabs }: { tabs: readonly RibbonTab[] }) {
  const L = S.layouts.oo;
  const read = findControl(tabs, /^mode lecture$/i);
  const edit = findControl(tabs, /^page$/i);
  const [reading, setReading] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!read || !edit) return null;
  const items: MenuItem[] = [
    { id: 'mode-edit', label: L.modeEdit, icon: 'edit', checked: !reading, onClick: () => { invoke(edit); setReading(false); } },
    { id: 'mode-read', label: L.modeRead, icon: 'eye', checked: reading, onClick: () => { invoke(read); setReading(true); } },
  ];
  return (
    <div className="fo-oo-mode" role="group" aria-label={L.mode}>
      <button type="button" className="fo-oo-mode__btn" aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)}>
        <Icon name={reading ? 'eye' : 'edit'} size={16} />
        <span>{reading ? L.modeRead : L.modeEdit}</span>
        <Icon name="chevron_down" size={12} />
      </button>
      {anchor && <Menu items={items} anchor={anchor} placement="below" onClose={() => setAnchor(null)} label={L.mode} />}
    </div>
  );
}

/** Section du panneau « Parametres » OnlyOffice : titre, champs en lignes (libelle a gauche, champ a droite), boutons d'icones cote a cote ; nos commandes branchees. */
function PanelSection({ group }: { group: RibbonGroup }) {
  const controls = flatten(group.controls).filter((c) => c.kind !== 'separator' && !c.hidden);
  const isField = (c: RibbonControl): boolean => c.kind === 'combo' || c.kind === 'font' || c.kind === 'number' || c.kind === 'checkbox' || c.kind === 'gallery';
  const blocks: (RibbonControl | RibbonControl[])[] = [];
  for (const c of controls) {
    const last = blocks[blocks.length - 1];
    if (isField(c)) blocks.push(c);
    else if (Array.isArray(last)) last.push(c);
    else blocks.push([c]);
  }
  const title = GROUP_LABELS[group.id] ?? group.label;
  return (
    <section className="fo-oo-form" aria-label={title}>
      <h3 className="fo-oo-form__title">{title}</h3>
      {blocks.map((b, i) =>
        Array.isArray(b) ? (
          <div key={`b${i}`} className="fo-oo-form__tools">
            {b.map((c) => <RibbonControlView key={c.id} control={c} mode="icon" ctx={CTX} />)}
          </div>
        ) : (
          <div key={b.id} className={`fo-oo-form__row fo-oo-form__row--${b.kind}`}>
            {(b.kind === 'combo' || b.kind === 'font') && <span className="fo-oo-form__label">{b.label}</span>}
            <RibbonControlView control={b} mode="small" ctx={CTX} />
          </div>
        ),
      )}
    </section>
  );
}

/** « Ouvrir l'emplacement du fichier » : bouton de la rangee d'onglets d'OnlyOffice ; grise, la suite n'a pas de fonction pour montrer un fichier dans l'explorateur. */
export function OoReveal() {
  return (
    <button type="button" className="fo-oo-reveal" disabled aria-label="Ouvrir l'emplacement du fichier" title="Ouvrir l'emplacement du fichier : pas encore disponible dans ForgeOffice">
      <Icon name="folder_open" size={18} />
    </button>
  );
}
