// Onglets Transitions et Animations.
import { useRef } from 'react';
import type { Animation, AnimationClass, AnimationTrigger, Transition } from '@forgeoffice/pptx';
import { addMedia } from '@forgeoffice/pptx';
import type { GalleryItem, MenuItem, RibbonTab } from '@forgeoffice/ui';
import { Icon, type IconName } from '@forgeoffice/ui';
import { editSlide, editSlides } from '../deck-ops.ts';
import { effectFrames, transitionFrames } from '../playback.ts';
import { AUDIO_FILTERS, extensionOf } from '../insert.ts';
import type { Editor } from '../editor.ts';
import type { TabContext } from './common.tsx';
import { S } from '../../strings.ts';
import { EFFECTS, OO_EFFECT_NAMES, OO_TRANSITION_NAMES, TRANSITIONS, ooTransitionOrder } from '../motion-catalog.ts';
import { isOnlyOffice } from '@forgeoffice/ui/logic/ooMode';

export { EFFECTS, TRANSITIONS };
import { S3 } from '../strings-text.ts';
import { animationPainter, hasCopiedAnimation } from '../anim-painter.ts';

/** Vignette animee : survol = apercu de la transition. */
function TransitionTile({ type, params, label }: { type: string; params?: Record<string, string>; label: string }) {
  const a = useRef<HTMLSpanElement>(null);
  const b = useRef<HTMLSpanElement>(null);
  const play = (): void => {
    const frames = transitionFrames({ type, params, duration: 900 });
    if (!frames.duration) return;
    b.current?.animate(frames.incoming, { duration: frames.duration, easing: 'ease-in-out', fill: 'both' });
    a.current?.animate(frames.outgoing, { duration: frames.duration, easing: 'ease-in-out', fill: 'both' });
  };
  return (
    <span className="pp-trans" onMouseEnter={play} title={label}>
      <span className="pp-trans__box">
        <span ref={a} className="pp-trans__a" />
        {type !== 'none' && <span ref={b} className="pp-trans__b" />}
      </span>
      <span className="pp-trans__label">{label}</span>
    </span>
  );
}

const DIRECTIONS: Readonly<Record<string, ReadonlyArray<[string, Record<string, string>]>>> = {
  push: [['fromBottom', { dir: 'u' }], ['fromLeft', { dir: 'r' }], ['fromRight', { dir: 'l' }], ['fromTop', { dir: 'd' }]],
  wipe: [['fromRight', { dir: 'l' }], ['fromTop', { dir: 'd' }], ['fromLeft', { dir: 'r' }], ['fromBottom', { dir: 'u' }]],
  cover: [['fromRight', { dir: 'l' }], ['fromTop', { dir: 'd' }], ['fromLeft', { dir: 'r' }], ['fromBottom', { dir: 'u' }]],
  pull: [['fromRight', { dir: 'l' }], ['fromTop', { dir: 'd' }], ['fromLeft', { dir: 'r' }], ['fromBottom', { dir: 'u' }]],
  split: [['vertOut', { orient: 'vert', dir: 'out' }], ['vertIn', { orient: 'vert', dir: 'in' }], ['horzOut', { orient: 'horz', dir: 'out' }], ['horzIn', { orient: 'horz', dir: 'in' }]],
  fade: [['smooth', {}], ['throughBlack', { thruBlk: '1' }]],
  flip: [['right', { dir: 'r' }], ['left', { dir: 'l' }]],
  cube: [['fromRight', { dir: 'l' }], ['fromLeft', { dir: 'r' }]],
};

function targetSlides(ed: Editor): Set<number> {
  return new Set(ed.selectedSlides.length ? ed.selectedSlides : ed.slide ? [ed.slide.id] : []);
}

function setTransition(ed: Editor, patch: Partial<Transition> | null, all = false): void {
  const ids = all ? new Set(ed.deck.slides.map((s) => s.id)) : targetSlides(ed);
  const base = ed.slide?.transition;
  ed.commit(editSlides(ed.deck, ids, (slide) => {
    if (patch === null) delete slide.transition;
    else slide.transition = { ...((all ? base : slide.transition) ?? { type: 'none' }), ...patch };
  }), 'transition');
}

