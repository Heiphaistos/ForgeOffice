// Syntaxes de formule : canonique (fichiers .xlsx, anglais) et francaise (saisie/affichage).
import { ERROR_CODES, type ErrorCode } from '../values.ts';
import type { TableSpecial } from './ast.ts';
import { functionNameFromFr, functionNameToFr } from './names-fr.ts';

export type FormulaLocale = 'en' | 'fr';

export interface FormulaSyntax {
  locale: FormulaLocale;
  argSep: string;
  decimal: string;
  arrayCol: string;
  /** Autres separateurs de colonnes acceptes a la saisie. */
  arrayColAlt: string[];
  arrayRow: string;
  trueName: string;
  falseName: string;
  /** Texte -> code d'erreur (plus long d'abord). */
  errorsIn: [string, ErrorCode][];
  errorOut: (code: ErrorCode) => string;
  funcIn: (name: string) => string;
  funcOut: (canonical: string) => string;
  tableIn: (text: string) => TableSpecial | undefined;
  tableOut: (s: TableSpecial) => string;
}

const FR_ERRORS: Record<ErrorCode, string> = {
  '#NULL!': '#NUL!',
  '#DIV/0!': '#DIV/0!',
  '#VALUE!': '#VALEUR!',
  '#REF!': '#REF!',
  '#NAME?': '#NOM?',
  '#NUM!': '#NOMBRE!',
  '#N/A': '#N/A',
  '#GETTING_DATA': '#CHARGEMENT_DONNEES',
  '#SPILL!': '#EPARS!',
  '#CONNECT!': '#CONNECT!',
  '#BLOCKED!': '#BLOQUE!',
  '#UNKNOWN!': '#INCONNU!',
  '#FIELD!': '#CHAMP!',
  '#CALC!': '#CALC!',
  '#BUSY!': '#OCCUPE!',
};

/** Code d'erreur -> texte francais d'Excel. */
export function errorToFr(code: ErrorCode): string {
  return FR_ERRORS[code];
}

const TABLE_EN: Record<TableSpecial, string> = {
  '#All': '#All',
  '#Data': '#Data',
  '#Headers': '#Headers',
  '#Totals': '#Totals',
  '#This Row': '#This Row',
};
const TABLE_FR: Record<TableSpecial, string> = {
  '#All': '#Tout',
  '#Data': '#Données',
  '#Headers': '#En-têtes',
  '#Totals': '#Totaux',
  '#This Row': '#Cette ligne',
};

function sortErrors(pairs: [string, ErrorCode][]): [string, ErrorCode][] {
  return pairs.sort((a, b) => b[0].length - a[0].length);
}

const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

function tableLookup(maps: Record<TableSpecial, string>[]): (t: string) => TableSpecial | undefined {
  const index = new Map<string, TableSpecial>();
  for (const m of maps) {
    for (const [k, v] of Object.entries(m) as [TableSpecial, string][]) index.set(fold(v), k);
  }
  index.set('#TOUS', '#All');
  return (t) => index.get(fold(t.trim()));
}

function stripPrefixes(name: string): string {
  let n = name;
  for (;;) {
    const up = n.toUpperCase();
    if (up.startsWith('_XLFN.') || up.startsWith('_XLWS.') || up.startsWith('_XLPM.')) n = n.slice(6);
    else if (up.startsWith('_XLUDF.')) n = n.slice(7);
    else return n;
  }
}

export const CANONICAL: FormulaSyntax = {
  locale: 'en',
  argSep: ',',
  decimal: '.',
  arrayCol: ',',
  arrayColAlt: [],
  arrayRow: ';',
  trueName: 'TRUE',
  falseName: 'FALSE',
  errorsIn: sortErrors(ERROR_CODES.map((c) => [c, c])),
  errorOut: (c) => c,
  funcIn: (n) => stripPrefixes(n).toUpperCase(),
  funcOut: (n) => n,
  tableIn: tableLookup([TABLE_EN]),
  tableOut: (s) => TABLE_EN[s],
};

export const FRENCH: FormulaSyntax = {
  locale: 'fr',
  argSep: ';',
  decimal: ',',
  arrayCol: '.',
  arrayColAlt: ['\\'],
  arrayRow: ';',
  trueName: 'VRAI',
  falseName: 'FAUX',
  errorsIn: sortErrors([
    ...ERROR_CODES.map((c): [string, ErrorCode] => [FR_ERRORS[c], c]),
    ...ERROR_CODES.map((c): [string, ErrorCode] => [c, c]),
  ]),
  errorOut: errorToFr,
  funcIn: (n) => functionNameFromFr(stripPrefixes(n)),
  funcOut: functionNameToFr,
  tableIn: tableLookup([TABLE_FR, TABLE_EN]),
  tableOut: (s) => TABLE_FR[s],
};

export function syntaxFor(locale: FormulaLocale): FormulaSyntax {
  return locale === 'fr' ? FRENCH : CANONICAL;
}

/** Nom canonique d'un parametre LET/LAMBDA (retire _xlpm.). */
export function canonicalIdentifier(name: string): string {
  return stripPrefixes(name);
}
