// Edition du texte riche d'une forme (sans DOM) : positions (paragraphe, decalage), insertion, suppression,
// coupure de paragraphe, mise en forme des caracteres et des paragraphes. Un saut de ligne compte pour 1 caractere,
// un champ (numero, date) pour la longueur de son texte et ne se coupe pas.
import type { Paragraph, ParagraphProps, Run, RunProps, TextBody } from '@forgeoffice/pptx';

export interface TextPos {
  /** Indice du paragraphe. */
  p: number;
  /** Decalage dans le paragraphe (caracteres). */
  o: number;
}

export interface TextRange {
  start: TextPos;
  end: TextPos;
}

/** Proprietes de caracteres a appliquer : une cle a `null` est retiree. */
export type RunPatch = { [K in keyof RunProps]?: RunProps[K] | null };
export type ParagraphPatch = { [K in keyof ParagraphProps]?: ParagraphProps[K] | null };

export const runLength = (run: Run): number => (run.type === 'break' ? 1 : run.text.length);

export const paragraphLength = (p: Paragraph): number => p.runs.reduce((n, r) => n + runLength(r), 0);

/** Texte d'un paragraphe (saut de ligne = \v). */
export const paragraphText = (p: Paragraph): string => p.runs.map((r) => (r.type === 'break' ? '\v' : r.text)).join('');

export function comparePos(a: TextPos, b: TextPos): number {
  return a.p - b.p || a.o - b.o;
}

export function orderRange(range: TextRange): TextRange {
  return comparePos(range.start, range.end) <= 0 ? range : { start: range.end, end: range.start };
}

export const isCollapsed = (r: TextRange): boolean => comparePos(r.start, r.end) === 0;

const sameProps = (a: RunProps, b: RunProps): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Fusionne les segments de texte voisins identiques et retire les segments vides. */
export function normalizeParagraph(p: Paragraph): void {
  const runs: Run[] = [];
  for (const run of p.runs) {
    if (run.type === 'text' && run.text === '') continue;
    const last = runs[runs.length - 1];
    if (run.type === 'text' && last?.type === 'text' && sameProps(last.props, run.props)) last.text += run.text;
    else runs.push(run);
  }
  if (!runs.length && p.runs[0] && !p.endProps) p.endProps = { ...p.runs[0].props };
  p.runs = runs;
}

/** Coupe les segments pour qu'une frontiere existe au decalage `o`. Renvoie l'indice du segment qui commence a `o`. */
export function splitAt(p: Paragraph, o: number): number {
  let at = 0;
  for (let i = 0; i < p.runs.length; i++) {
    const run = p.runs[i] as Run;
    const len = runLength(run);
    if (o <= at) return i;
    if (o < at + len) {
      if (run.type !== 'text') return i + 1;
      const head: Run = { type: 'text', text: run.text.slice(0, o - at), props: run.props };
      const tail: Run = { type: 'text', text: run.text.slice(o - at), props: { ...run.props } };
      p.runs.splice(i, 1, head, tail);
      return i + 1;
    }
    at += len;
  }
  return p.runs.length;
}

/** Proprietes du caractere avant `pos` (sinon apres, sinon fin de paragraphe). */
export function runPropsAt(body: TextBody, pos: TextPos): RunProps {
  const p = body.paragraphs[pos.p];
  if (!p) return {};
  let at = 0;
  let before: Run | undefined;
  for (const run of p.runs) {
    const len = runLength(run);
    if (at < pos.o) before = run;
    if (at >= pos.o && !before) return { ...run.props };
    at += len;
  }
  if (before) return { ...before.props };
  return { ...(p.endProps ?? p.runs[0]?.props ?? {}) };
}

function patchProps<T extends object>(base: T, patch: { [K in keyof T]?: T[K] | null }): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete out[key];
    else if (value !== undefined) out[key] = value;
  }
  return out as T;
}

