// Onglets contextuels : Format de forme, Format de l'image, Creation de tableau, Disposition (tableau), Creation de graphique.
import type { MenuItem, RibbonGroup, RibbonTab } from '@forgeoffice/ui';
import { chartSeries, cssColor, SHAPE_GALLERY, type ChartType, type Picture, type Shape, type TableShape } from '@forgeoffice/pptx';
import { locate } from '../../canvas/ops.ts';
import { TABLE_STYLES, cellLook } from '../../canvas/table-style.ts';
import { applyRun, colorFromHex, selectedTable, setFill } from '../format.ts';
import { changePicture } from '../insert.ts';
import { deleteColumns, deleteRows, distribute, insertColumn, insertRow, mergeRange, splitColumns, unmerge } from '../table-ops.ts';
import { themeSwatches } from '../themes.ts';
import type { Editor } from '../editor.ts';
import { applyQuickStyle, arrangeItems, quickStyleItems, shapeItems } from './galleries.tsx';
import { effectsMenu, outlineMenu } from './shape-menus.tsx';
import type { TabContext } from './common.tsx';
import { S } from '../../strings.ts';
import { S3 } from '../strings-text.ts';
import { mergeMenuItems } from '../merge-ops.ts';
import { chartElementItems } from '../chart-element-menu.ts';
import { pointsTarget, startEditPoints } from '../points-ops.ts';
import { S2 } from '../../strings2.ts';

const SHAPE_SET = S.context.drawingTools;
const PICTURE_SET = S.context.pictureTools;
const TABLE_SET = S.context.tableTools;
const CHART_SET = S.context.chartTools;
const CONTEXT_COLOR = '#C43E1C';

function sizeGroup(ed: Editor): RibbonGroup {
  const first = ed.selectedShapes[0];
  const eff = first ? ed.ctx.resolve(first).xfrm : undefined;
  const cm = (pt: number): number => Math.round((pt / 72) * 2.54 * 100) / 100;
  const pt = (cmv: number): number => (cmv / 2.54) * 72;
  const set = (key: 'width' | 'height', v: number): void =>
    ed.editSelected((shape) => {
      const base = shape.xfrm ?? ed.ctx.resolve(shape).xfrm;
      if (!base) return;
      const ratio = base.width / Math.max(0.01, base.height);
      const lock = shape.kind === 'picture' || shape.locks?.noChangeAspect;
      const x = { ...base, [key]: pt(v) };
      if (lock) {
        if (key === 'width') x.height = x.width / ratio;
        else x.width = x.height * ratio;
      }
      shape.xfrm = x;
    }, 'size');
  return {
    id: 'size', label: S.context.size, icon: 'resize',
    controls: [
      { kind: 'number', id: 'h', label: S.context.height, value: eff ? cm(eff.height) : 0, min: 0.01, max: 142, step: 0.1, unit: 'cm', width: 84, disabled: !eff, onChange: (v) => set('height', v) },
      { kind: 'number', id: 'w', label: S.context.width, value: eff ? cm(eff.width) : 0, min: 0.01, max: 142, step: 0.1, unit: 'cm', width: 84, disabled: !eff, onChange: (v) => set('width', v) },
    ],
  };
}

function arrangeGroup(ctx: TabContext): RibbonGroup {
  return { id: 'arrange', label: S.arrange.title, icon: 'position_forward', controls: [{ kind: 'menu', id: 'arrangeMenu', label: S.arrange.title, icon: 'position_forward', size: 'large', items: arrangeItems(ctx) }] };
}

function altTextGroup(ctx: TabContext): RibbonGroup {
  return { id: 'a11y', label: S.context.accessibility, icon: 'accessibility_checkmark', controls: [{ kind: 'button', id: 'alt', label: S.context.altText, icon: 'accessibility_checkmark', size: 'large', onClick: () => ctx.app.pane('accessibility') }] };
}

/** Change la forme predefinie des formes selectionnees (Modifier la forme). */
function changeShapeItems(ed: Editor): MenuItem[] {
  return SHAPE_GALLERY.filter((c) => c.category !== 'Lignes').map((cat) => ({
    id: cat.category,
    label: cat.category,
    items: cat.shapes.map(([id, name]) => ({
      id,
      label: name,
      onClick: () => ed.editSelected((shape) => {
        if (shape.kind === 'shape') shape.geometry = { type: 'preset', preset: id };
        if (shape.kind === 'picture') shape.geometry = { type: 'preset', preset: id };
      }, 'geometry'),
    })),
  }));
}

