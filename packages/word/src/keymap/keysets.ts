// Jeux de raccourcis : francais (defaut, comme Word FR) ou anglais ; superposition sur les raccourcis communs.
import type { Command } from 'prosemirror-state';
import { setParagraph } from '../editor/commands.ts';

export type Keyset = 'fr' | 'en';
export const KEYSET_SETTING = 'word.keyset';
export const NBSP = ' ';

/** Raccourcis propres a un jeu ; `null` = touche libre dans ce jeu (la commande commune est retiree). */
export type KeyOverrides = Record<string, Command | null>;

/** Word FR : Ctrl+Maj+G/D alignent, Alt+Ctrl+C/V copient/collent la mise en forme, Alt+Ctrl+B/F notes, Alt+Maj+H heure. */
export function frenchKeys(ui: (id: 'copyFormat' | 'pasteFormat' | 'footnote' | 'endnote' | 'time') => Command): KeyOverrides {
  return {
    'Mod-Shift-g': setParagraph({ props: { alignment: 'left' } }),
    'Mod-Shift-d': setParagraph({ props: { alignment: 'right' } }),
    'Mod-Alt-c': ui('copyFormat'), 'Mod-Alt-v': ui('pasteFormat'),
    'Mod-Alt-b': ui('footnote'), 'Mod-Alt-f': ui('endnote'), 'Mod-Alt-d': null,
    'Alt-Shift-h': ui('time'), 'Alt-Shift-t': null,
    'Mod-Shift-c': null, 'Mod-Shift-v': null,
    'Mod-Shift-Space': (state, dispatch) => {
      if (dispatch) dispatch(state.tr.insertText(NBSP).scrollIntoView());
      return true;
    },
  };
}

/** Ajoute les raccourcis du jeu actif (lu a chaque frappe) par-dessus ceux de base. */
export function layerKeysets(base: Record<string, Command>, byKeyset: Partial<Record<Keyset, KeyOverrides>>, current: () => Keyset): Record<string, Command> {
  const out: Record<string, Command> = { ...base };
  const keys = new Set([...Object.keys(base), ...Object.values(byKeyset).flatMap((o) => Object.keys(o ?? {}))]);
  for (const key of keys) {
    out[key] = (state, dispatch, view) => {
      const over = byKeyset[current()];
      if (over && key in over) return over[key]?.(state, dispatch, view) ?? false;
      return base[key]?.(state, dispatch, view) ?? false;
    };
  }
  return out;
}
