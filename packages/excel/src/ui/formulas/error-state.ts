// Etat de la verification des erreurs partage par la grille (triangle vert), le menu contextuel et la boite : erreurs ignorees par
// classeur ouvert, regles actives (reglage persistant), environnement de controle d'une feuille.
import type { Settings } from '@forgeoffice/core';
import { cellFormat, styleAt } from '../../logic/styles.ts';
import { DEFAULT_ERROR_RULES, ERROR_RULES_KEY, checkCell, ignoreKey, type CheckEnv, type ErrorRuleId } from '../../logic/formulas/errors.ts';
import type { DocStore } from '../store.ts';

const ignoredByStore = new WeakMap<DocStore, Set<string>>();

/** Erreurs ignorees (« Ignorer l'erreur ») du classeur ouvert, tant qu'il reste ouvert. */
export function ignoredErrors(store: DocStore): Set<string> {
  let s = ignoredByStore.get(store);
  if (!s) {
    s = new Set();
    ignoredByStore.set(store, s);
  }
  return s;
}

export function errorRules(settings: Settings): Record<ErrorRuleId, boolean> {
  return { ...DEFAULT_ERROR_RULES, ...settings.get<Partial<Record<ErrorRuleId, boolean>>>(ERROR_RULES_KEY, {}) };
}

/** Environnement de controle d'une feuille du classeur (valeurs du moteur, verrouillage des styles). */
export function checkEnv(store: DocStore, si: number, rules: Record<ErrorRuleId, boolean>): CheckEnv | null {
  const wb = store.wb;
  const sheet = wb.sheets[si];
  if (!sheet) return null;
  return {
    sheet,
    rules,
    value: (r, c) => {
      try {
        return store.engine.value(sheet.name, r, c);
      } catch {
        return null; // feuille absente du moteur pendant une reconstruction
      }
    },
    isLocked: (r, c) => cellFormat(wb, styleAt(sheet, r, c)).protection?.locked !== false,
  };
}

/** Resultat du controle de chaque cellule, calcule a la demande et conserve tant que le classeur ne change pas (peinture de la grille). */
export class ErrorCache {
  private readonly env: CheckEnv | null;
  private readonly ignored: ReadonlySet<string>;
  private readonly cache = new Map<number, boolean>();

  constructor(env: CheckEnv | null, ignored: ReadonlySet<string>) {
    this.env = env;
    this.ignored = ignored;
  }

  /** Vrai si la cellule porte un triangle vert. */
  readonly at = (row: number, col: number): boolean => {
    const env = this.env;
    if (!env) return false;
    const key = row * 16384 + col;
    let hit = this.cache.get(key);
    if (hit === undefined) {
      const f = checkCell(env, row, col);
      hit = f !== null && !this.ignored.has(ignoreKey(env.sheet.name, f));
      this.cache.set(key, hit);
    }
    return hit;
  };
}
