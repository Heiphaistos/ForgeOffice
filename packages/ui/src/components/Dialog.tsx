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

/** Boites ouvertes, la plus recente en dernier : seule celle du dessus reagit a Echap au niveau du document. */
const openStack: object[] = [];

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
    (first ?? ref.current)?.focus(); // sans element focalisable, la boite elle-meme prend le focus : Echap et Tab restent captes
    return () => previous?.focus?.();
  }, [open]);

  // Echap ferme la boite du dessus meme si le focus est reparti ailleurs (l'editeur le reprend apres une commande) ;
  // un menu ou une liste ouverts gardent la priorite (ils ferment d'abord).
  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    openStack.push(token);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || openStack[openStack.length - 1] !== token || e.defaultPrevented) return;
      if (document.querySelector('[role="menu"], [role="listbox"][aria-expanded="true"], .fo-popover')) return;
      if (ref.current?.contains(document.activeElement)) return; // le gestionnaire de la boite s'en charge
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      openStack.splice(openStack.indexOf(token), 1);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fo-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}>
      <div
        ref={ref}
        className={`fo-dialog${actions ? '' : ' fo-dialog--default'}`}
        role="dialog"
        tabIndex={-1}
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
          <button type="button" className="fo-dialog__back" aria-label={S.sheet.back} onClick={onClose}>
            <Icon name="chevron_left" size={24} />
            <span>{S.sheet.back}</span>
          </button>
          <h2 id={titleId}>{title}</h2>
          {primary && (
            <button type="button" className="fo-dialog__headok" onClick={primary.onClick}>
              {primary.label}
            </button>
          )}
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
