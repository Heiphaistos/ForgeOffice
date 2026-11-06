// Pages du Backstage (Fichier) : Accueil, Nouveau, Ouvrir, Informations, Enregistrer sous (tous formats),
// Imprimer (apercu pagine et reglages), Exporter, Compte, Options.
import { useState } from 'react';
import { MODULES, type RecentFile, type Services } from '@forgeoffice/core';
import {
  AppBadge, BackstageAction, BackstageHeading, BackstageSection, BackstageTile, BACKSTAGE_PAGES, Button, Checkbox, FileList, TextField, type BackstagePage, type FileRow,
} from '@forgeoffice/ui';
import type { Scalar } from '@forgeoffice/formulas';
import type { Sheet, Workbook } from '@forgeoffice/xlsx';
import { PrintPage } from './page-setup/print-page.tsx';
import type { PsTab } from './page-setup/types.ts';
import { SAVE_FORMATS, type SaveFormat } from './io.ts';
import { S, RB } from '../strings/index.ts';

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
  saveAs: (name: string, format: SaveFormat, protectFormulas?: boolean) => void;
  print: () => void;
  close: () => void;
  closeBackstage: () => void;
  protect: () => void;
  setPage: (patch: Partial<Sheet['pageSetup']>) => void;
  /** Ouvre la boite Mise en page (ferme le Backstage). */
  openPageSetup?: (tab?: PsTab) => void;
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

function SaveAsPage({ e }: { e: BackstageEnv }) {
  const [name, setName] = useState(e.name);
  const [format, setFormat] = useState<SaveFormat>('xlsx');
  const [protect, setProtect] = useState(true);
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
        {(format === 'csv' || format === 'tsv') && <Checkbox checked={protect} onChange={setProtect} label={S.backstage.protectFormulas} />}
        <Button appearance="primary" icon="save" onClick={() => e.saveAs(name, format, protect)}>{S.backstage.saveAsGo}</Button>
      </div>
    </>
  );
}

function ExportPage({ e }: { e: BackstageEnv }) {
  const [protect, setProtect] = useState(true);
  return (
    <>
      <BackstageHeading>{BACKSTAGE_PAGES.export.label}</BackstageHeading>
      <BackstageAction icon="document_pdf" title={S.backstage.exportPdf} description={S.backstage.exportPdfDesc} onClick={e.print} />
      <BackstageAction icon="arrow_export_ltr" title={S.backstage.exportCsv} description={S.backstage.exportCsvDesc}>
        <div className="xl-dlg-row">
          {(['csv', 'tsv', 'ods'] as const).map((f) => <Button key={f} onClick={() => e.saveAs(e.name, f, protect)}>{f.toUpperCase()}</Button>)}
        </div>
        <Checkbox checked={protect} onChange={setProtect} label={S.backstage.protectFormulas} />
      </BackstageAction>
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
    { ...BACKSTAGE_PAGES.export, render: () => <ExportPage e={e} /> },
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
