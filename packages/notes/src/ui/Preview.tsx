// Apercu Markdown en direct : rendu du lecteur Markdown de @forgeoffice/docx, nettoye par DOMPurify, liens [[note]] cliquables.
import { useEffect, useRef, useSyncExternalStore, type MouseEvent } from 'react';
import DOMPurify from 'dompurify';
import { documentToHtml, readMarkdown } from '@forgeoffice/docx';
import { TaskPane } from '@forgeoffice/ui';
import { isSafeUrl, linkifyWikiHtml } from '../logic/links.ts';
import type { Workspace } from '../workspace.ts';
import { S } from '../strings.ts';

/** Noeuds nettoyes (DOMPurify renvoie un fragment : jamais de HTML brut injecte) d'un texte Markdown. */
export function renderMarkdown(text: string): DocumentFragment {
  const page = documentToHtml(readMarkdown(text).document);
  const start = page.indexOf('<body>');
  const end = page.lastIndexOf('</body>');
  const body = start >= 0 && end > start ? page.slice(start + 6, end) : page;
  return DOMPurify.sanitize(linkifyWikiHtml(body), {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed', 'script'],
    FORBID_ATTR: ['style'],
    RETURN_DOM_FRAGMENT: true,
  });
}

export interface PreviewProps {
  ws: Workspace;
  width: number;
  onWidthChange: (w: number) => void;
  onClose: () => void;
  onOpenNote: (name: string, heading?: string) => void;
  onBlocked: () => void;
}

export function Preview({ ws, width, onWidthChange, onClose, onOpenNote, onBlocked }: PreviewProps) {
  const cursor = useSyncExternalStore(ws.subscribeCursor, ws.getCursor);
  const ref = useRef<HTMLElement>(null);
  const activeId = ws.activeId;

  useEffect(() => {
    const timer = window.setTimeout(() => ref.current?.replaceChildren(renderMarkdown(ws.text(activeId))), 150);
    return () => window.clearTimeout(timer);
  }, [ws, activeId, cursor.docVersion]);

  const onClick = (e: MouseEvent): void => {
    const a = e.target instanceof Element ? e.target.closest('a') : null;
    if (!a) return;
    e.preventDefault();
    const note = a.getAttribute('data-note');
    if (note) onOpenNote(note, a.getAttribute('data-heading') ?? undefined);
    else {
      const href = a.getAttribute('href') ?? '';
      if (isSafeUrl(href)) window.open(href, '_blank', 'noopener,noreferrer');
      else onBlocked();
    }
  };

  return (
    <TaskPane title={S.preview.title} side="right" width={width} onWidthChange={onWidthChange} onClose={onClose} minWidth={240} maxWidth={1200}>
      <article className="nt-preview" ref={ref} onClick={onClick} aria-label={S.preview.title} />
    </TaskPane>
  );
}
