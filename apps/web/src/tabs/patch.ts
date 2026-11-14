// Mise a jour d'un onglet : la liste reste IDENTIQUE si rien ne change.
// Un module qui renvoie son titre dans un effet (ex. Publication : `[services, ...]`) rappelle `setTitle` a chaque rendu de l'hote ;
// recopier l'onglet a chaque fois relancait un rendu de l'hote, donc un nouvel effet : « Maximum update depth exceeded » (React #185).
export function patchTab<T extends { id: string }>(list: T[], id: string, change: Partial<T>): T[] {
  let changed = false;
  const next = list.map((t) => {
    if (t.id !== id || (Object.keys(change) as (keyof T)[]).every((k) => Object.is(t[k], change[k]))) return t;
    changed = true;
    return { ...t, ...change };
  });
  return changed ? next : list;
}
