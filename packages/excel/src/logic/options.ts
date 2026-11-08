// Options de l'utilisateur (Fichier > Options > Avance) : sens de deplacement apres Entree. Memorisees dans le navigateur.
export type EnterDirection = 'down' | 'right' | 'up' | 'left' | 'none';

export const ENTER_DIRECTIONS: readonly EnterDirection[] = ['down', 'right', 'up', 'left', 'none'];

const KEY = 'xl.options.enterDirection';
/** Choix de la session quand le stockage du navigateur est indisponible. */
let memory: EnterDirection | null = null;

/** Deplacement (lignes, colonnes) apres Entree ; Maj inverse le sens. */
export function enterDelta(dir: EnterDirection, shift: boolean): [number, number] {
  const sign = shift ? -1 : 1;
  switch (dir) {
    case 'down': return [sign, 0];
    case 'up': return [-sign, 0];
    case 'right': return [0, sign];
    case 'left': return [0, -sign];
    case 'none': return [0, 0];
  }
}

export function loadEnterDirection(): EnterDirection {
  try {
    const v = localStorage.getItem(KEY);
    return (ENTER_DIRECTIONS as readonly string[]).includes(v ?? '') ? (v as EnterDirection) : 'down';
  } catch {
    return 'down';
  }
}

export function saveEnterDirection(dir: EnterDirection): void {
  try {
    localStorage.setItem(KEY, dir);
  } catch {
    // stockage indisponible : le choix vaut pour la session
    memory = dir;
  }
}

export const currentEnterDirection = (): EnterDirection => memory ?? loadEnterDirection();

// ---------------------------------------------------------------- Decimales fixes

const DECIMALS_KEY = 'xl.options.fixedDecimals';
let decimalsMemory: number | null = null;

/** Nombre de decimales fixes (0 = option desactivee). */
export function fixedDecimals(): number {
  if (decimalsMemory !== null) return decimalsMemory;
  try {
    const n = Number(localStorage.getItem(DECIMALS_KEY));
    return Number.isInteger(n) && n > 0 && n <= 9 ? n : 0;
  } catch {
    return 0;
  }
}

export function setFixedDecimals(n: number): void {
  const v = Number.isInteger(n) && n > 0 && n <= 9 ? n : 0;
  decimalsMemory = v;
  try {
    localStorage.setItem(DECIMALS_KEY, String(v));
  } catch {
    // stockage indisponible : le choix vaut pour la session
  }
}

/** « Decimale fixe » : un entier saisi sans separateur recoit `n` decimales (350 devient 3,50 pour n = 2). Le reste est inchange. */
export function applyFixedDecimals(text: string, n: number): string {
  if (n <= 0 || !/^-?\d+$/.test(text.trim())) return text;
  const t = text.trim();
  const neg = t.startsWith('-');
  const digits = (neg ? t.slice(1) : t).padStart(n + 1, '0');
  return `${neg ? '-' : ''}${digits.slice(0, -n)},${digits.slice(-n)}`;
}

// ---------------------------------------------------------------- General et Enregistrement

const USER_KEY = 'xl.options.userName';
const RECOVERY_KEY = 'xl.options.recoverySeconds';
/** Intervalles proposes pour la copie de secours (secondes). */
export const RECOVERY_CHOICES: readonly number[] = [10, 30, 60, 300, 600];
const memory2: { user: string | null; recovery: number | null } = { user: null, recovery: null };

/** Nom d'utilisateur (auteur des nouvelles notes) ; vide = nom par defaut de l'application. */
export function userName(): string {
  if (memory2.user !== null) return memory2.user;
  try {
    return localStorage.getItem(USER_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setUserName(name: string): void {
  memory2.user = name;
  try {
    localStorage.setItem(USER_KEY, name);
  } catch {
    // stockage indisponible : le choix vaut pour la session
  }
}

/** Intervalle de la copie de secours en secondes (30 par defaut). */
export function recoverySeconds(): number {
  if (memory2.recovery !== null) return memory2.recovery;
  try {
    const n = Number(localStorage.getItem(RECOVERY_KEY));
    return RECOVERY_CHOICES.includes(n) ? n : 30;
  } catch {
    return 30;
  }
}

export function setRecoverySeconds(n: number): void {
  const v = RECOVERY_CHOICES.includes(n) ? n : 30;
  memory2.recovery = v;
  try {
    localStorage.setItem(RECOVERY_KEY, String(v));
  } catch {
    // stockage indisponible : le choix vaut pour la session
  }
}
