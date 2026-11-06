// Mini-barre flottante de mise en forme pres de la selection (comme Word) : controles declaratifs du ruban, reutilisable par toutes les applications.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { RibbonControl } from '../ribbon-types.ts';
import { RibbonControlView } from './ribbon/RibbonControls.tsx';
import { miniToolbarVisible, placeMiniToolbar, type Box, type Placement } from '../logic/miniToolbar.ts';
import { miniToolbarPosition } from '../logic/touch.ts';
import './MiniToolbar.css';

const NO_KEYTIPS: ReadonlyMap<string, string> = new Map();

export interface MiniToolbarProps {
  /** Rangees de controles (une rangee = une ligne de la barre). */
  rows: readonly (readonly RibbonControl[])[];
  /** Rectangle de la selection (ecran) ; la barre se place au-dessus. */
  anchor: Box;
  label: string;
  onClose: () => void;
}

const isTouch = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

/**
 * Au doigt : sous la selection (les poignees et le menu natifs d'Android restent libres), bornee sous le ruban et au-dessus de la barre du clavier.
 * Sinon : au-dessus de la selection, comme Word sur bureau.
 */
function placeFor(anchor: Box, bar: { width: number; height: number }): Placement {
  if (!isTouch()) return placeMiniToolbar(anchor, bar, { width: window.innerWidth, height: window.innerHeight });
  const vv = window.visualViewport;
  const kb = document.querySelector('.fo-kbbar')?.getBoundingClientRect().height ?? 0;
  const top = Math.max(vv?.offsetTop ?? 0, document.querySelector('.fo-ribbon')?.getBoundingClientRect().bottom ?? 0);
  const bottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - kb;
  const sel = { left: anchor.left, right: anchor.left + anchor.width, top: anchor.top, bottom: anchor.top + anchor.height };
  const p = miniToolbarPosition(sel, bar, { width: vv?.width ?? window.innerWidth, top, bottom });
  return { ...p, below: p.top >= sel.bottom };
}

export function MiniToolbar({ rows, anchor, label, onClose }: MiniToolbarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Placement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = placeFor(anchor, { width: el.offsetWidth, height: el.offsetHeight });
    setPlace((p) => (p && p.left === next.left && p.top === next.top ? p : next));
  });
  return (
    <div ref={ref} className="fo-mini" role="toolbar" aria-label={label} style={{ left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? 'visible' : 'hidden' }}
      onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('input, select, textarea')) e.preventDefault(); }}
      onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('input, select, textarea')) e.preventDefault(); }}>
      {rows.map((row, i) => (
        <div key={i} className="fo-mini__row">
          {row.map((c) => <RibbonControlView key={c.id} control={c} mode="icon" ctx={{ keytips: NO_KEYTIPS, onCommand: onClose }} />)}
        </div>
      ))}
    </div>
  );
}

export interface SelectionMiniToolbarOptions {
  /** Zone editable : la barre apparait quand elle contient une selection non vide. */
  container: RefObject<HTMLElement | null>;
  enabled: boolean;
  /** Rectangle de la selection (ecran) ou null ; par defaut, celui de la selection du navigateur. */
  getRect?: () => Box | null;
}

export interface SelectionMiniToolbar {
  visible: boolean;
  anchor: Box | null;
  hide: () => void;
  /** Force l'affichage pres d'un point (clic droit). */
  showAt: (box: Box) => void;
}

function browserSelectionBox(container: HTMLElement): Box | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount || !container.contains(sel.anchorNode)) return null;
  const r = sel.getRangeAt(0).getBoundingClientRect();
  return r.width || r.height ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
}

/** Suit la selection de la zone editable : visible apres le relachement du pointeur, fermee par Echap ou un clic ailleurs. */
export function useSelectionMiniToolbar({ container, enabled, getRect }: SelectionMiniToolbarOptions): SelectionMiniToolbar {
  const [anchor, setAnchor] = useState<Box | null>(null);
  const down = useRef(false);
  const forced = useRef(false);
  const dismissed = useRef(false);
  const refresh = useCallback(() => {
    const el = container.current;
    if (!el || forced.current) return;
    const box = getRect ? getRect() : browserSelectionBox(el);
    if (!box) dismissed.current = false;
    const ok = miniToolbarVisible({ enabled, hasSelection: !!box, pointerDown: down.current, dismissed: dismissed.current, focusInside: true });
    setAnchor(ok ? box : null);
  }, [container, enabled, getRect]);
  useEffect(() => {
    const el = container.current;
    if (!el || !enabled) {
      setAnchor(null);
      return;
    }
    const onDown = (e: PointerEvent): void => {
      if ((e.target as HTMLElement).closest('.fo-mini, .fo-menu')) return;
      down.current = true;
      forced.current = false;
      dismissed.current = false;
      setAnchor(null);
    };
    const onUp = (): void => {
      if (!down.current) return;
      down.current = false;
      setTimeout(refresh, 0);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        dismissed.current = true;
        forced.current = false;
        setAnchor(null);
      } else if (e.shiftKey && e.key.startsWith('Arrow')) setTimeout(refresh, 0);
    };
    // Au doigt, les poignees de selection natives changent la selection sans evenement pointeur utile : on suit `selectionchange`.
    let timer = 0;
    const onSel = (): void => {
      if (down.current || forced.current || !isTouch()) return;
      clearTimeout(timer);
      timer = window.setTimeout(refresh, 120);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('selectionchange', onSel);
    el.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', onSel);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointerup', onUp, true);
      el.removeEventListener('keydown', onKey);
    };
  }, [container, enabled, refresh]);
  return {
    visible: !!anchor,
    anchor,
    hide: () => { setAnchor(null); forced.current = false; },
    showAt: (box) => { forced.current = true; dismissed.current = false; setAnchor(box); },
  };
}
