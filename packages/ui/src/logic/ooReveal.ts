// « Ouvrir l'emplacement du fichier » du profil OnlyOffice : le module publie le fichier ouvert et la fonction du Services (bureau seulement),
// la rangee d'onglets et la vue Fichier s'y abonnent. Absent (navigateur, document sans chemin) = bouton grise.
import { useEffect, useSyncExternalStore } from 'react';

type Reveal = (() => void) | null;
let current: Reveal = null;
const listeners = new Set<() => void>();

/** Publie (ou retire) l'action ; appelee par chaque module avec le chemin du document et `services.revealInFolder`. */
export function useRevealFile(path: string | null | undefined, services: { revealInFolder?(path: string): Promise<void> }): void {
  useEffect(() => {
    current = path && services.revealInFolder ? () => void services.revealInFolder?.(path).catch(() => undefined) : null;
    listeners.forEach((l) => l());
    return () => { current = null; listeners.forEach((l) => l()); };
  }, [path, services]);
}

export function useRevealAction(): Reveal {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => current);
}
