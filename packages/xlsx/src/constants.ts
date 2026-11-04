// Tables de reference Excel : formats de nombre integres, palette indexee, theme Office 2024, polices de repli.
import type { Theme } from './model.ts';

/** Formats de nombre integres (identifiants ECMA-376 18.8.30, codes de la locale anglaise). */
export const BUILTIN_NUMBER_FORMATS: Readonly<Record<number, string>> = {
  0: 'General',
  1: '0',
  2: '0.00',
  3: '#,##0',
  4: '#,##0.00',
  5: '"$"#,##0_);\\("$"#,##0\\)',
  6: '"$"#,##0_);[Red]\\("$"#,##0\\)',
  7: '"$"#,##0.00_);\\("$"#,##0.00\\)',
  8: '"$"#,##0.00_);[Red]\\("$"#,##0.00\\)',
  9: '0%',
  10: '0.00%',
  11: '0.00E+00',
  12: '# ?/?',
  13: '# ??/??',
  14: 'm/d/yyyy',
  15: 'd-mmm-yy',
  16: 'd-mmm',
  17: 'mmm-yy',
  18: 'h:mm AM/PM',
  19: 'h:mm:ss AM/PM',
  20: 'h:mm',
  21: 'h:mm:ss',
  22: 'm/d/yyyy h:mm',
  37: '#,##0 ;(#,##0)',
  38: '#,##0 ;[Red](#,##0)',
  39: '#,##0.00;(#,##0.00)',
  40: '#,##0.00;[Red](#,##0.00)',
  41: '_(* #,##0_);_(* \\(#,##0\\);_(* "-"_);_(@_)',
  42: '_("$"* #,##0_);_("$"* \\(#,##0\\);_("$"* "-"_);_(@_)',
  43: '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)',
  44: '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)',
  45: 'mm:ss',
  46: '[h]:mm:ss',
  47: 'mm:ss.0',
  48: '##0.0E+0',
  49: '@',
};

/** Premier identifiant libre pour un format personnalise. */
export const FIRST_CUSTOM_NUMFMT_ID = 164;

/** Palette indexee par defaut d'Excel (64 couleurs, AARRGGBB). Index 64 / 65 = couleurs systeme. */
export const DEFAULT_INDEXED_COLORS: readonly string[] = [
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080',
  '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF',
  '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
  '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696',
  '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
].map((rgb) => `FF${rgb}`);

/** Theme « Office » 2023+ (Office 2024 / Microsoft 365) : Aptos, nouvelle palette. */
export function officeTheme(): Theme {
  return {
    name: 'Office Theme',
    colorSchemeName: 'Office',
    colors: {
      dk1: '000000',
      lt1: 'FFFFFF',
      dk2: '0E2841',
      lt2: 'E8E8E8',
      accent1: '156082',
      accent2: 'E97132',
      accent3: '196B24',
      accent4: '0F9ED5',
      accent5: 'A02B93',
      accent6: '4EA72E',
      hlink: '467886',
      folHlink: '96607D',
    },
    fontSchemeName: 'Office',
    majorFont: { latin: 'Aptos Display' },
    minorFont: { latin: 'Aptos Narrow' },
  };
}

/** Ordre des couleurs de theme dans les attributs « theme="n" » des couleurs de cellule. */
export const THEME_COLOR_ORDER = [
  'lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink',
] as const;

/** Polices de repli quand la police Office n'est pas installee (Linux, Android...). */
export const FONT_FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  'Aptos Narrow': ['Aptos Narrow', 'Calibri', 'Carlito', 'Arial Narrow', 'Liberation Sans Narrow', 'sans-serif'],
  Aptos: ['Aptos', 'Calibri', 'Carlito', 'Segoe UI', 'Arial', 'sans-serif'],
  'Aptos Display': ['Aptos Display', 'Calibri Light', 'Calibri', 'Carlito', 'Segoe UI Light', 'sans-serif'],
  Calibri: ['Calibri', 'Carlito', 'Arial', 'sans-serif'],
  'Calibri Light': ['Calibri Light', 'Calibri', 'Carlito', 'sans-serif'],
  Cambria: ['Cambria', 'Caladea', 'Georgia', 'serif'],
  Arial: ['Arial', 'Liberation Sans', 'Helvetica', 'sans-serif'],
  'Times New Roman': ['Times New Roman', 'Liberation Serif', 'Times', 'serif'],
  'Courier New': ['Courier New', 'Liberation Mono', 'Courier', 'monospace'],
  Consolas: ['Consolas', 'DejaVu Sans Mono', 'monospace'],
};

/** Pile CSS « font-family » d'une police de cellule, avec ses replis. */
export function cssFontFamily(name: string): string {
  const stack = FONT_FALLBACKS[name] ?? [name, 'Calibri', 'Carlito', 'sans-serif'];
  return stack.map((font) => (/^[a-z-]+$/.test(font) ? font : `"${font.replace(/"/g, '')}"`)).join(', ');
}

/** Codes d'erreur reconnus. */
export const ERROR_CODES = [
  '#NULL!', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A', '#GETTING_DATA', '#SPILL!', '#CALC!',
  '#FIELD!', '#BLOCKED!', '#CONNECT!', '#BUSY!', '#UNKNOWN!',
] as const;
