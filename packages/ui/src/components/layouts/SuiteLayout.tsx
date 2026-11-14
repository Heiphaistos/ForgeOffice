// Copie fidele de LibreOffice / OpenOffice : barre de menus et barres d'outils reelles de la suite (structure extraite de l'installation),
// branchees sur les commandes ForgeOffice ; ce que la suite n'expose pas reste accessible dans le menu « ForgeOffice ».
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NAVIGATE_EVENT, type AppId, type NavigateDetail, type Settings } from '@forgeoffice/core';
import type { MenuItem, RibbonTab } from '../../ribbon-types.ts';
import type { LayoutId } from '../../logic/layouts.ts';
import { groupsToMenu } from '../../logic/commands.ts';
import { makeBinder } from '../../logic/suite/bind.ts';
import { buildCatalog } from '../../logic/suite/catalog.ts';
import { buildSuiteBars, buildSuiteMenus, type HostCommands, type SuiteMenu } from '../../logic/suite/build.ts';
import type { SuiteData } from '../../logic/suite/types.ts';
import { S } from '../../strings.ts';
import { layoutMenuItem } from '../../layoutHooks.ts';
import { Dialog } from '../Dialog.tsx';
import { Menu } from '../Menu.tsx';
import { RibbonGroupView } from '../ribbon/RibbonGroup.tsx';
import type { ControlContext } from '../ribbon/RibbonControls.tsx';
import { OnlyOfficeDock } from './OnlyOfficeDock.tsx';
import { SIDEBAR_EVENT } from './CalcSidePanels.tsx';
import { SuiteToolbar } from './SuiteToolbar.tsx';
import './suite-foot.css';
import './suite-sidebar.css';
import { SuiteOptions } from './SuiteOptions.tsx';
import type { ReactNode } from 'react';

export interface SuiteLayoutProps {
  tabs: readonly RibbonTab[];
  onFile?: (page?: string) => void;
  end?: ReactNode;
  settings?: Settings | null;
  variant: LayoutId;
  app?: AppId | null;
  data: SuiteData;
}

const LAYOUT_TAB = '__layout';
const OWN_TAB = '__own';
const CTX: ControlContext = { keytips: new Map(), onCommand: () => undefined };
const press = (key: string): void => { document.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true })); };
const toggleFullscreen = (): void => { void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined); };

/** Commandes de la suite qui relevent de l'application (fichier, fenetre, aide) et non d'un onglet du ruban. */
const panel = (id: string) => (): void => { window.dispatchEvent(new CustomEvent(SIDEBAR_EVENT, { detail: id })); };

