// Boîte « Supprimer les informations masquées » : catégories trouvées dans le document, à cocher avant partage.
import { useEffect, useState } from 'react';
import { Checkbox, Dialog } from '@forgeoffice/ui';
import { HIDDEN_KINDS, type HiddenKind, type HiddenReport } from './sanitize.ts';
import { S } from './strings.ts';

export function SanitizeDialog({ report, onApply, onClose }: { report: HiddenReport | null; onApply(kinds: ReadonlySet<HiddenKind>): void; onClose(): void }) {
  const [kinds, setKinds] = useState<ReadonlySet<HiddenKind>>(new Set());
  useEffect(() => { if (report) setKinds(new Set(HIDDEN_KINDS.filter((k) => report[k] > 0))); }, [report]);
  const toggle = (k: HiddenKind, on: boolean): void => setKinds((cur) => { const n = new Set(cur); if (on) n.add(k); else n.delete(k); return n; });
  const total = report ? HIDDEN_KINDS.reduce((sum, k) => sum + report[k], 0) : 0;
  return (
    <Dialog open={report !== null} title={S.sanitize.title} onClose={onClose} width={500} description={S.sanitize.help}
      actions={[{ label: S.sanitize.apply, primary: true, disabled: kinds.size === 0, onClick: () => onApply(kinds) }, { label: S.dialogs.cancel, onClick: onClose }]}>
      <div className="pdf-form">
        {report && HIDDEN_KINDS.map((k) => (
          <Checkbox key={k} label={`${S.sanitize.kinds[k]} (${report[k] === 0 ? S.sanitize.none : report[k]})`} checked={kinds.has(k)} disabled={report[k] === 0} onChange={(on) => toggle(k, on)} />
        ))}
        {report && total === 0 && <p className="pdf-muted" role="status">{S.sanitize.clean}</p>}
        <p className="pdf-muted">{S.sanitize.note}</p>
      </div>
    </Dialog>
  );
}
