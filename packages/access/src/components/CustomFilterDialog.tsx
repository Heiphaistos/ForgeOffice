// Boite « Filtre personnalise » : une ou deux valeurs selon l'option choisie, controlees avant d'appliquer le filtre.
import { useEffect, useState } from 'react';
import { Dialog, TextField } from '@forgeoffice/ui';
import { buildCustomFilter, type CustomFilterOption, type FilterFamily } from '../logic/custom-filter.ts';
import { F } from '../strings-filter.ts';
import type { Filtre } from '../types.ts';

interface Props {
  /** null = fermee. */
  request: { champ: string; label: string; family: FilterFamily; option: CustomFilterOption } | null;
  onCancel: () => void;
  onApply: (filter: Filtre) => void;
}

export function CustomFilterDialog({ request, onCancel, onApply }: Props) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setA('');
    setB('');
    setError(null);
  }, [request]);
  if (!request) return null;
  const { option, family } = request;
  const submit = (): void => {
    const r = buildCustomFilter(request.champ, option, family, a, b);
    if (r.ok) onApply(r.filter);
    else setError(F.errors[r.error]);
  };
  return (
    <Dialog
      open
      title={F.title(F.menu[family], F.options[option.id] ?? option.id)}
      description={F.field(request.label)}
      width={420}
      onClose={onCancel}
      onConfirm={submit}
      actions={[{ label: F.ok, primary: true, onClick: submit }, { label: F.cancel, onClick: onCancel }]}
    >
      {option.values >= 1 && <TextField label={option.values === 2 ? F.from : F.value} value={a} data-autofocus error={error ?? undefined} onChange={(e) => { setA(e.currentTarget.value); setError(null); }} />}
      {option.values === 2 && <TextField label={F.to} value={b} onChange={(e) => { setB(e.currentTarget.value); setError(null); }} />}
    </Dialog>
  );
}
