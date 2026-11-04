// Publipostage (sans DOM) : lecture CSV, champs « Nom » dans le texte, pages fusionnees (une copie par enregistrement).
import type { Deck, Shape, Slide, TextBody } from '@forgeoffice/pptx';
import type { MergeSource } from './model.ts';

const MAX_RECORDS = 5000;
const MAX_FIELDS = 200;

/** CSV (RFC 4180) : guillemets, separateur « ; » ou « , » detecte sur la premiere ligne, BOM ignore. */
export function parseCsv(text: string, name = ''): MergeSource {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : (firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length && rows.length <= MAX_RECORDS; i++) {
    const ch = src[i] as string;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  const header = (nonEmpty[0] ?? []).slice(0, MAX_FIELDS).map((h, i) => h.trim() || `Champ ${i + 1}`);
  const records = nonEmpty.slice(1, MAX_RECORDS + 1).map((r) => header.map((_, i) => (r[i] ?? '').trim()));
  return { name, fields: header, records };
}

/** Marque de champ inseree dans le texte. */
export const fieldToken = (field: string): string => `«${field}»`;

/** Remplace les champs « Nom » par les valeurs de l'enregistrement (champ inconnu laisse tel quel). */
export function fillFields(text: string, fields: readonly string[], record: readonly string[]): string {
  return text.replace(/«([^«»]{1,100})»/g, (whole, name: string) => {
    const i = fields.indexOf(name);
    return i >= 0 ? (record[i] ?? '') : whole;
  });
}

function fillBody(body: TextBody | undefined, fields: readonly string[], record: readonly string[]): void {
  if (!body) return;
  for (const p of body.paragraphs) for (const r of p.runs) if (r.type === 'text') r.text = fillFields(r.text, fields, record);
}

export function fillShapes(shapes: Shape[], fields: readonly string[], record: readonly string[]): void {
  for (const s of shapes) {
    if (s.kind === 'shape') fillBody(s.text, fields, record);
    else if (s.kind === 'table') for (const row of s.table.rows) for (const c of row.cells) fillBody(c.text, fields, record);
    else if (s.kind === 'group') fillShapes(s.children, fields, record);
  }
}

/** Le texte de la publication contient-il des champs de fusion ? */
export function hasFields(deck: Deck): boolean {
  return JSON.stringify(deck.slides.map((s) => s.shapes)).includes('«');
}

/** Publication fusionnee : les pages sont repetees pour chaque enregistrement, champs remplis. */
export function mergeDeck(deck: Deck, source: MergeSource, records: readonly number[] = source.records.map((_, i) => i)): Deck {
  const slides: Slide[] = [];
  let id = Math.max(255, ...deck.slides.map((s) => s.id));
  for (const r of records) {
    const record = source.records[r];
    if (!record) continue;
    for (const slide of deck.slides) {
      const copy = structuredClone(slide);
      copy.id = ++id;
      fillShapes(copy.shapes, source.fields, record);
      slides.push(copy);
    }
  }
  return { ...deck, slides, sections: [] };
}
