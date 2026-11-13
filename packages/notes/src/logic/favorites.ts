// Favoris : chemins de fichiers épinglés, le plus récent d'abord (stockés dans les réglages de l'application).

export const FAVS_KEY = 'notes.favorites';
const MAX_FAVS = 200;

/** Lit la liste enregistrée (donnée hostile : chaînes seulement, sans doublon). */
export function parseFavs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const v of raw) if (typeof v === 'string' && v.length > 0 && v.length <= 4096) seen.add(v);
  return [...seen].slice(0, MAX_FAVS);
}

/** Ajoute le chemin en tête s'il n'y est pas, le retire sinon. */
export function toggleFav(list: readonly string[], path: string): { list: string[]; added: boolean } {
  return list.includes(path) ? { list: list.filter((p) => p !== path), added: false } : { list: [path, ...list].slice(0, MAX_FAVS), added: true };
}
