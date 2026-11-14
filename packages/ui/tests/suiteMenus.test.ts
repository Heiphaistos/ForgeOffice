// Menus LibreOffice et OpenOffice : chaque menu et sous-menu de la donnee generee reproduit la vraie fenetre (releve UI Automation versionne dans scripts/lo-extract/menus).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LIBREOFFICE_DATA } from '../src/logic/suite/libreoffice.generated.ts';
import { OPENOFFICE_DATA } from '../src/logic/suite/openoffice.generated.ts';
import type { SuiteItem } from '../src/logic/suite/types.ts';

interface Real { t: string; name?: string; k?: string; items?: Real[] }

const dir = new URL('../../../scripts/lo-extract/menus/', import.meta.url);
const MODULES = { word: 'writer', excel: 'calc', powerpoint: 'impress', publisher: 'draw' } as const;
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Ecarts (chemin + nature) entre la liste reelle et la donnee generee ; liste vide = identique. */
function diff(real: readonly Real[], mine: readonly SuiteItem[], path: string): string[] {
  const out: string[] = [];
  const label = (i: SuiteItem): string => (i.sep ? '-' : i.u === 'WindowList' ? '%WINDOW%' : norm(i.l ?? ''));
  const rl = real.map((r) => (r.t === '-' ? '-' : /^Sans nom \d+/.test(r.name ?? '') && path.startsWith('Fenêtre') ? '%WINDOW%' : norm(r.name ?? '')));
  const ml = mine.map(label);
  if (rl.join('|') !== ml.join('|')) { out.push(`${path} : réel [${rl.join(' | ')}] / nôtre [${ml.join(' | ')}]`); return out; }
  real.forEach((r, n) => {
    const m = mine[n]!;
    if (r.t === '-') return;
    if ((r.t === 's') !== Boolean(m.i)) out.push(`${path} > ${r.name} : sous-menu ${r.t === 's' ? 'manquant' : 'en trop'}`);
    else if (r.t === 's') out.push(...diff(r.items ?? [], m.i ?? [], `${path} > ${r.name}`));
    if ((r.k ?? '') !== (m.k ?? '') && r.name && m.u !== 'WindowList') out.push(`${path} > ${r.name} : lettre d'accès « ${r.k ?? ''} » / « ${m.k ?? ''} »`);
  });
  return out;
}

const SUITES = { lo: ['LibreOffice', LIBREOFFICE_DATA], oo: ['OpenOffice', OPENOFFICE_DATA] } as const;

for (const [prefix, [name, DATA]] of Object.entries(SUITES)) {
  for (const [app, mod] of Object.entries(MODULES)) {
    const file = new URL(`${prefix}_${mod}.json`, dir);
    test(`${name} ${mod} : menus identiques à la vraie fenêtre`, () => {
      const real = (JSON.parse(readFileSync(file, 'utf8')) as { menus: { name: string; items: Real[] }[] }).menus;
      const data = DATA[app as 'word' | 'excel' | 'powerpoint' | 'publisher'].menu;
      assert.deepEqual(data.map((m) => m.l), real.map((m) => m.name), 'menus de premier niveau');
      const errors = real.flatMap((r, n) => diff(r.items, data[n]!.i ?? [], r.name));
      assert.deepEqual(errors, []);
    });
  }
}
