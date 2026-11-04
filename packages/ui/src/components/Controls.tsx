// Controles de base Fluent 2 : bouton, interrupteur, champ, case, compteur, attente, progression.
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from '../icons/Icon.tsx';
import type { IconName } from '../icons/generated.ts';
import { S } from '../strings.ts';
import './Controls.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  appearance?: 'primary' | 'secondary' | 'subtle' | 'transparent';
  icon?: IconName;
  iconPosition?: 'before' | 'after';
  size?: 'small' | 'medium' | 'large';
}

export function Button({ appearance = 'secondary', icon, iconPosition = 'before', size = 'medium', className, children, type = 'button', ...rest }: ButtonProps) {
  const iconSize = size === 'large' ? 24 : 20;
  const iconOnly = children === undefined || children === null || children === false;
  return (
    <button
      type={type}
      className={`fo-btn fo-btn--${appearance} fo-btn--${size}${iconOnly ? ' fo-btn--icon' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {icon && iconPosition === 'before' && <Icon name={icon} size={iconSize} />}
      {!iconOnly && <span className="fo-btn__label">{children}</span>}
      {icon && iconPosition === 'after' && <Icon name={icon} size={iconSize} />}
    </button>
  );
}

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  /** Texte d'etat affiche apres l'interrupteur (« Active »). */
  stateLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, label, stateLabel, disabled, className }: SwitchProps) {
  return (
    <label className={`fo-switch${className ? ` ${className}` : ''}${disabled ? ' is-disabled' : ''}`}>
      {label && <span className="fo-switch__label">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`fo-switch__track${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="fo-switch__thumb" />
      </button>
      {stateLabel && <span className="fo-switch__state">{stateLabel}</span>}
    </label>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  icon?: IconName;
  hint?: string;
  error?: string;
  contentAfter?: ReactNode;
  appearance?: 'outline' | 'filled' | 'underline';
}

export function TextField({ label, icon, hint, error, contentAfter, appearance = 'outline', className, id, ...rest }: TextFieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={`fo-field${className ? ` ${className}` : ''}`}>
      {label && (
        <label className="fo-field__label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className={`fo-input fo-input--${appearance}${error ? ' is-invalid' : ''}`}>
        {icon && <Icon name={icon} size={20} className="fo-input__icon" />}
        <input id={inputId} aria-invalid={error ? true : undefined} {...rest} />
        {contentAfter}
      </div>
      {(error ?? hint) && <div className={error ? 'fo-field__error' : 'fo-field__hint'}>{error ?? hint}</div>}
    </div>
  );
}

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  /** Case partiellement cochee. */
  mixed?: boolean;
}

export function Checkbox({ checked, onChange, label, disabled, mixed }: CheckboxProps) {
  return (
    <label className={`fo-checkbox${disabled ? ' is-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        ref={(el) => {
          if (el) el.indeterminate = mixed === true;
        }}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
  width?: number;
  disabled?: boolean;
}

/** Compteur numerique (fleches haut/bas, molette, saisie a la virgule). */
export function NumberField({ value, onChange, min = -Infinity, max = Infinity, step = 1, unit, label, width = 72, disabled }: NumberFieldProps) {
  const commit = (n: number): void => {
    if (!Number.isFinite(n)) return;
    const decimals = (String(step).split('.')[1] ?? '').length;
    onChange(Number(Math.min(max, Math.max(min, n)).toFixed(decimals)));
  };
  const shown = `${String(value).replace('.', ',')}${unit ? ` ${unit}` : ''}`;
  return (
    <span className={`fo-number${disabled ? ' is-disabled' : ''}`} style={{ width }}>
      <input
        aria-label={label}
        role="spinbutton"
        aria-valuenow={value}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        disabled={disabled}
        defaultValue={shown}
        key={shown}
        onBlur={(e) => commit(parseFloat(e.currentTarget.value.replace(',', '.')))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(parseFloat(e.currentTarget.value.replace(',', '.')));
          else if (e.key === 'ArrowUp') {
            e.preventDefault();
            commit(value + step);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            commit(value - step);
          }
        }}
      />
      <span className="fo-number__spin">
        <button type="button" tabIndex={-1} disabled={disabled} aria-hidden onClick={() => commit(value + step)}>
          <Icon name="chevron_up" size={12} />
        </button>
        <button type="button" tabIndex={-1} disabled={disabled} aria-hidden onClick={() => commit(value - step)}>
          <Icon name="chevron_down" size={12} />
        </button>
      </span>
    </span>
  );
}

export function Spinner({ size = 24, label }: { size?: number; label?: string }) {
  return (
    <span className="fo-spinner" role="progressbar" aria-label={label ?? S.progress.loading} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <circle cx="12" cy="12" r="10" className="fo-spinner__track" />
        <circle cx="12" cy="12" r="10" className="fo-spinner__arc" />
      </svg>
    </span>
  );
}

/** Barre de progression : `value` 0..1, ou indeterminee si absent. */
export function ProgressBar({ value, label }: { value?: number; label?: string }) {
  const pct = value === undefined ? undefined : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="fo-progress" role="progressbar" aria-label={label ?? S.progress.loading} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className={pct === undefined ? 'fo-progress__bar is-indeterminate' : 'fo-progress__bar'} style={pct === undefined ? undefined : { width: `${pct}%` }} />
    </div>
  );
}

/** Carre d'application colore avec son sigle (Texte « T », Tableur « X »...). */
export function AppBadge({ glyph, color, size = 24, label }: { glyph: string; color: string; size?: number; label?: string }) {
  return (
    <span
      className="fo-appbadge"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * (glyph.length > 1 ? 0.36 : 0.56)), borderRadius: Math.max(3, Math.round(size / 6)) }}
    >
      {glyph}
    </span>
  );
}
