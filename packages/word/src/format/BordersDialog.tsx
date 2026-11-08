// Boite « Bordures et trame » : bordures du paragraphe (côtés, style, épaisseur, couleur) et trame de fond.
import { useState } from 'react';
import { ColorPalette, Dialog, NumberField } from '@forgeoffice/ui';
import type { Border, BorderStyle, ParagraphBorders, ParagraphProps } from '@forgeoffice/docx';
import type { ParaTarget } from './TabsDialog.tsx';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { Check, Row, Select } from '../dialogs/common.tsx';
import { setParagraph } from '../editor/commands.ts';

const B = X.paraBorders;
const SIDES = ['top', 'bottom', 'left', 'right'] as const;
const STYLES: [BorderStyle, string][] = [['single', B.single], ['double', B.double], ['dotted', B.dotted], ['dashed', B.dashed], ['thick', B.thick]];

export function BordersDialog({ c, onClose, target }: { c: Ctl; onClose: () => void; target?: ParaTarget }) {
  const para = target?.value ?? c.sel.para;
  const current = para.borders ?? {};
  const first = SIDES.map((s) => current[s]).find((b) => b && b.style !== 'none');
  const [sides, setSides] = useState<Record<(typeof SIDES)[number], boolean>>({ top: !!current.top, bottom: !!current.bottom, left: !!current.left, right: !!current.right });
  const [style, setStyle] = useState<BorderStyle>(first?.style ?? 'single');
  const [width, setWidth] = useState(first?.width ?? 0.5);
  const [color, setColor] = useState<string | undefined>(first && first.color !== 'auto' ? `#${first.color}` : undefined);
  const [fill, setFill] = useState<string | undefined>(para.shading?.fill && para.shading.fill !== 'auto' ? `#${para.shading.fill}` : undefined);
  const preset = (on: boolean): void => setSides({ top: on, bottom: on, left: on, right: on });
  const ok = (): void => {
    const border: Border = { style, width, color: color ? color.slice(1).toUpperCase() : 'auto', space: 1 };
    const borders: ParagraphBorders = {};
    for (const s of SIDES) if (sides[s]) borders[s] = border;
    const patch: Partial<ParagraphProps> = { borders: Object.keys(borders).length ? borders : undefined, shading: fill ? { fill: fill.slice(1).toUpperCase(), pattern: 'clear' } : undefined };
    if (target) target.apply(patch);
    else c.run(setParagraph({ props: patch }));
    onClose();
  };
  return (
    <Dialog open title={B.title} onClose={onClose} onConfirm={ok} width={520} actions={[{ label: T.dialogs.ok, primary: true, onClick: ok }, { label: T.dialogs.cancel, onClick: onClose }]}>
      <fieldset className="fo-word-fieldset">
        <legend>{B.setting}</legend>
        <div className="fo-word-tabbtns">
          <button type="button" className="fo-word-chip" onClick={() => preset(false)}>{B.none}</button>
          <button type="button" className="fo-word-chip" onClick={() => preset(true)}>{B.box}</button>
        </div>
        <div className="fo-word-checks">
          {SIDES.map((s) => <Check key={s} label={B[s]} checked={sides[s]} onChange={(v) => setSides({ ...sides, [s]: v })} />)}
        </div>
      </fieldset>
      <div className="fo-word-form fo-word-form--2">
        <Row label={B.style}><Select value={style} label={B.style} options={STYLES} onChange={setStyle} /></Row>
        <Row label={B.width}><NumberField value={width} min={0.25} max={6} step={0.25} unit="pt" width={90} label={B.width} onChange={setWidth} /></Row>
      </div>
      <fieldset className="fo-word-fieldset"><legend>{B.color}</legend><ColorPalette value={color ?? null} onPick={(v) => setColor(v ?? undefined)} /></fieldset>
      <fieldset className="fo-word-fieldset"><legend>{B.shading}</legend><ColorPalette value={fill ?? null} onPick={(v) => setFill(v ?? undefined)} /></fieldset>
    </Dialog>
  );
}
