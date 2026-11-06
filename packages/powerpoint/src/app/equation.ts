// Equations : saisie lineaire de type LaTeX reduit (fractions, exposants et indices, racines, sommes, integrales,
// lettres grecques, delimiteurs) mise en page puis rendue en SVG. Sans DOM : testable dans Node.
// Le texte de la saisie est conserve avec la forme ; le SVG et son repli PNG servent a l'affichage et a l'export.

export class EquationError extends Error {}

/** Largeur d'un texte dans la police de l'equation (navigateur) ; absent = approximation par classe de caractere. */
export type TextMeasure = (text: string, fontSize: number, italic: boolean, bold: boolean) => number;

export interface EquationSvg {
  svg: string;
  width: number;
  height: number;
}

const GREEK: Readonly<Record<string, string>> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
  pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'ϕ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

const SYMBOLS: Readonly<Record<string, string>> = {
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', sim: '∼', infty: '∞', partial: '∂', nabla: '∇',
  to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', Leftarrow: '⇐', leftrightarrow: '↔', in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩', forall: '∀', exists: '∃',
  emptyset: '∅', ldots: '…', cdots: '⋯', degree: '°', prime: '′', propto: '∝', angle: '∠', perp: '⊥', parallel: '∥', circ: '∘', ast: '∗', hbar: 'ℏ', ell: 'ℓ', Re: 'ℜ', Im: 'ℑ',
};

