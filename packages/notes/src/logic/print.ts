// Impression : mise en page (marges, en-tête et pied en trois zones) et feuille @page sûre.

export const PRINT_KEY = 'notes.printLayout';

export interface PrintLayout {
  marginMm: number;
  /** Trois zones « gauche|centre|droite » ; variables {fichier} {date} {page} {pages}. */
  header: string;
  footer: string;
}

export const DEFAULT_LAYOUT: PrintLayout = { marginMm: 18, header: '{fichier}||{date}', footer: '|Page {page} / {pages}|' };
export const MARGIN_MIN = 5;
export const MARGIN_MAX = 60;

/** Lit la mise en page enregistrée (donnée hostile) ; ce qui manque ou déborde reprend la valeur par défaut. */
export function parseLayout(raw: unknown): PrintLayout {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const text = (v: unknown, d: string): string => (typeof v === 'string' && v.length <= 200 ? v : d);
  const m = typeof o.marginMm === 'number' && Number.isFinite(o.marginMm) ? Math.round(o.marginMm) : DEFAULT_LAYOUT.marginMm;
  return { marginMm: Math.min(MARGIN_MAX, Math.max(MARGIN_MIN, m)), header: text(o.header, DEFAULT_LAYOUT.header), footer: text(o.footer, DEFAULT_LAYOUT.footer) };
}

/** Chaine CSS entre guillemets ; antislash, guillemets et retours a la ligne neutralises. */
export function cssString(text: string): string {
  return `"${text.replace(/[\\"]/g, '\\$&').replace(/[\r\n\f\u2028\u2029]/g, ' ').slice(0, 200)}"`;
}

/** Trois zones (gauche, centre, droite) d'un modèle : « | » sépare les zones, le reste est du texte. */
export function splitZones(tpl: string): [string, string, string] {
  const [a = '', b = '', ...rest] = tpl.split('|');
  return [a, b, rest.join('|')];
}

/** Valeur CSS `content` d'une zone : texte et variables ; {page} et {pages} deviennent les compteurs de page. */
export function zoneContent(zone: string, file: string, date: string): string {
  const parts = zone.split(/(\{page\}|\{pages\})/).filter((p) => p !== '');
  if (parts.length === 0) return '""';
  return parts.map((p) => (p === '{page}' ? 'counter(page)' : p === '{pages}' ? 'counter(pages)' : cssString(p.replace(/\{fichier\}/g, file).replace(/\{date\}/g, date)))).join(' ');
}

/** Feuille @page : marges, en-tête et pied en trois zones. */
export function pageCss(layout: PrintLayout, file: string, date: string): string {
  const box = (pos: string, zone: string): string => (zone === '' ? '' : ` @${pos} { content: ${zoneContent(zone, file, date)}; font: 9pt sans-serif; color: #000; }`);
  const [h1, h2, h3] = splitZones(layout.header);
  const [f1, f2, f3] = splitZones(layout.footer);
  return `@page { margin: ${layout.marginMm}mm;${box('top-left', h1)}${box('top-center', h2)}${box('top-right', h3)}${box('bottom-left', f1)}${box('bottom-center', f2)}${box('bottom-right', f3)} }`;
}
