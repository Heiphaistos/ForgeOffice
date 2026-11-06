// Garde le focus dans la boite ouverte : un bouton qui disparait ou se desactive apres un clic (Supprimer, Convertir en nombre...)
// fait tomber le focus sur la page, et Echap / Entree n'atteignent alors plus la boite.
import { useEffect } from 'react';

/** Apres chaque changement de `deps`, ramene le focus sur le bouton principal de la boite si le focus l'a quittee. */
export function useDialogFocus(deps: readonly unknown[]): void {
  useEffect(() => {
    const dlg = document.querySelector<HTMLElement>('.fo-dialog');
    const a = document.activeElement as (HTMLElement & { disabled?: boolean }) | null;
    // Un bouton qui vient d'etre desactive garde le focus sans plus recevoir les touches.
    if (!dlg || (a && dlg.contains(a) && !a.disabled)) return;
    dlg.querySelector<HTMLElement>('.fo-btn--primary:not([disabled])')?.focus();
  }, deps);
}
