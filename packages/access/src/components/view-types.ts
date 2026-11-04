// Contrat entre l'application et les vues d'objets (feuille de donnees, creation, formulaire, etat...).
import type { NoticeKind, Services } from '@forgeoffice/core';
import type { Db } from '../db.ts';
import type { EtapeMacro, Json, ObjetBase } from '../types.ts';
import type { NavSelection, ObjKind } from './NavPane.tsx';

export type View = 'datasheet' | 'design' | 'sql' | 'form' | 'layout' | 'preview';
export type TabKind = ObjKind | 'relations' | 'doc' | 'analysis';

export interface Tab {
  id: string;
  kind: TabKind;
  name: string;
  view: View;
  /** Objet pas encore enregistre (nom provisoire). */
  isNew?: boolean;
  /** Contenu initial d'un formulaire, d'un etat ou d'une macro crees a la volee. */
  seed?: Json;
  dirty?: boolean;
  /** Source d'un formulaire/etat instantane pas encore enregistre. */
  source?: string;
}

export type FilterMode = 'egal' | 'different' | 'contient' | 'ne_contient_pas';

/** Commandes que la vue active offre au ruban (absentes = boutons grises). */
export interface ViewApi {
  sort?: (descending: boolean) => void;
  clearSort?: () => void;
  selectionText?: string | null;
  filterSelection?: (mode: FilterMode) => void;
  filtered?: boolean;
  toggleFilter?: () => void;
  clearFilters?: () => void;
  columnFilterMenu?: () => void;
  refresh?: () => void;
  newRecord?: () => void;
  saveRecord?: () => void;
  deleteRecord?: () => void;
  totalsOn?: boolean;
  toggleTotals?: () => void;
  find?: () => void;
  spelling?: () => void;
  replace?: () => void;
  goTo?: (where: 'first' | 'previous' | 'next' | 'last' | 'new') => void;
  copy?: () => void;
  cut?: () => void;
  paste?: () => void;
  /** Enregistrer l'objet (mode Creation, requete, formulaire, etat, macro). */
  save?: () => void;
  run?: () => void;
  print?: () => void;
  /** Colonne active (contextuel Champs). */
  column?: string | null;
  addField?: (type: 'texte_court' | 'reel_double' | 'monetaire' | 'date_heure' | 'oui_non') => void;
  deleteField?: () => void;
  toggleRequired?: () => void;
  toggleIndexed?: () => void;
  required?: boolean;
  indexed?: boolean;
  // Mode Creation de table
  primaryKey?: () => void;
  insertRow?: () => void;
  deleteRow?: () => void;
  togglePropertySheet?: () => void;
  // Createur de requetes
  queryType?: string;
  setQueryType?: (t: 'selection' | 'creation_table' | 'ajout' | 'mise_a_jour' | 'analyse_croisee' | 'suppression') => void;
  showTables?: () => void;
  totalsRow?: boolean;
  toggleTotalsRow?: () => void;
  top?: number | null;
  setTop?: (n: number | null) => void;
  // Relations
  clearLayout?: () => void;
  allRelations?: () => void;
  editRelation?: () => void;
  // Formulaires / etats en mode Page
  addControl?: (type: 'etiquette' | 'zone_texte') => void;
  toggleFieldList?: () => void;
  groupFields?: string[];
  groupBy?: string | null;
  setGroupBy?: (field: string | null) => void;
  landscape?: boolean;
  setLandscape?: (on: boolean) => void;
  // Macros
  addAction?: () => void;
}

export interface AppCtx {
  services: Services;
  objects: readonly ObjetBase[];
  notify: (message: string, kind?: NoticeKind) => void;
  fail: (err: unknown) => void;
  refreshObjects: () => Promise<void>;
  open: (kind: ObjKind, name: string, view?: View) => void;
  openTab: (tab: Omit<Tab, 'id'>) => void;
  closeTab: (id: string) => void;
  patchTab: (id: string, patch: Partial<Tab>) => void;
  confirm: (message: string, title?: string) => Promise<boolean>;
  prompt: (title: string, label: string, initial: string) => Promise<string | null>;
  /** Objet selectionne dans le volet de navigation. */
  selected: NavSelection | null;
  playMacro: (actions: readonly EtapeMacro[]) => void;
}

export interface ViewProps {
  db: Db;
  tab: Tab;
  ctx: AppCtx;
  register: (api: ViewApi) => void;
}
