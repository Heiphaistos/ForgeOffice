// Transitions (p:transition) et animations (p:timing) : lecture vers le modele et generation du XML PowerPoint.
import { attr, child, children, descendants, el, numAttr, type XmlElement } from '@forgeoffice/opc';
import type { Animation, AnimationClass, AnimationTrigger, Transition } from './model.ts';

// ---- Transitions ----

const P14_TRANSITIONS = new Set([
  'vortex', 'switch', 'flip', 'ripple', 'honeycomb', 'prism', 'doors', 'window', 'ferris', 'gallery', 'conveyor',
  'pan', 'glitter', 'warp', 'flythrough', 'flash', 'shred', 'reveal', 'wheelReverse',
]);

function transitionPrefix(type: string): string {
  if (type === 'morph') return 'p159';
  if (type === 'prstTrans') return 'p15';
  return P14_TRANSITIONS.has(type) ? 'p14' : 'p';
}

/** Choisit p:transition dans un mc:AlternateContent (Choice si possible) ou directement. */
export function pickTransition(node: XmlElement | undefined): XmlElement | undefined {
  if (!node) return undefined;
  if (node.name === 'p:transition') return node;
  if (node.name === 'mc:AlternateContent') {
    for (const choice of children(node, 'mc:Choice')) {
      const found = child(choice, 'p:transition');
      if (found) return found;
    }
    return child(child(node, 'mc:Fallback'), 'p:transition');
  }
  return undefined;
}

export function readTransition(node: XmlElement, soundMedia: (relId: string) => string | undefined): Transition {
  const effect = children(node).find((n) => n.name !== 'p:sndAc' && n.name !== 'p:extLst');
  const transition: Transition = { type: effect ? effect.name.slice(effect.name.indexOf(':') + 1) : 'cut' };
  if (!effect) transition.type = 'none';
  if (effect && Object.keys(effect.attrs).length) transition.params = { ...effect.attrs };
  const dur = numAttr(node, 'p14:dur') ?? numAttr(node, 'dur');
  if (dur !== undefined) transition.duration = dur;
  const speed = attr(node, 'spd');
  if (speed) transition.speed = speed as Transition['speed'];
  transition.advanceOnClick = attr(node, 'advClick') !== '0' && attr(node, 'advClick') !== 'false';
  const advTm = numAttr(node, 'advTm');
  if (advTm !== undefined) transition.advanceAfter = advTm;
  const sndAc = child(node, 'p:sndAc');
  const stSnd = child(sndAc, 'p:stSnd');
  const snd = child(stSnd, 'p:snd');
  const relId = attr(snd, 'r:embed');
  const mediaId = relId ? soundMedia(relId) : undefined;
  if (mediaId) transition.sound = { name: attr(snd, 'name') ?? '', mediaId, loop: attr(stSnd, 'loop') === '1' || attr(stSnd, 'loop') === 'true' };
  if (child(sndAc, 'p:endSnd')) transition.stopSound = true;
  return transition;
}

function speedFor(duration: number | undefined): Transition['speed'] {
  if (duration === undefined) return undefined;
  return duration <= 500 ? 'fast' : duration <= 750 ? 'med' : 'slow';
}

function transitionNode(t: Transition, extended: boolean, soundRel: (mediaId: string) => string): XmlElement {
  const kids: XmlElement[] = [];
  if (t.type !== 'none') {
    const prefix = transitionPrefix(t.type);
    kids.push(extended || prefix === 'p' ? el(`${prefix}:${t.type}`, { ...(t.params ?? {}) }) : el('p:fade'));
  }
  if (t.sound || t.stopSound) {
    const sound = t.sound ? el('p:stSnd', { loop: t.sound.loop ? '1' : undefined }, [el('p:snd', { 'r:embed': soundRel(t.sound.mediaId), name: t.sound.name })]) : el('p:endSnd');
    kids.push(el('p:sndAc', {}, [sound]));
  }
  return el(
    'p:transition',
    {
      spd: t.speed ?? speedFor(t.duration),
      'p14:dur': extended && t.duration !== undefined ? Math.round(t.duration) : undefined,
      advClick: t.advanceOnClick === false ? '0' : undefined,
      advTm: t.advanceAfter === undefined ? undefined : Math.round(t.advanceAfter),
    },
    kids,
  );
}

