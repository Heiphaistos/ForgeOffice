// Filtres personnalises de la feuille de donnees (« Filtres de texte / de nombres / de dates ») : options par famille de
// champ et construction du filtre a partir des valeurs saisies (sans DOM, teste).
import type { Filtre, Json, Operateur, TypeChamp } from '../types.ts';
import { isNumericType, parseDate, parseNumber } from './values.ts';

export type FilterFamily = 'texte' | 'nombre' | 'date';

export interface CustomFilterOption {
  id: string;
  operateur: Operateur;
  /** Nombre de valeurs a saisir (0, 1 ou 2). */
  values: 0 | 1 | 2;
}

const TEXT: readonly CustomFilterOption[] = [
  { id: 'egal', operateur: 'egal', values: 1 }, { id: 'different', operateur: 'different', values: 1 },
  { id: 'commence_par', operateur: 'commence_par', values: 1 }, { id: 'finit_par', operateur: 'finit_par', values: 1 },
  { id: 'contient', operateur: 'contient', values: 1 }, { id: 'ne_contient_pas', operateur: 'ne_contient_pas', values: 1 },
  { id: 'est_vide', operateur: 'est_vide', values: 0 }, { id: 'nest_pas_vide', operateur: 'nest_pas_vide', values: 0 },
];

const ORDERED: readonly CustomFilterOption[] = [
  { id: 'egal', operateur: 'egal', values: 1 }, { id: 'different', operateur: 'different', values: 1 },
  { id: 'inferieur', operateur: 'inferieur', values: 1 }, { id: 'inferieur_ou_egal', operateur: 'inferieur_ou_egal', values: 1 },
  { id: 'superieur', operateur: 'superieur', values: 1 }, { id: 'superieur_ou_egal', operateur: 'superieur_ou_egal', values: 1 },
  { id: 'entre', operateur: 'entre', values: 2 },
  { id: 'est_vide', operateur: 'est_vide', values: 0 }, { id: 'nest_pas_vide', operateur: 'nest_pas_vide', values: 0 },
];

export function familyOf(type: TypeChamp | null): FilterFamily {
  if (type === 'date_heure') return 'date';
  return isNumericType(type) || type === 'numero_auto' ? 'nombre' : 'texte';
}

export const customFilterOptions = (family: FilterFamily): readonly CustomFilterOption[] => (family === 'texte' ? TEXT : ORDERED);

function parseValue(family: FilterFamily, raw: string): Json | null {
  const t = raw.trim();
  if (t === '') return null;
  if (family === 'nombre') return parseNumber(t);
  if (family === 'date') return parseDate(t);
  return t;
}

export type CustomFilterResult = { ok: true; filter: Filtre } | { ok: false; error: 'empty' | 'number' | 'date' };

/** Filtre pour `champ` d'apres l'option choisie et les valeurs saisies ; erreur si une valeur est vide ou illisible. */
export function buildCustomFilter(champ: string, option: CustomFilterOption, family: FilterFamily, raw1: string, raw2: string): CustomFilterResult {
  if (option.values === 0) return { ok: true, filter: { champ, operateur: option.operateur } };
  const bad = family === 'nombre' ? 'number' : 'date';
  const v1 = parseValue(family, raw1);
  if (v1 === null) return { ok: false, error: raw1.trim() === '' ? 'empty' : bad };
  if (option.values === 1) return { ok: true, filter: { champ, operateur: option.operateur, valeur: v1 } };
  const v2 = parseValue(family, raw2);
  if (v2 === null) return { ok: false, error: raw2.trim() === '' ? 'empty' : bad };
  return { ok: true, filter: { champ, operateur: option.operateur, valeur: v1, valeur2: v2 } };
}
