// Commandes de tableau (taille, uniformiser, selection, fractionner, conversions) sur un vrai document ProseMirror.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';
import { CellSelection } from 'prosemirror-tables';
import { createSchema } from '../src/editor/schema.ts';
import { createTable } from '../src/editor/commands.ts';
import { alignCells, applyBorders, lineBorder, shadeCells } from '../src/tables/borders.ts';
import { autoFit, equalizeColumns, selectTablePart, setColumnWidth, setRowHeight, setTableProps, splitCells, splitTable, tableToText, textToTable } from '../src/tables/commands.ts';

const schema = createSchema();
const para = (t: string) => schema.nodes.paragraph!.create(null, t ? schema.text(t) : null);

function stateIn(rows: number, cols: number, cell = [1, 1]): EditorState {
  const doc = schema.nodes.doc!.create(null, [para('avant'), createTable(schema, rows, cols, 300), para('apres')]);
  const base = EditorState.create({ doc });
  let pos = 0;
  let n = 0;
  doc.descendants((node, p) => { if (node.type.name === 'table_cell' && n++ === cell[0]! * cols + cell[1]!) pos = p + 2; });
  return base.apply(base.tr.setSelection(TextSelection.create(doc, pos)));
}
const apply = (s: EditorState, cmd: (st: EditorState, d: (tr: Transaction) => void) => boolean): EditorState => {
  let out = s;
  assert.ok(cmd(s, (tr) => { out = s.apply(tr); }));
  return out;
};
const table = (s: EditorState) => { let t = null as null | ReturnType<typeof s.doc.nodeAt>; s.doc.descendants((n) => { if (n.type.name === 'table') t = n; }); return t!; };

test('largeur de colonne : cellules et grille', () => {
  const s = apply(stateIn(2, 3), setColumnWidth(100));
  const t = table(s);
  assert.equal((t.attrs.grid as number[])[1], 100);
  assert.deepEqual(t.child(0).child(1).attrs.colwidth, [133]);
  assert.deepEqual(t.child(1).child(1).attrs.colwidth, [133]);
  assert.deepEqual(t.child(0).child(0).attrs.colwidth, [Math.round(100 * 4 / 3)]);
});

test('hauteur de ligne', () => {
  const s = apply(stateIn(3, 2), setRowHeight({ value: 40, rule: 'atLeast' }));
  assert.deepEqual(table(s).child(1).attrs.props.height, { value: 40, rule: 'atLeast' });
  assert.equal(table(s).child(0).attrs.props.height, undefined);
});

test('uniformiser les colonnes (une cellule = tout le tableau)', () => {
  let s = apply(stateIn(2, 2), setColumnWidth(50));
  s = apply(s, equalizeColumns);
  const grid = table(s).attrs.grid as number[];
  assert.equal(grid[0], grid[1]);
  assert.equal(grid[0], (50 + 150) / 2);
});

test('ajustement automatique et proprietes', () => {
  let s = apply(stateIn(2, 2), autoFit('window'));
  assert.deepEqual(table(s).attrs.props.width, { value: 100, type: 'pct' });
  s = apply(s, autoFit('contents'));
  assert.equal(table(s).child(0).child(0).attrs.colwidth, null);
  s = apply(s, setTableProps({ alignment: 'center', caption: 'Titre' }));
  assert.equal(table(s).attrs.props.alignment, 'center');
  assert.equal(table(s).attrs.props.caption, 'Titre');
});

test('selectionner colonne / ligne / tableau', () => {
  const s = stateIn(3, 3);
  const col = apply(s, selectTablePart('column')).selection as CellSelection;
  assert.equal(col.$anchorCell.pos < col.$headCell.pos, true);
  let n = 0;
  col.forEachCell(() => n++);
  assert.equal(n, 3);
  n = 0;
  (apply(s, selectTablePart('table')).selection as CellSelection).forEachCell(() => n++);
  assert.equal(n, 9);
});

