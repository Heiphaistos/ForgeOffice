// Barre d'outils flottante au-dessus du clavier virtuel : boutons de 44 px, repli du surplus dans « Plus ».
// Les boutons ne prennent pas le focus (pointerdown annule), le clavier reste ouvert et la selection intacte.
import { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../icons/Icon.tsx';
import type { IconName } from '../icons/generated.ts';
import type { MenuItem } from '../ribbon-types.ts';
import { foldToolbar, TOUCH_TARGET } from '../logic/touch.ts';
import { useTouchEditing } from '../touch.ts';
import { S } from '../strings.ts';
import { Menu } from './Menu.tsx';

export interface KeyboardBarItem {
  id: string;
  label: string;
  /** Icone Fluent ; sinon `text` (glyphe court : Tab, (, ), ...). */
  icon?: IconName;
  text?: string;
  pressed?: boolean;
  disabled?: boolean;
  /** Ajoute un separateur avant le bouton. */
  separator?: boolean;
  onClick: () => void;
}

export interface KeyboardBarProps {
  items: readonly KeyboardBarItem[];
  /** Montre la barre meme sans zone de saisie focalisee (tests, mode force). */
  alwaysVisible?: boolean;
}

const itemWidth = (it: KeyboardBarItem): number => (it.text && it.text.length > 2 ? TOUCH_TARGET + 12 : TOUCH_TARGET) + (it.separator ? 9 : 0);

export function KeyboardBar({ items, alwaysVisible = false }: KeyboardBarProps) {
  const editing = useTouchEditing();
  const barRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [more, setMore] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const sync = (): void => setWidth(el.clientWidth - 16);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [editing, alwaysVisible]);
  if (!editing && !alwaysVisible) return null;

  const fold = width > 0 ? foldToolbar(items.map(itemWidth), width) : { visible: items.length, overflow: 0 };
  const shown = items.slice(0, fold.visible);
  const hidden = items.slice(fold.visible);
  const menuItems: MenuItem[] = hidden.map((it) => ({ id: it.id, label: it.label, icon: it.icon, disabled: it.disabled, checked: it.pressed, onClick: it.onClick }));
  // Garde le focus de l'editeur : un bouton ne vole ni le focus ni la selection.
  const keep = (e: { preventDefault: () => void }): void => e.preventDefault();

  return (
    <div ref={barRef} className="fo-kbbar" role="toolbar" aria-label={S.kbBar.label} onPointerDown={keep}>
      {shown.map((it) => (
        <span key={it.id} style={{ display: 'contents' }}>
          {it.separator && <span className="fo-kbbar__sep" role="separator" />}
          <button type="button" className={`fo-kbbar__btn${it.pressed ? ' is-pressed' : ''}`} aria-label={it.label} aria-pressed={it.pressed} disabled={it.disabled} onPointerDown={keep} onClick={it.onClick}>
            {it.icon ? <Icon name={it.icon} size={22} /> : it.text}
          </button>
        </span>
      ))}
      {fold.overflow > 0 && (
        <button type="button" className="fo-kbbar__btn" aria-label={S.kbBar.more} aria-haspopup="menu" onPointerDown={keep} onClick={(e) => setMore(e.currentTarget)}>
          <Icon name="more_horizontal" size={22} />
        </button>
      )}
      {more && <Menu items={menuItems} anchor={more} placement="above" onClose={() => setMore(null)} label={S.kbBar.more} />}
    </div>
  );
}
