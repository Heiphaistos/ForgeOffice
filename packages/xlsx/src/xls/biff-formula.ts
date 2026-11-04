// Formules BIFF8 (jetons « ptg » en notation polonaise inverse) -> formule Excel canonique sans « = ».
// Jeton non pris en charge (tables de donnees, macros, classeurs externes) : undefined, seule la valeur est gardee.
import { columnName } from '../address.ts';
import { fromFileFormula } from '../xlsx/formula-names.ts';
import { BIFF_FUNCTIONS } from './biff-functions.ts';

export const BIFF_ERRORS: Readonly<Record<number, string>> = {
  0x00: '#NULL!', 0x07: '#DIV/0!', 0x0f: '#VALUE!', 0x17: '#REF!', 0x1d: '#NAME?', 0x24: '#NUM!', 0x2a: '#N/A', 0x2b: '#GETTING_DATA',
};

const BINARY: Readonly<Record<number, string>> = {
  0x03: '+', 0x04: '-', 0x05: '*', 0x06: '/', 0x07: '^', 0x08: '&', 0x09: '<', 0x0a: '<=', 0x0b: '=', 0x0c: '>=', 0x0d: '>',
  0x0e: '<>', 0x0f: ' ', 0x10: ',', 0x11: ':',
};

export interface FormulaContext {
  /** Cellule de la formule (references relatives des formules partagees). */
  row: number;
  col: number;
  /** Nom de feuille (deja cite si besoin) d'une entree EXTERNSHEET ; undefined = externe/inconnu. */
  sheetRef: (ixti: number) => string | undefined;
  /** Nom defini (index a partir de 1). */
  name: (index: number) => string | undefined;
  /** Nom externe (fonctions de complement, « _xlfn. ») d'une entree EXTERNSHEET. */
  externName: (ixti: number, index: number) => string | undefined;
}

/** Resultat : texte de la formule, ou reference de la cellule maitre (formule partagee / matricielle). */
export type DecodedFormula = { text: string } | { exp: { row: number; col: number } } | undefined;

class Unsupported extends Error {}

function cellRef(rw: number, colField: number, ctx: FormulaContext | undefined): string {
  const rowRel = (colField & 0x8000) !== 0;
  const colRel = (colField & 0x4000) !== 0;
  let row = rw;
  let col = colField & 0x3fff;
  if (ctx) {
    // Formules partagees (ptgRefN) : decalages signes par rapport a la cellule.
    if (rowRel) row = (ctx.row + ((rw << 16) >> 16)) & 0xffff;
    if (colRel) col = (ctx.col + ((col << 24) >> 24)) & 0xff;
  }
  return `${colRel ? '' : '$'}${columnName(col)}${rowRel ? '' : '$'}${row + 1}`;
}

function areaRef(r1: number, r2: number, c1: number, c2: number, ctx: FormulaContext | undefined): string {
  const colRel = (f: number): string => ((f & 0x4000) !== 0 ? '' : '$');
  const rowRel = (f: number): string => ((f & 0x8000) !== 0 ? '' : '$');
  if (!ctx && r1 === 0 && r2 === 0xffff) return `${colRel(c1)}${columnName(c1 & 0x3fff)}:${colRel(c2)}${columnName(c2 & 0x3fff)}`;
  if (!ctx && (c1 & 0x3fff) === 0 && (c2 & 0x3fff) === 0xff) return `${rowRel(c1)}${r1 + 1}:${rowRel(c2)}${r2 + 1}`;
  return `${cellRef(r1, c1, ctx)}:${cellRef(r2, c2, ctx)}`;
}

function formatNumber(n: number): string {
  return String(n).toUpperCase();
}

function readString(data: Uint8Array, view: DataView, offset: number, cch: number): { text: string; next: number } {
  const wide = (view.getUint8(offset) & 1) !== 0;
  let p = offset + 1;
  let text = '';
  for (let i = 0; i < cch; i++) {
    if (p + (wide ? 2 : 1) > data.length) throw new Unsupported('chaine tronquee');
    text += String.fromCharCode(wide ? view.getUint16(p, true) : view.getUint8(p));
    p += wide ? 2 : 1;
  }
  return { text, next: p };
}

