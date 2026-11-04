// Info-touches (touche Alt) : badges poses sur les elements marques data-keytip / data-keytip-top.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { keytipMatch } from '../../logic/keytips.ts';
import { S } from '../../strings.ts';

export type KeytipScope = 'top' | 'panel';

interface Badge {
  key: string;
  el: HTMLElement;
  left: number;
  top: number;
}

export interface KeytipLayerProps {
  scope: KeytipScope;
  /** Zone ou chercher les info-touches du panneau (lue apres le rendu). */
  getPanel: () => HTMLElement | null;
  /** Element choisi au premier niveau (onglet) : passe au niveau panneau. */
  onTopPicked: (el: HTMLElement) => void;
  onBack: () => void;
  onExit: () => void;
}

function collect(scope: KeytipScope, panel: HTMLElement | null): Badge[] {
  const nodes = scope === 'top' ? [...document.querySelectorAll<HTMLElement>('[data-keytip-top]')] : [...(panel?.querySelectorAll<HTMLElement>('[data-keytip]') ?? [])];
  const out: Badge[] = [];
  for (const el of nodes) {
    const key = scope === 'top' ? el.dataset.keytipTop : el.dataset.keytip;
    if (!key) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    out.push({ key, el, left: r.left + r.width / 2, top: scope === 'top' ? r.bottom - 6 : r.bottom - 8 });
  }
  return out;
}

export function KeytipLayer({ scope, getPanel, onTopPicked, onBack, onExit }: KeytipLayerProps) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [typed, setTyped] = useState('');
  const state = useRef({ badges, typed });
  state.current = { badges, typed };

  useLayoutEffect(() => {
    setTyped('');
    // le panneau vient peut-etre de changer d'onglet : mesurer apres le rendu
    const id = requestAnimationFrame(() => setBadges(collect(scope, getPanel())));
    return () => cancelAnimationFrame(id);
  }, [scope, getPanel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Alt' || e.key === 'Shift' || e.key === 'Control') return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        if (scope === 'panel') onBack();
        else onExit();
        return;
      }
      if (e.key === 'Backspace') {
        setTyped((t) => t.slice(0, -1));
        return;
      }
      if (e.key.length !== 1) {
        onExit();
        return;
      }
      const next = state.current.typed + e.key.toUpperCase();
      const { state: match, index } = keytipMatch(next, state.current.badges.map((b) => b.key));
      if (match === 'prefix') {
        setTyped(next);
        return;
      }
      if (match === 'none') return;
      const el = state.current.badges[index]?.el;
      if (!el) return;
      if (scope === 'top' && el.getAttribute('role') === 'tab') {
        onTopPicked(el);
        return;
      }
      onExit();
      if (el instanceof HTMLInputElement) {
        el.focus();
        el.select();
      } else {
        const target = el.matches('button, input, [role="button"]') ? el : el.querySelector<HTMLElement>('button, input') ?? el;
        target.focus();
        target.click();
      }
    };
    const onPointer = (): void => onExit();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('blur', onExit);
    window.addEventListener('resize', onExit);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('blur', onExit);
      window.removeEventListener('resize', onExit);
    };
  }, [scope, onBack, onExit, onTopPicked]);

  return createPortal(
    <div className="fo-keytips" aria-live="polite">
      <span className="fo-visually-hidden">{S.ribbon.keytipsHint}</span>
      {badges
        .filter((b) => b.key.startsWith(typed))
        .map((b) => (
          <span key={`${b.key}-${b.left}-${b.top}`} className="fo-keytip" style={{ left: b.left, top: b.top }}>
            {b.key}
          </span>
        ))}
    </div>,
    document.body,
  );
}
