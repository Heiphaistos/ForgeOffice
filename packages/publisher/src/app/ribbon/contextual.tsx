// Onglets contextuels : Format de zone de texte (liaison, alignement, ajustement, colonnes, lettrine), Format d'image,
// Format de forme, Tableau.
import type { MenuItem, RibbonControl, RibbonTab } from '@forgeoffice/ui';
import { emptyText, mergeCells, type Picture, type Shape, type TableShape } from '@forgeoffice/pptx';
import { deleteShapes, locate } from '@forgeoffice/powerpoint/canvas';
import { sc } from '../../build.ts';
import { chainOf, wrapOf } from '../../chain.ts';
import { shapeKey, WRAP_MODES } from '../../model.ts';
import { S } from '../../strings.ts';
import type { Editor } from '../editor.ts';
import { applyBody, breakLink, colorFromHex, currentBody, hexOf, insertPicture, selectedBox, setDropCap, setEffects, setFill, setLine, setWrap, themeSwatches } from '../ops.ts';
import { fitPicture } from '../picfit.ts';
import { arrangeMenus, shapeMenu, type TabContext } from './common.tsx';

const TEXT = '#077568';
const PICTURE = '#A4373A';
const DRAWING = '#C43E1C';
const TABLE = '#185ABD';

function wrapControl(ed: Editor): RibbonControl {
  const shape = ed.selectedShapes[0];
  const current = shape && ed.ref.kind === 'page' ? wrapOf(ed.pub, ed.ref.id, shape) : 'none';
  return {
    kind: 'menu', id: 'wrap', label: S.cmd.wrapText, icon: 'text_wrap', size: 'large', disabled: !shape || ed.ref.kind !== 'page',
    items: WRAP_MODES.map((m) => ({ id: m, label: S.cmd.wraps[m], checked: current === m, onClick: () => setWrap(ed, m) })),
  };
}

function sizeControls(ed: Editor): RibbonControl[] {
  const shape = ed.selectedShapes[0];
  const x = shape?.xfrm;
  const cm = (pt: number): number => Math.round((pt / 72) * 2.54 * 100) / 100;
  const setSize = (key: 'width' | 'height', v: number): void => ed.editSelected((s) => {
    if (!s.xfrm) return;
    const pt = (v / 2.54) * 72;
    if (s.kind === 'picture' && s.locks?.noChangeAspect) {
      const k = pt / s.xfrm[key];
      s.xfrm = { ...s.xfrm, width: s.xfrm.width * k, height: s.xfrm.height * k };
    } else s.xfrm = { ...s.xfrm, [key]: pt };
  }, 'size');
  return [
    { kind: 'number', id: 'h', label: S.cmd.height, value: x ? cm(x.height) : 0, min: 0.1, max: 140, step: 0.1, unit: S.dialogs.cm, width: 72, disabled: !x, onChange: (v) => setSize('height', v) },
    { kind: 'number', id: 'w', label: S.cmd.width, value: x ? cm(x.width) : 0, min: 0.1, max: 140, step: 0.1, unit: S.dialogs.cm, width: 72, disabled: !x, onChange: (v) => setSize('width', v) },
  ];
}

function arrangeGroup(ed: Editor) {
  const a = arrangeMenus(ed, false);
  return { id: 'arrange', label: S.groups.arrange, icon: 'layer' as const, controls: [wrapControl(ed), a.front, a.back, a.align, a.group, a.rotate] };
}

