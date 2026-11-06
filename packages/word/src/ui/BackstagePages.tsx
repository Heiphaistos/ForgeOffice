// Pages du Backstage (Fichier) : Accueil, Nouveau, Ouvrir, Informations, Enregistrer sous, Imprimer, Exporter, Options.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MODULES, type RecentFile } from '@forgeoffice/core';
import {
  AppBadge, BackstageAction, BackstageHeading, BackstageSection, BackstageTile, BACKSTAGE_PAGES, Button, FileList, TextField, THEME_SETTING, applyTheme, savedTheme,
  type BackstagePage, type FileRow, type ThemeChoice,
} from '@forgeoffice/ui';
import { plainText, type DocumentProperties, type Section, type WordDocument, type WritableFormat } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import type { Ctl } from '../app/types.ts';
import { baseName, fullDocument, type Env } from '../app/actions.ts';
import { advancedStats, formatMinutes } from '../features/stats.ts';
import { TEMPLATES } from '../features/templates.ts';
import { Check, Row, Select } from '../dialogs/common.tsx';
import { sectionBox } from '../features/sections.ts';
import type { SheetInfo } from './PageView.tsx';

const B = T.backstage;

/** Vignettes de pages : copies de la surface du document mises a l'echelle (apercu avant impression, plusieurs pages). */
export function PageThumbs({ sheets, sections, scale, onPick, max = 30 }: { sheets: readonly SheetInfo[]; sections: readonly Section[]; scale: number; onPick?: (page: number) => void; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const boxes = sheets.slice(0, max).map((sh) => sectionBox(sections[Math.min(sh.section, sections.length - 1)]!));
  const maxW = Math.max(...boxes.map((b) => b.pageW), 1);
  useLayoutEffect(() => {
    const host = ref.current;
    const src = document.querySelector<HTMLElement>('.fo-word-canvas .fo-word-pages');
    if (!host || !src) return;
    const clips = [...host.querySelectorAll<HTMLElement>('.fo-word-thumb__clip')];
    clips.forEach((box, i) => {
      const clone = src.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[contenteditable]').forEach((el) => el.setAttribute('contenteditable', 'false'));
      clone.style.zoom = '1';
      clone.style.transform = `scale(${scale}) translate(${-(maxW - boxes[i]!.pageW) / 2}px, ${-(sheets[i]!.top)}px)`;
      clone.style.transformOrigin = 'top left';
      clone.setAttribute('aria-hidden', 'true');
      box.replaceChildren(clone);
    });
  }, [sheets, sections, scale]);
  return (
    <div ref={ref} className="fo-word-thumbs">
      {boxes.map((b, i) => (
        <button key={i} type="button" className="fo-word-thumb" onClick={() => onPick?.(i + 1)} aria-label={T.status.page(i + 1, sheets.length)}>
          <div className="fo-word-thumb__clip" style={{ width: b.pageW * scale, height: b.pageH * scale }} />
          <span>{sheets[i]!.label}</span>
        </button>
      ))}
    </div>
  );
}

function blankPreview(lines: number) {
  return <span className="fo-word-tplthumb">{Array.from({ length: lines }, (_, i) => <span key={i} style={{ width: `${88 - ((i * 23) % 45)}%` }} />)}</span>;
}

export interface BackstageEnv {
  c: Ctl;
  env: Env;
  pageCount: number;
  sheets: readonly SheetInfo[];
  sections: readonly Section[];
  close: () => void;
  author: string;
  setAuthor: (name: string) => void;
}

function Recents({ c, close }: { c: Ctl; close: () => void }) {
  const [recent, setRecent] = useState<RecentFile[]>([]);
  useEffect(() => {
    void c.services.recentFiles().then((list) => setRecent(list.filter((r) => r.app === 'word')));
  }, [c.services]);
  const rows: FileRow[] = recent.map((r) => ({ id: r.path, name: r.name, location: r.path, date: r.openedAt, icon: <AppBadge glyph={MODULES.word.glyph} color={MODULES.word.accent} size={24} /> }));
  return <FileList rows={rows} grouped emptyText={B.noRecent} onOpen={(row) => {
    close();
    void c.services.readFile(row.id).then((f) => c.services.openDocument(f), (err: unknown) => c.notify(String(err instanceof Error ? err.message : err), 'error'));
  }} />;
}

function Info({ c, env, pageCount }: BackstageEnv) {
  const doc = fullDocument(env);
  const text = plainText(doc);
  const st = advancedStats(text);
  const props = c.meta.properties;
  const set = (k: keyof DocumentProperties, v: string): void => c.updateMeta((m) => ({ ...m, properties: { ...m.properties, [k]: v || undefined } }));
  const field = (k: keyof DocumentProperties, label: string) => <TextField label={label} value={String(props[k] ?? '')} onChange={(e) => set(k, e.target.value)} />;
  const date = (iso?: string): string => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) : '—');
  return (
    <>
      <BackstageHeading>{B.info}</BackstageHeading>
      <div className="fo-word-bsinfo">
        <div>
          <BackstageAction icon="shield_lock" title={B.protect} description={B.protectDesc} onClick={() => c.setUi({ readOnly: !c.ui.readOnly })}>
            <Button size="small" onClick={() => c.setUi({ readOnly: !c.ui.readOnly })}>{c.ui.readOnly ? T.dialogs.unprotect : B.markFinal}</Button>
          </BackstageAction>
          <BackstageAction icon="accessibility_checkmark" title={B.inspect} description={B.inspectDesc}>
            <Button size="small" onClick={() => c.updateMeta((m) => ({ ...m, properties: { custom: m.properties.custom, title: m.properties.title } }))}>{B.removePersonal}</Button>
          </BackstageAction>
          <BackstageAction icon="history" title={B.versions} description={B.versionsDesc} />
        </div>
        <aside className="fo-word-bsinfo__props">
          <BackstageSection title={B.properties}>
            <div className="fo-word-form">
              {field('title', B.title)}{field('subject', B.subject)}{field('creator', B.authorProp)}{field('keywords', B.keywords)}
              {field('description', B.comments)}{field('company', B.company)}{field('category', B.category)}
            </div>
          </BackstageSection>
          <BackstageSection title={B.stats}>
            <table className="fo-word-stats__table"><tbody>
              {([[B.pages, pageCount], [B.words, st.words], [B.characters, st.characters], [B.paragraphs, st.paragraphs], [B.readingTime, formatMinutes(st.readingMinutes)],
                [B.readability, `${st.readability} / 100`], [B.created, date(props.created)], [B.modified, date(props.modified)]] as const).map(([l, v]) => (
                <tr key={l}><th scope="row">{l}</th><td>{typeof v === 'number' ? v.toLocaleString('fr-FR') : v}</td></tr>
              ))}
            </tbody></table>
          </BackstageSection>
        </aside>
      </div>
    </>
  );
}

