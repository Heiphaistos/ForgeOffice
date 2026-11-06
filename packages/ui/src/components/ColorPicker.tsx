// Selecteur de couleur Office : couleurs du theme en nuances, couleurs standard, recentes, Automatique/Aucune, Autres couleurs.
import { useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactElement } from 'react';
import { Icon } from '../icons/Icon.tsx';
import type { IconName } from '../icons/generated.ts';
import { S } from '../strings.ts';
import { OFFICE_THEME_COLORS, STANDARD_COLORS, normalizeHex, pushRecentColor, themeShades, type Swatch } from '../logic/color.ts';
import { Popover } from './Popover.tsx';
import { Tooltip } from './Tooltip.tsx';
import type { TooltipContent } from '../ribbon-types.ts';
import './ColorPicker.css';

// Couleurs recentes partagees par tous les selecteurs de la session.
let recentColors: string[] = [];
const listeners = new Set<() => void>();
function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function rememberColor(color: string): void {
  recentColors = pushRecentColor(recentColors, color);
  for (const fn of listeners) fn();
}

export interface ColorPaletteProps {
  value: string | null;
  onPick: (color: string | null) => void;
  emptyMode?: 'automatic' | 'none';
  /** 10 couleurs du theme du document ; defaut : theme Office. */
  themeColors?: readonly string[];
}

/** Palette seule (a placer dans un menu, un volet ou une boite de dialogue). */
export function ColorPalette({ value, onPick, emptyMode = 'automatic', themeColors }: ColorPaletteProps) {
  const recent = useSyncExternalStore(subscribe, () => recentColors);
  const [custom, setCustom] = useState(false);
  const [hex, setHex] = useState(value ?? '#000000');
  const gridRef = useRef<HTMLDivElement>(null);
  const theme: Swatch[] = OFFICE_THEME_COLORS.map((s, i) => ({ label: s.label, color: normalizeHex(themeColors?.[i] ?? '') ?? s.color }));
  const columns = theme.map((s) => [s, ...themeShades(s)]);
  const current = value ? normalizeHex(value) : null;

  const pick = (color: string | null): void => {
    if (color) rememberColor(color);
    onPick(color);
  };

  // Fleches dans la grille : 10 colonnes.
  const onGridKey = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    const cells = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>('.fo-swatch') ?? [])];
    const i = cells.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 10, ArrowUp: -10 }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    cells[Math.min(cells.length - 1, Math.max(0, i + delta))]?.focus();
  };

  const swatch = (s: Swatch, extra = ''): ReactElement => (
    <button
      key={`${s.color}-${s.label}`}
      type="button"
      className={`fo-swatch${extra}${current === s.color ? ' is-selected' : ''}`}
      style={{ background: s.color }}
      title={s.label}
      aria-label={s.label}
      onClick={() => pick(s.color)}
    />
  );

  return (
    <div className="fo-palette">
      <button type="button" className="fo-palette__row" onClick={() => pick(null)} data-autofocus>
        <span className={`fo-palette__empty fo-palette__empty--${emptyMode}`} />
        {emptyMode === 'automatic' ? S.color.automatic : S.color.none}
      </button>
      <div ref={gridRef} onKeyDown={onGridKey}>
        <div className="fo-palette__title">{S.color.theme}</div>
        <div className="fo-palette__grid">
          {columns.map((col) => swatch(col[0] ?? { color: '#000000', label: '' }))}
        </div>
        <div className="fo-palette__grid fo-palette__grid--shades">
          {[1, 2, 3, 4, 5].flatMap((row) => columns.map((col) => swatch(col[row] ?? { color: '#000000', label: '' }, ' fo-swatch--shade')))}
        </div>
        <div className="fo-palette__title">{S.color.standard}</div>
        <div className="fo-palette__grid">{STANDARD_COLORS.map((s) => swatch(s))}</div>
        {recent.length > 0 && (
          <>
            <div className="fo-palette__title">{S.color.recent}</div>
            <div className="fo-palette__grid">{recent.map((c) => swatch({ color: c, label: c }))}</div>
          </>
        )}
      </div>
      <div className="fo-palette__sep" />
      {custom ? (
        <div className="fo-palette__custom">
          <input type="color" aria-label={S.color.moreTitle} value={normalizeHex(hex) ?? '#000000'} onChange={(e) => setHex(e.currentTarget.value.toUpperCase())} />
          <input
            className="fo-palette__hex"
            aria-label={S.color.hex}
            value={hex}
            maxLength={7}
            onChange={(e) => setHex(e.currentTarget.value)}
            onKeyDown={(e) => {
              const ok = normalizeHex(hex);
              if (e.key === 'Enter' && ok) pick(ok);
            }}
          />
          <button type="button" className="fo-palette__apply" disabled={!normalizeHex(hex)} onClick={() => pick(normalizeHex(hex))}>
            {S.color.apply}
          </button>
        </div>
      ) : (
        <button type="button" className="fo-palette__row" onClick={() => setCustom(true)}>
          <Icon name="color" size={20} />
          {S.color.more}
        </button>
      )}
    </div>
  );
}

export interface ColorPickerProps {
  label: string;
  icon?: IconName;
  value: string | null;
  onChange: (color: string | null) => void;
  emptyMode?: 'automatic' | 'none';
  themeColors?: readonly string[];
  /** Grand bouton (icone 32) ou petit (16). */
  size?: 'large' | 'small';
  showLabel?: boolean;
  disabled?: boolean;
  tooltip?: TooltipContent;
  keytip?: string;
  /** Identifiant de commande expose au banc de conformite (data-cmd). */
  cmd?: string;
}

/** Bouton partage couleur : la partie gauche applique la couleur courante (barre sous l'icone), la fleche ouvre la palette. */
export function ColorPicker({ label, icon = 'color', value, onChange, emptyMode, themeColors, size = 'small', showLabel = false, disabled, tooltip, keytip, cmd }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const arrowRef = useRef<HTMLButtonElement>(null);
  const bar = value ?? (emptyMode === 'none' ? 'transparent' : 'var(--fo-text)');
  const large = size === 'large';
  return (
    <span className={`fo-colorpick${large ? ' fo-colorpick--large' : ''}${open ? ' is-open' : ''}`} data-cmd={cmd}>
      <Tooltip content={tooltip ?? { title: label }}>
        <button type="button" className="fo-colorpick__main fo-hc-invert" disabled={disabled} aria-label={label} data-keytip={keytip} data-ribbon-focus onClick={() => onChange(value)}>
          <span className="fo-colorpick__icon">
            <Icon name={icon} size={large ? 32 : 20} />
            <span className="fo-colorpick__bar" style={{ background: bar }} />
          </span>
          {(showLabel || large) && <span className="fo-colorpick__label">{label}</span>}
        </button>
      </Tooltip>
      <button
        ref={arrowRef}
        type="button"
        className="fo-colorpick__arrow fo-hc-invert"
        disabled={disabled}
        aria-label={`${label} : ${S.color.theme}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-ribbon-focus
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="chevron_down" size={12} />
      </button>
      {open && arrowRef.current && (
        <Popover anchor={arrowRef.current.parentElement ?? arrowRef.current} onClose={() => setOpen(false)} label={label}>
          <ColorPalette
            value={value}
            emptyMode={emptyMode}
            themeColors={themeColors}
            onPick={(c) => {
              setOpen(false);
              onChange(c);
            }}
          />
        </Popover>
      )}
    </span>
  );
}
