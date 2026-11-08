// Import / export des styles entre documents : un document .docx ne contenant que les styles (et le thème) sert de fichier d'échange.
import { createBlankDocument, type Style, type WordDocument } from '@forgeoffice/docx';

/** Document d'échange : styles, thème et réglages par défaut du document, sans contenu. */
export function stylesDocument(meta: WordDocument): WordDocument {
  const blank = createBlankDocument();
  return { ...blank, styles: meta.styles, theme: meta.theme, settings: { ...blank.settings, defaultTabStop: meta.settings.defaultTabStop } };
}

/** Contenu visible d'un style (champs de mise en forme et de filiation), cles triees : deux styles equivalents donnent la meme chaine. */
function signature(s: Style): string {
  const sorted = (v: unknown): unknown => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sorted(x)])) : v);
  return JSON.stringify(sorted({ type: s.type, basedOn: s.basedOn, next: s.next, paragraph: s.paragraph, run: s.run, table: s.table, tableCell: s.tableCell, tableConditional: s.tableConditional }));
}

const usable = (s: Style): boolean => (s.type === 'paragraph' || s.type === 'character' || s.type === 'table') && !s.hidden;

/** Style importable : sans lien vers les listes du document d'origine (leurs numeros n'existent pas ici). */
function portable(s: Style): Style {
  if (!s.paragraph?.numbering) return s;
  const { numbering: _n, ...paragraph } = s.paragraph;
  return { ...s, paragraph };
}

export interface MergeResult {
  meta: WordDocument;
  added: number;
  replaced: number;
}

/** Ajoute les styles du document source ; `replace` remplace aussi ceux qui portent déjà le même identifiant. */
export function mergeStyles(target: WordDocument, source: WordDocument, mode: 'add' | 'replace'): MergeResult {
  const byId = new Map(target.styles.styles.map((s) => [s.id, s]));
  let added = 0;
  let replaced = 0;
  const next = [...target.styles.styles];
  for (const raw of source.styles.styles.filter(usable)) {
    const style = portable(raw);
    const existing = byId.get(style.id);
    if (!existing) {
      next.push(style);
      added++;
    } else if (mode === 'replace' && signature(existing) !== signature(style)) {
      next[next.indexOf(existing)] = style;
      replaced++;
    }
  }
  return { meta: { ...target, styles: { ...target.styles, styles: next } }, added, replaced };
}
