// Onglets des feuilles (bas de la fenetre) : navigation, ajout, renommage en place (double-clic),
// glisser pour deplacer, menu contextuel (inserer, supprimer, renommer, deplacer, copier, couleur, masquer).
import { useState } from 'react';
import { Icon, useContextMenu, type MenuItem } from '@forgeoffice/ui';
import { isValidSheetName, type Workbook } from '@forgeoffice/xlsx';
import { buildMenu } from './registry.ts';
import { S } from '../strings/index.ts';
import { useSuiteKind } from './suiteKind.ts';

/** Triangle de defilement (avec barre pour « premiere » / « derniere » feuille) : forme geometrique simple. */
function Tri({ dir, bar }: { dir: 'l' | 'r'; bar?: boolean }) {
  const d = dir === 'l' ? 'M9 2 L3 7 L9 12 Z' : 'M3 2 L9 7 L3 12 Z';
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d={d} fill="currentColor" transform={bar ? (dir === 'l' ? 'translate(2 0)' : 'translate(-1 0)') : undefined} />
      {bar && <rect x={dir === 'l' ? 2 : 10.5} y="2" width="1.5" height="10" fill="currentColor" />}
    </svg>
  );
}

export interface SheetTabsProps {
  wb: Workbook;
  active: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRename: (index: number, name: string) => boolean;
  onDelete: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (index: number) => void;
  onMoveCopy: (index: number) => void;
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
  const suite = useSuiteKind();
  const visible = p.wb.sheets.map((s, i) => ({ s, i })).filter((x) => x.s.state === 'visible');
  const hiddenCount = p.wb.sheets.length - visible.length;

  const commitRename = (): void => {
    if (renaming === null) return;
    const name = draft.trim();
    if (name && isValidSheetName(name)) p.onRename(renaming, name);
    setRenaming(null);
  };

  /** Entrees du menu d'un onglet : fournies par les segments enregistres (menus-sheettab.tsx et lots suivants). */
  const items = (i: number): MenuItem[] => buildMenu('sheetTab', {
    visibleCount: visible.length, sheetCount: p.wb.sheets.length, hiddenCount, sheetName: (k) => p.wb.sheets[k]?.name ?? '',
    onAdd: p.onAdd, onDelete: p.onDelete, onMove: p.onMove, onDuplicate: p.onDuplicate, onMoveCopy: p.onMoveCopy, onColor: p.onColor, onHide: p.onHide, onUnhide: p.onUnhide, onProtect: p.onProtect,
    startRename: (k) => { setRenaming(k); setDraft(p.wb.sheets[k]?.name ?? ''); },
  }, { sheetIndex: i });

  return (
    <div className={`xl-tabs${suite ? ' xl-tabs--suite' : ''}`} role="tablist" aria-label={S.sheets}>
      {suite && (
        <button type="button" className="xl-tabs__nav xl-tabs__nav--end" aria-label={S.firstSheetBtn} title={S.firstSheetBtn} onClick={() => { setFirst(0); const f = visible[0]; if (f) p.onSelect(f.i); }}>
          <Tri dir="l" bar />
        </button>
      )}
      <button type="button" className="xl-tabs__nav" aria-label={S.prevSheet} title={S.prevSheet} onClick={() => setFirst((f) => Math.max(0, f - 1))}>
        {suite ? <Tri dir="l" /> : <Icon name="chevron_left" size={16} />}
      </button>
      <button type="button" className="xl-tabs__nav" aria-label={S.nextSheet} title={S.nextSheet} onClick={() => setFirst((f) => Math.min(visible.length - 1, f + 1))}>
        {suite ? <Tri dir="r" /> : <Icon name="chevron_right" size={16} />}
      </button>
      {suite && (
        <button type="button" className="xl-tabs__nav xl-tabs__nav--end" aria-label={S.lastSheetBtn} title={S.lastSheetBtn} onClick={() => { const l = visible[visible.length - 1]; if (l) { setFirst(visible.length - 1); p.onSelect(l.i); } }}>
          <Tri dir="r" bar />
        </button>
      )}
      {suite && (<button type="button" className="xl-tabs__add" aria-label={S.addSheet} title={S.addSheet} onClick={p.onAdd}>
          <Icon name="add" size={16} />
        </button>)}
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
        {!suite && (<button type="button" className="xl-tabs__add" aria-label={S.addSheet} title={S.addSheet} onClick={p.onAdd}>
          <Icon name="add" size={16} />
        </button>)}
      </div>
      {menu.menu}
    </div>
  );
}
