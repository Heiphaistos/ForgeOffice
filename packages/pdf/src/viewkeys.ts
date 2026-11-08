// Raccourcis de navigation et d'affichage façon Acrobat (sans DOM, testé) et historique de vues (Alt+Gauche / Alt+Droite).

export type ViewAction =
  | 'zoomIn' | 'zoomOut' | 'actualSize' | 'fitPage' | 'fitWidth'
  | 'firstPage' | 'lastPage' | 'findNext' | 'findPrevious' | 'goToPage' | 'readingMode' | 'back' | 'forward';

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/** Action d'affichage liée à une frappe, ou null. Ctrl+= et Ctrl++ agrandissent (clavier français : « + » demande Maj). */
export function viewAction(e: KeyLike): ViewAction | null {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && !e.altKey) {
    if (e.key === '+' || e.key === '=') return 'zoomIn';
    if (e.key === '-' || e.key === '_') return 'zoomOut';
    if (e.key === '0') return 'fitPage';
    if (e.key === '1') return 'actualSize';
    if (e.key === '2') return 'fitWidth';
    if (e.shiftKey && e.key.toLowerCase() === 'n') return 'goToPage';
    if (!e.shiftKey && e.key.toLowerCase() === 'h') return 'readingMode';
    return null;
  }
  if (e.altKey && !ctrl && !e.shiftKey) {
    if (e.key === 'ArrowLeft') return 'back';
    if (e.key === 'ArrowRight') return 'forward';
    return null;
  }
  if (ctrl || e.altKey) return null;
  if (e.key === 'F3') return e.shiftKey ? 'findPrevious' : 'findNext';
  if (e.shiftKey) return null;
  if (e.key === 'Home') return 'firstPage';
  if (e.key === 'End') return 'lastPage';
  return null;
}

/** Numéro saisi (1 à `count`) -> index de page, ou null si invalide. */
export function pageFromInput(text: string, count: number): number | null {
  const t = text.trim();
  if (!/^\d{1,7}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= count ? n - 1 : null;
}

/** Historique des pages visitées par saut (lien, signet, Aller à la page) : retour et avance comme dans un navigateur. */
export interface NavHistory {
  readonly stack: readonly number[];
  readonly index: number;
}

export const emptyHistory = (page: number): NavHistory => ({ stack: [page], index: 0 });

/** Enregistre un saut vers `to` depuis la page affichée ; efface l'avance, ignore un saut sur place. */
export function pushView(h: NavHistory, from: number, to: number): NavHistory {
  if (from === to) return h;
  const base = h.stack.slice(0, h.index + 1);
  if (base[base.length - 1] !== from) base.push(from);
  base.push(to);
  return { stack: base.slice(-100), index: Math.min(base.length, 100) - 1 };
}

export function stepView(h: NavHistory, dir: 1 | -1): { history: NavHistory; page: number | null } {
  const i = h.index + dir;
  const page = h.stack[i];
  return page === undefined ? { history: h, page: null } : { history: { ...h, index: i }, page };
}
