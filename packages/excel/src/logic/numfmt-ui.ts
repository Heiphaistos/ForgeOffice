// Formats de nombre de la boite « Format de cellule » (sans DOM) : categories d'Excel, fabrication du code a partir
// des options (decimales, milliers, negatifs, symbole) et analyse inverse d'un code existant.
// La fabrication et l'analyse sont inverses l'une de l'autre : analyser(fabriquer(o)) retrouve o.

export type NumCategory =
  | 'general' | 'number' | 'currency' | 'accounting' | 'date' | 'time' | 'percent' | 'fraction' | 'scientific' | 'text' | 'special' | 'custom';

export const NUM_CATEGORIES: readonly NumCategory[] = [
  'general', 'number', 'currency', 'accounting', 'date', 'time', 'percent', 'fraction', 'scientific', 'text', 'special', 'custom',
];

/** Nombres negatifs : 0 = -1234,10 ; 1 = 1234,10 en rouge ; 2 = (1234,10) ; 3 = (1234,10) en rouge. */
export type NegativeStyle = 0 | 1 | 2 | 3;
export const NEGATIVE_STYLES: readonly NegativeStyle[] = [0, 1, 2, 3];

export interface CurrencySymbol {
  id: string;
  /** Code de symbole d'Excel (« [$€-40C] ») ; vide = aucun symbole. */
  token: string;
  /** Symbole avant le nombre (« $1 234,50 ») ou apres (« 1 234,50 € »). */
  prefix: boolean;
  /** Espace entre le symbole et le nombre. */
  space: boolean;
  /** Texte court du symbole (liste deroulante). */
  sign: string;
}

export const CURRENCY_SYMBOLS: readonly CurrencySymbol[] = [
  { id: 'none', token: '', prefix: false, space: false, sign: '' },
  { id: 'eur', token: '[$€-40C]', prefix: false, space: true, sign: '€' },
  { id: 'eurBefore', token: '[$€-2]', prefix: true, space: true, sign: '€' },
  { id: 'usd', token: '[$$-409]', prefix: true, space: false, sign: '$' },
  { id: 'gbp', token: '[$£-809]', prefix: true, space: false, sign: '£' },
  { id: 'chf', token: '[$CHF-100C]', prefix: false, space: true, sign: 'CHF' },
  { id: 'cad', token: '[$$-C0C]', prefix: false, space: true, sign: '$' },
  { id: 'jpy', token: '[$¥-411]', prefix: true, space: false, sign: '¥' },
];

export const MAX_DECIMALS = 30;

export interface NumOptions {
  decimals: number;
  thousands: boolean;
  negative: NegativeStyle;
  symbol: string;
}

export const DEFAULT_OPTIONS: NumOptions = { decimals: 2, thousands: false, negative: 0, symbol: 'eur' };

const zeros = (n: number): string => '0'.repeat(Math.max(0, Math.min(MAX_DECIMALS, n)));
const dec = (n: number, ch = '0'): string => (n > 0 ? `.${ch.repeat(Math.min(MAX_DECIMALS, n))}` : '');
const symbolOf = (id: string): CurrencySymbol => CURRENCY_SYMBOLS.find((s) => s.id === id) ?? CURRENCY_SYMBOLS[0] as CurrencySymbol;

/** Ajoute les sections « negatif » du style choisi autour d'un corps de format. */
function withNegatives(body: string, style: NegativeStyle): string {
  switch (style) {
    case 1: return `${body};[Red]${body}`;
    case 2: return `${body}_);(${body})`;
    case 3: return `${body}_);[Red](${body})`;
    default: return body;
  }
}

export function buildNumber(o: Pick<NumOptions, 'decimals' | 'thousands' | 'negative'>): string {
  return withNegatives(`${o.thousands ? '#,##0' : '0'}${dec(o.decimals)}`, o.negative);
}

export function buildCurrency(o: NumOptions): string {
  const s = symbolOf(o.symbol);
  const base = `#,##0${dec(o.decimals)}`;
  const sp = s.space ? ' ' : '';
  const body = !s.token ? base : s.prefix ? `${s.token}${sp}${base}` : `${base}${sp}${s.token}`;
  return withNegatives(body, o.negative);
}

