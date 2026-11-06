// Galerie du ruban (Styles, Formes, Themes...) : bande en ligne defilante, depliage en grille, apercu au survol.
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Icon } from '../../icons/Icon.tsx';
import type { GalleryControl, GalleryItem, MenuItem } from '../../ribbon-types.ts';
import { S } from '../../strings.ts';
import { Popover } from '../Popover.tsx';
import { Menu } from '../Menu.tsx';
import { Tooltip } from '../Tooltip.tsx';

const PREVIEW_DELAY = 120;

function ItemFace({ item }: { item: GalleryItem }) {
  if (item.render) return <>{item.render()}</>;
  return (
    <>
      {item.icon && <Icon name={item.icon} size={24} />}
      {item.sample !== undefined && (
        <span className="fo-gal__sample" style={item.style}>
          {item.sample}
        </span>
      )}
      <span className="fo-gal__label">{item.label}</span>
    </>
  );
}

/** level 0 : bande large ; 1 : bande etroite ; 2+ : grand bouton qui deplie la galerie. */
export function RibbonGallery({ control, level, keytip, onCommand }: { control: GalleryControl; level: number; keytip?: string; onCommand: () => void }) {
  const [row, setRow] = useState(0);
  const [open, setOpen] = useState(false);
  const [footerMenu, setFooterMenu] = useState<{ el: HTMLElement; items: readonly MenuItem[] } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const previewing = useRef(false);
  const itemWidth = control.itemWidth ?? 72;
  const perRow = level === 0 ? 5 : 3;
  const rows = Math.max(1, Math.ceil(control.items.length / perRow));
  const visible = control.items.slice(row * perRow, row * perRow + perRow);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const preview = (id: string): void => {
    if (!control.onPreview) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      previewing.current = true;
      control.onPreview?.(id);
    }, PREVIEW_DELAY);
  };
  const endPreview = (): void => {
    window.clearTimeout(timer.current);
    if (previewing.current) {
      previewing.current = false;
      control.onPreviewEnd?.();
    }
  };
  const select = (id: string): void => {
    endPreview();
    setOpen(false);
    control.onSelect(id);
    onCommand();
  };

  const tile = (item: GalleryItem, inGrid: boolean): ReactElement => (
    <Tooltip key={item.id} content={{ title: item.label }}>
      <button
        type="button"
        role="option"
        aria-selected={control.selectedId === item.id}
        className={`fo-gal__item fo-hc-invert${control.selectedId === item.id ? ' is-selected' : ''}`}
        style={{ width: itemWidth }}
        disabled={control.disabled}
        data-ribbon-focus={inGrid ? undefined : true}
        data-cmd-item={item.id}
        onMouseEnter={() => preview(item.id)}
        onFocus={() => preview(item.id)}
        onClick={() => select(item.id)}
      >
        <ItemFace item={item} />
      </button>
    </Tooltip>
  );

  const grid = open && hostRef.current && (
    <Popover anchor={hostRef.current} onClose={() => { endPreview(); setOpen(false); }} label={control.label} className="fo-gal__popup">
      <div className="fo-gal__grid" role="listbox" aria-label={control.label} style={{ gridTemplateColumns: `repeat(${control.columns ?? 6}, ${itemWidth}px)` }} onMouseLeave={endPreview}>
        {control.items.map((item) => tile(item, true))}
      </div>
      {control.footer && control.footer.length > 0 && (
        <div className="fo-gal__footer">
          {control.footer.map((f) =>
            f.kind === 'separator' ? <div key={f.id} className="fo-menu__sep" /> : (
              <button
                key={f.id}
                type="button"
                className="fo-gal__footer-item"
                data-cmd-item={f.id}
                disabled={f.disabled}
                onClick={(e) => {
                  if (f.items) {
                    setFooterMenu({ el: e.currentTarget, items: f.items });
                    return;
                  }
                  setOpen(false);
                  f.onClick?.();
                  onCommand();
                }}
              >
                {f.icon && <Icon name={f.icon} size={20} />}
                <span>{f.label}</span>
              </button>
            ),
          )}
        </div>
      )}
      {footerMenu && (
        <Menu
          items={footerMenu.items}
          anchor={footerMenu.el}
          placement="right"
          onClose={() => setFooterMenu(null)}
          onDone={() => { setFooterMenu(null); setOpen(false); onCommand(); }}
        />
      )}
    </Popover>
  );

  if (level >= 2) {
    return (
      <div ref={hostRef} className="fo-gal fo-gal--button" data-cmd={control.id}>
        <Tooltip content={control.tooltip ?? { title: control.label }}>
          <button type="button" className={`fo-rb-btn fo-rb-btn--large fo-hc-invert${open ? ' is-open' : ''}`} disabled={control.disabled} aria-haspopup="listbox" aria-expanded={open} data-keytip={keytip} data-ribbon-focus onClick={() => setOpen((o) => !o)}>
            <Icon name={control.icon ?? 'grid'} size={32} />
            <span className="fo-rb-btn__label">
              {control.label}
              <Icon name="chevron_down" size={12} className="fo-rb-btn__chev" />
            </span>
          </button>
        </Tooltip>
        {grid}
      </div>
    );
  }

  return (
    <div ref={hostRef} className="fo-gal" data-cmd={control.id} role="listbox" aria-label={control.label} data-keytip={keytip} onMouseLeave={endPreview}>
      <div className="fo-gal__strip">{visible.map((item) => tile(item, false))}</div>
      <div className="fo-gal__nav">
        <button type="button" tabIndex={-1} aria-label={S.ribbon.galleryUp} disabled={row === 0} onClick={() => setRow((r) => Math.max(0, r - 1))}>
          <Icon name="chevron_up" size={12} />
        </button>
        <button type="button" tabIndex={-1} aria-label={S.ribbon.galleryDown} disabled={row >= rows - 1} onClick={() => setRow((r) => Math.min(rows - 1, r + 1))}>
          <Icon name="chevron_down" size={12} />
        </button>
        <button type="button" aria-label={`${S.ribbon.galleryMore} : ${control.label}`} aria-expanded={open} data-ribbon-focus onClick={() => setOpen(true)}>
          <Icon name="chevron_double_down" size={12} />
        </button>
      </div>
      {grid}
    </div>
  );
}
