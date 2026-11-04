// Ecriture d'un arbre de formule ou d'une reference dans une syntaxe donnee.
import { MAX_COLS, MAX_ROWS, colToLetters, quoteSheetName, sheetNeedsQuotes } from '../refs.ts';
import type { Node, RefNode, TableNode } from './ast.ts';
import { CANONICAL, type FormulaSyntax } from './syntax.ts';

export function printNumber(v: number, syntax: FormulaSyntax): string {
  let s = String(v);
  if (s.includes('e')) s = s.toUpperCase();
  return syntax.decimal === '.' ? s : s.replace('.', syntax.decimal);
}

export function printString(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export function printSheetPrefix(sheet: string | undefined, sheet2: string | undefined, book: string | undefined): string {
  if (sheet === undefined) return '';
  const b = book ?? '';
  if (sheet2 !== undefined) {
    const quote = sheetNeedsQuotes(sheet) || sheetNeedsQuotes(sheet2) || b !== '';
    const body = `${b}${sheet}:${sheet2}`;
    return quote ? `'${body.replace(/'/g, "''")}'!` : `${body}!`;
  }
  if (b !== '') return `'${(b + sheet).replace(/'/g, "''")}'!`;
  return `${quoteSheetName(sheet)}!`;
}

/** Corps de la reference (sans feuille). */
export function printRefBody(r: RefNode): string {
  const d = (abs: boolean): string => (abs ? '$' : '');
  if (r.kind === 'cols' || (r.r1 === 0 && r.r2 === MAX_ROWS - 1 && r.kind !== 'cell')) {
    return `${d(r.ac1)}${colToLetters(r.c1)}:${d(r.ac2)}${colToLetters(r.c2)}`;
  }
  if (r.kind === 'rows' || (r.c1 === 0 && r.c2 === MAX_COLS - 1 && r.kind !== 'cell')) {
    return `${d(r.ar1)}${r.r1 + 1}:${d(r.ar2)}${r.r2 + 1}`;
  }
  const a = `${d(r.ac1)}${colToLetters(r.c1)}${d(r.ar1)}${r.r1 + 1}`;
  if (r.kind === 'cell') return a;
  return `${a}:${d(r.ac2)}${colToLetters(r.c2)}${d(r.ar2)}${r.r2 + 1}`;
}

export function printRef(r: RefNode): string {
  if (r.sheetError) return `#REF!${printRefBody(r)}`;
  return printSheetPrefix(r.sheet, r.sheet2, r.book) + printRefBody(r);
}

function escapeTableItem(s: string): string {
  return s.replace(/['#[\]@]/g, (m) => `'${m}`);
}

export function printTable(t: TableNode, syntax: FormulaSyntax): string {
  const simple = (s: string): boolean => /^[A-Za-z0-9_.À-￿]+$/.test(s);
  const thisRow = t.specials.length === 1 && t.specials[0] === '#This Row';
  if (thisRow && t.col2 === undefined) {
    if (t.col1 === undefined) return `${t.table}[@]`;
    return simple(t.col1) ? `${t.table}[@${t.col1}]` : `${t.table}[@[${escapeTableItem(t.col1)}]]`;
  }
  if (t.specials.length === 0 && t.col2 === undefined) {
    return t.col1 === undefined ? `${t.table}[]` : `${t.table}[${escapeTableItem(t.col1)}]`;
  }
  if (t.specials.length === 1 && t.col1 === undefined) {
    return `${t.table}[${syntax.tableOut(t.specials[0] ?? '#Data')}]`;
  }
  const items: string[] = t.specials.map((s) => `[${syntax.tableOut(s)}]`);
  if (t.col1 !== undefined) {
    let cols = `[${escapeTableItem(t.col1)}]`;
    if (t.col2 !== undefined) cols += `:[${escapeTableItem(t.col2)}]`;
    items.push(cols);
  }
  return `${t.table}[${items.join(syntax.argSep)}]`;
}

/** Ecrit l'arbre en texte de formule (sans '=' initial). */
export function printFormula(node: Node, syntax: FormulaSyntax = CANONICAL): string {
  const p = (n: Node): string => {
    switch (n.type) {
      case 'num':
        return printNumber(n.value, syntax);
      case 'str':
        return printString(n.value);
      case 'bool':
        return n.value ? syntax.trueName : syntax.falseName;
      case 'err':
        return syntax.errorOut(n.code);
      case 'ref':
        return printRef(n);
      case 'name':
        return n.sheet === undefined ? n.name : `${quoteSheetName(n.sheet)}!${n.name}`;
      case 'table':
        return printTable(n, syntax);
      case 'array':
        return `{${n.rows.map((r) => r.map(p).join(syntax.arrayCol)).join(syntax.arrayRow)}}`;
      case 'unary':
        return n.op + p(n.arg);
      case 'postfix':
        return p(n.arg) + n.op;
      case 'binary':
        return p(n.left) + (n.op === ',' ? syntax.argSep : n.op) + p(n.right);
      case 'paren':
        return `(${p(n.arg)})`;
      case 'call':
        return `${syntax.funcOut(n.name)}(${n.args.map(p).join(syntax.argSep)})`;
      case 'invoke':
        return `${p(n.callee)}(${n.args.map(p).join(syntax.argSep)})`;
      case 'missing':
        return '';
    }
  };
  return p(node);
}
