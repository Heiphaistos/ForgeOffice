// Boites Police (Ctrl+T) et Paragraphe : equivalents des boites d'Office, au-dessus des commandes du ruban.
import { useState } from 'react';
import { ALIASED_FONTS, Checkbox, Dialog, EMBEDDED_FONTS, NumberField } from '@forgeoffice/ui';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';
import type { Editor } from './editor.ts';
import { applyParagraph, applyRun, colorFromHex, currentParagraph, currentRun, hexOf } from './format.ts';
import {
  addTabAligned, fontForm, fontPatch, paragraphForm, paragraphPatch, previewStyle, withScript,
  type CapsMode, type FontForm, type ParagraphForm, type SpecialIndent, type StrikeMode, type TabAlign,
} from './text-dialog-model.ts';

interface DialogProps {
  ed: Editor;
  onClose: () => void;
}

const FONT_CHOICES: readonly string[] = [...new Set([...ALIASED_FONTS, ...EMBEDDED_FONTS])].sort((a, b) => a.localeCompare(b));
type StyleId = keyof typeof S3.font.styles;
const styleOf = (f: FontForm): StyleId => (f.bold ? (f.italic ? 'boldItalic' : 'bold') : f.italic ? 'italic' : 'regular');

export function FontDialog({ ed, onClose }: DialogProps) {
  const run = currentRun(ed);
  const [initial] = useState(() => fontForm(run, ed.ctx.theme.fonts.minor.latin));
  const [form, setForm] = useState<FontForm>(initial);
  const [color, setColor] = useState<string | null>(run.color ? hexOf(ed, run.color) : null);
  const [colorChanged, setColorChanged] = useState(false);
  const patch = <K extends keyof FontForm>(key: K, value: FontForm[K]): void => setForm((f) => ({ ...f, [key]: value }));
  const ok = (): void => {
    const changes = fontPatch(form, initial);
    if (colorChanged) changes.color = color ? colorFromHex(ed, color) : null;
    if (Object.keys(changes).length) applyRun(ed, changes, 'font-dialog');
    onClose();
  };
  const fonts = FONT_CHOICES.includes(initial.font) ? FONT_CHOICES : [initial.font, ...FONT_CHOICES];
  return (
    <Dialog open title={S3.font.title} onClose={onClose} onConfirm={ok} width={560} actions={[{ label: S.common.ok, primary: true, onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <div className="pp-stack" data-testid="font-dialog">
        <div className="pp-form">
          <label htmlFor="pp-font-name">{S3.font.fontName}</label>
          <input id="pp-font-name" list="pp-font-list" value={form.font} onChange={(e) => patch('font', e.target.value)} />
          <datalist id="pp-font-list">{fonts.map((f) => <option key={f} value={f} />)}</datalist>
          <label htmlFor="pp-font-style">{S3.font.style}</label>
          <select id="pp-font-style" value={styleOf(form)} onChange={(e) => setForm((f) => ({ ...f, bold: e.target.value.startsWith('bold'), italic: e.target.value.endsWith('talic') }))}>
            {(Object.keys(S3.font.styles) as StyleId[]).map((id) => <option key={id} value={id}>{S3.font.styles[id]}</option>)}
          </select>
          <label>{S3.font.size}</label>
          <div className="pp-form__row">
            <NumberField value={form.size} min={1} max={4000} step={1} width={90} onChange={(v) => patch('size', v)} label={S3.font.size} />
          </div>
          <label htmlFor="pp-font-underline">{S3.font.underline}</label>
          <select id="pp-font-underline" value={form.underline} onChange={(e) => patch('underline', e.target.value)}>
            {!(form.underline in S3.font.underlines) && <option value={form.underline}>{form.underline}</option>}
            {Object.entries(S3.font.underlines).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
        <div className="pp-form">
          <label htmlFor="pp-font-color">{S3.font.color}</label>
          <div className="pp-form__row">
            <input id="pp-font-color" type="color" value={color ?? '#000000'} disabled={color === null} onChange={(e) => { setColor(e.target.value); setColorChanged(true); }} />
            <Checkbox checked={color === null} label={S3.font.automatic} onChange={(auto) => { setColor(auto ? null : hexOf(ed, { type: 'scheme', value: 'tx1' })); setColorChanged(true); }} />
          </div>
        </div>
        <fieldset className="pp-group">
          <legend>{S3.font.effects}</legend>
          <div className="pp-checks">
            <Checkbox checked={form.strike === 'single'} label={S3.font.strikeSingle} onChange={(c) => patch('strike', (c ? 'single' : 'none') as StrikeMode)} />
            <Checkbox checked={form.strike === 'double'} label={S3.font.strikeDouble} onChange={(c) => patch('strike', (c ? 'double' : 'none') as StrikeMode)} />
            <Checkbox checked={form.script === 'sup'} label={S3.font.superscript} onChange={(c) => setForm((f) => withScript(f, c ? 'sup' : 'none'))} />
            <Checkbox checked={form.script === 'sub'} label={S3.font.subscript} onChange={(c) => setForm((f) => withScript(f, c ? 'sub' : 'none'))} />
            <Checkbox checked={form.caps === 'small'} label={S3.font.smallCaps} onChange={(c) => patch('caps', (c ? 'small' : 'none') as CapsMode)} />
            <Checkbox checked={form.caps === 'all'} label={S3.font.allCaps} onChange={(c) => patch('caps', (c ? 'all' : 'none') as CapsMode)} />
            <Checkbox checked={form.shadow} label={S3.font.shadow} onChange={(c) => patch('shadow', c)} />
          </div>
          <div className="pp-form">
            <label>{S3.font.offset}</label>
            <NumberField value={form.offset} min={1} max={100} step={5} unit="%" width={90} disabled={form.script === 'none'} onChange={(v) => patch('offset', v)} label={S3.font.offset} />
            <label>{S3.font.spacing}</label>
            <NumberField value={form.spacing} min={-20} max={100} step={0.5} unit={S3.font.spacingUnit} width={90} onChange={(v) => patch('spacing', v)} label={S3.font.spacing} />
          </div>
        </fieldset>
        <div className="pp-fontpreview" aria-label={S3.font.preview}>
          <span style={previewStyle(form)}>{S3.font.previewText}</span>
        </div>
      </div>
    </Dialog>
  );
}

export function ParagraphDialog({ ed, onClose }: DialogProps) {
  const [initial] = useState(() => paragraphForm(currentParagraph(ed)));
  const [form, setForm] = useState<ParagraphForm>(initial);
  const [newTab, setNewTab] = useState(5);
  const [newAlign, setNewAlign] = useState<TabAlign>('l');
  const patch = <K extends keyof ParagraphForm>(key: K, value: ParagraphForm[K]): void => setForm((f) => ({ ...f, [key]: value }));
  const ok = (): void => {
    const changes = paragraphPatch(form, initial);
    if (Object.keys(changes).length) applyParagraph(ed, changes, 'paragraph-dialog');
    onClose();
  };
  return (
    <Dialog open title={S3.paragraph.title} onClose={onClose} onConfirm={ok} width={480} actions={[{ label: S.common.ok, primary: true, onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <div className="pp-stack" data-testid="paragraph-dialog">
        <fieldset className="pp-group">
          <legend>{S3.paragraph.general}</legend>
          <div className="pp-form">
            <label htmlFor="pp-para-align">{S3.paragraph.align}</label>
            <select id="pp-para-align" value={form.align} onChange={(e) => patch('align', e.target.value as ParagraphForm['align'])}>
              {Object.entries(S3.paragraph.aligns).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
        </fieldset>
        <fieldset className="pp-group">
          <legend>{S3.paragraph.indents}</legend>
          <div className="pp-form">
            <label>{S3.paragraph.beforeText}</label>
            <NumberField value={form.beforeText} min={0} max={50} step={0.1} unit={S3.paragraph.cm} width={110} onChange={(v) => patch('beforeText', v)} label={S3.paragraph.beforeText} />
            <label htmlFor="pp-para-special">{S3.paragraph.special}</label>
            <div className="pp-form__row">
              <select id="pp-para-special" value={form.special} onChange={(e) => setForm((f) => ({ ...f, special: e.target.value as SpecialIndent, specialBy: e.target.value !== 'none' && !f.specialBy ? 1.27 : f.specialBy }))}>
                {Object.entries(S3.paragraph.specials).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <label>{S3.paragraph.by}</label>
              <NumberField value={form.specialBy} min={0} max={50} step={0.1} unit={S3.paragraph.cm} width={110} disabled={form.special === 'none'} onChange={(v) => patch('specialBy', v)} label={S3.paragraph.by} />
            </div>
          </div>
        </fieldset>
        <fieldset className="pp-group">
          <legend>{S3.paragraph.spacing}</legend>
          <div className="pp-form">
            <label>{S3.paragraph.before}</label>
            <NumberField value={form.spaceBefore} min={0} max={1584} step={1} unit={S3.paragraph.pt} width={110} onChange={(v) => patch('spaceBefore', v)} label={S3.paragraph.before} />
            <label>{S3.paragraph.after}</label>
            <NumberField value={form.spaceAfter} min={0} max={1584} step={1} unit={S3.paragraph.pt} width={110} onChange={(v) => patch('spaceAfter', v)} label={S3.paragraph.after} />
            <label htmlFor="pp-para-line">{S3.paragraph.lineSpacing}</label>
            <div className="pp-form__row">
              <select id="pp-para-line" value={form.lineMode} onChange={(e) => setForm((f) => ({ ...f, lineMode: e.target.value as ParagraphForm['lineMode'], lineValue: e.target.value === 'exact' ? 18 : 1 }))}>
                {Object.entries(S3.paragraph.lineModes).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <label>{S3.paragraph.lineAt}</label>
              <NumberField value={form.lineValue} min={0.1} max={form.lineMode === 'exact' ? 1584 : 9.99} step={form.lineMode === 'exact' ? 1 : 0.05} unit={form.lineMode === 'exact' ? S3.paragraph.pt : undefined} width={110} onChange={(v) => patch('lineValue', v)} label={S3.paragraph.lineAt} />
            </div>
          </div>
        </fieldset>
        <fieldset className="pp-group">
          <legend>{S3.paragraph.tabsTitle}</legend>
          <div className="pp-form">
            <label>{S3.paragraph.defaultTab}</label>
            <NumberField value={form.defaultTab} min={0.1} max={50} step={0.1} unit={S3.paragraph.cm} width={110} onChange={(v) => patch('defaultTab', v)} label={S3.paragraph.defaultTab} />
            <label>{S3.paragraph.tabPosition}</label>
            <div className="pp-form__row">
              <NumberField value={newTab} min={0} max={50} step={0.1} unit={S3.paragraph.cm} width={110} onChange={setNewTab} label={S3.paragraph.tabPosition} />
              <select aria-label={S3.paragraph.tabAlign} value={newAlign} onChange={(e) => setNewAlign(e.target.value as TabAlign)}>
                {(Object.keys(S3.paragraph.tabAligns) as TabAlign[]).map((a) => <option key={a} value={a}>{S3.paragraph.tabAligns[a]}</option>)}
              </select>
              <button type="button" className="pp-chip" onClick={() => setForm((f) => ({ ...f, ...addTabAligned(f.tabs, f.tabAligns, newTab, newAlign) }))}>{S3.paragraph.tabSet}</button>
            </div>
          </div>
          <div className="pp-form__row" data-testid="tab-list">
            {form.tabs.map((t, i) => (
              <button key={t} type="button" className="pp-chip" title={S3.paragraph.tabRemove} onClick={() => setForm((f) => ({ ...f, tabs: f.tabs.filter((_, k) => k !== i), tabAligns: f.tabAligns.filter((_, k) => k !== i) }))}>{`${String(t).replace('.', ',')} cm (${S3.paragraph.tabAligns[form.tabAligns[i] ?? 'l']}) ✕`}</button>
            ))}
            {!form.tabs.length && <span>{S3.paragraph.tabNone}</span>}
          </div>
        </fieldset>
      </div>
    </Dialog>
  );
}
