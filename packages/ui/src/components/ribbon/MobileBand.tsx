// Ruban mobile : l'onglet actif en une bande horizontale defilante au doigt, TOUS ses groupes et TOUTES ses commandes.
// Calage par groupe, ombres de defilement, curseur de position, etiquette sous chaque groupe, cibles de 44 px.
// Les menus, galeries, couleurs et listes s'ouvrent en feuille du bas (voir mobile.css) ; chaque cellule porte `data-cmd`.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../../icons/Icon.tsx';
import type { RibbonTab } from '../../ribbon-types.ts';
import { activeGroup, bandGroups, launcherId, scrollEdges, snapOffsets, type ScrollEdges } from '../../logic/mobileRibbon.ts';
import { RibbonControlView, type ControlContext } from './RibbonControls.tsx';

const NO_KEYTIPS: ReadonlyMap<string, string> = new Map();

export function MobileBand({ tab, onCommand, wrap = false }: { tab: RibbonTab; onCommand: () => void; wrap?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<ScrollEdges>(() => scrollEdges(0, 1, 1));
  const [current, setCurrent] = useState(0);
  const groups = bandGroups(tab);
  const ctx: ControlContext = { keytips: NO_KEYTIPS, onCommand };

  const sync = useCallback((): void => {
    const el = trackRef.current;
    if (!el) return;
    const next = scrollEdges(el.scrollLeft, el.clientWidth, el.scrollWidth);
    setEdges((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    const box = el.getBoundingClientRect();
    const lefts = [...el.querySelectorAll<HTMLElement>('.fo-band__group')].map((g) => g.getBoundingClientRect().left);
    setCurrent(activeGroup(snapOffsets(lefts, box.left, el.scrollLeft), el.scrollLeft));
  }, []);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab.id, sync]);
  // Les controles peuvent changer de largeur (valeur d'une liste) : recalcule apres chaque rendu de la bande.
  useEffect(sync);

  return (
    <div className={`fo-band${wrap ? ' is-wrap' : ''}${edges.more.start ? ' has-start' : ''}${edges.more.end ? ' has-end' : ''}`} data-band-tab={tab.id}>
      <div ref={trackRef} className="fo-band__track" onScroll={sync}>
        {groups.map((g) => (
          <section key={g.id} className="fo-band__group" role="group" aria-label={g.label} data-group={g.id}>
            <div className="fo-band__controls">
              {g.controls.map((c) => (
                <span key={c.id} className="fo-band__cell" data-cmd={c.id} data-kind={c.kind}>
                  <RibbonControlView control={c} mode={c.kind === 'number' ? 'small' : 'icon'} ctx={ctx} galleryLevel={2} />
                </span>
              ))}
              {g.launcher && (
                <span className="fo-band__cell" data-cmd={launcherId(g.id)} data-kind="launcher">
                  <button type="button" className="fo-band__launcher" aria-label={g.launcher.label} onClick={() => { g.launcher?.onClick(); onCommand(); }}>
                    <Icon name="arrow_down" size={16} style={{ transform: 'rotate(-45deg)' }} />
                  </button>
                </span>
              )}
            </div>
            <div className="fo-band__label">{g.label}</div>
          </section>
        ))}
      </div>
      {!wrap && (
        <div className="fo-band__pos" role="presentation">
          <span className="fo-band__thumb" style={{ left: `${edges.thumb.left * 100}%`, width: `${edges.thumb.width * 100}%` }} />
          {groups.length > 1 && (
            <span className="fo-band__dots" aria-hidden>
              {groups.map((g, i) => (
                <span key={g.id} className={`fo-band__dot${i === current ? ' is-current' : ''}`} />
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
