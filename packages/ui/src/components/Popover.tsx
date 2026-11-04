// Fenetre flottante generique (palette, liste, groupe replie...) : ancree, bornee a l'ecran, fermee par clic exterieur ou Echap.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePopupPosition, type Anchor } from '../hooks.ts';
import type { Placement } from '../logic/position.ts';
import './Popover.css';

export interface PopoverProps {
  anchor: Anchor;
  onClose: () => void;
  children: ReactNode;
  placement?: Placement;
  className?: string;
  style?: CSSProperties;
  /** role ARIA (dialog par defaut, listbox pour une liste). */
  role?: string;
  label?: string;
  /** Donne le focus au premier element focalisable a l'ouverture. */
  autoFocus?: boolean;
}

export function Popover({ anchor, onClose, children, placement = 'below', className, style, role = 'dialog', label, autoFocus = true }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = usePopupPosition(ref, anchor, placement);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const onPointer = (e: PointerEvent): void => {
      const target = e.target as Element | null;
      if (!target) return;
      if (ref.current?.contains(target) || target.closest('.fo-menu, .fo-popover-child')) return;
      if (anchor instanceof HTMLElement && anchor.contains(target)) return;
      close.current();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close.current();
      if (anchor instanceof HTMLElement) anchor.focus();
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [anchor]);

  useEffect(() => {
    if (!autoFocus) return;
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus], button:not([disabled]), input, [tabindex="0"]');
    (first ?? ref.current)?.focus({ preventScroll: true });
  }, [autoFocus]);

  return createPortal(
    <div
      ref={ref}
      className={`fo-popover fo-scroll${className ? ` ${className}` : ''}`}
      role={role}
      aria-label={label}
      tabIndex={-1}
      style={{ ...style, left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}
