// Lecture .ods (suite) : texte enrichi, commentaires, validations, mises en forme conditionnelles (style:map et
// table:conditional-formats), volets figes et zoom (settings.xml), graphiques de base.
import { isElement, textOf, type OpcPackage, type XmlElement } from '@forgeoffice/opc';
import { columnIndex } from '../address.ts';
import type {
  CellRange, CfOperator, CfRule, ChartModel, ChartObject, ChartPlotType, ChartSeries, ConditionalFormat, DataValidation,
  DifferentialFormat, Font, Note, RichRun, Sheet, Workbook,
} from '../model.ts';
import { kid, kids, localName, str } from '../xlsx/xml-util.ts';
import { lengthToPt, odfToExcelFormula } from './ods-common.ts';

const MAX_ITEMS = 50_000;

// ---------------------------------------------------------------- Texte enrichi et commentaires

/** Texte des enfants d'un paragraphe, avec les passages stylises (« text:span ») en series (`runs`). */
export function paragraphRuns(paragraphs: XmlElement[], textStyles: ReadonlyMap<string, Partial<Font>>): { text: string; rich?: RichRun[] } {
  const runs: RichRun[] = [];
  let styled = false;
  const push = (text: string, font: Partial<Font> | undefined): void => {
    if (!text) return;
    const last = runs[runs.length - 1];
    if (last && last.font === font) last.text += text;
    else runs.push(font ? { text, font } : { text });
  };
  const walk = (node: XmlElement, font: Partial<Font> | undefined): void => {
    for (const child of node.children) {
      if (typeof child === 'string') {
        push(child, font);
        continue;
      }
      const name = localName(child.name);
      if (name === 's') push(' '.repeat(Math.min(Number(child.attrs['text:c'] ?? 1) || 1, 1000)), font);
      else if (name === 'tab') push('\t', font);
      else if (name === 'line-break') push('\n', font);
      else if (name === 'annotation') continue;
      else if (name === 'span') {
        const own = textStyles.get(child.attrs['text:style-name'] ?? '');
        if (own && Object.keys(own).length) styled = true;
        walk(child, own ?? font);
      } else walk(child, font);
    }
  };
  paragraphs.forEach((p, i) => {
    if (i > 0) push('\n', undefined);
    walk(p, undefined);
  });
  const text = runs.map((r) => r.text).join('');
  return styled ? { text, rich: runs } : { text };
}

export function readAnnotation(node: XmlElement, ref: { row: number; col: number }, textStyles: ReadonlyMap<string, Partial<Font>>): Note {
  const author = textOf(kid(node, 'creator'));
  const content = paragraphRuns(kids(node, 'p'), textStyles);
  const note: Note = { ref, author, text: content.text };
  if (node.attrs['office:display'] === 'true') note.visible = true;
  return note;
}

// ---------------------------------------------------------------- Adresses ODF

/** Plage ODF (« Feuil1.$A$2:.$B$5 », « $'Ma feuille'.A1:C3 ») -> plage et nom de feuille. */
export function parseOdfRange(raw: string): { sheet?: string; range: CellRange } | undefined {
  const parts = raw.trim().split(':');
  const cells = parts.map((part) => {
    const m = part.match(/^(?:\$?(?:'((?:[^']|'')+)'|([^.'$]+))?\.)?\$?([A-Za-z]{1,3})\$?(\d+)$/);
    if (!m) return undefined;
    return { sheet: m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2], col: columnIndex(m[3] ?? ''), row: Number(m[4]) - 1 };
  });
  const a = cells[0];
  const b = cells[1] ?? a;
  if (!a || !b || a.row < 0 || b.row < 0) return undefined;
  const range: CellRange = { r1: Math.min(a.row, b.row), r2: Math.max(a.row, b.row), c1: Math.min(a.col, b.col), c2: Math.max(a.col, b.col) };
  return a.sheet ? { sheet: a.sheet, range } : { range };
}

export function parseOdfRanges(raw: string | undefined): CellRange[] {
  return (raw ?? '').split(/\s+/).filter(Boolean).map((r) => parseOdfRange(r)?.range).filter((r): r is CellRange => r !== undefined);
}

