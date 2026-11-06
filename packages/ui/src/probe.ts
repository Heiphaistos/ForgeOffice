// Crochet de test (banc de conformite, apps/web/tests/conformity) : le ruban affiche expose ses onglets. Rien en production.
import type { RibbonTab } from './ribbon-types.ts';

export const ribbonProbe: { tabs: readonly RibbonTab[] } = { tabs: [] };
