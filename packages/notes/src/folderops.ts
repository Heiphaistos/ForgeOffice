// Operations de l'explorateur sur le dossier ouvert : nouveau fichier / dossier, renommer, dupliquer, deplacer, supprimer (corbeille du dossier), actualiser.
// Elles passent par `FolderFs` (acces en ecriture donne par le navigateur ou la coquille) ; sans lui, tout est refuse avec une explication.
import type { FolderFs } from './folderfs.ts';
import { TRASH_DIR, baseName, isInside, joinRel, nameProblem, namesIn, parentOf, remapRel, uniqueName } from './logic/fileops.ts';
import { S } from './strings.ts';
import { errorText, type Workspace } from './workspace.ts';

export type PromptKind = 'newFile' | 'newDir' | 'rename' | 'move';

export interface Target {
  rel: string;
  dir: boolean;
}

export class FolderOps {
  /** Ligne choisie dans l'explorateur (fichier ou dossier). */
  selected: string | null = null;
  private readonly ws: Workspace;

  constructor(ws: Workspace) {
    this.ws = ws;
  }

  /** Vrai si le dossier ouvert accepte les modifications. */
  get enabled(): boolean {
    return (this.ws.folder?.fs ?? null) !== null;
  }

  select(rel: string | null): void {
    this.selected = rel;
    this.ws.touch();
  }

  /** Cible des commandes : la ligne choisie, sinon le fichier de l'onglet actif s'il vient du dossier. */
  target(): Target | null {
    const folder = this.ws.folder;
    const rel = this.selected ?? this.ws.active?.origin ?? null;
    if (!folder || !rel) return null;
    if (folder.files.some((f) => f.rel === rel)) return { rel, dir: false };
    if ((folder.dirs ?? []).includes(rel) || folder.files.some((f) => f.rel.startsWith(`${rel}/`))) return { rel, dir: true };
    return null;
  }

  /** Dossier ou les nouveaux elements sont crees : la cible si c'est un dossier, son parent si c'est un fichier, sinon la racine. */
  targetDir(): string {
    const t = this.target();
    return !t ? '' : t.dir ? t.rel : parentOf(t.rel);
  }

  /** Dossiers existants (racine = chaine vide), sauf `except` et ce qu'il contient. */
  directories(except?: string): string[] {
    const folder = this.ws.folder;
    if (!folder) return [];
    const all = new Set<string>(folder.dirs ?? []);
    for (const f of folder.files) for (let p = parentOf(f.rel); p; p = parentOf(p)) all.add(p);
    return ['', ...[...all].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }))].filter((d) => !except || !isInside(d, except));
  }

  private fail(message: string): false {
    this.ws.notify(message, 'warning');
    return false;
  }

  private async run(fn: (fs: FolderFs) => Promise<void>): Promise<boolean> {
    const fs = this.ws.folder?.fs;
    if (!fs) return this.fail(S.notices.folderReadOnly);
    try {
      await fn(fs);
      await this.refresh();
      return true;
    } catch (err) {
      this.ws.notify(S.notices.folderOpFailed(errorText(err)), 'error');
      return false;
    }
  }

  /** Relit le dossier sur le disque. */
  async refresh(): Promise<boolean> {
    const folder = this.ws.folder;
    if (!folder?.fs) return this.fail(S.notices.folderReadOnly);
    try {
      const scan = await folder.fs.scan();
      this.ws.setFolder({ ...folder, files: scan.files, dirs: scan.dirs });
      return true;
    } catch (err) {
      this.ws.notify(S.notices.folderOpFailed(errorText(err)), 'error');
      return false;
    }
  }

  async createFile(dir: string, name: string): Promise<boolean> {
    let clean = name.trim();
    if (clean !== '' && !clean.includes('.')) clean += '.md';
    const problem = nameProblem(clean);
    if (problem) return this.fail(problem);
    const rel = joinRel(dir, clean);
    const ok = await this.run(async (fs) => {
      if (await fs.exists(rel)) throw new Error(S.notices.alreadyExists(clean));
      await fs.write(rel, new Uint8Array());
    });
    if (ok) {
      this.selected = rel;
      this.ws.openFolderFile(rel);
    }
    return ok;
  }

  async createDir(dir: string, name: string): Promise<boolean> {
    const clean = name.trim();
    const problem = nameProblem(clean);
    if (problem) return this.fail(problem);
    const rel = joinRel(dir, clean);
    const ok = await this.run((fs) => fs.mkdir(rel));
    if (ok) this.selected = rel;
    return ok;
  }

  /** Remplace `from` par `to` dans les onglets ouverts (le texte, modifie ou non, est garde). */
  private retarget(from: string, to: string): void {
    for (const tab of this.ws.tabs) {
      if (tab.origin === null || !isInside(tab.origin, from)) continue;
      const origin = remapRel(tab.origin, from, to);
      this.ws.patch(tab.id, { origin, name: baseName(origin) });
    }
    if (this.selected !== null) this.selected = remapRel(this.selected, from, to);
  }

  async rename(rel: string, newName: string): Promise<boolean> {
    const clean = newName.trim();
    const problem = nameProblem(clean);
    if (problem) return this.fail(problem);
    const to = joinRel(parentOf(rel), clean);
    if (to === rel) return true;
    const ok = await this.run(async (fs) => {
      if (await fs.exists(to)) throw new Error(S.notices.alreadyExists(clean));
      await fs.rename(rel, to);
    });
    if (ok) this.retarget(rel, to);
    return ok;
  }

  async move(rel: string, destDir: string): Promise<boolean> {
    if (isInside(destDir, rel) && destDir !== '') return this.fail(S.notices.moveIntoSelf);
    const to = joinRel(destDir, baseName(rel));
    if (to === rel) return true;
    const ok = await this.run(async (fs) => {
      if (await fs.exists(to)) throw new Error(S.notices.alreadyExists(baseName(rel)));
      await fs.rename(rel, to);
    });
    if (ok) this.retarget(rel, to);
    return ok;
  }

  async duplicate(rel: string): Promise<boolean> {
    const folder = this.ws.folder;
    if (!folder) return false;
    const parent = parentOf(rel);
    const name = uniqueName(baseName(rel), namesIn(parent, folder.files.map((f) => f.rel), folder.dirs ?? []));
    const to = joinRel(parent, name);
    const ok = await this.run((fs) => fs.copy(rel, to));
    if (ok) this.selected = to;
    return ok;
  }

  /** Range dans la corbeille (celle du systeme sur le bureau, `.trash` du dossier dans le navigateur), jamais de suppression definitive. Les onglets ouverts gardent leur texte, devenu un document libre. */
  async remove(rel: string): Promise<boolean> {
    let where: string | null = null;
    const ok = await this.run(async (fs) => {
      where = await fs.trash(rel);
    });
    if (!ok) return false;
    for (const tab of this.ws.tabs) {
      if (tab.origin !== null && isInside(tab.origin, rel)) this.ws.patch(tab.id, { origin: null, dirty: true });
    }
    if (this.selected !== null && isInside(this.selected, rel)) this.selected = null;
    this.ws.notify(where === null ? S.notices.trashedSystem(baseName(rel)) : S.notices.trashed(baseName(rel), TRASH_DIR), 'info');
    return true;
  }
}
