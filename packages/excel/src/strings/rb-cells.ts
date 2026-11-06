// Libelles du ruban : Cellules, edition, insertion.

export const rbCells = {
  insert: 'Insérer', insertRows: 'Insérer des lignes dans la feuille', insertCols: 'Insérer des colonnes dans la feuille', insertSheet: 'Insérer une feuille', cellsDown: 'Insérer des cellules (décaler vers le bas)', cellsRight: 'Insérer des cellules (décaler vers la droite)',
  del: 'Supprimer', delRows: 'Supprimer des lignes dans la feuille', delCols: 'Supprimer des colonnes dans la feuille', delSheet: 'Supprimer une feuille', cellsUp: 'Supprimer des cellules (décaler vers le haut)', cellsLeft: 'Supprimer des cellules (décaler vers la gauche)',
  format: 'Format', rowHeight: 'Hauteur de ligne…', autoRow: 'Ajuster la hauteur de ligne', colWidth: 'Largeur de colonne…', autoCol: 'Ajuster la largeur de colonne',
  hideRows: 'Masquer les lignes', hideCols: 'Masquer les colonnes', showRows: 'Afficher les lignes', showCols: 'Afficher les colonnes', hideSheet: 'Masquer la feuille', showSheet: 'Afficher la feuille…', renameSheet: 'Renommer la feuille', formatCells: 'Format de cellule…',
  autoSum: 'Somme automatique', sum: 'Somme', average: 'Moyenne', countNumbers: 'Nombres', max: 'Max', min: 'Min', moreFunctions: 'Autres fonctions…',
  fillMenu: 'Remplissage', fillDown: 'En bas', fillRight: 'À droite', fillUp: 'En haut', fillLeft: 'À gauche', fillSeries: 'Série…', flashFill: 'Remplissage instantané',
  clear: 'Effacer', clearAll: 'Effacer tout', clearFormats: 'Effacer les formats', clearContents: 'Effacer le contenu', clearComments: 'Effacer les commentaires et les notes', clearLinks: 'Effacer les liens hypertexte',
  sortFilter: 'Trier et filtrer', sortAsc: 'Trier de A à Z', sortDesc: 'Trier de Z à A', customSort: 'Tri personnalisé…', filter: 'Filtrer', clearFilter: 'Effacer', reapply: 'Réappliquer',
  findSelect: 'Rechercher et sélectionner', find: 'Rechercher…', replace: 'Remplacer…', goTo: 'Atteindre…',
  pivot: 'Tableau croisé dynamique', table: 'Tableau', pictures: 'Images',
  chartCol: 'Histogramme ou barres', chartLine: 'Courbes ou aires', chartPie: 'Secteurs ou anneau', chartScatter: 'Nuage de points', chartCombo: 'Graphique combiné', recommended: 'Graphiques recommandés',
  spLine: 'Courbe', spCol: 'Histogramme', spWin: 'Positif/Négatif',
  link: 'Lien', comment: 'Commentaire', symbol: 'Symbole',
} as const;
