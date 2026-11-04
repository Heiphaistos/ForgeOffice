// Session : onglets restaures au redemarrage, y compris les textes non enregistres.
// Une entree par fenetre : chaque fenetre n'ecrit que la sienne et reprend celles des fenetres fermees.
import { isEncoding, isEol, type Eol, type TextEncoding } from './encoding.ts';

export const SESSION_KEY = 'notes.session';
/** Signes de vie des fenetres ouvertes : { fenetre: millisecondes }. Petite cle ecrite souvent, a part des textes. */
export const ALIVE_KEY = 'notes.alive';
/** Une fenetre sans signe de vie depuis ce delai est consideree fermee (sa session est reprise). */
export const STALE_MS = 15_000;
/** Au-dela, le texte n'est pas garde dans la session (le stockage du navigateur est limite). */
export const MAX_TAB_TEXT = 4_000_000;
const MAX_WINDOWS = 20;
const MAX_TABS = 200;

export interface SessionTab {
  name: string;
  path: string | null;
  /** Chemin relatif dans le dossier ouvert (explorateur), sinon null. */
  origin: string | null;
  encoding: TextEncoding;
  eol: Eol;
  lang: string | null;
  dirty: boolean;
  readOnly: boolean;
  /** null = relire le fichier `path` au demarrage. */
  text: string | null;
  cursor: number;
}

export interface WindowSession {
  win: string;
  active: number;
  tabs: SessionTab[];
}

export interface SessionStore {
  windows: WindowSession[];
}

/** Le texte n'est garde que s'il ne peut pas etre relu tel quel depuis le disque. */
export function keepText(tab: { dirty: boolean; path: string | null }, length: number): boolean {
  return (tab.dirty || tab.path === null) && length <= MAX_TAB_TEXT;
}

const str = (v: unknown, max = 4096): string | null => (typeof v === 'string' && v.length <= max ? v : null);

function parseTab(v: unknown): SessionTab | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const name = str(o.name, 512);
  const text = o.text === null ? null : str(o.text, MAX_TAB_TEXT);
  const path = o.path === null ? null : str(o.path);
  if (!name || (text === null && path === null)) return null;
  return {
    name,
    path,
    origin: str(o.origin),
    encoding: isEncoding(o.encoding) ? o.encoding : 'utf-8',
    eol: isEol(o.eol) ? o.eol : 'crlf',
    lang: str(o.lang, 100),
    dirty: o.dirty === true,
    readOnly: o.readOnly === true,
    text,
    cursor: typeof o.cursor === 'number' && Number.isInteger(o.cursor) && o.cursor >= 0 ? o.cursor : 0,
  };
}

/** Lit la session enregistree (donnee hostile : tout est verifie). */
export function parseStore(raw: unknown): SessionStore {
  const list = typeof raw === 'object' && raw !== null ? (raw as { windows?: unknown }).windows : null;
  if (!Array.isArray(list)) return { windows: [] };
  const windows: WindowSession[] = [];
  for (const w of list.slice(0, MAX_WINDOWS)) {
    if (typeof w !== 'object' || w === null) continue;
    const o = w as Record<string, unknown>;
    const win = str(o.win, 64);
    if (!win || !Array.isArray(o.tabs)) continue;
    const tabs = o.tabs.slice(0, MAX_TABS).map(parseTab).filter((t): t is SessionTab => t !== null);
    const active = typeof o.active === 'number' && Number.isInteger(o.active) ? Math.min(Math.max(o.active, 0), Math.max(tabs.length - 1, 0)) : 0;
    windows.push({ win, active, tabs });
  }
  return { windows };
}

export type AliveMap = Record<string, number>;

export function parseAlive(raw: unknown): AliveMap {
  const out: AliveMap = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [k, v] of Object.entries(raw).slice(0, MAX_WINDOWS * 2)) if (typeof v === 'number' && k.length <= 64) out[k] = v;
  return out;
}

/** Signe de vie de `win` ; les fenetres muettes sont oubliees. `seen` = 0 : fenetre fermee. */
export function touchAlive(alive: AliveMap, win: string, now: number, seen: number, staleMs = STALE_MS): AliveMap {
  const out: AliveMap = {};
  for (const [k, v] of Object.entries(alive)) if (k !== win && v > now - staleMs) out[k] = v;
  if (seen > 0) out[win] = seen;
  return out;
}

export interface Claimed {
  tabs: SessionTab[];
  active: number;
  store: SessionStore;
}

/** Reprend les onglets des fenetres fermees (ou muettes depuis STALE_MS) et les retire du magasin. */
export function claimSession(store: SessionStore, alive: AliveMap, now: number, staleMs = STALE_MS): Claimed {
  const tabs: SessionTab[] = [];
  let active = -1;
  const kept: WindowSession[] = [];
  for (const w of store.windows) {
    if ((alive[w.win] ?? 0) > now - staleMs) {
      kept.push(w);
      continue;
    }
    if (active < 0 && w.tabs.length) active = tabs.length + w.active;
    tabs.push(...w.tabs);
  }
  return { tabs, active: Math.max(active, 0), store: { windows: kept } };
}

/** Remplace l'entree de la fenetre `w.win`. */
export function upsertWindow(store: SessionStore, w: WindowSession): SessionStore {
  return { windows: [...store.windows.filter((x) => x.win !== w.win), w] };
}
