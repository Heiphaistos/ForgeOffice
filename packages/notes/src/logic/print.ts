// Impression : chaine CSS sure pour l'en-tete (nom du fichier) des marges de page.

/** Chaine CSS entre guillemets ; antislash, guillemets et retours a la ligne neutralises. */
export function cssString(text: string): string {
  return `"${text.replace(/[\\"]/g, '\\$&').replace(/[\r\n\f\u2028\u2029]/g, ' ').slice(0, 200)}"`;
}

/** Feuille @page : en-tete = nom du fichier, pied = « Page n / N ». */
export function pageCss(name: string, page: string, of: string): string {
  return `@page { margin: 18mm 15mm; @top-center { content: ${cssString(name)}; font: 9pt sans-serif; color: #000; } @bottom-center { content: ${cssString(`${page} `)} counter(page) ${cssString(` ${of} `)} counter(pages); font: 9pt sans-serif; color: #000; } }`;
}
