// Boite Mise en page (4 onglets : Page, Marges, En-tete/Pied de page, Feuille) avec apercu en direct de la copie de travail.
import { useMemo, useState } from 'react';
import { Button, Checkbox, Dialog, NumberField } from '@forgeoffice/ui';
import type { PageSetup } from '@forgeoffice/xlsx';
import { paginate, printRanges, type PrintPage } from '../../logic/pagebreaks.ts';
import { PAPER_SIZES, fitOf, pageDims, paperLabel, parsePrintAreaText, parseTitleCols, parseTitleRows } from '../../logic/pagesetup.ts';
import type { DialogEnv } from '../registry.ts';
import { PageView } from '../print.tsx';
import { rememberMargins } from './last-margins.ts';
import { HeaderFooterTab } from './header-footer.tsx';
import { SheetTab } from './titles.tsx';
import type { PsPatch, PsTab, TabProps } from './types.ts';
import { PS } from '../../strings/index.ts';

const IN = 2.54;
const cmOf = (inches: number): number => Math.round(inches * IN * 100) / 100;
const inchesOf = (cm: number): number => Math.round((cm / IN) * 1000) / 1000;

function PageTab({ d, up }: TabProps) {
  const fit = fitOf(d);
  const count = (n: number | undefined, key: 'fitToWidth' | 'fitToHeight') => (
    <input
      type="number" min={0} max={99} className="ps-count" aria-label={key === 'fitToWidth' ? PS.fitWide : PS.fitTall} placeholder={PS.auto}
      value={n === 0 ? '' : n ?? 1} disabled={!d.fitToPage}
      onChange={(e) => up({ [key]: e.target.value === '' ? 0 : Math.max(0, Math.min(99, Number(e.target.value))) })}
    />
  );
  return (
    <div className="ps-form">
      <fieldset className="xl-fs">
        <legend>{PS.orientation}</legend>
        <div className="xl-dlg-row">
          <label className="xl-radio"><input type="radio" name="ps-o" checked={d.orientation !== 'landscape'} onChange={() => up({ orientation: 'portrait' })} />{PS.portrait}</label>
          <label className="xl-radio"><input type="radio" name="ps-o" checked={d.orientation === 'landscape'} onChange={() => up({ orientation: 'landscape' })} />{PS.landscape}</label>
        </div>
      </fieldset>
      <fieldset className="xl-fs">
        <legend>{PS.scaling}</legend>
        <div className="xl-dlg-row">
          <label className="xl-radio"><input type="radio" name="ps-s" checked={!d.fitToPage} onChange={() => up({ fitToPage: false })} />{PS.adjustTo}</label>
          <NumberField value={d.scale ?? 100} min={10} max={400} step={1} unit="%" width={84} label={PS.adjustTo} disabled={!!d.fitToPage} onChange={(v) => up({ scale: v })} />
        </div>
        <div className="xl-dlg-row">
          <label className="xl-radio"><input type="radio" name="ps-s" checked={!!d.fitToPage} onChange={() => up({ fitToPage: true, fitToWidth: fit.w, fitToHeight: fit.h })} />{PS.fitTo}</label>
          {count(d.fitToWidth, 'fitToWidth')}<span>{PS.fitWide}</span>{count(d.fitToHeight, 'fitToHeight')}<span>{PS.fitTall}</span>
        </div>
      </fieldset>
      <div className="xl-form">
        <label htmlFor="ps-paper">{PS.paperSize}</label>
        <select id="ps-paper" value={d.paperSize ?? 9} onChange={(e) => up({ paperSize: Number(e.target.value) })}>
          {PAPER_SIZES.map((p) => <option key={p.id} value={p.id}>{paperLabel(p)}</option>)}
        </select>
        <label htmlFor="ps-quality">{PS.quality}</label>
        <select id="ps-quality" value={d.dpi ?? 0} onChange={(e) => up({ dpi: Number(e.target.value) || undefined })}>
          <option value={0}>{PS.qualityAuto}</option>
          {[1200, 600, 300, 150].map((n) => <option key={n} value={n}>{n} ppp</option>)}
        </select>
        <label htmlFor="ps-first">{PS.firstPage}</label>
        <input
          id="ps-first" className="ps-count" type="number" min={1} max={32767} placeholder={PS.firstPageAuto} value={d.firstPageNumber ?? ''}
          onChange={(e) => up({ firstPageNumber: e.target.value === '' ? undefined : Math.max(1, Math.round(Number(e.target.value))) })}
        />
      </div>
    </div>
  );
}

