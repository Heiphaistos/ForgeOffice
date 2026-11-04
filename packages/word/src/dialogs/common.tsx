// Petits elements partages par les boites de dialogue (lignes de formulaire, listes deroulantes).
import type { ReactNode } from 'react';

export function Row({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="fo-word-form__row">
      <label htmlFor={htmlFor}>{label}</label>
      <div>{children}</div>
    </div>
  );
}

export function Select<V extends string>({ id, value, options, onChange, label }: { id?: string; value: V; options: readonly (readonly [V, string])[]; onChange: (v: V) => void; label?: string }) {
  return (
    <select id={id} className="fo-word-select" value={value} aria-label={label} onChange={(e) => onChange(e.target.value as V)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="fo-word-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export interface DialogBodyProps {
  onClose: () => void;
}
