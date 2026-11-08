// Volet de navigation : regroupement, tri, masquage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_NAV_VIEW, arrangeNav, hiddenCount, hideEntry, unhideEntry, type NavEntry } from '../src/logic/nav-view.ts';

const E: NavEntry[] = [
  { kind: 'table', name: 'Produits', modified: '2026-01-02' },
  { kind: 'table', name: 'Clients', modified: '2026-03-01' },
  { kind: 'table', name: 'Éclairage', modified: null },
  { kind: 'etat', name: 'Bilan', modified: '2026-02-01' },
];
const names = (g: ReturnType<typeof arrangeNav>[number]): string[] => g.items.map((i) => i.name);

test('par type : tous les groupes, tri par nom avec accents (fr)', () => {
  const groups = arrangeNav(E, DEFAULT_NAV_VIEW);
  assert.deepEqual(groups.map((g) => g.id), ['table', 'requete', 'formulaire', 'etat', 'macro']);
  assert.deepEqual(names(groups[0]!), ['Clients', 'Éclairage', 'Produits']);
});

test('tri decroissant et par date de modification (recents d abord, sans date en dernier)', () => {
  assert.deepEqual(names(arrangeNav(E, { ...DEFAULT_NAV_VIEW, sort: 'name-desc' })[0]!), ['Produits', 'Éclairage', 'Clients']);
  assert.deepEqual(names(arrangeNav(E, { ...DEFAULT_NAV_VIEW, sort: 'modified' })[0]!), ['Clients', 'Produits', 'Éclairage']);
});

test('liste plate sans groupes', () => {
  const groups = arrangeNav(E, { ...DEFAULT_NAV_VIEW, groupBy: 'none' });
  assert.equal(groups.length, 1);
  assert.deepEqual(names(groups[0]!), ['Bilan', 'Clients', 'Éclairage', 'Produits']);
});

test('recherche : groupes vides retires', () => {
  const groups = arrangeNav(E, DEFAULT_NAV_VIEW, (n) => n.startsWith('B'), true);
  assert.deepEqual(groups.map((g) => g.id), ['etat']);
});

test('masquage : retire de la liste, revele a la demande, reversible', () => {
  const v = hideEntry(DEFAULT_NAV_VIEW, E[1]!);
  assert.deepEqual(names(arrangeNav(E, v)[0]!), ['Éclairage', 'Produits']);
  assert.equal(hiddenCount(E, v), 1);
  assert.equal(hideEntry(v, E[1]!), v, 'idempotent');
  assert.deepEqual(names(arrangeNav(E, { ...v, showHidden: true })[0]!), ['Clients', 'Éclairage', 'Produits']);
  assert.deepEqual(unhideEntry(v, E[1]!).hidden, []);
  assert.equal(hiddenCount(E.slice(0, 1), v), 0, 'objet supprime : non compte');
});
