// Empreinte d'un fichier tel qu'il est sur le disque : sert a detecter une modification faite par un autre programme
// (le contrat Services ne donne pas la date du fichier, on compare donc le contenu relu au retour dans la fenetre).

/** Longueur + FNV-1a 32 bits : suffit pour reperer un changement, pas pour la securite. */
export function diskSignature(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i]!, 0x01000193);
  return `${bytes.length}:${(h >>> 0).toString(16)}`;
}

export type ExternalChange = 'same' | 'reload' | 'conflict';

/** Que faire quand le contenu relu differe de celui connu : recharger si l'onglet n'a pas de modification non enregistree. */
export function externalChange(known: string | null, current: string, dirty: boolean): ExternalChange {
  if (known === null || known === current) return 'same';
  return dirty ? 'conflict' : 'reload';
}
