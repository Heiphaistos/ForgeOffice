// Rognage d'image (sans DOM) : le cadre (partie visible, `xfrm` de l'image) et l'image entiere (`full`, plus grande que le cadre)
// partagent le meme repere ; le rognage en % de la forme en est deduit. Le cadre reste toujours a l'interieur de l'image.
import type { Insets, Picture, Transform } from '@forgeoffice/pptx';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Plus petite taille du cadre (points). */
export const MIN_FRAME = 12;

/** Proportions proposees (largeur / hauteur). */
export const CROP_RATIOS: ReadonlyArray<{ id: string; ratio: number | null }> = [
  { id: 'free', ratio: null },
  { id: '1:1', ratio: 1 },
  { id: '4:3', ratio: 4 / 3 },
  { id: '3:2', ratio: 3 / 2 },
  { id: '16:9', ratio: 16 / 9 },
  { id: '3:4', ratio: 3 / 4 },
  { id: '2:3', ratio: 2 / 3 },
  { id: '9:16', ratio: 9 / 16 },
];

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(lo, hi));
const EMPTY: Insets = { left: 0, top: 0, right: 0, bottom: 0 };

/** Image entiere deduite du cadre et du rognage actuel (en %). */
export function fullRect(frame: Rect, crop: Insets = EMPTY): Rect {
  const fw = Math.max(0.01, 1 - (crop.left + crop.right) / 100);
  const fh = Math.max(0.01, 1 - (crop.top + crop.bottom) / 100);
  const width = frame.width / fw;
  const height = frame.height / fh;
  return { x: frame.x - (crop.left / 100) * width, y: frame.y - (crop.top / 100) * height, width, height };
}

/** Rognage (%) qui donne `frame` dans l'image `full`. */
export function cropOf(frame: Rect, full: Rect): Insets {
  const pct = (v: number, size: number): number => Math.round(clamp((v / size) * 100, 0, 99) * 100) / 100;
  return {
    left: pct(frame.x - full.x, full.width),
    top: pct(frame.y - full.y, full.height),
    right: pct(full.x + full.width - (frame.x + frame.width), full.width),
    bottom: pct(full.y + full.height - (frame.y + frame.height), full.height),
  };
}

/** Deplace l'image derriere le cadre immobile : l'image continue de couvrir le cadre. */
export function moveImage(frame: Rect, full: Rect, dx: number, dy: number): Rect {
  return {
    ...full,
    x: clamp(full.x + dx, frame.x + frame.width - full.width, frame.x),
    y: clamp(full.y + dy, frame.y + frame.height - full.height, frame.y),
  };
}

/** Deplace le cadre sur l'image immobile. */
export function moveFrame(frame: Rect, full: Rect, dx: number, dy: number): Rect {
  return {
    ...frame,
    x: clamp(frame.x + dx, full.x, full.x + full.width - frame.width),
    y: clamp(frame.y + dy, full.y, full.y + full.height - frame.height),
  };
}

/**
 * Redimensionne le cadre en tirant une poignee (l'image ne bouge pas), dans les limites de l'image.
 * `ratio` (largeur / hauteur) verrouille les proportions : le cote tire commande, l'autre suit.
 */
export function resizeFrame(frame: Rect, full: Rect, handle: CropHandle, dx: number, dy: number, ratio?: number | null): Rect {
  let l = frame.x;
  let t = frame.y;
  let r = frame.x + frame.width;
  let b = frame.y + frame.height;
  if (handle.includes('w')) l = clamp(l + dx, full.x, r - MIN_FRAME);
  if (handle.includes('e')) r = clamp(r + dx, l + MIN_FRAME, full.x + full.width);
  if (handle.includes('n')) t = clamp(t + dy, full.y, b - MIN_FRAME);
  if (handle.includes('s')) b = clamp(b + dy, t + MIN_FRAME, full.y + full.height);
  if (!ratio) return { x: l, y: t, width: r - l, height: b - t };
  // Proportions verrouillees : on garde le cote commande par la poignee et on ajuste l'autre sans sortir de l'image.
  const horizontalEdge = handle === 'n' || handle === 's';
  const verticalEdge = handle === 'e' || handle === 'w';
  let w = r - l;
  let h = b - t;
  if (horizontalEdge) w = h * ratio;
  else if (verticalEdge) h = w / ratio;
  else if (w / h > ratio) w = h * ratio;
  else h = w / ratio;
  // Ancre : le bord oppose a la poignee ; pour une arete, le centre de l'autre axe.
  const ax = handle.includes('w') ? r : handle.includes('e') ? l : (l + r) / 2;
  const ay = handle.includes('n') ? b : handle.includes('s') ? t : (t + b) / 2;
  // Taille maximale possible depuis l'ancre dans l'image.
  const roomW = handle.includes('w') ? ax - full.x : handle.includes('e') ? full.x + full.width - ax : 2 * Math.min(ax - full.x, full.x + full.width - ax);
  const roomH = handle.includes('n') ? ay - full.y : handle.includes('s') ? full.y + full.height - ay : 2 * Math.min(ay - full.y, full.y + full.height - ay);
  const k = Math.min(1, roomW / w, roomH / h);
  w *= k;
  h *= k;
  const x = handle.includes('w') ? ax - w : handle.includes('e') ? ax : ax - w / 2;
  const y = handle.includes('n') ? ay - h : handle.includes('s') ? ay : ay - h / 2;
  return { x, y, width: w, height: h };
}

