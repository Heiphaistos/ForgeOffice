// Boîte « Options de suivi des modifications » : couleur et style des insertions, couleur des suppressions.
import { useState } from 'react';
import { Dialog } from '@forgeoffice/ui';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl, TrackOptions } from '../app/types.ts';
import { Row, Select } from '../dialogs/common.tsx';

const O = X.trackOptions;
export const TRACK_SETTING = 'word.track';

export function TrackOptionsDialog({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const [o, setO] = useState<TrackOptions>({ ...c.ui.trackOpts });
  const ok = (): void => {
    c.services.settings.set(TRACK_SETTING, o);
    c.setUi({ trackOpts: o });
    onClose();
  };
  const color = (label: string, value: string, on: (v: string) => void) => (
    <Row label={label}><input type="color" aria-label={label} value={value} onChange={(e) => on(e.target.value)} /></Row>
  );
  return (
    <Dialog open title={O.title} onClose={onClose} onConfirm={ok} width={420} actions={[{ label: T.dialogs.ok, primary: true, onClick: ok }, { label: T.dialogs.cancel, onClick: onClose }]}>
      <div className="fo-word-form fo-word-form--2">
        {color(O.insColor, o.insColor, (insColor) => setO({ ...o, insColor }))}
        <Row label={O.insStyle}><Select value={o.insStyle} label={O.insStyle} options={[['underline', O.underline], ['double', O.double], ['bold', O.bold], ['none', O.none]]} onChange={(insStyle) => setO({ ...o, insStyle })} /></Row>
        {color(O.delColor, o.delColor, (delColor) => setO({ ...o, delColor }))}
      </div>
      <p className="fo-word-hint">{O.hint}</p>
    </Dialog>
  );
}
