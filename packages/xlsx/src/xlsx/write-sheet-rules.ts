// Ecriture des regles d'une feuille : mises en forme conditionnelles (+ extension 2010 des barres de donnees),
// validations, filtre automatique, tris, graphiques sparkline.
import { el, type XmlElement } from '@forgeoffice/opc';
import { cellName, rangeName, sqrefName } from '../address.ts';
import type { AutoFilter, CfRule, Cfvo, ColumnFilter, DataBar, DataValidation, Sheet, SortState, SparklineGroup } from '../model.ts';
import { toFileFormula } from './formula-names.ts';
import { EXT_CF_ID, EXT_CONDITIONAL, EXT_SPARKLINES, NS_X14, NS_XM } from './ns.ts';
import { colorEl } from './style-xml.ts';
import { b1 } from './xml-util.ts';

function cfvoEl(cfvo: Cfvo, tag = 'cfvo'): XmlElement {
  return el(tag, { type: cfvo.type, val: cfvo.value === undefined ? undefined : toFileFormula(cfvo.value), gte: cfvo.gte === false ? '0' : undefined });
}

/** Les barres de donnees « modernes » demandent l'extension Excel 2010. */
function needsDataBarExt(bar: DataBar): boolean {
  return bar.gradient === false || bar.negativeColor !== undefined || bar.axisColor !== undefined || bar.borderColor !== undefined
    || bar.direction !== undefined || bar.axisPosition !== undefined;
}

interface ExtRule {
  id: string;
  rule: CfRule;
  sqref: string;
}

function guid(seed: number): string {
  const hex = (seed + 1).toString(16).toUpperCase().padStart(12, '0');
  return `{00000000-0000-4000-8000-${hex}}`;
}

function cfRuleEl(rule: CfRule, extRules: ExtRule[], sqref: string): XmlElement {
  const kidsOut: XmlElement[] = [];
  for (const formula of rule.formulas ?? []) kidsOut.push(el('formula', {}, [toFileFormula(formula)]));
  if (rule.colorScale) {
    kidsOut.push(el('colorScale', {}, [
      ...rule.colorScale.cfvos.map((c) => cfvoEl(c)),
      ...rule.colorScale.colors.flatMap((c) => colorEl('color', c)),
    ]));
  }
  if (rule.dataBar) {
    const bar = rule.dataBar;
    kidsOut.push(el('dataBar', { minLength: bar.minLength, maxLength: bar.maxLength, showValue: bar.showValue === false ? '0' : undefined }, [
      cfvoEl(bar.cfvos[0]),
      cfvoEl(bar.cfvos[1]),
      ...colorEl('color', bar.color),
    ]));
    if (needsDataBarExt(bar)) {
      const id = guid(extRules.length);
      extRules.push({ id, rule, sqref });
      kidsOut.push(el('extLst', {}, [el('ext', { uri: EXT_CF_ID, 'xmlns:x14': NS_X14 }, [el('x14:id', {}, [id])])]));
    }
  }
  if (rule.iconSet) {
    const icons = rule.iconSet;
    kidsOut.push(el('iconSet', {
      iconSet: icons.iconSet === '3TrafficLights1' ? undefined : icons.iconSet,
      showValue: icons.showValue === false ? '0' : undefined,
      percent: icons.percent === false ? '0' : undefined,
      reverse: b1(icons.reverse),
    }, icons.cfvos.map((c) => cfvoEl(c))));
  }
  return el('cfRule', {
    type: rule.type,
    dxfId: rule.dxfId,
    priority: rule.priority,
    stopIfTrue: b1(rule.stopIfTrue),
    aboveAverage: rule.type === 'aboveAverage' && rule.aboveAverage === false ? '0' : undefined,
    percent: b1(rule.percent),
    bottom: b1(rule.bottom),
    operator: rule.operator,
    text: rule.text,
    timePeriod: rule.timePeriod,
    rank: rule.rank,
    stdDev: rule.stdDev,
    equalAverage: b1(rule.equalAverage),
  }, kidsOut);
}

