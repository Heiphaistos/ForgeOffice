// Attribution des Info-touches (touche Alt) : lettres uniques, comme Office.
import { fold } from './text.ts';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function lettersOf(label: string): string[] {
  return [...fold(label).toUpperCase()].filter((c) => LETTERS.includes(c));
}

/**
 * Attribue une info-touche unique a chaque libelle.
 * Ordre : touche imposee, puis premiere lettre, puis autres lettres du libelle, puis 2 lettres.
 * `reserved` : touches deja prises (ex. « F » pour Fichier).
 */
export function assignKeytips(entries: readonly { label: string; keytip?: string }[], reserved: readonly string[] = []): string[] {
  const used = new Set(reserved.map((r) => r.toUpperCase()));
  const result: string[] = new Array<string>(entries.length).fill('');
  // 1. touches imposees
  entries.forEach((entry, i) => {
    const wanted = entry.keytip?.toUpperCase();
    if (wanted && !used.has(wanted)) {
      used.add(wanted);
      result[i] = wanted;
    }
  });
  // 2. une lettre du libelle
  entries.forEach((entry, i) => {
    if (result[i]) return;
    const free = lettersOf(entry.label).find((c) => !used.has(c));
    if (free) {
      used.add(free);
      result[i] = free;
    }
  });
  // 3. deux lettres : initiale + lettre suivante libre, sinon combinaison quelconque
  entries.forEach((entry, i) => {
    if (result[i]) return;
    const letters = lettersOf(entry.label);
    const first = letters[0] ?? 'Z';
    const pool = [...letters.slice(1), ...LETTERS];
    const pair = pool.map((c) => first + c).find((p) => !used.has(p) && ![...used].some((u) => u.length === 1 && p.startsWith(u)));
    const fallback = [...LETTERS].flatMap((a) => [...LETTERS].map((b) => a + b)).find((p) => !used.has(p) && ![...used].some((u) => u.length === 1 && p.startsWith(u)));
    const chosen = pair ?? fallback ?? '';
    used.add(chosen);
    result[i] = chosen;
  });
  return result;
}

/** Etat de la saisie d'info-touche : 'match' (declencher), 'prefix' (attendre), 'none'. */
export function keytipMatch(typed: string, keytips: readonly string[]): { state: 'match' | 'prefix' | 'none'; index: number } {
  const t = typed.toUpperCase();
  const exact = keytips.indexOf(t);
  if (exact >= 0) return { state: 'match', index: exact };
  if (keytips.some((k) => k.startsWith(t))) return { state: 'prefix', index: -1 };
  return { state: 'none', index: -1 };
}
