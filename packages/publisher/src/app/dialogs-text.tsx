// Boites Police (Ctrl+T), Paragraphe et Taille et position : modeles purs et libelles de la Presentation (importes, non modifies),
// application par les operations de la Publication.
import { useRef, useState } from 'react';
import { ALIASED_FONTS, Checkbox, Dialog, EMBEDDED_FONTS, NumberField as BareNumber } from '@forgeoffice/ui';
import { locate } from '@forgeoffice/powerpoint/canvas';
import { geomForm, geomPatch, normalizeRotation, withHeight, withWidth, type GeomForm } from '../../../powerpoint/src/app/geom-dialog-model.ts';
import { S3 } from '../../../powerpoint/src/app/strings-text.ts';
import {
  fontForm, fontPatch, paragraphForm, paragraphPatch, previewStyle, withScript,
  type CapsMode, type FontForm, type ParagraphForm, type SpecialIndent, type StrikeMode,
} from '../../../powerpoint/src/app/text-dialog-model.ts';
import { S } from '../strings.ts';
import type { Editor } from './editor.ts';
import { applyParagraph, applyRun, colorFromHex, currentParagraph, currentRun, hexOf } from './ops.ts';

interface DialogProps {
  ed: Editor;
  onClose: () => void;
}

const FONT_CHOICES: readonly string[] = [...new Set([...ALIASED_FONTS, ...EMBEDDED_FONTS])].sort((a, b) => a.localeCompare(b));
type StyleId = keyof typeof S3.font.styles;
const styleOf = (f: FontForm): StyleId => (f.bold ? (f.italic ? 'boldItalic' : 'bold') : f.italic ? 'italic' : 'regular');

/** Champ numerique libelle : la valeur saisie est aussi memorisee en direct (Entree valide le champ puis la boite dans le meme evenement). */
export function Num({ label, value, onChange, ...rest }: { label: string; value: number; min: number; max: number; step: number; unit?: string; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <label className="pub-field">
      <span>{label}</span>
      <BareNumber value={value} label={label} width={110} onChange={onChange} {...rest} />
    </label>
  );
}

