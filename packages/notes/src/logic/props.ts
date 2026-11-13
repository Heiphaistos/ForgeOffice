// Propriétés YAML (front matter « --- ... --- ») : lire, poser, retirer (port de WinNote extras.rs). Les autres lignes ne changent jamais.

export interface Prop {
  key: string;
  /** Valeur en une ligne ; une liste « - a / - b » est affichée « a, b ». */
  value: string;
}

const eolOf = (text: string): string => (text.includes('\r\n') ? '\r\n' : '\n');

/** Lignes (sans fin de ligne) de l'en-tête et longueur de l'en-tête fermeture comprise ; null s'il n'y en a pas. */
function frontLines(text: string): { lines: string[]; end: number } | null {
  const raw = text.split(/(?<=\n)/);
  if ((raw[0] ?? '').trimEnd() !== '---') return null;
  let pos = (raw[0] ?? '').length;
  const lines: string[] = [];
  for (const l of raw.slice(1)) {
    pos += l.length;
    const t = l.trimEnd();
    if (t === '---' || t === '...') return { lines, end: pos };
    lines.push(t);
  }
  return null;
}

const isCont = (l: string): boolean => l.startsWith(' ') || l.startsWith('\t') || l.startsWith('- ') || l === '-';

function unquote(v: string): string {
  const t = v.trim();
  for (const q of ['"', "'"]) if (t.length >= 2 && t.startsWith(q) && t.endsWith(q)) return t.slice(1, -1);
  return t;
}

function keyOf(l: string): { key: string; value: string } | null {
  if (isCont(l) || l.startsWith('#')) return null;
  const i = l.indexOf(':');
  if (i < 0) return null;
  const key = l.slice(0, i).trim();
  return key ? { key, value: l.slice(i + 1).trim() } : null;
}

const stripBom = (t: string): string => (t.startsWith('﻿') ? t.slice(1) : t);

/** Propriétés de l'en-tête YAML du document (vide s'il n'y en a pas). */
export function props(text: string): Prop[] {
  const fm = frontLines(stripBom(text));
  const out: Prop[] = [];
  for (const l of fm?.lines ?? []) {
    const kv = keyOf(l);
    const last = out[out.length - 1];
    if (kv) out.push({ key: kv.key, value: unquote(kv.value) });
    else if (last && isCont(l)) {
      const item = unquote(l.trim().replace(/^-+/, ''));
      if (item) last.value = last.value ? `${last.value}, ${item}` : item;
    }
  }
  return out;
}

/** « clé: valeur » -> [clé, valeur] ; null si la clé est vide ou contient des espaces. */
export function parseKv(s: string): [string, string] | null {
  const i = s.indexOf(':');
  if (i < 0) return null;
  const k = s.slice(0, i).trim();
  return k && !/\s/.test(k) ? [k, s.slice(i + 1).trim()] : null;
}

function yamlValue(v: string): string {
  const quote = /^[#&*!|>%@`"'[{]/.test(v) || v.includes(': ') || v.includes(' #') || v.endsWith(':');
  return quote ? `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : v;
}

/** Texte avec la propriété `key` posée à `value` (créée si besoin, retirée si `value` est vide). */
export function setProp(text: string, key: string, value: string): string {
  const eol = eolOf(text);
  const bom = text.startsWith('﻿') ? '﻿' : '';
  const body = stripBom(text);
  const v = value.trim();
  const line = `${key}: ${yamlValue(v)}`;
  const fm = frontLines(body);
  if (!fm) return v === '' ? text : `${bom}---${eol}${line}${eol}---${eol}${body}`;
  const out: string[] = [];
  let found = false;
  let skipping = false;
  for (const l of fm.lines) {
    const kv = keyOf(l);
    if (kv?.key === key) {
      found = true;
      skipping = true;
      if (v !== '') out.push(line);
    } else if (kv || !(skipping && isCont(l))) {
      skipping = false;
      out.push(l);
    }
  }
  if (!found && v !== '') out.push(line);
  const head = out.length === 0 ? '' : `---${eol}${out.map((l) => l + eol).join('')}---${eol}`;
  return `${bom}${head}${body.slice(fm.end)}`;
}

/** Plus petite zone à remplacer pour passer de `a` à `b` : { from, to (dans `a`), insert }. Garde l'annulation d'un seul geste. */
export function diffRange(a: string, b: string): { from: number; to: number; insert: string } {
  const max = Math.min(a.length, b.length);
  let pre = 0;
  while (pre < max && a[pre] === b[pre]) pre++;
  const low = (i: number): boolean => i > 0 && i < max + 1 && /[\ud800-\udbff]/.test(a[i - 1] ?? '');
  if (low(pre)) pre--;
  let suf = 0;
  while (suf < max - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  if (suf > 0 && /[\udc00-\udfff]/.test(a[a.length - suf] ?? '')) suf--;
  return { from: pre, to: a.length - suf, insert: b.slice(pre, b.length - suf) };
}
