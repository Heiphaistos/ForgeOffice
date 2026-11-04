// Fonctions texte (y compris TEXTE.AVANT/APRES, FRACTIONNER.TEXTE, REGEX.*).
import { MAX_TEXT, deref, forEachValue, scalarToText, textToNumber, toBool, toMatrix, toNumber, toScalar, toText } from '../eval/coerce.ts';
import { MAX_WILDCARD, wildcardMatcher } from '../eval/wildcard.ts';
import type { EvalContext } from '../eval/types.ts';
import { formatCodeFromLocale } from '../format/codes.ts';
import { localeData } from '../format/locale.ts';
import { formatValue } from '../format/render.ts';
import { CANONICAL, FRENCH } from '../parse/syntax.ts';
import { printNumber, printString } from '../parse/printer.ts';
import { ERR, FormulaError, Matrix, type Scalar } from '../values.ts';
import { roundHalfAway } from './numeric.ts';
import { alias, define, textFn, type Arg } from './registry.ts';
import { regexFor } from './safe-regex.ts';

const T = 'text' as const;

const CP1252_HIGH = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ';

function limit(s: string): string | FormulaError {
  return s.length > MAX_TEXT ? ERR.VALUE : s;
}

function optNum(a: Arg, def: number, ctx: EvalContext): number | FormulaError {
  return a === undefined || a === null ? def : toNumber(a, ctx);
}

define(T, 'CHAR', { min: 1 }, ([a], ctx) => {
  const n = toNumber(a, ctx);
  if (n instanceof FormulaError) return n;
  const k = Math.trunc(n);
  if (k < 1 || k > 255) return ERR.VALUE;
  return k >= 128 && k < 160 ? (CP1252_HIGH[k - 128] ?? '') : String.fromCharCode(k);
});
textFn(T, 'CODE', 1, 1, ([s = '']) => {
  if (s === '') return ERR.VALUE;
  const ch = s[0] ?? '';
  const c = ch.charCodeAt(0);
  if (c < 128 || (c >= 160 && c < 256)) return c;
  const i = CP1252_HIGH.indexOf(ch);
  return i >= 0 ? 128 + i : 63;
});
define(T, 'UNICHAR', { min: 1 }, ([a], ctx) => {
  const n = toNumber(a, ctx);
  if (n instanceof FormulaError) return n;
  const k = Math.trunc(n);
  if (k < 1 || k > 0x10ffff || (k >= 0xd800 && k <= 0xdfff)) return ERR.VALUE;
  return String.fromCodePoint(k);
});
textFn(T, 'UNICODE', 1, 1, ([s = '']) => (s === '' ? ERR.VALUE : (s.codePointAt(0) ?? 0)));
textFn(T, 'CLEAN', 1, 1, ([s = '']) => s.replace(/[\u0000-\u001F]/g, ''));
textFn(T, 'TRIM', 1, 1, ([s = '']) => s.replace(/^ +| +$/g, '').replace(/ {2,}/g, ' '));
textFn(T, 'LOWER', 1, 1, ([s = '']) => s.toLowerCase());
textFn(T, 'UPPER', 1, 1, ([s = '']) => s.toUpperCase());
textFn(T, 'PROPER', 1, 1, ([s = '']) =>
  s.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_m, p: string, l: string) => p + l.toUpperCase()),
);
textFn(T, 'LEN', 1, 1, ([s = '']) => s.length);
alias('LENB', 'LEN');
textFn(T, 'EXACT', 2, 2, ([a = '', b = '']) => a === b);
textFn(T, 'CONCATENATE', 1, 255, (ss) => limit(ss.join('')));
define(T, 'T', { min: 1 }, ([a], ctx) => {
  const v = toScalar(a, ctx);
  return typeof v === 'string' || v instanceof FormulaError ? v : '';
});

