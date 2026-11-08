// File d'attente du Convertisseur : modele immuable sans DOM (teste).
import { defaultTarget, extensionOf, outputName, planEngine, targetsFor, type Engine } from './formats.ts';
import type { PasswordReason } from './password.ts';
import { S } from './strings.ts';

export const MAX_FILE_BYTES = 512 * 1024 * 1024;
export const MAX_JOBS = 500;

export type JobStatus = 'waiting' | 'working' | 'done' | 'error' | 'unsupported';

export interface JobOutput {
  name: string;
  bytes: Uint8Array;
  /** Chemin ecrit dans le dossier de destination (bureau). */
  savedPath?: string;
}

export interface Job {
  id: string;
  name: string;
  /** Chemin relatif dans un dossier depose (« Rapports/2025/a.docx »), sinon le nom. */
  relativePath: string;
  ext: string;
  size: number;
  bytes: Uint8Array;
  /** Chemin sur le disque (bureau, fichier ouvert par la coquille) ; null sinon. */
  path: string | null;
  target: string | null;
  /** Radical du nom de sortie choisi par l'utilisateur ; null = nom automatique. */
  outName: string | null;
  status: JobStatus;
  progress: number;
  error: string | null;
  outputs: JobOutput[];
  /** Mot de passe saisi pour un fichier chiffre. */
  password: string | null;
  /** Fichier chiffre dont il faut (re)saisir le mot de passe. */
  passwordPrompt: PasswordReason | null;
}

export interface IncomingFile {
  name: string;
  relativePath?: string;
  bytes: Uint8Array;
  path?: string | null;
}

let serial = 0;
const nextId = (): string => `j${Date.now().toString(36)}${(serial++).toString(36)}`;

/** Ajoute des fichiers ; renvoie la file et la liste des refus (nom + raison). */
export function addFiles(jobs: readonly Job[], files: readonly IncomingFile[], native: boolean): { jobs: Job[]; rejected: { name: string; reason: string }[] } {
  const out = [...jobs];
  const rejected: { name: string; reason: string }[] = [];
  for (const f of files) {
    if (out.length >= MAX_JOBS) {
      rejected.push({ name: f.name, reason: S.tooMany });
      continue;
    }
    if (f.bytes.length === 0) {
      rejected.push({ name: f.name, reason: S.empty });
      continue;
    }
    if (f.bytes.length > MAX_FILE_BYTES) {
      rejected.push({ name: f.name, reason: S.tooBig });
      continue;
    }
    const ext = extensionOf(f.name);
    const target = defaultTarget(ext, native);
    out.push({
      id: nextId(), name: f.name, relativePath: f.relativePath ?? f.name, ext, size: f.bytes.length, bytes: f.bytes, path: f.path ?? null,
      target, outName: null, status: target ? 'waiting' : 'unsupported', progress: 0, error: null, outputs: [], password: null, passwordPrompt: null,
    });
  }
  return { jobs: out, rejected };
}

export function update(jobs: readonly Job[], id: string, patch: Partial<Job>): Job[] {
  return jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
}

/** Mot de passe saisi pour un fichier chiffre : il repasse en attente. */
export function setPassword(jobs: readonly Job[], id: string, password: string): Job[] {
  return update(jobs, id, { password, passwordPrompt: null, status: 'waiting', progress: 0, error: null, outputs: [] });
}

/** Change le format d'un fichier : il repasse en attente. */
export function setTarget(jobs: readonly Job[], id: string, target: string): Job[] {
  return update(jobs, id, { target, status: 'waiting', progress: 0, error: null, outputs: [] });
}

/** Fixe (ou efface, null) le nom de sortie d'un fichier : il repasse en attente. */
export function setOutName(jobs: readonly Job[], id: string, outName: string | null): Job[] {
  return jobs.map((j) => (j.id === id && j.outName !== outName ? { ...j, outName, status: j.status === 'working' || !j.target ? j.status : 'waiting', progress: 0, error: null, outputs: [] } : j));
}

/** « Tout convertir en » : seuls les fichiers qui le permettent changent. */
export function setAllTargets(jobs: readonly Job[], target: string, native: boolean): Job[] {
  return jobs.map((j) =>
    j.status !== 'working' && targetsFor(j.ext, native).includes(target)
      ? { ...j, target, status: 'waiting', progress: 0, error: null, outputs: [] }
      : j,
  );
}

/** Recalcule les formats quand le moteur natif apparait ou disparait. */
export function refreshTargets(jobs: readonly Job[], native: boolean): Job[] {
  return jobs.map((j) => {
    if (j.status !== 'unsupported' && j.status !== 'waiting') return j;
    const list = targetsFor(j.ext, native);
    const target = j.target && list.includes(j.target) ? j.target : defaultTarget(j.ext, native);
    return { ...j, target, status: target ? 'waiting' : 'unsupported' };
  });
}

/** Prochain fichier a convertir. */
export function nextWaiting(jobs: readonly Job[]): Job | null {
  return jobs.find((j) => j.status === 'waiting' && j.target !== null) ?? null;
}

export function engineOf(job: Job, native: boolean): Engine | null {
  return job.target ? planEngine(job.ext, job.target, native) : null;
}

/** Nom du resultat, unique parmi les resultats deja produits. */
export function resultName(jobs: readonly Job[], job: Job, target: string): string {
  const taken = new Set(jobs.flatMap((j) => (j.id === job.id ? [] : j.outputs.map((o) => o.name.toLowerCase()))));
  return outputName(job.outName ? `${job.outName}.${job.ext}` : job.name, target, taken);
}

export interface Summary {
  total: number;
  waiting: number;
  done: number;
  errors: number;
  working: boolean;
}

export function summarize(jobs: readonly Job[]): Summary {
  return {
    total: jobs.length,
    waiting: jobs.filter((j) => j.status === 'waiting').length,
    done: jobs.filter((j) => j.status === 'done').length,
    errors: jobs.filter((j) => j.status === 'error').length,
    working: jobs.some((j) => j.status === 'working'),
  };
}

/** Taille lisible en francais (« 1,5 Mo »). */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ['Ko', 'Mo', 'Go'];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toLocaleString('fr-FR', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[u]}`;
}

/** Entree d'historique (persistee dans les reglages, 50 au plus). */
export interface HistoryEntry {
  input: string;
  output: string;
  size: number;
  at: number;
}

export function pushHistory(list: readonly HistoryEntry[], entries: readonly HistoryEntry[]): HistoryEntry[] {
  return [...entries, ...list].slice(0, 50);
}
