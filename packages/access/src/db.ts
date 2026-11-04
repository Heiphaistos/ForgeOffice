// Acces au moteur : la coquille native (forge-base via la commande `base_op`) ou la base de demonstration en memoire.
import type { NativeBridge } from '@forgeoffice/core';
import type { BaseOuverte, DefinitionRequete, Json, ObjetBase, OptionsLecture, PageLignes, Relation, RequeteEnregistree, ResultatSql, SchemaTable } from './types.ts';

export interface Db {
  /** Base de demonstration du navigateur (lecture seule, sans moteur SQLite). */
  readonly demo: boolean;
  readonly readOnly: boolean;
  call<T>(op: string, args?: Record<string, unknown>): Promise<T>;
}

export function nativeDb(bridge: NativeBridge, readOnly: boolean): Db {
  return {
    demo: false,
    readOnly,
    call: <T,>(op: string, args: Record<string, unknown> = {}): Promise<T> => bridge.invoke<T>('base_op', { requete: { op, ...args } }),
  };
}

/** Commandes de cycle de vie de la coquille (une base par fenetre). */
export const life = {
  open: (b: NativeBridge, path: string) => b.invoke<BaseOuverte>('base_open', { path }),
  create: (b: NativeBridge) => b.invoke<BaseOuverte | null>('base_create'),
  copy: (b: NativeBridge, reopen: boolean, suggestedName: string) => b.invoke<BaseOuverte | null>('base_copy', { reopen, suggestedName }),
  close: (b: NativeBridge) => b.invoke<null>('base_close'),
};

// Raccourcis types des operations les plus utilisees.
export const api = {
  objects: (db: Db) => db.call<ObjetBase[]>('objets'),
  schema: (db: Db, table: string) => db.call<SchemaTable>('schema', { table }),
  read: (db: Db, table: string, options: OptionsLecture) => db.call<PageLignes>('lire_table', { table, options }),
  relations: (db: Db) => db.call<Relation[]>('relations'),
  query: (db: Db, nom: string) => db.call<RequeteEnregistree>('lire_requete', { nom }),
  runQuery: (db: Db, nom: string, parametres: Json[] = []) => db.call<ResultatSql>('executer_requete', { nom, parametres }),
  runDefinition: (db: Db, definition: DefinitionRequete, parametres: Json[] = []) => db.call<ResultatSql>('executer_definition', { definition, parametres }),
  runSql: (db: Db, sql: string, parametres: Json[] = []) => db.call<ResultatSql>('executer_sql', { sql, parametres }),
};

/** Toutes les lignes d'une table (pages de 10 000, la limite du moteur). */
export async function readAll(db: Db, table: string): Promise<PageLignes> {
  const first = await api.read(db, table, { page: 0, taille_page: 10000, tri: [], filtres: [] });
  const pages = [first];
  for (let p = 1; p < first.nb_pages; p++) pages.push(await api.read(db, table, { page: p, taille_page: 10000, tri: [], filtres: [] }));
  return { ...first, lignes: pages.flatMap((x) => x.lignes), cles: pages.flatMap((x) => x.cles) };
}
