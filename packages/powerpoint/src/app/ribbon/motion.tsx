// Onglets Transitions et Animations.
import { useRef } from 'react';
import type { Animation, AnimationClass, AnimationTrigger, Transition } from '@forgeoffice/pptx';
import { addMedia } from '@forgeoffice/pptx';
import type { GalleryItem, MenuItem, RibbonTab } from '@forgeoffice/ui';
import { Icon, type IconName } from '@forgeoffice/ui';
import { editSlide, editSlides } from '../deck-ops.ts';
import { transitionFrames } from '../playback.ts';
import { AUDIO_FILTERS, extensionOf } from '../insert.ts';
import type { Editor } from '../editor.ts';
import type { TabContext } from './common.tsx';
import { S } from '../../strings.ts';

/** Transitions proposees (type, parametres, icone). */
export const TRANSITIONS: ReadonlyArray<{ id: string; type: string; params?: Record<string, string>; group: 'subtle' | 'exciting' }> = [
  { id: 'none', type: 'none', group: 'subtle' },
  { id: 'morph', type: 'morph', group: 'subtle' },
  { id: 'fade', type: 'fade', group: 'subtle' },
  { id: 'push', type: 'push', params: { dir: 'u' }, group: 'subtle' },
  { id: 'wipe', type: 'wipe', params: { dir: 'l' }, group: 'subtle' },
  { id: 'split', type: 'split', params: { orient: 'vert', dir: 'out' }, group: 'subtle' },
  { id: 'reveal', type: 'reveal', group: 'subtle' },
  { id: 'cut', type: 'cut', group: 'subtle' },
  { id: 'randomBar', type: 'randomBar', params: { dir: 'vert' }, group: 'subtle' },
  { id: 'circle', type: 'circle', group: 'subtle' },
  { id: 'uncover', type: 'pull', params: { dir: 'l' }, group: 'subtle' },
  { id: 'cover', type: 'cover', params: { dir: 'l' }, group: 'subtle' },
  { id: 'flash', type: 'flash', group: 'subtle' },
  { id: 'zoom', type: 'zoom', group: 'exciting' },
  { id: 'vortex', type: 'vortex', params: { dir: 'r' }, group: 'exciting' },
  { id: 'flip', type: 'flip', params: { dir: 'r' }, group: 'exciting' },
  { id: 'cube', type: 'cube', params: { dir: 'l' }, group: 'exciting' },
  { id: 'gallery', type: 'gallery', params: { dir: 'l' }, group: 'exciting' },
  { id: 'doors', type: 'doors', params: { dir: 'vert' }, group: 'exciting' },
  { id: 'ripple', type: 'ripple', group: 'exciting' },
  { id: 'honeycomb', type: 'honeycomb', group: 'exciting' },
  { id: 'glitter', type: 'glitter', params: { dir: 'l' }, group: 'exciting' },
  { id: 'dissolve', type: 'dissolve', group: 'exciting' },
  { id: 'checker', type: 'checker', group: 'exciting' },
  { id: 'blinds', type: 'blinds', group: 'exciting' },
  { id: 'shred', type: 'shred', group: 'exciting' },
];

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
  const items: GalleryItem[] = TRANSITIONS.map((x) => ({ id: x.id, label: S.transitions.names[x.id as keyof typeof S.transitions.names] ?? x.id, render: () => <TransitionTile type={x.type} params={x.params} label={S.transitions.names[x.id as keyof typeof S.transitions.names] ?? x.id} /> }));
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

