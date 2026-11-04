// Base de demonstration du navigateur (« Comptoir ») : petit jeu de donnees en memoire, lecture seule.
// Sert quand la coquille native est absente, pour que toute l'interface reste visible et verifiable.
import type { Db } from './db.ts';
import { runDefinition, type MemTable } from './logic/demo-query.ts';
import { applyOptions, computeTotal, distinctValues } from './logic/table-ops.ts';
import { S } from './strings.ts';
import type {
  ChampSchema, Controle, DefinitionChamp, DefinitionRequete, FonctionTotal, Json, Maquette, ObjetBase, ObjetStocke, OptionsLecture,
  PageLignes, Relation, RequeteEnregistree, ResultatSql, SchemaTable, TypeChamp,
} from './types.ts';

interface DemoTable {
  fields: DefinitionChamp[];
  rows: Json[][];
}

const f = (nom: string, type: TypeChamp, extra: Partial<DefinitionChamp> = {}): DefinitionChamp => ({ nom, type, cle_primaire: type === 'numero_auto', ...extra });

const TABLES: Record<string, DemoTable> = {
  Clients: {
    fields: [f('N°', 'numero_auto'), f('Société', 'texte_court', { taille: 80, requis: true }), f('Contact', 'texte_court', { taille: 60 }), f('Ville', 'texte_court', { taille: 60 }), f('Pays', 'texte_court', { taille: 40 }), f('Téléphone', 'texte_court', { taille: 20 }), f('Client depuis', 'date_heure')],
    rows: [
      [1, 'Atelier Lumière', 'Camille Martin', 'Lyon', 'France', '04 72 10 20 30', '2021-03-14'],
      [2, 'Bernard & Fils', 'Hugo Bernard', 'Nantes', 'France', '02 40 11 22 33', '2019-09-02'],
      [3, 'Studio Nord', 'Léa Dubois', 'Lille', 'France', '03 20 44 55 66', '2023-01-20'],
      [4, 'Épicerie Fine Roux', 'Nathan Roux', 'Bordeaux', 'France', '05 56 77 88 99', '2022-06-11'],
      [5, 'Café des Arts', 'Inès Moreau', 'Bruxelles', 'Belgique', '+32 2 123 45 67', '2020-11-30'],
      [6, 'Librairie Vautrin', 'Paul Vautrin', 'Genève', 'Suisse', '+41 22 345 67 89', '2024-02-08'],
      [7, 'Maison Garnier', 'Chloé Garnier', 'Marseille', 'France', '04 91 22 33 44', '2018-05-17'],
      [8, 'Les Jardins d’Alice', 'Alice Petit', 'Toulouse', 'France', '05 61 12 34 56', '2025-04-03'],
    ],
  },
  Produits: {
    fields: [f('N°', 'numero_auto'), f('Désignation', 'texte_court', { requis: true }), f('Catégorie', 'texte_court', { taille: 40, liste_valeurs: ['Boissons', 'Épicerie', 'Papeterie'] }), f('Prix unitaire', 'monetaire'), f('Stock', 'entier_long'), f('Disponible', 'oui_non')],
    rows: [
      [1, 'Café en grains 1 kg', 'Boissons', 18.5, 42, true],
      [2, 'Thé vert Sencha', 'Boissons', 9.9, 8, true],
      [3, 'Chocolat noir 70 %', 'Épicerie', 3.2, 120, true],
      [4, 'Confiture d’abricot', 'Épicerie', 4.75, 0, false],
      [5, 'Huile d’olive vierge', 'Épicerie', 12.4, 35, true],
      [6, 'Carnet A5 ligné', 'Papeterie', 6.9, 64, true],
      [7, 'Stylo plume', 'Papeterie', 24, 5, true],
      [8, 'Jus de pomme bio', 'Boissons', 3.6, 90, true],
      [9, 'Biscuits sablés', 'Épicerie', 2.95, 3, true],
      [10, 'Agenda 2027', 'Papeterie', 15.5, 22, true],
    ],
  },
  Commandes: {
    fields: [f('N°', 'numero_auto'), f('Client', 'entier_long', { indexe: 'avec_doublons' }), f('Produit', 'entier_long', { indexe: 'avec_doublons' }), f('Date', 'date_heure'), f('Quantité', 'entier_long'), f('Livrée', 'oui_non')],
    rows: [
      [1, 1, 1, '2026-09-03', 4, true], [2, 1, 3, '2026-09-03', 20, true], [3, 2, 6, '2026-09-12', 10, true],
      [4, 3, 7, '2026-09-21', 2, true], [5, 4, 5, '2026-10-01', 6, true], [6, 5, 2, '2026-10-04', 12, true],
      [7, 5, 8, '2026-10-04', 24, false], [8, 6, 10, '2026-10-15', 5, true], [9, 7, 1, '2026-10-22', 8, false],
      [10, 7, 9, '2026-10-22', 30, false], [11, 8, 3, '2026-11-02', 15, false], [12, 2, 4, '2026-11-03', 6, false],
    ],
  },
};

