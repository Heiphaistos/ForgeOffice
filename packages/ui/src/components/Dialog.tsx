// Boite de dialogue modale Fluent : deplacable par son titre, Entree = action principale, Echap = fermer, focus piege.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icons/Icon.tsx';
import { S } from '../strings.ts';
import { Button } from './Controls.tsx';
import './Dialog.css';

export interface DialogAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Boutons du bas ; par defaut « OK » (onConfirm) et « Annuler ». */
  actions?: readonly DialogAction[];
  /** Action d'Entree quand `actions` est absent. */
  onConfirm?: () => void;
  width?: number;
  /** Texte d'aide sous le titre. */
  description?: string;
  /** Zone en bas a gauche (ex. « Definir par defaut »). */
  footerStart?: ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, title, onClose, children, actions, onConfirm, width = 480, description, footerStart }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const list: readonly DialogAction[] = actions ?? [
    { label: S.dialog.ok, primary: true, onClick: onConfirm ?? onClose },
    { label: S.dialog.cancel, onClick: onClose },
  ];
  const primary = list.find((a) => a.primary && !a.disabled);

  useEffect(() => {
    if (!open) return;
    setOffset({ x: 0, y: 0 });
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLElement>(`.fo-dialog__body ${FOCUSABLE}`) ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => previous?.focus?.();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fo-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}>
      <div
        ref={ref}
        className="fo-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        style={{ width, transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          } else if (e.key === 'Enter' && primary && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement) && !e.defaultPrevented) {
            e.preventDefault();
            primary.onClick();
          } else if (e.key === 'Tab') {
            const items = [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div
          className="fo-dialog__title"
          onPointerDown={(e) => {
            if ((e.target as Element).closest('button')) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const maxX = window.innerWidth / 2;
            const maxY = window.innerHeight / 2;
            setOffset({ x: Math.max(-maxX, Math.min(maxX, d.ox + e.clientX - d.x)), y: Math.max(-maxY, Math.min(maxY, d.oy + e.clientY - d.y)) });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="fo-dialog__close" aria-label={S.dialog.close} onClick={onClose}>
            <Icon name="dismiss" size={20} />
          </button>
        </div>
        {description && (
          <p id={descId} className="fo-dialog__desc">
            {description}
          </p>
        )}
        <div className="fo-dialog__body">{children}</div>
        <div className="fo-dialog__footer">
          <div className="fo-dialog__footer-start">{footerStart}</div>
          {list.map((a) => (
            <Button key={a.label} appearance={a.primary ? 'primary' : 'secondary'} disabled={a.disabled} onClick={a.onClick}>
              {a.label}
            </Button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
