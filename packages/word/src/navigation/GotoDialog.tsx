// Boite « Atteindre » : page, titre, signet, commentaire, note de bas de page / de fin, tableau, image.
import { useMemo, useState } from 'react';
import { Button, Dialog, NumberField } from '@forgeoffice/ui';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { Row, Select } from '../dialogs/common.tsx';
import { gotoTargets, stepTarget, type TargetType } from './targets.ts';

const D = T.dialogs;
const G = X.goto;

export function GotoDialog({ c, onClose, pageCount }: { c: Ctl; onClose: () => void; pageCount: number }) {
  const [type, setType] = useState<TargetType>('page');
  const [page, setPage] = useState(1);
  const [index, setIndex] = useState(0);
  const targets = useMemo(() => {
    const state = c.state();
    return state && type !== 'page' ? gotoTargets(state.doc, c.meta, type) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cibles lues a l'ouverture et au changement de type
  }, [type]);
  const here = (): number => c.state()?.selection.from ?? 0;
  const go = (): boolean => {
    if (type === 'page') {
      if (page < 1 || page > pageCount) {
        c.notify(D.goToBad, 'warning');
        return false;
      }
      c.act.gotoPage(page);
      return true;
    }
    const target = targets[index];
    if (!target) return false;
    c.act.gotoPos(target.pos);
    return true;
  };
  const step = (dir: 1 | -1): void => {
    const next = stepTarget(targets, here(), dir);
    if (!next) return;
    setIndex(targets.indexOf(next));
    c.act.gotoPos(next.pos);
  };
  const types: [TargetType, string][] = [['page', G.page], ['heading', G.heading], ['bookmark', G.bookmark], ['comment', G.comment], ['footnote', G.footnote], ['endnote', G.endnote], ['table', G.table], ['image', G.image], ['field', G.field], ['equation', G.equation], ['section', G.section]];
  const ok = (): void => { if (go()) onClose(); };
  return (
    <Dialog open title={D.goToTitle} onClose={onClose} onConfirm={ok} width={420}
      footerStart={type !== 'page' ? <><Button onClick={() => step(-1)} disabled={targets.length === 0}>{G.previous}</Button><Button onClick={() => step(1)} disabled={targets.length === 0}>{G.next}</Button></> : undefined}
      actions={[{ label: D.goTo, primary: true, onClick: ok }, { label: D.close, onClick: onClose }]}>
      <div className="fo-word-form">
        <Row label={G.what}><Select value={type} label={G.what} options={types} onChange={(t) => { setType(t); setIndex(0); }} /></Row>
        {type === 'page'
          ? <Row label={D.goToPage}><NumberField value={page} min={1} max={Math.max(1, pageCount)} label={D.goToPage} width={90} onChange={setPage} /></Row>
          : (
            <Row label={G.item}>
              <select className="fo-word-select fo-word-listbox" size={6} aria-label={G.item} value={String(index)} onChange={(e) => setIndex(Number(e.target.value))}>
                {targets.map((t, i) => <option key={`${t.pos}-${i}`} value={i}>{t.label}</option>)}
              </select>
              {targets.length === 0 && <span className="fo-word-hint">{G.none}</span>}
            </Row>
          )}
      </div>
    </Dialog>
  );
}
