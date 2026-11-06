// Clavier de la grille : les raccourcis vivent dans keys-nav.ts, keys-format.ts, keys-edit.ts (grille) et keys-entry.ts (saisie),
// enregistres dans le registre (registry.ts) ; ce fichier ne fait que les charger et envoyer la touche.
import type { KeyboardEvent } from 'react';
import { dispatchKey } from './registry.ts';
import type { GridKeyApi } from './keys-types.ts';
import './keys-nav.ts';
import './keys-format.ts';
import './keys-edit.ts';
import './keys-entry.ts';
import './keys-select.ts';
import './keys-dialogs.tsx';

export type { GridKeyApi as KeyApi } from './keys-types.ts';

/** Traite une touche de la grille (hors saisie) ; vrai si un raccourci l'a prise (l'appelant fait preventDefault). */
export function handleGridKey(e: KeyboardEvent<HTMLElement>, k: GridKeyApi): boolean {
  return dispatchKey('grid', e, k);
}
