// Etat du document : classeur immuable + pile annuler/retablir (History de @forgeoffice/core) + moteur synchronise.
import { useSyncExternalStore } from 'react';
import { History } from '@forgeoffice/core';
import type { Workbook } from '@forgeoffice/xlsx';
import { Draft } from '../logic/draft.ts';
import { WorkbookEngine } from '../logic/engine.ts';

export class DocStore {
  private history: History<Workbook>;
  engine: WorkbookEngine;
  private readonly listeners = new Set<() => void>();
  private ver = 0;
  /** Version au dernier enregistrement (pour l'indicateur « Modifie »). */
  savedVersion: Workbook;

  constructor(wb: Workbook) {
    this.history = new History(wb, { limit: 100 });
    this.engine = new WorkbookEngine(wb.date1904);
    this.engine.sync(wb);
    this.savedVersion = wb;
  }

  get wb(): Workbook {
    return this.history.state;
  }

  get version(): number {
    return this.ver;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  get modified(): boolean {
    return this.wb !== this.savedVersion;
  }

  /** Applique une modification ; `fn` peut renvoyer false pour l'annuler. `group` fusionne les frappes successives. */
  commit(fn: (d: Draft) => void | boolean, group: string | null = null): boolean {
    const d = new Draft(this.wb);
    if (fn(d) === false) return false;
    this.history.commit(d.wb, group);
    this.apply();
    return true;
  }

  undo(): void {
    if (!this.history.canUndo) return;
    this.history.undo();
    this.apply();
  }

  redo(): void {
    if (!this.history.canRedo) return;
    this.history.redo();
    this.apply();
  }

  /** Nouveau document (ouverture) : historique vide, moteur reconstruit. */
  reset(wb: Workbook): void {
    this.history.reset(wb);
    this.engine = new WorkbookEngine(wb.date1904);
    this.savedVersion = wb;
    this.apply();
  }

  markSaved(): void {
    this.savedVersion = this.wb;
    this.notify();
  }

  /** Signale un changement d'affichage sans modification du classeur (recalcul F9). */
  notify(): void {
    this.ver++;
    for (const l of this.listeners) l();
  }

  private apply(): void {
    this.engine.sync(this.wb);
    this.notify();
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

/** Rend le composant a chaque modification du document. */
export function useDoc(store: DocStore): number {
  return useSyncExternalStore(store.subscribe, () => store.version);
}
