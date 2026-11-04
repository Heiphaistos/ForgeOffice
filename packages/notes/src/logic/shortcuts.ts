// Raccourcis clavier ecrits en francais (« Ctrl+Maj+P ») : correspondance avec un evenement clavier.

export interface KeyLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const NAMED: Readonly<Record<string, string>> = {
  '↑': 'ArrowUp', '↓': 'ArrowDown', '←': 'ArrowLeft', '→': 'ArrowRight', Entrée: 'Enter', Tab: 'Tab', Suppr: 'Delete',
  Échap: 'Escape', PgSuiv: 'PageDown', PgPréc: 'PageUp', Espace: ' ',
};

interface Spec {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

export function parseShortcut(spec: string): Spec {
  const parts = spec.endsWith('++') ? [...spec.slice(0, -2).split('+'), '+'] : spec.split('+');
  const key = parts.pop() ?? '';
  return { ctrl: parts.includes('Ctrl'), alt: parts.includes('Alt'), shift: parts.includes('Maj'), key: NAMED[key] ?? key };
}

export function matchShortcut(spec: string, e: KeyLike): boolean {
  const s = parseShortcut(spec);
  if (s.ctrl !== (e.ctrlKey || e.metaKey) || s.alt !== e.altKey) return false;
  const k = s.key;
  // Lettres, chiffres et touches nommees : Maj compte. Ponctuation : Maj depend du clavier (AZERTY), on l'ignore.
  if (/^[A-Za-z]$/.test(k)) return s.shift === e.shiftKey && (e.key.toLowerCase() === k.toLowerCase() || e.code === `Key${k.toUpperCase()}`);
  if (/^[0-9]$/.test(k)) return s.shift === e.shiftKey && (e.key === k || e.code === `Digit${k}` || e.code === `Numpad${k}`);
  if (k.length > 1) return s.shift === e.shiftKey && e.key === k;
  if (k === '+') return e.key === '+' || e.key === '=' || e.code === 'NumpadAdd';
  if (k === '-') return e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract';
  return e.key === k;
}
