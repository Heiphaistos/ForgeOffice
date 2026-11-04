// Numeros de serie Excel : systeme 1900 (avec le faux 29/02/1900) et systeme 1904.

export type DateSystem = 1900 | 1904;

/** Plus grand numero de serie valide (31/12/9999, systeme 1900). */
export const MAX_SERIAL_1900 = 2958465;
/** Ecart entre les deux systemes (01/01/1904 = 1462 en systeme 1900). */
export const OFFSET_1904 = 1462;

/** Jours depuis le 01/01/1970 du calendrier gregorien proleptique (algorithme de H. Hinnant). */
export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function civilFromDays(z: number): { y: number; m: number; d: number } {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

const EPOCH_1900 = daysFromCivil(1899, 12, 30);
const EPOCH_1904 = daysFromCivil(1904, 1, 1);

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 30;
}

/**
 * Numero de serie d'une date (annee, mois, jour normalises comme DATE() : mois 13 = janvier suivant...).
 * Les annees 0 a 1899 sont decalees de 1900 comme dans Excel.
 */
export function dateToSerial(year: number, month: number, day: number, system: DateSystem = 1900): number {
  let y = Math.trunc(year);
  if (y >= 0 && y < 1900) y += 1900;
  const m0 = Math.trunc(month) - 1;
  y += Math.floor(m0 / 12);
  const m = ((m0 % 12) + 12) % 12 + 1;
  const first = daysFromCivil(y, m, 1);
  if (system === 1904) return first - EPOCH_1904 + Math.trunc(day) - 1;
  // Calcul dans le calendrier d'Excel (fevrier 1900 a 29 jours) : 1er du mois puis decalage.
  const s = first - EPOCH_1900;
  return (s < 61 ? s - 1 : s) + Math.trunc(day) - 1;
}

export interface DateParts {
  y: number;
  m: number;
  d: number;
}

/** Partie date d'un numero de serie (gere le 0/01/1900 et le 29/02/1900 d'Excel). */
export function serialToDate(serial: number, system: DateSystem = 1900): DateParts {
  const n = Math.floor(serial);
  if (system === 1904) return civilFromDays(n + EPOCH_1904);
  if (n === 0) return { y: 1900, m: 1, d: 0 };
  if (n === 60) return { y: 1900, m: 2, d: 29 };
  return civilFromDays((n < 60 ? n + 1 : n) + EPOCH_1900);
}

export interface TimeParts {
  h: number;
  mi: number;
  s: number;
  /** Millisecondes. */
  ms: number;
}

/** Heure d'un numero de serie, arrondie a la milliseconde. */
export function serialToTime(serial: number): TimeParts {
  let ms = Math.round((serial - Math.floor(serial)) * 86400000);
  if (ms >= 86400000) ms = 86399999;
  const h = Math.floor(ms / 3600000);
  ms -= h * 3600000;
  const mi = Math.floor(ms / 60000);
  ms -= mi * 60000;
  const s = Math.floor(ms / 1000);
  return { h, mi, s, ms: ms - s * 1000 };
}

/** Jour de la semaine : 0 = dimanche ... 6 = samedi (coherent avec WEEKDAY d'Excel). */
export function serialWeekday(serial: number, system: DateSystem = 1900): number {
  const n = Math.floor(serial) + (system === 1904 ? OFFSET_1904 : 0);
  return (((n - 1) % 7) + 7) % 7;
}

/** Date JS (heure locale) -> numero de serie. */
export function jsDateToSerial(d: Date, system: DateSystem = 1900): number {
  const day = dateToSerial(d.getFullYear(), d.getMonth() + 1, d.getDate(), system);
  const t = (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000) / 86400;
  return day + t;
}

export function maxSerial(system: DateSystem): number {
  return system === 1904 ? MAX_SERIAL_1900 - OFFSET_1904 : MAX_SERIAL_1900;
}
