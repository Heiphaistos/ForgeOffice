// Format d'une regle de mise en forme conditionnelle : modifications de la boite « Format de cellule » (4 onglets : Nombre, Police,
// Bordure, Remplissage) converties en format differentiel (dxf). Excel n'autorise ni police ni taille dans une regle : seuls le style,
// le soulignement, le barre et la couleur sont retenus pour la police.
import { numberFormatId, type Border, type DifferentialFormat, type Fill, type Workbook } from '@forgeoffice/xlsx';
import type { FormatEdits } from './format-edits.ts';

export function editsToDxf(wb: Workbook, e: FormatEdits): DifferentialFormat {
  const dxf: DifferentialFormat = {};
  const font: NonNullable<DifferentialFormat['font']> = {};
  if (e.bold !== undefined && e.bold) font.bold = true;
  if (e.italic !== undefined && e.italic) font.italic = true;
  if (e.strike) font.strike = true;
  if (e.underline) font.underline = e.underline;
  if (e.color) font.color = e.color;
  if (Object.keys(font).length) dxf.font = font;
  const fill = e.fill as Fill | undefined;
  if (fill && fill.type === 'pattern' && fill.pattern !== 'none') {
    // Une regle colore le fond avec la couleur « fg » ou « bg » selon l'auteur du fichier : on pose les deux.
    const c = fill.fg ?? fill.bg;
    if (c) dxf.fill = { ...fill, fg: c, bg: fill.bg ?? c };
  }
  if (e.border) {
    const b: Border = {};
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      const edge = e.border[side];
      if (edge) b[side] = edge;
    }
    if (Object.keys(b).length) dxf.border = b;
  }
  if (e.numFmt !== undefined && e.numFmt !== 'General') dxf.numFmt = { id: numberFormatId(wb.styles, e.numFmt), code: e.numFmt };
  return dxf;
}
