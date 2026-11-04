// Crochets React partages.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { Settings } from '@forgeoffice/core';
import { placePopup, type Placement } from './logic/position.ts';

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
