// Historique de versions : liste bornee de copies horodatees d'un classeur ; fonctions pures (le stockage est dans ui/versions-store.ts).
export interface VersionInfo {
  id: string;
  name: string;
  /** Date ISO de la copie. */
  at: string;
  size: number;
  /** Empreinte du contenu (pour ne pas enregistrer deux fois la meme version). */
  digest: string;
}

/** Empreinte simple (FNV-1a 32 bits) des octets. */
export function digestOf(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i] ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${bytes.length.toString(16)}-${h.toString(16)}`;
}

/** Ajoute une version en tete (la plus recente d'abord) sauf si elle est identique a la derniere ; garde au plus `max` versions. Renvoie la liste et les versions evincees. */
export function pushVersion(list: readonly VersionInfo[], next: VersionInfo, max: number): { list: VersionInfo[]; dropped: VersionInfo[] } {
  if (list[0]?.digest === next.digest) return { list: [...list], dropped: [] };
  const all = [next, ...list];
  return { list: all.slice(0, max), dropped: all.slice(max) };
}
