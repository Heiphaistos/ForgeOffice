// F4 / Ctrl+Y : repeter la derniere action de mise en forme tapee au clavier.
import type { Command } from 'prosemirror-state';

/** Enveloppe les commandes `keys` pour memoriser la derniere qui a abouti ; renvoie la commande « Repeter ». */
export function recordRepeatable(bindings: Record<string, Command>, keys: readonly string[]): Command {
  let last: Command | null = null;
  for (const key of keys) {
    const cmd = bindings[key];
    if (!cmd) continue;
    bindings[key] = (state, dispatch, view) => {
      const done = cmd(state, dispatch, view);
      if (done && dispatch) last = cmd;
      return done;
    };
  }
  return (state, dispatch, view) => (last ? last(state, dispatch, view) : false);
}
