// Barre d'etat du Tableur : mode, calcul manuel, references circulaires, statistiques de la selection, vues et zoom.
import { useMemo, useState } from 'react';
import { StatusBar, type MenuItem } from '@forgeoffice/ui';
import { formatValue, type Scalar } from '@forgeoffice/formulas';
import { rangeName, type Sheet, type Workbook } from '@forgeoffice/xlsx';
import { lastCol } from '../logic/rangeText.ts';
import { activeRange, clipRange, sizeLabel, type Selection } from '../logic/selection.ts';
import { accumulate, parseStats, statValue, STAT_IDS, type StatId } from '../logic/status-stats.ts';
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
  openMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuItem[]) => void;
}

const STATS_KEY = 'xl.statusStats';

function loadStats(): StatId[] {
  try {
    return parseStats(localStorage.getItem(STATS_KEY));
  } catch {
    return parseStats(null);
  }
}

export function StatusBarHost(p: StatusBarHostProps) {
  const { wb, sheet, selection, valueAt } = p;
  const [shown, setShown] = useState<StatId[]>(loadStats);
  const stats = useMemo(() => {
    const acc = accumulate();
    let visited = 0;
    for (const r0 of selection.ranges) {
      const r = clipRange(r0, { r1: 0, c1: 0, r2: Math.max(0, ...[...sheet.cells.keys()]), c2: lastCol(sheet) });
      if (!r) continue;
      for (let row = r.r1; row <= r.r2 && visited < 1_000_000; row++) {
        const line = sheet.cells.get(row);
        if (!line) continue;
        for (let col = r.c1; col <= r.c2; col++) {
          visited++;
          if (line.has(col)) acc.add(valueAt(row, col));
        }
      }
    }
    return acc.result();
  }, [selection, sheet, valueAt]);
  const label = (id: StatId): string => ({ avg: S.average, cnt: S.count, num: S.countNums, min: S.min, max: S.max, sum: S.sum })[id];
  const toggle = (id: StatId): void => {
    const next = STAT_IDS.filter((k) => (k === id ? !shown.includes(k) : shown.includes(k)));
    setShown(next);
    try {
      localStorage.setItem(STATS_KEY, next.join(','));
    } catch {
      // stockage indisponible : le choix vaut pour la session
    }
  };
  const fmtNum = (n: number): string => formatValue(n, numFmtOf(wb, styleAt(sheet, selection.active.row, selection.active.col)), 'fr-FR');
  const ar = activeRange(selection);
  const multi = selection.ranges.length > 1 || ar.r1 !== ar.r2 || ar.c1 !== ar.c2;
  const zoom = sheet.view.zoom || 100;
  return (
    <div style={{ display: 'contents' }} onContextMenu={(e) => {
      e.preventDefault();
      p.openMenu(e, STAT_IDS.map((id) => ({ id, label: label(id), checked: shown.includes(id), onClick: () => toggle(id) })));
    }}>
      <StatusBar
        left={[
          { id: 'mode', label: p.mode },
          ...(p.calcManual ? [{ id: 'calc', label: S.calculate, onClick: p.recalc }] : []),
          ...(p.circular.length ? [{ id: 'circ', label: `${S.circular} : ${p.circular[0] ?? ''}`, icon: 'warning' as const }] : []),
          ...(p.painter ? [{ id: 'painter', label: RB.painter, icon: 'paint_brush' as const }] : []),
        ]}
        right={multi && stats.count > 0 ? STAT_IDS.filter((id) => shown.includes(id)).flatMap((id) => {
          const v = statValue(stats, id);
          return v === undefined ? [] : [{ id, label: `${label(id)} : ${id === 'cnt' || id === 'num' ? v : fmtNum(v)}` }];
        }) : []}
        views={[{ id: 'normal', label: S.viewNormal, icon: 'grid' }, { id: 'pageLayout', label: S.viewLayout, icon: 'document_one_page' }, { id: 'pageBreakPreview', label: S.viewBreak, icon: 'document_page_break' }]}
        activeView={sheet.view.view}
        onViewChange={(id) => p.setView(id as 'normal' | 'pageLayout' | 'pageBreakPreview')}
        zoom={zoom}
        onZoomChange={(z) => p.setZoom(Math.max(10, Math.min(400, Math.round(z))))}
        zoomPresets={[{ label: S.zoomSelection, compute: () => { p.zoomToSelection(); return zoom; } }]}
      />
      <span className="xl-sr" aria-live="polite">{multi ? sizeLabel(ar) : rangeName(ar)}</span>
    </div>
  );
}
