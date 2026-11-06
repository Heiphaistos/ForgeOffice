// Lecture des tableaux croises : caches (definition + enregistrements) et definition de chaque tableau.
import { isElement, textOf, type OpcPackage, type XmlElement } from '@forgeoffice/opc';
import { parseRange } from '../address.ts';
import { parseErrorCode } from '../workbook.ts';
import {
  type PivotCache, type PivotCacheField, type PivotDataField, type PivotFieldDef, type PivotItemDef, type PivotLineItem,
  type PivotSummary, type PivotTable, type PivotValue,
} from '../model-pivot.ts';
import { REL_PIVOT_CACHE_REC } from './ns.ts';
import { int, kid, kids, localName, num, optBool, str } from './xml-util.ts';

/** Au-dela, les enregistrements ne sont pas lus (le cache sera recalcule par Excel a l'ouverture). */
const MAX_RECORD_VALUES = 20_000_000;
const MAX_FIELDS = 16_384;

function valueOf(node: XmlElement): PivotValue {
  switch (localName(node.name)) {
    case 'n':
      return num(node, 'v') ?? 0;
    case 's':
      return str(node, 'v') ?? '';
    case 'b':
      return str(node, 'v') === '1' || str(node, 'v') === 'true';
    case 'e':
      return parseErrorCode(str(node, 'v') ?? '#N/A') ?? { error: '#N/A' };
    case 'd':
      return { date: str(node, 'v') ?? '' };
    default:
      return null;
  }
}

const OWN_CACHE_ATTRS = new Set(['xmlns', 'xmlns:r', 'r:id', 'recordCount', 'refreshOnLoad', 'xmlns:mc', 'mc:Ignorable', 'xmlns:xr', 'xr:uid']);

/** Lit un cache ; undefined si la source n'est pas une plage de feuille (OLAP, externe, consolidation...). */
export async function readPivotCache(pkg: OpcPackage, defPart: string, id: number): Promise<{ cache: PivotCache; shared: PivotValue[][] } | undefined> {
  const root = await pkg.readXml(defPart);
  const source = kid(root, 'cacheSource');
  const ws = kid(source, 'worksheetSource');
  if (!source || str(source, 'type') !== 'worksheet' || !ws || str(ws, 'id') !== undefined) return undefined;
  const ref = parseRange(str(ws, 'ref') ?? '');
  const name = str(ws, 'name');
  if (!ref && !name) return undefined;
  const fieldEls = kids(kid(root, 'cacheFields'), 'cacheField').slice(0, MAX_FIELDS);
  const fields: PivotCacheField[] = [];
  const shared: PivotValue[][] = [];
  for (const f of fieldEls) {
    const field: PivotCacheField = { name: str(f, 'name') ?? `Champ${fields.length + 1}` };
    const fmt = int(f, 'numFmtId');
    if (fmt) field.numFmtId = fmt;
    const formula = str(f, 'formula');
    if (formula !== undefined) field.formula = formula;
    const rest: Record<string, string> = {};
    for (const [k, v] of Object.entries(f.attrs)) if (!['name', 'numFmtId', 'formula', 'databaseField'].includes(k)) rest[k] = v;
    if (Object.keys(rest).length) field.attrs = rest;
    fields.push(field);
    shared.push(kids(kid(f, 'sharedItems')).map(valueOf));
  }
  const cache: PivotCache = {
    id,
    source: name !== undefined ? { name } : { sheet: str(ws, 'sheet') ?? '', ref: ref ?? { r1: 0, c1: 0, r2: 0, c2: 0 } },
    fields,
    records: [],
  };
  if (optBool(root, 'refreshOnLoad')) cache.refreshOnLoad = true;
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(root.attrs)) if (!OWN_CACHE_ATTRS.has(k)) attrs[k] = v;
  if (Object.keys(attrs).length) cache.attrs = attrs;

  const rels = await pkg.relationships(defPart);
  const recRel = rels.find((r) => r.type === REL_PIVOT_CACHE_REC && !r.external && pkg.has(r.target));
  const expected = int(root, 'recordCount') ?? 0;
  if (!recRel) {
    if (expected > 0) cache.refreshOnLoad = true;
    return { cache, shared };
  }
  const recRoot = await pkg.readXml(recRel.target);
  const rows = kids(recRoot, 'r');
  const columns = fields.map((f, i) => (f.formula === undefined ? i : -1)).filter((i) => i >= 0);
  if (rows.length * Math.max(1, columns.length) > MAX_RECORD_VALUES) {
    cache.refreshOnLoad = true;
    return { cache, shared };
  }
  for (const row of rows) {
    const cells = kids(row);
    cache.records.push(columns.map((f, k): PivotValue => {
      const node = cells[k];
      if (!node) return null;
      if (localName(node.name) === 'x') return shared[f]?.[int(node, 'v') ?? 0] ?? null;
      return valueOf(node);
    }));
  }
  return { cache, shared };
}

const SUMMARIES = new Set<string>(['sum', 'count', 'average', 'max', 'min', 'product', 'countNums', 'stdDev', 'stdDevp', 'var', 'varp']);

function lineItems(parent: XmlElement | undefined, tag: string): PivotLineItem[] | undefined {
  const root = kid(parent, tag);
  if (!root) return undefined;
  return kids(root, 'i').map((i) => {
    const item: PivotLineItem = { x: kids(i, 'x').map((x) => int(x, 'v') ?? 0) };
    const type = str(i, 't');
    if (type && type !== 'data') item.type = type;
    const r = int(i, 'r');
    if (r) item.repeat = r;
    const d = int(i, 'i');
    if (d) item.dataIndex = d;
    return item;
  });
}

