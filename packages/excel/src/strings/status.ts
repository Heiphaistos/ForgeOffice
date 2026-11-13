// Barre d'etat (francais).

export const statusStrings = {
  // Barre d'etat
  ready: 'Prêt',
  enter: 'Entrer',
  edit: 'Modifier',
  point: 'Pointer',
  average: 'Moyenne',
  count: 'Nombre',
  countNums: 'Nb (numérique)',
  sum: 'Somme',
  min: 'Min',
  max: 'Max',
  numCount: 'Nb (non vides)',
  calculate: 'Calculer',
  circular: 'Références circulaires',
  viewNormal: 'Normal',
  viewLayout: 'Mise en page',
  viewBreak: 'Aperçu des sauts de page',
  zoomSelection: 'Zoom sur la sélection',
  // Dispositions LibreOffice / OpenOffice : zones de la barre d'etat de Calc
  suiteSheet: (n: number, total: number, oo: boolean): string => (oo ? `Feuille ${n} / ${total}` : `Feuille ${n} sur ${total}`),
  suiteSelected: (rows: number, cols: number): string => `Sélectionné : ${rows} ${rows > 1 ? 'lignes' : 'ligne'}, ${cols} ${cols > 1 ? 'colonnes' : 'colonne'}`,
  suiteStats: (avg: string, sum: string, oo: boolean): string => (oo ? `Somme=${sum}` : `Moyenne: ${avg}; Somme: ${sum}`),
  suitePageStyle: 'Par défaut',
  suiteLanguage: 'Français (France)',
  suiteInsert: 'Insertion',
  suiteModified: 'Le document a été modifié. Cliquez pour enregistrer le document.',
  suiteSaved: 'Le document n’a pas été modifié.',
  accessibility: 'Accessibilité : vérification terminée',
} as const;
