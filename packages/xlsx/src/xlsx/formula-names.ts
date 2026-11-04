// Prefixes des fonctions recentes dans les fichiers (« _xlfn.XLOOKUP ») : retires a la lecture
// (formule canonique « XLOOKUP(...) »), remis a l'ecriture pour qu'Excel reconnaisse la fonction.

/** Fonctions posterieures a Excel 2007 ecrites avec « _xlfn. » (ou « _xlws. » pour FILTER et SORT). */
const FUTURE_FUNCTIONS = [
  'ACOT', 'ACOTH', 'AGGREGATE', 'ARABIC', 'ARRAYTOTEXT', 'BASE', 'BETA.DIST', 'BETA.INV', 'BINOM.DIST',
  'BINOM.DIST.RANGE', 'BINOM.INV', 'BITAND', 'BITLSHIFT', 'BITOR', 'BITRSHIFT', 'BITXOR', 'BYCOL', 'BYROW',
  'CEILING.MATH', 'CEILING.PRECISE', 'CHISQ.DIST', 'CHISQ.DIST.RT', 'CHISQ.INV', 'CHISQ.INV.RT', 'CHISQ.TEST',
  'CHOOSECOLS', 'CHOOSEROWS', 'COMBINA', 'CONCAT', 'CONFIDENCE.NORM', 'CONFIDENCE.T', 'COT', 'COTH',
  'COVARIANCE.P', 'COVARIANCE.S', 'CSC', 'CSCH', 'DAYS', 'DECIMAL', 'DROP', 'ECMA.CEILING', 'ERF.PRECISE',
  'ERFC.PRECISE', 'EXPAND', 'EXPON.DIST', 'F.DIST', 'F.DIST.RT', 'F.INV', 'F.INV.RT', 'F.TEST', 'FIELDVALUE',
  'FILTERXML', 'FLOOR.MATH', 'FLOOR.PRECISE', 'FORECAST.ETS', 'FORECAST.ETS.CONFINT', 'FORECAST.ETS.SEASONALITY',
  'FORECAST.ETS.STAT', 'FORECAST.LINEAR', 'FORMULATEXT', 'GAMMA', 'GAMMA.DIST', 'GAMMA.INV', 'GAMMALN.PRECISE',
  'GAUSS', 'GROUPBY', 'HSTACK', 'HYPGEOM.DIST', 'IFNA', 'IFS', 'IMAGE', 'IMCOSH', 'IMCOT', 'IMCSC', 'IMCSCH',
  'IMSEC', 'IMSECH', 'IMSINH', 'IMTAN', 'ISFORMULA', 'ISO.CEILING', 'ISOMITTED', 'ISOWEEKNUM', 'LAMBDA', 'LET',
  'LOGNORM.DIST', 'LOGNORM.INV', 'MAKEARRAY', 'MAP', 'MAXIFS', 'MINIFS', 'MODE.MULT', 'MODE.SNGL', 'MUNIT',
  'NEGBINOM.DIST', 'NETWORKDAYS.INTL', 'NORM.DIST', 'NORM.INV', 'NORM.S.DIST', 'NORM.S.INV', 'NUMBERVALUE',
  'PDURATION', 'PERCENTILE.EXC', 'PERCENTILE.INC', 'PERCENTOF', 'PERCENTRANK.EXC', 'PERCENTRANK.INC', 'PERMUTATIONA',
  'PHI', 'PIVOTBY', 'POISSON.DIST', 'QUARTILE.EXC', 'QUARTILE.INC', 'QUERYSTRING', 'RANDARRAY', 'RANK.AVG',
  'RANK.EQ', 'REDUCE', 'REGEXEXTRACT', 'REGEXREPLACE', 'REGEXTEST', 'RRI', 'SCAN', 'SEC', 'SECH', 'SEQUENCE',
  'SHEET', 'SHEETS', 'SKEW.P', 'SORTBY', 'STDEV.P', 'STDEV.S', 'SWITCH', 'T.DIST', 'T.DIST.2T', 'T.DIST.RT',
  'T.INV', 'T.INV.2T', 'T.TEST', 'TAKE', 'TEXTAFTER', 'TEXTBEFORE', 'TEXTJOIN', 'TEXTSPLIT', 'TOCOL', 'TOROW',
  'TRIMRANGE', 'UNICHAR', 'UNICODE', 'UNIQUE', 'VALUETOTEXT', 'VAR.P', 'VAR.S', 'VSTACK', 'WEBSERVICE',
  'WEIBULL.DIST', 'WORKDAY.INTL', 'WRAPCOLS', 'WRAPROWS', 'XLOOKUP', 'XMATCH', 'XOR', 'Z.TEST', 'ANCHORARRAY',
  'SINGLE', 'STOCKHISTORY', 'DETECTLANGUAGE', 'TRANSLATE', 'COPILOT',
];

const WORKSHEET_FUNCTIONS = ['FILTER', 'SORT'];

const PREFIX_OF = new Map<string, string>([
  ...FUTURE_FUNCTIONS.map((name): [string, string] => [name, '_xlfn.']),
  ...WORKSHEET_FUNCTIONS.map((name): [string, string] => [name, '_xlfn._xlws.']),
]);

/** Applique `fn` aux morceaux hors chaines et hors noms de feuille cites. */
function mapOutsideQuotes(formula: string, fn: (chunk: string) => string): string {
  if (!formula.includes('"') && !formula.includes("'")) return fn(formula);
  let out = '';
  let start = 0;
  let i = 0;
  while (i < formula.length) {
    const ch = formula.charAt(i);
    if (ch === '"' || ch === "'") {
      out += fn(formula.slice(start, i));
      let j = i + 1;
      while (j < formula.length) {
        if (formula.charAt(j) === ch) {
          if (formula.charAt(j + 1) === ch) {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      out += formula.slice(i, j + 1);
      i = j + 1;
      start = i;
      continue;
    }
    i++;
  }
  return out + fn(formula.slice(start));
}

/** Formule du fichier -> formule canonique (prefixes « _xlfn. » et « _xlws. » retires). */
export function fromFileFormula(formula: string): string {
  if (!formula.includes('_xl')) return formula;
  return mapOutsideQuotes(formula, (chunk) => chunk.replace(/_xlfn\.(?:_xlws\.)?|_xlws\./gi, ''));
}

/** Formule canonique -> formule du fichier (prefixes remis devant les fonctions recentes). */
export function toFileFormula(formula: string): string {
  if (!/[A-Za-z]\s*\(/.test(formula)) return formula;
  return mapOutsideQuotes(formula, (chunk) => chunk.replace(/(^|[^A-Za-z0-9_.])([A-Za-z][A-Za-z0-9.]*)(?=\()/g, (whole, lead: string, name: string) => {
    const prefix = PREFIX_OF.get(name.toUpperCase());
    return prefix ? `${lead}${prefix}${name}` : whole;
  }));
}
