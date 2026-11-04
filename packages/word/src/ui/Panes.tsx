// Volets : Navigation (titres, recherche), Commentaires, Notes, Styles, Statistiques avancees.
import { useMemo, useState } from 'react';
import type { Schema } from 'prosemirror-model';
import { Button, Icon, TextField } from '@forgeoffice/ui';
import { blocksText, styleDisplayName, type Block, type Comment, type Note, type WordDocument } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import type { Heading } from '../features/toc.ts';
import { advancedStats, formatMinutes } from '../features/stats.ts';
import { MiniEditor } from './blocks.tsx';

export interface NavPaneProps {
  headings: readonly Heading[];
  activePos: number;
  results: number;
  onGo: (pos: number) => void;
  onSearch: (q: string) => void;
}

export function NavPane({ headings, activePos, results, onGo, onSearch }: NavPaneProps) {
  const [q, setQ] = useState('');
  const active = [...headings].reverse().find((h) => h.pos <= activePos)?.pos;
  return (
    <div className="fo-word-nav">
      <TextField icon="search" placeholder={T.dialogs.navSearch} aria-label={T.dialogs.navSearch} value={q} autoFocus
        onChange={(e) => { setQ(e.target.value); onSearch(e.target.value); }} />
      {q && <div className="fo-word-nav__count">{T.dialogs.results(results)}</div>}
      <div className="fo-word-nav__title">{T.dialogs.navHeadings}</div>
      {headings.length ? (
        <ul className="fo-word-nav__list" role="tree">
          {headings.map((h) => (
            <li key={h.pos} role="treeitem" aria-level={h.level} aria-selected={h.pos === active} className={h.pos === active ? 'is-active' : ''} style={{ paddingLeft: 8 + (h.level - 1) * 14 }}>
              <button type="button" onClick={() => onGo(h.pos)}>{h.text}</button>
            </li>
          ))}
        </ul>
      ) : <p className="fo-word-pane__empty">{T.dialogs.navEmpty}</p>}
    </div>
  );
}

const commentText = (c: Comment): string => blocksText(c.blocks).trim();
const toBlocks = (text: string): Block[] => text.split('\n').map((line) => ({ type: 'paragraph', styleId: 'CommentText', props: {}, inlines: line ? [{ type: 'text', text: line, props: {} }] : [] }));

export interface CommentsPaneProps {
  comments: readonly Comment[];
  active: number | null;
  author: string;
  onSelect: (id: number) => void;
  onChange: (comments: Comment[]) => void;
  onDelete: (id: number) => void;
}

