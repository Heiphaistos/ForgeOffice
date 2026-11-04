// Logique sans DOM du module Base de donnees : saisie, types, QBE, tri/filtres en memoire, etats, export, modeles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayValue, parseDate, parseInput, parseNumber, safeLink, uniqueName, validateName } from '../src/logic/values.ts';
import { changeType, cleanFields, engineType, newField, uiTypeOf, UI_TYPES } from '../src/logic/field-types.ts';
import { addField, addJoin, addTable, emptyQuery, fromDefinition, removeTable, setColumn, setTotals, toDefinition, validateQbe, definitionWithLayout } from '../src/logic/qbe.ts';
import { applyOptions, computeTotal, distinctValues, matchFilter } from '../src/logic/table-ops.ts';
import { evalReportExpression, groupRows, paginate, reportLines } from '../src/logic/report.ts';
import { escapeHtml, fileNameFor, toCsv, toHtml } from '../src/logic/export.ts';
import { matchCriterion, runDefinition } from '../src/logic/demo-query.ts';
import { analyzeSchema } from '../src/logic/analyze.ts';
import { TEMPLATES } from '../src/logic/templates.ts';
import { demoDb } from '../src/demo-db.ts';
import type { PageLignes, SchemaTable } from '../src/types.ts';

test('saisie : nombres, dates et booleens a la francaise', () => {
  assert.equal(parseNumber('1 234,56'), 1234.56);
  assert.equal(parseNumber('-3 €'), -3);
  assert.equal(parseNumber('12.5'), 12.5);
  assert.equal(parseNumber('abc'), null);
  assert.equal(parseNumber('1,2,3'), null);
  assert.equal(parseDate('31/12/2026'), '2026-12-31');
  assert.equal(parseDate('1/2/26 9:05'), '2026-02-01T09:05:00');
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(parseDate('29/02/2024'), '2024-02-29');
  assert.equal(parseDate('25:00'), null);
});

test('saisie : controles du type, requis, taille, liste, liens', () => {
  assert.deepEqual(parseInput('42', { nom: 'Qté', type: 'entier' }), { ok: true, value: 42 });
  assert.equal(parseInput('4,5', { nom: 'Qté', type: 'entier' }).ok, false);
  assert.equal(parseInput('300', { nom: 'O', type: 'octet' }).ok, false);
  assert.deepEqual(parseInput('12,345678', { nom: 'P', type: 'monetaire' }), { ok: true, value: 12.3457 });
  assert.deepEqual(parseInput('', { nom: 'N', type: 'texte_court' }), { ok: true, value: null });
  const req = parseInput(' ', { nom: 'Nom', type: 'texte_court', requis: true });
  assert.equal(req.ok, false);
  assert.match(req.ok ? '' : req.error, /Nom/);
  assert.equal(parseInput('abcdef', { nom: 'C', type: 'texte_court', taille: 5 }).ok, false);
  assert.deepEqual(parseInput('oui', { nom: 'B', type: 'oui_non' }), { ok: true, value: true });
  assert.equal(parseInput('peut-être', { nom: 'B', type: 'oui_non' }).ok, false);
  assert.equal(parseInput('Rouge', { nom: 'L', type: 'texte_court', liste_valeurs: ['Vert'], limiter_a_liste: true }).ok, false);
  assert.equal(parseInput('javascript:alert(1)', { nom: 'U', type: 'lien_hypertexte' }).ok, false);
  assert.equal(safeLink('https://exemple.fr'), true);
  assert.equal(safeLink('mailto:a@b.fr'), true);
  assert.equal(safeLink('data:text/html,x'), false);
  assert.equal(parseInput('5', { nom: 'N°', type: 'numero_auto' }).ok, false);
});

