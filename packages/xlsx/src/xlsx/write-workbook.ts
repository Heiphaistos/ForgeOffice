// Ecriture d'un classeur .xlsx / .xlsm / .xltx / .xltm ouvrable par Excel.
import { el, type XmlElement } from '@forgeoffice/opc';
import { OoxmlWriter } from './ooxml-writer.ts';
import { rangeName, sheetRangeRef, quoteSheetName } from '../address.ts';
import { MAX_COLS, MAX_ROWS, type PasswordHash, type Sheet, type Workbook } from '../model.ts';
import { toFileFormula } from './formula-names.ts';
import {
  CT_CHARTSHEET, CT_COMMENTS, CT_CORE, CT_CUSTOM, CT_EXTENDED, CT_PERSON, CT_SST, CT_STYLES, CT_TABLE, CT_TEMPLATE,
  CT_PIVOT_CACHE_DEF, CT_PIVOT_CACHE_REC, CT_PIVOT_TABLE, REL_PIVOT_CACHE_DEF, REL_PIVOT_CACHE_REC, REL_PIVOT_TABLE,
  CT_TEMPLATE_MACRO, CT_THEME, CT_THREADED, CT_VBA, CT_VML, CT_WORKBOOK, CT_WORKBOOK_MACRO, CT_WORKSHEET, NS_MAIN, NS_R,
  REL_CHARTSHEET, REL_COMMENTS, REL_CORE, REL_CUSTOM, REL_DRAWING, REL_EXTENDED, REL_HYPERLINK, REL_OFFICE_DOCUMENT,
  REL_PERSON, REL_SHARED_STRINGS, REL_STYLES, REL_TABLE, REL_THEME, REL_THREADED, REL_VBA, REL_VML, REL_WORKSHEET,
} from './ns.ts';
import { cacheDefinitionXml, cacheRecordsXml, cachesElement, pivotTableXml, planCache, type CachePlan } from './pivot-write.ts';
import type { PivotCache, PivotTable } from '../model-pivot.ts';
import { writeStyles } from './styles-part.ts';
import { writeTheme } from './theme-part.ts';
import { writeDrawing, type DrawingCounters } from './write-drawing.ts';
import {
  appXml, commentsVml, commentsXml, coreXml, customXml, DYNAMIC_ARRAY_METADATA, legacyComments, personsXml, tableXml, threadedXml,
} from './write-parts.ts';
import { SharedStringTable, writeChartsheet, writeWorksheet, type SheetWriteRefs } from './write-sheet.ts';

export type XlsxFormat = 'xlsx' | 'xlsm' | 'xltx' | 'xltm';

export interface XlsxWriteOptions {
  /** Format de sortie ; par defaut « xlsm » si le classeur contient un projet VBA, sinon « xlsx ». */
  format?: XlsxFormat;
}

const REL_METADATA = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sheetMetadata';
const CT_METADATA = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml';

/** Fonctions de calcul modernes declarees comme Excel 2021+ (matrices dynamiques, LET, LAMBDA...). */
const CALC_FEATURES = el('extLst', {}, [el('ext', { uri: '{B58B0392-4F1F-4190-BB64-5DF3571DCE5F}', 'xmlns:xcalcf': 'http://schemas.microsoft.com/office/spreadsheetml/2018/calcfeatures' }, [
  el('xcalcf:calcFeatures', {}, ['RD', 'Single', 'FV', 'CNMTM', 'LET_WF', 'LAMBDA_WF', 'ARRAYTEXT_WF'].map((name) => el('xcalcf:feature', { name: `microsoft.com:${name}` }))),
])]);

function workbookContentType(format: XlsxFormat): string {
  if (format === 'xlsm') return CT_WORKBOOK_MACRO;
  if (format === 'xltx') return CT_TEMPLATE;
  if (format === 'xltm') return CT_TEMPLATE_MACRO;
  return CT_WORKBOOK;
}

function passwordAttrs(hash: PasswordHash | undefined): Record<string, string | number | undefined> {
  if (!hash) return {};
  return {
    workbookPassword: hash.legacy,
    workbookAlgorithmName: hash.algorithmName,
    workbookHashValue: hash.hashValue,
    workbookSaltValue: hash.saltValue,
    workbookSpinCount: hash.spinCount,
  };
}