export function shapeFormatTab(ctx: TabContext): RibbonTab {
  const { ed } = ctx;
  const themeColors = themeSwatches(ed.ctx.theme.colors);
  const hasText = ed.selectedShapes.some((s) => s.kind === 'shape');
  return {
    id: 'shapeFormat',
    label: S.context.shapeFormat,
    keytip: 'JD',
    contextual: { set: SHAPE_SET, color: CONTEXT_COLOR },
    hidden: !ed.selectedShapes.some((s) => s.kind === 'shape' || s.kind === 'connector' || s.kind === 'group'),
    groups: [
      {
        id: 'insertShapes', label: S.context.insertShapes, icon: 'shapes',
        controls: [
          { kind: 'gallery', id: 'shapes', label: S.insert.shapes, items: shapeItems(), itemWidth: 24, columns: 12, onSelect: (id) => ctx.app.drawShape(id) },
          { kind: 'menu', id: 'edit', label: S.context.changeShape, icon: 'edit', size: 'small', items: changeShapeItems(ed) },
          { kind: 'button', id: 'points', label: S3.points.menu, icon: 'edit', size: 'small', disabled: !pointsTarget(ed), onClick: () => startEditPoints(ed) },
          { kind: 'menu', id: 'merge', label: S3.merge.menu, icon: 'shapes', size: 'small', disabled: ed.selectedShapes.filter((s) => s.kind === 'shape').length < 2, items: mergeMenuItems(ed) },
          { kind: 'button', id: 'textbox', label: S.insert.textBox, icon: 'textbox', size: 'small', onClick: () => ed.setUi({ tool: { kind: 'textbox' } }) },
        ],
      },
      {
        id: 'styles', label: S.context.shapeStyles, icon: 'paint_brush', launcher: { label: S.home.formatShape, onClick: () => ctx.app.pane('format') },
        controls: [
          { kind: 'gallery', id: 'quick', label: S.drawing.quickStyles, items: quickStyleItems(ed), itemWidth: 48, columns: 7, onSelect: (id) => applyQuickStyle(ed, id) },
          { kind: 'color', id: 'fill', label: S.drawing.fill, icon: 'paint_bucket', size: 'small', value: '#156082', emptyMode: 'none', themeColors, onChange: (c) => setFill(ed, c ? { type: 'solid', color: colorFromHex(ed, c) } : { type: 'none' }) },
          { kind: 'menu', id: 'outline', label: S.drawing.outline, icon: 'color_line', size: 'small', items: outlineMenu(ed) },
          { kind: 'menu', id: 'effects', label: S.drawing.effects, icon: 'sparkle', size: 'small', items: effectsMenu(ed) },
        ],
      },
      {
        id: 'wordart', label: S.context.wordArtStyles, icon: 'text_effects',
        controls: [
          { kind: 'color', id: 'textFill', label: S.context.textFill, icon: 'text_color', size: 'small', value: '#000000', themeColors, disabled: !hasText, onChange: (c) => applyRun(ed, { color: c ? colorFromHex(ed, c) : null, textFill: null }) },
          { kind: 'color', id: 'textOutline', label: S.context.textOutline, icon: 'text_effects', size: 'small', value: null, emptyMode: 'none', themeColors, disabled: !hasText, onChange: (c) => applyRun(ed, { outline: c ? { width: 0.75, fill: { type: 'solid', color: colorFromHex(ed, c) } } : null }) },
          {
            kind: 'menu', id: 'textEffects', label: S.context.textEffects, icon: 'sparkle', size: 'small', disabled: !hasText,
            items: [
              { id: 'shadow', label: S.drawing.shadow, onClick: () => applyRun(ed, { effects: { outerShadow: { color: { type: 'rgb', value: '000000', mods: [{ name: 'alpha', val: 40000 }] }, blur: 4, distance: 2, direction: 45 } } }) },
              { id: 'glow', label: S.drawing.glow, onClick: () => applyRun(ed, { effects: { glow: { radius: 6, color: { type: 'scheme', value: 'accent2', mods: [{ name: 'alpha', val: 50000 }] } } } }) },
              { id: 'gradient', label: S.context.gradientText, onClick: () => applyRun(ed, { textFill: { type: 'gradient', kind: 'linear', angle: 90, stops: [{ position: 0, color: { type: 'scheme', value: 'accent1' } }, { position: 100, color: { type: 'scheme', value: 'accent2' } }] } }) },
              { id: 'none', label: S.drawing.noEffects, onClick: () => applyRun(ed, { effects: null, textFill: null, outline: null }) },
            ],
          },
        ],
      },
      altTextGroup(ctx),
      arrangeGroup(ctx),
      sizeGroup(ed),
    ],
  };
}

