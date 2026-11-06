// Onglet Fichier : Nouveau (catalogue des compositions, pages vierges, taille personnalisee), Ouvrir, Informations,
// Enregistrer, Enregistrer sous, Imprimer (imposition, traits de coupe), Exporter, Fermer.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Backstage, BACKSTAGE_PAGES, BackstageAction, BackstageHeading, BackstageSection, BackstageTile, Button, Checkbox, TextField, type BackstagePage,
} from '@forgeoffice/ui';
import { deckTheme, ptToMm, mmToPt } from '@forgeoffice/pptx';
import { reflow } from '../chain.ts';
import type { PubDocument } from '../fopub.ts';
import { S } from '../strings.ts';
import { blank, CATALOG, type BlankFormat } from '../templates/index.ts';
import type { Editor } from './editor.ts';
import { buildSheets, defaultImpose, exportPdf, exportPng, requestPptxExport, saveDoc, type ImposeMode, type Sheets } from './export.ts';
import { NumberField } from './dialogs.tsx';
import { afterFonts, createMeasure } from './measure.ts';
import { PageThumb } from './PagesPane.tsx';

/** Pages « 1-3, 5 » -> indices (base 0). */
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

/** Composition prete a l'emploi : articles deja repartis. */
export function flowed(doc: PubDocument): PubDocument {
  const r = reflow(doc.deck, doc.pub, createMeasure(deckTheme(doc.deck)));
  return { deck: r.deck, pub: r.pub };
}

function Preview({ doc, scope, width = 150 }: { doc: PubDocument; scope: string; width?: number }) {
  const slide = doc.deck.slides[0];
  if (!slide) return null;
  const w = doc.deck.size.width >= doc.deck.size.height ? width : (width * doc.deck.size.width) / doc.deck.size.height;
  return (
    <span className="pub-bs-preview" style={{ width, height: width * 0.78 }}>
      <PageThumb deck={doc.deck} pub={doc.pub} slide={slide} index={0} scope={scope} width={Math.min(w, ((width * 0.78) * doc.deck.size.width) / doc.deck.size.height)} />
    </span>
  );
}

function NewPage({ onNew }: { onNew: (doc: PubDocument) => void }) {
  const docs = useMemo(() => CATALOG.map((c) => ({ kind: c.kind, doc: flowed(c.build()) })), []);
  const blanks = useMemo(() => (['a4', 'a4l', 'a3', 'a5', 'letter'] as const).map((id) => ({ id, doc: id === 'a4l' ? blank('a4', true) : blank(id as BlankFormat) })), []);
  const [custom, setCustom] = useState({ width: 210, height: 297 });
  return (
    <>
      <BackstageHeading>{S.file.newTitle}</BackstageHeading>
      <BackstageSection title={S.file.blankTitle}>
        <div className="pub-bs-tiles">
          {blanks.map((b) => (
            <BackstageTile key={b.id} label={S.blanks[b.id]} preview={<Preview doc={b.doc} scope={b.id} />} onClick={() => onNew(b.doc)} />
          ))}
          <div className="pub-bs-custom">
            <strong>{S.file.customSize}</strong>
            <NumberField label={`${S.dialogs.width} (${S.dialogs.mm})`} value={custom.width} min={25} max={1422} step={1} onChange={(v) => setCustom((c) => ({ ...c, width: v }))} />
            <NumberField label={`${S.dialogs.height} (${S.dialogs.mm})`} value={custom.height} min={25} max={1422} step={1} onChange={(v) => setCustom((c) => ({ ...c, height: v }))} />
            <Button appearance="primary" onClick={() => onNew(blank({ width: mmToPt(custom.width), height: mmToPt(custom.height), type: 'custom' }))}>{S.dialogs.ok}</Button>
          </div>
        </div>
      </BackstageSection>
      <BackstageSection title={S.file.catalog}>
        <div className="pub-bs-tiles">
          {docs.map((d) => (
            <BackstageTile key={d.kind} label={S.kinds[d.kind]} preview={<Preview doc={d.doc} scope={d.kind} />} onClick={() => onNew(d.doc)} />
          ))}
        </div>
      </BackstageSection>
    </>
  );
}

