// Operations sur les fichiers du dossier ouvert (sans disque) : noms valides, copies sans ecrasement, chemins relatifs, corbeille du dossier.

/** Dossier de corbeille a la racine du dossier ouvert (convention Obsidian) ; ignore par l'explorateur. */
export const TRASH_DIR = '.trash';

const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** Message d'erreur si `name` ne peut pas etre un nom de fichier ou de dossier, sinon null. */
export function nameProblem(name: string): string | null {
  const n = name.trim();
  if (n === '') return 'Le nom est vide.';
  if (n === '.' || n === '..') return 'Ce nom est interdit.';
  if (n.length > 200) return 'Le nom est trop long (200 caractères au plus).';
  if (FORBIDDEN.test(n)) return 'Le nom ne peut pas contenir / \\ : * ? " < > |.';
  if (/[. ]$/.test(n)) return 'Le nom ne peut pas finir par un point ou une espace.';
  if (RESERVED.test(n)) return 'Ce nom est réservé par Windows.';
  return null;
}

export const baseName = (rel: string): string => rel.split('/').pop() ?? rel;
export const parentOf = (rel: string): string => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
export const joinRel = (dir: string, name: string): string => (dir ? `${dir}/${name}` : name);
/** `rel` est `dir` ou se trouve dessous. */
export const isInside = (rel: string, dir: string): boolean => dir === '' || rel === dir || rel.startsWith(`${dir}/`);

/** Chemin apres renommage / deplacement de `from` vers `to` (inchange s'il n'est pas dessous). */
export function remapRel(rel: string, from: string, to: string): string {
  if (rel === from) return to;
  return rel.startsWith(`${from}/`) ? `${to}${rel.slice(from.length)}` : rel;
}

/** « note.md » -> « note (copie).md », « note (copie 2).md »... jamais un nom deja pris (comparaison sans casse). */
export function uniqueName(name: string, taken: ReadonlySet<string>): string {
  const lower = new Set([...taken].map((t) => t.toLowerCase()));
  if (!lower.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 1; ; i++) {
    const candidate = `${stem} (copie${i > 1 ? ` ${i}` : ''})${ext}`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
}

/** Noms deja pris dans le dossier `dir` (fichiers et sous-dossiers directs). */
export function namesIn(dir: string, files: readonly string[], dirs: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const rel of [...files, ...dirs]) {
    if (!isInside(rel, dir) || rel === dir) continue;
    const rest = dir ? rel.slice(dir.length + 1) : rel;
    out.add(rest.split('/')[0] as string);
  }
  return out;
}
