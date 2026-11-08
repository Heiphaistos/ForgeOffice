// Boîte « Combiner des fichiers » : plusieurs PDF d'un coup, ordre réglable (document ouvert compris), pages comptées avant fusion.
import { useEffect, useState } from 'react';
import { Dialog } from '@forgeoffice/ui';
import { pdfOps } from '@forgeoffice/convert';
import { moveIndex } from './model.ts';
import { S } from './strings.ts';

export interface MergeEntry {
  name: string;
  bytes: Uint8Array;
  pages: number;
  /** Vrai pour le document actuellement ouvert. */
  current: boolean;
}

export async function readEntries(files: readonly File[]): Promise<MergeEntry[]> {
  const out: MergeEntry[] = [];
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    out.push({ name: f.name, bytes, pages: (await pdfOps.readMetadata(bytes)).pages, current: false });
  }
  return out;
}

export function MergeDialog({ open, current, onMerge, onError, onClose }: {
  open: boolean; current: MergeEntry | null; onMerge(entries: readonly MergeEntry[]): void; onError(err: unknown): void; onClose(): void;
}) {
  const [list, setList] = useState<MergeEntry[]>([]);
  useEffect(() => { if (open && current) setList([current]); }, [open, current]);
  const move = (from: number, to: number): void => setList((l) => moveIndex(l.length, from, to).map((i) => l[i] as MergeEntry));
  const total = list.reduce((n, e) => n + e.pages, 0);
  return (
    <Dialog open={open} title={S.mergeDialog.title} onClose={onClose} width={520} description={S.mergeDialog.help}
      actions={[{ label: S.mergeDialog.apply(list.length), primary: true, disabled: list.length < 2, onClick: () => onMerge(list) }, { label: S.dialogs.cancel, onClick: onClose }]}>
      <div className="pdf-form">
        <label className="pdf-field-row"><span>{S.mergeDialog.add}</span>
          <input type="file" multiple accept="application/pdf,.pdf" aria-label={S.mergeDialog.add}
            onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ''; void readEntries(files).then((added) => setList((l) => [...l, ...added]), onError); }} /></label>
        <ol className="pdf-merge-list">
          {list.map((e, i) => (
            <li key={`${e.name}-${i}`}>
              <span className="pdf-merge-list__name">{e.name}{e.current && <em> {S.mergeDialog.opened}</em>}</span>
              <span className="pdf-muted">{S.mergeDialog.pages(e.pages)}</span>
              <button type="button" className="pdf-link" disabled={i === 0} aria-label={`${S.mergeDialog.up} ${e.name}`} onClick={() => move(i, i - 1)}>↑</button>
              <button type="button" className="pdf-link" disabled={i === list.length - 1} aria-label={`${S.mergeDialog.down} ${e.name}`} onClick={() => move(i, i + 1)}>↓</button>
              <button type="button" className="pdf-link" disabled={list.length < 2} aria-label={`${S.mergeDialog.remove} ${e.name}`} onClick={() => setList((l) => l.filter((_, k) => k !== i))}>×</button>
            </li>
          ))}
        </ol>
        <p className="pdf-muted" role="status">{S.mergeDialog.total(list.length, total)}</p>
      </div>
    </Dialog>
  );
}
