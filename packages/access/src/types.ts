// Formes JSON echangees avec le moteur forge-base (miroir des structures serde de crates/forge-base).

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Row = Record<string, Json>;

export type TypeChamp =
  | 'texte_court' | 'texte_long' | 'octet' | 'entier' | 'entier_long' | 'grand_entier' | 'reel_simple' | 'reel_double'
  | 'decimal' | 'monetaire' | 'date_heure' | 'numero_auto' | 'oui_non' | 'lien_hypertexte' | 'piece_jointe' | 'objet_ole' | 'calcule';

export type Rendu = 'nombre' | 'texte' | 'booleen' | 'date' | 'blob' | 'brut';
export type Indexation = 'non' | 'avec_doublons' | 'sans_doublons';

export interface ProprietesChamp {
  taille?: number | null;
  format?: string | null;
  decimales?: number | null;
  masque_saisie?: string | null;
  legende?: string | null;
  valeur_defaut?: string | null;
  valide_si?: string | null;
  message_validation?: string | null;
  requis?: boolean;
  chaine_vide_autorisee?: boolean | null;
  indexe?: Indexation;
  description?: string | null;
  expression?: string | null;
  type_resultat?: TypeChamp | null;
  liste_valeurs?: string[];
  limiter_a_liste?: boolean;
  alignement?: string | null;
}

/** Champ envoye au mode Creation (proprietes « aplaties » comme en Rust, serde flatten). */
export interface DefinitionChamp extends ProprietesChamp {
  nom: string;
  type: TypeChamp;
  cle_primaire?: boolean;
  ancien_nom?: string | null;
}

export interface ChampSchema {
  nom: string;
  type: TypeChamp;
  libelle_type: string;
  position: number;
  cle_primaire: boolean;
  proprietes: ProprietesChamp;
  genere: boolean;
}

export interface ProprietesTable {
  description?: string | null;
  valide_si?: string | null;
  message_validation?: string | null;
  tri?: string | null;
  filtre?: string | null;
}

export interface DefinitionTable {
  nom: string;
  champs: DefinitionChamp[];
  proprietes?: ProprietesTable;
}

export type Suppression = 'restreindre' | 'cascade' | 'mettre_null';
export type TypeJointure = 'interne' | 'tous_parent' | 'tous_enfant';

export interface Relation {
  nom: string;
  table_parent: string;
  champs_parent: string[];
  table_enfant: string;
  champs_enfant: string[];
  integrite: boolean;
  cascade_maj: boolean;
  suppression: Suppression;
  jointure: TypeJointure;
}

export interface SchemaTable {
  nom: string;
  est_vue: boolean;
  proprietes: ProprietesTable;
  champs: ChampSchema[];
  cle_primaire: string[];
  index: { nom: string; champs: { nom: string }[]; unique: boolean; origine: string }[];
  relations: Relation[];
  nb_lignes: number;
}

export type GenreObjet = 'table' | 'vue' | 'requete' | 'formulaire' | 'etat' | 'macro' | 'module';

export interface ObjetBase {
  nom: string;
  genre: GenreObjet;
  description: string | null;
  modifie_le: string | null;
}

export type Operateur =
  | 'egal' | 'different' | 'inferieur' | 'inferieur_ou_egal' | 'superieur' | 'superieur_ou_egal' | 'contient'
  | 'ne_contient_pas' | 'commence_par' | 'finit_par' | 'est_vide' | 'nest_pas_vide' | 'entre' | 'dans' | 'comme';

export interface Filtre {
  champ: string;
  operateur: Operateur;
  valeur?: Json;
  valeur2?: Json;
  valeurs?: Json[];
}

export interface Tri {
  champ: string;
  descendant: boolean;
}

export interface OptionsLecture {
  page: number;
  taille_page: number;
  tri: Tri[];
  filtres: Filtre[];
  combinaison_ou?: boolean;
  recherche?: string | null;
}

export interface ColonneResultat {
  nom: string;
  type: TypeChamp | null;
  rendu: Rendu;
  legende: string | null;
}

