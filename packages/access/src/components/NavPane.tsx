// Volet de navigation d'Access : « Tous les objets Access », recherche, groupes repliables, menu contextuel.
import { useMemo, useState, type MouseEvent } from 'react';
import type { Settings } from '@forgeoffice/core';
import { Icon, useContextMenu, usePersistentState, type IconName, type MenuItem } from '@forgeoffice/ui';
import { DEFAULT_NAV_VIEW, arrangeNav, hiddenCount, hiddenKey, hideEntry, unhideEntry, type NavEntry, type NavView } from '../logic/nav-view.ts';
import { fold } from '../logic/table-ops.ts';
import { S } from '../strings.ts';
import { N } from '../strings-nav.ts';
import type { ObjetBase } from '../types.ts';

export type ObjKind = 'table' | 'requete' | 'formulaire' | 'etat' | 'macro';
export const KINDS: readonly ObjKind[] = ['table', 'requete', 'formulaire', 'etat', 'macro'];

export const KIND_ICON: Record<ObjKind, IconName> = {
  table: 'table',
  requete: 'database_search',
  formulaire: 'form',
  etat: 'document_text',
  macro: 'play',
};

export function kindOf(o: ObjetBase): ObjKind | null {
  if (o.genre === 'vue') return 'requete';
  return KINDS.includes(o.genre as ObjKind) ? (o.genre as ObjKind) : null;
}

export interface NavSelection {
  kind: ObjKind;
  name: string;
}

interface NavPaneProps {
  objects: readonly ObjetBase[];
  selected: NavSelection | null;
  collapsed: boolean;
  readOnly: boolean;
  /** Reglages de la plateforme : memorisent le regroupement, le tri et les objets masques. */
  settings?: Settings | null;
  onToggle: () => void;
  onSelect: (s: NavSelection) => void;
  onOpen: (s: NavSelection, view?: 'design' | 'layout') => void;
  onRename: (s: NavSelection) => void;
  onDelete: (s: NavSelection) => void;
  onCopy: (s: NavSelection) => void;
  onExport: (s: NavSelection) => void;
}

