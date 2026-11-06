// Surface du document : feuilles de papier (mode Page), en-tetes/pieds, notes de bas de page, filigrane, bordures, numeros de ligne.
// Chaque feuille prend la geometrie de sa section ; seules les feuilles proches de l'ecran sont dessinees (virtualisation).
import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { Schema } from 'prosemirror-model';
import { formatNumber, type Block, type HeaderFooterRefs, type Section, type WordDocument } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import type { UiState } from '../app/types.ts';
import { borderCss } from '../editor/css.ts';
import { pageColor, readWatermark } from '../features/design.ts';
import { horizontalDiffers, resolveRefs, sectionBox } from '../features/sections.ts';
import { maxPageWidth } from '../editor/layout-deco.ts';
import { MiniEditor, StaticBlocks } from './blocks.tsx';

export const PAGE_GAP = 16;
/** Feuilles toujours dessinees (apercus du Backstage et vignettes). */
const KEEP_FIRST = 12;
/** Pagination native des colonnes (CSS column-wrap) disponible dans ce moteur. */
export const COLUMN_WRAP = typeof CSS !== 'undefined' && CSS.supports('column-wrap', 'wrap') && CSS.supports('column-height', '1px');
export const px = (pt: number): number => (pt * 4) / 3;

export interface PageNote {
  page: number;
  noteId: number;
  num: string;
}

/** Une feuille affichee : position verticale, section, numero de page. */
export interface SheetInfo {
  top: number;
  /** Debut de la zone de texte, relatif au haut de l'editeur. */
  textTop: number;
  section: number;
  /** Numero de page (nombre) et libelle mis en forme. */
  number: number;
  label: string;
  /** Premiere page de sa section. */
  first: boolean;
}

export interface Layout {
  pages: number;
  notes: PageNote[];
  lineNumbers: { page: number; y: number; n: number }[];
  sheets: SheetInfo[];
  /** Espace ajoute au-dessus des notes de fin (pagination de la zone de fin de document). */
  tailGap: number;
  /** Notes de fin referencees, dans l'ordre du document. */
  endnotes: number[];
}

export const EMPTY_LAYOUT: Layout = { pages: 1, notes: [], lineNumbers: [], sheets: [{ top: 0, textTop: 0, section: 0, number: 1, label: '1', first: true }], tailGap: 0, endnotes: [] };

/** Section dont les colonnes servent a tout le document (la pagination native des colonnes ne gere qu'une geometrie), ou -1. */
export function columnsSection(sections: readonly Section[]): number {
  return sections.findIndex((s) => s.columns.count > 1);
}

export interface HFEdit {
  kind: 'header' | 'footer';
  id: string;
  page: number;
}

export interface PageViewProps {
  schema: Schema;
  meta: WordDocument;
  /** Toutes les sections du document, dans l'ordre. */
  sections: readonly Section[];
  ui: UiState;
  layout: Layout;
  /** Feuilles a dessiner (virtualisation) : null = toutes. */
  range: { from: number; to: number } | null;
  gap: number;
  mountRef: RefObject<HTMLDivElement | null>;
  hfEdit: HFEdit | null;
  onEditHF: (edit: HFEdit | null) => void;
  onHFChange: (id: string, blocks: Block[]) => void;
  /** Calque au-dessus du document (poignees de l'image selectionnee). */
  overlay?: ReactNode;
  /** Clic droit sur un en-tete ou un pied de page. */
  onHFContext?: (e: { clientX: number; clientY: number; preventDefault: () => void }, kind: 'header' | 'footer') => void;
}

function refFor(refs: HeaderFooterRefs, sheet: SheetInfo, titlePage: boolean, evenOdd: boolean): string | undefined {
  if (sheet.first && titlePage) return refs.first;
  if (evenOdd && sheet.number % 2 === 0) return refs.even ?? refs.default;
  return refs.default;
}