function printNames(sheet: Sheet, index: number): XmlElement[] {
  const out: XmlElement[] = [];
  const setup = sheet.pageSetup;
  if (sheet.autoFilter) {
    out.push(el('definedName', { name: '_xlnm._FilterDatabase', localSheetId: index, hidden: '1' }, [sheetRangeRef(sheet.name, sheet.autoFilter.ref)]));
  }
  if (setup.printArea?.length) {
    out.push(el('definedName', { name: '_xlnm.Print_Area', localSheetId: index }, [
      setup.printArea.map((r) => sheetRangeRef(sheet.name, r)).join(','),
    ]));
  }
  const titles: string[] = [];
  const quoted = quoteSheetName(sheet.name);
  if (setup.printTitleCols) {
    titles.push(`${quoted}!${rangeName({ r1: 0, r2: MAX_ROWS - 1, c1: setup.printTitleCols.first, c2: setup.printTitleCols.last }, true)}`);
  }
  if (setup.printTitleRows) {
    titles.push(`${quoted}!${rangeName({ r1: setup.printTitleRows.first, r2: setup.printTitleRows.last, c1: 0, c2: MAX_COLS - 1 }, true)}`);
  }
  if (titles.length) out.push(el('definedName', { name: '_xlnm.Print_Titles', localSheetId: index }, [titles.join(',')]));
  return out;
}

interface WriteState {
  writer: OoxmlWriter;
  sst: SharedStringTable;
  counters: DrawingCounters & { table: number; comments: number; threaded: number; pivot: number };
  dynamicArrays: boolean;
  /** Caches de tableaux croises ecrits : partie « definition » et plan des elements partages. */
  pivotCaches: Map<number, { part: string; cache: PivotCache; plan: CachePlan }>;
}

/** Ecrit les caches (definition + enregistrements) ; renvoie l'element « pivotCaches » du classeur. */
function writePivotCaches(state: WriteState, wb: Workbook, wbPart: string): XmlElement | undefined {
  const tables = wb.sheets.flatMap((s) => s.pivotTables ?? []);
  const entries: { id: number; rid: string }[] = [];
  (wb.pivotCaches ?? []).forEach((cache, i) => {
    if (state.pivotCaches.has(cache.id) || cache.fields.length === 0) return;
    const mine: PivotTable[] = tables.filter((t) => t.cacheId === cache.id);
    const plan = planCache(cache, mine);
    const defPart = `xl/pivotCache/pivotCacheDefinition${i + 1}.xml`;
    const recPart = `xl/pivotCache/pivotCacheRecords${i + 1}.xml`;
    const recId = state.writer.addRelationship(defPart, REL_PIVOT_CACHE_REC, recPart);
    state.writer.addText(defPart, cacheDefinitionXml(cache, mine, plan, recId), CT_PIVOT_CACHE_DEF);
    state.writer.addText(recPart, cacheRecordsXml(cache, plan), CT_PIVOT_CACHE_REC);
    entries.push({ id: cache.id, rid: state.writer.addRelationship(wbPart, REL_PIVOT_CACHE_DEF, defPart) });
    state.pivotCaches.set(cache.id, { part: defPart, cache, plan });
  });
  return entries.length ? cachesElement(entries) : undefined;
}

function writeSheetPivots(state: WriteState, wb: Workbook, sheet: Sheet, part: string): void {
  const seen = new Set<string>();
  for (const table of sheet.pivotTables ?? []) {
    const entry = state.pivotCaches.get(table.cacheId);
    if (!entry || seen.has(table.name.toLowerCase())) continue;
    seen.add(table.name.toLowerCase());
    state.counters.pivot++;
    const tablePart = `xl/pivotTables/pivotTable${state.counters.pivot}.xml`;
    state.writer.addText(tablePart, pivotTableXml(table, entry.cache, entry.plan, wb).xml, CT_PIVOT_TABLE);
    state.writer.addRelationship(tablePart, REL_PIVOT_CACHE_DEF, entry.part);
    state.writer.addRelationship(part, REL_PIVOT_TABLE, tablePart);
  }
}