export function FontDialog({ ed, onClose }: DialogProps) {
  const run = currentRun(ed);
  const [initial] = useState(() => fontForm(run, ed.ctx.theme.fonts.minor.latin));
  const [form, setForm] = useState<FontForm>(initial);
  const latest = useRef(form);
  const [color, setColor] = useState<string | null>(run.color ? hexOf(ed, run.color) : null);
  const [colorChanged, setColorChanged] = useState(false);
  const update = (fn: (f: FontForm) => FontForm): void => setForm((f) => { latest.current = fn(f); return latest.current; });
  const patch = <K extends keyof FontForm>(key: K, value: FontForm[K]): void => update((f) => ({ ...f, [key]: value }));
  const ok = (): void => {
    const changes = fontPatch(latest.current, initial);
    if (colorChanged) changes.color = color ? colorFromHex(ed, color) : null;
    if (Object.keys(changes).length) applyRun(ed, changes, 'font-dialog');
    onClose();
  };
  const fonts = FONT_CHOICES.includes(initial.font) ? FONT_CHOICES : [initial.font, ...FONT_CHOICES];
  return (
    <Dialog open title={S3.font.title} onClose={onClose} onConfirm={ok} width={560}>
      <div className="pub-form" data-testid="font-dialog">
        <label className="pub-field"><span>{S3.font.fontName}</span>
          <input list="pub-font-list" value={form.font} onChange={(e) => patch('font', e.target.value)} />
        </label>
        <datalist id="pub-font-list">{fonts.map((f) => <option key={f} value={f} />)}</datalist>
        <label className="pub-field"><span>{S3.font.style}</span>
          <select value={styleOf(form)} onChange={(e) => update((f) => ({ ...f, bold: e.target.value.startsWith('bold'), italic: e.target.value.endsWith('talic') }))}>
            {(Object.keys(S3.font.styles) as StyleId[]).map((id) => <option key={id} value={id}>{S3.font.styles[id]}</option>)}
          </select>
        </label>
        <Num label={S3.font.size} value={form.size} min={1} max={4000} step={1} onChange={(v) => patch('size', v)} />
        <label className="pub-field"><span>{S3.font.underline}</span>
          <select value={form.underline} onChange={(e) => patch('underline', e.target.value)}>
            {!(form.underline in S3.font.underlines) && <option value={form.underline}>{form.underline}</option>}
            {Object.entries(S3.font.underlines).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="pub-field"><span>{S3.font.color}</span>
          <span>
            <input type="color" value={color ?? '#000000'} disabled={color === null} onChange={(e) => { setColor(e.target.value); setColorChanged(true); }} />
            <Checkbox checked={color === null} label={S3.font.automatic} onChange={(auto) => { setColor(auto ? null : hexOf(ed, { type: 'scheme', value: 'tx1' })); setColorChanged(true); }} />
          </span>
        </label>
        <fieldset>
          <legend>{S3.font.effects}</legend>
          <Checkbox checked={form.strike === 'single'} label={S3.font.strikeSingle} onChange={(c) => patch('strike', (c ? 'single' : 'none') as StrikeMode)} />
          <Checkbox checked={form.strike === 'double'} label={S3.font.strikeDouble} onChange={(c) => patch('strike', (c ? 'double' : 'none') as StrikeMode)} />
          <Checkbox checked={form.script === 'sup'} label={S3.font.superscript} onChange={(c) => update((f) => withScript(f, c ? 'sup' : 'none'))} />
          <Checkbox checked={form.script === 'sub'} label={S3.font.subscript} onChange={(c) => update((f) => withScript(f, c ? 'sub' : 'none'))} />
          <Checkbox checked={form.caps === 'small'} label={S3.font.smallCaps} onChange={(c) => patch('caps', (c ? 'small' : 'none') as CapsMode)} />
          <Checkbox checked={form.caps === 'all'} label={S3.font.allCaps} onChange={(c) => patch('caps', (c ? 'all' : 'none') as CapsMode)} />
          <Checkbox checked={form.shadow} label={S3.font.shadow} onChange={(c) => patch('shadow', c)} />
          <Num label={S3.font.offset} value={form.offset} min={1} max={100} step={5} unit="%" disabled={form.script === 'none'} onChange={(v) => patch('offset', v)} />
          <Num label={S3.font.spacing} value={form.spacing} min={-20} max={100} step={0.5} unit={S3.font.spacingUnit} onChange={(v) => patch('spacing', v)} />
        </fieldset>
        <div aria-label={S3.font.preview}><span style={previewStyle(form)}>{S3.font.previewText}</span></div>
      </div>
    </Dialog>
  );
}

export function ParagraphDialog({ ed, onClose }: DialogProps) {
  const [initial] = useState(() => paragraphForm(currentParagraph(ed)));
  const [form, setForm] = useState<ParagraphForm>(initial);
  const latest = useRef(form);
  const update = (fn: (f: ParagraphForm) => ParagraphForm): void => setForm((f) => { latest.current = fn(f); return latest.current; });
  const patch = <K extends keyof ParagraphForm>(key: K, value: ParagraphForm[K]): void => update((f) => ({ ...f, [key]: value }));
  const ok = (): void => {
    const changes = paragraphPatch(latest.current, initial);
    if (Object.keys(changes).length) applyParagraph(ed, changes, 'paragraph-dialog');
    onClose();
  };
  return (
    <Dialog open title={S3.paragraph.title} onClose={onClose} onConfirm={ok} width={480}>
      <div className="pub-form" data-testid="paragraph-dialog">
        <label className="pub-field"><span>{S3.paragraph.align}</span>
          <select value={form.align} onChange={(e) => patch('align', e.target.value as ParagraphForm['align'])}>
            {Object.entries(S3.paragraph.aligns).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>{S3.paragraph.indents}</legend>
          <Num label={S3.paragraph.beforeText} value={form.beforeText} min={0} max={50} step={0.1} unit={S3.paragraph.cm} onChange={(v) => patch('beforeText', v)} />
          <label className="pub-field"><span>{S3.paragraph.special}</span>
            <select value={form.special} onChange={(e) => update((f) => ({ ...f, special: e.target.value as SpecialIndent, specialBy: e.target.value !== 'none' && !f.specialBy ? 1.27 : f.specialBy }))}>
              {Object.entries(S3.paragraph.specials).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <Num label={S3.paragraph.by} value={form.specialBy} min={0} max={50} step={0.1} unit={S3.paragraph.cm} disabled={form.special === 'none'} onChange={(v) => patch('specialBy', v)} />
        </fieldset>
        <fieldset>
          <legend>{S3.paragraph.spacing}</legend>
          <Num label={S3.paragraph.before} value={form.spaceBefore} min={0} max={1584} step={1} unit={S3.paragraph.pt} onChange={(v) => patch('spaceBefore', v)} />
          <Num label={S3.paragraph.after} value={form.spaceAfter} min={0} max={1584} step={1} unit={S3.paragraph.pt} onChange={(v) => patch('spaceAfter', v)} />
          <label className="pub-field"><span>{S3.paragraph.lineSpacing}</span>
            <select value={form.lineMode} onChange={(e) => update((f) => ({ ...f, lineMode: e.target.value as ParagraphForm['lineMode'], lineValue: e.target.value === 'exact' ? 18 : 1 }))}>
              {Object.entries(S3.paragraph.lineModes).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <Num label={S3.paragraph.lineAt} value={form.lineValue} min={0.1} max={form.lineMode === 'exact' ? 1584 : 9.99} step={form.lineMode === 'exact' ? 1 : 0.05} unit={form.lineMode === 'exact' ? S3.paragraph.pt : undefined} onChange={(v) => patch('lineValue', v)} />
        </fieldset>
      </div>
    </Dialog>
  );
}

/** Taille et position de l'objet selectionne (cm, rotation, rapport verrouille). */
export function GeomDialog({ ed, onClose }: DialogProps) {
  const id = ed.selection.ids[0];
  const shape = id === undefined ? undefined : locate(ed.pageShapes, id)?.shape;
  const xfrm = shape && 'xfrm' in shape ? shape.xfrm : undefined;
  const [initial] = useState<GeomForm>(() => geomForm(xfrm ?? { x: 0, y: 0, width: 1, height: 1 }, true));
  const [form, setForm] = useState<GeomForm>(initial);
  const latest = useRef(form);
  const update = (next: GeomForm): void => { latest.current = next; setForm(next); };
  const ok = (): void => {
    const changes = geomPatch(latest.current, initial);
    if (Object.keys(changes).length && id !== undefined) {
      ed.editSelected((s) => { if ('xfrm' in s && s.xfrm) s.xfrm = { ...s.xfrm, ...changes }; }, 'geom');
    }
    onClose();
  };
  return (
    <Dialog open title={S3.geom.title} onClose={onClose} onConfirm={ok}>
      <div className="pub-form" data-testid="geom-dialog">
        <fieldset>
          <legend>{S3.geom.size}</legend>
          <Num label={S.dialogs.width} value={form.width} min={0.1} max={500} step={0.1} unit="cm" onChange={(v) => update(withWidth(latest.current, initial, v))} />
          <Num label={S.dialogs.height} value={form.height} min={0.1} max={500} step={0.1} unit="cm" onChange={(v) => update(withHeight(latest.current, initial, v))} />
          <Num label={S.dialogs.rotation} value={form.rotation} min={0} max={359.9} step={1} unit="°" onChange={(v) => update({ ...latest.current, rotation: normalizeRotation(v) })} />
          <Checkbox checked={form.lockRatio} label={S3.geom.lockRatio} onChange={(c) => update({ ...latest.current, lockRatio: c })} />
        </fieldset>
        <fieldset>
          <legend>{S3.geom.position}</legend>
          <Num label={S.dialogs.horizontal} value={form.x} min={-500} max={500} step={0.1} unit="cm" onChange={(v) => update({ ...latest.current, x: v })} />
          <Num label={S.dialogs.vertical} value={form.y} min={-500} max={500} step={0.1} unit="cm" onChange={(v) => update({ ...latest.current, y: v })} />
        </fieldset>
      </div>
    </Dialog>
  );
}