function dataBarExtEl(item: ExtRule): XmlElement {
  const bar = item.rule.dataBar;
  const kidsOut: XmlElement[] = [];
  if (bar) {
    const cfvo = (c: Cfvo): XmlElement =>
      el('x14:cfvo', { type: c.type }, c.value === undefined ? [] : [el('xm:f', {}, [toFileFormula(c.value)])]);
    kidsOut.push(el('x14:dataBar', {
      minLength: bar.minLength ?? 0,
      maxLength: bar.maxLength ?? 100,
      gradient: bar.gradient === false ? '0' : undefined,
      border: bar.borderColor ? '1' : undefined,
      direction: bar.direction,
      axisPosition: bar.axisPosition,
      negativeBarBorderColorSameAsPositive: bar.borderColor ? '0' : undefined,
    }, [
      cfvo(bar.cfvos[0]),
      cfvo(bar.cfvos[1]),
      ...colorEl('x14:borderColor', bar.borderColor),
      ...colorEl('x14:negativeFillColor', bar.negativeColor ?? { rgb: 'FFFF0000' }),
      ...(bar.borderColor ? colorEl('x14:negativeBorderColor', bar.negativeColor ?? { rgb: 'FFFF0000' }) : []),
      ...colorEl('x14:axisColor', bar.axisColor ?? { rgb: 'FF000000' }),
    ]));
  }
  return el('x14:conditionalFormatting', { 'xmlns:xm': NS_XM }, [
    el('x14:cfRule', { type: 'dataBar', id: item.id }, kidsOut),
    el('xm:sqref', {}, [item.sqref]),
  ]);
}

function validationEl(dv: DataValidation): XmlElement {
  return el('dataValidation', {
    type: dv.type === 'none' ? undefined : dv.type,
    errorStyle: dv.errorStyle && dv.errorStyle !== 'stop' ? dv.errorStyle : undefined,
    operator: dv.operator && dv.operator !== 'between' ? dv.operator : undefined,
    allowBlank: b1(dv.allowBlank),
    showDropDown: dv.type === 'list' && dv.inCellDropdown === false ? '1' : undefined,
    showInputMessage: b1(dv.showInputMessage),
    showErrorMessage: b1(dv.showErrorMessage),
    errorTitle: dv.errorTitle,
    error: dv.error,
    promptTitle: dv.promptTitle,
    prompt: dv.prompt,
    sqref: sqrefName(dv.ranges),
  }, [
    ...(dv.formula1 !== undefined ? [el('formula1', {}, [toFileFormula(dv.formula1)])] : []),
    ...(dv.formula2 !== undefined ? [el('formula2', {}, [toFileFormula(dv.formula2)])] : []),
  ]);
}

function filterEl(filter: ColumnFilter): XmlElement {
  switch (filter.kind) {
    case 'values':
      return el('filters', { blank: b1(filter.blank) }, [
        ...filter.values.map((v) => el('filter', { val: v })),
        ...(filter.dateGroups ?? []).map((d) => el('dateGroupItem', {
          year: d.year, month: d.month, day: d.day, hour: d.hour, minute: d.minute, second: d.second, dateTimeGrouping: d.grouping,
        })),
      ]);
    case 'custom':
      return el('customFilters', { and: b1(filter.and) }, filter.conditions.map((c) => el('customFilter', {
        operator: c.operator === 'equal' ? undefined : c.operator,
        val: c.value,
      })));
    case 'top10':
      return el('top10', { top: filter.top ? undefined : '0', percent: b1(filter.percent), val: filter.value, filterVal: filter.filterValue });
    case 'dynamic':
      return el('dynamicFilter', { type: filter.type, val: filter.value, maxVal: filter.maxValue });
    case 'color':
      return el('colorFilter', { dxfId: filter.dxfId, cellColor: filter.cellColor ? undefined : '0' });
    case 'icon':
      return el('iconFilter', { iconSet: filter.iconSet, iconId: filter.iconId });
  }
}

export function sortStateEl(sort: SortState): XmlElement {
  return el('sortState', { columnSort: b1(sort.columnSort), caseSensitive: b1(sort.caseSensitive), ref: rangeName(sort.ref) },
    sort.conditions.map((c) => el('sortCondition', {
      descending: b1(c.descending),
      sortBy: c.sortBy && c.sortBy !== 'value' ? c.sortBy : undefined,
      ref: rangeName(c.ref),
      customList: c.customList,
      dxfId: c.dxfId,
      iconSet: c.iconSet,
      iconId: c.iconId,
    })));
}