export function CommentsPane({ comments, active, author, onSelect, onChange, onDelete }: CommentsPaneProps) {
  const [reply, setReply] = useState<{ to: number; text: string } | null>(null);
  const roots = comments.filter((c) => c.parentId === undefined);
  const update = (id: number, patch: Partial<Comment>): void => onChange(comments.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const post = (): void => {
    if (!reply?.text.trim()) return;
    const id = comments.reduce((m, c) => Math.max(m, c.id), -1) + 1;
    onChange([...comments, { id, author, initials: author.slice(0, 2).toUpperCase(), date: new Date().toISOString(), blocks: toBlocks(reply.text), parentId: reply.to }]);
    setReply(null);
  };
  if (!roots.length) return <p className="fo-word-pane__empty">{T.dialogs.noComments}</p>;
  return (
    <div className="fo-word-comments">
      {roots.map((root) => {
        const thread = [root, ...comments.filter((c) => c.parentId === root.id)];
        return (
          <article key={root.id} className={`fo-word-comment${root.id === active ? ' is-active' : ''}${root.done ? ' is-done' : ''}`} onClick={() => onSelect(root.id)}>
            {thread.map((c) => (
              <div key={c.id} className="fo-word-comment__item">
                <header>
                  <span className="fo-word-comment__avatar" aria-hidden="true">{c.initials ?? c.author.slice(0, 2).toUpperCase()}</span>
                  <strong>{c.author}</strong>
                  <time>{c.date ? new Date(c.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</time>
                </header>
                {c.author === author && !c.done ? (
                  <textarea aria-label={T.dialogs.commentsTitle} placeholder={T.dialogs.commentPlaceholder} value={commentText(c)} autoFocus={!commentText(c)}
                    onChange={(e) => update(c.id, { blocks: toBlocks(e.target.value) })} rows={Math.max(2, commentText(c).split('\n').length)} />
                ) : <p>{commentText(c)}</p>}
              </div>
            ))}
            {root.done && <div className="fo-word-comment__done"><Icon name="checkmark" size={16} /> {T.dialogs.resolved}</div>}
            {reply?.to === root.id ? (
              <div className="fo-word-comment__reply">
                <textarea autoFocus aria-label={T.dialogs.reply} value={reply.text} onChange={(e) => setReply({ to: root.id, text: e.target.value })} rows={2} />
                <Button appearance="primary" size="small" onClick={post}>{T.dialogs.post}</Button>
                <Button size="small" onClick={() => setReply(null)}>{T.dialogs.cancel}</Button>
              </div>
            ) : (
              <footer>
                <Button size="small" appearance="subtle" icon="comment" onClick={() => setReply({ to: root.id, text: '' })}>{T.dialogs.reply}</Button>
                <Button size="small" appearance="subtle" icon="checkmark" onClick={() => update(root.id, { done: !root.done })}>{root.done ? T.dialogs.reopen : T.dialogs.resolve}</Button>
                <Button size="small" appearance="subtle" icon="delete" onClick={() => onDelete(root.id)}>{T.dialogs.remove}</Button>
              </footer>
            )}
          </article>
        );
      })}
    </div>
  );
}

export interface NotesPaneProps {
  schema: Schema;
  footnotes: readonly Note[];
  endnotes: readonly Note[];
  onChange: (kind: 'footnote' | 'endnote', id: number, blocks: Block[]) => void;
}

export function NotesPane({ schema, footnotes, endnotes, onChange }: NotesPaneProps) {
  const section = (kind: 'footnote' | 'endnote', notes: readonly Note[], title: string) => {
    const list = notes.filter((n) => !n.special);
    return (
      <section>
        <h3 className="fo-word-nav__title">{title}</h3>
        {list.length ? list.map((n, i) => (
          <div key={n.id} className="fo-word-notecard">
            <span className="fo-word-notecard__num">{kind === 'footnote' ? i + 1 : (i + 1).toString()}</span>
            <MiniEditor schema={schema} blocks={n.blocks} label={title} className="fo-word-notecard__ed" onChange={(b) => onChange(kind, n.id, b)} />
          </div>
        )) : <p className="fo-word-pane__empty">{T.dialogs.noNotes}</p>}
      </section>
    );
  };
  return <div className="fo-word-notes-pane">{section('footnote', footnotes, T.dialogs.footnotes)}{section('endnote', endnotes, T.dialogs.endnotes)}</div>;
}

export function StylesPane({ meta, current, onApply }: { meta: WordDocument; current: string; onApply: (id: string) => void }) {
  const styles = meta.styles.styles.filter((s) => (s.type === 'paragraph' || s.type === 'character') && !s.hidden && (!s.semiHidden || s.quickFormat))
    .sort((a, b) => styleDisplayName(a).localeCompare(styleDisplayName(b), 'fr'));
  return (
    <ul className="fo-word-styles">
      {styles.map((s) => (
        <li key={s.id}>
          <button type="button" className={s.id === current ? 'is-active' : ''} onClick={() => onApply(s.id)}>
            <span>{styleDisplayName(s)}</span>
            <span className="fo-word-styles__kind" aria-hidden="true">{s.type === 'paragraph' ? '¶' : 'a'}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function StatsPane({ text, selection }: { text: string; selection: string }) {
  const st = useMemo(() => advancedStats(text), [text]);
  const sel = useMemo(() => (selection ? advancedStats(selection) : null), [selection]);
  const row = (label: string, value: string | number) => <tr key={label}><th scope="row">{label}</th><td>{typeof value === 'number' ? value.toLocaleString('fr-FR') : value}</td></tr>;
  const b = T.backstage;
  return (
    <div className="fo-word-stats">
      <table>
        <tbody>
          {row(b.words, st.words)}
          {sel ? row(T.cmd.select, sel.words) : null}
          {row(b.characters, st.characters)}
          {row(b.charactersNoSpaces, st.charactersNoSpaces)}
          {row(b.paragraphs, st.paragraphs)}
          {row(b.sentences, st.sentences)}
          {row(b.readingTime, formatMinutes(st.readingMinutes))}
          {row(b.speakingTime, formatMinutes(st.speakingMinutes))}
          {row(b.readability, `${st.readability} / 100`)}
          {row(b.avgSentence, st.avgWordsPerSentence)}
          {row(b.uniqueWords, st.uniqueWords)}
        </tbody>
      </table>
      <h3 className="fo-word-nav__title">{b.topWords}</h3>
      <ol className="fo-word-stats__top">
        {st.topWords.map(([w, n]) => <li key={w}><span>{w}</span><span className="fo-word-stats__bar" style={{ width: `${(n / (st.topWords[0]?.[1] ?? 1)) * 100}%` }} /><span>{n}</span></li>)}
      </ol>
    </div>
  );
}
