import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_ENCODINGS } from '../src/logic/charsets.ts';
import { canEncode, decodeFile, encodeFile } from '../src/logic/encoding.ts';
import { DEFAULT_PREFS } from '../src/logic/prefs.ts';
import { Workspace } from '../src/workspace.ts';
import { S } from '../src/strings.ts';
import { fake } from './fake.ts';

const SAMPLES: Record<string, string> = {
  'windows-1250': 'Zażółć gęślą jaźń', 'windows-1251': 'Привет, мир', 'windows-1253': 'Γειά σου Κόσμε', 'windows-1254': 'Işık ğüşöç İstanbul',
  'windows-1255': 'שלום עולם', 'windows-1256': 'مرحبا بالعالم', 'windows-1257': 'Āčēģīķļņšūž', 'windows-1258': 'ăâêôơư đĐ',
  'iso-8859-15': 'Œuvre € Šš', 'koi8-r': 'Привет, мир', shift_jis: 'こんにちは世界ｱｲｳ', gbk: '你好，世界', big5: '你好，世界', 'euc-kr': '안녕하세요 세계',
};

test('19 encodages : liste complete', () => {
  assert.equal(ALL_ENCODINGS.length, 19);
  assert.equal(new Set(ALL_ENCODINGS).size, 19);
  for (const e of ALL_ENCODINGS) assert.ok(S.encodings[e], `nom francais de ${e}`);
});

test('chaque encodage : aller-retour de son alphabet, sans perte signalee', () => {
  for (const e of ALL_ENCODINGS) {
    const text = SAMPLES[e] ?? 'Été à Noël ç ñ';
    if (e === 'windows-1252' || e === 'utf-8' || e === 'utf-8-bom' || e === 'utf-16le' || e === 'utf-16be') assert.ok(canEncode(text, e), e);
    else assert.ok(canEncode(text, e), `${e} sans perte`);
    const bytes = encodeFile(text, e, 'lf');
    assert.equal(decodeFile(bytes, e).text, text, `${e} aller-retour`);
  }
});

test('octets connus : cyrillique, Shift-JIS, Latin-9', () => {
  assert.deepEqual([...encodeFile('Привет', 'windows-1251', 'lf')], [0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);
  assert.deepEqual([...encodeFile('Привет', 'koi8-r', 'lf')], [0xf0, 0xd2, 0xc9, 0xd7, 0xc5, 0xd4]);
  assert.deepEqual([...encodeFile('あ', 'shift_jis', 'lf')], [0x82, 0xa0]);
  assert.deepEqual([...encodeFile('€', 'iso-8859-15', 'lf')], [0xa4]);
});

test('perte : detectee hors alphabet, remplacee par « ? »', () => {
  assert.equal(canEncode('Привет', 'windows-1252'), false);
  assert.equal(canEncode('日本', 'windows-1251'), false);
  assert.equal(canEncode('日本', 'utf-8'), true);
  assert.deepEqual([...encodeFile('a日', 'windows-1251', 'lf')], [0x61, 0x3f]);
});

test('UTF-8 avec BOM force sur des octets sans BOM : aucun caractere perdu', () => {
  assert.equal(decodeFile(new TextEncoder().encode('abcdef'), 'utf-8-bom').text, 'abcdef');
});

test('enregistrement avec perte : annuler, passer en UTF-8, ou forcer', async () => {
  for (const answer of ['cancel', 'utf8', 'force'] as const) {
    const f = fake();
    const ws = new Workspace(f.services, DEFAULT_PREFS);
    const id = ws.add({ name: 'p.txt', text: 'Привет', encoding: 'windows-1252', eol: 'lf', dirty: true });
    let asked = '';
    ws.confirmLossy = (name, enc) => {
      asked = `${name}/${enc}`;
      return Promise.resolve(answer);
    };
    const ok = await ws.save(id, true);
    assert.equal(asked, 'p.txt/windows-1252');
    assert.equal(ok, answer !== 'cancel');
    if (answer === 'cancel') assert.equal(f.disk.size, 0);
    if (answer === 'utf8') {
      assert.equal(ws.tab(id)?.encoding, 'utf-8');
      assert.equal(new TextDecoder().decode(f.disk.get('C:/tmp/p.txt')), 'Привет');
    }
    if (answer === 'force') assert.deepEqual([...f.disk.get('C:/tmp/p.txt')!], [0x3f, 0x3f, 0x3f, 0x3f, 0x3f, 0x3f]);
  }
});

test("recharger avec l'encodage : relit le disque, ou reinterprete le texte modifie", async () => {
  const f = fake();
  f.disk.set('C:/x/ru.txt', Uint8Array.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]));
  const ws = new Workspace(f.services, DEFAULT_PREFS);
  ws.openFile(await f.services.readFile('C:/x/ru.txt'));
  const id = ws.activeId;
  assert.equal(ws.tab(id)?.encoding, 'windows-1252');
  await ws.reloadAs(id, 'windows-1251');
  assert.equal(ws.text(id), 'Привет');
  assert.equal(ws.tab(id)?.encoding, 'windows-1251');
  assert.equal(ws.tab(id)?.dirty, false);
  // Modifie : le texte en memoire est reinterprete, les modifications restent.
  const id2 = ws.add({ name: 'm.txt', text: 'Ïðèâåò', encoding: 'windows-1252', eol: 'lf', dirty: true });
  await ws.reloadAs(id2, 'windows-1251');
  assert.equal(ws.text(id2), 'Привет');
  assert.equal(ws.tab(id2)?.dirty, true);
});
