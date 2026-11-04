// Traduction jeton par jeton entre syntaxe canonique et syntaxe locale (conserve espaces et sauts de ligne).
import { tokenize, type Token } from './lexer.ts';
import { printTable } from './printer.ts';
import { CANONICAL, syntaxFor, type FormulaLocale, type FormulaSyntax } from './syntax.ts';

function translate(formula: string, from: FormulaSyntax, to: FormulaSyntax): string {
  const eq = formula.startsWith('=');
  const src = eq ? formula.slice(1) : formula;
  const toks = tokenize(src, from);
  let out = '';
  for (const tk of toks) {
    const raw = src.slice(tk.s, tk.e);
    switch (tk.t) {
      case 'num':
        out += raw.replace(from.decimal, to.decimal);
        break;
      case 'bool':
        out += tk.v ? to.trueName : to.falseName;
        break;
      case 'err':
        out += to.errorOut(tk.v);
        break;
      case 'func':
        out += to.funcOut(tk.v);
        break;
      case 'table':
        out += printTable(tk.table, to);
        break;
      case 'name': {
        // Nom de fonction passe comme LAMBDA (BYROW(A1:C3;SOMME)) : traduit s'il est connu.
        const local = tk.sheet === undefined ? to.funcOut(from.funcIn(raw)) : raw;
        out += local.toUpperCase() !== raw.toUpperCase() ? local : raw;
        break;
      }
      case 'sep':
        out += to.argSep;
        break;
      case 'arow':
        out += to.arrayRow;
        break;
      case 'acol':
        out += to.arrayCol;
        break;
      default:
        out += raw;
    }
  }
  return (eq ? '=' : '') + out;
}

/** Formule canonique (fichier .xlsx) -> formule affichee dans la langue donnee. */
export function toLocalized(formula: string, locale: FormulaLocale): string {
  return translate(formula, CANONICAL, syntaxFor(locale));
}

/** Formule saisie dans la langue donnee -> formule canonique. */
export function fromLocalized(formula: string, locale: FormulaLocale): string {
  return translate(formula, syntaxFor(locale), CANONICAL);
}

/**
 * Reecrit une formule canonique en remplacant certains jetons (references, noms...).
 * `fn` renvoie le nouveau texte du jeton ou undefined pour le garder.
 */
export function rewriteTokens(formula: string, fn: (tok: Token, raw: string) => string | undefined): string {
  const eq = formula.startsWith('=');
  const src = eq ? formula.slice(1) : formula;
  const toks = tokenize(src, CANONICAL);
  let out = '';
  let last = 0;
  for (const tk of toks) {
    const raw = src.slice(tk.s, tk.e);
    const rep = fn(tk, raw);
    if (rep === undefined) continue;
    out += src.slice(last, tk.s) + rep;
    last = tk.e;
  }
  out += src.slice(last);
  return (eq ? '=' : '') + out;
}

