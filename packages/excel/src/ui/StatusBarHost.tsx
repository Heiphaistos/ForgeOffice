// Barre d'etat du Tableur : mode, calcul manuel, references circulaires, statistiques de la selection, vues et zoom.
import { useMemo } from 'react';
import { StatusBar } from '@forgeoffice/ui';
import { formatValue, type Scalar } from '@forgeoffice/formulas';
import { rangeName, type Sheet, type Workbook } from '@forgeoffice/xlsx';
import { lastCol } from '../logic/rangeText.ts';
import { activeRange, clipRange, sizeLabel, type Selection } from '../logic/selection.ts';
import { numFmtOf, styleAt } from '../logic/styles.ts';
import { S, RB } from '../strings/index.ts';

export interface StatusBarHostProps {
  wb: Workbook;
  sheet: Sheet;
  selection: Selection;
  valueAt: (row: number, col: number) => Scalar;
  mode: string;
  calcManual: boolean;
  recalc: () => void;
  circular: readonly string[];
  painter: boolean;
  setView: (view: 'normal' | 'pageLayout' | 'pageBreakPreview') => void;
  setZoom: (zoom: number) => void;
  zoomToSelection: () => void;
}

export function StatusBarHost(p: StatusBarHostProps) {
  const { wb, sheet, selection, valueAt } = p;
  const stats = useMemo(() => {
    let sum = 0;
    let nums = 0;
    let count = 0;
    let visited = 0;
    for (const r0 of selection.ranges) {
      const r = clipRange(r0, { r1: 0, c1: 0, r2: Math.max(0, ...[...sheet.cells.keys()]), c2: lastCol(sheet) });
      if (!r) continue;
      for (let row = r.r1; row <= r.r2 && visited < 1_000_000; row++) {
        const line = sheet.cells.get(row);
        if (!line) continue;
        for (let col = r.c1; col <= r.c2; col++) {
          visited++;
          if (!line.has(col)) continue;
          const v = valueAt(row, col);
          if (v === null || v === '') continue;
          count++;
          if (typeof v === 'number') {
            nums++;
            sum += v;
          }
        }
      }
    }
    return { sum, nums, count };
  }, [selection, sheet, valueAt]);
  const fmtNum = (n: number): string => formatValue(n, numFmtOf(wb, styleAt(sheet, selection.active.row, selection.active.col)), 'fr-FR');
  const ar = activeRange(selection);
  const multi = selection.ranges.length > 1 || ar.r1 !== ar.r2 || ar.c1 !== ar.c2;
  const zoom = sheet.view.zoom || 100;
  return (
    <>
      <StatusBar
        left={[
          { id: 'mode', label: p.mode },
          ...(p.calcManual ? [{ id: 'calc', label: S.calculate, onClick: p.recalc }] : []),
          ...(p.circular.length ? [{ id: 'circ', label: `${S.circular} : ${p.circular[0] ?? ''}`, icon: 'warning' as const }] : []),
          ...(p.painter ? [{ id: 'painter', label: RB.painter, icon: 'paint_brush' as const }] : []),
        ]}
        right={multi && stats.count > 0 ? [
          ...(stats.nums > 0 ? [{ id: 'avg', label: `${S.average} : ${fmtNum(stats.sum / stats.nums)}` }] : []),
          { id: 'cnt', label: `${S.count} : ${stats.count}` },
          ...(stats.nums > 0 ? [{ id: 'sum', label: `${S.sum} : ${fmtNum(stats.sum)}` }] : []),
        ] : []}
        views={[{ id: 'normal', label: S.viewNormal, icon: 'grid' }, { id: 'pageLayout', label: S.viewLayout, icon: 'document_one_page' }, { id: 'pageBreakPreview', label: S.viewBreak, icon: 'document_page_break' }]}
        activeView={sheet.view.view}
        onViewChange={(id) => p.setView(id as 'normal' | 'pageLayout' | 'pageBreakPreview')}
        zoom={zoom}
        onZoomChange={(z) => p.setZoom(Math.max(10, Math.min(400, Math.round(z))))}
        zoomPresets={[{ label: S.zoomSelection, compute: () => { p.zoomToSelection(); return zoom; } }]}
      />
      <span className="xl-sr" aria-live="polite">{multi ? sizeLabel(ar) : rangeName(ar)}</span>
    </>
  );
}
