// Boites de dialogue de l'application : confirmation, saisie d'un nom, importation de donnees externes.
import { useEffect, useState } from 'react';
import { Checkbox, Dialog, TextField } from '@forgeoffice/ui';
import { validateName } from '../logic/values.ts';
import { S } from '../strings.ts';

export type Ask =
  | { kind: 'confirm'; title: string; message: string; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; title: string; label: string; initial: string; resolve: (v: string | null) => void };

export function AskDialog({ ask, onDone }: { ask: Ask | null; onDone: () => void }) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (ask?.kind === 'prompt') setText(ask.initial);
  }, [ask]);
  if (!ask) return null;
  if (ask.kind === 'confirm') {
    const close = (ok: boolean) => () => {
      ask.resolve(ok);
      onDone();
    };
    return (
      <Dialog open title={ask.title} onClose={close(false)} actions={[{ label: S.ds.yes, primary: true, onClick: close(true) }, { label: S.ds.no, onClick: close(false) }]}>
        {ask.message.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
      </Dialog>
    );
  }
  const error = validateName(text);
  const ok = (): void => {
    if (error) return;
    ask.resolve(text.trim());
    onDone();
  };
  return (
    <Dialog
      open
      title={ask.title}
      onClose={() => {
        ask.resolve(null);
        onDone();
      }}
      actions={[{ label: S.dlg.ok, primary: true, disabled: error !== null, onClick: ok }, { label: S.dlg.cancel, onClick: () => { ask.resolve(null); onDone(); } }]}
    >
      <TextField label={ask.label} value={text} data-autofocus error={text !== ask.initial ? (error ?? undefined) : undefined} onChange={(e) => setText(e.currentTarget.value)} />
    </Dialog>
  );
}

export interface ImportChoice {
  table: string;
  mode: 'creer_table' | 'ajouter' | 'remplacer';
  header: boolean;
  autoKey: boolean;
}

interface ImportProps {
  kind: string;
  fileName: string;
  tables: readonly string[];
  onImport: (c: ImportChoice) => void;
  onClose: () => void;
}

export function ImportDialog({ kind, fileName, tables, onImport, onClose }: ImportProps) {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[.!`[\]]/g, '_').slice(0, 64) || 'Import';
  const [c, setC] = useState<ImportChoice>({ table: base, mode: 'creer_table', header: true, autoKey: true });
  const [target, setTarget] = useState(tables[0] ?? '');
  const choice: ImportChoice = c.mode === 'creer_table' ? c : { ...c, table: target };
  const error = c.mode === 'creer_table' ? validateName(c.table) : target ? null : S.err.nameEmpty;
  return (
    <Dialog
      open
      title={S.ext.importTitle(kind)}
      width={560}
      onClose={onClose}
      actions={[{ label: S.ext.import, primary: true, disabled: error !== null, onClick: () => onImport(choice) }, { label: S.dlg.cancel, onClick: onClose }]}
    >
      <TextField label={S.ext.source} value={fileName} readOnly />
      <div className="acc-radios">
        <label>
          <input type="radio" name="acc-imp" checked={c.mode === 'creer_table'} onChange={() => setC({ ...c, mode: 'creer_table' })} />
          {S.ext.modeNew}
        </label>
        {c.mode === 'creer_table' && <TextField label={S.ext.table} value={c.table} error={error ?? undefined} onChange={(e) => setC({ ...c, table: e.currentTarget.value })} />}
        <label>
          <input type="radio" name="acc-imp" checked={c.mode === 'ajouter'} disabled={tables.length === 0} onChange={() => setC({ ...c, mode: 'ajouter' })} />
          {S.ext.modeAppend}
        </label>
        <label>
          <input type="radio" name="acc-imp" checked={c.mode === 'remplacer'} disabled={tables.length === 0} onChange={() => setC({ ...c, mode: 'remplacer' })} />
          {S.ext.modeReplace}
        </label>
        {c.mode !== 'creer_table' && (
          <select value={target} aria-label={S.ext.table} onChange={(e) => setTarget(e.currentTarget.value)}>
            {tables.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
      </div>
      <Checkbox checked={c.header} label={S.ext.header} onChange={(v) => setC({ ...c, header: v })} />
      {c.mode === 'creer_table' && <Checkbox checked={c.autoKey} label={S.ext.autoKey} onChange={(v) => setC({ ...c, autoKey: v })} />}
    </Dialog>
  );
}
