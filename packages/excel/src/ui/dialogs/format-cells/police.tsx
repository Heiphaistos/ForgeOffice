// Onglet Police : nom, style, taille, soulignement, couleur, effets (barre, exposant, indice), police normale, apercu.
import { Button, Checkbox, ColorPicker, FontPicker, NumberField } from '@forgeoffice/ui';
import { cssFontFamily, defaultFont, type UnderlineStyle } from '@forgeoffice/xlsx';
import { FC } from '../../../strings/index.ts';
import { colorHex, hexColor, type FormatCtx } from './state.ts';

const UNDERLINES: readonly (UnderlineStyle | 'none')[] = ['none', 'single', 'double', 'singleAccounting', 'doubleAccounting'];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

/** Style combine (Normal, Italique, Gras, Gras italique) <-> gras + italique. */
const styleIndex = (bold: boolean, italic: boolean): number => (bold ? (italic ? 3 : 2) : italic ? 1 : 0);

export function FontTab({ f }: { f: FormatCtx }) {
  const bold = f.get('bold');
  const italic = f.get('italic');
  const size = f.get('size');
  const underline = f.get('underline');
  const vert = f.get('vertAlign');
  const color = f.get('color');
  const hex = colorHex(f.wb, color);
  const reset = (): void => {
    const d = defaultFont();
    f.set({ fontName: d.name, size: d.size, bold: false, italic: false, underline: null, strike: false, vertAlign: null, color: null });
  };
  const decoration = `${underline ? 'underline' : ''} ${f.get('strike') ? 'line-through' : ''}`.trim();
  return (
    <div className="xl-fc-font">
      <div className="xl-fc-font-grid">
        <div>
          <label className="xl-fc-label">{FC.fontName}</label>
          <FontPicker value={f.get('fontName')} onChange={(n) => f.set({ fontName: n })} width={200} />
        </div>
        <div>
          <label className="xl-fc-label" htmlFor="fc-style">{FC.fontStyle}</label>
          <select id="fc-style" value={styleIndex(bold, italic)} onChange={(e) => { const i = Number(e.target.value); f.set({ bold: i >= 2, italic: i === 1 || i === 3 }); }}>
            {FC.styles.map((label, i) => <option key={label} value={i}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="xl-fc-label">{FC.fontSize}</label>
          <NumberField value={size} min={1} max={409} step={0.5} unit="pt" width={96} label={FC.fontSize} onChange={(n) => f.set({ size: n })} />
          <div className="xl-fc-sizes">{SIZES.map((n) => <button key={n} type="button" className={n === size ? 'is-active' : ''} onClick={() => f.set({ size: n })}>{n}</button>)}</div>
        </div>
      </div>
      <div className="xl-form">
        <label htmlFor="fc-ul">{FC.underline}</label>
        <select id="fc-ul" value={underline ?? 'none'} onChange={(e) => f.set({ underline: e.target.value === 'none' ? null : (e.target.value as UnderlineStyle) })}>
          {UNDERLINES.map((u) => <option key={u} value={u}>{FC.underlines[u]}</option>)}
        </select>
        <label>{FC.color}</label>
        <ColorPicker label={FC.color} showLabel value={hex} onChange={(c) => f.set({ color: c ? hexColor(c) : null })} />
      </div>
      <fieldset className="xl-fs">
        <legend>{FC.effects}</legend>
        <Checkbox checked={f.get('strike')} mixed={f.isMixed('strike')} onChange={(v) => f.set({ strike: v })} label={FC.strike} />
        <Checkbox checked={vert === 'superscript'} mixed={f.isMixed('vertAlign')} onChange={(v) => f.set({ vertAlign: v ? 'superscript' : null })} label={FC.superscript} />
        <Checkbox checked={vert === 'subscript'} mixed={f.isMixed('vertAlign')} onChange={(v) => f.set({ vertAlign: v ? 'subscript' : null })} label={FC.subscript} />
      </fieldset>
      <fieldset className="xl-fs">
        <legend>{FC.preview}</legend>
        <div
          className="xl-fc-preview"
          data-testid="fc-font-preview"
          style={{
            fontFamily: cssFontFamily(f.get('fontName')), fontSize: Math.min(size, 40), fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal',
            color: hex ?? undefined, textDecoration: decoration || undefined, verticalAlign: vert === 'superscript' ? 'super' : vert === 'subscript' ? 'sub' : undefined,
          }}
        >
          {FC.previewText}
        </div>
      </fieldset>
      <Button onClick={reset}>{FC.normalFont}</Button>
      <p className="xl-fc-desc">{FC.fontHint}</p>
    </div>
  );
}