/** Fusionne des plages d'une cellule : meme etendue de colonnes sur des lignes consecutives. */
export function mergeRuns(runs: CellRange[]): CellRange[] {
  const sorted = [...runs].sort((a, b) => a.c1 - b.c1 || a.c2 - b.c2 || a.r1 - b.r1);
  const out: CellRange[] = [];
  for (const run of sorted) {
    const last = out[out.length - 1];
    if (last && last.c1 === run.c1 && last.c2 === run.c2 && run.r1 <= last.r2 + 1) last.r2 = Math.max(last.r2, run.r2);
    else out.push({ ...run });
  }
  return out;
}

// ---------------------------------------------------------------- Validations

function splitArgs(raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charAt(i);
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === '(' || ch === '[')) depth++;
    else if (!quoted && (ch === ')' || ch === ']')) depth--;
    else if (!quoted && depth === 0 && (ch === ';' || ch === ',')) {
      out.push(raw.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(raw.slice(start).trim());
  return out.filter((s) => s !== '');
}

const VALUE_OPERATORS: Record<string, NonNullable<DataValidation['operator']>> = {
  'is-between': 'between', 'is-not-between': 'notBetween', 'is-equal-to': 'equal', 'is-not-equal-to': 'notEqual',
  'is-greater-than': 'greaterThan', 'is-less-than': 'lessThan', 'is-greater-than-or-equal-to': 'greaterThanOrEqual',
  'is-less-than-or-equal-to': 'lessThanOrEqual',
};

/** Condition ODF (« of:cell-content-is-whole-number() and cell-content-is-between(1,100) ») -> validation sans plages. */
export function parseValidationCondition(condition: string): Omit<DataValidation, 'ranges'> | undefined {
  const text = condition.replace(/^of:/, '').replace(/\bof:/g, '');
  const result: Omit<DataValidation, 'ranges'> = { type: 'none' };
  for (const clause of text.split(/\s+and\s+/)) {
    const m = clause.trim().match(/^([a-z-]+)\((.*)\)$/s);
    if (!m) return undefined;
    const name = m[1] ?? '';
    const args = splitArgs(m[2] ?? '');
    if (name.startsWith('cell-content-text-length-is-')) result.type = 'textLength';
    if (name === 'cell-content-is-whole-number') result.type = 'whole';
    else if (name === 'cell-content-is-decimal-number') result.type = 'decimal';
    else if (name === 'cell-content-is-date') result.type = 'date';
    else if (name === 'cell-content-is-time') result.type = 'time';
    else if (name === 'cell-content-text-length') result.type = 'textLength';
    else if (name === 'is-true-formula') {
      result.type = 'custom';
      result.formula1 = odfToExcelFormula(m[2] ?? '');
    } else if (name === 'cell-content-is-in-list') {
      result.type = 'list';
      result.formula1 = args.length === 1 && /^\[/.test(args[0] ?? '') ? odfToExcelFormula(args[0] ?? '') : args.length === 1 ? (args[0] ?? '') : `"${args.map((a) => a.replace(/^"|"$/g, '')).join(',')}"`;
    } else {
      const op = VALUE_OPERATORS[name.replace(/^cell-content-(?:text-length-)?/, '')];
      if (!op) return undefined;
      result.operator = op;
      result.formula1 = odfToExcelFormula(args[0] ?? '');
      if (args[1] !== undefined) result.formula2 = odfToExcelFormula(args[1]);
    }
  }
  return result;
}

export function readValidations(spreadsheet: XmlElement | undefined): Map<string, Omit<DataValidation, 'ranges'>> {
  const out = new Map<string, Omit<DataValidation, 'ranges'>>();
  for (const node of kids(kid(spreadsheet, 'content-validations'), 'content-validation')) {
    const name = str(node, 'table:name');
    const parsed = parseValidationCondition(str(node, 'table:condition') ?? '');
    if (!name || !parsed || out.size >= MAX_ITEMS) continue;
    const v = parsed;
    v.allowBlank = str(node, 'table:allow-empty-cell') !== 'false';
    const list = str(node, 'table:display-list');
    if (list === 'none') v.inCellDropdown = false;
    const help = kid(node, 'help-message');
    if (help) {
      if (str(help, 'table:display') === 'true') v.showInputMessage = true;
      const title = str(help, 'table:title');
      if (title) v.promptTitle = title;
      const body = kids(help, 'p').map((p) => textOf(p)).join('\n');
      if (body) v.prompt = body;
    }
    const error = kid(node, 'error-message');
    if (error) {
      if (str(error, 'table:display') === 'true') v.showErrorMessage = true;
      const kind = str(error, 'table:message-type');
      if (kind === 'warning' || kind === 'information') v.errorStyle = kind;
      const title = str(error, 'table:title');
      if (title) v.errorTitle = title;
      const body = kids(error, 'p').map((p) => textOf(p)).join('\n');
      if (body) v.error = body;
    }
    out.set(name, v);
  }
  return out;
}

// ---------------------------------------------------------------- Mises en forme conditionnelles

const CELL_OPS: [string, CfOperator][] = [['>=', 'greaterThanOrEqual'], ['<=', 'lessThanOrEqual'], ['!=', 'notEqual'], ['<>', 'notEqual'], ['=', 'equal'], ['>', 'greaterThan'], ['<', 'lessThan']];

/** Condition ODF d'une mise en forme conditionnelle -> regle (sans format). */
export function parseCfCondition(condition: string, priority: number): CfRule | undefined {
  const text = condition.replace(/^of:/, '').replace(/\bof:/g, '').trim();
  const direct = text.match(/^cell-content\(\)\s*(>=|<=|!=|<>|=|>|<)\s*(.+)$/s);
  if (direct) {
    const op = CELL_OPS.find(([symbol]) => symbol === direct[1])?.[1];
    return op ? { type: 'cellIs', priority, operator: op, formulas: [odfToExcelFormula(direct[2] ?? '')] } : undefined;
  }
  const m = text.match(/^([a-z-]+)\((.*)\)$/s);
  if (!m) return undefined;
  const name = m[1] ?? '';
  const args = splitArgs(m[2] ?? '');
  if (name === 'is-true-formula' || name === 'formula-is') return { type: 'expression', priority, formulas: [odfToExcelFormula(m[2] ?? '')] };
  const op = VALUE_OPERATORS[name.replace(/^cell-content-/, '')];
  if (op && (name.startsWith('cell-content-'))) return { type: 'cellIs', priority, operator: op, formulas: args.map((a) => odfToExcelFormula(a)) };
  return undefined;
}

export type CellStyleLookup = (name: string) => DifferentialFormat | undefined;

/** Cellules (plages d'une cellule) qui utilisent un style portant des « style:map » : une regle par condition. */
export function conditionalFromStyleMaps(
  maps: ReadonlyMap<string, { conditions: { condition: string; style: string }[]; runs: CellRange[] }>,
  dxfOf: (style: string) => number | undefined,
): ConditionalFormat[] {
  const out: ConditionalFormat[] = [];
  for (const { conditions, runs } of maps.values()) {
    const rules: CfRule[] = [];
    conditions.forEach((c, i) => {
      const rule = parseCfCondition(c.condition, i + 1);
      if (!rule) return;
      const dxfId = dxfOf(c.style);
      if (dxfId !== undefined) rule.dxfId = dxfId;
      rules.push(rule);
    });
    if (rules.length && runs.length && out.length < MAX_ITEMS) out.push({ ranges: mergeRuns(runs), rules });
  }
  return out;
}

const SCALE_TYPES: Record<string, 'min' | 'max' | 'percentile' | 'num' | 'formula' | 'percent'> = {
  minimum: 'min', maximum: 'max', percentile: 'percentile', value: 'num', formula: 'formula', percent: 'percent', 'auto-minimum': 'min', 'auto-maximum': 'max',
};

/** `table:conditional-formats` d'une feuille (ODF 1.2+ / LibreOffice) : conditions et echelles de couleurs. */
export function readConditionalFormats(table: XmlElement, dxfOf: (style: string) => number | undefined): ConditionalFormat[] {
  const out: ConditionalFormat[] = [];
  for (const cf of kids(kid(table, 'conditional-formats'), 'conditional-format')) {
    const ranges = parseOdfRanges(str(cf, 'table:target-range-address'));
    if (ranges.length === 0 || out.length >= MAX_ITEMS) continue;
    const rules: CfRule[] = [];
    for (const node of kids(cf)) {
      const name = localName(node.name);
      if (name === 'condition') {
        const rule = parseCfCondition(str(node, 'table:value') ?? str(node, 'table:condition') ?? '', rules.length + 1);
        const style = str(node, 'table:apply-style-name');
        if (!rule) continue;
        const dxfId = style ? dxfOf(style) : undefined;
        if (dxfId !== undefined) rule.dxfId = dxfId;
        rules.push(rule);
      } else if (name === 'color-scale') {
        const entries = kids(node, 'color-scale-entry');
        if (entries.length < 2) continue;
        rules.push({
          type: 'colorScale',
          priority: rules.length + 1,
          colorScale: {
            cfvos: entries.map((e) => {
              const type = SCALE_TYPES[str(e, 'calcext:type') ?? ''] ?? 'num';
              const value = str(e, 'calcext:value');
              return value !== undefined && type !== 'min' && type !== 'max' ? { type, value } : { type };
            }),
            colors: entries.map((e) => ({ rgb: `FF${(str(e, 'calcext:color') ?? '#000000').replace('#', '').toUpperCase()}` })),
          },
        });
      }
    }
    if (rules.length) out.push({ ranges, rules });
  }
  return out;
}

// ---------------------------------------------------------------- settings.xml : volets figes, zoom, quadrillage

function configItems(entry: XmlElement): Map<string, string> {
  const items = new Map<string, string>();
  for (const item of kids(entry, 'config-item')) items.set(str(item, 'config:name') ?? '', textOf(item));
  return items;
}

export function applySettings(root: XmlElement, wb: Workbook): void {
  const visit = (node: XmlElement, inTables: boolean): void => {
    for (const child of kids(node)) {
      const name = localName(child.name);
      if (name === 'config-item') continue;
      if (name === 'config-item-map-named') {
        visit(child, str(child, 'config:name') === 'Tables');
      } else if (name === 'config-item-map-entry' && inTables) {
        const sheet = wb.sheets.find((s) => s.name === str(child, 'config:name'));
        if (sheet) applyTableSettings(sheet, configItems(child));
      } else if (name === 'config-item-map-entry') {
        const zoom = Number(configItems(child).get('ZoomValue'));
        if (Number.isFinite(zoom) && zoom >= 10 && zoom <= 400) for (const s of wb.sheets) s.view.zoom = zoom;
        visit(child, false);
      } else visit(child, inTables);
    }
  };
  visit(root, false);
}

function applyTableSettings(sheet: Sheet, items: Map<string, string>): void {
  const cols = Number(items.get('HorizontalSplitPosition'));
  const rows = Number(items.get('VerticalSplitPosition'));
  const fixedH = items.get('HorizontalSplitMode') === '2';
  const fixedV = items.get('VerticalSplitMode') === '2';
  const frozenCols = fixedH && Number.isFinite(cols) ? Math.max(0, Math.min(cols, 16383)) : 0;
  const frozenRows = fixedV && Number.isFinite(rows) ? Math.max(0, Math.min(rows, 1_048_575)) : 0;
  if (frozenCols || frozenRows) sheet.view.frozen = { rows: frozenRows, cols: frozenCols };
  if (items.get('ShowGrid') === 'false') sheet.view.showGridLines = false;
  const zoom = Number(items.get('ZoomValue'));
  if (Number.isFinite(zoom) && zoom >= 10 && zoom <= 400) sheet.view.zoom = zoom;
}

// ---------------------------------------------------------------- Graphiques

const CHART_CLASSES: Record<string, ChartPlotType> = {
  'chart:bar': 'bar', 'chart:line': 'line', 'chart:area': 'area', 'chart:circle': 'pie', 'chart:ring': 'doughnut',
  'chart:scatter': 'scatter', 'chart:radar': 'radar', 'chart:filled-radar': 'radar', 'chart:bubble': 'bubble',
};

function odfSheetRef(raw: string | undefined): string | undefined {
  const parsed = raw ? parseOdfRange(raw.replace(/\$/g, '').replace(/:\./, ':')) : undefined;
  if (!parsed || !parsed.sheet) return undefined;
  const a1 = (r: number, c: number): string => `${columnName(c)}${r + 1}`;
  const { range } = parsed;
  const local = range.r1 === range.r2 && range.c1 === range.c2 ? a1(range.r1, range.c1) : `${a1(range.r1, range.c1)}:${a1(range.r2, range.c2)}`;
  return `${/^[A-Za-z_][\w.]*$/.test(parsed.sheet) ? parsed.sheet : `'${parsed.sheet.replace(/'/g, "''")}'`}!${local}`;
}

