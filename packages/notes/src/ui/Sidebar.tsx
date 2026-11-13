// Volet lateral : explorateur du dossier ouvert, plan du document, liens entrants (retroliens).
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { MouseEvent } from 'react';
import { Button, Icon, TaskPane, Tooltip, type IconName } from '@forgeoffice/ui';
import type { Command } from '../commands.ts';
import { folderRows } from '../logic/folder.ts';
import { backlinks, noteKey, type NoteSource } from '../logic/links.ts';
import { outline } from '../logic/outline.ts';
import type { SidePanel } from '../logic/prefs.ts';
import type { Workspace } from '../workspace.ts';
import { S } from '../strings.ts';

export interface SidebarProps {
  ws: Workspace;
  mode: Exclude<SidePanel, 'none'>;
  width: number;
  onWidthChange: (w: number) => void;
  onModeChange: (mode: SidePanel) => void;
  onOpenFolder: () => void;
  onOpenFolderFile: (rel: string, line?: number) => void;
  onGoTo: (tabId: string, line: number) => void;
  /** Registre des commandes (boutons de l'explorateur). */
  commands: ReadonlyMap<string, Command>;
  /** Clic droit sur une ligne (rel) ou dans le vide (null). */
  onRowMenu: (e: MouseEvent, rel: string | null) => void;
}

const FILE_TOOLS: readonly { id: string; icon: IconName }[] = [
  { id: 'newFile', icon: 'document_add' },
  { id: 'newDir', icon: 'folder_add' },
  { id: 'refreshFolder', icon: 'arrow_sync' },
];

const MODES: readonly { id: Exclude<SidePanel, 'none'>; icon: IconName }[] = [
  { id: 'files', icon: 'folder' },
  { id: 'outline', icon: 'document_bullet_list' },
  { id: 'backlinks', icon: 'link_multiple' },
];

/** Notes analysees : onglets ouverts + fichiers du dossier non ouverts. */
export function noteSources(ws: Workspace): NoteSource[] {
  const open = new Set(ws.tabs.map((t) => t.origin).filter((o): o is string => o !== null));
  return [
    ...ws.tabs.map((t) => ({ id: t.id, name: t.origin ?? t.name, text: ws.text(t.id) })),
    ...(ws.folder?.files ?? []).filter((f) => !open.has(f.rel)).map((f) => ({ id: `f:${f.rel}`, name: f.rel, text: f.text })),
  ];
}

