// Textes (messages d'erreur montres a l'utilisateur) du paquet de format Tableur.

export const strings = {
  notSpreadsheet: 'Ce fichier n’est pas un classeur reconnu.',
  zipInvalid: 'Le classeur est endommagé (archive illisible).',
  noWorkbookPart: 'Le classeur ne contient pas de partie « workbook ».',
  noSheets: 'Le classeur ne contient aucune feuille.',
  tooManySheets: 'Le classeur contient trop de feuilles.',
  tooManyCells: 'La feuille contient trop de cellules pour être ouverte.',
  xlsEncrypted: 'Ce classeur Excel 97-2003 est protégé par mot de passe : ouverture impossible.',
  xlsInvalid: 'Le fichier Excel 97-2003 est endommagé ou n’est pas au format BIFF8.',
  xlsTooOld: 'Ce fichier Excel est antérieur à Excel 97 : ouverture impossible.',
  cfbInvalid: 'Le conteneur OLE du fichier est endommagé.',
  odsInvalid: 'Le classeur OpenDocument est endommagé.',
  csvTooLarge: 'Le fichier texte dépasse la taille maximale d’une feuille.',
  sheetPrefix: 'Feuil',
  threadedPlaceholder: '[Commentaire de fil]\nVotre version d’Excel vous permet de lire ce commentaire de fil, mais toute modification sera supprimée si le fichier est ouvert dans une version plus récente d’Excel.',
} as const;

/** Erreur de lecture ou d'ecriture d'un classeur (message en francais pour l'utilisateur). */
export class SpreadsheetError extends Error {}
