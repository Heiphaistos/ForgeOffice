// Boîte « Restreindre la modification » : lecture seule ou suivi obligatoire, avec mot de passe facultatif (empreinte SHA-512 comme Word).
import { useState } from 'react';
import { Dialog, TextField } from '@forgeoffice/ui';
import { hashPassword, verifyPassword } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { Row, Select } from '../dialogs/common.tsx';

const P = X.protect;
type Kind = 'readOnly' | 'trackedChanges' | 'comments' | 'forms';

export function ProtectDialog({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const current = c.meta.settings.protection;
  const active = !!current?.enforced;
  const [kind, setKind] = useState<Kind>(current?.kind === 'trackedChanges' || current?.kind === 'comments' || current?.kind === 'forms' ? current.kind : 'readOnly');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const stop = async (): Promise<void> => {
    if (current?.password && !(await verifyPassword(pw, current.password))) return setError(P.wrong);
    c.updateMeta((m) => ({ ...m, settings: { ...m.settings, protection: undefined } }));
    c.setUi({ readOnly: false });
    onClose();
  };
  const start = async (): Promise<void> => {
    if (pw !== pw2) return setError(P.mismatch);
    const password = pw ? await hashPassword(pw) : undefined;
    c.updateMeta((m) => ({ ...m, settings: { ...m.settings, trackRevisions: kind === 'trackedChanges' ? true : m.settings.trackRevisions, protection: { kind, enforced: true, ...(password ? { password } : {}) } } }));
    c.setUi({ readOnly: kind === 'readOnly' || kind === 'comments' });
    onClose();
  };
  const ok = (): void => {
    setBusy(true);
    setError('');
    void (active ? stop() : start()).finally(() => setBusy(false));
  };
  return (
    <Dialog open title={active ? P.stopTitle : P.title} onClose={onClose} onConfirm={ok} width={440}
      actions={[{ label: active ? P.stop : P.start, primary: true, onClick: ok, disabled: busy }, { label: T.dialogs.cancel, onClick: onClose }]}>
      <div className="fo-word-form">
        {!active && <Row label={P.kind}><Select value={kind} label={P.kind} options={[['readOnly', P.readOnly], ['comments', P.comments], ['forms', P.forms], ['trackedChanges', P.tracked]]} onChange={setKind} /></Row>}
        {active && <p className="fo-word-hint">{current?.password ? P.needPassword : P.noPassword}</p>}
        {(!active || current?.password) && <TextField label={P.password} type="password" value={pw} autoComplete="off" onChange={(e) => setPw(e.target.value)} />}
        {!active && <TextField label={P.confirm} type="password" value={pw2} autoComplete="off" onChange={(e) => setPw2(e.target.value)} />}
        {error && <p role="alert" className="fo-word-hint fo-word-hint--error">{error}</p>}
        {!active && <p className="fo-word-hint">{P.hint}</p>}
      </div>
    </Dialog>
  );
}