function joinValues(args: Arg[], ctx: EvalContext, sep: string[] | undefined, ignoreEmpty: boolean): string | FormulaError {
  let out = '';
  let n = 0;
  let error: FormulaError | undefined;
  for (const a of args) {
    forEachValue(a, ctx, (v) => {
      if (v instanceof FormulaError) {
        error = v;
        return true;
      }
      const s = scalarToText(v, ctx);
      if (s instanceof FormulaError) {
        error = s;
        return true;
      }
      if (ignoreEmpty && s === '') return false;
      if (n > 0 && sep && sep.length > 0) out += sep[(n - 1) % sep.length] ?? '';
      out += s;
      n++;
      if (out.length > MAX_TEXT) {
        error = ERR.VALUE;
        return true;
      }
      return false;
    });
    if (error) return error;
  }
  return out;
}

define(T, 'CONCAT', { min: 1, max: 255, kinds: 'R' }, (args, ctx) => joinValues(args, ctx, undefined, false));
define(T, 'TEXTJOIN', { min: 3, max: 255, kinds: 'VSR' }, ([d, ig, ...rest], ctx) => {
  const dm = toMatrix(d, ctx);
  if (dm instanceof FormulaError) return dm;
  const seps: string[] = [];
  for (const v of dm.data) {
    const s = scalarToText(v, ctx);
    if (s instanceof FormulaError) return s;
    seps.push(s);
  }
  const ignore = toBool(ig, ctx);
  if (ignore instanceof FormulaError) return ignore;
  return joinValues(rest, ctx, seps, ignore);
});

function findImpl(caseSensitive: boolean) {
  return ([f, w, st]: Arg[], ctx: EvalContext): Scalar => {
    const find = toText(f, ctx);
    const within = toText(w, ctx);
    if (find instanceof FormulaError) return find;
    if (within instanceof FormulaError) return within;
    const start = optNum(st, 1, ctx);
    if (start instanceof FormulaError) return start;
    const s = Math.trunc(start);
    if (s < 1 || s > within.length + (find === '' ? 1 : 0)) return ERR.VALUE;
    if (find === '') return s;
    if (caseSensitive) {
      const i = within.indexOf(find, s - 1);
      return i < 0 ? ERR.VALUE : i + 1;
    }
    if (find.length > MAX_WILDCARD) return ERR.VALUE;
    const at = wildcardMatcher(find).search(within.slice(s - 1));
    return at < 0 ? ERR.VALUE : at + s;
  };
}
define(T, 'FIND', { min: 2, max: 3 }, findImpl(true));
define(T, 'SEARCH', { min: 2, max: 3 }, findImpl(false));
alias('FINDB', 'FIND');
alias('SEARCHB', 'SEARCH');

