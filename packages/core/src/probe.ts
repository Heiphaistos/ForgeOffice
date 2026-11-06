// Crochet de test (banc de conformite) : chaque module y declare comment lire son document. Utilise seulement en developpement
// (`import.meta.env.DEV`) : les appelants gardent l'appel derriere ce test pour que le build de production ne l'embarque pas.

export interface ModuleProbe {
  /** Etats de selection que `select` sait preparer (texte, mot, tableau...). */
  presets: readonly string[];
  /** JSON stable du modele de document (jamais du DOM). */
  snapshot(): unknown;
  /** Prepare une selection ; false si le document de test n'a pas l'element. */
  select(preset: string): boolean | Promise<boolean>;
}

let current: ModuleProbe | null = null;

export function registerProbe(probe: ModuleProbe): () => void {
  current = probe;
  return () => {
    if (current === probe) current = null;
  };
}

export function currentProbe(): ModuleProbe | null {
  return current;
}