/** Constantes de matrice « {1,2;3,4} » lues dans les donnees supplementaires (rgcb). */
function readArray(extra: Uint8Array, view: DataView, start: number): { text: string; next: number } {
  if (start + 3 > extra.length) throw new Unsupported('matrice tronquee');
  const cols = view.getUint8(start) + 1;
  const rows = view.getUint16(start + 1, true) + 1;
  let p = start + 3;
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const items: string[] = [];
    for (let c = 0; c < cols; c++) {
      if (p + 1 > extra.length) throw new Unsupported('matrice tronquee');
      const kind = view.getUint8(p);
      p++;
      if (kind === 0x02) {
        const s = readString(extra, view, p + 2, view.getUint16(p, true));
        items.push(`"${s.text.replace(/"/g, '""')}"`);
        p = s.next;
        continue;
      }
      if (p + 8 > extra.length) throw new Unsupported('matrice tronquee');
      if (kind === 0x01) items.push(formatNumber(view.getFloat64(p, true)));
      else if (kind === 0x04) items.push(view.getUint8(p) ? 'TRUE' : 'FALSE');
      else if (kind === 0x10) items.push(BIFF_ERRORS[view.getUint8(p)] ?? '#N/A');
      else items.push('');
      p += 8;
    }
    lines.push(items.join(','));
  }
  return { text: `{${lines.join(';')}}`, next: p };
}

/**
 * Decode `rgce` (jetons) avec ses donnees supplementaires `extra` (matrices constantes).
 * `shared` = vrai pour une formule partagee (SHRFMLA) dont les references sont relatives a ctx.row/ctx.col.
 */
export function decodeFormula(rgce: Uint8Array, extra: Uint8Array, ctx: FormulaContext, shared = false): DecodedFormula {
  try {
    return decode(rgce, extra, ctx, shared);
  } catch (error) {
    if (error instanceof Unsupported || error instanceof RangeError) return undefined;
    throw error;
  }
}

