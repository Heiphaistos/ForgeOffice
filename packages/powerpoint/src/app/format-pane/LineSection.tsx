// Section « Trait » du volet Format : couleur et transparence, épaisseur, tirets, extrémités, jointures, trait composé, flèches.
import { NumberField } from '@forgeoffice/ui';
import type { Color, Line, LineEnd } from '@forgeoffice/pptx';
import type { Editor } from '../editor.ts';
import { setLine } from '../format.ts';
import { S } from '../../strings.ts';
import { S3 } from '../strings-text.ts';
import { ColorField, Section } from './PaneSection.tsx';
import { DASH_CHOICES, END_SIZES, END_TYPES, linePatch } from './format-model.ts';

const L = S3.format.line;
const DEFAULT_COLOR: Color = { type: 'scheme', value: 'tx1' };

function ArrowEditor({ label, end, onChange }: { label: string; end: LineEnd | undefined; onChange: (e: LineEnd) => void }) {
  const type = end?.type ?? 'none';
  return (
    <>
      <label>{label}</label>
      <select aria-label={label} value={type} onChange={(e) => onChange({ ...(end ?? {}), type: e.target.value as LineEnd['type'] })}>
        {END_TYPES.map((t) => <option key={t} value={t}>{L.endNames[t]}</option>)}
      </select>
      <label>{`${label} – ${L.endSize}`}</label>
      <select aria-label={`${label} – ${L.endSize}`} disabled={type === 'none'} value={end?.width ?? 'med'} onChange={(e) => onChange({ type, width: e.target.value as NonNullable<LineEnd['width']>, length: e.target.value as NonNullable<LineEnd['length']> })}>
        {END_SIZES.map((s) => <option key={s} value={s}>{L.sizeNames[s]}</option>)}
      </select>
    </>
  );
}

export function LineSection({ ed, line }: { ed: Editor; line: Line | undefined }) {
  const visible = !!line?.fill && line.fill.type !== 'none';
  const color: Color = line?.fill?.type === 'solid' ? line.fill.color : DEFAULT_COLOR;
  const patch = (p: Parameters<typeof linePatch>[0]): void => setLine(ed, linePatch(p));
  return (
    <Section title={S.panes.line} testId="line-section">
      <div className="pp-pane__radios">
        <label><input type="radio" name="pp-line-kind" checked={!visible} onChange={() => setLine(ed, null)} /> {L.none}</label>
        <label><input type="radio" name="pp-line-kind" checked={visible} onChange={() => setLine(ed, { fill: { type: 'solid', color } })} /> {L.solid}</label>
      </div>
      {visible && (
        <>
          <ColorField ed={ed} label={S.drawing.outline} value={color} onChange={(c) => setLine(ed, { fill: { type: 'solid', color: c } })} />
          <div className="pp-form">
            <label>{S.drawing.weight}</label>
            <NumberField value={line?.width ?? 0.75} min={0} max={1584} step={0.25} unit="pt" width={100} onChange={(w) => setLine(ed, { width: w })} label={S.drawing.weight} />
            <label>{L.dash}</label>
            <select aria-label={L.dash} value={line?.dash ?? 'solid'} onChange={(e) => patch({ dash: e.target.value })}>
              {DASH_CHOICES.map((d) => <option key={d} value={d}>{L.dashNames[d]}</option>)}
            </select>
            <label>{L.cap}</label>
            <select aria-label={L.cap} value={line?.cap ?? 'flat'} onChange={(e) => patch({ cap: e.target.value as Line['cap'] })}>
              <option value="flat">{L.capNames.flat}</option>
              <option value="rnd">{L.capNames.rnd}</option>
              <option value="sq">{L.capNames.sq}</option>
            </select>
            <label>{L.join}</label>
            <select aria-label={L.join} value={line?.join ?? 'round'} onChange={(e) => patch({ join: e.target.value as Line['join'] })}>
              <option value="round">{L.joinNames.round}</option>
              <option value="bevel">{L.joinNames.bevel}</option>
              <option value="miter">{L.joinNames.miter}</option>
            </select>
            <label>{L.compound}</label>
            <select aria-label={L.compound} value={line?.compound ?? 'sng'} onChange={(e) => patch({ compound: e.target.value as Line['compound'] })}>
              {(Object.keys(L.compoundNames) as Array<keyof typeof L.compoundNames>).map((c) => <option key={c} value={c}>{L.compoundNames[c]}</option>)}
            </select>
            <ArrowEditor label={L.head} end={line?.head} onChange={(head) => patch({ head })} />
            <ArrowEditor label={L.tail} end={line?.tail} onChange={(tail) => patch({ tail })} />
          </div>
        </>
      )}
    </Section>
  );
}
