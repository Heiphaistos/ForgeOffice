// Lecture d'un classeur .xlsx / .xlsm / .xltx / .xltm vers le modele.
import { OpcPackage, PackageError, textOf, XmlError, type PackageLimits, type XmlElement } from '@forgeoffice/opc';
import { MAX_COLS, MAX_ROWS, type CellRange, type DocumentProperties, type Sheet, type Workbook, type WorkbookFormat } from '../model.ts';
import { parseRange, splitSheetRef } from '../address.ts';
import { SpreadsheetError, strings } from '../strings.ts';
import { createBlankWorkbook, createSheet, uniqueSheetName } from '../workbook.ts';
import { fromFileFormula } from './formula-names.ts';
import {
  CT_TEMPLATE, CT_TEMPLATE_MACRO, CT_WORKBOOK_MACRO, REL_CHART, REL_COMMENTS, REL_CORE, REL_CUSTOM, REL_DRAWING,
  REL_EXTENDED, REL_OFFICE_DOCUMENT, REL_PERSON, REL_PIVOT_CACHE_DEF, REL_PIVOT_TABLE, REL_SHARED_STRINGS, REL_STYLES, REL_THEME, REL_THREADED, REL_VBA, REL_VML,
} from './ns.ts';
import { readDrawing } from './read-drawing.ts';
import { readPivotCache, readPivotTable } from './pivot-read.ts';
import type { PivotCache, PivotValue } from '../model-pivot.ts';
import { applyVmlToNotes, readComments, readPersons, readTable, readThreadedComments } from './read-parts.ts';
import { readPasswordHash, readSharedStrings, readWorksheet, type SharedString } from './read-sheet.ts';
import { readStyles } from './styles-part.ts';
import { readTheme } from './theme-part.ts';
import { bool, int, kid, kids, localName, optBool, relAttr, str } from './xml-util.ts';

const MAX_SHEETS = 4096;

export interface XlsxReadOptions {
  /** Ignore images, formes et graphiques (ouverture plus rapide). */
  skipDrawings?: boolean;
  /** Limites de decompression (bombes zip) ; defaut : celles de @forgeoffice/opc. */
  limits?: PackageLimits;
}

function formatOf(contentType: string | undefined): WorkbookFormat {
  if (contentType === CT_WORKBOOK_MACRO) return 'xlsm';
  if (contentType === CT_TEMPLATE) return 'xltx';
  if (contentType === CT_TEMPLATE_MACRO) return 'xltm';
  return 'xlsx';
}

