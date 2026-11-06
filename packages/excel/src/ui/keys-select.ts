// Modes de selection au clavier : F8 (Etendre la selection) et Maj+F8 (Ajouter a la selection). Les fleches agissent comme Maj+fleches
// (etendre) ou ajoutent une cellule a une selection discontinue ; Echap et la frappe d'une cellule quittent le mode.
import { extendBy, moveActive, type Selection } from '../logic/selection.ts';
import { S } from '../strings/index.ts';
import { registerShortcuts, type ShortcutDef } from './registry.ts';
import type { GridKeyApi } from './keys-types.ts';

type SelectionMode = 'extend' | 'add' | null;
let mode: SelectionMode = null;
/** Nombre de plages deja choisies quand le mode Ajout a commence (elles restent ; la derniere est la cellule courante). */
let addBase = 0;

export const selectionMode = (): SelectionMode => mode;
export const selectionModeLabel = (): string | undefined => (mode === 'extend' ? S.keys.extendMode : mode === 'add' ? S.keys.addMode : undefined);
/** Quitte le mode (Echap, saisie) ; vrai s'il y en avait un. */
export function resetSelectionMode(): boolean {
  const was = mode !== null;
  mode = null;
  return was;
}

/** Copie la selection pour que l'application se redessine (barre d'etat : changement de mode). */
const refresh = (k: GridKeyApi): void => k.setSel({ ...k.sel });

const ARROWS = [['ArrowUp', -1, 0], ['ArrowDown', 1, 0], ['ArrowLeft', 0, -1], ['ArrowRight', 0, 1]] as const;

/** Selection apres une fleche dans le mode en cours. */
export function stepInMode(sel: Selection, dr: number, dc: number): Selection {
  if (mode === 'add') {
    const next = moveActive(sel, dr, dc);
    return { ranges: [...sel.ranges.slice(0, addBase), ...next.ranges], active: next.active, anchor: next.anchor };
  }
  return extendBy(sel, dr, dc);
}

registerShortcuts<'grid'>([
  {
    id: 'select.extend', context: 'grid', combo: 'F8',
    run: (k) => {
      mode = mode === 'extend' ? null : 'extend';
      refresh(k);
    },
  },
  {
    id: 'select.add', context: 'grid', combo: 'Shift+F8',
    run: (k) => {
      if (mode === 'add') mode = null;
      else {
        mode = 'add';
        addBase = k.sel.ranges.length;
      }
      refresh(k);
    },
  },
  ...ARROWS.map(([key, dr, dc]): ShortcutDef<'grid'> => ({
    id: `select.mode.${key}`, context: 'grid', combo: key, priority: 50,
    when: () => mode !== null,
    run: (k) => k.setSel(stepInMode(k.sel, dr, dc)),
  })),
  {
    id: 'select.escape', context: 'grid', combo: '~Ctrl+~Shift+~Alt+Escape', priority: 50,
    when: () => mode !== null,
    run: (k) => {
      resetSelectionMode();
      refresh(k);
      return false; // l'Echap normal (presse-papiers, pinceau) continue
    },
  },
]);
