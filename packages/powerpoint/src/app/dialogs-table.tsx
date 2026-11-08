// Boite « Bordures et trame » du tableau : cotes a modifier, style de trait, trame de la plage de cellules.
import { useState } from 'react';
import { Checkbox, Dialog, NumberField } from '@forgeoffice/ui';
import type { Fill, Line } from '@forgeoffice/pptx';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';
import type { Editor } from './editor.ts';
import { colorFromHex, selectedTable } from './format.ts';
import { editTable, tableSelection } from './ribbon/contextual.tsx';
import { ALL_SIDES, INSIDE_SIDES, NO_LINE, OUTSIDE_SIDES, applyBorders, type BorderSide } from './table-borders.ts';

type ShadeMode = 'keep' | 'none' | 'color';
const DASHES = ['solid', 'dot', 'dash', 'lgDash', 'dashDot'] as const;

export function BordersDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const table = selectedTable(ed);
  const [sides, setSides] = useState<readonly BorderSide[]>(OUTSIDE_SIDES);
  const [style, setStyle] = useState<'line' | 'none'>('line');
  const [dash, setDash] = useState<string>('solid');
  const [width, setWidth] = useState(1);
  const [color, setColor] = useState('#000000');
  const [shade, setShade] = useState<ShadeMode>('keep');
  const [shadeColor, setShadeColor] = useState('#FFFF00');
  const B = S3.borders;
  const toggle = (side: BorderSide, on: boolean): void => setSides((s) => (on ? [...new Set([...s, side])] : s.filter((x) => x !== side)));
  const ok = (): void => {
    if (!table) return onClose();
    const range = tableSelection(ed, table);
    const line: Line = style === 'none' ? NO_LINE : { width, dash: dash === 'solid' ? undefined : dash, fill: { type: 'solid', color: colorFromHex(ed, color) } };
    const fill: Fill | null = shade === 'none' ? { type: 'none' } : shade === 'color' ? { type: 'solid', color: colorFromHex(ed, shadeColor) } : null;
    editTable(ed, table, (s) => {
      if (sides.length) applyBorders(s, range, sides, line);
      if (fill) for (let r = range.r0; r <= range.r1; r++) for (let c = range.c0; c <= range.c1; c++) { const cell = s.table.rows[r]?.cells[c]; if (cell) cell.fill = { ...fill }; }
    }, 'borders-dialog');
    onClose();
  };
  const side = (id: BorderSide, label: string) => <Checkbox key={id} checked={sides.includes(id)} label={label} onChange={(c) => toggle(id, c)} />;
  return (
    <Dialog open title={B.title} onClose={onClose} onConfirm={ok} width={480} actions={[{ label: S.common.ok, primary: true, onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <div className="pp-stack" data-testid="borders-dialog">
        <fieldset className="pp-group">
          <legend>{B.sides}</legend>
          <div className="pp-form__row">
            <button type="button" className="pp-chip" onClick={() => setSides(ALL_SIDES)}>{B.presetAll}</button>
            <button type="button" className="pp-chip" onClick={() => setSides(OUTSIDE_SIDES)}>{B.presetOutside}</button>
            <button type="button" className="pp-chip" onClick={() => setSides(INSIDE_SIDES)}>{B.presetInside}</button>
            <button type="button" className="pp-chip" onClick={() => { setSides(ALL_SIDES); setStyle('none'); }}>{B.presetNone}</button>
          </div>
          <div className="pp-checks">
            {side('top', B.top)}
            {side('bottom', B.bottom)}
            {side('left', B.left)}
            {side('right', B.right)}
            {side('insideH', B.insideH)}
            {side('insideV', B.insideV)}
          </div>
        </fieldset>
        <fieldset className="pp-group">
          <legend>{B.line}</legend>
          <div className="pp-form">
            <label htmlFor="pp-border-style">{B.style}</label>
            <select id="pp-border-style" value={style} onChange={(e) => setStyle(e.target.value as 'line' | 'none')}>
              <option value="line">{B.styleLine}</option>
              <option value="none">{B.styleNone}</option>
            </select>
            <label htmlFor="pp-border-dash">{B.dash}</label>
            <select id="pp-border-dash" value={dash} disabled={style === 'none'} onChange={(e) => setDash(e.target.value)}>
              {DASHES.map((d) => <option key={d} value={d}>{B.dashNames[d]}</option>)}
            </select>
            <label>{B.width}</label>
            <NumberField value={width} min={0.25} max={20} step={0.25} unit="pt" width={110} disabled={style === 'none'} onChange={setWidth} label={B.width} />
            <label htmlFor="pp-border-color">{B.color}</label>
            <input id="pp-border-color" type="color" value={color} disabled={style === 'none'} onChange={(e) => setColor(e.target.value)} />
          </div>
        </fieldset>
        <fieldset className="pp-group">
          <legend>{B.shading}</legend>
          <div className="pp-form">
            <label htmlFor="pp-shade-mode">{B.shading}</label>
            <select id="pp-shade-mode" value={shade} onChange={(e) => setShade(e.target.value as ShadeMode)}>
              <option value="keep">{B.shadeKeep}</option>
              <option value="none">{B.shadeNone}</option>
              <option value="color">{B.shadeColor}</option>
            </select>
            <label htmlFor="pp-shade-color">{B.color}</label>
            <input id="pp-shade-color" type="color" value={shadeColor} disabled={shade !== 'color'} onChange={(e) => setShadeColor(e.target.value)} />
          </div>
        </fieldset>
      </div>
    </Dialog>
  );
}
