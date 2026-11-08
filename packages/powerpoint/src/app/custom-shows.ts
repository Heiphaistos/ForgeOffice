// Diaporamas personnalisés : opérations pures sur la liste (création, ajout/retrait/ordre des diapositives, suppression).
import type { CustomShow } from '@forgeoffice/pptx';

export const nextShowId = (shows: readonly CustomShow[]): number => Math.max(-1, ...shows.map((s) => s.id)) + 1;

export function addShow(shows: readonly CustomShow[], name: string, slideIds: readonly number[]): CustomShow[] {
  const clean = name.trim();
  if (!clean || !slideIds.length) return [...shows];
  return [...shows, { id: nextShowId(shows), name: uniqueName(shows, clean), slideIds: [...slideIds] }];
}

/** Nom sans doublon : « Court », « Court (2) »... */
export function uniqueName(shows: readonly CustomShow[], name: string): string {
  const taken = new Set(shows.map((s) => s.name.toLocaleLowerCase('fr')));
  if (!taken.has(name.toLocaleLowerCase('fr'))) return name;
  for (let n = 2; ; n++) if (!taken.has(`${name} (${n})`.toLocaleLowerCase('fr'))) return `${name} (${n})`;
}

export function updateShow(shows: readonly CustomShow[], id: number, patch: Partial<Pick<CustomShow, 'name' | 'slideIds'>>): CustomShow[] {
  return shows.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

export const removeShow = (shows: readonly CustomShow[], id: number): CustomShow[] => shows.filter((s) => s.id !== id);

/** Deplace l'element `index` de `delta` rangs (borne). */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const j = index + delta;
  if (index < 0 || index >= items.length || j < 0 || j >= items.length) return [...items];
  const out = [...items];
  [out[index], out[j]] = [out[j] as T, out[index] as T];
  return out;
}

/** Retire des diaporamas les diapositives supprimees de la presentation. */
export function pruneShows(shows: readonly CustomShow[], existing: ReadonlySet<number>): CustomShow[] {
  return shows.map((s) => ({ ...s, slideIds: s.slideIds.filter((id) => existing.has(id)) }));
}
