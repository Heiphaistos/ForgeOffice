// Pages du Backstage (Fichier) : Accueil, Nouveau, Ouvrir, Informations, Enregistrer sous (tous formats),
// Imprimer (apercu pagine et reglages), Exporter, Compte, Options.
import { useState } from 'react';
import { MODULES, type RecentFile, type Services } from '@forgeoffice/core';
import {
  AppBadge, BackstageAction, BackstageHeading, BackstageSection, BackstageTile, BACKSTAGE_PAGES, Button, FileList, TextField, type BackstagePage, type FileRow,
} from '@forgeoffice/ui';
import type { Scalar } from '@forgeoffice/formulas';
import type { Sheet, Workbook } from '@forgeoffice/xlsx';
import { PageView, paginate, printRange } from './print.tsx';
import { SAVE_FORMATS, type SaveFormat } from './io.ts';
import { S, RB } from '../strings.ts';

export interface BackstageEnv {
  services: Services;
  wb: Workbook;
  sheet: Sheet;
  name: string;
  recents: RecentFile[];
  value: (row: number, col: number) => Scalar;
  newBlank: () => void;
  open: () => void;
  save: () => void;
  saveAs: (name: string, format: SaveFormat) => void;
  print: () => void;
  close: () => void;
  closeBackstage: () => void;
  protect: () => void;
  setPage: (patch: Partial<Sheet['pageSetup']>) => void;
  calcManual: boolean;
  setCalcManual: (v: boolean) => void;
}

function Blank() {
  return (
    <span className="xl-thumb">
      {Array.from({ length: 6 }, (_, r) => <span key={r}>{Array.from({ length: 4 }, (_, c) => <i key={c} />)}</span>)}
    </span>
  );
}

