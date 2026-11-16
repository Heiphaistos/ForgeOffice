// Largeur des popups LibreOffice / OpenOffice : un popup dont la vraie fenetre est plus large d'une colonne de coche (entrees cochables : Affichage, Barres d'outils,
// En-tete et pied de page...) porte une entree `c` dans la donnee generee ; la feuille de style lui reserve alors la largeur mesuree (LibreOffice 29 px, OpenOffice 23 px).
// La liste scripts/lo-extract/menus/chk_popups.json est celle relevee (ecart de largeur -25..-45 px avant correction).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LIBREOFFICE_DATA } from '../src/logic/suite/libreoffice.generated.ts';
import { OPENOFFICE_DATA } from '../src/logic/suite/openoffice.generated.ts';
import type { SuiteItem } from '../src/logic/suite/types.ts';

const expected = JSON.parse(readFileSync(new URL('../../../scripts/lo-extract/menus/chk_popups.json', import.meta.url), 'utf8')) as Record<string, string[]>;
const css = readFileSync(new URL('../src/components/layouts/suite.css', import.meta.url), 'utf8');

function popupsWithCheck(menu: readonly SuiteItem[]): string[] {
  const out: string[] = [];
  const walk = (items: readonly SuiteItem[], path: string): void => {
    if (items.some((i) => i.c)) out.push(path);
    for (const i of items) if (i.i) walk(i.i, `${path}>${i.l ?? ''}`);
  };
  for (const m of menu) walk(m.i ?? [], m.l ?? '');
  return out;
}

for (const [prefix, DATA] of [['lo', LIBREOFFICE_DATA], ['oo', OPENOFFICE_DATA]] as const) {
  for (const app of ['word', 'excel', 'powerpoint', 'publisher'] as const) {
    test(`${prefix} ${app} : popups à colonne de coche`, () => {
      assert.deepEqual(popupsWithCheck(DATA[app].menu), expected[`${prefix}_${app}`]);
    });
  }
}

test('la feuille de style réserve la colonne de coche (LibreOffice 29 px, OpenOffice 23 px)', () => {
  assert.match(css, /data-layout="libreoffice"\] \.fo-menu\.fo-menu--chk \.fo-menu__item \{ padding-right: 48px; \}/);
  assert.match(css, /data-layout="openoffice"\] \.fo-menu\.fo-menu--chk \.fo-menu__item \{ padding-right: 46px; \}/);
});
