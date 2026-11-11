// Disposition « barre de menus + barres d'outils » (LibreOffice, OpenOffice, Office 2003, Google Docs).
// Memes commandes que le ruban : chaque onglet devient un menu (un sous-menu par groupe) et l'onglet principal reste visible en barre d'outils.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppId, Settings } from '@forgeoffice/core';
import type { RibbonTab } from '../../ribbon-types.ts';
import type { LayoutId } from '../../logic/layouts.ts';
import { groupsToMenu } from '../../logic/commands.ts';
import { buildMenus, suiteSpec, toolbarRows } from '../../logic/menuMap.ts';
import { S } from '../../strings.ts';
import { layoutMenuItem } from '../../layoutHooks.ts';
import type { MenuItem } from '../../ribbon-types.ts';
import { Dialog } from '../Dialog.tsx';
import { Menu } from '../Menu.tsx';
import { RibbonGroupView } from '../ribbon/RibbonGroup.tsx';
import { OnlyOfficeDock } from './OnlyOfficeDock.tsx';
import type { ControlContext } from '../ribbon/RibbonControls.tsx';

export interface MenuBarLayoutProps {
  tabs: readonly RibbonTab[];
  /** Ouvre le Backstage, eventuellement sur une page (nouveau, ouvrir, enregistrer sous, imprimer...). */
  onFile?: (page?: string) => void;
  fileLabel?: string;
  end?: ReactNode;
  settings?: Settings | null;
  variant: LayoutId;
  /** Module affiche : choisit les menus propres a la suite imitee (LibreOffice, OpenOffice). */
  app?: AppId | null;
}

const LAYOUT_TAB = '__layout';
const FILE_TAB = '__file';
const WINDOW_TAB = '__window';
const HELP_TAB = '__help';
const press = (key: string): void => { document.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true })); };
const toggleFullscreen = (): void => { void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined); };
const CTX: ControlContext = { keytips: new Map(), onCommand: () => undefined };

