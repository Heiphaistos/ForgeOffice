// OPML (plan hierarchique) vers Markdown : une liste a puces imbriquee, un lien quand l'entree porte xmlUrl ou url.
// Sans DOM, teste.
import { S } from './strings.ts';

const ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith('#')) return String.fromCodePoint(Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function attrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[(m[1] ?? '').toLowerCase()] = decode(m[2] ?? m[3] ?? '');
  return out;
}

const escapeMd = (s: string): string => s.replace(/([\`*_[\]])/g, '\$1');

/** Markdown d'un document OPML ; erreur claire si le fichier n'en est pas un. */
export function opmlToMarkdown(xml: string): string {
  if (!/<opml[\s>]/i.test(xml)) throw new Error(S.opml.invalid);
  const title = decode((xml.match(/<head>[\s\S]*?<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim());
  const body = xml.slice(xml.search(/<body[\s>]/i) >= 0 ? xml.search(/<body[\s>]/i) : 0);
  const lines: string[] = title ? [`# ${escapeMd(title)}`, ''] : [];
  let depth = 0;
  for (const m of body.matchAll(/<(\/?)outline\b([^>]*?)(\/?)>/gi)) {
    if (m[1] === '/') { depth = Math.max(0, depth - 1); continue; }
    const a = attrs(m[2] ?? '');
    const text = (a.text ?? a.title ?? '').trim();
    const url = a.xmlurl ?? a.htmlurl ?? a.url;
    const label = escapeMd(text);
    lines.push(`${'  '.repeat(depth)}- ${url ? `[${label || url}](${url})` : label}`);
    if (m[3] !== '/') depth++;
  }
  return `${lines.join('\n')}\n`;
}