/** p:transition, enveloppe dans mc:AlternateContent quand l'effet ou la duree demandent une extension Office 2010+. */
export function writeTransition(t: Transition, soundRel: (mediaId: string) => string): XmlElement {
  const prefix = t.type === 'none' ? 'p' : transitionPrefix(t.type);
  if (prefix === 'p' && t.duration === undefined) return transitionNode(t, false, soundRel);
  const requires = prefix === 'p' ? 'p14' : prefix;
  const choiceAttrs: Record<string, string> = { Requires: requires, 'xmlns:p14': 'http://schemas.microsoft.com/office/powerpoint/2010/main' };
  if (prefix === 'p15') choiceAttrs['xmlns:p15'] = 'http://schemas.microsoft.com/office/powerpoint/2012/main';
  if (prefix === 'p159') choiceAttrs['xmlns:p159'] = 'http://schemas.microsoft.com/office/powerpoint/2015/09/main';
  return el('mc:AlternateContent', { 'xmlns:mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006' }, [
    el('mc:Choice', choiceAttrs, [transitionNode(t, true, soundRel)]),
    el('mc:Fallback', {}, [transitionNode(t, false, soundRel)]),
  ]);
}

// ---- Animations : lecture ----

const TRIGGERS: Readonly<Record<string, AnimationTrigger>> = { clickEffect: 'onClick', withEffect: 'withPrevious', afterEffect: 'afterPrevious' };

function condDelay(cTn: XmlElement | undefined): number {
  const raw = attr(child(child(cTn, 'p:stCondLst'), 'p:cond'), 'delay');
  const n = Number(raw);
  return raw === undefined || !Number.isFinite(n) ? 0 : n;
}

function readEffect(par: XmlElement, triggerShapeId: number | undefined): Animation | undefined {
  const cTn = child(par, 'p:cTn');
  const cls = attr(cTn, 'presetClass') as AnimationClass | undefined;
  if (!cTn || !cls) return undefined;
  const spTgt = [...descendants(cTn, 'p:spTgt')][0];
  const shapeId = numAttr(spTgt, 'spid');
  if (shapeId === undefined) return undefined;
  let duration = 0;
  for (const node of descendants(cTn, 'p:cTn')) {
    const dur = numAttr(node, 'dur');
    const start = condDelay(node);
    if (dur !== undefined) duration = Math.max(duration, dur + start);
  }
  const animation: Animation = {
    shapeId,
    class: cls,
    presetId: numAttr(cTn, 'presetID') ?? 0,
    trigger: TRIGGERS[attr(cTn, 'nodeType') ?? ''] ?? 'withPrevious',
    delay: condDelay(cTn),
    duration: duration <= 1 ? 0 : duration,
  };
  const subtype = numAttr(cTn, 'presetSubtype');
  if (subtype) animation.presetSubtype = subtype;
  const motion = [...descendants(cTn, 'p:animMotion')][0];
  const path = attr(motion, 'path');
  if (path) animation.path = path;
  const repeat = attr(cTn, 'repeatCount');
  if (repeat === 'indefinite') animation.repeat = 'indefinite';
  else if (repeat !== undefined && Number(repeat) !== 1000) animation.repeat = Number(repeat) / 1000;
  if (attr(cTn, 'autoRev') === '1' || attr(cTn, 'autoRev') === 'true') animation.autoReverse = true;
  const range = [...descendants(cTn, 'p:pRg')][0];
  if (range) animation.paragraphs = { start: numAttr(range, 'st') ?? 0, end: numAttr(range, 'end') ?? 0 };
  if (triggerShapeId !== undefined) animation.triggerShapeId = triggerShapeId;
  return animation;
}

function readSequence(seqCTn: XmlElement, triggerShapeId: number | undefined, out: Animation[]): void {
  for (const clickPar of children(child(seqCTn, 'p:childTnLst'), 'p:par')) {
    for (const groupPar of children(child(child(clickPar, 'p:cTn'), 'p:childTnLst'), 'p:par')) {
      for (const effectPar of children(child(child(groupPar, 'p:cTn'), 'p:childTnLst'), 'p:par')) {
        const effect = readEffect(effectPar, triggerShapeId);
        if (effect) out.push(effect);
      }
    }
  }
}

