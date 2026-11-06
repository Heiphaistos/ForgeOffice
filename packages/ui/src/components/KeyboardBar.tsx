// Barre d'outils flottante au-dessus du clavier virtuel : boutons de 44 px, repli du surplus dans « Plus ».
// Les boutons ne prennent pas le focus (pointerdown annule), le clavier reste ouvert et la selection intacte.
import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { Icon } from '../icons/Icon.tsx';
import type { IconName } from '../icons/generated.ts';
import type { MenuItem, RibbonControl, RibbonTab } from '../ribbon-types.ts';
import { flattenControls } from '../logic/mobileRibbon.ts';
import { foldToolbar, TOUCH_TARGET } from '../logic/touch.ts';
import { useDeviceMode, useTouchEditing } from '../touch.ts';
import { S } from '../strings.ts';
import { STANDARD_COLORS } from '../logic/color.ts';
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
  /** Pastille de couleur sous l'icone (couleur de police, surlignage). */
  swatch?: string | null;
  /** Menu a ouvrir (feuille du bas sur telephone) a la place de `onClick` : couleurs, styles... */
  items?: readonly MenuItem[];
  onClick?: () => void;
}

/** Entrees de menu « couleur » : Automatique + couleurs standard avec pastille ; `onPick(null)` = automatique / aucune. */
export function colorMenuItems(emptyLabel: string, onPick: (color: string | null) => void, current?: string | null): MenuItem[] {
  const dot = (c: string | null): ReactElement => <span className="fo-kbbar__swatch" style={{ background: c ?? 'transparent', marginTop: 0 }} />;
  return [
    { id: 'none', label: emptyLabel, adornment: dot(null), checked: current == null ? true : undefined, onClick: () => onPick(null) },
    ...STANDARD_COLORS.map((c): MenuItem => ({ id: c.color, label: c.label, adornment: dot(c.color), checked: current?.toUpperCase() === c.color.toUpperCase() ? true : undefined, onClick: () => onPick(c.color) })),
  ];
}

/**
 * Barre de mise en forme tirée du ruban : memes commandes que le ruban (donc memes effets), choisies par identifiant.
 * bouton -> bouton ; bascule -> bouton enfonce ; menu / bouton partage / galerie / liste -> menu en feuille du bas ; couleur -> pastille + palette.
 * `separatorBefore` : identifiants devant lesquels un separateur est insere.
 */
export function itemsFromTab(tab: RibbonTab, ids: readonly string[], separatorBefore: readonly string[] = []): KeyboardBarItem[] {
  const all = new Map(tab.groups.flatMap((g) => flattenControls(g.controls)).map((c) => [c.id, c] as const));
  const out: KeyboardBarItem[] = [];
  for (const id of ids) {
    const c: RibbonControl | undefined = all.get(id);
    if (!c || c.hidden) continue;
    const base = { id: c.id, label: c.label, separator: separatorBefore.includes(id) || undefined };
    switch (c.kind) {
      case 'button':
        out.push({ ...base, icon: c.icon, disabled: c.disabled, onClick: c.onClick });
        break;
      case 'toggle':
        out.push({ ...base, icon: c.icon, disabled: c.disabled, pressed: c.pressed, onClick: () => c.onToggle(!c.pressed) });
        break;
      case 'split':
        out.push({ ...base, icon: c.icon, disabled: c.disabled, onClick: c.onClick });
        break;
      case 'menu':
        out.push({ ...base, icon: c.icon, disabled: c.disabled, items: c.items });
        break;
      case 'color':
        out.push({ ...base, icon: c.icon, disabled: c.disabled, swatch: c.value, items: colorMenuItems(c.emptyMode === 'none' ? S.color.none : S.color.automatic, c.onChange, c.value) });
        break;
      case 'gallery':
        out.push({ ...base, icon: c.icon ?? 'text_font', disabled: c.disabled, items: c.items.map((i): MenuItem => ({ id: i.id, label: i.label, checked: c.selectedId === i.id ? true : undefined, onClick: () => c.onSelect(i.id) })) });
        break;
      case 'combo':
        out.push({ ...base, text: c.value || c.label, disabled: c.disabled, items: c.options.map((o): MenuItem => ({ id: o.value, label: o.label ?? o.value, checked: c.value === o.value ? true : undefined, onClick: () => c.onChange(o.value) })) });
        break;
      default:
        break;
    }
  }
  return out;
}

