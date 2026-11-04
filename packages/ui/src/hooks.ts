// Crochets React partages.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import type { Settings } from '@forgeoffice/core';
import { placePopup, type Placement } from './logic/position.ts';
import { createFontsEpoch } from './logic/fontsReady.ts';
import { ZOOM_MAX, ZOOM_MIN, pinchZoom } from './logic/zoom.ts';

/** Etat memorise dans les reglages de la plateforme (survit au redemarrage). */
export function usePersistentState<T>(settings: Settings | null | undefined, key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => (settings ? settings.get<T>(key, fallback) : fallback));
  const update = useCallback(
    (next: T) => {
      setValue(next);
      settings?.set(key, next);
    },
    [settings, key],
  );
  return [value, update];
}

/** Appelle `onOutside` sur un clic en dehors des elements donnes, ou sur Echap. */
export function useDismiss(refs: readonly RefObject<HTMLElement | null>[], active: boolean, onOutside: () => void): void {
  const latest = useRef(onOutside);
  latest.current = onOutside;
  useEffect(() => {
    if (!active) return;
    const onPointer = (e: PointerEvent): void => {
      const target = e.target as Node | null;
      if (refs.some((r) => r.current && target && r.current.contains(target))) return;
      latest.current();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        latest.current();
      }
    };
    const onBlur = (): void => latest.current();
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onBlur);
    };
    // refs : tableau stable fourni par l appelant ; seul `active` relance l ecoute
  }, [active]);
}

export type Anchor = HTMLElement | { x: number; y: number };

/** Positionne un element flottant contre son ancre (element ou point), en restant dans la fenetre. */
export function usePopupPosition(popupRef: RefObject<HTMLElement | null>, anchor: Anchor | null, placement: Placement = 'below'): { left: number; top: number } | null {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const popup = popupRef.current;
    if (!popup || !anchor) return;
    const update = (): void => {
      const rect = anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : { left: anchor.x, top: anchor.y, width: 0, height: 0 };
      const size = { width: popup.offsetWidth, height: popup.offsetHeight };
      setPos(placePopup(rect, size, { width: window.innerWidth, height: window.innerHeight }, placement));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(popup);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [popupRef, anchor, placement]);
  return pos;
}

/** Largeur observee d'un element (passer l'element recu par un ref callback). */
export function useElementWidth(el: HTMLElement | null): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return width;
}

/** true si la fenetre est etroite (mode tactile / compact). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (): void => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/**
 * Zoom au pincement (deux doigts) sur un element defilant, par Pointer Events. Le defilement a un doigt reste natif
 * (`touch-action: pan-x pan-y` : le navigateur ne zoome pas la page lui-meme). `zoom` en %, `onZoom` recoit le nouveau zoom.
 */
export function usePinchZoom(ref: RefObject<HTMLElement | null>, zoom: number, onZoom: (zoom: number) => void, min = ZOOM_MIN, max = ZOOM_MAX): void {
  const latest = useRef({ zoom, onZoom });
  latest.current = { zoom, onZoom };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (getComputedStyle(el).touchAction === 'auto') el.style.touchAction = 'pan-x pan-y'; // une zone qui gere deja ses gestes (touch-action: none) est laissee telle quelle
    const pointers = new Map<number, { x: number; y: number }>();
    let start: { dist: number; zoom: number } | null = null;
    const dist = (): number => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const down = (e: PointerEvent): void => {
      if (e.pointerType !== 'touch') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) start = { dist: dist(), zoom: latest.current.zoom };
    };
    const move = (e: PointerEvent): void => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && start) latest.current.onZoom(pinchZoom(start.zoom, start.dist, dist(), min, max));
    };
    const up = (e: PointerEvent): void => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) start = null;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [ref, min, max]);
}

const fontsEpoch = createFontsEpoch();
/** Change quand des polices finissent de charger : a lire dans un composant dont le rendu ou la mesure depend de la police. */
export function useFontsEpoch(): number {
  return useSyncExternalStore(fontsEpoch.subscribe, fontsEpoch.get, () => 0);
}
