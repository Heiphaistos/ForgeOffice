// Modeles de couleurs et de polices (onglet Creation de page) appliques au theme de la publication.
import type { Color, Deck, ThemeColors, ThemeFonts } from '@forgeoffice/pptx';

export interface ColorScheme {
  id: string;
  name: string;
  /** Fonce principal, clair, fonce 2, clair 2, puis 6 accents. */
  colors: [string, string, string, string, string, string, string, string, string, string];
}

const scheme = (id: string, name: string, c: ColorScheme['colors']): ColorScheme => ({ id, name, colors: c });

export const COLOR_SCHEMES: readonly ColorScheme[] = [
  scheme('office', 'Office', ['000000', 'FFFFFF', '0E2841', 'E8E8E8', '156082', 'E97132', '196B24', '0F9ED5', 'A02B93', '4EA72E']),
  scheme('aqua', 'Aqua', ['000000', 'FFFFFF', '0B3C5D', 'E6F4F1', '077568', '2BA6A0', 'F2A541', '3D7EA6', '86BBD8', 'C8553D']),
  scheme('baies', 'Baies', ['1F1A24', 'FFFFFF', '4A1942', 'F7EEF5', '893168', 'C94277', 'F28F3B', '5B8E7D', '4A5899', 'E6C229']),
  scheme('bordeaux', 'Bordeaux', ['1C1C1C', 'FFFFFF', '4B1D24', 'F4ECE6', '7B2D3A', 'B9875E', '9C6644', '5E6472', 'C9A227', '3F5F4A']),
  scheme('agrumes', 'Agrumes', ['222222', 'FFFFFF', '3C4A1E', 'FBF6E4', 'E8871E', 'F2C14E', '8CB369', '5B8C5A', 'D1495B', '386FA4']),
  scheme('argile', 'Argile', ['2A2522', 'FFFFFF', '5C3D2E', 'F5EFE6', 'B85C38', 'E0C097', '6E7F80', '8C5E58', 'A3B18A', '3C6E71']),
  scheme('nuit', 'Bleu nuit', ['0B132B', 'FFFFFF', '1C2541', 'EEF2F7', '3A506B', '5BC0BE', 'F4A259', 'BC4B51', '8CB369', '6FFFE9']),
  scheme('desert', 'Désert', ['2E2A24', 'FFFFFF', '6B4E31', 'F8F1E5', 'C08552', 'DAB894', '8D6346', '5E7C6B', 'C9A66B', '7A4E2D']),
  scheme('fjord', 'Fjord', ['10202B', 'FFFFFF', '234E70', 'EDF4F7', '2E86AB', 'A23B72', 'F18F01', 'C73E1D', '3B1F2B', '6A994E']),
  scheme('glacier', 'Glacier', ['1B262C', 'FFFFFF', '0F4C75', 'EAF6FB', '3282B8', 'BBE1FA', '6C9BCF', '2A9D8F', 'E9C46A', 'F4A261']),
  scheme('lavande', 'Lavande', ['231942', 'FFFFFF', '5E548E', 'F3F0FA', '9F86C0', 'BE95C4', 'E0B1CB', '6D597A', 'B56576', '355070']),
  scheme('mousse', 'Mousse', ['1E2A1E', 'FFFFFF', '344E41', 'EEF3EA', '588157', 'A3B18A', 'DAD7CD', '3A5A40', 'BC6C25', 'DDA15E']),
  scheme('ocean', 'Océan', ['03045E', 'FFFFFF', '023E8A', 'EAF8FC', '0077B6', '00B4D8', '90E0EF', 'FFB703', 'FB8500', '219EBC']),
  scheme('papaye', 'Papaye', ['3D2B1F', 'FFFFFF', '7F4F24', 'FFF4E6', 'F3722C', 'F8961E', 'F9C74F', '90BE6D', '43AA8B', '577590']),
  scheme('sauge', 'Sauge', ['2F3E46', 'FFFFFF', '354F52', 'F1F5F2', '52796F', '84A98C', 'CAD2C5', 'B5838D', 'E5989B', '6D6875']),
  scheme('grenat', 'Grenat', ['1A1A1D', 'FFFFFF', '4E4E50', 'F4F1F1', '950740', 'C3073F', '6F2232', 'E09F3E', '335C67', '9E2A2B']),
];

export interface FontScheme {
  id: string;
  name: string;
  major: string;
  minor: string;
}

export const FONT_SCHEMES: readonly FontScheme[] = [
  { id: 'office', name: 'Office', major: 'Aptos Display', minor: 'Aptos' },
  { id: 'edition', name: 'Édition', major: 'Cambria', minor: 'Calibri' },
  { id: 'civique', name: 'Civique', major: 'Georgia', minor: 'Georgia' },
  { id: 'moderne', name: 'Moderne', major: 'Segoe UI Semibold', minor: 'Segoe UI' },
  { id: 'equilibre', name: 'Équilibre', major: 'Trebuchet MS', minor: 'Verdana' },
  { id: 'opulent', name: 'Opulent', major: 'Constantia', minor: 'Corbel' },
  { id: 'industriel', name: 'Industriel', major: 'Franklin Gothic Medium', minor: 'Franklin Gothic Book' },
  { id: 'technique', name: 'Technique', major: 'Century Gothic', minor: 'Segoe UI' },
  { id: 'classique', name: 'Classique', major: 'Times New Roman', minor: 'Arial' },
  { id: 'elegant', name: 'Élégant', major: 'Palatino Linotype', minor: 'Candara' },
];

const rgb = (value: string): Color => ({ type: 'rgb', value });

export function schemeColors(s: ColorScheme): ThemeColors {
  const [dk1, lt1, dk2, lt2, a1, a2, a3, a4, a5, a6] = s.colors;
  return { name: s.name, dk1: rgb(dk1), lt1: rgb(lt1), dk2: rgb(dk2), lt2: rgb(lt2), accent1: rgb(a1), accent2: rgb(a2), accent3: rgb(a3), accent4: rgb(a4), accent5: rgb(a5), accent6: rgb(a6), hlink: rgb(a1), folHlink: rgb(a5) };
}

/** Publication avec un autre modele de couleurs et/ou de polices (tous les masques). */
export function applySchemes(deck: Deck, colors?: ColorScheme, fonts?: FontScheme): Deck {
  return {
    ...deck,
    masters: deck.masters.map((m) => {
      const f: ThemeFonts = fonts ? { name: fonts.name, major: { ...m.theme.fonts.major, latin: fonts.major }, minor: { ...m.theme.fonts.minor, latin: fonts.minor } } : m.theme.fonts;
      return { ...m, theme: { ...m.theme, colors: colors ? schemeColors(colors) : m.theme.colors, fonts: f } };
    }),
  };
}