export function textFormatTab({ ed }: TabContext, visible: boolean): RibbonTab {
  const body = currentBody(ed);
  const box = selectedBox(ed);
  const chain = box ? chainOf(ed.pub, box) : undefined;
  const at = chain && box ? chain.boxes.findIndex((b) => b.page === box.page && b.shape === box.shape) : -1;
  const goto = (i: number): void => {
    const target = chain?.boxes[i];
    if (!target) return;
    const index = ed.deck.slides.findIndex((s) => s.id === target.page);
    if (index !== ed.pageIndex) ed.goto(index);
    ed.setSelection({ ids: [target.shape] });
  };
  const dropKey = box ? shapeKey(box.page, box.shape) : '';
  const dropItems: MenuItem[] = [
    { id: '0', label: S.cmd.dropCapNone, checked: !ed.pub.dropCaps[dropKey], onClick: () => setDropCap(ed, null) },
    ...[2, 3, 4].map((n) => ({ id: String(n), label: S.cmd.dropCapLines(n), checked: ed.pub.dropCaps[dropKey] === n, onClick: () => setDropCap(ed, n) })),
  ];
  const fit = body.autofit?.type ?? 'none';
  return {
    id: 'textFormat',
    label: S.tabs.textFormat,
    hidden: !visible,
    contextual: { set: S.tabs.textSet, color: TEXT },
    groups: [
      {
        id: 'linking', label: S.groups.linking, icon: 'link', controls: [
          { kind: 'button', id: 'link', label: S.cmd.linkBox, icon: 'link_add', size: 'large', disabled: !box || (!!chain && at !== chain.boxes.length - 1), tooltip: { title: S.cmd.linkBox, description: S.status.linking }, onClick: () => box && ed.setUi({ linking: box }) },
          { kind: 'button', id: 'unlink', label: S.cmd.unlinkBox, icon: 'link_dismiss', disabled: !chain || at === chain.boxes.length - 1, onClick: () => breakLink(ed) },
          { kind: 'button', id: 'prev', label: S.cmd.prevBox, icon: 'arrow_previous', disabled: !chain || at <= 0, onClick: () => goto(at - 1) },
          { kind: 'button', id: 'next', label: S.cmd.nextBox, icon: 'arrow_next', disabled: !chain || at < 0 || at >= chain.boxes.length - 1, onClick: () => goto(at + 1) },
        ],
      },
      {
        id: 'alignment', label: S.groups.alignment, icon: 'textbox_align_middle', controls: [
          {
            kind: 'menu', id: 'anchor', label: S.cmd.alignText, icon: 'textbox_align_middle', size: 'large', items: (['t', 'ctr', 'b'] as const).map((a) => ({
              id: a, label: S.anchorNames[a], icon: a === 't' ? ('textbox_align_top' as const) : a === 'ctr' ? ('textbox_align_middle' as const) : ('textbox_align_bottom' as const), checked: (body.anchor ?? 't') === a, onClick: () => applyBody(ed, { anchor: a }),
            })),
          },
          { kind: 'button', id: 'margins', label: S.cmd.margins2, icon: 'document_margins', onClick: () => ed.setUi({ dialog: 'textBox' }) },
        ],
      },
      {
        id: 'text', label: S.groups.text, icon: 'textbox', controls: [
          {
            kind: 'menu', id: 'fit', label: S.cmd.textFit, icon: 'arrow_fit', size: 'large', items: [
              { id: 'shrink', label: S.cmd.fitShrink, checked: fit === 'normal', disabled: !!chain, onClick: () => applyBody(ed, { autofit: { type: 'normal' } }) },
              { id: 'grow', label: S.cmd.fitGrow, checked: fit === 'shape', disabled: !!chain, onClick: () => applyBody(ed, { autofit: { type: 'shape' } }) },
              { id: 'none', label: S.cmd.fitNone, checked: fit === 'none', onClick: () => applyBody(ed, { autofit: { type: 'none' } }) },
            ],
          },
          {
            kind: 'menu', id: 'columns', label: S.cmd.columns, icon: 'text_column_two', size: 'large', items: [1, 2, 3].map((n) => ({ id: String(n), label: S.columnsN(n), checked: (body.columns ?? 1) === n, onClick: () => applyBody(ed, { columns: n, columnSpacing: n > 1 ? 14.4 : undefined }) })).concat([{ id: 'more', label: S.cmd.more, checked: false, onClick: () => ed.setUi({ dialog: 'textBox' }) }]),
          },
        ],
      },
      { id: 'typography', label: S.groups.typography, icon: 'text_font', controls: [{ kind: 'menu', id: 'dropcap', label: S.cmd.dropCap, icon: 'text_font', size: 'large', disabled: !box, items: dropItems }] },
      arrangeGroup(ed),
      { id: 'size', label: S.groups.size, icon: 'resize', launcher: { label: S.cmd.formatShape, onClick: () => ed.setUi({ dialog: 'format' }) }, controls: sizeControls(ed) },
    ],
  };
}

