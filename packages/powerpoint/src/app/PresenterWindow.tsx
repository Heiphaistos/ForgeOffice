// Fenetre « Ecran du presentateur » : suit le diaporama d'une autre fenetre (BroadcastChannel) et le pilote.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@forgeoffice/ui';
import { notesText, type Deck } from '@forgeoffice/pptx';
import { PageView } from '../canvas/PageView.tsx';
import { S } from '../strings.ts';
import { S2 } from '../strings2.ts';
import { hiddenAtStep } from './playback.ts';
import { readDeck } from './fileops.ts';
import { formatClock } from './RehearseBar.tsx';
import { ShowFollower, type ShowSnapshot } from './show-sync.ts';
import { slidePageProps } from './slide-render.ts';
import './SlideShow.css';

export interface PresenterWindowProps {
  onClose: () => void;
}

export function PresenterWindow({ onClose }: PresenterWindowProps) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [snap, setSnap] = useState<ShowSnapshot | null>(null);
  const [ended, setEnded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [notesSize, setNotesSize] = useState(18);
  const follower = useRef<ShowFollower | null>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const [sideWidth, setSideWidth] = useState(360);
  const [room, setRoom] = useState({ width: 760, height: 430 });

  useEffect(() => {
    const f: ShowFollower = new ShowFollower({
      onDeck: (bytes) =>
        void readDeck(bytes).then(
          (d) => {
            setDeck(d);
            setEnded(false);
          },
          () => undefined,
        ),
      onState: (s) => setSnap(s),
      onBye: () => {
        setEnded(true);
        setDeck(null);
        setSnap(null);
        f.hello();
      },
    });
    follower.current = f;
    f.hello();
    return () => f.close();
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  const send = (cmd: Parameters<ShowFollower['send']>[0], pos?: number): void => follower.current?.send(cmd, pos);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (['ArrowRight', 'ArrowDown', ' ', 'Enter', 'PageDown', 'n', 'N'].includes(e.key)) send('next');
      else if (['ArrowLeft', 'ArrowUp', 'Backspace', 'PageUp', 'p', 'P'].includes(e.key)) send('prev');
      else if (e.key === 'b' || e.key === 'B' || e.key === '.') send('blank');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const connected = !!deck && !!snap;
  // La diapositive courante occupe toute la place disponible (fenetre redimensionnable).
  useLayoutEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const update = (): void => {
      setRoom({ width: el.clientWidth, height: el.clientHeight });
      if (sideRef.current) setSideWidth(Math.min(360, sideRef.current.clientWidth));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (sideRef.current) ro.observe(sideRef.current);
    return () => ro.disconnect();
  }, [connected]);

  const slide = deck && snap ? deck.slides[snap.index] : undefined;
  const nextIndex = snap ? snap.order[snap.pos + 1] : undefined;
  const nextSlide = deck && nextIndex !== undefined ? deck.slides[nextIndex] : undefined;
  const hidden = useMemo(() => (slide && snap ? hiddenAtStep(slide, snap.step) : undefined), [slide, snap]);

  if (!deck || !snap || !slide) {
    return (
      <div className="pp-presenter" role="status" data-testid="presenter-window">
        <div className="pp-presenter__wait">
          <Icon name="presenter" size={48} />
          <p>{ended ? S2.presenterWindow.ended : S2.presenterWindow.waiting}</p>
          <button type="button" className="pp-presenter__end" onClick={onClose}>
            {S2.presenterWindow.close}
          </button>
        </div>
      </div>
    );
  }
  const elapsed = (snap.paused ?? now) - snap.startedAt;
  const width = Math.max(120, Math.min(room.width, (room.height * deck.size.width) / deck.size.height));
  return (
    <div className="pp-presenter" role="presentation" data-testid="presenter-window">
      <div className="pp-presenter__top">
        <span className="pp-presenter__timer" data-testid="presenter-timer">{formatClock(elapsed)}</span>
        <button type="button" title={snap.paused ? S.show.resume : S.show.pause} onClick={() => send('pause')}>
          <Icon name={snap.paused ? 'play' : 'pause'} size={16} />
        </button>
        <button type="button" title={S.show.resetTimer} onClick={() => send('reset')}>
          <Icon name="arrow_counterclockwise" size={16} />
        </button>
        <span className="pp-show__spacer" />
        <span>{new Date(now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
        <button type="button" className="pp-presenter__end" onClick={() => send('end')}>
          {S.show.endShow}
        </button>
      </div>
      <div className="pp-presenter__main">
        <div className="pp-presenter__current">
          <div ref={fitRef} className="pp-presenter__fit">
            <div className="pp-presenter__slide" style={{ width, height: (width * deck.size.height) / deck.size.width }}>
              {snap.blank ? <div className={`pp-show__blank is-${snap.blank}`} style={{ position: 'absolute', inset: 0 }} /> : <PageView {...slidePageProps(deck, slide, snap.index, `p${slide.id}`)} hidden={hidden} scale={width / deck.size.width} />}
            </div>
          </div>
          <div className="pp-show__tools" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" title={S.show.previous} onClick={() => send('prev')}>
              <Icon name="chevron_left" size={20} />
            </button>
            <button type="button" title={S.show.next} onClick={() => send('next')}>
              <Icon name="chevron_right" size={20} />
            </button>
            <button type="button" title={S.show.black} onClick={() => send('blank')}>
              <Icon name="eye_off" size={20} />
            </button>
          </div>
          <div className="pp-presenter__count" data-testid="presenter-count">{S.show.counter(snap.pos + 1, snap.order.length)}</div>
        </div>
        <div ref={sideRef} className="pp-presenter__side">
          <div className="pp-presenter__label">{S.show.nextSlide}</div>
          <div className="pp-presenter__next" style={{ aspectRatio: `${deck.size.width} / ${deck.size.height}` }}>
            {nextSlide && nextIndex !== undefined ? <PageView {...slidePageProps(deck, nextSlide, nextIndex, `q${nextSlide.id}`)} scale={sideWidth / deck.size.width} /> : <div className="pp-presenter__none">{S.show.endOfShow}</div>}
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
          <div className="pp-presenter__notes" style={{ fontSize: notesSize }} data-testid="presenter-notes">
            {notesText(slide) || S.show.noNotes}
          </div>
        </div>
      </div>
    </div>
  );
}
