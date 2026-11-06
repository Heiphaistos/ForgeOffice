// Barre au-dessus du clavier virtuel : mise en forme des cellules (memes commandes que le ruban Accueil) puis signes de formule.
import { KeyboardBar, insertTextAtCaret, itemsFromTab, type KeyboardBarItem, type RibbonTab } from '@forgeoffice/ui';
import { S } from '../strings/index.ts';

const KEYS = ['=', '+', '-', '*', '/', '(', ')', ';', ':', '$', '"', '%', '<', '>', '&'] as const;

const SIGNS: readonly KeyboardBarItem[] = KEYS.map((k, i) => ({ id: `k${k}`, label: S.insertSign(k), text: k, separator: i === 0 || undefined, onClick: () => insertTextAtCaret(k) }));

/** Identifiants des commandes de l'onglet Accueil reprises dans la barre. */
const FORMAT_IDS = ['bold', 'italic', 'underline', 'fontcolor', 'fill', 'left', 'center', 'right', 'wrap', 'merge', 'numfmt', 'percent', 'comma', 'borders'] as const;

export function KeyBar({ home }: { home: RibbonTab }) {
  return <KeyboardBar items={[...itemsFromTab(home, FORMAT_IDS), ...SIGNS]} scope=".xl-fi" overflow="scroll" />;
}
