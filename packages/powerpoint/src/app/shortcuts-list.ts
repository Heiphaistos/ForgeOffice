// Lignes de la liste consultable des raccourcis (registre + raccourcis traites ailleurs), avec recherche.
import { S3 } from './strings-text.ts';
import { OTHER_SHORTCUTS, SHORTCUTS, type ShortcutGroup } from './shortcuts.ts';

const fold = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr');

export interface ShortcutRow {
  group: ShortcutGroup;
  keys: string;
  label: string;
}

/** Toutes les lignes (registre + raccourcis traites ailleurs), filtrees par la recherche (touches ou libelle, sans accents). */
export function shortcutRows(query: string): ShortcutRow[] {
  const rows: ShortcutRow[] = [...SHORTCUTS.map((s) => ({ group: s.group, keys: s.keys, label: S3.shortcuts.labels[s.id] })), ...OTHER_SHORTCUTS];
  const q = fold(query.trim());
  return q ? rows.filter((r) => fold(r.keys).includes(q) || fold(r.label).includes(q)) : rows;
}
