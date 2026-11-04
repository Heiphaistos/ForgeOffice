// Garde-fous communs a tous les lecteurs : URL sures, limites, avertissements.
import type { ReadWarning } from './model.ts';
import { WARNINGS } from './strings.ts';

/** Limites de lecture (protection contre les fichiers hostiles). */
export interface ReadLimits {
  /** Taille maximale du fichier d'entree, en octets. */
  maxInputBytes: number;
  /** Nombre maximal de blocs (paragraphes, tableaux) dans tout le document. */
  maxBlocks: number;
  /** Profondeur maximale d'imbrication (tableaux dans tableaux, controles...). */
  maxDepth: number;
  /** Taille maximale d'une image importee depuis HTML / Markdown / RTF. */
  maxImageBytes: number;
}

export const DEFAULT_READ_LIMITS: ReadLimits = {
  maxInputBytes: 512 * 1024 * 1024,
  maxBlocks: 2_000_000,
  maxDepth: 48,
  maxImageBytes: 64 * 1024 * 1024,
};

const UNSAFE_SCHEMES = /^(javascript|vbscript|data|livescript|mocha|jscript):/i;

/** URL sure pour un lien, ou undefined si dangereuse (javascript:, vbscript:, data:...). */
export function sanitizeUrl(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  // Les navigateurs ignorent espaces et caracteres de controle dans le schema (« java\tscript: »).
  const compact = raw.replace(/[\u0000- \u007f-\u009f]/g, '');
  if (UNSAFE_SCHEMES.test(compact)) return undefined;
  return raw.trim();
}

/** Collecte des avertissements, sans doublon. */
export class Warnings {
  readonly list: ReadWarning[] = [];
  private readonly seen = new Set<string>();

  add(code: string, message: string): void {
    const key = `${code}|${message}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.list.push({ code, message });
  }

  unsafeLink(url: string): void {
    this.add('unsafe-link', WARNINGS.unsafeLink(url));
  }
}

/** Verifie un lien et avertit s'il est refuse. */
export function checkedUrl(raw: string | undefined, warnings: Warnings): string | undefined {
  const safe = sanitizeUrl(raw);
  if (raw !== undefined && safe === undefined) warnings.unsafeLink(raw);
  return safe;
}

/** Compteur partage de blocs + profondeur. */
export class Budget {
  private blocks = 0;
  readonly limits: ReadLimits;
  readonly warnings: Warnings;

  constructor(limits: ReadLimits, warnings: Warnings) {
    this.limits = limits;
    this.warnings = warnings;
  }

  /** Faux quand la limite de blocs est atteinte (le lecteur arrete d'ajouter). */
  takeBlock(): boolean {
    this.blocks++;
    if (this.blocks > this.limits.maxBlocks) {
      this.warnings.add('too-many-blocks', WARNINGS.tooManyBlocks);
      return false;
    }
    return true;
  }

  depthOk(depth: number): boolean {
    if (depth > this.limits.maxDepth) {
      this.warnings.add('too-deep', WARNINGS.tooDeep);
      return false;
    }
    return true;
  }
}
