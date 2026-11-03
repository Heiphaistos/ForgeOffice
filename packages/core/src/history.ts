// Pile annuler/retablir generique pour les modeles immuables (Tableur, Presentation, Publication, Base).
// Le module Texte utilise l'historique de ProseMirror.

export interface HistoryOptions {
  /** Nombre maximal d'etats conserves (defaut 200). */
  limit?: number;
  /** Deux validations du meme groupe a moins de `mergeMs` ms fusionnent (frappe continue). */
  mergeMs?: number;
}

export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  private lastGroup: string | null = null;
  private lastTime = 0;
  private readonly limit: number;
  private readonly mergeMs: number;
  private current: T;

  constructor(initial: T, options: HistoryOptions = {}) {
    this.current = initial;
    this.limit = options.limit ?? 200;
    this.mergeMs = options.mergeMs ?? 800;
  }

  get state(): T {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Enregistre un nouvel etat. `group` permet de fusionner les petites modifications successives. */
  commit(next: T, group: string | null = null, now: number = Date.now()): void {
    if (next === this.current) return;
    const merge = group !== null && group === this.lastGroup && now - this.lastTime < this.mergeMs;
    if (!merge) {
      this.past.push(this.current);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.current = next;
    this.future = [];
    this.lastGroup = group;
    this.lastTime = now;
  }

  undo(): T {
    const previous = this.past.pop();
    if (previous === undefined) return this.current;
    this.future.push(this.current);
    this.current = previous;
    this.lastGroup = null;
    return this.current;
  }

  redo(): T {
    const next = this.future.pop();
    if (next === undefined) return this.current;
    this.past.push(this.current);
    this.current = next;
    this.lastGroup = null;
    return this.current;
  }

  /** Remplace l'etat sans historique (ouverture d'un fichier). */
  reset(state: T): void {
    this.current = state;
    this.past = [];
    this.future = [];
    this.lastGroup = null;
  }
}
