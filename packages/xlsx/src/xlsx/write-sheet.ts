// Ecriture d'une partie worksheet. Les donnees sont produites par concatenation de chaines (rapide
// sur des centaines de milliers de cellules) ; les sections structurees passent par l'arbre XML.
import { el, serializeXml, type XmlElement } from '@forgeoffice/opc';
import { cellName, rangeName, sqrefName } from '../address.ts';
import { MAX_COLS, type Cell, type HeaderFooter, type PasswordHash, type RichRun, type RowInfo, type Sheet, type SheetProtection } from '../model.ts';
import { toFileFormula } from './formula-names.ts';
import { NS_MAIN, NS_MC, NS_R, NS_X14AC } from './ns.ts';
import { colorEl, fontEl } from './style-xml.ts';
import { writeSheetRules } from './write-sheet-rules.ts';
import { b1, escAttr, escXml, textEl } from './xml-util.ts';

const MAX_TEXT = 32_767;

/** Table des chaines partagees : texte simple deduplique, texte enrichi conserve. */
export class SharedStringTable {
  readonly items: (string | RichRun[])[] = [];
  count = 0;
  private readonly index = new Map<string, number>();
  private readonly richIndex = new Map<string, number>();

  add(text: string, rich?: RichRun[]): number {
    this.count++;
    if (rich && rich.length) {
      const key = JSON.stringify(rich);
      const found = this.richIndex.get(key);
      if (found !== undefined) return found;
      this.items.push(rich);
      this.richIndex.set(key, this.items.length - 1);
      return this.items.length - 1;
    }
    const found = this.index.get(text);
    if (found !== undefined) return found;
    this.items.push(text);
    this.index.set(text, this.items.length - 1);
    return this.items.length - 1;
  }

  toXml(): XmlElement {
    return el('sst', { xmlns: NS_MAIN, count: this.count, uniqueCount: this.items.length }, this.items.map((item) => {
      if (typeof item === 'string') return el('si', {}, [textEl('t', item.slice(0, MAX_TEXT))]);
      return el('si', {}, item.map((run) => el('r', {}, [
        ...(run.font ? [fontEl('rPr', run.font, true)] : []),
        textEl('t', run.text),
      ])));
    }));
  }
}

/** Fragment XML sans en-tete. */
export function fragment(node: XmlElement): string {
  const xml = serializeXml(node);
  return xml.slice(xml.indexOf('?>') + 2).replace(/^\r?\n/, '');
}

export interface SheetWriteRefs {
  /** Identifiant de relation par lien hypertexte externe (meme ordre que `sheet.hyperlinks`). */
  hyperlinks: (string | undefined)[];
  drawing?: string;
  legacyDrawing?: string;
  tables: string[];
}

export interface SheetWriteResult {
  xml: string;
  /** Vrai si une formule matricielle dynamique a ete ecrite (partie metadata requise). */
  dynamicArrays: boolean;
}

function cellXml(ref: string, cell: Cell, sst: SharedStringTable, state: { dynamic: boolean }): string {
  const style = cell.styleId ? ` s="${cell.styleId}"` : '';
  const value = cell.value;
  let type = '';
  let v = '';
  if (typeof value === 'number') {
    if (Number.isFinite(value)) v = String(value);
    else {
      type = 'e';
      v = '#NUM!';
    }
  } else if (typeof value === 'string') {
    const text = value.length > MAX_TEXT ? value.slice(0, MAX_TEXT) : value;
    if (cell.formula !== undefined) {
      type = 'str';
      v = escXml(text);
    } else {
      type = 's';
      v = String(sst.add(text, cell.rich));
    }
  } else if (typeof value === 'boolean') {
    type = 'b';
    v = value ? '1' : '0';
  } else if (value !== null) {
    type = 'e';
    v = escXml(value.error);
  }
  let f = '';
  let cm = '';
  if (cell.shared) {
    if (cell.shared.ref && cell.formula !== undefined) {
      f = `<f t="shared" ref="${rangeName(cell.shared.ref)}" si="${cell.shared.index}">${escXml(toFileFormula(cell.formula))}</f>`;
    } else {
      f = `<f t="shared" si="${cell.shared.index}"/>`;
    }
  } else if (cell.array && cell.formula !== undefined) {
    f = `<f t="array" ref="${rangeName(cell.array.ref)}">${escXml(toFileFormula(cell.formula))}</f>`;
    if (cell.array.dynamic) {
      cm = ' cm="1"';
      state.dynamic = true;
    }
  } else if (cell.formula !== undefined) {
    f = `<f>${escXml(toFileFormula(cell.formula))}</f>`;
  }
  const t = type ? ` t="${type}"` : '';
  if (!f && v === '') return `<c r="${ref}"${style}${t}/>`;
  return `<c r="${ref}"${style}${t}${cm}>${f}${v === '' ? '' : `<v>${v}</v>`}</c>`;
}

