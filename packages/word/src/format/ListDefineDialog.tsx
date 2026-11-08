// Boite « Définir une nouvelle liste à plusieurs niveaux » : format, gabarit du numéro, début et retraits de chacun des 9 niveaux.
import { useState } from 'react';
import { Dialog, NumberField, TextField } from '@forgeoffice/ui';
import type { NumberFormat, NumberingLevel } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { Row, Select } from '../dialogs/common.tsx';
import { defaultCustomLevels } from '../features/lists.ts';
import { templateValid } from './listTemplate.ts';
import { cmToPt, ptToCm } from '../ribbon/shared.ts';

const L = X.listDefine;
const FORMATS: [NumberFormat, string][] = [['decimal', '1, 2, 3…'], ['lowerLetter', 'a, b, c…'], ['upperLetter', 'A, B, C…'], ['lowerRoman', 'i, ii, iii…'], ['upperRoman', 'I, II, III…'], ['bullet', L.bullet]];

export function ListDefineDialog({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const [levels, setLevels] = useState<NumberingLevel[]>(defaultCustomLevels);
  const [index, setIndex] = useState(0);
  const cur = levels[index]!;
  const set = (patch: Partial<NumberingLevel>): void => setLevels((all) => all.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const setPara = (indentLeft: number, hanging: number): void => set({ paragraph: { ...cur.paragraph, indentLeft: cmToPt(indentLeft), indentFirstLine: -cmToPt(hanging) } });
  const valid = levels.every((l, i) => l.format === 'bullet' || templateValid(l.text, i));
  const ok = (): void => {
    c.act.list({ kind: 'custom', levels });
    onClose();
  };
  return (
    <Dialog open title={L.title} onClose={onClose} onConfirm={ok} width={480} actions={[{ label: T.dialogs.ok, primary: true, onClick: ok, disabled: !valid }, { label: T.dialogs.cancel, onClick: onClose }]}>
      <div className="fo-word-form fo-word-form--2">
        <Row label={L.level}><Select value={String(index)} label={L.level} options={levels.map((_, i): [string, string] => [String(i), `${i + 1}`])} onChange={(v) => setIndex(Number(v))} /></Row>
        <Row label={L.format}><Select value={cur.format} label={L.format} options={FORMATS} onChange={(format) => set({ format, text: format === 'bullet' ? '•' : cur.format === 'bullet' ? `%${index + 1}.` : cur.text, run: format === 'bullet' ? { font: 'Segoe UI Symbol' } : undefined })} /></Row>
        <TextField label={L.template} value={cur.text} maxLength={30} onChange={(e) => set({ text: e.target.value })} />
        <Row label={L.start}><NumberField value={cur.start} min={0} max={9999} step={1} label={L.start} width={90} disabled={cur.format === 'bullet'} onChange={(start) => set({ start: Math.round(start) })} /></Row>
        <Row label={L.indent}><NumberField value={ptToCm(cur.paragraph?.indentLeft ?? 0)} min={0} max={20} step={0.1} label={L.indent} width={90} onChange={(v) => setPara(v, ptToCm(-(cur.paragraph?.indentFirstLine ?? -18)))} /></Row>
        <Row label={L.hanging}><NumberField value={ptToCm(-(cur.paragraph?.indentFirstLine ?? -18))} min={0} max={10} step={0.1} label={L.hanging} width={90} onChange={(v) => setPara(ptToCm(cur.paragraph?.indentLeft ?? 0), v)} /></Row>
      </div>
      <p className="fo-word-hint">{valid ? L.hint : L.invalid}</p>
    </Dialog>
  );
}