export interface PageLignes {
  colonnes: ColonneResultat[];
  lignes: Json[][];
  cles: Row[];
  total: number;
  page: number;
  taille_page: number;
  nb_pages: number;
  modifiable: boolean;
}

export type FonctionTotal = 'somme' | 'moyenne' | 'compte' | 'min' | 'max' | 'ecart_type' | 'variance';

export type GenreRequete = 'selection' | 'ajout' | 'mise_a_jour' | 'suppression' | 'creation_table' | 'analyse_croisee' | 'union' | 'sql_direct';
export type GenreJointure = 'interne' | 'gauche' | 'droite';
export type SensTri = 'croissant' | 'decroissant';
export type Operation = 'regroupement' | 'somme' | 'moyenne' | 'min' | 'max' | 'compte' | 'ecart_type' | 'var' | 'premier' | 'dernier' | 'expression' | 'ou';
export type RoleAnalyse = 'en_tete_ligne' | 'en_tete_colonne' | 'valeur';

export interface SourceRequete {
  nom: string;
  alias?: string | null;
}

export interface Jointure {
  gauche: string;
  champ_gauche: string;
  droite: string;
  champ_droite: string;
  genre: GenreJointure;
}

export interface ColonneRequete {
  champ: string;
  table?: string | null;
  alias?: string | null;
  afficher: boolean;
  tri?: SensTri | null;
  criteres: string[];
  operation?: Operation | null;
  mise_a_jour?: string | null;
  ajouter_a?: string | null;
  analyse?: RoleAnalyse | null;
}

export interface DefinitionRequete {
  genre: GenreRequete;
  tables: SourceRequete[];
  jointures: Jointure[];
  colonnes: ColonneRequete[];
  distinct?: boolean;
  haut?: number | null;
  table_cible?: string | null;
}

export interface RequeteEnregistree {
  nom: string;
  genre: GenreRequete;
  sql: string;
  definition?: unknown;
  description?: string | null;
  parametres?: string[];
}

export interface ResultatSql {
  colonnes: ColonneResultat[];
  lignes: Json[][];
  lignes_modifiees: number;
  dernier_id: number | null;
  lecture_seule: boolean;
  tronque: boolean;
}

export interface ObjetStocke {
  genre: string;
  nom: string;
  contenu: Json;
  description: string | null;
}

export interface InfosBase {
  chemin: string | null;
  lecture_seule: boolean;
  taille_octets: number;
  version_sqlite: string;
  nb_tables: number;
}

export interface BaseOuverte {
  nom: string;
  chemin: string;
  infos: InfosBase;
}

export interface RapportImport {
  table: string;
  lignes_lues: number;
  lignes_importees: number;
  erreurs: { ligne: number; message: string }[];
  nb_erreurs: number;
}

export interface RapportIntegrite {
  ok: boolean;
  problemes: string[];
  orphelins: [string, number, string][];
}

export interface RapportCompactage {
  taille_avant: number;
  taille_apres: number;
}

/** Controle d'un formulaire ou d'un etat (forme produite par formulaire_instantane / etat_instantane). */
export interface Controle {
  type: string;
  nom?: string;
  champ?: string;
  etiquette?: string;
  texte?: string;
  source?: string;
  style?: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  lecture_seule?: boolean;
  aligne_droite?: boolean;
  valeurs?: string[];
}

export interface Section {
  hauteur?: number;
  controles: Controle[];
}

export interface Regroupement {
  champ: string;
  tri?: string;
  entete?: boolean;
  pied?: boolean;
}

/** Formulaire ou etat : sections nommees (entete, detail, pied / entete_etat, entete_page, detail, pied_page, pied_etat). */
export interface Maquette {
  version: number;
  source: string;
  titre: string;
  disposition?: string;
  orientation?: string;
  regroupements?: Regroupement[];
  sections: Record<string, Section>;
}

export interface EtapeMacro {
  action: string;
  arguments: Record<string, string>;
  condition?: string;
}

export interface Macro {
  actions: EtapeMacro[];
}
