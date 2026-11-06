// Validation, filtres, tableaux (francais).

export const dataStrings = {
  // Validation, filtres, tableaux
  validationList: 'Choisir une valeur',
  filterSortAsc: 'Trier de A à Z',
  filterSortDesc: 'Trier de Z à A',
  filterSortAscNum: 'Trier du plus petit au plus grand',
  filterSortDescNum: 'Trier du plus grand au plus petit',
  filterClear: (c: string) => `Effacer le filtre de « ${c} »`,
  filterSearch: 'Rechercher',
  filterAll: '(Sélectionner tout)',
  filterBlank: '(Vides)',
  filterNumber: 'Filtres numériques',
  filterText: 'Filtres textuels',
  filterTop10: '10 premiers…',
  filterAbove: 'Au-dessus de la moyenne',
  filterBelow: 'En dessous de la moyenne',
  filterGreater: 'Supérieur à…',
  filterLess: 'Inférieur à…',
  filterContains: 'Contient…',
  filterEquals: 'Est égal à…',
  filterPrompt: 'Valeur :',
  ok: 'OK',
  cancel: 'Annuler',
  close: 'Fermer',
  apply: 'Appliquer',
  column: (n: number) => `Colonne${n}`,
} as const;
