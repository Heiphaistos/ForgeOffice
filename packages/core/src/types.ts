// Contrats partages entre la coquille (web ou Tauri) et les applications de la suite.
import type { ComponentType } from 'react';

export type AppId = 'hub' | 'word' | 'excel' | 'powerpoint' | 'publisher' | 'access' | 'pdf' | 'notes' | 'convert';

export type Platform = 'web' | 'desktop' | 'mobile';

/** Fiche d'une application de la suite (affichee par l'accueil, la barre de titre, les associations de fichiers). */
export interface ModuleInfo {
  id: AppId;
  /** Nom complet affiche : « Texte », « Tableur »... */
  name: string;
  /** Lettre ou sigle de l'icone d'application (« T », « X »...). */
  glyph: string;
  /** Couleur d'accent Fluent de l'application. */
  accent: string;
  /** Extensions ouvertes par le module, sans point, en minuscules. La premiere est le format natif. */
  extensions: readonly string[];
  /** Libelle du document vierge : « Document vierge »... */
  blankLabel: string;
}

export interface FileFilter {
  name: string;
  extensions: readonly string[];
}

/** Fichier ouvert : octets bruts + nom. `path` est null dans le navigateur ou pour un nouveau document. */
export interface OpenedFile {
  name: string;
  path: string | null;
  bytes: Uint8Array;
}

export interface SavedFile {
  name: string;
  path: string | null;
}

export interface RecentFile {
  app: AppId;
  name: string;
  path: string;
  /** Millisecondes depuis l'epoque. */
  openedAt: number;
}

export type NoticeKind = 'info' | 'success' | 'warning' | 'error';

export interface UpdateInfo {
  version: string;
  notes: string;
}

/** Mise a jour automatique (bureau seulement) : signature verifiee par la coquille avant installation. */
export interface Updater {
  /** null si l'application est a jour. */
  check(): Promise<UpdateInfo | null>;
  /** Telecharge, verifie, installe puis relance. `onProgress` recoit une fraction 0..1. */
  install(onProgress?: (fraction: number) => void): Promise<void>;
}

/** Appel des moteurs Rust de la coquille (forge-base, forge-convert). null dans le navigateur. */
export interface NativeBridge {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}

/** Boutons de la barre de titre personnalisee (bureau seulement). */
export interface WindowControls {
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  /** « Toujours au premier plan » (bureau). Absent : l'option est masquee. */
  setAlwaysOnTop?(on: boolean): Promise<void>;
}

/** Date et taille d'un fichier, sans le relire. */
export interface FileInfo {
  /** Millisecondes depuis l'epoque. */
  modifiedAt: number;
  size: number;
}

/** Element d'un dossier ouvert sur le disque. `rel` : chemin relatif, separateur « / ». */
export interface DiskEntry {
  rel: string;
  dir: boolean;
  size: number;
}

/**
 * Dossier ouvert sur le VRAI disque (bureau) : lecture et ecriture directes, sans passer par le navigateur.
 * Les chemins sont toujours relatifs a la racine choisie par l'utilisateur ; la coquille refuse tout ce qui en sortirait.
 */
export interface DiskFolder {
  name: string;
  /** Chemin absolu de la racine (affichage). */
  path: string;
  /** Tout le contenu (sans suivre les liens symboliques), dossiers avant leur contenu. */
  list(): Promise<DiskEntry[]>;
  read(rel: string): Promise<Uint8Array>;
  /** Cree ou remplace un fichier (ecriture atomique), dossiers parents compris. */
  write(rel: string, bytes: Uint8Array): Promise<void>;
  mkdir(rel: string): Promise<void>;
  /** Renomme ou deplace ; refuse d'ecraser. */
  rename(from: string, to: string): Promise<void>;
  /** Copie un fichier ou un dossier ; refuse d'ecraser. */
  copy(from: string, to: string): Promise<void>;
  /** Envoie a la corbeille du SYSTEME (Corbeille Windows, Trash macOS, corbeille FreeDesktop). */
  trash(rel: string): Promise<void>;
  exists(rel: string): Promise<boolean>;
  /** Date et taille d'un fichier du dossier (null s'il n'existe plus). */
  info?(rel: string): Promise<FileInfo | null>;
}

export interface Settings {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
}

/** Services fournis par la plateforme. Les modules n'accedent jamais directement au disque ni a Tauri. */
export interface Services {
  readonly platform: Platform;
  readonly version: string;
  /** Dialogue « Ouvrir ». null si l'utilisateur annule. */
  openFile(filters: readonly FileFilter[]): Promise<OpenedFile | null>;
  /** Relit un fichier connu (fichiers recents, ligne de commande). */
  readFile(path: string): Promise<OpenedFile>;
  /** « Enregistrer » si `path` est connu, sinon « Enregistrer sous ». null si annule. */
  saveFile(bytes: Uint8Array, suggestedName: string, filters: readonly FileFilter[], path: string | null): Promise<SavedFile | null>;
  /** Ouvre une application (nouvelle fenetre sur bureau, navigation dans le navigateur et sur mobile). */
  openModule(app: AppId, path?: string): Promise<void>;
  /** Ouvre un fichier deja lu dans l'application qui le gere (d'apres son extension). */
  openDocument(file: OpenedFile): Promise<void>;
  /** null dans le navigateur. */
  readonly updater: Updater | null;
  /** null dans le navigateur et sur mobile (barre de titre systeme). */
  readonly windowControls: WindowControls | null;
  /** Moteurs natifs (SQLite, PDF, conversions). null dans le navigateur : le module propose alors un mode degrade. */
  readonly native: NativeBridge | null;
  /** Date et taille d'un fichier connu (null s'il n'existe plus) : detecter une modification sans le relire. Bureau seulement. */
  fileInfo?(path: string): Promise<FileInfo | null>;
  /** Montre le fichier dans l'explorateur du systeme (explorer /select, open -R, xdg-open). Bureau seulement. */
  revealInFolder?(path: string): Promise<void>;
  /** Dialogue natif « Ouvrir un dossier » puis acces direct au disque. null si annule. Bureau seulement. */
  openFolder?(): Promise<DiskFolder | null>;
  recentFiles(): Promise<RecentFile[]>;
  addRecent(entry: Omit<RecentFile, 'openedAt'>): Promise<void>;
  clearRecent(): Promise<void>;
  readonly settings: Settings;
  setTitle(title: string): void;
  setModified(modified: boolean): void;
  notify(message: string, kind?: NoticeKind): void;
  print(): void;
  /** Ferme la fenetre courante (retour a l'accueil dans le navigateur). */
  close(): void;
}

export interface ModuleProps {
  services: Services;
  /** Fichier a ouvrir au demarrage, ou null pour un document vierge. */
  file: OpenedFile | null;
}

/** Ce que chaque paquet d'application exporte depuis son `src/index.ts`. */
export interface AppModule {
  info: ModuleInfo;
  App: ComponentType<ModuleProps>;
}