const ratio = (w: number, h: number) => ({ w, h });

export function pictureFormatTab(ctx: TabContext): RibbonTab {
  const { ed, app } = ctx;
  const pic = ed.selectedShapes.find((s): s is Picture => s.kind === 'picture');
  const fx = (patch: Partial<NonNullable<Picture['imageEffects']>>) => () =>
    ed.editSelected((s) => {
      if (s.kind === 'picture') s.imageEffects = { ...(s.imageEffects ?? {}), ...patch };
    }, 'picture');
  const cropTo = (w: number, h: number) => () =>
    ed.editSelected((s) => {
      if (s.kind !== 'picture' || !s.xfrm) return;
      const box = s.xfrm;
      const want = w / h;
      const have = box.width / box.height;
      if (want > have) {
        const keep = (have / want) * 100;
        s.crop = { left: 0, right: 0, top: (100 - keep) / 2, bottom: (100 - keep) / 2 };
        s.xfrm = { ...box, height: box.width / want };
      } else {
        const keep = (want / have) * 100;
        s.crop = { left: (100 - keep) / 2, right: (100 - keep) / 2, top: 0, bottom: 0 };
        s.xfrm = { ...box, width: box.height * want };
      }
    }, 'crop');
  const style = (preset: string, effects: Picture['effects'], line?: Picture['line']) => () =>
    ed.editSelected((s) => {
      if (s.kind !== 'picture') return;
      s.geometry = { type: 'preset', preset };
      s.effects = effects;
      s.line = line;
    }, 'pictureStyle');
  const white = { width: 6, fill: { type: 'solid' as const, color: { type: 'rgb' as const, value: 'FFFFFF' } } };
  const shadow = { outerShadow: { color: { type: 'rgb' as const, value: '000000', mods: [{ name: 'alpha', val: 40000 }] }, blur: 6, distance: 3, direction: 45 } };
  return {
    id: 'pictureFormat',
    label: S.context.pictureFormat,
    keytip: 'JP',
    contextual: { set: PICTURE_SET, color: CONTEXT_COLOR },
    hidden: !pic,
    groups: [
      {
        id: 'adjust', label: S.context.adjust, icon: 'image_edit',
        controls: [
          {
            kind: 'menu', id: 'corrections', label: S.context.corrections, icon: 'weather_sunny', size: 'large',
            items: [-40, -20, 0, 20, 40].flatMap((b) => [-20, 0, 20].map((c) => ({ id: `${b}:${c}`, label: S.context.brightnessContrast(b, c), checked: (pic?.imageEffects?.brightness ?? 0) === b && (pic?.imageEffects?.contrast ?? 0) === c, onClick: fx({ brightness: b || undefined, contrast: c || undefined }) }))),
          },
          {
            kind: 'menu', id: 'color', label: S.context.color, icon: 'color', size: 'large',
            items: [
              { id: 'original', label: S.context.noRecolor, onClick: fx({ grayscale: undefined, duotone: undefined }) },
              { id: 'gray', label: S.context.grayscale, checked: !!pic?.imageEffects?.grayscale, onClick: fx({ grayscale: true, duotone: undefined }) },
              { id: 'sepia', label: S.context.sepia, onClick: fx({ grayscale: undefined, duotone: [{ type: 'rgb', value: '3D2E14' }, { type: 'rgb', value: 'F3E7CF' }] }) },
            ],
          },
          { kind: 'menu', id: 'transparency', label: S.context.transparency, icon: 'eye', size: 'large', items: [0, 15, 30, 50, 65, 80].map((t) => ({ id: String(t), label: `${t} %`, onClick: fx({ alpha: t ? 100 - t : undefined }) })) },
          { kind: 'button', id: 'removeBg', label: S2.removeBg.button, icon: 'image_edit', size: 'large', tooltip: { title: S2.removeBg.button, description: S2.removeBg.tip }, onClick: () => app.dialog('removeBg') },
          { kind: 'button', id: 'change', label: S.context.changePicture, icon: 'image_add', size: 'small', onClick: () => void changePicture(ed) },
          { kind: 'button', id: 'reset', label: S.context.resetPicture, icon: 'arrow_counterclockwise', size: 'small', onClick: () => ed.editSelected((s) => { if (s.kind === 'picture') { delete s.imageEffects; delete s.crop; delete s.effects; delete s.line; s.geometry = { type: 'preset', preset: 'rect' }; } }, 'picture') },
        ],
      },
      {
        id: 'styles', label: S.context.pictureStyles, icon: 'image',
        controls: [
          {
            kind: 'menu', id: 'pictureStyles', label: S.context.pictureStyles, icon: 'image', size: 'large',
            items: [
              { id: 'simple', label: S.context.styles.simpleFrame, onClick: style('rect', undefined, white) },
              { id: 'shadow', label: S.context.styles.dropShadow, onClick: style('rect', shadow, white) },
              { id: 'rounded', label: S.context.styles.rounded, onClick: style('roundRect', shadow) },
              { id: 'oval', label: S.context.styles.oval, onClick: style('ellipse', shadow) },
              { id: 'soft', label: S.context.styles.soft, onClick: style('rect', { softEdge: 12 }) },
              { id: 'reflected', label: S.context.styles.reflected, onClick: style('roundRect', { reflection: { blur: 0.5, startAlpha: 50, startPosition: 0, endAlpha: 0.3, endPosition: 35, distance: 0, direction: 90, fadeDirection: 90, scaleX: 100, scaleY: -100 } }) },
              { id: 'none', label: S.context.styles.none, onClick: style('rect', undefined, undefined) },
            ],
          },
          { kind: 'menu', id: 'border', label: S.context.border, icon: 'color_line', size: 'small', items: outlineMenu(ed) },
          { kind: 'menu', id: 'effects', label: S.drawing.effects, icon: 'sparkle', size: 'small', items: effectsMenu(ed) },
        ],
      },
      altTextGroup(ctx),
      arrangeGroup(ctx),
      {
        id: 'crop', label: S.context.size, icon: 'crop',
        controls: [
          {
            kind: 'split', id: 'crop', label: S.context.crop, icon: 'crop', size: 'large', onClick: () => app.dialog('crop'),
            items: [
              { id: 'shape', label: S.context.cropToShape, items: changeShapeItems(ed).flatMap((c) => c.items ?? []).slice(0, 40) },
              { id: 'ratio', label: S.context.aspectRatio, items: [ratio(1, 1), ratio(4, 3), ratio(3, 2), ratio(16, 9), ratio(16, 10), ratio(3, 4), ratio(2, 3), ratio(9, 16)].map((r) => ({ id: `${r.w}:${r.h}`, label: `${r.w}:${r.h}`, onClick: cropTo(r.w, r.h) })) },
              { id: 'dialog', label: S.context.cropDialog, onClick: () => app.dialog('crop') },
            ],
          },
          ...sizeGroup(ed).controls,
        ],
      },
    ],
  };
}

