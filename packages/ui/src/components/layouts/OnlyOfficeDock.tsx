// Barres laterales des dispositions OnlyOffice, LibreOffice et OpenOffice : rail droit dont le panneau (« Parametres » / « Proprietes »)
// reprend les groupes du ruban (texte, image, forme, tableau...) ; OnlyOffice ajoute un rail gauche (recherche, commentaires, navigation).
// Memes commandes, autre place.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Settings } from '@forgeoffice/core';
import type { LayoutId } from '../../logic/layouts.ts';
import { Icon } from '../../icons/Icon.tsx';
import type { IconName } from '../../icons/generated.ts';
import type { RibbonControl, RibbonTab } from '../../ribbon-types.ts';
import { usePersistentState } from '../../hooks.ts';
import { S } from '../../strings.ts';
import { RibbonGroupView } from '../ribbon/RibbonGroup.tsx';
import type { ControlContext } from '../ribbon/RibbonControls.tsx';

const RAIL = 40;
const PANEL = 300;
const CTX: ControlContext = { keytips: new Map(), onCommand: () => undefined };
/** Groupes du premier onglet laisses de cote dans « Parametres » (presse-papiers, edition : deja a portee dans la barre d'outils). */
const SKIP_GROUP = /clip|presse|editing|modif/i;

function flatten(controls: readonly RibbonControl[]): RibbonControl[] {
  return controls.flatMap((c) => (c.kind === 'row' ? flatten(c.controls) : [c]));
}

/** Premier bouton ou bascule du ruban dont l'intitule correspond. */
function findControl(tabs: readonly RibbonTab[], label: RegExp): RibbonControl | null {
  for (const t of tabs) for (const g of t.groups) for (const c of flatten(g.controls)) if ((c.kind === 'button' || c.kind === 'toggle') && !c.hidden && label.test(c.label)) return c;
  return null;
}

function invoke(c: RibbonControl): void {
  if (c.kind === 'button' || c.kind === 'split') c.onClick();
  else if (c.kind === 'toggle') c.onToggle(!c.pressed);
}

interface LeftItem {
  id: string;
  label: string;
  icon: IconName;
  run: () => void;
}

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
  const SB = S.layouts.sidebar;
  const main = tabs.find((t) => !t.contextual) ?? tabs[0];
  const contextual = useMemo(() => tabs.filter((t) => t.contextual && !t.hidden), [tabs]);
  // OnlyOffice : panneau ferme au depart ; LibreOffice et OpenOffice : barre laterale ouverte sur « Proprietes ».
  const [open, setOpen] = usePersistentState<string>(settings, oo ? 'ui.onlyoffice.panel' : 'ui.sidebar.panel', oo ? '' : 'settings');
  const [top, setTop] = useState(0);
  const [bottom, setBottom] = useState(0);
  const seen = useRef(new Set<string>());

  // Un objet selectionne (image, forme, tableau...) ouvre son panneau, comme dans OnlyOffice.
  useEffect(() => {
    const fresh = contextual.find((t) => !seen.current.has(t.id));
    seen.current = new Set(contextual.map((t) => t.id));
    if (fresh) setOpen(fresh.id);
    else if (open && open !== 'settings' && open !== 'styles' && !contextual.some((t) => t.id === open)) setOpen('settings');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagit seulement aux onglets contextuels
  }, [contextual]);

  const stylesGroup = !oo ? main?.groups.find((g) => !g.hidden && /styl/i.test(`${g.id} ${g.label}`)) : undefined;
  const navControl = !oo ? findControl(tabs, /navigat|^plan$/i) : null;
  const panelTab = open === 'settings' || open === 'styles' ? main : contextual.find((t) => t.id === open);
  const rightWidth = RAIL + (panelTab ? PANEL : 0);

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
    return items;
  }, [tabs, L]);

  const skip = oo ? SKIP_GROUP : /clip|presse|editing|modif|styl/i;
  const groups = !panelTab ? [] : open === 'styles' ? (stylesGroup ? [stylesGroup] : []) : panelTab.groups.filter((g) => !g.hidden && (panelTab !== main || !skip.test(`${g.id} ${g.label}`)));
  const title = open === 'styles' ? SB.styles : open === 'settings' ? (oo ? L.settings : SB.properties) : (panelTab?.label ?? '');
  const style = { top, bottom };
  return (
    <>
      {oo && (
        <nav className={`fo-oo-rail fo-oo-rail--left fo-oo--${variant}`} style={style} aria-label={L.left}>
          {left.map((i) => (
            <button key={i.id} type="button" className="fo-oo-rail__btn" title={i.label} aria-label={i.label} onClick={i.run}>
              <Icon name={i.icon} size={20} />
            </button>
          ))}
        </nav>
      )}
      {panelTab && (
        <aside className={`fo-oo-panel fo-oo--${variant}`} style={{ ...style, right: RAIL }} aria-label={title}>
          <h2 className="fo-oo-panel__title">{title}</h2>
          <div className="fo-oo-panel__body">
            {groups.map((g) => (
              <RibbonGroupView key={g.id} group={g} level={1} ctx={CTX} />
            ))}
          </div>
        </aside>
      )}
      <nav className={`fo-oo-rail fo-oo-rail--right fo-oo--${variant}`} style={style} aria-label={oo ? L.right : SB.tabs}>
        <button type="button" className={`fo-oo-rail__btn${open === 'settings' ? ' is-active' : ''}`} title={oo ? L.settings : SB.properties} aria-label={oo ? L.settings : SB.properties} aria-pressed={open === 'settings'} onClick={() => setOpen(open === 'settings' ? '' : 'settings')}>
          <Icon name="options" size={20} />
        </button>
        {stylesGroup && (
          <button type="button" className={`fo-oo-rail__btn${open === 'styles' ? ' is-active' : ''}`} title={SB.styles} aria-label={SB.styles} aria-pressed={open === 'styles'} onClick={() => setOpen(open === 'styles' ? '' : 'styles')}>
            <Icon name="text_paragraph" size={20} />
          </button>
        )}
        {navControl && (
          <button type="button" className="fo-oo-rail__btn" title={SB.navigator} aria-label={SB.navigator} onClick={() => invoke(navControl)}>
            <Icon name="navigation" size={20} />
          </button>
        )}
        {contextual.map((t) => (
          <button key={t.id} type="button" className={`fo-oo-rail__btn${open === t.id ? ' is-active' : ''}`} title={t.label} aria-label={t.label} aria-pressed={open === t.id} onClick={() => setOpen(open === t.id ? '' : t.id)}>
            <Icon name={contextIcon(t)} size={20} />
          </button>
        ))}
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