const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp', 'min', 'max', 'det', 'gcd', 'lim', 'sup', 'inf', 'deg', 'dim', 'ker']);
const BIGOPS: Readonly<Record<string, string>> = { sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', oint: '∮', bigcup: '⋃', bigcap: '⋂' };
const DELIMS = new Set(['(', ')', '[', ']', '|', '{', '}', '.', '‖']);

// ---------------------------------------------------------------- Arbre

type Node =
  | { t: 'char'; s: string; style: 'math' | 'roman' | 'bold' | 'op' }
  | { t: 'row'; items: Node[] }
  | { t: 'frac'; num: Node; den: Node }
  | { t: 'sqrt'; body: Node; index?: Node }
  | { t: 'script'; base: Node; sup?: Node; sub?: Node }
  | { t: 'bigop'; sym: string; sup?: Node; sub?: Node; limits: boolean }
  | { t: 'fence'; open: string; close: string; body: Node }
  | { t: 'accent'; kind: 'bar' | 'hat' | 'vec'; body: Node }
  | { t: 'space'; em: number };

class Parser {
  private i = 0;
  private readonly src: string;
  constructor(src: string) {
    this.src = src;
  }

  parse(): Node {
    const row = this.row(() => false);
    if (this.i < this.src.length) throw new EquationError(`Accolade ou délimiteur inattendu à la position ${this.i + 1}.`);
    return row;
  }

  private peek(): string {
    return this.src[this.i] ?? '';
  }

  private row(stop: () => boolean): Node {
    const items: Node[] = [];
    for (;;) {
      this.skipSpaces();
      if (this.i >= this.src.length || stop()) break;
      let atom = this.atom();
      atom = this.scripts(atom);
      items.push(atom);
    }
    return items.length === 1 ? (items[0] as Node) : { t: 'row', items };
  }

  private skipSpaces(): void {
    while (this.i < this.src.length && /\s/.test(this.peek())) this.i++;
  }

  private group(): Node {
    this.skipSpaces();
    if (this.peek() === '{') {
      this.i++;
      const body = this.row(() => this.peek() === '}');
      if (this.peek() !== '}') throw new EquationError('Accolade fermante « } » manquante.');
      this.i++;
      return body;
    }
    if (this.i >= this.src.length) throw new EquationError('Argument manquant.');
    return this.atom();
  }

  private scripts(base: Node): Node {
    let sup: Node | undefined;
    let sub: Node | undefined;
    for (;;) {
      this.skipSpaces();
      const c = this.peek();
      if (c === '^' && !sup) {
        this.i++;
        sup = this.group();
      } else if (c === '_' && !sub) {
        this.i++;
        sub = this.group();
      } else break;
    }
    if (!sup && !sub) return base;
    if (base.t === 'bigop') return { ...base, sup, sub };
    return { t: 'script', base, sup, sub };
  }

  private command(): string {
    let name = '';
    while (/[A-Za-z]/.test(this.peek())) name += this.src[this.i++];
    if (!name && this.i < this.src.length) name = this.src[this.i++] as string;
    return name;
  }

  private atom(): Node {
    const c = this.peek();
    if (c === '{') return this.group();
    if (c === '}') throw new EquationError('Accolade fermante « } » inattendue.');
    if (c === '^' || c === '_') throw new EquationError('Exposant ou indice sans base.');
    if (c !== '\\') {
      this.i++;
      return { t: 'char', s: c, style: /[A-Za-z]/.test(c) ? 'math' : 'roman' };
    }
    this.i++;
    const name = this.command();
    if (name === 'frac' || name === 'dfrac') return { t: 'frac', num: this.group(), den: this.group() };
    if (name === 'sqrt') {
      let index: Node | undefined;
      this.skipSpaces();
      if (this.peek() === '[') {
        this.i++;
        index = this.row(() => this.peek() === ']');
        if (this.peek() !== ']') throw new EquationError('Crochet fermant « ] » manquant.');
        this.i++;
      }
      return { t: 'sqrt', body: this.group(), index };
    }
    if (name === 'text' || name === 'mathrm' || name === 'mathbf') {
      const body = this.group();
      return restyle(body, name === 'mathbf' ? 'bold' : 'roman');
    }
    if (name === 'overline' || name === 'bar') return { t: 'accent', kind: 'bar', body: this.group() };
    if (name === 'hat') return { t: 'accent', kind: 'hat', body: this.group() };
    if (name === 'vec') return { t: 'accent', kind: 'vec', body: this.group() };
    if (name === 'left') {
      const open = this.delim();
      const body = this.row(() => this.src.startsWith('\\right', this.i));
      if (!this.src.startsWith('\\right', this.i)) throw new EquationError('« \\right » manquant après « \\left ».');
      this.i += 6;
      return { t: 'fence', open, close: this.delim(), body };
    }
    if (name === 'right') throw new EquationError('« \\right » sans « \\left ».');
    if (BIGOPS[name]) return { t: 'bigop', sym: BIGOPS[name] as string, limits: name !== 'int' && name !== 'iint' && name !== 'oint' };
    if (FUNCTIONS.has(name)) return { t: 'char', s: name, style: 'op' };
    if (GREEK[name]) return { t: 'char', s: GREEK[name] as string, style: 'math' };
    if (SYMBOLS[name]) return { t: 'char', s: SYMBOLS[name] as string, style: 'roman' };
    if (name === ',') return { t: 'space', em: 0.17 };
    if (name === ':' || name === ';') return { t: 'space', em: 0.28 };
    if (name === 'quad') return { t: 'space', em: 1 };
    if (name === 'qquad') return { t: 'space', em: 2 };
    if (name === '!') return { t: 'space', em: -0.17 };
    if (name === '\\') return { t: 'space', em: 0.5 };
    if ('{}%&#_$^'.includes(name)) return { t: 'char', s: name, style: 'roman' };
    throw new EquationError(`Commande inconnue : « \\${name} ».`);
  }

  private delim(): string {
    this.skipSpaces();
    let d = this.peek();
    if (d === '\\') {
      this.i++;
      d = this.command();
      if (d === 'lbrace') d = '{';
      else if (d === 'rbrace') d = '}';
      else if (d === 'langle') d = '⟨';
      else if (d === 'rangle') d = '⟩';
      else if (d === '|') d = '‖';
      else throw new EquationError('Délimiteur inconnu.');
      return d;
    }
    this.i++;
    if (!DELIMS.has(d)) throw new EquationError(`Délimiteur « ${d} » non pris en charge.`);
    return d;
  }
}

function restyle(node: Node, style: 'roman' | 'bold'): Node {
  if (node.t === 'char') return { ...node, style };
  if (node.t === 'row') return { t: 'row', items: node.items.map((n) => restyle(n, style)) };
  return node;
}

// ---------------------------------------------------------------- Mise en page

interface Box {
  w: number;
  /** Hauteur au-dessus de la ligne de base, profondeur au-dessous. */
  a: number;
  d: number;
  draw: (x: number, y: number) => string;
}

const FONT = "'Cambria Math','STIX Two Math','Latin Modern Math','Times New Roman',serif";
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (v: number): string => String(Math.round(v * 100) / 100);

/** Largeur approchee d'un caractere (em), a defaut de mesure. */
function approxWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    if (/[iIl.,;:'!|′]/.test(ch)) w += 0.3;
    else if (/[mwMW∑∏]/.test(ch)) w += 0.85;
    else if (/[A-ZΑ-Ω]/.test(ch)) w += 0.68;
    else if (/[0-9]/.test(ch)) w += 0.5;
    else if (/[+\-=<>±∓×÷≤≥≠≈≡→←⇒⇐↔∈∉⊂⊆∪∩]/.test(ch)) w += 0.62;
    else if (ch === '−' || ch === '·') w += 0.5;
    else w += 0.52;
  }
  return w;
}

interface Env {
  measure: TextMeasure | undefined;
  color: string;
}

function textBox(env: Env, s: string, size: number, style: 'math' | 'roman' | 'bold' | 'op', scale = 1): Box {
  const italic = style === 'math';
  const bold = style === 'bold';
  const fs = size * scale;
  const w = env.measure ? env.measure(s, fs, italic, bold) : approxWidth(s) * fs;
  return {
    w,
    a: fs * 0.72,
    d: fs * 0.22,
    draw: (x, y) => `<text x="${n2(x)}" y="${n2(y)}" font-size="${n2(fs)}"${italic ? ' font-style="italic"' : ''}${bold ? ' font-weight="bold"' : ''}>${esc(s)}</text>`,
  };
}

const row = (boxes: readonly Box[]): Box => {
  let w = 0;
  let a = 0;
  let d = 0;
  for (const b of boxes) {
    w += b.w;
    a = Math.max(a, b.a);
    d = Math.max(d, b.d);
  }
  return {
    w,
    a,
    d,
    draw: (x, y) => {
      let at = x;
      return boxes.map((b) => {
        const out = b.draw(at, y);
        at += b.w;
        return out;
      }).join('');
    },
  };
};

const gap = (w: number): Box => ({ w, a: 0, d: 0, draw: () => '' });
const BINARY = new Set(['+', '−', '-', '=', '<', '>', '±', '∓', '×', '÷', '≤', '≥', '≠', '≈', '≡', '∼', '→', '←', '⇒', '⇐', '↔', '∈', '∉', '⊂', '⊆', '∪', '∩', '∝', '∘']);

function layout(node: Node, env: Env, size: number): Box {
  switch (node.t) {
    case 'char': {
      const text = node.s === '-' ? '−' : node.s;
      if (node.style === 'op') return row([textBox(env, text, size, 'roman'), gap(size * 0.17)]);
      return textBox(env, text, size, node.style);
    }
    case 'space':
      return gap(node.em * size);
    case 'row': {
      const parts: Box[] = [];
      node.items.forEach((item, i) => {
        const prev = node.items[i - 1];
        const isBinary = item.t === 'char' && BINARY.has(item.s) && prev !== undefined;
        const box = layout(item, env, size);
        if (isBinary) parts.push(gap(size * 0.22), box, gap(size * 0.22));
        else parts.push(box);
      });
      return row(parts);
    }
    case 'frac': {
      const small = size * 0.9;
      const n = layout(node.num, env, small);
      const dn = layout(node.den, env, small);
      const pad = size * 0.12;
      const w = Math.max(n.w, dn.w) + 2 * pad;
      const axis = size * 0.28;
      const g = size * 0.14;
      const th = Math.max(0.8, size * 0.055);
      return {
        w,
        a: axis + g + n.a + n.d + th / 2,
        d: dn.a + dn.d + g - axis + th / 2,
        draw: (x, y) =>
          n.draw(x + (w - n.w) / 2, y - axis - g - n.d) +
          `<rect x="${n2(x + pad / 2)}" y="${n2(y - axis - th / 2)}" width="${n2(w - pad)}" height="${n2(th)}"/>` +
          dn.draw(x + (w - dn.w) / 2, y - axis + g + dn.a),
      };
    }
    case 'sqrt': {
      const body = layout(node.body, env, size);
      const idx = node.index ? layout(node.index, env, size * 0.6) : null;
      const g = size * 0.14;
      const th = Math.max(0.8, size * 0.055);
      const tick = size * 0.62;
      const top = body.a + g;
      const h = top + body.d;
      const pad = size * 0.08;
      const lead = idx ? Math.max(0, idx.w - tick * 0.5) : 0;
      return {
        w: lead + tick + body.w + pad,
        a: top + th,
        d: body.d,
        draw: (x, y) => {
          const x0 = x + lead;
          const yb = y + body.d;
          const yt = y - top;
          const pts = `${n2(x0)},${n2(yb - h * 0.4)} ${n2(x0 + tick * 0.22)},${n2(yb - h * 0.45)} ${n2(x0 + tick * 0.5)},${n2(yb)} ${n2(x0 + tick)},${n2(yt)} ${n2(x0 + tick + body.w + pad)},${n2(yt)}`;
          return (
            `<polyline points="${pts}" fill="none" stroke="${env.color}" stroke-width="${n2(th)}" stroke-linejoin="miter" stroke-linecap="butt"/>` +
            body.draw(x0 + tick, y) +
            (idx ? idx.draw(x + Math.max(0, lead - idx.w + tick * 0.35), y - h * 0.5 + idx.d) : '')
          );
        },
      };
    }
    case 'script': {
      const base = layout(node.base, env, size);
      const s = size * 0.7;
      const sup = node.sup ? layout(node.sup, env, s) : null;
      const sub = node.sub ? layout(node.sub, env, s) : null;
      const supUp = sup ? Math.max(base.a * 0.62, sup.d + size * 0.3) : 0;
      const subDown = sub ? Math.max(size * 0.22, base.d + sub.a * 0.4) : 0;
      const w = base.w + Math.max(sup?.w ?? 0, sub?.w ?? 0) + size * 0.04;
      return {
        w,
        a: Math.max(base.a, sup ? supUp + sup.a : 0),
        d: Math.max(base.d, sub ? subDown + sub.d : 0),
        draw: (x, y) => base.draw(x, y) + (sup ? sup.draw(x + base.w + size * 0.04, y - supUp) : '') + (sub ? sub.draw(x + base.w + size * 0.04, y + subDown) : ''),
      };
    }
    case 'bigop': {
      const integral = !node.limits;
      const glyphSize = size * (integral ? 1.9 : 1.55);
      const glyph = textBox(env, node.sym, glyphSize, 'roman');
      const axis = size * 0.28;
      const shift = glyphSize * (integral ? 0.28 : 0.34) - axis;
      const g = { w: glyph.w, a: Math.max(size, glyphSize * 0.74 - shift), d: Math.max(size * 0.4, glyphSize * 0.26 + shift) };
      const small = size * 0.7;
      const sup = node.sup ? layout(node.sup, env, small) : null;
      const sub = node.sub ? layout(node.sub, env, small) : null;
      if (node.limits) {
        const w = Math.max(g.w, sup?.w ?? 0, sub?.w ?? 0) + size * 0.1;
        const gp = size * 0.1;
        return {
          w,
          a: g.a + (sup ? sup.a + sup.d + gp : 0),
          d: g.d + (sub ? sub.a + sub.d + gp : 0),
          draw: (x, y) =>
            glyph.draw(x + (w - g.w) / 2, y + shift) +
            (sup ? sup.draw(x + (w - sup.w) / 2, y - g.a - gp - sup.d) : '') +
            (sub ? sub.draw(x + (w - sub.w) / 2, y + g.d + gp + sub.a) : ''),
        };
      }
      const lw = Math.max(sup?.w ?? 0, sub?.w ?? 0);
      const slant = size * 0.18;
      return {
        w: g.w + lw + slant,
        a: Math.max(g.a, sup ? g.a * 0.85 + sup.a : 0),
        d: Math.max(g.d, sub ? g.d * 0.85 + sub.d : 0),
        draw: (x, y) =>
          glyph.draw(x, y + shift) + (sup ? sup.draw(x + g.w + slant, y - g.a * 0.8) : '') + (sub ? sub.draw(x + g.w - slant * 0.3, y + g.d * 0.85) : ''),
      };
    }
    case 'fence': {
      const body = layout(node.body, env, size);
      const h = Math.max(size * 1.1, body.a + body.d + size * 0.15);
      const k = h / (size * 1.1);
      const dw = size * (0.3 + Math.min(0.2, (k - 1) * 0.05));
      const delim = (ch: string): string => (ch === '.' ? '' : ch);
      const mid = (body.a - body.d) / 2;
      const one = (ch: string, x: number, y: number): string => {
        const c = delim(ch);
        if (!c) return '';
        const cy = y - mid;
        if (c === '|' || c === '‖') {
          const xs = c === '|' ? [x + dw / 2] : [x + dw / 2 - size * 0.05, x + dw / 2 + size * 0.05];
          return xs.map((xx) => `<line x1="${n2(xx)}" y1="${n2(cy - h / 2)}" x2="${n2(xx)}" y2="${n2(cy + h / 2)}" stroke="${env.color}" stroke-width="${n2(Math.max(0.8, size * 0.055))}"/>`).join('');
        }
        // Delimiteur etire en hauteur : glyphe agrandi verticalement autour du centre de la formule.
        return `<text transform="translate(${n2(x)} ${n2(cy + size * 0.3 * k)}) scale(1 ${n2(k)})" x="0" y="0" font-size="${n2(size * 1.1)}">${esc(c)}</text>`;
      };
      return {
        w: body.w + 2 * dw,
        a: Math.max(body.a, h / 2 + mid),
        d: Math.max(body.d, h / 2 - mid),
        draw: (x, y) => one(node.open, x, y) + body.draw(x + dw, y) + one(node.close, x + dw + body.w, y),
      };
    }
    case 'accent': {
      const body = layout(node.body, env, size);
      const th = Math.max(0.8, size * 0.055);
      const top = body.a + size * 0.1;
      return {
        w: body.w,
        a: top + size * 0.12,
        d: body.d,
        draw: (x, y) => {
          const cx = x + body.w / 2;
          if (node.kind === 'bar') return body.draw(x, y) + `<rect x="${n2(x)}" y="${n2(y - top - th)}" width="${n2(body.w)}" height="${n2(th)}"/>`;
          const glyph = node.kind === 'hat' ? '^' : '→';
          return body.draw(x, y) + `<text x="${n2(cx - size * 0.15)}" y="${n2(y - top + size * 0.35)}" font-size="${n2(size * 0.6)}">${glyph}</text>`;
        },
      };
    }
  }
}

/** Rend une equation en SVG (la saisie vide donne une erreur). `size` en points ; `color` en CSS. */
export function renderEquation(source: string, options: { size?: number; color?: string; measure?: TextMeasure } = {}): EquationSvg {
  const src = source.trim();
  if (!src) throw new EquationError('L’équation est vide.');
  if (src.length > 2000) throw new EquationError('L’équation est trop longue (2 000 caractères au plus).');
  const size = Math.min(200, Math.max(8, options.size ?? 28));
  const color = options.color && /^#[0-9a-f]{3,8}$/i.test(options.color) ? options.color : '#000000';
  const tree = new Parser(src).parse();
  const box = layout(tree, { measure: options.measure, color }, size);
  const pad = size * 0.2;
  const width = Math.ceil(box.w + 2 * pad);
  const height = Math.ceil(box.a + box.d + 2 * pad);
  const body = box.draw(pad, pad + box.a);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT.replace(/"/g, "'")}" fill="${color}">${body}</svg>`;
  return { svg, width, height };
}

/** Modeles proposes dans le dialogue (libelle, saisie). */
export const EQUATION_TEMPLATES: ReadonlyArray<{ label: string; source: string }> = [
  { label: 'Fraction', source: '\\frac{a}{b}' },
  { label: 'Exposant', source: 'x^{2}' },
  { label: 'Indice', source: 'x_{i}' },
  { label: 'Racine', source: '\\sqrt{x}' },
  { label: 'Somme', source: '\\sum_{i=1}^{n} i' },
  { label: 'Intégrale', source: '\\int_{0}^{1} f(x)\\,dx' },
  { label: 'Quadratique', source: 'x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}' },
  { label: 'Pythagore', source: 'a^{2} + b^{2} = c^{2}' },
  { label: 'Limite', source: '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1' },
  { label: 'Parenthèses', source: '\\left( \\frac{a}{b} \\right)^{2}' },
];