const SUITE_APP: Record<string, string> = { word: 'Writer', excel: 'Calc', powerpoint: 'Impress', publisher: 'Draw', access: 'Base' };
/** Titre du document de cette fenetre, au format de la vraie suite : « Sans nom 1 — LibreOffice Writer » (suit le titre de la page). */
function useWindowTitle(product: string, app?: AppId | null): string {
  // Noms par defaut des modules (Document1, Classeur1, Presentation1...) : la vraie suite les appelle « Sans nom N ».
  const read = (): string => (document.title.replace(/ - [^-]*$/, '').replace(/\.[a-z0-9]{2,5}$/i, '').trim() || 'Sans nom 1').replace(/^(Document|Classeur|Pr[ée]sentation|Publication|Dessin|Base)\s*(\d+)$/i, 'Sans nom $2');
  const [name, setName] = useState(read);
  useEffect(() => {
    const el = document.querySelector('title');
    if (!el) return undefined;
    const mo = new MutationObserver(() => setName(read()));
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return `${name} — ${product} ${SUITE_APP[app ?? ''] ?? ''}`.trim();
}

function hostCommands(onFile: ((page?: string) => void) | undefined, about: () => void, options: () => void, app?: string): HostCommands {
  const page = (p: string) => (): void => onFile?.(p);
  // Fichier > Nouveau > <type> : le module courant ouvre sa page « Nouveau », les autres sont montes par la coquille (evenement `fo-navigate`).
  const nav = (target: AppId) => (): void => { if (target === app) onFile?.('new'); else window.dispatchEvent(new CustomEvent<NavigateDetail>(NAVIGATE_EVENT, { detail: { app: target, file: null } })); };
  const cmds: Record<string, () => void> = {
    AddDirect: page('new'), NewDoc: page('new'), NewWriter: nav('word'), NewCalc: nav('excel'), NewImpress: nav('powerpoint'), NewDraw: nav('publisher'), NewBase: nav('access'), NewTemplate: page('new'), CheckUpdate: page('account'), CommandPopup: () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', altKey: true, bubbles: true })); }, Open: page('open'), OpenFromWriter: page('open'), OpenFromCalc: page('open'), OpenFromImpress: page('open'), OpenFromDraw: page('open'),
    Save: () => press('s'), SaveAll: () => press('s'), Undo: () => press('z'), Redo: () => press('y'), SaveAs: page('saveAs'), SaveACopy: page('saveAs'), ExportTo: page('export'), ExportToPDF: page('export'), ExportDirectToPDF: page('export'),
    Print: page('print'), DirectPrint: page('print'), PrintPreview: page('print'), PrinterSetup: page('print'), SetDocumentProperties: page('info'), CloseDoc: page('home'),
    FullScreen: toggleFullscreen, About: about, OptionsTreeDialog: options, Quit: () => window.close(), CloseWin: () => window.close(), NewWindow: () => { window.open(window.location.href, '_blank'); },
  };
  // Calc : les entrees Affichage > Volet latéral / Styles / Galerie / Navigateur ouvrent les panneaux de la barre laterale.
  if (app === 'excel') Object.assign(cmds, { Sidebar: panel('settings'), ViewSidebarStyles: panel('styles'), Gallery: panel('gallery'), Navigator: panel('navigator') });
  if (!onFile) for (const k of Object.keys(cmds)) if (k !== 'FullScreen' && k !== 'About' && k !== 'OptionsTreeDialog' && k !== 'Quit' && k !== 'CloseWin' && k !== 'NewWindow' && k !== 'Save' && k !== 'SaveAll' && k !== 'Undo' && k !== 'Redo' && !(app === 'excel' && ['Sidebar', 'ViewSidebarStyles', 'Gallery', 'Navigator'].includes(k))) delete cmds[k];
  return cmds;
}

export function SuiteLayout({ tabs, onFile, end, settings, variant, data, app }: SuiteLayoutProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [about, setAbout] = useState(false);
  const [options, setOptions] = useState(false);
  const winTitle = useWindowTitle(variant === 'openoffice' ? 'OpenOffice' : 'LibreOffice', app);
  const visible = useMemo(() => tabs.filter((t) => !t.hidden), [tabs]);
  const contextual = visible.filter((t) => t.contextual);
  const binder = useMemo(() => makeBinder(buildCatalog(tabs), hostCommands(onFile, () => setAbout(true), () => setOptions(true), app ?? undefined)), [tabs, onFile, app]);
  const menus = useMemo<SuiteMenu[]>(() => {
    const own: SuiteMenu = { id: OWN_TAB, label: 'ForgeOffice', items: visible.map((t): MenuItem => ({ id: `own:${t.id}`, label: t.label, items: groupsToMenu(t) })) };
    const base = buildSuiteMenus(data, binder, variant === 'openoffice' ? 'OpenOffice' : 'LibreOffice', winTitle);
    return [...base, own];
  }, [data, binder, visible, variant, winTitle]);
  const allBars = useMemo(() => buildSuiteBars(data, binder), [data, binder]);
  const side = data.side ? allBars[allBars.length - 1] : undefined;
  const foot = data.foot ? allBars[allBars.length - 1 - (side ? 1 : 0)] : undefined;
  const bars = allBars.slice(0, allBars.length - (foot ? 1 : 0) - (side ? 1 : 0));
  const footHost = useFootHost(rootRef, Boolean(foot), variant);
  const sideHost = useSideHost(rootRef, Boolean(side), variant);
  const L = S.layouts;
  const openMenu = menus.find((m) => m.id === open?.id);
  const items: readonly MenuItem[] = open?.id === LAYOUT_TAB ? (layoutMenuItem(settings, variant).items ?? []) : openMenu?.items ?? [];
  const toggle = (id: string, e: React.MouseEvent<HTMLElement>): void => setOpen(open?.id === id ? null : { id, anchor: e.currentTarget });
  const hover = (id: string, e: React.MouseEvent<HTMLElement>): void => { if (open && open.id !== id) setOpen({ id, anchor: e.currentTarget }); };

  return (
    <div ref={rootRef} className={`fo-ribbon fo-menubar fo-menubar--${variant} fo-suite fo-suite--${variant}`} data-menubar data-suite={variant}>
      <div className="fo-menubar__row" role="menubar" aria-label={S.ribbon.tabsLabel}>
        {menus.map((m) => (
          <button key={m.id} type="button" role="menuitem" aria-haspopup="menu" aria-expanded={open?.id === m.id} className={`fo-menubar__item${open?.id === m.id ? ' is-open' : ''}${m.id === OWN_TAB ? ' fo-menubar__own' : ''}`} onClick={(e) => toggle(m.id, e)} onMouseEnter={(e) => hover(m.id, e)}>
            {withMnemonic(m.label, m.mnemonic)}
          </button>
        ))}
        <button type="button" role="menuitem" aria-haspopup="menu" className={`fo-menubar__item fo-menubar__layout${open?.id === LAYOUT_TAB ? ' is-open' : ''}`} onClick={(e) => toggle(LAYOUT_TAB, e)} onMouseEnter={(e) => hover(LAYOUT_TAB, e)}>
          {L.menu}
        </button>
        {end && <div className="fo-menubar__end">{end}</div>}
      </div>
      {bars.map((entries, i) => <SuiteToolbar key={`bar${i}`} entries={entries} label={i === 0 ? L.standardBar : L.formatBar} ctx={CTX} />)}
      {contextual.map((tab) => (
        <div key={tab.id} className="fo-menubar__toolbar fo-menubar__toolbar--context" role="toolbar" aria-label={tab.label}>
          {tab.groups.map((group) => <RibbonGroupView key={group.id} group={group} level={2} ctx={CTX} simplified />)}
        </div>
      ))}
      {side && sideHost && createPortal(<SuiteToolbar entries={side} label={L.drawBar} ctx={CTX} vertical />, sideHost)}
      {foot && footHost && createPortal(<SuiteToolbar entries={foot} label={L.drawBar} ctx={CTX} />, footHost)}
      {open && (openMenu || open.id === LAYOUT_TAB) && <Menu items={items} anchor={open.anchor} placement="below" onClose={() => setOpen(null)} label={openMenu?.label ?? L.menu} />}
      <Dialog open={about} title={L.about} onClose={() => setAbout(false)} width={420} actions={[{ label: S.dialog.close, primary: true, onClick: () => setAbout(false) }]}>
        <p>{`ForgeOffice ${document.documentElement.dataset.foVersion ?? ''}`.trim()}</p>
        <p>{L.aboutText}</p>
      </Dialog>
      {options && <SuiteOptions settings={settings} app={app} kind={variant === 'openoffice' ? 'openoffice' : 'libreoffice'} onClose={() => setOptions(false)} />}
      <OnlyOfficeDock variant={variant} tabs={visible} host={rootRef} settings={settings} />
    </div>
  );
}

/** Emplacement de la barre du bas : un conteneur insere juste avant la barre d'etat de l'application (hors du ruban). */
function useFootHost(root: React.RefObject<HTMLElement | null>, wanted: boolean, variant: string): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const shell = root.current?.parentElement;
    const sb = shell?.querySelector(':scope > .fo-sb');
    if (!wanted || !shell || !sb) { setHost(null); return; }
    const el = document.createElement('div');
    el.className = `fo-suite fo-suite--${variant} fo-suite--foot`;
    el.dataset.suiteFoot = '';
    shell.insertBefore(el, sb);
    setHost(el);
    return () => { el.remove(); setHost(null); };
  }, [root, wanted, variant]);
  return host;
}

/** Emplacement de la barre verticale : premier enfant du corps de l'application (marque `data-suite-body`), a gauche de la zone de travail. */
function useSideHost(root: React.RefObject<HTMLElement | null>, wanted: boolean, variant: string): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const body = root.current?.parentElement?.querySelector(':scope > [data-suite-body]');
    if (!wanted || !body) { setHost(null); return; }
    const el = document.createElement('div');
    el.className = `fo-suite fo-suite--${variant} fo-suite--side`;
    body.insertBefore(el, body.firstChild);
    setHost(el);
    return () => { el.remove(); setHost(null); };
  }, [root, wanted, variant]);
  return host;
}

function withMnemonic(label: string, key?: string): ReactNode {
  const at = key ? label.toLowerCase().indexOf(key.toLowerCase()) : -1;
  return at < 0 ? label : <>{label.slice(0, at)}<u>{label.slice(at, at + 1)}</u>{label.slice(at + 1)}</>;
}
