// Tri, filtres, recherche, pagination et totaux en memoire (base de demonstration, resultats de requete).
import type { Filtre, FonctionTotal, Json, OptionsLecture } from '../types.ts';

/** Minuscules sans accents (recherche « a la francaise »). */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function asText(v: Json): string {
  return v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/** Ordre Access : vides d'abord, nombres, puis textes en ordre francais. */
export function compareValues(a: Json, b: Json): number {
  if (a === null || a === '') return b === null || b === '' ? 0 : -1;
  if (b === null || b === '') return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return asText(a).localeCompare(asText(b), 'fr', { sensitivity: 'base', numeric: true });
}

function like(value: string, pattern: string): boolean {
  const re = fold(pattern).replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.').replace(/#/g, '\\d');
  return new RegExp(`^${re}$`).test(fold(value));
}

export function matchFilter(value: Json, f: Filtre): boolean {
  const v = value;
  const target = f.valeur ?? null;
  const text = fold(asText(v));
  const t = fold(asText(target));
  switch (f.operateur) {
    case 'egal': return compareValues(v, target) === 0 && (v === null) === (target === null);
    case 'different': return compareValues(v, target) !== 0;
    case 'inferieur': return v !== null && compareValues(v, target) < 0;
    case 'inferieur_ou_egal': return v !== null && compareValues(v, target) <= 0;
    case 'superieur': return v !== null && compareValues(v, target) > 0;
    case 'superieur_ou_egal': return v !== null && compareValues(v, target) >= 0;
    case 'contient': return text.includes(t);
    case 'ne_contient_pas': return !text.includes(t);
    case 'commence_par': return text.startsWith(t);
    case 'finit_par': return text.endsWith(t);
    case 'est_vide': return v === null || v === '';
    case 'nest_pas_vide': return v !== null && v !== '';
    case 'entre': return v !== null && compareValues(v, target) >= 0 && compareValues(v, f.valeur2 ?? null) <= 0;
    case 'dans': return (f.valeurs ?? []).some((x) => compareValues(v, x) === 0 && (v === null) === (x === null));
    case 'comme': return like(asText(v), asText(target));
  }
}

export interface LocalPage {
  /** Index des lignes retenues dans `rows`, dans l'ordre d'affichage, pour la page demandee. */
  indexes: number[];
  total: number;
  nbPages: number;
}

/** Applique filtres, recherche, tri et pagination a des lignes en memoire. */
export function applyOptions(columns: readonly string[], rows: readonly Json[][], o: OptionsLecture): LocalPage {
  const col = (name: string): number => columns.findIndex((c) => c.toLowerCase() === name.toLowerCase());
  const needle = fold(o.recherche?.trim() ?? '');
  let idx = rows.map((_, i) => i).filter((i) => {
    const row = rows[i] ?? [];
    const results = o.filtres.map((f) => matchFilter(row[col(f.champ)] ?? null, f));
    const passFilters = results.length === 0 || (o.combinaison_ou ? results.some(Boolean) : results.every(Boolean));
    return passFilters && (needle === '' || row.some((v) => fold(asText(v)).includes(needle)));
  });
  if (o.tri.length > 0) {
    idx = [...idx].sort((a, b) => {
      for (const t of o.tri) {
        const c = col(t.champ);
        const r = compareValues(rows[a]?.[c] ?? null, rows[b]?.[c] ?? null);
        if (r !== 0) return t.descendant ? -r : r;
      }
      return a - b;
    });
  }
  const size = Math.max(1, o.taille_page);
  const nbPages = Math.max(1, Math.ceil(idx.length / size));
  return { indexes: idx.slice(o.page * size, o.page * size + size), total: idx.length, nbPages };
}

/** Ligne Total de la feuille de donnees. */
export function computeTotal(values: readonly Json[], fn: FonctionTotal): Json {
  if (fn === 'compte') return values.filter((v) => v !== null && v !== '').length;
  const nums = values.filter((v): v is number => typeof v === 'number');
  if (fn === 'min' || fn === 'max') {
    const present = values.filter((v) => v !== null && v !== '');
    if (present.length === 0) return null;
    return [...present].sort(compareValues)[fn === 'min' ? 0 : present.length - 1] ?? null;
  }
  if (nums.length === 0) return null;
  const sum = nums.reduce((s, n) => s + n, 0);
  if (fn === 'somme') return sum;
  const mean = sum / nums.length;
  if (fn === 'moyenne') return mean;
  if (nums.length < 2) return null;
  const variance = nums.reduce((s, n) => s + (n - mean) ** 2, 0) / (nums.length - 1);
  return fn === 'variance' ? variance : Math.sqrt(variance);
}

/** Valeurs distinctes triees (menu de filtre d'une colonne). */
export function distinctValues(values: readonly Json[], limit = 200): Json[] {
  const seen = new Map<string, Json>();
  for (const v of values) {
    const key = asText(v);
    if (!seen.has(key)) seen.set(key, v);
  }
  return [...seen.values()].sort(compareValues).slice(0, limit);
}
