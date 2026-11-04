// Onglet Insertion : Pages, Tableaux, Illustrations (images, formes, icones), Blocs de construction, Texte (zone de texte,
// WordArt, en-tete, pied de page, numero de page, date), Liens.
import type { GalleryItem, MenuItem, RibbonTab } from '@forgeoffice/ui';
import { addText, MASTER_SHAPE_BASE, pageNumberParagraph, para, sc } from '../../build.ts';
import { blockCatalog, type BlockGroup } from '../../blocks.ts';
import { marginBox } from '../../guides.ts';
import { S } from '../../strings.ts';
import { editPageShapes } from '../editor.ts';
import { addPages, duplicateCurrentPage, insertPicture, insertTextAtCaret, insertTextBox, insertWordArt, WORDART } from '../ops.ts';
import { shapeMenu, type TabContext } from './common.tsx';

const BLOCK_GROUPS: ReadonlyArray<{ group: BlockGroup; label: string; icon: 'text_header_1' | 'text_quote' | 'ticket_diagonal' | 'calendar_month' | 'border_outside' }> = [
  { group: 'headings', label: S.cmd.headings, icon: 'text_header_1' },
  { group: 'sidebars', label: S.cmd.sidebars, icon: 'text_quote' },
  { group: 'coupons', label: S.cmd.coupons, icon: 'ticket_diagonal' },
  { group: 'calendars', label: S.cmd.calendars, icon: 'calendar_month' },
  { group: 'accents', label: S.cmd.accents, icon: 'border_outside' },
];

/** Insere un bloc au centre de la zone de marges de la page active. */
export function insertBlock(ctx: TabContext, id: string): void {
  const { ed } = ctx;
  const now = new Date();
  const block = blockCatalog(S.insert.sample, now.getFullYear(), now.getMonth()).find((b) => b.id === id);
  if (!block) return;
  const area = marginBox(ed.deck.size, ed.pub, ed.pageIndex);
  const k = Math.min(1, area.width / block.width, area.height / block.height);
  const w = block.width * k;
  const h = block.height * k;
  let ids: number[] = [];
  ed.editShapes((shapes) => {
    ids = block.build(shapes, { x: area.x + (area.width - w) / 2, y: area.y + (area.height - h) / 2, width: w, height: h }, ed.ref.kind === 'master' ? MASTER_SHAPE_BASE : 2);
  }, 'insert');
  ed.setSelection({ ids });
}

/** En-tete, pied de page ou numero de page : places sur la page maitre de la page active (toutes ses pages). */
function insertOnMaster(ctx: TabContext, what: 'header' | 'footer' | 'pageNumber'): void {
  const { ed } = ctx;
  const layoutId = ed.page?.layoutId ?? ed.deck.masters[0]?.layouts[0]?.id;
  if (!layoutId) return;
  const { width: W, height: H } = ed.deck.size;
  const m = ed.pub.margins;
  const deck = editPageShapes(ed.deck, { kind: 'master', layoutId }, (shapes) => {
    const run = { size: 9, color: sc('tx2'), font: '+mn-lt' };
    if (what === 'header') addText(shapes, [m.inside, Math.max(6, m.top / 2 - 10), W - m.inside - m.outside, 20], [para(S.insert.headerText, run, { align: 'ctr' })], {}, { minId: MASTER_SHAPE_BASE, name: S.insert.header });
    else if (what === 'footer') addText(shapes, [m.inside, H - Math.max(26, m.bottom / 2 + 10), W - m.inside - m.outside, 20], [para(S.insert.footerText, run, { align: 'l' })], {}, { minId: MASTER_SHAPE_BASE, name: S.insert.footer });
    else addText(shapes, [W - m.outside - 60, H - Math.max(26, m.bottom / 2 + 10), 60, 20], [pageNumberParagraph(run, { align: 'r' })], {}, { minId: MASTER_SHAPE_BASE, name: S.cmd.pageNumber });
  });
  ed.commitDeck(deck, 'master');
  ed.setUi({ view: 'master', masterId: layoutId });
}