export function buildAccounting(o: Pick<NumOptions, 'decimals' | 'symbol'>): string {
  const s = symbolOf(o.symbol);
  const num = `#,##0${dec(o.decimals)}`;
  const zero = `"-"${'?'.repeat(Math.min(MAX_DECIMALS, o.decimals))}`;
  const t = s.token;
  if (!t) return `_-* ${num}_-;-* ${num}_-;_-* ${zero}_-;_-@_-`;
  if (s.prefix) return `_-${t}* ${num}_-;-${t}* ${num}_-;_-${t}* ${zero}_-;_-@_-`;
  return `_-* ${num} ${t}_-;-* ${num} ${t}_-;_-* ${zero} ${t}_-;_-@_-`;
}

export const buildPercent = (decimals: number): string => `0${dec(decimals)}%`;
export const buildScientific = (decimals: number): string => `0${dec(decimals)}E+00`;

// ---------------------------------------------------------------- Listes de types

export interface TypeEntry {
  /** Identifiant stable (libelle francais cote interface). */
  id: string;
  code: string;
}

/** Dates : le premier est le format « date courte » du ruban. */
export const DATE_TYPES: readonly TypeEntry[] = [
  { id: 'short', code: 'dd/mm/yyyy' },
  { id: 'long', code: 'dddd d mmmm yyyy' },
  { id: 'dm', code: 'd/m' },
  { id: 'dmy', code: 'd/m/yy' },
  { id: 'ddmmyy', code: 'dd/mm/yy' },
  { id: 'dmmm', code: 'd-mmm' },
  { id: 'dmmmyy', code: 'd-mmm-yy' },
  { id: 'mmmyy', code: 'mmm-yy' },
  { id: 'mmmmyy', code: 'mmmm-yy' },
  { id: 'dmmmm', code: 'd mmmm' },
  { id: 'dmmmmyyyy', code: 'd mmmm yyyy' },
  { id: 'mmmmyy2', code: 'mmmm yy' },
  { id: 'mmmmyyyy', code: 'mmmm yyyy' },
  { id: 'dateTime', code: 'dd/mm/yyyy hh:mm' },
  { id: 'month', code: 'mmmm' },
  { id: 'weekday', code: 'dddd' },
  { id: 'weekdayShort', code: 'ddd' },
];

export const TIME_TYPES: readonly TypeEntry[] = [
  { id: 'hms', code: 'hh:mm:ss' },
  { id: 'hm', code: 'h:mm' },
  { id: 'hms2', code: 'h:mm:ss' },
  { id: 'hmPm', code: 'h:mm AM/PM' },
  { id: 'hmsPm', code: 'h:mm:ss AM/PM' },
  { id: 'hhmm', code: 'hh:mm' },
  { id: 'elapsedHms', code: '[h]:mm:ss' },
  { id: 'elapsedHm', code: '[h]:mm' },
  { id: 'ms', code: 'mm:ss' },
  { id: 'msTenth', code: 'mm:ss.0' },
];

export const FRACTION_TYPES: readonly TypeEntry[] = [
  { id: 'f1', code: '# ?/?' },
  { id: 'f2', code: '# ??/??' },
  { id: 'f3', code: '# ???/???' },
  { id: 'half', code: '# ?/2' },
  { id: 'quarter', code: '# ?/4' },
  { id: 'eighth', code: '# ?/8' },
  { id: 'sixteenth', code: '# ??/16' },
  { id: 'tenth', code: '# ?/10' },
  { id: 'hundredth', code: '# ??/100' },
];

/** Formats speciaux (France). */
export const SPECIAL_TYPES: readonly TypeEntry[] = [
  { id: 'zip', code: '00000' },
  { id: 'ssn', code: '0\\ 00\\ 00\\ 00\\ 000\\ 000\\ 00' },
  { id: 'phone', code: '00\\ 00\\ 00\\ 00\\ 00' },
];

