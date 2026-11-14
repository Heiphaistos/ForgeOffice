// Bouton de ruban (grand ou petit, simple ou partage) qui ouvre une galerie libre (dispositions, formes, grille de tableau...).
import { useRef, useState, type ReactNode } from 'react';
import { Icon, Menu, Popover, Tooltip, type IconName, type MenuItem } from '@forgeoffice/ui';
import './ribbon.css';

export interface PopupGalleryProps {
  label: string;
  icon: IconName;
  /** Action du bouton principal (bouton partage) ; absent = le bouton entier ouvre la galerie. */
  onClick?: () => void;
  size?: 'large' | 'small';
  tooltip?: string;
  disabled?: boolean;
  children: (close: () => void) => ReactNode;
}

export function PopupGallery({ label, icon, onClick, size = 'large', tooltip, disabled, children }: PopupGalleryProps) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const close = (): void => setOpen(false);
  const large = size === 'large';
  const face = (
    <>
      {large ? <Icon name={icon} size={32} /> : <Icon name={icon} size={20} />}
      {!large && <span className="fo-rb-btn__label">{label}</span>}
    </>
  );
  return (
    <span ref={anchor} className={`fo-rb-split fo-rb-split--${large ? 'large' : 'small'}${open ? ' is-open' : ''}`}>
      {onClick ? (
        <>
          <Tooltip content={{ title: label, description: tooltip }}>
            <button type="button" className={`fo-rb-btn fo-rb-btn--${large ? 'large' : 'small'} fo-hc-invert fo-rb-split__main`} disabled={disabled} aria-label={label} data-ribbon-focus onClick={onClick}>
              {face}
            </button>
          </Tooltip>
          <button type="button" className="fo-rb-split__arrow fo-hc-invert" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} data-ribbon-focus onClick={() => setOpen((o) => !o)}>
            {large && <span className="fo-rb-btn__label">{label}</span>}
            <Icon name="chevron_down" size={12} />
          </button>
        </>
      ) : (
        <Tooltip content={{ title: label, description: tooltip }}>
          <button type="button" className={`fo-rb-btn fo-rb-btn--${large ? 'large' : 'small'} fo-hc-invert`} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} data-ribbon-focus onClick={() => setOpen((o) => !o)}>
            {face}
            {large && (
              <span className="fo-rb-btn__label">
                {label} <Icon name="chevron_down" size={10} />
              </span>
            )}
            {!large && <Icon name="chevron_down" size={10} />}
          </button>
        </Tooltip>
      )}
      {open && anchor.current && (
        <Popover anchor={anchor.current} onClose={close} className="pp-popgal" label={label}>
          {children(close)}
        </Popover>
      )}
    </span>
  );
}

/** Grille d'elements d'une galerie avec titres de sections. */
export function GalleryGrid({ sections, columns, onPick }: { sections: ReadonlyArray<{ title?: string; items: ReadonlyArray<{ id: string; label: string; render: ReactNode }> }>; columns: number; onPick: (id: string) => void }) {
  return (
    <div className="pp-popgal__body">
      {sections.map((section, i) => (
        <div key={i}>
          {section.title && <div className="pp-popgal__title">{section.title}</div>}
          <div className="pp-popgal__grid" style={{ gridTemplateColumns: `repeat(${columns}, auto)` }}>
            {section.items.map((item) => (
              <button key={item.id} type="button" className="pp-popgal__item" title={item.label} onClick={() => onPick(item.id)}>
                {item.render}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Petit bouton de ruban (pour les groupes composes a la main). */
export function SmallButton({ label, icon, onClick, disabled, tooltip }: { label: string; icon: IconName; onClick: () => void; disabled?: boolean; tooltip?: string }) {
  return (
    <Tooltip content={{ title: label, description: tooltip }}>
      <button type="button" className="fo-rb-btn fo-rb-btn--small fo-hc-invert" disabled={disabled} data-ribbon-focus onClick={onClick}>
        <Icon name={icon} size={20} />
        <span className="fo-rb-btn__label">{label}</span>
      </button>
    </Tooltip>
  );
}

/** Petit bouton de ruban avec menu deroulant. */
export function SmallMenu({ label, icon, items, disabled }: { label: string; icon: IconName; items: readonly MenuItem[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={ref} type="button" className={`fo-rb-btn fo-rb-btn--small fo-hc-invert${open ? ' is-open' : ''}`} disabled={disabled} aria-haspopup="menu" aria-expanded={open} data-ribbon-focus onClick={() => setOpen((o) => !o)}>
        <Icon name={icon} size={20} />
        <span className="fo-rb-btn__label">{label}</span>
        <Icon name="chevron_down" size={12} className="fo-rb-btn__chev" />
      </button>
      {open && ref.current && <Menu items={items} anchor={ref.current} onClose={() => setOpen(false)} onDone={() => setOpen(false)} label={label} />}
    </>
  );
}
