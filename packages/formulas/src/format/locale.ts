// Donnees regionales pour l'affichage et la saisie des nombres et des dates.

export type NumberLocale = 'fr-FR' | 'en-US';

export interface LocaleData {
  id: NumberLocale;
  decimal: string;
  group: string;
  /** Separateurs de milliers acceptes a la saisie. */
  groupInput: string[];
  months: string[];
  monthsShort: string[];
  days: string[];
  daysShort: string[];
  am: string;
  pm: string;
  trueName: string;
  falseName: string;
  /** Ordre des composantes d'une date saisie en chiffres. */
  dateOrder: 'DMY' | 'MDY';
  shortDate: string;
  longDate: string;
  time: string;
  dateTime: string;
  currency: string;
  currencyFormat: string;
  accountingFormat: string;
}

export const FR_FR: LocaleData = {
  id: 'fr-FR',
  decimal: ',',
  group: ' ',
  groupInput: [' ', ' ', ' '],
  months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  monthsShort: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  daysShort: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
  am: 'AM',
  pm: 'PM',
  trueName: 'VRAI',
  falseName: 'FAUX',
  dateOrder: 'DMY',
  shortDate: 'dd/mm/yyyy',
  longDate: 'dddd d mmmm yyyy',
  time: 'hh:mm:ss',
  dateTime: 'dd/mm/yyyy hh:mm',
  currency: '€',
  currencyFormat: '#,##0.00 [$€-40C];-#,##0.00 [$€-40C]',
  accountingFormat: '_-* #,##0.00 [$€-40C]_-;-* #,##0.00 [$€-40C]_-;_-* "-"?? [$€-40C]_-;_-@_-',
};

export const EN_US: LocaleData = {
  id: 'en-US',
  decimal: '.',
  group: ',',
  groupInput: [','],
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  am: 'AM',
  pm: 'PM',
  trueName: 'TRUE',
  falseName: 'FALSE',
  dateOrder: 'MDY',
  shortDate: 'm/d/yyyy',
  longDate: 'dddd, mmmm d, yyyy',
  time: 'h:mm:ss AM/PM',
  dateTime: 'm/d/yyyy h:mm',
  currency: '$',
  currencyFormat: '[$$-409]#,##0.00;-[$$-409]#,##0.00',
  accountingFormat: '_-[$$-409]* #,##0.00_ ;_-[$$-409]* -#,##0.00 ;_-[$$-409]* "-"??_ ;_-@_ ',
};

export function localeData(locale: NumberLocale | string | undefined): LocaleData {
  return locale === 'en-US' || locale === 'en' ? EN_US : FR_FR;
}

/**
 * Formats integres d'Excel (numFmtId 0 a 49) : texte canonique.
 * Les identifiants 14 et 22 dependent de la region (date courte).
 */
export function builtinFormat(id: number, locale: NumberLocale = 'fr-FR'): string | undefined {
  const l = localeData(locale);
  const table: Record<number, string> = {
    0: 'General',
    1: '0',
    2: '0.00',
    3: '#,##0',
    4: '#,##0.00',
    9: '0%',
    10: '0.00%',
    11: '0.00E+00',
    12: '# ?/?',
    13: '# ??/??',
    14: l.shortDate,
    15: 'd-mmm-yy',
    16: 'd-mmm',
    17: 'mmm-yy',
    18: 'h:mm AM/PM',
    19: 'h:mm:ss AM/PM',
    20: 'h:mm',
    21: 'h:mm:ss',
    22: `${l.shortDate} h:mm`,
    37: '#,##0 ;(#,##0)',
    38: '#,##0 ;[Red](#,##0)',
    39: '#,##0.00;(#,##0.00)',
    40: '#,##0.00;[Red](#,##0.00)',
    45: 'mm:ss',
    46: '[h]:mm:ss',
    47: 'mmss.0',
    48: '##0.0E+0',
    49: '@',
  };
  return table[id];
}
