// Libelles du ruban : Accueil : presse-papiers, police, alignement, nombre, mise en forme conditionnelle, styles.

export const rbHome = {
  paste: 'Coller', pasteValues: 'Coller les valeurs', pasteFormulas: 'Formules', pasteFormats: 'Mise en forme', pasteTranspose: 'Transposer', pasteSpecial: 'Collage spécial…',
  cut: 'Couper', copy: 'Copier', painter: 'Reproduire la mise en forme',
  font: 'Police', size: 'Taille de police', grow: 'Augmenter la taille de police', shrink: 'Réduire la taille de police',
  bold: 'Gras', italic: 'Italique', underline: 'Souligner', underlineDouble: 'Souligné double', strike: 'Barré',
  borders: 'Bordures', fill: 'Couleur de remplissage', fontColor: 'Couleur de police',
  b: { bottom: 'Bordure inférieure', top: 'Bordure supérieure', left: 'Bordure gauche', right: 'Bordure droite', none: 'Aucune bordure', all: 'Toutes les bordures', outside: 'Bordures extérieures', thickOutside: 'Bordure épaisse en encadré', bottomDouble: 'Bordure double en bas', bottomThick: 'Bordure épaisse en bas', topBottom: 'Bordure en haut et en bas', topBottomThick: 'Bordure en haut et bordure épaisse en bas', topBottomDouble: 'Bordure en haut et bordure double en bas', inside: 'Bordures intérieures' } as Record<string, string>,
  alignTop: 'Aligner en haut', alignMiddle: 'Aligner au centre', alignBottom: 'Aligner en bas', alignLeft: 'Aligner à gauche', center: 'Centrer', alignRight: 'Aligner à droite',
  orientation: 'Orientation', rotUp: 'Rotation dans le sens inverse des aiguilles d’une montre', rotDown: 'Rotation dans le sens des aiguilles d’une montre', rotVertical: 'Texte vertical', rotNone: 'Horizontal',
  indentDec: 'Diminuer le retrait', indentInc: 'Augmenter le retrait', wrap: 'Renvoyer à la ligne automatiquement',
  merge: 'Fusionner et centrer', mergeAcross: 'Fusionner horizontalement', mergeCells: 'Fusionner les cellules', unmerge: 'Annuler Fusionner cellules',
  numFormat: 'Format de nombre', currency: 'Format Nombre Comptabilité', percent: 'Style de pourcentage', comma: 'Séparateur de milliers', decInc: 'Ajouter une décimale', decDec: 'Réduire les décimales',
  formats: {
    General: 'Standard', number: 'Nombre', currency: 'Monétaire', accounting: 'Comptabilité', shortDate: 'Date courte', longDate: 'Date longue',
    time: 'Heure', percent: 'Pourcentage', fraction: 'Fraction', scientific: 'Scientifique', text: 'Texte', more: 'Autres formats numériques…',
  } as Record<string, string>,
  cf: 'Mise en forme conditionnelle', cfHighlight: 'Règles de mise en surbrillance des cellules', cfTop: 'Règles des valeurs plus/moins élevées', cfBars: 'Barres de données', cfScales: 'Nuances de couleurs', cfIcons: 'Jeux d’icônes',
  cfGreater: 'Supérieur à…', cfLess: 'Inférieur à…', cfBetween: 'Entre…', cfEqual: 'Égal à…', cfText: 'Texte qui contient…', cfDate: 'Une date se produisant aujourd’hui', cfDup: 'Valeurs en double',
  cfTop10: '10 valeurs les plus élevées', cfTop10p: '10 % les plus élevés', cfBottom10: '10 valeurs les moins élevées', cfAbove: 'Valeurs supérieures à la moyenne', cfBelow: 'Valeurs inférieures à la moyenne',
  cfNew: 'Nouvelle règle…', cfClearSel: 'Effacer les règles des cellules sélectionnées', cfClearSheet: 'Effacer les règles de la feuille entière', cfManage: 'Gérer les règles…', cfClear: 'Effacer les règles',
  gradient: 'Dégradé', solid: 'Remplissage uni',
  cellStyles: 'Styles de cellules', asTable: 'Mettre sous forme de tableau',
  csNames: {
    normal: 'Normal', bad: 'Insatisfaisant', good: 'Satisfaisant', neutral: 'Neutre', calculation: 'Calcul', check: 'Vérification', explanatory: 'Explicatif', input: 'Entrée', linked: 'Cellule liée', note: 'Note', output: 'Sortie', warning: 'Avertissement',
    heading1: 'Titre 1', heading2: 'Titre 2', heading3: 'Titre 3', heading4: 'Titre 4', title: 'Titre', total: 'Total', comma: 'Milliers', comma0: 'Milliers [0]', currency: 'Monétaire', currency0: 'Monétaire [0]', percent: 'Pourcentage',
  } as Record<string, string>,
  accent: (n: string): string => n.replace(/^accent(\d)-(\d+)$/, '$2 % - Accent$1').replace(/^accent(\d)$/, 'Accent$1'),
  tsFamily: { Light: 'Clair', Medium: 'Moyen', Dark: 'Foncé' } as Record<string, string>,
  newTableStyle: 'Nouveau style de tableau…',
} as const;
