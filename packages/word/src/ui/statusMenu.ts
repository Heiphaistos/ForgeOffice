// Menu de personnalisation de la barre d'état (clic droit) : indicateurs affichés ou masqués.
import type { MenuItem } from '@forgeoffice/ui';
import type { Ctl } from '../app/types.ts';
import { X } from '../strings-extra.ts';

export const STATUS_HIDDEN_SETTING = 'word.statusHidden';

/** Indicateurs masquables, dans l'ordre de la barre. */
export const STATUS_ITEMS: readonly (readonly [string, string])[] = [
  ['page', X.status.page], ['words', X.status.words], ['proof', X.status.proof], ['lang', X.status.lang], ['track', X.status.track], ['timer', X.status.timer],
];

export const isShown = (hidden: readonly string[], id: string): boolean => !hidden.includes(id);

/** Liste des indicateurs masques apres bascule de l'un d'eux. */
export const toggleHidden = (hidden: readonly string[], id: string): string[] => (hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]);

export function statusMenu(c: Ctl): MenuItem[] {
  const hidden = c.ui.statusHidden;
  return [
    { id: 'sb-head', kind: 'header', label: X.status.title },
    ...STATUS_ITEMS.map(([id, label]): MenuItem => ({
      id: `sb-${id}`, label, checked: isShown(hidden, id),
      onClick: () => {
        const next = toggleHidden(hidden, id);
        c.services.settings.set(STATUS_HIDDEN_SETTING, next);
        c.setUi({ statusHidden: next });
      },
    })),
  ];
}
