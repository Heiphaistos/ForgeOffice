// Groupes ajoutes a l'onglet « Disposition du tableau » (parite Word) : Tableau, Taille de la cellule, fractionner, convertir.
import type { MenuItem, RibbonGroup } from '@forgeoffice/ui';
import type { TableRowProps } from '@forgeoffice/docx';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { cmToPt, ptToCm } from '../ribbon/shared.ts';
import { alignCells, applyBorders, lineBorder, type BorderSide } from './borders.ts';
import { autoFit, equalizeColumns, equalizeRows, selectTablePart, setColumnWidth, setRowHeight, splitTable, tableRect, tableToText } from './commands.ts';

const C = X.tableCmd;

/** Mesure en pixels la ligne dont le noeud commence a `pos` (hauteur affichee). */
function measureRow(c: Ctl, pos: number): number {
  const dom = c.view()?.nodeDOM(pos);
  return dom instanceof HTMLElement ? dom.getBoundingClientRect().height / (Number(getComputedStyle(dom).zoom) || 1) : 0;
}

export function tableTopGroups(c: Ctl): RibbonGroup[] {
  return [{
    id: 'tableSel', label: C.tableGroup, icon: 'table_settings',
    controls: [
      { kind: 'menu', id: 'select', label: C.select, icon: 'table_cell_edit', size: 'large', items: [
        { id: 'sc', label: C.selCell, onClick: () => c.run(selectTablePart('cell')) },
        { id: 'sk', label: C.selCol, onClick: () => c.run(selectTablePart('column')) },
        { id: 'sr', label: C.selRow, onClick: () => c.run(selectTablePart('row')) },
        { id: 'st', label: C.selTable, onClick: () => c.run(selectTablePart('table')) },
      ] },
      { kind: 'button', id: 'props', label: C.properties, icon: 'table_settings', onClick: () => c.openDialog('tableProps') },
    ],
  }];
}

export function tableSizeGroups(c: Ctl): RibbonGroup[] {
  const state = c.state();
  const r = state ? tableRect(state) : null;
  const row = r?.table.maybeChild(r.top);
  const height = (row?.attrs.props as TableRowProps | undefined)?.height;
  const colPt = r ? (r.table.attrs.grid as number[])[r.left] ?? 0 : 0;
  return [
    {
      id: 'cellSize', label: C.cellSize, icon: 'resize',
      controls: [
        { kind: 'menu', id: 'autofit', label: C.autoFit, icon: 'table_resize_column', size: 'large', items: [
          { id: 'fc', label: C.fitContents, onClick: () => c.run(autoFit('contents')) },
          { id: 'fw', label: C.fitWindow, onClick: () => c.run(autoFit('window')) },
          { id: 'ff', label: C.fitFixed, onClick: () => c.run(autoFit('fixed')) },
        ] },
        { kind: 'number', id: 'rowheight', label: C.height, value: ptToCm(height?.value ?? 0), min: 0, max: 55, step: 0.1, unit: 'cm', width: 70, onChange: (v) => c.run(setRowHeight(v > 0 ? { value: cmToPt(v), rule: 'atLeast' } : undefined)) },
        { kind: 'number', id: 'colwidth', label: C.width, value: ptToCm(colPt), min: 0.1, max: 55, step: 0.1, unit: 'cm', width: 70, onChange: (v) => c.run(setColumnWidth(cmToPt(v))) },
        { kind: 'button', id: 'eqrows', label: C.equalRows, icon: 'table_resize_row', onClick: () => c.run(equalizeRows((pos) => measureRow(c, pos))) },
        { kind: 'button', id: 'eqcols', label: C.equalCols, icon: 'table_resize_column', onClick: () => c.run(equalizeColumns) },
      ],
    },
    {
      id: 'tableOps', label: C.tableGroup, icon: 'table',
      controls: [
        { kind: 'button', id: 'splittable', label: C.splitTable, icon: 'table_split', onClick: () => c.run(splitTable) },
        { kind: 'button', id: 'totext', label: C.toText, icon: 'text_align_left', onClick: () => c.run(tableToText) },
      ],
    },
  ];
}

const B = X.borders;
const STYLES = [['single', B.single], ['double', B.double], ['dotted', B.dotted], ['dashed', B.dashed], ['dotDash', B.dotDash], ['thick', B.thick]] as const;
const WIDTHS = ['0.25', '0.5', '0.75', '1', '1.5', '2.25', '3', '4.5', '6'];

/** Groupe « Creation de bordures » : trait (style, epaisseur, couleur) et menu Bordures. */
export function tableBorderGroups(c: Ctl): RibbonGroup[] {
  const pen = c.ui.borderPen;
  const apply = (side: BorderSide): void => {
    c.run(applyBorders(side, lineBorder({ style: pen.style, width: pen.width, color: pen.color === 'auto' ? 'auto' : pen.color.replace('#', '').toUpperCase() })));
  };
  const items: [BorderSide, string][] = [['all', B.all], ['outer', B.outer], ['inner', B.inner], ['top', B.top], ['bottom', B.bottom], ['left', B.left], ['right', B.right], ['insideH', B.insideH], ['insideV', B.insideV]];
  return [{
    id: 'borderpen', label: B.group, icon: 'border_all',
    controls: [
      { kind: 'combo', id: 'penstyle', label: B.style, value: STYLES.find(([id]) => id === pen.style)?.[1] ?? B.single, options: STYLES.map(([, label]) => ({ value: label })), width: 120,
        onChange: (v) => c.setUi({ borderPen: { ...pen, style: STYLES.find(([, label]) => label === v)?.[0] ?? 'single' } }) },
      { kind: 'combo', id: 'penwidth', label: B.width, value: `${pen.width} pt`, options: WIDTHS.map((w) => ({ value: `${w} pt` })), width: 90,
        onChange: (v) => c.setUi({ borderPen: { ...pen, width: Number.parseFloat(v) || pen.width } }) },
      { kind: 'color', id: 'pencolor', label: B.color, icon: 'edit', value: pen.color === 'auto' ? '#000000' : pen.color, emptyMode: 'automatic', onChange: (hex) => c.setUi({ borderPen: { ...pen, color: hex ?? 'auto' } }) },
      { kind: 'menu', id: 'bordermenu', label: B.menu, icon: 'border_all', size: 'large', items: [
        ...items.map(([id, label]): MenuItem => ({ id, label, onClick: () => apply(id) })),
        { id: 'none', label: B.none, onClick: () => c.run(applyBorders('none', null)) },
      ] },
    ],
  }];
}

/** Menu « Alignement du texte » a 9 positions pour les cellules. */
export function tableAlignMenu(c: Ctl): RibbonGroup['controls'][number] {
  const pos: [string, 'left' | 'center' | 'right', 'top' | 'center' | 'bottom'][] = [
    [B.topLeft, 'left', 'top'], [B.topCenter, 'center', 'top'], [B.topRight, 'right', 'top'],
    [B.midLeft, 'left', 'center'], [B.midCenter, 'center', 'center'], [B.midRight, 'right', 'center'],
    [B.botLeft, 'left', 'bottom'], [B.botCenter, 'center', 'bottom'], [B.botRight, 'right', 'bottom'],
  ];
  return { kind: 'menu', id: 'align9', label: B.align, icon: 'align_center_horizontal', items: pos.map(([label, h, v], i): MenuItem => ({ id: `a${i}`, label, onClick: () => c.run(alignCells(h, v)) })) };
}
