// Info-bulle riche Office (titre + raccourci, description) apres un court survol.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePopupPosition } from '../hooks.ts';
import type { TooltipContent } from '../ribbon-types.ts';
import './Tooltip.css';

const SHOW_DELAY = 550;

export interface TooltipProps {
  content: TooltipContent | string | null | undefined;
  children: ReactNode;
  placement?: 'below' | 'above' | 'right' | 'left';
}

export function Tooltip({ content, children, placement = 'below' }: TooltipProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const popup = useRef<HTMLDivElement>(null);
  const pos = usePopupPosition(popup, shown ? anchor : null, placement);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setShown(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shown]);

  if (!content) return <>{children}</>;
  const data: TooltipContent = typeof content === 'string' ? { title: content } : content;

  const show = (el: Element | null, immediate: boolean): void => {
    if (!(el instanceof HTMLElement)) return;
    window.clearTimeout(timer.current);
    setAnchor(el);
    if (immediate) setShown(true);
    else timer.current = window.setTimeout(() => setShown(true), SHOW_DELAY);
  };
  const hide = (): void => {
    window.clearTimeout(timer.current);
    setShown(false);
  };

  return (
    <span
      className="fo-tooltip-host"
      onMouseEnter={(e) => show(e.currentTarget.firstElementChild, false)}
      onMouseLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => {
        if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) show(e.currentTarget.firstElementChild, false);
      }}
      onBlur={hide}
    >
      {children}
      {shown &&
        createPortal(
          <div ref={popup} className="fo-tooltip" role="tooltip" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden' }}>
            <div className="fo-tooltip__title">
              {data.title}
              {data.shortcut && <span className="fo-tooltip__shortcut"> ({data.shortcut})</span>}
            </div>
            {data.description && <div className="fo-tooltip__desc">{data.description}</div>}
          </div>,
          document.body,
        )}
    </span>
  );
}