export function autoFilterEl(filter: AutoFilter): XmlElement {
  return el('autoFilter', { ref: rangeName(filter.ref) }, [
    ...filter.columns.map((c) => el('filterColumn', {
      colId: c.colId,
      hiddenButton: b1(c.hiddenButton),
      showButton: c.showButton === false ? '0' : undefined,
    }, c.filter ? [filterEl(c.filter)] : [])),
    ...(filter.sort ? [sortStateEl(filter.sort)] : []),
  ]);
}

function sparklineGroupEl(group: SparklineGroup): XmlElement {
  const kidsOut: XmlElement[] = [];
  for (const key of ['colorSeries', 'colorNegative', 'colorAxis', 'colorMarkers', 'colorFirst', 'colorLast', 'colorHigh', 'colorLow'] as const) {
    kidsOut.push(...colorEl(`x14:${key}`, group[key] ?? (key === 'colorSeries' ? { theme: 4, tint: -0.499984740745262 } : { theme: 4 })));
  }
  if (group.dateAxis) kidsOut.push(el('xm:f', {}, [group.dateAxis]));
  kidsOut.push(el('x14:sparklines', {}, group.sparklines.map((s) => el('x14:sparkline', {}, [
    el('xm:f', {}, [s.source]),
    el('xm:sqref', {}, [cellName(s.location.row, s.location.col)]),
  ]))));
  return el('x14:sparklineGroup', {
    manualMax: group.manualMax,
    manualMin: group.manualMin,
    lineWeight: group.lineWeight,
    type: group.type === 'line' ? undefined : group.type,
    dateAxis: b1(group.dateAxis !== undefined),
    displayEmptyCellsAs: group.displayEmptyCellsAs ?? 'gap',
    markers: b1(group.markers),
    high: b1(group.high),
    low: b1(group.low),
    first: b1(group.first),
    last: b1(group.last),
    negative: b1(group.negative),
    displayXAxis: b1(group.displayXAxis),
    displayHidden: b1(group.displayHidden),
    minAxisType: group.minAxisType,
    maxAxisType: group.maxAxisType,
    rightToLeft: b1(group.rightToLeft),
  }, kidsOut);
}

export interface SheetRuleParts {
  conditional: XmlElement[];
  validations?: XmlElement;
  autoFilter?: XmlElement;
  sort?: XmlElement;
  extensions: XmlElement[];
}

export function writeSheetRules(sheet: Sheet): SheetRuleParts {
  const extRules: ExtRule[] = [];
  const conditional = sheet.conditionalFormats
    .filter((cf) => cf.ranges.length && cf.rules.length)
    .map((cf) => {
      const sqref = sqrefName(cf.ranges);
      return el('conditionalFormatting', { pivot: b1(cf.pivot), sqref }, cf.rules.map((r) => cfRuleEl(r, extRules, sqref)));
    });
  const valid = sheet.dataValidations.filter((dv) => dv.ranges.length);
  const parts: SheetRuleParts = { conditional, extensions: [] };
  if (valid.length) parts.validations = el('dataValidations', { count: valid.length }, valid.map(validationEl));
  if (sheet.autoFilter) parts.autoFilter = autoFilterEl(sheet.autoFilter);
  if (sheet.sort) parts.sort = sortStateEl(sheet.sort);
  if (extRules.length) {
    parts.extensions.push(el('ext', { uri: EXT_CONDITIONAL, 'xmlns:x14': NS_X14 }, [
      el('x14:conditionalFormattings', {}, extRules.map(dataBarExtEl)),
    ]));
  }
  const groups = sheet.sparklineGroups.filter((g) => g.sparklines.length);
  if (groups.length) {
    parts.extensions.push(el('ext', { uri: EXT_SPARKLINES, 'xmlns:x14': NS_X14 }, [
      el('x14:sparklineGroups', { 'xmlns:xm': NS_XM }, groups.map(sparklineGroupEl)),
    ]));
  }
  return parts;
}
