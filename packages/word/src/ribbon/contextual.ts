// Onglets contextuels : Creation / Disposition de tableau, Format de l'image, Mode Plan.
import {
  addColumnAfter, addColumnBefore, addRowAfter, addRowBefore, deleteColumn, deleteRow, deleteTable, mergeCells, selectedRect, splitCell,
  toggleHeaderRow,
} from 'prosemirror-tables';
import type { RibbonTab } from '@forgeoffice/ui';
import type { Border, ImageInline, TableCellProps } from '@forgeoffice/docx';
import type { Command } from 'prosemirror-state';
import { T } from '../strings.ts';
import { withAlign, wrapOf, wrapPatch, type ImageWrap } from '../editor/images.ts';
import type { Ctl } from '../app/types.ts';
import { applyStyle, updateAtom } from '../editor/commands.ts';
import { ptToCm, cmToPt } from './shared.ts';

const TABLE_COLOR = '#A4373A';
const PICTURE_COLOR = '#B85F00';

/** Applique une fonction aux proprietes de toutes les cellules selectionnees. */
function cellProps(fn: (p: TableCellProps) => TableCellProps): Command {
  return (state, dispatch) => {
    let rect;
    try {
      rect = selectedRect(state);
    } catch {
      return false; // curseur hors tableau
    }
    if (!dispatch) return true;
    const tr = state.tr;
    const cells = rect.map.cellsInRect(rect);
    for (const rel of cells) {
      const pos = rect.tableStart + rel;
      const node = tr.doc.nodeAt(pos);
      if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, props: fn(node.attrs.props as TableCellProps) });
    }
    dispatch(tr);
    return true;
  };
}

/** Proprietes du tableau courant. */
function tableAttrs(fn: (a: Record<string, unknown>) => Record<string, unknown>): Command {
  return (state, dispatch) => {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      if (node.type.name === 'table') {
        if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(d), undefined, fn({ ...node.attrs })));
        return true;
      }
    }
    return false;
  };
}

const line = (): Border => ({ style: 'single', width: 0.5, color: 'auto', space: 0 });

export function tableDesignTab(c: Ctl): RibbonTab {
  const cmd = T.cmd;
  const styles: [string, string][] = [['TableGrid', 'Grille du tableau'], ['TableNormal', 'Tableau normal']];
  return {
    id: 'tableDesign', label: T.tabs.tableDesign, contextual: { set: T.tabs.tableSet, color: TABLE_COLOR }, hidden: !c.sel.inTable,
    groups: [
      {
        id: 'opts', label: T.groups.tableStyleOptions, icon: 'table_settings',
        controls: [{ kind: 'button', id: 'header', label: cmd.headerRow, icon: 'table_freeze_row', onClick: () => c.run(toggleHeaderRow) }],
      },
      {
        id: 'styles', label: T.groups.tableStyles, icon: 'table',
        controls: [
          { kind: 'menu', id: 'tstyle', label: T.groups.tableStyles, icon: 'table', size: 'large', items: styles.map(([id, label]) => ({ id, label, onClick: () => c.run(tableAttrs((a) => ({ ...a, styleId: id }))) })) },
          { kind: 'color', id: 'shading', label: cmd.cellShading, icon: 'paint_bucket', size: 'large', value: '#D9E2F3', emptyMode: 'none', onChange: (hex) => c.run(cellProps((p) => ({ ...p, shading: hex ? { fill: hex.slice(1).toUpperCase(), pattern: 'clear' } : undefined }))) },
        ],
      },
      {
        id: 'borders', label: T.groups.borders, icon: 'border_all',
        controls: [
          { kind: 'button', id: 'all', label: cmd.allBorders, icon: 'border_all', onClick: () => c.run(cellProps((p) => ({ ...p, borders: { top: line(), bottom: line(), left: line(), right: line() } }))) },
          { kind: 'button', id: 'none', label: cmd.noBorders, icon: 'border_none', onClick: () => c.run(cellProps((p) => {
            const n: Border = { style: 'none', width: 0, color: 'auto', space: 0 };
            return { ...p, borders: { top: n, bottom: n, left: n, right: n } };
          })) },
        ],
      },
    ],
  };
}

