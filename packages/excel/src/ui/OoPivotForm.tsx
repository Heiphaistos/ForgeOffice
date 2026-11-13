// Panneau « Parametres du tableau croise dynamique » du profil OnlyOffice : liste des champs a cocher, puis les quatre zones (Filtres, Colonnes, Lignes, Valeurs).
import { useState } from 'react';
import { Checkbox, Icon } from '@forgeoffice/ui';
import type { PivotDef } from '../logic/pivot.ts';
import { pivotMove, pivotToggle, pivotUsed } from './Panes.tsx';

type Area = 'filters' | 'cols' | 'rows' | 'values';

export function OoPivotForm({ fields, numeric, def, onChange }: { fields: string[]; numeric: readonly boolean[]; def: PivotDef; onChange: (def: PivotDef) => void }) {
  const [drag, setDrag] = useState<number | null>(null);
  const zone = (id: Area, label: string, items: readonly number[]) => (
    <div className="fo-oo-pv__zone" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) onChange(pivotMove(def, drag, id)); setDrag(null); }}>
      <h3 className="fo-oo-form__title">{label}</h3>
      <div className="fo-oo-pv__box">
        {items.map((f) => (
          <div key={f} className="fo-oo-pv__chip" draggable onDragStart={() => setDrag(f)}>
            <span title={fields[f]}>{fields[f]}</span>
            <select aria-label={`Déplacer ${fields[f] ?? ''}`} value={id} onChange={(e) => onChange(pivotMove(def, f, e.target.value as Area))}>
              <option value="filters">Filtres</option><option value="cols">Colonnes</option><option value="rows">Lignes</option><option value="values">Valeurs</option>
            </select>
            <button type="button" aria-label={`Retirer ${fields[f] ?? ''}`} onClick={() => onChange(pivotToggle(def, numeric, f, false))}><Icon name="dismiss" size={10} /></button>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="fo-oo-pv">
      <h3 className="fo-oo-form__title">Sélectionner les champs</h3>
      <div className="fo-oo-pv__fields">
        {fields.map((f, i) => (
          <div key={`${f}-${i}`} draggable onDragStart={() => setDrag(i)}>
            <Checkbox checked={pivotUsed(def, i)} onChange={(v) => onChange(pivotToggle(def, numeric, i, v))} label={f} />
          </div>
        ))}
      </div>
      <div className="fo-oo-pv__grid">
        {zone('filters', 'Filtres', def.filters.map((f) => f.field))}
        {zone('cols', 'Colonnes', def.cols)}
        {zone('rows', 'Lignes', def.rows)}
        {zone('values', 'Valeurs', def.values.map((v) => v.field))}
      </div>
    </div>
  );
}