export function tableSelection(ed: Editor, t: TableShape): { r0: number; c0: number; r1: number; c1: number } {
  const cells = ed.selection.cells;
  if (cells && cells.shapeId === t.id) return cells;
  const c = ed.selection.text?.cell;
  if (c) return { r0: c.row, c0: c.col, r1: c.row, c1: c.col };
  return { r0: 0, c0: 0, r1: t.table.rows.length - 1, c1: t.table.columns.length - 1 };
}

export function editTable(ed: Editor, t: TableShape, recipe: (table: TableShape) => void, group = 'table'): void {
  ed.editShapes((shapes) => {
    const found = locate(shapes, t.id);
    if (found?.shape.kind === 'table') recipe(found.shape);
  }, group);
}

function StylePreview({ ed, id }: { ed: Editor; id: string }) {
  const table = { columns: [1, 1, 1, 1], rows: Array.from({ length: 4 }, () => ({ height: 1, cells: Array.from({ length: 4 }, () => ({ text: { props: {}, paragraphs: [] } })) })), styleId: id, firstRow: true, bandRow: true };
  return (
    <span style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 12px)', gap: 0, border: '1px solid var(--fo-border)' }}>
      {table.rows.flatMap((row, r) =>
        row.cells.map((_, c) => {
          const look = cellLook(table, r, c);
          const bg = look.fill?.type === 'solid' ? cssColor(look.fill.color, ed.ctx.theme, ed.ctx.colorMap) : '#fff';
          const border = look.bottom?.fill?.type === 'solid' ? cssColor(look.bottom.fill.color, ed.ctx.theme, ed.ctx.colorMap) : 'transparent';
          return <span key={`${r}${c}`} style={{ width: 12, height: 8, background: bg, borderBottom: `1px solid ${border}`, borderRight: '1px solid rgba(255,255,255,.6)' }} />;
        }),
      )}
    </span>
  );
}