function SaveAs({ c, env }: BackstageEnv) {
  const [name, setName] = useState(baseName(env.info().name));
  const [format, setFormat] = useState<WritableFormat>('docx');
  const formats = Object.keys(B.formatNames) as WritableFormat[];
  return (
    <>
      <BackstageHeading>{B.saveAsTitle}</BackstageHeading>
      <div className="fo-word-form fo-word-bssave">
        <TextField label={B.fileName} value={name} onChange={(e) => setName(e.target.value)} />
        <Row label={B.format}><Select value={format} label={B.format} options={formats.map((f): [WritableFormat, string] => [f, B.formatNames[f]])} onChange={setFormat} /></Row>
        <Button appearance="primary" icon="save" onClick={() => void c.act.saveAs(format, name.trim() || T.app.untitled)}>{B.saveBtn}</Button>
      </div>
    </>
  );
}

function Options({ c, author, setAuthor }: BackstageEnv) {
  const [theme, setTheme] = useState<ThemeChoice>(() => savedTheme(c.services.settings));
  return (
    <>
      <BackstageHeading>{B.options}</BackstageHeading>
      <BackstageSection title={B.author}>
        <TextField value={author} hint={B.authorHint} aria-label={B.author} onChange={(e) => setAuthor(e.target.value)} />
      </BackstageSection>
      <BackstageSection title={B.theme}>
        <Select value={theme} label={B.theme} options={[['light', B.light], ['dark', B.dark], ['contrast', B.contrast], ['system', B.system]]}
          onChange={(t) => { setTheme(t); c.services.settings.set(THEME_SETTING, t); applyTheme(t); }} />
      </BackstageSection>
      <BackstageSection title={B.caret}>
        <div className="fo-word-form fo-word-form--2">
          <Row label={B.caretWidth}><Select value={String(c.ui.caret.width)} label={B.caretWidth} options={[['1', '1 px'], ['2', '2 px'], ['3', '3 px']]} onChange={(w) => c.setUi({ caret: { ...c.ui.caret, width: Number(w) as 1 | 2 | 3 } })} /></Row>
          <Row label={B.caretColor}><Select value={c.ui.caret.color} label={B.caretColor} options={[['auto', B.caretAuto], ['accent', B.caretAccent], ['black', B.caretBlack], ['white', B.caretWhite]]} onChange={(color) => c.setUi({ caret: { ...c.ui.caret, color } })} /></Row>
        </div>
        <Check label={B.caretBlink} checked={c.ui.caret.blink} onChange={(blink) => c.setUi({ caret: { ...c.ui.caret, blink } })} />
        <Check label={B.miniBar} checked={c.ui.miniBar} onChange={(miniBar) => c.setUi({ miniBar })} />
      </BackstageSection>
      <BackstageSection title={T.groups.proofing}>
        <Check label={B.spellcheck} checked={c.ui.spell} onChange={(spell) => c.setUi({ spell })} />
        <p className="fo-word-hint">{B.versionsDesc}</p>
      </BackstageSection>
    </>
  );
}

