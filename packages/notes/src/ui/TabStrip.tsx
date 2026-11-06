// Onglets arrondis (facon WinNote / Bloc-notes Windows 11) : fermer, clic du milieu, glisser pour reordonner, menu contextuel.
import { useState, type MouseEvent } from 'react';
import { Icon, Tooltip } from '@forgeoffice/ui';
import type { Tab } from '../workspace.ts';
import { S } from '../strings.ts';

export interface TabStripProps {
  tabs: readonly Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onMove: (id: string, index: number) => void;
  onNew: () => void;
  /** Ouvre la palette de commandes (bouton visible seulement au toucher : pas de Ctrl+Maj+P). */
  onPalette: () => void;
  onContextMenu: (e: MouseEvent, id: string) => void;
}

const DRAG_TYPE = 'application/x-forgeoffice-tab';

export function TabStrip({ tabs, activeId, onSelect, onClose, onMove, onNew, onPalette, onContextMenu }: TabStripProps) {
  const [dropAt, setDropAt] = useState<number | null>(null);
  return (
    <div className="nt-tabs" role="tablist" aria-label={S.tabsLabel} onDragLeave={() => setDropAt(null)}>
      {tabs.map((t, i) => (
        <div
          key={t.id}
          role="tab"
          aria-selected={t.id === activeId}
          tabIndex={t.id === activeId ? 0 : -1}
          title={t.path ?? t.origin ?? t.name}
          draggable
          className={`nt-tab${t.id === activeId ? ' is-active' : ''}${dropAt === i ? ' is-drop' : ''}`}
          onClick={() => onSelect(t.id)}
          onAuxClick={(e) => {
            if (e.button === 1) onClose(t.id);
          }}
          onContextMenu={(e) => onContextMenu(e, t.id)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
              if (n) onSelect(n.id);
            } else if (e.key === 'Delete') onClose(t.id);
          }}
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_TYPE, t.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
            e.preventDefault();
            setDropAt(i);
          }}
          onDrop={(e) => {
            const id = e.dataTransfer.getData(DRAG_TYPE);
            setDropAt(null);
            if (!id) return;
            e.preventDefault();
            onMove(id, i);
          }}
          onDragEnd={() => setDropAt(null)}
        >
          {t.readOnly && <Icon name="lock_closed" size={16} />}
          <span className="nt-tab__label">{t.name}</span>
          {t.dirty && <span className="nt-tab__dot" aria-label={S.modified} />}
          <button
            type="button"
            className="nt-tab__close"
            aria-label={`${S.dialogs.close} ${t.name}`}
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onClose(t.id);
            }}
          >
            <Icon name="dismiss" size={12} />
          </button>
        </div>
      ))}
      <Tooltip content={{ title: S.newTab, shortcut: 'Ctrl+N' }}>
        <button type="button" className="nt-tabs__add" aria-label={S.newTab} onClick={onNew}>
          <Icon name="add" size={16} />
        </button>
      </Tooltip>
      <button type="button" className="nt-tabs__palette" aria-label={S.touch.palette} title={S.touch.palette} onClick={onPalette}>
        <Icon name="key_command" size={16} />
      </button>
    </div>
  );
}
