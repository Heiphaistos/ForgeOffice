// Boîte « Diaporamas personnalisés » : liste, création, modification (diapositives et ordre), suppression, lecture.
import { useState } from 'react';
import { Button, Dialog, TextField } from '@forgeoffice/ui';
import { slideTitle, type CustomShow } from '@forgeoffice/pptx';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';
import type { Editor } from './editor.ts';
import { addShow, moveItem, removeShow, updateShow } from './custom-shows.ts';

type Mode = { kind: 'list' } | { kind: 'edit'; id: number | null; name: string; slideIds: number[] };

export function CustomShowsDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [shows, setShows] = useState<CustomShow[]>(() => ed.deck.customShows ?? []);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [selected, setSelected] = useState<number | null>(shows[0]?.id ?? null);
  const [pick, setPick] = useState<number | null>(null);
  const [inShow, setInShow] = useState<number | null>(null);
  const C = S3.customShow;
  const slides = ed.deck.slides;
  const label = (id: number): string => {
    const i = slides.findIndex((s) => s.id === id);
    return `${i + 1}. ${(i >= 0 && slideTitle(slides[i] as never)) || S.dialogs.slideN(i + 1)}`;
  };
  const commit = (next: CustomShow[]): void => {
    const deck = { ...ed.deck };
    if (next.length) deck.customShows = next;
    else delete deck.customShows;
    ed.commit(deck, 'custom-shows');
  };
  const close = (): void => {
    commit(shows);
    onClose();
  };
  if (mode.kind === 'edit') {
    const m = mode;
    const save = (): void => {
      const next = m.id === null ? addShow(shows, m.name, m.slideIds) : updateShow(shows, m.id, { name: m.name.trim() || C.untitled, slideIds: m.slideIds });
      setShows(next);
      setSelected(m.id ?? next[next.length - 1]?.id ?? null);
      setMode({ kind: 'list' });
    };
    return (
      <Dialog open title={C.editTitle} onClose={() => setMode({ kind: 'list' })} onConfirm={save} width={620} actions={[{ label: S.common.ok, primary: true, onClick: save }, { label: S.common.cancel, onClick: () => setMode({ kind: 'list' }) }]}>
        <div className="pp-stack" data-testid="custom-show-edit">
          <TextField label={C.name} value={m.name} onChange={(e) => setMode({ ...m, name: e.target.value })} data-testid="custom-show-name" />
          <div className="pp-form__row" style={{ alignItems: 'stretch' }}>
            <div className="pp-stack" style={{ flex: 1 }}>
              <strong>{C.available}</strong>
              <select size={9} className="pp-list" aria-label={C.available} value={pick ?? ''} onChange={(e) => setPick(Number(e.target.value))}>
                {slides.map((s) => <option key={s.id} value={s.id}>{label(s.id)}</option>)}
              </select>
            </div>
            <div className="pp-stack" style={{ justifyContent: 'center' }}>
              <Button size="small" disabled={pick === null} onClick={() => pick !== null && setMode({ ...m, slideIds: [...m.slideIds, pick] })}>{C.add}</Button>
              <Button size="small" disabled={inShow === null} onClick={() => inShow !== null && setMode({ ...m, slideIds: m.slideIds.filter((_, i) => i !== inShow) })}>{C.remove}</Button>
              <Button size="small" disabled={inShow === null} onClick={() => { if (inShow === null) return; setMode({ ...m, slideIds: moveItem(m.slideIds, inShow, -1) }); setInShow(Math.max(0, inShow - 1)); }}>{C.up}</Button>
              <Button size="small" disabled={inShow === null} onClick={() => { if (inShow === null) return; setMode({ ...m, slideIds: moveItem(m.slideIds, inShow, 1) }); setInShow(Math.min(m.slideIds.length - 1, inShow + 1)); }}>{C.down}</Button>
            </div>
            <div className="pp-stack" style={{ flex: 1 }}>
              <strong>{C.inShow}</strong>
              <select size={9} className="pp-list" aria-label={C.inShow} value={inShow ?? ''} onChange={(e) => setInShow(Number(e.target.value))} data-testid="custom-show-list">
                {m.slideIds.map((id, i) => <option key={`${id}-${i}`} value={i}>{label(id)}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Dialog>
    );
  }
  const current = shows.find((s) => s.id === selected);
  return (
    <Dialog open title={C.title} onClose={close} onConfirm={close} width={460} actions={[{ label: C.play, disabled: !current, onClick: () => { if (!current) return; commit(shows); ed.setUi({ show: { start: 0, presenter: false, customShowId: current.id } }); onClose(); } }, { label: S.common.close, primary: true, onClick: close }]}>
      <div className="pp-stack" data-testid="custom-shows-dialog">
        <select size={8} className="pp-list" aria-label={C.title} value={selected ?? ''} onChange={(e) => setSelected(Number(e.target.value))} data-testid="custom-shows-list">
          {shows.map((s) => <option key={s.id} value={s.id}>{`${s.name} (${s.slideIds.length})`}</option>)}
        </select>
        <div className="pp-form__row">
          <Button size="small" onClick={() => { setPick(null); setInShow(null); setMode({ kind: 'edit', id: null, name: C.newName, slideIds: [] }); }}>{C.new}</Button>
          <Button size="small" disabled={!current} onClick={() => { if (!current) return; setPick(null); setInShow(null); setMode({ kind: 'edit', id: current.id, name: current.name, slideIds: [...current.slideIds] }); }}>{C.edit}</Button>
          <Button size="small" disabled={!current} onClick={() => { if (!current) return; const next = removeShow(shows, current.id); setShows(next); setSelected(next[0]?.id ?? null); }}>{S.common.delete}</Button>
        </div>
      </div>
    </Dialog>
  );
}