const RELATIONS: Relation[] = [
  { nom: 'Clients_Commandes', table_parent: 'Clients', champs_parent: ['N°'], table_enfant: 'Commandes', champs_enfant: ['Client'], integrite: true, cascade_maj: false, suppression: 'restreindre', jointure: 'interne' },
  { nom: 'Produits_Commandes', table_parent: 'Produits', champs_parent: ['N°'], table_enfant: 'Commandes', champs_enfant: ['Produit'], integrite: true, cascade_maj: false, suppression: 'restreindre', jointure: 'interne' },
];

const col = (champ: string, table: string, extra: Partial<DefinitionRequete['colonnes'][number]> = {}): DefinitionRequete['colonnes'][number] => ({ champ, table, afficher: true, criteres: [], ...extra });

const QUERIES: RequeteEnregistree[] = [
  {
    nom: 'Commandes détaillées', genre: 'selection', sql: '',
    definition: {
      genre: 'selection', tables: [{ nom: 'Clients' }, { nom: 'Commandes' }, { nom: 'Produits' }],
      jointures: [
        { gauche: 'Clients', champ_gauche: 'N°', droite: 'Commandes', champ_droite: 'Client', genre: 'interne' },
        { gauche: 'Produits', champ_gauche: 'N°', droite: 'Commandes', champ_droite: 'Produit', genre: 'interne' },
      ],
      colonnes: [col('Date', 'Commandes', { tri: 'decroissant' }), col('Société', 'Clients'), col('Désignation', 'Produits'), col('Quantité', 'Commandes'), col('Prix unitaire', 'Produits')],
      _positions: { Clients: { x: 16, y: 12 }, Commandes: { x: 260, y: 40 }, Produits: { x: 504, y: 12 } },
    },
  },
  {
    nom: 'Produits à réapprovisionner', genre: 'selection', sql: '',
    definition: {
      genre: 'selection', tables: [{ nom: 'Produits' }], jointures: [],
      colonnes: [col('Désignation', 'Produits'), col('Catégorie', 'Produits'), col('Stock', 'Produits', { tri: 'croissant', criteres: ['<10'] })],
    },
  },
];

function controle(c: DefinitionChamp, x: number, y: number, largeur: number): Controle {
  return {
    type: c.type === 'oui_non' ? 'case_a_cocher' : c.liste_valeurs?.length ? 'zone_liste_deroulante' : c.type === 'texte_long' ? 'zone_texte_multiligne' : 'zone_texte',
    nom: c.nom, champ: c.nom, etiquette: c.nom, x, y, largeur, hauteur: c.type === 'texte_long' ? 96 : 24,
    lecture_seule: c.type === 'numero_auto', aligne_droite: ['monetaire', 'entier_long', 'reel_double'].includes(c.type), valeurs: c.liste_valeurs ?? [],
  };
}

/** Meme forme que forge-base formulaire_instantane (disposition simple ou tabulaire). */
function instantForm(source: string, fields: DefinitionChamp[], disposition: string): Maquette {
  const tab = disposition === 'tabulaire';
  return {
    version: 1, source, titre: source, disposition,
    sections: {
      entete: { hauteur: 56, controles: [{ type: 'etiquette', texte: source, style: 'titre', x: 8, y: 8, largeur: 400, hauteur: 36 }] },
      detail: { controles: fields.map((c, i) => (tab ? controle(c, 8 + i * 136, 8, 128) : controle(c, 160, 8 + i * 36, 320))) },
      pied: { hauteur: 0, controles: [] },
    },
  };
}

