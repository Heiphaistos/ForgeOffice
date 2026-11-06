// Cote diaporama de la synchronisation entre deux fenetres : diffuse l'etat et applique les commandes du presentateur.
import { useEffect, useRef } from 'react';
import { writePptx, type Deck } from '@forgeoffice/pptx';
import { ShowLeader, type ShowCommand, type ShowSnapshot } from './show-sync.ts';

const PUBLISH_MS = 250;

export function useShowLeader(sync: { openWindow: boolean } | undefined, deck: Deck, name: string, getState: () => ShowSnapshot, run: (cmd: ShowCommand, pos?: number) => void): void {
  const state = useRef(getState);
  const command = useRef(run);
  const current = useRef(deck);
  state.current = getState;
  command.current = run;
  current.current = deck;
  const on = !!sync;
  const open = !!sync?.openWindow;
  useEffect(() => {
    if (!on) return;
    const leader = new ShowLeader(
      async () => ({ bytes: await writePptx(current.current, { format: 'pptx' }), name }),
      (cmd, pos) => command.current(cmd, pos),
    );
    if (open) leader.announce();
    leader.publish(state.current());
    const timer = window.setInterval(() => leader.publish(state.current()), PUBLISH_MS);
    return () => {
      window.clearInterval(timer);
      leader.close();
    };
  }, [on, open, name]);
}
