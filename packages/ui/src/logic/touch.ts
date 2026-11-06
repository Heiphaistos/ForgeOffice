// Logique tactile sans DOM : mode d'appareil, appui long, balayage, poignees, bascule selection/defilement, clavier virtuel.

export type FormFactor = 'phone' | 'tablet' | 'desktop';
export interface DeviceMode {
  form: FormFactor;
  landscape: boolean;
  /** Telephone tenu en paysage : peu de hauteur, tout est replie. */
  landscapePhone: boolean;
}

/** Taille minimale d'une cible tactile (px CSS). */
export const TOUCH_TARGET = 44;
export const LONG_PRESS_MS = 500;
export const LONG_PRESS_SLOP = 10;

/** Telephone : petit cote < 600 px (ou largeur < 720 px) ; tablette : tactile plus large que 720 px ; sinon bureau. */
export function deviceMode(width: number, height: number, coarse: boolean): DeviceMode {
  const landscape = width > height;
  const short = Math.min(width, height);
  let form: FormFactor = 'desktop';
  if (width < 720 || (coarse && short < 600)) form = 'phone';
  else if (coarse) form = 'tablet';
  return { form, landscape, landscapePhone: form === 'phone' && landscape };
}

/** Le ruban complet n'est propose qu'en tablette paysage ou sur bureau ; en tablette portrait et sur telephone, ruban simplifie. */
export function ribbonLayoutFor(mode: DeviceMode, width: number): 'classic' | 'simplified' {
  if (mode.form === 'phone') return 'simplified';
  if (mode.form === 'tablet' && !(mode.landscape && width >= 1000)) return 'simplified';
  return 'classic';
}

/** Un appui long est valide si le doigt a peu bouge et assez attendu. */
export function isLongPress(elapsedMs: number, movedPx: number, holdMs = LONG_PRESS_MS, slop = LONG_PRESS_SLOP): boolean {
  return elapsedMs >= holdMs && movedPx <= slop;
}

export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;
/** Balayage franc : distance minimale, rapide, et net sur un axe (rapport 2:1). */
export function swipeDirection(dx: number, dy: number, elapsedMs: number, minDist = 48, maxMs = 700): SwipeDirection {
  if (elapsedMs > maxMs) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < minDist) return null;
  if (ax >= ay * 2) return dx < 0 ? 'left' : 'right';
  if (ay >= ax * 2) return dy < 0 ? 'up' : 'down';
  return null;
}

export interface Rect { x: number; y: number; w: number; h: number }

/** Zone de toucher d'une poignee visuelle de `size` px centree en (cx, cy) : au moins `target` px de cote. */
export function handleHitBox(cx: number, cy: number, size: number, target = TOUCH_TARGET): Rect {
  const s = Math.max(size, target);
  return { x: cx - s / 2, y: cy - s / 2, w: s, h: s };
}

export interface HandleAt { id: string; x: number; y: number }
/** Poignee touchee : la plus proche dont la zone de 44 px contient le point (egalite : la premiere). */
export function pickHandle<T extends HandleAt>(handles: readonly T[], px: number, py: number, size: number, target = TOUCH_TARGET): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const h of handles) {
    const b = handleHitBox(h.x, h.y, size, target);
    if (px < b.x || px > b.x + b.w || py < b.y || py > b.y + b.h) continue;
    const d = Math.hypot(px - h.x, py - h.y);
    if (d < bestD) {
      best = h;
      bestD = d;
    }
  }
  return best;
}

/** Angle (degres, 0 = haut) de la direction centre -> point, pour une poignee de rotation. */
export function rotationAngle(cx: number, cy: number, px: number, py: number, snap = 0): number {
  const deg = (Math.atan2(px - cx, -(py - cy)) * 180) / Math.PI;
  const norm = ((deg % 360) + 360) % 360;
  return snap > 0 ? (Math.round(norm / snap) * snap) % 360 : Math.round(norm);
}

export type GridMode = 'scroll' | 'select';
export type GridIntent = 'scroll' | 'select';
/**
 * Intention d'un doigt sur une grille. Souris/stylet : toujours selection. Doigt : mode « selection » = glisser selectionne ;
 * mode « defilement » = glisser defile, appui long = selection (puis glisser etend).
 */
export function gridIntent(pointerType: string, mode: GridMode, longPressed: boolean): GridIntent {
  if (pointerType !== 'touch') return 'select';
  if (mode === 'select') return 'select';
  return longPressed ? 'select' : 'scroll';
}

/** Hauteur masquee par le clavier virtuel, d'apres la fenetre visuelle (0 si le clavier est ferme ou si l'ecart vient de la barre d'adresse). */
export function keyboardInset(layoutHeight: number, vvHeight: number, vvOffsetTop: number, threshold = 120): number {
  const hidden = layoutHeight - vvHeight - vvOffsetTop;
  return hidden > threshold ? Math.round(hidden) : 0;
}

/** Deplacement de defilement pour que l'element focalise (haut/bas) reste visible au-dessus du clavier, avec une marge. */
export function scrollDeltaToReveal(top: number, bottom: number, visibleTop: number, visibleBottom: number, margin = 12): number {
  if (bottom > visibleBottom - margin) return Math.ceil(bottom - (visibleBottom - margin));
  if (top < visibleTop + margin) return Math.floor(top - (visibleTop + margin));
  return 0;
}

export interface ToolbarFold { visible: number; overflow: number }
/** Repli d'une barre d'outils : combien d'elements (largeurs en px) tiennent ; le reste va dans « plus » (reserve `moreWidth`). */
export function foldToolbar(widths: readonly number[], available: number, moreWidth = TOUCH_TARGET): ToolbarFold {
  const total = widths.reduce((a, b) => a + b, 0);
  if (total <= available) return { visible: widths.length, overflow: 0 };
  let used = moreWidth;
  let visible = 0;
  for (const w of widths) {
    if (used + w > available) break;
    used += w;
    visible++;
  }
  return { visible, overflow: widths.length - visible };
}

/** Distance et milieu de deux points (pincement, defilement a deux doigts). */
export function pinchGeometry(a: { x: number; y: number }, b: { x: number; y: number }): { dist: number; mx: number; my: number } {
  return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
}

/**
 * Position de la mini-barre de selection (coordonnees fenetre) : centree sous la selection, a distance des poignees natives (`gap`),
 * retournee au-dessus si elle ne tient pas en bas, puis bornee a la zone visible (`bottom` exclut le clavier et sa barre).
 */
export function miniToolbarPosition(
  sel: { left: number; right: number; top: number; bottom: number },
  size: { width: number; height: number },
  visible: { width: number; top: number; bottom: number },
  gap = 30,
  margin = 8,
): { left: number; top: number } {
  const left = Math.max(margin, Math.min((sel.left + sel.right) / 2 - size.width / 2, visible.width - size.width - margin));
  const below = sel.bottom + gap;
  const above = sel.top - gap - size.height;
  let top = below;
  if (below + size.height > visible.bottom - margin) top = above >= visible.top + margin ? above : Math.max(visible.top + margin, visible.bottom - size.height - margin);
  return { left: Math.round(left), top: Math.round(top) };
}
