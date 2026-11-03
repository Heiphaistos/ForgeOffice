// Fiches des applications de la suite : source unique des noms, couleurs et extensions.
import type { AppId, ModuleInfo } from './types.ts';

export const MODULES: Readonly<Record<AppId, ModuleInfo>> = {
  hub: { id: 'hub', name: 'ForgeOffice', glyph: 'F', accent: '#185ABD', extensions: [], blankLabel: '' },
  word: {
    id: 'word', name: 'Texte', glyph: 'T', accent: '#185ABD',
    extensions: ['docx', 'docm', 'dotx', 'doc', 'odt', 'rtf', 'txt', 'html', 'md'],
    blankLabel: 'Document vierge',
  },
  excel: {
    id: 'excel', name: 'Tableur', glyph: 'X', accent: '#107C41',
    extensions: ['xlsx', 'xlsm', 'xltx', 'xls', 'ods', 'csv', 'tsv'],
    blankLabel: 'Classeur vierge',
  },
  powerpoint: {
    id: 'powerpoint', name: 'Présentation', glyph: 'P', accent: '#C43E1C',
    extensions: ['pptx', 'pptm', 'potx', 'ppsx', 'ppt', 'odp'],
    blankLabel: 'Présentation vierge',
  },
  publisher: {
    id: 'publisher', name: 'Publication', glyph: 'Pu', accent: '#077568',
    extensions: ['fopub', 'pub'],
    blankLabel: 'Publication vierge',
  },
  access: {
    id: 'access', name: 'Base de données', glyph: 'B', accent: '#A4373A',
    extensions: ['fodb', 'sqlite', 'db', 'accdb', 'mdb'],
    blankLabel: 'Base de données vide',
  },
  pdf: { id: 'pdf', name: 'PDF', glyph: 'PDF', accent: '#B30B00', extensions: ['pdf'], blankLabel: '' },
};

/** Application qui ouvre un nom de fichier, d'apres son extension. */
export function moduleForFile(name: string): AppId | null {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  for (const info of Object.values(MODULES)) {
    if (info.extensions.includes(ext)) return info.id;
  }
  return null;
}

export function isAppId(value: string): value is AppId {
  return Object.hasOwn(MODULES, value);
}