function MarginsTab({ d, up }: TabProps) {
  const m = d.margins;
  const field = (key: keyof PageSetup['margins'], label: string) => (
    <>
      <label>{label}</label>
      <NumberField value={cmOf(m[key])} min={0} max={50} step={0.05} unit="cm" width={96} label={label} onChange={(v) => up({ margins: { ...m, [key]: inchesOf(v) } })} />
    </>
  );
  return (
    <div className="ps-form">
      <div className="xl-form ps-margins">
        {field('top', PS.top)}{field('bottom', PS.bottom)}{field('left', PS.left)}{field('right', PS.right)}{field('header', PS.header)}{field('footer', PS.footer)}
      </div>
      <fieldset className="xl-fs">
        <legend>{PS.centerOnPage}</legend>
        <Checkbox checked={!!d.horizontalCentered} onChange={(v) => up({ horizontalCentered: v || undefined })} label={PS.horizontally} />
        <Checkbox checked={!!d.verticalCentered} onChange={(v) => up({ verticalCentered: v || undefined })} label={PS.vertically} />
      </fieldset>
    </div>
  );
}

/** Apercu en direct de la copie de travail (page par page). */
function Preview({ x, d }: { x: DialogEnv; d: PageSetup }) {
  const [index, setIndex] = useState(0);
  const sheet = useMemo(() => ({ ...x.sheet, pageSetup: d }), [x.sheet, d]);
  const { pages, scale } = useMemo(() => {
    const areas = printRanges(sheet);
    const r = areas.length ? paginate(sheet, areas) : { pages: [] as PrintPage[], scale: 1 };
    return r.pages.length ? r : { pages: [{ rows: [], cols: [], area: 0, number: d.firstPageNumber ?? 1, total: 1 }], scale: r.scale };
  }, [sheet, d.firstPageNumber]);
  const at = Math.min(index, pages.length - 1);
  const page = pages[at];
  const size = pageDims(d);
  const zoom = Math.min(170 / size.w, 250 / size.h);
  return (
    <div className="ps-preview" aria-label={PS.preview}>
      <div className="ps-preview__page">
        {page && <PageView wb={x.store.wb} sheet={sheet} page={page} scale={scale} value={x.value} zoom={zoom} fileName="" />}
      </div>
      <div className="xl-print__nav">
        <Button appearance="subtle" icon="chevron_left" aria-label="-" disabled={at === 0} onClick={() => setIndex(at - 1)} />
        <span>{PS.pageOf(at + 1, pages.length)}</span>
        <Button appearance="subtle" icon="chevron_right" aria-label="+" disabled={at >= pages.length - 1} onClick={() => setIndex(at + 1)} />
      </div>
    </div>
  );
}

const clean = (d: PageSetup): PageSetup => {
  const out = { ...d };
  for (const key of Object.keys(out) as (keyof PageSetup)[]) if (out[key] === undefined) delete out[key];
  return out;
};

export function PageSetupDialog({ x, tab }: { x: DialogEnv; tab?: PsTab }) {
  const [page, setPage] = useState<PsTab>(tab ?? 'page');
  const [d, setD] = useState<PageSetup>(() => ({ ...x.sheet.pageSetup, margins: { ...x.sheet.pageSetup.margins } }));
  const [areaText, setAreaText] = useState<{ area: string; rows: string; cols: string } | null>(null);
  const [error, setError] = useState('');
  const up = (patch: PsPatch): void => setD((cur) => {
    const next = { ...cur };
    for (const [key, v] of Object.entries(patch)) (next as Record<string, unknown>)[key] = v;
    return clean(next);
  });
  const apply = (): void => {
    let next = d;
    if (areaText) {
      const area = parsePrintAreaText(areaText.area);
      const rows = parseTitleRows(areaText.rows);
      const cols = parseTitleCols(areaText.cols);
      if (area === null) return setError(PS.badArea);
      if (rows === null) return setError(PS.badRows);
      if (cols === null) return setError(PS.badCols);
      next = clean({ ...d, printArea: area.length ? area : undefined, printTitleRows: rows, printTitleCols: cols });
    }
    const before = x.sheet.pageSetup.margins;
    if (JSON.stringify(before) !== JSON.stringify(next.margins)) rememberMargins(next.margins);
    x.store.commit((doc) => {
      doc.sheet(x.si).pageSetup = next;
    });
    x.close();
  };
  const tabs: readonly PsTab[] = ['page', 'margins', 'headerFooter', 'sheet'];
  return (
    <Dialog
      open title={PS.title} onClose={x.close} onConfirm={apply} width={760}
      footerStart={<Button onClick={() => { apply(); x.services.print(); }}>{PS.print}</Button>}
    >
      <div className="xl-tabsbar" role="tablist">
        {tabs.map((k) => <button key={k} type="button" role="tab" aria-selected={page === k} className={page === k ? 'is-active' : ''} onClick={() => setPage(k)}>{PS.tabs[k]}</button>)}
      </div>
      <div className="ps-body">
        <div className="ps-main">
          {page === 'page' && <PageTab d={d} up={up} />}
          {page === 'margins' && <MarginsTab d={d} up={up} />}
          {page === 'headerFooter' && <HeaderFooterTab d={d} up={up} />}
          {page === 'sheet' && <SheetTab d={d} up={up} x={x} text={areaText} setText={setAreaText} />}
          {error && <p className="ps-error" role="alert">{error}</p>}
        </div>
        <Preview x={x} d={d} />
      </div>
    </Dialog>
  );
}