function rowAttrs(info: RowInfo | undefined): string {
  if (!info) return '';
  let out = '';
  if (info.styleId) out += ` s="${info.styleId}" customFormat="1"`;
  if (info.height !== undefined) out += ` ht="${info.height}" customHeight="1"`;
  if (info.hidden) out += ' hidden="1"';
  if (info.outlineLevel) out += ` outlineLevel="${info.outlineLevel}"`;
  if (info.collapsed) out += ' collapsed="1"';
  if (info.thickTop) out += ' thickTop="1"';
  if (info.thickBottom) out += ' thickBot="1"';
  return out;
}

function sheetDataXml(sheet: Sheet, sst: SharedStringTable, state: { dynamic: boolean }): { xml: string; dimension: string } {
  const rowKeys = new Set<number>(sheet.cells.keys());
  for (const key of sheet.rows.keys()) rowKeys.add(key);
  const rows = [...rowKeys].sort((a, b) => a - b);
  const parts: string[] = ['<sheetData>'];
  let minRow = Infinity;
  let maxRow = -1;
  let minCol = Infinity;
  let maxCol = -1;
  for (const row of rows) {
    const line = sheet.cells.get(row);
    const info = sheet.rows.get(row);
    if ((!line || line.size === 0) && !info) continue;
    parts.push(`<row r="${row + 1}"${rowAttrs(info)}`);
    if (!line || line.size === 0) {
      parts.push('/>');
      continue;
    }
    parts.push('>');
    const cols = [...line.keys()].sort((a, b) => a - b);
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
    const first = cols[0] ?? 0;
    const last = cols[cols.length - 1] ?? 0;
    if (first < minCol) minCol = first;
    if (last > maxCol) maxCol = last;
    const rowLabel = String(row + 1);
    for (const col of cols) {
      const cell = line.get(col);
      if (cell) parts.push(cellXml(cellRef(col, rowLabel), cell, sst, state));
    }
    parts.push('</row>');
  }
  parts.push('</sheetData>');
  const dimension = maxRow < 0 ? 'A1' : rangeName({ r1: minRow, c1: minCol, r2: maxRow, c2: maxCol });
  return { xml: parts.join(''), dimension };
}

const COLUMN_NAMES: string[] = [];

function cellRef(col: number, rowLabel: string): string {
  let name = COLUMN_NAMES[col];
  if (name === undefined) {
    name = cellName(0, col).slice(0, -1);
    COLUMN_NAMES[col] = name;
  }
  return name + rowLabel;
}

function passwordAttrs(hash: PasswordHash | undefined): Record<string, string | number | undefined> {
  if (!hash) return {};
  return {
    password: hash.legacy,
    algorithmName: hash.algorithmName,
    hashValue: hash.hashValue,
    saltValue: hash.saltValue,
    spinCount: hash.spinCount,
  };
}

function protectionEl(p: SheetProtection): XmlElement {
  const denied = (allowed: boolean | undefined): string | undefined => (allowed ? '0' : undefined);
  return el('sheetProtection', {
    ...passwordAttrs(p.password),
    sheet: b1(p.sheet),
    objects: b1(p.objects),
    scenarios: b1(p.scenarios),
    formatCells: denied(p.allow.formatCells),
    formatColumns: denied(p.allow.formatColumns),
    formatRows: denied(p.allow.formatRows),
    insertColumns: denied(p.allow.insertColumns),
    insertRows: denied(p.allow.insertRows),
    insertHyperlinks: denied(p.allow.insertHyperlinks),
    deleteColumns: denied(p.allow.deleteColumns),
    deleteRows: denied(p.allow.deleteRows),
    selectLockedCells: p.allow.selectLockedCells === false ? '1' : undefined,
    sort: denied(p.allow.sort),
    autoFilter: denied(p.allow.autoFilter),
    pivotTables: denied(p.allow.pivotTables),
    selectUnlockedCells: p.allow.selectUnlockedCells === false ? '1' : undefined,
  });
}

