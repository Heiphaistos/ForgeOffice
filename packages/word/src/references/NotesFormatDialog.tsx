// Boite « Notes de bas de page et de fin » : format du numéro et premier numéro de chaque type de note.
import { useState } from 'react';
import { Button, Dialog, NumberField } from '@forgeoffice/ui';
import { convertRefs, moveNotes, type NoteKind } from './convertNotes.ts';
import type { NoteNumbering } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { Row, Select } from '../dialogs/common.tsx';

const N = X.notesFormat;
const FORMATS: [string, string][] = [['decimal', '1, 2, 3…'], ['lowerRoman', 'i, ii, iii…'], ['upperRoman', 'I, II, III…'], ['lowerLetter', 'a, b, c…'], ['upperLetter', 'A, B, C…']];

function Block({ title, value, onChange, fallback }: { title: string; value: NoteNumbering; onChange: (v: NoteNumbering) => void; fallback: string }) {
  return (
    <fieldset className="fo-word-fieldset">
      <legend>{title}</legend>
      <div className="fo-word-form fo-word-form--2">
        <Row label={N.format}><Select value={value.format ?? fallback} label={`${title} : ${N.format}`} options={FORMATS} onChange={(format) => onChange({ ...value, format })} /></Row>
        <Row label={N.start}><NumberField value={value.start ?? 1} min={1} max={9999} step={1} width={90} label={`${title} : ${N.start}`} onChange={(start) => onChange({ ...value, start: Math.max(1, Math.round(start)) })} /></Row>
      </div>
    </fieldset>
  );
}

export function NotesFormatDialog({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const [fn, setFn] = useState<NoteNumbering>({ ...c.meta.settings.footnoteNumbering });
  const [en, setEn] = useState<NoteNumbering>({ ...c.meta.settings.endnoteNumbering });
  const ok = (): void => {
    c.updateMeta((m) => ({ ...m, settings: { ...m.settings, footnoteNumbering: fn, endnoteNumbering: en } }));
    onClose();
  };
  const convert = (from: NoteKind): void => {
    const { idMap } = moveNotes(c.meta, from);
    c.run(convertRefs(from, idMap));
    c.updateMeta((m) => moveNotes(m, from).meta);
    onClose();
  };
  const count = (k: NoteKind): number => (k === 'footnote' ? c.meta.footnotes : c.meta.endnotes).filter((n) => !n.special).length;
  return (
    <Dialog open title={N.title} onClose={onClose} onConfirm={ok} width={460} actions={[{ label: T.dialogs.ok, primary: true, onClick: ok }, { label: T.dialogs.cancel, onClick: onClose }]}>
      <Block title={N.footnotes} value={fn} onChange={setFn} fallback="decimal" />
      <Block title={N.endnotes} value={en} onChange={setEn} fallback="lowerRoman" />
      <fieldset className="fo-word-fieldset">
        <legend>{N.convert}</legend>
        <div className="fo-word-tabbtns">
          <Button disabled={count('footnote') === 0} onClick={() => convert('footnote')}>{N.toEndnotes}</Button>
          <Button disabled={count('endnote') === 0} onClick={() => convert('endnote')}>{N.toFootnotes}</Button>
        </div>
      </fieldset>
    </Dialog>
  );
}
