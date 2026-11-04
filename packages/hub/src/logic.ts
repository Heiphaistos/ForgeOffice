// Logique sans DOM de l'accueil : salutation, liste des recents (filtre, epingles), controle des fichiers deposes.
import { MODULES, moduleForFile, type AppId, type FileFilter, type RecentFile } from '@forgeoffice/core';
import { S } from './strings.ts';

/** Taille maximale d'un fichier ouvert depuis l'accueil (garde-fou memoire). */
export const MAX_OPEN_BYTES = 512 * 1024 * 1024;

export const PINNED_SETTING = 'hub.pinned';

/** Applications qui creent un document vierge, dans l'ordre d'Office. */
export const BLANK_APPS: readonly AppId[] = ['word', 'excel', 'powerpoint', 'publisher', 'access', 'notes'];

/** Applications du rail gauche. */
export const RAIL_APPS: readonly AppId[] = ['word', 'excel', 'powerpoint', 'publisher', 'access', 'pdf', 'notes', 'convert'];

export function greeting(hour: number): string {
  return hour >= 18 || hour < 4 ? S.greetingEvening : S.greetingMorning;
}

export function pinKey(entry: Pick<RecentFile, 'app' | 'path'>): string {
  return `${entry.app}|${entry.path}`;
}

/** Ajoute ou retire une cle de la liste des epingles (nouvelle liste). */
export function togglePin(pins: readonly string[], key: string): string[] {
  return pins.includes(key) ? pins.filter((k) => k !== key) : [key, ...pins];
}

/** Dossier parent d'un chemin ; null si le chemin n'est qu'un nom (navigateur). */
export function parentFolder(path: string): string | null {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return cut > 0 ? path.slice(0, cut) : null;
}

/** Recents a afficher : filtre (sans accents), epingles seuls si demande, epingles d'abord (sauf liste regroupee par date) puis plus recents. */
export function visibleRecents(
  list: readonly RecentFile[],
  pins: readonly string[],
  query: string,
  onlyPinned: boolean,
  fold: (s: string) => string,
  pinnedFirst = true,
): RecentFile[] {
  const q = fold(query);
  return list
    .filter((r) => !onlyPinned || pins.includes(pinKey(r)))
    .filter((r) => q === '' || fold(r.name).includes(q) || fold(r.path).includes(q))
    .sort((a, b) => (pinnedFirst ? Number(pins.includes(pinKey(b))) - Number(pins.includes(pinKey(a))) : 0) || b.openedAt - a.openedAt);
}

/** Filtres du dialogue « Ouvrir » : tous les formats, puis un filtre par application. */
export function openFilters(): FileFilter[] {
  const apps = Object.values(MODULES).filter((m) => m.extensions.length > 0);
  return [
    { name: S.allDocuments, extensions: apps.flatMap((m) => m.extensions) },
    ...apps.map((m) => ({ name: m.name, extensions: m.extensions })),
  ];
}

export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1).replace('.', ',')} Go`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} Mo`;
  return `${Math.max(1, Math.round(n / 1024))} Ko`;
}

/** Verifie un fichier depose avant lecture : application cible ou message d'erreur. */
export function checkDropped(name: string, size: number): { app: AppId } | { error: string } {
  const app = moduleForFile(name);
  if (!app) return { error: S.unsupported(name) };
  if (size > MAX_OPEN_BYTES) return { error: S.tooLarge(name, formatBytes(MAX_OPEN_BYTES)) };
  return { app };
}