/** Exemples proposes dans « Personnalisée » (en plus des formats du classeur). */
export const CUSTOM_EXAMPLES: readonly string[] = [
  'General', '0', '0.00', '#,##0', '#,##0.00', '0%', '0.00%', '0.00E+00', '# ?/?', '# ??/??', '@',
  '#,##0_);(#,##0)', '#,##0.00_);[Red](#,##0.00)', '#,##0 [$€-40C]', '#,##0.00 [$€-40C]', '"Total : "@', '0.0,"k"', '[Red]0.00;[Blue]-0.00',
  ...DATE_TYPES.map((t) => t.code), ...TIME_TYPES.map((t) => t.code), 'd mmm yyyy hh:mm:ss',
];

// ---------------------------------------------------------------- Analyse inverse

export interface ParsedFormat {
  category: NumCategory;
  options: NumOptions;
  /** Code d'une liste de types (date, heure, fraction, special) ; vide sinon. */
  type: string;
}

const lists: readonly [NumCategory, readonly TypeEntry[]][] = [['date', DATE_TYPES], ['time', TIME_TYPES], ['fraction', FRACTION_TYPES], ['special', SPECIAL_TYPES]];

/** Categorie et options d'un code de format (« Personnalisée » si le code n'est celui d'aucune categorie). */
export function parseNumFmt(code: string): ParsedFormat {
  const options = { ...DEFAULT_OPTIONS };
  const done = (category: NumCategory, type = ''): ParsedFormat => ({ category, options, type });
  if (code === '' || code === 'General') return done('general');
  if (code === '@') return done('text');
  for (const [category, list] of lists) if (list.some((t) => t.code === code)) return done(category, code);
  for (let d = 0; d <= MAX_DECIMALS; d++) {
    if (code === buildPercent(d)) { options.decimals = d; return done('percent'); }
    if (code === buildScientific(d)) { options.decimals = d; return done('scientific'); }
    for (const negative of NEGATIVE_STYLES) {
      for (const thousands of [false, true]) {
        if (code === buildNumber({ decimals: d, thousands, negative })) {
          Object.assign(options, { decimals: d, thousands, negative });
          return done('number');
        }
      }
      for (const s of CURRENCY_SYMBOLS) {
        if (s.token && code === buildCurrency({ decimals: d, thousands: true, negative, symbol: s.id })) {
          Object.assign(options, { decimals: d, negative, symbol: s.id });
          return done('currency');
        }
      }
    }
    for (const s of CURRENCY_SYMBOLS) {
      if (code === buildAccounting({ decimals: d, symbol: s.id })) {
        Object.assign(options, { decimals: d, symbol: s.id });
        return done('accounting');
      }
    }
  }
  return done('custom');
}

/** Code de format d'une categorie avec ses options (le type choisi pour les listes ; vide = premier de la liste). */
export function buildFormat(category: NumCategory, o: NumOptions, type = ''): string {
  switch (category) {
    case 'general': return 'General';
    case 'number': return buildNumber(o);
    case 'currency': return buildCurrency(o);
    case 'accounting': return buildAccounting(o);
    case 'percent': return buildPercent(o.decimals);
    case 'scientific': return buildScientific(o.decimals);
    case 'text': return '@';
    case 'date': return type || DATE_TYPES[0]?.code || 'General';
    case 'time': return type || TIME_TYPES[0]?.code || 'General';
    case 'fraction': return type || FRACTION_TYPES[0]?.code || 'General';
    case 'special': return type || SPECIAL_TYPES[0]?.code || 'General';
    case 'custom': return type || 'General';
  }
}

/** Liste de types d'une categorie (vide pour les categories a options numeriques). */
export function typesOf(category: NumCategory): readonly TypeEntry[] {
  return lists.find(([c]) => c === category)?.[1] ?? [];
}

/** Categories dont les options sont les decimales, les milliers, les negatifs ou le symbole. */
export function usesOption(category: NumCategory, option: 'decimals' | 'thousands' | 'negative' | 'symbol'): boolean {
  switch (option) {
    case 'decimals': return category === 'number' || category === 'currency' || category === 'accounting' || category === 'percent' || category === 'scientific';
    case 'thousands': return category === 'number';
    case 'negative': return category === 'number' || category === 'currency';
    case 'symbol': return category === 'currency' || category === 'accounting';
  }
}