/** Cadre de proportions `ratio`, le plus grand possible dans le cadre actuel (meme centre). */
export function frameForRatio(frame: Rect, full: Rect, ratio: number): Rect {
  let w = frame.width;
  let h = w / ratio;
  if (h > frame.height) {
    h = frame.height;
    w = h * ratio;
  }
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  return moveFrame({ x: cx - w / 2, y: cy - h / 2, width: w, height: h }, full, 0, 0);
}

/** Agrandit ou reduit l'image autour du centre du cadre ; elle couvre toujours le cadre. */
export function zoomImage(frame: Rect, full: Rect, factor: number): Rect {
  const minK = Math.max(frame.width / full.width, frame.height / full.height);
  const k = Math.max(factor, minK);
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  const width = full.width * k;
  const height = full.height * k;
  const x = cx - ((cx - full.x) / full.width) * width;
  const y = cy - ((cy - full.y) / full.height) * height;
  return moveImage(frame, { x, y, width, height }, 0, 0);
}

/**
 * Cadre en coordonnees de page : le calcul se fait dans le repere de l'image avant rotation, autour du centre d'origine ;
 * le centre du nouveau cadre est ramene dans la page par la rotation de l'image.
 */
export function toPageXfrm(frame: Rect, origin: Rect, rotation: number): Rect {
  const a = (rotation * Math.PI) / 180;
  const oc = { x: origin.x + origin.width / 2, y: origin.y + origin.height / 2 };
  const dx = frame.x + frame.width / 2 - oc.x;
  const dy = frame.y + frame.height / 2 - oc.y;
  const cx = oc.x + dx * Math.cos(a) - dy * Math.sin(a);
  const cy = oc.y + dx * Math.sin(a) + dy * Math.cos(a);
  return { x: cx - frame.width / 2, y: cy - frame.height / 2, width: frame.width, height: frame.height };
}

/** Applique le cadre et l'image entiere a une image de la page : nouvelle position et nouveau rognage. */
export function applyCrop(pic: Picture, frame: Rect, full: Rect, origin: Rect): void {
  const old = pic.xfrm as Transform;
  const page = toPageXfrm(frame, origin, old.rotation ?? 0);
  const round = (v: number): number => Math.round(v * 100) / 100;
  pic.xfrm = { ...old, x: round(page.x), y: round(page.y), width: round(page.width), height: round(page.height) };
  const crop = cropOf(frame, full);
  if (crop.left || crop.top || crop.right || crop.bottom) pic.crop = crop;
  else delete pic.crop;
}

const centered = (frame: Rect, width: number, height: number): Rect => ({ x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height });

/** « Remplir » : image entiere agrandie pour couvrir tout le cadre (centree) ; le cadre ne bouge pas. */
export function fillFull(frame: Rect, crop: Insets = EMPTY): Rect {
  const full = fullRect(frame, crop);
  const aspect = full.width / full.height;
  const width = aspect >= frame.width / frame.height ? frame.height * aspect : frame.width;
  return centered(frame, width, width / aspect);
}

/** « Ajuster » : cadre ramene aux proportions de l'image entiere, contenu dans l'ancien cadre (meme centre), sans rognage. */
export function fitFrame(frame: Rect, crop: Insets = EMPTY): Rect {
  const full = fullRect(frame, crop);
  const aspect = full.width / full.height;
  const width = aspect >= frame.width / frame.height ? frame.width : frame.height * aspect;
  return centered(frame, width, width / aspect);
}
