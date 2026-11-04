// Lecture des regles d'une feuille : mises en forme conditionnelles (avec extensions 2010), validations,
// filtre automatique, tris, graphiques sparkline.
import { textOf, type XmlElement } from '@forgeoffice/opc';
import { parseCell, parseRange, parseSqref } from '../address.ts';
import type {
  AutoFilter, CfOperator, CfRule, CfRuleType, Cfvo, ColumnFilter, CustomFilterOperator, DataBar, DataValidation,
  DateGroupItem, FilterColumn, IconSetName, Sheet, SortCondition, SortState, SparklineGroup, TimePeriod,
} from '../model.ts';
import { fromFileFormula } from './formula-names.ts';
import { EXT_CONDITIONAL, EXT_SPARKLINES } from './ns.ts';
import { readColor } from './style-xml.ts';
import { bool, int, kid, kids, num, optBool, str } from './xml-util.ts';

function readCfvo(node: XmlElement): Cfvo {
  const cfvo: Cfvo = { type: (str(node, 'type') ?? 'num') as Cfvo['type'] };
  const value = str(node, 'val') ?? (kid(node, 'f') ? textOf(kid(node, 'f')) : undefined);
  if (value !== undefined) cfvo.value = fromFileFormula(value);
  if (optBool(node, 'gte') === false) cfvo.gte = false;
  return cfvo;
}

function readCfRule(node: XmlElement): CfRule {
  const rule: CfRule = { type: (str(node, 'type') ?? 'expression') as CfRuleType, priority: int(node, 'priority') ?? 1 };
  if (optBool(node, 'stopIfTrue')) rule.stopIfTrue = true;
  const dxf = int(node, 'dxfId');
  if (dxf !== undefined) rule.dxfId = dxf;
  const operator = str(node, 'operator');
  if (operator) rule.operator = operator as CfOperator;
  const formulas = kids(node, 'formula').map((f) => fromFileFormula(textOf(f)));
  if (formulas.length) rule.formulas = formulas;
  const text = str(node, 'text');
  if (text !== undefined) rule.text = text;
  const period = str(node, 'timePeriod');
  if (period) rule.timePeriod = period as TimePeriod;
  const rank = int(node, 'rank');
  if (rank !== undefined) rule.rank = rank;
  if (optBool(node, 'percent')) rule.percent = true;
  if (optBool(node, 'bottom')) rule.bottom = true;
  if (rule.type === 'aboveAverage') {
    rule.aboveAverage = bool(node, 'aboveAverage', true);
    if (optBool(node, 'equalAverage')) rule.equalAverage = true;
    const stdDev = int(node, 'stdDev');
    if (stdDev !== undefined) rule.stdDev = stdDev;
  }
  const scale = kid(node, 'colorScale');
  if (scale) {
    rule.colorScale = {
      cfvos: kids(scale, 'cfvo').map(readCfvo),
      colors: kids(scale, 'color').map((c) => readColor(c) ?? { rgb: 'FF000000' }),
    };
  }
  const bar = kid(node, 'dataBar');
  if (bar) {
    const cfvos = kids(bar, 'cfvo').map(readCfvo);
    const dataBar: DataBar = {
      cfvos: [cfvos[0] ?? { type: 'min' }, cfvos[1] ?? { type: 'max' }],
      color: readColor(kid(bar, 'color')) ?? { rgb: 'FF638EC6' },
    };
    const minLength = int(bar, 'minLength');
    if (minLength !== undefined) dataBar.minLength = minLength;
    const maxLength = int(bar, 'maxLength');
    if (maxLength !== undefined) dataBar.maxLength = maxLength;
    if (optBool(bar, 'showValue') === false) dataBar.showValue = false;
    rule.dataBar = dataBar;
  }
  const icons = kid(node, 'iconSet');
  if (icons) {
    rule.iconSet = { iconSet: (str(icons, 'iconSet') ?? '3TrafficLights1') as IconSetName, cfvos: kids(icons, 'cfvo').map(readCfvo) };
    if (optBool(icons, 'reverse')) rule.iconSet.reverse = true;
    if (optBool(icons, 'showValue') === false) rule.iconSet.showValue = false;
    if (optBool(icons, 'percent') === false) rule.iconSet.percent = false;
  }
  return rule;
}

