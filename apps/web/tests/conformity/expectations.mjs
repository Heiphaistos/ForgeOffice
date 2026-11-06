// Attentes de mise en forme : une commande de format doit laisser la valeur voulue dans le snapshot.
// expectationsFor(module, commande) renvoie null ou { check(avant, apres) => null | message d'ecart }.
import { WORD_EXPECT } from './expect-word.mjs';
import { EXCEL_EXPECT } from './expect-excel.mjs';
import { POWERPOINT_EXPECT } from './expect-powerpoint.mjs';

const TABLES = { word: WORD_EXPECT, excel: EXCEL_EXPECT, powerpoint: POWERPOINT_EXPECT };

export function expectationsFor(module, cmd) {
  const table = TABLES[module];
  if (!table) return null;
  const key = Object.keys(table).find((k) => cmd.id === k || (k.endsWith('#') && cmd.id.startsWith(k)));
  if (!key) return null;
  const entry = table[key];
  return typeof entry === 'function' ? { check: entry, cmd } : entry;
}