export function tableDesignTab(ctx: TabContext): RibbonTab {
  const { ed } = ctx;
  const t = selectedTable(ed);
  const tbl = t?.table;
  const opt = (key: 'firstRow' | 'lastRow' | 'bandRow' | 'firstCol' | 'lastCol' | 'bandCol', label: string) => ({
    kind: 'checkbox' as const, id: key, label, checked: !!tbl?.[key],
    onChange: (v: boolean) => t && editTable(ed, t, (s) => {
      if (v) s.table[key] = true;
      else delete s.table[key];
    }),
  });
  const border = (which: 'all' | 'outside' | 'none' | 'bottom' | 'top' | 'inside') => () =>
    t && editTable(ed, t, (s) => {
      const sel = tableSelection(ed, s);
      const line = { width: 1, fill: { type: 'solid' as const, color: { type: 'scheme' as const, value: 'tx1' as const } } };
      const none = { fill: { type: 'none' as const } };
      for (let r = sel.r0; r <= sel.r1; r++) {
        for (let c = sel.c0; c <= sel.c1; c++) {
          const cell = s.table.rows[r]?.cells[c];
          if (!cell) continue;
          const b = { ...(cell.borders ?? {}) };
          const edge = { top: r === sel.r0, bottom: r === sel.r1, left: c === sel.c0, right: c === sel.c1 };
          for (const side of ['top', 'bottom', 'left', 'right'] as const) {
            if (which === 'all') b[side] = line;
            else if (which === 'none') b[side] = none;
            else if (which === 'outside' && edge[side]) b[side] = line;
            else if (which === 'inside' && !edge[side]) b[side] = line;
            else if ((which === 'bottom' || which === 'top') && side === which && edge[side]) b[side] = line;
          }
          cell.borders = b;
        }
      }
    }, 'borders');
  return {
    id: 'tableDesign',
    label: S.context.tableDesign,
    keytip: 'JT',
    contextual: { set: TABLE_SET, color: CONTEXT_COLOR },
    hidden: !t,
    groups: [
      {
        id: 'options', label: S.context.tableOptions, icon: 'table_settings',
        controls: [opt('firstRow', S.context.headerRow), opt('lastRow', S.context.totalRow), opt('bandRow', S.context.bandedRows), opt('firstCol', S.context.firstColumn), opt('lastCol', S.context.lastColumn), opt('bandCol', S.context.bandedColumns)],
      },
      {
        id: 'styles', label: S.context.tableStyles, icon: 'table',
        controls: [
          { kind: 'gallery', id: 'tableStyles', label: S.context.tableStyles, items: TABLE_STYLES.map((st, i) => ({ id: st.id, label: S.context.tableStyleName(st.family, st.accent, i), render: () => <StylePreview ed={ed} id={st.id} /> })), selectedId: tbl?.styleId ?? null, itemWidth: 60, columns: 7, onSelect: (id) => t && editTable(ed, t, (s) => { s.table.styleId = id; }) },
          { kind: 'color', id: 'shading', label: S.context.shading, icon: 'paint_bucket', size: 'small', value: '#156082', emptyMode: 'none', themeColors: themeSwatches(ed.ctx.theme.colors), onChange: (c) => setFill(ed, c ? { type: 'solid', color: colorFromHex(ed, c) } : { type: 'none' }) },
          {
            kind: 'menu', id: 'borders', label: S.context.borders, icon: 'border_all', size: 'small',
            items: [
              { id: 'all', label: S.context.borderAll, icon: 'border_all', onClick: border('all') },
              { id: 'outside', label: S.context.borderOutside, icon: 'border_outside', onClick: border('outside') },
              { id: 'inside', label: S.context.borderInside, onClick: border('inside') },
              { id: 'top', label: S.context.borderTop, onClick: border('top') },
              { id: 'bottom', label: S.context.borderBottom, icon: 'border_bottom', onClick: border('bottom') },
              { id: 'none', label: S.context.borderNone, icon: 'border_none', onClick: border('none') },
            ],
          },
        ],
      },
    ],
  };
}

