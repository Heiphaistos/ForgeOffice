// Ecriture des tableaux croises : cache (definition + enregistrements) et definition de chaque tableau.
import { el, type XmlElement } from '@forgeoffice/opc';
import { rangeName } from '../address.ts';
import {
  pivotValueKey,
  type PivotCache, type PivotLineItem, type PivotTable, type PivotValue,
} from '../model-pivot.ts';
import type { Workbook } from '../model.ts';
import { numberFormatId } from '../workbook.ts';
import { layoutPivot, orderedItems, recordColumns, sharedValues } from './pivot-layout.ts';
import { NS_MAIN, NS_R } from './ns.ts';
import { escAttr } from './xml-util.ts';

const A = escAttr;

/** Champs du cache qui doivent avoir des elements partages (champs d'axe ou valeurs non numeriques). */
function sharedFields(cache: PivotCache, tables: readonly PivotTable[]): boolean[] {
  const cols = recordColumns(cache);
  return cache.fields.map((_, f) => {
    if (tables.some((t) => t.rowFields.includes(f) || t.colFields.includes(f) || t.pageFields.some((p) => p.field === f))) return true;
    const col = cols[f] ?? -1;
    return col >= 0 && cache.records.some((row) => typeof (row[col] ?? null) !== 'number' && row[col] !== null);
  });
}

function valueTag(v: PivotValue, asItem: boolean): string {
  if (v === null) return '<m/>';
  if (typeof v === 'number') return `<n v="${Number.isFinite(v) ? v : 0}"/>`;
  if (typeof v === 'string') return `<s v="${A(v)}"/>`;
  if (typeof v === 'boolean') return `<b v="${v ? 1 : 0}"/>`;
  if ('error' in v) return `<e v="${A(v.error)}"/>`;
  void asItem;
  return `<d v="${A(v.date)}"/>`;
}

function sharedItemsXml(values: readonly PivotValue[], used: boolean): string {
  const nums = values.filter((v): v is number => typeof v === 'number');
  const dates = values.filter((v): v is { date: string } => v !== null && typeof v === 'object' && 'date' in v);
  const has = {
    string: values.some((v) => typeof v === 'string'),
    blank: values.some((v) => v === null),
    other: values.some((v) => typeof v === 'boolean' || (v !== null && typeof v === 'object' && 'error' in v)),
    number: nums.length > 0,
    date: dates.length > 0,
  };
  const attrs: string[] = [];
  const semi = has.string || has.blank || has.other;
  if (!semi) attrs.push('containsSemiMixedTypes="0"');
  if (has.date && !has.string && !has.number && !has.other && !has.blank) attrs.push('containsNonDate="0"');
  if (has.date) attrs.push('containsDate="1"');
  if (!has.string) attrs.push('containsString="0"');
  if (has.blank) attrs.push('containsBlank="1"');
  if ((has.string && (has.number || has.date || has.other)) || (has.other && (has.number || has.date))) attrs.push('containsMixedTypes="1"');
  if (has.number) {
    attrs.push('containsNumber="1"');
    if (nums.every(Number.isInteger)) attrs.push('containsInteger="1"');
    attrs.push(`minValue="${Math.min(...nums)}"`, `maxValue="${Math.max(...nums)}"`);
  }
  if (has.date) {
    const sorted = dates.map((d) => d.date).sort();
    attrs.push(`minDate="${A(sorted[0] ?? '')}"`, `maxDate="${A(sorted[sorted.length - 1] ?? '')}"`);
  }
  if (!used) return `<sharedItems${attrs.length ? ` ${attrs.join(' ')}` : ''}/>`;
  return `<sharedItems ${[...attrs, `count="${values.length}"`].join(' ')}>${values.map((v) => valueTag(v, true)).join('')}</sharedItems>`;
}

export interface CachePlan {
  shared: boolean[];
  values: PivotValue[][];
  index: Map<string, number>[];
}

export function planCache(cache: PivotCache, tables: readonly PivotTable[]): CachePlan {
  const shared = sharedFields(cache, tables);
  const values = cache.fields.map((_, f) => (shared[f] ? sharedValues(cache, tables, f) : []));
  const index = values.map((list) => new Map(list.map((v, i) => [pivotValueKey(v), i])));
  return { shared, values, index };
}

