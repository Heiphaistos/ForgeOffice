// Onglet Fichier (Backstage) : Accueil / Nouveau, Ouvrir, Informations, Enregistrer, Enregistrer sous, Imprimer,
// Exporter, Fermer, Options ; impression des diapositives, pages de commentaires et documents.
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AppBadge, Backstage, BACKSTAGE_PAGES, BackstageAction, BackstageHeading, BackstageSection, BackstageTile, Button, Checkbox, TextField, type BackstagePage,
} from '@forgeoffice/ui';
import { MODULES } from '@forgeoffice/core';
import { createBlankDeck, type Deck, type DeckFormat, type Slide } from '@forgeoffice/pptx';
import { PageView } from '../canvas/PageView.tsx';
import { applyDesignTheme, DESIGN_THEMES } from './themes.ts';
import type { Editor } from './editor.ts';
import { exportImages, exportPdf, saveDeck } from './fileops.ts';
import { NotesPage } from './NotesPage.tsx';
import { DeckThumb } from './ribbon/common.tsx';
import { slidePageProps } from './slide-render.ts';
import { S } from '../strings.ts';
import './backstage.css';

export type PrintLayout = 'slides' | 'notes' | 'handout3' | 'handout6';

/** Liste « 1-3, 5 » -> indices (base 0) bornes a la presentation. */
export function parseRange(text: string, count: number): number[] {
  const out = new Set<number>();
  for (const part of text.split(/[;,]/)) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b) && i <= count; i++) if (i >= 1) out.add(i - 1);
  }
  return [...out].sort((x, y) => x - y);
}

function Handout({ deck, slides, perPage, page }: { deck: Deck; slides: Array<{ slide: Slide; index: number }>; perPage: 3 | 6; page: number }) {
  const size = deck.notesSize;
  const cols = perPage === 6 ? 2 : 1;
  const rows = 3;
  const margin = 36;
  const cellW = (size.width - margin * 2) / (perPage === 3 ? 2 : cols);
  const cellH = (size.height - margin * 2) / rows;
  const thumbW = cellW - 18;
  const scale = Math.min(thumbW / deck.size.width, (cellH - 18) / deck.size.height);
  return (
    <div style={{ position: 'relative', width: size.width, height: size.height, background: '#fff', overflow: 'hidden', fontFamily: 'Aptos, "Segoe UI", sans-serif' }}>
      {slides.map(({ slide, index }, i) => {
        const col = perPage === 3 ? 0 : i % cols;
        const row = perPage === 3 ? i : Math.floor(i / cols);
        return (
          <div key={slide.id} style={{ position: 'absolute', left: margin + col * cellW, top: margin + row * cellH, width: deck.size.width * scale, height: deck.size.height * scale, outline: '0.75px solid #000', overflow: 'hidden' }}>
            <PageView {...slidePageProps(deck, slide, index, `h${slide.id}`)} scale={scale} />
          </div>
        );
      })}
      {perPage === 3 &&
        slides.map((_, i) => (
          <div key={i} style={{ position: 'absolute', left: margin + cellW + 10, top: margin + i * cellH + 6, width: cellW - 20 }}>
            {Array.from({ length: 6 }, (_, k) => (
              <div key={k} style={{ borderBottom: '0.75px solid #999', height: (cellH - 30) / 6 }} />
            ))}
          </div>
        ))}
      <div style={{ position: 'absolute', right: margin, bottom: 12, fontSize: 9, color: '#595959' }}>{page}</div>
    </div>
  );
}

