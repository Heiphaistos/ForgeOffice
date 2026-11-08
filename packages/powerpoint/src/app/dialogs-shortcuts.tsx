// Boîte « Raccourcis clavier » : liste consultable (recherche) construite depuis le registre unique.
import { useMemo, useState } from 'react';
import { Dialog, TextField } from '@forgeoffice/ui';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';
import { shortcutRows } from './shortcuts-list.ts';
import type { ShortcutGroup } from './shortcuts.ts';

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => shortcutRows(query), [query]);
  const T = S3.shortcuts;
  const groups = (Object.keys(T.groups) as ShortcutGroup[]).filter((g) => rows.some((r) => r.group === g));
  return (
    <Dialog open title={T.title} onClose={onClose} onConfirm={onClose} width={620} actions={[{ label: S.common.close, primary: true, onClick: onClose }]}>
      <div className="pp-stack" data-testid="shortcuts-dialog">
        <TextField label={T.search} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus data-testid="shortcuts-search" />
        <div style={{ maxHeight: 420, overflowY: 'auto' }} data-testid="shortcuts-list">
          {groups.map((g) => (
            <section key={g}>
              <h4 style={{ margin: '8px 0 4px' }}>{T.groups[g]}</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {rows.filter((r) => r.group === g).map((r) => (
                    <tr key={`${r.keys}-${r.label}`}>
                      <td style={{ padding: '3px 8px 3px 0' }}>{r.label}</td>
                      <td style={{ padding: '3px 0', textAlign: 'right', whiteSpace: 'nowrap' }}><kbd>{r.keys}</kbd></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
          {!groups.length && <p>{T.none}</p>}
        </div>
      </div>
    </Dialog>
  );
}
