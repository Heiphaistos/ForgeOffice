// Etat de la presentation : historique annuler / retablir (History de @forgeoffice/core), indicateur de modification.
import { useCallback, useMemo, useRef, useState } from 'react';
import { History } from '@forgeoffice/core';
import type { Deck } from '@forgeoffice/pptx';

export interface DeckState {
  deck: Deck;
  /** Enregistre un nouvel etat ; `group` fusionne les petites modifications successives (frappe). */
  commit: (next: Deck, group?: string | null) => void;
  /** Remplace sans historique (ouverture). */
  reset: (next: Deck) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  modified: boolean;
  markSaved: () => void;
  /** Compteur de modifications (sauvegarde de recuperation). */
  revision: number;
}

export function useDeck(initial: () => Deck, onModified: (modified: boolean) => void): DeckState {
  const history = useRef<History<Deck> | null>(null);
  if (!history.current) history.current = new History(initial(), { limit: 300, mergeMs: 1000 });
  const h = history.current;
  const [deck, setDeck] = useState(h.state);
  const [revision, setRevision] = useState(0);
  const savedAt = useRef<Deck>(h.state);
  const [modified, setModified] = useState(false);

  const sync = useCallback(() => {
    setDeck(h.state);
    setRevision((r) => r + 1);
    const m = h.state !== savedAt.current;
    setModified(m);
    onModified(m);
  }, [h, onModified]);

  const commit = useCallback(
    (next: Deck, group: string | null = null) => {
      h.commit(next, group);
      sync();
    },
    [h, sync],
  );
  const reset = useCallback(
    (next: Deck) => {
      h.reset(next);
      savedAt.current = next;
      sync();
    },
    [h, sync],
  );
  const undo = useCallback(() => {
    h.undo();
    sync();
  }, [h, sync]);
  const redo = useCallback(() => {
    h.redo();
    sync();
  }, [h, sync]);
  const markSaved = useCallback(() => {
    savedAt.current = h.state;
    setModified(false);
    onModified(false);
  }, [h, onModified]);

  return useMemo(
    () => ({ deck, commit, reset, undo, redo, canUndo: h.canUndo, canRedo: h.canRedo, modified, markSaved, revision }),
    [deck, commit, reset, undo, redo, modified, markSaved, revision],
  );
}
