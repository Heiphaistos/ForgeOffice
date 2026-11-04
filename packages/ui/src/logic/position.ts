// Placement des fenetres flottantes (menus, info-bulles, listes) dans la fenetre visible.

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type Placement = 'below' | 'above' | 'right' | 'left';

/**
 * Position d'un element flottant de taille `size` autour de `anchor`, retournee si elle deborde,
 * puis bornee a la fenetre (`viewport`) avec une marge de 4 px.
 */
export function placePopup(anchor: Rect, size: { width: number; height: number }, viewport: { width: number; height: number }, placement: Placement = 'below', gap = 2): { left: number; top: number } {
  const m = 4;
  let left: number;
  let top: number;
  if (placement === 'below' || placement === 'above') {
    left = anchor.left;
    const below = anchor.top + anchor.height + gap;
    const above = anchor.top - gap - size.height;
    const fitsBelow = below + size.height <= viewport.height - m;
    const fitsAbove = above >= m;
    top = placement === 'below' ? (fitsBelow || !fitsAbove ? below : above) : fitsAbove || !fitsBelow ? above : below;
  } else {
    top = anchor.top;
    const right = anchor.left + anchor.width + gap;
    const leftSide = anchor.left - gap - size.width;
    const fitsRight = right + size.width <= viewport.width - m;
    const fitsLeft = leftSide >= m;
    left = placement === 'right' ? (fitsRight || !fitsLeft ? right : leftSide) : fitsLeft || !fitsRight ? leftSide : right;
  }
  left = Math.max(m, Math.min(left, viewport.width - size.width - m));
  top = Math.max(m, Math.min(top, viewport.height - size.height - m));
  return { left, top };
}
