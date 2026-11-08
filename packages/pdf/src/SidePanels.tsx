// Volets du panneau de gauche : recherche (regex, casse, remplacement), commentaires, pieces jointes, calques, signatures, historique.
import { useState } from 'react';
import { Checkbox, Icon, TextField } from '@forgeoffice/ui';
import { authorsOf, filterComments, isFiltering, kindsOf, NO_FILTER, type CommentFilter, type CommentSort } from './commentfilter.ts';
import type { AttachmentInfo, LayerInfo } from './extras.ts';
import { isExisting, type Item, type SearchHit, type SearchOptions } from './model.ts';
import type { SignatureReport } from './sign/verify.ts';
import type { ExistingComment } from './useExtras.ts';
import { S } from './strings.ts';

export interface ExtraPanelProps {
  search: {
    query: string;
    onQuery(q: string): void;
    options: SearchOptions;
    onOptions(o: SearchOptions): void;
    valid: boolean;
    hits: readonly SearchHit[];
    activeHit: number;
    onHit(i: number): void;
    replacement: string;
    onReplacement(v: string): void;
    onReplace(): void;
    canReplace: boolean;
  };
  items: readonly Item[];
  foreign: readonly ExistingComment[];
  onItem(item: Item): void;
  onRemoveItem(id: string): void;
  onGo(page: number): void;
  attachments: readonly AttachmentInfo[];
  onSaveAttachment(a: AttachmentInfo): void;
  layers: readonly LayerInfo[];
  onToggleLayer(id: string, visible: boolean): void;
  signatures: readonly SignatureReport[];
  log: readonly string[];
  onUndoTo(length: number): void;
}

export function SearchPanel({ search: s }: ExtraPanelProps) {
  return (
    <div className="pdf-search">
      <TextField icon="search" autoFocus value={s.query} placeholder={S.searchPlaceholder} aria-label={S.searchPlaceholder} onChange={(e) => s.onQuery(e.target.value)}
        error={s.valid ? undefined : S.finder.invalid}
        onKeyDown={(e) => { if (e.key === 'Enter' && s.hits.length > 0) s.onHit((s.activeHit + (e.shiftKey ? s.hits.length - 1 : 1)) % s.hits.length); }} />
      <Checkbox label={S.finder.regex} checked={s.options.regex === true} onChange={(regex) => s.onOptions({ ...s.options, regex })} />
      <Checkbox label={S.finder.matchCase} checked={s.options.matchCase === true} onChange={(matchCase) => s.onOptions({ ...s.options, matchCase })} />
      <Checkbox label={S.finder.wholeWord} checked={s.options.wholeWord === true} onChange={(wholeWord) => s.onOptions({ ...s.options, wholeWord })} />
      {s.query.trim() && s.valid && <p className="pdf-muted">{S.searchCount(s.hits.length)}</p>}
      <ul className="pdf-results">
        {s.hits.map((h, i) => (
          <li key={i}>
            <button type="button" className={i === s.activeHit ? 'is-active' : undefined} onClick={() => s.onHit(i)}>
              <span className="pdf-results__page">{S.comments.page(h.page + 1)}</span>
              <span>{h.context.slice(Math.max(0, h.start - 30), h.start)}<mark>{h.context.slice(h.start, h.start + h.length)}</mark>{h.context.slice(h.start + h.length, h.start + h.length + 40)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="pdf-search__replace">
        <TextField value={s.replacement} placeholder={S.finder.replaceWith} aria-label={S.finder.replaceWith} onChange={(e) => s.onReplacement(e.target.value)} />
        <button type="button" className="pdf-link" disabled={!s.canReplace || !s.query.trim() || !s.valid} title={S.finder.replaceTip} onClick={s.onReplace}>{S.finder.replaceAll}</button>
      </div>
    </div>
  );
}

export function CommentsPanel(p: ExtraPanelProps) {
  const [filter, setFilter] = useState<CommentFilter>(NO_FILTER);
  const all = p.items.filter((i) => i.kind !== 'field');
  const filtering = isFiltering(filter);
  const shown = filterComments(all, filter, (k) => S.kinds[k]);
  const foreign = p.foreign.filter((c) => filter.kind === 'all' && (filter.author === 'all' || c.author === filter.author)
    && (filter.text.trim() === '' || `${c.text} ${c.author} ${c.type}`.toLowerCase().includes(filter.text.trim().toLowerCase())));
  const fromFile = shown.filter((i) => isExisting(i.id));
  const added = shown.filter((i) => !isExisting(i.id));
  if (all.length === 0 && p.foreign.length === 0) return <p className="pdf-muted">{S.comments.empty}</p>;
  const card = (i: Item) => (
    <div key={i.id} className="pdf-comment" role="button" tabIndex={0} onClick={() => p.onItem(i)} onKeyDown={(e) => e.key === 'Enter' && p.onItem(i)}>
      <div className="pdf-comment__head"><strong>{i.author || '—'}</strong><span className="pdf-muted">{S.comments.page(i.page + 1)} · {S.kinds[i.kind]}</span>
        <button type="button" className="pdf-iconbtn" aria-label={S.deletePages} title={S.deletePages} onClick={(e) => { e.stopPropagation(); p.onRemoveItem(i.id); }}><Icon name="delete" size={16} /></button>
      </div>
      {'text' in i && i.text && <p>{i.text}</p>}
    </div>
  );
  return (
    <div className="pdf-comments">
      <div className="pdf-comments__filter">
        <TextField icon="search" value={filter.text} placeholder={S.comments.filterPlaceholder} aria-label={S.comments.filterPlaceholder} onChange={(e) => setFilter({ ...filter, text: e.target.value })} />
        <select className="pdf-select" aria-label={S.comments.byKind} value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value as CommentFilter['kind'] })}>
          <option value="all">{S.comments.allKinds}</option>
          {kindsOf(all).map((k) => <option key={k} value={k}>{S.kinds[k]}</option>)}
        </select>
        <select className="pdf-select" aria-label={S.comments.byAuthor} value={filter.author} onChange={(e) => setFilter({ ...filter, author: e.target.value })}>
          <option value="all">{S.comments.allAuthors}</option>
          {authorsOf([...all, ...p.foreign]).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="pdf-select" aria-label={S.comments.sortBy} value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value as CommentSort })}>
          {(Object.keys(S.comments.sorts) as CommentSort[]).map((k) => <option key={k} value={k}>{S.comments.sorts[k]}</option>)}
        </select>
        {filtering && <p className="pdf-muted">{S.comments.count(shown.length + foreign.length, all.length + p.foreign.length)} <button type="button" className="pdf-link" onClick={() => setFilter({ ...NO_FILTER, sort: filter.sort })}>{S.comments.clearFilter}</button></p>}
      </div>
      {added.length > 0 && <h3>{S.comments.added}</h3>}
      {added.map(card)}
      {fromFile.length > 0 && <h3>{S.comments.existing}</h3>}
      {fromFile.map(card)}
      {foreign.map((c, k) => (
        <div key={k} className="pdf-comment" role="button" tabIndex={0} onClick={() => p.onGo(c.page)} onKeyDown={(e) => e.key === 'Enter' && p.onGo(c.page)}>
          <div className="pdf-comment__head"><strong>{c.author || '—'}</strong><span className="pdf-muted">{S.comments.page(c.page + 1)} · {c.type}</span></div>
          {c.text && <p>{c.text}</p>}
        </div>
      ))}
    </div>
  );
}