function viewEl(sheet: Sheet): XmlElement {
  const view = sheet.view;
  const kidsOut: XmlElement[] = [];
  let pane: string | undefined;
  if (view.frozen && (view.frozen.rows > 0 || view.frozen.cols > 0)) {
    const { rows, cols } = view.frozen;
    pane = rows && cols ? 'bottomRight' : rows ? 'bottomLeft' : 'topRight';
    kidsOut.push(el('pane', {
      xSplit: cols || undefined,
      ySplit: rows || undefined,
      topLeftCell: cellName(rows, cols),
      activePane: pane,
      state: 'frozen',
    }));
  } else if (view.split && (view.split.x || view.split.y)) {
    pane = view.split.x && view.split.y ? 'bottomRight' : view.split.y ? 'bottomLeft' : 'topRight';
    kidsOut.push(el('pane', { xSplit: view.split.x || undefined, ySplit: view.split.y || undefined, activePane: pane }));
  }
  if (view.activeCell || view.selection) {
    const active = view.activeCell ?? { row: view.selection?.[0]?.r1 ?? 0, col: view.selection?.[0]?.c1 ?? 0 };
    kidsOut.push(el('selection', {
      pane,
      activeCell: cellName(active.row, active.col),
      sqref: view.selection ? sqrefName(view.selection) : cellName(active.row, active.col),
    }));
  } else if (pane) {
    kidsOut.push(el('selection', { pane }));
  }
  return el('sheetView', {
    showFormulas: b1(view.showFormulas),
    showGridLines: view.showGridLines ? undefined : '0',
    showRowColHeaders: view.showHeaders ? undefined : '0',
    showZeros: view.showZeros ? undefined : '0',
    rightToLeft: b1(view.rightToLeft),
    tabSelected: b1(view.tabSelected),
    defaultGridColor: view.gridColor?.indexed !== undefined ? '0' : undefined,
    view: view.view === 'normal' ? undefined : view.view,
    topLeftCell: view.topLeftCell ? cellName(view.topLeftCell.row, view.topLeftCell.col) : undefined,
    colorId: view.gridColor?.indexed,
    zoomScale: view.zoom === 100 ? undefined : view.zoom,
    zoomScaleNormal: view.zoom === 100 || view.view !== 'normal' ? undefined : view.zoom,
    workbookViewId: 0,
  }, kidsOut);
}

function headerFooterEl(hf: HeaderFooter): XmlElement {
  const keys = ['oddHeader', 'oddFooter', 'evenHeader', 'evenFooter', 'firstHeader', 'firstFooter'] as const;
  return el('headerFooter', {
    differentOddEven: b1(hf.differentOddEven),
    differentFirst: b1(hf.differentFirst),
    scaleWithDoc: hf.scaleWithDoc === false ? '0' : undefined,
    alignWithMargins: hf.alignWithMargins === false ? '0' : undefined,
  }, keys.flatMap((key) => (hf[key] ? [el(key, {}, [hf[key] ?? ''])] : [])));
}

function breaksEl(tag: string, breaks: number[], max: number): XmlElement[] {
  if (breaks.length === 0) return [];
  return [el(tag, { count: breaks.length, manualBreakCount: breaks.length }, breaks.map((id) => el('brk', { id: id + 1, max, man: '1' })))];
}

function outlineLevels(sheet: Sheet): { row: number; col: number } {
  let row = 0;
  for (const info of sheet.rows.values()) row = Math.max(row, info.outlineLevel ?? 0);
  let col = 0;
  for (const info of sheet.cols) col = Math.max(col, info.outlineLevel ?? 0);
  return { row, col };
}

function structuredHead(sheet: Sheet, dimension: string): string {
  const pr: XmlElement[] = [...colorEl('tabColor', sheet.tabColor)];
  const outline = sheet.outline;
  if (!outline.summaryBelow || !outline.summaryRight || !outline.showSymbols) {
    pr.push(el('outlinePr', {
      summaryBelow: outline.summaryBelow ? undefined : '0',
      summaryRight: outline.summaryRight ? undefined : '0',
      showOutlineSymbols: outline.showSymbols ? undefined : '0',
    }));
  }
  if (sheet.pageSetup.fitToPage) pr.push(el('pageSetUpPr', { fitToPage: '1' }));
  const head: XmlElement[] = [];
  if (pr.length || sheet.codeName) {
    head.push(el('sheetPr', { codeName: sheet.codeName }, pr));
  }
  head.push(el('dimension', { ref: dimension }));
  head.push(el('sheetViews', {}, [viewEl(sheet)]));
  const levels = outlineLevels(sheet);
  head.push(el('sheetFormatPr', {
    baseColWidth: sheet.baseColWidth,
    defaultColWidth: sheet.defaultColWidth,
    defaultRowHeight: sheet.defaultRowHeight,
    outlineLevelRow: levels.row || undefined,
    outlineLevelCol: levels.col || undefined,
  }));
  const cols = [...sheet.cols].filter((c) => c.max >= c.min && c.min < MAX_COLS).sort((a, b) => a.min - b.min);
  if (cols.length) {
    head.push(el('cols', {}, cols.map((c) => el('col', {
      min: c.min + 1,
      max: Math.min(c.max, MAX_COLS - 1) + 1,
      width: c.width ?? sheet.defaultColWidth ?? 8.88671875,
      style: c.styleId || undefined,
      hidden: b1(c.hidden),
      bestFit: b1(c.bestFit),
      customWidth: c.width !== undefined ? '1' : undefined,
      outlineLevel: c.outlineLevel || undefined,
      collapsed: b1(c.collapsed),
    }))));
  }
  return head.map(fragment).join('');
}

