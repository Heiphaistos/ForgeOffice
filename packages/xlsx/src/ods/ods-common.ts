// Outils communs OpenDocument tableur : formules OpenFormula <-> Excel, unites de longueur.
import { quoteSheetName } from '../address.ts';

export const NS = {
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  number: 'urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0',
  of: 'urn:oasis:names:tc:opendocument:xmlns:of:1.2',
  xlink: 'http://www.w3.org/1999/xlink',
  meta: 'urn:oasis:names:tc:opendocument:xmlns:meta:1.0',
  dc: 'http://purl.org/dc/elements/1.1/',
  manifest: 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0',
  svg: 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0',
} as const;

export const ODS_MIME = 'application/vnd.oasis.opendocument.spreadsheet';

/** Longueur ODF (« 2.258cm », « 0.889in », « 64.01pt », « 85px ») -> points. */
export function lengthToPt(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const m = raw.trim().match(/^(-?[\d.]+)\s*(cm|mm|in|pt|pc|px)?$/);
  if (!m) return undefined;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return undefined;
  switch (m[2]) {
    case 'cm': return (value / 2.54) * 72;
    case 'mm': return (value / 25.4) * 72;
    case 'in': return value * 72;
    case 'pc': return value * 12;
    case 'px': return (value * 72) / 96;
    default: return value;
  }
}

/** Largeur de colonne Excel (caracteres, chiffre de 7 px) <-> points. */
export function colWidthToPt(chars: number): number {
  return ((Math.trunc(chars * 7 + 5)) * 72) / 96;
}

export function ptToColWidth(pt: number): number {
  const px = (pt * 96) / 72;
  return Math.max(0, Math.round(((px - 5) / 7) * 100) / 100);
}

export function cm(pt: number): string {
  return `${((pt / 72) * 2.54).toFixed(3)}cm`;
}

/** Applique `fn` hors des chaines « "..." ». */
function outsideStrings(formula: string, fn: (chunk: string) => string): string {
  const parts = formula.split('"');
  return parts.map((part, i) => (i % 2 === 0 ? fn(part) : part)).join('"');
}

function odfRefToA1(ref: string): string {
  // ref : « .A1 », « $Feuille1.$A$1 », « 'Ma feuille'.A1 », « .A1:.B2 », « Feuil1.A1:Feuil1.B2 »
  const parts = ref.split(':');
  let sheet: string | undefined;
  const locals = parts.map((part) => {
    const dot = part.lastIndexOf('.');
    const sheetPart = dot > 0 ? part.slice(0, dot).replace(/^\$/, '') : '';
    if (sheetPart && sheet === undefined) sheet = sheetPart.startsWith("'") ? sheetPart.slice(1, -1).replace(/''/g, "'") : sheetPart;
    return dot >= 0 ? part.slice(dot + 1) : part;
  });
  const local = locals.join(':');
  return sheet ? `${quoteSheetName(sheet)}!${local}` : local;
}

/** Formule OpenFormula (« of:=SUM([.A1:.A3]) ») -> formule Excel canonique sans « = ». */
export function odfToExcelFormula(raw: string): string {
  let f = raw.replace(/^(?:of|oooc|msoxl):/i, '');
  if (f.startsWith('=')) f = f.slice(1);
  return outsideStrings(f, (chunk) => chunk
    .replace(/\[([^\]]+)\]/g, (_m, ref: string) => odfRefToA1(ref))
    .replace(/;/g, ',')
    .replace(/\bCOM\.MICROSOFT\./gi, '')
    .replace(/\bORG\.OPENOFFICE\./gi, ''));
}

function a1ToOdfRef(ref: string): string {
  const bang = ref.lastIndexOf('!');
  const sheet = bang >= 0 ? ref.slice(0, bang) : '';
  const local = bang >= 0 ? ref.slice(bang + 1) : ref;
  const prefix = sheet ? (sheet.startsWith("'") ? sheet : `$${sheet}`) : '';
  return `[${local.split(':').map((p) => `${prefix}.${p}`).join(':')}]`;
}

const A1_REF = /((?:'(?:[^']|'')+'|[A-Za-z_][\w.]*)!)?\$?[A-Za-z]{1,3}\$?\d{1,7}(?::\$?[A-Za-z]{1,3}\$?\d{1,7})?(?![\w(])/g;

/** Formule Excel canonique -> OpenFormula pour table:formula. */
export function excelToOdfFormula(formula: string): string {
  const body = outsideStrings(formula, (chunk) => chunk
    .replace(/,/g, ';')
    .replace(A1_REF, (ref, _sheet, offset: number, whole: string) => {
      const before = whole.charAt(offset - 1);
      return /[A-Za-z0-9_.]/.test(before) ? ref : a1ToOdfRef(ref);
    }));
  return `of:=${body}`;
}
