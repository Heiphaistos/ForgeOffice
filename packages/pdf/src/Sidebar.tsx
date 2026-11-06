// Volet de gauche facon Acrobat : rail d'icones + miniatures (glisser pour reordonner, menu contextuel), signets editables,
// et les autres volets (recherche, commentaires, pieces jointes, calques, signatures, historique) de SidePanels.tsx.
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Icon, useContextMenu, type IconName, type MenuItem } from '@forgeoffice/ui';
import { addBookmark, moveBookmark, removeBookmark, renameBookmark, setBookmarkPage, type Bookmark, type BookmarkPath } from './outlines.ts';
import { AttachmentsPanel, CommentsPanel, HistoryPanel, LayersPanel, SearchPanel, SignaturesPanel, type ExtraPanelProps } from './SidePanels.tsx';
import type { PDFDocumentProxy } from './pdfdoc.ts';
import { S } from './strings.ts';

export type Panel = 'thumbs' | 'bookmarks' | 'search' | 'comments' | 'attachments' | 'layers' | 'signatures' | 'history';

const PANELS: readonly { id: Panel; label: string; icon: IconName }[] = [
  { id: 'thumbs', label: S.thumbnails, icon: 'document_one_page_multiple' },
  { id: 'bookmarks', label: S.bookmarks, icon: 'bookmark' },
  { id: 'search', label: S.search, icon: 'search' },
  { id: 'comments', label: S.commentsPane, icon: 'comment_multiple' },
  { id: 'attachments', label: S.panes.attachments, icon: 'attach' },
  { id: 'layers', label: S.panes.layers, icon: 'layer' },
  { id: 'signatures', label: S.panes.signatures, icon: 'certificate' },
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

export interface BookmarkPanelProps {
  tree: Bookmark[] | null;
  editable: boolean;
  /** Page affichee (0-based), destination des nouveaux signets. */
  currentPage: number;
  onChange(tree: Bookmark[]): void;
}

function Tree({ nodes, onGo, selected, onSelect, renaming, onRename, onContext, parent = [] }: {
  nodes: readonly Bookmark[]; onGo(p: number): void; selected: BookmarkPath | null; onSelect(p: BookmarkPath): void;
  renaming: BookmarkPath | null; onRename(path: BookmarkPath, title: string | null): void;
  onContext(e: ReactMouseEvent, path: BookmarkPath): void; parent?: BookmarkPath;
}) {
  return (
    <ul className="pdf-tree" role={parent.length === 0 ? 'tree' : 'group'}>
      {nodes.map((n, i) => {
        const path = [...parent, i];
        const isSel = selected !== null && selected.join('.') === path.join('.');
        const isRen = renaming !== null && renaming.join('.') === path.join('.');
        return (
          <li key={path.join('.')} role="treeitem" aria-expanded={n.children.length > 0 ? true : undefined} aria-selected={isSel}>
            {isRen
              ? <input className="pdf-tree__input" autoFocus defaultValue={n.title} aria-label={S.bookmarksEdit.label} style={{ marginLeft: 8 + parent.length * 14 }}
                  onKeyDown={(e) => { if (e.key === 'Enter') onRename(path, e.currentTarget.value); if (e.key === 'Escape') onRename(path, null); }}
                  onBlur={(e) => onRename(path, e.currentTarget.value)} />
              : <button type="button" className={`pdf-tree__item${isSel ? ' is-selected' : ''}`} style={{ paddingLeft: 8 + parent.length * 14 }}
                  onClick={() => { onSelect(path); if (n.page !== null) onGo(n.page); }} onDoubleClick={() => onRename(path, null)} onContextMenu={(e) => onContext(e, path)}>
                  <Icon name="bookmark" size={16} />
                  <span>{n.title}</span>
                </button>}
            {n.children.length > 0 && <Tree nodes={n.children} onGo={onGo} selected={selected} onSelect={onSelect} renaming={renaming} onRename={onRename} onContext={onContext} parent={path} />}
          </li>
        );
      })}
    </ul>
  );
}

function Bookmarks({ b, onGo }: { b: BookmarkPanelProps; onGo(p: number): void }) {
  const [selected, setSelected] = useState<BookmarkPath | null>(null);
  const [renaming, setRenaming] = useState<BookmarkPath | null>(null);
  const tree = b.tree ?? [];
  const menu = useContextMenu();
  const tool = (label: string, icon: IconName, onClick: () => void, disabled = false): ReactNode => (
    <button type="button" className="pdf-iconbtn" aria-label={label} title={label} disabled={disabled || !b.editable} onClick={onClick}><Icon name={icon} size={16} /></button>
  );
  const rename = (path: BookmarkPath | null, title: string | null): void => {
    if (path && title === null) {
      setRenaming(path);
      return;
    }
    if (path && title !== null && title.trim() !== '') b.onChange(renameBookmark(tree, path, title.trim()));
    setRenaming(null);
  };
  const contextMenu = (e: ReactMouseEvent, path: BookmarkPath): void => {
    setSelected(path);
    const node = path.reduce<{ page: number | null; children: Bookmark[] } | undefined>((acc, i) => (acc ? acc.children[i] : undefined), { page: null, children: tree });
    menu.open(e, [
      { id: 'go', label: S.menus.gotoBookmark, icon: 'arrow_right', disabled: node?.page === null || node?.page === undefined, onClick: () => node?.page != null && onGo(node.page) },
      { id: 's1', kind: 'separator' },
      { id: 'rename', label: S.bookmarksEdit.rename, icon: 'rename', disabled: !b.editable, onClick: () => setRenaming(path) },
      { id: 'child', label: S.bookmarksEdit.addChild, icon: 'document_add', disabled: !b.editable, onClick: () => b.onChange(addBookmark(tree, path, S.bookmarksEdit.newTitle(b.currentPage + 1), b.currentPage)) },
      { id: 'dest', label: S.menus.setDest, icon: 'bookmark', disabled: !b.editable, onClick: () => b.onChange(setBookmarkPage(tree, path, b.currentPage)) },
      { id: 's2', kind: 'separator' },
      { id: 'up', label: S.bookmarksEdit.up, icon: 'arrow_up', disabled: !b.editable, onClick: () => { const m = moveBookmark(tree, path, -1); b.onChange(m.tree); setSelected(m.path); } },
      { id: 'down', label: S.bookmarksEdit.down, icon: 'arrow_down', disabled: !b.editable, onClick: () => { const m = moveBookmark(tree, path, 1); b.onChange(m.tree); setSelected(m.path); } },
      { id: 's3', kind: 'separator' },
      { id: 'del', label: S.bookmarksEdit.remove, icon: 'delete', disabled: !b.editable, onClick: () => { b.onChange(removeBookmark(tree, path)); setSelected(null); } },
    ]);
  };
  return (
    <div className="pdf-bookmarks">
      <div className="pdf-bookmarks__tools">
        {tool(S.bookmarksEdit.add, 'add', () => {
          const parent = selected ? selected.slice(0, -1) : [];
          b.onChange(addBookmark(tree, parent, S.bookmarksEdit.newTitle(b.currentPage + 1), b.currentPage));
        })}
        {tool(S.bookmarksEdit.addChild, 'document_add', () => selected && b.onChange(addBookmark(tree, selected, S.bookmarksEdit.newTitle(b.currentPage + 1), b.currentPage)), selected === null)}
        {tool(S.bookmarksEdit.rename, 'rename', () => setRenaming(selected), selected === null)}
        {tool(S.bookmarksEdit.up, 'arrow_up', () => { if (selected) { const m = moveBookmark(tree, selected, -1); b.onChange(m.tree); setSelected(m.path); } }, selected === null)}
        {tool(S.bookmarksEdit.down, 'arrow_down', () => { if (selected) { const m = moveBookmark(tree, selected, 1); b.onChange(m.tree); setSelected(m.path); } }, selected === null)}
        {tool(S.bookmarksEdit.remove, 'delete', () => { if (selected) { b.onChange(removeBookmark(tree, selected)); setSelected(null); } }, selected === null)}
      </div>
      {tree.length > 0
        ? <Tree nodes={tree} onGo={onGo} selected={selected} onSelect={setSelected} renaming={renaming} onRename={rename} onContext={contextMenu} />
        : <p className="pdf-muted">{b.editable ? S.bookmarksEdit.empty : S.noBookmarks}</p>}
      {menu.menu}
    </div>
  );
}

export interface SidebarProps extends ExtraPanelProps {
  panel: Panel | null;
  onPanel(p: Panel | null): void;
  pdf: PDFDocumentProxy | null;
  current: number;
  selected: ReadonlySet<number>;
  onSelectPages(s: Set<number>): void;
  onGo(page: number): void;
  onMovePage(from: number, to: number): void;
  pageMenu(page: number): MenuItem[];
  bookmarks: BookmarkPanelProps;
}

export function Sidebar(p: SidebarProps) {
  // Reordonner les miniatures : souris = glisser depuis la miniature ; doigt et stylet = glisser depuis la poignee (le reste defile).
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const press = useRef<{ from: number; x: number; y: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const menu = useContextMenu();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (p.panel !== 'thumbs') return;
    listRef.current?.querySelector(`[data-thumb="${p.current}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [p.current, p.panel]);

  const down = (e: ReactPointerEvent, i: number): void => {
    if (e.button !== 0) return;
    const grip = (e.target as HTMLElement).closest('.pdf-thumb__grip') !== null;
    if (e.pointerType !== 'mouse' && !grip) return;
    press.current = { from: i, x: e.clientX, y: e.clientY, active: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent): void => {
    const s = press.current;
    if (!s) return;
    if (!s.active && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 6) {
      s.active = true;
      setDragFrom(s.from);
    }
    if (!s.active) return;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-thumb]');
    setDropAt(over ? Number(over.dataset.thumb) : null);
  };
  const up = (): void => {
    const s = press.current;
    press.current = null;
    if (s?.active) {
      suppressClick.current = true; // le clic qui suit le glisser ne selectionne rien
      if (dropAt !== null && dropAt !== s.from) p.onMovePage(s.from, dropAt);
    }
    setDragFrom(null);
    setDropAt(null);
  };

  let body: ReactNode = null;
  const pdf = p.pdf;
  if (p.panel === 'thumbs' && pdf) {
    body = (
      <div className="pdf-thumbs" ref={listRef}>
        {Array.from({ length: pdf.numPages }, (_, i) => (
          <div key={i} data-thumb={i}
            className={`pdf-thumb${i === p.current ? ' is-current' : ''}${p.selected.has(i) ? ' is-selected' : ''}${dragFrom === i ? ' is-dragging' : ''}${dropAt === i && dragFrom !== null && dragFrom !== i ? (dragFrom < i ? ' is-drop-after' : ' is-drop') : ''}`}
            onPointerDown={(e) => down(e, i)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            onClick={(e) => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              const next = new Set(e.ctrlKey || e.metaKey ? p.selected : []);
              if (e.shiftKey) for (let k = Math.min(p.current, i); k <= Math.max(p.current, i); k++) next.add(k);
              else if (next.has(i) && (e.ctrlKey || e.metaKey)) next.delete(i);
              else next.add(i);
              p.onSelectPages(next);
              p.onGo(i);
            }}
            onContextMenu={(e) => { if (!p.selected.has(i)) p.onSelectPages(new Set([i])); menu.open(e, p.pageMenu(i)); }}>
            <Thumb pdf={pdf} index={i} rotation={0} />
            <span className="pdf-thumb__num"><span className="pdf-thumb__grip" aria-hidden="true" />{i + 1}</span>
          </div>
        ))}
      </div>
    );
  } else if (p.panel === 'bookmarks') body = <Bookmarks b={p.bookmarks} onGo={p.onGo} />;
  else if (p.panel === 'search') body = <SearchPanel {...p} />;
  else if (p.panel === 'comments') body = <CommentsPanel {...p} />;
  else if (p.panel === 'attachments') body = <AttachmentsPanel {...p} />;
  else if (p.panel === 'layers') body = <LayersPanel {...p} />;
  else if (p.panel === 'signatures') body = <SignaturesPanel {...p} />;
  else if (p.panel === 'history') body = <HistoryPanel {...p} />;

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