export function transitionsTab(ctx: TabContext): RibbonTab {
  const { ed, app } = ctx;
  const t = ed.slide?.transition;
  const current = TRANSITIONS.find((x) => x.type === (t?.type ?? 'none'))?.id ?? 'none';
  const oo = isOnlyOffice();
  const tname = (id: string): string => (oo ? OO_TRANSITION_NAMES[id] : undefined) ?? S.transitions.names[id as keyof typeof S.transitions.names] ?? id;
  const items: GalleryItem[] = (oo ? ooTransitionOrder(TRANSITIONS) : TRANSITIONS).map((x) => ({ id: x.id, label: tname(x.id), render: () => <TransitionTile type={x.type} params={x.params} label={tname(x.id)} /> }));
  const dirs = DIRECTIONS[t?.type ?? ''] ?? [];
  const pickSound = async (): Promise<void> => {
    const file = await ed.services.openFile(AUDIO_FILTERS);
    if (!file) return;
    const deck = { ...ed.deck, media: { ...ed.deck.media } };
    const mediaId = addMedia(deck, file.bytes, extensionOf(file.name));
    ed.commit({ ...editSlides(deck, targetSlides(ed), (s) => {
      s.transition = { ...(s.transition ?? { type: 'fade' }), sound: { name: file.name, mediaId } };
    }), media: deck.media }, 'sound');
  };
  return {
    id: 'transitions',
    label: S.tabs.transitions,
    keytip: 'K',
    groups: [
      { id: 'preview', label: S.transitions.preview, icon: 'play', controls: [{ kind: 'button', id: 'preview', label: S.transitions.preview, icon: 'play', size: 'large', onClick: app.previewTransition }] },
      {
        id: 'gallery', label: S.transitions.toSlide, icon: 'slide_transition',
        controls: [
          {
            kind: 'gallery', id: 'transitions', label: S.transitions.toSlide, items, selectedId: current, itemWidth: 64, columns: 7,
            onSelect: (id) => {
              const def = TRANSITIONS.find((x) => x.id === id);
              if (!def || def.type === 'none') setTransition(ed, null);
              else {
                setTransition(ed, { type: def.type, params: def.params ? { ...def.params } : undefined, duration: def.type === 'morph' ? 2000 : def.type === 'cut' ? undefined : (t?.duration ?? 700) });
                window.setTimeout(app.previewTransition, 30);
              }
            },
          },
          {
            kind: 'menu', id: 'options', label: S.transitions.options, icon: 'options', size: 'large', disabled: !dirs.length,
            items: dirs.map(([key, params]) => ({ id: key, label: S.transitions.directions[key as keyof typeof S.transitions.directions] ?? key, checked: JSON.stringify(t?.params ?? {}) === JSON.stringify(params), onClick: () => setTransition(ed, { params: { ...params } }) })),
          },
        ],
      },
      {
        id: 'timing', label: S.transitions.timing, icon: 'clock',
        controls: [
          {
            kind: 'menu', id: 'sound', label: t?.sound ? `${S.transitions.sound} : ${t.sound.name}` : S.transitions.sound, icon: 'speaker_2', size: 'small',
            items: [
              { id: 'none', label: S.transitions.noSound, checked: !t?.sound && !t?.stopSound, onClick: () => setTransition(ed, { sound: undefined, stopSound: undefined }) },
              { id: 'stop', label: S.transitions.stopSound, checked: !!t?.stopSound, onClick: () => setTransition(ed, { sound: undefined, stopSound: true }) },
              { id: 'other', label: S.transitions.otherSound, icon: 'folder_open', onClick: () => void pickSound() },
            ],
          },
          { kind: 'number', id: 'duration', label: S.transitions.duration, value: Math.round((t?.duration ?? 700) / 10) / 100, min: 0.01, max: 59, step: 0.25, unit: 's', width: 64, disabled: !t || t.type === 'none', onChange: (v) => setTransition(ed, { duration: Math.round(v * 1000) }) },
          { kind: 'button', id: 'applyAll', label: S.transitions.applyAll, icon: 'slide_multiple', size: 'small', disabled: !t, onClick: () => setTransition(ed, {}, true) },
          { kind: 'separator', id: 'sep' },
          { kind: 'checkbox', id: 'onClick', label: S.transitions.onClick, checked: t?.advanceOnClick !== false, onChange: (v) => setTransition(ed, { advanceOnClick: v ? undefined : false }) },
          {
            kind: 'row', id: 'afterRow', controls: [
              { kind: 'checkbox', id: 'after', label: S.transitions.after, checked: t?.advanceAfter !== undefined, onChange: (v) => setTransition(ed, { advanceAfter: v ? 5000 : undefined }) },
              { kind: 'number', id: 'afterValue', label: S.transitions.afterValue, value: (t?.advanceAfter ?? 0) / 1000, min: 0, max: 3600, step: 1, unit: 's', width: 64, disabled: t?.advanceAfter === undefined, onChange: (v) => setTransition(ed, { advanceAfter: Math.round(v * 1000) }) },
            ],
          },
        ],
      },
    ],
  };
}

