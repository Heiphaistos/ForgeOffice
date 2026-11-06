// « Dernier réglage personnalisé » du menu Marges : derniere marge saisie dans la boite Mise en page (pour la session).
import type { PageMargins } from '@forgeoffice/xlsx';

let last: PageMargins | undefined;
export const rememberMargins = (m: PageMargins): void => {
  last = { ...m };
};
export const lastMargins = (): PageMargins | undefined => last;