export function PageView({ schema, meta, sections, ui, layout, range, gap, mountRef, hfEdit, onEditHF, onHFChange, overlay, onHFContext }: PageViewProps) {
  const colIdx = columnsSection(sections);
  const frame = sections[Math.max(0, colIdx)] ?? meta.finalSection;
  const multi = colIdx < 0 && horizontalDiffers(sections);
  const maxW = multi ? maxPageWidth(sections) : px(frame.pageWidth);
  const print = ui.view === 'print';
  const wm = readWatermark(meta);
  const bg = pageColor(meta);
  const sheets = layout.sheets;
  const lastBox = sectionBox(sections[sheets[sheets.length - 1]?.section ?? 0] ?? frame);
  const totalH = (sheets[sheets.length - 1]?.top ?? 0) + lastBox.pageH;
  const total = String(sheets.length);
  const cols = frame.columns.count > 1 ? { columnCount: frame.columns.count, columnGap: `${frame.columns.space}pt`, columnRule: frame.columns.separator ? '1px solid #808080' : undefined } : {};
  // Colonnes en mode Page : chaque rangee de colonnes = une page (CSS column-wrap, WebView2 / Chromium recents).
  const colWrap = print && frame.columns.count > 1 && COLUMN_WRAP;
  const wrapVars = colWrap ? { '--fo-colh': `${px(frame.pageHeight - frame.margins.top - frame.margins.bottom)}px`, '--fo-rowgap': `${px(frame.margins.top + frame.margins.bottom) + gap}px` } as CSSProperties : {};
  const headerRefs = resolveRefs(sections, 'headers');
  const footerRefs = resolveRefs(sections, 'footers');
  const from = range ? Math.max(0, range.from) : 0;
  const to = range ? Math.min(sheets.length - 1, range.to) : sheets.length - 1;

  const hf = (kind: 'header' | 'footer', page: number, sheet: SheetInfo, sec: Section) => {
    const refs = (kind === 'header' ? headerRefs : footerRefs)[sheet.section] ?? {};
    const id = refFor(refs, sheet, sec.titlePage, meta.settings.evenAndOddHeaders);
    const part = id ? meta.headersFooters[id] : undefined;
    const editing = hfEdit && hfEdit.kind === kind && hfEdit.page === page && hfEdit.id === id;
    const b = sectionBox(sec);
    const style = kind === 'header'
      ? { top: px(sec.margins.header), left: b.marginLeft, width: b.pageW - b.marginLeft - b.marginRight, minHeight: Math.max(16, px(sec.margins.top - sec.margins.header) - 8) }
      : { bottom: px(sec.margins.footer), left: b.marginLeft, width: b.pageW - b.marginLeft - b.marginRight, minHeight: 16 };
    const label = kind === 'header' ? T.dialogs.headerTitle : T.dialogs.footerTitle;
    return (
      <div className={`fo-word-hf fo-word-hf--${kind}${editing ? ' is-editing' : ''}`} style={style} title={editing ? undefined : T.dialogs.editHeaderHint} onContextMenu={(e) => { if (!editing) onHFContext?.(e, kind); }}
        onDoubleClick={() => !editing && (id ? onEditHF({ kind, id, page }) : onEditHF({ kind, id: '', page }))}>
        {editing && part ? (
          <>
            <span className="fo-word-hf__tag">{label}</span>
            <MiniEditor schema={schema} blocks={part.blocks} label={label} autoFocus className="fo-word-hf__editor" onChange={(blocks) => onHFChange(part.id, blocks)} onExit={() => onEditHF(null)} />
          </>
        ) : part ? (
          <StaticBlocks schema={schema} blocks={part.blocks} className="fo-doc fo-word-hf__static" tabGrid page={sheet.label} pages={total} />
        ) : null}
      </div>
    );
  };

  const sheetEl = (sheet: SheetInfo, i: number) => {
    const sec = sections[Math.min(sheet.section, sections.length - 1)] ?? frame;
    const b = sectionBox(sec);
    const pb = sec.pageBorders;
    const borderInset = pb?.offsetFrom === 'text';
    return (
      <div key={i} className="fo-word-sheet" style={{ top: sheet.top, left: (maxW - b.pageW) / 2, width: b.pageW, height: b.pageH, background: bg ?? undefined }} data-page={i + 1}>
        {pb && (
          <div className="fo-word-sheet__border" style={{
            inset: borderInset ? `${px(sec.margins.top - (pb.top?.space ?? 4))}px ${px(sec.margins.right - (pb.right?.space ?? 4))}px ${px(sec.margins.bottom - (pb.bottom?.space ?? 4))}px ${px(sec.margins.left - (pb.left?.space ?? 4))}px` : `${px(pb.top?.space ?? 24)}px ${px(pb.right?.space ?? 24)}px ${px(pb.bottom?.space ?? 24)}px ${px(pb.left?.space ?? 24)}px`,
            borderTop: borderCss(pb.top) ?? undefined, borderBottom: borderCss(pb.bottom) ?? undefined, borderLeft: borderCss(pb.left) ?? undefined, borderRight: borderCss(pb.right) ?? undefined,
          }} />
        )}
        {wm && <div className={`fo-word-watermark${wm.diagonal ? ' is-diagonal' : ''}`} style={{ color: wm.color }} aria-hidden="true">{wm.text}</div>}
        {hf('header', i, sheet, sec)}
        {hf('footer', i, sheet, sec)}
        <div className="fo-word-notes" style={{ left: b.marginLeft, width: b.pageW - b.marginLeft - b.marginRight, bottom: b.marginBottom }}>
          {layout.notes.filter((n) => n.page === i).map((n) => {
            const note = meta.footnotes.find((f) => f.id === n.noteId);
            return note ? <div key={n.noteId} data-note={n.noteId}><StaticBlocks schema={schema} blocks={note.blocks} noteNumber={n.num} className="fo-doc fo-word-note" /></div> : null;
          })}
        </div>
        {layout.lineNumbers.filter((l) => l.page === i).map((l) => (
          <span key={`${l.page}-${l.n}`} className="fo-word-lineno" style={{ top: b.marginTop + l.y, left: b.marginLeft - 36 }}>{l.n}</span>
        ))}
      </div>
    );
  };

  const bodyStyle: CSSProperties = print
    ? multi
      ? { ...wrapVars, top: px(frame.margins.top), left: 0, width: maxW, ...cols }
      : { ...wrapVars, top: px(frame.margins.top), left: px(frame.margins.left), width: px(frame.pageWidth - frame.margins.left - frame.margins.right), ...cols }
    : cols;
  return (
    <div
      className={`fo-word-pages fo-view-${ui.view}${ui.grid ? ' has-grid' : ''}`}
      style={print ? { width: maxW, height: totalH, zoom: ui.zoom / 100 } : { zoom: ui.zoom / 100, ...(ui.view === 'web' ? {} : { maxWidth: px(frame.pageWidth) }) }}
    >
      {print && sheets.map((sheet, i) => (!range || i < KEEP_FIRST || (i >= from && i <= to) ? sheetEl(sheet, i) : null))}
      <div className={`fo-word-body${colWrap ? ' has-colwrap' : ''}`} style={bodyStyle}>
        <div ref={mountRef} className="fo-word-mount" />
        {print && layout.endnotes.length > 0 && (
          <div className="fo-word-endnotes" style={{ marginTop: layout.tailGap, ...(multi ? { marginLeft: (maxW - lastBox.pageW) / 2 + lastBox.marginLeft, marginRight: (maxW - lastBox.pageW) / 2 + lastBox.marginRight } : {}) }}>
            {layout.endnotes.map((id, k) => {
              const note = meta.endnotes.find((f) => f.id === id);
              return note ? <StaticBlocks key={id} schema={schema} blocks={note.blocks} noteNumber={formatNumber(k + 1, 'lowerRoman')} className="fo-doc fo-word-note" /> : null;
            })}
          </div>
        )}
      </div>
      {overlay}
    </div>
  );
}