/** Identifiant d'extension 2010 d'une regle classique (« x14:id »). */
function extId(node: XmlElement): string | undefined {
  for (const ext of kids(kid(node, 'extLst'), 'ext')) {
    const id = kid(ext, 'id');
    if (id) return textOf(id);
  }
  return undefined;
}

function readConditional(root: XmlElement, sheet: Sheet): void {
  const extended = new Map<string, XmlElement>();
  for (const ext of kids(kid(root, 'extLst'), 'ext')) {
    if (str(ext, 'uri') !== EXT_CONDITIONAL) continue;
    for (const cf of kids(kid(ext, 'conditionalFormattings'), 'conditionalFormatting')) {
      for (const rule of kids(cf, 'cfRule')) {
        const id = str(rule, 'id');
        if (id) extended.set(id, rule);
      }
    }
  }
  for (const node of kids(root, 'conditionalFormatting')) {
    const ranges = parseSqref(str(node, 'sqref') ?? '');
    if (ranges.length === 0) continue;
    const rules = kids(node, 'cfRule').map((ruleNode) => {
      const rule = readCfRule(ruleNode);
      const id = extId(ruleNode);
      const ext = id ? extended.get(id) : undefined;
      if (ext && rule.dataBar) applyDataBarExtension(rule.dataBar, kid(ext, 'dataBar'));
      return rule;
    });
    sheet.conditionalFormats.push(optBool(node, 'pivot') ? { ranges, rules, pivot: true } : { ranges, rules });
  }
}

function applyDataBarExtension(bar: DataBar, ext: XmlElement | undefined): void {
  if (!ext) return;
  bar.gradient = bool(ext, 'gradient', true);
  const direction = str(ext, 'direction');
  if (direction === 'leftToRight' || direction === 'rightToLeft' || direction === 'context') bar.direction = direction;
  const axis = str(ext, 'axisPosition');
  if (axis === 'middle' || axis === 'none' || axis === 'automatic') bar.axisPosition = axis;
  const negative = readColor(kid(ext, 'negativeFillColor'));
  if (negative) bar.negativeColor = negative;
  const border = readColor(kid(ext, 'borderColor'));
  if (border && optBool(ext, 'border')) bar.borderColor = border;
  const axisColor = readColor(kid(ext, 'axisColor'));
  if (axisColor) bar.axisColor = axisColor;
  const cfvos = kids(ext, 'cfvo').map(readCfvo);
  if (cfvos[0] && cfvos[1]) bar.cfvos = [cfvos[0], cfvos[1]];
}

function readValidation(node: XmlElement, sqref: string, f1?: string, f2?: string): DataValidation {
  const dv: DataValidation = { ranges: parseSqref(sqref), type: (str(node, 'type') ?? 'none') as DataValidation['type'] };
  const operator = str(node, 'operator');
  if (operator) dv.operator = operator as DataValidation['operator'];
  const formula1 = f1 ?? (kid(node, 'formula1') ? textOf(kid(node, 'formula1')) : undefined);
  if (formula1 !== undefined) dv.formula1 = fromFileFormula(formula1);
  const formula2 = f2 ?? (kid(node, 'formula2') ? textOf(kid(node, 'formula2')) : undefined);
  if (formula2 !== undefined) dv.formula2 = fromFileFormula(formula2);
  if (optBool(node, 'allowBlank')) dv.allowBlank = true;
  if (dv.type === 'list') dv.inCellDropdown = !bool(node, 'showDropDown', false);
  if (optBool(node, 'showInputMessage')) dv.showInputMessage = true;
  if (optBool(node, 'showErrorMessage')) dv.showErrorMessage = true;
  const style = str(node, 'errorStyle');
  if (style === 'warning' || style === 'information' || style === 'stop') dv.errorStyle = style;
  for (const key of ['errorTitle', 'error', 'promptTitle', 'prompt'] as const) {
    const value = str(node, key);
    if (value !== undefined) dv[key] = value;
  }
  return dv;
}

