// Dates relatives a la francaise pour les listes de fichiers.
import { S } from '../strings.ts';

const DAY = 86_400_000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function time(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** « A l'instant », « Il y a 5 minutes », « Aujourd'hui a 14:05 », « Hier a 09:12 », sinon JJ/MM/AAAA. */
export function relativeDate(ms: number, now: number = Date.now()): string {
  const diff = now - ms;
  if (diff >= 0 && diff < 60_000) return S.dates.now;
  if (diff >= 0 && diff < 3_600_000) return S.dates.minutes(Math.floor(diff / 60_000));
  const today = startOfDay(now);
  if (ms >= today && ms < today + DAY) return S.dates.today(time(ms));
  if (ms >= today - DAY && ms < today) return S.dates.yesterday(time(ms));
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export type DateGroup = 'today' | 'yesterday' | 'week' | 'month' | 'older';

/** Regroupement des fichiers recents par periode (comme la liste Recents d'Office). */
export function dateGroup(ms: number, now: number = Date.now()): DateGroup {
  const today = startOfDay(now);
  if (ms >= today) return 'today';
  if (ms >= today - DAY) return 'yesterday';
  if (ms >= today - 6 * DAY) return 'week';
  if (ms >= today - 30 * DAY) return 'month';
  return 'older';
}

export const DATE_GROUP_LABEL: Readonly<Record<DateGroup, string>> = {
  today: S.dates.groupToday,
  yesterday: S.dates.groupYesterday,
  week: S.dates.groupWeek,
  month: S.dates.groupMonth,
  older: S.dates.groupOlder,
};
