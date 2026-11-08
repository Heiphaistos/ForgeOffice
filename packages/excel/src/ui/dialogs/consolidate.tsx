// Donnees > Consolider : fonction, liste de references (une plage par ligne), etiquettes, resultat ecrit a partir de la cellule active.
import { useState } from 'react';
import { Button, Checkbox, Dialog } from '@forgeoffice/ui';
import type { Scalar } from '@forgeoffice/formulas';
import { CONSOLIDATE_FNS, consolidate, type ConsolidateFn } from '../../logic/consolidate.ts';
import { fromScalar } from '../../logic/engine.ts';
import { rangeSelection } from '../../logic/selection.ts';
import { S } from '../../strings/index.ts';
import { readRange, type DlgEnv } from './basic.tsx';

/** Feuille (ou la feuille courante) et plage d'une reference « Feuil2!A1:C4 ». */
function parseRef(text: string, current: string): { sheet: string; range: NonNullable<ReturnType<typeof readRange>> } | undefined {
  const t = text.trim().replace(/^=/, '');
  const bang = t.lastIndexOf('!');
  const sheet = bang >= 0 ? t.slice(0, bang).replace(/^'|'$/g, '') : current;
  const range = readRange(t);
  return range ? { sheet, range } : undefined;
}

export function ConsolidateDialog({ x }: { x: DlgEnv }) {
  const C = S.consolidate;
  const here = x.store.wb.sheets[x.si]?.name ?? '';
  const [fn, setFn] = useState<ConsolidateFn>('sum');
  const [refs, setRefs] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [top, setTop] = useState(false);
  const [left, setLeft] = useState(false);
  const [error, setError] = useState('');
  const add = (): void => {
    if (!parseRef(draft, here)) return setError(C.invalid);
    setError('');
    setRefs((r) => [...r, draft.trim()]);
    setDraft('');
  };
  const apply = (): void => {
    const sources = refs.flatMap((t) => {
      const p = parseRef(t, here);
      if (!p) return [];
      const rows: Scalar[][] = [];
      for (let r = p.range.r1; r <= p.range.r2; r++) rows.push(Array.from({ length: p.range.c2 - p.range.c1 + 1 }, (_, k) => x.store.engine.value(p.sheet, r, p.range.c1 + k)));
      return [rows];
    });
    if (!sources.length) return setError(C.none);
    const out = consolidate(sources, { fn, topRow: top, leftCol: left });
    const a = x.sel.active;
    x.store.commit((d) => {
      out.forEach((line, r) => line.forEach((v, c) => d.set(x.si, a.row + r, a.col + c, v === null ? undefined : { value: fromScalar(v) })));
      x.setSel(rangeSelection({ r1: a.row, c1: a.col, r2: a.row + Math.max(0, out.length - 1), c2: a.col + Math.max(0, (out[0]?.length ?? 1) - 1) }));
    });
    x.close();
  };
  return (
    <Dialog open title={C.title} onClose={x.close} onConfirm={apply} width={460}>
      <div className="xl-form">
        <label htmlFor="cs-fn">{C.function}</label>
        <select id="cs-fn" value={fn} onChange={(e) => setFn(e.target.value as ConsolidateFn)}>
          {CONSOLIDATE_FNS.map((f) => <option key={f} value={f}>{S.pivot.fn[f === 'count' ? 'count' : f] ?? f}</option>)}
        </select>
        <label htmlFor="cs-ref">{C.reference}</label>
        <input id="cs-ref" className="ps-count" style={{ width: '100%' }} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); add(); } }} />
      </div>
      <Button onClick={add}>{C.add}</Button>
      <div className="xl-checklist" aria-label={C.allRefs}>
        {refs.map((r, i) => (
          <div key={`${r}-${i}`} className="xl-dlg-row"><span>{r}</span><Button size="small" appearance="subtle" icon="delete" aria-label={C.remove} onClick={() => setRefs((l) => l.filter((_, k) => k !== i))} /></div>
        ))}
      </div>
      <fieldset className="xl-fs">
        <legend>{C.labels}</legend>
        <Checkbox checked={top} onChange={setTop} label={C.topRow} />
        <Checkbox checked={left} onChange={setLeft} label={C.leftCol} />
      </fieldset>
      {error && <p className="tw-error" role="alert">{error}</p>}
    </Dialog>
  );
}
