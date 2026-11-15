// Impression d'un cadre d'onglet (iframe). WebView2 n'imprime que la page de plus haut niveau, et il n'applique ni
// `@media print` ni `@page` aux cadres : `print_window` imprimerait la barre d'onglets et le cadre tel qu'a l'ecran
// (1 feuille rognee). On « emprunte » donc la page hote le temps de l'impression : l'arbre du cadre (#root et portails, avec ses
// canvas et son etat) est deplace dans l'hote, les feuilles de style du cadre sont copiees dans l'hote, puis tout est
// remis en place a la fin (`afterprint`, filet 5 min). Les regles d'impression du module s'appliquent alors a la vraie page.

const MARK = 'data-fo-frame-print';

/** Copie les feuilles de style du cadre dans l'hote ; renvoie les copies (a retirer ensuite). */
export function copyStyles(from: Document, to: Document): HTMLElement[] {
  const copies: HTMLElement[] = [];
  for (const el of Array.from(from.head.querySelectorAll('style, link[rel="stylesheet"]'))) {
    const copy = to.importNode(el, true) as HTMLElement;
    copy.setAttribute(MARK, '');
    to.head.append(copy);
    copies.push(copy);
  }
  return copies;
}

/** Enfants de <body> a deplacer : #root et les portails (zone d'impression de Tableur, etc.), pas les balises techniques. */
const movable = (doc: Document): Element[] => Array.from(doc.body.children).filter((el) => !['SCRIPT', 'STYLE', 'LINK'].includes(el.tagName));

/** Imprime le cadre courant par la page hote ; remet tout en place des que l'impression est finie. */
export function printFrame(hostPrint: () => void): void {
  const hostDoc = window.parent.document;
  const hostRoot = hostDoc.getElementById('root');
  const moved = movable(document);
  if (window.parent === window || !hostRoot || moved.length === 0) {
    hostPrint();
    return;
  }
  const styles = copyStyles(document, hostDoc);
  hostRoot.setAttribute(MARK, '');
  const hide = hostDoc.createElement('style');
  hide.setAttribute(MARK, '');
  hide.textContent = `@media print { #root[${MARK}] { display: none !important; } }`;
  hostDoc.head.append(hide);
  // Un repere (commentaire) tient la place de chaque element dans le cadre.
  const marks = moved.map((el) => {
    const mark = document.createComment('fo-print');
    el.replaceWith(mark);
    hostDoc.body.append(hostDoc.adoptNode(el));
    return mark;
  });
  let over = false;
  const end = (): void => {
    if (over) return;
    over = true;
    window.parent.removeEventListener('afterprint', end);
    moved.forEach((el, i) => marks[i]!.replaceWith(document.adoptNode(el)));
    hostRoot.removeAttribute(MARK);
    hide.remove();
    for (const st of styles) st.remove();
  };
  window.parent.addEventListener('afterprint', end);
  window.setTimeout(end, 300_000);
  hostPrint();
}