/** Insere du texte (\n = nouveau paragraphe, \v = saut de ligne). Renvoie la position apres l'insertion. */
export function insertText(body: TextBody, pos: TextPos, text: string, props?: RunProps): TextPos {
  if (!body.paragraphs.length) body.paragraphs.push({ props: {}, runs: [] });
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let cursor = { p: Math.min(pos.p, body.paragraphs.length - 1), o: pos.o };
  lines.forEach((line, i) => {
    if (i > 0) cursor = splitParagraph(body, cursor);
    const p = body.paragraphs[cursor.p] as Paragraph;
    const runProps = props ?? runPropsAt(body, cursor);
    const parts = line.split('\v');
    parts.forEach((part, j) => {
      const at = splitAt(p, cursor.o);
      const runs: Run[] = [];
      if (j > 0) runs.push({ type: 'break', props: { ...runProps } });
      if (part) runs.push({ type: 'text', text: part, props: { ...runProps } });
      p.runs.splice(at, 0, ...runs);
      cursor = { p: cursor.p, o: cursor.o + (j > 0 ? 1 : 0) + part.length };
    });
    normalizeParagraph(p);
  });
  return cursor;
}

/** Coupe le paragraphe a `pos` (Entree). Le nouveau paragraphe garde la mise en forme. */
export function splitParagraph(body: TextBody, pos: TextPos): TextPos {
  const p = body.paragraphs[pos.p];
  if (!p) return pos;
  const at = splitAt(p, pos.o);
  const tail = p.runs.splice(at);
  const endProps = runPropsAt(body, pos);
  const next: Paragraph = { props: structuredClone(p.props), runs: tail, endProps: p.endProps ? { ...p.endProps } : endProps };
  if (!p.runs.length) p.endProps = endProps;
  body.paragraphs.splice(pos.p + 1, 0, next);
  return { p: pos.p + 1, o: 0 };
}

/** Supprime une plage (fusionne les paragraphes extremes). Renvoie la position de debut. */
export function deleteRange(body: TextBody, range: TextRange): TextPos {
  const { start, end } = orderRange(range);
  if (isCollapsed({ start, end })) return start;
  const first = body.paragraphs[start.p];
  const last = body.paragraphs[end.p];
  if (!first || !last) return start;
  const keepProps = runPropsAt(body, start);
  const cutEnd = splitAt(last, end.o);
  const tail = last.runs.slice(cutEnd);
  const cutStart = splitAt(first, start.o);
  first.runs.splice(cutStart);
  first.runs.push(...tail);
  body.paragraphs.splice(start.p + 1, end.p - start.p);
  if (!first.runs.length) first.endProps = keepProps;
  normalizeParagraph(first);
  return start;
}

export function prevPos(body: TextBody, pos: TextPos): TextPos {
  if (pos.o > 0) return { p: pos.p, o: pos.o - 1 };
  if (pos.p > 0) return { p: pos.p - 1, o: paragraphLength(body.paragraphs[pos.p - 1] as Paragraph) };
  return pos;
}

export function nextPos(body: TextBody, pos: TextPos): TextPos {
  const p = body.paragraphs[pos.p];
  if (p && pos.o < paragraphLength(p)) return { p: pos.p, o: pos.o + 1 };
  if (pos.p < body.paragraphs.length - 1) return { p: pos.p + 1, o: 0 };
  return pos;
}

/** Position debut / fin du corps. */
export const startPos = (): TextPos => ({ p: 0, o: 0 });

export function endPos(body: TextBody): TextPos {
  const last = Math.max(0, body.paragraphs.length - 1);
  const p = body.paragraphs[last];
  return { p: last, o: p ? paragraphLength(p) : 0 };
}

