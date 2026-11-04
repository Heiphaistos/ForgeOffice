// Onglets Insertion et Dessin.
import { useState } from 'react';
import { Icon, Popover, type MenuItem, type RibbonTab } from '@forgeoffice/ui';
import type { ShapeInline } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import type { Ctl, Pen } from '../app/types.ts';
import { insertInline, insertPageBreak } from '../editor/commands.ts';

const GRID_ROWS = 8;
const GRID_COLS = 10;

/** Grille de selection « Tableau » (survol = dimensions, clic = insertion). */
function TableGridButton({ onPick, onMore }: { onPick: (rows: number, cols: number) => void; onMore: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [hover, setHover] = useState<[number, number]>([0, 0]);
  return (
    <>
      <button type="button" className="fo-word-ribbtn" aria-haspopup="dialog" aria-expanded={!!anchor} onClick={(e) => setAnchor(anchor ? null : e.currentTarget)} title={T.tips.table}>
        <Icon name="table" size={24} />
        <span>{T.cmd.table}</span>
        <Icon name="chevron_down" size={12} />
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} label={T.cmd.table} className="fo-word-tablegrid">
          <div className="fo-word-tablegrid__title">{hover[0] ? T.dialogs.tableSize(hover[0], hover[1]) : T.cmd.insertTable}</div>
          <div className="fo-word-tablegrid__cells" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 18px)` }} onMouseLeave={() => setHover([0, 0])}>
            {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
              const r = Math.floor(i / GRID_COLS) + 1;
              const c = (i % GRID_COLS) + 1;
              return (
                <button
                  type="button" key={i} aria-label={T.dialogs.tableSize(r, c)}
                  className={r <= hover[0] && c <= hover[1] ? 'is-on' : ''}
                  onMouseEnter={() => setHover([r, c])} onFocus={() => setHover([r, c])}
                  onClick={() => { setAnchor(null); onPick(r, c); }}
                />
              );
            })}
          </div>
          <button type="button" className="fo-word-tablegrid__more" onClick={() => { setAnchor(null); onMore(); }}>{T.cmd.insertTable}</button>
        </Popover>
      )}
    </>
  );
}

const shape = (geometry: string, w: number, h: number, text?: string): ShapeInline => ({
  type: 'shape', geometry, width: w, height: h, fill: text ? 'FFFFFF' : 'DAE9F7', line: { color: '156082', width: 1 },
  text: text ? [{ type: 'paragraph', props: {}, inlines: [{ type: 'text', text, props: {} }] }] : undefined,
});

const POS = { left: T.cmd.posLeft, center: T.cmd.posCenter, right: T.cmd.posRight } as const;

const SYMBOLS = ['€', '£', '¥', '©', '®', '™', '±', '≠', '≤', '≥', '÷', '×', '∞', 'µ', 'α', 'β', 'π', 'Ω', '∑', '√', '°', '§', '¶', '…', '«', '»', '—', '–', '•', '→'];

export function insertTab(c: Ctl): RibbonTab {
  const cmd = T.cmd;
  const { act } = c;
  const hf = (kind: 'header' | 'footer'): MenuItem[] => [
    { id: 'blank', label: T.headerFooter.blank, onClick: () => act.editHeaderFooter(kind, 'blank') },
    { id: 'three', label: T.headerFooter.blankThree, onClick: () => act.editHeaderFooter(kind, 'three') },
    { id: 'title', label: T.headerFooter.title, onClick: () => act.editHeaderFooter(kind, 'title') },
    { id: 'date', label: T.headerFooter.dateRight, onClick: () => act.editHeaderFooter(kind, 'date') },
    { id: 's', kind: 'separator' },
    { id: 'edit', label: kind === 'header' ? cmd.editHeader : cmd.editFooter, onClick: () => act.editHeaderFooter(kind) },
    { id: 'remove', label: kind === 'header' ? cmd.removeHeader : cmd.removeFooter, icon: 'delete', onClick: () => act.removeHeaderFooter(kind) },
  ];
  const pageNum: MenuItem[] = [
    { id: 'top', label: cmd.pageNumTop, items: (['left', 'center', 'right'] as const).map((a) => ({ id: `t${a}`, label: POS[a], onClick: () => act.pageNumbers('header', a) })) },
    { id: 'bottom', label: cmd.pageNumBottom, items: (['left', 'center', 'right'] as const).map((a) => ({ id: `b${a}`, label: POS[a], onClick: () => act.pageNumbers('footer', a) })) },
    { id: 'total', label: cmd.pageNumOfTotal, onClick: () => act.pageNumbers('footer', 'right', true) },
    { id: 's', kind: 'separator' },
    { id: 'remove', label: cmd.removePageNumbers, icon: 'delete', onClick: () => act.removeHeaderFooter('footer') },
  ];
  return {
    id: 'insert', label: T.tabs.insert, keytip: 'N',
    groups: [
      {
        id: 'pages', label: T.groups.pages, icon: 'document',
        controls: [
          { kind: 'button', id: 'cover', label: cmd.coverPage, icon: 'document_text', onClick: act.insertCover, size: 'large' },
          { kind: 'button', id: 'blank', label: cmd.blankPage, icon: 'document_add', onClick: act.insertBlankPage },
          { kind: 'button', id: 'break', label: cmd.pageBreak, icon: 'document_page_break', onClick: () => c.run(insertPageBreak), tooltip: { title: cmd.pageBreak, shortcut: 'Ctrl+Entrée', description: T.tips.pageBreak } },
        ],
      },
      {
        id: 'tables', label: T.groups.tables, icon: 'table',
        controls: [{ kind: 'custom', id: 'table', label: cmd.table, keywords: ['tableau', 'grille'], render: () => <TableGridButton onPick={act.insertTable} onMore={() => c.openDialog('table')} /> }],
      },
      {
        id: 'illustrations', label: T.groups.illustrations, icon: 'image',
        controls: [
          { kind: 'button', id: 'picture', label: cmd.pictures, icon: 'image_add', size: 'large', onClick: () => void act.insertImage() },
          { kind: 'menu', id: 'shapes', label: cmd.shapes, icon: 'shapes', size: 'large', items: [
            { id: 'rect', label: T.dialogs.shapeRect, icon: 'square', onClick: () => c.run(insertInline(shape('rect', 96, 60))) },
            { id: 'round', label: T.dialogs.shapeRound, icon: 'square', onClick: () => c.run(insertInline(shape('roundRect', 96, 60))) },
            { id: 'ellipse', label: T.dialogs.shapeEllipse, icon: 'circle', onClick: () => c.run(insertInline(shape('ellipse', 80, 80))) },
            { id: 'line', label: T.dialogs.shapeLine, icon: 'subtract', onClick: () => c.run(insertInline({ ...shape('line', 160, 1), fill: '156082' })) },
          ] },
        ],
      },
      {
        id: 'links', label: T.groups.links, icon: 'link',
        controls: [
          { kind: 'button', id: 'link', label: cmd.link, icon: 'link', size: 'large', onClick: () => c.openDialog('link'), tooltip: { title: cmd.link, shortcut: 'Ctrl+K' } },
          { kind: 'button', id: 'bookmark', label: cmd.bookmark, icon: 'bookmark', onClick: () => c.openDialog('bookmark') },
          { kind: 'button', id: 'crossref', label: cmd.crossRef, icon: 'link_square', onClick: () => c.openDialog('crossref') },
        ],
      },
      {
        id: 'comments', label: T.groups.comments, icon: 'comment',
        controls: [{ kind: 'button', id: 'comment', label: cmd.comment, icon: 'comment_add', size: 'large', onClick: act.insertComment, tooltip: { title: cmd.newComment, shortcut: 'Ctrl+Alt+M' } }],
      },
      {
        id: 'hf', label: T.groups.headerFooter, icon: 'document_header_footer',
        controls: [
          { kind: 'menu', id: 'header', label: cmd.header, icon: 'document_header', items: hf('header') },
          { kind: 'menu', id: 'footer', label: cmd.footer, icon: 'document_footer', items: hf('footer') },
          { kind: 'menu', id: 'pagenum', label: cmd.pageNumber, icon: 'document_page_number', items: pageNum },
        ],
      },
      {
        id: 'text', label: T.groups.text, icon: 'textbox',
        controls: [
          { kind: 'button', id: 'textbox', label: cmd.textBox, icon: 'textbox', size: 'large', onClick: () => c.run(insertInline(shape('rect', 160, 72, cmd.textBox))) },
          { kind: 'button', id: 'date', label: cmd.date, icon: 'calendar_date', onClick: () => c.openDialog('date') },
          { kind: 'button', id: 'field', label: cmd.insertField, icon: 'text_field', onClick: () => c.openDialog('field') },
        ],
      },
      {
        id: 'symbols', label: T.groups.symbols, icon: 'math_symbols',
        controls: [
          { kind: 'button', id: 'equation', label: cmd.equation, icon: 'math_formula', onClick: () => c.openDialog('equation') },
          { kind: 'menu', id: 'symbol', label: cmd.symbol, icon: 'symbols', items: [
            ...SYMBOLS.map((s): MenuItem => ({ id: `sym${s}`, label: s, onClick: () => c.run((st, d) => { if (d) d(st.tr.insertText(s)); return true; }) })),
            { id: 's', kind: 'separator' },
            { id: 'more', label: cmd.moreSymbols, onClick: () => c.openDialog('symbol') },
          ] },
        ],
      },
    ],
  };
}

const PENS: { id: string; label: string; pen: Pen }[] = [
  { id: 'black', label: `${T.cmd.pen} ${T.draw.black.toLowerCase()}`, pen: { color: '#000000', width: 2, highlighter: false } },
  { id: 'red', label: `${T.cmd.pen} ${T.draw.red.toLowerCase()}`, pen: { color: '#C00000', width: 2, highlighter: false } },
  { id: 'blue', label: `${T.cmd.pen} ${T.draw.blue.toLowerCase()}`, pen: { color: '#185ABD', width: 2, highlighter: false } },
  { id: 'green', label: `${T.cmd.pen} ${T.draw.green.toLowerCase()}`, pen: { color: '#107C41', width: 3, highlighter: false } },
  { id: 'hl', label: T.cmd.highlighter, pen: { color: '#FFE600', width: 14, highlighter: true } },
];

export function drawTab(c: Ctl): RibbonTab {
  return {
    id: 'draw', label: T.tabs.draw, keytip: 'JI',
    groups: [
      {
        id: 'pens', label: T.groups.pens, icon: 'pen',
        controls: PENS.map((p) => ({
          kind: 'toggle' as const, id: `pen-${p.id}`, label: p.label, icon: p.pen.highlighter ? 'highlight' as const : 'pen' as const, size: 'large' as const,
          pressed: c.ui.pen.color === p.pen.color, onToggle: () => {
            c.setUi({ pen: p.pen });
            c.openDialog('ink');
          },
        })),
      },
      {
        id: 'tools', label: T.groups.tools, icon: 'ink_stroke',
        controls: [{ kind: 'button', id: 'drawmode', label: T.cmd.drawMode, icon: 'ink_stroke', size: 'large', onClick: () => c.openDialog('ink') }],
      },
    ],
  };
}
