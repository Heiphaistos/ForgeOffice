// Organisation du volet de navigation : regroupement, tri, objets masques (sans DOM, teste).

export type NavKind = 'table' | 'requete' | 'formulaire' | 'etat' | 'macro';
export type NavGroupBy = 'type' | 'none';
export type NavSort = 'name-asc' | 'name-desc' | 'modified';

export interface NavView {
  groupBy: NavGroupBy;
  sort: NavSort;
  /** Objets masques, « genre:nom ». */
  hidden: string[];
  showHidden: boolean;
}

export const DEFAULT_NAV_VIEW: NavView = { groupBy: 'type', sort: 'name-asc', hidden: [], showHidden: false };

export interface NavEntry {
  kind: NavKind;
  name: string;
  modified: string | null;
}

export interface NavGroup {
  /** Genre du groupe, ou « all » pour la liste plate. */
  id: NavKind | 'all';
  items: NavEntry[];
}

export const KINDS_ORDER: readonly NavKind[] = ['table', 'requete', 'formulaire', 'etat', 'macro'];

export const hiddenKey = (e: Pick<NavEntry, 'kind' | 'name'>): string => `${e.kind}:${e.name}`;

const byName = (a: NavEntry, b: NavEntry): number => a.name.localeCompare(b.name, 'fr');

function sorted(items: NavEntry[], sort: NavSort): NavEntry[] {
  const list = [...items];
  if (sort === 'name-desc') return list.sort((a, b) => byName(b, a));
  // Plus recent d'abord ; sans date, apres, par nom.
  if (sort === 'modified') return list.sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? '') || byName(a, b));
  return list.sort(byName);
}

/** Groupes a afficher. `needle` est la recherche deja normalisee ; sans recherche, les groupes vides restent visibles (par type). */
export function arrangeNav(entries: readonly NavEntry[], view: NavView, matches: (name: string) => boolean = () => true, searching = false): NavGroup[] {
  const visible = entries.filter((e) => matches(e.name) && (view.showHidden || !view.hidden.includes(hiddenKey(e))));
  if (view.groupBy === 'none') return [{ id: 'all', items: sorted(visible, view.sort) }];
  return KINDS_ORDER.map((id) => ({ id, items: sorted(visible.filter((e) => e.kind === id), view.sort) })).filter((g) => g.items.length > 0 || !searching);
}

export function hideEntry(view: NavView, entry: NavEntry): NavView {
  const key = hiddenKey(entry);
  return view.hidden.includes(key) ? view : { ...view, hidden: [...view.hidden, key] };
}

export const unhideEntry = (view: NavView, entry: NavEntry): NavView => ({ ...view, hidden: view.hidden.filter((k) => k !== hiddenKey(entry)) });

/** Nombre d'objets masques qui existent encore. */
export const hiddenCount = (entries: readonly NavEntry[], view: NavView): number => entries.filter((e) => view.hidden.includes(hiddenKey(e))).length;
