// Onglet Insertion : diapositives, tableau, images, icones, formes, graphique, lien, commentaire, texte, symboles, medias.
import type { MenuItem, RibbonTab } from '@forgeoffice/ui';
import { insertChart, insertField, insertSymbol, insertMedia, insertPicture, insertTable, insertWordArt, WORDART } from '../insert.ts';
import { cssColor } from '@forgeoffice/pptx';
import { LayoutsButton, ShapesButton, TableGrid } from './galleries.tsx';
import { PopupGallery, GalleryGrid } from './PopupGallery.tsx';
import type { TabContext } from './common.tsx';
import { runStyle } from '../../canvas/render/TextBlock.tsx';
import { S } from '../../strings.ts';

const SYMBOLS = ['©', '®', '™', '€', '£', '¥', '°', '±', '×', '÷', '≤', '≥', '≠', '≈', '∞', '√', 'π', 'Ω', 'µ', '§', '¶', '•', '…', '«', '»', '→', '←', '↑', '↓', '✓', '★', '♥'];

export function insertTab(ctx: TabContext): RibbonTab {
  const { ed, app } = ctx;
  const chartItems: MenuItem[] = [
    { id: 'col', label: S.insert.charts.column, icon: 'data_bar_vertical', onClick: () => insertChart(ed, 'bar', { barDirection: 'col' }) },
    { id: 'colStack', label: S.insert.charts.columnStacked, icon: 'data_bar_vertical', onClick: () => insertChart(ed, 'bar', { barDirection: 'col', grouping: 'stacked' }) },
    { id: 'bar', label: S.insert.charts.bar, icon: 'data_histogram', onClick: () => insertChart(ed, 'bar', { barDirection: 'bar' }) },
    { id: 'line', label: S.insert.charts.line, icon: 'data_line', onClick: () => insertChart(ed, 'line') },
    { id: 'pie', label: S.insert.charts.pie, icon: 'data_pie', onClick: () => insertChart(ed, 'pie') },
    { id: 'doughnut', label: S.insert.charts.doughnut, icon: 'data_pie', onClick: () => insertChart(ed, 'doughnut') },
    { id: 'area', label: S.insert.charts.area, icon: 'data_area', onClick: () => insertChart(ed, 'area') },
    { id: 'scatter', label: S.insert.charts.scatter, icon: 'data_scatter', onClick: () => insertChart(ed, 'scatter') },
    { id: 'bubble', label: S.insert.charts.bubble, icon: 'data_scatter', onClick: () => insertChart(ed, 'bubble') },
    { id: 'radar', label: S.insert.charts.radar, icon: 'data_trending', onClick: () => insertChart(ed, 'radar') },
  ];
  return {
    id: 'insert',
    label: S.tabs.insert,
    keytip: 'N',
    groups: [
      { id: 'slides', label: S.home.slides, icon: 'slide_add', controls: [{ kind: 'custom', id: 'newSlide', label: S.slides.newSlide, render: () => <LayoutsButton ctx={ctx} mode="new" /> }] },
      {
        id: 'tables', label: S.insert.tables, icon: 'table',
        controls: [
          {
            kind: 'custom', id: 'table', label: S.insert.table,
            render: () => (
              <PopupGallery label={S.insert.table} icon="table" tooltip={S.insert.tableTip}>
                {(close) => (
                  <TableGrid
                    onPick={(r, c) => {
                      close();
                      insertTable(ed, r, c);
                    }}
                    onMore={() => {
                      close();
                      app.dialog('table');
                    }}
                  />
                )}
              </PopupGallery>
            ),
          },
        ],
      },
      {
        id: 'images', label: S.insert.images, icon: 'image',
        controls: [
          { kind: 'button', id: 'picture', label: S.insert.pictures, icon: 'image_add', size: 'large', tooltip: { title: S.insert.pictures, description: S.insert.picturesTip }, onClick: () => void insertPicture(ed) },
        ],
      },
      {
        id: 'illustrations', label: S.insert.illustrations, icon: 'shapes',
        controls: [
          { kind: 'custom', id: 'shapes', label: S.insert.shapes, render: () => <ShapesButton ctx={ctx} /> },
          { kind: 'button', id: 'icons', label: S.insert.icons, icon: 'emoji', size: 'large', tooltip: { title: S.insert.icons, description: S.insert.iconsTip }, onClick: () => app.dialog('icons') },
          { kind: 'menu', id: 'chart', label: S.insert.chart, icon: 'data_bar_vertical', size: 'large', items: chartItems },
        ],
      },
      {
        id: 'links', label: S.insert.links, icon: 'link',
        controls: [{ kind: 'button', id: 'link', label: S.insert.link, icon: 'link', size: 'large', tooltip: { title: S.insert.link, shortcut: 'Ctrl+K' }, disabled: !ed.selection.ids.length && !ed.selection.text, onClick: () => app.dialog('link') }],
      },
      {
        id: 'comments', label: S.review.comments, icon: 'comment_add',
        controls: [{ kind: 'button', id: 'comment', label: S.review.newComment, icon: 'comment_add', size: 'large', onClick: () => app.dialog('comment') }],
      },
      {
        id: 'text', label: S.insert.text, icon: 'textbox',
        controls: [
          { kind: 'button', id: 'textbox', label: S.insert.textBox, icon: 'textbox', size: 'large', tooltip: { title: S.insert.textBox, description: S.insert.textBoxTip }, onClick: () => ed.setUi({ tool: { kind: 'textbox' } }) },
          { kind: 'button', id: 'hf', label: S.headerFooter.title, icon: 'document_header_footer', size: 'large', onClick: () => app.dialog('headerFooter') },
          { kind: 'button', id: 'date', label: S.insert.date, icon: 'calendar_date', size: 'small', onClick: () => insertField(ed, 'datetime1') },
          { kind: 'button', id: 'number', label: S.insert.slideNumber, icon: 'number_symbol', size: 'small', onClick: () => (ed.selection.text ? insertField(ed, 'slidenum') : app.dialog('headerFooter')) },
          { kind: 'button', id: 'vtext', label: S.insert.verticalText, icon: 'text_direction_vertical', size: 'small', onClick: () => ed.setUi({ tool: { kind: 'textbox', vertical: true } }) },
          {
            kind: 'custom', id: 'wordart', label: S.insert.wordArt,
            render: () => (
              <PopupGallery label={S.insert.wordArt} icon="text_effects" tooltip={S.insert.wordArtTip}>
                {(close) => (
                  <GalleryGrid
                    columns={3}
                    sections={[{ items: WORDART.map((w) => ({ id: w.id, label: S.insert.wordArt, render: <span style={{ ...runStyle({ ...w.props, size: 26, bold: true }, ed.ctx), display: 'inline-block', width: 56, fontSize: 26, color: w.props.color ? cssColor(w.props.color, ed.ctx.theme, ed.ctx.colorMap) : undefined }}>A</span> })) }]}
                    onPick={(id) => {
                      close();
                      insertWordArt(ed, id);
                    }}
                  />
                )}
              </PopupGallery>
            ),
          },
        ],
      },
      {
        id: 'symbols', label: S.insert.symbols, icon: 'symbols',
        controls: [
          {
            kind: 'menu', id: 'symbol', label: S.insert.symbol, icon: 'symbols', size: 'large', disabled: !ed.selection.text,
            items: SYMBOLS.map((ch) => ({ id: ch, label: ch, onClick: () => insertSymbol(ed, ch) })),
          },
        ],
      },
      {
        id: 'media', label: S.insert.media, icon: 'video',
        controls: [
          { kind: 'button', id: 'video', label: S.insert.video, icon: 'video', size: 'large', onClick: () => void insertMedia(ed, 'video') },
          { kind: 'button', id: 'audio', label: S.insert.audio, icon: 'speaker_2', size: 'large', onClick: () => void insertMedia(ed, 'audio') },
        ],
      },
    ],
  };
}