export function tableLayoutTab(ctx: TabContext): RibbonTab {
  const { ed } = ctx;
  const t = selectedTable(ed);
  const sel = t ? tableSelection(ed, t) : { r0: 0, c0: 0, r1: 0, c1: 0 };
  const run = (recipe: (s: TableShape) => void, group = 'tableLayout') => () => t && editTable(ed, t, recipe, group);
  const single = sel.r0 === sel.r1 && sel.c0 === sel.c1;
  const cell = t?.table.rows[sel.r0]?.cells[sel.c0];
  const anchorAll = (anchor: 't' | 'ctr' | 'b') => run((s) => {
    for (let r = sel.r0; r <= sel.r1; r++) for (let c = sel.c0; c <= sel.c1; c++) {
      const x = s.table.rows[r]?.cells[c];
      if (x) x.anchor = anchor;
    }
  });
  return {
    id: 'tableLayout',
    label: S.context.tableLayout,
    keytip: 'JL',
    contextual: { set: TABLE_SET, color: CONTEXT_COLOR },
    hidden: !t,
    groups: [
      {
        id: 'rowsCols', label: S.context.rowsColumns, icon: 'table_insert_row',
        controls: [
          {
            kind: 'menu', id: 'delete', label: S.context.delete, icon: 'table_delete_row', size: 'large',
            items: [
              { id: 'cols', label: S.context.deleteColumns, icon: 'table_delete_column', onClick: run((s) => deleteColumns(s, sel.c0, sel.c1)) },
              { id: 'rows', label: S.context.deleteRows, icon: 'table_delete_row', onClick: run((s) => deleteRows(s, sel.r0, sel.r1)) },
              { id: 'table', label: S.context.deleteTable, icon: 'delete', onClick: () => t && ed.editShapes((shapes) => { const f = locate(shapes, t.id); if (f) f.list.splice(f.index, 1); }, 'delete') },
            ],
          },
          { kind: 'button', id: 'above', label: S.context.insertAbove, icon: 'table_insert_row', size: 'large', onClick: run((s) => insertRow(s, sel.r0)) },
          { kind: 'button', id: 'below', label: S.context.insertBelow, icon: 'table_insert_row', size: 'small', onClick: run((s) => insertRow(s, sel.r1 + 1)) },
          { kind: 'button', id: 'left', label: S.context.insertLeft, icon: 'table_insert_column', size: 'small', onClick: run((s) => insertColumn(s, sel.c0)) },
          { kind: 'button', id: 'right', label: S.context.insertRight, icon: 'table_insert_column', size: 'small', onClick: run((s) => insertColumn(s, sel.c1 + 1)) },
        ],
      },
      {
        id: 'merge', label: S.context.merge, icon: 'table_cells_merge',
        controls: [
          { kind: 'button', id: 'merge', label: S.context.mergeCells, icon: 'table_cells_merge', size: 'large', disabled: single, onClick: run((s) => mergeRange(s, sel.r0, sel.c0, sel.r1, sel.c1)) },
          { kind: 'button', id: 'split', label: S.context.splitCells, icon: 'table_cells_split', size: 'large', onClick: run((s) => (cell?.gridSpan || cell?.rowSpan ? unmerge(s, sel.r0, sel.c0) : splitColumns(s, sel.r0, sel.c0, 2))) },
        ],
      },
      {
        id: 'cellSize', label: S.context.cellSize, icon: 'resize',
        controls: [
          { kind: 'number', id: 'rowHeight', label: S.context.height, value: Math.round(((t?.table.rows[sel.r0]?.height ?? 0) / 72) * 254) / 100, min: 0.1, max: 50, step: 0.1, unit: 'cm', width: 84, disabled: !t, onChange: (v) => t && editTable(ed, t, (s) => { for (let r = sel.r0; r <= sel.r1; r++) { const row = s.table.rows[r]; if (row) row.height = (v / 2.54) * 72; } }) },
          { kind: 'number', id: 'colWidth', label: S.context.width, value: Math.round(((t?.table.columns[sel.c0] ?? 0) / 72) * 254) / 100, min: 0.1, max: 50, step: 0.1, unit: 'cm', width: 84, disabled: !t, onChange: (v) => t && editTable(ed, t, (s) => { for (let c = sel.c0; c <= sel.c1; c++) s.table.columns[c] = (v / 2.54) * 72; s.xfrm = s.xfrm && { ...s.xfrm, width: s.table.columns.reduce((a, b) => a + b, 0) }; }) },
          { kind: 'button', id: 'distRows', label: S.context.distributeRows, icon: 'table_stack_below', size: 'small', onClick: run((s) => distribute(s, 'rows')) },
          { kind: 'button', id: 'distCols', label: S.context.distributeColumns, icon: 'table_split', size: 'small', onClick: run((s) => distribute(s, 'columns')) },
        ],
      },
      {
        id: 'alignment', label: S.context.alignment, icon: 'text_align_center',
        controls: [
          {
            kind: 'row', id: 'h', controls: [
              { kind: 'button', id: 'l', label: S.home.alignLeft, icon: 'text_align_left', iconOnly: true, onClick: () => applyParagraphTo(ctx, 'l') },
              { kind: 'button', id: 'c', label: S.home.alignCenter, icon: 'text_align_center', iconOnly: true, onClick: () => applyParagraphTo(ctx, 'ctr') },
              { kind: 'button', id: 'r', label: S.home.alignRight, icon: 'text_align_right', iconOnly: true, onClick: () => applyParagraphTo(ctx, 'r') },
            ],
          },
          {
            kind: 'row', id: 'v', controls: [
              { kind: 'button', id: 't', label: S.home.anchorTop, icon: 'align_top', iconOnly: true, onClick: anchorAll('t') },
              { kind: 'button', id: 'm', label: S.home.anchorMiddle, icon: 'textbox_align_center', iconOnly: true, onClick: anchorAll('ctr') },
              { kind: 'button', id: 'b', label: S.home.anchorBottom, icon: 'align_bottom', iconOnly: true, onClick: anchorAll('b') },
            ],
          },
        ],
      },
    ],
  };
}

