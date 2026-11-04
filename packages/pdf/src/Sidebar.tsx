// Volet de gauche facon Acrobat : rail d'icones + miniatures (glisser pour reordonner, menu contextuel),
// signets, recherche, commentaires et historique des actions.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, TextField, useContextMenu, type IconName, type MenuItem } from '@forgeoffice/ui';
import type { Item, SearchHit } from './model.ts';
import type { OutlineNode, PDFDocumentProxy } from './pdfdoc.ts';
import { S } from './strings.ts';

export type Panel = 'thumbs' | 'bookmarks' | 'search' | 'comments' | 'history';

const PANELS: readonly { id: Panel; label: string; icon: IconName }[] = [
  { id: 'thumbs', label: S.thumbnails, icon: 'document_one_page_multiple' },
  { id: 'bookmarks', label: S.bookmarks, icon: 'bookmark' },
  { id: 'search', label: S.search, icon: 'search' },
  { id: 'comments', label: S.commentsPane, icon: 'comment_multiple' },
  { id: 'history', label: S.historyPane, icon: 'history' },
];

function Thumb({ pdf, index, rotation }: { pdf: PDFDocumentProxy; index: number; rotation: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let task: { cancel(): void; promise: Promise<unknown> } | null = null;
    let alive = true;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting || task) return;
      pdf.getPage(index + 1).then((page) => {
        if (!alive) return;
        const base = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
        const viewport = page.getViewport({ scale: (130 * Math.min(window.devicePixelRatio || 1, 2)) / Math.max(base.width, base.height), rotation: (page.rotate + rotation) % 360 });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        task = page.render({ canvas, viewport });
        task.promise.catch(() => undefined); // miniature annulee
      }, () => undefined);
    }, { rootMargin: '300px' });
    io.observe(canvas);
    return () => {
      alive = false;
      io.disconnect();
      task?.cancel();
    };
  }, [pdf, index, rotation]);
  return <canvas ref={ref} className="pdf-thumb__canvas" />;
}

export interface SidebarProps {
  panel: Panel | null;
  onPanel(p: Panel | null): void;
  pdf: PDFDocumentProxy | null;
  current: number;
  selected: ReadonlySet<number>;
  onSelectPages(s: Set<number>): void;
  onGo(page: number): void;
  onMovePage(from: number, to: number): void;
  pageMenu(page: number): MenuItem[];
  outline: OutlineNode[] | null;
  query: string;
  onQuery(q: string): void;
  hits: readonly SearchHit[];
  activeHit: number;
  onHit(i: number): void;
  items: readonly Item[];
  existingComments: readonly { page: number; author: string; text: string; type: string }[];
  onItem(item: Item): void;
  onRemoveItem(id: string): void;
  log: readonly string[];
  onUndoTo(length: number): void;
}

