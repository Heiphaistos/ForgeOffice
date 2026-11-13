// Copie LibreOffice / OpenOffice : les alias visent des commandes qui existent, les menus gardent la structure reelle de la suite.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ALIASES } from '../src/logic/suite/aliases.ts';
import { makeBinder } from '../src/logic/suite/bind.ts';
import type { Cmd } from '../src/logic/suite/catalog.ts';
import { LIBREOFFICE_DATA } from '../src/logic/suite/libreoffice.generated.ts';
import { OPENOFFICE_DATA } from '../src/logic/suite/openoffice.generated.ts';
import type { SuiteItem } from '../src/logic/suite/types.ts';

const docs = new URL('../../../docs/conformite/', import.meta.url);
const APPS = ['word', 'excel', 'powerpoint', 'publisher'] as const;
const catalogOf = (app: string): Cmd[] =>
  (JSON.parse(readFileSync(new URL(`${app}.json`, docs), 'utf8')) as { commandes: { id: string; label: string; type: string }[] }).commandes
    .filter((c) => !c.type.endsWith('-option') && !c.type.endsWith('-pick'))
    .map((c) => ({ ref: c.id, label: c.label, run: () => undefined }));

test('chaque alias vise au moins une commande existante dans un module', () => {
  const all = APPS.flatMap(catalogOf);
  const dead: string[] = [];
  for (const [uno, refs] of Object.entries(ALIASES)) {
    for (const p of refs) if (!all.some((c) => c.ref === p || c.ref.endsWith(`.${p}`))) dead.push(`${uno} -> ${p}`);
  }
  assert.deepEqual(dead, [], `alias sans cible : ${dead.join(', ')}`);
});

const leaves = (items: readonly SuiteItem[]): SuiteItem[] => items.flatMap((i) => (i.i ? leaves(i.i) : i.sep || !i.l ? [] : [i]));

for (const [name, data] of [['LibreOffice', LIBREOFFICE_DATA], ['OpenOffice', OPENOFFICE_DATA]] as const) {
  for (const app of APPS) {
    test(`${name} ${app} : menus reels, au moins la moitie des entrees courantes branchees`, () => {
      const d = data[app];
      assert.ok(d.menu.length >= 9, 'menus de la suite');
      assert.equal(d.menu[0]?.l, 'Fichier');
      const bars = [...d.bars, ...(d.foot ? [d.foot] : []), ...(d.side ? [d.side] : [])];
      assert.ok(bars.length >= 2 && bars.every((b) => b.length > 5), "deux barres d'outils");
      const binder = makeBinder(catalogOf(app));
      const all = [...d.menu.flatMap((m) => leaves(m.i ?? [])), ...bars.flatMap((b) => b.filter((x) => x.u && !x.sep))];
      const bound = all.filter((i) => binder.find(i.u ?? '', i.l ?? '')).length;
      console.log(`${name} ${app} : ${bound}/${all.length} commandes branchees`);
      assert.ok(bound > 0);
    });
  }
}
