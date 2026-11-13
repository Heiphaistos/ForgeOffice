// Proprietes Word -> CSS (sans DOM) : caracteres, paragraphes, cellules, feuille de styles du document.
import {
  builtinStyle, cssFontStack, effectiveParagraphProps, effectiveRunProps,
  type Border, type HighlightColor, type ParagraphProps, type RunProps, type Shading, type Style, type TableBorders,
  type TableCellProps, type TableProps, type TableRowProps, type WordDocument,
} from '@forgeoffice/docx';

const HIGHLIGHT: Readonly<Record<HighlightColor, string>> = {
  yellow: '#FFFF00', green: '#00FF00', cyan: '#00FFFF', magenta: '#FF00FF', blue: '#0000FF', red: '#FF0000',
  darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000',
  darkYellow: '#808000', darkGray: '#808080', lightGray: '#C0C0C0', black: '#000000', white: '#FFFFFF', none: 'transparent',
};

export const HIGHLIGHT_NAMES = Object.keys(HIGHLIGHT) as HighlightColor[];

export function highlightHex(h: HighlightColor): string {
  return HIGHLIGHT[h];
}

/** Couleur de surlignage Word la plus proche d'une couleur hexadecimale « #RRGGBB ». */
export function nearestHighlight(hex: string): HighlightColor {
  const rgb = (h: string): number[] => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  const target = rgb(hex.startsWith('#') ? hex : `#${hex}`);
  let best: HighlightColor = 'yellow';
  let bestDist = Infinity;
  for (const name of HIGHLIGHT_NAMES) {
    if (name === 'none') continue;
    const c = rgb(HIGHLIGHT[name]);
    const d = c.reduce((s, v, i) => s + (v - (target[i] ?? 0)) ** 2, 0);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

const hex = (c: string | undefined): string | null => (c && c !== 'auto' && /^[0-9A-Fa-f]{6}$/.test(c) ? `#${c}` : null);

/** Valeur CSS sure : on refuse tout ce qui pourrait sortir de la declaration. */
const safe = (v: string): string => v.replace(/[;{}<>\\]/g, '');

const BORDER_STYLE: Readonly<Record<string, string>> = {
  single: 'solid', thick: 'solid', double: 'double', dotted: 'dotted', dashed: 'dashed', dotDash: 'dashed', dotDotDash: 'dotted',
  triple: 'double', wave: 'solid', doubleWave: 'double', threeDEmboss: 'ridge', threeDEngrave: 'groove', outset: 'outset', inset: 'inset',
};

export function borderCss(b: Border | undefined): string | null {
  if (!b || b.style === 'none') return null;
  const style = BORDER_STYLE[b.style] ?? 'solid';
  const width = Math.max(0.75, b.style === 'double' || b.style === 'triple' ? Math.max(b.width, 2.25) : b.width);
  return `${width}pt ${style} ${hex(b.color) ?? 'currentColor'}`;
}

function shadingCss(s: Shading | undefined): string | null {
  return s ? hex(s.fill) : null;
}

/** Declarations CSS d'un ensemble de proprietes de caracteres (sans accolades). */
export function runCss(p: Partial<RunProps>): string {
  const out: string[] = [];
  if (p.bold !== undefined) out.push(`font-weight:${p.bold ? 700 : 400}`);
  if (p.italic !== undefined) out.push(`font-style:${p.italic ? 'italic' : 'normal'}`);
  if (p.fontTheme) out.push(`font-family:var(--fo-doc-font-${p.fontTheme})`);
  else if (p.font) out.push(`font-family:${safe(cssFontStack(p.font))}`);
  if (p.size !== undefined && p.size > 0) out.push(`font-size:${p.size}pt`);
  const color = p.color ? hex(p.color.rgb) : null;
  if (color) out.push(`color:${color}`);
  else if (p.color?.rgb === 'auto') out.push('color:#000000');
  const deco: string[] = [];
  if (p.underline && p.underline !== 'none') deco.push('underline');
  if (p.strike || p.doubleStrike) deco.push('line-through');
  if (p.underline !== undefined || p.strike !== undefined || p.doubleStrike !== undefined) {
    out.push(`text-decoration-line:${deco.join(' ') || 'none'}`);
    if (p.underline === 'double' || p.doubleStrike) out.push('text-decoration-style:double');
    else if (p.underline === 'dotted' || p.underline === 'dottedHeavy') out.push('text-decoration-style:dotted');
    else if (p.underline?.startsWith('dash')) out.push('text-decoration-style:dashed');
    else if (p.underline?.startsWith('wav')) out.push('text-decoration-style:wavy');
    if (p.underline === 'thick' || p.underline?.endsWith('Heavy')) out.push('text-decoration-thickness:2px');
    const uc = hex(p.underlineColor);
    out.push(`text-decoration-color:${uc ?? 'var(--fo-ul, currentcolor)'}`);
  } else if (p.underlineColor) {
    // Marque seule : la couleur est transmise au soulignement qu'elle enveloppe.
    const uc = hex(p.underlineColor);
    if (uc) out.push(`--fo-ul:${uc}`);
  }
  if (p.kerning) out.push('font-kerning:normal');
  if (p.caps !== undefined) out.push(`text-transform:${p.caps ? 'uppercase' : 'none'}`);
  if (p.smallCaps !== undefined) out.push(`font-variant-caps:${p.smallCaps ? 'small-caps' : 'normal'}`);
  if (p.highlight && p.highlight !== 'none') out.push(`background-color:${HIGHLIGHT[p.highlight]}`);
  else {
    const sh = shadingCss(p.shading);
    if (sh) out.push(`background-color:${sh}`);
  }
  if (p.vertAlign === 'superscript' || p.vertAlign === 'subscript') {
    out.push(`vertical-align:${p.vertAlign === 'superscript' ? 'super' : 'sub'}`, 'font-size:65%', 'line-height:0');
  } else if (p.vertAlign === 'baseline') out.push('vertical-align:baseline');
  if (p.spacing) out.push(`letter-spacing:${p.spacing}pt`);
  if (p.position) out.push('position:relative', `top:${-p.position}pt`);
  if (p.scale && p.scale !== 100) out.push('display:inline-block', `transform:scaleX(${p.scale / 100})`, 'transform-origin:left');
  if (p.hidden) out.push('display:none');
  if (p.outline) out.push('-webkit-text-stroke:0.6px currentColor', 'color:transparent');
  if (p.shadow) out.push('text-shadow:1px 1px 1px rgba(0,0,0,.35)');
  if (p.emboss) out.push('text-shadow:-1px -1px 0 rgba(255,255,255,.6),1px 1px 0 rgba(0,0,0,.35)');
  if (p.imprint) out.push('text-shadow:1px 1px 0 rgba(255,255,255,.6),-1px -1px 0 rgba(0,0,0,.35)');
  const border = borderCss(p.border);
  if (border) out.push(`border:${border}`);
  if (p.rtl) out.push('direction:rtl', 'unicode-bidi:embed');
  return out.join(';');
}

/** Hauteur de ligne CSS d'un interligne Word (simple = 1,2 em environ, comme Aptos / Calibri). */
export function lineHeightCss(p: ParagraphProps): string | null {
  const ls = p.lineSpacing;
  if (!ls) return null;
  if (ls.rule === 'auto') return String(Math.round(ls.value * 1.2 * 1000) / 1000);
  return `${ls.value}pt`;
}

/** Declarations CSS d'un paragraphe. L'espacement avant/apres est un remplissage (Word additionne, il ne fusionne pas). */
export function paragraphCss(p: ParagraphProps): string {
  const out: string[] = [];
  if (p.alignment) out.push(`text-align:${p.alignment === 'distribute' ? 'justify' : p.alignment}`);
  if (p.indentLeft !== undefined) out.push(`margin-left:calc(var(--fo-sl,0px) + ${p.indentLeft}pt)`);
  if (p.indentRight !== undefined) out.push(`margin-right:calc(var(--fo-sr,0px) + ${p.indentRight}pt)`);
  if (p.indentFirstLine !== undefined) out.push(`text-indent:${p.indentFirstLine}pt`);
  if (p.spacingBefore !== undefined) out.push(`padding-top:${p.spacingBefore}pt`);
  if (p.spacingAfter !== undefined) out.push(`padding-bottom:${p.spacingAfter}pt`);
  const lh = lineHeightCss(p);
  if (lh) out.push(`line-height:${lh}`);
  const b = p.borders;
  if (b) {
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      const css = borderCss(b[side]);
      if (css) out.push(`border-${side}:${css}`);
    }
  }
  const sh = shadingCss(p.shading);
  if (sh) out.push(`background-color:${sh}`);
  if (p.bidi) out.push('direction:rtl');
  return out.join(';');
}

function tableBordersCss(b: TableBorders | undefined, inside: boolean): string[] {
  if (!b) return [];
  const out: string[] = [];
  const pairs: [string, Border | undefined][] = inside
    ? [['top', b.insideH], ['bottom', b.insideH], ['left', b.insideV], ['right', b.insideV]]
    : [['top', b.top], ['bottom', b.bottom], ['left', b.left], ['right', b.right]];
  for (const [side, border] of pairs) {
    // Une bordure explicitement « aucune » masque celle du style de tableau.
    const css = border?.style === 'none' ? 'none' : borderCss(border);
    if (css) out.push(`border-${side}:${css}`);
  }
  return out;
}

/** CSS d'une cellule (trame, alignement vertical, bordures directes). */
export function cellCss(p: TableCellProps): string {
  const out: string[] = [];
  const sh = shadingCss(p.shading);
  if (sh) out.push(`background-color:${sh}`);
  if (p.verticalAlign) out.push(`vertical-align:${p.verticalAlign === 'center' ? 'middle' : p.verticalAlign}`);
  out.push(...tableBordersCss(p.borders, false));
  if (p.margins?.left !== undefined) out.push(`padding-left:${p.margins.left}pt`);
  if (p.margins?.right !== undefined) out.push(`padding-right:${p.margins.right}pt`);
  if (p.margins?.top !== undefined) out.push(`padding-top:${p.margins.top}pt`);
  if (p.margins?.bottom !== undefined) out.push(`padding-bottom:${p.margins.bottom}pt`);
  return out.join(';');
}

/** CSS d'un tableau : largeur preferee, alignement, mode de disposition. */
export function tableCss(p: TableProps): string {
  const out: string[] = [];
  if (p.width?.type === 'pt' && p.width.value > 0) out.push(`width:${p.width.value}pt`);
  else if (p.width?.type === 'pct' && p.width.value > 0) out.push(`width:${p.width.value}%`);
  if (p.alignment === 'center') out.push('margin-left:auto;margin-right:auto');
  else if (p.alignment === 'right') out.push('margin-left:auto;margin-right:0');
  if (p.layout === 'fixed') out.push('table-layout:fixed');
  // Marges par defaut des cellules (lues par la regle `td` de App.css) et espacement entre cellules.
  for (const [k, side] of [['top', 't'], ['right', 'r'], ['bottom', 'b'], ['left', 'l']] as const) {
    const v = p.cellMargins?.[k];
    if (v !== undefined) out.push(`--fo-cm-${side}:${v}pt`);
  }
  if (p.cellSpacing) out.push(`border-collapse:separate;border-spacing:${p.cellSpacing}pt`);
  return out.join(';');
}

/** CSS d'une ligne : hauteur (minimale ou exacte). */
export function rowCss(p: TableRowProps): string {
  return p.height && p.height.rule !== 'auto' && p.height.value > 0 ? `height:${p.height.value}pt` : '';
}

const ruleFor = (selector: string, css: string): string => (css ? `${selector}{${css}}` : '');

/** Proprietes de caracteres d'un style de caractere seul (chaine basedOn, sans le paragraphe). */
function charStyleRun(styles: readonly Style[], id: string): RunProps {
  const byId = new Map(styles.map((s) => [s.id, s]));
  const chain: Style[] = [];
  const seen = new Set<string>();
  let cur = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.basedOn ? byId.get(cur.basedOn) : undefined;
  }
  return chain.reduce<RunProps>((acc, s) => ({ ...acc, ...s.run }), {});
}

