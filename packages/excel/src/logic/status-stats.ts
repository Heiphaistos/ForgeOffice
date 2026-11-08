// Calculs de la barre d'etat sur la selection : moyenne, nombre, chiffres, min, max, somme ; choix des calculs affiches.
export type StatId = 'avg' | 'cnt' | 'num' | 'min' | 'max' | 'sum';

export const STAT_IDS: readonly StatId[] = ['avg', 'cnt', 'num', 'min', 'max', 'sum'];
/** Calculs affiches par defaut (comme Excel). */
export const DEFAULT_STATS: readonly StatId[] = ['avg', 'cnt', 'sum'];

export interface SelectionStats {
  sum: number;
  nums: number;
  count: number;
  min: number;
  max: number;
}

export function accumulate(): { add: (v: unknown) => void; result: () => SelectionStats } {
  const s: SelectionStats = { sum: 0, nums: 0, count: 0, min: Infinity, max: -Infinity };
  return {
    add(v) {
      if (v === null || v === '' || v === undefined) return;
      s.count++;
      if (typeof v === 'number') {
        s.nums++;
        s.sum += v;
        if (v < s.min) s.min = v;
        if (v > s.max) s.max = v;
      }
    },
    result: () => s,
  };
}

/** Valeur d'un calcul ; undefined s'il n'a pas de sens (aucun nombre). */
export function statValue(s: SelectionStats, id: StatId): number | undefined {
  switch (id) {
    case 'cnt': return s.count || undefined;
    case 'num': return s.nums || undefined;
    case 'avg': return s.nums ? s.sum / s.nums : undefined;
    case 'sum': return s.nums ? s.sum : undefined;
    case 'min': return s.nums ? s.min : undefined;
    case 'max': return s.nums ? s.max : undefined;
  }
}

export const parseStats = (raw: string | null): StatId[] => {
  if (raw === null) return [...DEFAULT_STATS];
  return raw.split(',').filter((x): x is StatId => (STAT_IDS as readonly string[]).includes(x));
};
