// Scenario d'operations tel que l'interface les envoie a la commande Tauri `base_op` (memes fonctions que l'application).
// Le fichier fixtures/ops-scenario.json est rejoue par un test Rust de apps/desktop/src-tauri/src/base_cmds.rs contre le
// vrai moteur forge-base. Regenerer : node packages/access/tests/scenario.ts --write
import { writeFileSync } from 'node:fs';
import { addField, addJoin, addTable, definitionWithLayout, emptyQuery, setColumn, setTotals, toDefinition } from '../src/logic/qbe.ts';
import { TEMPLATES } from '../src/logic/templates.ts';
import type { DefinitionChamp } from '../src/types.ts';

export const FIXTURE = new URL('./fixtures/ops-scenario.json', import.meta.url);

type Op = Record<string, unknown> & { op: string };

export function scenario(): Op[] {
  const ops: Op[] = [];
  // Modeles : tables, relations, donnees (comme exchange.applyTemplate).
  for (const t of TEMPLATES) {
    for (const table of t.tables) ops.push({ op: 'creer_table', definition: table });
    for (const r of t.relations) ops.push({ op: 'creer_relation', relation: r });
    for (const table of t.tables) for (const row of t.rows[table.nom] ?? []) ops.push({ op: 'inserer', table: table.nom, valeurs: row });
  }
  // Nouvelle table vide (Creer > Table) puis ajout d'un champ depuis la feuille de donnees (toDefinitions + nouveau champ).
  ops.push({ op: 'creer_table', definition: { nom: 'Table1', champs: [{ nom: 'N°', type: 'numero_auto', cle_primaire: true }] } });
  const existing: DefinitionChamp[] = [{ nom: 'N°', type: 'numero_auto', cle_primaire: true, ancien_nom: 'N°', requis: false, indexe: 'non', liste_valeurs: [], limiter_a_liste: false }];
  ops.push({ op: 'modifier_table', table: 'Table1', champs: [...existing, { nom: 'Champ1', type: 'texte_court', cle_primaire: false }] });
  ops.push({ op: 'inserer', table: 'Table1', valeurs: { Champ1: 'Bonjour' } });
  // Feuille de donnees : lecture paginee, tri, filtres (selection et liste de valeurs), recherche, totaux, edition.
  ops.push({ op: 'lire_table', table: 'Produits', options: { page: 0, taille_page: 100, tri: [{ champ: 'Désignation', descendant: false }], filtres: [{ champ: 'Catégorie', operateur: 'dans', valeurs: [1, 2] }], recherche: 'souris' } });
  ops.push({ op: 'lire_table', table: 'Contacts', options: { page: 0, taille_page: 100, tri: [], filtres: [{ champ: 'Ville', operateur: 'different', valeur: 'Lyon' }], recherche: null } });
  ops.push({ op: 'total', table: 'Produits', champ: 'Prix unitaire', fonction: 'somme', options: { page: 0, taille_page: 100, tri: [], filtres: [], recherche: null } });
  ops.push({ op: 'distinctes', table: 'Tâches', champ: 'Priorité', limite: 50 });
  ops.push({ op: 'modifier', table: 'Produits', cle: { 'N°': 1 }, valeurs: { Stock: 150 } });
  ops.push({ op: 'remplacer_tout', table: 'Contacts', champ: 'Ville', chercher: 'Lille', remplacer: 'Roubaix', respecter_casse: false });
  // Createur de requetes : jointure, criteres, totaux -> SQL, execution, enregistrement avec positions.
  let q = addJoin(addTable(addTable(emptyQuery(), 'Clients'), 'Factures'), { gauche: 'Clients', champ_gauche: 'N°', droite: 'Factures', champ_droite: 'Client', genre: 'interne' });
  q = addField(addField(q, 'Clients', 'Nom'), 'Factures', 'N°');
  q = setColumn(setTotals(q, true), 1, { total: 'compte' });
  q = setColumn(q, 0, { sort: 'croissant', criteria: ['Comme "A*"', 'Comme "B*"'] });
  ops.push({ op: 'generer_sql', definition: toDefinition(q) });
  ops.push({ op: 'executer_definition', definition: toDefinition(q), parametres: [] });
  ops.push({ op: 'enregistrer_requete', requete: { nom: 'Factures par client', genre: q.genre, sql: '', definition: definitionWithLayout(q) } });
  ops.push({ op: 'executer_requete', nom: 'Factures par client', parametres: [] });
  ops.push({ op: 'executer_sql', sql: 'SELECT [Désignation] FROM [Produits] WHERE [Stock] > ?', parametres: [10] });
  // Formulaires, etats, macros.
  ops.push({ op: 'formulaire_instantane', source: 'Contacts', disposition: 'simple' });
  ops.push({ op: 'etat_instantane', source: 'Produits', regroupement: 'Catégorie' });
  ops.push({ op: 'enregistrer_objet', genre: 'formulaire', nom: 'Fiche contact', contenu: { version: 1, source: 'Contacts', titre: 'Contacts', sections: { detail: { controles: [] } } }, description: null });
  ops.push({ op: 'enregistrer_objet', genre: 'macro', nom: 'Ouvrir produits', contenu: { actions: [{ action: 'ouvrir_table', arguments: { nom: 'Produits' } }, { action: 'zone_message', arguments: { message: 'OK' } }] }, description: null });
  ops.push({ op: 'executer_macro', nom: 'Ouvrir produits' });
  ops.push({ op: 'renommer_objet', genre: 'formulaire', ancien: 'Fiche contact', nouveau: 'Fiche des contacts' });
  // Donnees externes (comme exchange.importFile).
  ops.push({ op: 'importer_csv', table: 'Import CSV', texte: 'Nom;Montant;Date\nAlpha;12,5;31/12/2026\nBêta;3;01/01/2027\n', options: { entete: true, mode: 'creer_table', ajouter_numero_auto: true } });
  ops.push({ op: 'importer_lignes', table: 'Import classeur', entetes: ['Code', 'Qté'], lignes: [['A1', 3], ['B2', null]], options: { entete: true, mode: 'creer_table', ajouter_numero_auto: false } });
  // Volet de navigation et outils.
  ops.push({ op: 'copier_table', source: 'Contacts', destination: 'Copie de Contacts', avec_donnees: true });
  ops.push({ op: 'renommer_table', ancien: 'Copie de Contacts', nouveau: 'Contacts 2' });
  ops.push({ op: 'supprimer_table', table: 'Contacts 2', avec_relations: true });
  ops.push({ op: 'supprimer', table: 'Table1', cles: [{ 'N°': 1 }] });
  ops.push({ op: 'objets' });
  ops.push({ op: 'relations' });
  ops.push({ op: 'documenter' });
  ops.push({ op: 'verifier_integrite' });
  return ops;
}

if (process.argv.includes('--write')) writeFileSync(FIXTURE, `${JSON.stringify(scenario(), null, 1)}\n`);
