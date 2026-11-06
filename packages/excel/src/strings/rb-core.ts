// Libelles du ruban : Onglets, ensembles contextuels, groupes.

export const rbCore = {
  tabs: { home: 'Accueil', insert: 'Insertion', layout: 'Mise en page', formulas: 'Formules', data: 'Données', review: 'Révision', view: 'Affichage', table: 'Création de tableau', chart: 'Création de graphique', pivot: 'Analyse du tableau croisé dynamique' },
  sets: { table: 'Outils de tableau', chart: 'Outils de graphique', pivot: 'Outils de tableau croisé dynamique' },
  g: {
    clipboard: 'Presse-papiers', font: 'Police', alignment: 'Alignement', number: 'Nombre', styles: 'Styles', cells: 'Cellules', editing: 'Édition',
    tables: 'Tableaux', illustrations: 'Illustrations', charts: 'Graphiques', sparklines: 'Graphiques sparkline', filters: 'Filtres', links: 'Liens', comments: 'Commentaires', text: 'Texte', symbols: 'Symboles',
    themes: 'Thèmes', pageSetup: 'Mise en page', scale: 'Mise à l’échelle', sheetOptions: 'Options de la feuille de calcul',
    library: 'Bibliothèque de fonctions', names: 'Noms définis', audit: 'Audit de formules', calc: 'Calcul',
    getData: 'Récupérer et transformer des données', queries: 'Requêtes et connexions', sortFilter: 'Trier et filtrer', dataTools: 'Outils de données', outline: 'Plan',
    proofing: 'Vérification', notes: 'Notes', protect: 'Protéger',
    views: 'Affichages classeur', show: 'Afficher', zoom: 'Zoom', window: 'Fenêtre',
    props: 'Propriétés', tools: 'Outils', tableStyleOptions: 'Options de style de tableau', tableStyles: 'Styles de tableau',
    chartLayouts: 'Dispositions du graphique', chartStyles: 'Styles du graphique', type: 'Type', data: 'Données', pivotTable: 'Tableau croisé dynamique',
  },
} as const;
