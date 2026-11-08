// Boite « Numéros de ligne » : début, pas de comptage, redémarrage (continue, chaque page, chaque section).
import { useState } from 'react';
import { Dialog, NumberField } from '@forgeoffice/ui';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { Check, Row, Select } from '../dialogs/common.tsx';

const L = X.lineNo;
type Restart = 'continuous' | 'newPage' | 'newSection';

export function LineNumbersDialog({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const cur = c.section.lineNumbering;
  const [on, setOn] = useState(!!cur);
  const [start, setStart] = useState(cur?.start ?? 1);
  const [countBy, setCountBy] = useState(cur?.countBy ?? 1);
  const [restart, setRestart] = useState<Restart>(cur?.restart ?? 'continuous');
  const ok = (): void => {
    c.act.setSection({ lineNumbering: on ? { countBy: Math.max(1, Math.round(countBy)), start: Math.max(1, Math.round(start)), restart } : undefined });
    onClose();
  };
  return (
    <Dialog open title={L.title} onClose={onClose} onConfirm={ok} width={400} actions={[{ label: T.dialogs.ok, primary: true, onClick: ok }, { label: T.dialogs.cancel, onClick: onClose }]}>
      <div className="fo-word-form">
        <Check label={L.enable} checked={on} onChange={setOn} />
        <Row label={L.start}><NumberField value={start} min={1} max={9999} step={1} label={L.start} width={90} disabled={!on} onChange={setStart} /></Row>
        <Row label={L.countBy}><NumberField value={countBy} min={1} max={100} step={1} label={L.countBy} width={90} disabled={!on} onChange={setCountBy} /></Row>
        <Row label={L.restart}><Select value={restart} label={L.restart} options={[['continuous', L.continuous], ['newPage', L.newPage], ['newSection', L.newSection]]} onChange={setRestart} /></Row>
      </div>
    </Dialog>
  );
}
