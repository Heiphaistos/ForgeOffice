// Rendu des controles du ruban selon leur taille effective (grand, petit avec libelle, icone seule).
import { useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../icons/Icon.tsx';
import type { ButtonControl, MenuControl, RibbonControl, SplitButtonControl, ToggleControl } from '../../ribbon-types.ts';
import { S } from '../../strings.ts';
import { isOnlyOffice } from '../../logic/ooMode.ts';
import { Menu } from '../Menu.tsx';
import { Tooltip } from '../Tooltip.tsx';
import { ColorPicker } from '../ColorPicker.tsx';
import { ComboBox } from '../ComboBox.tsx';
import { FontPicker } from '../FontPicker.tsx';
import { Checkbox, NumberField } from '../Controls.tsx';
import { RibbonGallery } from './RibbonGallery.tsx';

/** Taille effective d'un controle : grand, petit avec libelle, icone seule. */
export type ControlMode = 'large' | 'small' | 'icon';

export interface ControlContext {
  /** Info-touches du panneau courant (id du controle -> touche). */
  keytips: ReadonlyMap<string, string>;
  /** Appele apres une commande (ferme le ruban flottant quand il est replie). */
  onCommand: () => void;
}

type Pressable = ButtonControl | ToggleControl | MenuControl | SplitButtonControl;

function ButtonFace({ control, mode, chevron }: { control: Pressable; mode: ControlMode; chevron: boolean }) {
  if (mode === 'large') {
    return (
      <>
        {control.icon && <Icon name={control.icon} size={32} />}
        <span className="fo-rb-btn__label">
          {control.label}
          {chevron && <Icon name="chevron_down" size={12} className="fo-rb-btn__chev" />}
        </span>
      </>
    );
  }
  return (
    <>
      {control.icon && <Icon name={control.icon} size={20} filled={control.kind === 'toggle' && control.pressed} />}
      {mode === 'small' && <span className="fo-rb-btn__label">{control.label}</span>}
      {chevron && <Icon name="chevron_down" size={12} className="fo-rb-btn__chev" />}
    </>
  );
}

function effectiveMode(control: Pressable, mode: ControlMode): ControlMode {
  if (mode === 'small' && control.iconOnly && control.icon) return 'icon';
  if (mode === 'large' && control.size !== 'large') return control.iconOnly && control.icon ? 'icon' : 'small';
  if (!control.icon) return mode === 'large' ? 'large' : 'small';
  return mode;
}

function PressableControl({ control, mode, ctx }: { control: Pressable; mode: ControlMode; ctx: ControlContext }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const arrowRef = useRef<HTMLButtonElement>(null);
  const m = effectiveMode(control, mode);
  const tip = control.tooltip ?? { title: control.label };
  const keytip = ctx.keytips.get(control.id);
  const cls = `fo-rb-btn fo-rb-btn--${m} fo-hc-invert`;

  if (control.kind === 'split') {
    return (
      <span className={`fo-rb-split fo-rb-split--${m}${menuOpen ? ' is-open' : ''}`} data-cmd={control.id}>
        <Tooltip content={tip}>
          <button ref={ref} type="button" className={`${cls} fo-rb-split__main`} disabled={control.disabled} aria-label={m === 'icon' ? control.label : undefined} data-keytip={keytip} data-ribbon-focus onClick={() => { control.onClick(); ctx.onCommand(); }}>
            {m === 'large' ? control.icon && <Icon name={control.icon} size={32} /> : <ButtonFace control={control} mode={m} chevron={false} />}
          </button>
        </Tooltip>
        <button ref={arrowRef} type="button" className="fo-rb-split__arrow fo-hc-invert" disabled={control.disabled} aria-label={`${control.label} : ${S.ribbon.more}`} aria-haspopup="menu" aria-expanded={menuOpen} data-ribbon-focus onClick={() => setMenuOpen((o) => !o)}>
          {m === 'large' && <span className="fo-rb-btn__label">{control.label}</span>}
          <Icon name="chevron_down" size={12} />
        </button>
        {menuOpen && arrowRef.current && (
          <Menu items={control.items} anchor={arrowRef.current.parentElement ?? arrowRef.current} onClose={() => { setMenuOpen(false); }} onDone={() => { setMenuOpen(false); ctx.onCommand(); }} label={control.label} />
        )}
      </span>
    );
  }

  if (control.kind === 'menu') {
    return (
      <>
        <Tooltip content={tip}>
          <button ref={ref} type="button" className={`${cls}${menuOpen ? ' is-open' : ''}`} disabled={control.disabled} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={m === 'icon' ? control.label : undefined} data-keytip={keytip} data-cmd={control.id} data-ribbon-focus onClick={() => setMenuOpen((o) => !o)}>
            <ButtonFace control={control} mode={m} chevron />
          </button>
        </Tooltip>
        {menuOpen && ref.current && <Menu items={control.items} anchor={ref.current} onClose={() => setMenuOpen(false)} onDone={() => { setMenuOpen(false); ctx.onCommand(); }} label={control.label} />}
      </>
    );
  }

  const pressed = control.kind === 'toggle' ? control.pressed : undefined;
  return (
    <Tooltip content={tip}>
      <button
        ref={ref}
        type="button"
        className={`${cls}${pressed ? ' is-pressed' : ''}`}
        disabled={control.disabled}
        aria-pressed={pressed}
        aria-label={m === 'icon' ? control.label : undefined}
        data-keytip={keytip}
        data-cmd={control.id}
        data-ribbon-focus
        onClick={() => {
          if (control.kind === 'toggle') control.onToggle(!control.pressed);
          else control.onClick();
          ctx.onCommand();
        }}
      >
        <ButtonFace control={control} mode={m} chevron={false} />
      </button>
    </Tooltip>
  );
}

/** Rendu d'un controle du ruban. `mode` = taille maximale permise par le niveau de reduction du groupe. */
export function RibbonControlView({ control, mode, ctx, galleryLevel = 0 }: { control: RibbonControl; mode: ControlMode; ctx: ControlContext; galleryLevel?: number }): ReactNode {
  if (control.hidden) return null;
  switch (control.kind) {
    case 'button':
    case 'toggle':
    case 'menu':
    case 'split':
      return <PressableControl control={control} mode={mode} ctx={ctx} />;
    case 'separator':
      return <span className="fo-rb-sep" role="separator" aria-orientation="vertical" />;
    case 'row':
      return (
        <span className="fo-rb-row" role="group">
          {control.controls.map((c) => (
            <RibbonControlView key={c.id} control={c} mode={'caption' in c && c.caption && isOnlyOffice() ? 'small' : 'icon'} ctx={ctx} />
          ))}
        </span>
      );
    case 'combo':
      return (
        <Tooltip content={control.tooltip ?? { title: control.label }}>
          <span className="fo-rb-field" data-cmd={control.id}>
            <ComboBox label={control.label} value={control.value} options={control.options} editable={control.editable} validate={control.validate} width={control.width ?? 100} disabled={control.disabled} keytip={ctx.keytips.get(control.id)} onChange={(v) => { control.onChange(v); ctx.onCommand(); }} />
          </span>
        </Tooltip>
      );
    case 'font':
      return (
        <Tooltip content={control.tooltip ?? { title: control.label }}>
          <span className="fo-rb-field" data-cmd={control.id}>
            <FontPicker value={control.value} width={control.width ?? 140} disabled={control.disabled} keytip={ctx.keytips.get(control.id)} onChange={(v) => { control.onChange(v); ctx.onCommand(); }} />
          </span>
        </Tooltip>
      );
    case 'number':
      return (
        <Tooltip content={control.tooltip ?? { title: control.label }}>
          <span className="fo-rb-field fo-rb-number" data-cmd={control.id} data-keytip={ctx.keytips.get(control.id)}>
            {control.icon && <Icon name={control.icon} size={16} />}
            {(mode !== 'icon' || (control.caption && isOnlyOffice())) && <span className="fo-rb-field__label">{control.label}</span>}
            <NumberField value={control.value} min={control.min} max={control.max} step={control.step} unit={control.unit} label={control.label} width={control.width ?? 72} disabled={control.disabled} onChange={control.onChange} />
          </span>
        </Tooltip>
      );
    case 'checkbox':
      return (
        <Tooltip content={control.tooltip}>
          <span className="fo-rb-check" data-cmd={control.id} data-keytip={ctx.keytips.get(control.id)}>
            <Checkbox label={control.label} checked={control.checked} disabled={control.disabled} onChange={control.onChange} />
          </span>
        </Tooltip>
      );
    case 'color':
      return (
        <ColorPicker
          label={control.label}
          icon={control.icon}
          value={control.value}
          emptyMode={control.emptyMode}
          themeColors={control.themeColors}
          palette={control.palette}
          size={mode === 'large' && control.size === 'large' ? 'large' : 'small'}
          showLabel={mode === 'small' && !control.iconOnly}
          disabled={control.disabled}
          tooltip={control.tooltip}
          keytip={ctx.keytips.get(control.id)}
          cmd={control.id}
          onChange={(c) => { control.onChange(c); ctx.onCommand(); }}
        />
      );
    case 'gallery':
      return <RibbonGallery control={control} level={galleryLevel} keytip={ctx.keytips.get(control.id)} onCommand={ctx.onCommand} />;
    case 'custom':
      return <span className="fo-rb-custom" data-cmd={control.id} data-keytip={ctx.keytips.get(control.id)}>{control.render()}</span>;
  }
}

/** true si le controle occupe toute la hauteur du groupe (grand bouton, galerie en ligne, separateur). */
export function isTall(control: RibbonControl, mode: ControlMode): boolean {
  switch (control.kind) {
    case 'separator':
      return true;
    case 'gallery':
      return true;
    case 'button':
    case 'toggle':
    case 'menu':
    case 'split':
    case 'color':
      return mode === 'large' && control.size === 'large';
    default:
      return false;
  }
}
