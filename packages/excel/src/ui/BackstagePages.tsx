// Pages du Backstage (Fichier) : Accueil, Nouveau, Ouvrir, Informations, Enregistrer sous (tous formats),
// Imprimer (apercu pagine et reglages), Exporter, Compte, Options.
import { useEffect, useState } from 'react';
import { MODULES, type RecentFile, type Services } from '@forgeoffice/core';
import {
  AppBadge, BackstageAction, DisplayOptions, BackstageHeading, BackstageSection, BackstageTile, BACKSTAGE_PAGES, Button, Checkbox, FileList, TextField, type BackstagePage, type FileRow,
} from '@forgeoffice/ui';
import type { Scalar } from '@forgeoffice/formulas';
import type { VersionInfo } from '../logic/versions.ts';
import type { DocumentProperties, Sheet, Workbook } from '@forgeoffice/xlsx';
import { PrintPage } from './page-setup/print-page.tsx';
import type { PsTab } from './page-setup/types.ts';
import { ENTER_DIRECTIONS, RECOVERY_CHOICES, currentEnterDirection, fixedDecimals, recoverySeconds, saveEnterDirection, setFixedDecimals, setRecoverySeconds, setUserName, userName, type EnterDirection } from '../logic/options.ts';
import { isOnlyOffice } from '@forgeoffice/ui';
import { OoExcelAdvanced, OoExcelInfo } from './OoBackstage.tsx';
import { SAVE_FORMATS, type SaveFormat } from './io.ts';
import { S, RB } from '../strings/index.ts';

export interface BackstageEnv {
  services: Services;
  wb: Workbook;
  sheet: Sheet;
  name: string;
  recents: RecentFile[];
  value: (row: number, col: number) => Scalar;
  /** Modifie les proprietes du document (titre, auteur, sujet, mots cles, categorie, societe). */
  setProperties: (patch: Partial<DocumentProperties>) => void;
  /** Historique de versions du classeur (copies horodatees) et restauration d'une version. */
  listVersions: () => Promise<VersionInfo[]>;
  restoreVersion: (id: string) => Promise<void>;
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
  const optionsBody = (
    <>
        <DisplayOptions settings={e.services.settings} app="excel" />
        <BackstageSection title={S.backstage.general}>
          <UserNameOption />
        </BackstageSection>
        <BackstageSection title={RB.calcOptions}>
          <label className="xl-radio"><input type="radio" checked={!e.calcManual} onChange={() => e.setCalcManual(false)} />{S.backstage.calcAuto}</label>
          <label className="xl-radio"><input type="radio" checked={e.calcManual} onChange={() => e.setCalcManual(true)} />{S.backstage.calcManual}</label>
        </BackstageSection>
        <BackstageSection title={S.backstage.advanced}>
          <EnterDirectionOption />
          <FixedDecimalsOption />
        </BackstageSection>
        <p>{S.backstage.r1c1}</p>
        <BackstageSection title={S.backstage.saving}>
          <RecoveryOption />
        </BackstageSection>
    </>
  );
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
    { ...BACKSTAGE_PAGES.info, render: () => (isOnlyOffice() ? <OoExcelInfo e={e} /> : (
      <>
        <BackstageHeading>{S.backstage.info}</BackstageHeading>
        <BackstageAction icon="shield_lock" title={S.backstage.protectTitle} description={S.backstage.protectDesc} onClick={e.protect} />
        <BackstageAction icon="accessibility_checkmark" title={S.backstage.inspectTitle} description={S.backstage.inspectDesc(cells, formulas)} />
        <BackstageSection title={S.backstage.versions}>
          <VersionList e={e} />
        </BackstageSection>
        <BackstageSection title={S.backstage.properties}>
          <dl className="xl-props">
            <dt>{S.backstage.sheetsCount}</dt><dd>{e.wb.sheets.length}</dd>
            <dt>{S.backstage.size}</dt><dd>{cells}</dd>
          </dl>
          <div className="xl-form xl-props-edit">
            {PROPERTY_FIELDS.map((k) => (
              <PropertyField key={k} id={k} label={S.backstage.props[k]} value={e.wb.properties[k] ?? (k === 'title' ? e.name : '')} onCommit={(v) => e.setProperties({ [k]: v })} />
            ))}
          </div>
        </BackstageSection>
      </>
    )) },
    { ...BACKSTAGE_PAGES.save, onSelect: () => { e.closeBackstage(); e.save(); } },
    { ...BACKSTAGE_PAGES.saveAs, render: () => <SaveAsPage e={e} /> },
    { ...BACKSTAGE_PAGES.print, render: () => <PrintPage e={e} /> },
    { ...BACKSTAGE_PAGES.export, render: () => <ExportPage e={e} /> },
    { ...BACKSTAGE_PAGES.close, onSelect: e.close },
    { ...BACKSTAGE_PAGES.account, render: () => <><BackstageHeading>{BACKSTAGE_PAGES.account.label}</BackstageHeading><p>{S.backstage.account} ForgeOffice {e.services.version}</p></> },
    { ...BACKSTAGE_PAGES.options, render: () => (isOnlyOffice() ? <OoExcelAdvanced e={e} extra={optionsBody} /> : <><BackstageHeading>{S.backstage.options}</BackstageHeading>{optionsBody}</>) },
  ];
}

