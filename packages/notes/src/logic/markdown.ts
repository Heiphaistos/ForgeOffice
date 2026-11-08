// Mise en forme Markdown (texte pur, testé) : gras, italique, barré, code, lien, titres, listes, citation. Chaque fonction renvoie
// une modification (remplacement d'une plage + nouvelle sélection) que l'éditeur applique en une seule transaction.

export interface Edit {
  from: number;
  to: number;
  insert: string;
  anchor: number;
  head: number;
}

export type InlineMark = '**' | '*' | '~~' | '`';

const WORD = /[\p{L}\p{N}_]/u;

const run = (text: string, from: number, step: 1 | -1, ch: string): number => {
  let n = 0;
  for (let i = step === 1 ? from : from - 1; i >= 0 && i < text.length && text[i] === ch; i += step) n++;
  return n;
};

/** Met en forme la sélection ; sans sélection, le mot sous le curseur ; sans mot, une paire de marques avec le curseur au milieu. */
export function toggleInline(doc: string, from: number, to: number, mark: InlineMark): Edit {
  let a = from;
  let b = to;
  if (a === b) {
    while (a > 0 && WORD.test(doc[a - 1] ?? '')) a--;
    while (b < doc.length && WORD.test(doc[b] ?? '')) b++;
    if (a === b) return { from, to, insert: mark + mark, anchor: from + mark.length, head: from + mark.length };
  }
  const m = mark.length;
  const star = mark.charAt(0) === '*';
  const before = star ? run(doc, a, -1, '*') : doc.slice(a - m, a) === mark ? m : 0;
  const after = star ? run(doc, b, 1, '*') : doc.slice(b, b + m) === mark ? m : 0;
  const present = Math.min(before, after);
  // Marques déjà autour de la sélection : on les retire (gras = 2 étoiles, italique = 1, ce qui reste dans ***x*** est conservé).
  const wrapped = mark === '**' ? present >= 2 : mark === '*' ? present % 2 === 1 : present >= m;
  if (wrapped) return { from: a - m, to: b + m, insert: doc.slice(a, b), anchor: a - m, head: b - m };
  // Marques à l'intérieur de la sélection (« **texte** » sélectionné avec ses marques).
  const inner = doc.slice(a, b);
  if (mark !== '*' && inner.length > 2 * m && inner.startsWith(mark) && inner.endsWith(mark)) {
    return { from: a, to: b, insert: inner.slice(m, -m), anchor: a, head: b - 2 * m };
  }
  return { from: a, to: b, insert: mark + inner + mark, anchor: a + m, head: b + m };
}

/** Lien Markdown : texte sélectionné comme libellé (adresse à saisir), adresse sélectionnée comme cible (libellé à saisir). */
export function makeLink(doc: string, from: number, to: number): Edit {
  const sel = doc.slice(from, to);
  if (/^(https?:\/\/|mailto:)\S+$/.test(sel)) return { from, to, insert: `[](${sel})`, anchor: from + 1, head: from + 1 };
  const label = sel === '' ? 'texte' : sel;
  const insert = `[${label}](https://)`;
  const urlStart = from + label.length + 3;
  return { from, to, insert, anchor: urlStart, head: urlStart + 'https://'.length };
}

export type LineStyle = 'bullet' | 'number' | 'task' | 'quote';

const LIST_PREFIX = /^(\s*)(?:[-*+] \[[ xX]\] |[-*+] |\d+[.)] |> ?)/;

const prefixOf = (style: LineStyle, i: number): string => (style === 'bullet' ? '- ' : style === 'task' ? '- [ ] ' : style === 'quote' ? '> ' : `${i + 1}. `);
const hasStyle = (line: string, style: LineStyle): boolean => {
  if (style === 'bullet') return /^\s*[-*+] (?!\[[ xX]\] )/.test(line);
  if (style === 'task') return /^\s*[-*+] \[[ xX]\] /.test(line);
  if (style === 'number') return /^\s*\d+[.)] /.test(line);
  return /^\s*> ?/.test(line);
};

/** Bascule le style de liste ou de citation des lignes non vides : si toutes l'ont déjà, il est retiré ; sinon il remplace l'ancien. */
export function toggleLineStyle(lines: readonly string[], style: LineStyle): string[] {
  const filled = lines.filter((l) => l.trim() !== '');
  const remove = filled.length > 0 && filled.every((l) => hasStyle(l, style));
  let n = 0;
  return lines.map((l) => {
    if (l.trim() === '') return l;
    const indent = l.match(/^\s*/)?.[0] ?? '';
    const content = l.replace(LIST_PREFIX, '$1').slice(indent.length);
    return remove ? indent + content : indent + prefixOf(style, n++) + content;
  });
}

/** Titre de niveau `level` (1 à 6) ; le même niveau déjà présent est retiré. */
export function setHeading(line: string, level: number): string {
  const m = line.match(/^(#{1,6})[ \t]+/);
  const body = m ? line.slice(m[0].length) : line;
  return m && m[1]?.length === level ? body : `${'#'.repeat(level)} ${body}`;
}