test('affichage : dates, euros, booleens, pieces jointes', () => {
  assert.equal(displayValue('2026-12-31', 'date_heure'), '31/12/2026');
  assert.equal(displayValue('2026-12-31T14:30:00', 'date_heure'), '31/12/2026 14:30');
  assert.equal(displayValue(true, 'oui_non'), 'Oui');
  assert.match(displayValue(1234.5, 'monetaire'), /1\s?234,50\s?€/);
  assert.equal(displayValue({ type: 'blob', taille: 12 }, 'piece_jointe'), '(12 octets)');
});

test('noms d’objets selon les regles d’Access', () => {
  assert.equal(validateName('Clients'), null);
  assert.equal(validateName('Prix unitaire'), null);
  assert.notEqual(validateName(''), null);
  assert.notEqual(validateName(' Nom'), null);
  assert.notEqual(validateName('a.b'), null);
  assert.notEqual(validateName('[x]'), null);
  assert.notEqual(validateName('x'.repeat(65)), null);
  assert.equal(uniqueName('Table1', ['Table1', 'table2']), 'Table3');
});

test('types : les 13 choix d’Access et la taille Nombre', () => {
  assert.equal(UI_TYPES.length, 13);
  assert.equal(uiTypeOf({ type: 'reel_double' }), 'nombre');
  assert.equal(uiTypeOf({ type: 'grand_entier' }), 'grand_nombre');
  assert.equal(uiTypeOf({ type: 'texte_court', liste_valeurs: ['A'] }), 'liste_choix');
  assert.equal(engineType('nombre', 'octet'), 'octet');
  assert.equal(engineType('liste_choix'), 'texte_court');
  const auto = changeType(newField('Id'), 'numero_auto');
  assert.equal(auto.cle_primaire, true);
  const num = changeType({ ...newField('P'), taille: 20 }, 'nombre');
  assert.equal(num.type, 'entier_long');
  assert.equal(num.taille, undefined);
  assert.deepEqual(cleanFields([{ nom: ' A ', type: 'texte_court', liste_valeurs: [' x ', ''] }, { nom: '', type: 'texte_court' }]), [{ nom: 'A', type: 'texte_court', liste_valeurs: ['x'] }]);
});

test('QBE : grille -> definition de requete', () => {
  let q = addTable(addTable(emptyQuery(), 'Clients'), 'Commandes');
  q = addTable(q, 'clients');
  assert.equal(q.tables.length, 2);
  q = addJoin(q, { gauche: 'Clients', champ_gauche: 'N°', droite: 'Commandes', champ_droite: 'Client', genre: 'interne' });
  q = addJoin(q, { gauche: 'Commandes', champ_gauche: 'Client', droite: 'Clients', champ_droite: 'N°', genre: 'gauche' });
  assert.equal(q.joins.length, 1);
  assert.equal(q.joins[0]?.genre, 'gauche');
  q = addField(q, 'Clients', 'Ville');
  q = addField(q, 'Commandes', 'Quantité');
  q = setColumn(q, 0, { sort: 'croissant', criteria: ['"Lyon"', '"Lille"', ''] });
  q = setColumn(q, 1, { show: false, criteria: ['>5'] });
  q = setColumn(q, 5, { field: '' });
  const def = toDefinition(q);
  assert.equal(def.genre, 'selection');
  assert.deepEqual(def.tables, [{ nom: 'Clients' }, { nom: 'Commandes' }]);
  assert.equal(def.colonnes.length, 2);
  assert.deepEqual(def.colonnes[0], { champ: 'Ville', table: 'Clients', afficher: true, tri: 'croissant', criteres: ['"Lyon"', '"Lille"'] });
  assert.equal(def.colonnes[1]?.afficher, false);
  assert.equal(def.colonnes[1]?.operation, undefined);
  assert.equal(validateQbe(q), null);
});