/** Effets d'animation de p:timing (sequence principale puis declencheurs interactifs). */
export function readAnimations(timing: XmlElement): Animation[] {
  const out: Animation[] = [];
  for (const seq of descendants(timing, 'p:seq')) {
    const cTn = child(seq, 'p:cTn');
    const nodeType = attr(cTn, 'nodeType');
    if (!cTn) continue;
    if (nodeType === 'mainSeq') readSequence(cTn, undefined, out);
    else if (nodeType === 'interactiveSeq') {
      const trigger = numAttr([...descendants(child(cTn, 'p:stCondLst') ?? cTn, 'p:spTgt')][0], 'spid');
      readSequence(cTn, trigger, out);
    }
  }
  return out;
}

// ---- Animations : ecriture ----

/** Filtres d'animEffect par effet predefini (entree et sortie). */
const FILTERS: Readonly<Record<number, string>> = {
  3: 'blinds(horizontal)',
  4: 'box(in)',
  5: 'checkerboard(across)',
  6: 'circle(in)',
  8: 'diamond(in)',
  9: 'dissolve',
  10: 'fade',
  13: 'plus(in)',
  14: 'randombar(horizontal)',
  16: 'barn(inVertical)',
  18: 'strips(downLeft)',
  20: 'wedge',
  21: 'wheel(1)',
  22: 'wipe(up)',
};

const WIPE_DIRECTIONS: Readonly<Record<number, string>> = { 1: 'wipe(down)', 2: 'wipe(left)', 4: 'wipe(up)', 8: 'wipe(right)' };

class TimingBuilder {
  private id = 3;

  next(): number {
    return this.id++;
  }

  target(a: Animation): XmlElement {
    const kids = a.paragraphs ? [el('p:txEl', {}, [el('p:pRg', { st: a.paragraphs.start, end: a.paragraphs.end })])] : [];
    return el('p:tgtEl', {}, [el('p:spTgt', { spid: a.shapeId }, kids)]);
  }

  behavior(a: Animation, dur: number, attrs: string[] = [], extra: Record<string, string | number | undefined> = {}, delay?: number): XmlElement {
    const cTnKids = delay === undefined ? [] : [el('p:stCondLst', {}, [el('p:cond', { delay })])];
    const kids = [el('p:cTn', { id: this.next(), dur, fill: 'hold', ...extra }, cTnKids), this.target(a)];
    if (attrs.length) kids.push(el('p:attrNameLst', {}, attrs.map((name) => el('p:attrName', {}, [name]))));
    return el('p:cBhvr', {}, kids);
  }

  visibility(a: Animation, value: 'visible' | 'hidden', delay: number): XmlElement {
    return el('p:set', {}, [this.behavior(a, 1, ['style.visibility'], {}, delay), el('p:to', {}, [el('p:strVal', { val: value })])]);
  }

  effect(a: Animation, transition: 'in' | 'out', filter: string): XmlElement {
    return el('p:animEffect', { transition, filter }, [this.behavior(a, a.duration)]);
  }

  property(a: Animation, name: string, from: string, to: string): XmlElement {
    return el('p:anim', { calcmode: 'lin', valueType: 'num' }, [
      this.behavior(a, a.duration, [name], {}, undefined),
      el('p:tavLst', {}, [el('p:tav', { tm: 0 }, [el('p:val', {}, [el('p:strVal', { val: from })])]), el('p:tav', { tm: 100000 }, [el('p:val', {}, [el('p:strVal', { val: to })])])]),
    ]);
  }

