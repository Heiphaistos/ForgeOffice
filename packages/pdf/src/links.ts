// Adresses de liens (sans DOM, teste) : seules les adresses sures s'ouvrent, jamais javascript: ni data: ni file:.

const ALLOWED = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/** Adresse nettoyee si elle est autorisee ; sinon null. */
export function safeUrl(raw: string): string | null {
  const text = raw.trim();
  if (text === '' || text.length > 4096) return null;
  try {
    const url = new URL(text);
    return ALLOWED.has(url.protocol) ? url.href : null;
  } catch {
    return null; // pas une adresse absolue valide
  }
}

/** Destination affichee dans la confirmation (hote pour http(s), adresse entiere sinon). */
export function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.host : url;
  } catch {
    return url;
  }
}