const OWN_TABLE_ATTRS = new Set(['name', 'cacheId', 'dataCaption', 'rowGrandTotals', 'colGrandTotals', 'xmlns', 'mc:Ignorable', 'xmlns:mc', 'xmlns:xr', 'xr:uid']);
const KEPT_CHILDREN = new Set(['formats', 'conditionalFormats', 'chartFormats', 'filters', 'extLst']);

/** Lit la definition d'un tableau croise ; `shared` = elements partages de chaque champ du cache. */
export function readPivotTable(root: XmlElement, shared: PivotValue[][], fieldCount: number): PivotTable | undefined {
  const loc = kid(root, 'location');
  const ref = parseRange(str(loc, 'ref') ?? '');
  const cacheId = int(root, 'cacheId');
  if (!loc || !ref || cacheId === undefined) return undefined;
  const itemLists: PivotValue[][] = [];
  const fields: PivotFieldDef[] = kids(kid(root, 'pivotFields'), 'pivotField').slice(0, fieldCount).map((pf, f): PivotFieldDef => {
    const def: PivotFieldDef = {};
    const axis = str(pf, 'axis');
    if (axis === 'axisRow') def.axis = 'row';
    else if (axis === 'axisCol') def.axis = 'col';
    else if (axis === 'axisPage') def.axis = 'page';
    if (str(pf, 'defaultSubtotal') === '0') def.defaultSubtotal = false;
    const items: PivotItemDef[] = [];
    const values: PivotValue[] = [];
    for (const it of kids(kid(pf, 'items'), 'item')) {
      const x = int(it, 'x');
      if (x === undefined || str(it, 't') !== undefined) continue;
      const item: PivotItemDef = { value: shared[f]?.[x] ?? null };
      if (optBool(it, 'h')) item.hidden = true;
      const n = str(it, 'n');
      if (n !== undefined) item.caption = n;
      items.push(item);
      values.push(item.value);
    }
    itemLists[f] = values;
    if (items.length) def.items = items;
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(pf.attrs)) if (!['axis', 'dataField', 'defaultSubtotal', 'compact', 'outline'].includes(k) && !(k === 'showAll' && v === '0')) attrs[k] = v;
    if (Object.keys(attrs).length) def.attrs = attrs;
    return def;
  });
  while (fields.length < fieldCount) fields.push({});
  const axisFields = (tag: string): number[] => kids(kid(root, tag), 'field').map((f) => int(f, 'x') ?? 0);
  const dataFields: PivotDataField[] = kids(kid(root, 'dataFields'), 'dataField').map((d, i) => {
    const sub = str(d, 'subtotal');
    const field: PivotDataField = { name: str(d, 'name') ?? `Valeur${i + 1}`, field: int(d, 'fld') ?? 0 };
    if (sub && sub !== 'sum' && SUMMARIES.has(sub)) field.summary = sub as PivotSummary;
    const fmt = int(d, 'numFmtId');
    if (fmt) field.numFmtId = fmt;
    const show = str(d, 'showDataAs');
    if (show) field.showDataAs = show;
    const bf = int(d, 'baseField');
    if (bf) field.baseField = bf;
    const bi = int(d, 'baseItem');
    if (bi) field.baseItem = bi;
    return field;
  });
  const table: PivotTable = {
    name: str(root, 'name') ?? 'TableauCroise',
    cacheId,
    location: ref,
    fields,
    rowFields: axisFields('rowFields'),
    colFields: axisFields('colFields'),
    pageFields: kids(kid(root, 'pageFields'), 'pageField').map((p) => {
      const field = int(p, 'fld') ?? 0;
      const pos = int(p, 'item');
      const selected = pos === undefined ? undefined : itemLists[field]?.[pos];
      return selected === undefined ? { field } : { field, selected };
    }),
    dataFields,
  };
  const rowItems = lineItems(root, 'rowItems');
  const colItems = lineItems(root, 'colItems');
  if (rowItems) table.rowItems = rowItems;
  if (colItems) table.colItems = colItems;
  const style = kid(root, 'pivotTableStyleInfo');
  if (style) {
    table.style = {
      name: str(style, 'name') ?? 'PivotStyleLight16',
      showRowHeaders: str(style, 'showRowHeaders') !== '0',
      showColHeaders: str(style, 'showColHeaders') !== '0',
      showRowStripes: str(style, 'showRowStripes') === '1',
      showColStripes: str(style, 'showColStripes') === '1',
      showLastColumn: str(style, 'showLastColumn') !== '0',
    };
  }
  const caption = str(root, 'dataCaption');
  if (caption) table.dataCaption = caption;
  if (str(root, 'rowGrandTotals') === '0') table.rowGrandTotals = false;
  if (str(root, 'colGrandTotals') === '0') table.colGrandTotals = false;
  const locAttrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(loc.attrs)) if (k !== 'ref') locAttrs[k] = v;
  if (Object.keys(locAttrs).length) table.locationAttrs = locAttrs;
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(root.attrs)) if (!OWN_TABLE_ATTRS.has(k)) attrs[k] = v;
  if (Object.keys(attrs).length) table.attrs = attrs;
  const raw = root.children.filter((c): c is XmlElement => isElement(c) && KEPT_CHILDREN.has(localName(c.name)));
  if (raw.length) table.raw = raw;
  void textOf;
  return table;
}
