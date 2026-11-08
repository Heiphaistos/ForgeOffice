// Inspecteur de style : résumé lisible (en français) de la mise en forme directe du paragraphe et du texte sous le curseur.
import type { ParagraphProps, RunProps } from '@forgeoffice/docx';

const ALIGN: Readonly<Record<string, string>> = { left: 'Aligné à gauche', center: 'Centré', right: 'Aligné à droite', justify: 'Justifié', distribute: 'Distribué' };
const cm = (pt: number): string => `${(Math.round((pt * 2.54 / 72) * 100) / 100).toLocaleString('fr-FR')} cm`;

/** Lignes de mise en forme directe d'un paragraphe. */
export function describeParagraph(p: ParagraphProps): string[] {
  const out: string[] = [];
  if (p.alignment) out.push(ALIGN[p.alignment] ?? p.alignment);
  if (p.indentLeft) out.push(`Retrait gauche ${cm(p.indentLeft)}`);
  if (p.indentRight) out.push(`Retrait droit ${cm(p.indentRight)}`);
  if (p.indentFirstLine) out.push(`${p.indentFirstLine < 0 ? 'Retrait suspendu' : 'Retrait de première ligne'} ${cm(Math.abs(p.indentFirstLine))}`);
  if (p.spacingBefore) out.push(`Espacement avant ${p.spacingBefore} pt`);
  if (p.spacingAfter !== undefined) out.push(`Espacement après ${p.spacingAfter} pt`);
  if (p.lineSpacing) out.push(`Interligne ${p.lineSpacing.rule === 'auto' ? `multiple ${p.lineSpacing.value.toLocaleString('fr-FR')}` : `${p.lineSpacing.rule === 'exact' ? 'exactement' : 'au moins'} ${p.lineSpacing.value} pt`}`);
  if (p.numbering) out.push(`Liste (niveau ${p.numbering.level + 1})`);
  if (p.borders) out.push('Bordures');
  if (p.shading) out.push('Trame de fond');
  if (p.tabs?.length) out.push(`${p.tabs.length} tabulation${p.tabs.length > 1 ? 's' : ''}`);
  if (p.keepNext) out.push('Paragraphe solidaire du suivant');
  if (p.pageBreakBefore) out.push('Saut de page avant');
  return out;
}

/** Lignes de mise en forme directe des caractères. */
export function describeRun(r: RunProps): string[] {
  const out: string[] = [];
  if (r.font) out.push(`Police ${r.font}`);
  if (r.size) out.push(`Taille ${r.size} pt`);
  if (r.bold) out.push('Gras');
  if (r.italic) out.push('Italique');
  if (r.underline && r.underline !== 'none') out.push('Souligné');
  if (r.strike || r.doubleStrike) out.push('Barré');
  if (r.color?.rgb && r.color.rgb !== 'auto') out.push(`Couleur ${r.color.rgb}`);
  if (r.highlight && r.highlight !== 'none') out.push('Surlignage');
  if (r.vertAlign === 'superscript') out.push('Exposant');
  if (r.vertAlign === 'subscript') out.push('Indice');
  if (r.smallCaps) out.push('Petites majuscules');
  if (r.caps) out.push('Majuscules');
  if (r.spacing) out.push(`Espacement ${r.spacing} pt`);
  return out;
}
