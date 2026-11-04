// Les 17 themes et les 8 dispositions de WinNote, plus le theme Office 2024 (defaut, suit le theme de la suite).

export interface SyntaxColors {
  comment: string;
  string: string;
  number: string;
  keyword: string;
  type: string;
  meta: string;
  operator: string;
  attribute: string;
  func: string;
}

export interface NoteTheme {
  id: string;
  name: string;
  dark: boolean;
  bg: string;
  fg: string;
  selection: string;
  activeLine: string;
  gutter: string;
  uiBg: string;
  uiFg: string;
  accent: string;
  syntax: SyntaxColors;
}

export const OFFICE_THEME = 'office';

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0').toUpperCase()}`;

function t(id: string, name: string, dark: boolean, c: readonly number[], s: readonly number[]): NoteTheme {
  const [bg = 0, fg = 0, selection = 0, activeLine = 0, gutter = 0, uiBg = 0, uiFg = 0, accent = 0] = c;
  const [comment = 0, string = 0, number = 0, keyword = 0, type = 0, meta = 0, operator = 0, attribute = 0, func = 0] = s;
  return {
    id, name, dark, bg: hex(bg), fg: hex(fg), selection: hex(selection), activeLine: hex(activeLine), gutter: hex(gutter), uiBg: hex(uiBg), uiFg: hex(uiFg),
    accent: hex(accent),
    syntax: {
      comment: hex(comment), string: hex(string), number: hex(number), keyword: hex(keyword), type: hex(type), meta: hex(meta), operator: hex(operator),
      attribute: hex(attribute), func: hex(func),
    },
  };
}