/** Effets d'animation de la galerie (classe, presetId, sous-type). */
export const EFFECTS: ReadonlyArray<{ id: string; cls: AnimationClass; preset: number; subtype?: number; icon: IconName; path?: string }> = [
  { id: 'entr:1', cls: 'entr', preset: 1, icon: 'star' },
  { id: 'entr:10', cls: 'entr', preset: 10, icon: 'star' },
  { id: 'entr:2', cls: 'entr', preset: 2, subtype: 4, icon: 'star' },
  { id: 'entr:42', cls: 'entr', preset: 42, icon: 'star' },
  { id: 'entr:16', cls: 'entr', preset: 16, subtype: 21, icon: 'star' },
  { id: 'entr:22', cls: 'entr', preset: 22, subtype: 4, icon: 'star' },
  { id: 'entr:6', cls: 'entr', preset: 6, subtype: 16, icon: 'star' },
  { id: 'entr:21', cls: 'entr', preset: 21, subtype: 1, icon: 'star' },
  { id: 'entr:14', cls: 'entr', preset: 14, subtype: 10, icon: 'star' },
  { id: 'entr:31', cls: 'entr', preset: 31, icon: 'star' },
  { id: 'entr:53', cls: 'entr', preset: 53, subtype: 16, icon: 'star' },
  { id: 'entr:26', cls: 'entr', preset: 26, icon: 'star' },
  { id: 'emph:26', cls: 'emph', preset: 26, icon: 'sparkle' },
  { id: 'emph:32', cls: 'emph', preset: 32, icon: 'sparkle' },
  { id: 'emph:8', cls: 'emph', preset: 8, icon: 'sparkle' },
  { id: 'emph:6', cls: 'emph', preset: 6, icon: 'sparkle' },
  { id: 'emph:9', cls: 'emph', preset: 9, icon: 'sparkle' },
  { id: 'exit:1', cls: 'exit', preset: 1, icon: 'dismiss' },
  { id: 'exit:10', cls: 'exit', preset: 10, icon: 'dismiss' },
  { id: 'exit:2', cls: 'exit', preset: 2, subtype: 4, icon: 'dismiss' },
  { id: 'exit:42', cls: 'exit', preset: 42, icon: 'dismiss' },
  { id: 'exit:16', cls: 'exit', preset: 16, subtype: 21, icon: 'dismiss' },
  { id: 'exit:22', cls: 'exit', preset: 22, subtype: 4, icon: 'dismiss' },
  { id: 'exit:53', cls: 'exit', preset: 53, subtype: 16, icon: 'dismiss' },
  { id: 'path:line', cls: 'path', preset: 0, icon: 'arrow_down', path: 'M 0 0 L 0 0.25 E' },
  { id: 'path:right', cls: 'path', preset: 0, icon: 'arrow_right', path: 'M 0 0 L 0.25 0 E' },
  { id: 'path:arc', cls: 'path', preset: 0, icon: 'arrow_clockwise', path: 'M 0 0 C 0.07 0 0.13 0.06 0.13 0.13 C 0.13 0.2 0.07 0.25 0 0.25 E' },
  { id: 'path:loop', cls: 'path', preset: 0, icon: 'arrow_sync', path: 'M 0 0 C 0.1 -0.1 0.2 0 0.1 0.1 C 0 0.2 -0.1 0.1 0 0 Z' },
];

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
  const name = (id: string): string => S.animations.names[id as keyof typeof S.animations.names] ?? id;
  const items: GalleryItem[] = [
    { id: 'none', label: S.animations.none, render: () => <span className="pp-anim"><Icon name="dismiss" size={20} /><span>{S.animations.none}</span></span> },
    ...EFFECTS.map((e) => ({ id: e.id, label: name(e.id), render: () => <span className="pp-anim"><Icon name={e.icon} size={20} filled style={{ color: COLOR[e.cls] }} /><span>{name(e.id)}</span></span> })),
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
          { kind: 'menu', id: 'options', label: S.transitions.options, icon: 'options', size: 'large', disabled: !subtypeItems.length, items: subtypeItems },
        ],
      },
      {
        id: 'advanced', label: S.animations.advanced, icon: 'sparkle',
        controls: [
          { kind: 'menu', id: 'add', label: S.animations.add, icon: 'add', size: 'large', disabled: !hasSel, items: EFFECTS.map((e) => ({ id: e.id, label: name(e.id), onClick: () => apply(e.id, true) })) },
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
