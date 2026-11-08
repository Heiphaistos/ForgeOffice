// Plan du document : titres Markdown, ou definitions (fonctions, classes...) pour le code.

export interface OutlineItem {
  level: number;
  title: string;
  /** Ligne (0 = premiere). */
  line: number;
}

const CODE_STARTS = [
  'fn ', 'pub fn ', 'pub(crate) fn ', 'async fn ', 'pub async fn ', 'def ', 'async def ', 'class ', 'function ', 'async function ',
  'export function ', 'export async function ', 'export default function ', 'export class ', 'export interface ', 'export type ',
  'func ', 'struct ', 'pub struct ', 'impl ', 'impl<', 'enum ', 'pub enum ', 'trait ', 'pub trait ', 'interface ', 'mod ', 'pub mod ',
  'sub ', 'procedure ', 'module ',
];

/** Forme comparable d'un titre (sans accents ni casse, ponctuation et espaces réduits à un tiret) : « Mon Titre ! » ~ « mon-titre ». */
export function headingKey(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
}

/** Ligne (0 = première) du titre Markdown cité par un lien [[note#titre]] ; null si introuvable. */
export function headingLine(text: string, heading: string): number | null {
  const key = headingKey(heading);
  if (key === '') return null;
  return outline(text, true).find((h) => headingKey(h.title) === key)?.line ?? null;
}

export function outline(text: string, markdown: boolean): OutlineItem[] {
  const out: OutlineItem[] = [];
  let inCode = false;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const t = raw.trimStart();
    if (t.startsWith('```') || t.startsWith('~~~')) {
      inCode = !inCode;
      continue;
    }
    if (markdown) {
      if (inCode) continue;
      const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(t);
      if (m && raw.length - t.length < 4) out.push({ level: (m[1] ?? '#').length, title: (m[2] ?? '').trim(), line: i });
    } else if (CODE_STARTS.some((k) => t.startsWith(k))) {
      const indent = raw.length - t.length;
      const title = t.replace(/[{:\s]+$/, '').slice(0, 80);
      if (title) out.push({ level: 1 + Math.floor(indent / 4), title, line: i });
    }
  }
  return out;
}
