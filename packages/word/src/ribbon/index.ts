// Ruban complet du module Texte (onglets fixes + onglets contextuels).
import type { RibbonTab } from '@forgeoffice/ui';
import type { Ctl } from '../app/types.ts';
import { homeTab } from './home.ts';
import { drawTab, insertTab } from './insert.tsx';
import { designTab, layoutTab } from './page.ts';
import { mailingsTab, referencesTab } from './references.ts';
import { reviewTab, viewTab } from './review.ts';
import { shapeTab } from '../objects/shapeTab.ts';
import { outlineTab, pictureTab, tableDesignTab, tableLayoutTab } from './contextual.ts';

export function wordTabs(c: Ctl): RibbonTab[] {
  return [
    outlineTab(c), homeTab(c), insertTab(c), drawTab(c), designTab(c), layoutTab(c), referencesTab(c), mailingsTab(c), reviewTab(c), viewTab(c),
    tableDesignTab(c), tableLayoutTab(c), pictureTab(c), shapeTab(c),
  ];
}