  /** Comportements d'un effet selon sa classe et son effet predefini. */
  behaviors(a: Animation): XmlElement[] {
    const dur = Math.max(1, a.duration);
    switch (a.class) {
      case 'entr': {
        const show = this.visibility(a, 'visible', 0);
        if (a.presetId === 1) return [show];
        if (a.presetId === 2) {
          const dir = a.presetSubtype ?? 4;
          const x = dir === 8 ? ['0-#ppt_w/2', '#ppt_x'] : dir === 2 ? ['1+#ppt_w/2', '#ppt_x'] : ['#ppt_x', '#ppt_x'];
          const y = dir === 1 ? ['0-#ppt_h/2', '#ppt_y'] : dir === 4 ? ['1+#ppt_h/2', '#ppt_y'] : ['#ppt_y', '#ppt_y'];
          return [show, this.property(a, 'ppt_x', x[0] as string, x[1] as string), this.property(a, 'ppt_y', y[0] as string, y[1] as string)];
        }
        if (a.presetId === 53 || a.presetId === 23) return [show, this.property(a, 'ppt_w', '0', '#ppt_w'), this.property(a, 'ppt_h', '0', '#ppt_h'), this.effect(a, 'in', 'fade')];
        if (a.presetId === 42) return [show, this.effect(a, 'in', 'fade'), this.property(a, 'ppt_y', '#ppt_y+.1', '#ppt_y')];
        const filter = a.presetId === 22 ? WIPE_DIRECTIONS[a.presetSubtype ?? 4] ?? 'wipe(up)' : FILTERS[a.presetId] ?? 'fade';
        return [show, this.effect(a, 'in', filter)];
      }
      case 'exit': {
        const hide = this.visibility(a, 'hidden', Math.max(0, dur - 1));
        if (a.presetId === 1) return [this.visibility(a, 'hidden', 0)];
        if (a.presetId === 2) return [this.property(a, 'ppt_y', '#ppt_y', '1+#ppt_h/2'), hide];
        if (a.presetId === 53 || a.presetId === 23) return [this.property(a, 'ppt_w', '#ppt_w', '0'), this.property(a, 'ppt_h', '#ppt_h', '0'), this.effect(a, 'out', 'fade'), hide];
        const filter = a.presetId === 22 ? WIPE_DIRECTIONS[a.presetSubtype ?? 4] ?? 'wipe(down)' : FILTERS[a.presetId] ?? 'fade';
        return [this.effect(a, 'out', filter), hide];
      }
      case 'emph': {
        if (a.presetId === 8) return [el('p:animRot', { by: 21600000 }, [this.behavior(a, dur, ['r'])])];
        if (a.presetId === 6) return [el('p:animScale', {}, [this.behavior(a, dur), el('p:by', { x: 150000, y: 150000 })])];
        if (a.presetId === 9) return [el('p:set', {}, [this.behavior(a, dur, ['style.opacity']), el('p:to', {}, [el('p:strVal', { val: '0.5' })])])];
        return [el('p:animScale', {}, [this.behavior(a, Math.max(1, Math.round(dur / 2)), [], { autoRev: '1' }), el('p:by', { x: 105000, y: 105000 })])];
      }
      case 'path':
        return [el('p:animMotion', { origin: 'layout', path: a.path ?? 'M 0 0 L 0 0.1 E', pathEditMode: 'relative', ptsTypes: '' }, [this.behavior(a, dur, ['ppt_x', 'ppt_y'])])];
      case 'mediacall':
      case 'verb':
        return [el('p:cmd', { type: 'call', cmd: 'playFrom(0.0)' }, [this.behavior(a, dur)])];
    }
  }

  effectPar(a: Animation, nodeType: string): XmlElement {
    const id = this.next();
    const repeat = a.repeat === undefined ? undefined : a.repeat === 'indefinite' ? 'indefinite' : Math.round(a.repeat * 1000);
    return el('p:par', {}, [
      el(
        'p:cTn',
        {
          id,
          presetID: a.presetId,
          presetClass: a.class,
          presetSubtype: a.presetSubtype ?? 0,
          repeatCount: repeat,
          autoRev: a.autoReverse ? '1' : undefined,
          fill: 'hold',
          grpId: 0,
          nodeType,
        },
        [el('p:stCondLst', {}, [el('p:cond', { delay: Math.round(a.delay) })]), el('p:childTnLst', {}, this.behaviors(a))],
      ),
    ]);
  }

