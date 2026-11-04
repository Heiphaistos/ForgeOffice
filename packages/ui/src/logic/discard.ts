// Garde « document modifie » : Enregistrer / Ne pas enregistrer / Annuler avant tout remplacement ou fermeture.

export type DiscardAnswer = 'save' | 'discard' | 'cancel';

/**
 * Vrai si l'on peut remplacer ou fermer le document. Document intact : oui sans rien demander.
 * `save` renvoie vrai si l'enregistrement a abouti (un « Enregistrer sous » annule bloque l'operation).
 */
export async function guardUnsaved(modified: boolean, ask: () => Promise<DiscardAnswer>, save: () => Promise<boolean>): Promise<boolean> {
  if (!modified) return true;
  const answer = await ask();
  if (answer === 'cancel') return false;
  if (answer === 'save') return save();
  return true;
}