export interface KeyboardBarProps {
  items: readonly KeyboardBarItem[];
  /** Selecteur de la zone de saisie qui declenche la barre (sinon n'importe quelle zone de saisie). */
  scope?: string;
  /** Surplus : « fold » le replie dans un menu « Plus » (defaut), « scroll » fait defiler la barre au doigt (beaucoup de signes). */
  overflow?: 'fold' | 'scroll';
  /** Montre la barre meme sans zone de saisie focalisee (tests, mode force). */
  alwaysVisible?: boolean;
  /** Ajoute en fin de barre le bouton « Fermer le clavier » (defaut : oui). */
  hideButton?: boolean;
}

const itemWidth = (it: KeyboardBarItem): number => (it.text && it.text.length > 2 ? TOUCH_TARGET + 12 : TOUCH_TARGET) + (it.separator ? 9 : 0);

export function KeyboardBar({ items, scope, overflow = 'fold', alwaysVisible = false, hideButton = true }: KeyboardBarProps) {
  const editing = useTouchEditing(scope);
  const device = useDeviceMode(); // hook appele sans condition (l'ordre des hooks ne doit jamais changer)
  const forced = alwaysVisible && device.form !== 'desktop';
  const barRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [more, setMore] = useState<HTMLElement | null>(null);
  const [sub, setSub] = useState<{ el: HTMLElement; items: readonly MenuItem[]; label: string } | null>(null);
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const sync = (): void => setWidth(el.clientWidth - 16);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [editing, forced]);
  // Un menu ouvert prend le focus de l'editeur : la barre (et son menu) doit rester pendant ce temps.
  const shownBar = editing || forced || more !== null || sub !== null;
  // La barre remplace la barre d'etat et reserve sa place en bas de la coquille (voir touch.css).
  useEffect(() => {
    if (!shownBar) return;
    document.documentElement.classList.add('fo-kbbar-on');
    return () => document.documentElement.classList.remove('fo-kbbar-on');
  }, [shownBar]);
  if (!shownBar) return null;

  const fold = overflow === 'fold' && width > 0 ? foldToolbar(items.map(itemWidth), width) : { visible: items.length, overflow: 0 };
  const shown = items.slice(0, fold.visible);
  const hidden = items.slice(fold.visible);
  const menuItems: MenuItem[] = hidden.map((it) => ({ id: it.id, label: it.label, icon: it.icon, disabled: it.disabled, checked: it.pressed, items: it.items, onClick: it.onClick }));
  // Garde le focus de l'editeur : un bouton ne vole ni le focus ni la selection.
  const keep = (e: { preventDefault: () => void }): void => e.preventDefault();

  return (
    <div ref={barRef} className="fo-kbbar" role="toolbar" aria-label={S.kbBar.label} onPointerDown={keep}>
      {shown.map((it) => (
        <span key={it.id} style={{ display: 'contents' }}>
          {it.separator && <span className="fo-kbbar__sep" role="separator" />}
          <button
            type="button"
            className={`fo-kbbar__btn${it.pressed ? ' is-pressed' : ''}${it.swatch !== undefined ? ' has-swatch' : ''}`}
            aria-label={it.label}
            aria-pressed={it.pressed}
            aria-haspopup={it.items ? 'menu' : undefined}
            data-kb={it.id}
            disabled={it.disabled}
            onPointerDown={keep}
            onClick={(e) => (it.items ? setSub({ el: e.currentTarget, items: it.items, label: it.label }) : it.onClick?.())}
          >
            {it.icon ? <Icon name={it.icon} size={22} /> : it.text}
            {it.swatch !== undefined && <span className="fo-kbbar__swatch" style={{ background: it.swatch ?? 'transparent' }} />}
          </button>
        </span>
      ))}
      {fold.overflow > 0 && (
        <button type="button" className="fo-kbbar__btn" aria-label={S.kbBar.more} aria-haspopup="menu" onPointerDown={keep} onClick={(e) => setMore(e.currentTarget)}>
          <Icon name="more_horizontal" size={22} />
        </button>
      )}
      {hideButton && (
        <>
          <span className="fo-kbbar__sep" role="separator" />
          <button type="button" className="fo-kbbar__btn" aria-label={S.kbBar.hide} data-kb="hide-keyboard" onPointerDown={keep} onClick={() => (document.activeElement as HTMLElement | null)?.blur()}>
            <Icon name="keyboard" size={22} />
          </button>
        </>
      )}
      {sub && <Menu items={sub.items} anchor={sub.el} placement="above" onClose={() => setSub(null)} label={sub.label} />}
      {more && <Menu items={menuItems} anchor={more} placement="above" onClose={() => setMore(null)} label={S.kbBar.more} />}
    </div>
  );
}
