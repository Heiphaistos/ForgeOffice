// Boite Format de la zone de texte / de l'image / de la forme, a onglets : Couleurs et traits, Taille, Disposition, Zone de texte,
// Texte de remplacement. Reutilise les modeles de la boite Taille et position ; chaque onglet n'ecrit que ce qui a change.
import { useRef, useState } from 'react';
import { Checkbox, Dialog, TextField } from '@forgeoffice/ui';
import { mmToPt, ptToMm } from '@forgeoffice/pptx';
import { locate } from '@forgeoffice/powerpoint/canvas';
import { geomForm, geomPatch, normalizeRotation, withHeight, withWidth, type GeomForm } from '../../../powerpoint/src/app/geom-dialog-model.ts';
import { S3 } from '../../../powerpoint/src/app/strings-text.ts';
import { wrapOf } from '../chain.ts';
import { alignedOnPage, DASHES, PATTERNS, fillForm, fillOf, imageEffectsOf, imageForm, lineForm, lineOf, type ImageForm, type LineForm, type PaintForm } from '../formatmodel.ts';
import { WRAP_MODES, type WrapMode } from '../model.ts';
import { S } from '../strings.ts';
import { Num } from './dialogs-text.tsx';
import type { Editor } from './editor.ts';
import { applyBody, colorFromHex, hexOf, setFill, setLine, setWrap } from './ops.ts';

type Tab = 'paint' | 'size' | 'layout' | 'text' | 'image' | 'alt';

