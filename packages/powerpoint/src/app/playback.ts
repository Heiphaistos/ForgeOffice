// Lecture du diaporama (sans DOM) : etapes d'animation au clic, minutage, images cles des effets et des transitions.
import type { Animation, Slide, Transition } from '@forgeoffice/pptx';

export interface TimedEffect {
  animation: Animation;
  /** Debut (ms) depuis le declenchement de l'etape. */
  start: number;
  duration: number;
}

export interface Step {
  /** Etape jouee seule a l'arrivee sur la diapositive (effets « avec / apres le precedent » en tete). */
  auto: boolean;
  effects: TimedEffect[];
  /** Duree totale de l'etape. */
  total: number;
}

const DEFAULT_DURATION = 500;
const durationOf = (a: Animation): number => (a.duration > 0 ? a.duration : a.presetId === 1 && a.class !== 'emph' ? 1 : DEFAULT_DURATION);

/** Decoupe la sequence principale en etapes (un clic = une etape) avec le debut de chaque effet. */
export function buildSteps(animations: readonly Animation[]): Step[] {
  const steps: Step[] = [];
  let current: Step | null = null;
  let prevStart = 0;
  let prevEnd = 0;
  for (const a of animations) {
    if (a.triggerShapeId !== undefined) continue;
    const duration = durationOf(a);
    if (a.trigger === 'onClick' || !current) {
      current = { auto: a.trigger !== 'onClick', effects: [], total: 0 };
      steps.push(current);
      prevStart = 0;
      prevEnd = 0;
    }
    const start = a.trigger === 'afterPrevious' ? prevEnd + a.delay : a.trigger === 'withPrevious' ? prevStart + a.delay : a.delay;
    current.effects.push({ animation: a, start, duration });
    prevStart = start;
    prevEnd = Math.max(prevEnd, start + duration * (a.repeat === 'indefinite' ? 1 : (a.repeat ?? 1)));
    current.total = Math.max(current.total, prevEnd);
  }
  return steps;
}

/** Sequences interactives : clic sur une forme declencheuse -> effets. */
export function triggerSteps(animations: readonly Animation[]): Map<number, Step> {
  const byShape = new Map<number, Animation[]>();
  for (const a of animations) {
    if (a.triggerShapeId === undefined) continue;
    byShape.set(a.triggerShapeId, [...(byShape.get(a.triggerShapeId) ?? []), { ...a, trigger: a.trigger === 'onClick' && (byShape.get(a.triggerShapeId)?.length ?? 0) > 0 ? 'afterPrevious' : a.trigger }]);
  }
  const out = new Map<number, Step>();
  for (const [shape, list] of byShape) {
    const steps = buildSteps(list.map((a, i) => ({ ...a, triggerShapeId: undefined, trigger: i === 0 ? ('onClick' as const) : a.trigger })));
    const merged: Step = { auto: false, effects: steps.flatMap((s) => s.effects), total: Math.max(0, ...steps.map((s) => s.total)) };
    out.set(shape, merged);
  }
  return out;
}

/** Formes cachees a l'arrivee : celles dont le premier effet est une entree. */
export function initiallyHidden(slide: Slide): Set<number> {
  const seen = new Set<number>();
  const hidden = new Set<number>();
  for (const a of slide.animations) {
    if (seen.has(a.shapeId)) continue;
    seen.add(a.shapeId);
    if (a.class === 'entr') hidden.add(a.shapeId);
  }
  return hidden;
}

/** Visibilite d'une forme apres un effet. */
export function visibleAfter(a: Animation): boolean | null {
  if (a.class === 'entr') return true;
  if (a.class === 'exit') return false;
  return null;
}

export interface EffectFrames {
  keyframes: Keyframe[];
  easing: string;
  /** Origine de transformation relative a la forme (CSS). */
  origin?: string;
}

