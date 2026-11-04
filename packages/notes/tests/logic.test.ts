import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCODINGS, EOLS, applyEol, canEncode, decodeFile, detectEol, encodeFile, looksBinary } from '../src/logic/encoding.ts';
import { changeCase, dateTimeStamp, dedupeLines, joinLines, reverseLines, sortLines, spacesToTabs, tabsToSpaces, trimTrailing } from '../src/logic/lines.ts';
import { backlinks, findWikiLinks, isSafeUrl, linkAt, linkifyWikiHtml, noteKey } from '../src/logic/links.ts';
import { outline } from '../src/logic/outline.ts';
import { textStats } from '../src/logic/stats.ts';
import { diffLines } from '../src/logic/diff.ts';
import { matchShortcut } from '../src/logic/shortcuts.ts';
import { acceptFolderFile, folderRows } from '../src/logic/folder.ts';

test('encodages : detection et aller-retour des octets', () => {
  const text = 'Été : « œuvre » — ligne 2\nfin';
  for (const enc of ENCODINGS) {
    for (const eol of EOLS) {
      const sample = enc === 'windows-1252' ? text.replace('—', '-') : text;
      const bytes = encodeFile(sample, enc, eol);
      const back = decodeFile(bytes);
      assert.equal(back.encoding, enc, `${enc}/${eol}`);
      assert.equal(back.eol, eol, `${enc}/${eol}`);
      assert.equal(back.text, sample);
      assert.deepEqual(encodeFile(back.text, back.encoding, back.eol), bytes);
    }
  }
  // Octets precis : BOM UTF-8, UTF-16 LE, ANSI.
  assert.deepEqual([...encodeFile('a', 'utf-8-bom', 'lf')], [0xef, 0xbb, 0xbf, 0x61]);
  assert.deepEqual([...encodeFile('é\n', 'utf-16le', 'crlf')], [0xff, 0xfe, 0xe9, 0, 13, 0, 10, 0]);
  assert.deepEqual([...encodeFile('é€', 'windows-1252', 'lf')], [0xe9, 0x80]);
  assert.equal(decodeFile(new Uint8Array([0x63, 0x61, 0x66, 0xe9])).encoding, 'windows-1252');
});

test('fins de ligne : detection majoritaire et conversion', () => {
  assert.equal(detectEol('a\r\nb\r\nc\nd'), 'crlf');
  assert.equal(detectEol('a\nb\nc\r\n'), 'lf');
  assert.equal(detectEol('a\rb\rc'), 'cr');
  assert.equal(detectEol('sans fin de ligne'), 'crlf');
  assert.equal(applyEol('a\nb', 'cr'), 'a\rb');
  assert.equal(decodeFile(new TextEncoder().encode('x\r\ny\rz')).text, 'x\ny\nz');
});

test('binaire et caracteres hors Windows-1252', () => {
  assert.equal(looksBinary(new Uint8Array([0x4d, 0x5a, 0, 0]), 'utf-8'), true);
  assert.equal(looksBinary(encodeFile('abc', 'utf-16le', 'lf'), 'utf-16le'), false);
  assert.equal(canEncode('café €', 'windows-1252'), true);
  assert.equal(canEncode('日本', 'windows-1252'), false);
  assert.equal(canEncode('日本', 'utf-8'), true);
});

test('operations sur les lignes', () => {
  assert.deepEqual(sortLines(['b', 'É', 'a', 'ligne 10', 'ligne 2']), ['a', 'b', 'É', 'ligne 2', 'ligne 10']);
  assert.deepEqual(sortLines(['a', 'c', 'b'], true), ['c', 'b', 'a']);
  assert.deepEqual(dedupeLines(['x', 'y', 'x', 'z', 'y']), ['x', 'y', 'z']);
  assert.deepEqual(reverseLines(['1', '2', '3']), ['3', '2', '1']);
  assert.deepEqual(trimTrailing(['a  ', 'b\t', ' c']), ['a', 'b', ' c']);
  assert.deepEqual(joinLines(['un  ', '  deux', '', 'trois']), ['un deux trois']);
  assert.deepEqual(tabsToSpaces(['\tx', 'ab\tc'], 4), ['    x', 'ab  c']);
  assert.deepEqual(spacesToTabs(['        x', '      y', 'a    b'], 4), ['\t\tx', '\t  y', 'a    b']);
});

test('casse et date', () => {
  assert.equal(changeCase('élan vital', 'upper'), 'ÉLAN VITAL');
  assert.equal(changeCase('ÉCOLE', 'lower'), 'école');
  assert.equal(changeCase("l'été du chat-noir", 'title'), "L'été Du Chat-Noir");
  assert.equal(changeCase('BONJOUR. ça va ? oui', 'sentence'), 'Bonjour. Ça va ? Oui');
  assert.equal(changeCase('AbC', 'invert'), 'aBc');
  assert.equal(dateTimeStamp(new Date(2026, 10, 4, 9, 5)), '09:05 04/11/2026');
});

