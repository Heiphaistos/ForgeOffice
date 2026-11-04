// Reduction adaptative du ruban : choisit le niveau de chaque groupe pour tenir dans la largeur.
import type { GroupLevel } from '../ribbon-types.ts';

/**
 * `widths[g][l]` = largeur mesuree du groupe g au niveau l (0 normal .. 3 replie).
 * Reduit d'abord le groupe le plus a droite d'un cran, puis le suivant vers la gauche,
 * niveau par niveau, jusqu'a tenir dans `available` (comme Office).
 */
export function fitGroups(widths: readonly (readonly number[])[], available: number): GroupLevel[] {
  const levels: GroupLevel[] = widths.map(() => 0);
  const total = (): number => widths.reduce((sum, w, g) => sum + (w[levels[g] ?? 0] ?? 0), 0);
  if (total() <= available) return levels;
  for (let level = 1 as GroupLevel; level <= 3; level = (level + 1) as GroupLevel) {
    for (let g = widths.length - 1; g >= 0; g--) {
      const w = widths[g];
      if (!w || w.length <= level) continue;
      // un niveau qui n'economise rien est saute
      if ((w[level] ?? Infinity) >= (w[levels[g] ?? 0] ?? 0)) continue;
      levels[g] = level;
      if (total() <= available) return levels;
    }
  }
  return levels;
}
