// Liaison commande de la suite imitee -> commande ForgeOffice : alias explicite d'abord, puis libelle identique.
import { fold } from '../text.ts';
import { ALIASES } from './aliases.ts';
import type { Cmd } from './catalog.ts';

export interface Binder {
  find: (uno: string, label: string) => Cmd | null;
  /** References deja liees (pour lister ensuite ce que la suite imitee n'expose pas). */
  used: Set<string>;
}

const norm = (s: string): string => fold(s.replace(/\.\.\.|…/g, '').replace(/[:.]$/, ''));

export function makeBinder(catalog: readonly Cmd[], hostCmds: Readonly<Record<string, () => void>> = {}): Binder {
  const byRef = new Map<string, Cmd>();
  const bySuffix = new Map<string, Cmd>();
  const byLabel = new Map<string, Cmd>();
  for (const c of catalog) {
    byRef.set(c.ref, c);
    const parts = c.ref.split('.');
    // suffixes « groupe.controle[#x] », « controle[#x] » (le premier rencontre gagne : ordre du ruban)
    for (let i = 1; i < parts.length; i++) { const s = parts.slice(i).join('.'); if (!bySuffix.has(s)) bySuffix.set(s, c); }
    const l = norm(c.label);
    if (l && !c.ref.includes('#') && !byLabel.has(l)) byLabel.set(l, c);
  }
  const used = new Set<string>();
  const find = (uno: string, label: string): Cmd | null => {
    const host = hostCmds[uno];
    if (host) return { ref: `host:${uno}`, label, run: host };
    for (const p of ALIASES[uno] ?? []) {
      const hit = byRef.get(p) ?? bySuffix.get(p);
      if (hit) { used.add(hit.ref); return hit; }
    }
    const byName = byLabel.get(norm(label));
    if (byName && (!byName.control || ['toggle', 'split', 'color'].includes(byName.control.kind))) { used.add(byName.ref); return byName; }
    return null;
  };
  return { find, used };
}