export function tableLayoutTab(c: Ctl): RibbonTab {
  const cmd = T.cmd;
  const valign = (v: TableCellProps['verticalAlign']): Command => cellProps((p) => ({ ...p, verticalAlign: v }));
  return {
    id: 'tableLayout', label: T.tabs.tableLayout, contextual: { set: T.tabs.tableSet, color: TABLE_COLOR }, hidden: !c.sel.inTable,
    groups: [
      { id: 'table', label: T.groups.table, icon: 'table', controls: [{ kind: 'button', id: 'delete', label: cmd.deleteTable, icon: 'table_delete_row', onClick: () => c.run(deleteTable) }] },
      {
        id: 'rowscols', label: T.groups.rowsCols, icon: 'table_insert_row',
        controls: [
          { kind: 'button', id: 'above', label: cmd.insertAbove, icon: 'table_insert_row', size: 'large', onClick: () => c.run(addRowBefore) },
          { kind: 'button', id: 'below', label: cmd.insertBelow, icon: 'table_stack_below', onClick: () => c.run(addRowAfter) },
          { kind: 'button', id: 'left', label: cmd.insertLeft, icon: 'table_insert_column', onClick: () => c.run(addColumnBefore) },
          { kind: 'button', id: 'right', label: cmd.insertRight, icon: 'table_insert_column', onClick: () => c.run(addColumnAfter) },
          { kind: 'button', id: 'delrow', label: cmd.deleteRow, icon: 'table_delete_row', onClick: () => c.run(deleteRow) },
          { kind: 'button', id: 'delcol', label: cmd.deleteCol, icon: 'table_delete_column', onClick: () => c.run(deleteColumn) },
        ],
      },
      {
        id: 'merge', label: T.groups.merge, icon: 'table_cells_merge',
        controls: [
          { kind: 'button', id: 'merge', label: cmd.mergeCells, icon: 'table_cells_merge', onClick: () => c.run(mergeCells) },
          { kind: 'button', id: 'split', label: cmd.splitCell, icon: 'table_cells_split', onClick: () => c.run(splitCell) },
        ],
      },
      {
        id: 'align', label: T.groups.alignment, icon: 'align_top',
        controls: [
          { kind: 'button', id: 'top', label: cmd.alignTop, icon: 'align_top', onClick: () => c.run(valign('top')) },
          { kind: 'button', id: 'middle', label: cmd.alignMiddle, icon: 'align_center_horizontal', onClick: () => c.run(valign('center')) },
          { kind: 'button', id: 'bottom', label: cmd.alignBottom, icon: 'align_bottom', onClick: () => c.run(valign('bottom')) },
        ],
      },
      {
        id: 'data', label: T.groups.data, icon: 'arrow_sort',
        controls: [
          { kind: 'button', id: 'sort', label: cmd.sortTable, icon: 'arrow_sort', onClick: () => c.openDialog('sort') },
          { kind: 'button', id: 'repeat', label: cmd.headerRow, icon: 'table_freeze_row', onClick: () => c.run((state, dispatch) => {
            const $from = state.selection.$from;
            for (let d = $from.depth; d > 0; d--) {
              const node = $from.node(d);
              if (node.type.name === 'table_row') {
                if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(d), undefined, { props: { ...node.attrs.props, header: !node.attrs.props.header } }));
                return true;
              }
            }
            return false;
          }) },
        ],
      },
    ],
  };
}


