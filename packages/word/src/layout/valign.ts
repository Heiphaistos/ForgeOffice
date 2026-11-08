// Alignement vertical du contenu de chaque page (haut, centré, bas), sans DOM : décale le contenu en jouant sur les espaces entre pages.
import type { PageGap, Pagination } from './paginate.ts';

export type VAlign = 'top' | 'center' | 'bottom' | 'both';

export interface AlignBlock {
  pos: number;
  top: number;
  bottom: number;
}

/**
 * Espaces corriges : le contenu de la page k descend de d_k (la moitie ou la totalite de l'espace libre en bas de page) ;
 * l'espace qui precede la page k augmente de d_k et diminue de d_(k-1), de sorte que les pages suivantes ne bougent pas.
 * `contentHeights` et `aligns` : une valeur par page. Renvoie les espaces d'origine si la structure est inattendue (pages blanches de parite).
 */
export function alignPages(blocks: readonly AlignBlock[], pagination: Pagination, contentHeights: readonly number[], aligns: readonly VAlign[]): PageGap[] {
  const { pageStarts, gaps } = pagination;
  if (!aligns.some((a) => a === 'center' || a === 'bottom') || blocks.length === 0 || pageStarts.length !== gaps.length + 1) return gaps;
  const lastBottom = Math.max(...blocks.map((b) => b.bottom));
  const shift = pageStarts.map((start, k) => {
    const end = pageStarts[k + 1] ?? lastBottom;
    let bottom = start;
    for (const b of blocks) if (b.top < end && b.bottom > start) bottom = Math.max(bottom, Math.min(b.bottom, end));
    const free = Math.max(0, (contentHeights[k] ?? 0) - (bottom - start));
    return aligns[k] === 'center' ? free / 2 : aligns[k] === 'bottom' ? free : 0;
  });
  const out: PageGap[] = gaps.map((g, i) => ({ pos: g.pos, height: Math.max(0, g.height + shift[i + 1]! - shift[i]!), at: g.at }));
  if (shift[0]! > 0.5) out.unshift({ pos: blocks[0]!.pos, height: shift[0]!, at: 'block' });
  return out;
}
