// Surface du document : feuilles de papier (mode Page), en-tetes/pieds, notes de bas de page, filigrane, bordures, numeros de ligne.
import type { CSSProperties, RefObject } from 'react';
import type { Schema } from 'prosemirror-model';
import { formatNumber, type Block, type HeaderFooterRefs, type WordDocument } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import type { UiState } from '../app/types.ts';
import { borderCss } from '../editor/css.ts';
import { pageColor, readWatermark } from '../features/design.ts';
import { MiniEditor, StaticBlocks } from './blocks.tsx';

export const PAGE_GAP = 16;
/** Pagination native des colonnes (CSS column-wrap) disponible dans ce moteur. */
export const COLUMN_WRAP = typeof CSS !== 'undefined' && CSS.supports('column-wrap', 'wrap') && CSS.supports('column-height', '1px');
export const px = (pt: number): number => (pt * 4) / 3;

export interface PageNote {
  page: number;
  noteId: number;
  num: string;
}

export interface Layout {
  pages: number;
  notes: PageNote[];
  lineNumbers: { page: number; y: number; n: number }[];
}

export interface HFEdit {
  kind: 'header' | 'footer';
  id: string;
  page: number;
}

export interface PageViewProps {
  schema: Schema;
  meta: WordDocument;
  ui: UiState;
  layout: Layout;
  gap: number;
  mountRef: RefObject<HTMLDivElement | null>;
  hfEdit: HFEdit | null;
  onEditHF: (edit: HFEdit | null) => void;
  onHFChange: (id: string, blocks: Block[]) => void;
}

function refFor(refs: HeaderFooterRefs, page: number, titlePage: boolean, evenOdd: boolean): string | undefined {
  if (page === 0 && titlePage) return refs.first;
  if (evenOdd && (page + 1) % 2 === 0) return refs.even ?? refs.default;
  return refs.default;
}

