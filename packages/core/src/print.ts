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

/**
 * CSS d'impression de feuilles de taille propre (diapositives, pages de publication) sur le papier choisi dans la boite d'impression.
 * Une `@page { size: <largeur> <hauteur> }` explicite est ignoree des que le papier choisi est autre (A4 par defaut) : le moteur remet
 * alors ses marges (en-tete date / titre / URL imprimes, feuille en trop). On ne donne donc que l'orientation, marge 0, et chaque page
 * (`w` x `h` unites de conception en pt) est mise a l'echelle pour tenir dans la feuille (jamais agrandie), centree, une par feuille.
 */
export function fitSheetCss(sheet: string, page: string, w: number, h: number): string {
  const landscape = w >= h;
  const [pw, ph] = landscape ? [1056, 794] : [794, 1056]; // px CSS : le plus petit de A4 et Lettre US
  const zoom = (4 / 3) * Math.min(1, pw / ((w * 4) / 3), ph / ((h * 4) / 3));
  return `@page { size: ${landscape ? 'landscape' : 'portrait'}; margin: 0; } @media print { ${sheet} { box-sizing: border-box; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden; break-after: page; page-break-after: always; } ${page} { flex: none; width: ${w}px; height: ${h}px; zoom: ${zoom}; break-after: auto; page-break-after: auto; } }`;
}
