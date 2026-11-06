// Saisie semi-automatique au-dela des fonctions : noms definis, noms de tableaux, colonnes et elements speciaux d'un tableau
// (Tableau1[ -> Ventes, #Donnees...), comme la liste deroulante d'Excel pendant la frappe d'une formule.
import type { Workbook } from '@forgeoffice/xlsx';

export type CompletionKind = 'name' | 'table' | 'column' | 'special';

export interface NameCompletion {
  kind: CompletionKind;
  /** Texte propose (et insere). */
  text: string;
  description: string;
}

export interface CompletionSource {
  names: readonly NameCompletion[];
  tables: readonly { name: string; columns: readonly string[] }[];
}

export const EMPTY_SOURCE: CompletionSource = { names: [], tables: [] };

/** Elements speciaux d'un tableau en francais (#Tout, #Donnees...). */
const SPECIALS: readonly [string, string][] = [
  ['#Tout', 'Tout le tableau, en-tetes et totaux compris'],
  ['#Données', 'Les lignes de données'],
  ['#En-têtes', 'La ligne d’en-têtes'],
  ['#Totaux', 'La ligne de totaux'],
  ['#Cette ligne', 'La ligne de la formule'],
];

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Noms et tableaux du classeur proposes a la frappe. */
export function completionSource(wb: Workbook, sheetIndex: number): CompletionSource {
  const names: NameCompletion[] = [];
  for (const n of wb.definedNames) {
    if (n.name.startsWith('_xlnm') || n.hidden || (n.localSheet !== undefined && n.localSheet !== sheetIndex)) continue;
    names.push({ kind: 'name', text: n.name, description: n.comment ?? n.formula });
  }
  const tables: { name: string; columns: string[] }[] = [];
  for (const sh of wb.sheets) {
    for (const t of sh.tables) {
      const name = t.displayName || t.name;
      names.push({ kind: 'table', text: name, description: `${sh.name}` });
      tables.push({ name, columns: t.columns.map((c) => c.name) });
    }
  }
  return { names, tables };
}

/** Noms ou tableaux dont le debut correspond au mot saisi (sans accents ni casse). */
export function nameCompletions(word: string, source: CompletionSource, limit = 8): NameCompletion[] {
  if (!word) return [];
  const w = fold(word);
  return source.names.filter((n) => fold(n.text).startsWith(w) && fold(n.text) !== w).slice(0, limit);
}

/** Apres « Tableau1[ » (ou « Tableau1[[ ») : debut deja tape de la colonne, et position ou il commence. */
export function columnContext(text: string, caret: number): { table: string; start: number; prefix: string } | null {
  if (!text.startsWith('=')) return null;
  const m = text.slice(0, caret).match(/([A-Za-zÀ-ÿ_][\w.À-ÿ]*)\[\[?([^[\]]*)$/);
  if (!m || m.index === undefined) return null;
  const prefix = m[2] ?? '';
  return { table: m[1] ?? '', start: caret - prefix.length, prefix };
}

/** Colonnes (puis elements speciaux) du tableau qui commencent par ce qui est tape. */
export function columnCompletions(table: string, prefix: string, source: CompletionSource, limit = 12): NameCompletion[] {
  const t = source.tables.find((k) => k.name.toLowerCase() === table.toLowerCase());
  if (!t) return [];
  const p = fold(prefix);
  const cols = t.columns.filter((c) => fold(c).startsWith(p)).map((c): NameCompletion => ({ kind: 'column', text: c, description: t.name }));
  const specials = prefix.startsWith('#') || prefix === '' ? SPECIALS.filter(([s]) => fold(s).startsWith(p)).map(([s, d]): NameCompletion => ({ kind: 'special', text: s, description: d })) : [];
  return [...cols, ...specials].slice(0, limit);
}