function shapeStyleControls(ed: Editor): RibbonControl[] {
  const shape = ed.selectedShapes[0];
  const fill = shape && 'fill' in shape && shape.fill?.type === 'solid' ? hexOf(ed, shape.fill.color) : null;
  const line = shape && 'line' in shape && shape.line?.fill?.type === 'solid' ? hexOf(ed, shape.line.fill.color) : null;
  const shadow = { outerShadow: { color: { type: 'rgb' as const, value: '000000', mods: [{ name: 'alpha', val: 40000 }] }, blur: 6, distance: 3, direction: 45 } };
  return [
    { kind: 'color', id: 'fill', label: S.cmd.shapeFill, icon: 'paint_bucket', value: fill, emptyMode: 'none', themeColors: themeSwatches(ed), onChange: (c) => setFill(ed, c ? { type: 'solid', color: colorFromHex(ed, c) } : { type: 'none' }) },
    { kind: 'color', id: 'line', label: S.cmd.shapeOutline, icon: 'color_line', value: line, emptyMode: 'none', themeColors: themeSwatches(ed), onChange: (c) => setLine(ed, c ? { fill: { type: 'solid', color: colorFromHex(ed, c) }, width: 1 } : null) },
    {
      kind: 'menu', id: 'effects', label: S.cmd.shapeEffects, icon: 'sparkle', items: [
        { id: 'none', label: S.cmd.noShadow, onClick: () => setEffects(ed, null) },
        { id: 'shadow', label: S.cmd.shadow, onClick: () => setEffects(ed, shadow) },
        { id: 'glow', label: S.cmd.glow, onClick: () => setEffects(ed, { glow: { radius: 8, color: sc('accent1', [{ name: 'alpha', val: 50000 }]) } }) },
      ],
    },
  ];
}

export function shapeFormatTab(ctx: TabContext, visible: boolean): RibbonTab {
  const { ed, app } = ctx;
  return {
    id: 'shapeFormat',
    label: S.tabs.shapeFormat,
    hidden: !visible,
    contextual: { set: S.tabs.shapeSet, color: DRAWING },
    groups: [
      { id: 'insertShapes', label: S.groups.insertShapes, icon: 'shapes', controls: [{ kind: 'menu', id: 'shapes', label: S.cmd.shapes, icon: 'shapes', size: 'large', items: shapeMenu(app) }] },
      { id: 'shapeStyles', label: S.groups.shapeStyles, icon: 'paint_bucket', controls: shapeStyleControls(ed) },
      arrangeGroup(ed),
      { id: 'size', label: S.groups.size, icon: 'resize', launcher: { label: S.cmd.formatShape, onClick: () => ed.setUi({ dialog: 'format' }) }, controls: sizeControls(ed) },
    ],
  };
}

