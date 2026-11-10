// Mode Backstage « Fichier » : Nouveau, Ouvrir (recents), Enregistrer, Enregistrer sous (encodage, fins de ligne), Imprimer, Fermer, Options.
import { useEffect, useState } from 'react';
import { MODULES, type RecentFile, type Settings } from '@forgeoffice/core';
import {
  AppBadge, BACKSTAGE_PAGES, Backstage, DisplayOptions, BackstageAction, BackstageHeading, BackstageSection, Button, FileList, Switch, type BackstagePage,
} from '@forgeoffice/ui';
import { ENCODINGS, EOLS, type Eol, type TextEncoding } from '../logic/encoding.ts';
import { SPELL_LANGS, type NotesPrefs, type SpellLang } from '../logic/prefs.ts';
import { LAYOUTS, OFFICE_THEME, THEMES } from '../logic/themes.ts';
import type { Workspace } from '../workspace.ts';
import { CMD, S } from '../strings.ts';

export interface FileBackstageProps {
  ws: Workspace;
  settings: Settings;
  open: boolean;
  page: string;
  onPageChange: (page: string) => void;
  onClose: () => void;
  recents: readonly RecentFile[];
  prefs: NotesPrefs;
  setPrefs: (p: Partial<NotesPrefs>) => void;
  applyLayout: (i: number) => void;
  onOpenFolder: () => void;
  onPrint: () => void;
  onCloseTab: () => void;
  /** Quitter l'application (retour a l'Accueil dans le navigateur). */
  onQuit: () => void;
  onClearRecent: () => void;
  onConvert: () => void;
}

const info = MODULES.notes;

function SaveAsPage({ ws, onDone }: { ws: Workspace; onDone: () => void }) {
  const tab = ws.active;
  const [encoding, setEncoding] = useState<TextEncoding>(tab?.encoding ?? 'utf-8');
  const [eol, setEol] = useState<Eol>(tab?.eol ?? 'crlf');
  useEffect(() => {
    if (tab) {
      setEncoding(tab.encoding);
      setEol(tab.eol);
    }
  }, [tab]);
  if (!tab) return null;
  return (
    <>
      <BackstageHeading>{CMD.saveAs.replace('…', '')}</BackstageHeading>
      <div className="nt-form nt-form--wide">
        <label htmlFor="nt-enc">{S.menus.encoding}</label>
        <select id="nt-enc" className="nt-select" value={encoding} onChange={(e) => setEncoding(e.target.value as TextEncoding)}>
          {ENCODINGS.map((e) => <option key={e} value={e}>{S.encodings[e]}</option>)}
        </select>
        <label htmlFor="nt-eol">{S.menus.eol}</label>
        <select id="nt-eol" className="nt-select" value={eol} onChange={(e) => setEol(e.target.value as Eol)}>
          {EOLS.map((e) => <option key={e} value={e}>{S.eols[e]}</option>)}
        </select>
      </div>
      <p>
        <Button appearance="primary" icon="save_copy" onClick={() => void ws.save(tab.id, true, encoding, eol).then((ok) => ok && onDone())}>
          {CMD.saveAs}
        </Button>
      </p>
    </>
  );
}

export function FileBackstage(props: FileBackstageProps) {
  const { ws, prefs, setPrefs } = props;
  const rows = props.recents
    .filter((r) => r.app === 'notes')
    .map((r) => ({ id: `${r.path}`, name: r.name, location: r.path, date: r.openedAt, icon: <AppBadge glyph={info.glyph} color={info.accent} size={24} label={info.name} /> }));
  const openPage = (
    <>
      <BackstageHeading
        actions={
          <>
            <Button icon="folder_open" onClick={() => { props.onClose(); void ws.openDialog(); }}>{CMD.open}</Button>
            <Button icon="folder" onClick={() => { props.onClose(); props.onOpenFolder(); }}>{CMD.openFolder}</Button>
            <Button icon="delete" disabled={rows.length === 0} onClick={props.onClearRecent}>{CMD.clearRecent}</Button>
          </>
        }
      >
        {S.menus.recent}
      </BackstageHeading>
      <FileList rows={rows} grouped onOpen={(r) => { props.onClose(); void ws.openPath(r.location, r.name); }} />
    </>
  );
  const options = (
    <>
      <BackstageHeading>{BACKSTAGE_PAGES.options.label}</BackstageHeading>
      <DisplayOptions settings={props.settings} app="notes" />
      <BackstageSection title={S.ribbon.theme}>
        <div className="nt-themes">
          {[{ id: OFFICE_THEME, name: 'Office 2024' }, ...THEMES].map((t) => (
            <label key={t.id} className="nt-radio">
              <input type="radio" name="nt-theme" checked={prefs.theme === t.id} onChange={() => setPrefs({ theme: t.id })} />
              {t.name}
            </label>
          ))}
        </div>
      </BackstageSection>
      <BackstageSection title={S.ribbon.layout}>
        <div className="nt-themes">
          {LAYOUTS.map((l, i) => <Button key={l.name} appearance="subtle" icon="slide_layout" onClick={() => props.applyLayout(i)}>{l.name}</Button>)}
        </div>
      </BackstageSection>
      <BackstageSection title={S.ribbon.window}>
        <Switch checked={prefs.menus === 'classic'} onChange={(on) => setPrefs({ menus: on ? 'classic' : 'ribbon' })} label={CMD.menus} />
        <Switch checked={prefs.spell} onChange={(on) => setPrefs({ spell: on })} label={CMD.spell} />
        <div className="nt-form">
          <label htmlFor="nt-spell">{S.menus.spellLang}</label>
          <select id="nt-spell" className="nt-select" value={prefs.spellLang} onChange={(e) => setPrefs({ spellLang: e.target.value as SpellLang })}>
            {SPELL_LANGS.map((c) => <option key={c} value={c}>{S.spellLangs[c]}</option>)}
          </select>
        </div>
      </BackstageSection>
    </>
  );
  const pages: BackstagePage[] = [
    { ...BACKSTAGE_PAGES.new, onSelect: () => { props.onClose(); ws.newTab(); } },
    { ...BACKSTAGE_PAGES.open, render: () => openPage },
    { ...BACKSTAGE_PAGES.save, onSelect: () => { props.onClose(); if (ws.active) void ws.save(ws.activeId); } },
    { ...BACKSTAGE_PAGES.saveAs, render: () => <SaveAsPage ws={ws} onDone={props.onClose} /> },
    { ...BACKSTAGE_PAGES.print, onSelect: () => { props.onClose(); props.onPrint(); } },
    {
      ...BACKSTAGE_PAGES.export,
      render: () => (
        <>
          <BackstageHeading>{BACKSTAGE_PAGES.export.label}</BackstageHeading>
          <BackstageAction icon="document_text" title={CMD.convertDocx} description={S.convertDesc} onClick={() => { props.onClose(); props.onConvert(); }} />
        </>
      ),
    },
    { ...BACKSTAGE_PAGES.close, onSelect: () => { props.onClose(); props.onCloseTab(); } },
    { id: 'quit', label: CMD.quit, icon: 'sign_out', onSelect: () => { props.onClose(); props.onQuit(); } },
    { ...BACKSTAGE_PAGES.options, render: () => options },
  ];
  return <Backstage open={props.open} appName={info.name} pages={pages} activePage={props.page} onPageChange={props.onPageChange} onClose={props.onClose} />;
}
