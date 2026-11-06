// Menu Fluent (menus deroulants, sous-menus, menu contextuel) : clavier complet, coches, raccourcis.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icons/Icon.tsx';
import type { MenuItem } from '../ribbon-types.ts';
import { usePopupPosition, type Anchor } from '../hooks.ts';
import type { Placement } from '../logic/position.ts';
import { fold } from '../logic/text.ts';
import { S } from '../strings.ts';
import './Menu.css';

export interface MenuProps {
  items: readonly MenuItem[];
  anchor: Anchor;
  /** Ferme ce menu (et ses sous-menus). */
  onClose: () => void;
  placement?: Placement;
  minWidth?: number;
  /** Contenu libre au-dessus des elements (ex. palette de couleurs). */
  header?: ReactNode;
  /** Etiquette accessible du menu. */
  label?: string;
  /** Interne : ferme toute la cascade apres une action. */
  onDone?: () => void;
  /** Interne : sous-menu (pas de gestion du clic exterieur). */
  nested?: boolean;
}

function isActionable(item: MenuItem): boolean {
  return item.kind !== 'separator' && item.kind !== 'header' && !item.disabled;
}

export function Menu({ items, anchor, onClose, placement = 'below', minWidth = 180, header, label, onDone, nested = false }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = usePopupPosition(ref, anchor, placement);
  const [active, setActive] = useState(-1);
  const [submenu, setSubmenu] = useState<{ index: number; el: HTMLElement; focus: boolean } | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const done = onDone ?? onClose;

  // Clic exterieur (hors de tout menu et de l'ancre) : ferme la cascade.
  useEffect(() => {
    if (nested) return;
    const onPointer = (e: PointerEvent): void => {
      const target = e.target as Element | null;
      if (target?.closest('.fo-menu')) return;
      if (anchor instanceof HTMLElement && target && anchor.contains(target)) return;
      onClose();
    };
    const onBlur = (): void => onClose();
    document.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [anchor, nested, onClose]);

  // Echap (touche Retour d'Android) ferme le menu du dessus meme si le focus est reparti vers l'editeur.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const all = document.querySelectorAll('.fo-menu');
      if (all[all.length - 1] !== ref.current) return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
      if (anchor instanceof HTMLElement && nested) anchor.focus();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [anchor, nested, onClose]);

  // Le menu est cache tant qu'il n'est pas place : le focus (clavier, touche Retour d'Android = Echap) ne se prend qu'apres.
  const placed = pos !== null;
  useEffect(() => {
    if (placed) ref.current?.focus({ preventScroll: true });
  }, [placed]);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const focusItem = useCallback((index: number) => {
    setActive(index);
    const el = ref.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    el?.focus({ preventScroll: false });
  }, []);

  const move = (from: number, dir: 1 | -1): void => {
    const n = items.length;
    for (let step = 1; step <= n; step++) {
      const i = (from + dir * step + n * 2) % n;
      const it = items[i];
      if (it && it.kind !== 'separator' && it.kind !== 'header') {
        focusItem(i);
        return;
      }
    }
  };

  const activate = (index: number, el: HTMLElement, viaKeyboard: boolean): void => {
    const item = items[index];
    if (!item || !isActionable(item)) return;
    if (item.items) {
      setSubmenu({ index, el, focus: viaKeyboard });
      return;
    }
    done();
    item.onClick?.();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (submenu?.focus && e.target !== ref.current && !ref.current?.contains(e.target as Node)) return;
    const current = active;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(current, 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(current < 0 ? 0 : current, -1);
        break;
      case 'Home':
        e.preventDefault();
        move(-1, 1);
        break;
      case 'End':
        e.preventDefault();
        move(0, -1);
        break;
      case 'ArrowRight':
      case 'Enter':
      case ' ': {
        const el = ref.current?.querySelector<HTMLElement>(`[data-index="${current}"]`);
        if (!el) return;
        if (e.key === 'ArrowRight' && !items[current]?.items) return;
        e.preventDefault();
        activate(current, el, true);
        break;
      }
      case 'ArrowLeft':
      case 'Escape':
        if (nested || e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          if (anchor instanceof HTMLElement) anchor.focus();
        }
        break;
      case 'Tab':
        e.preventDefault();
        onClose();
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const ch = fold(e.key);
          const start = current + 1;
          for (let k = 0; k < items.length; k++) {
            const i = (start + k) % items.length;
            const it = items[i];
            if (it && isActionable(it) && fold(it.label ?? '').startsWith(ch)) {
              focusItem(i);
              break;
            }
          }
        }
    }
  };

  const onEnter = (index: number, e: ReactMouseEvent<HTMLElement>): void => {
    setActive(index);
    window.clearTimeout(hoverTimer.current);
    const item = items[index];
    const el = e.currentTarget;
    if (item?.items && !item.disabled) {
      hoverTimer.current = window.setTimeout(() => setSubmenu({ index, el, focus: false }), 180);
    } else {
      hoverTimer.current = window.setTimeout(() => setSubmenu(null), 250);
    }
  };

  const hasIcons = items.some((i) => i.icon || i.adornment || i.checked !== undefined);
  const subItems = submenu ? items[submenu.index]?.items : undefined;

  return createPortal(
    <>
      {!nested && <div className="fo-sheet-scrim" aria-hidden />}
    <div
      ref={ref}
      className="fo-menu fo-scroll"
      role="menu"
      aria-label={label}
      tabIndex={-1}
      style={{ minWidth, left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {nested && (
        <button type="button" className="fo-sheet__back" onClick={onClose}>
          <Icon name="chevron_left" size={20} />
          {S.sheet.back}
        </button>
      )}
      {header}
      {items.map((item, index) => {
        if (item.kind === 'separator') return <div key={item.id} className="fo-menu__sep" role="separator" />;
        if (item.kind === 'header') return <div key={item.id} className="fo-menu__header" role="presentation">{item.label}</div>;
        const role = item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem';
        return (
          <div
            key={item.id}
            data-index={index}
            data-cmd-item={item.id}
            role={role}
            tabIndex={index === active ? 0 : -1}
            aria-checked={item.checked}
            aria-disabled={item.disabled || undefined}
            aria-haspopup={item.items ? 'menu' : undefined}
            aria-expanded={item.items ? submenu?.index === index : undefined}
            className={`fo-menu__item fo-hc-invert${index === active ? ' is-active' : ''}${item.disabled ? ' is-disabled' : ''}`}
            onMouseEnter={(e) => onEnter(index, e)}
            onClick={(e) => activate(index, e.currentTarget, false)}
          >
            {hasIcons && (
              <span className="fo-menu__icon">
                {item.adornment ?? (item.icon ? <Icon name={item.icon} size={20} filled={item.checked === true} /> : item.checked ? <Icon name="checkmark" size={16} /> : null)}
              </span>
            )}
            <span className="fo-menu__text">
              <span className="fo-menu__label">{item.label}</span>
              {item.description && <span className="fo-menu__desc">{item.description}</span>}
            </span>
            {item.icon && item.checked && <Icon name="checkmark" size={16} className="fo-menu__check" />}
            {item.shortcut && <span className="fo-menu__shortcut">{item.shortcut}</span>}
            {item.items && <Icon name="chevron_right" size={16} className="fo-menu__chevron" />}
          </div>
        );
      })}
      {submenu && subItems && (
        <Menu
          key={submenu.index}
          items={subItems}
          anchor={submenu.el}
          placement="right"
          nested
          onClose={() => {
            setSubmenu(null);
            focusItem(submenu.index);
          }}
          onDone={done}
        />
      )}
    </div>
    </>,
    document.body,
  );
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: readonly MenuItem[];
}

/** Menu contextuel : `open(evenement, elements)` dans un gestionnaire onContextMenu, puis rendre `menu`. */
export function useContextMenu(): { open: (e: { clientX: number; clientY: number; preventDefault?: () => void }, items: readonly MenuItem[]) => void; close: () => void; menu: ReactNode } {
  const [state, setState] = useState<ContextMenuState | null>(null);
  const close = useCallback(() => setState(null), []);
  const open = useCallback((e: { clientX: number; clientY: number; preventDefault?: () => void }, items: readonly MenuItem[]) => {
    e.preventDefault?.();
    setState({ x: e.clientX, y: e.clientY, items });
  }, []);
  const anchor = useMemo(() => (state ? { x: state.x, y: state.y } : null), [state]);
  const menu = state && anchor ? <Menu items={state.items} anchor={anchor} onClose={close} /> : null;
  return { open, close, menu };
}
