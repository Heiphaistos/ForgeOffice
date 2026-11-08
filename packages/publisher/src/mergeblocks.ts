// Publipostage etendu (sans DOM) : bloc d'adresse et ligne de salutation composes depuis les champs de la source,
// detection des erreurs de fusion (champs inconnus, valeurs vides, champs en double).
import type { Deck, Shape, TextBody } from '@forgeoffice/pptx';
import type { MergeSource } from './model.ts';

export const ADDRESS_BLOCK = 'Bloc d’adresse';
export const GREETING_LINE = 'Ligne de salutation';
export const COMPOSITE_FIELDS: readonly string[] = [ADDRESS_BLOCK, GREETING_LINE];

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const SYNONYMS = {
  title: ['civilite', 'titre', 'madame monsieur', 'genre'],
  first: ['prenom', 'first name', 'firstname'],
  last: ['nom', 'nom de famille', 'last name', 'lastname', 'surname'],
  name: ['nom complet', 'destinataire', 'contact', 'full name'],
  street: ['adresse', 'adresse 1', 'rue', 'voie', 'address', 'street'],
  zip: ['code postal', 'cp', 'zip', 'postal code'],
  city: ['ville', 'commune', 'localite', 'city'],
  country: ['pays', 'country'],
} as const;

type Role = keyof typeof SYNONYMS;

/** Valeur du premier champ de la source dont le nom correspond au role (accents, casse et ponctuation ignores). */
function pick(fields: readonly string[], record: readonly string[], role: Role): string {
  for (const syn of SYNONYMS[role]) {
    const i = fields.findIndex((f) => norm(f) === syn);
    if (i >= 0) return (record[i] ?? '').trim();
  }
  return '';
}

const join = (...parts: string[]): string => parts.filter(Boolean).join(' ');

/** Adresse postale sur plusieurs lignes : civilite prenom nom / adresse / code postal ville / pays (lignes vides omises). */
export function addressBlock(fields: readonly string[], record: readonly string[]): string {
  const who = pick(fields, record, 'name') || join(pick(fields, record, 'title'), pick(fields, record, 'first'), pick(fields, record, 'last'));
  return [who, pick(fields, record, 'street'), join(pick(fields, record, 'zip'), pick(fields, record, 'city')), pick(fields, record, 'country')].filter(Boolean).join('\n');
}

/** « Bonjour Madame Martin, » ; sans nom de famille : « Madame, Monsieur, ». */
export function greetingLine(fields: readonly string[], record: readonly string[]): string {
  const last = pick(fields, record, 'last');
  const title = pick(fields, record, 'title');
  if (!last) return 'Madame, Monsieur,';
  return `Bonjour ${join(title, last)},`;
}

/** Valeur d'un champ composite, ou null si `name` n'en est pas un. */
export function compositeValue(name: string, fields: readonly string[], record: readonly string[]): string | null {
  if (name === ADDRESS_BLOCK) return addressBlock(fields, record);
  if (name === GREETING_LINE) return greetingLine(fields, record);
  return null;
}

export type MergeIssue =
  | { kind: 'unknown'; field: string }
  | { kind: 'empty'; field: string; records: number[] }
  | { kind: 'duplicate'; field: string };

function bodyFields(body: TextBody | undefined, out: Set<string>): void {
  if (!body) return;
  for (const p of body.paragraphs) for (const r of p.runs) if (r.type === 'text') for (const m of r.text.matchAll(/«([^«»]{1,100})»/g)) out.add(m[1] as string);
}

function shapeFields(shapes: readonly Shape[], out: Set<string>): void {
  for (const s of shapes) {
    if (s.kind === 'shape') bodyFields(s.text, out);
    else if (s.kind === 'table') for (const row of s.table.rows) for (const c of row.cells) bodyFields(c.text, out);
    else if (s.kind === 'group') shapeFields(s.children, out);
  }
}

/** Champs de fusion utilises dans le texte des pages. */
export function usedFields(deck: Deck): string[] {
  const out = new Set<string>();
  for (const slide of deck.slides) shapeFields(slide.shapes, out);
  return [...out];
}

/** Problemes de fusion : champ du texte absent de la source, champ de la source en double, valeurs vides des champs utilises. */
export function mergeIssues(deck: Deck, source: MergeSource): MergeIssue[] {
  const issues: MergeIssue[] = [];
  const seen = new Set<string>();
  for (const f of source.fields) {
    if (seen.has(f)) issues.push({ kind: 'duplicate', field: f });
    seen.add(f);
  }
  for (const field of usedFields(deck)) {
    if (COMPOSITE_FIELDS.includes(field)) continue;
    const i = source.fields.indexOf(field);
    if (i < 0) {
      issues.push({ kind: 'unknown', field });
      continue;
    }
    const empty = source.records.flatMap((r, n) => ((r[i] ?? '').trim() === '' ? [n] : []));
    if (empty.length) issues.push({ kind: 'empty', field, records: empty });
  }
  return issues;
}
