// Volets et menus flottants : champs de tableau croise dynamique, commentaires, menu du filtre automatique.
import { useMemo, useState, type ReactNode } from 'react';
import { Button, Checkbox, Icon, Popover, TaskPane, TextField } from '@forgeoffice/ui';
import type { Scalar } from '@forgeoffice/formulas';
import { rangeName, type ColumnFilter, type ThreadedComment } from '@forgeoffice/xlsx';
import type { PivotDef, PivotFn, PivotShow } from '../logic/pivot.ts';
import { S } from '../strings.ts';

type Area = 'filters' | 'cols' | 'rows' | 'values';

export function PivotPane({ fields, numeric, def, onChange, onClose }: { fields: string[]; numeric: readonly boolean[]; def: PivotDef; onChange: (def: PivotDef) => void; onClose: () => void }) {
  const [width, setWidth] = useState(300);
  const used = (i: number): boolean => def.rows.includes(i) || def.cols.includes(i) || def.values.some((v) => v.field === i) || def.filters.some((f) => f.field === i);
  const toggle = (i: number, on: boolean): void => {
    if (!on) {
      onChange({ ...def, rows: def.rows.filter((k) => k !== i), cols: def.cols.filter((k) => k !== i), values: def.values.filter((v) => v.field !== i), filters: def.filters.filter((f) => f.field !== i) });
      return;
    }
    // Comme Excel : les champs numeriques vont dans Valeurs, les autres dans Lignes.
    onChange(numeric[i] ? { ...def, values: [...def.values, { field: i, fn: 'sum' }] } : { ...def, rows: [...def.rows, i] });
  };
  const move = (i: number, to: Area): void => {
    const base = { ...def, rows: def.rows.filter((k) => k !== i), cols: def.cols.filter((k) => k !== i), filters: def.filters.filter((f) => f.field !== i), values: def.values.filter((v) => v.field !== i) };
    if (to === 'rows') base.rows = [...base.rows, i];
    if (to === 'cols') base.cols = [...base.cols, i];
    if (to === 'filters') base.filters = [...base.filters, { field: i, hidden: [] }];
    if (to === 'values') base.values = [...base.values, { field: i, fn: 'sum' }];
    onChange(base);
  };
  const [drag, setDrag] = useState<number | null>(null);
  const area = (id: Area, label: string, items: { field: number; extra?: ReactNode }[]): ReactNode => (
    <div className="xl-pv-area" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, id); setDrag(null); }}>
      <div className="xl-pv-area__title">{label}</div>
      {items.map(({ field, extra }) => (
        <div key={`${id}-${field}`} className="xl-pv-chip" draggable onDragStart={() => setDrag(field)}>
          <span>{fields[field]}</span>
          {extra}
          <select aria-label={S.pivot.moveTo} value={id} onChange={(e) => move(field, e.target.value as Area)}>
            <option value="filters">{S.pivot.filters}</option>
            <option value="cols">{S.pivot.columns}</option>
            <option value="rows">{S.pivot.rows}</option>
            <option value="values">{S.pivot.values}</option>
          </select>
          <button type="button" aria-label={S.pivot.remove} onClick={() => toggle(field, false)}><Icon name="dismiss" size={12} /></button>
        </div>
      ))}
    </div>
  );
  return (
    <TaskPane title={S.pivot.fields} width={width} onWidthChange={setWidth} onClose={onClose}>
      <p className="xl-hint">{S.pivot.chooseFields}</p>
      <div className="xl-pv-fields">
        {fields.map((f, i) => (
          <div key={`${f}-${i}`} draggable onDragStart={() => setDrag(i)}>
            <Checkbox checked={used(i)} onChange={(v) => toggle(i, v)} label={f} />
          </div>
        ))}
      </div>
      <p className="xl-hint">{S.pivot.areas}</p>
      <div className="xl-pv-grid">
        {area('filters', S.pivot.filters, def.filters.map((f) => ({
          field: f.field,
          extra: <input className="xl-mini xl-mini--wide" placeholder={S.pivot.hiddenItems} value={f.hidden.join(';')} onChange={(e) => onChange({ ...def, filters: def.filters.map((k) => (k === f ? { ...k, hidden: e.target.value.split(';').map((s) => s.trim()).filter(Boolean) } : k)) })} />,
        })))}
        {area('cols', S.pivot.columns, def.cols.map((field) => ({ field })))}
        {area('rows', S.pivot.rows, def.rows.map((field) => ({ field })))}
        {area('values', S.pivot.values, def.values.map((v, vi) => ({
          field: v.field,
          extra: (
            <>
              <select aria-label={S.pivot.settings} value={v.fn} onChange={(e) => onChange({ ...def, values: def.values.map((k, j) => (j === vi ? { ...k, fn: e.target.value as PivotFn } : k)) })}>
                {Object.entries(S.pivot.fn).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <select aria-label={S.pivot.settings} value={v.show ?? 'normal'} onChange={(e) => onChange({ ...def, values: def.values.map((k, j) => (j === vi ? { ...k, show: e.target.value as PivotShow } : k)) })}>
                {Object.entries(S.pivot.show).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </>
          ),
        })))}
      </div>
      <div className="xl-pv-opts">
        <Checkbox checked={!!def.descending} onChange={(v) => onChange({ ...def, descending: v })} label={S.pivot.descending} />
        <Checkbox checked={def.grandTotalRows !== false} onChange={(v) => onChange({ ...def, grandTotalRows: v, grandTotalCols: v })} label={S.pivot.grandRows} />
        <Checkbox checked={def.subtotals !== false} onChange={(v) => onChange({ ...def, subtotals: v })} label={S.pivot.subtotals} />
      </div>
    </TaskPane>
  );
}

export function CommentsPane({ comments, sheetName, onSelect, onReply, onResolve, onDelete, onClose }: {
  comments: readonly ThreadedComment[];
  sheetName: string;
  onSelect: (c: ThreadedComment) => void;
  onReply: (c: ThreadedComment, text: string) => void;
  onResolve: (c: ThreadedComment) => void;
  onDelete: (c: ThreadedComment) => void;
  onClose: () => void;
}) {
  const [width, setWidth] = useState(300);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  return (
    <TaskPane title={`${S.comments} — ${sheetName}`} width={width} onWidthChange={setWidth} onClose={onClose}>
      {comments.length === 0 && <p className="xl-hint">{S.noComments}</p>}
      {comments.map((c) => (
        <div key={c.id} className={`xl-cmt${c.done ? ' is-done' : ''}`} onClick={() => onSelect(c)}>
          <div className="xl-cmt__head">
            <Icon name="person" size={16} />
            <strong>{S.author}</strong>
            <span>{rangeName({ r1: c.ref.row, c1: c.ref.col, r2: c.ref.row, c2: c.ref.col })}</span>
          </div>
          <p>{c.text}</p>
          {c.replies.map((r) => <p key={r.id} className="xl-cmt__reply">{r.text}</p>)}
          <div className="xl-cmt__actions">
            <TextField value={drafts[c.id] ?? ''} placeholder={S.reply} aria-label={S.reply} onChange={(e) => setDrafts({ ...drafts, [c.id]: e.target.value })} />
            <Button size="small" appearance="primary" icon="send" aria-label={S.post} disabled={!drafts[c.id]?.trim()} onClick={() => { onReply(c, drafts[c.id] ?? ''); setDrafts({ ...drafts, [c.id]: '' }); }} />
            <Button size="small" appearance="subtle" icon="checkmark" aria-label={S.resolve} onClick={() => onResolve(c)} />
            <Button size="small" appearance="subtle" icon="delete" aria-label={S.del} onClick={() => onDelete(c)} />
          </div>
        </div>
      ))}
    </TaskPane>
  );
}

export interface FilterMenuProps {
  anchor: { x: number; y: number };
  column: string;
  items: { text: string; value: Scalar }[];
  current: ColumnFilter | undefined;
  numeric: boolean;
  onSort: (descending: boolean) => void;
  onApply: (f: ColumnFilter | undefined) => void;
  onClose: () => void;
}

export function FilterMenu(p: FilterMenuProps) {
  const [search, setSearch] = useState('');
  const initial = useMemo(() => {
    if (p.current?.kind === 'values') return new Set([...p.current.values.map((v) => v.toLowerCase()), ...(p.current.blank ? [''] : [])]);
    return new Set(p.items.map((i) => i.text.toLowerCase()));
  }, [p.current, p.items]);
  const [checked, setChecked] = useState<Set<string>>(initial);
  const [cond, setCond] = useState<{ op: 'greaterThan' | 'lessThan' | 'equal' | 'contains'; value: string } | null>(null);
  const visible = p.items.filter((i) => i.text.toLowerCase().includes(search.toLowerCase()));
  const all = visible.every((i) => checked.has(i.text.toLowerCase()));
  const apply = (): void => {
    if (cond) {
      const value = cond.op === 'contains' ? `*${cond.value}*` : cond.value;
      p.onApply({ kind: 'custom', conditions: [{ operator: cond.op === 'contains' ? 'equal' : cond.op, value }] });
      return;
    }
    if (p.items.every((i) => checked.has(i.text.toLowerCase()))) p.onApply(undefined);
    else p.onApply({ kind: 'values', values: p.items.filter((i) => i.text !== '' && checked.has(i.text.toLowerCase())).map((i) => i.text), blank: checked.has('') });
  };
  return (
    <Popover anchor={p.anchor} onClose={p.onClose} className="xl-filter" label={p.column}>
      <button type="button" className="xl-filter__cmd" onClick={() => p.onSort(false)}><Icon name="text_sort_ascending" size={16} />{p.numeric ? S.filterSortAscNum : S.filterSortAsc}</button>
      <button type="button" className="xl-filter__cmd" onClick={() => p.onSort(true)}><Icon name="text_sort_descending" size={16} />{p.numeric ? S.filterSortDescNum : S.filterSortDesc}</button>
      <hr />
      <button type="button" className="xl-filter__cmd" disabled={!p.current} onClick={() => p.onApply(undefined)}><Icon name="filter_dismiss" size={16} />{S.filterClear(p.column)}</button>
      <div className="xl-filter__conds">
        <span>{p.numeric ? S.filterNumber : S.filterText}</span>
        {(p.numeric ? (['greaterThan', 'lessThan', 'equal'] as const) : (['contains', 'equal'] as const)).map((op) => (
          <button key={op} type="button" className={cond?.op === op ? 'is-active' : ''} onClick={() => setCond({ op, value: cond?.value ?? '' })}>
            {op === 'greaterThan' ? S.filterGreater : op === 'lessThan' ? S.filterLess : op === 'contains' ? S.filterContains : S.filterEquals}
          </button>
        ))}
        {p.numeric && <button type="button" onClick={() => p.onApply({ kind: 'top10', top: true, percent: false, value: 10 })}>{S.filterTop10}</button>}
        {p.numeric && <button type="button" onClick={() => p.onApply({ kind: 'dynamic', type: 'aboveAverage' })}>{S.filterAbove}</button>}
        {p.numeric && <button type="button" onClick={() => p.onApply({ kind: 'dynamic', type: 'belowAverage' })}>{S.filterBelow}</button>}
        {cond && <TextField value={cond.value} aria-label={S.filterPrompt} placeholder={S.filterPrompt} onChange={(e) => setCond({ ...cond, value: e.target.value })} autoFocus />}
      </div>
      {!cond && (
        <>
          <TextField icon="search" value={search} placeholder={S.filterSearch} aria-label={S.filterSearch} onChange={(e) => setSearch(e.target.value)} />
          <div className="xl-filter__list">
            <Checkbox checked={all} onChange={(v) => {
              const next = new Set(checked);
              for (const i of visible) (v ? next.add(i.text.toLowerCase()) : next.delete(i.text.toLowerCase()));
              setChecked(next);
            }} label={S.filterAll} />
            {visible.map((i) => (
              <Checkbox key={i.text} checked={checked.has(i.text.toLowerCase())} label={i.text === '' ? S.filterBlank : i.text} onChange={(v) => {
                const next = new Set(checked);
                if (v) next.add(i.text.toLowerCase());
                else next.delete(i.text.toLowerCase());
                setChecked(next);
              }} />
            ))}
          </div>
        </>
      )}
      <div className="xl-filter__foot">
        <Button appearance="primary" onClick={apply}>{S.ok}</Button>
        <Button onClick={p.onClose}>{S.cancel}</Button>
      </div>
    </Popover>
  );
}
