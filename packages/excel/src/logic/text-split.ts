// Assistant Convertir (texte en colonnes) : decoupe par delimiteurs ou par largeur fixe, format par colonne, destination.
import type { CellRange } from '@forgeoffice/xlsx';
import { commitEntry, parseEntry } from './cells.ts';
import type { Draft } from './draft.ts';

export type SplitFormat = 'general' | 'text' | 'skip';

export interface SplitOptions {
  mode: 'delimited' | 'fixed';
  /** Caracteres delimiteurs (mode delimite). */
  delimiters: readonly string[];
  /** Considerer les delimiteurs identiques consecutifs comme un seul. */
  consecutive: boolean;
  /** Identificateur de texte (« " », « ' » ou vide). */
  qualifier: string;
  /** Positions de rupture (mode largeur fixe), en nombre de caracteres depuis le debut. */
  breaks: readonly number[];
}

/** Decoupe une ligne selon les options. */
export function splitLine(line: string, o: SplitOptions): string[] {
  if (o.mode === 'fixed') {
    const cuts = [...new Set(o.breaks.filter((b) => b > 0 && b < line.length))].sort((a, b) => a - b);
    const out: string[] = [];
    let from = 0;
    for (const cut of [...cuts, line.length]) {
      out.push(line.slice(from, cut));
      from = cut;
    }
    return out;
  }
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  let afterDelimiter = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (o.qualifier && ch === o.qualifier) {
      if (quoted && line.charAt(i + 1) === o.qualifier) {
        cur += ch;
        i++;
      } else if (quoted || cur === '') quoted = !quoted;
      else cur += ch;
      afterDelimiter = false;
    } else if (!quoted && o.delimiters.includes(ch)) {
      if (!(o.consecutive && afterDelimiter)) out.push(cur);
      cur = '';
      afterDelimiter = true;
    } else {
      cur += ch;
      afterDelimiter = false;
    }
  }
  out.push(cur);
  return out;
}

export interface SplitResult {
  /** Resultat par ligne source. */
  rows: string[][];
  /** Nombre de colonnes produites. */
  width: number;
}

export function splitAll(lines: readonly string[], o: SplitOptions): SplitResult {
  const rows = lines.map((l) => splitLine(l, o));
  return { rows, width: rows.reduce((n, r) => Math.max(n, r.length), 0) };
}

/**
 * Convertit la premiere colonne de `range` vers `dest` (haut-gauche). `formats[i]` donne le traitement de la i-eme colonne produite
 * (« skip » : colonne ignoree et non ecrite). Renvoie la zone ecrite.
 */
export function convertText(d: Draft, si: number, range: CellRange, o: SplitOptions, formats: readonly SplitFormat[], dest: { row: number; col: number }, textAt: (r: number) => string | null): CellRange {
  const sources: { r: number; text: string }[] = [];
  for (let r = range.r1; r <= range.r2; r++) {
    const text = textAt(r);
    if (text !== null) sources.push({ r, text });
  }
  const { rows } = splitAll(sources.map((s) => s.text), o);
  let width = 0;
  sources.forEach((s, i) => {
    let col = 0;
    (rows[i] ?? []).forEach((part, k) => {
      const f = formats[k] ?? 'general';
      if (f === 'skip') return;
      const row = dest.row + (s.r - range.r1);
      const entry = f === 'text' ? { ok: true as const, value: part } : parseEntry(part.trim(), d.wb.date1904);
      commitEntry(d, si, row, dest.col + col, entry.ok ? entry : { ok: true, value: part });
      col++;
    });
    width = Math.max(width, col);
  });
  return { r1: dest.row, c1: dest.col, r2: dest.row + range.r2 - range.r1, c2: dest.col + Math.max(0, width - 1) };
}