/** Vignette d'effet d'animation : le survol joue l'effet sur un petit carre (aperçu). */
function EffectTile({ effect, label, color }: { effect: (typeof EFFECTS)[number]; label: string; color: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const play = (): void => {
    const frames = effectFrames({ shapeId: 0, class: effect.cls, presetId: effect.preset, presetSubtype: effect.subtype, trigger: 'onClick', delay: 0, duration: 700, path: effect.path }, { width: 160, height: 90 });
    box.current?.animate(frames.keyframes, { duration: 700, easing: frames.easing, fill: 'none' });
  };
  return (
    <span className="pp-anim" onMouseEnter={play} data-effect={effect.id} title={label}>
      <span className="pp-anim__stage"><span ref={box} className="pp-anim__box" style={{ background: color }} /></span>
      <span>{label}</span>
    </span>
  );
}

const COLOR: Readonly<Record<string, string>> = { entr: '#3A9A3A', emph: '#D9A400', exit: '#D13438', path: '#6B6B6B' };

/** Animations de la diapositive courante qui visent les formes selectionnees. */
export function selectedAnimations(ed: Editor): Animation[] {
  const ids = new Set(ed.selection.ids);
  return (ed.slide?.animations ?? []).filter((a) => ids.has(a.shapeId));
}

/** Modifie les animations des formes selectionnees (ou celles choisies dans le volet). */
export function editAnimations(ed: Editor, recipe: (list: Animation[], targets: Set<number>) => Animation[], group = 'animation'): void {
  const slide = ed.slide;
  if (!slide) return;
  const targets = new Set(ed.selection.ids);
  ed.commit(editSlide(ed.deck, slide.id, (s) => {
    s.animations = recipe(s.animations, targets);
    delete s.timing;
  }), group);
}

function makeAnimation(shapeId: number, effect: (typeof EFFECTS)[number], trigger: AnimationTrigger): Animation {
  const a: Animation = { shapeId, class: effect.cls, presetId: effect.preset, trigger, delay: 0, duration: effect.cls === 'entr' && effect.preset === 1 ? 0 : effect.cls === 'path' ? 2000 : 500 };
  if (effect.subtype) a.presetSubtype = effect.subtype;
  if (effect.path) a.path = effect.path;
  return a;
}

export function animationsTab(ctx: TabContext): RibbonTab {
  const { ed, app } = ctx;
  const anims = selectedAnimations(ed);
  const first = anims[0];
  const hasSel = ed.selection.ids.length > 0;
  const name = (id: string): string => (isOnlyOffice() ? OO_EFFECT_NAMES[id] : undefined) ?? S.animations.names[id as keyof typeof S.animations.names] ?? id;
  const items: GalleryItem[] = [
    { id: 'none', label: S.animations.none, render: () => <span className="pp-anim"><Icon name="dismiss" size={20} /><span>{S.animations.none}</span></span> },
    ...EFFECTS.map((e) => ({ id: e.id, label: name(e.id), render: () => <EffectTile effect={e} label={name(e.id)} color={COLOR[e.cls] ?? '#888'} /> })),
  ];
  const apply = (id: string, add: boolean): void => {
    const effect = EFFECTS.find((e) => e.id === id);
    editAnimations(ed, (list, targets) => {
      const kept = add ? list : list.filter((a) => !targets.has(a.shapeId));
      if (!effect) return kept;
      return [...kept, ...[...targets].map((shapeId, i) => makeAnimation(shapeId, effect, i === 0 ? 'onClick' : 'withPrevious'))];
    });
    if (effect) window.setTimeout(app.previewAnimations, 30);
  };
  const patchAll = (patch: Partial<Animation>): void => editAnimations(ed, (list, targets) => list.map((a) => (targets.has(a.shapeId) ? { ...a, ...patch } : a)), 'animTiming');
  const move = (delta: -1 | 1): void =>
    editAnimations(ed, (list, targets) => {
      const out = [...list];
      const indices = out.map((a, i) => (targets.has(a.shapeId) ? i : -1)).filter((i) => i >= 0);
      const ordered = delta < 0 ? indices : [...indices].reverse();
      for (const i of ordered) {
        const j = i + delta;
        if (j < 0 || j >= out.length || targets.has((out[j] as Animation).shapeId)) continue;
        [out[i], out[j]] = [out[j] as Animation, out[i] as Animation];
      }
      return out;
    }, 'animOrder');
  const triggerItems: MenuItem[] = [
    { id: 'seq', label: S.animations.triggerSequence, checked: first?.triggerShapeId === undefined, onClick: () => editAnimations(ed, (list, targets) => list.map((a) => (targets.has(a.shapeId) ? { ...a, triggerShapeId: undefined } : a))) },
    { id: 'h', kind: 'header', label: S.animations.triggerOnClickOf },
    ...(ed.slide?.shapes ?? []).map((s) => ({ id: String(s.id), label: s.name, checked: first?.triggerShapeId === s.id, onClick: () => patchAll({ triggerShapeId: s.id }) })),
  ];
  const subtypeItems: MenuItem[] = first?.class !== 'path' && (first?.presetId === 2 || first?.presetId === 22)
    ? ([['fromBottom', 4], ['fromLeft', 8], ['fromRight', 2], ['fromTop', 1]] as const).map(([key, sub]) => ({ id: key, label: S.transitions.directions[key], checked: first.presetSubtype === sub, onClick: () => patchAll({ presetSubtype: sub }) }))
    : [];
  return {
    id: 'animations',
    label: S.tabs.animations,
    keytip: 'A',
    groups: [
      { id: 'preview', label: S.transitions.preview, icon: 'play', controls: [{ kind: 'button', id: 'preview', label: S.transitions.preview, icon: 'play', size: 'large', disabled: !ed.slide?.animations.length, onClick: app.previewAnimations }] },
      {
        id: 'animation', label: S.animations.group, icon: 'sparkle',
        controls: [
          { kind: 'gallery', id: 'effects', label: S.animations.group, items, selectedId: first ? `${first.class}:${first.class === 'path' ? (EFFECTS.find((e) => e.path === first.path)?.id.split(':')[1] ?? 'line') : first.presetId}` : 'none', itemWidth: 72, columns: 8, disabled: !hasSel, onSelect: (id) => apply(id, false) },
          { kind: 'menu', id: 'options', label: S.transitions.options, icon: 'options', size: 'large', disabled: !first, items: [...subtypeItems, ...(subtypeItems.length ? [{ id: 'sepOpt', kind: 'separator' as const }] : []), { id: 'more', label: S3.effect.menu, onClick: () => app.dialog('effect') }] },
        ],
      },
      {
        id: 'advanced', label: S.animations.advanced, icon: 'sparkle',
        controls: [
          { kind: 'menu', id: 'add', label: S.animations.add, icon: 'add', size: 'large', disabled: !hasSel, items: EFFECTS.map((e) => ({ id: e.id, label: name(e.id), onClick: () => apply(e.id, true) })) },
          { kind: 'button', id: 'painter', label: S3.effect.painter, icon: 'paint_brush', size: 'small', disabled: !hasSel && !hasCopiedAnimation(), onClick: () => animationPainter(ed) },
          { kind: 'toggle', id: 'pane', label: S.animations.pane, icon: 'panel_right', size: 'small', pressed: ed.ui.pane === 'animation', onToggle: (on) => app.pane(on ? 'animation' : null) },
          { kind: 'menu', id: 'trigger', label: S.animations.trigger, icon: 'arrow_right', size: 'small', disabled: !first, items: triggerItems },
        ],
      },
      {
        id: 'timing', label: S.transitions.timing, icon: 'clock',
        controls: [
          {
            kind: 'combo', id: 'start', label: S.animations.start, width: 150, disabled: !first, value: S.animations[first?.trigger ?? 'onClick'],
            options: (['onClick', 'withPrevious', 'afterPrevious'] as const).map((t) => ({ value: S.animations[t] })),
            onChange: (v) => {
              const trigger = (['onClick', 'withPrevious', 'afterPrevious'] as const).find((t) => S.animations[t] === v);
              if (trigger) patchAll({ trigger });
            },
          },
          { kind: 'number', id: 'duration', label: S.animations.duration, value: (first?.duration ?? 500) / 1000, min: 0, max: 59, step: 0.25, unit: 's', width: 64, disabled: !first, onChange: (v) => patchAll({ duration: Math.round(v * 1000) }) },
          { kind: 'number', id: 'delay', label: S.animations.delay, value: (first?.delay ?? 0) / 1000, min: 0, max: 59, step: 0.25, unit: 's', width: 64, disabled: !first, onChange: (v) => patchAll({ delay: Math.round(v * 1000) }) },
          { kind: 'button', id: 'earlier', label: S.animations.earlier, icon: 'arrow_up', size: 'small', disabled: !first, onClick: () => move(-1) },
          { kind: 'button', id: 'later', label: S.animations.later, icon: 'arrow_down', size: 'small', disabled: !first, onClick: () => move(1) },
        ],
      },
    ],
  };
}