export function insertTab(ctx: TabContext): RibbonTab {
  const { ed, app } = ctx;
  const now = new Date();
  const blocks = blockCatalog(S.insert.sample, now.getFullYear(), now.getMonth());
  const wordart: GalleryItem[] = WORDART.map((w) => ({ id: w.id, label: S.wordartNames[w.id] ?? w.id, sample: 'A', style: { fontSize: 22, fontWeight: 700, fontFamily: 'Georgia, serif', color: w.id === 'outline' ? 'transparent' : 'var(--pub-accent)', WebkitTextStroke: w.id === 'outline' ? '1px var(--pub-accent)' : undefined, textShadow: w.id === 'accent' ? '1px 1px 2px rgba(0,0,0,.35)' : w.id === 'glow' ? '0 0 6px var(--pub-accent2)' : undefined } }));
  const pageItems: MenuItem[] = [
    { id: 'blank', label: S.cmd.insertPage, icon: 'document_add', onClick: () => addPages(ed, 1) },
    { id: 'dup', label: S.cmd.duplicatePage, icon: 'copy', onClick: () => duplicateCurrentPage(ed) },
    { id: 'many', label: S.cmd.insertPages, icon: 'document_multiple', onClick: () => ed.setUi({ dialog: 'insertPages' }) },
  ];
  return {
    id: 'insert',
    label: S.tabs.insert,
    keytip: 'N',
    groups: [
      { id: 'pages', label: S.groups.pages, icon: 'document_add', controls: [{ kind: 'split', id: 'page', label: S.cmd.page, icon: 'document_add', size: 'large', onClick: () => addPages(ed, 1), items: pageItems }] },
      { id: 'tables', label: S.groups.tables, icon: 'table', controls: [{ kind: 'button', id: 'table', label: S.cmd.table, icon: 'table', size: 'large', onClick: () => ed.setUi({ dialog: 'table' }) }] },
      {
        id: 'illustrations', label: S.groups.illustrations, icon: 'image', controls: [
          { kind: 'button', id: 'picture', label: S.cmd.picture, icon: 'image', size: 'large', onClick: () => void insertPicture(ed) },
          { kind: 'menu', id: 'shapes', label: S.cmd.shapes, icon: 'shapes', size: 'large', items: shapeMenu(app) },
          { kind: 'button', id: 'icons', label: S.cmd.icons, icon: 'emoji', size: 'large', onClick: () => ed.setUi({ dialog: 'icons' }) },
        ],
      },
      {
        id: 'blocks', label: S.groups.blocks, icon: 'book_template', controls: BLOCK_GROUPS.map((g) => ({
          kind: 'menu' as const, id: `b-${g.group}`, label: g.label, icon: g.icon, size: 'large' as const,
          items: blocks.filter((b) => b.group === g.group).map((b) => ({ id: b.id, label: S.blocks[b.id] ?? b.id, onClick: () => insertBlock(ctx, b.id) })),
        })),
      },
      {
        id: 'text', label: S.groups.text, icon: 'textbox', controls: [
          { kind: 'button', id: 'textbox', label: S.cmd.textBox, icon: 'textbox', size: 'large', onClick: () => ed.setUi({ tool: { kind: 'textbox' } }) },
          { kind: 'gallery', id: 'wordart', label: S.cmd.wordart, icon: 'text_effects', itemWidth: 44, columns: 6, items: wordart, onSelect: (id) => insertWordArt(ed, id) },
          { kind: 'button', id: 'dateTime', label: S.cmd.dateTime, icon: 'calendar_date', onClick: () => insertTextAtCaret(ed, now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })) },
          { kind: 'button', id: 'emptyBox', label: S.cmd.textBox, icon: 'textbox_align_top', hidden: true, onClick: () => insertTextBox(ed) },
        ],
      },
      {
        id: 'headerFooter', label: S.groups.headerFooter, icon: 'document_header_footer', controls: [
          { kind: 'button', id: 'header', label: S.cmd.header, icon: 'document_header', onClick: () => insertOnMaster(ctx, 'header') },
          { kind: 'button', id: 'footer', label: S.cmd.footer, icon: 'document_footer', onClick: () => insertOnMaster(ctx, 'footer') },
          { kind: 'button', id: 'pageNumber', label: S.cmd.pageNumber, icon: 'document_page_number', onClick: () => insertOnMaster(ctx, 'pageNumber') },
        ],
      },
      { id: 'links', label: S.groups.links, icon: 'link', controls: [{ kind: 'button', id: 'link', label: S.cmd.link, icon: 'link', size: 'large', disabled: !ed.selection.ids.length && !ed.selection.text, onClick: () => ed.setUi({ dialog: 'link' }) }] },
    ],
  };
}