// Valeurs reprises telles quelles de WinNote (src/theme.rs).
export const THEMES: readonly NoteTheme[] = [
  t('windows-light', 'Clair (Windows)', false, [0xFFFFFF, 0x1B1B1B, 0xADD6FF, 0xF5F5F5, 0x8A8A8A, 0xF3F3F3, 0x1B1B1B, 0x0067C0], [0x008000, 0xA31515, 0x098658, 0x0000FF, 0x267F99, 0xAF00DB, 0x1B1B1B, 0x001080, 0x795E26]),
  t('windows-dark', 'Sombre (Windows)', true, [0x1E1E1E, 0xD4D4D4, 0x264F78, 0x2A2A2A, 0x858585, 0x2B2B2B, 0xFFFFFF, 0x60CDFF], [0x6A9955, 0xCE9178, 0xB5CEA8, 0x569CD6, 0x4EC9B0, 0xC586C0, 0xD4D4D4, 0x9CDCFE, 0xDCDCAA]),
  t('monokai', 'Monokai', true, [0x272822, 0xF8F8F2, 0x49483E, 0x3E3D32, 0x90908A, 0x1E1F1C, 0xF8F8F2, 0xA6E22E], [0x75715E, 0xE6DB74, 0xAE81FF, 0xF92672, 0x66D9EF, 0xF92672, 0xF8F8F2, 0xA6E22E, 0xA6E22E]),
  t('dracula', 'Dracula', true, [0x282A36, 0xF8F8F2, 0x44475A, 0x2F3241, 0x6272A4, 0x21222C, 0xF8F8F2, 0xBD93F9], [0x6272A4, 0xF1FA8C, 0xBD93F9, 0xFF79C6, 0x8BE9FD, 0xFF79C6, 0xFF79C6, 0x50FA7B, 0x50FA7B]),
  t('nord', 'Nord', true, [0x2E3440, 0xD8DEE9, 0x434C5E, 0x3B4252, 0x616E88, 0x272C36, 0xD8DEE9, 0x88C0D0], [0x616E88, 0xA3BE8C, 0xB48EAD, 0x81A1C1, 0x8FBCBB, 0x5E81AC, 0x81A1C1, 0x8FBCBB, 0x88C0D0]),
  t('solarized-light', 'Solarized clair', false, [0xFDF6E3, 0x657B83, 0xEEE8D5, 0xEEE8D5, 0x93A1A1, 0xEEE8D5, 0x586E75, 0x268BD2], [0x93A1A1, 0x2AA198, 0xD33682, 0x859900, 0xB58900, 0xCB4B16, 0x657B83, 0x268BD2, 0x268BD2]),
  t('solarized-dark', 'Solarized sombre', true, [0x002B36, 0x839496, 0x073642, 0x073642, 0x586E75, 0x00212B, 0x93A1A1, 0x268BD2], [0x586E75, 0x2AA198, 0xD33682, 0x859900, 0xB58900, 0xCB4B16, 0x839496, 0x268BD2, 0x268BD2]),
  t('sepia', 'Papier (sépia)', false, [0xF4ECD8, 0x433422, 0xE0D2B0, 0xEBE1C8, 0x9C8C6C, 0xE8DEC4, 0x433422, 0x8B5E34], [0x8A7A5C, 0x9C4A1A, 0x7A5C00, 0x7A3E9D, 0x2F6F6F, 0xB5552B, 0x433422, 0x2F5F8F, 0x8B5E34]),
  t('gruvbox', 'Gruvbox sombre', true, [0x282828, 0xEBDBB2, 0x504945, 0x32302F, 0x7C6F64, 0x1D2021, 0xEBDBB2, 0xFABD2F], [0x928374, 0xB8BB26, 0xD3869B, 0xFB4934, 0xFABD2F, 0x8EC07C, 0xEBDBB2, 0x83A598, 0xB8BB26]),
  t('high-contrast', 'Nuit (contraste élevé)', true, [0x000000, 0xFFFFFF, 0x264F78, 0x1A1A1A, 0x9A9A9A, 0x0A0A0A, 0xFFFFFF, 0xFFD700], [0x7CA668, 0xCE9178, 0xB5CEA8, 0x569CD6, 0x4EC9B0, 0xC586C0, 0xFFFFFF, 0x9CDCFE, 0xDCDCAA]),
  t('apple-light', 'Apple Notes (clair)', false, [0xFFFEF8, 0x1D1D1F, 0xFBE7A1, 0xFFF7DB, 0xB0AFA8, 0xF2EFE6, 0x1D1D1F, 0xE5A100], [0x5D6C79, 0xD12F1B, 0x272AD8, 0xAD3DA4, 0x3E8087, 0x78492A, 0x1D1D1F, 0x4B21B0, 0x0F68A0]),
  t('apple-dark', 'Apple Notes (sombre)', true, [0x1C1C1E, 0xF2F2F7, 0x5C4B14, 0x2C2C2E, 0x636366, 0x2C2C2E, 0xF2F2F7, 0xFFD60A], [0x7F8C98, 0xFC6A5D, 0xD0BF69, 0xFC5FA3, 0x5DD8FF, 0xFD8F3F, 0xF2F2F7, 0x78C2B3, 0x67B7A4]),
  t('github-light', 'GitHub clair', false, [0xFFFFFF, 0x24292F, 0xB6D6FD, 0xF6F8FA, 0x8C959F, 0xF6F8FA, 0x24292F, 0x0969DA], [0x6E7781, 0x0A3069, 0x0550AE, 0xCF222E, 0x953800, 0x8250DF, 0x24292F, 0x116329, 0x8250DF]),
  t('tokyo-night', 'Tokyo Night', true, [0x1A1B26, 0xC0CAF5, 0x33467C, 0x1F2335, 0x3B4261, 0x16161E, 0xC0CAF5, 0x7AA2F7], [0x565F89, 0x9ECE6A, 0xFF9E64, 0xBB9AF7, 0x2AC3DE, 0x7DCFFF, 0x89DDFF, 0x73DACA, 0x7AA2F7]),
  t('one-dark', 'One Dark', true, [0x282C34, 0xABB2BF, 0x3E4451, 0x2C313A, 0x495162, 0x21252B, 0xABB2BF, 0x61AFEF], [0x5C6370, 0x98C379, 0xD19A66, 0xC678DD, 0xE5C07B, 0x56B6C2, 0x56B6C2, 0xD19A66, 0x61AFEF]),
  t('catppuccin', 'Catppuccin Mocha', true, [0x1E1E2E, 0xCDD6F4, 0x45475A, 0x313244, 0x6C7086, 0x181825, 0xCDD6F4, 0xCBA6F7], [0x6C7086, 0xA6E3A1, 0xFAB387, 0xCBA6F7, 0xF9E2AF, 0xF5C2E7, 0x89DCEB, 0x89B4FA, 0x89B4FA]),
  t('obsidian', 'Obsidian', true, [0x1E1E1E, 0xDADADA, 0x3B3552, 0x262626, 0x6C6C6C, 0x262626, 0xDADADA, 0x8B6CEF], [0x6A737D, 0x7EE787, 0xF2CC60, 0xA78BFA, 0x79C0FF, 0xFF7B72, 0xDADADA, 0x79C0FF, 0xD2A8FF]),
];

