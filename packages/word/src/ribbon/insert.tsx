// Onglets Insertion et Dessin.
import { useState } from 'react';
import { Icon, isOnlyOffice, Popover, type MenuItem, type RibbonTab } from '@forgeoffice/ui';
import type { ShapeInline } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl, Pen } from '../app/types.ts';
import { insertInline, insertPageBreak } from '../editor/commands.ts';
import { GEOMETRIES, GROUP_LABEL, svgPoints } from '../objects/geometry.ts';

/** Glyphe 20 x 20 d'une forme (grille « Forme » du profil OnlyOffice). */
function ShapeGlyph({ id }: { id: string }) {
  const pts = svgPoints(id);
  return (
    <svg viewBox="0 0 100 100" width={20} height={20} aria-hidden fill="none" stroke="currentColor" strokeWidth={7} strokeLinejoin="round">
      {pts ? <polygon points={pts} /> : id === 'ellipse' ? <ellipse cx={50} cy={50} rx={45} ry={45} /> : id === 'line' ? <line x1={5} y1={95} x2={95} y2={5} /> : <rect x={5} y={15} width={90} height={70} rx={id === 'roundRect' ? 16 : 0} />}
    </svg>
  );
}

const OO_SHAPE_SECTIONS: readonly (readonly [string, readonly string[]])[] = [
  ['Formes de base', ['rect', 'roundRect', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon']],
  ['Flèches figurées', ['rightArrow', 'leftArrow', 'upArrow', 'downArrow']],
  ['Étoiles et rubans', ['star4', 'star5']],
  ['Légendes', ['wedgeRectCallout', 'wedgeRoundRectCallout']],
  ['Lignes', ['line']],
];

const GRID_ROWS = 8;
const GRID_COLS = 10;

/** Grille de selection « Tableau » (survol = dimensions, clic = insertion). */
function TableGridButton({ onPick, onMore, onConvert }: { onPick: (rows: number, cols: number) => void; onMore: () => void; onConvert: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [hover, setHover] = useState<[number, number]>([0, 0]);
  const oo = isOnlyOffice();
  return (
    <>
      <button type="button" className="fo-word-ribbtn" aria-haspopup="dialog" aria-expanded={!!anchor} onClick={(e) => setAnchor(anchor ? null : e.currentTarget)} title={T.tips.table}>
        <Icon name="table" size={24} />
        <span>{T.cmd.table}</span>
        <Icon name="chevron_down" size={12} />
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} label={T.cmd.table} className="fo-word-tablegrid">
          <div className="fo-word-tablegrid__title">{oo ? `${hover[1]} x ${hover[0]}` : hover[0] ? T.dialogs.tableSize(hover[0], hover[1]) : T.cmd.insertTable}</div>
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
          {oo ? (
            <>
              <button type="button" className="fo-word-tablegrid__more" onClick={() => { setAnchor(null); onMore(); }}>Insérer un tableau personnalisé</button>
              <button type="button" className="fo-word-tablegrid__more" disabled title="Pas encore disponible dans ForgeOffice">Dessiner un tableau</button>
              <button type="button" className="fo-word-tablegrid__more" disabled title="Pas encore disponible dans ForgeOffice">Effacer le tableau</button>
              <button type="button" className="fo-word-tablegrid__more" onClick={() => { setAnchor(null); onConvert(); }}>Convertir un texte en tableau</button>
              <button type="button" className="fo-word-tablegrid__more" disabled title="Pas encore disponible dans ForgeOffice">Insérer une feuille de calcul</button>
            </>
          ) : (
            <>
              <button type="button" className="fo-word-tablegrid__more" onClick={() => { setAnchor(null); onMore(); }}>{T.cmd.insertTable}</button>
              <button type="button" className="fo-word-tablegrid__more" onClick={() => { setAnchor(null); onConvert(); }}>{X.tableCmd.textToTable}</button>
            </>
          )}
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

/** Caracteres speciaux (espaces insecables, traits d'union, marques de direction) : memes noms que la suite imitee. */
const SPECIAL: ReadonlyArray<readonly [string, string, string]> = [
  ['nbsp', 'Espace insécable', ' '], ['nnbsp', 'Espace fine insécable', ' '], ['softhy', "Trait d'union conditionnel", '­'], ['hardhy', "Trait d'union insécable", '‑'],
  ['zwsp', 'Espace sans chasse', '​'], ['wj', 'Joint de mots', '⁠'], ['lrm', 'Marque gauche-droite', '‎'], ['rlm', 'Marque droite-gauche', '‏'],
];
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
    id: 'insert', label: T.tabs.insert, keytip: 'S',
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
        controls: [{ kind: 'custom', id: 'table', label: cmd.table, keywords: ['tableau', 'grille'], run: () => c.openDialog('table'), render: () => <TableGridButton onPick={act.insertTable} onMore={() => c.openDialog('table')} onConvert={() => c.openDialog('textToTable')} /> }],
      },
      {
        id: 'illustrations', label: T.groups.illustrations, icon: 'image',
        controls: [
          { kind: 'button', id: 'picture', label: cmd.pictures, icon: 'image_add', size: 'large', onClick: () => void act.insertImage() },
          { kind: 'menu', id: 'shapes', label: cmd.shapes, icon: 'shapes', size: 'large', items: isOnlyOffice() ? OO_SHAPE_SECTIONS.flatMap(([title, ids]): MenuItem[] => [
            { id: `h-${title}`, kind: 'header', label: title },
            ...ids.map((id): MenuItem => {
              const g = GEOMETRIES.find((x) => x.id === id)!;
              const dims: [number, number] = id === 'line' ? [160, 1] : g.group === 'arrows' || id === 'rect' || id === 'roundRect' ? [96, 60] : g.group === 'callouts' ? [80, 60] : [80, 80];
              return { id, label: g.label, cell: true, mini: true, adornment: <ShapeGlyph id={id} />, onClick: () => c.run(insertInline(id === 'line' ? { ...shape(id, 160, 1), fill: '156082' } : shape(id, dims[0], dims[1]))) };
            }),
          ]) : [
            { id: 'rect', label: T.dialogs.shapeRect, icon: 'square', onClick: () => c.run(insertInline(shape('rect', 96, 60))) },
            { id: 'round', label: T.dialogs.shapeRound, icon: 'square', onClick: () => c.run(insertInline(shape('roundRect', 96, 60))) },
            { id: 'ellipse', label: T.dialogs.shapeEllipse, icon: 'circle', onClick: () => c.run(insertInline(shape('ellipse', 80, 80))) },
            { id: 'line', label: T.dialogs.shapeLine, icon: 'subtract', onClick: () => c.run(insertInline({ ...shape('line', 160, 1), fill: '156082' })) },
            ...(['basic', 'arrows', 'stars', 'callouts'] as const).map((group): MenuItem => ({ id: `g-${group}`, label: GROUP_LABEL[group], items: GEOMETRIES.filter((g) => g.group === group && !['rect', 'roundRect', 'ellipse', 'line'].includes(g.id)).map((g): MenuItem => ({ id: g.id, label: g.label, onClick: () => c.run(insertInline(shape(g.id, g.group === 'arrows' ? 96 : 80, g.group === 'callouts' ? 60 : 80))) })) })).filter((m) => (m.items?.length ?? 0) > 0),
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
            { id: 'sp', kind: 'separator' },
            ...SPECIAL.map(([id, label, ch]): MenuItem => ({ id: `sym-${id}`, label, onClick: () => c.run((st, d) => { if (d) d(st.tr.insertText(ch)); return true; }) })),
            { id: 'sp-br', label: 'Saut de ligne', onClick: () => c.run(insertInline({ type: 'break', kind: 'line' })) },
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