export function pictureFormatTab(ctx: TabContext, visible: boolean): RibbonTab {
  const { ed } = ctx;
  const pic = ed.selectedShapes.find((s): s is Picture => s.kind === 'picture');
  const fx = pic?.imageEffects ?? {};
  const setFx = (patch: Partial<NonNullable<Picture['imageEffects']>>): void => ed.editSelected((s) => {
    if (s.kind === 'picture') s.imageEffects = { ...(s.imageEffects ?? {}), ...patch };
  }, 'picfx');
  const levels = [-40, -20, 0, 20, 40];
  return {
    id: 'pictureFormat',
    label: S.tabs.pictureFormat,
    hidden: !visible,
    contextual: { set: S.tabs.pictureSet, color: PICTURE },
    groups: [
      {
        id: 'adjust', label: S.groups.adjust, icon: 'image_edit', controls: [
          { kind: 'button', id: 'change', label: S.cmd.changePicture, icon: 'image_edit', size: 'large', onClick: () => void insertPicture(ed) },
          { kind: 'button', id: 'crop', label: S.crop.button, icon: 'crop', size: 'large', tooltip: { title: S.crop.button, description: S.crop.tip }, disabled: !pic?.xfrm, onClick: () => pic && ed.setUi({ crop: pic.id }) },
          { kind: 'button', id: 'fill', label: S.cmd.fillPicture, icon: 'crop', disabled: !pic?.xfrm, onClick: () => fitPicture(ed, 'fill') },
          { kind: 'button', id: 'fit', label: S.cmd.fitPicture, icon: 'page_fit', disabled: !pic?.xfrm, onClick: () => fitPicture(ed, 'fit') },
          { kind: 'menu', id: 'brightness', label: S.cmd.brightness, icon: 'weather_sunny', items: levels.map((v) => ({ id: String(v), label: `${v > 0 ? '+' : ''}${v} %`, checked: (fx.brightness ?? 0) === v, onClick: () => setFx({ brightness: v }) })) },
          { kind: 'menu', id: 'contrast', label: S.cmd.contrast, icon: 'dark_theme', items: levels.map((v) => ({ id: String(v), label: `${v > 0 ? '+' : ''}${v} %`, checked: (fx.contrast ?? 0) === v, onClick: () => setFx({ contrast: v }) })) },
          { kind: 'toggle', id: 'gray', label: S.cmd.grayscale, icon: 'color', pressed: !!fx.grayscale, onToggle: (p) => (p ? setFx({ grayscale: true }) : ed.editSelected((s) => { if (s.kind === 'picture' && s.imageEffects) { delete s.imageEffects.grayscale; if (Object.keys(s.imageEffects).length === 0) delete s.imageEffects; } }, 'picfx')) },
          { kind: 'menu', id: 'alpha', label: S.cmd.transparency, icon: 'drop', items: [100, 80, 60, 40].map((v) => ({ id: String(v), label: `${100 - v} %`, checked: (fx.alpha ?? 100) === v, onClick: () => setFx({ alpha: v }) })) },
          { kind: 'button', id: 'reset', label: S.cmd.resetPicture, icon: 'arrow_counterclockwise', onClick: () => ed.editSelected((s) => { if (s.kind === 'picture') { delete s.imageEffects; delete s.crop; delete s.effects; } }, 'picfx') },
        ],
      },
      { id: 'pictureStyles', label: S.groups.pictureStyles, icon: 'image_border', controls: shapeStyleControls(ed).slice(1) },
      arrangeGroup(ed),
      { id: 'size', label: S.groups.size, icon: 'resize', launcher: { label: S.cmd.formatShape, onClick: () => ed.setUi({ dialog: 'format' }) }, controls: sizeControls(ed) },
    ],
  };
}

// ---- Tableau ----

function editTable(ed: Editor, fn: (t: TableShape, r: number, c: number) => void): void {
  const target = ed.selection.text?.shapeId ?? ed.selection.ids[0];
  const cell = ed.selection.text?.cell ?? (ed.selection.cells ? { row: ed.selection.cells.r0, col: ed.selection.cells.c0 } : { row: 0, col: 0 });
  if (target === undefined) return;
  ed.editShapes((shapes) => {
    const shape = locate(shapes, target)?.shape;
    if (shape?.kind === 'table') fn(shape, cell.row, cell.col);
  }, 'table');
  if (ed.selection.text) ed.setSelection({ ids: [target] });
}

