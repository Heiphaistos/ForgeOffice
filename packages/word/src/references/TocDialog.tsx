// Boite « Table des matieres » : numeros de page, alignement a droite, caractere de suite, niveaux, liens.
import { useState } from 'react';
import { Dialog, NumberField } from '@forgeoffice/ui';
import { X } from '../strings-extra.ts';
import { T } from '../strings.ts';
import type { Ctl } from '../app/types.ts';
import { Check, Row, Select } from '../dialogs/common.tsx';
import { DEFAULT_TOC, existingTocOptions, type TocOptions } from '../features/toc.ts';

const L = X.toc;

export function TocDialog({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const existing = c.state() ? existingTocOptions(c.state()!.doc) : null;
  const [o, setO] = useState<TocOptions>(existing ?? DEFAULT_TOC);
  const set = (patch: Partial<TocOptions>): void => setO((cur) => ({ ...cur, ...patch }));
  const ok = (): void => {
    c.act.insertToc(o);
    onClose();
  };
  return (
    <Dialog open title={L.title} onClose={onClose} onConfirm={ok} width={420} actions={[{ label: T.dialogs.ok, primary: true, onClick: ok }, { label: T.dialogs.cancel, onClick: onClose }]}>
      <div className="fo-word-form">
        <Check label={L.pageNumbers} checked={o.pageNumbers} onChange={(pageNumbers) => set({ pageNumbers })} />
        <Check label={L.rightAlign} checked={o.rightAlign} onChange={(rightAlign) => set({ rightAlign })} />
        <Row label={L.leader}>
          <Select value={o.leader} label={L.leader} options={[['dot', L.dots], ['hyphen', L.dashes], ['underscore', L.line], ['none', L.none]]} onChange={(leader) => set({ leader })} />
        </Row>
        <Check label={L.hyperlinks} checked={o.hyperlinks} onChange={(hyperlinks) => set({ hyperlinks })} />
        <Row label={L.levels}><NumberField value={o.levels} min={1} max={9} step={1} label={L.levels} width={80} onChange={(levels) => set({ levels: Math.round(levels) })} /></Row>
      </div>
    </Dialog>
  );
}
