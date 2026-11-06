// Graphiques et sparklines (francais).

export const chartStrings = {
  chart: {
    title: 'Titre du graphique',
    series: (n: number) => `Série${n}`,
    types: { col: 'Histogramme groupé', colStacked: 'Histogramme empilé', bar: 'Barres groupées', line: 'Courbes', lineMarkers: 'Courbes avec marqueurs', pie: 'Secteurs', doughnut: 'Anneau', area: 'Aires', scatter: 'Nuage de points', combo: 'Graphique combiné' } as Record<string, string>,
    noData: 'Sélectionnez des données numériques pour créer un graphique.',
    legend: 'Légende',
    legendPos: { r: 'Droite', b: 'Bas', t: 'Haut', l: 'Gauche', none: 'Aucune' } as Record<string, string>,
    dataLabels: 'Étiquettes de données',
    axisTitles: 'Titres des axes',
    gridlines: 'Quadrillage',
    switch: 'Intervertir les lignes/colonnes',
    changeType: 'Modifier le type de graphique',
    styles: 'Styles du graphique',
    colors: 'Modifier les couleurs',
    delete: 'Supprimer le graphique',
    editTitle: 'Modifier le titre',
  },
  sparkline: 'Créer des graphiques sparkline',
  sparkData: 'Plage de données :',
  sparkLocation: 'Plage d’emplacements :',
  image: 'Image',
  imageAlt: 'Image insérée',
} as const;