function insertRow(t: TableShape, at: number): void {
  const ref = t.table.rows[Math.min(at, t.table.rows.length - 1)];
  t.table.rows.splice(at, 0, { height: ref?.height ?? 24, cells: t.table.columns.map(() => ({ text: emptyText() })) });
  if (t.xfrm) t.xfrm = { ...t.xfrm, height: t.xfrm.height + (ref?.height ?? 24) };
}

function insertCol(t: TableShape, at: number): void {
  const w = t.table.columns[Math.min(at, t.table.columns.length - 1)] ?? 72;
  t.table.columns.splice(at, 0, w);
  for (const row of t.table.rows) row.cells.splice(at, 0, { text: emptyText() });
  if (t.xfrm) t.xfrm = { ...t.xfrm, width: t.xfrm.width + w };
}

function deleteRow(t: TableShape, r: number): void {
  if (t.table.rows.length < 2) return;
  const [gone] = t.table.rows.splice(r, 1);
  if (t.xfrm && gone) t.xfrm = { ...t.xfrm, height: Math.max(1, t.xfrm.height - gone.height) };
}

function deleteCol(t: TableShape, c: number): void {
  if (t.table.columns.length < 2) return;
  const [gone] = t.table.columns.splice(c, 1);
  for (const row of t.table.rows) row.cells.splice(c, 1);
  if (t.xfrm && gone) t.xfrm = { ...t.xfrm, width: Math.max(1, t.xfrm.width - gone) };
}

function splitAll(t: TableShape): void {
  for (const row of t.table.rows) for (const c of row.cells) { delete c.gridSpan; delete c.rowSpan; delete c.hMerge; delete c.vMerge; }
}

/** Menu contextuel d'un tableau : Inserer, Supprimer, Fusionner / Fractionner les cellules. */
export function tableMenuItems(ed: Editor): MenuItem[] {
  const cells = ed.selection.cells;
  return [
    { id: 'tins', label: S.cmd.insert, icon: 'table_insert_row', items: [
      { id: 'above', label: S.cmd.insertAbove, icon: 'table_insert_row', onClick: () => editTable(ed, (t, r) => insertRow(t, r)) },
      { id: 'below', label: S.cmd.insertBelow, icon: 'table_insert_row', onClick: () => editTable(ed, (t, r) => insertRow(t, r + 1)) },
      { id: 'left', label: S.cmd.insertLeft, icon: 'table_insert_column', onClick: () => editTable(ed, (t, _r, c) => insertCol(t, c)) },
      { id: 'right', label: S.cmd.insertRight, icon: 'table_insert_column', onClick: () => editTable(ed, (t, _r, c) => insertCol(t, c + 1)) },
    ] },
    { id: 'tdel', label: S.cmd.delete, icon: 'table_delete_row', items: [
      { id: 'row', label: S.cmd.deleteRows, icon: 'table_delete_row', onClick: () => editTable(ed, (t, r) => deleteRow(t, r)) },
      { id: 'col', label: S.cmd.deleteCols, icon: 'table_delete_column', onClick: () => editTable(ed, (t, _r, c) => deleteCol(t, c)) },
      { id: 'tab', label: S.cmd.deleteTable, icon: 'delete', onClick: () => { const id = ed.selection.text?.shapeId ?? ed.selection.ids[0]; if (id === undefined) return; ed.editShapes((sh) => deleteShapes(sh, [id]), 'delete'); ed.setSelection({ ids: [] }); } },
    ] },
    { id: 'tmerge', label: S.cmd.mergeCells, icon: 'table_cells_merge', disabled: !cells || (cells.r0 === cells.r1 && cells.c0 === cells.c1), onClick: () => cells && editTable(ed, (t) => mergeCells(t, Math.min(cells.r0, cells.r1), Math.min(cells.c0, cells.c1), Math.abs(cells.r1 - cells.r0) + 1, Math.abs(cells.c1 - cells.c0) + 1)) },
    { id: 'tsplit', label: S.cmd.splitCells, icon: 'table_cells_split', onClick: () => editTable(ed, splitAll) },
  ];
}