export function Sidebar({ ws, mode, width, onWidthChange, onModeChange, onOpenFolder, onOpenFolderFile, onGoTo, commands, onRowMenu }: SidebarProps) {
  const cursor = useSyncExternalStore(ws.subscribeCursor, ws.getCursor);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const tab = ws.active;
  const docVersion = cursor.docVersion;

  const items = useMemo(() => {
    if (!tab || mode !== 'outline') return [];
    return outline(ws.text(tab.id), ws.languageName(tab) === 'Markdown');
    // docVersion : recalcul a chaque frappe.
  }, [ws, tab, mode, docVersion]);

  const links = useMemo(() => {
    if (!tab || mode !== 'backlinks') return [];
    return backlinks(tab.origin ?? tab.name, noteSources(ws), tab.id);
  }, [ws, tab, mode, docVersion, ws.folder]);

  const rows = useMemo(() => (mode === 'files' && ws.folder ? folderRows(ws.folder.files.map((f) => f.rel), collapsed, ws.folder.dirs ?? []) : []), [mode, ws.folder, collapsed]);

  const actions = (
    <span className="nt-side__modes">
      {MODES.map((m) => (
        <Tooltip key={m.id} content={S.sides[m.id]}>
          <button type="button" className={`nt-side__mode${m.id === mode ? ' is-active' : ''}`} aria-pressed={m.id === mode} aria-label={S.sides[m.id]} onClick={() => onModeChange(m.id)}>
            <Icon name={m.icon} size={16} />
          </button>
        </Tooltip>
      ))}
    </span>
  );

  let body;
  if (mode === 'files') {
    body = ws.folder ? (
      <>
        <div className="nt-side__folder">
          <Icon name="folder_open" size={16} /> <span className="nt-side__foldername">{ws.folder.name}</span>
          <span className="nt-side__tools">
            {FILE_TOOLS.map((t) => {
              const c = commands.get(t.id);
              if (!c) return null;
              return (
                <Tooltip key={t.id} content={c.disabled && c.hint ? `${c.label} : ${c.hint}` : c.label}>
                  <button type="button" className="nt-side__mode" aria-label={c.label} aria-disabled={c.disabled} disabled={c.disabled} onClick={c.run}><Icon name={t.icon} size={16} /></button>
                </Tooltip>
              );
            })}
          </span>
        </div>
        <ul
          className="nt-side__list"
          role="tree"
          tabIndex={0}
          onContextMenu={(e) => {
            e.preventDefault();
            onRowMenu(e, null);
          }}
          onKeyDown={(e) => {
            const id = e.key === 'F2' ? 'renameEntry' : e.key === 'Delete' ? 'deleteEntry' : null;
            const c = id ? commands.get(id) : undefined;
            if (c && !c.disabled) {
              e.preventDefault();
              c.run();
            }
          }}
        >
          {rows.map((r) => (
            <li
              key={r.rel}
              role="treeitem"
              aria-expanded={r.dir ? !collapsed.has(r.rel) : undefined}
              className={`nt-side__row${!r.dir && tab?.origin === r.rel ? ' is-active' : ''}${ws.folderOps.selected === r.rel ? ' is-selected' : ''}`}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRowMenu(e, r.rel);
              }}
              style={{ paddingLeft: 8 + r.depth * 14 }}
              onClick={() => {
                ws.folderOps.select(r.rel);
                if (!r.dir) onOpenFolderFile(r.rel);
                else {
                  const next = new Set(collapsed);
                  if (next.has(r.rel)) next.delete(r.rel);
                  else next.add(r.rel);
                  setCollapsed(next);
                }
              }}
            >
              <Icon name={r.dir ? (collapsed.has(r.rel) ? 'chevron_right' : 'chevron_down') : 'document'} size={16} />
              <span className="nt-side__name">{r.name}</span>
            </li>
          ))}
        </ul>
      </>
    ) : (
      <div className="nt-side__empty">
        <p>{S.side.filesEmpty}</p>
        <Button icon="folder_open" onClick={onOpenFolder}>{S.side.openFolder}</Button>
      </div>
    );
  } else if (mode === 'outline') {
    body = items.length ? (
      <ul className="nt-side__list">
        {items.map((o) => (
          <li key={`${o.line}`} className="nt-side__row" style={{ paddingLeft: 8 + (o.level - 1) * 14 }} onClick={() => tab && onGoTo(tab.id, o.line + 1)}>
            <span className={`nt-side__name nt-side__h${Math.min(o.level, 3)}`}>{o.title}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="nt-side__empty">{S.side.outlineEmpty}</p>
    );
  } else {
    const name = tab ? noteKey(tab.origin ?? tab.name) : '';
    body = links.length ? (
      <ul className="nt-side__list">
        {links.map((b) => (
          <li
            key={`${b.sourceId}:${b.line}`}
            className="nt-side__row nt-side__backlink"
            onClick={() => (b.sourceId.startsWith('f:') ? onOpenFolderFile(b.sourceId.slice(2), b.line + 1) : onGoTo(b.sourceId, b.line + 1))}
          >
            <span className="nt-side__name"><Icon name="document" size={16} /> {b.sourceName} <small>{S.side.line(b.line)}</small></span>
            <span className="nt-side__excerpt">{b.excerpt}</span>
          </li>
        ))}
      </ul>
    ) : (
      <div className="nt-side__empty">
        <p>{S.side.backlinksEmpty(name)}</p>
        <p className="nt-side__hint">{S.side.backlinksHint}</p>
      </div>
    );
  }

  return (
    <TaskPane title={S.sides[mode]} side="left" width={width} onWidthChange={onWidthChange} onClose={() => onModeChange('none')} actions={actions}>
      {body}
    </TaskPane>
  );
}