export function pictureTab(c: Ctl): RibbonTab {
  const img = c.sel.image;
  const cmd = T.cmd;
  const update = (patch: Partial<ImageInline>): void => {
    if (img) c.run(updateAtom(img.pos, { ...img.data, ...patch }));
  };
  const wrap = (mode: ImageWrap): void => {
    if (img) update(wrapPatch(img.data, mode));
  };
  const ratio = img ? img.data.height / Math.max(1, img.data.width) : 1;
  return {
    id: 'picture', label: T.tabs.picture, contextual: { set: T.tabs.pictureSet, color: PICTURE_COLOR }, hidden: !img,
    groups: [
      {
        id: 'styles', label: T.groups.pictureStyles, icon: 'image',
        controls: [
          { kind: 'button', id: 'alt', label: cmd.altText, icon: 'text_description', size: 'large', onClick: () => c.openDialog('alt') },
          { kind: 'button', id: 'reset', label: cmd.resetPicture, icon: 'arrow_counterclockwise', onClick: () => update({ rotation: undefined, flipH: undefined, flipV: undefined, crop: undefined }) },
        ],
      },
      {
        id: 'arrange', label: T.groups.arrange, icon: 'text_wrap',
        controls: [
          { kind: 'menu', id: 'wrap', label: cmd.wrapText, icon: 'text_wrap', size: 'large', items: ([
            ['inline', cmd.wrapInline], ['square', cmd.wrapSquare], ['tight', cmd.wrapTight], ['topAndBottom', cmd.wrapTopBottom], ['behind', cmd.wrapBehind], ['front', cmd.wrapFront],
          ] as const).map(([id, label]) => ({ id, label, checked: !!img && wrapOf(img.data) === id, onClick: () => wrap(id) })) },
          { kind: 'menu', id: 'position', label: cmd.position, icon: 'align_left', size: 'large', disabled: !img?.data.floating, items: ([['left', T.ctx.alignLeft], ['center', T.ctx.alignCenter], ['right', T.ctx.alignRight]] as const).map(([a, label]) => ({
            id: a, label, checked: img?.data.floating?.horizontal.align === a, onClick: () => img && update(withAlign(img.data, a)),
          })) },
          { kind: 'button', id: 'rotateleft', label: cmd.rotateLeft, icon: 'rotate_left', onClick: () => update({ rotation: (((img?.data.rotation ?? 0) + 270) % 360) || undefined }) },
          { kind: 'number', id: 'angle', label: cmd.rotationAngle, value: img?.data.rotation ?? 0, min: 0, max: 359, step: 5, unit: '°', width: 64, onChange: (v) => update({ rotation: (((Math.round(v) % 360) + 360) % 360) || undefined }) },
          { kind: 'button', id: 'rotate', label: cmd.rotateRight, icon: 'rotate_right', onClick: () => update({ rotation: ((img?.data.rotation ?? 0) + 90) % 360 || undefined }) },
          { kind: 'button', id: 'fliph', label: cmd.flipH, icon: 'flip_horizontal', onClick: () => update({ flipH: !img?.data.flipH || undefined }) },
          { kind: 'button', id: 'flipv', label: cmd.flipV, icon: 'flip_vertical', onClick: () => update({ flipV: !img?.data.flipV || undefined }) },
        ],
      },
      {
        id: 'size', label: T.groups.size, icon: 'resize',
        controls: [
          { kind: 'number', id: 'h', label: cmd.height, value: ptToCm(img?.data.height ?? 0), min: 0.1, max: 55, step: 0.1, unit: 'cm', width: 70, onChange: (v) => update({ height: cmToPt(v), width: cmToPt(v) / ratio }) },
          { kind: 'number', id: 'w', label: cmd.width, value: ptToCm(img?.data.width ?? 0), min: 0.1, max: 55, step: 0.1, unit: 'cm', width: 70, onChange: (v) => update({ width: cmToPt(v), height: cmToPt(v) * ratio }) },
        ],
      },
    ],
  };
}

const levelLabel = (n: number): string => (n >= 10 ? T.cmd.allLevels : T.dialogs.level(n));

export function outlineTab(c: Ctl): RibbonTab {
  const cmd = T.cmd;
  const lvl = c.sel.para.outlineLevel;
  const level = lvl !== undefined && lvl < 9 ? lvl + 1 : 0;
  return {
    id: 'outline', label: T.tabs.outline, contextual: { set: T.tabs.outline, color: '#185ABD' }, hidden: c.ui.view !== 'outline',
    groups: [
      {
        id: 'tools', label: T.groups.outlineTools, icon: 'text_bullet_list_tree',
        controls: [
          { kind: 'button', id: 'promote', label: cmd.promote, icon: 'arrow_left', onClick: () => c.run(applyStyle(level <= 1 ? 'Heading1' : `Heading${level - 1}`, 'paragraph')) },
          { kind: 'button', id: 'demote', label: cmd.demote, icon: 'arrow_right', onClick: () => c.run(applyStyle(level === 0 ? 'Heading1' : `Heading${Math.min(9, level + 1)}`, 'paragraph')) },
          { kind: 'button', id: 'body', label: cmd.toBody, icon: 'text_t', onClick: () => c.run(applyStyle('Normal', 'paragraph')) },
          { kind: 'combo', id: 'showlevel', label: cmd.showLevel, width: 140, value: levelLabel(c.ui.outlineLevel), options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: levelLabel(n) })),
            onChange: (v) => c.setUi({ outlineLevel: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((n) => levelLabel(n) === v) ?? 10 }) },
        ],
      },
      { id: 'close', label: T.groups.close, icon: 'dismiss', controls: [{ kind: 'button', id: 'close', label: cmd.closeOutline, icon: 'dismiss', size: 'large', onClick: () => c.setUi({ view: 'print' }) }] },
    ],
  };
}