function decode(rgce: Uint8Array, extra: Uint8Array, ctx: FormulaContext, shared: boolean): DecodedFormula {
  const view = new DataView(rgce.buffer, rgce.byteOffset, rgce.byteLength);
  const extraView = new DataView(extra.buffer, extra.byteOffset, extra.byteLength);
  let extraPos = 0;
  const stack: string[] = [];
  const pop = (): string => {
    const v = stack.pop();
    if (v === undefined) throw new Unsupported('pile vide');
    return v;
  };
  const sheet = (ixti: number): string => {
    const name = ctx.sheetRef(ixti);
    if (name === undefined) throw new Unsupported('reference externe');
    return name;
  };
  const relCtx = shared ? ctx : undefined;
  let p = 0;
  while (p < rgce.length) {
    const ptg = view.getUint8(p);
    p++;
    const id = ptg >= 0x20 ? (ptg & 0x1f) | 0x20 : ptg;
    const op = BINARY[id];
    if (op !== undefined) {
      const right = pop();
      const left = pop();
      stack.push(`${left}${op}${right}`);
      continue;
    }
    switch (id) {
      case 0x01: return { exp: { row: view.getUint16(p, true), col: view.getUint16(p + 2, true) } };
      case 0x12: stack.push(`+${pop()}`); break;
      case 0x13: stack.push(`-${pop()}`); break;
      case 0x14: stack.push(`${pop()}%`); break;
      case 0x15: stack.push(`(${pop()})`); break;
      case 0x16: stack.push(''); break;
      case 0x17: {
        const s = readString(rgce, view, p + 1, view.getUint8(p));
        stack.push(`"${s.text.replace(/"/g, '""')}"`);
        p = s.next;
        break;
      }
      case 0x19: {
        const flags = view.getUint8(p);
        const w = view.getUint16(p + 1, true);
        p += 3;
        if (flags & 0x04) p += (w + 1) * 2;
        if (flags & 0x10) stack.push(`SUM(${pop()})`);
        break;
      }
      case 0x1c: stack.push(BIFF_ERRORS[view.getUint8(p)] ?? '#N/A'); p += 1; break;
      case 0x1d: stack.push(view.getUint8(p) ? 'TRUE' : 'FALSE'); p += 1; break;
      case 0x1e: stack.push(String(view.getUint16(p, true))); p += 2; break;
      case 0x1f: stack.push(formatNumber(view.getFloat64(p, true))); p += 8; break;
      case 0x20: {
        const arr = readArray(extra, extraView, extraPos);
        extraPos = arr.next;
        stack.push(arr.text);
        p += 7;
        break;
      }
      case 0x21:
      case 0x22: {
        let argc: number;
        let index: number;
        if (id === 0x21) {
          index = view.getUint16(p, true);
          p += 2;
          const fixed = BIFF_FUNCTIONS.get(index)?.args;
          if (fixed === undefined) throw new Unsupported(`fonction ${index}`);
          argc = fixed;
        } else {
          argc = view.getUint8(p) & 0x7f;
          index = view.getUint16(p + 1, true);
          p += 3;
          if (index & 0x8000) throw new Unsupported('commande de macro');
        }
        const args: string[] = [];
        for (let i = 0; i < argc; i++) args.unshift(pop());
        if (index === 255) {
          const name = args.shift();
          if (name === undefined) throw new Unsupported('fonction de complement');
          stack.push(`${name}(${args.join(',')})`);
        } else {
          const fn = BIFF_FUNCTIONS.get(index);
          if (!fn) throw new Unsupported(`fonction ${index}`);
          stack.push(`${fn.name}(${args.join(',')})`);
        }
        break;
      }
      case 0x23: {
        const name = ctx.name(view.getUint32(p, true));
        if (name === undefined) throw new Unsupported('nom');
        stack.push(name);
        p += 4;
        break;
      }
      case 0x24: stack.push(cellRef(view.getUint16(p, true), view.getUint16(p + 2, true), undefined)); p += 4; break;
      case 0x25:
        stack.push(areaRef(view.getUint16(p, true), view.getUint16(p + 2, true), view.getUint16(p + 4, true), view.getUint16(p + 6, true), undefined));
        p += 8;
        break;
      case 0x26: {
        // ptgMemArea : la sous-expression suit ; ses zones precalculees sont dans rgcb.
        p += 6;
        const count = extraView.getUint16(extraPos, true);
        extraPos += 2 + count * 8;
        break;
      }
      case 0x27: case 0x28: p += 6; break;
      case 0x29: p += 2; break;
      case 0x2a: stack.push('#REF!'); p += 4; break;
      case 0x2b: stack.push('#REF!'); p += 8; break;
      case 0x2c: stack.push(cellRef(view.getUint16(p, true), view.getUint16(p + 2, true), relCtx)); p += 4; break;
      case 0x2d:
        stack.push(areaRef(view.getUint16(p, true), view.getUint16(p + 2, true), view.getUint16(p + 4, true), view.getUint16(p + 6, true), relCtx));
        p += 8;
        break;
      case 0x39: {
        const name = ctx.externName(view.getUint16(p, true), view.getUint32(p + 2, true));
        if (name === undefined) throw new Unsupported('nom externe');
        stack.push(name);
        p += 6;
        break;
      }
      case 0x3a:
        stack.push(`${sheet(view.getUint16(p, true))}!${cellRef(view.getUint16(p + 2, true), view.getUint16(p + 4, true), relCtx)}`);
        p += 6;
        break;
      case 0x3b:
        stack.push(`${sheet(view.getUint16(p, true))}!${areaRef(view.getUint16(p + 2, true), view.getUint16(p + 4, true), view.getUint16(p + 6, true), view.getUint16(p + 8, true), relCtx)}`);
        p += 10;
        break;
      case 0x3c: stack.push(`${sheet(view.getUint16(p, true))}!#REF!`); p += 6; break;
      case 0x3d: stack.push(`${sheet(view.getUint16(p, true))}!#REF!`); p += 10; break;
      default: throw new Unsupported(`jeton 0x${ptg.toString(16)}`);
    }
  }
  if (stack.length !== 1) throw new Unsupported('pile incoherente');
  return { text: fromFileFormula(stack[0] ?? '') };
}