const COUNTER_STYLES: Readonly<Record<string, string>> = {
  decimal: 'decimal', decimalZero: 'decimal-leading-zero', lowerRoman: 'lower-roman', upperRoman: 'upper-roman', lowerLetter: 'lower-alpha', upperLetter: 'upper-alpha',
};

/** Style de compteur CSS d'un format de numero Word (decimal par defaut). */
export const counterStyle = (format: string | undefined, fallback: string): string => COUNTER_STYLES[format ?? fallback] ?? 'decimal';

const cssIdent = (id: string): string => id.replace(/["\\\n]/g, '');

/**
 * Feuille de styles du document : styles de paragraphe (`p[data-style]`), de caractere (`span[data-cstyle]`),
 * de tableau (`table[data-tstyle]`) et paragraphe par defaut. `scope` = selecteur de la racine de l'editeur.
 */
export function documentStylesheet(doc: WordDocument, scope: string): string {
  const rules: string[] = [];
  const theme = doc.theme;
  rules.push(`${scope}{--fo-doc-font-major:${safe(cssFontStack(theme.majorFont))};--fo-doc-font-minor:${safe(cssFontStack(theme.minorFont))};tab-size:${(doc.settings.defaultTabStop * 4) / 3}px}`);
  // Numerotation des notes : format et premier numero (les compteurs du document sont reinitialises ici).
  const fn = doc.settings.footnoteNumbering;
  const en = doc.settings.endnoteNumbering;
  rules.push(`${scope}{counter-reset:fo-fn ${(fn?.start ?? 1) - 1} fo-en ${(en?.start ?? 1) - 1} !important}`);
  rules.push(`${scope} .fo-fnref:not([data-custom])::after{content:counter(fo-fn, ${counterStyle(fn?.format, 'decimal')})}`);
  rules.push(`${scope} .fo-enref:not([data-custom])::after{content:counter(fo-en, ${counterStyle(en?.format, 'lowerRoman')})}`);
  // Pose horizontale par section (voir layout-deco.ts) : les blocs decores portent --fo-sl / --fo-sr ; leurs descendants repartent de zero.
  rules.push(`${scope} > [data-sx]{margin-left:var(--fo-sl);margin-right:var(--fo-sr)}`, `${scope} [data-sx] *{--fo-sl:0px;--fo-sr:0px}`);
  const defaults = effectiveParagraphProps(doc, { props: {} });
  const defaultRun = effectiveRunProps(doc, { styleId: undefined }, { props: {} });
  rules.push(ruleFor(`${scope} p`, [paragraphCss(defaults), runCss({ ...defaultRun, fontTheme: defaultRun.fontTheme })].filter(Boolean).join(';')));
  for (const style of doc.styles.styles) {
    const id = cssIdent(style.id);
    if (style.type === 'paragraph' && !style.isDefault) {
      const pp = effectiveParagraphProps(doc, { styleId: style.id, props: {} });
      const rp = effectiveRunProps(doc, { styleId: style.id }, { props: {} });
      rules.push(ruleFor(`${scope} p[data-style="${id}"]`, [paragraphCss(pp), runCss(rp)].filter(Boolean).join(';')));
      if (pp.contextualSpacing) {
        // Pas d'espace entre deux paragraphes consecutifs du meme style (listes).
        rules.push(`${scope} p[data-style="${id}"]:has(+ p[data-style="${id}"]){padding-bottom:0}`, `${scope} p[data-style="${id}"] + p[data-style="${id}"]{padding-top:0}`);
      }
    } else if (style.type === 'character' && !style.isDefault) {
      rules.push(ruleFor(`${scope} span[data-cstyle="${id}"]`, runCss(charStyleRun(doc.styles.styles, style.id))));
    } else if (style.type === 'table') {
      const borders = style.table?.borders;
      rules.push(ruleFor(`${scope} table[data-tstyle="${id}"]`, tableBordersCss(borders, false).join(';')));
      rules.push(ruleFor(`${scope} table[data-tstyle="${id}"] td`, tableBordersCss(borders, true).join(';')));
      if (style.paragraph) rules.push(ruleFor(`${scope} table[data-tstyle="${id}"] p`, paragraphCss(style.paragraph)));
      const first = style.tableConditional?.find((c) => c.region === 'firstRow');
      if (first) {
        const css = [first.cell?.shading ? `background-color:${hex(first.cell.shading.fill) ?? 'transparent'}` : '', first.run ? runCss(first.run) : ''].filter(Boolean).join(';');
        rules.push(ruleFor(`${scope} table[data-tstyle="${id}"] tr:first-child td`, css));
      }
    }
  }
  return rules.filter(Boolean).join('\n');
}

/** Ajoute un style integre absent du document (Titre 4, Citation...). Renvoie vrai si la feuille a change. */
export function ensureStyle(doc: WordDocument, id: string): boolean {
  if (doc.styles.styles.some((s) => s.id === id)) return false;
  const style = builtinStyle(id);
  if (!style) return false;
  doc.styles.styles.push(style);
  const linked = style.link ? builtinStyle(style.link) : undefined;
  if (linked && !doc.styles.styles.some((s) => s.id === linked.id)) doc.styles.styles.push(linked);
  return true;
}
