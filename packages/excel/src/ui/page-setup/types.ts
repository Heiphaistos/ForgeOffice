// Types communs des onglets de la boite Mise en page.
import type { PageSetup } from '@forgeoffice/xlsx';

/** Modification d'une copie de travail : une valeur `undefined` supprime la cle. */
export type PsPatch = { [K in keyof PageSetup]?: PageSetup[K] | undefined };

export interface TabProps {
  /** Copie de travail de la mise en page (validee par OK). */
  d: PageSetup;
  up: (patch: PsPatch) => void;
}

export type PsTab = 'page' | 'margins' | 'headerFooter' | 'sheet';
