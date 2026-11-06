// Boites de dialogue de la signature numerique (choix du certificat) et de la confirmation d'ouverture d'un lien.
import { useRef, useState } from 'react';
import { Checkbox, Dialog, TextField } from '@forgeoffice/ui';
import { linkLabel } from './links.ts';
import { S } from './strings.ts';

export interface DigitalSignResult {
  pfx: Uint8Array;
  password: string;
  reason: string;
  location: string;
  visible: boolean;
}

export function DigitalSignDialog({ alreadySigned, onClose, onApply }: { alreadySigned: boolean; onClose(): void; onApply(r: DigitalSignResult): void }) {
  const [pfx, setPfx] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [location, setLocation] = useState('');
  const [visible, setVisible] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const actions = [
    { label: S.sign.title, primary: true, disabled: pfx === null || password === '', onClick: () => pfx && onApply({ pfx: pfx.bytes, password, reason, location, visible }) },
    { label: S.dialogs.cancel, onClick: onClose },
  ];
  return (
    <Dialog open title={S.sign.title} onClose={onClose} width={480} actions={actions}>
      <div className="pdf-form">
        <div className="pdf-field-row">
          <span>{S.sign.certificate}</span>
          <div className="pdf-filepick">
            <button type="button" className="pdf-link" onClick={() => input.current?.click()}>{S.sign.choose}</button>
            <span className="pdf-muted">{pfx?.name ?? S.sign.noFile}</span>
            <input ref={input} type="file" accept=".pfx,.p12" hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void f.arrayBuffer().then((b) => setPfx({ name: f.name, bytes: new Uint8Array(b) }));
              }} />
          </div>
        </div>
        <TextField label={S.sign.password} type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
        <TextField label={S.sign.reason} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        <TextField label={S.sign.location} value={location} maxLength={200} onChange={(e) => setLocation(e.target.value)} />
        <Checkbox label={S.sign.visible} checked={visible} onChange={setVisible} />
        <p className="pdf-muted">{S.sign.rewrite}</p>
        {alreadySigned && <p className="pdf-warn">{S.sign.replaceWarn}</p>}
      </div>
    </Dialog>
  );
}

export function LinkDialog({ url, onClose, onOpen }: { url: string; onClose(): void; onOpen(url: string): void }) {
  return (
    <Dialog open title={S.links.confirmTitle} onClose={onClose} width={440}
      actions={[{ label: S.links.open, primary: true, onClick: () => onOpen(url) }, { label: S.dialogs.cancel, onClick: onClose }]}>
      <div className="pdf-form">
        <p>{S.links.confirmText(linkLabel(url))}</p>
        <p className="pdf-muted pdf-linkurl">{url}</p>
      </div>
    </Dialog>
  );
}
