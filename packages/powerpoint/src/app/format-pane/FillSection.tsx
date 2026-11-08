// Section « Remplissage » du volet Format : aucun, uni, dégradé (type, angle, arrêts), image ou texture, motif ; transparence.
import { Button, NumberField } from '@forgeoffice/ui';
import { addMedia, type Color, type Fill } from '@forgeoffice/pptx';
import { PATTERN_NAMES } from '../../canvas/render/paint.tsx';
import { locate } from '../../canvas/ops.ts';
import { editPage } from '../deck-ops.ts';
import type { Editor } from '../editor.ts';
import { setFill } from '../format.ts';
import { IMAGE_FILTERS, extensionOf } from '../insert.ts';
import { S } from '../../strings.ts';
import { S3 } from '../strings-text.ts';
import { ColorField, Section } from './PaneSection.tsx';
import { addStop, defaultGradient, fillKind, pattern, removeStop, updateStop, type FillKind, type GradientFill } from './format-model.ts';

const ACCENT: Color = { type: 'scheme', value: 'accent1' };
const BLACK: Color = { type: 'rgb', value: '000000' };
const WHITE: Color = { type: 'rgb', value: 'FFFFFF' };
const F = S3.format;

/** Remplit les formes selectionnees avec une image choisie dans un fichier. */
async function pickImageFill(ed: Editor, mode: 'stretch' | 'tile'): Promise<void> {
  const file = await ed.services.openFile(IMAGE_FILTERS);
  if (!file) return;
  const ext = extensionOf(file.name);
  const deck = { ...ed.deck, media: { ...ed.deck.media } };
  const mediaId = addMedia(deck, file.bytes, ext === 'jpg' ? 'jpeg' : ext);
  const ids = ed.selection.ids;
  const fill: Fill = { type: 'image', mediaId, mode, ...(mode === 'tile' ? { tile: { tx: 0, ty: 0, sx: 100, sy: 100 } } : {}) };
  const next = editPage(deck, ed.page, (shapes) => {
    for (const id of ids) {
      const found = locate(shapes, id);
      if (found?.shape.kind === 'shape' || found?.shape.kind === 'group') found.shape.fill = fill;
    }
  });
  ed.commit({ ...next, media: deck.media }, 'fill-image');
}

function GradientEditor({ ed, fill }: { ed: Editor; fill: GradientFill }) {
  const set = (next: GradientFill): void => setFill(ed, next);
  return (
    <>
      <div className="pp-form">
        <label>{F.gradientType}</label>
        <select aria-label={F.gradientType} value={fill.kind} onChange={(e) => set({ ...fill, kind: e.target.value as GradientFill['kind'] })}>
          <option value="linear">{F.gradientKinds.linear}</option>
          <option value="circle">{F.gradientKinds.circle}</option>
          <option value="rect">{F.gradientKinds.rect}</option>
        </select>
        {fill.kind === 'linear' && (
          <>
            <label>{S.dialogs.angle}</label>
            <NumberField value={fill.angle ?? 0} min={0} max={359} step={15} unit="°" width={100} onChange={(v) => set({ ...fill, angle: v })} label={S.dialogs.angle} />
          </>
        )}
      </div>
      <div data-testid="gradient-stops" className="pp-pane__stops">
        {fill.stops.map((stop, i) => (
          <div key={i} className="pp-pane__stop">
            <NumberField value={stop.position} min={0} max={100} step={5} unit="%" width={90} onChange={(v) => set(updateStop(fill, i, { position: v }))} label={`${F.stop} ${i + 1}`} />
            <ColorField ed={ed} label={`${F.stopColor} ${i + 1}`} value={stop.color} onChange={(c) => set(updateStop(fill, i, { color: c }))} />
            <Button size="small" disabled={fill.stops.length <= 2} onClick={() => set(removeStop(fill, i))}>{F.removeStop}</Button>
          </div>
        ))}
      </div>
      <Button size="small" onClick={() => set(addStop(fill))}>{F.addStop}</Button>
    </>
  );
}

export function FillSection({ ed, fill }: { ed: Editor; fill: Fill | undefined }) {
  const kind = fillKind(fill);
  const choose = (next: FillKind): void => {
    if (next === 'none') setFill(ed, { type: 'none' });
    else if (next === 'solid') setFill(ed, { type: 'solid', color: fill?.type === 'solid' ? fill.color : ACCENT });
    else if (next === 'gradient') setFill(ed, fill?.type === 'gradient' ? fill : defaultGradient(fill?.type === 'solid' ? fill.color : ACCENT));
    else if (next === 'pattern') setFill(ed, fill?.type === 'pattern' ? fill : pattern('pct50', BLACK, WHITE));
    else void pickImageFill(ed, 'stretch');
  };
  const kinds: ReadonlyArray<[FillKind, string]> = [['none', S.panes.noFill], ['solid', S.dialogs.solidFill], ['gradient', S.dialogs.gradientFill], ['image', F.imageFill], ['pattern', F.patternFill]];
  return (
    <Section title={S.drawing.fill} testId="fill-section">
      <div className="pp-pane__radios">
        {kinds.map(([id, label]) => (
          <label key={id}><input type="radio" name="pp-fill-kind" checked={kind === id} onChange={() => choose(id)} /> {label}</label>
        ))}
      </div>
      {fill?.type === 'solid' && <ColorField ed={ed} label={S.drawing.fill} value={fill.color} onChange={(color) => setFill(ed, { type: 'solid', color })} />}
      {fill?.type === 'gradient' && <GradientEditor ed={ed} fill={fill} />}
      {fill?.type === 'pattern' && (
        <>
          <div className="pp-form">
            <label>{F.pattern}</label>
            <select aria-label={F.pattern} value={fill.preset} onChange={(e) => setFill(ed, { ...fill, preset: e.target.value })}>
              {PATTERN_NAMES.map((n) => <option key={n} value={n}>{F.patternNames[n] ?? n}</option>)}
            </select>
          </div>
          <ColorField ed={ed} label={F.foreground} value={fill.foreground} transparency={false} onChange={(c) => setFill(ed, { ...fill, foreground: c })} />
          <ColorField ed={ed} label={F.background} value={fill.background} transparency={false} onChange={(c) => setFill(ed, { ...fill, background: c })} />
        </>
      )}
      {fill?.type === 'image' && (
        <div className="pp-form">
          <label>{F.imageMode}</label>
          <select aria-label={F.imageMode} value={fill.mode} onChange={(e) => setFill(ed, { ...fill, mode: e.target.value as 'stretch' | 'tile', tile: e.target.value === 'tile' ? (fill.tile ?? { tx: 0, ty: 0, sx: 100, sy: 100 }) : fill.tile })}>
            <option value="stretch">{F.imageStretch}</option>
            <option value="tile">{F.imageTile}</option>
          </select>
          <label>{F.transparency}</label>
          <NumberField value={100 - (fill.alpha ?? 100)} min={0} max={100} step={5} unit="%" width={100} onChange={(v) => setFill(ed, { ...fill, alpha: 100 - v })} label={F.transparency} />
          <Button size="small" onClick={() => void pickImageFill(ed, fill.mode)}>{F.imageChoose}</Button>
        </div>
      )}
    </Section>
  );
}
