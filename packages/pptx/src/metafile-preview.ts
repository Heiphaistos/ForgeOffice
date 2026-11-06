// Rendu de repli des images EMF / WMF : conversion en SVG (affichable partout) conservee a cote des octets d'origine.
import { metafileToSvg } from '@forgeoffice/opc';
import type { MediaItem } from './model.ts';

const METAFILE = /^image\/(x-emf|x-wmf|emf|wmf)$/;

/** Ajoute `preview` (SVG) a un media EMF / WMF convertible ; les autres media sont renvoyes tels quels. */
export function withMetafilePreview(item: MediaItem): MediaItem {
  if (!METAFILE.test(item.contentType) && !/^(emf|wmf)$/.test(item.extension)) return item;
  const svg = metafileToSvg(item.bytes);
  if (svg) item.preview = { contentType: 'image/svg+xml', bytes: new TextEncoder().encode(svg) };
  return item;
}

/** Media a afficher : le rendu SVG d'un metafichier, sinon le media lui-meme. */
export function displayMedia(item: MediaItem | undefined): { contentType: string; bytes: Uint8Array } | undefined {
  return item ? (item.preview ?? item) : undefined;
}