const isWordChar = (ch: string): boolean => /[\p{L}\p{N}_'’-]/u.test(ch);

/** Mot autour d'une position (double-clic). */
export function wordAt(body: TextBody, pos: TextPos): TextRange {
  const p = body.paragraphs[pos.p];
  if (!p) return { start: pos, end: pos };
  const text = paragraphText(p);
  let a = pos.o;
  let b = pos.o;
  while (a > 0 && isWordChar(text[a - 1] as string)) a--;
  while (b < text.length && isWordChar(text[b] as string)) b++;
  return { start: { p: pos.p, o: a }, end: { p: pos.p, o: b } };
}

/** Saut au mot precedent / suivant (Ctrl+fleches). */
export function wordBoundary(body: TextBody, pos: TextPos, dir: -1 | 1): TextPos {
  const p = body.paragraphs[pos.p];
  if (!p) return pos;
  const text = paragraphText(p);
  let o = pos.o;
  if (dir < 0) {
    if (o === 0) return prevPos(body, pos);
    while (o > 0 && !isWordChar(text[o - 1] as string)) o--;
    while (o > 0 && isWordChar(text[o - 1] as string)) o--;
  } else {
    if (o >= text.length) return nextPos(body, pos);
    while (o < text.length && isWordChar(text[o] as string)) o++;
    while (o < text.length && !isWordChar(text[o] as string)) o++;
  }
  return { p: pos.p, o };
}

/** Parcourt les segments couverts par une plage (apres decoupe aux bornes). */
function forRunsIn(body: TextBody, range: TextRange, visit: (run: Run, p: Paragraph) => void): void {
  const { start, end } = orderRange(range);
  for (let i = start.p; i <= end.p; i++) {
    const p = body.paragraphs[i];
    if (!p) continue;
    const from = i === start.p ? start.o : 0;
    const to = i === end.p ? end.o : paragraphLength(p);
    const a = splitAt(p, from);
    const b = splitAt(p, to);
    for (let r = a; r < b; r++) visit(p.runs[r] as Run, p);
  }
}

/** Applique une mise en forme de caracteres a une plage ; plage vide ou paragraphe vide : aussi aux proprietes de fin. */
export function applyRunProps(body: TextBody, range: TextRange, patch: RunPatch): void {
  const { start, end } = orderRange(range);
  forRunsIn(body, { start, end }, (run) => {
    run.props = patchProps(run.props, patch);
  });
  for (let i = start.p; i <= end.p; i++) {
    const p = body.paragraphs[i];
    if (!p) continue;
    if (!p.runs.length || i === end.p) p.endProps = patchProps(p.endProps ?? {}, patch);
    normalizeParagraph(p);
  }
}

/** Mise en forme commune d'une plage (une cle absente si les valeurs different). */
export function commonRunProps(body: TextBody, range: TextRange): RunProps {
  if (isCollapsed(range)) return runPropsAt(body, range.start);
  const copy = structuredClone(body);
  const list: RunProps[] = [];
  forRunsIn(copy, range, (run) => list.push(run.props));
  if (!list.length) return runPropsAt(body, range.start);
  const first = list[0] as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(first)) {
    if (list.every((p) => JSON.stringify((p as Record<string, unknown>)[key]) === JSON.stringify(value))) out[key] = value;
  }
  return out as RunProps;
}

/** Applique des proprietes de paragraphe aux paragraphes touches par la plage. */
export function applyParagraphProps(body: TextBody, range: TextRange, patch: ParagraphPatch | ((props: ParagraphProps, index: number) => ParagraphProps)): void {
  const { start, end } = orderRange(range);
  for (let i = start.p; i <= end.p; i++) {
    const p = body.paragraphs[i];
    if (!p) continue;
    p.props = typeof patch === 'function' ? patch(p.props, i) : patchProps(p.props, patch);
  }
}

/** Texte brut d'une plage (paragraphes separes par \n). */
export function textOfRange(body: TextBody, range: TextRange): string {
  const { start, end } = orderRange(range);
  const parts: string[] = [];
  for (let i = start.p; i <= end.p; i++) {
    const p = body.paragraphs[i];
    if (!p) continue;
    const text = paragraphText(p);
    parts.push(text.slice(i === start.p ? start.o : 0, i === end.p ? end.o : text.length));
  }
  return parts.join('\n');
}

/** Copie riche d'une plage (pour le presse-papiers interne). */
export function sliceBody(body: TextBody, range: TextRange): Paragraph[] {
  const { start, end } = orderRange(range);
  const copy = structuredClone(body);
  const out: Paragraph[] = [];
  for (let i = start.p; i <= end.p; i++) {
    const p = copy.paragraphs[i];
    if (!p) continue;
    const to = i === end.p ? end.o : paragraphLength(p);
    const a = splitAt(p, i === start.p ? start.o : 0);
    const b = splitAt(p, to);
    out.push({ props: p.props, runs: p.runs.slice(a, b), endProps: p.endProps });
  }
  return out;
}

