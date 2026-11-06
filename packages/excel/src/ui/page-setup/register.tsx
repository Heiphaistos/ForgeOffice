// Enregistrement de la boite Mise en page dans le registre de dialogues du Tableur (une seule ligne d'import dans ui/register.ts).
import { registerDialog } from '../registry.ts';
import { PageSetupDialog } from './dialog.tsx';
import type { PsTab } from './types.ts';
import { PS } from '../../strings/index.ts';

declare module '../registry.ts' {
  interface DialogMap {
    pageSetup: { tab?: PsTab };
  }
}

registerDialog({ id: 'pageSetup', title: PS.title, render: (d, x) => <PageSetupDialog x={x} {...(d.tab ? { tab: d.tab } : {})} /> });
