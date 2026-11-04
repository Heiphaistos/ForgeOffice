// Zone de travail : une page ou une planche de deux pages en vis-a-vis, reperes (marges, colonnes, regles, lignes de base),
// regles a zero sur le bord de la page (tirer pour creer un repere), limites des objets, indicateurs de debordement,
// navigation dans les articles, mode liaison des zones de texte, apercu du publipostage.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { deckTheme, resolveColor, type Shape } from '@forgeoffice/pptx';
import { CanvasEditor, EMPTY_SELECTION, type CanvasSelection, type CreateRequest } from '@forgeoffice/powerpoint/canvas';
import { chainOf, isTextFrame } from '../chain.ts';
import { baselines, layoutGuides, snapValue, spreadOf } from '../guides.ts';
import { fillShapes } from '../merge.ts';
import { shapeKey, type BoxRef } from '../model.ts';
import { pageClass, pageCss } from '../pagecss.ts';
import { S } from '../strings.ts';
import { pageProps, type Editor } from './editor.ts';
import { finishLink } from './ops.ts';

const PX = 96 / 72;
const CM = 72 / 2.54;

export interface StageProps {
  ed: Editor;
  /** Zoom effectif (le parent l'affiche dans la barre d'etat). */
  zoom: number;
  onFitZoom: (zoom: number) => void;
  onCreate: (request: CreateRequest) => void;
  onContextMenu: (e: MouseEvent, shapeId: number | null) => void;
  onShapeDoubleClick: (id: number) => boolean;
}

interface PageSlot {
  index: number;
  id: number;
}