define(T, 'LEFT', { min: 1, max: 2 }, ([a, n], ctx) => {
  const s = toText(a, ctx);
  if (s instanceof FormulaError) return s;
  const k = optNum(n, 1, ctx);
  if (k instanceof FormulaError) return k;
  return k < 0 ? ERR.VALUE : s.slice(0, Math.trunc(k));
});
define(T, 'RIGHT', { min: 1, max: 2 }, ([a, n], ctx) => {
  const s = toText(a, ctx);
  if (s instanceof FormulaError) return s;
  const k = optNum(n, 1, ctx);
  if (k instanceof FormulaError) return k;
  if (k < 0) return ERR.VALUE;
  const t = Math.trunc(k);
  return t === 0 ? '' : s.slice(-t);
});
define(T, 'MID', { min: 3, max: 3 }, ([a, st, n], ctx) => {
  const s = toText(a, ctx);
  if (s instanceof FormulaError) return s;
  const b = toNumber(st, ctx);
  if (b instanceof FormulaError) return b;
  const k = toNumber(n, ctx);
  if (k instanceof FormulaError) return k;
  if (b < 1 || k < 0) return ERR.VALUE;
  return s.substr(Math.trunc(b) - 1, Math.trunc(k));
});
alias('LEFTB', 'LEFT');
alias('RIGHTB', 'RIGHT');
alias('MIDB', 'MID');
define(T, 'REPLACE', { min: 4, max: 4 }, ([a, st, n, nw], ctx) => {
  const s = toText(a, ctx);
  const r = toText(nw, ctx);
  const b = toNumber(st, ctx);
  const k = toNumber(n, ctx);
  if (s instanceof FormulaError) return s;
  if (r instanceof FormulaError) return r;
  if (b instanceof FormulaError) return b;
  if (k instanceof FormulaError) return k;
  if (b < 1 || k < 0) return ERR.VALUE;
  const i = Math.trunc(b) - 1;
  return limit(s.slice(0, i) + r + s.slice(i + Math.trunc(k)));
});
alias('REPLACEB', 'REPLACE');
define(T, 'SUBSTITUTE', { min: 3, max: 4 }, ([a, o, nw, inst], ctx) => {
  const s = toText(a, ctx);
  const old = toText(o, ctx);
  const rep = toText(nw, ctx);
  if (s instanceof FormulaError) return s;
  if (old instanceof FormulaError) return old;
  if (rep instanceof FormulaError) return rep;
  if (old === '') return s;
  if (inst === undefined || inst === null) return limit(s.split(old).join(rep));
  const k = toNumber(inst, ctx);
  if (k instanceof FormulaError) return k;
  const nth = Math.trunc(k);
  if (nth < 1) return ERR.VALUE;
  let idx = -1;
  for (let i = 0; i < nth; i++) {
    idx = s.indexOf(old, idx + 1);
    if (idx < 0) return s;
  }
  return limit(s.slice(0, idx) + rep + s.slice(idx + old.length));
});
define(T, 'REPT', { min: 2, max: 2 }, ([a, n], ctx) => {
  const s = toText(a, ctx);
  const k = toNumber(n, ctx);
  if (s instanceof FormulaError) return s;
  if (k instanceof FormulaError) return k;
  if (k < 0 || s.length * Math.trunc(k) > MAX_TEXT) return ERR.VALUE;
  return s.repeat(Math.trunc(k));
});

// ---------- Conversions ----------

