import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, parseSettings, serializeSettings } from '../src/model.ts';
import { parseStyles, removeStyle, renameStyle, runPatchOf, saveStyle, sanitizeRun, updateStyle } from '../src/styles.ts';

test('saveStyle : nouveau style, mise à jour du même nom, identifiants uniques, nom vide refusé', () => {
  let s = saveStyle([], 'Légende photo', { size: 9, italic: true, color: { type: 'rgb', value: '336699' } }, { align: 'ctr', spaceAfter: { type: 'pts', value: 4 } });
  assert.equal(s.length, 1);
  assert.equal(s[0]!.id, 'legende-photo');
  s = saveStyle(s, 'Légende photo', { size: 10 }, {});
  assert.equal(s.length, 1);
  assert.equal(s[0]!.run.size, 10);
  s = saveStyle(s, 'Légende  photo!', {}, {});
  assert.equal(s.length, 2);
  assert.notEqual(s[0]!.id, s[1]!.id);
  assert.equal(saveStyle(s, '   ', {}, {}).length, 2);
});

test('renameStyle / updateStyle / removeStyle', () => {
  let s = saveStyle(saveStyle([], 'A', { bold: true }, {}), 'B', {}, {});
  s = renameStyle(s, 'a', 'B');
  assert.equal(s[0]!.name, 'A');
  s = renameStyle(s, 'a', 'Titre');
  assert.equal(s[0]!.name, 'Titre');
  s = updateStyle(s, 'a', { size: 20 }, { align: 'r' });
  assert.deepEqual(s[0]!.run, { size: 20 });
  assert.deepEqual(removeStyle(s, 'a').map((x) => x.name), ['B']);
});

test('runPatchOf remet à zéro gras, italique, majuscules, espacement absents du style', () => {
  const p = runPatchOf(saveStyle([], 'X', { size: 12 }, {})[0]!);
  assert.deepEqual([p.bold, p.italic, p.caps, p.spacing, p.size], [null, null, null, null, 12]);
});

test('lecture défensive : publication.json hostile', () => {
  const hostile = parseStyles([
    { name: 'ok', run: { size: 1e9, bold: 'oui', color: { type: 'rgb', value: 'zzzzzz' }, font: 'Georgia', evil: 1 }, para: { align: 'xx', marginLeft: -5 } },
    { name: '' }, { name: 'ok' }, null, 42,
    ...Array.from({ length: 300 }, (_, i) => ({ name: `s${i}` })),
  ]);
  assert.equal(hostile.length, 96); // 100 entrées lues au plus, dont 4 invalides ou en double
  assert.deepEqual(hostile[0]!.run, { size: 4000, font: 'Georgia' });
  assert.deepEqual(hostile[0]!.para, { marginLeft: 0 });
  assert.deepEqual(sanitizeRun({ color: { type: 'scheme', value: 'accent2' } }), { color: { type: 'scheme', value: 'accent2' } });
  assert.deepEqual(parseSettings('{"styles": "pas une liste"}').styles, []);
});

test('les styles survivent à l aller-retour de publication.json', () => {
  const settings = defaultSettings('blank', { styles: saveStyle([], 'Chapeau', { size: 14, bold: true }, { align: 'just' }) });
  assert.deepEqual(parseSettings(serializeSettings(settings)).styles, settings.styles);
});

test('styles basés sur : héritage multi-niveaux, boucle et style inconnu refusés', async () => {
  const { chainOf, resolveStyle, setBasedOn } = await import('../src/styles.ts');
  let s = saveStyle(saveStyle(saveStyle([], 'Base', { size: 11, bold: true }, { align: 'just' }), 'Chapeau', { size: 14 }, {}), 'Chapeau rouge', { color: { type: 'rgb', value: 'FF0000' } }, {});
  s = setBasedOn(s, 'chapeau', 'base');
  s = setBasedOn(s, 'chapeau-rouge', 'chapeau');
  const red = resolveStyle(s, s[2]!);
  assert.deepEqual(red.run, { size: 14, bold: true, color: { type: 'rgb', value: 'FF0000' } });
  assert.deepEqual(red.para, { align: 'just' });
  assert.equal(setBasedOn(s, 'base', 'chapeau-rouge').find((x) => x.id === 'base')?.basedOn, undefined);
  assert.deepEqual(setBasedOn(s, 'base', 'base'), s);
  assert.deepEqual(setBasedOn(s, 'base', 'inconnu'), s);
  assert.equal(setBasedOn(s, 'chapeau', null).find((x) => x.id === 'chapeau')?.basedOn, undefined);
  assert.equal(chainOf(s, s[2]!).chain.map((x) => x.id).join('>'), 'base>chapeau>chapeau-rouge');
  const hostile = parseStyles([{ name: 'A', basedOn: 'b' }, { name: 'B', basedOn: 'a' }, { name: 'C', basedOn: 'zzz' }, { name: 'D', basedOn: 'd' }]);
  assert.ok(hostile.every((x) => x.basedOn === undefined));
});

test('mergeStyles : import d un autre fichier, même nom remplacé, liens de base conservés', async () => {
  const { mergeStyles, setBasedOn } = await import('../src/styles.ts');
  const mine = saveStyle(saveStyle([], 'Titre', { size: 30 }, {}), 'Légende', { size: 8 }, {});
  let other = saveStyle(saveStyle([], 'Titre', { size: 40 }, {}), 'Sous-titre', { size: 20 }, {});
  other = setBasedOn(other, 'sous-titre', 'titre');
  const merged = mergeStyles(mine, other);
  assert.deepEqual(merged.map((x) => x.name), ['Titre', 'Légende', 'Sous-titre']);
  assert.equal(merged[0]!.run.size, 40);
  assert.equal(merged[2]!.basedOn, merged[0]!.id);
  assert.deepEqual(mine[0]!.run, { size: 30 });
});
