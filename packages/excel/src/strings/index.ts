// Textes du Tableur (francais, vocabulaire d'Excel 2024), un fichier par domaine ; `S` et `RB` reunissent les domaines.
import { gridStrings } from './grid.ts';
import { statusStrings } from './status.ts';
import { messagesStrings } from './messages.ts';
import { dataStrings } from './data.ts';
import { pivotStrings } from './pivot.ts';
import { dialogsStrings } from './dialogs.ts';
import { printStrings } from './print.ts';
import { chartStrings } from './chart.ts';
import { keysStrings } from './keys.ts';
import { rbCore } from './rb-core.ts';
import { rbHome } from './rb-home.ts';
import { rbCells } from './rb-cells.ts';
import { rbLayout } from './rb-layout.ts';
import { rbData } from './rb-data.ts';

/** Textes de l'interface (hors ruban). */
export const S = {
  ...gridStrings,
  ...statusStrings,
  ...messagesStrings,
  ...dataStrings,
  ...pivotStrings,
  ...dialogsStrings,
  ...printStrings,
  ...chartStrings,
  ...keysStrings,
} as const;

/** Libelles du ruban (onglets, groupes, commandes). */
export const RB = {
  ...rbCore,
  ...rbHome,
  ...rbCells,
  ...rbLayout,
  ...rbData,
} as const;

/** Textes de la boite Format de cellule. */
export { FC } from './format-cells.ts';

/** Textes de la mise en page et de l'impression. */
export { PS } from './page-setup.ts';

/** Textes des formules et des noms (gestionnaire de noms, Inserer une fonction, verification, calcul). */
export { FM } from './formulas.ts';

/** Textes de l'assistant Convertir. */
export { TW } from './text-wizard.ts';
