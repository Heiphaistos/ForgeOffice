// Taquets de tabulation (sans DOM) : prochain taquet, largeur d'une tabulation selon l'alignement du taquet.
import type { TabStop } from '@forgeoffice/docx';

export interface ResolvedStop {
  position: number;
  align: TabStop['align'];
  leader: NonNullable<TabStop['leader']>;
}

/** Taquets utiles (position positive, non effaces), tries. */
export function usableStops(tabs: readonly TabStop[] | undefined): TabStop[] {
  return (tabs ?? []).filter((t) => t.align !== 'clear' && t.align !== 'bar' && t.position > 0).sort((a, b) => a.position - b.position);
}

/** Taquet atteint depuis `at` (points depuis la marge) : le premier taquet personnalise plus loin, sinon le prochain taquet par defaut. */
export function nextStop(at: number, stops: readonly TabStop[], defaultStop: number): ResolvedStop {
  const custom = stops.find((s) => s.position > at + 0.5);
  if (custom) return { position: custom.position, align: custom.align, leader: custom.leader ?? 'none' };
  const step = Math.max(1, defaultStop);
  return { position: (Math.floor((at + 0.5) / step) + 1) * step, align: 'left', leader: 'none' };
}

/**
 * Largeur de la tabulation (points). `segment` = largeur du texte qui suit jusqu'a la tabulation suivante (ou la fin de ligne),
 * `beforeDecimal` = largeur de ce texte jusqu'au separateur decimal.
 */
export function tabWidth(at: number, stop: ResolvedStop, segment: number, beforeDecimal: number): number {
  const room = stop.position - at;
  switch (stop.align) {
    case 'center': return Math.max(0, room - segment / 2);
    case 'right': return Math.max(0, room - segment);
    case 'decimal': return Math.max(0, room - beforeDecimal);
    default: return Math.max(0, room);
  }
}
