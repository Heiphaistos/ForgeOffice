// Volet de navigation d'Access : « Tous les objets Access », recherche, groupes repliables, menu contextuel.
import { useMemo, useState } from 'react';
import { Icon, useContextMenu, type IconName, type MenuItem } from '@forgeoffice/ui';
import { fold } from '../logic/table-ops.ts';
import { S } from '../strings.ts';
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
  onToggle: () => void;
  onSelect: (s: NavSelection) => void;
  onOpen: (s: NavSelection, view?: 'design' | 'layout') => void;
  onRename: (s: NavSelection) => void;
  onDelete: (s: NavSelection) => void;
  onCopy: (s: NavSelection) => void;
  onExport: (s: NavSelection) => void;
}

export function NavPane({ objects, selected, collapsed, readOnly, onToggle, onSelect, onOpen, onRename, onDelete, onCopy, onExport }: NavPaneProps) {
  const [search, setSearch] = useState('');
  const [closed, setClosed] = useState<Partial<Record<ObjKind, boolean>>>({});
  const menu = useContextMenu();
  const groups = useMemo(() => {
    const needle = fold(search.trim());
    return KINDS.map((kind) => ({
      kind,
      items: objects
        .filter((o) => kindOf(o) === kind && (needle === '' || fold(o.nom).includes(needle)))
        .map((o) => o.nom)
        .sort((a, b) => a.localeCompare(b, 'fr')),
    })).filter((g) => g.items.length > 0 || search === '');
  }, [objects, search]);

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
      <div className="acc-nav__groups fo-scroll" role="tree">
        {groups.map((g) => (
          <div key={g.kind} className="acc-nav__group" role="group">
            <button type="button" className="acc-nav__ghead" aria-expanded={!closed[g.kind]} onClick={() => setClosed((c) => ({ ...c, [g.kind]: !c[g.kind] }))}>
              <span>{S.nav.groups[g.kind]}</span>
              <Icon name={closed[g.kind] ? 'chevron_down' : 'chevron_up'} size={16} />
            </button>
            {!closed[g.kind] &&
              (g.items.length === 0 ? (
                <div className="acc-nav__empty">{S.nav.empty}</div>
              ) : (
                g.items.map((name) => {
                  const s = { kind: g.kind, name };
                  const on = selected?.kind === g.kind && selected.name === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      role="treeitem"
                      aria-selected={on}
                      className={`acc-nav__item${on ? ' is-selected' : ''}`}
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
                        onSelect(s);
                        menu.open(e, itemMenu(s));
                      }}
                    >
                      <Icon name={KIND_ICON[g.kind]} size={16} />
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