function applyParagraphTo(ctx: TabContext, align: 'l' | 'ctr' | 'r'): void {
  const t = selectedTable(ctx.ed);
  if (!t) return;
  const sel = tableSelection(ctx.ed, t);
  editTable(ctx.ed, t, (s) => {
    for (let r = sel.r0; r <= sel.r1; r++) for (let c = sel.c0; c <= sel.c1; c++) {
      const cell = s.table.rows[r]?.cells[c];
      cell?.text.paragraphs.forEach((p) => { p.props = { ...p.props, align }; });
    }
  }, 'align');
}

type ChartEdit = (recipe: (c: Extract<Shape, { kind: 'chart' }>['chart']) => void, group?: string) => void;
type ChartTypeOpts = { barDirection?: 'bar' | 'col'; grouping?: 'clustered' | 'stacked' | 'percentStacked' | 'standard' };

/** Changement de type du premier trace d'un graphique (ruban et menu contextuel). */
function chartTypeSetter(edit: ChartEdit) {
  return (type: ChartType, opts: ChartTypeOpts = {}) => () =>
      edit((c) => {
        const plot = c.plots[0];
        if (!plot) return;
        const noAxes = type === 'pie' || type === 'doughnut';
        plot.type = type;
        plot.barDirection = type === 'bar' ? (opts.barDirection ?? 'col') : undefined;
        plot.grouping = opts.grouping ?? (type === 'bar' ? 'clustered' : type === 'line' || type === 'area' ? 'standard' : undefined);
        plot.overlap = plot.grouping === 'stacked' || plot.grouping === 'percentStacked' ? 100 : type === 'bar' ? -27 : undefined;
        plot.varyColors = noAxes;
        if (type === 'doughnut') plot.holeSize = 75;
        if (noAxes) plot.axisIds = [];
        else if (!plot.axisIds.length && c.axes.length) plot.axisIds = c.axes.map((a) => a.id);
        for (const a of c.axes) if (type === 'bar') a.position = a.type === 'cat' ? (plot.barDirection === 'bar' ? 'l' : 'b') : plot.barDirection === 'bar' ? 'b' : 'l';
      });
}

