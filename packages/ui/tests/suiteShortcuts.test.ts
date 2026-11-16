// Raccourcis des menus LibreOffice / OpenOffice : ceux LUS sur la vraie fenetre (photos des popups + OCR, relues a l'oeil ; scripts/lo-extract/menus/sc_*.json) sont dans la donnee generee.
// "" = la vraie ligne n'affiche AUCUN raccourci. Regle de la source (registre main.xcd) : touches de la section du module puis de Global, jamais celles d'un autre module ni d'un autre clavier.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LIBREOFFICE_DATA } from '../src/logic/suite/libreoffice.generated.ts';
import { OPENOFFICE_DATA } from '../src/logic/suite/openoffice.generated.ts';
import type { SuiteItem } from '../src/logic/suite/types.ts';

const dir = new URL('../../../scripts/lo-extract/menus/', import.meta.url);
const MODULES = { word: 'writer', excel: 'calc', powerpoint: 'impress', publisher: 'draw' } as const;
const norm = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\.\.\.|…/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

function find(menu: readonly SuiteItem[], path: string): SuiteItem | undefined {
  let nodes: readonly SuiteItem[] = menu;
  let node: SuiteItem | undefined;
  for (const part of path.split('>')) {
    node = nodes.find((x) => !x.sep && norm(x.l ?? '') === norm(part));
    if (!node) return undefined;
    nodes = node.i ?? [];
  }
  return node;
}

for (const [prefix, DATA] of [['lo', LIBREOFFICE_DATA], ['oo', OPENOFFICE_DATA]] as const) {
  for (const [app, mod] of Object.entries(MODULES)) {
    let verified: Record<string, string> = {};
    try { verified = JSON.parse(readFileSync(new URL(`sc_${prefix}_${mod}.json`, dir), 'utf8')) as Record<string, string>; } catch { continue; }
    test(`${prefix} ${mod} : raccourcis identiques à la vraie fenêtre`, () => {
      const menu = DATA[app as keyof typeof MODULES].menu;
      const errors = Object.entries(verified).flatMap(([path, sc]) => {
        const it = find(menu, path);
        if (!it) return [`${path} : entrée absente`];
        return (it.s ?? '') === sc ? [] : [`${path} : réel « ${sc} » / nôtre « ${it.s ?? ''} »`];
      });
      assert.deepEqual(errors, []);
    });
  }
}

test('un raccourci ne vient que des touches du module ou de Global : pas de Ctrl+D (soulignage double Writer) dans Impress / Draw / Calc', () => {
  for (const app of ['excel', 'powerpoint', 'publisher'] as const) {
    const all: string[] = [];
    const walk = (items: readonly SuiteItem[]): void => { for (const i of items) { if (i.u === 'UnderlineDouble' && i.s) all.push(i.s); if (i.i) walk(i.i); } };
    walk(LIBREOFFICE_DATA[app].menu);
    assert.deepEqual(all, [], app);
  }
});
