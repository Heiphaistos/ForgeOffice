// Barre de saisie de formule au-dessus du clavier virtuel : operateurs et signes courants sans changer de clavier.
import { KeyboardBar, insertTextAtCaret, type KeyboardBarItem } from '@forgeoffice/ui';
import { S } from '../strings.ts';

const KEYS = ['=', '+', '-', '*', '/', '(', ')', ';', ':', '$', '"', '%', '<', '>', '&'] as const;

const ITEMS: readonly KeyboardBarItem[] = KEYS.map((k) => ({ id: `k${k}`, label: S.insertSign(k), text: k, onClick: () => insertTextAtCaret(k) }));

export function KeyBar() {
  return <KeyboardBar items={ITEMS} scope=".xl-fi" overflow="scroll" />;
}
