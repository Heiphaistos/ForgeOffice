// Structure des menus / barres d'outils des suites imitees (extraite de l'installation locale par scripts/lo-extract).
export interface SuiteItem {
  /** Identifiant de commande de la suite (« Bold », « FontDialog »...). */
  u?: string;
  /** Libelle francais de la suite. */
  l?: string;
  /** Lettre d'acces (soulignee). */
  k?: string;
  /** Raccourci affiche. */
  s?: string;
  /** Sous-menu. */
  i?: SuiteItem[];
  sep?: 1;
}

export interface SuiteBarItem {
  u?: string;
  l?: string;
  sep?: 1;
  /** Nature dans la vraie barre : b bouton, s bouton a liste, f champ (releve sur la vraie fenetre). */
  t?: 'b' | 's' | 'f';
  /** Largeur en px des champs (police, taille...) relevee sur la vraie fenetre. */
  w?: number;
}

export interface SuiteData {
  menu: SuiteItem[];
  bars: SuiteBarItem[][];
  /** Barre ancree en bas de la fenetre, sous la zone de travail (OpenOffice Impress / Draw : barre de dessin). */
  foot?: SuiteBarItem[];
  /** Barre verticale a gauche de la zone de travail (LibreOffice Draw : barre de dessin). */
  side?: SuiteBarItem[];
  status: string[];
}

export type SuiteKind = 'libreoffice' | 'openoffice';