function PrintPage({ e }: { e: BackstageEnv }) {
  const range = printRange(e.sheet);
  const { pages, scale } = range ? paginate(e.sheet, range) : { pages: [], scale: 1 };
  const [index, setIndex] = useState(0);
  const page = pages[Math.min(index, pages.length - 1)];
  const ps = e.sheet.pageSetup;
  return (
    <>
      <BackstageHeading>{BACKSTAGE_PAGES.print.label}</BackstageHeading>
      <div className="xl-print">
        <div className="xl-print__opts">
          <Button appearance="primary" icon="print" size="large" onClick={e.print}>{BACKSTAGE_PAGES.print.label}</Button>
          <BackstageSection title={S.print.printer}><p>{S.print.printerName}</p></BackstageSection>
          <BackstageSection title={S.print.settings}>
            <select value={ps.orientation ?? 'portrait'} onChange={(ev) => e.setPage({ orientation: ev.target.value as 'portrait' | 'landscape' })} aria-label={RB.orientationPage}>
              <option value="portrait">{S.print.portrait}</option>
              <option value="landscape">{S.print.landscape}</option>
            </select>
            <select value={ps.paperSize ?? 9} onChange={(ev) => e.setPage({ paperSize: Number(ev.target.value) })} aria-label={RB.pageSize}>
              <option value={9}>{S.print.a4}</option>
              <option value={1}>{S.print.letter}</option>
            </select>
            <select value={ps.fitToPage ? (ps.fitToHeight ? 'sheet' : 'cols') : 'none'} aria-label={RB.g.scale} onChange={(ev) => {
              const v = ev.target.value;
              e.setPage(v === 'none' ? { fitToPage: false } : { fitToPage: true, fitToWidth: 1, fitToHeight: v === 'sheet' ? 1 : 0 });
            }}>
              <option value="none">{S.print.noScale}</option>
              <option value="sheet">{S.print.fitSheet}</option>
              <option value="cols">{S.print.fitCols}</option>
            </select>
            <label className="xl-radio"><input type="checkbox" checked={!!ps.printGridLines} onChange={(ev) => e.setPage({ printGridLines: ev.target.checked })} />{S.print.gridlines}</label>
          </BackstageSection>
        </div>
        <div className="xl-print__preview">
          {page ? <PageView wb={e.wb} sheet={e.sheet} page={page} scale={scale} value={e.value} zoom={0.62} /> : <p>{S.print.empty}</p>}
          {pages.length > 0 && (
            <div className="xl-print__nav">
              <Button appearance="subtle" icon="chevron_left" aria-label="-" disabled={index === 0} onClick={() => setIndex(index - 1)} />
              <span>{S.print.page(Math.min(index, pages.length - 1) + 1, pages.length)}</span>
              <Button appearance="subtle" icon="chevron_right" aria-label="+" disabled={index >= pages.length - 1} onClick={() => setIndex(index + 1)} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SaveAsPage({ e }: { e: BackstageEnv }) {
  const [name, setName] = useState(e.name);
  const [format, setFormat] = useState<SaveFormat>('xlsx');
  return (
    <>
      <BackstageHeading>{BACKSTAGE_PAGES.saveAs.label}</BackstageHeading>
      <div className="xl-saveas">
        <TextField label={S.backstage.saveAsName} value={name} onChange={(ev) => setName(ev.target.value)} />
        <fieldset className="xl-fs">
          <legend>{S.backstage.saveAsFormat}</legend>
          {SAVE_FORMATS.map((f) => (
            <label key={f} className="xl-radio"><input type="radio" name="fmt" checked={format === f} onChange={() => setFormat(f)} />{S.backstage.formats[f]}</label>
          ))}
        </fieldset>
        <Button appearance="primary" icon="save" onClick={() => e.saveAs(name, format)}>{S.backstage.saveAsGo}</Button>
      </div>
    </>
  );
}

export function backstagePages(e: BackstageEnv): BackstagePage[] {
  const excel = MODULES.excel;
  const rows: FileRow[] = e.recents.filter((r) => r.app === 'excel').map((r) => ({
    id: `${r.path}-${r.openedAt}`, name: r.name, location: r.path, date: r.openedAt, icon: <AppBadge glyph={excel.glyph} color={excel.accent} size={24} />,
  }));
  const reopen = (row: FileRow): void => {
    const r = e.recents.find((k) => `${k.path}-${k.openedAt}` === row.id);
    if (r && e.services.platform !== 'web') void e.services.openModule('excel', r.path);
    else e.open();
  };
  let cells = 0;
  let formulas = 0;
  for (const s of e.wb.sheets) for (const line of s.cells.values()) for (const c of line.values()) {
    cells++;
    if (c.formula !== undefined) formulas++;
  }
  return [
    { ...BACKSTAGE_PAGES.home, render: () => (
      <>
        <BackstageHeading>{S.backstage.welcome}</BackstageHeading>
        <BackstageSection title={BACKSTAGE_PAGES.new.label}>
          <div className="xl-tiles"><BackstageTile label={S.backstage.blank} preview={<Blank />} onClick={e.newBlank} /></div>
        </BackstageSection>
        <BackstageSection title={S.backstage.recent}>
          {rows.length ? <FileList rows={rows} onOpen={reopen} /> : <p>{S.backstage.noRecent}</p>}
        </BackstageSection>
      </>
    ) },
    { ...BACKSTAGE_PAGES.new, render: () => (
      <>
        <BackstageHeading>{BACKSTAGE_PAGES.new.label}</BackstageHeading>
        <div className="xl-tiles"><BackstageTile label={S.backstage.blank} preview={<Blank />} onClick={e.newBlank} /></div>
      </>
    ) },
    { ...BACKSTAGE_PAGES.open, render: () => (
      <>
        <BackstageHeading actions={<Button icon="folder_open" onClick={e.open}>{S.backstage.browse}</Button>}>{BACKSTAGE_PAGES.open.label}</BackstageHeading>
        {rows.length ? <FileList rows={rows} grouped onOpen={reopen} /> : <p>{S.backstage.noRecent}</p>}
      </>
    ) },
    { ...BACKSTAGE_PAGES.info, render: () => (
      <>
        <BackstageHeading>{S.backstage.info}</BackstageHeading>
        <BackstageAction icon="shield_lock" title={S.backstage.protectTitle} description={S.backstage.protectDesc} onClick={e.protect} />
        <BackstageAction icon="accessibility_checkmark" title={S.backstage.inspectTitle} description={S.backstage.inspectDesc(cells, formulas)} />
        <BackstageSection title={S.backstage.properties}>
          <dl className="xl-props">
            <dt>{S.backstage.sheetsCount}</dt><dd>{e.wb.sheets.length}</dd>
            <dt>{S.backstage.size}</dt><dd>{cells}</dd>
            <dt>{S.backstage.title}</dt><dd>{e.wb.properties.title ?? e.name}</dd>
            <dt>{S.backstage.author}</dt><dd>{e.wb.properties.creator ?? '—'}</dd>
          </dl>
        </BackstageSection>
      </>
    ) },
    { ...BACKSTAGE_PAGES.save, onSelect: () => { e.closeBackstage(); e.save(); } },
    { ...BACKSTAGE_PAGES.saveAs, render: () => <SaveAsPage e={e} /> },
    { ...BACKSTAGE_PAGES.print, render: () => <PrintPage e={e} /> },
    { ...BACKSTAGE_PAGES.export, render: () => (
      <>
        <BackstageHeading>{BACKSTAGE_PAGES.export.label}</BackstageHeading>
        <BackstageAction icon="document_pdf" title={S.backstage.exportPdf} description={S.backstage.exportPdfDesc} onClick={e.print} />
        <BackstageAction icon="arrow_export_ltr" title={S.backstage.exportCsv} description={S.backstage.exportCsvDesc}>
          <div className="xl-dlg-row">
            {(['csv', 'tsv', 'ods'] as const).map((f) => <Button key={f} onClick={() => e.saveAs(e.name, f)}>{f.toUpperCase()}</Button>)}
          </div>
        </BackstageAction>
      </>
    ) },
    { ...BACKSTAGE_PAGES.close, onSelect: e.close },
    { ...BACKSTAGE_PAGES.account, render: () => <><BackstageHeading>{BACKSTAGE_PAGES.account.label}</BackstageHeading><p>{S.backstage.account} ForgeOffice {e.services.version}</p></> },
    { ...BACKSTAGE_PAGES.options, render: () => (
      <>
        <BackstageHeading>{S.backstage.options}</BackstageHeading>
        <BackstageSection title={RB.calcOptions}>
          <label className="xl-radio"><input type="radio" checked={!e.calcManual} onChange={() => e.setCalcManual(false)} />{S.backstage.calcAuto}</label>
          <label className="xl-radio"><input type="radio" checked={e.calcManual} onChange={() => e.setCalcManual(true)} />{S.backstage.calcManual}</label>
        </BackstageSection>
        <p>{S.backstage.r1c1}</p>
        <p>{S.backstage.autoRecover}</p>
      </>
    ) },
  ];
}
