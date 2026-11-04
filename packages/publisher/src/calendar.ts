// Calendrier (sans DOM) : grille d'un mois, semaines commencant le lundi (usage francais).

export const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'] as const;
export const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

/** Semaines du mois (`month` 0..11) : 7 cases par semaine, null hors du mois. */
export function monthGrid(year: number, month: number): Array<Array<number | null>> {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const weeks: Array<Array<number | null>> = [];
  for (let start = -offset; start < days; start += 7) {
    weeks.push(Array.from({ length: 7 }, (_, i) => {
      const d = start + i + 1;
      return d >= 1 && d <= days ? d : null;
    }));
  }
  return weeks;
}
