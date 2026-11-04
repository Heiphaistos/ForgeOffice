// Familles de polices declarees par le document (theme, valeurs par defaut, styles) : a charger avant de mesurer la pagination.
import type { WordDocument } from '@forgeoffice/docx';

export function documentFonts(doc: WordDocument): string[] {
  const names = new Set<string>([doc.theme.majorFont, doc.theme.minorFont, doc.styles.docDefaults.run.font ?? '']);
  for (const s of doc.styles.styles) if (s.run?.font) names.add(s.run.font);
  names.delete('');
  return [...names];
}
