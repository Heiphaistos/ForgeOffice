// Export PDF vectoriel (texte selectionnable) : reutilise le moteur PDF de la Presentation, page par page, avec les coupures de ligne
// de l'ecran. Limites : polices standard du PDF, pas d'imposition ni de traits de coupe ; l'habillage, les colonnes et les lettrines
// ne sont reproduits que dans la mesure ou le moteur les connait (utiliser le PDF imprimeur pour une fidelite totale).
import { buildVectorPdf } from '../../../powerpoint/src/pdf/index.ts';
import { S } from '../strings.ts';
import { pageProps, type Editor } from './editor.ts';
import { baseName } from './export.ts';
import { afterFonts } from './measure.ts';

/** Largeur a l'ecran d'un texte (canvas 2D) : les lignes du PDF reprennent les coupures de l'editeur. */
function canvasMeasure(): (text: string, css: string) => number {
  const g = document.createElement('canvas').getContext('2d');
  return (text, css) => {
    if (!g) return text.length * 8;
    g.font = css;
    return g.measureText(text).width;
  };
}

export async function exportVectorPdf(ed: Editor): Promise<void> {
  try {
    ed.notify(S.file.exporting, 'info');
    const { deck, pub } = ed.doc;
    const pages = deck.slides.map((slide, i) => ({ width: deck.size.width, height: deck.size.height, ...pageProps(deck, slide, i, pub) }));
    const result = await buildVectorPdf(pages, { title: deck.properties.title || baseName(ed.file.name), creator: 'ForgeOffice Publication', screen: canvasMeasure() });
    const saved = await ed.services.saveFile(result.bytes, `${baseName(ed.file.name)} - vectoriel.pdf`, [{ name: S.file.formats.pdf, extensions: ['pdf'] }], null);
    if (saved) ed.notify(S.file.exported(saved.name) + (result.lossyText ? ` ${S.file.vectorLossy}` : ''), 'success');
  } catch (err) {
    ed.notify(`${S.file.exportFailed} ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

