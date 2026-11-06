// Libelles du ruban : Mise en page et formules.

export const rbLayout = {
  themesColors: 'Couleurs', themeNames: { office: 'Office', office2013: 'Office 2013-2022', green: 'Vert', blue: 'Bleu', red: 'Rouge orangé', gray: 'Niveaux de gris' } as Record<string, string>,
  margins: 'Marges', marginsNormal: 'Normales', marginsWide: 'Larges', marginsNarrow: 'Étroites', orientationPage: 'Orientation', portrait: 'Portrait', landscape: 'Paysage',
  pageSize: 'Taille', printArea: 'Zone d’impression', setPrintArea: 'Définir la zone d’impression', clearPrintArea: 'Annuler la zone d’impression', breaks: 'Sauts de page', insertBreak: 'Insérer un saut de page', removeBreak: 'Supprimer le saut de page', resetBreaks: 'Rétablir tous les sauts de page',
  printTitles: 'Imprimer les titres', scaleFit: 'Ajuster à 1 page', scale: 'Échelle',
  gridlines: 'Quadrillage', headings: 'En-têtes', viewOpt: 'Afficher', printOpt: 'Imprimer',
  insertFn: 'Insérer une fonction', recentFns: 'Récemment utilisées', financial: 'Financier', logical: 'Logique', text: 'Texte', dateTime: 'Date et heure', lookup: 'Recherche et référence', math: 'Maths et trigonométrie', moreFns: 'Plus de fonctions',
  nameManager: 'Gestionnaire de noms', defineName: 'Définir un nom', useInFormula: 'Utiliser dans la formule',
  precedents: 'Repérer les antécédents', dependents: 'Repérer les dépendants', removeArrows: 'Supprimer les flèches', showFormulas: 'Afficher les formules', evaluate: 'Évaluation de formule',
  calcOptions: 'Options de calcul', calcAuto: 'Automatique', calcManual: 'Manuel', calcNow: 'Calculer maintenant',
} as const;
