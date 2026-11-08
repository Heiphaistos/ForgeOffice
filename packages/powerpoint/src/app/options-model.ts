// Options de l'application (Fichier > Options) : lecture des réglages enregistrés et application au démarrage.
import type { UiState } from './editor.ts';

export type SettingsGet = <T>(key: string, fallback: T) => T;

export interface AppOptions {
  author: string;
  /** Affichage a l'ouverture. */
  ruler: boolean;
  grid: boolean;
  smartGuides: boolean;
  thumbnails: boolean;
  notes: boolean;
  /** Correction orthographique dans la saisie du texte et langue. */
  spell: boolean;
  lang: string;
  /** Delai de la copie de recuperation (minutes) ; 0 = desactivee. */
  autosaveMinutes: number;
  presenter: boolean;
  useTimings: boolean;
}

export const OPTION_KEYS: Readonly<Record<keyof AppOptions, string>> = {
  author: 'powerpoint.author',
  ruler: 'powerpoint.ruler',
  grid: 'powerpoint.grid',
  smartGuides: 'powerpoint.smartGuides',
  thumbnails: 'powerpoint.thumbnails',
  notes: 'powerpoint.notes',
  spell: 'powerpoint.spell',
  lang: 'powerpoint.lang',
  autosaveMinutes: 'powerpoint.autosave',
  presenter: 'powerpoint.presenter',
  useTimings: 'powerpoint.useTimings',
};

export const LANGUAGES: ReadonlyArray<readonly [string, string]> = [['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['de', 'Deutsch'], ['it', 'Italiano']];
export const AUTOSAVE_CHOICES: readonly number[] = [0, 1, 5, 10, 30];

export function readOptions(get: SettingsGet, defaultAuthor: string): AppOptions {
  const minutes = get<number>(OPTION_KEYS.autosaveMinutes, 0.5);
  return {
    author: get(OPTION_KEYS.author, defaultAuthor),
    ruler: get(OPTION_KEYS.ruler, false),
    grid: get(OPTION_KEYS.grid, false),
    smartGuides: get(OPTION_KEYS.smartGuides, true),
    thumbnails: get(OPTION_KEYS.thumbnails, true),
    notes: get(OPTION_KEYS.notes, true),
    spell: get(OPTION_KEYS.spell, true),
    lang: get(OPTION_KEYS.lang, 'fr'),
    autosaveMinutes: Number.isFinite(minutes) && minutes >= 0 ? minutes : 0.5,
    presenter: get(OPTION_KEYS.presenter, false),
    useTimings: get(OPTION_KEYS.useTimings, true),
  };
}

/** Etat d'affichage au demarrage d'apres les options. */
export function uiDefaults(o: AppOptions): Partial<UiState> {
  return { ruler: o.ruler, grid: o.grid, smartGuides: o.smartGuides, thumbnails: o.thumbnails, notes: o.notes };
}

/** Delai (ms) avant la copie de recuperation, ou null si elle est desactivee. */
export const backupDelayMs = (o: AppOptions): number | null => (o.autosaveMinutes > 0 ? Math.round(o.autosaveMinutes * 60_000) : null);