/** Decoupe une liste de references separees par des virgules (hors noms cites). */
function splitRefs(formula: string): string[] {
  const out: string[] = [];
  let quoted = false;
  let start = 0;
  for (let i = 0; i < formula.length; i++) {
    const ch = formula.charAt(i);
    if (ch === "'") quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(formula.slice(start, i));
      start = i + 1;
    }
  }
  out.push(formula.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

function applyPrintName(name: string, formula: string, sheet: Sheet): boolean {
  const ranges: CellRange[] = [];
  for (const ref of splitRefs(formula)) {
    const range = parseRange(splitSheetRef(ref).local);
    if (!range) return false;
    ranges.push(range);
  }
  if (name === '_xlnm.Print_Area') {
    sheet.pageSetup.printArea = ranges;
    return true;
  }
  for (const range of ranges) {
    if (range.c1 === 0 && range.c2 === MAX_COLS - 1) sheet.pageSetup.printTitleRows = { first: range.r1, last: range.r2 };
    else if (range.r1 === 0 && range.r2 === MAX_ROWS - 1) sheet.pageSetup.printTitleCols = { first: range.c1, last: range.c2 };
    else return false;
  }
  return true;
}

/** Ajoute un nom defini au classeur ; zones et titres d'impression vont dans la mise en page de la feuille. */
export function addDefinedName(wb: Workbook, name: string, formula: string, local?: number, hidden?: boolean, comment?: string): void {
  const sheet = local === undefined ? undefined : wb.sheets[local];
  if (name === '_xlnm._FilterDatabase') return;
  if (sheet && (name === '_xlnm.Print_Area' || name === '_xlnm.Print_Titles') && applyPrintName(name, formula, sheet)) return;
  const defined: Workbook['definedNames'][number] = { name, formula };
  if (local !== undefined && sheet) defined.localSheet = local;
  if (hidden) defined.hidden = true;
  if (comment) defined.comment = comment;
  wb.definedNames.push(defined);
}

function readDefinedNames(root: XmlElement, wb: Workbook): void {
  for (const node of kids(kid(root, 'definedNames'), 'definedName')) {
    addDefinedName(wb, str(node, 'name') ?? '', fromFileFormula(textOf(node)), int(node, 'localSheetId'), optBool(node, 'hidden'), str(node, 'comment'));
  }
}

async function readProperties(pkg: OpcPackage, wb: Workbook): Promise<void> {
  const props: DocumentProperties = {};
  const corePart = await pkg.relatedPart('', REL_CORE.slice(REL_CORE.lastIndexOf('/')));
  if (corePart && pkg.has(corePart)) {
    const core = await pkg.readXml(corePart);
    const map: Record<string, keyof DocumentProperties> = {
      title: 'title', subject: 'subject', creator: 'creator', keywords: 'keywords', description: 'description',
      lastModifiedBy: 'lastModifiedBy', category: 'category', contentStatus: 'contentStatus', created: 'created', modified: 'modified',
    };
    for (const node of kids(core)) {
      const key = map[localName(node.name)];
      const value = textOf(node);
      if (key && key !== 'custom' && value) props[key] = value;
    }
  }
  const appPart = await pkg.relatedPart('', REL_EXTENDED.slice(REL_EXTENDED.lastIndexOf('/')));
  if (appPart && pkg.has(appPart)) {
    const app = await pkg.readXml(appPart);
    const company = textOf(kid(app, 'Company'));
    if (company) props.company = company;
    const manager = textOf(kid(app, 'Manager'));
    if (manager) props.manager = manager;
    const application = textOf(kid(app, 'Application'));
    if (application) props.application = application;
    const version = textOf(kid(app, 'AppVersion'));
    if (version) props.appVersion = version;
  }
  const customPart = await pkg.relatedPart('', REL_CUSTOM.slice(REL_CUSTOM.lastIndexOf('/')));
  if (customPart && pkg.has(customPart)) {
    const custom: Record<string, string | number | boolean> = {};
    for (const prop of kids(await pkg.readXml(customPart), 'property')) {
      const name = str(prop, 'name');
      const value = kids(prop)[0];
      if (!name || !value) continue;
      const type = localName(value.name);
      const raw = textOf(value);
      if (type === 'bool') custom[name] = raw === 'true' || raw === '1';
      else if (/^(i[1-8]|ui[1-8]|int|uint|r4|r8|decimal)$/.test(type) && Number.isFinite(Number(raw))) custom[name] = Number(raw);
      else custom[name] = raw;
    }
    if (Object.keys(custom).length) props.custom = custom;
  }
  wb.properties = props;
}

interface SheetEntry {
  name: string;
  state: Sheet['state'];
  part: string;
  chart: boolean;
}

type PivotCaches = Map<number, { cache: PivotCache; shared: PivotValue[][] }>;

async function readSheetPart(pkg: OpcPackage, entry: SheetEntry, sheet: Sheet, sst: SharedString[], wb: Workbook, options: XlsxReadOptions, pivots: PivotCaches): Promise<void> {
  const rels = await pkg.relationships(entry.part);
  if (entry.chart) {
    const root = await pkg.readXml(entry.part);
    sheet.isChartSheet = true;
    const drawingRel = rels.find((r) => r.type === REL_DRAWING && !r.external);
    if (drawingRel && pkg.has(drawingRel.target) && !options.skipDrawings) sheet.drawings = await readDrawing(pkg, drawingRel.target);
    const view = kid(kid(root, 'sheetViews'), 'sheetView');
    if (optBool(view, 'tabSelected')) sheet.view.tabSelected = true;
    return;
  }
  const links = readWorksheet(await pkg.readText(entry.part), sheet, { sst, date1904: wb.date1904, rels });
  const byId = new Map(rels.map((r) => [r.id, r]));
  for (const rid of links.tables) {
    const rel = byId.get(rid);
    if (!rel || rel.external || !pkg.has(rel.target)) continue;
    const table = readTable(await pkg.readXml(rel.target));
    if (table) sheet.tables.push(table);
  }
  for (const rel of rels.filter((r) => r.type === REL_PIVOT_TABLE && !r.external && pkg.has(r.target))) {
    const root = await pkg.readXml(rel.target);
    const owner = pivots.get(int(root, 'cacheId') ?? -1);
    const table = owner && readPivotTable(root, owner.shared, owner.cache.fields.length);
    if (table) (sheet.pivotTables ??= []).push(table);
  }
  const comments = rels.find((r) => r.type === REL_COMMENTS && !r.external);
  if (comments && pkg.has(comments.target)) {
    sheet.notes = readComments(await pkg.readXml(comments.target));
    const vml = rels.find((r) => r.type === REL_VML && !r.external);
    if (vml && pkg.has(vml.target) && sheet.notes.length) applyVmlToNotes(await pkg.readText(vml.target), sheet.notes);
  }
  const threaded = rels.find((r) => r.type === REL_THREADED && !r.external);
  if (threaded && pkg.has(threaded.target)) sheet.threadedComments = readThreadedComments(await pkg.readXml(threaded.target));
  if (links.drawing && !options.skipDrawings) {
    const rel = byId.get(links.drawing);
    if (rel && !rel.external && pkg.has(rel.target)) sheet.drawings = await readDrawing(pkg, rel.target);
  }
}

async function openPackage(bytes: Uint8Array, limits?: PackageLimits): Promise<OpcPackage> {
  try {
    return await OpcPackage.open(bytes, limits);
  } catch (error) {
    if (error instanceof PackageError || error instanceof XmlError) throw new SpreadsheetError(strings.zipInvalid);
    throw error;
  }
}

/** Lit un classeur OOXML. Les erreurs de structure deviennent des SpreadsheetError en francais. */
export async function readXlsx(bytes: Uint8Array, options: XlsxReadOptions = {}): Promise<Workbook> {
  const pkg = await openPackage(bytes, options.limits);
  try {
    return await readPackage(pkg, options);
  } catch (error) {
    if (error instanceof XmlError || error instanceof PackageError) throw new SpreadsheetError(`${strings.notSpreadsheet} (${error.message})`);
    throw error;
  }
}

async function readPackage(pkg: OpcPackage, options: XlsxReadOptions): Promise<Workbook> {
  const workbookPart = (await pkg.relatedPart('', REL_OFFICE_DOCUMENT.slice(REL_OFFICE_DOCUMENT.lastIndexOf('/'))))
    ?? (pkg.has('xl/workbook.xml') ? 'xl/workbook.xml' : undefined);
  if (!workbookPart || !pkg.has(workbookPart)) throw new SpreadsheetError(strings.noWorkbookPart);
  const root = await pkg.readXml(workbookPart);
  const rels = await pkg.relationships(workbookPart);
  const relOf = (type: string): string | undefined => rels.find((r) => r.type === type && !r.external && pkg.has(r.target))?.target;

  const wb = createBlankWorkbook();
  wb.sheets = [];
  wb.sourceFormat = formatOf(pkg.contentType(workbookPart));
  const props = kid(root, 'workbookPr');
  wb.date1904 = bool(props, 'date1904', false);

  const stylesPart = relOf(REL_STYLES);
  wb.styles = readStyles(stylesPart ? await pkg.readXml(stylesPart) : undefined);
  const themePart = relOf(REL_THEME);
  wb.theme = readTheme(themePart ? await pkg.readText(themePart) : undefined);
  const sstPart = relOf(REL_SHARED_STRINGS);
  const sst = sstPart ? readSharedStrings(await pkg.readXml(sstPart)) : [];
  const personPart = relOf(REL_PERSON);
  if (personPart) wb.persons = readPersons(await pkg.readXml(personPart));
  const vbaPart = relOf(REL_VBA);
  if (vbaPart) wb.vbaProject = await pkg.readBytes(vbaPart);

  const protection = kid(root, 'workbookProtection');
  if (protection) {
    wb.protection = {};
    if (optBool(protection, 'lockStructure')) wb.protection.lockStructure = true;
    if (optBool(protection, 'lockWindows')) wb.protection.lockWindows = true;
    const hash = readPasswordHash(protection);
    if (hash) wb.protection.password = hash;
  }
  const view = kid(kid(root, 'bookViews'), 'workbookView');
  wb.activeSheet = int(view, 'activeTab') ?? 0;
  const firstTab = int(view, 'firstSheet');
  if (firstTab) wb.firstVisibleTab = firstTab;

  const pivots: PivotCaches = new Map();
  for (const node of kids(kid(root, 'pivotCaches'), 'pivotCache')) {
    const id = int(node, 'cacheId');
    const rel = rels.find((r) => r.id === relAttr(node) && r.type === REL_PIVOT_CACHE_DEF && !r.external && pkg.has(r.target));
    if (id === undefined || !rel) continue;
    const loaded = await readPivotCache(pkg, rel.target, id);
    if (loaded) pivots.set(id, loaded);
  }
  if (pivots.size) wb.pivotCaches = [...pivots.values()].map((p) => p.cache);

  const entries: SheetEntry[] = [];
  for (const node of kids(kid(root, 'sheets'), 'sheet')) {
    const rid = relAttr(node);
    const rel = rels.find((r) => r.id === rid);
    if (!rel || rel.external || !pkg.has(rel.target)) continue;
    const state = str(node, 'state');
    entries.push({
      name: str(node, 'name') ?? `${strings.sheetPrefix}${entries.length + 1}`,
      state: state === 'hidden' || state === 'veryHidden' ? state : 'visible',
      part: rel.target,
      chart: rel.type.endsWith('/chartsheet') || rel.type === REL_CHART,
    });
  }
  if (entries.length === 0) throw new SpreadsheetError(strings.noSheets);
  if (entries.length > MAX_SHEETS) throw new SpreadsheetError(strings.tooManySheets);
  for (const entry of entries) {
    const sheet = createSheet(uniqueSheetName(wb, entry.name));
    sheet.state = entry.state;
    wb.sheets.push(sheet);
    await readSheetPart(pkg, entry, sheet, sst, wb, options, pivots);
  }
  if (wb.activeSheet >= wb.sheets.length) wb.activeSheet = 0;
  readDefinedNames(root, wb);
  const calc = kid(root, 'calcPr');
  if (calc) {
    const mode = str(calc, 'calcMode');
    wb.calc = { mode: mode === 'manual' || mode === 'autoNoTable' ? mode : 'auto' };
    const id = int(calc, 'calcId');
    if (id !== undefined) wb.calc.calcId = id;
    if (optBool(calc, 'fullCalcOnLoad')) wb.calc.fullCalcOnLoad = true;
    if (optBool(calc, 'iterate')) wb.calc.iterate = true;
    const count = int(calc, 'iterateCount');
    if (count !== undefined) wb.calc.iterateCount = count;
    const delta = Number(str(calc, 'iterateDelta'));
    if (str(calc, 'iterateDelta') !== undefined && Number.isFinite(delta)) wb.calc.iterateDelta = delta;
    if (optBool(calc, 'fullPrecision') === false) wb.calc.fullPrecision = false;
  }
  await readProperties(pkg, wb);
  return wb;
}
