// Groupe du ruban : colonnes de controles, intitule, lanceur de boite de dialogue, repli en un bouton.
import { useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../icons/Icon.tsx';
import type { GroupLevel, RibbonControl, RibbonGroup } from '../../ribbon-types.ts';
import { S } from '../../strings.ts';
import { Popover } from '../Popover.tsx';
import { Tooltip } from '../Tooltip.tsx';
import { RibbonControlView, isTall, type ControlContext, type ControlMode } from './RibbonControls.tsx';

const MODES: Record<0 | 1 | 2, ControlMode> = { 0: 'large', 1: 'small', 2: 'icon' };

/** Regroupe les petits controles consecutifs en colonnes de 3 lignes au plus. */
function columns(controls: readonly RibbonControl[], mode: ControlMode): RibbonControl[][] {
  const out: RibbonControl[][] = [];
  let column: RibbonControl[] = [];
  const flush = (): void => {
    if (column.length > 0) out.push(column);
    column = [];
  };
  for (const c of controls) {
    if (c.hidden) continue;
    if (isTall(c, mode)) {
      flush();
      out.push([c]);
    } else {
      column.push(c);
      if (column.length === 3) flush();
    }
  }
  flush();
  return out;
}

export interface RibbonGroupViewProps {
  group: RibbonGroup;
  level: GroupLevel;
  ctx: ControlContext;
  /** Ruban simplifie : une seule ligne, icones seules. */
  simplified?: boolean;
}

export function RibbonGroupView({ group, level, ctx, simplified = false }: RibbonGroupViewProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  if (group.hidden) return null;

  if (simplified) {
    return (
      <div className="fo-rb-group fo-rb-group--simple" role="group" aria-label={group.label}>
        {group.controls.map((c) => (
          <RibbonControlView key={c.id} control={c} mode="icon" ctx={ctx} galleryLevel={2} />
        ))}
      </div>
    );
  }

  if (level === 3) {
    return (
      <div className="fo-rb-group fo-rb-group--collapsed" role="group" aria-label={group.label}>
        <Tooltip content={{ title: group.label }}>
          <button
            ref={buttonRef}
            type="button"
            className={`fo-rb-btn fo-rb-btn--large fo-hc-invert${open ? ' is-open' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={open}
            data-keytip={ctx.keytips.get(`group:${group.id}`)}
            data-ribbon-focus
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={group.icon ?? 'more_horizontal'} size={32} />
            <span className="fo-rb-btn__label">
              {group.label}
              <Icon name="chevron_down" size={12} className="fo-rb-btn__chev" />
            </span>
          </button>
        </Tooltip>
        {open && buttonRef.current && (
          <Popover anchor={buttonRef.current} onClose={() => setOpen(false)} label={group.label} className="fo-rb-popup-group">
            <RibbonGroupView group={group} level={0} ctx={{ ...ctx, onCommand: () => { setOpen(false); ctx.onCommand(); } }} />
          </Popover>
        )}
      </div>
    );
  }

  const mode = MODES[level];
  return (
    <div className="fo-rb-group" role="group" aria-label={group.label}>
      <div className="fo-rb-group__body">
        {columns(group.controls, mode).map((col, i): ReactNode =>
          col.length === 1 && col[0] && isTall(col[0], mode) ? (
            <div key={col[0].id} className="fo-rb-col fo-rb-col--tall">
              <RibbonControlView control={col[0]} mode={mode} ctx={ctx} galleryLevel={level} />
            </div>
          ) : (
            <div key={`c${i}`} className={`fo-rb-col fo-rb-col--rows-${col.length}`}>
              {col.map((c) => (
                <div key={c.id} className="fo-rb-cell">
                  <RibbonControlView control={c} mode={mode === 'large' ? 'small' : mode} ctx={ctx} galleryLevel={level} />
                </div>
              ))}
            </div>
          ),
        )}
      </div>
      <div className="fo-rb-group__label">
        <span>{group.label}</span>
        {group.launcher && (
          <Tooltip content={{ title: group.launcher.label, description: S.ribbon.launcher }}>
            <button
              type="button"
              className="fo-rb-launcher"
              data-cmd={`${group.id}:launcher`}
              aria-label={group.launcher.label}
              data-keytip={ctx.keytips.get(`launcher:${group.id}`)}
              data-ribbon-focus
              onClick={() => {
                group.launcher?.onClick();
                ctx.onCommand();
              }}
            >
              <Icon name="arrow_down" size={12} style={{ transform: 'rotate(-45deg)' }} />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
