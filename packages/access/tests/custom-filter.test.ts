// Filtres personnalises : familles, options, construction et application sur des lignes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomFilter, customFilterOptions, familyOf } from '../src/logic/custom-filter.ts';
import { matchFilter } from '../src/logic/table-ops.ts';

const opt = (family: 'texte' | 'nombre' | 'date', id: string) => {
  const o = customFilterOptions(family).find((x) => x.id === id);
  assert.ok(o, id);
  return o;
};

test('famille d un champ', () => {
  assert.equal(familyOf('texte_court'), 'texte');
  assert.equal(familyOf('monetaire'), 'nombre');
  assert.equal(familyOf('numero_auto'), 'nombre');
  assert.equal(familyOf('date_heure'), 'date');
  assert.equal(familyOf(null), 'texte');
});

test('options : le texte n a pas de comparaison d ordre, les nombres et dates ont « Entre »', () => {
  assert.deepEqual(customFilterOptions('texte').map((o) => o.id), ['egal', 'different', 'commence_par', 'finit_par', 'contient', 'ne_contient_pas', 'est_vide', 'nest_pas_vide']);
  assert.ok(customFilterOptions('nombre').some((o) => o.id === 'entre' && o.values === 2));
  assert.ok(!customFilterOptions('texte').some((o) => o.id === 'entre'));
});

test('construction : texte, nombre francais, date francaise, intervalle, sans valeur', () => {
  assert.deepEqual(buildCustomFilter('Ville', opt('texte', 'commence_par'), 'texte', ' B ', ''), { ok: true, filter: { champ: 'Ville', operateur: 'commence_par', valeur: 'B' } });
  assert.deepEqual(buildCustomFilter('Prix', opt('nombre', 'superieur'), 'nombre', '12,5', ''), { ok: true, filter: { champ: 'Prix', operateur: 'superieur', valeur: 12.5 } });
  assert.deepEqual(buildCustomFilter('Date', opt('date', 'inferieur'), 'date', '03/04/2024', ''), { ok: true, filter: { champ: 'Date', operateur: 'inferieur', valeur: '2024-04-03' } });
  assert.deepEqual(buildCustomFilter('Stock', opt('nombre', 'entre'), 'nombre', '3', '9'), { ok: true, filter: { champ: 'Stock', operateur: 'entre', valeur: 3, valeur2: 9 } });
  assert.deepEqual(buildCustomFilter('Ville', opt('texte', 'est_vide'), 'texte', '', ''), { ok: true, filter: { champ: 'Ville', operateur: 'est_vide' } });
});

test('construction : erreurs', () => {
  assert.deepEqual(buildCustomFilter('Ville', opt('texte', 'contient'), 'texte', '  ', ''), { ok: false, error: 'empty' });
  assert.deepEqual(buildCustomFilter('Prix', opt('nombre', 'egal'), 'nombre', 'abc', ''), { ok: false, error: 'number' });
  assert.deepEqual(buildCustomFilter('Date', opt('date', 'egal'), 'date', '31/02/2024', ''), { ok: false, error: 'date' });
  assert.deepEqual(buildCustomFilter('Stock', opt('nombre', 'entre'), 'nombre', '3', ''), { ok: false, error: 'empty' });
});

test('les filtres construits s appliquent aux valeurs', () => {
  const f = (family: 'texte' | 'nombre', id: string, a: string, b = '') => {
    const r = buildCustomFilter('c', opt(family, id), family, a, b);
    assert.ok(r.ok);
    return r.filter;
  };
  assert.ok(matchFilter('Bordeaux', f('texte', 'commence_par', 'b')));
  assert.ok(!matchFilter('Lyon', f('texte', 'commence_par', 'b')));
  assert.ok(matchFilter('Marseille', f('texte', 'finit_par', 'LLE')));
  assert.ok(matchFilter(5, f('nombre', 'entre', '3', '9')));
  assert.ok(!matchFilter(10, f('nombre', 'entre', '3', '9')));
});
