// Liens facon Obsidian : [[note]], [[note#titre]], [[note|alias]], retroliens, lien sous le curseur.

export interface WikiLink {
  /** Debut de « [[ » et fin apres « ]] » (positions dans le texte analyse). */
  from: number;
  to: number;
  target: string;
  heading: string | null;
  alias: string | null;
}

const WIKI = /\[\[([^[\]\n]+?)\]\]/g;

export function findWikiLinks(text: string): WikiLink[] {
  const out: WikiLink[] = [];
  for (const m of text.matchAll(WIKI)) {
    const inner = m[1] ?? '';
    const bar = inner.indexOf('|');
    const ref = bar < 0 ? inner : inner.slice(0, bar);
    const hash = ref.indexOf('#');
    const target = (hash < 0 ? ref : ref.slice(0, hash)).trim();
    if (!target) continue;
    out.push({
      from: m.index,
      to: m.index + m[0].length,
      target,
      heading: hash < 0 ? null : ref.slice(hash + 1).trim() || null,
      alias: bar < 0 ? null : inner.slice(bar + 1).trim() || null,
    });
  }
  return out;
}

/** Cle de comparaison d'une note : nom sans dossier ni extension texte, en minuscules. */
export function noteKey(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  return base.replace(/\.(md|markdown|mdx|txt)$/i, '').trim().normalize('NFC').toLocaleLowerCase('fr');
}

export interface NoteSource {
  id: string;
  name: string;
  text: string;
}

export interface Backlink {
  sourceId: string;
  sourceName: string;
  /** Ligne (0 = premiere). */
  line: number;
  excerpt: string;
}

const MAX_PER_SOURCE = 20;

/** Lignes des autres notes qui pointent vers `targetName`. */
export function backlinks(targetName: string, sources: readonly NoteSource[], selfId: string | null): Backlink[] {
  const key = noteKey(targetName);
  if (!key) return [];
  const out: Backlink[] = [];
  for (const src of sources) {
    if (src.id === selfId || !src.text.includes('[[')) continue;
    let count = 0;
    const lines = src.text.split('\n');
    for (let i = 0; i < lines.length && count < MAX_PER_SOURCE; i++) {
      const line = lines[i] ?? '';
      if (findWikiLinks(line).some((l) => noteKey(l.target) === key)) {
        out.push({ sourceId: src.id, sourceName: src.name, line: i, excerpt: line.trim().slice(0, 140) });
        count++;
      }
    }
  }
  return out;
}

export type LinkTarget = { kind: 'note'; target: string; heading: string | null } | { kind: 'url'; url: string };

const URL_TOKEN = /(?:https?:\/\/|mailto:)[^\s<>"'()]+/g;

/** Lien sous la colonne `col` d'une ligne : [[note]], URL nue ou lien Markdown [texte](url). */
export function linkAt(line: string, col: number): LinkTarget | null {
  for (const l of findWikiLinks(line)) {
    if (col >= l.from && col <= l.to) return { kind: 'note', target: l.target, heading: l.heading };
  }
  for (const m of line.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    if (col >= m.index && col <= m.index + m[0].length) return { kind: 'url', url: m[1] ?? '' };
  }
  for (const m of line.matchAll(URL_TOKEN)) {
    if (col >= m.index && col <= m.index + m[0].length) return { kind: 'url', url: m[0].replace(/[.,;:!?]+$/, '') };
  }
  return null;
}

/** Seules les adresses web et mail sont ouvertes (pas de javascript:, file:, data:). */
export function isSafeUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(url.trim());
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** HTML d'apercu : chaque [[note]] du texte devient un lien interne <a data-note>. */
export function linkifyWikiHtml(html: string): string {
  return html.replace(/(<[^>]*>)|([^<]+)/g, (_, tag: string | undefined, text: string | undefined) => {
    if (tag !== undefined) return tag;
    const t = text ?? '';
    let out = '';
    let last = 0;
    for (const l of findWikiLinks(t)) {
      // Le texte vient d'un HTML deja echappe : on decode les entites pour la cle, on reechappe pour l'attribut.
      const target = decodeEntities(l.target);
      const label = l.alias ?? (l.heading ? `${l.target} › ${l.heading}` : l.target);
      const heading = l.heading ? ` data-heading="${escapeHtml(decodeEntities(l.heading))}"` : '';
      out += `${t.slice(last, l.from)}<a class="nt-wikilink" href="#" data-note="${escapeHtml(target)}"${heading}>${label}</a>`;
      last = l.to;
    }
    return out + t.slice(last);
  });
}

function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    const code = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
  });
}
