// Menus LibreOffice / OpenOffice : chaque groupe de chaque module est range explicitement dans un menu (jamais par repli).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MODULES } from '@forgeoffice/core';
import { SUITE_SPECS, menuOf, suiteSpec } from '../src/logic/menuMap.ts';

const docs = new URL('../../../docs/conformite/', import.meta.url);

for (const app of Object.keys(SUITE_SPECS)) {
  test(`${app} : tous les groupes du ruban ont un menu explicite`, () => {
    const spec = suiteSpec(app as keyof typeof MODULES)!;
    const data = JSON.parse(readFileSync(new URL(`${app}.json`, docs), 'utf8')) as { commandes: { id: string }[] };
    const groups = new Set(data.commandes.map((c) => c.id.split('.').slice(0, 2).join('.')));
    const explicit = (tab: string, group: string): boolean => spec.menus.some((m) => m.from.includes(`${tab}.${group}`) || m.from.includes(tab));
    const orphan = [...groups].filter((g) => { const [t, gr] = g.split('.'); return !explicit(t!, gr!); });
    assert.deepEqual(orphan, [], `groupes sans menu : ${orphan.join(', ')}`);
    for (const g of groups) { const [t, gr] = g.split('.'); assert.ok(spec.menus.some((m) => m.id === menuOf(spec, t!, gr!))); }
  });
}

test('OpenOffice fusionne Styles et Feuille dans Format', () => {
  const oo = suiteSpec('excel', true)!;
  assert.ok(!oo.menus.some((m) => m.id === 'styles' || m.id === 'sheet'));
  assert.equal(menuOf(oo, 'home', 'styles'), 'format');
  assert.equal(menuOf(oo, 'home', 'cells'), 'format');
  assert.ok(suiteSpec('excel')!.menus.some((m) => m.id === 'styles'), 'la spec de base reste intacte');
});