test('liens [[ ]] : extraction, cles, lien sous le curseur', () => {
  const links = findWikiLinks('Voir [[Projet X]], [[Idées#Plan|le plan]] et [[ ]] puis [[a/b.md]]');
  assert.deepEqual(links.map((l) => [l.target, l.heading, l.alias]), [['Projet X', null, null], ['Idées', 'Plan', 'le plan'], ['a/b.md', null, null]]);
  assert.equal(noteKey('Dossier/Projet X.md'), 'projet x');
  assert.equal(noteKey('a/b.md'), 'b');
  const line = 'Lire [[Note A]] ou https://exemple.fr/page. et [doc](https://x.org/d)';
  assert.deepEqual(linkAt(line, 9), { kind: 'note', target: 'Note A', heading: null });
  assert.deepEqual(linkAt(line, 25), { kind: 'url', url: 'https://exemple.fr/page' });
  assert.deepEqual(linkAt(line, 50), { kind: 'url', url: 'https://x.org/d' });
  assert.equal(linkAt(line, 2), null);
  assert.equal(isSafeUrl('javascript:alert(1)'), false);
  assert.equal(isSafeUrl('https://ok.fr'), true);
});

test('retroliens', () => {
  const sources = [
    { id: '1', name: 'Projet.md', text: '# Projet\nlien vers [[Idées]]' },
    { id: '2', name: 'Journal.md', text: 'lundi [[idées|mes idées]]\nmardi rien\nmercredi [[Idées#Plan]]' },
    { id: '3', name: 'Idées.md', text: 'moi-meme [[Idées]]' },
    { id: '4', name: 'Autre.md', text: '[[Idées longues]]' },
  ];
  const found = backlinks('Idées.md', sources, '3');
  assert.deepEqual(found.map((b) => [b.sourceName, b.line]), [['Projet.md', 1], ['Journal.md', 0], ['Journal.md', 2]]);
  assert.deepEqual(backlinks('', sources, null), []);
});

test("apercu : [[note]] devient un lien interne echappe", () => {
  const html = linkifyWikiHtml('<p class="x">Voir [[A &amp; &quot;B&quot;|alias]] et [[C#T]]</p>');
  assert.equal(html, '<p class="x">Voir <a class="nt-wikilink" href="#" data-note="A &#38; &#34;B&#34;">alias</a> et <a class="nt-wikilink" href="#" data-note="C">C › T</a></p>');
});

test('plan du document', () => {
  assert.deepEqual(outline('# A\n```\n# non\n```\n## B\ntexte\n    # code indente', true), [
    { level: 1, title: 'A', line: 0 },
    { level: 2, title: 'B', line: 4 },
  ]);
  const code = outline('fn x() {\n    fn y() {\nexport function z() {\nclass K:', false);
  assert.deepEqual(code.map((o) => [o.level, o.title]), [[1, 'fn x()'], [2, 'fn y()'], [1, 'export function z()'], [1, 'class K']]);
});

test('statistiques', () => {
  const s = textStats("Bonjour l'été.\n\nDeux mots");
  assert.equal(s.lines, 3);
  assert.equal(s.words, 4);
  assert.equal(s.paragraphs, 2);
  assert.equal(s.chars, 25);
  assert.equal(s.utf8Bytes, 27);
  assert.equal(textStats('').lines, 1);
});

test('comparaison de lignes', () => {
  const rows = diffLines(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd', 'e']);
  assert.deepEqual(rows.map((r) => `${r.kind}:${r.text}`), ['same:a', 'del:b', 'add:x', 'same:c', 'same:d', 'add:e']);
  assert.deepEqual(rows.map((r) => [r.left, r.right]), [[1, 1], [2, null], [null, 2], [3, 3], [4, 4], [null, 5]]);
  assert.equal(diffLines([], []).length, 0);
});

test('raccourcis en francais', () => {
  const ev = (key: string, mods: Partial<{ ctrlKey: boolean; altKey: boolean; shiftKey: boolean; code: string }> = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });
  assert.equal(matchShortcut('Ctrl+Maj+P', ev('P', { ctrlKey: true, shiftKey: true })), true);
  assert.equal(matchShortcut('Ctrl+P', ev('P', { ctrlKey: true, shiftKey: true })), false);
  assert.equal(matchShortcut('Alt+↑', ev('ArrowUp', { altKey: true })), true);
  assert.equal(matchShortcut('Maj+F3', ev('F3', { shiftKey: true })), true);
  assert.equal(matchShortcut('Ctrl+/', ev('/', { ctrlKey: true, shiftKey: true })), true);
  assert.equal(matchShortcut('Ctrl++', ev('=', { ctrlKey: true })), true);
  assert.equal(matchShortcut('Ctrl+0', ev('à', { ctrlKey: true, code: 'Digit0' })), true);
  assert.equal(matchShortcut('Ctrl+Entrée', ev('Enter', { ctrlKey: true })), true);
});

test('dossier : filtrage et arborescence', () => {
  const ext = ['md', 'txt'];
  assert.equal(acceptFolderFile('notes/a.md', 10, ext), true);
  assert.equal(acceptFolderFile('node_modules/x.md', 10, ext), false);
  assert.equal(acceptFolderFile('a.exe', 10, ext), false);
  assert.equal(acceptFolderFile('gros.md', 3 * 1024 * 1024, ext), false);
  const rows = folderRows(['z.md', 'b/2.md', 'b/10.md', 'a/x.md'], new Set(['a']));
  assert.deepEqual(rows.map((r) => `${'-'.repeat(r.depth)}${r.name}${r.dir ? '/' : ''}`), ['a/', 'b/', '-2.md', '-10.md', 'z.md']);
});
