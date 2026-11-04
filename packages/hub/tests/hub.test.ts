import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moduleForFile, type RecentFile } from '@forgeoffice/core';
import { checkDropped, formatBytes, greeting, MAX_OPEN_BYTES, openFilters, parentFolder, pinKey, togglePin, visibleRecents } from '../src/logic.ts';
import { TEMPLATES, templateFile } from '../src/templates.ts';

const fold = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

test('salutation selon l heure', () => {
  assert.equal(greeting(9), 'Bonjour');
  assert.equal(greeting(17), 'Bonjour');
  assert.equal(greeting(19), 'Bonsoir');
  assert.equal(greeting(2), 'Bonsoir');
});

test('epingles : bascule et cle', () => {
  const k = pinKey({ app: 'word', path: 'C:\\a.docx' });
  assert.equal(k, 'word|C:\\a.docx');
  assert.deepEqual(togglePin([], k), [k]);
  assert.deepEqual(togglePin([k, 'x'], k), ['x']);
});

test('recents : filtre sans accents, epingles en tete, puis plus recents', () => {
  const list: RecentFile[] = [
    { app: 'word', name: 'Rapport.docx', path: '/d/Rapport.docx', openedAt: 3 },
    { app: 'excel', name: 'Budget été.xlsx', path: '/d/Budget été.xlsx', openedAt: 2 },
    { app: 'pdf', name: 'Facture.pdf', path: '/d/Facture.pdf', openedAt: 1 },
  ];
  const pins = [pinKey(list[2]!)];
  assert.deepEqual(visibleRecents(list, pins, '', false, fold).map((r) => r.name), ['Facture.pdf', 'Rapport.docx', 'Budget été.xlsx']);
  assert.deepEqual(visibleRecents(list, pins, 'ETE', false, fold).map((r) => r.name), ['Budget été.xlsx']);
  assert.deepEqual(visibleRecents(list, pins, '', true, fold).map((r) => r.name), ['Facture.pdf']);
});

test('dossier parent', () => {
  assert.equal(parentFolder('C:\\Docs\\a.docx'), 'C:\\Docs');
  assert.equal(parentFolder('/home/u/a.txt'), '/home/u');
  assert.equal(parentFolder('a.txt'), null);
});

test('fichiers deposes : format et taille', () => {
  assert.deepEqual(checkDropped('note.md', 10), { app: 'notes' });
  assert.deepEqual(checkDropped('Classeur.XLSX', 10), { app: 'excel' });
  assert.ok('error' in checkDropped('virus.exe', 10));
  assert.ok('error' in checkDropped('gros.pdf', MAX_OPEN_BYTES + 1));
  assert.equal(formatBytes(MAX_OPEN_BYTES), '512 Mo');
});

test('filtres Ouvrir : tous les formats en premier', () => {
  const f = openFilters();
  assert.ok(f[0]!.extensions.includes('docx') && f[0]!.extensions.includes('pdf') && f[0]!.extensions.includes('md'));
  assert.ok(f.every((x) => x.extensions.length > 0));
});

test('modeles : fichiers ouverts par la bonne application', () => {
  for (const t of TEMPLATES) {
    const file = templateFile(t);
    assert.equal(moduleForFile(file.name), t.app, t.id);
    assert.ok(file.bytes.length > 20, t.id);
  }
  const csv = new TextDecoder('utf-8', { ignoreBOM: true }).decode(templateFile(TEMPLATES.find((t) => t.id === 'budget')!).bytes);
  assert.ok(csv.startsWith('\uFEFFPoste,'));
});

test('recents regroupes par date : ordre chronologique meme avec epingles', () => {
  const list: RecentFile[] = [
    { app: 'word', name: 'a.docx', path: 'a.docx', openedAt: 3 },
    { app: 'word', name: 'b.docx', path: 'b.docx', openedAt: 1 },
  ];
  assert.deepEqual(visibleRecents(list, ['word|b.docx'], '', false, fold, false).map((r) => r.name), ['a.docx', 'b.docx']);
});
