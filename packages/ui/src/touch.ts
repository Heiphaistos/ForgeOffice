// Prise en charge du toucher, installee une fois par la coquille : mode d'appareil (data-fo-form), appui long = menu contextuel,
// clavier virtuel (hauteur visible, zone d'edition gardee a l'ecran), pas de zoom de page involontaire.
import { useSyncExternalStore } from 'react';
import { LONG_PRESS_MS, LONG_PRESS_SLOP, deviceMode, keyboardInset, scrollDeltaToReveal, type DeviceMode } from './logic/touch.ts';

const EDITABLE = 'textarea, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=range]):not([type=file]):not([type=color]), [contenteditable=""], [contenteditable="true"], .cm-content';

/** Vrai si l'element est une zone de saisie de texte (le clavier virtuel s'ouvre dessus). */
export function isTextEditable(el: Element | null): boolean {
  return Boolean(el?.matches(EDITABLE) || el?.closest('[contenteditable=""], [contenteditable="true"], .cm-content'));
}

let mode: DeviceMode = { form: 'desktop', landscape: true, landscapePhone: false };
let editingEl: Element | null = null;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Mode courant (telephone, tablette, bureau ; portrait ou paysage), mis a jour au redimensionnement. */
export function useDeviceMode(): DeviceMode {
  return useSyncExternalStore(subscribe, () => mode, () => mode);
}
/** Vrai tant qu'une zone de saisie a le focus sur un appareil tactile (barre d'outils au-dessus du clavier) ; `scope` : selecteur de la zone voulue. */
export function useTouchEditing(scope?: string): boolean {
  return useSyncExternalStore(subscribe, () => editingEl !== null && (!scope || editingEl.closest(scope) !== null), () => false);
}

function computeMode(): void {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const next = deviceMode(window.innerWidth, window.innerHeight, coarse);
  const root = document.documentElement;
  root.dataset.foForm = next.form;
  root.dataset.foOrient = next.landscape ? 'landscape' : 'portrait';
  root.dataset.foTouch = coarse ? '1' : '0';
  if (next.form !== mode.form || next.landscape !== mode.landscape) {
    mode = next;
    emit();
  }
}

function scrollParent(el: Element): HTMLElement | null {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

/** Garde le curseur de saisie visible au-dessus du clavier virtuel et de la barre d'outils flottante. */
function revealCaret(): void {
  const active = document.activeElement;
  if (!active || !isTextEditable(active)) return;
  const vv = window.visualViewport;
  const visibleTop = vv?.offsetTop ?? 0;
  const bar = document.querySelector('.fo-kbbar');
  const barH = bar ? bar.getBoundingClientRect().height : 0;
  const visibleBottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - barH;
  const sel = window.getSelection();
  let rect: DOMRect | undefined;
  if (sel && sel.rangeCount > 0 && active.contains(sel.anchorNode)) rect = sel.getRangeAt(0).getClientRects()[0];
  const r = rect && rect.height > 0 ? rect : active.getBoundingClientRect();
  const parent = scrollParent(active.matches('input, textarea') ? active : (sel?.anchorNode?.parentElement ?? active));
  const delta = scrollDeltaToReveal(r.top, r.bottom, visibleTop, visibleBottom);
  if (delta !== 0 && parent) parent.scrollTop += delta;
}

/**
 * Installe les ecouteurs globaux (idempotent) ; renvoie la fonction de retrait.
 * Appui long : un doigt immobile 500 ms envoie un evenement `contextmenu` a l'element (comme un clic droit), sauf dans un texte
 * editable ou l'appui long selectionne un mot. Le clic qui suit est avale.
 */
export function installTouchSupport(): () => void {
  const root = document.documentElement;
  const cleanups: (() => void)[] = [];
  const on = (target: Document | Window, type: string, fn: (e: never) => void, opts?: AddEventListenerOptions | boolean): void => {
    target.addEventListener(type, fn as EventListener, opts);
    cleanups.push(() => target.removeEventListener(type, fn as EventListener, opts));
  };

  // Pas de zoom de page (chaque module a son zoom), contenu sous l'encoche (zones sures gerees en CSS).
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');
  computeMode();
  on(window, 'resize', computeMode);
  on(window, 'orientationchange', computeMode);
  const mql = window.matchMedia('(pointer: coarse)');
  mql.addEventListener('change', computeMode);
  cleanups.push(() => mql.removeEventListener('change', computeMode));

  // Safari ignore touch-action pour le pincement : on coupe le zoom de page, les zones qui pincent le gerent elles-memes.
  on(document, 'gesturestart', (e: Event) => e.preventDefault(), { passive: false });

  // Clavier virtuel : hauteur de la fenetre visible et masquage de la zone d'edition.
  const vv = window.visualViewport;
  const syncViewport = (): void => {
    if (!vv) return;
    root.style.setProperty('--fo-vvh', `${Math.round(vv.height)}px`);
    const inset = keyboardInset(window.innerHeight, vv.height, vv.offsetTop);
    root.style.setProperty('--fo-kb', `${inset}px`);
    root.classList.toggle('fo-kb-open', inset > 0);
    if (window.scrollY !== 0 && inset > 0) window.scrollTo(0, 0);
    requestAnimationFrame(revealCaret);
  };
  if (vv) {
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    cleanups.push(() => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
    });
    syncViewport();
  }
  const setEditing = (): void => {
    const el = document.activeElement;
    const next = mql.matches && el && isTextEditable(el) ? el : null;
    if (next !== editingEl) {
      editingEl = next;
      root.classList.toggle('fo-editing', next !== null);
      emit();
    }
    if (next) window.setTimeout(revealCaret, 320);
  };
  on(document, 'focusin', setEditing);
  on(document, 'focusout', () => window.setTimeout(setEditing, 0));
  let raf = 0;
  on(document, 'selectionchange', () => {
    if (!editingEl) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(revealCaret);
  });

  // Appui long = menu contextuel.
  let press: { id: number; x: number; y: number; target: Element; timer: number } | null = null;
  let nativeMenuAt = 0;
  let swallowClick = false;
  const cancel = (): void => {
    if (press) window.clearTimeout(press.timer);
    press = null;
  };
  on(document, 'pointerdown', (e: PointerEvent) => {
    cancel();
    swallowClick = false;
    if (e.pointerType !== 'touch' || !e.isPrimary || !(e.target instanceof Element)) return;
    if (isTextEditable(e.target)) return;
    const target = e.target;
    const id = e.pointerId;
    const started = performance.now();
    const timer = window.setTimeout(() => {
      if (!press || press.id !== id || nativeMenuAt > started) return;
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true, view: window, clientX: press.x, clientY: press.y, button: 2 });
      swallowClick = true;
      press.target.dispatchEvent(ev);
      press = null;
    }, LONG_PRESS_MS + 50);
    press = { id, x: e.clientX, y: e.clientY, target, timer };
  }, true);
  on(document, 'pointermove', (e: PointerEvent) => {
    if (press && press.id === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) > LONG_PRESS_SLOP) cancel();
  }, true);
  on(document, 'pointerup', cancel, true);
  on(document, 'pointercancel', cancel, true);
  on(document, 'contextmenu', () => {
    nativeMenuAt = performance.now();
  }, true);
  on(document, 'click', (e: MouseEvent) => {
    if (swallowClick) {
      e.preventDefault();
      e.stopPropagation();
      swallowClick = false;
    }
  }, true);

  return () => {
    cancel();
    cleanups.forEach((c) => c());
  };
}