/** Pages a imprimer ou a previsualiser. */
export function printPages(deck: Deck, layout: PrintLayout, indices: readonly number[], hidden: boolean): ReactNode[] {
  const slides = indices.map((i) => ({ slide: deck.slides[i] as Slide, index: i })).filter((x) => x.slide && (hidden || !x.slide.hidden));
  if (layout === 'slides') return slides.map(({ slide, index }) => <PageView key={slide.id} {...slidePageProps(deck, slide, index, `p${slide.id}`)} />);
  if (layout === 'notes') return slides.map(({ slide, index }) => <NotesPage key={slide.id} deck={deck} slide={slide} index={index} />);
  const per = layout === 'handout3' ? 3 : 6;
  const pages: ReactNode[] = [];
  for (let i = 0; i < slides.length; i += per) pages.push(<Handout key={i} deck={deck} slides={slides.slice(i, i + per)} perPage={per} page={i / per + 1} />);
  return pages;
}

/** Impression : pages rendues dans un conteneur dedie, seul visible a l'impression. */
export function PrintJob({ deck, layout, pages, onDone, print }: { deck: Deck; layout: PrintLayout; pages: ReactNode[]; onDone: () => void; print: () => void }) {
  const size = layout === 'slides' ? deck.size : deck.notesSize;
  useEffect(() => {
    const t = window.setTimeout(() => {
      print();
      onDone();
    }, 400);
    return () => window.clearTimeout(t);
  }, [print, onDone]);
  return createPortal(
    <div className="pp-print">
      <style>{`@page { size: ${size.width}pt ${size.height}pt; margin: 0; } @media print { body > *:not(.pp-print) { display: none !important; } .pp-print { display: block !important; } .pp-print__page { width: ${size.width}pt; height: ${size.height}pt; zoom: ${4 / 3}; } }`}</style>
      {pages.map((page, i) => (
        <div key={i} className="pp-print__page">
          {page}
        </div>
      ))}
    </div>,
    document.body,
  );
}