export function themeById(id: string): NoteTheme | null {
  return THEMES.find((th) => th.id === id) ?? null;
}

export interface Layout {
  name: string;
  font: string;
  fontSize: number;
  wrap: boolean;
  lineNumbers: boolean;
  /** Marge interieure de la zone de texte (px). */
  margin: number;
  /** Espace supplementaire entre les lignes (px). */
  spacing: number;
  theme: string | null;
  side: 'none' | 'files' | 'outline';
  preview: boolean;
  foldGutter: boolean;
}

const l = (name: string, font: string, fontSize: number, wrap: boolean, lineNumbers: boolean, margin: number, extra: Partial<Layout> = {}): Layout => ({
  name, font, fontSize, wrap, lineNumbers, margin, spacing: 0, theme: null, side: 'none', preview: false, foldGutter: false, ...extra,
});

export const LAYOUTS: readonly Layout[] = [
  l('Classique (Bloc-notes)', 'Consolas', 11, true, false, 6),
  l('Code (Notepad++)', 'Consolas', 11, false, true, 4, { foldGutter: true }),
  l('Écriture', 'Georgia', 14, true, false, 56, { spacing: 3 }),
  l('Notes (style Apple, clair)', 'Segoe UI', 15, true, false, 48, { theme: 'apple-light', spacing: 4 }),
  l('Notes (style Apple, sombre)', 'Segoe UI', 15, true, false, 48, { theme: 'apple-dark', spacing: 4 }),
  l('Obsidian (explorateur + plan)', 'Segoe UI', 14, true, false, 40, { theme: 'obsidian', side: 'outline', spacing: 3 }),
  l('Markdown (édition + aperçu)', 'Segoe UI', 13, true, false, 20, { preview: true, spacing: 2 }),
  l('Sans distraction', 'Georgia', 16, true, false, 150, { spacing: 5 }),
];

const MONO = new Set(['consolas', 'cascadia mono', 'cascadia code', 'courier new', 'lucida console', 'jetbrains mono', 'fira code', 'dejavu sans mono', 'menlo', 'monaco']);
const SERIF = new Set(['georgia', 'cambria', 'times new roman', 'garamond', 'book antiqua', 'palatino linotype']);

/** Pile CSS d'une police avec des remplacements Linux/macOS. */
export function fontStack(font: string): string {
  const k = font.trim().toLowerCase();
  const safe = font.replace(/["\\]/g, '');
  if (MONO.has(k)) return `"${safe}", "Cascadia Mono", "DejaVu Sans Mono", Menlo, monospace`;
  if (SERIF.has(k)) return `"${safe}", "DejaVu Serif", Georgia, serif`;
  return `"${safe}", "Segoe UI", system-ui, sans-serif`;
}