function writeSheetPart(state: WriteState, wb: Workbook, sheet: Sheet, index: number, part: string): void {
  const { writer } = state;
  if (sheet.isChartSheet) {
    const drawing = writeDrawing(writer, sheet.drawings.filter((d) => d.kind === 'chart').slice(0, 1), state.counters);
    const drawingId = drawing ? writer.addRelationship(part, REL_DRAWING, drawing) : '';
    writer.addText(part, writeChartsheet(sheet, drawingId), CT_CHARTSHEET);
    return;
  }
  const refs: SheetWriteRefs = {
    hyperlinks: sheet.hyperlinks.map((link) => (link.target && !/^javascript:/i.test(link.target)
      ? writer.addRelationship(part, REL_HYPERLINK, link.target, true) : undefined)),
    tables: [],
  };
  const drawing = writeDrawing(writer, sheet.drawings, state.counters);
  if (drawing) refs.drawing = writer.addRelationship(part, REL_DRAWING, drawing);
  const comments = legacyComments(sheet.notes, sheet.threadedComments);
  if (comments.length) {
    state.counters.comments++;
    const n = state.counters.comments;
    const commentsPart = `xl/comments${n}.xml`;
    const vmlPart = `xl/drawings/vmlDrawing${n}.vml`;
    writer.addXml(commentsPart, commentsXml(comments), CT_COMMENTS);
    writer.addText(vmlPart, commentsVml(comments, index));
    writer.setDefault('vml', CT_VML);
    refs.legacyDrawing = writer.addRelationship(part, REL_VML, vmlPart);
    writer.addRelationship(part, REL_COMMENTS, commentsPart);
  }
  if (sheet.threadedComments.length) {
    state.counters.threaded++;
    const threadedPart = `xl/threadedComments/threadedComment${state.counters.threaded}.xml`;
    writer.addXml(threadedPart, threadedXml(sheet.threadedComments), CT_THREADED);
    writer.addRelationship(part, REL_THREADED, threadedPart);
  }
  for (const table of sheet.tables) {
    state.counters.table++;
    const tablePart = `xl/tables/table${state.counters.table}.xml`;
    writer.addXml(tablePart, tableXml(table, state.counters.table), CT_TABLE);
    refs.tables.push(writer.addRelationship(part, REL_TABLE, tablePart));
  }
  writeSheetPivots(state, wb, sheet, part);
  const result = writeWorksheet(sheet, state.sst, refs);
  if (result.dynamicArrays) state.dynamicArrays = true;
  writer.addText(part, result.xml, CT_WORKSHEET);
}

/** Feuille active visible et au moins une feuille visible (exigences d'Excel). */
function visibleSheets(wb: Workbook): { sheets: Sheet[]; active: number } {
  const sheets = wb.sheets.map((s) => ({ ...s }));
  if (!sheets.some((s) => s.state === 'visible') && sheets[0]) sheets[0].state = 'visible';
  let active = wb.activeSheet >= 0 && wb.activeSheet < sheets.length ? wb.activeSheet : 0;
  if (sheets[active]?.state !== 'visible') active = Math.max(0, sheets.findIndex((s) => s.state === 'visible'));
  return { sheets: sheets.map((s, i) => ({ ...s, view: { ...s.view, tabSelected: i === active } })), active };
}

