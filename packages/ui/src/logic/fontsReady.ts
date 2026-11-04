// Attente du chargement des polices avant toute mesure de texte (pagination, largeurs de colonnes).
// Une police embarquee (@font-face) ne se charge qu'a son premier usage : document.fonts.ready seul ne suffit pas,
// d'ou le chargement explicite des familles demandees (normal et gras).

/** Delai maximal : une police qui n'arrive pas ne doit jamais bloquer le document. */
const DEFAULT_TIMEOUT_MS = 3000;

/** Partie de `document.fonts` utilisee ici (injectable dans les tests). */
export interface FontSetLike {
  load(spec: string): Promise<unknown>;
  readonly ready: Promise<unknown>;
  addEventListener?(type: 'loadingdone', listener: () => void): void;
  removeEventListener?(type: 'loadingdone', listener: () => void): void;
}

function defaultSet(): FontSetLike | undefined {
  return typeof document === 'undefined' ? undefined : (document.fonts as FontSetLike | undefined);
}

/**
 * Resolue quand les polices sont pretes. `families` : familles du document a charger avant de mesurer
 * (ex. ['Calibri', 'Arial']). Sans navigateur (tests) ou sans API de polices, resolue aussitot. Ne rejette jamais.
 */
export function whenFontsReady(families: readonly string[] = [], timeoutMs = DEFAULT_TIMEOUT_MS, set: FontSetLike | undefined = defaultSet()): Promise<void> {
  if (!set) return Promise.resolve();
  const loads = families.flatMap((f) => [`12px "${f}"`, `bold 12px "${f}"`].map((spec) => set.load(spec).catch(() => [])));
  const ready = Promise.all([...loads, set.ready]).then(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  return Promise.race([ready, timeout]).finally(() => clearTimeout(timer));
}

export interface RemeasureOptions {
  timeoutMs?: number;
  /** Ensemble de polices (par defaut `document.fonts`). */
  set?: FontSetLike;
}

/**
 * Refait une mesure quand les polices sont chargees : `redo` est appele une fois apres le chargement des familles
 * (la mesure faite AVANT le chargement etait fausse), puis a chaque nouveau chargement de police (`loadingdone`).
 * `families` peut etre une fonction (familles du document courant). Retourne la fonction d'arret.
 */
export function remeasureWhenFontsReady(redo: () => void, families: readonly string[] | (() => readonly string[]) = [], options: RemeasureOptions = {}): () => void {
  const set = options.set ?? defaultSet();
  if (!set) return () => undefined;
  let stopped = false;
  const run = (): void => {
    if (!stopped) redo();
  };
  void whenFontsReady(typeof families === 'function' ? families() : families, options.timeoutMs, set).then(run);
  set.addEventListener?.('loadingdone', run);
  return () => {
    stopped = true;
    set.removeEventListener?.('loadingdone', run);
  };
}

export interface FontsEpoch {
  subscribe(listener: () => void): () => void;
  /** Change a chaque fin de chargement de police : sert de cle pour refaire un rendu ou une mesure. */
  get(): number;
}

/** Compteur partage (un seul ecouteur pour tous les composants) incremente quand des polices finissent de charger. */
export function createFontsEpoch(set: FontSetLike | undefined = defaultSet()): FontsEpoch {
  let epoch = 0;
  let started = false;
  const listeners = new Set<() => void>();
  const bump = (): void => {
    epoch++;
    listeners.forEach((l) => l());
  };
  return {
    get: () => epoch,
    subscribe(listener) {
      listeners.add(listener);
      if (set && !started) {
        started = true;
        set.addEventListener?.('loadingdone', bump);
        void set.ready.then(bump);
      }
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
