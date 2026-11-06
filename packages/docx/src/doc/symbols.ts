// Polices de symboles (Symbol, Wingdings) : code de caractere -> Unicode, pour les anciens documents Word dont les
// puces et symboles sont des codes bruts de ces polices (ou des codes prives U+F0xx).

const SYMBOL_LOW = ' !∀#∃%&∋()∗+,−./0123456789:;<=>?≅ΑΒΧΔΕΦΓΗΙϑΚΛΜΝΟΠΘΡΣΤΥςΩΞΨΖ[∴]⊥_‾αβχδεφγηιϕκλμνοπθρστυϖωξψζ{|}∼';
// 0xA0..0xF2 (0xA0 = euro, 0xF0 = pomme).
const SYMBOL_HIGH = '€ϒ′≤⁄∞ƒ♣♦♥♠↔←↑→↓°±″≥×∝∂•÷≠≡≈…⏐⎯↵ℵℑℜ℘⊗⊕∅∩∪⊃⊇⊄⊂⊆∈∉∠∇®©™∏√⋅¬∧∨⇔⇐⇑⇒⇓◊〈®©™∑⎛⎜⎝⎡⎢⎣⎧⎨⎩⎪〉∫⌠⎮⌡';

const WINGDINGS: Readonly<Record<number, string>> = {
  0x21: '✏', 0x22: '✂', 0x23: '✁', 0x28: '☎', 0x29: '✆', 0x2a: '✉', 0x34: '⌛', 0x36: '⌨', 0x46: '✌', 0x4a: '☺', 0x4c: '☹',
  0x4e: '☠', 0x4f: '⚐', 0x52: '✈', 0x53: '☼', 0x55: '❄', 0x58: '✠', 0x59: '✡', 0x5a: '☪', 0x5b: '☯', 0x6c: '●', 0x6d: '❍',
  0x6e: '■', 0x6f: '□', 0x71: '❑', 0x72: '❒', 0x73: '⬧', 0x74: '⧫', 0x75: '◆', 0x76: '❖', 0x77: '⬥', 0x78: '⌧', 0x7a: '⌘',
  0x7b: '❀', 0x7c: '✿', 0x7d: '❝', 0x7e: '❞', 0xa1: '○', 0xa4: '◉', 0xa7: '▪', 0xa8: '◻', 0xaa: '✪', 0xab: '★', 0xd8: '➢',
  0xe0: '➔', 0xe8: '➔', 0xef: '⇦', 0xf0: '⇨', 0xf1: '⇧', 0xf2: '⇩', 0xfb: '✗', 0xfc: '✓', 0xfd: '☒', 0xfe: '☑',
};

/** Caractere Unicode equivalent a `code` (0..255 ou 0xF000..0xF0FF) dans une police de symboles, ou undefined. */
export function symbolToUnicode(font: string, code: number): string | undefined {
  const low = code >= 0xf000 && code <= 0xf0ff ? code - 0xf000 : code;
  if (low < 0x20 || low > 0xff) return undefined;
  const name = font.trim().toLowerCase();
  if (name === 'wingdings') return WINGDINGS[low];
  if (name !== 'symbol') return undefined;
  if (low <= 0x7e) return SYMBOL_LOW[low - 0x20];
  if (low >= 0xa0 && low - 0xa0 < SYMBOL_HIGH.length + 1) return Array.from(SYMBOL_HIGH)[low - 0xa0];
  return undefined;
}