export function MenuBarLayout({ tabs, onFile, fileLabel = S.ribbon.file, end, settings, variant, app = null }: MenuBarLayoutProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(() => tabs.filter((t) => !t.hidden), [tabs]);
  // LibreOffice et OpenOffice : menus et barres d'outils a la maniere de la suite, memes commandes que le ruban.
  const suite = variant === 'libreoffice' || variant === 'openoffice' ? suiteSpec(app, variant === 'openoffice') : null;
  const suiteMenus = useMemo(() => (suite ? buildMenus(suite, tabs) : null), [suite, tabs]);
  const suiteRows = useMemo(() => (suite ? toolbarRows(suite, tabs) : null), [suite, tabs]);
  const main = visible.find((t) => !t.contextual) ?? visible[0];
  const contextual = visible.filter((t) => t.contextual);
  const [open, setOpen] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [about, setAbout] = useState(false);
  const openTab = visible.find((t) => t.id === open?.id);
  const openSuite = suiteMenus?.find((m) => m.id === open?.id);
  const B = S.backstage;
  const L = S.layouts;
  const sepItem = (id: string): MenuItem => ({ id, kind: 'separator' });
  const page = (id: string, label: string, p: string, shortcut?: string): MenuItem => ({ id, label, shortcut, onClick: () => onFile?.(p) });
  const fileItems: MenuItem[] = [
    page('new', B.new, 'new', 'Ctrl+N'), page('open', B.open, 'open', 'Ctrl+O'), sepItem('s1'),
    { id: 'save', label: L.fileMenu.save, shortcut: 'Ctrl+S', onClick: () => press('s') }, page('saveAs', B.saveAs, 'saveAs'), sepItem('s2'),
    page('export', B.export, 'export'), page('print', B.print, 'print', 'Ctrl+P'), sepItem('s3'),
    page('info', L.fileMenu.props, 'info'), page('home', B.home, 'home'),
  ];
  const windowItems: MenuItem[] = [{ id: 'fs', label: L.fullscreen, shortcut: 'F11', onClick: toggleFullscreen }];
  const helpItems: MenuItem[] = [{ id: 'upd', label: L.updates, onClick: () => onFile?.('account') }, sepItem('h1'), { id: 'about', label: L.about, onClick: () => setAbout(true) }];
  const items = useMemo(() => (open?.id === FILE_TAB ? fileItems : open?.id === WINDOW_TAB ? windowItems : open?.id === HELP_TAB ? helpItems : open?.id === LAYOUT_TAB ? (layoutMenuItem(settings, variant).items ?? []) : openSuite ? (openSuite.items.length > 0 ? openSuite.items : [{ id: 'empty', label: S.layouts.menuEmpty, disabled: true }]) : openTab ? groupsToMenu(openTab) : []), // eslint-disable-next-line react-hooks/exhaustive-deps -- les listes ne dependent que de onFile
  [open?.id, openTab, openSuite, settings, variant, onFile]);

  const legacyRows = [main, ...contextual].filter((t): t is RibbonTab => Boolean(t));
  return (
    <div ref={rootRef} className={`fo-ribbon fo-menubar fo-menubar--${variant}`} data-menubar>
      <div className="fo-menubar__row" role="menubar" aria-label={S.ribbon.tabsLabel}>
        {onFile && (
          <button
            type="button"
            role="menuitem"
            className={`fo-menubar__item${open?.id === FILE_TAB ? ' is-open' : ''}`}
            {...(suite ? { 'aria-haspopup': 'menu' as const, onClick: (e: React.MouseEvent<HTMLButtonElement>) => setOpen(open?.id === FILE_TAB ? null : { id: FILE_TAB, anchor: e.currentTarget }), onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => open && open.id !== FILE_TAB && setOpen({ id: FILE_TAB, anchor: e.currentTarget }) } : { onClick: () => onFile() })}
          >
            {fileLabel}
          </button>
        )}
        {(suiteMenus ?? visible.map((t) => ({ id: t.id, label: t.label, items: [], contextual: Boolean(t.contextual) }))).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open?.id === tab.id}
            className={`fo-menubar__item${open?.id === tab.id ? ' is-open' : ''}${'contextual' in tab && tab.contextual ? ' is-contextual' : ''}${suiteMenus && tab.items.length === 0 ? ' is-empty' : ''}`}
            onClick={(e) => setOpen(open?.id === tab.id ? null : { id: tab.id, anchor: e.currentTarget })}
            onMouseEnter={(e) => open && open.id !== tab.id && setOpen({ id: tab.id, anchor: e.currentTarget })}
          >
            {tab.label}
          </button>
        ))}
        {suite && [{ id: WINDOW_TAB, label: L.windowMenu }, { id: HELP_TAB, label: L.helpMenu }].map((m) => (
          <button
            key={m.id}
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open?.id === m.id}
            className={`fo-menubar__item${open?.id === m.id ? ' is-open' : ''}`}
            onClick={(e) => setOpen(open?.id === m.id ? null : { id: m.id, anchor: e.currentTarget })}
            onMouseEnter={(e) => open && open.id !== m.id && setOpen({ id: m.id, anchor: e.currentTarget })}
          >
            {m.label}
          </button>
        ))}
        <button
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          className={`fo-menubar__item fo-menubar__layout${open?.id === LAYOUT_TAB ? ' is-open' : ''}`}
          onClick={(e) => setOpen(open?.id === LAYOUT_TAB ? null : { id: LAYOUT_TAB, anchor: e.currentTarget })}
        >
          {S.layouts.menu}
        </button>
        {end && <div className="fo-menubar__end">{end}</div>}
      </div>
      {suiteRows
        ? [
            ...suiteRows.map((row, i) => (
              <div key={`row${i}`} className="fo-menubar__toolbar" role="toolbar" aria-label={i === 0 ? S.layouts.standardBar : S.layouts.formatBar}>
                {row.flatMap((part) => part.groups.map((group) => <RibbonGroupView key={`${part.tab.id}.${group.id}`} group={group} level={2} ctx={CTX} simplified />))}
              </div>
            )),
            ...contextual.map((tab) => (
              <div key={tab.id} className="fo-menubar__toolbar fo-menubar__toolbar--context" role="toolbar" aria-label={tab.label}>
                {tab.groups.map((group) => <RibbonGroupView key={group.id} group={group} level={2} ctx={CTX} simplified />)}
              </div>
            )),
          ]
        : legacyRows.map((tab) => (
            <div key={tab.id} className="fo-menubar__toolbar" role="toolbar" aria-label={tab.label}>
              {tab.groups.map((group) => (
                <RibbonGroupView key={group.id} group={group} level={2} ctx={CTX} simplified />
              ))}
            </div>
          ))}
      {open && (openTab || openSuite || [LAYOUT_TAB, FILE_TAB, WINDOW_TAB, HELP_TAB].includes(open.id)) && <Menu items={items} anchor={open.anchor} placement="below" onClose={() => setOpen(null)} label={openSuite?.label ?? openTab?.label ?? S.layouts.menu} />}
      <Dialog open={about} title={L.about} onClose={() => setAbout(false)} width={420} actions={[{ label: S.dialog.close, primary: true, onClick: () => setAbout(false) }]}>
        <p>{`ForgeOffice ${document.documentElement.dataset.foVersion ?? ''}`.trim()}</p>
        <p>{L.aboutText}</p>
      </Dialog>
      {suite && <OnlyOfficeDock variant={variant} tabs={tabs.filter((t) => !t.hidden)} host={rootRef} settings={settings} />}
    </div>
  );
}