function Tree({ nodes, onGo, depth = 0 }: { nodes: readonly OutlineNode[]; onGo(p: number): void; depth?: number }) {
  return (
    <ul className="pdf-tree" role={depth === 0 ? 'tree' : 'group'}>
      {nodes.map((n, i) => (
        <li key={`${depth}-${i}`} role="treeitem" aria-expanded={n.children.length > 0 ? true : undefined}>
          <button type="button" className="pdf-tree__item" disabled={n.page === null} onClick={() => n.page !== null && onGo(n.page)} style={{ paddingLeft: 8 + depth * 14 }}>
            <Icon name="bookmark" size={16} />
            <span>{n.title}</span>
          </button>
          {n.children.length > 0 && <Tree nodes={n.children} onGo={onGo} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export function Sidebar(p: SidebarProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const menu = useContextMenu();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (p.panel !== 'thumbs') return;
    listRef.current?.querySelector(`[data-thumb="${p.current}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [p.current, p.panel]);

  let body: ReactNode = null;
  const pdf = p.pdf;
  if (p.panel === 'thumbs' && pdf) {
    body = (
      <div className="pdf-thumbs" ref={listRef}>
        {Array.from({ length: pdf.numPages }, (_, i) => (
          <div key={i} data-thumb={i}
            className={`pdf-thumb${i === p.current ? ' is-current' : ''}${p.selected.has(i) ? ' is-selected' : ''}${dropAt === i && dragFrom !== null ? ' is-drop' : ''}`}
            draggable
            onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); setDropAt(i); } }}
            onDragEnd={() => { setDragFrom(null); setDropAt(null); }}
            onDrop={(e) => { e.preventDefault(); if (dragFrom !== null && dragFrom !== i) p.onMovePage(dragFrom, i); setDragFrom(null); setDropAt(null); }}
            onClick={(e) => {
              const next = new Set(e.ctrlKey || e.metaKey ? p.selected : []);
              if (e.shiftKey) for (let k = Math.min(p.current, i); k <= Math.max(p.current, i); k++) next.add(k);
              else if (next.has(i) && (e.ctrlKey || e.metaKey)) next.delete(i);
              else next.add(i);
              p.onSelectPages(next);
              p.onGo(i);
            }}
            onContextMenu={(e) => { if (!p.selected.has(i)) p.onSelectPages(new Set([i])); menu.open(e, p.pageMenu(i)); }}>
            <Thumb pdf={pdf} index={i} rotation={0} />
            <span className="pdf-thumb__num">{i + 1}</span>
          </div>
        ))}
      </div>
    );
  } else if (p.panel === 'bookmarks') {
    body = p.outline && p.outline.length > 0 ? <Tree nodes={p.outline} onGo={p.onGo} /> : <p className="pdf-muted">{S.noBookmarks}</p>;
  } else if (p.panel === 'search') {
    body = (
      <div className="pdf-search">
        <TextField icon="search" autoFocus value={p.query} placeholder={S.searchPlaceholder} aria-label={S.searchPlaceholder} onChange={(e) => p.onQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && p.hits.length > 0) p.onHit((p.activeHit + (e.shiftKey ? p.hits.length - 1 : 1)) % p.hits.length); }} />
        {p.query.trim() && <p className="pdf-muted">{S.searchCount(p.hits.length)}</p>}
        <ul className="pdf-results">
          {p.hits.map((h, i) => (
            <li key={i}>
              <button type="button" className={i === p.activeHit ? 'is-active' : undefined} onClick={() => p.onHit(i)}>
                <span className="pdf-results__page">{S.comments.page(h.page + 1)}</span>
                <span>{h.context.slice(Math.max(0, h.start - 30), h.start)}<mark>{h.context.slice(h.start, h.start + h.length)}</mark>{h.context.slice(h.start + h.length, h.start + h.length + 40)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (p.panel === 'comments') {
    const added = p.items.filter((i) => i.kind !== 'field');
    body = added.length === 0 && p.existingComments.length === 0 ? <p className="pdf-muted">{S.comments.empty}</p> : (
      <div className="pdf-comments">
        {added.length > 0 && <h3>{S.comments.added}</h3>}
        {added.map((i) => (
          <div key={i.id} className="pdf-comment" role="button" tabIndex={0} onClick={() => p.onItem(i)} onKeyDown={(e) => e.key === 'Enter' && p.onItem(i)}>
            <div className="pdf-comment__head"><strong>{i.author}</strong><span className="pdf-muted">{S.comments.page(i.page + 1)} · {S.kinds[i.kind]}</span>
              <button type="button" className="pdf-iconbtn" aria-label={S.deletePages} title={S.deletePages} onClick={(e) => { e.stopPropagation(); p.onRemoveItem(i.id); }}><Icon name="delete" size={16} /></button>
            </div>
            {'text' in i && i.text && <p>{i.text}</p>}
          </div>
        ))}
        {p.existingComments.length > 0 && <h3>{S.comments.existing}</h3>}
        {p.existingComments.map((c, k) => (
          <div key={k} className="pdf-comment" role="button" tabIndex={0} onClick={() => p.onGo(c.page)} onKeyDown={(e) => e.key === 'Enter' && p.onGo(c.page)}>
            <div className="pdf-comment__head"><strong>{c.author || '—'}</strong><span className="pdf-muted">{S.comments.page(c.page + 1)} · {c.type}</span></div>
            {c.text && <p>{c.text}</p>}
          </div>
        ))}
      </div>
    );
  } else if (p.panel === 'history') {
    body = p.log.length === 0 ? <p className="pdf-muted">{S.noHistory}</p> : (
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

  const title = PANELS.find((x) => x.id === p.panel)?.label ?? '';
  return (
    <div className="pdf-side">
      <nav className="pdf-rail" aria-label={S.thumbnails}>
        {PANELS.map((x) => (
          <button key={x.id} type="button" className={`pdf-rail__btn${p.panel === x.id ? ' is-active' : ''}`} aria-pressed={p.panel === x.id} title={x.label} aria-label={x.label}
            onClick={() => p.onPanel(p.panel === x.id ? null : x.id)}>
            <Icon name={x.icon} size={20} />
          </button>
        ))}
      </nav>
      {p.panel && (
        <section className="pdf-panel" aria-label={title}>
          <header className="pdf-panel__head"><span>{title}</span>
            <button type="button" className="pdf-iconbtn" aria-label={S.dialogs.close} title={S.dialogs.close} onClick={() => p.onPanel(null)}><Icon name="dismiss" size={16} /></button>
          </header>
          <div className="pdf-panel__body">{body}</div>
        </section>
      )}
      {menu.menu}
    </div>
  );
}
