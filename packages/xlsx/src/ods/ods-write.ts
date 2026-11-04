// Ecriture OpenDocument tableur (.ods) : feuilles (masquees, couleur d'onglet), valeurs, dates, formules
// (OpenFormula), fusions, largeurs/hauteurs, lignes et colonnes masquees, styles de base (police, couleurs,
// alignement, retour a la ligne, bordures), formats de nombre courants, plages nommees, proprietes.
import { MAX_COLS, type Cell, type CellFormat, type Sheet, type Workbook } from '../model.ts';
import { escAttr, escXml } from '../xlsx/xml-util.ts';
import { isCellError, isDateFormatId, numberFormatCode, resolveColor, serialToDate } from '../workbook.ts';
import { buildZip } from '../zip.ts';
import { cm, colWidthToPt, excelToOdfFormula, NS, ODS_MIME } from './ods-common.ts';

const NS_DECL = Object.entries({ ...NS, tableooo: 'http://openoffice.org/2009/table', calcext: 'urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0' })
  .map(([prefix, uri]) => `xmlns:${prefix}="${uri}"`).join(' ');

/** Code de format Excel -> elements d'un style de nombre ODF ; undefined = non convertible (Standard). */
export function numberStyleXml(name: string, code: string): string | undefined {
  const section = (code.split(';')[0] ?? '').replace(/\[[^\]]*\]/g, '');
  if (!section || /^general$/i.test(section)) return undefined;
  if (section === '@') return `<number:text-style style:name="${name}"><number:text-content/></number:text-style>`;
  const isDate = /[dy]|(?:^|[^"])[hs]/i.test(section.replace(/"[^"]*"/g, '')) && !/[0#]/.test(section.replace(/"[^"]*"/g, ''));
  if (isDate) {
    const parts: string[] = [];
    const hasTime = /[hs]/i.test(section);
    const re = /"([^"]*)"|\\(.)|(yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM)|(.)/gi;
    let previous = '';
    for (const m of section.matchAll(re)) {
      const literal = m[1] ?? m[2] ?? m[4];
      if (literal !== undefined) {
        parts.push(`<number:text>${escXml(literal)}</number:text>`);
        continue;
      }
      const token = (m[3] ?? '').toLowerCase();
      const long = ' number:style="long"';
      // « mm » apres une heure (ou avant des secondes) = minutes.
      const minutes = (token === 'mm' || token === 'm') && (/h/.test(previous) || (hasTime && !/[dy]/i.test(section)));
      if (token.startsWith('y')) parts.push(`<number:year${token.length > 2 ? long : ''}/>`);
      else if (minutes) parts.push(`<number:minutes${token.length > 1 ? long : ''}/>`);
      else if (token === 'mmmm' || token === 'mmm') parts.push(`<number:month number:textual="true"${token.length > 3 ? long : ''}/>`);
      else if (token.startsWith('m')) parts.push(`<number:month${token.length > 1 ? long : ''}/>`);
      else if (token === 'dddd' || token === 'ddd') parts.push(`<number:day-of-week${token.length > 3 ? long : ''}/>`);
      else if (token.startsWith('d')) parts.push(`<number:day${token.length > 1 ? long : ''}/>`);
      else if (token.startsWith('h')) parts.push(`<number:hours${token.length > 1 ? long : ''}/>`);
      else if (token.startsWith('s')) parts.push(`<number:seconds${token.length > 1 ? long : ''}/>`);
      else if (token === 'am/pm') parts.push('<number:am-pm/>');
      if (token) previous = token;
    }
    return `<number:date-style style:name="${name}">${parts.join('')}</number:date-style>`;
  }
  const numeric = section.match(/[#0,]*0(?:\.0+)?|#(?:[#,]*)(?:\.[0#]+)?/);
  if (!numeric) return undefined;
  const body = numeric[0];
  const decimals = (body.split('.')[1] ?? '').replace(/#/g, '').length;
  const minInt = Math.max(1, ((body.split('.')[0] ?? '').match(/0/g) ?? []).length);
  const grouping = body.includes(',') ? ' number:grouping="true"' : '';
  const before = section.slice(0, numeric.index ?? 0).replace(/["\\]/g, '');
  const after = section.slice((numeric.index ?? 0) + body.length).replace(/["\\]/g, '');
  const percent = after.includes('%');
  const scientific = /E[+-]0+/i.test(after);
  const number = scientific
    ? `<number:scientific-number number:decimal-places="${decimals}" number:min-integer-digits="${minInt}" number:min-exponent-digits="2"/>`
    : `<number:number number:decimal-places="${decimals}" number:min-integer-digits="${minInt}"${grouping}/>`;
  const text = (t: string): string => (t ? `<number:text>${escXml(t)}</number:text>` : '');
  const tag = percent ? 'percentage-style' : 'number-style';
  return `<number:${tag} style:name="${name}">${text(before)}${number}${text(scientific ? after.replace(/E[+-]0+/i, '') : after)}</number:${tag}>`;
}

class StyleBook {
  readonly automatic: string[] = [];
  private readonly cellStyles = new Map<number, string>();
  private readonly dataStyles = new Map<string, string | undefined>();
  private readonly simple = new Map<string, string>();
  private readonly wb: Workbook;

  constructor(wb: Workbook) {
    this.wb = wb;
  }

  /** Style automatique simple (colonne, ligne, table) deduplique par contenu. */
  named(prefix: string, xml: (name: string) => string, key: string): string {
    const found = this.simple.get(key);
    if (found) return found;
    const name = `${prefix}${this.simple.size + 1}`;
    this.simple.set(key, name);
    this.automatic.push(xml(name));
    return name;
  }

  private dataStyle(code: string): string | undefined {
    if (this.dataStyles.has(code)) return this.dataStyles.get(code);
    const name = `N${this.dataStyles.size + 100}`;
    const xml = numberStyleXml(name, code);
    this.dataStyles.set(code, xml ? name : undefined);
    if (xml) this.automatic.push(xml);
    return xml ? name : undefined;
  }

  cell(styleId: number | undefined): string | undefined {
    if (!styleId) return undefined;
    const cached = this.cellStyles.get(styleId);
    if (cached !== undefined) return cached || undefined;
    const xf = this.wb.styles.cellXfs[styleId];
    const name = xf ? this.cellXml(`ce${this.cellStyles.size + 1}`, xf) : undefined;
    this.cellStyles.set(styleId, name ?? '');
    return name;
  }

  private cellXml(name: string, xf: CellFormat): string | undefined {
    const { wb } = this;
    const font = wb.styles.fonts[xf.fontId];
    const text: string[] = [];
    if (font) {
      text.push(`style:font-name="${escAttr(font.name)}" fo:font-size="${font.size}pt"`);
      if (font.bold) text.push('fo:font-weight="bold"');
      if (font.italic) text.push('fo:font-style="italic"');
      if (font.underline) text.push('style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"');
      if (font.strike) text.push('style:text-line-through-style="solid"');
      const color = resolveColor(wb, font.color);
      if (color) text.push(`fo:color="#${color}"`);
    }
    const cellProps: string[] = [];
    const fill = wb.styles.fills[xf.fillId];
    if (fill?.type === 'pattern' && fill.pattern !== 'none' && fill.pattern !== 'gray125') {
      const bg = resolveColor(wb, fill.pattern === 'solid' ? fill.fg : fill.bg ?? fill.fg);
      if (bg) cellProps.push(`fo:background-color="#${bg}"`);
    }
    const border = wb.styles.borders[xf.borderId];
    const sides = [['left', border?.left], ['right', border?.right], ['top', border?.top], ['bottom', border?.bottom]] as const;
    for (const [side, edge] of sides) {
      if (!edge) continue;
      const width = edge.style === 'thick' ? '2.5pt' : edge.style.startsWith('medium') ? '1.5pt' : '0.75pt';
      const kind = edge.style === 'double' ? 'double' : /dash/i.test(edge.style) ? 'dashed' : edge.style === 'dotted' || edge.style === 'hair' ? 'dotted' : 'solid';
      cellProps.push(`fo:border-${side}="${width} ${kind} #${resolveColor(wb, edge.color) ?? '000000'}"`);
    }
    const a = xf.alignment;
    if (a?.wrapText) cellProps.push('fo:wrap-option="wrap"');
    if (a?.vertical) cellProps.push(`style:vertical-align="${a.vertical === 'center' ? 'middle' : a.vertical === 'top' ? 'top' : 'bottom'}"`);
    if (a?.shrinkToFit) cellProps.push('style:shrink-to-fit="true"');
    if (a?.textRotation && a.textRotation <= 180) cellProps.push(`style:rotation-angle="${a.textRotation > 90 ? 360 - (a.textRotation - 90) : a.textRotation}"`);
    const para: string[] = [];
    const h = a?.horizontal;
    if (h === 'left' || h === 'right' || h === 'center' || h === 'justify') para.push(`fo:text-align="${h === 'left' ? 'start' : h === 'right' ? 'end' : h}"`);
    if (a?.indent) para.push(`fo:margin-left="${(a.indent * 0.3).toFixed(2)}cm"`);
    const data = xf.numFmtId ? this.dataStyle(numberFormatCode(wb.styles, xf.numFmtId)) : undefined;
    if (!text.length && !cellProps.length && !para.length && !data) return undefined;
    this.automatic.push(
      `<style:style style:name="${name}" style:family="table-cell" style:parent-style-name="Default"${data ? ` style:data-style-name="${data}"` : ''}>`
      + (cellProps.length ? `<style:table-cell-properties ${cellProps.join(' ')}/>` : '')
      + (para.length ? `<style:paragraph-properties ${para.join(' ')}/>` : '')
      + (text.length ? `<style:text-properties ${text.join(' ')}/>` : '')
      + '</style:style>',
    );
    return name;
  }
}

function pad(n: number, size = 2): string {
  return String(n).padStart(size, '0');
}

function isoDate(serial: number, date1904: boolean): string {
  const d = serialToDate(serial, date1904);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function paragraphs(text: string): string {
  return text.split('\n').map((line) => {
    const body = escXml(line).replace(/ {2,}/g, (spaces) => ` <text:s text:c="${spaces.length - 1}"/>`).replace(/\t/g, '<text:tab/>');
    return `<text:p>${body}</text:p>`;
  }).join('');
}

function cellXml(wb: Workbook, cell: Cell, styles: StyleBook, span: string): string {
  const attrs: string[] = [];
  const style = styles.cell(cell.styleId);
  if (style) attrs.push(`table:style-name="${style}"`);
  if (span) attrs.push(span);
  if (cell.formula !== undefined) attrs.push(`table:formula="${escAttr(excelToOdfFormula(cell.formula))}"`);
  const v = cell.value;
  let body = '';
  if (typeof v === 'number') {
    const xf = wb.styles.cellXfs[cell.styleId ?? 0];
    if (xf && isDateFormatId(wb.styles, xf.numFmtId) && v >= 0) {
      attrs.push(`office:value-type="date" office:date-value="${isoDate(v, wb.date1904)}" calcext:value-type="date"`);
    } else {
      const type = xf && /%/.test(numberFormatCode(wb.styles, xf.numFmtId)) ? 'percentage' : 'float';
      attrs.push(`office:value-type="${type}" office:value="${v}" calcext:value-type="${type}"`);
    }
    body = `<text:p>${v}</text:p>`;
  } else if (typeof v === 'boolean') {
    attrs.push(`office:value-type="boolean" office:boolean-value="${v}" calcext:value-type="boolean"`);
    body = `<text:p>${v ? 'VRAI' : 'FAUX'}</text:p>`;
  } else if (isCellError(v)) {
    attrs.push('calcext:value-type="error"');
    body = `<text:p>${escXml(v.error)}</text:p>`;
  } else if (typeof v === 'string') {
    attrs.push('office:value-type="string" calcext:value-type="string"');
    body = paragraphs(v);
  }
  return body ? `<table:table-cell ${attrs.join(' ')}>${body}</table:table-cell>` : `<table:table-cell${attrs.length ? ` ${attrs.join(' ')}` : ''}/>`;
}

/** Cellules couvertes par des fusions (bornees a 100 000 cellules par feuille). */
function mergeMaps(sheet: Sheet): { spans: Map<string, string>; covered: Map<number, Set<number>> } {
  const spans = new Map<string, string>();
  const covered = new Map<number, Set<number>>();
  let budget = 100_000;
  for (const m of sheet.merges) {
    const size = (m.r2 - m.r1 + 1) * (m.c2 - m.c1 + 1);
    if (size > budget) continue;
    budget -= size;
    spans.set(`${m.r1},${m.c1}`, `table:number-columns-spanned="${m.c2 - m.c1 + 1}" table:number-rows-spanned="${m.r2 - m.r1 + 1}"`);
    for (let r = m.r1; r <= m.r2; r++) {
      let set = covered.get(r);
      if (!set) covered.set(r, (set = new Set()));
      for (let c = m.c1; c <= m.c2; c++) if (r !== m.r1 || c !== m.c1) set.add(c);
    }
  }
  return { spans, covered };
}

function tableXml(wb: Workbook, sheet: Sheet, styles: StyleBook): string {
  const out: string[] = [];
  const tableStyle = styles.named('ta', (name) => `<style:style style:name="${name}" style:family="table" style:master-page-name="Default"><style:table-properties table:display="${sheet.state === 'visible'}"${sheet.tabColor && resolveColor(wb, sheet.tabColor) ? ` tableooo:tab-color="#${resolveColor(wb, sheet.tabColor)}"` : ''}/></style:style>`, `table:${sheet.state === 'visible'}:${resolveColor(wb, sheet.tabColor) ?? ''}`);
  out.push(`<table:table table:name="${escAttr(sheet.name)}" table:style-name="${tableStyle}">`);
  const defaultWidth = sheet.defaultColWidth ?? (sheet.baseColWidth ?? 8) + 0.71;
  const colStyle = (width: number): string => styles.named('co', (name) => `<style:style style:name="${name}" style:family="table-column"><style:table-column-properties fo:break-before="auto" style:column-width="${cm(colWidthToPt(width))}"/></style:style>`, `co:${width}`);
  let col = 0;
  const cols = [...sheet.cols].sort((a, b) => a.min - b.min);
  for (const info of cols) {
    if (info.min < col || info.min >= MAX_COLS) continue;
    if (info.min > col) out.push(`<table:table-column table:style-name="${colStyle(defaultWidth)}" table:number-columns-repeated="${info.min - col}"/>`);
    const max = Math.min(info.max, MAX_COLS - 1);
    out.push(`<table:table-column table:style-name="${colStyle(info.width ?? defaultWidth)}"${info.max > info.min ? ` table:number-columns-repeated="${max - info.min + 1}"` : ''}${info.hidden ? ' table:visibility="collapse"' : ''}/>`);
    col = max + 1;
  }
  const { spans, covered } = mergeMaps(sheet);
  let usedCols = 0;
  for (const line of sheet.cells.values()) for (const ci of line.keys()) usedCols = Math.max(usedCols, ci + 1);
  for (const set of covered.values()) for (const ci of set) usedCols = Math.max(usedCols, ci + 1);
  if (usedCols > col) out.push(`<table:table-column table:style-name="${colStyle(defaultWidth)}" table:number-columns-repeated="${usedCols - col}"/>`);
  const rowIndexes = [...new Set([...sheet.cells.keys(), ...sheet.rows.keys(), ...covered.keys()])].sort((a, b) => a - b);
  let row = 0;
  for (const r of rowIndexes) {
    if (r > row) out.push(`<table:table-row table:number-rows-repeated="${r - row}"><table:table-cell/></table:table-row>`);
    const info = sheet.rows.get(r);
    const height = info?.height;
    const rowStyle = height !== undefined
      ? styles.named('ro', (name) => `<style:style style:name="${name}" style:family="table-row"><style:table-row-properties style:row-height="${height}pt" style:use-optimal-row-height="false"/></style:style>`, `ro:${height}`)
      : undefined;
    const line = sheet.cells.get(r);
    const coveredCols = covered.get(r);
    const colsHere = [...new Set([...(line?.keys() ?? []), ...(coveredCols ?? [])])].sort((a, b) => a - b);
    const cells: string[] = [];
    let c = 0;
    for (const ci of colsHere) {
      if (ci > c) cells.push(`<table:table-cell table:number-columns-repeated="${ci - c}"/>`);
      const cell = line?.get(ci);
      if (coveredCols?.has(ci)) cells.push(cell ? cellXml(wb, cell, styles, '').replace(/^<table:table-cell/, '<table:covered-table-cell').replace(/<\/table:table-cell>$/, '</table:covered-table-cell>') : '<table:covered-table-cell/>');
      else cells.push(cell ? cellXml(wb, cell, styles, spans.get(`${r},${ci}`) ?? '') : '<table:table-cell/>');
      c = ci + 1;
    }
    if (cells.length === 0) cells.push('<table:table-cell/>');
    out.push(`<table:table-row${rowStyle ? ` table:style-name="${rowStyle}"` : ''}${info?.hidden ? ' table:visibility="collapse"' : ''}>${cells.join('')}</table:table-row>`);
    row = r + 1;
  }
  if (rowIndexes.length === 0) out.push('<table:table-row><table:table-cell/></table:table-row>');
  out.push('</table:table>');
  return out.join('');
}

function namedXml(wb: Workbook): string {
  const items: string[] = [];
  for (const dn of wb.definedNames) {
    if (dn.name.startsWith('_xlnm.')) continue;
    const odf = excelToOdfFormula(dn.formula).slice('of:='.length);
    const single = /^\[[^\][]+\]$/.test(odf);
    items.push(single
      ? `<table:named-range table:name="${escAttr(dn.name)}" table:base-cell-address="${escAttr(odf.slice(1, -1).split(':')[0] ?? '')}" table:cell-range-address="${escAttr(odf.slice(1, -1))}"/>`
      : `<table:named-expression table:name="${escAttr(dn.name)}" table:base-cell-address="$'${escAttr(wb.sheets[0]?.name ?? 'Feuil1')}'.$A$1" table:expression="of:=${escAttr(odf)}"/>`);
  }
  return items.length ? `<table:named-expressions>${items.join('')}</table:named-expressions>` : '';
}

function metaXml(wb: Workbook): string {
  const p = wb.properties;
  const now = new Date().toISOString().slice(0, 19);
  const item = (tag: string, value: string | undefined): string => (value ? `<${tag}>${escXml(value)}</${tag}>` : '');
  return `<?xml version="1.0" encoding="UTF-8"?><office:document-meta ${NS_DECL} office:version="1.3"><office:meta>`
    + `<meta:generator>ForgeOffice Tableur</meta:generator>${item('dc:title', p.title)}${item('dc:subject', p.subject)}${item('dc:description', p.description)}`
    + `${item('meta:initial-creator', p.creator)}${item('dc:creator', p.lastModifiedBy ?? p.creator)}${item('meta:creation-date', p.created ?? now)}<dc:date>${now}</dc:date>`
    + '</office:meta></office:document-meta>';
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NS_DECL} office:version="1.3"><office:styles>`
  + '<style:default-style style:family="table-cell"><style:paragraph-properties style:tab-stop-distance="1.25cm"/><style:text-properties style:font-name="Aptos Narrow" fo:font-size="11pt" fo:language="fr" fo:country="FR"/></style:default-style>'
  + '<style:style style:name="Default" style:family="table-cell"/></office:styles>'
  + '<office:automatic-styles><style:page-layout style:name="pm1"/></office:automatic-styles>'
  + '<office:master-styles><style:master-page style:name="Default" style:page-layout-name="pm1"/></office:master-styles></office:document-styles>';

const MANIFEST = '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">'
  + `<manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="${ODS_MIME}"/>`
  + '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'
  + '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>'
  + '<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/></manifest:manifest>';

/** Ecrit le classeur au format OpenDocument (.ods). */
export async function writeOds(wb: Workbook): Promise<Uint8Array> {
  const styles = new StyleBook(wb);
  const tables = wb.sheets.filter((s) => !s.isChartSheet).map((s) => tableXml(wb, s, styles)).join('');
  const content = `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS_DECL} office:version="1.3">`
    + `<office:automatic-styles>${styles.automatic.join('')}</office:automatic-styles>`
    + `<office:body><office:spreadsheet>${tables}${namedXml(wb)}</office:spreadsheet></office:body></office:document-content>`;
  const encoder = new TextEncoder();
  return buildZip([
    { path: 'mimetype', data: encoder.encode(ODS_MIME), store: true },
    { path: 'content.xml', data: encoder.encode(content) },
    { path: 'styles.xml', data: encoder.encode(STYLES_XML) },
    { path: 'meta.xml', data: encoder.encode(metaXml(wb)) },
    { path: 'META-INF/manifest.xml', data: encoder.encode(MANIFEST) },
  ]);
}
