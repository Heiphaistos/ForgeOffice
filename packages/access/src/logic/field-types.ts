// Les 13 types du menu « Type de donnees » d'Access <-> types du moteur (Nombre + Taille du champ).
import { S } from '../strings.ts';
import type { ChampSchema, DefinitionChamp, TypeChamp } from '../types.ts';

export type UiType = keyof typeof S.types;
export type NumberSize = keyof typeof S.sizes;

export const UI_TYPES = Object.keys(S.types) as UiType[];
export const NUMBER_SIZES = Object.keys(S.sizes) as NumberSize[];

const SIZE_SET: ReadonlySet<string> = new Set(NUMBER_SIZES);

export function isNumberSize(t: TypeChamp): t is NumberSize & TypeChamp {
  return SIZE_SET.has(t);
}

/** Type affiche dans la colonne « Type de donnees » pour un champ du moteur. */
export function uiTypeOf(field: Pick<DefinitionChamp, 'type' | 'liste_valeurs'>): UiType {
  const t = field.type;
  if (isNumberSize(t)) return 'nombre';
  if (t === 'grand_entier') return 'grand_nombre';
  if (t === 'texte_court' && (field.liste_valeurs?.length ?? 0) > 0) return 'liste_choix';
  return t as UiType;
}

/** Type du moteur pour un choix du menu (la taille ne sert que pour « Nombre »). */
export function engineType(ui: UiType, size: NumberSize = 'entier_long'): TypeChamp {
  switch (ui) {
    case 'nombre': return size;
    case 'grand_nombre': return 'grand_entier';
    case 'liste_choix': return 'texte_court';
    default: return ui;
  }
}

/** Change le type d'un champ en gardant les proprietes compatibles. */
export function changeType(field: DefinitionChamp, ui: UiType): DefinitionChamp {
  const type = engineType(ui, isNumberSize(field.type) ? field.type : 'entier_long');
  const next: DefinitionChamp = { ...field, type };
  if (type !== 'texte_court') delete next.taille;
  if (ui !== 'liste_choix' && type !== 'texte_court') next.liste_valeurs = [];
  if (ui === 'liste_choix' && (next.liste_valeurs?.length ?? 0) === 0) next.liste_valeurs = [''];
  if (type === 'numero_auto') next.cle_primaire = true;
  if (type === 'calcule' && !next.type_resultat) next.type_resultat = 'reel_double';
  return next;
}

/** Nouveau champ vide du mode Creation. */
export function newField(nom: string, type: TypeChamp = 'texte_court'): DefinitionChamp {
  return { nom, type, cle_primaire: type === 'numero_auto', liste_valeurs: [] };
}

/** Definition prete pour le moteur : lignes vides retirees, listes nettoyees. */
export function cleanFields(fields: readonly DefinitionChamp[]): DefinitionChamp[] {
  return fields
    .filter((f) => f.nom.trim() !== '')
    .map((f) => ({ ...f, nom: f.nom.trim(), liste_valeurs: (f.liste_valeurs ?? []).map((v) => v.trim()).filter((v) => v !== '') }));
}

/** Champs du schema -> definitions modifiables (avec `ancien_nom` pour suivre les renommages). */
export function toDefinitions(champs: readonly ChampSchema[]): DefinitionChamp[] {
  return champs.map((c) => ({ ...c.proprietes, nom: c.nom, type: c.type, cle_primaire: c.cle_primaire, ancien_nom: c.nom }));
}