export async function writeXlsx(wb: Workbook, options: XlsxWriteOptions = {}): Promise<Uint8Array> {
  const format: XlsxFormat = options.format ?? (wb.vbaProject ? 'xlsm' : 'xlsx');
  const writer = new OoxmlWriter();
  const state: WriteState = {
    writer,
    sst: new SharedStringTable(),
    counters: { drawing: 0, chart: 0, image: 0, table: 0, comments: 0, threaded: 0, pivot: 0 },
    dynamicArrays: false,
    pivotCaches: new Map(),
  };
  const wbPart = 'xl/workbook.xml';
  writer.addRelationship('', REL_OFFICE_DOCUMENT, wbPart);
  writer.addRelationship('', REL_CORE, 'docProps/core.xml');
  writer.addRelationship('', REL_EXTENDED, 'docProps/app.xml');
  const encoder = new TextEncoder();
  writer.addBytes('docProps/core.xml', encoder.encode(coreXml(wb.properties)), CT_CORE);
  writer.addBytes('docProps/app.xml', encoder.encode(appXml(wb.properties, wb.sheets.map((s) => s.name))), CT_EXTENDED);
  if (wb.properties.custom && Object.keys(wb.properties.custom).length) {
    writer.addRelationship('', REL_CUSTOM, 'docProps/custom.xml');
    writer.addBytes('docProps/custom.xml', encoder.encode(customXml(wb.properties.custom)), CT_CUSTOM);
  }

  const { sheets, active } = visibleSheets(wb);
  const pivotCaches = writePivotCaches(state, wb, wbPart);
  const sheetEls: XmlElement[] = [];
  const names: XmlElement[] = [];
  sheets.forEach((sheet, i) => {
    const part = sheet.isChartSheet ? `xl/chartsheets/sheet${i + 1}.xml` : `xl/worksheets/sheet${i + 1}.xml`;
    const rid = writer.addRelationship(wbPart, sheet.isChartSheet ? REL_CHARTSHEET : REL_WORKSHEET, part);
    sheetEls.push(el('sheet', { name: sheet.name, sheetId: i + 1, state: sheet.state === 'visible' ? undefined : sheet.state, 'r:id': rid }));
    writeSheetPart(state, wb, sheet, i, part);
    names.push(...printNames(sheet, i));
  });
  for (const name of wb.definedNames) {
    names.push(el('definedName', {
      name: name.name,
      comment: name.comment,
      localSheetId: name.localSheet !== undefined && name.localSheet < sheets.length ? name.localSheet : undefined,
      hidden: name.hidden ? '1' : undefined,
    }, [toFileFormula(name.formula)]));
  }

  writer.addRelationship(wbPart, REL_THEME, 'xl/theme/theme1.xml');
  writer.addBytes('xl/theme/theme1.xml', encoder.encode(writeTheme(wb.theme)), CT_THEME);
  writer.addRelationship(wbPart, REL_STYLES, 'xl/styles.xml');
  writer.addXml('xl/styles.xml', writeStyles(wb.styles), CT_STYLES);
  if (state.sst.items.length) {
    writer.addRelationship(wbPart, REL_SHARED_STRINGS, 'xl/sharedStrings.xml');
    writer.addXml('xl/sharedStrings.xml', state.sst.toXml(), CT_SST);
  }
  if (wb.persons.length) {
    writer.addRelationship(wbPart, REL_PERSON, 'xl/persons/person.xml');
    writer.addXml('xl/persons/person.xml', personsXml(wb.persons), CT_PERSON);
  }
  if (state.dynamicArrays) {
    writer.addRelationship(wbPart, REL_METADATA, 'xl/metadata.xml');
    writer.addBytes('xl/metadata.xml', encoder.encode(DYNAMIC_ARRAY_METADATA), CT_METADATA);
  }
  if (wb.vbaProject && (format === 'xlsm' || format === 'xltm')) {
    writer.addRelationship(wbPart, REL_VBA, 'xl/vbaProject.bin');
    writer.addBytes('xl/vbaProject.bin', wb.vbaProject, CT_VBA);
  }

  const calc = wb.calc;
  const root = el('workbook', { xmlns: NS_MAIN, 'xmlns:r': NS_R }, [
    el('fileVersion', { appName: 'xl', lastEdited: 7, lowestEdited: 7, rupBuild: 27328 }),
    el('workbookPr', { date1904: wb.date1904 ? '1' : undefined, defaultThemeVersion: 202300 }),
    ...(wb.protection ? [el('workbookProtection', {
      ...passwordAttrs(wb.protection.password),
      lockStructure: wb.protection.lockStructure ? '1' : undefined,
      lockWindows: wb.protection.lockWindows ? '1' : undefined,
    })] : []),
    el('bookViews', {}, [el('workbookView', {
      xWindow: 0, yWindow: 0, windowWidth: 28800, windowHeight: 12300,
      firstSheet: wb.firstVisibleTab, activeTab: active || undefined,
    })]),
    el('sheets', {}, sheetEls),
    ...(names.length ? [el('definedNames', {}, names)] : []),
    el('calcPr', {
      calcId: calc.calcId ?? 191029,
      calcMode: calc.mode === 'auto' ? undefined : calc.mode,
      fullCalcOnLoad: calc.fullCalcOnLoad ? '1' : undefined,
      iterate: calc.iterate ? '1' : undefined,
      iterateCount: calc.iterateCount,
      iterateDelta: calc.iterateDelta,
      fullPrecision: calc.fullPrecision === false ? '0' : undefined,
    }),
    ...(pivotCaches ? [pivotCaches] : []),
    CALC_FEATURES,
  ]);
  writer.addXml(wbPart, root, workbookContentType(format));
  return writer.build();
}
