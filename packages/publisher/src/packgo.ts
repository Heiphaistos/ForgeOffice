// Pack and Go : inventaire des polices et des images d'une publication, fichier LISEZ-MOI joint au dossier pour l'imprimeur.
import { deckTheme, resolveThemeFont, type Deck, type Paragraph, type Shape } from '@forgeoffice/pptx';

function paragraphFonts(paragraphs: readonly Paragraph[], out: Set<string>, resolve: (f: string | undefined) => string): void {
  for (const p of paragraphs) for (const r of p.runs) if (r.type === 'text' || r.type === 'field') out.add(resolve(r.props?.font));
}

function shapeFonts(shapes: readonly Shape[], out: Set<string>, resolve: (f: string | undefined) => string): void {
  for (const s of shapes) {
    if (s.kind === 'shape' && s.text) paragraphFonts(s.text.paragraphs, out, resolve);
    else if (s.kind === 'table') for (const row of s.table.rows) for (const cell of row.cells) paragraphFonts(cell.text?.paragraphs ?? [], out, resolve);
    else if (s.kind === 'group') shapeFonts(s.children, out, resolve);
  }
}

/** Polices reellement utilisees par le texte des pages et des pages maitres (polices du modele resolues), triees. */
export function fontsUsed(deck: Deck): string[] {
  const theme = deckTheme(deck);
  const resolve = (f: string | undefined): string => resolveThemeFont(f, theme) ?? theme.fonts.minor.latin;
  const out = new Set<string>();
  for (const slide of deck.slides) shapeFonts(slide.shapes, out, resolve);
  for (const layout of deck.masters[0]?.layouts ?? []) shapeFonts(layout.shapes, out, resolve);
  out.delete('');
  return [...out].sort((a, b) => a.localeCompare(b, 'fr'));
}

export interface PackSummary {
  title: string;
  pages: number;
  size: { width: number; height: number };
  bleed: number;
  fonts: readonly string[];
  images: readonly string[];
  files: readonly string[];
  /** Tons directs utilises : « Nom : C 0 M 100 J 100 N 20 ». */
  spots?: readonly string[];
}

const mm = (pt: number): string => (pt * 25.4 / 72).toFixed(1).replace('.', ',');

export function packReadme(s: PackSummary): string {
  return [
    `Dossier de remise : ${s.title}`,
    '',
    `Pages : ${s.pages} (${mm(s.size.width)} x ${mm(s.size.height)} mm), fond perdu ${mm(s.bleed)} mm.`,
    '',
    'Fichiers du dossier :',
    ...s.files.map((f) => `  - ${f}`),
    '',
    `Polices utilisées (${s.fonts.length}) : à installer pour rouvrir le fichier source ; le PDF imprimeur (pages en images) n’en a pas besoin.`,
    ...(s.fonts.length ? s.fonts.map((f) => `  - ${f}`) : ['  (aucune)']),
    '',
    ...(s.spots?.length ? [`Tons directs utilisés (${s.spots.length}) : valeur CMJN de remplacement.`, ...s.spots.map((f) => `  - ${f}`), ''] : []),
    `Images (${s.images.length}) : dossier « Images ».`,
    ...s.images.map((f) => `  - ${f}`),
    '',
  ].join('\r\n');
}
