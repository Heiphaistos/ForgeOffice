// Onglets des feuilles (bas de la fenetre) : navigation, ajout, renommage en place (double-clic),
// glisser pour deplacer, menu contextuel (inserer, supprimer, renommer, deplacer, copier, couleur, masquer).
import { useState } from 'react';
import { Icon, useContextMenu, STANDARD_COLORS, type MenuItem } from '@forgeoffice/ui';
import { isValidSheetName, type Workbook } from '@forgeoffice/xlsx';
import { S } from '../strings.ts';

export interface SheetTabsProps {
  wb: Workbook;
  active: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRename: (index: number, name: string) => boolean;
  onDelete: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (index: number) => void;
  onColor: (index: number, rgb: string | null) => void;
  onHide: (index: number) => void;
  onUnhide: () => void;
  onProtect: () => void;
}

export function SheetTabs(p: SheetTabsProps) {
  const [renaming, setRenaming] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [first, setFirst] = useState(0);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const menu = useContextMenu();
  const visible = p.wb.sheets.map((s, i) => ({ s, i })).filter((x) => x.s.state === 'visible');
  const hiddenCount = p.wb.sheets.length - visible.length;

  const commitRename = (): void => {
    if (renaming === null) return;
    const name = draft.trim();
    if (name && isValidSheetName(name)) p.onRename(renaming, name);
    setRenaming(null);
  };

  const items = (i: number): MenuItem[] => [
    { id: 'ins', label: S.sheetMenu.insert, icon: 'add', onClick: p.onAdd },
    { id: 'del', label: S.sheetMenu.delete, icon: 'delete', disabled: visible.length <= 1, onClick: () => p.onDelete(i) },
    { id: 'ren', label: S.sheetMenu.rename, icon: 'rename', onClick: () => { setRenaming(i); setDraft(p.wb.sheets[i]?.name ?? ''); } },
    { id: 'left', label: S.sheetMenu.moveLeft, icon: 'arrow_left', disabled: i === 0, onClick: () => p.onMove(i, i - 1) },
    { id: 'right', label: S.sheetMenu.moveRight, icon: 'arrow_right', disabled: i >= p.wb.sheets.length - 1, onClick: () => p.onMove(i, i + 1) },
    { id: 'dup', label: S.sheetMenu.duplicate, icon: 'copy', onClick: () => p.onDuplicate(i) },
    { id: 's1', kind: 'separator' },
    {
      id: 'color', label: S.sheetMenu.tabColor, icon: 'color_fill',
      items: [
        { id: 'none', label: S.sheetMenu.noColor, onClick: () => p.onColor(i, null) },
        ...STANDARD_COLORS.map((c) => ({ id: c.color, label: c.label, adornment: <span className="xl-swatch" style={{ background: c.color }} />, onClick: () => p.onColor(i, c.color.replace('#', '')) })),
      ],
    },
    { id: 'hide', label: S.sheetMenu.hide, icon: 'eye_off', disabled: visible.length <= 1, onClick: () => p.onHide(i) },
    { id: 'unhide', label: S.sheetMenu.unhide, icon: 'eye', disabled: hiddenCount === 0, onClick: p.onUnhide },
    { id: 's2', kind: 'separator' },
    { id: 'protect', label: S.sheetMenu.protect, icon: 'shield_lock', onClick: p.onProtect },
  ];

  return (
    <div className="xl-tabs" role="tablist" aria-label={S.sheets}>
      <button type="button" className="xl-tabs__nav" aria-label={S.prevSheet} title={S.prevSheet} onClick={() => setFirst((f) => Math.max(0, f - 1))}>
        <Icon name="chevron_left" size={16} />
      </button>
      <button type="button" className="xl-tabs__nav" aria-label={S.nextSheet} title={S.nextSheet} onClick={() => setFirst((f) => Math.min(visible.length - 1, f + 1))}>
        <Icon name="chevron_right" size={16} />
      </button>
      <div className="xl-tabs__list">
        {visible.slice(first).map(({ s, i }) => {
          const color = s.tabColor?.rgb ? `#${s.tabColor.rgb.slice(-6)}` : undefined;
          const selected = i === p.active;
          return (
            <div
              key={`${s.name}-${i}`}
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={`xl-tab${selected ? ' is-active' : ''}`}
              style={color ? { ['--xl-tab-color' as string]: color } : undefined}
              draggable={renaming !== i}
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragFrom !== null && dragFrom !== i) p.onMove(dragFrom, i);
                setDragFrom(null);
              }}
              onClick={() => p.onSelect(i)}
              onDoubleClick={() => {
                setRenaming(i);
                setDraft(s.name);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                p.onSelect(i);
                menu.open(e, items(i));
              }}
            >
              {renaming === i ? (
                <input
                  className="xl-tab__edit"
                  value={draft}
                  autoFocus
                  aria-label={S.sheetName}
                  maxLength={31}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenaming(null);
                    e.stopPropagation();
                  }}
                />
              ) : (
                <span>{s.name}</span>
              )}
              {color && <span className="xl-tab__color" />}
            </div>
          );
        })}
        <button type="button" className="xl-tabs__add" aria-label={S.addSheet} title={S.addSheet} onClick={p.onAdd}>
          <Icon name="add" size={16} />
        </button>
      </div>
      {menu.menu}
    </div>
  );
}
