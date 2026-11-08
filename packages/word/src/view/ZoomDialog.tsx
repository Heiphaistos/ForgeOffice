// Boite « Zoom » : 200 %, 100 %, 75 %, largeur de page, pleine page, plusieurs pages, pourcentage libre.
import { useState } from 'react';
import { Dialog, NumberField } from '@forgeoffice/ui';
import { X } from '../strings-extra.ts';
import { T } from '../strings.ts';
import type { Ctl } from '../app/types.ts';
import { fitZoom } from './zoom.ts';

const Z = X.zoom;
type Choice = '200' | '100' | '75' | 'width' | 'page' | 'multi' | 'custom';
const PT_TO_PX = 4 / 3;

export function ZoomDialog({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const initial: Choice = c.ui.multiPage ? 'multi' : ['200', '100', '75'].includes(String(c.ui.zoom)) ? String(c.ui.zoom) as Choice : 'custom';
  const [choice, setChoice] = useState<Choice>(initial);
  const [pct, setPct] = useState(c.ui.zoom);
  const viewport = (): { width: number; height: number } => {
    const el = document.querySelector('.fo-word-canvas');
    return { width: el?.clientWidth ?? 900, height: el?.clientHeight ?? 700 };
  };
  const ok = (): void => {
    const page = { width: c.section.pageWidth * PT_TO_PX, height: c.section.pageHeight * PT_TO_PX };
    if (choice === 'multi') c.setUi({ multiPage: true, view: 'print' });
    else if (choice === 'width' || choice === 'page') c.setUi({ zoom: fitZoom(choice, viewport(), page), multiPage: false });
    else c.setUi({ zoom: choice === 'custom' ? pct : Number(choice), multiPage: false });
    onClose();
  };
  const options: [Choice, string][] = [['200', '200 %'], ['100', '100 %'], ['75', '75 %'], ['width', Z.width], ['page', Z.page], ['multi', Z.multi], ['custom', Z.percent]];
  return (
    <Dialog open title={Z.title} onClose={onClose} onConfirm={ok} width={360} actions={[{ label: T.dialogs.ok, primary: true, onClick: ok }, { label: T.dialogs.cancel, onClick: onClose }]}>
      <div className="fo-word-radios" role="radiogroup" aria-label={Z.title}>
        {options.map(([id, label]) => (
          <label key={id} className="fo-word-check"><input type="radio" name="zoom" checked={choice === id} onChange={() => setChoice(id)} />{label}
            {id === 'custom' && <NumberField value={pct} min={10} max={500} step={10} unit="%" label={Z.percent} width={96} disabled={choice !== 'custom'} onChange={setPct} />}
          </label>
        ))}
      </div>
    </Dialog>
  );
}