  /** Groupes de clic d'une sequence. `autoStartFirst` = la premiere etape demarre seule. */
  sequence(effects: Animation[], mainSeqId: number | undefined): XmlElement[] {
    const clicks: XmlElement[] = [];
    const autoStart = effects[0] !== undefined && effects[0].trigger !== 'onClick';
    let groups: Array<{ offset: number; end: number; pars: XmlElement[] }> = [];
    const flush = (): void => {
      if (!groups.length) return;
      const first = clicks.length === 0;
      const conds = [el('p:cond', { delay: 'indefinite' })];
      if (first && autoStart && mainSeqId !== undefined) conds.push(el('p:cond', { evt: 'onBegin', delay: 0 }, [el('p:tn', { val: mainSeqId })]));
      const clickId = this.next();
      const groupNodes = groups.map((g) =>
        el('p:par', {}, [el('p:cTn', { id: this.next(), fill: 'hold' }, [el('p:stCondLst', {}, [el('p:cond', { delay: Math.round(g.offset) })]), el('p:childTnLst', {}, g.pars)])]),
      );
      clicks.push(
        el('p:par', {}, [
          el('p:cTn', { id: clickId, fill: 'hold' }, [
            el('p:stCondLst', {}, mainSeqId === undefined && first ? [el('p:cond', { delay: 0 })] : conds),
            el('p:childTnLst', {}, groupNodes),
          ]),
        ]),
      );
      groups = [];
    };
    for (const effect of effects) {
      const nodeType = effect.trigger === 'onClick' ? 'clickEffect' : effect.trigger === 'withPrevious' ? 'withEffect' : 'afterEffect';
      if (effect.trigger === 'onClick') flush();
      let current = groups[groups.length - 1];
      if (!current || effect.trigger === 'afterPrevious') {
        const offset = current ? current.end : 0;
        current = { offset, end: offset, pars: [] };
        groups.push(current);
      }
      current.pars.push(this.effectPar(effect, nodeType));
      current.end = Math.max(current.end, current.offset + effect.delay + effect.duration);
    }
    flush();
    return clicks;
  }
}

/** p:timing complet pour une liste d'effets. `buildShapeIds` = formes a texte (liste de generation bldP). */
export function writeTiming(animations: Animation[], buildShapeIds: ReadonlySet<number>): XmlElement | undefined {
  if (!animations.length) return undefined;
  const builder = new TimingBuilder();
  const main = animations.filter((a) => a.triggerShapeId === undefined);
  const triggers = [...new Set(animations.map((a) => a.triggerShapeId).filter((id): id is number => id !== undefined))];
  const sequences: XmlElement[] = [];
  if (main.length) {
    sequences.push(
      el('p:seq', { concurrent: '1', nextAc: 'seek' }, [
        el('p:cTn', { id: 2, dur: 'indefinite', nodeType: 'mainSeq' }, [el('p:childTnLst', {}, builder.sequence(main, 2))]),
        el('p:prevCondLst', {}, [el('p:cond', { evt: 'onPrev', delay: 0 }, [el('p:tgtEl', {}, [el('p:sldTgt')])])]),
        el('p:nextCondLst', {}, [el('p:cond', { evt: 'onNext', delay: 0 }, [el('p:tgtEl', {}, [el('p:sldTgt')])])]),
      ]),
    );
  }
  for (const trigger of triggers) {
    const effects = animations.filter((a) => a.triggerShapeId === trigger);
    const target = (): XmlElement => el('p:tgtEl', {}, [el('p:spTgt', { spid: trigger })]);
    const seqId = main.length || sequences.length ? builder.next() : 2;
    sequences.push(
      el('p:seq', { concurrent: '1', nextAc: 'seek' }, [
        el('p:cTn', { id: seqId, restart: 'whenNotActive', fill: 'hold', evtFilter: 'cancelBubble', nodeType: 'interactiveSeq' }, [
          el('p:stCondLst', {}, [el('p:cond', { evt: 'onClick', delay: 0 }, [target()])]),
          el('p:endSync', { evt: 'end', delay: 0 }, [el('p:rtn', { val: 'all' })]),
          el('p:childTnLst', {}, builder.sequence(effects, undefined)),
        ]),
        el('p:nextCondLst', {}, [el('p:cond', { evt: 'onClick', delay: 0 }, [target()])]),
      ]),
    );
  }
  const builds = [...new Set(animations.map((a) => a.shapeId))].filter((id) => buildShapeIds.has(id));
  const kids = [el('p:tnLst', {}, [el('p:par', {}, [el('p:cTn', { id: 1, dur: 'indefinite', restart: 'never', nodeType: 'tmRoot' }, [el('p:childTnLst', {}, sequences)])])])];
  if (builds.length) {
    kids.push(
      el('p:bldLst', {}, builds.map((spid) => {
        const byParagraph = animations.some((a) => a.shapeId === spid && a.paragraphs);
        return el('p:bldP', { spid, grpId: 0, build: byParagraph ? 'p' : undefined, animBg: byParagraph ? undefined : '1' });
      })),
    );
  }
  return el('p:timing', {}, kids);
}