test('QBE : totaux, requetes action, aller-retour avec positions', () => {
  let q = addField(addTable(emptyQuery(), 'Produits'), 'Produits', 'Catégorie');
  q = addField(q, 'Produits', 'Stock');
  q = setTotals(q, true);
  q = setColumn(q, 1, { total: 'somme' });
  let def = toDefinition(q);
  assert.equal(def.colonnes[0]?.operation, 'regroupement');
  assert.equal(def.colonnes[1]?.operation, 'somme');
  q = { ...q, genre: 'ajout', target: '' };
  assert.notEqual(validateQbe(q), null);
  q = setColumn({ ...setTotals(q, false), target: 'Archive' }, 1, { appendTo: 'Stock' });
  def = toDefinition(q);
  assert.equal(def.table_cible, 'Archive');
  assert.equal(def.colonnes[1]?.ajouter_a, 'Stock');
  const upd = setColumn({ ...q, genre: 'mise_a_jour' }, 1, { update: '[Stock]+1' });
  assert.equal(toDefinition(upd).colonnes[1]?.mise_a_jour, '[Stock]+1');
  const moved = { ...upd, tables: upd.tables.map((t) => ({ ...t, x: 300, y: 40 })) };
  const back = fromDefinition(JSON.parse(JSON.stringify(definitionWithLayout(moved))));
  assert.equal(back.genre, 'mise_a_jour');
  assert.deepEqual(back.tables[0], { name: 'Produits', x: 300, y: 40 });
  assert.equal(back.columns[1]?.update, '[Stock]+1');
  assert.equal(removeTable(back, 'produits').columns.length, 0);
  assert.equal(validateQbe(emptyQuery()), 'Ajoutez au moins une table à la requête.');
});

test('feuille en memoire : filtres, recherche sans accents, tri, pages, totaux', () => {
  const cols = ['Nom', 'Ville', 'Prix'];
  const rows = [['Élodie', 'Lyon', 10], ['bernard', 'Paris', 5], ['Adèle', 'Lyon', null], ['Zoé', 'Lille', 7]];
  const all = applyOptions(cols, rows, { page: 0, taille_page: 10, tri: [{ champ: 'Nom', descendant: false }], filtres: [] });
  assert.deepEqual(all.indexes, [2, 1, 0, 3]);
  const lyon = applyOptions(cols, rows, { page: 0, taille_page: 10, tri: [], filtres: [{ champ: 'Ville', operateur: 'egal', valeur: 'lyon' }] });
  assert.deepEqual(lyon.indexes, [0, 2]);
  const search = applyOptions(cols, rows, { page: 0, taille_page: 10, tri: [], filtres: [], recherche: 'elo' });
  assert.deepEqual(search.indexes, [0]);
  const paged = applyOptions(cols, rows, { page: 1, taille_page: 3, tri: [{ champ: 'Prix', descendant: true }], filtres: [] });
  assert.equal(paged.nbPages, 2);
  assert.deepEqual(paged.indexes, [2]);
  assert.equal(matchFilter(5, { champ: 'P', operateur: 'entre', valeur: 1, valeur2: 5 }), true);
  assert.equal(matchFilter('Lyon', { champ: 'V', operateur: 'dans', valeurs: ['Paris', 'Lyon'] }), true);
  assert.equal(matchFilter('Lyon', { champ: 'V', operateur: 'comme', valeur: 'L*n' }), true);
  assert.equal(matchFilter(null, { champ: 'V', operateur: 'est_vide' }), true);
  assert.equal(computeTotal([10, 5, null, 7], 'somme'), 22);
  assert.equal(computeTotal([10, 5, null, 7], 'compte'), 3);
  assert.equal(computeTotal([10, 5, null, 7], 'max'), 10);
  assert.equal(computeTotal([2, 4], 'variance'), 2);
  assert.deepEqual(distinctValues(['b', 'a', 'b', null]), [null, 'a', 'b']);
});

