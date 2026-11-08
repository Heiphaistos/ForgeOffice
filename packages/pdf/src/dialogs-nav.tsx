// Petites boîtes du module PDF : Aller à la page, Imprimer (plage de pages), Modifications non enregistrées.
import { useEffect, useState } from 'react';
import { Dialog, TextField } from '@forgeoffice/ui';
import { printPages, type PrintScope } from './printpages.ts';
import { pageFromInput } from './viewkeys.ts';
import { S } from './strings.ts';

export function GoToPageDialog({ open, pageCount, current, onGo, onClose }: { open: boolean; pageCount: number; current: number; onGo(page: number): void; onClose(): void }) {
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(String(current + 1)); }, [open, current]);
  const page = pageFromInput(text, pageCount);
  return (
    <Dialog open={open} title={S.nav.goTo} onClose={onClose} width={340}
      actions={[{ label: S.nav.go, primary: true, disabled: page === null, onClick: () => page !== null && onGo(page) }, { label: S.dialogs.cancel, onClick: onClose }]}>
      <TextField label={S.nav.goToLabel(pageCount)} value={text} inputMode="numeric" data-autofocus="" error={text !== '' && page === null ? S.nav.goToInvalid(pageCount) : undefined}
        onChange={(e) => setText(e.target.value)} />
    </Dialog>
  );
}

export interface PrintRequest {
  pages: number[] | null;
}

export function PrintDialog({ open, pageCount, current, selected, onPrint, onClose }: {
  open: boolean; pageCount: number; current: number; selected: readonly number[]; onPrint(r: PrintRequest): void; onClose(): void;
}) {
  const [scope, setScope] = useState<PrintScope>('all');
  const [range, setRange] = useState('');
  useEffect(() => { if (open) setScope('all'); }, [open]);
  let pages: number[] | null = null;
  let error: string | undefined;
  try {
    pages = printPages(scope, range, pageCount, current, selected);
  } catch (err) {
    error = scope === 'range' && range.trim() !== '' ? (err instanceof Error ? err.message : String(err)) : undefined;
    pages = [];
  }
  const blocked = scope === 'range' && (error !== undefined || range.trim() === '');
  const sel = selected.length > 0 && selected.length < pageCount ? selected.length : 0;
  return (
    <Dialog open={open} title={S.nav.printTitle} onClose={onClose} width={420}
      actions={[{ label: S.nav.printGo, primary: true, disabled: blocked, onClick: () => onPrint({ pages }) }, { label: S.dialogs.cancel, onClick: onClose }]}>
      <div className="pdf-form">
        <label className="pdf-field-row">
          <span>{S.nav.printScope}</span>
          <select className="pdf-select" value={scope} onChange={(e) => setScope(e.target.value as PrintScope)}>
            <option value="all">{S.nav.printAll}</option>
            <option value="current">{S.nav.printCurrent(current + 1)}</option>
            {sel > 0 && <option value="selected">{S.nav.printSelected(sel)}</option>}
            <option value="range">{S.nav.printRange}</option>
          </select>
        </label>
        {scope === 'range' && <TextField label={S.nav.printRange} value={range} placeholder={S.nav.printRangePlaceholder} error={error} data-autofocus="" onChange={(e) => setRange(e.target.value)} />}
      </div>
    </Dialog>
  );
}

export function DiscardDialog({ open, name, onSave, onDiscard, onClose }: { open: boolean; name: string; onSave(): void; onDiscard(): void; onClose(): void }) {
  return (
    <Dialog open={open} title={S.nav.discardTitle} onClose={onClose} width={420} description={S.nav.discardText(name)}
      actions={[{ label: S.nav.discardSave, primary: true, onClick: onSave }, { label: S.nav.discardDrop, onClick: onDiscard }, { label: S.nav.discardCancel, onClick: onClose }]}>
      <span />
    </Dialog>
  );
}
