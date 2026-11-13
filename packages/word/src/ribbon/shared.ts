// Aides communes aux onglets du ruban.
import type { CSSProperties } from 'react';
import { cssFontStack, effectiveRunProps, styleDisplayName, type RunProps, type Style, type WordDocument } from '@forgeoffice/docx';
import type { GalleryItem } from '@forgeoffice/ui';
import { T } from '../strings.ts';

/** Style React d'apercu (galerie de styles, menus). Taille plafonnee pour tenir dans la vignette. */
export function runPreview(meta: WordDocument, run: RunProps, maxPx = 18): CSSProperties {
  const font = run.fontTheme ? (run.fontTheme === 'major' ? meta.theme.majorFont : meta.theme.minorFont) : run.font;
  const color = run.color?.rgb && run.color.rgb !== 'auto' ? `#${run.color.rgb}` : undefined;
  return {
    fontFamily: font ? cssFontStack(font) : undefined,
    fontSize: Math.min(maxPx, ((run.size ?? 11) * 4) / 3),
    fontWeight: run.bold ? 700 : 400,
    fontStyle: run.italic ? 'italic' : 'normal',
    color,
    textDecoration: run.underline && run.underline !== 'none' ? 'underline' : undefined,
    fontVariant: run.smallCaps ? 'small-caps' : undefined,
    textTransform: run.caps ? 'uppercase' : undefined,
  };
}

/** Styles de la galerie (styles rapides du document), par priorite. */
export function quickStyles(meta: WordDocument): Style[] {
  return meta.styles.styles
    .filter((s) => s.quickFormat && !s.hidden && (s.type === 'paragraph' || s.type === 'character'))
    .sort((a, b) => (a.uiPriority ?? 99) - (b.uiPriority ?? 99));
}

// (copie locale : l'index de @forgeoffice/ui charge des feuilles CSS que les tests Node ne savent pas lire)
const isOnlyOffice = (): boolean => typeof document !== 'undefined' && document.documentElement.dataset.layout === 'onlyoffice';

export function styleGallery(meta: WordDocument): GalleryItem[] {
  return quickStyles(meta).map((s) => {
    const run = s.type === 'paragraph'
      ? effectiveRunProps(meta, { styleId: s.id }, { props: {} })
      : effectiveRunProps(meta, { styleId: undefined }, { styleId: s.id, props: {} });
    const isTitle = s.id === 'Title' || s.id.startsWith('Heading');
    return { id: s.id, label: styleDisplayName(s), sample: isOnlyOffice() ? (s.id === 'NoSpacing' ? 'Aucun espace' : styleDisplayName(s)) : isTitle ? T.styles.title : T.styles.hint, style: runPreview(meta, run) };
  });
}

/** « #RRGGBB » d'une couleur de texte, ou null (automatique). */
export function colorHex(run: RunProps): string | null {
  const rgb = run.color?.rgb;
  return rgb && rgb !== 'auto' ? `#${rgb}` : null;
}

/** Points -> centimetres arrondis (affichage des dialogues et menus). */
export const ptToCm = (pt: number): number => Math.round((pt * 2.54 / 72) * 100) / 100;
export const cmToPt = (cm: number): number => Math.round((cm * 72 / 2.54) * 100) / 100;

/** Centimetres affiches a la francaise (« 2,5 »). */
export const cmLabel = (pt: number): string => ptToCm(pt).toLocaleString('fr-FR');
