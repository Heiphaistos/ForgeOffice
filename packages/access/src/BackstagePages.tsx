// Pages du Backstage (onglet Fichier) : Accueil, Nouveau (base vide + modeles), Ouvrir, Informations, Enregistrer sous, Imprimer.
import { AppBadge, BackstageAction, BackstageHeading, BackstageSection, BackstageTile, BACKSTAGE_PAGES, Button, FileList, type BackstagePage, type FileRow } from '@forgeoffice/ui';
import { MODULES, type RecentFile } from '@forgeoffice/core';
import { TEMPLATES, type TemplateDef } from './logic/templates.ts';
import { frenchNumber } from './logic/values.ts';
import { S } from './strings.ts';
import type { InfosBase } from './types.ts';

export interface BackstageInput {
  native: boolean;
  hasDb: boolean;
  dbName: string;
  infos: InfosBase | null;
  recents: readonly RecentFile[];
  newBlank: () => void;
  template: (t: TemplateDef) => void;
  browse: () => void;
  openRecent: (r: RecentFile) => void;
  saveAs: () => void;
  backup: () => void;
  compact: () => void;
  integrity: () => void;
  print: () => void;
  closeDb: () => void;
}

function TilePreview({ blank }: { blank?: boolean }) {
  return (
    <span className="acc-tile">
      {blank ? <span className="acc-tile__blank" /> : (
        <span className="acc-tile__grid">
          {Array.from({ length: 12 }, (_, i) => <span key={i} />)}
        </span>
      )}
    </span>
  );
}

function size(bytes: number): string {
  return bytes >= 1048576 ? `${frenchNumber(Math.round(bytes / 104857.6) / 10)} Mo` : `${frenchNumber(Math.max(1, Math.round(bytes / 1024)))} Ko`;
}

export function backstagePages(p: BackstageInput): BackstagePage[] {
  const tiles = (
    <div className="acc-tiles">
      <BackstageTile label={S.bs.blank} description={S.bs.blankDesc} preview={<TilePreview blank />} onClick={p.newBlank} />
      {TEMPLATES.map((t) => <BackstageTile key={t.id} label={t.label} description={t.description} preview={<TilePreview />} onClick={() => p.template(t)} />)}
    </div>
  );
  const rows: FileRow[] = p.recents.map((r) => ({ id: r.path, name: r.name, location: r.path, date: r.openedAt, icon: <AppBadge glyph="B" color={MODULES.access.accent} size={24} /> }));
  const recent = rows.length === 0 ? <p className="acc-muted">{S.bs.noRecent}</p> : (
    <FileList rows={rows} grouped onOpen={(row) => {
      const r = p.recents.find((x) => x.path === row.id);
      if (r) p.openRecent(r);
    }} />
  );
  const nativeOnly = p.native ? null : <p className="acc-muted">{S.bs.nativeOnly}</p>;
  return [
    { ...BACKSTAGE_PAGES.home, render: () => (
      <>
        <BackstageHeading>{S.bs.hello}</BackstageHeading>
        <BackstageSection title={S.bs.new}>{nativeOnly}{tiles}</BackstageSection>
        <BackstageSection title={S.bs.recent}>{recent}</BackstageSection>
      </>
    ) },
    { ...BACKSTAGE_PAGES.new, render: () => <><BackstageHeading>{S.bs.new}</BackstageHeading>{nativeOnly}{tiles}</> },
    { ...BACKSTAGE_PAGES.open, render: () => (
      <>
        <BackstageHeading actions={<Button icon="folder_open" disabled={!p.native} onClick={p.browse}>{S.bs.browse}</Button>}>{S.bs.open}</BackstageHeading>
        {nativeOnly}
        {recent}
      </>
    ) },
    { ...BACKSTAGE_PAGES.info, disabled: !p.hasDb, render: () => (
      <>
        <BackstageHeading>{S.bs.info}</BackstageHeading>
        <h2 className="acc-bs-name">{p.dbName}</h2>
        {p.infos && (
          <dl className="acc-bs-props">
            <dt>{S.bs.path}</dt><dd>{p.infos.chemin ?? S.bs.memory}</dd>
            <dt>{S.bs.size}</dt><dd>{size(p.infos.taille_octets)}</dd>
            <dt>{S.bs.tables}</dt><dd>{p.infos.nb_tables}</dd>
            <dt>{S.bs.mode}</dt><dd>{p.infos.lecture_seule ? S.bs.readOnly : S.bs.readWrite}</dd>
            <dt>{S.bs.engine}</dt><dd>SQLite {p.infos.version_sqlite}</dd>
          </dl>
        )}
        <BackstageAction icon="database_arrow_down" title={S.cmd.compact} description={S.bs.compactDesc} onClick={p.native && !p.infos?.lecture_seule ? p.compact : undefined} />
        <BackstageAction icon="shield_lock" title={S.cmd.integrity} description={S.bs.integrityDesc} onClick={p.integrity} />
      </>
    ) },
    { ...BACKSTAGE_PAGES.saveAs, disabled: !p.hasDb, render: () => (
      <>
        <BackstageHeading>{S.bs.saveAs}</BackstageHeading>
        {nativeOnly}
        <BackstageAction icon="save_copy" title={S.bs.saveDbAs} description={S.bs.saveDbAsDesc} onClick={p.native ? p.saveAs : undefined} />
        <BackstageAction icon="save" title={S.bs.backup} description={S.bs.backupDesc} onClick={p.native ? p.backup : undefined} />
      </>
    ) },
    { ...BACKSTAGE_PAGES.print, disabled: !p.hasDb, render: () => (
      <>
        <BackstageHeading>{S.bs.print}</BackstageHeading>
        <BackstageAction icon="print" title={S.bs.print} description={S.bs.printDesc} onClick={p.print} />
      </>
    ) },
    { ...BACKSTAGE_PAGES.close, disabled: !p.hasDb, onSelect: p.closeDb },
  ];
}