function PrintPage({ ed, onPrint }: { ed: Editor; onPrint: (layout: PrintLayout, indices: number[], hidden: boolean) => void }) {
  const [layout, setLayout] = useState<PrintLayout>('slides');
  const [which, setWhich] = useState<'all' | 'current' | 'custom'>('all');
  const [range, setRange] = useState('');
  const [hidden, setHidden] = useState(false);
  const count = ed.deck.slides.length;
  const indices = which === 'all' ? ed.deck.slides.map((_, i) => i) : which === 'current' ? [ed.slideIndex] : parseRange(range, count);
  const preview = printPages(ed.deck, layout, indices.slice(0, 6), hidden || which !== 'all');
  const size = layout === 'slides' ? ed.deck.size : ed.deck.notesSize;
  const scale = 300 / size.width;
  return (
    <>
      <BackstageHeading actions={<Button appearance="primary" icon="print" disabled={!indices.length} onClick={() => onPrint(layout, indices, hidden || which !== 'all')}>{S.file.print}</Button>}>{S.file.print}</BackstageHeading>
      <div className="pp-bs-print">
        <div className="pp-stack">
          <strong>{S.file.printWhat}</strong>
          <select value={which} onChange={(e) => setWhich(e.target.value as typeof which)}>
            <option value="all">{S.file.printAll}</option>
            <option value="current">{S.file.printCurrent}</option>
            <option value="custom">{S.file.printCustom}</option>
          </select>
          {which === 'custom' && <TextField placeholder="1-3, 5" value={range} onChange={(e) => setRange(e.target.value)} aria-label={S.file.printCustom} />}
          <strong>{S.file.printLayout}</strong>
          <select value={layout} onChange={(e) => setLayout(e.target.value as PrintLayout)}>
            <option value="slides">{S.file.layoutSlides}</option>
            <option value="notes">{S.file.layoutNotes}</option>
            <option value="handout3">{S.file.layoutHandout3}</option>
            <option value="handout6">{S.file.layoutHandout6}</option>
          </select>
          <Checkbox checked={hidden} label={S.file.printHidden} onChange={setHidden} />
          <span className="pp-muted">{S.file.pageCount(indices.length)}</span>
        </div>
        <div className="pp-bs-print__preview">
          {preview.map((page, i) => (
            <div key={i} className="pp-bs-print__page" style={{ width: size.width * scale, height: size.height * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0', width: size.width, height: size.height }}>{page}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function SaveAsPage({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const formats: Array<[DeckFormat, string]> = [['pptx', S.file.formats.pptx], ['pptm', S.file.formats.pptm], ['potx', S.file.formats.potx], ['potm', S.file.formats.potm], ['ppsx', S.file.formats.ppsx], ['ppsm', S.file.formats.ppsm]];
  return (
    <>
      <BackstageHeading>{S.file.saveAs}</BackstageHeading>
      <BackstageSection title={S.file.chooseFormat}>
        {formats.map(([f, label]) => (
          <BackstageAction key={f} icon={f.startsWith('pps') ? 'slide_play' : f.startsWith('pot') ? 'document_copy' : 'save'} title={`${label} (.${f})`} description={S.file.formatHelp[f]} onClick={() => void saveDeck(ed, f).then((ok) => ok && onClose())} />
        ))}
      </BackstageSection>
    </>
  );
}

function InfoPage({ ed }: { ed: Editor }) {
  const p = ed.deck.properties;
  const set = (key: 'title' | 'subject' | 'creator' | 'keywords' | 'category', value: string): void => ed.commit({ ...ed.deck, properties: { ...p, [key]: value } }, `prop-${key}`);
  const hiddenCount = ed.deck.slides.filter((s) => s.hidden).length;
  const comments = ed.deck.slides.reduce((n, s) => n + s.comments.length, 0);
  const notes = ed.deck.slides.filter((s) => s.notes?.length).length;
  return (
    <>
      <BackstageHeading>{S.file.info}</BackstageHeading>
      <div className="pp-bs-info">
        <div className="pp-stack">
          <BackstageAction icon="accessibility_checkmark" title={S.file.inspect} description={S.file.inspectText(hiddenCount, comments, notes)} onClick={() => ed.setUi({ pane: 'accessibility', backstage: null })} />
          <BackstageAction icon="history" title={S.file.versions} description={S.file.versionsText} />
        </div>
        <div className="pp-stack pp-bs-props">
          <strong>{S.file.properties}</strong>
          <TextField label={S.file.propTitle} defaultValue={p.title ?? ''} onBlur={(e) => set('title', e.target.value)} />
          <TextField label={S.file.propSubject} defaultValue={p.subject ?? ''} onBlur={(e) => set('subject', e.target.value)} />
          <TextField label={S.file.propAuthor} defaultValue={p.creator ?? ''} onBlur={(e) => set('creator', e.target.value)} />
          <TextField label={S.file.propKeywords} defaultValue={p.keywords ?? ''} onBlur={(e) => set('keywords', e.target.value)} />
          <span className="pp-muted">{S.file.slidesCount(ed.deck.slides.length)}</span>
          {p.created && <span className="pp-muted">{S.file.created(new Date(p.created).toLocaleString('fr-FR'))}</span>}
        </div>
      </div>
    </>
  );
}

export interface FileMenuProps {
  ed: Editor;
  open: boolean;
  page: string;
  onPage: (page: string) => void;
  onClose: () => void;
  onNew: (deck: Deck) => void;
  onOpen: () => void;
  onCloseDoc: () => void;
  onPrint: (layout: PrintLayout, indices: number[], hidden: boolean) => void;
}

export function FileMenu({ ed, open, page, onPage, onClose, onNew, onOpen, onCloseDoc, onPrint }: FileMenuProps) {
  const [author, setAuthor] = useState<string>(() => ed.services.settings.get('powerpoint.author', S.review.defaultAuthor));
  const blank = (): Deck => createBlankDeck(ed.deck.size);
  const newTiles = (
    <div className="pp-bs-tiles">
      <BackstageTile label={S.file.blank} preview={<DeckThumb deck={blank()} width={210} title={S.file.blank} />} onClick={() => onNew(blank())} />
      {DESIGN_THEMES.filter((t) => t.id !== 'office').map((t) => {
        const deck = applyDesignTheme(createBlankDeck(ed.deck.size), t.id);
        return <BackstageTile key={t.id} label={t.name} preview={<DeckThumb deck={deck} width={210} title={t.name} />} onClick={() => onNew(applyDesignTheme(createBlankDeck(ed.deck.size), t.id))} />;
      })}
    </div>
  );
  const pages: BackstagePage[] = [
    { ...BACKSTAGE_PAGES.home, render: () => <><BackstageHeading>{S.file.hello}</BackstageHeading><BackstageSection title={S.file.new}>{newTiles}</BackstageSection></> },
    { ...BACKSTAGE_PAGES.new, render: () => <><BackstageHeading>{S.file.new}</BackstageHeading>{newTiles}</> },
    { ...BACKSTAGE_PAGES.open, onSelect: () => { onClose(); onOpen(); } },
    { ...BACKSTAGE_PAGES.info, render: () => <InfoPage ed={ed} /> },
    { ...BACKSTAGE_PAGES.save, onSelect: () => { onClose(); void saveDeck(ed); } },
    { ...BACKSTAGE_PAGES.saveAs, render: () => <SaveAsPage ed={ed} onClose={onClose} /> },
    { ...BACKSTAGE_PAGES.print, render: () => <PrintPage ed={ed} onPrint={(...args) => { onClose(); onPrint(...args); }} /> },
    {
      ...BACKSTAGE_PAGES.export,
      render: () => (
        <>
          <BackstageHeading>{S.file.export}</BackstageHeading>
          <BackstageAction icon="document_pdf" title={S.file.exportPdf} description={S.file.exportPdfText} onClick={() => { onClose(); void exportPdf(ed); }} />
          <BackstageAction icon="document_one_page" title={S.file.exportNotesPdf} description={S.file.exportNotesPdfText} onClick={() => { onClose(); void exportPdf(ed, true); }} />
          <BackstageAction icon="image" title={S.file.exportPng} description={S.file.exportPngText} onClick={() => { onClose(); void exportImages(ed, 'png', false); }} />
          <BackstageAction icon="image" title={S.file.exportJpeg} description={S.file.exportJpegText} onClick={() => { onClose(); void exportImages(ed, 'jpeg', false); }} />
          <BackstageAction icon="image_add" title={S.file.exportCurrent} description={S.file.exportCurrentText} onClick={() => { onClose(); void exportImages(ed, 'png', true); }} />
          <BackstageAction icon="slide_play" title={S.file.exportShow} description={S.file.exportShowText} onClick={() => void saveDeck(ed, 'ppsx').then((ok) => ok && onClose())} />
        </>
      ),
    },
    { ...BACKSTAGE_PAGES.close, onSelect: onCloseDoc },
    { ...BACKSTAGE_PAGES.account, render: () => <><BackstageHeading>{S.file.account}</BackstageHeading><div className="pp-bs-account"><AppBadge glyph={MODULES.powerpoint.glyph} color={MODULES.powerpoint.accent} size={48} /><p>{S.file.accountText(ed.services.version)}</p></div></> },
    {
      ...BACKSTAGE_PAGES.options,
      render: () => (
        <>
          <BackstageHeading>{S.file.options}</BackstageHeading>
          <BackstageSection title={S.file.personalize}>
            <TextField label={S.file.userName} value={author} onChange={(e) => setAuthor(e.target.value)} onBlur={() => ed.services.settings.set('powerpoint.author', author.trim() || S.review.defaultAuthor)} />
          </BackstageSection>
        </>
      ),
    },
  ];
  return <Backstage open={open} appName={MODULES.powerpoint.name} pages={pages} activePage={page} onPageChange={onPage} onClose={onClose} />;
}
