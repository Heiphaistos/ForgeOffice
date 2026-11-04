import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asAppModule, appFromSearch } from '../src/module-check.ts';

test('asAppModule accepte { info, App } du bon module', () => {
  const App = () => null;
  const mod = { info: { id: 'word' }, App };
  assert.equal(asAppModule(mod, 'word'), mod);
  assert.equal(asAppModule(mod, 'excel'), null);
  assert.equal(asAppModule({}, 'word'), null);
  assert.equal(asAppModule({ info: { id: 'word' } }, 'word'), null);
  assert.equal(asAppModule(null, 'word'), null);
  assert.ok(asAppModule({ info: { id: 'pdf' }, App: { $$typeof: Symbol.for('react.memo') } }, 'pdf'));
});

test('appFromSearch', () => {
  const isApp = (v: string) => ['hub', 'word'].includes(v);
  assert.equal(appFromSearch('?app=word', isApp), 'word');
  assert.equal(appFromSearch('?app=demo', isApp), 'demo');
  assert.equal(appFromSearch('?app=<script>', isApp), 'hub');
  assert.equal(appFromSearch('', isApp), 'hub');
});
