// Liste de fichiers facon Office (Recents, Epingles) : icone d'application, nom, emplacement, date, epingle, menu contextuel.
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon.tsx';
import type { MenuItem } from '../ribbon-types.ts';
import { S } from '../strings.ts';
import { DATE_GROUP_LABEL, dateGroup, relativeDate, type DateGroup } from '../logic/dates.ts';
import { useContextMenu } from './Menu.tsx';
import './FileList.css';

export interface FileRow {
  id: string;
  name: string;
  location: string;
  /** Millisecondes depuis l'epoque. */
  date: number;
  /** Icone (generalement <AppBadge>). */
  icon: ReactNode;
  pinned?: boolean;
}

export interface FileListProps {
  rows: readonly FileRow[];
  onOpen: (row: FileRow) => void;
  onTogglePin?: (row: FileRow) => void;
  /** Elements du menu contextuel d'une ligne. */
  menuFor?: (row: FileRow) => readonly MenuItem[];
  /** Regroupe par periode (Aujourd'hui, Hier...). */
  grouped?: boolean;
  emptyText?: string;
  now?: number;
}

export function FileList({ rows, onOpen, onTogglePin, menuFor, grouped = false, emptyText = S.files.empty, now = Date.now() }: FileListProps) {
  const context = useContextMenu();
  if (rows.length === 0) return <div className="fo-files__empty">{emptyText}</div>;

  const sections: { group: DateGroup | null; rows: FileRow[] }[] = [];
  for (const row of rows) {
    const group = grouped ? dateGroup(row.date, now) : null;
    const last = sections[sections.length - 1];
    if (last && last.group === group) last.rows.push(row);
    else sections.push({ group, rows: [row] });
  }

  return (
    <div className="fo-files" role="table" aria-label={S.files.name}>
      <div className="fo-files__head" role="row">
        <span role="columnheader" className="fo-files__c-icon" />
        <span role="columnheader">{S.files.name}</span>
        <span role="columnheader" className="fo-files__c-date">{S.files.date}</span>
        <span role="columnheader" className="fo-files__c-act" />
      </div>
      {sections.map((section, si) => (
        <div key={`${section.group ?? 'all'}-${si}`} role="rowgroup">
          {section.group && <div className="fo-files__group" role="presentation">{DATE_GROUP_LABEL[section.group]}</div>}
          {section.rows.map((row) => (
            <div
              key={row.id}
              role="row"
              tabIndex={0}
              className="fo-files__row"
              onClick={() => onOpen(row)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onOpen(row);
                if (e.key === 'ContextMenu' && menuFor) {
                  const r = e.currentTarget.getBoundingClientRect();
                  context.open({ clientX: r.left + 40, clientY: r.bottom, preventDefault: () => e.preventDefault() }, menuFor(row));
                }
              }}
              onContextMenu={(e) => {
                if (menuFor) context.open(e, menuFor(row));
              }}
            >
              <span role="cell" className="fo-files__c-icon">{row.icon}</span>
              <span role="cell" className="fo-files__c-name">
                <span className="fo-files__name">{row.name}</span>
                <span className="fo-files__loc">{row.location}</span>
              </span>
              <span role="cell" className="fo-files__c-date">{relativeDate(row.date, now)}</span>
              <span role="cell" className="fo-files__c-act">
                {onTogglePin && (
                  <button
                    type="button"
                    className={`fo-files__pin${row.pinned ? ' is-pinned' : ''}`}
                    aria-pressed={row.pinned === true}
                    aria-label={row.pinned ? S.files.unpin : S.files.pin}
                    title={row.pinned ? S.files.unpin : S.files.pin}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(row);
                    }}
                  >
                    <Icon name={row.pinned ? 'pin_off' : 'pin'} size={16} />
                  </button>
                )}
                {menuFor && (
                  <button
                    type="button"
                    className="fo-files__more"
                    aria-label={S.files.more}
                    title={S.files.more}
                    onClick={(e) => {
                      e.stopPropagation();
                      const r = e.currentTarget.getBoundingClientRect();
                      context.open({ clientX: r.left, clientY: r.bottom }, menuFor(row));
                    }}
                  >
                    <Icon name="more_horizontal" size={16} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      ))}
      {context.menu}
    </div>
  );
}