function instantReport(source: string, fields: DefinitionChamp[], group: string | null): Maquette {
  const cols = fields.filter((c) => c.nom !== group);
  const w = Math.max(60, Math.floor(720 / Math.max(1, cols.length)));
  return {
    version: 1, source, titre: source, orientation: cols.length > 6 ? 'paysage' : 'portrait',
    regroupements: group ? [{ champ: group, tri: 'croissant', entete: true, pied: true }] : [],
    sections: {
      entete_etat: { controles: [{ type: 'etiquette', texte: source, style: 'titre', x: 8, y: 8, largeur: 500, hauteur: 36 }, { type: 'zone_texte', source: '=Date()', x: 560, y: 8, largeur: 160, hauteur: 20 }] },
      entete_page: { controles: cols.map((c, i) => ({ type: 'etiquette', texte: c.nom, style: 'entete_colonne', x: 8 + i * w, y: 4, largeur: w - 4, hauteur: 20 })) },
      detail: { controles: cols.map((c, i) => controle(c, 8 + i * w, 2, w - 4)) },
      pied_page: { controles: [{ type: 'zone_texte', source: '="Page " & [Page] & " sur " & [Pages]', x: 560, y: 4, largeur: 160, hauteur: 20 }] },
      pied_etat: { controles: cols.flatMap((c, i) => (['monetaire', 'entier_long'].includes(c.type) && !c.cle_primaire ? [{ type: 'zone_texte', source: `=Somme([${c.nom}])`, x: 8 + i * w, y: 4, largeur: w - 4, hauteur: 20, aligne_droite: true }] : [])) },
    },
  };
}

const OBJECTS: Record<string, ObjetStocke[]> = {
  formulaire: [{ genre: 'formulaire', nom: 'Fiche client', contenu: instantForm('Clients', TABLES.Clients?.fields ?? [], 'simple') as unknown as Json, description: null }],
  etat: [{ genre: 'etat', nom: 'Produits par catégorie', contenu: instantReport('Produits', TABLES.Produits?.fields ?? [], 'Catégorie') as unknown as Json, description: null }],
  macro: [{
    genre: 'macro', nom: 'Ouvrir le catalogue', description: null,
    contenu: { actions: [{ action: 'ouvrir_table', arguments: { nom: 'Produits' } }, { action: 'zone_message', arguments: { message: 'Catalogue ouvert.' } }] },
  }],
  module: [],
};

function find(name: string): [string, DemoTable] {
  const e = Object.entries(TABLES).find(([n]) => n.toLowerCase() === name.trim().toLowerCase());
  if (!e) throw new Error(`« ${name} » est introuvable.`);
  return e;
}

function champs(fields: DefinitionChamp[]): ChampSchema[] {
  return fields.map((c, i) => {
    const { nom, type, cle_primaire, ...proprietes } = c;
    return { nom, type, libelle_type: type, position: i, cle_primaire: cle_primaire ?? false, proprietes, genere: false };
  });
}

function schema(name: string): SchemaTable {
  const [nom, t] = find(name);
  return {
    nom, est_vue: false, proprietes: {}, champs: champs(t.fields), cle_primaire: t.fields.filter((x) => x.cle_primaire).map((x) => x.nom),
    index: [], relations: RELATIONS.filter((r) => r.table_parent === nom || r.table_enfant === nom), nb_lignes: t.rows.length,
  };
}

function memTables(): Record<string, MemTable> {
  return Object.fromEntries(Object.entries(TABLES).map(([n, t]) => [n, { columns: t.fields.map((x) => x.nom), rows: t.rows }]));
}

function result(r: { colonnes: string[]; lignes: Json[][] }): ResultatSql {
  return { colonnes: r.colonnes.map((nom) => ({ nom, type: null, rendu: 'brut', legende: null })), lignes: r.lignes, lignes_modifiees: 0, dernier_id: null, lecture_seule: true, tronque: false };
}

function query(nom: string): RequeteEnregistree {
  const q = QUERIES.find((x) => x.nom.toLowerCase() === nom.toLowerCase());
  if (!q) throw new Error(`« ${nom} » est introuvable.`);
  return q;
}