function readValidations(root: XmlElement, sheet: Sheet): void {
  for (const node of kids(kid(root, 'dataValidations'), 'dataValidation')) {
    sheet.dataValidations.push(readValidation(node, str(node, 'sqref') ?? ''));
  }
  // Excel 2010 : listes renvoyant vers une autre feuille.
  for (const ext of kids(kid(root, 'extLst'), 'ext')) {
    for (const node of kids(kid(ext, 'dataValidations'), 'dataValidation')) {
      const f1 = kid(kid(node, 'formula1'), 'f');
      const f2 = kid(kid(node, 'formula2'), 'f');
      sheet.dataValidations.push(readValidation(node, textOf(kid(node, 'sqref')),
        f1 ? textOf(f1) : undefined, f2 ? textOf(f2) : undefined));
    }
  }
}

function readFilterColumn(node: XmlElement): FilterColumn {
  const column: FilterColumn = { colId: int(node, 'colId') ?? 0 };
  if (optBool(node, 'hiddenButton')) column.hiddenButton = true;
  if (optBool(node, 'showButton') === false) column.showButton = false;
  const filters = kid(node, 'filters');
  const custom = kid(node, 'customFilters');
  const top10 = kid(node, 'top10');
  const dynamic = kid(node, 'dynamicFilter');
  const color = kid(node, 'colorFilter');
  const icon = kid(node, 'iconFilter');
  let filter: ColumnFilter | undefined;
  if (filters) {
    const dateGroups: DateGroupItem[] = kids(filters, 'dateGroupItem').map((d) => {
      const item: DateGroupItem = {
        grouping: (str(d, 'dateTimeGrouping') ?? 'year') as DateGroupItem['grouping'],
        year: int(d, 'year') ?? 1900,
      };
      for (const key of ['month', 'day', 'hour', 'minute', 'second'] as const) {
        const value = int(d, key);
        if (value !== undefined) item[key] = value;
      }
      return item;
    });
    filter = { kind: 'values', values: kids(filters, 'filter').map((f) => str(f, 'val') ?? '') };
    if (optBool(filters, 'blank')) filter.blank = true;
    if (dateGroups.length) filter.dateGroups = dateGroups;
  } else if (custom) {
    filter = {
      kind: 'custom',
      conditions: kids(custom, 'customFilter').map((f) => ({
        operator: (str(f, 'operator') ?? 'equal') as CustomFilterOperator,
        value: str(f, 'val') ?? '',
      })),
    };
    if (optBool(custom, 'and')) filter.and = true;
  } else if (top10) {
    filter = { kind: 'top10', top: bool(top10, 'top', true), percent: bool(top10, 'percent', false), value: num(top10, 'val') ?? 10 };
    const fv = num(top10, 'filterVal');
    if (fv !== undefined) filter.filterValue = fv;
  } else if (dynamic) {
    filter = { kind: 'dynamic', type: str(dynamic, 'type') ?? 'null' };
    const v = num(dynamic, 'val');
    if (v !== undefined) filter.value = v;
    const max = num(dynamic, 'maxVal');
    if (max !== undefined) filter.maxValue = max;
  } else if (color) {
    filter = { kind: 'color', cellColor: bool(color, 'cellColor', true) };
    const dxf = int(color, 'dxfId');
    if (dxf !== undefined) filter.dxfId = dxf;
  } else if (icon) {
    filter = { kind: 'icon', iconSet: (str(icon, 'iconSet') ?? '3Arrows') as IconSetName };
    const id = int(icon, 'iconId');
    if (id !== undefined) filter.iconId = id;
  }
  if (filter) column.filter = filter;
  return column;
}

