// Section repliable du volet Format et champ couleur avec transparence, partages par les sections.
import { useState, type ReactNode } from 'react';
import { Button, NumberField } from '@forgeoffice/ui';
import type { Color } from '@forgeoffice/pptx';
import { S3 } from '../strings-text.ts';
import type { Editor } from '../editor.ts';
import { colorFromHex, hexOf } from '../format.ts';
import { ColorDialog } from '../dialogs-color.tsx';
import { transparencyOf, withTransparency } from './format-model.ts';

export function Section({ title, children, open = true, testId }: { title: string; children: ReactNode; open?: boolean; testId?: string }) {
  return (
    <details className="pp-pane__section" open={open} data-testid={testId}>
      <summary>{title}</summary>
      <div className="pp-pane__body">{children}</div>
    </details>
  );
}

/** Couleur (sélecteur) et transparence en %. */
export function ColorField({ ed, label, value, onChange, transparency = true }: { ed: Editor; label: string; value: Color; onChange: (c: Color) => void; transparency?: boolean }) {
  const pct = transparencyOf(value);
  const [open, setOpen] = useState(false);
  return (
    <div className="pp-form">
      <label>{label}</label>
      <div className="pp-form__row">
        <input type="color" aria-label={label} value={hexOf(ed, value)} onChange={(e) => onChange(withTransparency(colorFromHex(ed, e.target.value), pct))} />
        <Button size="small" aria-label={`${S3.colors.more} (${label})`} onClick={() => setOpen(true)}>{S3.colors.more}</Button>
      </div>
      {open && <ColorDialog value={hexOf(ed, value)} onClose={() => setOpen(false)} onPick={(hex) => onChange(withTransparency(colorFromHex(ed, hex), pct))} />}
      {transparency && (
        <>
          <label>{S3.format.transparency}</label>
          <NumberField value={pct} min={0} max={100} step={5} unit="%" width={100} onChange={(v) => onChange(withTransparency(value, v))} label={`${label} – ${S3.format.transparency}`} />
        </>
      )}
    </div>
  );
}