export function backstagePages(e: BackstageEnv): BackstagePage[] {
  const { c, pageCount, close } = e;
  const tiles = (
    <div className="fo-word-tiles">
      {TEMPLATES.map((t, i) => <BackstageTile key={t.id} label={t.label} description={t.description} preview={blankPreview(i === 0 ? 0 : 6 + i)} onClick={() => { close(); c.act.newDocument(t.id); }} />)}
    </div>
  );
  const exportRow = (f: WritableFormat, icon: 'document_text' | 'globe' | 'text_t' | 'document', title: string, desc: string) => (
    <BackstageAction key={f} icon={icon} title={title} description={desc} onClick={() => void c.act.exportFile(f)} />
  );
  return [
    { ...BACKSTAGE_PAGES.home, render: () => <><BackstageHeading>{B.hello}</BackstageHeading><BackstageSection title={B.newTitle}>{tiles}</BackstageSection><BackstageSection title={B.recent}><Recents c={c} close={close} /></BackstageSection></> },
    { ...BACKSTAGE_PAGES.new, render: () => <><BackstageHeading>{B.newTitle}</BackstageHeading>{tiles}</> },
    { ...BACKSTAGE_PAGES.open, render: () => <><BackstageHeading actions={<Button icon="folder_open" onClick={() => { close(); void c.act.open(); }}>{B.browse}</Button>}>{B.openTitle}</BackstageHeading><Recents c={c} close={close} /></> },
    { ...BACKSTAGE_PAGES.info, render: () => <Info {...e} /> },
    { ...BACKSTAGE_PAGES.save, onSelect: () => { close(); void c.act.save(); } },
    { ...BACKSTAGE_PAGES.saveAs, render: () => <SaveAs {...e} /> },
    { ...BACKSTAGE_PAGES.print, render: () => (
      <>
        <BackstageHeading actions={<Button appearance="primary" icon="print" onClick={() => { close(); c.act.print(); }}>{B.printBtn}</Button>}>{B.printTitle}</BackstageHeading>
        <p className="fo-word-hint">{B.printHint}</p>
        <p className="fo-word-hint">{B.previewOf(pageCount)}</p>
        <PageThumbs sheets={e.sheets} sections={e.sections} scale={0.32} max={12} />
      </>
    ) },
    { ...BACKSTAGE_PAGES.export, render: () => (
      <>
        <BackstageHeading>{B.exportTitle}</BackstageHeading>
        <BackstageAction icon="document_pdf" title={B.pdf} description={`${B.pdfDesc} ${B.printHint}`} onClick={() => { close(); c.act.print(); }} />
        {exportRow('md', 'document_text', B.md, B.mdDesc)}
        {exportRow('html', 'globe', B.html, B.htmlDesc)}
        {exportRow('txt', 'text_t', B.txt, B.txtDesc)}
        {exportRow('odt', 'document', B.formatNames.odt, '')}
        {exportRow('rtf', 'document', B.formatNames.rtf, '')}
      </>
    ) },
    { ...BACKSTAGE_PAGES.close, onSelect: () => { close(); c.act.close(); } },
    { ...BACKSTAGE_PAGES.account, render: () => <><BackstageHeading>{B.account}</BackstageHeading><p>{B.accountText(c.services.version)}</p></> },
    { ...BACKSTAGE_PAGES.options, render: () => <Options {...e} /> },
  ];
}