/** Sens d'arrivee d'une entree brusquee d'apres le sous-type PowerPoint (1 haut, 2 droite, 4 bas, 8 gauche). */
function flyOffset(subtype: number | undefined): [string, string] {
  switch (subtype) {
    case 1:
      return ['0', '-120vh'];
    case 2:
      return ['120vw', '0'];
    case 8:
      return ['-120vw', '0'];
    default:
      return ['0', '120vh'];
  }
}

/** Trajectoire PowerPoint (« M 0 0 L 0.25 0.1 E ») -> points relatifs a la diapositive. */
export function parseMotionPath(path: string): Array<{ x: number; y: number }> {
  const nums = path.replace(/[A-DF-Za-df-z]/g, ' ').match(/-?\d*\.?\d+(e-?\d+)?/gi) ?? [];
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
  return pts;
}

/** Images cles d'un effet (Web Animations). `page` = taille de la diapositive en points (trajectoires). */
export function effectFrames(a: Animation, page: { width: number; height: number }): EffectFrames {
  const ease = 'cubic-bezier(0.25, 0.1, 0.25, 1)';
  const reverse = a.class === 'exit';
  const pair = (from: Keyframe, to: Keyframe): Keyframe[] => (reverse ? [to, from] : [from, to]);
  if (a.class === 'entr' || a.class === 'exit') {
    switch (a.presetId) {
      case 1:
        return { keyframes: pair({ opacity: 0 }, { opacity: 1 }), easing: 'steps(1, end)' };
      case 2: {
        const [x, y] = flyOffset(a.presetSubtype);
        return { keyframes: pair({ transform: `translate(${x}, ${y})`, opacity: 1 }, { transform: 'translate(0, 0)', opacity: 1 }), easing: reverse ? 'ease-in' : 'ease-out' };
      }
      case 42:
      case 47:
        return { keyframes: pair({ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'translateY(0)' }), easing: ease };
      case 16:
        return { keyframes: pair({ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0 0 0)' }), easing: ease };
      case 22:
        return { keyframes: pair({ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }), easing: ease };
      case 6:
        return { keyframes: pair({ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }), easing: ease };
      case 8:
        return { keyframes: pair({ clipPath: 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)' }, { clipPath: 'polygon(50% -50%, 150% 50%, 50% 150%, -50% 50%)' }), easing: ease };
      case 21:
        return { keyframes: pair({ clipPath: 'polygon(50% 50%, 50% 0%, 50% 0%)', opacity: 0.2 }, { clipPath: 'polygon(50% 50%, 50% -200%, 300% 50%, 50% 300%, -200% 50%, 50% -200%)', opacity: 1 }), easing: ease };
      case 14:
      case 3:
        return { keyframes: pair({ clipPath: 'inset(0 0 100% 0)', opacity: 0.4 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }), easing: 'steps(8, end)' };
      case 9:
        return { keyframes: pair({ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }), easing: 'steps(10, end)' };
      case 23:
      case 53:
        return { keyframes: pair({ opacity: 0, transform: 'scale(0.3)' }, { opacity: 1, transform: 'scale(1)' }), easing: ease };
      case 26:
        return {
          keyframes: reverse
            ? [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-30px)', opacity: 1, offset: 0.3 }, { transform: 'translateY(120vh)', opacity: 1 }]
            : [{ transform: 'translateY(-120vh)', opacity: 1 }, { transform: 'translateY(0)', offset: 0.6 }, { transform: 'translateY(-30px)', offset: 0.75 }, { transform: 'translateY(0)', offset: 0.88 }, { transform: 'translateY(-8px)', offset: 0.94 }, { transform: 'translateY(0)' }],
          easing: 'ease-in-out',
        };
      case 31:
        return { keyframes: pair({ opacity: 0, transform: 'scale(0.2) rotate(-90deg)' }, { opacity: 1, transform: 'scale(1) rotate(0)' }), easing: ease };
      default:
        return { keyframes: pair({ opacity: 0 }, { opacity: 1 }), easing: ease };
    }
  }
  if (a.class === 'emph') {
    switch (a.presetId) {
      case 8:
        return { keyframes: [{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], easing: ease };
      case 6:
        return { keyframes: [{ transform: 'scale(1)' }, { transform: 'scale(1.5)' }], easing: ease };
      case 9:
        return { keyframes: [{ opacity: 1 }, { opacity: 0.25 }], easing: ease };
      case 32:
        return { keyframes: [0, -8, 8, -8, 8, 0].map((d) => ({ transform: `rotate(${d}deg)` })), easing: 'linear' };
      default:
        return { keyframes: [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], easing: 'ease-in-out' };
    }
  }
  if (a.class === 'path' && a.path) {
    const pts = parseMotionPath(a.path);
    return { keyframes: pts.map((p) => ({ transform: `translate(${p.x * page.width}px, ${p.y * page.height}px)` })), easing: ease };
  }
  return { keyframes: [{ opacity: 1 }, { opacity: 1 }], easing: 'linear' };
}

export interface TransitionFrames {
  incoming: Keyframe[];
  outgoing: Keyframe[];
  duration: number;
  /** Perspective necessaire (effets 3D). */
  perspective?: boolean;
}

const dirVector = (dir: string | undefined): [number, number] => {
  switch (dir) {
    case 'u':
      return [0, -1];
    case 'd':
      return [0, 1];
    case 'r':
      return [1, 0];
    case 'l':
      return [-1, 0];
    case 'lu':
      return [-1, -1];
    case 'ru':
      return [1, -1];
    case 'ld':
      return [-1, 1];
    case 'rd':
      return [1, 1];
    default:
      return [0, 0];
  }
};

/** Duree effective d'une transition (ms). */
export function transitionDuration(t: Transition | undefined): number {
  if (!t || t.type === 'none' || t.type === 'cut') return 0;
  if (t.duration !== undefined) return t.duration;
  return t.speed === 'slow' ? 1000 : t.speed === 'med' ? 750 : t.type === 'morph' ? 2000 : 700;
}

/** Images cles des diapositives entrante et sortante pour une transition. */
export function transitionFrames(t: Transition | undefined): TransitionFrames {
  const duration = transitionDuration(t);
  const none: TransitionFrames = { incoming: [{ opacity: 1 }, { opacity: 1 }], outgoing: [{ opacity: 1 }, { opacity: 0 }], duration };
  if (!t || duration === 0) return { ...none, duration: 0 };
  const p = t.params ?? {};
  // Sens « vers » : l'entrante arrive du cote oppose a la direction (PowerPoint « Depuis la droite » = dir l).
  const [vx, vy] = dirVector(p.dir ?? (t.type === 'push' || t.type === 'cover' || t.type === 'pull' ? 'u' : 'l'));
  const pct = (v: number): string => `${v * 100}%`;
  switch (t.type) {
    case 'fade':
    case 'dissolve':
    case 'morph':
      return { incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: p.thruBlk === '1' || p.thruBlk === 'true' ? [{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }] : [{ opacity: 1 }, { opacity: 1 }], duration };
    case 'push':
      return { incoming: [{ transform: `translate(${pct(-vx)}, ${pct(-vy)})` }, { transform: 'translate(0, 0)' }], outgoing: [{ transform: 'translate(0, 0)' }, { transform: `translate(${pct(vx)}, ${pct(vy)})` }], duration };
    case 'cover':
      return { incoming: [{ transform: `translate(${pct(-vx)}, ${pct(-vy)})` }, { transform: 'translate(0, 0)' }], outgoing: [{ opacity: 1 }, { opacity: 1 }], duration };
    case 'pull':
    case 'uncover':
      return { incoming: [{ opacity: 1 }, { opacity: 1 }], outgoing: [{ transform: 'translate(0, 0)', zIndex: 2 }, { transform: `translate(${pct(vx)}, ${pct(vy)})`, zIndex: 2 }], duration };
    case 'wipe': {
      const from = vx > 0 ? 'inset(0 100% 0 0)' : vx < 0 ? 'inset(0 0 0 100%)' : vy > 0 ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)';
      return { incoming: [{ clipPath: from }, { clipPath: 'inset(0 0 0 0)' }], outgoing: [{ opacity: 1 }, { opacity: 1 }], duration };
    }
    case 'split': {
      const vertical = p.orient === 'vert';
      const from = vertical ? 'inset(0 50% 0 50%)' : 'inset(50% 0 50% 0)';
      return { incoming: [{ clipPath: p.dir === 'in' ? 'inset(0 0 0 0)' : from }, { clipPath: 'inset(0 0 0 0)' }], outgoing: [{ opacity: 1 }, { opacity: 1 }], duration };
    }
    case 'circle':
    case 'wheel':
    case 'wedge':
      return { incoming: [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }], outgoing: [{ opacity: 1 }, { opacity: 1 }], duration };
    case 'diamond':
      return { incoming: [{ clipPath: 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)' }, { clipPath: 'polygon(50% -50%, 150% 50%, 50% 150%, -50% 50%)' }], outgoing: [{ opacity: 1 }, { opacity: 1 }], duration };
    case 'plus':
      return { incoming: [{ clipPath: 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)' }, { clipPath: 'polygon(50% -100%, 200% 50%, 50% 200%, -100% 50%)' }], outgoing: [{ opacity: 1 }, { opacity: 1 }], duration };
    case 'zoom':
    case 'warp':
      return { incoming: [{ transform: 'scale(0.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], outgoing: [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], duration };
    case 'randomBar':
    case 'blinds':
    case 'strips':
    case 'checker':
      return { incoming: [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }], outgoing: [{ opacity: 1 }, { opacity: 1 }], duration: duration };
    case 'flash':
      return { incoming: [{ opacity: 0, filter: 'brightness(3)' }, { opacity: 1, filter: 'brightness(3)', offset: 0.4 }, { opacity: 1, filter: 'brightness(1)' }], outgoing: [{ opacity: 1 }, { opacity: 1 }], duration };
    case 'flip':
    case 'cube':
    case 'switch':
    case 'gallery':
    case 'doors':
    case 'window':
    case 'ferris':
    case 'rotate':
      return {
        incoming: [{ transform: `rotateY(${vx >= 0 ? -90 : 90}deg)`, opacity: 0 }, { transform: `rotateY(${vx >= 0 ? -90 : 90}deg)`, opacity: 0, offset: 0.5 }, { transform: 'rotateY(0)', opacity: 1 }],
        outgoing: [{ transform: 'rotateY(0)' }, { transform: `rotateY(${vx >= 0 ? 90 : -90}deg)`, opacity: 0, offset: 0.5 }, { opacity: 0 }],
        duration,
        perspective: true,
      };
    case 'vortex':
    case 'ripple':
    case 'honeycomb':
    case 'glitter':
    case 'shred':
      return { incoming: [{ opacity: 0, transform: 'scale(1.2) rotate(8deg)', filter: 'blur(8px)' }, { opacity: 1, transform: 'scale(1) rotate(0)', filter: 'blur(0)' }], outgoing: [{ opacity: 1 }, { opacity: 1 }], duration };
    case 'reveal':
      return { incoming: [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], outgoing: [{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], duration };
    default:
      return { incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: [{ opacity: 1 }, { opacity: 1 }], duration };
  }
}

/** Diapositives visibles en diaporama (masquees exclues). Renvoie leurs indices dans la presentation. */
export function showOrder(slides: readonly Slide[], from = 0): number[] {
  return slides.map((s, i) => (s.hidden ? -1 : i)).filter((i) => i >= from && i >= 0);
}

/** Formes cachees une fois `step` etapes d'animation jouees (ecran du presentateur synchronise). */
export function hiddenAtStep(slide: Slide, step: number): Set<number> {
  const hidden = initiallyHidden(slide);
  for (const s of buildSteps(slide.animations).slice(0, Math.max(0, step))) {
    for (const e of s.effects) {
      const v = visibleAfter(e.animation);
      if (v === true) hidden.delete(e.animation.shapeId);
      else if (v === false) hidden.add(e.animation.shapeId);
    }
  }
  return hidden;
}
