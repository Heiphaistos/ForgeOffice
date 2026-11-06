// Affichage Mise en page : les pages reelles (papier, marges, en-tete et pied de page) l'une sous l'autre, regle en centimetres,
// en-tete / pied cliquables (ouvrent la boite Mise en page sur l'onglet En-tete/Pied de page), double-clic sur une cellule = la modifier en mode Normal.
import { useMemo } from 'react';
import type { Scalar } from '@forgeoffice/formulas';
import type { Sheet, Workbook } from '@forgeoffice/xlsx';
import { paginate, printRanges, type PrintPage } from '../../logic/pagebreaks.ts';
import { pageDims } from '../../logic/pagesetup.ts';
import { PageView } from '../print.tsx';
import { PS } from '../../strings/index.ts';

export interface PageLayoutViewProps {
  wb: Workbook;
  sheet: Sheet;
  value: (row: number, col: number) => Scalar;
  fileName: string;
  /** Zoom de la feuille (1 = 100 %). */
  zoom: number;
  onEditHeaderFooter: (zone: 'header' | 'footer') => void;
  onOpenCell: (row: number, col: number) => void;
}

const CM = 96 / 2.54;

function Ruler({ width, zoom }: { width: number; zoom: number }) {
  const cms = Math.floor(width / CM);
  return (
    <div className="ps-layout__ruler-h" aria-hidden="true">
      <div style={{ position: 'relative', width: width * zoom, margin: '0 auto', height: 20 }}>
        {Array.from({ length: cms + 1 }, (_, i) => <span key={i} className="ps-layout__tick" style={{ left: i * CM * zoom }}>{i}</span>)}
      </div>
    </div>
  );
}

export function PageLayoutView({ wb, sheet, value, fileName, zoom, onEditHeaderFooter, onOpenCell }: PageLayoutViewProps) {
  const { pages, scale } = useMemo(() => {
    const areas = printRanges(sheet);
    const r = areas.length ? paginate(sheet, areas) : { pages: [] as PrintPage[], scale: 1 };
    return r.pages.length ? r : { pages: [{ rows: [], cols: [], area: 0, number: sheet.pageSetup.firstPageNumber ?? 1, total: 1 }], scale: r.scale };
  }, [sheet]);
  const now = useMemo(() => new Date(), []);
  const { w } = pageDims(sheet.pageSetup);
  return (
    <div
      className="ps-layout" data-view="pageLayout" role="document" aria-label={PS.title}
      onDoubleClick={(e) => {
        const td = (e.target as HTMLElement).closest('td[data-r]');
        if (td instanceof HTMLElement) onOpenCell(Number(td.dataset.r), Number(td.dataset.c));
      }}
    >
      <Ruler width={w} zoom={zoom} />
      <p className="ps-layout__hint">{PS.layoutHint}</p>
      <div className="ps-layout__pages">
        {pages.map((p, i) => (
          <div key={i} className="ps-layout__page">
            <PageView wb={wb} sheet={sheet} page={p} scale={scale} value={value} zoom={zoom} fileName={fileName} now={now} onEditHeaderFooter={onEditHeaderFooter} show={{ grid: sheet.view.showGridLines, headings: sheet.view.showHeaders }} />
            <span className="ps-layout__badge">{PS.pageN(p.number)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
