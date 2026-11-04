// Informations : ESTVIDE, ESTNUM, ESTERREUR, TYPE, N, NA, CELLULE, FEUILLE, FEUILLES, INFORMATIONS...
import { toNumber, toText } from '../eval/coerce.ts';
import { RefValue, type EvalContext } from '../eval/types.ts';
import { quoteSheetName, formatCellAddress, type Area } from '../refs.ts';
import { ERR, ERROR_TYPE_NUMBER, FormulaError, excelType, type Scalar, type Value } from '../values.ts';
import { define, type Arg } from './registry.ts';

const I = 'info' as const;

const is = (name: string, test: (v: Scalar) => boolean): void =>
  define(I, name, { min: 1 }, ([v]) => test((v ?? null) as Scalar));

is('ISBLANK', (v) => v === null);
is('ISERR', (v) => v instanceof FormulaError && v.code !== '#N/A');
is('ISERROR', (v) => v instanceof FormulaError);
is('ISNA', (v) => v instanceof FormulaError && v.code === '#N/A');
is('ISNUMBER', (v) => typeof v === 'number');
is('ISTEXT', (v) => typeof v === 'string');
is('ISNONTEXT', (v) => typeof v !== 'string');
is('ISLOGICAL', (v) => typeof v === 'boolean');

function parity(name: string, odd: boolean): void {
  define(I, name, { min: 1 }, ([v], ctx) => {
    if (typeof v === 'boolean') return ERR.VALUE;
    const n = toNumber(v, ctx);
    if (n instanceof FormulaError) return n;
    return (Math.abs(Math.trunc(n)) % 2 === 1) === odd;
  });
}
parity('ISEVEN', false);
parity('ISODD', true);

function singleArea(a: Arg): Area | undefined {
  return a instanceof RefValue && a.areas.length === 1 ? a.areas[0] : undefined;
}

define(I, 'ISREF', { min: 1, kinds: 'R' }, ([a]) => a instanceof RefValue);
define(I, 'ISFORMULA', { min: 1, kinds: 'R' }, ([a], ctx) => {
  const area = singleArea(a);
  if (!area) return a instanceof FormulaError ? a : ERR.VALUE;
  return ctx.wb.formulaText(area.sheet, area.r1, area.c1) !== undefined;
});

define(I, 'N', { min: 1 }, ([v]) => {
  if (typeof v === 'number' || v instanceof FormulaError) return v;
  return v === true ? 1 : 0;
});
define(I, 'NA', { min: 0 }, () => ERR.NA);
define(I, 'TYPE', { min: 1, kinds: 'V' }, ([v]) => (v === undefined ? 1 : excelType(v as Value)));
define(I, 'ERROR.TYPE', { min: 1 }, ([v]) => (v instanceof FormulaError ? ERROR_TYPE_NUMBER[v.code] : ERR.NA));

function sheetIndex(id: number, ctx: EvalContext): number {
  return ctx.wb.sheetOrder().indexOf(id) + 1;
}

define(I, 'SHEET', { min: 0, max: 1, kinds: 'R' }, ([a], ctx) => {
  if (a === undefined) return sheetIndex(ctx.sheet, ctx);
  if (a instanceof RefValue) return sheetIndex(a.areas[0]?.sheet ?? ctx.sheet, ctx);
  if (a instanceof FormulaError) return a;
  if (typeof a !== 'string') return ERR.VALUE;
  const id = ctx.wb.sheetId(a);
  return id === undefined ? ERR.NA : sheetIndex(id, ctx);
});
define(I, 'SHEETS', { min: 0, max: 1, kinds: 'R' }, ([a], ctx) => {
  if (a === undefined) return ctx.wb.sheetOrder().length;
  if (a instanceof RefValue) return new Set(a.areas.map((x) => x.sheet)).size;
  return a instanceof FormulaError ? a : ERR.VALUE;
});

const CELL_INFO: Record<string, string> = {
  ADRESSE: 'address',
  COLONNE: 'col',
  CONTENU: 'contents',
  LIGNE: 'row',
  NOMFICHIER: 'filename',
  PREFIXE: 'prefix',
  PROTEGE: 'protect',
  LARGEUR: 'width',
};

define(I, 'CELL', { min: 1, max: 2, kinds: 'SR' }, ([t, ref], ctx) => {
  const what = toText(t, ctx);
  if (what instanceof FormulaError) return what;
  const key = CELL_INFO[what.toUpperCase()] ?? what.toLowerCase();
  if (ref instanceof FormulaError) return ref;
  const area = ref === undefined ? { sheet: ctx.sheet, r1: ctx.row, c1: ctx.col, r2: ctx.row, c2: ctx.col } : singleArea(ref);
  if (!area) return ERR.VALUE;
  const v = ctx.wb.getCell(area.sheet, area.r1, area.c1);
  switch (key) {
    case 'address': {
      const a = formatCellAddress(area.r1, area.c1, true, true);
      return area.sheet === ctx.sheet ? a : `${quoteSheetName(ctx.wb.sheetName(area.sheet) ?? '')}!${a}`;
    }
    case 'col':
      return area.c1 + 1;
    case 'row':
      return area.r1 + 1;
    case 'contents':
      return v;
    case 'type':
      return v === null ? 'b' : typeof v === 'string' ? 'l' : 'v';
    case 'filename':
      return '';
    case 'prefix':
      return typeof v === 'string' ? "'" : '';
    case 'protect':
      return 1;
    case 'width':
      return 10;
    default:
      return ERR.VALUE;
  }
});

define(I, 'INFO', { min: 1, volatile: true }, ([t], ctx) => {
  const what = toText(t, ctx);
  if (what instanceof FormulaError) return what;
  switch (what.toLowerCase()) {
    case 'numfile':
    case 'nbfich':
      return ctx.wb.sheetOrder().length;
    case 'recalc':
    case 'recalcul':
      return ctx.wb.locale === 'fr-FR' ? 'Automatique' : 'Automatic';
    case 'release':
    case 'version':
      return '16.0';
    case 'system':
    case 'systexpl':
      return 'pcdos';
    case 'osversion':
    case 'versionse':
      return 'ForgeOffice';
    case 'origin':
    case 'origine':
      return '$A:$A$1';
    case 'directory':
    case 'repertoire':
      return '';
    default:
      return ERR.VALUE;
  }
});
