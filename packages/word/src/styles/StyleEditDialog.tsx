// Boite « Modifier le style » : nom, style de base, style suivant, police, paragraphe, galerie.
import { useState } from 'react';
import { Button, ColorPalette, Dialog, FontPicker, NumberField, TextField } from '@forgeoffice/ui';
import { styleDisplayName, type Alignment, type ParagraphProps, type RunProps, type Style } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { Check, Row, Select } from '../dialogs/common.tsx';
import { cmToPt, colorHex, ptToCm } from '../ribbon/shared.ts';
import { nameTaken, updateStyle } from './ops.ts';
import { TabsDialog } from '../format/TabsDialog.tsx';
import { BordersDialog } from '../format/BordersDialog.tsx';

const S = X.styles;

export function StyleEditDialog({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const style = c.meta.styles.styles.find((s) => s.id === c.ui.styleEdit);
  const [name, setName] = useState(style ? styleDisplayName(style) : '');
  const [basedOn, setBasedOn] = useState(style?.basedOn ?? '');
  const [next, setNext] = useState(style?.next ?? style?.id ?? '');
  const [run, setRun] = useState<RunProps>({ ...style?.run });
  const [para, setPara] = useState<ParagraphProps>({ ...style?.paragraph });
  const [gallery, setGallery] = useState(!!style?.quickFormat);
  const [sub, setSub] = useState<'tabs' | 'borders' | null>(null);
  if (!style) return <Dialog open title={S.edit} onClose={onClose} width={360} actions={[{ label: T.dialogs.close, primary: true, onClick: onClose }]}><p>{S.none}</p></Dialog>;
  const isPara = style.type === 'paragraph';
  const siblings = c.meta.styles.styles.filter((s) => s.type === style.type && s.id !== style.id && !s.hidden);
  const options = (withSelf: boolean): [string, string][] => [['', S.noBase], ...(withSelf ? [[style.id, S.itself] as [string, string]] : []), ...siblings.map((s): [string, string] => [s.id, styleDisplayName(s)])];
  const taken = style.custom ? nameTaken(c.meta, name, style.id) : false;
  const ok = (): void => {
    const patch: Partial<Style> = {
      basedOn: basedOn || undefined, next: isPara ? next || undefined : undefined, run, paragraph: isPara ? para : style.paragraph, quickFormat: gallery,
      ...(style.custom && name.trim() ? { name: name.trim() } : {}),
    };
    c.updateMeta((m) => updateStyle(m, style.id, patch));
    onClose();
  };
  const ls = para.lineSpacing ?? { rule: 'auto' as const, value: 1.08 };
  const aligns: [Alignment, string][] = [['left', T.cmd.alignLeft], ['center', T.cmd.center], ['right', T.cmd.alignRight], ['justify', T.cmd.justify]];
  return (
    <>
    <Dialog open title={`${S.edit} : ${styleDisplayName(style)}`} onClose={onClose} onConfirm={ok} width={540}
      footerStart={isPara ? <><Button onClick={() => setSub('tabs')}>{S.formatTabs}</Button><Button onClick={() => setSub('borders')}>{S.formatBorders}</Button></> : undefined} actions={[{ label: T.dialogs.ok, primary: true, onClick: ok, disabled: !name.trim() || taken }, { label: T.dialogs.cancel, onClick: onClose }]}>
      <div className="fo-word-form fo-word-form--2">
        <TextField label={S.name} value={name} disabled={!style.custom} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <Row label={S.basedOn}><Select value={basedOn} label={S.basedOn} options={options(false)} onChange={setBasedOn} /></Row>
        {isPara && <Row label={S.next}><Select value={next} label={S.next} options={options(true).filter(([id]) => id !== '')} onChange={setNext} /></Row>}
      </div>
      <fieldset className="fo-word-fieldset">
        <legend>{T.dialogs.font}</legend>
        <div className="fo-word-form fo-word-form--3">
          <Row label={T.dialogs.font}><FontPicker value={run.font ?? ''} width={160} onChange={(font) => setRun({ ...run, font, fontTheme: undefined })} /></Row>
          <Row label={T.dialogs.fontSize}><NumberField value={run.size ?? 11} min={1} max={400} step={0.5} unit="pt" width={90} label={T.dialogs.fontSize} onChange={(size) => setRun({ ...run, size })} /></Row>
        </div>
        <div className="fo-word-checks">
          <Check label={T.cmd.bold} checked={!!run.bold} onChange={(bold) => setRun({ ...run, bold: bold || undefined })} />
          <Check label={T.cmd.italic} checked={!!run.italic} onChange={(italic) => setRun({ ...run, italic: italic || undefined })} />
          <Check label={T.cmd.underline} checked={!!run.underline && run.underline !== 'none'} onChange={(u) => setRun({ ...run, underline: u ? 'single' : undefined })} />
        </div>
        <ColorPalette value={colorHex(run)} onPick={(hex) => setRun({ ...run, color: hex ? { rgb: hex.slice(1).toUpperCase() } : undefined })} />
      </fieldset>
      {isPara && (
        <fieldset className="fo-word-fieldset">
          <legend>{T.dialogs.paragraph}</legend>
          <div className="fo-word-form fo-word-form--3">
            <Row label={T.dialogs.alignment}><Select value={para.alignment ?? 'left'} label={T.dialogs.alignment} options={aligns} onChange={(alignment) => setPara({ ...para, alignment })} /></Row>
            <Row label={`${T.dialogs.left} (cm)`}><NumberField value={ptToCm(para.indentLeft ?? 0)} step={0.1} min={0} max={30} width={80} label={T.dialogs.left} onChange={(v) => setPara({ ...para, indentLeft: cmToPt(v) })} /></Row>
            <Row label={T.dialogs.lineSpacing}><NumberField value={ls.value} step={0.05} min={0.5} max={5} width={80} label={T.dialogs.lineSpacing} onChange={(value) => setPara({ ...para, lineSpacing: { rule: 'auto', value } })} /></Row>
            <Row label={T.dialogs.before}><NumberField value={para.spacingBefore ?? 0} step={6} min={0} max={200} width={80} label={T.dialogs.before} onChange={(spacingBefore) => setPara({ ...para, spacingBefore })} /></Row>
            <Row label={T.dialogs.after}><NumberField value={para.spacingAfter ?? 0} step={6} min={0} max={200} width={80} label={T.dialogs.after} onChange={(spacingAfter) => setPara({ ...para, spacingAfter })} /></Row>
          </div>
        </fieldset>
      )}
      <Check label={S.gallery} checked={gallery} onChange={setGallery} />
    </Dialog>
    {sub === 'tabs' && <TabsDialog c={c} target={{ value: para, apply: (patch) => setPara((p) => ({ ...p, ...patch })) }} onClose={() => setSub(null)} />}
    {sub === 'borders' && <BordersDialog c={c} target={{ value: para, apply: (patch) => setPara((p) => ({ ...p, ...patch })) }} onClose={() => setSub(null)} />}
    </>
  );
}