/** Regle graduee en centimetres, zero sur le bord de la page active. */
function Ruler({ axis, origin, scale, length, onGuide }: { axis: 'x' | 'y'; origin: number; scale: number; length: number; onGuide: (e: ReactPointerEvent<HTMLDivElement>, axis: 'x' | 'y') => void }) {
  const ticks: Array<{ at: number; major: boolean; label?: string }> = [];
  const step = scale * CM < 30 ? CM : CM / 4;
  const from = Math.floor(-origin / (step * scale)) - 1;
  const to = Math.ceil((length - origin) / (step * scale)) + 1;
  for (let i = from; i <= to; i++) {
    const quarter = Math.round((i * step * 4) / CM);
    const major = quarter % 4 === 0;
    ticks.push({ at: origin + i * step * scale, major, label: major ? String(Math.abs(quarter / 4)) : undefined });
  }
  const horizontal = axis === 'x';
  return (
    <div className={`pub-ruler is-${axis}`} onPointerDown={(e) => onGuide(e, axis)} title={S.canvas.ruler} role="presentation">
      <svg width={horizontal ? length : 18} height={horizontal ? 18 : length} aria-hidden>
        {ticks.map((t, i) => {
          const len = t.major ? 8 : 4;
          return horizontal ? (
            <g key={i}>
              <line x1={t.at} x2={t.at} y1={18 - len} y2={18} />
              {t.label && <text x={t.at + 2} y={9}>{t.label}</text>}
            </g>
          ) : (
            <g key={i}>
              <line y1={t.at} y2={t.at} x1={18 - len} x2={18} />
              {t.label && <text x={2} y={t.at + 9}>{t.label}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Stage({ ed, zoom, onFitZoom, onCreate, onContextMenu, onShapeDoubleClick }: StageProps) {
  const { deck, pub, ui } = ed;
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ width: 900, height: 600 });
  const [pageEls, setPageEls] = useState<Map<number, HTMLElement>>(new Map());
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [dragGuide, setDragGuide] = useState<{ axis: 'x' | 'y'; client: number } | null>(null);
  const s = (zoom / 100) * PX;
  const master = ui.view === 'master';
  const slots: PageSlot[] = master
    ? [{ index: -1, id: -1 }]
    : (ui.twoPage && pub.facing ? spreadOf(ed.pageIndex, deck.slides.length, true) : [ed.pageIndex]).map((i) => ({ index: i, id: deck.slides[i]?.id ?? 0 }));
  const activeId = master ? -1 : (ed.page?.id ?? 0);

  // Taille de la zone de travail -> zoom ajuste.
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = (): void => setArea({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const count = slots.length;
  useEffect(() => {
    if (!ui.fit) return;
    const pad = ui.rulers ? 64 : 40;
    const zx = (area.width - pad * 2) / (deck.size.width * count * PX);
    const zy = (area.height - pad * 2) / (deck.size.height * PX);
    const next = Math.max(10, Math.min(400, Math.floor((ui.fit === 'width' ? zx : Math.min(zx, zy)) * 100)));
    if (next !== zoom) onFitZoom(next);
  }, [ui.fit, area, deck.size.width, deck.size.height, count, ui.rulers, zoom, onFitZoom]);

  // Elements DOM des pages (portails des reperes et indicateurs) et origine des regles.
  const slotKey = slots.map((p) => p.id).join(',');
  useLayoutEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const map = new Map<number, HTMLElement>();
    root.querySelectorAll<HTMLElement>('[data-pub-slot]').forEach((el) => {
      const page = el.querySelector<HTMLElement>('.fo-canvas__page');
      if (page) map.set(Number(el.dataset.pubSlot), page);
    });
    setPageEls((old) => (old.size === map.size && [...map].every(([k, v]) => old.get(k) === v) ? old : map));
  });
  const measureOrigin = useCallback(() => {
    const host = hostRef.current;
    const page = pageEls.get(activeId);
    if (!host || !page) return;
    const h = host.getBoundingClientRect();
    const p = page.getBoundingClientRect();
    setOrigin((o) => (Math.abs(o.x - (p.left - h.left)) < 0.5 && Math.abs(o.y - (p.top - h.top)) < 0.5 ? o : { x: p.left - h.left, y: p.top - h.top }));
  }, [pageEls, activeId]);
  useLayoutEffect(measureOrigin);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', measureOrigin, { passive: true });
    return () => el.removeEventListener('scroll', measureOrigin);
  }, [measureOrigin]);

  // Reperes fixes (marges, colonnes) puis reperes de regle ; seuls ces derniers se deplacent.
  const fixedFor = (index: number): { x: number[]; y: number[] } => {
    if (!ui.guides) return { x: [], y: [] };
    const g = layoutGuides(deck.size, pub, Math.max(0, index));
    return { x: [...g.marginX, ...g.gridX], y: [...g.marginY, ...g.gridY] };
  };

  const accent = `#${resolveColor({ type: 'scheme', value: 'accent1' }, deckTheme(deck), ed.ctx.colorMap).hex}`;
  const css = useMemo(() => {
    const out: string[] = [];
    for (const slot of slots) {
      const slide = deck.slides[slot.index];
      if (slide) out.push(pageCss(slide, pub, /^#[0-9A-F]{6}$/i.test(accent) ? accent : '#077568'));
      const fixed = fixedFor(slot.index);
      const scope = `.${pageClass(slot.id)}`;
      fixed.x.forEach((_, i) => out.push(`${scope} .fo-ov__guide[data-guide="x:${i}"]{pointer-events:none}${scope} .fo-ov__guide[data-guide="x:${i}"]::after{border-color:${i < 2 ? 'var(--pub-margin-guide)' : 'var(--pub-grid-guide)'}}`));
      fixed.y.forEach((_, i) => out.push(`${scope} .fo-ov__guide[data-guide="y:${i}"]{pointer-events:none}${scope} .fo-ov__guide[data-guide="y:${i}"]::after{border-color:${i < 2 ? 'var(--pub-margin-guide)' : 'var(--pub-grid-guide)'}}`));
    }
    return out.join('\n');
  }, [deck, pub, slotKey, ui.guides, accent]);

  const onGuideStart = (e: ReactPointerEvent<HTMLDivElement>, axis: 'x' | 'y'): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setDragGuide({ axis, client: axis === 'x' ? e.clientY : e.clientX });
    const move = (ev: PointerEvent): void => setDragGuide({ axis, client: axis === 'x' ? ev.clientY : ev.clientX });
    const up = (ev: PointerEvent): void => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      setDragGuide(null);
      const page = pageEls.get(activeId);
      if (!page) return;
      const r = page.getBoundingClientRect();
      // Regle horizontale -> repere horizontal (position y), regle verticale -> repere vertical (position x).
      const raw = axis === 'x' ? (ev.clientY - r.top) / s : (ev.clientX - r.left) / s;
      const size = axis === 'x' ? deck.size.height : deck.size.width;
      if (raw < 0 || raw > size) return;
      const fixed = fixedFor(ed.pageIndex);
      const value = Math.round(snapValue(raw, [...(axis === 'x' ? fixed.y : fixed.x), size / 2], 4 / s) * 10) / 10;
      const guides = axis === 'x' ? { ...pub.guides, y: [...pub.guides.y, value] } : { ...pub.guides, x: [...pub.guides.x, value] };
      ed.commitPub({ ...pub, guides }, 'guides');
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  /** Mode liaison : le clic suivant sur une zone de texte termine la liaison. */
  const onPointerDownCapture = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!ui.linking) return;
    const target = e.target as HTMLElement;
    const slot = target.closest<HTMLElement>('[data-pub-slot]');
    const shapeEl = target.closest<HTMLElement>('[data-shape-id]');
    e.preventDefault();
    e.stopPropagation();
    if (!slot || !shapeEl) {
      ed.setUi({ linking: null });
      return;
    }
    finishLink(ed, { page: Number(slot.dataset.pubSlot), shape: Number(shapeEl.dataset.shapeId) });
  };

  const selectedChain = (() => {
    const id = ed.selection.text?.shapeId ?? (ed.selection.ids.length === 1 ? ed.selection.ids[0] : undefined);
    if (id === undefined || master) return null;
    const ref: BoxRef = { page: activeId, shape: id };
    const chain = chainOf(pub, ref);
    if (!chain) return null;
    const at = chain.boxes.findIndex((b) => b.page === ref.page && b.shape === ref.shape);
    return { chain, at };
  })();

  const gotoBox = (box: BoxRef | undefined): void => {
    if (!box) return;
    const index = deck.slides.findIndex((sl) => sl.id === box.page);
    if (index !== ed.pageIndex) ed.goto(index);
    ed.setSelection({ ids: [box.shape] });
  };

  const indicators = (slot: PageSlot) => {
    const el = pageEls.get(slot.id);
    const slide = deck.slides[slot.index];
    if (!el || !slide) return null;
    const items = slide.shapes.filter((sh): sh is Shape & { xfrm: NonNullable<Shape['xfrm']> } => isTextFrame(sh) && !!sh.xfrm && ed.overflow.has(shapeKey(slide.id, sh.id)));
    const lines = ui.baselines ? baselines(deck.size, pub) : [];
    const sel = slot.id === activeId ? selectedChain : null;
    const box = sel ? slide.shapes.find((sh) => sh.id === sel.chain.boxes[sel.at]?.shape)?.xfrm : undefined;
    return createPortal(
      <>
        {lines.length > 0 && (
          <div className="pub-baselines" aria-hidden>
            {lines.map((y, i) => (
              <div key={i} style={{ top: y * s, left: pub.margins.inside * s, right: pub.margins.outside * s }} />
            ))}
          </div>
        )}
        {items.map((sh) => (
          <button
            key={sh.id}
            type="button"
            className="pub-overflow"
            style={{ left: (sh.xfrm.x + sh.xfrm.width) * s - 22, top: (sh.xfrm.y + sh.xfrm.height) * s - 10 }}
            title={S.canvas.overflowHint}
            aria-label={S.canvas.overflowHint}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => ed.setUi({ linking: { page: slide.id, shape: sh.id } })}
          >
            A…
          </button>
        ))}
        {sel && box && sel.at > 0 && (
          <button type="button" className="pub-chainnav is-prev" style={{ left: box.x * s - 24, top: box.y * s - 4 }} title={S.canvas.prevBox} aria-label={S.canvas.prevBox} onPointerDown={(e) => e.stopPropagation()} onClick={() => gotoBox(sel.chain.boxes[sel.at - 1])}>
            ◀
          </button>
        )}
        {sel && box && sel.at < sel.chain.boxes.length - 1 && (
          <button type="button" className="pub-chainnav is-next" style={{ left: (box.x + box.width) * s + 4, top: (box.y + box.height) * s - 20 }} title={S.canvas.nextBox} aria-label={S.canvas.nextBox} onPointerDown={(e) => e.stopPropagation()} onClick={() => gotoBox(sel.chain.boxes[sel.at + 1])}>
            ▶
          </button>
        )}
      </>,
      el,
    );
  };

  const renderSlot = (slot: PageSlot, position: 'single' | 'left' | 'right') => {
    const active = slot.id === activeId;
    const slide = master ? undefined : deck.slides[slot.index];
    const view = master || !slide ? { background: ed.background, ctx: ed.ctx, shapes: ed.pageShapes, underlay: ed.underlay } : active ? { background: ed.background, ctx: ed.ctx, shapes: ed.pageShapes, underlay: ed.underlay } : pageProps(deck, slide, slot.index);
    const record = ui.mergePreview !== null && pub.merge ? pub.merge.records[ui.mergePreview] : undefined;
    const shapes = record && pub.merge ? (() => {
      const copy = structuredClone(view.shapes);
      fillShapes(copy, pub.merge.fields, record);
      return copy;
    })() : view.shapes;
    const fixed = fixedFor(slot.index);
    const guidesX = ui.guides ? [...fixed.x, ...pub.guides.x] : [];
    const guidesY = ui.guides ? [...fixed.y, ...pub.guides.y] : [];
    const select = (sel: CanvasSelection): void => {
      if (!active && slide) {
        ed.goto(slot.index);
        ed.setSelection(sel);
        return;
      }
      ed.setSelection(sel);
    };
    return (
      <div key={slot.id} className={`pub-slot is-${position}${active ? ' is-active' : ''}`} data-pub-slot={slot.id}>
        <CanvasEditor
          width={deck.size.width}
          height={deck.size.height}
          background={view.background}
          ctx={view.ctx}
          shapes={shapes}
          underlay={view.underlay}
          uid={`pub${slot.id}`}
          zoom={zoom}
          onZoomChange={(z) => ed.setUi({ zoom: z, fit: null })}
          selection={active ? ed.selection : EMPTY_SELECTION}
          onSelectionChange={select}
          onEdit={(recipe, group) => ed.editShapes(recipe, group, master ? undefined : { kind: 'page', id: slot.id })}
          tool={active ? ui.tool : { kind: 'select' }}
          onCreate={active ? onCreate : undefined}
          options={{
            smartGuides: ui.snapObjects,
            guidesX,
            guidesY,
            onGuidesChange: (g) => ed.commitPub({ ...pub, guides: { x: g.x.slice(fixed.x.length), y: g.y.slice(fixed.y.length) } }, 'guides'),
          }}
          onContextMenu={(e, id) => {
            if (!active && slide) ed.goto(slot.index);
            onContextMenu(e, id);
          }}
          onShapeDoubleClick={onShapeDoubleClick}
          locked={record !== undefined}
          className={`${pageClass(slot.id)}${ui.boundaries ? ' pub-bounds' : ''}`}
        />
        {indicators(slot)}
      </div>
    );
  };

  const guideLine = dragGuide && hostRef.current
    ? (() => {
        const r = hostRef.current.getBoundingClientRect();
        return dragGuide.axis === 'x' ? <div className="pub-dragguide is-h" style={{ top: dragGuide.client - r.top }} /> : <div className="pub-dragguide is-v" style={{ left: dragGuide.client - r.left }} />;
      })()
    : null;

  return (
    <div ref={hostRef} className={`pub-stage${ui.rulers ? ' has-rulers' : ''}${ui.linking ? ' is-linking' : ''}`} style={{ ['--pub-hair' as string]: `${1 / s}px` }} onPointerDownCapture={onPointerDownCapture}>
      <style>{css}</style>
      {ui.rulers && (
        <>
          <div className="pub-ruler-corner" aria-hidden />
          <Ruler axis="x" origin={origin.x - 18} scale={s} length={Math.max(0, area.width - 18)} onGuide={onGuideStart} />
          <Ruler axis="y" origin={origin.y - 18} scale={s} length={Math.max(0, area.height - 18)} onGuide={onGuideStart} />
        </>
      )}
      <div
        ref={scrollRef}
        className="pub-scroll"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('pub-spread')) ed.setSelection(EMPTY_SELECTION);
        }}
      >
        <div className="pub-spread">
          {slots.map((slot, i) => renderSlot(slot, slots.length === 1 ? 'single' : i === 0 ? 'left' : 'right'))}
        </div>
      </div>
      {guideLine}
      {ui.linking && <div className="pub-linkhint" role="status">{S.status.linking}</div>}
    </div>
  );
}