export function FormatDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const id = ed.selection.ids[0];
  const shape = id === undefined ? undefined : locate(ed.pageShapes, id)?.shape;
  const isPicture = shape?.kind === 'picture';
  const isShape = shape?.kind === 'shape';
  const isText = shape?.kind === 'shape' && !!shape.text;
  const xfrm = shape && 'xfrm' in shape ? shape.xfrm : undefined;
  const hex = (c: Parameters<typeof hexOf>[1]): string => hexOf(ed, c);
  const toColor = (h: string) => colorFromHex(ed, h);

  const tabs: Tab[] = [...(isShape || isPicture ? ['paint' as const] : []), 'size', 'layout', ...(isText ? ['text' as const] : []), ...(isPicture ? ['image' as const] : []), 'alt'];
  const [tab, setTab] = useState<Tab>(tabs[0] ?? 'size');
  const [iPaint] = useState<PaintForm>(() => fillForm(shape?.kind === 'shape' ? shape.fill : undefined, hex, '#4472C4'));
  const [paint, setPaint] = useState(iPaint);
  const [iLine] = useState<LineForm>(() => lineForm(shape && 'line' in shape ? shape.line : undefined, hex, '#333333'));
  const [line, setLineForm] = useState(iLine);
  const [iGeom] = useState<GeomForm>(() => geomForm(xfrm ?? { x: 0, y: 0, width: 1, height: 1 }, true));
  const [geom, setGeom] = useState(iGeom);
  const latest = useRef(geom);
  const updateGeom = (next: GeomForm): void => { latest.current = next; setGeom(next); };
  const iWrap: WrapMode = shape && ed.ref.kind === 'page' ? wrapOf(ed.pub, ed.ref.id, shape) : 'none';
  const [wrap, setWrapMode] = useState<WrapMode>(iWrap);
  const body = shape?.kind === 'shape' ? shape.text?.props ?? {} : {};
  const ins = { left: 7.2, top: 3.6, right: 7.2, bottom: 3.6, ...(body.insets ?? {}) };
  const [insets, setInsets] = useState(ins);
  const [anchor, setAnchor] = useState(body.anchor ?? 't');
  const pageCm = { width: ptToMm(ed.deck.size.width) / 10, height: ptToMm(ed.deck.size.height) / 10 };
  const picture = shape?.kind === 'picture' ? shape : undefined;
  const [iImage] = useState<ImageForm>(() => imageForm(picture?.imageEffects));
  const [image, setImage] = useState(iImage);
  const [alt, setAlt] = useState(shape?.description ?? '');

  const ok = (): void => {
    const f = fillOf(paint, iPaint, toColor);
    if (f && isShape) setFill(ed, f);
    const l = lineOf(line, iLine, toColor);
    if (l) setLine(ed, l);
    const changes = geomPatch(latest.current, iGeom);
    if (Object.keys(changes).length) ed.editSelected((s) => { if ('xfrm' in s && s.xfrm) s.xfrm = { ...s.xfrm, ...changes }; }, 'geom');
    if (wrap !== iWrap) setWrap(ed, wrap);
    if (isText && (JSON.stringify(insets) !== JSON.stringify(ins) || anchor !== (body.anchor ?? 't'))) applyBody(ed, { insets, anchor });
    const fx = imageEffectsOf(image, iImage, picture?.imageEffects);
    if (fx !== null) ed.editSelected((s) => { if (s.kind === 'picture') { if (fx) s.imageEffects = fx; else delete s.imageEffects; } }, 'picfx');
    if (alt !== (shape?.description ?? '')) ed.editSelected((s) => { s.description = alt.slice(0, 2000); }, 'alt');
    onClose();
  };
  const title = isPicture ? S.dialogs.format.picture : isText ? S.dialogs.format.textBox : S.dialogs.format.shape;
  const side = (key: keyof typeof ins, label: string) => <Num label={label} value={Math.round(ptToMm(insets[key]) * 10) / 10} min={0} max={50} step={0.5} unit={S.dialogs.mm} onChange={(v) => setInsets({ ...insets, [key]: mmToPt(v) })} />;

  return (
    <Dialog open title={title} onClose={onClose} onConfirm={ok} width={560}>
      <div className="pub-form" data-testid="format-dialog">
        <div className="pub-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>{S.dialogs.format.tabs[t]}</button>
          ))}
        </div>
        {tab === 'paint' && (
          <>
            {isShape && (
              <fieldset>
                <legend>{S.dialogs.format.fill}</legend>
                {paint.mode === 'keep' && <small>{S.dialogs.format.kept}</small>}
                <label className="pub-field"><span>{S.dialogs.format.fillType}</span>
                  <select value={paint.mode} aria-label={S.dialogs.format.fillType} onChange={(e) => setPaint({ ...paint, mode: e.target.value as PaintForm['mode'] })}>
                    {paint.mode === 'keep' && <option value="keep">{S.dialogs.format.fillTypes.keep}</option>}
                    {(['none', 'solid', 'gradient', 'pattern'] as const).map((m) => <option key={m} value={m}>{S.dialogs.format.fillTypes[m]}</option>)}
                  </select>
                </label>
                {(paint.mode === 'solid' || paint.mode === 'gradient' || paint.mode === 'pattern') && (
                  <>
                    <label className="pub-field"><span>{paint.mode === 'pattern' ? S.dialogs.format.foreground : S.dialogs.format.color}</span><input type="color" aria-label={S.dialogs.format.fill} value={paint.color} onChange={(e) => setPaint({ ...paint, color: e.target.value.toUpperCase() })} /></label>
                    {paint.mode !== 'solid' && <label className="pub-field"><span>{paint.mode === 'pattern' ? S.dialogs.format.background : S.dialogs.format.color2}</span><input type="color" aria-label={S.dialogs.format.color2} value={paint.color2} onChange={(e) => setPaint({ ...paint, color2: e.target.value.toUpperCase() })} /></label>}
                    {paint.mode === 'gradient' && <Num label={S.dialogs.format.angle} value={paint.angle} min={0} max={359} step={15} unit="°" onChange={(v) => setPaint({ ...paint, angle: v })} />}
                    {paint.mode === 'pattern' && (
                      <label className="pub-field"><span>{S.dialogs.format.pattern}</span>
                        <select value={paint.pattern} onChange={(e) => setPaint({ ...paint, pattern: e.target.value })}>
                          {PATTERNS.map((p) => <option key={p} value={p}>{S.dialogs.format.patterns[p]}</option>)}
                        </select>
                      </label>
                    )}
                    {paint.mode !== 'pattern' && <Num label={S.dialogs.format.transparency} value={paint.transparency} min={0} max={100} step={5} unit="%" onChange={(v) => setPaint({ ...paint, transparency: v })} />}
                  </>
                )}
              </fieldset>
            )}
            <fieldset>
              <legend>{S.dialogs.format.line}</legend>
              <Checkbox checked={line.mode === 'none'} label={S.dialogs.format.noLine} onChange={(c) => setLineForm({ ...line, mode: c ? 'none' : 'solid' })} />
              <label className="pub-field"><span>{S.dialogs.format.color}</span><input type="color" aria-label={S.dialogs.format.line} value={line.color} disabled={line.mode === 'none'} onChange={(e) => setLineForm({ ...line, mode: 'solid', color: e.target.value.toUpperCase() })} /></label>
              <Num label={S.dialogs.format.width} value={line.width} min={0.25} max={100} step={0.25} unit="pt" disabled={line.mode === 'none'} onChange={(v) => setLineForm({ ...line, mode: 'solid', width: v })} />
              <label className="pub-field"><span>{S.dialogs.format.dash}</span>
                <select value={line.dash} disabled={line.mode === 'none'} onChange={(e) => setLineForm({ ...line, mode: 'solid', dash: e.target.value })}>
                  {DASHES.map((d) => <option key={d} value={d}>{S.dialogs.format.dashes[d]}</option>)}
                </select>
              </label>
            </fieldset>
          </>
        )}
        {tab === 'size' && (
          <fieldset>
            <legend>{S3.geom.size}</legend>
            <Num label={S.dialogs.width} value={geom.width} min={0.1} max={500} step={0.1} unit="cm" onChange={(v) => updateGeom(withWidth(latest.current, iGeom, v))} />
            <Num label={S.dialogs.height} value={geom.height} min={0.1} max={500} step={0.1} unit="cm" onChange={(v) => updateGeom(withHeight(latest.current, iGeom, v))} />
            <Num label={S.dialogs.rotation} value={geom.rotation} min={0} max={359.9} step={1} unit="°" onChange={(v) => updateGeom({ ...latest.current, rotation: normalizeRotation(v) })} />
            <Checkbox checked={geom.lockRatio} label={S3.geom.lockRatio} onChange={(c) => updateGeom({ ...latest.current, lockRatio: c })} />
          </fieldset>
        )}
        {tab === 'layout' && (
          <>
            <fieldset>
              <legend>{S3.geom.position}</legend>
              <Num label={S.dialogs.horizontal} value={geom.x} min={-500} max={500} step={0.1} unit="cm" onChange={(v) => updateGeom({ ...latest.current, x: v })} />
              <Num label={S.dialogs.vertical} value={geom.y} min={-500} max={500} step={0.1} unit="cm" onChange={(v) => updateGeom({ ...latest.current, y: v })} />
              <div className="pub-stylerow">
                <button type="button" onClick={() => updateGeom({ ...latest.current, x: alignedOnPage(pageCm.width, latest.current.width, 'center') })}>{S.dialogs.format.centerH}</button>
                <button type="button" onClick={() => updateGeom({ ...latest.current, y: alignedOnPage(pageCm.height, latest.current.height, 'center') })}>{S.dialogs.format.centerV}</button>
              </div>
            </fieldset>
            <fieldset>
              <legend>{S.cmd.wrapText}</legend>
              {WRAP_MODES.map((m) => (
                <label key={m} className="pub-field"><span>{S.cmd.wraps[m]}</span><input type="radio" name="pub-wrap" checked={wrap === m} onChange={() => setWrapMode(m)} /></label>
              ))}
            </fieldset>
          </>
        )}
        {tab === 'text' && (
          <>
            <fieldset>
              <legend>{S.dialogs.insets}</legend>
              {side('left', S.dialogs.left)}
              {side('right', S.dialogs.right)}
              {side('top', S.dialogs.top)}
              {side('bottom', S.dialogs.bottom)}
            </fieldset>
            <label className="pub-field"><span>{S.dialogs.format.anchor}</span>
              <select value={anchor} onChange={(e) => setAnchor(e.target.value as typeof anchor)}>
                <option value="t">{S.dialogs.format.anchors.t}</option>
                <option value="ctr">{S.dialogs.format.anchors.ctr}</option>
                <option value="b">{S.dialogs.format.anchors.b}</option>
              </select>
            </label>
          </>
        )}
        {tab === 'image' && (
          <fieldset>
            <legend>{S.dialogs.format.tabs.image}</legend>
            <Num label={S.cmd.brightness} value={image.brightness} min={-100} max={100} step={5} unit="%" onChange={(v) => setImage({ ...image, brightness: v })} />
            <Num label={S.cmd.contrast} value={image.contrast} min={-100} max={100} step={5} unit="%" onChange={(v) => setImage({ ...image, contrast: v })} />
            <Num label={S.dialogs.format.transparency} value={image.transparency} min={0} max={100} step={5} unit="%" onChange={(v) => setImage({ ...image, transparency: v })} />
            <Checkbox checked={image.grayscale} label={S.cmd.grayscale} onChange={(c) => setImage({ ...image, grayscale: c })} />
          </fieldset>
        )}
        {tab === 'alt' && <TextField value={alt} onChange={(e) => setAlt(e.target.value)} aria-label={S.dialogs.altText} placeholder={S.dialogs.altHelp} />}
      </div>
    </Dialog>
  );
}
