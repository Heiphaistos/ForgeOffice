// Analyseur syntaxique (Pratt) avec les priorites exactes d'Excel.
import { STRINGS } from '../strings.ts';
import type { BinaryOp, Node } from './ast.ts';
import { FormulaParseError, tokenize, type Token } from './lexer.ts';
import { CANONICAL, type FormulaSyntax } from './syntax.ts';

export const MAX_FORMULA_LENGTH = 8192;
const MAX_DEPTH = 200;
const MAX_ARGS = 255;

const BINARY_BP: Record<string, number> = {
  '=': 10,
  '<>': 10,
  '<': 10,
  '>': 10,
  '<=': 10,
  '>=': 10,
  '&': 20,
  '+': 30,
  '-': 30,
  '*': 40,
  '/': 40,
  '^': 50,
  ',': 80,
  ' ': 85,
  ':': 90,
};
const PERCENT_BP = 60;
const UNARY_BP = 55;
const AT_BP = 88;
const SPILL_BP = 95;

const OPERAND_END = new Set(['ref', 'name', 'table', ')']);
const OPERAND_START = new Set(['ref', 'name', 'table', '(', 'func']);

/** Convertit les espaces significatifs en operateur d'intersection et supprime les autres. */
function resolveWhitespace(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (!tk) continue;
    if (tk.t !== 'ws') {
      out.push(tk);
      continue;
    }
    const prev = out[out.length - 1];
    const next = tokens[i + 1];
    if (prev && next && OPERAND_END.has(prev.t) && OPERAND_START.has(next.t)) {
      out.push({ t: 'op', v: ' ', s: tk.s, e: tk.e });
    }
  }
  return out;
}

class Parser {
  private readonly toks: Token[];
  private pos = 0;
  private depth = 0;
  private allowUnion = true;
  private readonly srcLength: number;
  constructor(toks: Token[], srcLength: number) {
    this.toks = toks;
    this.srcLength = srcLength;
  }

  private peek(): Token | undefined {
    return this.toks[this.pos];
  }

  private fail(msg: string): never {
    const tk = this.peek();
    throw new FormulaParseError(msg, tk ? tk.s : this.srcLength);
  }

  private expect(t: Token['t']): Token {
    const tk = this.peek();
    if (!tk || tk.t !== t) this.fail(t === ')' ? STRINGS.parse.missingParen : STRINGS.parse.unexpectedToken);
    this.pos++;
    return tk;
  }

  parseAll(): Node {
    if (this.toks.length === 0) this.fail(STRINGS.parse.empty);
    const n = this.parseExpr(0);
    if (this.pos < this.toks.length) this.fail(STRINGS.parse.unexpectedToken);
    return n;
  }

  private parseExpr(minBp: number): Node {
    if (++this.depth > MAX_DEPTH) this.fail(STRINGS.parse.tooDeep);
    let left = this.parsePrefix();
    for (;;) {
      const tk = this.peek();
      if (!tk) break;
      if (tk.t === 'op') {
        if (tk.v === '%') {
          if (PERCENT_BP < minBp) break;
          this.pos++;
          left = { type: 'postfix', op: '%', arg: left };
          continue;
        }
        if (tk.v === '#') {
          if (SPILL_BP < minBp) break;
          this.pos++;
          left = { type: 'postfix', op: '#', arg: left };
          continue;
        }
        const bp = BINARY_BP[tk.v];
        if (bp === undefined || bp < minBp) break;
        this.pos++;
        const right = this.parseExpr(bp + 1);
        left = { type: 'binary', op: tk.v as BinaryOp, left, right };
        continue;
      }
      if (tk.t === 'sep' && this.allowUnion) {
        const bp = BINARY_BP[','] ?? 80;
        if (bp < minBp) break;
        this.pos++;
        const right = this.parseExpr(bp + 1);
        left = { type: 'binary', op: ',', left, right };
        continue;
      }
      if (tk.t === '(' && (left.type === 'call' || left.type === 'invoke' || left.type === 'paren' || left.type === 'name')) {
        // Appel direct d'une LAMBDA : LAMBDA(x;x+1)(2)
        if (minBp > SPILL_BP) break;
        this.pos++;
        left = { type: 'invoke', callee: left, args: this.parseArgs() };
        continue;
      }
      break;
    }
    this.depth--;
    return left;
  }

