// Diaporama plein ecran, mode Lecture et mode Presentateur : transitions (dont Morphose), animations au clic,
// declencheurs, liens, clavier PowerPoint (fleches, numero + Entree, B / W, Echap), stylet, surligneur, pointeur laser.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from '@forgeoffice/ui';
import { notesText, type Deck, type Slide, type Transform } from '@forgeoffice/pptx';
import { PageView } from '../canvas/PageView.tsx';
import { mediaUrl } from '../canvas/context.ts';
import { buildSteps, effectFrames, initiallyHidden, showOrder, transitionFrames, triggerSteps, visibleAfter, type Step } from './playback.ts';
import { slidePageProps } from './slide-render.ts';
import { S } from '../strings.ts';
import './SlideShow.css';
import { useShowTouch } from './useShowTouch.ts';

export interface SlideShowProps {
  deck: Deck;
  /** Indice de la diapositive de depart (dans la presentation). */
  start: number;
  presenter: boolean;
  /** Mode Lecture : dans la fenetre, barre de navigation. */
  windowed?: boolean;
  onExit: (lastIndex: number) => void;
  /** Ouvre un lien externe (verifie par l'appelant). */
  onOpenUrl: (url: string) => void;
}

type Tool = 'arrow' | 'pen' | 'highlighter' | 'laser' | 'eraser';
interface Stroke {
  tool: 'pen' | 'highlighter';
  points: Array<{ x: number; y: number }>;
}

/** Diapositive dans une boite ajustee (proportions conservees). */
function useFit(ref: React.RefObject<HTMLElement | null>, w: number, h: number): number {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (): void => setScale(Math.max(0.05, Math.min(el.clientWidth / w, el.clientHeight / h)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, w, h]);
  return scale;
}

const shapeEl = (layer: HTMLElement | null, id: number): HTMLElement | null => {
  const all = layer?.querySelectorAll<HTMLElement>(`[data-shape-id="${id}"]`);
  return all && all.length ? (all[all.length - 1] as HTMLElement) : null;
};

