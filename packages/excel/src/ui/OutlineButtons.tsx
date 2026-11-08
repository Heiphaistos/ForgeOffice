// Boutons +/- du plan dans la marge des numeros de ligne, et boutons de niveau dans le coin (poses sur la grille, hors du clip de la zone de cellules).
import type { Sheet } from '@forgeoffice/xlsx';
import { colsAsRows, maxLevel, rowGroups, type OutlineGroup } from '../logic/outline.ts';
import { colX, rangeRect, type Viewport } from '../logic/viewport.ts';
import { S } from '../strings/index.ts';

export type OutlineAction = { group: OutlineGroup; axis: 'row' | 'col' } | { level: number };

export function OutlineButtons({ v, sheet, onAction }: { v: Viewport; sheet: Sheet; onAction: (a: OutlineAction) => void }) {
  const groups = rowGroups(sheet.rows);
  const colRows = colsAsRows(sheet.cols);
  const colGroups = rowGroups(colRows);
  if ((!groups.length && !colGroups.length) || v.headerW === 0) return null;
  const levels = Math.max(maxLevel(sheet.rows), maxLevel(colRows)) + 1;
  return (
    <>
      {Array.from({ length: Math.min(levels, 4) }, (_, i) => (
        <button key={`lv${i}`} type="button" className="xl-outline xl-outline--level" style={{ left: 2 + i * 12, top: 3 }} aria-label={`${S.outline.level} ${i + 1}`}
          onPointerDown={(e) => { e.stopPropagation(); onAction({ level: i + 1 }); }}>{i + 1}</button>
      ))}
      {groups.map((g) => {
        if (sheet.rows.get(g.summary)?.hidden) return null;
        const box = rangeRect(v, { r1: g.summary, c1: 0, r2: g.summary, c2: 0 });
        if (box.y < v.headerH || box.y > v.height) return null;
        return (
          <button key={`g${g.level}-${g.start}`} type="button" className="xl-outline" style={{ left: 2 + (g.level - 1) * 12, top: box.y + Math.max(1, (box.h - 11) / 2) }}
            aria-label={g.collapsed ? S.outline.expand : S.outline.collapse} onPointerDown={(e) => { e.stopPropagation(); onAction({ group: g, axis: 'row' }); }}>{g.collapsed ? '+' : '−'}</button>
        );
      })}
      {colGroups.map((g) => {
        if (colRows.get(g.summary)?.hidden) return null;
        const x = colX(v, g.summary);
        if (x < v.headerW || x > v.width - 12) return null;
        return (
          <button key={`c${g.level}-${g.start}`} type="button" className="xl-outline" style={{ left: x + 2 + (g.level - 1) * 12, top: 3 }}
            aria-label={g.collapsed ? S.outline.expand : S.outline.collapse} onPointerDown={(e) => { e.stopPropagation(); onAction({ group: g, axis: 'col' }); }}>{g.collapsed ? '+' : '−'}</button>
        );
      })}
    </>
  );
}