/** Insere des paragraphes riches a une position. Renvoie la position apres. */
export function insertParagraphs(body: TextBody, pos: TextPos, paragraphs: readonly Paragraph[]): TextPos {
  let cursor = pos;
  paragraphs.forEach((source, i) => {
    if (i > 0) cursor = splitParagraph(body, cursor);
    const p = body.paragraphs[cursor.p] as Paragraph;
    if (i > 0 || paragraphLength(p) === 0) p.props = structuredClone(source.props);
    const at = splitAt(p, cursor.o);
    const runs = structuredClone(source.runs);
    p.runs.splice(at, 0, ...runs);
    cursor = { p: cursor.p, o: cursor.o + runs.reduce((n, r) => n + runLength(r), 0) };
    normalizeParagraph(p);
  });
  return cursor;
}

export type CaseMode = 'sentence' | 'lower' | 'upper' | 'title' | 'toggle';

/** Modifier la casse d'une plage. */
export function changeCase(body: TextBody, range: TextRange, mode: CaseMode): void {
  let atSentenceStart = true;
  let atWordStart = true;
  forRunsIn(body, range, (run) => {
    if (run.type !== 'text') return;
    let out = '';
    for (const ch of run.text) {
      let c = ch;
      if (mode === 'lower') c = ch.toLocaleLowerCase('fr');
      else if (mode === 'upper') c = ch.toLocaleUpperCase('fr');
      else if (mode === 'toggle') c = ch === ch.toLocaleUpperCase('fr') ? ch.toLocaleLowerCase('fr') : ch.toLocaleUpperCase('fr');
      else if (mode === 'title') c = atWordStart ? ch.toLocaleUpperCase('fr') : ch.toLocaleLowerCase('fr');
      else c = atSentenceStart && /\p{L}/u.test(ch) ? ch.toLocaleUpperCase('fr') : ch.toLocaleLowerCase('fr');
      if (/\p{L}/u.test(ch)) atSentenceStart = false;
      if (/[.!?]/.test(ch)) atSentenceStart = true;
      atWordStart = !/[\p{L}\p{N}]/u.test(ch);
      out += c;
    }
    run.text = out;
  });
}

/** Indice de caractere global (paragraphes separes par 1) <-> position. */
export function posToIndex(body: TextBody, pos: TextPos): number {
  let n = 0;
  for (let i = 0; i < pos.p; i++) n += paragraphLength(body.paragraphs[i] as Paragraph) + 1;
  return n + pos.o;
}

export function indexToPos(body: TextBody, index: number): TextPos {
  let rest = Math.max(0, index);
  for (let i = 0; i < body.paragraphs.length; i++) {
    const len = paragraphLength(body.paragraphs[i] as Paragraph);
    if (rest <= len) return { p: i, o: rest };
    rest -= len + 1;
  }
  return endPos(body);
}

/** Augmente / diminue le niveau de liste (Tab / Maj+Tab), borne a 0..8. */
export function shiftLevel(body: TextBody, range: TextRange, delta: 1 | -1): void {
  applyParagraphProps(body, range, (props) => {
    const level = Math.max(0, Math.min(8, (props.level ?? 0) + delta));
    const out = { ...props };
    if (level) out.level = level;
    else delete out.level;
    return out;
  });
}

/** Recherche dans un corps de texte : plages de toutes les occurrences. */
export function findInBody(body: TextBody, query: string, matchCase = false): TextRange[] {
  if (!query) return [];
  const out: TextRange[] = [];
  const q = matchCase ? query : query.toLocaleLowerCase('fr');
  body.paragraphs.forEach((p, i) => {
    const text = matchCase ? paragraphText(p) : paragraphText(p).toLocaleLowerCase('fr');
    let at = text.indexOf(q);
    while (at >= 0) {
      out.push({ start: { p: i, o: at }, end: { p: i, o: at + q.length } });
      at = text.indexOf(q, at + q.length);
    }
  });
  return out;
}
