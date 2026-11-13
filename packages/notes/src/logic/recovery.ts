// Récupération après arrêt brutal : copies de secours des documents modifiés, une entrée par fenêtre.
// Une sortie normale retire l'entrée de la fenêtre ; celle d'une fenêtre disparue sans sortie (signe de vie périmé) est reprise au démarrage.
import { isEncoding, isEol, type Eol, type TextEncoding } from './encoding.ts';
import { STALE_MS, type AliveMap } from './session.ts';

export const RECOVERY_KEY = 'notes.recovery';
/** Au-delà, un document n'est pas copié (le stockage du navigateur est limité) ; idem pour le total d'une fenêtre. */
export const MAX_DOC_CHARS = 1_000_000;
export const MAX_TOTAL_CHARS = 2_000_000;
const MAX_WINDOWS = 20;
const MAX_DOCS = 50;

export interface RecoveredDoc {
  name: string;
  path: string | null;
  encoding: TextEncoding;
  eol: Eol;
  text: string;
}

export interface RecoveryEntry {
  win: string;
  docs: RecoveredDoc[];
}

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v : null);

function parseDoc(v: unknown): RecoveredDoc | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const name = str(o.name, 512);
  const text = str(o.text, MAX_DOC_CHARS);
  if (!name || text === null) return null;
  return { name, path: o.path === null ? null : str(o.path, 4096), encoding: isEncoding(o.encoding) ? o.encoding : 'utf-8', eol: isEol(o.eol) ? o.eol : 'crlf', text };
}

/** Lit le magasin enregistré (donnée hostile : tout est vérifié). */
export function parseRecovery(raw: unknown): RecoveryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: RecoveryEntry[] = [];
  for (const e of raw.slice(0, MAX_WINDOWS)) {
    const o = typeof e === 'object' && e !== null ? (e as Record<string, unknown>) : null;
    const win = o ? str(o.win, 64) : null;
    if (!o || !win || !Array.isArray(o.docs)) continue;
    out.push({ win, docs: o.docs.slice(0, MAX_DOCS).map(parseDoc).filter((d): d is RecoveredDoc => d !== null) });
  }
  return out;
}

/** Remplace l'entrée de `win` par ces copies (trop grosses : ignorées) ; aucune copie = entrée retirée. */
export function snapshot(store: readonly RecoveryEntry[], win: string, docs: readonly RecoveredDoc[]): RecoveryEntry[] {
  let total = 0;
  const kept: RecoveredDoc[] = [];
  for (const d of docs) {
    if (d.text.length > MAX_DOC_CHARS || total + d.text.length > MAX_TOTAL_CHARS || kept.length >= MAX_DOCS) continue;
    total += d.text.length;
    kept.push(d);
  }
  const others = store.filter((e) => e.win !== win);
  return kept.length ? [...others, { win, docs: kept }] : others;
}

/** Copies des fenêtres disparues sans sortie normale dont le texte n'est dans aucun document ouvert ; leurs entrées quittent le magasin. */
export function claimRecovery(store: readonly RecoveryEntry[], alive: AliveMap, now: number, openTexts: ReadonlySet<string>, staleMs = STALE_MS): { docs: RecoveredDoc[]; store: RecoveryEntry[] } {
  const docs: RecoveredDoc[] = [];
  const kept: RecoveryEntry[] = [];
  for (const e of store) {
    if ((alive[e.win] ?? 0) > now - staleMs) kept.push(e);
    else for (const d of e.docs) if (!openTexts.has(d.text)) docs.push(d);
  }
  return { docs, store: kept };
}
