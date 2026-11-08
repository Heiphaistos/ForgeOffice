import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findRedactZones, ibanValid, luhn, REDACT_PATTERNS } from '../src/redactfind.ts';
import type { TextBox } from '../src/model.ts';

const box = (str: string, y = 0): TextBox => ({ str, rect: { x: 0.1, y, w: 0.8, h: 0.02 }, size: 12 });

test('Luhn et IBAN', () => {
  assert.equal(luhn('4539 1488 0343 6467'), true);
  assert.equal(luhn('4539 1488 0343 6468'), false);
  assert.equal(luhn('1234'), false);
  assert.equal(ibanValid('FR14 2004 1010 0505 0001 3M02 606'), true);
  assert.equal(ibanValid('FR14 2004 1010 0505 0001 3M02 607'), false);
  assert.equal(ibanValid('GB82 WEST 1234 5698 7654 32'), true);
});

test('motifs : seules les vraies données sont trouvées', () => {
  const pages = [[
    box('Contact : jean.dupont@exemple.fr ou 06 12 34 56 78'),
    box('IBAN FR14 2004 1010 0505 0001 3M02 606 et FR14 2004 1010 0505 0001 3M02 607'),
    box('Carte 4539 1488 0343 6467, ref 1234 5678 9012 3456'),
    box('Né le 12/03/1985, sécu 1 85 03 75 123 456 78'),
  ]];
  const by = (p: string): string[] => findRedactZones(pages, '', {}, REDACT_PATTERNS, undefined).filter((z) => z.pattern === p).map((z) => z.text);
  assert.deepEqual(by('email'), ['jean.dupont@exemple.fr']);
  assert.deepEqual(by('phone'), ['06 12 34 56 78']);
  assert.deepEqual(by('iban'), ['FR14 2004 1010 0505 0001 3M02 606']);
  assert.deepEqual(by('card'), ['4539 1488 0343 6467']);
  assert.deepEqual(by('date'), ['12/03/1985']);
  assert.deepEqual(by('ssn'), ['1 85 03 75 123 456 78']);
});

test('recherche libre et rectangle borné à la boîte', () => {
  const pages = [[box('Confidentiel : plan'), box('rien')], [box('CONFIDENTIEL')]];
  const zones = findRedactZones(pages, 'confidentiel', {}, []);
  assert.deepEqual(zones.map((z) => [z.page, z.text, z.pattern]), [[0, 'Confidentiel', null], [1, 'CONFIDENTIEL', null]]);
  const z = zones[0]!;
  assert.ok(z.rect.x >= 0.1 && z.rect.x + z.rect.w <= 0.9 + 1e-9);
  assert.equal(findRedactZones(pages, 'confidentiel', { matchCase: true }, []).length, 0);
  assert.equal(findRedactZones(pages, '', {}, []).length, 0);
});
