// Raccourcis de mise en forme (hors saisie) : gras, italique, souligne, barre, taille de police, formats de nombre Ctrl+Maj+symbole,
// contours, Format de cellule (Ctrl+1, Ctrl+Maj+F/P pour l'onglet Police).
import { isDigit, KEY_FORMATS } from '../logic/keys-logic.ts';
import { registerShortcuts, type ShortcutDef } from './registry.ts';

/** Ctrl+Maj+symbole : Maj et Alt indifferents (le symbole est produit avec Maj en QWERTY, sans en AZERTY ; AltGr = Ctrl+Alt pour ~ # @). */
const symbol = (id: string, key: string, run: ShortcutDef<'grid'>['run']): ShortcutDef<'grid'> => ({ id, context: 'grid', combo: `Ctrl+~Shift+~Alt+${key}`, run });
const format = (id: string, key: string, code: string): ShortcutDef<'grid'> => symbol(`format.${id}`, key, (k) => k.cmd.numberFormat(code));

registerShortcuts<'grid'>([
  { id: 'format.bold', context: 'grid', combo: 'Ctrl+~Shift+~Alt+g', run: (k) => k.cmd.bold() },
  { id: 'format.italic', context: 'grid', combo: 'Ctrl+~Shift+~Alt+i', run: (k) => k.cmd.italic() },
  { id: 'format.underline', context: 'grid', combo: 'Ctrl+~Shift+~Alt+u', run: (k) => k.cmd.underline() },
  { id: 'format.strike', context: 'grid', combo: 'Ctrl+~Shift+~Alt+5', run: (k) => k.cmd.strike() },
  // Ctrl+Maj+F / Ctrl+Maj+P : Format de cellule, onglet Police (priorite sur Ctrl+F / Ctrl+P qui ignorent Maj).
  { id: 'format.fontTab.f', context: 'grid', combo: 'Ctrl+Shift+~Alt+f', priority: 10, run: (k) => k.open({ kind: 'formatCells', tab: 'font' }) },
  { id: 'format.fontTab.p', context: 'grid', combo: 'Ctrl+Shift+~Alt+p', priority: 10, run: (k) => k.open({ kind: 'formatCells', tab: 'font' }) },
  // Ctrl+Maj+> / Ctrl+Maj+< : agrandir / reduire la police (Maj indifferent : « < » est une touche directe en AZERTY).
  symbol('format.grow', '>', (k) => k.cmd.growFont(1)),
  symbol('format.shrink', '<', (k) => k.cmd.growFont(-1)),
  format('general', '~', KEY_FORMATS.general),
  format('number', '!', KEY_FORMATS.number),
  format('date', '#', KEY_FORMATS.date),
  format('time', '@', KEY_FORMATS.time),
  format('currency', '$', KEY_FORMATS.currency),
  format('percent', '%', KEY_FORMATS.percent),
  format('scientific', '^', KEY_FORMATS.scientific),
  // « ^ » est une touche morte en AZERTY (key « Dead », touche physique des crochets, sans Maj).
  {
    id: 'format.scientific.dead', context: 'grid', test: (e) => (e.ctrlKey || e.metaKey) && e.key === 'Dead' && e.code === 'BracketLeft' && !e.shiftKey,
    run: (k) => k.cmd.numberFormat(KEY_FORMATS.scientific),
  },
  symbol('format.outline', '&', (k) => k.cmd.borders('outside')),
  symbol('format.noBorder', '_', (k) => k.cmd.borders('none')),
  // Ctrl+9 / Ctrl+0 : masquer les lignes / colonnes ; Ctrl+Maj+( / ) : les afficher.
  { id: 'format.hideRows', context: 'grid', test: (e) => (e.ctrlKey || e.metaKey) && !e.altKey && isDigit(e, '9'), run: (k) => k.cmd.hide('row', true) },
  { id: 'format.hideCols', context: 'grid', test: (e) => (e.ctrlKey || e.metaKey) && !e.altKey && isDigit(e, '0'), run: (k) => k.cmd.hide('col', true) },
  symbol('format.showRows', '(', (k) => k.cmd.hide('row', false)),
  symbol('format.showCols', ')', (k) => k.cmd.hide('col', false)),
  { id: 'format.cells', context: 'grid', combo: 'Ctrl+~Shift+~Alt+1', run: (k) => k.open({ kind: 'formatCells' }) },
]);