/** Entrees « Modifier le type de graphique » du menu contextuel d'un graphique. */
export function chartTypeMenuItems(ed: Editor): MenuItem[] {
  const setType = chartTypeSetter((recipe, group = 'chart') =>
    ed.editSelected((s) => {
      if (s.kind !== 'chart') return;
      recipe(s.chart);
      delete s.source;
    }, group));
  return CHART_TYPE_ENTRIES.map(([id, label, type, opts]) => ({ id, label, onClick: setType(type, opts) }));
}

const CHART_TYPE_ENTRIES: ReadonlyArray<readonly [string, string, ChartType, ChartTypeOpts?]> = [
  ['col', S.insert.charts.column, 'bar', { barDirection: 'col' }],
  ['colStack', S.insert.charts.columnStacked, 'bar', { barDirection: 'col', grouping: 'stacked' }],
  ['bar', S.insert.charts.bar, 'bar', { barDirection: 'bar' }],
  ['line', S.insert.charts.line, 'line'],
  ['area', S.insert.charts.area, 'area'],
  ['pie', S.insert.charts.pie, 'pie'],
  ['doughnut', S.insert.charts.doughnut, 'doughnut'],
  ['radar', S.insert.charts.radar, 'radar'],
];

export function chartDesignTab(ctx: TabContext): RibbonTab {
  const { ed, app } = ctx;
  const shape = ed.selectedShapes.find((s) => s.kind === 'chart');
  const chart = shape?.kind === 'chart' ? shape.chart : undefined;
  const edit = (recipe: (c: NonNullable<typeof chart>) => void, group = 'chart') =>
    ed.editSelected((s) => {
      if (s.kind !== 'chart') return;
      recipe(s.chart);
      delete s.source;
    }, group);
  const series = chart ? chartSeries(chart) : [];
  return {
    id: 'chartDesign',
    label: S.context.chartDesign,
    keytip: 'JC',
    contextual: { set: CHART_SET, color: CONTEXT_COLOR },
    hidden: !chart,
    groups: [
      {
        id: 'layouts', label: S.context.chartLayouts, icon: 'chart_multiple',
        controls: [
          {
            kind: 'menu', id: 'elements', label: S.context.chartElements, icon: 'add', size: 'large',
            items: [
              { id: 'title', label: S.context.chartTitle, checked: !!chart?.title, onClick: () => edit((c) => { c.title = c.title ? null : { text: series.length === 1 ? series[0]?.name : S.context.chartTitle, props: { size: 14 } }; c.autoTitleDeleted = !c.title; }) },
              ...(chart ? chartElementItems(chart, edit) : []),
              {
                id: 'legend', label: S.context.legend,
                items: [
                  { id: 'none', label: S.home.none, checked: !chart?.legend, onClick: () => edit((c) => { c.legend = null; }) },
                  ...(['r', 't', 'l', 'b'] as const).map((p) => ({ id: p, label: S.context.legendPos[p], checked: chart?.legend?.position === p, onClick: () => edit((c) => { c.legend = { position: p, overlay: false, props: c.legend?.props }; }) })),
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'styles', label: S.context.chartStyles, icon: 'color',
        controls: [
          {
            kind: 'menu', id: 'colors', label: S.context.changeColors, icon: 'color', size: 'large',
            items: [
              { id: 'colorful', label: S.context.colorful, onClick: () => edit((c) => { for (const s of chartSeries(c)) delete s.fill; }) },
              ...(['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const).map((slot) => ({
                id: slot,
                label: `${S.context.monochrome} ${slot.slice(-1)}`,
                onClick: () => edit((c) => chartSeries(c).forEach((s, i) => { s.fill = { type: 'solid', color: { type: 'scheme', value: slot, mods: [{ name: 'lumMod', val: Math.max(30000, 100000 - i * 25000) }] } }; })),
              })),
            ],
          },
        ],
      },
      {
        id: 'data', label: S.context.data, icon: 'table',
        controls: [{ kind: 'button', id: 'edit', label: S.context.editData, icon: 'table_cell_edit', size: 'large', onClick: () => app.dialog('chartData') }],
      },
      {
        id: 'type', label: S.context.type, icon: 'data_bar_vertical',
        controls: [
          {
            kind: 'menu', id: 'changeType', label: S.context.changeType, icon: 'data_bar_vertical', size: 'large',
            items: chartTypeMenuItems(ed),
          },
        ],
      },
    ],
  };
}