export function AttachmentsPanel(p: ExtraPanelProps) {
  if (p.attachments.length === 0) return <p className="pdf-muted">{S.attachments.empty}</p>;
  return (
    <ul className="pdf-attachments">
      {p.attachments.map((a) => (
        <li key={a.id} className="pdf-attachment">
          <Icon name="attach" size={18} />
          <span className="pdf-attachment__name" title={a.description || a.name}>{a.name}<small className="pdf-muted">{S.attachments.size(a.size)}</small></span>
          <button type="button" className="pdf-link" onClick={() => p.onSaveAttachment(a)}>{S.attachments.save}</button>
        </li>
      ))}
    </ul>
  );
}

export function LayersPanel(p: ExtraPanelProps) {
  if (p.layers.length === 0) return <p className="pdf-muted">{S.layers.empty}</p>;
  return (
    <div className="pdf-layers">
      <p className="pdf-muted">{S.layers.tip}</p>
      {p.layers.map((l) => <Checkbox key={l.id} label={l.name} checked={l.visible} onChange={(v) => p.onToggleLayer(l.id, v)} />)}
    </div>
  );
}

const fmt = (d: Date | null): string => (d && !Number.isNaN(d.getTime()) ? d.toLocaleString('fr-FR') : '—');

export function SignaturesPanel(p: ExtraPanelProps) {
  if (p.signatures.length === 0) return <p className="pdf-muted">{S.sign.none}</p>;
  return (
    <div className="pdf-signatures">
      <p className="pdf-muted">{S.sign.count(p.signatures.length)}</p>
      {p.signatures.map((r, k) => {
        const bad = r.integrity === 'modified' || r.signature === 'invalid';
        const good = r.integrity === 'ok' && r.signature === 'ok';
        return (
          <div key={k} className={`pdf-sig ${bad ? 'is-bad' : good ? 'is-good' : 'is-unknown'}`}>
            <div className="pdf-sig__head">
              <Icon name={bad ? 'error_circle' : good ? 'checkmark_circle' : 'warning'} size={20} />
              <strong>{r.signer ? S.sign.signedBy(r.signer) : r.field}</strong>
            </div>
            <p>{bad ? S.sign.states.modified : good ? S.sign.states.ok : S.sign.states.unknown}</p>
            {r.signature === 'invalid' && <p>{S.sign.sigBad}</p>}
            <p className="pdf-muted">{S.sign.at(fmt(r.signedAt))}</p>
            {r.reason && <p className="pdf-muted">{r.reason}</p>}
            {r.location && <p className="pdf-muted">{r.location}</p>}
            {r.issuer && <p className="pdf-muted">{r.issuer}</p>}
            <ul className="pdf-sig__warnings">{r.warnings.map((w) => <li key={w}>{S.sign.warnings[w]}</li>)}</ul>
          </div>
        );
      })}
    </div>
  );
}

export function HistoryPanel(p: ExtraPanelProps) {
  if (p.log.length === 0) return <p className="pdf-muted">{S.noHistory}</p>;
  return (
    <ol className="pdf-history">
      {p.log.map((l, i) => (
        <li key={i}>
          <button type="button" className={i === p.log.length - 1 ? 'is-current' : undefined} onClick={() => p.onUndoTo(i + 1)}>
            <Icon name={i === 0 ? 'document_pdf' : 'edit'} size={16} /><span>{l}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
