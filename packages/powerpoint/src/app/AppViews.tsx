// Vues secondaires : volet de notes, mode Plan, mode Page de commentaires, apercu de transition / d'animation.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { notesText, setNotes, slideTitle, slideText, type Slide } from '@forgeoffice/pptx';
import { PageView } from '../canvas/PageView.tsx';
import { editSlide } from './deck-ops.ts';
import type { Editor } from './editor.ts';
import { NotesPage } from './NotesPage.tsx';
import { animTargets, buildSteps, effectFrames, initiallyHidden, transitionFrames } from './playback.ts';
import { slidePageProps } from './slide-render.ts';
import { S } from '../strings.ts';

/** Volet des notes du presentateur (sous la diapositive). */
export function NotesPane({ ed, height, onResize }: { ed: Editor; height: number; onResize: (h: number) => void }) {
  const slide = ed.slide;
  const [value, setValue] = useState(() => (slide ? notesText(slide) : ''));
  const [slideId, setSlideId] = useState(slide?.id);
  if (slide && slide.id !== slideId) {
    setSlideId(slide.id);
    setValue(notesText(slide));
  }
  const save = (text: string): void => {
    setValue(text);
    if (slide) ed.commit(editSlide(ed.deck, slide.id, (s) => setNotes(s, text)), `notes:${slide.id}`);
  };
  return (
    <div className="pp-notes" style={{ height }}>
      <div
        className="pp-notes__grip"
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={(e) => {
          const startY = e.clientY;
          const start = height;
          const move = (ev: PointerEvent): void => onResize(Math.max(40, Math.min(480, start - (ev.clientY - startY))));
          const up = (): void => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        }}
      />
      <textarea className="pp-notes__text" value={value} placeholder={S.notes.placeholder} onChange={(e) => save(e.target.value)} aria-label={S.notes.label} spellCheck lang="fr" />
    </div>
  );
}

/** Mode Plan : titres et textes de toutes les diapositives. */
export function OutlineView({ ed }: { ed: Editor }) {
  return (
    <div className="pp-outline">
      {ed.deck.slides.map((slide, i) => {
        const title = slideTitle(slide);
        const body = slideText(slide).split('\n').filter((line) => line && line !== title);
        return (
          <div key={slide.id} className={`pp-outline__slide${ed.slide?.id === slide.id ? ' is-current' : ''}`} onClick={() => ed.goto(slide.id)} onDoubleClick={() => ed.setUi({ view: 'normal' })}>
            <span className="pp-outline__num">{i + 1}</span>
            <span className="pp-outline__icon" />
            <div>
              <div className="pp-outline__title">{title || S.outline.untitled}</div>
              {body.map((line, k) => (
                <div key={k} className="pp-outline__line">{line}</div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Mode Page de commentaires : la page imprimee et les notes modifiables. */
export function NotesPageView({ ed }: { ed: Editor }) {
  const slide = ed.slide;
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const update = (): void => setScale(Math.min((el.clientWidth - 48) / ed.deck.notesSize.width, (el.clientHeight - 48) / ed.deck.notesSize.height));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ed.deck.notesSize]);
  if (!slide) return null;
  return (
    <div className="pp-notespage" ref={host}>
      <div className="pp-notespage__paper" style={{ width: ed.deck.notesSize.width * scale, height: ed.deck.notesSize.height * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}>
          <NotesPage deck={ed.deck} slide={slide} index={ed.slideIndex} />
        </div>
      </div>
      <div className="pp-notespage__edit">
        <NotesPane ed={ed} height={220} onResize={() => undefined} />
      </div>
    </div>
  );
}

/** Apercu d'une transition ou des animations de la diapositive, joue par-dessus la zone d'edition. */
export function PreviewOverlay({ ed, kind, onDone, width, height, scale }: { ed: Editor; kind: 'transition' | 'animations'; onDone: () => void; width: number; height: number; scale: number }) {
  const slide = ed.slide as Slide;
  const prev = ed.deck.slides[ed.slideIndex - 1];
  const inRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timers: number[] = [];
    const layer = inRef.current;
    if (!layer) return;
    let total = 0;
    if (kind === 'transition') {
      const f = transitionFrames(slide.transition ?? { type: 'fade', duration: 700 });
      const opts: KeyframeAnimationOptions = { duration: Math.max(1, f.duration), easing: 'ease-in-out', fill: 'both' };
      layer.animate(f.incoming, opts);
      outRef.current?.animate(f.outgoing, opts);
      total = f.duration;
    } else {
      const hidden = initiallyHidden(slide);
      const el = (id: number): HTMLElement | null => {
        const all = layer.querySelectorAll<HTMLElement>(`[data-shape-id="${id}"]`);
        return (all[all.length - 1] as HTMLElement | undefined) ?? null;
      };
      for (const id of hidden) {
        const e = el(id);
        if (e) e.style.visibility = 'hidden';
      }
      for (const a of slide.animations) if (a.paragraphs && a.class === 'entr') for (const p of animTargets(el(a.shapeId), a)) p.style.visibility = 'hidden';
      let offset = 300;
      for (const step of buildSteps(slide.animations)) {
        for (const effect of step.effects) {
          const a = effect.animation;
          timers.push(window.setTimeout(() => {
            const f = effectFrames(a, ed.deck.size);
            for (const e of animTargets(el(a.shapeId), a)) {
              if (a.class === 'entr') e.style.visibility = 'visible';
              const anim = e.animate(f.keyframes, { duration: Math.max(1, effect.duration), easing: f.easing });
              anim.onfinish = () => {
                if (a.class === 'exit') e.style.visibility = 'hidden';
              };
            }
          }, offset + effect.start));
        }
        offset += step.total + 250;
      }
      total = offset;
    }
    timers.push(window.setTimeout(onDone, total + 400));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [kind, slide, onDone, ed.deck.size]);
  return (
    <div className="pp-preview" style={{ width: width * scale, height: height * scale }} onClick={onDone}>
      {kind === 'transition' && (
        <div ref={outRef} className="pp-preview__layer">
          {prev ? <PageView {...slidePageProps(ed.deck, prev, ed.slideIndex - 1, 'pvo')} scale={scale} /> : <div style={{ width: width * scale, height: height * scale, background: '#000' }} />}
        </div>
      )}
      <div ref={inRef} className="pp-preview__layer">
        <PageView {...slidePageProps(ed.deck, slide, ed.slideIndex, 'pvi')} scale={scale} />
      </div>
    </div>
  );
}