function structuredTail(sheet: Sheet, refs: SheetWriteRefs): { beforeMerge: string; rest: string } {
  const before: XmlElement[] = [];
  if (sheet.protection) before.push(protectionEl(sheet.protection));
  if (sheet.protectedRanges.length) {
    before.push(el('protectedRanges', {}, sheet.protectedRanges.map((p) => el('protectedRange', {
      ...passwordAttrs(p.password),
      sqref: sqrefName(p.ranges),
      name: p.name,
    }))));
  }
  const rules = writeSheetRules(sheet);
  if (rules.autoFilter) before.push(rules.autoFilter);
  if (rules.sort) before.push(rules.sort);
  const rest: XmlElement[] = [];
  if (sheet.merges.length) rest.push(el('mergeCells', { count: sheet.merges.length }, sheet.merges.map((m) => el('mergeCell', { ref: rangeName(m) }))));
  rest.push(...rules.conditional);
  if (rules.validations) rest.push(rules.validations);
  if (sheet.hyperlinks.length) {
    rest.push(el('hyperlinks', {}, sheet.hyperlinks.map((link, i) => el('hyperlink', {
      ref: rangeName(link.ref),
      'r:id': refs.hyperlinks[i],
      location: link.location,
      tooltip: link.tooltip,
      display: link.display,
    }))));
  }
  const setup = sheet.pageSetup;
  if (setup.printGridLines || setup.printHeadings || setup.horizontalCentered || setup.verticalCentered) {
    rest.push(el('printOptions', {
      horizontalCentered: b1(setup.horizontalCentered),
      verticalCentered: b1(setup.verticalCentered),
      headings: b1(setup.printHeadings),
      gridLines: b1(setup.printGridLines),
    }));
  }
  rest.push(el('pageMargins', { ...setup.margins }));
  rest.push(el('pageSetup', {
    paperSize: setup.paperSize,
    scale: setup.scale,
    firstPageNumber: setup.firstPageNumber,
    fitToWidth: setup.fitToWidth,
    fitToHeight: setup.fitToHeight,
    pageOrder: setup.pageOrder === 'overThenDown' ? 'overThenDown' : undefined,
    orientation: setup.orientation,
    blackAndWhite: b1(setup.blackAndWhite),
    draft: b1(setup.draft),
    cellComments: setup.cellComments && setup.cellComments !== 'none' ? setup.cellComments : undefined,
    useFirstPageNumber: setup.firstPageNumber !== undefined ? '1' : undefined,
    errors: setup.errors && setup.errors !== 'displayed' ? setup.errors : undefined,
  }));
  if (setup.headerFooter) rest.push(headerFooterEl(setup.headerFooter));
  rest.push(...breaksEl('rowBreaks', setup.rowBreaks, MAX_COLS - 1));
  rest.push(...breaksEl('colBreaks', setup.colBreaks, 1_048_575));
  if (refs.drawing) rest.push(el('drawing', { 'r:id': refs.drawing }));
  if (refs.legacyDrawing) rest.push(el('legacyDrawing', { 'r:id': refs.legacyDrawing }));
  if (refs.tables.length) rest.push(el('tableParts', { count: refs.tables.length }, refs.tables.map((id) => el('tablePart', { 'r:id': id }))));
  if (rules.extensions.length) rest.push(el('extLst', {}, rules.extensions));
  return { beforeMerge: before.map(fragment).join(''), rest: rest.map(fragment).join('') };
}

export function writeWorksheet(sheet: Sheet, sst: SharedStringTable, refs: SheetWriteRefs): SheetWriteResult {
  const state = { dynamic: false };
  const data = sheetDataXml(sheet, sst, state);
  const tail = structuredTail(sheet, refs);
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
    + `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}" xmlns:mc="${NS_MC}" mc:Ignorable="x14ac" xmlns:x14ac="${NS_X14AC}">`
    + structuredHead(sheet, data.dimension)
    + data.xml
    + tail.beforeMerge
    + tail.rest
    + '</worksheet>';
  return { xml, dynamicArrays: state.dynamic };
}

/** Feuille graphique : un seul dessin plein ecran. */
export function writeChartsheet(sheet: Sheet, drawingId: string): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
    + `<chartsheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}">`
    + `${sheet.tabColor ? fragment(el('sheetPr', {}, colorEl('tabColor', sheet.tabColor))) : ''}`
    + `<sheetViews><sheetView${sheet.view.tabSelected ? ' tabSelected="1"' : ''} zoomToFit="1" workbookViewId="0"/></sheetViews>`
    + `<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>`
    + `<drawing r:id="${escAttr(drawingId)}"/></chartsheet>`;
}
