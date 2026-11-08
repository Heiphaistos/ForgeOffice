// Section « Effets » du volet Format : ombre, réflexion, lueur, bords adoucis, avec leurs paramètres.
import { Checkbox, NumberField } from '@forgeoffice/ui';
import type { Color, Effects, Shadow } from '@forgeoffice/pptx';
import type { Editor } from '../editor.ts';
import { S } from '../../strings.ts';
import { S3 } from '../strings-text.ts';
import { ColorField, Section } from './PaneSection.tsx';
import { toggleEffect, type EffectName } from './format-model.ts';

const E = S3.format.effects;
const ACCENT: Color = { type: 'scheme', value: 'accent1' };

function Num({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <>
      <label>{label}</label>
      <NumberField value={value} min={min} max={max} step={step} unit={unit} width={100} onChange={onChange} label={label} />
    </>
  );
}

export function EffectsSection({ ed, effects }: { ed: Editor; effects: Effects | undefined }) {
  /** Remplace les effets des formes selectionnees (la forme brute garde ses autres proprietes). */
  const apply = (fn: (current: Effects | undefined) => Effects): void =>
    ed.editSelected((s) => {
      if (s.kind === 'shape' || s.kind === 'picture' || s.kind === 'connector' || s.kind === 'group') (s as { effects?: Effects }).effects = fn((s as { effects?: Effects }).effects);
    }, 'effects-pane');
  const toggle = (name: EffectName, on: boolean): void => apply((cur) => toggleEffect(cur, name, on, ACCENT));
  const shadow = effects?.outerShadow;
  const setShadow = (p: Partial<Shadow>): void => apply((cur) => (cur?.outerShadow ? { ...cur, outerShadow: { ...cur.outerShadow, ...p } } : (cur ?? {})));
  const glow = effects?.glow;
  const refl = effects?.reflection;
  return (
    <Section title={S.drawing.effects} testId="effects-section">
      <Checkbox checked={!!shadow} label={E.shadow} onChange={(on) => toggle('outerShadow', on)} />
      {shadow && (
        <>
          <ColorField ed={ed} label={E.shadowColor} value={shadow.color} onChange={(c) => setShadow({ color: c })} />
          <div className="pp-form">
          <Num label={E.blur} value={shadow.blur} min={0} max={100} step={1} unit="pt" onChange={(v) => setShadow({ blur: v })} />
          <Num label={E.distance} value={shadow.distance} min={0} max={200} step={1} unit="pt" onChange={(v) => setShadow({ distance: v })} />
          <Num label={E.angle} value={shadow.direction} min={0} max={359} step={15} unit="°" onChange={(v) => setShadow({ direction: v })} />
          </div>
        </>
      )}
      <Checkbox checked={!!glow} label={E.glow} onChange={(on) => toggle('glow', on)} />
      {glow && (
        <>
          <ColorField ed={ed} label={E.glowColor} value={glow.color} onChange={(c) => apply((cur) => ({ ...cur, glow: { ...(cur?.glow ?? glow), color: c } }))} />
          <div className="pp-form">
          <Num label={E.glowSize} value={glow.radius} min={0} max={150} step={1} unit="pt" onChange={(v) => apply((cur) => ({ ...cur, glow: { ...(cur?.glow ?? glow), radius: v } }))} />
          </div>
        </>
      )}
      <Checkbox checked={!!refl} label={E.reflection} onChange={(on) => toggle('reflection', on)} />
      {refl && (
        <div className="pp-form">
          <Num label={E.reflectTransparency} value={100 - refl.startAlpha} min={0} max={100} step={5} unit="%" onChange={(v) => apply((cur) => ({ ...cur, reflection: { ...(cur?.reflection ?? refl), startAlpha: 100 - v } }))} />
          <Num label={E.reflectSize} value={refl.endPosition} min={0} max={100} step={5} unit="%" onChange={(v) => apply((cur) => ({ ...cur, reflection: { ...(cur?.reflection ?? refl), endPosition: v } }))} />
          <Num label={E.distance} value={refl.distance} min={0} max={100} step={1} unit="pt" onChange={(v) => apply((cur) => ({ ...cur, reflection: { ...(cur?.reflection ?? refl), distance: v } }))} />
        </div>
      )}
      <Checkbox checked={effects?.softEdge !== undefined} label={E.softEdge} onChange={(on) => toggle('softEdge', on)} />
      {effects?.softEdge !== undefined && (
        <div className="pp-form">
          <Num label={E.softSize} value={effects.softEdge} min={0} max={100} step={1} unit="pt" onChange={(v) => apply((cur) => ({ ...cur, softEdge: v }))} />
        </div>
      )}
    </Section>
  );
}