function readTable(name: string, options: OptionsLecture): PageLignes {
  const [, t] = find(name);
  const columns = t.fields.map((x) => x.nom);
  const page = applyOptions(columns, t.rows, options);
  const keyField = t.fields.find((x) => x.cle_primaire)?.nom ?? columns[0] ?? '';
  return {
    colonnes: t.fields.map((x) => ({ nom: x.nom, type: x.type, rendu: 'brut', legende: null })),
    lignes: page.indexes.map((i) => t.rows[i] ?? []),
    cles: page.indexes.map((i) => ({ [keyField]: t.rows[i]?.[0] ?? null })),
    total: page.total, page: options.page, taille_page: options.taille_page, nb_pages: page.nbPages, modifiable: false,
  };
}

function str(args: Record<string, unknown>, k: string): string {
  const v = args[k];
  return typeof v === 'string' ? v : '';
}

/** Base de demonstration en lecture seule. Toute ecriture est refusee avec un message clair. */
export function demoDb(): Db {
  const handlers: Record<string, (a: Record<string, unknown>) => unknown> = {
    infos: () => ({ chemin: null, lecture_seule: true, taille_octets: 0, version_sqlite: '-', nb_tables: Object.keys(TABLES).length }),
    objets: (): ObjetBase[] => [
      ...Object.keys(TABLES).map((nom) => ({ nom, genre: 'table' as const, description: null, modifie_le: null })),
      ...QUERIES.map((q) => ({ nom: q.nom, genre: 'requete' as const, description: null, modifie_le: null })),
      ...(['formulaire', 'etat', 'macro'] as const).flatMap((g) => (OBJECTS[g] ?? []).map((o) => ({ nom: o.nom, genre: g, description: null, modifie_le: null }))),
    ],
    schema: (a) => schema(str(a, 'table')),
    lire_table: (a) => readTable(str(a, 'table'), a.options as OptionsLecture),
    total: (a) => {
      const [, t] = find(str(a, 'table'));
      const o = a.options as OptionsLecture;
      const c = t.fields.findIndex((x) => x.nom === str(a, 'champ'));
      const all = applyOptions(t.fields.map((x) => x.nom), t.rows, { ...o, page: 0, taille_page: 1e9 });
      return computeTotal(all.indexes.map((i) => t.rows[i]?.[c] ?? null), a.fonction as FonctionTotal);
    },
    distinctes: (a) => {
      const [, t] = find(str(a, 'table'));
      const c = t.fields.findIndex((x) => x.nom === str(a, 'champ'));
      return distinctValues(t.rows.map((r) => r[c] ?? null));
    },
    relations: () => RELATIONS,
    requetes: () => QUERIES,
    lire_requete: (a) => query(str(a, 'nom')),
    executer_requete: (a) => result(runDefinition(query(str(a, 'nom')).definition as unknown as DefinitionRequete, memTables())),
    executer_definition: (a) => result(runDefinition(a.definition as DefinitionRequete, memTables())),
    lister_objets_genre: (a) => OBJECTS[str(a, 'genre')] ?? [],
    lire_objet: (a) => {
      const o = (OBJECTS[str(a, 'genre')] ?? []).find((x) => x.nom === str(a, 'nom'));
      if (!o) throw new Error(`« ${str(a, 'nom')} » est introuvable.`);
      return o;
    },
    formulaire_instantane: (a) => {
      const [nom, t] = find(str(a, 'source'));
      return instantForm(nom, t.fields, str(a, 'disposition') || 'simple');
    },
    etat_instantane: (a) => {
      const [nom, t] = find(str(a, 'source'));
      return instantReport(nom, t.fields, typeof a.regroupement === 'string' ? a.regroupement : null);
    },
    executer_macro: (a) => {
      const o = (OBJECTS.macro ?? []).find((x) => x.nom === str(a, 'nom'));
      const actions = (o?.contenu as { actions?: Json[] } | undefined)?.actions ?? [];
      return actions;
    },
    documenter: () => ({ tables: Object.keys(TABLES).map(schema), vues: [], requetes: QUERIES, relations: RELATIONS }),
    verifier_integrite: () => ({ ok: true, problemes: [], orphelins: [] }),
  };
  return {
    demo: true,
    readOnly: true,
    call: async <T,>(op: string, args: Record<string, unknown> = {}): Promise<T> => {
      const h = handlers[op];
      if (!h) throw new Error(S.readOnly);
      return h(args) as T;
    },
  };
}
