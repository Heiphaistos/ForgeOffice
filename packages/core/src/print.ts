// Fin d'une impression. Dans le navigateur `window.print()` bloque jusqu'a la fermeture de la boite ; dans le moteur web
// d'une appli (WebView2 : print_window) il rend la main tout de suite alors que l'apercu est encore rendu depuis la page
// vivante : retirer la mise en page d'impression juste apres `print()` donne un apercu faux (ecarts de pagination, page
// blanche finale, conteneur vide). On attend donc `afterprint` (filet : `maxMs`).
/** Appelle `done` une seule fois a la fin de l'impression. A appeler AVANT `print()`. */
export function afterPrint(done: () => void, maxMs = 300_000): void {
  let over = false;
  let timer = 0;
  const end = (): void => {
    if (over) return;
    over = true;
    window.removeEventListener('afterprint', end);
    window.clearTimeout(timer);
    done();
  };
  window.addEventListener('afterprint', end);
  timer = window.setTimeout(end, maxMs);
}