define(T, 'TEXT', { min: 2, max: 2 }, ([v, f], ctx) => {
  const val = toScalar(v, ctx);
  const code = toText(f, ctx);
  if (val instanceof FormulaError) return val;
  if (code instanceof FormulaError) return code;
  let x: Scalar = val;
  if (typeof val === 'string') {
    const n = textToNumber(val, ctx);
    if (n !== undefined) x = n;
  }
  if (typeof x === 'boolean') return scalarToText(x, ctx);
  return formatValue(x, formatCodeFromLocale(code, ctx.wb.locale), ctx.wb.locale, { dateSystem: ctx.wb.dateSystem });
});
define(T, 'VALUE', { min: 1 }, ([a], ctx) => {
  const v = toScalar(a, ctx);
  if (typeof v === 'number' || v instanceof FormulaError) return v;
  if (v === null) return 0;
  if (typeof v === 'boolean') return ERR.VALUE;
  const n = textToNumber(v, ctx);
  return n === undefined ? ERR.VALUE : n;
});
define(T, 'NUMBERVALUE', { min: 1, max: 3 }, ([a, d, g], ctx) => {
  const s = toText(a, ctx);
  if (s instanceof FormulaError) return s;
  const l = localeData(ctx.wb.locale);
  const dec = d === undefined || d === null ? l.decimal : toText(d, ctx);
  const grp = g === undefined || g === null ? l.group : toText(g, ctx);
  if (dec instanceof FormulaError) return dec;
  if (grp instanceof FormulaError) return grp;
  const ds = dec.charAt(0);
  const gs = grp.charAt(0);
  if (ds === '' || ds === gs) return ERR.VALUE;
  let t = s.replace(/\s/g, '');
  if (t === '') return 0;
  let pct = 0;
  while (t.endsWith('%')) {
    pct++;
    t = t.slice(0, -1);
  }
  const di = t.indexOf(ds);
  if (di >= 0 && t.indexOf(gs, di) >= 0 && gs !== '') return ERR.VALUE;
  t = t.split(gs === '' ? '\u0000' : gs).join('');
  if (t.split(ds).length > 2) return ERR.VALUE;
  t = t.replace(ds, '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return ERR.VALUE;
  return Number(t) / 100 ** pct;
});

function groupedFixed(n: number, decimals: number, grouping: boolean, ctx: EvalContext): string {
  const code = `${grouping ? '#,##0' : '0'}${decimals > 0 ? `.${'0'.repeat(decimals)}` : ''}`;
  return formatValue(n, code, ctx.wb.locale);
}

define(T, 'FIXED', { min: 1, max: 3 }, ([a, d, nc], ctx) => {
  const n = toNumber(a, ctx);
  if (n instanceof FormulaError) return n;
  const dd = optNum(d, 2, ctx);
  if (dd instanceof FormulaError) return dd;
  const noCommas = nc === undefined || nc === null ? false : toBool(nc, ctx);
  if (noCommas instanceof FormulaError) return noCommas;
  const decimals = Math.trunc(dd);
  if (decimals > 127) return ERR.VALUE;
  return groupedFixed(roundHalfAway(n, decimals), Math.max(0, Math.min(decimals, 30)), !noCommas, ctx);
});
define(T, 'DOLLAR', { min: 1, max: 2 }, ([a, d], ctx) => {
  const n = toNumber(a, ctx);
  if (n instanceof FormulaError) return n;
  const dd = optNum(d, 2, ctx);
  if (dd instanceof FormulaError) return dd;
  const decimals = Math.trunc(dd);
  const x = roundHalfAway(n, decimals);
  const dec = decimals > 0 ? `.${'0'.repeat(Math.min(decimals, 30))}` : '';
  const code = ctx.wb.locale === 'fr-FR' ? `#,##0${dec} €;-#,##0${dec} €` : `$#,##0${dec};($#,##0${dec})`;
  return formatValue(x, code, ctx.wb.locale);
});

function valueText(v: Scalar, strict: boolean, ctx: EvalContext): string | FormulaError {
  if (v instanceof FormulaError) return ctx.wb.locale === 'fr-FR' ? FRENCH.errorOut(v.code) : v.code;
  if (typeof v === 'string') return strict ? printString(v) : v;
  if (typeof v === 'number' && strict) return printNumber(v, ctx.wb.locale === 'fr-FR' ? FRENCH : CANONICAL);
  return scalarToText(v, ctx);
}
define(T, 'VALUETOTEXT', { min: 1, max: 2 }, ([a, f], ctx) => {
  const fm = optNum(f, 0, ctx);
  if (fm instanceof FormulaError) return fm;
  if (fm !== 0 && fm !== 1) return ERR.VALUE;
  return valueText(toScalar(a, ctx), fm === 1, ctx);
});
define(T, 'ARRAYTOTEXT', { min: 1, max: 2, kinds: 'VS' }, ([a, f], ctx) => {
  const m = toMatrix(a, ctx);
  if (m instanceof FormulaError) return m;
  const fm = optNum(f, 0, ctx);
  if (fm instanceof FormulaError) return fm;
  if (fm !== 0 && fm !== 1) return ERR.VALUE;
  const syn = ctx.wb.locale === 'fr-FR' ? FRENCH : CANONICAL;
  const cell = (v: Scalar): string => {
    const t = valueText(v, fm === 1, ctx);
    return t instanceof FormulaError ? t.code : t;
  };
  if (fm === 0) return limit(m.data.map(cell).join(ctx.wb.locale === 'fr-FR' ? '; ' : ', '));
  const rows = m.to2D().map((r) => r.map(cell).join(syn.arrayCol));
  return limit(`{${rows.join(syn.arrayRow)}}`);
});

// ---------- TEXTE.AVANT, TEXTE.APRES, FRACTIONNER.TEXTE ----------

function delimiters(a: Arg, ctx: EvalContext): string[] | FormulaError {
  const m = toMatrix(a, ctx);
  if (m instanceof FormulaError) return m;
  const out: string[] = [];
  for (const v of m.data) {
    const s = scalarToText(v, ctx);
    if (s instanceof FormulaError) return s;
    out.push(s);
  }
  return out;
}

/** Positions [debut, fin) de chaque occurrence d'un des delimiteurs. */
function occurrences(text: string, delims: string[], ci: boolean): [number, number][] {
  const hay = ci ? text.toLowerCase() : text;
  const ds = delims.map((d) => (ci ? d.toLowerCase() : d));
  const out: [number, number][] = [];
  let i = 0;
  while (i <= hay.length) {
    let best: [number, number] | undefined;
    for (const d of ds) {
      if (d === '') continue;
      const k = hay.indexOf(d, i);
      if (k >= 0 && (!best || k < best[0] || (k === best[0] && d.length > best[1] - best[0]))) best = [k, k + d.length];
    }
    if (!best) break;
    out.push(best);
    i = best[1];
  }
  return out;
}

function textAround(after: boolean) {
  return (args: Arg[], ctx: EvalContext): Scalar => {
    const [a, d, inst, mode, end, nf] = args;
    const text = toText(a, ctx);
    if (text instanceof FormulaError) return text;
    const ds = delimiters(d, ctx);
    if (ds instanceof FormulaError) return ds;
    const n = optNum(inst, 1, ctx);
    const mm = optNum(mode, 0, ctx);
    const me = optNum(end, 0, ctx);
    if (n instanceof FormulaError) return n;
    if (mm instanceof FormulaError) return mm;
    if (me instanceof FormulaError) return me;
    const k = Math.trunc(n);
    if (k === 0 || Math.abs(k) > text.length + 1) return ERR.VALUE;
    const notFound = (): Scalar => (nf === undefined ? ERR.NA : toScalar(nf, ctx));
    if (ds.every((x) => x === '')) return after ? (k > 0 ? text : '') : k > 0 ? '' : text;
    const occ = occurrences(text, ds, mm === 1);
    if (me) {
      if (k > 0) occ.push([text.length, text.length]);
      else occ.unshift([0, 0]);
    }
    const idx = k > 0 ? k - 1 : occ.length + k;
    const hit = occ[idx];
    if (idx < 0 || !hit) return notFound();
    return after ? text.slice(hit[1]) : text.slice(0, hit[0]);
  };
}
define(T, 'TEXTBEFORE', { min: 2, max: 6, kinds: 'SVSSSS' }, textAround(false));
define(T, 'TEXTAFTER', { min: 2, max: 6, kinds: 'SVSSSS' }, textAround(true));

define(T, 'TEXTSPLIT', { min: 2, max: 6, kinds: 'SVVSSS' }, ([a, cd, rd, ig, mode, pad], ctx) => {
  const text = toText(a, ctx);
  if (text instanceof FormulaError) return text;
  const cols = cd === undefined || cd === null ? [] : delimiters(cd, ctx);
  const rows = rd === undefined || rd === null ? [] : delimiters(rd, ctx);
  if (cols instanceof FormulaError) return cols;
  if (rows instanceof FormulaError) return rows;
  if (cols.every((x) => x === '') && rows.every((x) => x === '')) return ERR.VALUE;
  const ignore = ig === undefined || ig === null ? false : toBool(ig, ctx);
  if (ignore instanceof FormulaError) return ignore;
  const ci = optNum(mode, 0, ctx);
  if (ci instanceof FormulaError) return ci;
  const split = (s: string, ds: string[]): string[] => {
    if (ds.length === 0) return [s];
    const occ = occurrences(s, ds, ci === 1);
    const parts: string[] = [];
    let last = 0;
    for (const [b, e] of occ) {
      parts.push(s.slice(last, b));
      last = e;
    }
    parts.push(s.slice(last));
    return ignore ? parts.filter((p) => p !== '') : parts;
  };
  const lines = split(text, rows).map((r) => split(r, cols));
  const width = Math.max(1, ...lines.map((r) => r.length));
  const padValue: Scalar = pad === undefined ? ERR.NA : toScalar(pad, ctx);
  const data: Scalar[] = [];
  for (const r of lines) for (let c = 0; c < width; c++) data.push(c < r.length ? (r[c] ?? '') : padValue);
  return lines.length === 0 ? ERR.CALC : new Matrix(lines.length, width, data);
});

// ---------- Expressions regulieres (motifs verifies par safe-regex.ts) ----------

function regexArgs(a: Arg, p: Arg, cs: Arg, ctx: EvalContext): { text: string; pattern: string; ci: boolean } | FormulaError {
  const text = toText(a, ctx);
  const pattern = toText(p, ctx);
  if (text instanceof FormulaError) return text;
  if (pattern instanceof FormulaError) return pattern;
  const c = optNum(cs, 0, ctx);
  if (c instanceof FormulaError) return c;
  if (c !== 0 && c !== 1) return ERR.VALUE;
  return { text, pattern, ci: c === 1 };
}

define(T, 'REGEXTEST', { min: 2, max: 3 }, ([a, p, cs], ctx) => {
  const r = regexArgs(a, p, cs, ctx);
  if (r instanceof FormulaError) return r;
  const re = regexFor(r.pattern, r.ci ? 'iu' : 'u', r.text);
  return re instanceof FormulaError ? re : re.test(r.text);
});
define(T, 'REGEXEXTRACT', { min: 2, max: 4 }, ([a, p, md, cs], ctx) => {
  const r = regexArgs(a, p, cs, ctx);
  if (r instanceof FormulaError) return r;
  const mode = optNum(md, 0, ctx);
  if (mode instanceof FormulaError) return mode;
  const re = regexFor(r.pattern, r.ci ? 'giu' : 'gu', r.text);
  if (re instanceof FormulaError) return re;
  const all = [...r.text.matchAll(re)];
  if (all.length === 0) return ERR.NA;
  if (mode === 0) return all[0]?.[0] ?? ERR.NA;
  if (mode === 1) return Matrix.column(all.map((m) => m[0]));
  if (mode === 2) {
    const groups = (all[0] ?? []).slice(1).map((g) => g ?? '');
    return groups.length === 0 ? ERR.NA : Matrix.row(groups);
  }
  return ERR.VALUE;
});
define(T, 'REGEXREPLACE', { min: 3, max: 5 }, ([a, p, rp, occ, cs], ctx) => {
  const r = regexArgs(a, p, cs, ctx);
  if (r instanceof FormulaError) return r;
  const rep = toText(rp, ctx);
  if (rep instanceof FormulaError) return rep;
  const o = optNum(occ, 0, ctx);
  if (o instanceof FormulaError) return o;
  const re = regexFor(r.pattern, r.ci ? 'giu' : 'gu', r.text);
  if (re instanceof FormulaError) return re;
  if (o === 0) return limit(r.text.replace(re, rep));
  const matches = [...r.text.matchAll(re)];
  const target = matches[o > 0 ? o - 1 : matches.length + o];
  if (!target || target.index === undefined) return r.text;
  const single = regexFor(r.pattern, r.ci ? 'iu' : 'u', r.text);
  if (single instanceof FormulaError) return single;
  const replaced = target[0].replace(single, rep);
  return limit(r.text.slice(0, target.index) + replaced + r.text.slice(target.index + target[0].length));
});

// ---------- Divers ----------

textFn(T, 'ASC', 1, 1, ([s = '']) =>
  s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' '),
);
textFn(T, 'DBCS', 1, 1, ([s = '']) =>
  s.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).replace(/ /g, '　'),
);
textFn(T, 'ENCODEURL', 1, 1, ([s = '']) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`),
);
define(T, 'PHONETIC', { min: 1, kinds: 'R' }, ([a], ctx) => {
  const v = deref(a, ctx);
  const s = v instanceof Matrix ? v.get(0, 0) : v;
  return typeof s === 'string' ? s : '';
});