export function readSortState(node: XmlElement | undefined): SortState | undefined {
  const ref = parseRange(str(node, 'ref') ?? '');
  if (!node || !ref) return undefined;
  const state: SortState = {
    ref,
    conditions: kids(node, 'sortCondition').flatMap((c): SortCondition[] => {
      const range = parseRange(str(c, 'ref') ?? '');
      if (!range) return [];
      const condition: SortCondition = { ref: range };
      if (optBool(c, 'descending')) condition.descending = true;
      const by = str(c, 'sortBy');
      if (by === 'cellColor' || by === 'fontColor' || by === 'icon') condition.sortBy = by;
      const dxf = int(c, 'dxfId');
      if (dxf !== undefined) condition.dxfId = dxf;
      const list = str(c, 'customList');
      if (list) condition.customList = list;
      const iconSet = str(c, 'iconSet');
      if (iconSet) condition.iconSet = iconSet as IconSetName;
      const iconId = int(c, 'iconId');
      if (iconId !== undefined) condition.iconId = iconId;
      return [condition];
    }),
  };
  if (optBool(node, 'caseSensitive')) state.caseSensitive = true;
  if (optBool(node, 'columnSort')) state.columnSort = true;
  return state;
}

export function readAutoFilter(node: XmlElement | undefined): AutoFilter | undefined {
  const ref = parseRange(str(node, 'ref') ?? '');
  if (!node || !ref) return undefined;
  const filter: AutoFilter = { ref, columns: kids(node, 'filterColumn').map(readFilterColumn) };
  const sort = readSortState(kid(node, 'sortState'));
  if (sort) filter.sort = sort;
  return filter;
}

function readSparklines(root: XmlElement, sheet: Sheet): void {
  for (const ext of kids(kid(root, 'extLst'), 'ext')) {
    if (str(ext, 'uri') !== EXT_SPARKLINES) continue;
    for (const node of kids(kid(ext, 'sparklineGroups'), 'sparklineGroup')) {
      const type = str(node, 'type');
      const group: SparklineGroup = {
        type: type === 'column' || type === 'stacked' ? type : 'line',
        sparklines: kids(kid(node, 'sparklines'), 'sparkline').flatMap((s) => {
          const location = parseCell(textOf(kid(s, 'sqref')));
          return location ? [{ source: textOf(kid(s, 'f')), location }] : [];
        }),
      };
      for (const key of ['colorSeries', 'colorNegative', 'colorAxis', 'colorMarkers', 'colorFirst', 'colorLast', 'colorHigh', 'colorLow'] as const) {
        const color = readColor(kid(node, key));
        if (color) group[key] = color;
      }
      for (const key of ['markers', 'high', 'low', 'first', 'last', 'negative', 'displayXAxis', 'displayHidden', 'rightToLeft'] as const) {
        if (optBool(node, key)) group[key] = true;
      }
      const weight = num(node, 'lineWeight');
      if (weight !== undefined) group.lineWeight = weight;
      const empty = str(node, 'displayEmptyCellsAs');
      if (empty === 'gap' || empty === 'zero' || empty === 'span') group.displayEmptyCellsAs = empty;
      const minType = str(node, 'minAxisType');
      if (minType === 'individual' || minType === 'group' || minType === 'custom') group.minAxisType = minType;
      const maxType = str(node, 'maxAxisType');
      if (maxType === 'individual' || maxType === 'group' || maxType === 'custom') group.maxAxisType = maxType;
      const manualMin = num(node, 'manualMin');
      if (manualMin !== undefined) group.manualMin = manualMin;
      const manualMax = num(node, 'manualMax');
      if (manualMax !== undefined) group.manualMax = manualMax;
      const dateAxis = kid(node, 'f');
      if (dateAxis && optBool(node, 'dateAxis')) group.dateAxis = textOf(dateAxis);
      sheet.sparklineGroups.push(group);
    }
  }
}

export function readSheetRules(root: XmlElement, sheet: Sheet): void {
  readConditional(root, sheet);
  readValidations(root, sheet);
  const filter = readAutoFilter(kid(root, 'autoFilter'));
  if (filter) sheet.autoFilter = filter;
  const sort = readSortState(kid(root, 'sortState'));
  if (sort) sheet.sort = sort;
  readSparklines(root, sheet);
}
