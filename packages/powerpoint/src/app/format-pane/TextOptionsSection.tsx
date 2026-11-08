// Section « Options de texte » du volet Format : remplissage, contour et effets (ombre, lueur) du texte sélectionné.
import { Checkbox, NumberField } from '@forgeoffice/ui';
import type { Color } from '@forgeoffice/pptx';
import type { Editor } from '../editor.ts';
import { applyRun, currentRun } from '../format.ts';
import { S3 } from '../strings-text.ts';
import { ColorField, Section } from './PaneSection.tsx';
import { defaultShadow, toggleEffect } from './format-model.ts';

const T = S3.format.text;
const TEXT_COLOR: Color = { type: 'scheme', value: 'tx1' };
const ACCENT: Color = { type: 'scheme', value: 'accent1' };

export function TextOptionsSection({ ed }: { ed: Editor }) {
  const run = currentRun(ed);
  const fillKind = run.textFill?.type === 'none' ? 'none' : run.textFill?.type === 'solid' ? 'solid' : 'auto';
  const fillColor: Color = run.textFill?.type === 'solid' ? run.textFill.color : (run.color ?? TEXT_COLOR);
  const outline = run.outline?.fill?.type === 'solid' ? run.outline : undefined;
  const effects = run.effects;
  return (
    <Section title={T.title} open={false} testId="text-options-section">
      <div className="pp-pane__radios">
        <label><input type="radio" name="pp-text-fill" checked={fillKind === 'auto'} onChange={() => applyRun(ed, { textFill: null })} /> {T.fillAuto}</label>
        <label><input type="radio" name="pp-text-fill" checked={fillKind === 'solid'} onChange={() => applyRun(ed, { textFill: { type: 'solid', color: fillColor } })} /> {T.fillSolid}</label>
        <label><input type="radio" name="pp-text-fill" checked={fillKind === 'none'} onChange={() => applyRun(ed, { textFill: { type: 'none' } })} /> {T.fillNone}</label>
      </div>
      {run.textFill?.type === 'solid' && <ColorField ed={ed} label={T.fillColor} value={run.textFill.color} onChange={(c) => applyRun(ed, { textFill: { type: 'solid', color: c } })} />}
      <Checkbox checked={!!outline} label={T.outline} onChange={(on) => applyRun(ed, { outline: on ? { width: 1, fill: { type: 'solid', color: ACCENT } } : null })} />
      {outline?.fill?.type === 'solid' && (
        <>
          <ColorField ed={ed} label={T.outlineColor} value={outline.fill.color} transparency={false} onChange={(c) => applyRun(ed, { outline: { ...outline, fill: { type: 'solid', color: c } } })} />
          <div className="pp-form">
            <label>{T.outlineWidth}</label>
            <NumberField value={outline.width ?? 1} min={0.25} max={20} step={0.25} unit="pt" width={100} onChange={(w) => applyRun(ed, { outline: { ...outline, width: w } })} label={T.outlineWidth} />
          </div>
        </>
      )}
      <Checkbox checked={!!effects?.outerShadow} label={T.shadow} onChange={(on) => applyRun(ed, { effects: toggleEffect(effects, 'outerShadow', on, ACCENT) })} />
      {effects?.outerShadow && (
        <div className="pp-form">
          <label>{T.shadowBlur}</label>
          <NumberField value={effects.outerShadow.blur} min={0} max={50} step={1} unit="pt" width={100} onChange={(v) => applyRun(ed, { effects: { ...effects, outerShadow: { ...(effects.outerShadow ?? defaultShadow()), blur: v } } })} label={T.shadowBlur} />
        </div>
      )}
      <Checkbox checked={!!effects?.glow} label={T.glow} onChange={(on) => applyRun(ed, { effects: toggleEffect(effects, 'glow', on, ACCENT) })} />
    </Section>
  );
}