export function cacheDefinitionXml(cache: PivotCache, tables: readonly PivotTable[], plan: CachePlan, recordsRelId: string): string {
  const src = cache.source;
  const source = src.name !== undefined
    ? `<worksheetSource name="${A(src.name)}"/>`
    : `<worksheetSource ref="${A(src.ref ? rangeName(src.ref) : '')}" sheet="${A(src.sheet ?? '')}"/>`;
  const fields = cache.fields.map((f, i) => {
    const attrs = { name: f.name, numFmtId: f.numFmtId ?? 0, ...(f.attrs ?? {}) } as Record<string, string | number>;
    if (f.formula !== undefined) {
      attrs['formula'] = f.formula;
      attrs['databaseField'] = '0';
    }
    const head = Object.entries(attrs).map(([k, v]) => `${k}="${A(String(v))}"`).join(' ');
    const items = f.formula !== undefined ? '<sharedItems/>' : sharedItemsXml(plan.shared[i] ? plan.values[i] ?? [] : inlineValues(cache, i), plan.shared[i] ?? false);
    return `<cacheField ${head}>${items}</cacheField>`;
  });
  const extra = Object.entries(cache.attrs ?? {}).filter(([k]) => !['recordCount', 'r:id', 'refreshOnLoad', 'xmlns', 'xmlns:r'].includes(k));
  const attrs = [
    `xmlns="${NS_MAIN}"`, `xmlns:r="${NS_R}"`, `r:id="${recordsRelId}"`,
    ...extra.map(([k, v]) => `${k}="${A(v)}"`),
    ...(cache.refreshOnLoad ? ['refreshOnLoad="1"'] : []),
    `recordCount="${cache.records.length}"`,
  ];
  void tables;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<pivotCacheDefinition ${attrs.join(' ')}><cacheSource type="worksheet">${source}</cacheSource><cacheFields count="${fields.length}">${fields.join('')}</cacheFields></pivotCacheDefinition>`;
}

/** Valeurs d'une colonne inline (nombres et vides) pour calculer les attributs de « sharedItems ». */
function inlineValues(cache: PivotCache, field: number): PivotValue[] {
  const col = recordColumns(cache)[field] ?? -1;
  if (col < 0) return [];
  const out: PivotValue[] = [];
  let blank = false;
  for (const row of cache.records) {
    const v = row[col] ?? null;
    if (v === null) blank = true;
    else out.push(v);
  }
  if (blank) out.push(null);
  return out;
}

export function cacheRecordsXml(cache: PivotCache, plan: CachePlan): string {
  const cols = recordColumns(cache);
  const parts: string[] = [`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<pivotCacheRecords xmlns="${NS_MAIN}" xmlns:r="${NS_R}" count="${cache.records.length}">`];
  for (const row of cache.records) {
    let line = '<r>';
    for (let f = 0; f < cache.fields.length; f++) {
      const col = cols[f] ?? -1;
      if (col < 0) continue;
      const v = row[col] ?? null;
      line += plan.shared[f] ? `<x v="${plan.index[f]?.get(pivotValueKey(v)) ?? 0}"/>` : valueTag(v, false);
    }
    parts.push(`${line}</r>`);
  }
  parts.push('</pivotCacheRecords>');
  return parts.join('');
}

/** Extension Excel 2010 : masque la ligne « Valeurs » quand les champs de donnees sont seuls en colonnes. */
const HIDE_VALUES_ROW = '<extLst><ext uri="{962EF5D1-5CA2-4c93-8EF4-DBF5C05439D2}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:pivotTableDefinition hideValuesRow="1" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"/></ext></extLst>';

const SUBTOTAL_ATTR: Record<string, string> = {
  count: 'count', average: 'average', max: 'max', min: 'min', product: 'product', countNums: 'countNums',
  stdDev: 'stdDev', stdDevp: 'stdDevp', var: 'var', varp: 'varp',
};

function lineItems(items: readonly PivotLineItem[], tag: 'rowItems' | 'colItems'): string {
  const xml = items.map((it) => {
    const attrs = `${it.type ? ` t="${it.type}"` : ''}${it.repeat ? ` r="${it.repeat}"` : ''}${it.dataIndex ? ` i="${it.dataIndex}"` : ''}`;
    if (it.x.length === 0) return `<i${attrs}/>`;
    return `<i${attrs}>${it.x.map((v) => (v ? `<x v="${v}"/>` : '<x/>')).join('')}</i>`;
  });
  return `<${tag} count="${items.length}">${xml.join('')}</${tag}>`;
}

const DEFAULT_ATTRS: Record<string, string> = {
  applyNumberFormats: '0', applyBorderFormats: '0', applyFontFormats: '0', applyPatternFormats: '0', applyAlignmentFormats: '0',
  applyWidthHeightFormats: '1', updatedVersion: '8', minRefreshableVersion: '3', useAutoFormatting: '1', itemPrintTitles: '1',
  createdVersion: '8', indent: '0', outline: '1', outlineData: '1', multipleFieldFilters: '0',
};

export type PivotLayoutKind = 'compact' | 'outline' | 'tabular';

function layoutKind(table: PivotTable): PivotLayoutKind {
  if (table.attrs?.['compact'] === '0' && table.attrs?.['outline'] !== '1' && table.attrs?.['outlineData'] !== '1') return 'tabular';
  if (table.attrs?.['compact'] === '0') return 'outline';
  return 'compact';
}

/** Retire les index de champs hors du cache (donnees d'un fichier ou d'un appelant hostile). */
function sanitizeTable(table: PivotTable, fieldCount: number): PivotTable {
  const ok = (f: number): boolean => Number.isInteger(f) && f >= 0 && f < fieldCount;
  const axisOk = (f: number): boolean => ok(f) || f === -2;
  const dataFields = table.dataFields.filter((d) => ok(d.field));
  return {
    ...table,
    rowFields: [...new Set(table.rowFields.filter(axisOk))],
    colFields: [...new Set(table.colFields.filter(axisOk))].filter((f) => f !== -2 || dataFields.length > 1 || table.colFields.length === 1),
    pageFields: table.pageFields.filter((p) => ok(p.field)),
    dataFields,
  };
}

export function pivotTableXml(source: PivotTable, cache: PivotCache, plan: CachePlan, wb: Workbook): { xml: string; location: string } {
  const table = sanitizeTable(source, cache.fields.length);
  const kind = layoutKind(table);
  const fieldItems = cache.fields.map((_, f) => (plan.shared[f] ? orderedItems(cache, table, f) : []));
  const layout = layoutPivot(cache, table, kind);
  const generated = table.rowItems === undefined || table.colItems === undefined;
  const rowItems = table.rowItems ?? layout.rowItems;
  const colItems = table.colItems ?? layout.colItems;
  const loc = table.location;
  const loca = table.locationAttrs ?? {};
  const first = {
    firstHeaderRow: loca['firstHeaderRow'] ?? String(layout.firstHeaderRow),
    firstDataRow: loca['firstDataRow'] ?? String(layout.firstDataRow),
    firstDataCol: loca['firstDataCol'] ?? String(layout.firstDataCol),
  };
  const ref = generated
    ? { r1: loc.r1, c1: loc.c1, r2: loc.r1 + Number(first.firstDataRow) + rowItems.length - 1, c2: loc.c1 + Number(first.firstDataCol) + colItems.length - 1 }
    : loc;
  const pageAttrs = table.pageFields.length ? ` rowPageCount="${loca['rowPageCount'] ?? table.pageFields.length}" colPageCount="${loca['colPageCount'] ?? 1}"` : '';
  const location = `<location ref="${rangeName(ref)}" firstHeaderRow="${first.firstHeaderRow}" firstDataRow="${first.firstDataRow}" firstDataCol="${first.firstDataCol}"${pageAttrs}/>`;

  const dataFieldSet = new Set(table.dataFields.map((d) => d.field));
  const axisOf = (f: number): string | undefined => {
    if (table.rowFields.includes(f)) return 'axisRow';
    if (table.colFields.includes(f)) return 'axisCol';
    if (table.pageFields.some((p) => p.field === f)) return 'axisPage';
    return undefined;
  };
  const pivotFields = cache.fields.map((_, f) => {
    const def = table.fields[f];
    const axis = axisOf(f);
    const attrs: string[] = [];
    if (axis) attrs.push(`axis="${axis}"`);
    if (dataFieldSet.has(f)) attrs.push('dataField="1"');
    if (kind !== 'compact') attrs.push('compact="0"');
    if (kind === 'tabular') attrs.push('outline="0"');
    for (const [k, v] of Object.entries(def?.attrs ?? {})) if (!['axis', 'dataField', 'compact', 'outline', 'showAll', 'defaultSubtotal'].includes(k)) attrs.push(`${k}="${A(v)}"`);
    attrs.push(`showAll="${def?.attrs?.['showAll'] ?? '0'}"`);
    if (def?.defaultSubtotal === false) attrs.push('defaultSubtotal="0"');
    if (!axis) return `<pivotField ${attrs.join(' ')}/>`;
    const sharedIdx = plan.index[f] ?? new Map<string, number>();
    const items = (fieldItems[f] ?? []).map((it) => {
      const parts = [`x="${sharedIdx.get(pivotValueKey(it.value)) ?? 0}"`];
      if (it.hidden) parts.push('h="1"');
      if (it.caption !== undefined) parts.push(`n="${A(it.caption)}"`);
      return `<item ${parts.join(' ')}/>`;
    });
    if (def?.defaultSubtotal !== false) items.push('<item t="default"/>');
    return `<pivotField ${attrs.join(' ')}><items count="${items.length}">${items.join('')}</items></pivotField>`;
  });

  const fieldsXml = (name: string, list: number[]): string =>
    list.length ? `<${name} count="${list.length}">${list.map((f) => (f === -2 ? '<field x="-2"/>' : `<field x="${f}"/>`)).join('')}</${name}>` : '';
  const pages = table.pageFields.length
    ? `<pageFields count="${table.pageFields.length}">${table.pageFields.map((p) => {
      const pos = p.selected === undefined ? undefined : (fieldItems[p.field] ?? []).findIndex((it) => pivotValueKey(it.value) === pivotValueKey(p.selected ?? null));
      return `<pageField fld="${p.field}"${pos !== undefined && pos >= 0 ? ` item="${pos}"` : ''} hier="-1"/>`;
    }).join('')}</pageFields>`
    : '';
  const dataFields = table.dataFields.length
    ? `<dataFields count="${table.dataFields.length}">${table.dataFields.map((d) => {
      const numFmtId = d.numFmt !== undefined ? numberFormatId(wb.styles, d.numFmt) : d.numFmtId;
      const sub = d.summary && d.summary !== 'sum' ? ` subtotal="${SUBTOTAL_ATTR[d.summary] ?? 'sum'}"` : '';
      return `<dataField name="${A(d.name)}" fld="${d.field}"${sub}${d.showDataAs ? ` showDataAs="${A(d.showDataAs)}"` : ''} baseField="${d.baseField ?? 0}" baseItem="${d.baseItem ?? 0}"${numFmtId ? ` numFmtId="${numFmtId}"` : ''}/>`;
    }).join('')}</dataFields>`
    : '';
  const style = table.style ?? {};
  const styleXml = `<pivotTableStyleInfo name="${A(style.name ?? 'PivotStyleLight16')}" showRowHeaders="${style.showRowHeaders === false ? 0 : 1}" showColHeaders="${style.showColHeaders === false ? 0 : 1}" showRowStripes="${style.showRowStripes ? 1 : 0}" showColStripes="${style.showColStripes ? 1 : 0}" showLastColumn="${style.showLastColumn === false ? 0 : 1}"/>`;

  const attrs: Record<string, string> = { ...DEFAULT_ATTRS, ...(table.attrs ?? {}) };
  if (kind === 'tabular') {
    delete attrs['outline'];
    delete attrs['outlineData'];
    attrs['compact'] = '0';
    attrs['compactData'] = '0';
  } else if (kind === 'outline') {
    attrs['compact'] = '0';
    attrs['compactData'] = '0';
  }
  attrs['dataCaption'] = table.dataCaption ?? attrs['dataCaption'] ?? 'Valeurs';
  if (table.rowGrandTotals === false) attrs['rowGrandTotals'] = '0';
  if (table.colGrandTotals === false) attrs['colGrandTotals'] = '0';
  const root = Object.entries({ name: table.name, cacheId: String(cache.id), ...attrs }).map(([k, v]) => `${k}="${A(v)}"`).join(' ');
  const hideValues = !(table.raw ?? []).some((e) => e.name === 'extLst') && table.colFields.includes(-2) && table.colFields.length === 1 && table.dataFields.length > 1;
  const raw = (table.raw ?? []).map((e) => serializeFragment(e)).join('') + (hideValues ? HIDE_VALUES_ROW : '');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<pivotTableDefinition xmlns="${NS_MAIN}" ${root}>${location}<pivotFields count="${pivotFields.length}">${pivotFields.join('')}</pivotFields>${fieldsXml('rowFields', table.rowFields)}${lineItems(rowItems, 'rowItems')}${fieldsXml('colFields', table.colFields)}${lineItems(colItems, 'colItems')}${pages}${dataFields}${styleXml}${raw}</pivotTableDefinition>`;
  return { xml, location: rangeName(ref) };
}

function serializeFragment(node: XmlElement): string {
  const attrs = Object.entries(node.attrs).map(([k, v]) => ` ${k}="${A(v)}"`).join('');
  const body = node.children.map((c) => (typeof c === 'string' ? A(c) : serializeFragment(c))).join('');
  return body ? `<${node.name}${attrs}>${body}</${node.name}>` : `<${node.name}${attrs}/>`;
}

export function cachesElement(entries: { id: number; rid: string }[]): XmlElement {
  return el('pivotCaches', {}, entries.map((e) => el('pivotCache', { cacheId: e.id, 'r:id': e.rid })));
}
