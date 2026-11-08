// Boîte « Options d'effet » de l'animation : direction, démarrage, déclencheur, délai, durée, répétition, retour arrière.
import { useState } from 'react';
import { Checkbox, Dialog, NumberField } from '@forgeoffice/ui';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';
import type { Editor } from './editor.ts';
import { DIRECTIONS, DIRECTION_EFFECTS, REPEAT_CHOICES, applyEffectPatch, effectForm, effectPatch, isByParagraph, mergeParagraphs, splitByParagraph, type EffectForm, type RepeatChoice } from './effect-model.ts';
import { editAnimations, selectedAnimations } from './ribbon/motion.tsx';

const TRIGGERS = ['onClick', 'withPrevious', 'afterPrevious'] as const;

export function EffectOptionsDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const first = selectedAnimations(ed)[0];
  const [initial] = useState<EffectForm | null>(() => (first ? effectForm(first) : null));
  const [form, setForm] = useState<EffectForm | null>(initial);
  const shape = ed.selectedShapes[0];
  const paragraphCount = shape?.kind === 'shape' ? (shape.text?.paragraphs.length ?? 0) : 0;
  const [byPara, setByPara] = useState(() => !!first && isByParagraph(ed.slide?.animations ?? [], first.shapeId));
  if (!first || !initial || !form) return null;
  const patch = <K extends keyof EffectForm>(key: K, value: EffectForm[K]): void => setForm((f) => (f ? { ...f, [key]: value } : f));
  const ok = (): void => {
    const changes = effectPatch(form, initial);
    const wasByPara = isByParagraph(ed.slide?.animations ?? [], first.shapeId);
    if (Object.keys(changes).length || byPara !== wasByPara) {
      editAnimations(ed, (list, targets) => {
        let out = list.map((a) => (targets.has(a.shapeId) ? applyEffectPatch(a, changes) : a));
        if (byPara && !wasByPara) out = splitByParagraph(out, first.shapeId, paragraphCount);
        else if (!byPara && wasByPara) out = mergeParagraphs(out, first.shapeId);
        return out;
      }, 'effect-dialog');
    }
    onClose();
  };
  const E = S3.effect;
  const hasDirection = first.class !== 'path' && DIRECTION_EFFECTS.has(first.presetId);
  return (
    <Dialog open title={E.title} onClose={onClose} onConfirm={ok} width={460} actions={[{ label: S.common.ok, primary: true, onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <div className="pp-stack" data-testid="effect-dialog">
        {hasDirection && (
          <fieldset className="pp-group">
            <legend>{E.effect}</legend>
            <div className="pp-form">
              <label htmlFor="pp-eff-dir">{E.direction}</label>
              <select id="pp-eff-dir" value={form.direction ?? 4} onChange={(e) => patch('direction', Number(e.target.value))}>
                {DIRECTIONS.map(([key, sub]) => <option key={key} value={sub}>{S.transitions.directions[key]}</option>)}
              </select>
            </div>
          </fieldset>
        )}
        {paragraphCount > 1 && (
          <fieldset className="pp-group">
            <legend>{E.textAnimation}</legend>
            <Checkbox checked={byPara} label={E.byParagraph} onChange={setByPara} />
          </fieldset>
        )}
        <fieldset className="pp-group">
          <legend>{E.timing}</legend>
          <div className="pp-form">
            <label htmlFor="pp-eff-start">{S.animations.start}</label>
            <select id="pp-eff-start" value={form.trigger} onChange={(e) => patch('trigger', e.target.value as EffectForm['trigger'])}>
              {TRIGGERS.map((t) => <option key={t} value={t}>{S.animations[t]}</option>)}
            </select>
            <label>{S.animations.delay}</label>
            <NumberField value={form.delay} min={0} max={59} step={0.25} unit="s" width={100} onChange={(v) => patch('delay', v)} label={S.animations.delay} />
            <label>{S.animations.duration}</label>
            <NumberField value={form.duration} min={0} max={59} step={0.25} unit="s" width={100} onChange={(v) => patch('duration', v)} label={S.animations.duration} />
            <label htmlFor="pp-eff-repeat">{E.repeat}</label>
            <select id="pp-eff-repeat" value={form.repeat} onChange={(e) => patch('repeat', e.target.value as RepeatChoice)}>
              {REPEAT_CHOICES.map((r) => <option key={r} value={r}>{E.repeatNames[r]}</option>)}
            </select>
            <label htmlFor="pp-eff-trigger">{E.triggerShape}</label>
            <select id="pp-eff-trigger" value={form.triggerShapeId} onChange={(e) => patch('triggerShapeId', Number(e.target.value))}>
              <option value={0}>{S.animations.triggerSequence}</option>
              {(ed.slide?.shapes ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <Checkbox checked={form.autoReverse} label={E.rewind} onChange={(c) => patch('autoReverse', c)} />
        </fieldset>
      </div>
    </Dialog>
  );
}