export function tableTab(ctx: TabContext, visible: boolean): RibbonTab {
  const { ed } = ctx;
  const table = ed.selectedShapes.find((s): s is TableShape => s.kind === 'table') ?? (ed.selection.text ? (ed.pageShapes.find((s) => s.id === ed.selection.text?.shapeId && s.kind === 'table') as TableShape | undefined) : undefined);
  const opt = (key: 'firstRow' | 'bandRow' | 'firstCol', label: string): RibbonControl => ({
    kind: 'checkbox', id: key, label, checked: !!table?.table[key], onChange: (v) => editTable(ed, (t) => { t.table[key] = v; }),
  });
  const cells = ed.selection.cells;
  return {
    id: 'table',
    label: S.tabs.table,
    hidden: !visible,
    contextual: { set: S.tabs.tableSet, color: TABLE },
    groups: [
      { id: 'tableFormat', label: S.groups.tableFormat, icon: 'table_settings', controls: [opt('firstRow', S.cmd.headerRow), opt('bandRow', S.cmd.bandedRows), opt('firstCol', S.cmd.firstCol), shapeStyleControls(ed)[0] as RibbonControl] },
      {
        id: 'rowsCols', label: S.groups.rowsCols, icon: 'table_insert_row', controls: [
          { kind: 'button', id: 'above', label: S.cmd.insertAbove, icon: 'table_insert_row', onClick: () => editTable(ed, (t, r) => insertRow(t, r)) },
          { kind: 'button', id: 'below', label: S.cmd.insertBelow, icon: 'table_insert_row', onClick: () => editTable(ed, (t, r) => insertRow(t, r + 1)) },
          { kind: 'button', id: 'left', label: S.cmd.insertLeft, icon: 'table_insert_column', onClick: () => editTable(ed, (t, _r, c) => insertCol(t, c)) },
          { kind: 'button', id: 'right', label: S.cmd.insertRight, icon: 'table_insert_column', onClick: () => editTable(ed, (t, _r, c) => insertCol(t, c + 1)) },
          { kind: 'button', id: 'delRow', label: S.cmd.deleteRows, icon: 'table_delete_row', onClick: () => editTable(ed, (t, r) => deleteRow(t, r)) },
          { kind: 'button', id: 'delCol', label: S.cmd.deleteCols, icon: 'table_delete_column', onClick: () => editTable(ed, (t, _r, c) => deleteCol(t, c)) },
        ],
      },
      {
        id: 'merge', label: S.groups.merge, icon: 'table_cells_merge', controls: [
          { kind: 'button', id: 'merge', label: S.cmd.mergeCells, icon: 'table_cells_merge', disabled: !cells || (cells.r0 === cells.r1 && cells.c0 === cells.c1), onClick: () => cells && editTable(ed, (t) => mergeCells(t, Math.min(cells.r0, cells.r1), Math.min(cells.c0, cells.c1), Math.abs(cells.r1 - cells.r0) + 1, Math.abs(cells.c1 - cells.c0) + 1)) },
          { kind: 'button', id: 'split', label: S.cmd.splitCells, icon: 'table_cells_split', onClick: () => editTable(ed, splitAll) },
        ],
      },
      arrangeGroup(ed),
    ],
  };
}

/** Onglets contextuels visibles d'apres la selection. */
export function contextualKinds(shapes: readonly Shape[], editingTable: boolean): { text: boolean; picture: boolean; shape: boolean; table: boolean } {
  const first = shapes[0];
  return {
    text: !!first && first.kind === 'shape' && !!first.textBox,
    picture: !!first && first.kind === 'picture',
    shape: !!first && (first.kind === 'shape' || first.kind === 'connector') && !(first.kind === 'shape' && first.textBox),
    table: editingTable || (!!first && first.kind === 'table'),
  };
}
