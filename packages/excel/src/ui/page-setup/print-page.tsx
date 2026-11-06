// Page Imprimer du Backstage : reglages rapides (orientation, papier, marges, mise a l'echelle, quadrillage, en-tetes) et apercu
// pagine fidele (en-tete / pied de page, titres a repeter, zones d'impression), lien vers la boite Mise en page.
import { useMemo, useState } from 'react';
import { BACKSTAGE_PAGES, BackstageHeading, BackstageSection, Button } from '@forgeoffice/ui';
import type { Scalar } from '@forgeoffice/formulas';
import type { PageSetup, Sheet, Workbook } from '@forgeoffice/xlsx';
import { MARGIN_PRESETS, PAPER_SIZES, marginPresetOf, marginsOf, pageDims, paperLabel } from '../../logic/pagesetup.ts';
import { PageView, paginate, printJob, printRanges, type PrintScope } from '../print.tsx';
import type { PsTab } from './types.ts';
import { PS, RB, S } from '../../strings/index.ts';

export interface PrintPageEnv {
  wb: Workbook;
  sheet: Sheet;
  name: string;
  value: (row: number, col: number) => Scalar;
  print: () => void;
  setPage: (patch: Partial<PageSetup>) => void;
  openPageSetup?: ((tab?: PsTab) => void) | undefined;
}

type FitMode = 'none' | 'sheet' | 'cols' | 'rows' | 'custom';
const MARGIN_LABEL = { normal: RB.marginsNormal, wide: RB.marginsWide, narrow: RB.marginsNarrow } as const;

function fitModeOf(ps: PageSetup): FitMode {
  if (!ps.fitToPage) return (ps.scale ?? 100) === 100 ? 'none' : 'custom';
  const w = ps.fitToWidth ?? 1;
  const h = ps.fitToHeight ?? 1;
  return w === 1 && h === 1 ? 'sheet' : w === 1 && h === 0 ? 'cols' : w === 0 && h === 1 ? 'rows' : 'custom';
}

export function PrintPage({ e }: { e: PrintPageEnv }) {
  const ps = e.sheet.pageSetup;
  const areas = printRanges(e.sheet);
  const { pages, scale } = useMemo(() => (areas.length ? paginate(e.sheet, areas) : { pages: [], scale: 1 }), [e.sheet]);
  const [index, setIndex] = useState(0);
  const [scope, setScope] = useState<PrintScope>(printJob.scope);
  const [userZoom, setZoom] = useState<number | null>(null);
  const zoom = userZoom ?? Math.min(0.62, 520 / pageDims(ps).w);
  const at = Math.min(index, pages.length - 1);
  const page = pages[at];
  const mode = fitModeOf(ps);
  const margin = marginPresetOf(ps.margins);
  const now = useMemo(() => new Date(), []);
  return (
    <>
      <BackstageHeading>{BACKSTAGE_PAGES.print.label}</BackstageHeading>
      <div className="xl-print">
        <div className="xl-print__opts">
          <Button appearance="primary" icon="print" size="large" onClick={e.print}>{BACKSTAGE_PAGES.print.label}</Button>
          <BackstageSection title={S.print.printer}><p>{S.print.printerName}</p></BackstageSection>
          <BackstageSection title={S.print.settings}>
            <select value={scope} aria-label={PS.scopeLabel} onChange={(ev) => { const v = ev.target.value as PrintScope; printJob.scope = v; setScope(v); }}>
              <option value="active">{PS.scopeActive}</option>
              <option value="workbook">{PS.scopeWorkbook}</option>
              <option value="selection">{PS.scopeSelection}</option>
            </select>
            <select value={ps.orientation ?? 'portrait'} onChange={(ev) => e.setPage({ orientation: ev.target.value as 'portrait' | 'landscape' })} aria-label={RB.orientationPage}>
              <option value="portrait">{S.print.portrait}</option>
              <option value="landscape">{S.print.landscape}</option>
            </select>
            <select value={ps.paperSize ?? 9} onChange={(ev) => e.setPage({ paperSize: Number(ev.target.value) })} aria-label={RB.pageSize}>
              {PAPER_SIZES.map((p) => <option key={p.id} value={p.id}>{paperLabel(p)}</option>)}
            </select>
            <select
              value={margin ?? 'custom'} aria-label={PS.margins}
              onChange={(ev) => { const p = MARGIN_PRESETS.find((k) => k.id === ev.target.value); if (p) e.setPage({ margins: marginsOf(p) }); else e.openPageSetup?.('margins'); }}
            >
              {MARGIN_PRESETS.map((p) => <option key={p.id} value={p.id}>{MARGIN_LABEL[p.id]}</option>)}
              <option value="custom">{margin ? PS.customMargins : `${PS.lastMargins}`}</option>
            </select>
            <select
              value={mode} aria-label={RB.g.scale}
              onChange={(ev) => {
                const v = ev.target.value as FitMode;
                if (v === 'none') e.setPage({ fitToPage: false, scale: 100 });
                else if (v === 'sheet') e.setPage({ fitToPage: true, fitToWidth: 1, fitToHeight: 1 });
                else if (v === 'cols') e.setPage({ fitToPage: true, fitToWidth: 1, fitToHeight: 0 });
                else if (v === 'rows') e.setPage({ fitToPage: true, fitToWidth: 0, fitToHeight: 1 });
                else e.openPageSetup?.('page');
              }}
            >
              <option value="none">{S.print.noScale}</option>
              <option value="sheet">{S.print.fitSheet}</option>
              <option value="cols">{S.print.fitCols}</option>
              <option value="rows">{PS.fitRows}</option>
              <option value="custom">{PS.customScale}</option>
            </select>
            <label className="xl-radio"><input type="checkbox" checked={!!ps.printGridLines} onChange={(ev) => e.setPage({ printGridLines: ev.target.checked })} />{S.print.gridlines}</label>
            <label className="xl-radio"><input type="checkbox" checked={!!ps.printHeadings} onChange={(ev) => e.setPage({ printHeadings: ev.target.checked })} />{S.print.headings}</label>
            {e.openPageSetup && <Button appearance="subtle" onClick={() => e.openPageSetup?.('page')}>{PS.pageSetupLink}</Button>}
          </BackstageSection>
        </div>
        <div className="xl-print__preview">
          {page ? <PageView wb={e.wb} sheet={e.sheet} page={page} scale={scale} value={e.value} zoom={zoom} fileName={e.name} now={now} /> : <p>{S.print.empty}</p>}
          {pages.length > 0 && (
            <div className="xl-print__nav">
              <Button appearance="subtle" icon="chevron_left" aria-label="-" disabled={at === 0} onClick={() => setIndex(at - 1)} />
              <span>{S.print.page(at + 1, pages.length)}</span>
              <Button appearance="subtle" icon="chevron_right" aria-label="+" disabled={at >= pages.length - 1} onClick={() => setIndex(at + 1)} />
              <input type="range" min={30} max={110} value={Math.round(zoom * 100)} aria-label={PS.previewZoom} onChange={(ev) => setZoom(Number(ev.target.value) / 100)} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
