// Modele pur de la boîte « Options d'effet » : valeurs du formulaire <-> animation, patch minimal.
import type { Animation, AnimationTrigger } from '@forgeoffice/pptx';

export type RepeatChoice = 'none' | '2' | '3' | '4' | '5' | '10' | 'indefinite';
export const REPEAT_CHOICES: readonly RepeatChoice[] = ['none', '2', '3', '4', '5', '10', 'indefinite'];

/** Effets qui acceptent une direction (Entrée brusquée = 2, Balayer = 22) : sous-types de PowerPoint. */
export const DIRECTION_EFFECTS: ReadonlySet<number> = new Set([2, 22]);
export const DIRECTIONS: ReadonlyArray<readonly ['fromBottom' | 'fromLeft' | 'fromRight' | 'fromTop', number]> = [['fromBottom', 4], ['fromLeft', 8], ['fromRight', 2], ['fromTop', 1]];

export interface EffectForm {
  direction: number | undefined;
  trigger: AnimationTrigger;
  /** Declencheur interactif : forme sur laquelle cliquer (0 = enchainement normal). */
  triggerShapeId: number;
  /** Secondes. */
  delay: number;
  duration: number;
  repeat: RepeatChoice;
  autoReverse: boolean;
}

export function effectForm(a: Animation): EffectForm {
  return {
    direction: a.presetSubtype,
    trigger: a.trigger,
    triggerShapeId: a.triggerShapeId ?? 0,
    delay: a.delay / 1000,
    duration: a.duration / 1000,
    repeat: a.repeat === 'indefinite' ? 'indefinite' : a.repeat && a.repeat > 1 ? (String(a.repeat) as RepeatChoice) : 'none',
    autoReverse: !!a.autoReverse,
  };
}

/** Champs modifies, prets a etre fusionnes dans les animations : `undefined` retire la propriete. */
export function effectPatch(form: EffectForm, initial: EffectForm): Partial<Animation> {
  const patch: Partial<Animation> = {};
  if (form.direction !== initial.direction) patch.presetSubtype = form.direction;
  if (form.trigger !== initial.trigger) patch.trigger = form.trigger;
  if (form.triggerShapeId !== initial.triggerShapeId) patch.triggerShapeId = form.triggerShapeId || undefined;
  if (form.delay !== initial.delay) patch.delay = Math.max(0, Math.round(form.delay * 1000));
  if (form.duration !== initial.duration) patch.duration = Math.max(0, Math.round(form.duration * 1000));
  if (form.repeat !== initial.repeat) patch.repeat = form.repeat === 'none' ? undefined : form.repeat === 'indefinite' ? 'indefinite' : Number(form.repeat);
  if (form.autoReverse !== initial.autoReverse) patch.autoReverse = form.autoReverse || undefined;
  return patch;
}

/** Fusionne un patch dans une animation en retirant les proprietes mises a `undefined`. */
export function applyEffectPatch(a: Animation, patch: Partial<Animation>): Animation {
  const out: Animation = { ...a, ...patch };
  for (const key of Object.keys(patch) as Array<keyof Animation>) if (patch[key] === undefined) delete out[key];
  return out;
}

/** Remplace les animations des formes visees par des copies de `source` (une copie par forme visee). */
export function pasteAnimations(list: Animation[], targets: ReadonlySet<number>, source: readonly Animation[]): Animation[] {
  const kept = list.filter((a) => !targets.has(a.shapeId));
  const added = [...targets].flatMap((shapeId) => source.map((a) => ({ ...structuredClone(a), shapeId, triggerShapeId: undefined })));
  return [...kept, ...added];
}

/** L'animation de la forme est-elle decoupee par paragraphe ? */
export const isByParagraph = (list: readonly Animation[], shapeId: number): boolean => list.some((a) => a.shapeId === shapeId && a.paragraphs);

/** Decoupe l'animation de la forme en une par paragraphe (la premiere garde le demarrage, les autres sont « au clic »). */
export function splitByParagraph(list: readonly Animation[], shapeId: number, count: number): Animation[] {
  const at = list.findIndex((a) => a.shapeId === shapeId && !a.paragraphs);
  const base = list[at];
  if (!base || count < 2) return [...list];
  const parts = Array.from({ length: count }, (_, i): Animation => ({ ...base, trigger: i === 0 ? base.trigger : 'onClick', delay: i === 0 ? base.delay : 0, paragraphs: { start: i, end: i } }));
  return [...list.slice(0, at), ...parts, ...list.slice(at + 1)];
}

/** Regroupe les animations par paragraphe de la forme en une seule animation de forme entiere. */
export function mergeParagraphs(list: readonly Animation[], shapeId: number): Animation[] {
  const at = list.findIndex((a) => a.shapeId === shapeId && a.paragraphs);
  const first = list[at];
  if (!first) return [...list];
  const { paragraphs: _gone, ...whole } = first;
  return list.flatMap((a, i): Animation[] => (i === at ? [whole] : a.shapeId === shapeId && a.paragraphs ? [] : [a]));
}
