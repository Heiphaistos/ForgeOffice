// Disposition « barre de menus + barres d'outils » (LibreOffice, OpenOffice, Office 2003, Google Docs).
// Memes commandes que le ruban : chaque onglet devient un menu (un sous-menu par groupe) et l'onglet principal reste visible en barre d'outils.
import { useMemo, useState, type ReactNode } from 'react';
import type { Settings } from '@forgeoffice/core';
import type { RibbonTab } from '../../ribbon-types.ts';
import type { LayoutId } from '../../logic/layouts.ts';
import { groupsToMenu } from '../../logic/commands.ts';
import { S } from '../../strings.ts';
import { layoutMenuItem } from '../../layoutHooks.ts';
import { Menu } from '../Menu.tsx';
import { RibbonGroupView } from '../ribbon/RibbonGroup.tsx';
import type { ControlContext } from '../ribbon/RibbonControls.tsx';

export interface MenuBarLayoutProps {
  tabs: readonly RibbonTab[];
  onFile?: () => void;
  fileLabel?: string;
  end?: ReactNode;
  settings?: Settings | null;
  variant: LayoutId;
}

const LAYOUT_TAB = '__layout';
const CTX: ControlContext = { keytips: new Map(), onCommand: () => undefined };

export function MenuBarLayout({ tabs, onFile, fileLabel = S.ribbon.file, end, settings, variant }: MenuBarLayoutProps) {
  const visible = useMemo(() => tabs.filter((t) => !t.hidden), [tabs]);
  const main = visible.find((t) => !t.contextual) ?? visible[0];
  const contextual = visible.filter((t) => t.contextual);
  const [open, setOpen] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const openTab = visible.find((t) => t.id === open?.id);
  const items = useMemo(() => (open?.id === LAYOUT_TAB ? (layoutMenuItem(settings, variant).items ?? []) : openTab ? groupsToMenu(openTab) : []), [open?.id, openTab, settings, variant]);

  const toolbarRows = [main, ...contextual].filter((t): t is RibbonTab => Boolean(t));
  return (
    <div className={`fo-ribbon fo-menubar fo-menubar--${variant}`} data-menubar>
      <div className="fo-menubar__row" role="menubar" aria-label={S.ribbon.tabsLabel}>
        {onFile && (
          <button type="button" role="menuitem" className="fo-menubar__item" onClick={onFile}>
            {fileLabel}
          </button>
        )}
        {visible.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open?.id === tab.id}
            className={`fo-menubar__item${open?.id === tab.id ? ' is-open' : ''}${tab.contextual ? ' is-contextual' : ''}`}
            onClick={(e) => setOpen(open?.id === tab.id ? null : { id: tab.id, anchor: e.currentTarget })}
            onMouseEnter={(e) => open && open.id !== tab.id && setOpen({ id: tab.id, anchor: e.currentTarget })}
          >
            {tab.label}
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
      {toolbarRows.map((tab) => (
        <div key={tab.id} className="fo-menubar__toolbar" role="toolbar" aria-label={tab.label}>
          {tab.groups.map((group) => (
            <RibbonGroupView key={group.id} group={group} level={2} ctx={CTX} simplified />
          ))}
        </div>
      ))}
      {open && (openTab || open.id === LAYOUT_TAB) && <Menu items={items} anchor={open.anchor} placement="below" onClose={() => setOpen(null)} label={openTab?.label ?? S.layouts.menu} />}
    </div>
  );
}
