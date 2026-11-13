// Note du jour : AAAA-MM-JJ.md, modele `modele-quotidien.md` du dossier ouvert ({{date}} remplace), sinon un simple titre.

export const DAILY_TEMPLATE = 'modele-quotidien.md';

export function dailyDate(d: Date): string {
  const p = (n: number, w = 2): string => String(n).padStart(w, '0');
  return `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dailyNote(d: Date, template: string | null): { name: string; text: string } {
  const date = dailyDate(d);
  return { name: `${date}.md`, text: (template ?? '# {{date}}\n\n').replaceAll('{{date}}', date) };
}