/** Fonctions apparues apres Excel 2007 : prefixe `_xlfn.` obligatoire dans les fichiers .xlsx. */
const XLFN = new Set(
  (
    'ACOT ACOTH AGGREGATE ARABIC ARRAYTOTEXT BASE BETA.DIST BETA.INV BINOM.DIST BINOM.DIST.RANGE BINOM.INV BITAND ' +
    'BITLSHIFT BITOR BITRSHIFT BITXOR BYCOL BYROW CEILING.MATH CEILING.PRECISE CHISQ.DIST CHISQ.DIST.RT CHISQ.INV ' +
    'CHISQ.INV.RT CHISQ.TEST CHOOSECOLS CHOOSEROWS COMBINA CONCAT CONFIDENCE.NORM CONFIDENCE.T COT COTH COVARIANCE.P ' +
    'COVARIANCE.S CSC CSCH DAYS DECIMAL DROP ECMA.CEILING ERF.PRECISE ERFC.PRECISE EXPAND EXPON.DIST F.DIST F.DIST.RT ' +
    'F.INV F.INV.RT F.TEST FILTER FLOOR.MATH FLOOR.PRECISE FORECAST.ETS FORECAST.ETS.CONFINT FORECAST.ETS.SEASONALITY ' +
    'FORECAST.ETS.STAT FORECAST.LINEAR FORMULATEXT GAMMA GAMMA.DIST GAMMA.INV GAMMALN.PRECISE GAUSS GROUPBY HSTACK ' +
    'HYPGEOM.DIST IFNA IFS IMCOSH IMCOT IMCSC IMCSCH IMSEC IMSECH IMSINH IMTAN ISFORMULA ISO.CEILING ISOMITTED ' +
    'ISOWEEKNUM LAMBDA LET LOGNORM.DIST LOGNORM.INV MAKEARRAY MAP MAXIFS MINIFS MODE.MULT MODE.SNGL MUNIT ' +
    'NEGBINOM.DIST NETWORKDAYS.INTL NORM.DIST NORM.INV NORM.S.DIST NORM.S.INV NUMBERVALUE PDURATION PERCENTILE.EXC ' +
    'PERCENTILE.INC PERCENTOF PERCENTRANK.EXC PERCENTRANK.INC PERMUTATIONA PHI PIVOTBY POISSON.DIST QUARTILE.EXC ' +
    'QUARTILE.INC RANDARRAY RANK.AVG RANK.EQ REDUCE REGEXEXTRACT REGEXREPLACE REGEXTEST RRI SCAN SEC SECH SEQUENCE ' +
    'SHEET SHEETS SKEW.P SORT SORTBY STDEV.P STDEV.S SWITCH T.DIST T.DIST.2T T.DIST.RT T.INV T.INV.2T T.TEST TAKE ' +
    'TEXTAFTER TEXTBEFORE TEXTJOIN TEXTSPLIT TOCOL TOROW TRIMRANGE UNICHAR UNICODE UNIQUE VALUETOTEXT VAR.P VAR.S ' +
    'VSTACK WEBSERVICE WEIBULL.DIST WORKDAY.INTL WRAPCOLS WRAPROWS XLOOKUP XMATCH XOR Z.TEST'
  ).split(' '),
);
const XLWS = new Set(['FILTER', 'SORT', 'SORTBY']);

/** Formule canonique -> texte a ecrire dans un .xlsx (`_xlfn.` / `_xlws.` / `_xlpm.`). */
export function toFileFormula(formula: string): string {
  const params = new Set<string>();
  const toks: Token[] = tokenize(formula.startsWith('=') ? formula.slice(1) : formula, CANONICAL);
  // Parametres de LET / LAMBDA : premier argument de chaque paire.
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i];
    if (tk?.t !== 'func' || (tk.v !== 'LET' && tk.v !== 'LAMBDA')) continue;
    let depth = 0;
    let argStart = false;
    const firstNames: (string | undefined)[] = [];
    for (let k = i + 1; k < toks.length; k++) {
      const x = toks[k];
      if (!x || x.t === 'ws') continue;
      if (depth === 1 && argStart) {
        firstNames.push(x.t === 'name' && x.sheet === undefined ? x.v.toUpperCase() : undefined);
        argStart = false;
      }
      if (x.t === '(' || x.t === 'func') {
        if (x.t === '(' && ++depth === 1) argStart = true;
      } else if (x.t === ')') {
        if (--depth === 0) break;
      } else if (x.t === 'sep' && depth === 1) argStart = true;
    }
    firstNames.forEach((n, idx) => {
      const isParam = idx < firstNames.length - 1 && (tk.v === 'LAMBDA' || idx % 2 === 0);
      if (n && isParam) params.add(n);
    });
  }
  return rewriteTokens(formula, (tk) => {
    if (tk.t === 'func') {
      if (XLWS.has(tk.v)) return `_xlfn._xlws.${tk.v}`;
      if (XLFN.has(tk.v)) return `_xlfn.${tk.v}`;
      if (params.has(tk.v)) return `_xlpm.${tk.raw}`;
      return undefined;
    }
    if (tk.t === 'name' && tk.sheet === undefined && params.has(tk.v.toUpperCase())) return `_xlpm.${tk.v}`;
    return undefined;
  });
}

/** Texte lu dans un .xlsx -> formule canonique (retire les prefixes `_xlfn.` etc.). */
export function fromFileFormula(formula: string): string {
  return rewriteTokens(formula, (tk, raw) => {
    if (tk.t === 'func' && /^_xl/i.test(raw)) return tk.v;
    if (tk.t === 'name' && /^_xlpm\./i.test(tk.v)) return tk.v.slice(6);
    return undefined;
  });
}
