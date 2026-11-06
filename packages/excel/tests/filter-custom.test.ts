// Filtre personnalise : operateurs de l'interface <-> conditions du modele (jokers).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fromCondition, toCondition, type UiFilterOp } from '../src/logic/filter-custom.ts';

test('operateurs de texte : forme du modele avec jokers', () => {
  assert.deepEqual(toCondition('contains', 'pom'), { operator: 'equal', value: '*pom*' });
  assert.deepEqual(toCondition('notContains', 'pom'), { operator: 'notEqual', value: '*pom*' });
  assert.deepEqual(toCondition('beginsWith', 'po'), { operator: 'equal', value: 'po*' });
  assert.deepEqual(toCondition('endsWith', 'es'), { operator: 'equal', value: '*es' });
  assert.deepEqual(toCondition('notEndsWith', 'es'), { operator: 'notEqual', value: '*es' });
  assert.deepEqual(toCondition('greaterThanOrEqual', '5'), { operator: 'greaterThanOrEqual', value: '5' });
});

test('aller-retour interface -> modele -> interface', () => {
  const ops: UiFilterOp[] = ['equal', 'notEqual', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'contains', 'notContains', 'beginsWith', 'notBeginsWith', 'endsWith', 'notEndsWith'];
  for (const op of ops) assert.deepEqual(fromCondition(toCondition(op, 'abc')), { op, value: 'abc' }, op);
  // Un « * » seul ou une valeur sans joker reste « est egal a ».
  assert.deepEqual(fromCondition({ operator: 'equal', value: 'Pomme' }), { op: 'equal', value: 'Pomme' });
});