const formatClock = (ms: number): string => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export function SlideShow({ deck, start, presenter, windowed = false, onExit, onOpenUrl }: SlideShowProps) {
  const order = useMemo(() => {
    const visible = showOrder(deck.slides);
    return visible.length ? visible : deck.slides.map((_, i) => i);
  }, [deck.slides]);
  const [pos, setPos] = useState(() => Math.max(0, order.findIndex((i) => i >= start)));
  const [ended, setEnded] = useState(false);
  const [blank, setBlank] = useState<'black' | 'white' | null>(null);
  const [tool, setTool] = useState<Tool>('arrow');
  const [ink, setInk] = useState<Map<number, Stroke[]>>(new Map());
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  const [outgoing, setOutgoing] = useState<{ index: number; key: number } | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState<number | null>(null);
  const [notesSize, setNotesSize] = useState(18);
  const [overview, setOverview] = useState(false);
  const typed = useRef('');
  const step = useRef(0);
  const direction = useRef<'forward' | 'back' | 'jump'>('jump');
  const running = useRef<Animation[]>([]);
  const timers = useRef<number[]>([]);
  const layerRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<Stroke | null>(null);
  const transitionKey = useRef(0);
  const index = order[pos] ?? 0;
  const slide = deck.slides[index];
  const steps = useMemo<Step[]>(() => (slide ? buildSteps(slide.animations) : []), [slide]);
  const triggers = useMemo(() => (slide ? triggerSteps(slide.animations) : new Map<number, Step>()), [slide]);
  const scale = useFit(stageRef, deck.size.width, deck.size.height);

  useEffect(() => {
    if (windowed) return;
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) root.requestFullscreen().catch(() => undefined);
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [windowed]);

  useEffect(() => {
    if (!presenter) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [presenter]);

  const clearTimers = (): void => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };

  /** Termine instantanement les animations en cours (clic rapide). */
  const finishRunning = (): void => {
    clearTimers();
    for (const a of running.current) {
      try {
        a.finish();
      } catch (err) {
        if (!(err instanceof DOMException)) throw err;
      }
    }
    running.current = [];
  };

  /** Etat visible apres `count` etapes, sans animation. */
  const applyInstant = useCallback(
    (count: number) => {
      const layer = layerRef.current;
      if (!layer || !slide) return;
      const hidden = initiallyHidden(slide);
      for (const a of slide.animations) {
        const el = shapeEl(layer, a.shapeId);
        el?.getAnimations().forEach((x) => x.cancel());
        if (el) el.style.visibility = hidden.has(a.shapeId) ? 'hidden' : 'visible';
      }
      for (const s of steps.slice(0, count)) {
        for (const e of s.effects) {
          const v = visibleAfter(e.animation);
          const el = shapeEl(layer, e.animation.shapeId);
          if (el && v !== null) el.style.visibility = v ? 'visible' : 'hidden';
        }
      }
    },
    [slide, steps],
  );

  const playStep = useCallback(
    (s: Step) => {
      const layer = layerRef.current;
      if (!layer) return;
      for (const e of s.effects) {
        const a = e.animation;
        timers.current.push(
          window.setTimeout(() => {
            const el = shapeEl(layer, a.shapeId);
            if (!el) return;
            const frames = effectFrames(a, deck.size);
            if (a.class === 'entr') el.style.visibility = 'visible';
            const anim = el.animate(frames.keyframes, {
              duration: Math.max(1, e.duration),
              easing: frames.easing,
              fill: a.class === 'emph' && a.presetId !== 26 ? 'forwards' : 'none',
              iterations: a.repeat === 'indefinite' ? Infinity : (a.repeat ?? 1),
              direction: a.autoReverse ? 'alternate' : 'normal',
            });
            running.current.push(anim);
            anim.onfinish = () => {
              if (a.class === 'exit') el.style.visibility = 'hidden';
            };
          }, e.start),
        );
      }
    },
    [deck.size],
  );

  // Arrivee sur une diapositive : etat initial, transition, etape automatique.
  useLayoutEffect(() => {
    if (!slide) return;
    finishRunning();
    const dir = direction.current;
    if (dir === 'back') {
      step.current = steps.length;
      applyInstant(steps.length);
      return;
    }
    step.current = 0;
    applyInstant(0);
    const frames = dir === 'forward' ? transitionFrames(slide.transition) : { incoming: [], outgoing: [], duration: 0 };
    const layer = layerRef.current;
    if (frames.duration > 0 && layer) {
      const opts: KeyframeAnimationOptions = { duration: frames.duration, easing: 'ease-in-out', fill: 'both' };
      running.current.push(layer.animate(frames.incoming, opts));
      if (outRef.current) running.current.push(outRef.current.animate(frames.outgoing, opts));
      if (slide.transition?.type === 'morph') morph(layer, outRef.current, frames.duration);
      if (slide.transition?.sound) {
        const url = mediaUrl(deck.media[slide.transition.sound.mediaId]);
        if (url) void new Audio(url).play().catch(() => undefined);
      }
    }
    const done = window.setTimeout(() => setOutgoing(null), frames.duration);
    timers.current.push(done);
    const first = steps[0];
    if (first?.auto) {
      step.current = 1;
      timers.current.push(window.setTimeout(() => playStep(first), frames.duration));
    }
    const after = slide.transition?.advanceAfter;
    if (after !== undefined) timers.current.push(window.setTimeout(() => advanceRef.current(), frames.duration + after + (steps.reduce((n, s) => n + (s.auto ? s.total : 0), 0))));
  }, [slide, pos]);

  /** Morphose : les formes de meme nom glissent de leur ancienne position a la nouvelle. */
  const morph = (layer: HTMLElement, out: HTMLElement | null, duration: number): void => {
    const prevIndex = outgoing?.index;
    const prev = prevIndex === undefined ? undefined : deck.slides[prevIndex];
    if (!prev || !slide || !out) return;
    const boxOf = (x: Transform | undefined): Transform | undefined => x;
    const props = slidePageProps(deck, prev, prevIndex ?? 0, 'm');
    const nextProps = slidePageProps(deck, slide, index, 'n');
    for (const shape of slide.shapes) {
      const match = prev.shapes.find((p) => p.name === shape.name && p.kind === shape.kind);
      if (!match) continue;
      const a = boxOf(props.ctx.resolve(match).xfrm);
      const b = boxOf(nextProps.ctx.resolve(shape).xfrm);
      const el = shapeEl(layer, shape.id);
      if (!a || !b || !el || !b.width || !b.height) continue;
      const dx = a.x + a.width / 2 - (b.x + b.width / 2);
      const dy = a.y + a.height / 2 - (b.y + b.height / 2);
      const from = `translate(${dx}px, ${dy}px) rotate(${a.rotation ?? 0}deg) scale(${a.width / b.width}, ${a.height / b.height})`;
      running.current.push(el.animate([{ transform: from }, { transform: `translate(0, 0) rotate(${b.rotation ?? 0}deg) scale(1, 1)` }], { duration, easing: 'ease-in-out' }));
      const old = shapeEl(out, match.id);
      if (old) running.current.push(old.animate([{ opacity: 0 }, { opacity: 0 }], { duration }));
    }
  };

  const goToPos = useCallback(
    (next: number, dir: 'forward' | 'back' | 'jump') => {
      finishRunning();
      if (next >= order.length) {
        setEnded(true);
        return;
      }
      if (next < 0) return;
      setEnded(false);
      direction.current = dir;
      if (dir === 'forward' && next !== pos) {
        transitionKey.current++;
        setOutgoing({ index, key: transitionKey.current });
      } else setOutgoing(null);
      setPos(next);
    },
    [order.length, pos, index],
  );

  const advance = useCallback(() => {
    if (blank) {
      setBlank(null);
      return;
    }
    if (ended) {
      onExit(index);
      return;
    }
    const pending = running.current.some((a) => a.playState === 'running');
    if (pending) {
      finishRunning();
      return;
    }
    const s = steps[step.current];
    if (s) {
      step.current++;
      playStep(s);
      return;
    }
    goToPos(pos + 1, 'forward');
  }, [blank, ended, steps, playStep, goToPos, pos, onExit, index]);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  const back = useCallback(() => {
    if (blank) {
      setBlank(null);
      return;
    }
    if (ended) {
      setEnded(false);
      return;
    }
    finishRunning();
    const min = steps[0]?.auto ? 1 : 0;
    if (step.current > min) {
      step.current--;
      applyInstant(step.current);
      return;
    }
    goToPos(pos - 1, 'back');
  }, [blank, ended, steps, applyInstant, goToPos, pos]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const k = e.key;
      if (/^\d$/.test(k)) {
        typed.current += k;
        return;
      }
      if (k === 'Enter' && typed.current) {
        const n = Number(typed.current) - 1;
        typed.current = '';
        const target = order.indexOf(n);
        goToPos(target >= 0 ? target : Math.min(order.length - 1, Math.max(0, n)), 'jump');
        return;
      }
      typed.current = '';
      if (e.ctrlKey && (k === 'p' || k === 'P')) {
        e.preventDefault();
        setTool('pen');
      } else if (e.ctrlKey && (k === 'l' || k === 'L')) {
        e.preventDefault();
        setTool('laser');
      } else if (e.ctrlKey && (k === 'i' || k === 'I')) {
        e.preventDefault();
        setTool('highlighter');
      } else if (e.ctrlKey && (k === 'a' || k === 'A')) {
        e.preventDefault();
        setTool('arrow');
      } else if (k === 'e' || k === 'E') setInk((m) => new Map(m).set(index, []));
      else if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'Enter' || k === 'PageDown' || k === 'n' || k === 'N') {
        e.preventDefault();
        advance();
      } else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'Backspace' || k === 'PageUp' || k === 'p' || k === 'P') {
        e.preventDefault();
        back();
      } else if (k === 'Home') goToPos(0, 'jump');
      else if (k === 'End') goToPos(order.length - 1, 'jump');
      else if (k === 'b' || k === 'B' || k === '.') setBlank((b) => (b === 'black' ? null : 'black'));
      else if (k === 'w' || k === 'W' || k === ',') setBlank((b) => (b === 'white' ? null : 'white'));
      else if (k === 'g' || k === 'G' || k === '-') setOverview((o) => !o);
      else if (k === 'Escape') {
        e.preventDefault();
        if (overview) setOverview(false);
        else if (tool !== 'arrow') setTool('arrow');
        else if (blank) setBlank(null);
        else onExit(index);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, back, goToPos, order, index, blank, tool, overview, onExit]);

  useEffect(() => () => clearTimers(), []);

  const gesture = useShowTouch();
  const toPage = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const r = layerRef.current?.getBoundingClientRect();
    return r ? { x: ((e.clientX - r.left) / r.width) * deck.size.width, y: ((e.clientY - r.top) / r.height) * deck.size.height } : { x: 0, y: 0 };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    if (tool === 'pen' || tool === 'highlighter') {
      drawing.current = { tool, points: [toPage(e)] };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (tool === 'eraser') {
      setInk((m) => new Map(m).set(index, []));
      return;
    }
    if (tool === 'laser') return;
    if (e.pointerType === 'touch') {
      gesture.down(e);
      return;
    }
    press(e.target as Element);
  };

  /** Clic sur la diapositive : forme interactive (declencheur, lien, action) ou diapositive suivante. */
  const press = (el: Element): void => {
    const target = el.closest('[data-shape-id]');
    if (el.closest('video, audio')) return;
    const id = Number(target?.getAttribute('data-shape-id'));
    const shape = slide?.shapes.find((s) => s.id === id);
    const trigger = triggers.get(id);
    if (trigger) {
      playStep(trigger);
      return;
    }
    const click = shape?.click;
    if (click?.url) {
      onOpenUrl(click.url);
      return;
    }
    if (click?.slideId !== undefined) {
      const target2 = order.indexOf(deck.slides.findIndex((s) => s.id === click.slideId));
      if (target2 >= 0) goToPos(target2, 'jump');
      return;
    }
    if (click?.action?.includes('nextslide')) return goToPos(pos + 1, 'forward');
    if (click?.action?.includes('previousslide')) return goToPos(pos - 1, 'back');
    if (click?.action?.includes('firstslide')) return goToPos(0, 'jump');
    if (click?.action?.includes('lastslide')) return goToPos(order.length - 1, 'jump');
    if (click?.action?.includes('endshow')) return onExit(index);
    if (slide?.transition?.advanceOnClick === false) return;
    advance();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'touch') gesture.move(e);
    if (tool === 'laser') setLaser(toPage(e));
    const d = drawing.current;
    if (d) {
      d.points.push(toPage(e));
      setInk((m) => new Map(m).set(index, [...(m.get(index) ?? []).filter((s) => s !== d), d]));
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    drawing.current = null;
    if (e.pointerType !== 'touch') return;
    const g = gesture.up(e);
    if (g === 'next') advance();
    else if (g === 'prev') back();
    else if (g === 'exit') onExit(index);
    else if (g === 'tap' && gesture.target) press(gesture.target);
  };

  const strokes = ink.get(index) ?? [];
  const stageStyle: CSSProperties = { width: deck.size.width * scale, height: deck.size.height * scale };
  const pageProps = slide ? slidePageProps(deck, slide, index, `s${slide.id}`) : null;
  const outSlide = outgoing ? deck.slides[outgoing.index] : undefined;
  const persp = slide?.transition && transitionFrames(slide.transition).perspective;

  const stage = (
    <div ref={stageRef} className="pp-show__fit">
      <div
        className={`pp-show__stage${tool === 'laser' || tool === 'pen' || tool === 'highlighter' ? ' is-tool' : ''}`}
        style={{ ...stageStyle, perspective: persp ? 1600 : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => gesture.cancel()}
        onPointerLeave={() => setLaser(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          back();
        }}
      >
        {outSlide && (
          <div ref={outRef} className="pp-show__layer" key={`o${outgoing?.key}`}>
            <PageView {...slidePageProps(deck, outSlide, outgoing?.index ?? 0, `o${outSlide.id}`)} scale={scale} interactive />
          </div>
        )}
        {pageProps && (
          <div ref={layerRef} className="pp-show__layer" key={`i${index}`}>
            <PageView {...pageProps} scale={scale} interactive />
          </div>
        )}
        <svg className="pp-show__ink" viewBox={`0 0 ${deck.size.width} ${deck.size.height}`} preserveAspectRatio="none">
          {strokes.map((s, i) => (
            <polyline
              key={i}
              points={s.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={s.tool === 'pen' ? '#E81123' : '#FFEB3B'}
              strokeOpacity={s.tool === 'pen' ? 1 : 0.45}
              strokeWidth={s.tool === 'pen' ? 2.5 : 14}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {laser && <circle cx={laser.x} cy={laser.y} r={5} fill="#FF2020" stroke="#FFB0B0" strokeWidth={2} className="pp-show__laser" />}
        </svg>
        {blank && <div className={`pp-show__blank is-${blank}`} />}
        {ended && <div className="pp-show__end">{S.show.end}</div>}
      </div>
    </div>
  );

  const counter = S.show.counter(pos + 1, order.length);
  const toolbar = (
    <div className="pp-show__tools" onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" title={S.show.previous} onClick={back}>
        <Icon name="chevron_left" size={20} />
      </button>
      <button type="button" title={S.show.next} onClick={advance}>
        <Icon name="chevron_right" size={20} />
      </button>
      <button type="button" className={tool === 'pen' ? 'is-on' : ''} title={S.show.pen} onClick={() => setTool(tool === 'pen' ? 'arrow' : 'pen')}>
        <Icon name="pen" size={20} />
      </button>
      <button type="button" className={tool === 'highlighter' ? 'is-on' : ''} title={S.show.highlighter} onClick={() => setTool(tool === 'highlighter' ? 'arrow' : 'highlighter')}>
        <Icon name="highlight" size={20} />
      </button>
      <button type="button" className={tool === 'laser' ? 'is-on' : ''} title={S.show.laser} onClick={() => setTool(tool === 'laser' ? 'arrow' : 'laser')}>
        <Icon name="circle" size={20} filled />
      </button>
      <button type="button" title={S.show.erase} onClick={() => setInk((m) => new Map(m).set(index, []))}>
        <Icon name="eraser" size={20} />
      </button>
      <button type="button" title={S.show.overview} onClick={() => setOverview((o) => !o)}>
        <Icon name="grid" size={20} />
      </button>
      <button type="button" title={S.show.black} onClick={() => setBlank((b) => (b ? null : 'black'))}>
        <Icon name="eye_off" size={20} />
      </button>
      <button type="button" title={S.show.exit} onClick={() => onExit(index)}>
        <Icon name="dismiss" size={20} />
      </button>
    </div>
  );

  const overviewGrid = overview && (
    <div className="pp-show__overview" onPointerDown={(e) => e.stopPropagation()}>
      {order.map((i, k) => {
        const s = deck.slides[i] as Slide;
        const w = 220;
        return (
          <button
            key={s.id}
            type="button"
            className={k === pos ? 'is-current' : ''}
            onClick={() => {
              setOverview(false);
              goToPos(k, 'jump');
            }}
          >
            <div style={{ width: w, height: (deck.size.height * w) / deck.size.width, overflow: 'hidden' }}>
              <PageView {...slidePageProps(deck, s, i, `g${s.id}`)} scale={w / deck.size.width} />
            </div>
            <span>{i + 1}</span>
          </button>
        );
      })}
    </div>
  );

  if (!presenter) {
    return (
      <div className={`pp-show${windowed ? ' is-windowed' : ''}${tool === 'laser' ? ' is-laser' : ''}`} role="presentation">
        {stage}
        {windowed ? (
          <div className="pp-show__bar">
            <span>{counter}</span>
            <span className="pp-show__spacer" />
            <button type="button" onClick={back} title={S.show.previous}>
              <Icon name="chevron_left" size={16} />
            </button>
            <button type="button" onClick={advance} title={S.show.next}>
              <Icon name="chevron_right" size={16} />
            </button>
            <button type="button" onClick={() => onExit(index)} title={S.show.exitReading}>
              <Icon name="dismiss" size={16} />
            </button>
          </div>
        ) : (
          toolbar
        )}
        {overviewGrid}
      </div>
    );
  }

  const nextSlide = order[pos + 1] !== undefined ? deck.slides[order[pos + 1] as number] : undefined;
  const nextIndex = order[pos + 1] ?? 0;
  const elapsed = (paused ?? now) - startedAt;
  return (
    <div className="pp-presenter" role="presentation">
      <div className="pp-presenter__top">
        <span className="pp-presenter__timer">{formatClock(elapsed)}</span>
        <button type="button" title={paused ? S.show.resume : S.show.pause} onClick={() => {
          if (paused) {
            setStartedAt((t) => t + (Date.now() - paused));
            setPaused(null);
          } else setPaused(Date.now());
        }}>
          <Icon name={paused ? 'play' : 'pause'} size={16} />
        </button>
        <button type="button" title={S.show.resetTimer} onClick={() => {
          setStartedAt(Date.now());
          setPaused(null);
        }}>
          <Icon name="arrow_counterclockwise" size={16} />
        </button>
        <span className="pp-show__spacer" />
        <span>{new Date(now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
        <button type="button" className="pp-presenter__end" onClick={() => onExit(index)}>
          {S.show.endShow}
        </button>
      </div>
      <div className="pp-presenter__main">
        <div className="pp-presenter__current">
          {stage}
          {toolbar}
          <div className="pp-presenter__count">{counter}</div>
        </div>
        <div className="pp-presenter__side">
          <div className="pp-presenter__label">{S.show.nextSlide}</div>
          <div className="pp-presenter__next" style={{ aspectRatio: `${deck.size.width} / ${deck.size.height}` }}>
            {nextSlide ? (
              <PageView {...slidePageProps(deck, nextSlide, nextIndex, `n${nextSlide.id}`)} scale={360 / deck.size.width} />
            ) : (
              <div className="pp-presenter__none">{S.show.endOfShow}</div>
            )}
          </div>
          <div className="pp-presenter__label">
            {S.show.notes}
            <span className="pp-show__spacer" />
            <button type="button" title={S.show.smaller} onClick={() => setNotesSize((n) => Math.max(10, n - 2))}>
              A−
            </button>
            <button type="button" title={S.show.bigger} onClick={() => setNotesSize((n) => Math.min(48, n + 2))}>
              A+
            </button>
          </div>
          <div className="pp-presenter__notes" style={{ fontSize: notesSize }}>
            {slide ? notesText(slide) || S.show.noNotes : ''}
          </div>
        </div>
      </div>
      {overviewGrid}
    </div>
  );
}
