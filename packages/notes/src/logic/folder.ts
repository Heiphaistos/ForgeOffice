// Dossier ouvert (explorateur facon Obsidian) : filtrage des fichiers et arborescence a plat.

export const FOLDER_LIMITS = { maxFiles: 3000, maxFileBytes: 2 * 1024 * 1024, maxTotalBytes: 64 * 1024 * 1024 } as const;

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'target', '.logs', 'dist', 'build', '.obsidian', '.trash']);

export interface FolderFile {
  /** Chemin relatif au dossier ouvert, separateur « / ». */
  rel: string;
  text: string;
}

export function extensionOf(name: string): string {
  const base = name.split('/').pop() ?? name;
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase();
}

/** Fichier a charger : texte connu, pas trop gros, hors dossiers techniques. */
export function acceptFolderFile(rel: string, size: number, extensions: readonly string[]): boolean {
  if (size > FOLDER_LIMITS.maxFileBytes) return false;
  const parts = rel.split('/');
  if (parts.some((p) => p === '..' || IGNORED_DIRS.has(p))) return false;
  return extensions.includes(extensionOf(rel));
}

export interface FolderRow {
  depth: number;
  name: string;
  /** Chemin relatif du dossier ou du fichier. */
  rel: string;
  dir: boolean;
}

/** Lignes de l'arbre (dossiers d'abord, ordre alphabetique), sans le contenu des dossiers replies. */
export function folderRows(rels: readonly string[], collapsed: ReadonlySet<string>): FolderRow[] {
  interface Node { dirs: Map<string, Node>; files: string[] }
  const root: Node = { dirs: new Map(), files: [] };
  for (const rel of rels) {
    const parts = rel.split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      let next = node.dirs.get(part);
      if (!next) {
        next = { dirs: new Map(), files: [] };
        node.dirs.set(part, next);
      }
      node = next;
    }
    node.files.push(rel);
  }
  const cmp = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' }).compare;
  const rows: FolderRow[] = [];
  const walk = (node: Node, prefix: string, depth: number): void => {
    for (const name of [...node.dirs.keys()].sort(cmp)) {
      const rel = prefix ? `${prefix}/${name}` : name;
      rows.push({ depth, name, rel, dir: true });
      const child = node.dirs.get(name);
      if (child && !collapsed.has(rel)) walk(child, rel, depth + 1);
    }
    for (const rel of [...node.files].sort((a, b) => cmp(a, b))) rows.push({ depth, name: rel.split('/').pop() ?? rel, rel, dir: false });
  };
  walk(root, '', 0);
  return rows;
}
