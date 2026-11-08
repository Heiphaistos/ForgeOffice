// Boîte « Paramètres du diaporama » : type, boucle, sans animation, plage de diapositives, avancement.
import { useState } from 'react';
import { Checkbox, Dialog, NumberField } from '@forgeoffice/ui';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';
import type { Editor } from './editor.ts';
import { fromShowProps, toShowProps, type ShowSettings } from './show-settings.ts';

export function ShowSetupDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [form, setForm] = useState<ShowSettings>(() => fromShowProps(ed.deck.show));
  const total = ed.deck.slides.length;
  const patch = <K extends keyof ShowSettings>(key: K, value: ShowSettings[K]): void => setForm((f) => ({ ...f, [key]: value }));
  const ranged = form.from > 0 || form.to > 0;
  const ok = (): void => {
    const from = Math.min(form.from, total);
    const to = Math.min(form.to, total);
    const show = toShowProps({ ...form, from, to: to && to < from ? from : to });
    const next = { ...ed.deck };
    if (show) next.show = show;
    else delete next.show;
    ed.commit(next, 'show-setup');
    onClose();
  };
  const T = S3.show;
  return (
    <Dialog open title={T.title} onClose={onClose} onConfirm={ok} width={460} actions={[{ label: S.common.ok, primary: true, onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <div className="pp-stack" data-testid="show-dialog">
        <fieldset className="pp-group">
          <legend>{T.type}</legend>
          <label className="pp-radio"><input type="radio" name="pp-show-mode" checked={form.mode === 'speaker'} onChange={() => patch('mode', 'speaker')} /> {T.speaker}</label>
          <label className="pp-radio"><input type="radio" name="pp-show-mode" checked={form.mode === 'kiosk'} onChange={() => patch('mode', 'kiosk')} /> {T.kiosk}</label>
        </fieldset>
        <fieldset className="pp-group">
          <legend>{T.options}</legend>
          <div className="pp-stack">
            <Checkbox checked={form.loop || form.mode === 'kiosk'} disabled={form.mode === 'kiosk'} label={T.loop} onChange={(c) => patch('loop', c)} />
            <Checkbox checked={form.noAnimation} label={T.noAnimation} onChange={(c) => patch('noAnimation', c)} />
          </div>
        </fieldset>
        {!!ed.deck.customShows?.length && (
          <fieldset className="pp-group">
            <legend>{S3.customShow.menu}</legend>
            <select aria-label={S3.customShow.menu} value={form.customShowId ?? ''} onChange={(e) => setForm((f) => ({ ...f, customShowId: e.target.value === '' ? undefined : Number(e.target.value) }))} data-testid="show-custom-select">
              <option value="">{T.noCustom}</option>
              {ed.deck.customShows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </fieldset>
        )}
        <fieldset className="pp-group">
          <legend>{T.slides}</legend>
          <div className="pp-form__row">
            <label className="pp-radio"><input type="radio" name="pp-show-range" checked={!ranged} onChange={() => setForm((f) => ({ ...f, from: 0, to: 0 }))} /> {T.all}</label>
            <label className="pp-radio"><input type="radio" name="pp-show-range" checked={ranged} onChange={() => setForm((f) => ({ ...f, from: 1, to: total }))} /> {T.range}</label>
            <NumberField value={form.from || 1} min={1} max={total} step={1} width={80} disabled={!ranged} onChange={(v) => patch('from', Math.round(v))} label={T.range} />
            <span>{T.to}</span>
            <NumberField value={form.to || total} min={1} max={total} step={1} width={80} disabled={!ranged} onChange={(v) => patch('to', Math.round(v))} label={T.to} />
          </div>
        </fieldset>
        <fieldset className="pp-group">
          <legend>{T.advance}</legend>
          <label className="pp-radio"><input type="radio" name="pp-show-adv" checked={form.manual && form.mode !== 'kiosk'} disabled={form.mode === 'kiosk'} onChange={() => patch('manual', true)} /> {T.manual}</label>
          <label className="pp-radio"><input type="radio" name="pp-show-adv" checked={!form.manual || form.mode === 'kiosk'} onChange={() => patch('manual', false)} /> {T.timings}</label>
        </fieldset>
      </div>
    </Dialog>
  );
}
