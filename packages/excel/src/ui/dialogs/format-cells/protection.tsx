// Onglet Protection : verrouillee / masquee (effectives une fois la feuille protegee).
import { Checkbox } from '@forgeoffice/ui';
import { FC } from '../../../strings/index.ts';
import type { FormatCtx } from './state.ts';

export function ProtectionTab({ f }: { f: FormatCtx }) {
  return (
    <div className="xl-fc-prot">
      <Checkbox checked={f.get('locked')} mixed={f.isMixed('locked')} onChange={(v) => f.set({ locked: v })} label={FC.locked} />
      <Checkbox checked={f.get('hidden')} mixed={f.isMixed('hidden')} onChange={(v) => f.set({ hidden: v })} label={FC.hidden} />
      <p className="xl-fc-desc">{FC.protectionNote}</p>
    </div>
  );
}