/** Impression : feuilles rendues dans un conteneur dedie, seul visible a l'impression. */
export function PrintJob({ sheets, onDone, print }: { sheets: Sheets; onDone: () => void; print: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(() => {
      print();
      onDone();
    }, 400);
    return () => window.clearTimeout(t);
  }, [print, onDone]);
  return createPortal(
    <div className="pub-print">
      <style>{`@page { size: ${sheets.width}pt ${sheets.height}pt; margin: 0; } @media print { body > *:not(.pub-print) { display: none !important; } .pub-print { display: block !important; } .pub-print__sheet { width: ${sheets.width}pt; height: ${sheets.height}pt; zoom: ${4 / 3}; } }`}</style>
      {sheets.nodes.map((node, i) => (
        <div key={i} className="pub-print__sheet">
          {node}
        </div>
      ))}
    </div>,
    document.body,
  );
}

function PrintPage({ ed, onPrint }: { ed: Editor; onPrint: (sheets: Sheets) => void }) {
  const count = ed.deck.slides.length;
  const [which, setWhich] = useState<'all' | 'current' | 'custom'>('all');
  const [range, setRange] = useState('');
  const [impose, setImpose] = useState<ImposeMode>(defaultImpose(ed.pub));
  const [marks, setMarks] = useState(ed.pub.imposition?.kind === 'cards');
  const pages = which === 'all' ? undefined : which === 'current' ? [ed.pageIndex] : parseRange(range, count);
  const sheets = buildSheets(ed.doc, { impose, marks, pages });
  const scale = Math.min(300 / sheets.width, 380 / sheets.height);
  const perSheet = ed.pub.imposition ? ed.pub.imposition.cols * ed.pub.imposition.rows : 1;
  return (
    <>
      <BackstageHeading actions={<Button appearance="primary" icon="print" disabled={!sheets.nodes.length} onClick={() => onPrint(sheets)}>{S.file.printTitle}</Button>}>{S.file.printTitle}</BackstageHeading>
      <div className="pub-bs-print">
        <div className="pub-stack">
          <strong>{S.file.printWhat}</strong>
          <select value={which} onChange={(e) => setWhich(e.target.value as typeof which)} aria-label={S.file.printWhat}>
            <option value="all">{S.file.printAll}</option>
            <option value="current">{S.file.printCurrent}</option>
            <option value="custom">{S.file.printCustom}</option>
          </select>
          {which === 'custom' && <TextField placeholder="1-3, 5" value={range} onChange={(e) => setRange(e.target.value)} aria-label={S.file.printCustom} />}
          <strong>{S.file.printImpose}</strong>
          <select value={impose} onChange={(e) => setImpose(e.target.value as ImposeMode)} aria-label={S.file.printImpose}>
            <option value="none">{S.file.imposeNone}</option>
            {ed.pub.imposition?.kind === 'cards' && <option value="cards">{S.file.imposeCards(perSheet)}</option>}
            {ed.pub.imposition?.kind === 'fold' && <option value="fold">{S.file.imposeFold}</option>}
            <option value="booklet">{S.file.imposeBooklet}</option>
          </select>
          <Checkbox checked={marks} label={S.file.cropMarks} onChange={setMarks} />
          <span className="pub-muted">{S.file.sheets(sheets.nodes.length)}</span>
        </div>
        <div className="pub-bs-print__preview">
          {sheets.nodes.slice(0, 4).map((node, i) => (
            <div key={i} className="pub-bs-print__sheet" style={{ width: sheets.width * scale, height: sheets.height * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0', width: sheets.width, height: sheets.height }}>{node}</div>
            </div>
          ))}
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
  onNew: (doc: PubDocument) => void;
  onOpen: () => void;
  onCloseDoc: () => void;
  onPrint: (sheets: Sheets) => void;
}

export function FileMenu({ ed, open, page, onPage, onClose, onNew, onOpen, onCloseDoc, onPrint }: FileMenuProps) {
  const size = ed.deck.size;
  const cm = (pt: number): string => (ptToMm(pt) / 10).toFixed(1).replace('.', ',');
  const pages: BackstagePage[] = [
    { ...BACKSTAGE_PAGES.new, render: () => <NewPage onNew={onNew} /> },
    { ...BACKSTAGE_PAGES.open, onSelect: () => { onClose(); onOpen(); } },
    {
      ...BACKSTAGE_PAGES.info,
      render: () => (
        <>
          <BackstageHeading>{S.file.infoTitle}</BackstageHeading>
          <BackstageSection title={S.file.properties}>
            <dl className="pub-bs-props">
              <dt>{S.file.titleLabel}</dt>
              <dd><TextField value={ed.deck.properties.title ?? ''} onChange={(e) => ed.commitDeck({ ...ed.deck, properties: { ...ed.deck.properties, title: e.target.value } }, 'props')} aria-label={S.file.titleLabel} /></dd>
              <dt>{S.file.authorLabel}</dt>
              <dd>{ed.deck.properties.creator ?? ''}</dd>
              <dt>{S.file.kind}</dt>
              <dd>{S.kinds[ed.pub.kind]}</dd>
              <dt>{S.file.pages}</dt>
              <dd>{ed.deck.slides.length}</dd>
              <dt>{S.file.size}</dt>
              <dd>{S.status.size(cm(size.width), cm(size.height))}</dd>
            </dl>
          </BackstageSection>
        </>
      ),
    },
    { ...BACKSTAGE_PAGES.save, onSelect: () => { onClose(); void saveDoc(ed); } },
    {
      ...BACKSTAGE_PAGES.saveAs,
      render: () => (
        <>
          <BackstageHeading>{S.file.saveAsTitle}</BackstageHeading>
          <BackstageAction icon="save" title={S.file.saveAsFopub} description={S.file.saveAsFopubDesc} onClick={() => { onClose(); void saveDoc(ed, true); }} />
          <BackstageAction icon="slide_text" title={S.file.saveAsPptx} description={S.file.saveAsPptxDesc} onClick={() => { onClose(); requestPptxExport(ed); }} />
        </>
      ),
    },
    { ...BACKSTAGE_PAGES.print, render: () => <PrintPage ed={ed} onPrint={(sheets) => { onClose(); onPrint(sheets); }} /> },
    {
      ...BACKSTAGE_PAGES.export,
      render: () => (
        <>
          <BackstageHeading>{S.file.exportTitle}</BackstageHeading>
          <BackstageAction icon="document_pdf" title={S.file.exportPdf} description={S.file.exportPdfDesc} onClick={() => { onClose(); void afterFonts(ed, () => exportPdf(ed, false)); }} />
          <BackstageAction icon="print_add" title={S.file.exportPrinter} description={S.file.exportPrinterDesc} onClick={() => { onClose(); void afterFonts(ed, () => exportPdf(ed, true)); }} />
          <BackstageAction icon="print_add" title={S.file.exportCmyk} description={S.file.exportCmykDesc} onClick={() => { onClose(); void afterFonts(ed, () => exportPdf(ed, true, ed.doc, '', true)); }} />
          <BackstageAction icon="image" title={S.file.exportPng} description={S.file.exportPngDesc} onClick={() => { onClose(); void afterFonts(ed, () => exportPng(ed)); }} />
          <BackstageAction icon="slide_text" title={S.file.exportPptx} description={S.file.exportPptxDesc} onClick={() => { onClose(); requestPptxExport(ed); }} />
        </>
      ),
    },
    { ...BACKSTAGE_PAGES.close, onSelect: onCloseDoc },
  ];
  return <Backstage open={open} appName={S.file.formats.fopub} pages={pages} activePage={page} onPageChange={onPage} onClose={onClose} />;
}