function columnName(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Graphique OpenDocument (sous-document « Object N ») -> modele de graphique de base. */
export function readChartDocument(root: XmlElement): ChartModel | undefined {
  const chart = kid(kid(kid(root, 'body'), 'chart'), 'chart');
  if (!chart) return undefined;
  const type = CHART_CLASSES[str(chart, 'chart:class') ?? ''];
  if (!type) return undefined;
  const plotArea = kid(chart, 'plot-area');
  const categories = str(kid(kid(plotArea, 'axis'), 'categories'), 'table:cell-range-address')
    ?? str(kid(kids(plotArea, 'axis').find((a) => str(a, 'chart:dimension') === 'x'), 'categories'), 'table:cell-range-address');
  const catRef = odfSheetRef(categories);
  const series: ChartSeries[] = kids(plotArea, 'series').flatMap((s, i): ChartSeries[] => {
    const values = odfSheetRef(str(s, 'chart:values-cell-range-address'));
    if (!values) return [];
    const name = odfSheetRef(str(s, 'chart:label-cell-address'));
    return [{
      idx: i, order: i, values: { ref: values },
      ...(name ? { name: { ref: name } } : {}),
      ...(catRef ? { categories: { ref: catRef } } : {}),
    }];
  });
  if (series.length === 0) return undefined;
  const title = textOf(kid(kid(chart, 'title'), 'p'));
  const model: ChartModel = {
    plots: [{ type, series, axisIds: type === 'pie' || type === 'doughnut' ? [] : [1, 2], ...(type === 'bar' ? { barDirection: 'col' as const, grouping: 'clustered' as const } : {}) }],
    axes: type === 'pie' || type === 'doughnut' ? [] : [
      { id: 1, kind: 'category', position: 'b', crossAxisId: 2 },
      { id: 2, kind: 'value', position: 'l', crossAxisId: 1, majorGridlines: true },
    ],
  };
  if (title) model.title = { text: title };
  const legend = kid(chart, 'legend');
  if (legend) {
    const pos = str(legend, 'chart:legend-position');
    model.legend = { position: pos === 'start' ? 'l' : pos === 'top' ? 't' : pos === 'bottom' ? 'b' : 'r' };
  }
  return model;
}

export interface OdsFrame {
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}

export function readFrame(frame: XmlElement): OdsFrame | undefined {
  const object = kid(frame, 'object');
  const href = str(object, 'xlink:href');
  if (!object || !href) return undefined;
  const pt = (key: string): number => lengthToPt(str(frame, key)) ?? 0;
  return { href: href.replace(/^\.\//, '').replace(/\/$/, ''), x: pt('svg:x'), y: pt('svg:y'), width: pt('svg:width'), height: pt('svg:height'), name: str(frame, 'draw:name') ?? 'Graphique' };
}

export async function readFrameCharts(pkg: OpcPackage, sheet: Sheet, frames: OdsFrame[]): Promise<void> {
  for (const frame of frames) {
    const part = `${frame.href}/content.xml`;
    if (!pkg.has(part) || sheet.drawings.length >= 1000) continue;
    const chart = readChartDocument(await pkg.readXml(part));
    if (!chart) continue;
    const emu = (pt: number): number => Math.round(pt * 12700);
    const object: ChartObject = {
      kind: 'chart', name: frame.name, chart,
      anchor: { type: 'absolute', x: emu(frame.x), y: emu(frame.y), width: emu(frame.width), height: emu(frame.height) },
    };
    sheet.drawings.push(object);
  }
}

export function isFrame(node: XmlElement): boolean {
  return localName(node.name) === 'frame';
}

export { isElement };