export function PageView({ schema, meta, ui, layout, gap, mountRef, hfEdit, onEditHF, onHFChange }: PageViewProps) {
  const s = meta.finalSection;
  const pageW = px(s.pageWidth);
  const pageH = px(s.pageHeight);
  const stride = pageH + gap;
  const print = ui.view === 'print';
  const wm = readWatermark(meta);
  const bg = pageColor(meta);
  const start = s.pageNumbering?.start ?? 1;
  const fmt = s.pageNumbering?.format ?? 'decimal';
  const pages = Math.max(1, layout.pages);
  const total = formatNumber(pages + start - 1, fmt);
  const cols = s.columns.count > 1 ? { columnCount: s.columns.count, columnGap: `${s.columns.space}pt`, columnRule: s.columns.separator ? '1px solid #808080' : undefined } : {};
  // Colonnes en mode Page : chaque rangee de colonnes = une page (CSS column-wrap, WebView2 / Chromium recents).
  const colWrap = print && s.columns.count > 1 && COLUMN_WRAP;
  const wrapVars = colWrap ? { '--fo-colh': `${px(s.pageHeight - s.margins.top - s.margins.bottom)}px`, '--fo-rowgap': `${px(s.margins.top + s.margins.bottom) + gap}px` } as CSSProperties : {};
  const pb = s.pageBorders;
  const borderInset = pb?.offsetFrom === 'text';

  const hf = (kind: 'header' | 'footer', page: number) => {
    const refs = kind === 'header' ? s.headers : s.footers;
    const id = refFor(refs, page, s.titlePage, meta.settings.evenAndOddHeaders);
    const part = id ? meta.headersFooters[id] : undefined;
    const editing = hfEdit && hfEdit.kind === kind && hfEdit.page === page && hfEdit.id === id;
    const style = kind === 'header'
      ? { top: px(s.margins.header), left: px(s.margins.left), width: pageW - px(s.margins.left + s.margins.right), minHeight: Math.max(16, px(s.margins.top - s.margins.header) - 8) }
      : { bottom: px(s.margins.footer), left: px(s.margins.left), width: pageW - px(s.margins.left + s.margins.right), minHeight: 16 };
    const label = kind === 'header' ? T.dialogs.headerTitle : T.dialogs.footerTitle;
    return (
      <div className={`fo-word-hf fo-word-hf--${kind}${editing ? ' is-editing' : ''}`} style={style} title={editing ? undefined : T.dialogs.editHeaderHint}
        onDoubleClick={() => !editing && (id ? onEditHF({ kind, id, page }) : onEditHF({ kind, id: '', page }))}>
        {editing && part ? (
          <>
            <span className="fo-word-hf__tag">{label}</span>
            <MiniEditor schema={schema} blocks={part.blocks} label={label} autoFocus className="fo-word-hf__editor" onChange={(blocks) => onHFChange(part.id, blocks)} onExit={() => onEditHF(null)} />
          </>
        ) : part ? (
          <StaticBlocks schema={schema} blocks={part.blocks} className="fo-doc fo-word-hf__static" tabGrid page={formatNumber(page + start, fmt)} pages={total} />
        ) : null}
      </div>
    );
  };

  return (
    <div
      className={`fo-word-pages fo-view-${ui.view}${ui.grid ? ' has-grid' : ''}`}
      style={print ? { width: pageW, height: pages * stride - gap, zoom: ui.zoom / 100 } : { zoom: ui.zoom / 100, ...(ui.view === 'web' ? {} : { maxWidth: pageW }) }}
    >
      {print && Array.from({ length: pages }, (_, i) => (
        <div key={i} className="fo-word-sheet" style={{ top: i * stride, width: pageW, height: pageH, background: bg ?? undefined }} data-page={i + 1}>
          {pb && (
            <div className="fo-word-sheet__border" style={{
              inset: borderInset ? `${px(s.margins.top - (pb.top?.space ?? 4))}px ${px(s.margins.right - (pb.right?.space ?? 4))}px ${px(s.margins.bottom - (pb.bottom?.space ?? 4))}px ${px(s.margins.left - (pb.left?.space ?? 4))}px` : `${px(pb.top?.space ?? 24)}px ${px(pb.right?.space ?? 24)}px ${px(pb.bottom?.space ?? 24)}px ${px(pb.left?.space ?? 24)}px`,
              borderTop: borderCss(pb.top) ?? undefined, borderBottom: borderCss(pb.bottom) ?? undefined, borderLeft: borderCss(pb.left) ?? undefined, borderRight: borderCss(pb.right) ?? undefined,
            }} />
          )}
          {wm && <div className={`fo-word-watermark${wm.diagonal ? ' is-diagonal' : ''}`} style={{ color: wm.color }} aria-hidden="true">{wm.text}</div>}
          {hf('header', i)}
          {hf('footer', i)}
          <div className="fo-word-notes" style={{ left: px(s.margins.left), width: pageW - px(s.margins.left + s.margins.right), top: pageH - px(s.margins.bottom) + 4, maxHeight: px(s.margins.bottom - s.margins.footer) - 22 }}>
            {layout.notes.filter((n) => n.page === i).map((n) => {
              const note = meta.footnotes.find((f) => f.id === n.noteId);
              return note ? <StaticBlocks key={n.noteId} schema={schema} blocks={note.blocks} noteNumber={n.num} className="fo-doc fo-word-note" /> : null;
            })}
          </div>
          {layout.lineNumbers.filter((l) => l.page === i).map((l) => (
            <span key={`${l.page}-${l.n}`} className="fo-word-lineno" style={{ top: px(s.margins.top) + l.y, left: px(s.margins.left) - 36 }}>{l.n}</span>
          ))}
        </div>
      ))}
      <div className={`fo-word-body${colWrap ? ' has-colwrap' : ''}`} style={print ? { ...wrapVars, top: px(s.margins.top), left: px(s.margins.left), width: pageW - px(s.margins.left + s.margins.right), ...cols } : cols}>
        <div ref={mountRef} className="fo-word-mount" />
      </div>
    </div>
  );
}