export function NavPane({ objects, selected, collapsed, readOnly, settings, onToggle, onSelect, onOpen, onRename, onDelete, onCopy, onExport }: NavPaneProps) {
  const [search, setSearch] = useState('');
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const menu = useContextMenu();
  const [view, setView] = usePersistentState<NavView>(settings, 'access.nav.view', DEFAULT_NAV_VIEW);
  const entries = useMemo(() => objects.flatMap((o): NavEntry[] => {
    const kind = kindOf(o);
    return kind ? [{ kind, name: o.nom, modified: o.modifie_le }] : [];
  }), [objects]);
  const groups = useMemo(() => {
    const needle = fold(search.trim());
    return arrangeNav(entries, view, (name) => needle === '' || fold(name).includes(needle), search !== '');
  }, [entries, view, search]);
  const hiddenTotal = hiddenCount(entries, view);

  if (collapsed) {
    return (
      <aside className="acc-nav is-collapsed">
        <button type="button" className="acc-nav__toggle" onClick={onToggle} title={S.nav.expand} aria-label={S.nav.expand}>
          <Icon name="chevron_double_down" size={16} />
        </button>
        <span className="acc-nav__vertical">{S.nav.title}</span>
      </aside>
    );
  }

  const itemMenu = (s: NavSelection): MenuItem[] => {
    return [
      { id: 'open', label: s.kind === 'macro' ? S.nav.run : S.nav.open, icon: 'open', onClick: () => onOpen(s) },
      ...(s.kind === 'formulaire' || s.kind === 'etat' ? [{ id: 'layout', label: S.nav.layout, icon: 'layer' as IconName, onClick: () => onOpen(s, 'layout') }] : []),
      { id: 'design', label: S.nav.design, icon: 'edit', onClick: () => onOpen(s, 'design') },
      { id: 's1', kind: 'separator' },
      { id: 'export', label: S.nav.export, icon: 'arrow_export_ltr', onClick: () => onExport(s), disabled: s.kind !== 'table' && s.kind !== 'requete' },
      { id: 's2', kind: 'separator' },
      { id: 'rename', label: S.nav.rename, icon: 'rename', disabled: readOnly, onClick: () => onRename(s) },
      { id: 'copy', label: S.nav.copy, icon: 'copy', disabled: readOnly, onClick: () => onCopy(s) },
      { id: 'delete', label: S.nav.delete, icon: 'delete', disabled: readOnly, onClick: () => onDelete(s) },
    ];
  };

  const groupIds = groups.map((g) => g.id);
  const setAllClosed = (value: boolean): void => setClosed(Object.fromEntries(groupIds.map((id) => [id, value])));
  const paneMenu = (): MenuItem[] => [
    { id: 'group', label: N.groupBy, items: [
      { id: 'g-type', label: N.byType, checked: view.groupBy === 'type', onClick: () => setView({ ...view, groupBy: 'type' }) },
      { id: 'g-none', label: N.byNone, checked: view.groupBy === 'none', onClick: () => setView({ ...view, groupBy: 'none' }) },
    ] },
    { id: 'sort', label: N.sortBy, items: [
      { id: 's-asc', label: N.sortNameAsc, checked: view.sort === 'name-asc', onClick: () => setView({ ...view, sort: 'name-asc' }) },
      { id: 's-desc', label: N.sortNameDesc, checked: view.sort === 'name-desc', onClick: () => setView({ ...view, sort: 'name-desc' }) },
      { id: 's-mod', label: N.sortModified, checked: view.sort === 'modified', onClick: () => setView({ ...view, sort: 'modified' }) },
    ] },
    { id: 's1', kind: 'separator' },
    { id: 'collapse-all', label: N.collapseAll, disabled: view.groupBy === 'none', onClick: () => setAllClosed(true) },
    { id: 'expand-all', label: N.expandAll, disabled: view.groupBy === 'none', onClick: () => setAllClosed(false) },
    { id: 's2', kind: 'separator' },
    { id: 'hidden', label: N.showHidden(hiddenTotal), checked: view.showHidden, disabled: hiddenTotal === 0 && !view.showHidden, onClick: () => setView({ ...view, showHidden: !view.showHidden }) },
  ];
  const openPaneMenu = (e: MouseEvent): void => menu.open(e, paneMenu());
  const groupMenu = (e: MouseEvent, id: string): void => {
    e.stopPropagation();
    menu.open(e, [
      { id: 'toggle', label: closed[id] ? N.expand : N.collapse, onClick: () => setClosed((c) => ({ ...c, [id]: !c[id] })) },
      { id: 's', kind: 'separator' },
      ...paneMenu(),
    ]);
  };

  return (
    <aside className="acc-nav" aria-label={S.nav.title}>
      <div className="acc-nav__head">
        <span className="acc-nav__title">{S.nav.title}</span>
        <button type="button" className="acc-nav__toggle" onClick={onToggle} title={S.nav.collapse} aria-label={S.nav.collapse}>
          <Icon name="chevron_left" size={16} />
        </button>
      </div>
      <div className="acc-nav__search">
        <input type="search" value={search} placeholder={S.nav.search} aria-label={S.nav.searchLabel} onChange={(e) => setSearch(e.currentTarget.value)} />
        <Icon name="search" size={16} />
      </div>
      <div className="acc-nav__groups fo-scroll" role="tree" onContextMenu={openPaneMenu}>
        {groups.map((g) => (
          <div key={g.id} className="acc-nav__group" role="group">
            {g.id !== 'all' && (
              <button type="button" className="acc-nav__ghead" aria-expanded={!closed[g.id]} onClick={() => setClosed((c) => ({ ...c, [g.id]: !c[g.id] }))} onContextMenu={(e) => groupMenu(e, g.id)}>
                <span>{S.nav.groups[g.id]}</span>
                <Icon name={closed[g.id] ? 'chevron_down' : 'chevron_up'} size={16} />
              </button>
            )}
            {!closed[g.id] &&
              (g.items.length === 0 ? (
                <div className="acc-nav__empty">{S.nav.empty}</div>
              ) : (
                g.items.map((entry) => {
                  const { name } = entry;
                  const s = { kind: entry.kind, name };
                  const on = selected?.kind === entry.kind && selected.name === name;
                  const isHidden = view.hidden.includes(hiddenKey(entry));
                  return (
                    <button
                      key={`${entry.kind}:${name}`}
                      type="button"
                      role="treeitem"
                      aria-selected={on}
                      className={`acc-nav__item${on ? ' is-selected' : ''}${isHidden ? ' is-hidden' : ''}`}
                      onClick={() => {
                        onSelect(s);
                        if (window.matchMedia('(pointer: coarse)').matches) onOpen(s); // au doigt, un seul toucher ouvre l'objet (pas de double-clic)
                      }}
                      onDoubleClick={() => onOpen(s)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onOpen(s);
                        else if (e.key === 'F2' && !readOnly) onRename(s);
                        else if (e.key === 'Delete' && !readOnly) onDelete(s);
                      }}
                      onContextMenu={(e) => {
                        e.stopPropagation();
                        onSelect(s);
                        menu.open(e, [...itemMenu(s), { id: 's3', kind: 'separator' }, isHidden
                          ? { id: 'unhide', label: N.unhide, icon: 'eye', onClick: () => setView(unhideEntry(view, entry)) }
                          : { id: 'hide', label: N.hide, icon: 'eye_off', onClick: () => setView(hideEntry(view, entry)) }]);
                      }}
                    >
                      <Icon name={KIND_ICON[entry.kind]} size={16} />
                      <span>{name}</span>
                    </button>
                  );
                })
              ))}
          </div>
        ))}
      </div>
      {menu.menu}
    </aside>
  );
}