  private parseArgs(): Node[] {
    const saved = this.allowUnion;
    this.allowUnion = false;
    const args: Node[] = [];
    if (this.peek()?.t === ')') {
      this.pos++;
      this.allowUnion = saved;
      return args;
    }
    for (;;) {
      const tk = this.peek();
      if (!tk) this.fail(STRINGS.parse.missingParen);
      if (tk.t === 'sep' || tk.t === ')') args.push({ type: 'missing' });
      else args.push(this.parseExpr(0));
      if (args.length > MAX_ARGS) this.fail(STRINGS.parse.tooManyArgs);
      const nx = this.peek();
      if (!nx) this.fail(STRINGS.parse.missingParen);
      if (nx.t === 'sep') {
        this.pos++;
        continue;
      }
      if (nx.t === ')') {
        this.pos++;
        break;
      }
      this.fail(STRINGS.parse.unexpectedToken);
    }
    this.allowUnion = saved;
    return args;
  }

  private parsePrefix(): Node {
    const tk = this.peek();
    if (!tk) this.fail(STRINGS.parse.unexpectedEnd);
    this.pos++;
    switch (tk.t) {
      case 'num':
        return { type: 'num', value: tk.v };
      case 'str':
        return { type: 'str', value: tk.v };
      case 'bool':
        return { type: 'bool', value: tk.v };
      case 'err':
        return { type: 'err', code: tk.v };
      case 'ref':
        return { ...tk.ref };
      case 'table':
        return { ...tk.table, specials: [...tk.table.specials] };
      case 'name':
        return tk.sheet === undefined ? { type: 'name', name: tk.v } : { type: 'name', name: tk.v, sheet: tk.sheet };
      case 'func': {
        this.expect('(');
        return { type: 'call', name: tk.v, args: this.parseArgs() };
      }
      case '(': {
        const saved = this.allowUnion;
        this.allowUnion = true;
        const inner = this.parseExpr(0);
        this.allowUnion = saved;
        this.expect(')');
        return { type: 'paren', arg: inner };
      }
      case '{':
        return this.parseArray();
      case 'op': {
        if (tk.v === '-' || tk.v === '+') return { type: 'unary', op: tk.v, arg: this.parseExpr(UNARY_BP) };
        if (tk.v === '@') return { type: 'unary', op: '@', arg: this.parseExpr(AT_BP) };
        return this.fail(STRINGS.parse.unexpectedToken);
      }
      default:
        this.pos--;
        return this.fail(STRINGS.parse.unexpectedToken);
    }
  }

  private parseArray(): Node {
    const rows: Node[][] = [[]];
    for (;;) {
      const tk = this.peek();
      if (!tk) this.fail(STRINGS.parse.badArray);
      this.pos++;
      let sign = 1;
      let cur: Token | undefined = tk;
      if (cur.t === 'op' && (cur.v === '-' || cur.v === '+')) {
        sign = cur.v === '-' ? -1 : 1;
        cur = this.peek();
        if (!cur || cur.t !== 'num') this.fail(STRINGS.parse.badArray);
        this.pos++;
      }
      const row = rows[rows.length - 1] ?? [];
      switch (cur.t) {
        case 'num':
          row.push({ type: 'num', value: sign * cur.v });
          break;
        case 'str':
          row.push({ type: 'str', value: cur.v });
          break;
        case 'bool':
          row.push({ type: 'bool', value: cur.v });
          break;
        case 'err':
          row.push({ type: 'err', code: cur.v });
          break;
        default:
          this.fail(STRINGS.parse.badArray);
      }
      const sep = this.peek();
      if (!sep) this.fail(STRINGS.parse.badArray);
      this.pos++;
      if (sep.t === '}') break;
      if (sep.t === 'acol') continue;
      if (sep.t === 'arow') {
        rows.push([]);
        continue;
      }
      this.fail(STRINGS.parse.badArray);
    }
    const w = rows[0]?.length ?? 0;
    if (rows.some((r) => r.length !== w)) this.fail(STRINGS.parse.badArray);
    return { type: 'array', rows };
  }
}

/** Retire le '=' initial eventuel. */
export function stripEquals(formula: string): string {
  return formula.startsWith('=') ? formula.slice(1) : formula;
}

/** Analyse une formule (avec ou sans '=' initial) dans la syntaxe donnee (canonique par defaut). */
export function parseFormula(formula: string, syntax: FormulaSyntax = CANONICAL): Node {
  const src = stripEquals(formula);
  if (src.length > MAX_FORMULA_LENGTH) throw new FormulaParseError(STRINGS.parse.tooLong, MAX_FORMULA_LENGTH);
  const toks = resolveWhitespace(tokenize(src, syntax));
  return new Parser(toks, src.length).parseAll();
}
