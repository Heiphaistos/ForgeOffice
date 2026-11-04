// Attente du chargement des polices avant toute mesure de texte (pagination, largeurs de colonnes).
// Une police embarquee (@font-face) ne se charge qu'a son premier usage : document.fonts.ready seul ne suffit pas,
// d'ou le chargement explicite des familles demandees (normal et gras).

/** Delai maximal : une police qui n'arrive pas ne doit jamais bloquer le document. */
const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Resolue quand les polices sont pretes. `families` : familles du document a charger avant de mesurer
 * (ex. ['Calibri', 'Arial']). Sans navigateur (tests) ou sans API de polices, resolue aussitot. Ne rejette jamais.
 */
export function whenFontsReady(families: readonly string[] = [], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  const set = typeof document === 'undefined' ? undefined : document.fonts;
  if (!set) return Promise.resolve();
  const loads = families.flatMap((f) => [`12px "${f}"`, `bold 12px "${f}"`].map((spec) => set.load(spec).catch(() => [])));
  const ready = Promise.all([...loads, set.ready]).then(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  return Promise.race([ready, timeout]).finally(() => clearTimeout(timer));
}
