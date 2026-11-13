// Format > Caractere (dispositions LibreOffice / OpenOffice) : memes onglets et champs que la vraie boite, branches sur les proprietes de caractere de ForgeOffice.
import { useState, type ReactNode } from 'react';
import { Dialog, FontPicker, NumberField, suiteDialogKind, type DialogTab } from '@forgeoffice/ui';
import type { HighlightColor, RunProps, UnderlineType } from '@forgeoffice/docx';
import type { Ctl } from '../app/types.ts';
import { setRunProps } from '../editor/commands.ts';
import { highlightHex, runCss } from '../editor/css.ts';
import { SD } from '../strings-suite.ts';
import { runPatch, styleObject } from './text.tsx';
import { Check, Select } from './common.tsx';

const C = SD.character;
type Close = { c: Ctl; onClose: () => void };

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className="fo-sdlg__field" style={wide ? { gridColumn: '1 / -1' } : undefined}><span>{label}</span>{children}</label>;
}

export function Title({ children }: { children: ReactNode }) {
  return <h3 className="fo-sdlg__title">{children}</h3>;
}

export function Radio({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return <label className="fo-sdlg__radio"><input type="radio" checked={checked} disabled={disabled} onChange={onChange} />{label}</label>;
}

const HIGHLIGHTS: HighlightColor[] = ['yellow', 'green', 'cyan', 'magenta', 'blue', 'red', 'darkBlue', 'darkCyan', 'darkGreen', 'darkMagenta', 'darkRed', 'darkYellow', 'darkGray', 'lightGray', 'black', 'white'];

export function CharacterSuiteDialog({ c, onClose }: Close) {
  const oo = suiteDialogKind() === 'openoffice';
  const r = c.sel.run;
  const [st, setSt] = useState<RunProps>({ ...r });
  const set = (patch: Partial<RunProps>): void => setSt((s) => ({ ...s, ...patch }));
  const apply = (): void => {
    c.run(setRunProps({ ...runPatch(st, r), highlight: st.highlight && st.highlight !== 'none' ? st.highlight : undefined }));
    onClose();
  };
  const style = st.bold ? (st.italic ? 'bi' : 'b') : st.italic ? 'i' : 'r';
  const styleLabels: Record<string, string> = { r: C.styles[0], i: C.styles[1], b: C.styles[2], bi: C.styles[3] };
  const strike = st.doubleStrike ? 'double' : st.strike ? 'single' : '';
  const under = st.underline ?? 'none';
  const casing = st.caps ? 'caps' : st.smallCaps ? 'small' : '';
  const relief = st.emboss ? 'emboss' : st.imprint ? 'imprint' : '';
  const na = SD.na;
  const unders: [UnderlineType, string][] = [['none', C.none], ['single', C.single], ['double', C.double], ['dotted', C.dotted], ['wave', C.wave]];
  const preview = runCss(st).replace(/display:none/, '');
  const previewBox = <div className="fo-word-preview" aria-label={C.preview}><span style={styleObject(preview)}>{C.previewText}</span></div>;

  const fontTab = (
    <>
      <div className="fo-sdlg__cols">
        <div style={{ '--lw': '64px' } as React.CSSProperties}>
          {!oo && <Title>{C.western}</Title>}
          <Field label={C.font}><FontPicker value={st.font ?? ''} onChange={(font) => set({ font })} width={oo ? 200 : 260} /></Field>
          <Field label={C.style}><Select value={style} label={C.style} options={(['r', 'i', 'b', 'bi'] as const).map((k): [string, string] => [k, styleLabels[k] ?? k])} onChange={(v) => set({ bold: v.includes('b'), italic: v.includes('i') })} /></Field>
          <Field label={C.size}><NumberField value={st.size ?? 11} min={1} max={1638} step={0.5} unit="pt" width={110} label={C.size} onChange={(size) => set({ size })} /></Field>
          <Field label={C.language}>
            <Select value={st.lang ?? 'fr-FR'} label={C.language} options={[['fr-FR', 'Français (France)'], ['fr-BE', 'Français (Belgique)'], ['fr-CH', 'Français (Suisse)'], ['en-GB', 'Anglais (Royaume-Uni)'], ['en-US', 'Anglais (États-Unis)'], ['de-DE', 'Allemand (Allemagne)'], ['es-ES', 'Espagnol (Espagne)'], ['it-IT', 'Italien (Italie)']]} onChange={(lang) => set({ lang })} />
          </Field>
          <button type="button" className="fo-sbtn" disabled title={na}>{C.features}</button>
        </div>
      </div>
      <p className="fo-sdlg__hint">{C.sameFont}</p>
      {previewBox}
    </>
  );
  const effectsTab = (
    <>
      <Title>{C.fontColor}</Title>
      <div className="fo-sdlg__grid fo-sdlg__grid--2">
        <Field label={C.fontColorLabel}>
          <span className="fo-sdlg__inline">
            <input type="color" aria-label={C.fontColor} value={st.color && st.color.rgb !== 'auto' ? `#${st.color.rgb}` : '#000000'} onChange={(e) => set({ color: { rgb: e.target.value.slice(1).toUpperCase() } })} />
            <Check label={C.auto} checked={!st.color || st.color.rgb === 'auto'} onChange={(on) => set({ color: on ? undefined : { rgb: '000000' } })} />
          </span>
        </Field>
        <Field label={C.transparency}><NumberField value={0} min={0} max={100} unit="%" width={80} disabled label={C.transparency} onChange={() => undefined} /></Field>
      </div>
      <Title>{C.decoration}</Title>
      <div className="fo-sdlg__grid fo-sdlg__grid--2">
        <Field label={C.overline}><select disabled title={na} aria-label={C.overline}><option>{C.none}</option></select></Field>
        <Field label={C.strike}><Select value={strike} label={C.strike} options={[['', C.none], ['single', C.single], ['double', C.double]]} onChange={(v) => set({ strike: v === 'single', doubleStrike: v === 'double' })} /></Field>
        <Field label={C.underline}><Select value={under === 'words' ? 'single' : under} label={C.underline} options={unders} onChange={(underline) => set({ underline })} /></Field>
        <Field label=""><input type="color" aria-label={C.underline} disabled={under === 'none'} value={st.underlineColor ? `#${st.underlineColor}` : '#000000'} onChange={(e) => set({ underlineColor: e.target.value.slice(1).toUpperCase() })} /></Field>
        <Check label={C.wordsOnly} checked={under === 'words'} onChange={(on) => set({ underline: on ? 'words' : 'single' })} />
      </div>
      <Title>{C.effects}</Title>
      <div className="fo-sdlg__grid fo-sdlg__grid--2">
        <Field label={C.casing}><Select value={casing} label={C.casing} options={C.caseOptions.map(([v, l]): [string, string] => [v, l])} onChange={(v) => set({ caps: v === 'caps', smallCaps: v === 'small' })} /></Field>
        <Check label={C.hidden} checked={!!st.hidden} onChange={(hidden) => set({ hidden })} />
        <Field label={C.relief}><Select value={relief} label={C.relief} options={C.reliefOptions.map(([v, l]): [string, string] => [v, l])} onChange={(v) => set({ emboss: v === 'emboss', imprint: v === 'imprint' })} /></Field>
        <span className="fo-sdlg__inline"><Check label={C.outline} checked={!!st.outline} onChange={(outline) => set({ outline })} /><Check label={C.shadow} checked={!!st.shadow} onChange={(shadow) => set({ shadow })} /></span>
        <Field label={C.accent}><select disabled title={na} aria-label={C.accent}><option>{C.none}</option></select></Field>
        <Field label={C.accentPos}><select disabled title={na} aria-label={C.accentPos}><option /></select></Field>
      </div>
      {previewBox}
    </>
  );
  const sup = st.vertAlign === 'superscript';
  const sub = st.vertAlign === 'subscript';
  const positionTab = (
    <>
      <Title>{C.position}</Title>
      <div className="fo-sdlg__grid fo-sdlg__grid--2">
        <div>
          <Radio label={C.normal} checked={!sup && !sub} onChange={() => set({ vertAlign: undefined })} />
          <Radio label={C.superscript} checked={sup} onChange={() => set({ vertAlign: 'superscript' })} />
          <Radio label={C.subscript} checked={sub} onChange={() => set({ vertAlign: 'subscript' })} />
        </div>
        <div>
          <Field label={C.raise}><NumberField value={st.position ?? 0} min={-100} max={100} step={0.5} unit="pt" width={110} label={C.raise} onChange={(position) => set({ position })} /></Field>
          <Field label={C.rel}><NumberField value={100} unit="%" width={110} disabled label={C.rel} onChange={() => undefined} /></Field>
        </div>
      </div>
      <Title>{C.rotation}</Title>
      <div className="fo-sdlg__grid fo-sdlg__grid--2">
        <div>
          <Radio label={C.deg0} checked onChange={() => undefined} />
          <Radio label={C.deg90} checked={false} disabled onChange={() => undefined} />
          <Radio label={C.deg270} checked={false} disabled onChange={() => undefined} />
        </div>
        <div>
          <Field label={C.widthScale}><NumberField value={st.scale ?? 100} min={10} max={600} step={10} unit="%" width={110} label={C.widthScale} onChange={(scale) => set({ scale })} /></Field>
          <Check label={C.fitLine} checked={false} onChange={() => undefined} />
        </div>
      </div>
      <Title>{C.spacing}</Title>
      <div className="fo-sdlg__grid fo-sdlg__grid--2">
        <Field label={C.charSpacing}><NumberField value={st.spacing ?? 0} min={-10} max={50} step={0.1} unit="pt" width={110} label={C.charSpacing} onChange={(spacing) => set({ spacing })} /></Field>
        <Check label={C.pair} checked={!!st.kerning} onChange={(on) => set({ kerning: on ? 1 : undefined })} />
      </div>
      <Title>{C.hyphen}</Title>
      <Check label={C.noHyphen} checked={false} onChange={() => undefined} />
      <Title>{C.optical}</Title>
      <Check label={C.opticalAuto} checked onChange={() => undefined} />
    </>
  );
  const highlight = st.highlight && st.highlight !== 'none' ? st.highlight : '';
  const backgroundTab = (
    <>
      <Title>{C.highlightColor}</Title>
      <div className="fo-sdlg__swatches" role="radiogroup" aria-label={C.highlightColor}>
        <button type="button" role="radio" aria-checked={!highlight} className={`fo-sdlg__sw${highlight ? '' : ' is-on'}`} onClick={() => set({ highlight: undefined })}>{SD.paragraph.noFill}</button>
        {HIGHLIGHTS.map((h) => <button key={h} type="button" role="radio" aria-checked={highlight === h} aria-label={h} className={`fo-sdlg__sw${highlight === h ? ' is-on' : ''}`} style={{ background: highlightHex(h) }} onClick={() => set({ highlight: h })} />)}
      </div>
      {previewBox}
    </>
  );
  const b = st.border;
  const borderTab = (
    <>
      <Title>{C.borderSection}</Title>
      <Check label={C.borderOn} checked={!!b} onChange={(on) => set({ border: on ? { style: 'single', width: 0.5, color: 'auto', space: 0 } : undefined })} />
      <div className="fo-sdlg__grid fo-sdlg__grid--2">
        <Field label={C.borderStyle}><Select value={b?.style ?? 'single'} label={C.borderStyle} options={[['single', C.single], ['double', C.double], ['dotted', C.dotted], ['dashed', C.dash]]} onChange={(style) => b && set({ border: { ...b, style } })} /></Field>
        <Field label={C.borderWidth}><NumberField value={b?.width ?? 0.5} min={0.25} max={6} step={0.25} unit="pt" width={110} disabled={!b} label={C.borderWidth} onChange={(width) => b && set({ border: { ...b, width } })} /></Field>
        <Field label={C.borderSpace}><NumberField value={b?.space ?? 0} min={0} max={31} step={1} unit="pt" width={110} disabled={!b} label={C.borderSpace} onChange={(space) => b && set({ border: { ...b, space } })} /></Field>
        <Field label={C.borderColor}><input type="color" aria-label={C.borderColor} disabled={!b} value={b && b.color !== 'auto' ? `#${b.color}` : '#000000'} onChange={(e) => b && set({ border: { ...b, color: e.target.value.slice(1).toUpperCase() } })} /></Field>
      </div>
      {previewBox}
    </>
  );
  const off = (id: string, label: string, hint = na): DialogTab => ({ id, label, content: null, disabled: true, hint });
  const tabs: DialogTab[] = oo
    ? [{ id: 'font', label: C.tabs.font, content: fontTab }, { id: 'effects', label: C.tabs.effectsOO, content: effectsTab }, { id: 'position', label: C.tabs.positionOO, content: positionTab },
      off('hyperlink', C.tabs.hyperlink, C.hyperlinkHint), { id: 'background', label: C.tabs.background, content: backgroundTab }]
    : [{ id: 'font', label: C.tabs.font, content: fontTab }, { id: 'effects', label: C.tabs.effects, content: effectsTab }, { id: 'position', label: C.tabs.position, content: positionTab },
      off('asian', C.tabs.asian), { id: 'background', label: C.tabs.background, content: backgroundTab }, { id: 'border', label: C.tabs.border, content: borderTab }];
  return (
    <Dialog open title={C.title} onClose={onClose} onConfirm={apply} width={oo ? 560 : 830} tabs={tabs} onReset={() => setSt({ ...r })}
      actions={oo ? [{ label: SD.ok, primary: true, onClick: apply }, { label: SD.cancel, onClick: onClose }] : [{ label: SD.ok, primary: true, onClick: apply }, { label: SD.cancel, onClick: onClose }]}>
      {null}
    </Dialog>
  );
}
