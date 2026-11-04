// Fiches des applications de la suite : source unique des noms, couleurs et extensions.
import type { AppId, ModuleInfo } from './types.ts';

export const MODULES: Readonly<Record<AppId, ModuleInfo>> = {
  hub: { id: 'hub', name: 'ForgeOffice', glyph: 'F', accent: '#185ABD', extensions: [], blankLabel: '' },
  word: {
    id: 'word', name: 'Texte', glyph: 'T', accent: '#185ABD',
    extensions: ['docx', 'docm', 'dotx', 'doc', 'odt', 'rtf', 'html', 'htm'],
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
  // Bloc-notes : portage de WinNote (D:\Projet\WinNote). Ouvre le texte brut et le code par defaut.
  notes: {
    id: 'notes', name: 'Bloc-notes', glyph: 'N', accent: '#4F6BED',
    extensions: ['txt', 'md', 'markdown', 'log', 'ini', 'cfg', 'conf', 'json', 'xml', 'yaml', 'yml', 'toml',
      'js', 'mjs', 'ts', 'tsx', 'jsx', 'py', 'rs', 'c', 'h', 'cpp', 'hpp', 'cs', 'java', 'go', 'php', 'rb',
      'css', 'scss', 'sql', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'lua', 'kt', 'swift'],
    blankLabel: 'Nouvelle note',
  },
  // Convertisseur : portage du moteur de conversion de ForgePDF (documents, images, audio, archives, donnees).
  convert: { id: 'convert', name: 'Convertisseur', glyph: 'C', accent: '#8764B8', extensions: [], blankLabel: '' },
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
