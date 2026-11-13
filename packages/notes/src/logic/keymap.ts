// Raccourcis clavier personnalises : un texte « Ctrl+Maj+K = libelle de la commande » par ligne (meme format que le raccourcis.txt de WinNote).

export const KEYMAP_KEY = 'notes.keymap';
const MAX_TEXT = 20_000;

const NAMED: Readonly<Record<string, string>> = {
  entree: 'Entrée', enter: 'Entrée', tab: 'Tab', suppr: 'Suppr', delete: 'Suppr', echap: 'Échap', escape: 'Échap', espace: 'Espace', space: 'Espace',
  pgsuiv: 'PgSuiv', pagedown: 'PgSuiv', pgprec: 'PgPréc', pageup: 'PgPréc', haut: '↑', bas: '↓', gauche: '←', droite: '→',
  up: '↑', down: '↓', left: '←', right: '→', '↑': '↑', '↓': '↓', '←': '←', '→': '→',
};

/** « ctrl+shift+k » -> « Ctrl+Maj+K ». Refuse une touche sans Ctrl/Alt (sauf F1 a F24), pour ne pas voler la frappe normale. */
export function normalizeChord(spec: string): string | null {
  const mods = { ctrl: false, alt: false, shift: false };
  let key = '';
  const parts = spec.trim().endsWith('++') ? [...spec.trim().slice(0, -2).split('+'), '+'] : spec.split('+');
  for (const raw of parts) {
    const t = raw.trim();
    if (!t) return null;
    const low = t.toLowerCase();
    if (low === 'ctrl' || low === 'ctl' || low === 'control') mods.ctrl = true;
    else if (low === 'alt') mods.alt = true;
    else if (low === 'maj' || low === 'shift') mods.shift = true;
    else if (key) return null;
    else if (/^f([1-9]|1\d|2[0-4])$/.test(low)) key = low.toUpperCase();
    else if (NAMED[low]) key = NAMED[low] as string;
    else if (/^[a-z0-9]$/i.test(t)) key = t.toUpperCase();
    else if (/^[-+=/\\[\].,;'`]$/.test(t)) key = t;
    else return null;
  }
  if (!key || (!mods.ctrl && !mods.alt && !/^F\d+$/.test(key))) return null;
  return [mods.ctrl && 'Ctrl', mods.alt && 'Alt', mods.shift && 'Maj', key].filter(Boolean).join('+');
}

export interface KeymapError {
  line: number;
  text: string;
  why: string;
}

export interface Keymap {
  /** identifiant de commande -> raccourci normalise */
  overrides: Readonly<Record<string, string>>;
  errors: KeymapError[];
}

/** Lit le texte des raccourcis. `#` commence un commentaire ; la commande est son libelle (casse ignoree) ou son identifiant. */
export function parseKeymap(text: string, commands: readonly { id: string; label: string }[]): Keymap {
  const overrides: Record<string, string> = {};
  const errors: KeymapError[] = [];
  const byName = new Map<string, string>();
  for (const c of commands) {
    byName.set(c.id.toLowerCase(), c.id);
    byName.set(c.label.toLowerCase(), c.id);
  }
  const taken = new Map<string, string>();
  text.slice(0, MAX_TEXT).split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const eq = line.lastIndexOf('=');
    // Le « = » de la touche (Ctrl+=) : le separateur est le dernier « = » precede d'une espace ou suivi d'un nom.
    const at = line.indexOf(' = ') >= 0 ? line.indexOf(' = ') + 1 : eq;
    if (at <= 0) return void errors.push({ line: i + 1, text: raw, why: 'Format attendu : Ctrl+Maj+K = nom de la commande' });
    const chord = normalizeChord(line.slice(0, at));
    const name = line.slice(at + 1).trim().toLowerCase();
    const id = byName.get(name);
    if (!chord) return void errors.push({ line: i + 1, text: raw, why: 'Raccourci invalide (Ctrl ou Alt, ou une touche F1-F24, requis)' });
    if (!id) return void errors.push({ line: i + 1, text: raw, why: 'Commande inconnue' });
    const other = taken.get(chord);
    if (other && other !== id) return void errors.push({ line: i + 1, text: raw, why: 'Raccourci deja donne a une autre commande de ce fichier' });
    taken.set(chord, id);
    overrides[id] = chord;
  });
  return { overrides, errors };
}

/** Texte d'edition de depart : les raccourcis actuels du fichier, avec un rappel du format. */
export const KEYMAP_HELP = '# Un raccourci par ligne :  Ctrl+Maj+K = nom de la commande (tel qu il apparait dans la palette)\n# Exemple :  Ctrl+Alt+D = Note du jour\n';

/** Applique les raccourcis personnalises : ils remplacent le raccourci de la commande et retirent le meme raccourci aux autres. */
export function applyKeymap<T extends { id: string; key?: string; nativeKey?: boolean }>(list: readonly T[], overrides: Readonly<Record<string, string>>): T[] {
  const used = new Set(Object.values(overrides));
  return list.map((c) => {
    const own = overrides[c.id];
    if (own) return { ...c, key: own, nativeKey: false };
    return c.key && used.has(c.key) ? { ...c, key: undefined, nativeKey: false } : c;
  });
}
