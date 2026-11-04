// Barre de menus classique (option « Menus classiques » a la place du ruban), comme WinNote et le Bloc-notes Windows.
import { useState } from 'react';
import { Menu, type MenuItem } from '@forgeoffice/ui';
import { S } from '../strings.ts';

export interface MenuBarProps {
  menus: readonly { id: string; label: string; items: readonly MenuItem[] }[];
}

export function MenuBar({ menus }: MenuBarProps) {
  const [open, setOpen] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const current = open ? menus.find((m) => m.id === open.id) : undefined;
  return (
    <nav className="nt-menubar" aria-label={S.menus.file}>
      {menus.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`nt-menubar__item${open?.id === m.id ? ' is-open' : ''}`}
          aria-haspopup="menu"
          aria-expanded={open?.id === m.id}
          onClick={(e) => setOpen(open?.id === m.id ? null : { id: m.id, anchor: e.currentTarget })}
          onMouseEnter={(e) => {
            if (open && open.id !== m.id) setOpen({ id: m.id, anchor: e.currentTarget });
          }}
        >
          {m.label}
        </button>
      ))}
      {open && current && <Menu items={current.items} anchor={open.anchor} onClose={() => setOpen(null)} label={current.label} minWidth={260} />}
    </nav>
  );
}
