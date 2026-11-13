// Enregistrement de la boite Mise en page dans le registre de dialogues du Tableur (une seule ligne d'import dans ui/register.ts).
import { isOnlyOffice } from '@forgeoffice/ui';
import { registerDialog } from '../registry.ts';
import { PageSetupDialog } from './dialog.tsx';
import { OoHeaderFooterDialog, OoMarginsDialog } from './ooDialogs.tsx';
import type { PsTab } from './types.ts';
import { PS } from '../../strings/index.ts';

declare module '../registry.ts' {
  interface DialogMap {
    pageSetup: { tab?: PsTab };
  }
}

registerDialog({ id: 'pageSetup', title: PS.title, render: (d, x) => {
    // Profil OnlyOffice : Marges et En-tete/pied de page ont leur propre boite ; Page et Feuille gardent la boite d'origine.
    if (isOnlyOffice() && d.tab === 'margins') return <OoMarginsDialog x={x} />;
    if (isOnlyOffice() && d.tab === 'headerFooter') return <OoHeaderFooterDialog x={x} />;
    return <PageSetupDialog x={x} {...(d.tab ? { tab: d.tab } : {})} />;
  } });
