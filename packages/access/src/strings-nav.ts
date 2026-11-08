// Textes des menus du volet de navigation : regroupement, tri, objets masques, groupes.
export const N = {
  groupBy: 'Regrouper par',
  byType: 'Type d’objet',
  byNone: 'Aucun regroupement',
  sortBy: 'Trier par',
  sortNameAsc: 'Nom (A à Z)',
  sortNameDesc: 'Nom (Z à A)',
  sortModified: 'Date de modification',
  collapseAll: 'Réduire tous les groupes',
  expandAll: 'Développer tous les groupes',
  collapse: 'Réduire le groupe',
  expand: 'Développer le groupe',
  showHidden: (n: number) => `Afficher les objets masqués (${n})`,
  hide: 'Masquer dans ce groupe',
  unhide: 'Ne plus masquer',
} as const;
