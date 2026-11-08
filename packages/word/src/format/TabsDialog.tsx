// Boite « Tabulations » : taquets du paragraphe (position, alignement, points de suite) et tabulation par defaut.
import { useState } from 'react';
import { Button, Dialog, NumberField } from '@forgeoffice/ui';
import type { ParagraphProps, TabStop } from '@forgeoffice/docx';
import { X } from '../strings-extra.ts';
import { T } from '../strings.ts';
import type { Ctl } from '../app/types.ts';
import { Row, Select } from '../dialogs/common.tsx';
import { setParagraph } from '../editor/commands.ts';
import { clearStop, setStop } from '../features/tabstops.ts';
import { cmToPt, ptToCm } from '../ribbon/shared.ts';

const L = X.tabs;
type Leader = NonNullable<TabStop['leader']>;
type Align = Exclude<TabStop['align'], 'clear'>;

/** `target` : edite les taquets d'un style (valeur + application) au lieu du paragraphe du curseur. */
export interface ParaTarget { value: ParagraphProps; apply: (patch: Partial<ParagraphProps>) => void }

export function TabsDialog({ c, onClose, target }: { c: Ctl; onClose: () => void; target?: ParaTarget }) {
  const [tabs, setTabs] = useState<TabStop[]>(((target?.value ?? c.sel.para).tabs ?? []).filter((t) => t.align !== 'clear'));
  const [pos, setPos] = useState(ptToCm(tabs[0]?.position ?? 2 * 28.35));
  const [align, setAlign] = useState<Align>('left');
  const [leader, setLeader] = useState<Leader>('none');
  const [step, setStep] = useState(ptToCm(c.meta.settings.defaultTabStop));
  const label = (t: TabStop): string => `${ptToCm(t.position).toLocaleString('fr-FR')} cm — ${L[t.align === 'clear' ? 'left' : t.align]}`;
  const pick = (t: TabStop): void => { setPos(ptToCm(t.position)); setAlign(t.align === 'clear' ? 'left' : t.align); setLeader(t.leader ?? 'none'); };
  const define = (): void => setTabs((cur) => setStop(cur, { position: cmToPt(pos), align, leader }));
  const ok = (): void => {
    if (target) target.apply({ tabs: tabs.length ? tabs : undefined });
    else c.run(setParagraph({ props: (p) => ({ ...p, tabs: tabs.length ? tabs : undefined }) }));
    const defaultTabStop = cmToPt(step);
    if (defaultTabStop > 0 && Math.abs(defaultTabStop - c.meta.settings.defaultTabStop) > 0.01) c.updateMeta((m) => ({ ...m, settings: { ...m.settings, defaultTabStop } }));
    onClose();
  };
  return (
    <Dialog open title={L.title} onClose={onClose} onConfirm={ok} width={460} actions={[{ label: T.dialogs.ok, primary: true, onClick: ok }, { label: T.dialogs.cancel, onClick: onClose }]}>
      <div className="fo-word-form fo-word-form--2">
        <Row label={L.position}><NumberField value={pos} min={0} max={50} step={0.25} label={L.position} width={90} onChange={setPos} /></Row>
        <Row label={L.defaultStop}><NumberField value={step} min={0.1} max={20} step={0.1} label={L.defaultStop} width={90} onChange={setStep} /></Row>
        <Row label={L.alignment}><Select value={align} label={L.alignment} options={[['left', L.left], ['center', L.center], ['right', L.right], ['decimal', L.decimal], ['bar', L.bar]]} onChange={setAlign} /></Row>
        <Row label={L.leader}><Select value={leader} label={L.leader} options={[['none', L.none], ['dot', L.dots], ['hyphen', L.dashes], ['underscore', L.underscore]]} onChange={setLeader} /></Row>
      </div>
      <fieldset className="fo-word-fieldset">
        <legend>{L.listed}</legend>
        <ul className="fo-word-tablist" aria-label={L.listed}>
          {tabs.length === 0 && <li className="is-empty">{L.empty}</li>}
          {tabs.map((t) => <li key={t.position}><button type="button" onClick={() => pick(t)}>{label(t)}</button></li>)}
        </ul>
        <div className="fo-word-tabbtns">
          <Button onClick={define}>{L.set}</Button>
          <Button onClick={() => setTabs((cur) => clearStop(cur, cmToPt(pos)))}>{L.clear}</Button>
          <Button onClick={() => setTabs([])}>{L.clearAll}</Button>
        </div>
      </fieldset>
    </Dialog>
  );
}