/** Option Avance : sens de deplacement de la selection apres Entree. */
function EnterDirectionOption() {
  const [dir, setDir] = useState<EnterDirection>(currentEnterDirection);
  return (
    <div className="xl-form">
      <label htmlFor="opt-enter">{S.backstage.afterEnter}</label>
      <select id="opt-enter" value={dir} onChange={(e) => { const v = e.target.value as EnterDirection; setDir(v); saveEnterDirection(v); }}>
        {ENTER_DIRECTIONS.map((d) => <option key={d} value={d}>{S.backstage.enterDirections[d]}</option>)}
      </select>
    </div>
  );
}

/** Option Avance : decimale fixe a la saisie (nombre de decimales, 0 = desactivee). */
function FixedDecimalsOption() {
  const [n, setN] = useState(fixedDecimals);
  return (
    <div className="xl-form">
      <label htmlFor="opt-decimals">{S.backstage.fixedDecimals}</label>
      <input id="opt-decimals" className="ps-count" type="number" min={0} max={9} value={n} onChange={(e) => { const v = Math.max(0, Math.min(9, Math.round(Number(e.target.value)) || 0)); setN(v); setFixedDecimals(v); }} />
    </div>
  );
}

const PROPERTY_FIELDS = ['title', 'creator', 'subject', 'keywords', 'category', 'company'] as const;

/** Champ de propriete enregistre a la sortie du champ (ou Entree). */
function PropertyField({ id, label, value, onCommit }: { id: string; label: string; value: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <>
      <label htmlFor={`prop-${id}`}>{label}</label>
      <input id={`prop-${id}`} className="ps-count" style={{ width: '100%' }} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text !== value && onCommit(text)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
    </>
  );
}

/** Option General : nom d'utilisateur (auteur des nouvelles notes). */
function UserNameOption() {
  const [name, setName] = useState(userName);
  return (
    <div className="xl-form">
      <label htmlFor="opt-user">{S.backstage.userName}</label>
      <input id="opt-user" className="ps-count" style={{ width: '100%' }} value={name} onChange={(e) => { setName(e.target.value); setUserName(e.target.value); }} />
    </div>
  );
}

/** Option Enregistrement : intervalle de la copie de secours automatique. */
function RecoveryOption() {
  const [sec, setSec] = useState(recoverySeconds);
  return (
    <div className="xl-form">
      <label htmlFor="opt-recovery">{S.backstage.recoveryEvery}</label>
      <select id="opt-recovery" value={sec} onChange={(e) => { const v = Number(e.target.value); setSec(v); setRecoverySeconds(v); }}>
        {RECOVERY_CHOICES.map((n) => <option key={n} value={n}>{n < 60 ? `${n} secondes` : `${n / 60} minute(s)`}</option>)}
      </select>
    </div>
  );
}

/** Historique de versions : copies de recuperation horodatees, restauration d'une version. */
function VersionList({ e }: { e: BackstageEnv }) {
  const [list, setList] = useState<VersionInfo[] | null>(null);
  useEffect(() => {
    let live = true;
    e.listVersions().then((l) => live && setList(l), () => live && setList([]));
    return () => { live = false; };
  }, [e]);
  if (list === null) return <p>…</p>;
  if (!list.length) return <p>{S.backstage.noVersions}</p>;
  return (
    <ul className="xl-versions">
      {list.map((v) => (
        <li key={v.id}>
          <span>{new Date(v.at).toLocaleString('fr-FR')} · {Math.max(1, Math.round(v.size / 1024))} Ko</span>
          <Button size="small" onClick={() => void e.restoreVersion(v.id)}>{S.backstage.restore}</Button>
        </li>
      ))}
    </ul>
  );
}