test('fractionner le tableau avant la ligne du curseur', () => {
  const s = apply(stateIn(3, 2, [1, 0]), splitTable);
  const kinds: string[] = [];
  s.doc.forEach((n) => kinds.push(n.type.name + (n.type.name === 'table' ? n.childCount : '')));
  assert.deepEqual(kinds, ['paragraph', 'table1', 'paragraph', 'table2', 'paragraph']);
  assert.equal(stateIn(3, 2, [0, 0]) && splitTable(stateIn(3, 2, [0, 0]), undefined), false);
});

test('tableau -> texte et texte -> tableau', () => {
  const doc = schema.nodes.doc!.create(null, [para('a;b;c'), para('d;e')]);
  let s = EditorState.create({ doc });
  s = s.apply(s.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)));
  s = apply(s, textToTable(';'));
  const t = table(s);
  assert.equal(t.childCount, 2);
  assert.equal(t.child(0).childCount, 3);
  assert.equal(t.child(1).child(2).textContent, '');
  assert.equal(t.child(1).child(1).textContent, 'e');
  let pos = 0;
  s.doc.descendants((n, p) => { if (n.type.name === 'table_cell' && !pos) pos = p + 2; });
  s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, pos)));
  s = apply(s, tableToText);
  assert.deepEqual([...Array(s.doc.childCount).keys()].map((i) => s.doc.child(i).textContent), ['a\tb\tc', 'd\te\t']);
  assert.deepEqual(splitCells('a\tb', '\t'), ['a', 'b']);
});


const cellsOf = (s: EditorState) => { const out: Record<string, unknown>[] = []; table(s).forEach((row) => row.forEach((cell) => out.push(cell.attrs.props as Record<string, unknown>))); return out; };
const sides = (p: Record<string, unknown>): string => ['top', 'bottom', 'left', 'right'].filter((k) => (p.borders as Record<string, { style: string }> | undefined)?.[k]?.style === 'single').join(',');

test('bordures : tout, puis aucune, sur une cellule du milieu (voisins mis a jour)', () => {
  let s = apply(stateIn(3, 3, [1, 1]), applyBorders('all', lineBorder()));
  const cells = cellsOf(s);
  assert.equal(sides(cells[4]!), 'top,bottom,left,right');
  assert.equal(sides(cells[1]!), 'bottom'); // au-dessus
  assert.equal(sides(cells[7]!), 'top');
  assert.equal(sides(cells[3]!), 'right');
  assert.equal(sides(cells[0]!), '');
  s = apply(s, applyBorders('none', null));
  assert.equal(sides(cellsOf(s)[4]!), '');
  assert.equal(sides(cellsOf(s)[1]!), '');
});

test('bordures : bord haut et interieur sur tout le tableau', () => {
  let s = apply(stateIn(2, 2, [0, 0]), selectTablePart('table'));
  s = apply(s, applyBorders('top', lineBorder({ width: 2 })));
  assert.equal(sides(cellsOf(s)[0]!), 'top');
  assert.equal(sides(cellsOf(s)[1]!), 'top');
  assert.equal(sides(cellsOf(s)[2]!), '');
  s = apply(s, applyBorders('insideV', lineBorder()));
  assert.ok(sides(cellsOf(s)[0]!).includes('right'));
  assert.ok(sides(cellsOf(s)[1]!).includes('left'));
});

test('trame et alignement 9 positions', () => {
  let s = apply(stateIn(2, 2, [0, 1]), shadeCells('FFFF00'));
  assert.deepEqual((cellsOf(s)[1] as { shading: { fill: string } }).shading.fill, 'FFFF00');
  s = apply(s, alignCells('center', 'bottom'));
  const cell = table(s).child(0).child(1);
  assert.equal((cell.attrs.props as { verticalAlign: string }).verticalAlign, 'bottom');
  assert.equal((cell.child(0).attrs.props as { alignment: string }).alignment, 'center');
  assert.equal(table(s).child(0).child(0).child(0).attrs.props.alignment, undefined);
});