test('etats : regroupement, expressions, pagination', () => {
  const cols = ['Cat', 'Prix'];
  const rows = [['B', 2], ['A', 1], ['B', 3]];
  const groups = groupRows(cols, rows, 'Cat');
  assert.deepEqual(groups.map((g) => [g.key, g.rows.length]), [['A', 1], ['B', 2]]);
  assert.equal(groupRows(cols, rows, null).length, 1);
  const ctx = { columns: cols, rows, page: 2, pages: 5, today: new Date(2026, 10, 4) };
  assert.equal(evalReportExpression('=Somme([Prix])', ctx), '6');
  assert.equal(evalReportExpression('=Compte(*)', ctx), '3');
  assert.equal(evalReportExpression('=Date()', ctx), '04/11/2026');
  assert.equal(evalReportExpression('="Page " & [Page] & " sur " & [Pages]', ctx), 'Page 2 sur 5');
  assert.equal(evalReportExpression('=alert(1)', ctx), '');
  assert.equal(evalReportExpression('Texte', ctx), 'Texte');
  const lines = reportLines(groups, true);
  assert.deepEqual(lines.map((l) => l.kind), ['group', 'detail', 'groupFooter', 'group', 'detail', 'detail', 'groupFooter']);
  assert.deepEqual(paginate([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(paginate([], 2), [[]]);
});

test('export : CSV francais protege, HTML echappe, noms de fichiers', () => {
  const csv = toCsv({ title: 'T', columns: ['Nom', 'Prix'], rows: [['=SOMME(A1)', 1.5], ['a;b', null], ['dit "x"', true]] });
  assert.ok(csv.startsWith('﻿Nom;Prix\r\n'));
  assert.ok(csv.includes("'=SOMME(A1);1,5"));
  assert.ok(csv.includes('"a;b";'));
  assert.ok(csv.includes('"dit ""x""";Oui'));
  const html = toHtml({ title: '<T>', columns: ['<b>'], rows: [['<script>alert(1)</script>']] });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(escapeHtml(`"'&`), '&quot;&#39;&amp;');
  assert.equal(fileNameFor('a/b:c', 'csv'), 'a_b_c.csv');
});

test('requete en memoire : jointures, criteres, tri, totaux', () => {
  const tables = {
    Clients: { columns: ['N°', 'Ville'], rows: [[1, 'Lyon'], [2, 'Paris'], [3, 'Lyon']] },
    Commandes: { columns: ['N°', 'Client', 'Qté'], rows: [[1, 1, 5], [2, 1, 3], [3, 2, 10]] },
  };
  const join = { gauche: 'Clients', champ_gauche: 'N°', droite: 'Commandes', champ_droite: 'Client', genre: 'interne' as const };
  const r = runDefinition({
    genre: 'selection', tables: [{ nom: 'Clients' }, { nom: 'Commandes' }], jointures: [join],
    colonnes: [{ champ: 'Ville', table: 'Clients', afficher: true, criteres: ['"Lyon"'] }, { champ: 'Qté', table: 'Commandes', afficher: true, tri: 'decroissant', criteres: [] }],
  }, tables);
  assert.deepEqual(r.lignes, [['Lyon', 5], ['Lyon', 3]]);
  const left = runDefinition({ genre: 'selection', tables: [{ nom: 'Clients' }, { nom: 'Commandes' }], jointures: [{ ...join, genre: 'gauche' }], colonnes: [{ champ: 'N°', table: 'Clients', afficher: true, criteres: [] }] }, tables);
  assert.equal(left.lignes.length, 4);
  const tot = runDefinition({
    genre: 'selection', tables: [{ nom: 'Clients' }, { nom: 'Commandes' }], jointures: [join],
    colonnes: [{ champ: 'Ville', table: 'Clients', afficher: true, criteres: [], operation: 'regroupement', tri: 'croissant' }, { champ: 'Qté', table: 'Commandes', afficher: true, criteres: [], operation: 'somme' }],
  }, tables);
  assert.deepEqual(tot.lignes, [['Lyon', 8], ['Paris', 10]]);
  assert.equal(matchCriterion(5, 'Entre 1 Et 5'), true);
  assert.equal(matchCriterion('Lyon', 'Comme "L*"'), true);
  assert.equal(matchCriterion(null, 'Est Null'), true);
  assert.equal(matchCriterion(3, '<>3'), false);
  assert.throws(() => runDefinition({ genre: 'selection', tables: [{ nom: 'Inconnue' }], jointures: [], colonnes: [] }, tables));
});

test('modeles : noms valides et relations coherentes', () => {
  assert.deepEqual(TEMPLATES.map((t) => t.id), ['contacts', 'inventory', 'tasks', 'invoices']);
  for (const t of TEMPLATES) {
    const names = t.tables.map((x) => x.nom);
    assert.ok(names.includes(t.main));
    for (const tb of t.tables) {
      assert.equal(validateName(tb.nom), null);
      for (const c of tb.champs) assert.equal(validateName(c.nom), null, `${tb.nom}.${c.nom}`);
      for (const row of t.rows[tb.nom] ?? []) for (const k of Object.keys(row)) assert.ok(tb.champs.some((c) => c.nom === k), `${tb.nom}.${k}`);
    }
    for (const r of t.relations) {
      const parent = t.tables.find((x) => x.nom === r.table_parent);
      const child = t.tables.find((x) => x.nom === r.table_enfant);
      assert.ok(parent?.champs.find((c) => c.nom === r.champs_parent[0])?.cle_primaire, r.table_parent);
      assert.ok(child?.champs.some((c) => c.nom === r.champs_enfant[0]), r.table_enfant);
      assert.ok(names.indexOf(r.table_parent) < names.indexOf(r.table_enfant), 'parents crees avant les enfants');
    }
  }
});

test('analyseur : cle manquante, champ de jointure non indexe', () => {
  const base = (nom: string, extra: Partial<SchemaTable>): SchemaTable => ({ nom, est_vue: false, proprietes: {}, champs: [], cle_primaire: [], index: [], relations: [], nb_lignes: 0, ...extra });
  const tables = [
    base('A', { champs: [{ nom: 'X', type: 'texte_court', libelle_type: '', position: 0, cle_primaire: false, proprietes: { taille: 255 }, genere: false }] }),
    base('B', { cle_primaire: ['N°'], champs: [{ nom: 'A', type: 'entier_long', libelle_type: '', position: 0, cle_primaire: false, proprietes: {}, genere: false }] }),
  ];
  const out = analyzeSchema(tables, [{ nom: 'r', table_parent: 'A', champs_parent: ['X'], table_enfant: 'B', champs_enfant: ['A'], integrite: true, cascade_maj: false, suppression: 'restreindre', jointure: 'interne' }]);
  assert.ok(out.some((s) => s.includes('« A » n’a pas de clé')));
  assert.ok(out.some((s) => s.includes('B.A')));
  assert.ok(out.some((s) => s.includes('A.X')));
});

test('base de demonstration : lecture paginee, requetes, ecriture refusee', async () => {
  const db = demoDb();
  const objets = await db.call<{ genre: string }[]>('objets');
  assert.ok(objets.filter((o) => o.genre === 'table').length >= 3);
  const page = await db.call<PageLignes>('lire_table', { table: 'Clients', options: { page: 0, taille_page: 3, tri: [{ champ: 'Ville', descendant: false }], filtres: [] } });
  assert.equal(page.lignes.length, 3);
  assert.equal(page.total, 8);
  assert.equal(page.nb_pages, 3);
  const q = await db.call<{ lignes: unknown[][] }>('executer_requete', { nom: 'Produits à réapprovisionner' });
  assert.ok(q.lignes.length > 0 && q.lignes.every((l) => (l[2] as number) < 10));
  const detail = await db.call<{ lignes: unknown[][] }>('executer_requete', { nom: 'Commandes détaillées' });
  assert.equal(detail.lignes.length, 12);
  await assert.rejects(db.call('inserer', { table: 'Clients', valeurs: {} }), /lecture seule/);
});
