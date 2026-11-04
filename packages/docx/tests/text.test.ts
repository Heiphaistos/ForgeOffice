import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cmToPt, computeListLabels, countWords, createBlankDocument, cssFontStack, effectiveParagraphProps, effectiveRunProps,
  emuToPt, formatNumber, headingLevel, isBulletList, parseLength, plainText, ptToTwips, sanitizeUrl, sectionsOf,
  statistics, styleDisplayName, toFrenchWords, toLetters, toRoman, twipsToPt,
} from '../src/index.ts';
import { para, paragraphs, richDocument, run } from './helpers.ts';

test('texte : plainText, notes, tableaux et suppressions', () => {
  const doc = richDocument();
  const text = plainText(doc);
  assert.ok(text.startsWith('Titre principal\n'));
  assert.ok(text.includes('A2\tB2'));
  assert.ok(!text.includes('Texte de la note'));
  assert.ok(plainText(doc, { includeNotes: true }).includes('Texte de la note'));
  assert.ok(plainText(doc, { cellSeparator: ' | ' }).includes('A2 | B2'));
});

test('texte : statistiques (mots, caracteres, paragraphes, pages)', () => {
  const doc = createBlankDocument();
  doc.body = [para('Bonjour le monde !'), para("L'été — c'est 2026."), para([])];
  const s = statistics(doc);
  assert.equal(s.words, 6);
  assert.equal(s.paragraphs, 2);
  assert.equal(s.characters, 'Bonjour le monde !'.length + "L'été — c'est 2026.".length);
  assert.equal(s.charactersNoSpaces, 'Bonjourlemonde!'.length + "L'été—c'est2026.".length);
  assert.equal(s.pages, 1);
  doc.body.push(para([run('a'), { type: 'break', kind: 'page' }, run('b')]));
  assert.equal(statistics(doc).pages, 2);
  doc.body = Array.from({ length: 200 }, () => para('ligne de texte'));
  assert.ok(statistics(doc).pages >= 4, 'estimation multi-pages');
  assert.equal(countWords('  un   deux\ttrois\n quatre - , cinq'), 5);
  assert.equal(countWords(''), 0);
});

test('texte : formats de numeros (romains, lettres, francais, ordinaux)', () => {
  assert.equal(toRoman(1994), 'MCMXCIV');
  assert.equal(toRoman(4), 'IV');
  assert.equal(toRoman(0), '0');
  assert.equal(toLetters(1), 'a');
  assert.equal(toLetters(27), 'aa');
  assert.equal(toFrenchWords(21), 'vingt et un');
  assert.equal(toFrenchWords(71), 'soixante et onze');
  assert.equal(toFrenchWords(80), 'quatre-vingts');
  assert.equal(toFrenchWords(91), 'quatre-vingt-onze');
  assert.equal(toFrenchWords(200), 'deux cents');
  assert.equal(formatNumber(3, 'upperRoman'), 'III');
  assert.equal(formatNumber(2, 'upperLetter'), 'B');
  assert.equal(formatNumber(5, 'decimalZero'), '05');
  assert.equal(formatNumber(1, 'ordinal'), '1er');
  assert.equal(formatNumber(1, 'ordinalText'), 'premier');
  assert.equal(formatNumber(3, 'decimalEnclosedCircle'), '③');
  assert.equal(formatNumber(3, 'bullet'), '');
});

test('resolution : heritage des styles, numeros de liste, niveaux de titre', () => {
  const doc = richDocument();
  const ps = paragraphs(doc.body);
  const custom = ps[2];
  assert.ok(custom);
  assert.equal(effectiveRunProps(doc, custom, { props: {} }).bold, true);
  assert.equal(effectiveRunProps(doc, custom, { props: { bold: false } }).bold, false);
  assert.equal(effectiveParagraphProps(doc, custom).spacingBefore, 12);
  assert.deepEqual(effectiveParagraphProps(doc, para('x')).lineSpacing, { rule: 'auto', value: 1.08 });
  assert.equal(effectiveRunProps(doc, para('x'), { props: {} }).font, 'Aptos');
  assert.equal(effectiveRunProps(doc, para('x', {}, 'Heading1'), { props: {} }).font, 'Aptos Display');
  const labels = computeListLabels(doc);
  assert.equal(labels.get(ps[3] ?? para('')), '1.');
  assert.equal(labels.get(ps[4] ?? para('')), 'a)');
  assert.equal(labels.get(ps[5] ?? para('')), '•');
  assert.equal(isBulletList(doc, 2), true);
  assert.equal(isBulletList(doc, 1), false);
  const restart = createBlankDocument();
  restart.numbering = richDocument().numbering;
  restart.body = [para('a', { numbering: { numId: 1, level: 0 } }), para('b', { numbering: { numId: 1, level: 0 } }), para('c', { numbering: { numId: 3, level: 0 } })];
  assert.deepEqual([...computeListLabels(restart).values()], ['1.', '2.', '5.']);
  assert.equal(headingLevel(doc, ps[0] ?? para('')), 1);
  assert.equal(headingLevel(doc, para('corps')), 0);
});

test('modele : document vierge, noms de styles francais, polices de repli, sections', () => {
  const doc = createBlankDocument();
  const names = new Map(doc.styles.styles.map((s) => [s.id, styleDisplayName(s)]));
  assert.equal(names.get('Normal'), 'Normal');
  assert.equal(names.get('Heading1'), 'Titre 1');
  assert.equal(names.get('Heading9'), 'Titre 9');
  assert.equal(names.get('Title'), 'Titre');
  assert.equal(names.get('Subtitle'), 'Sous-titre');
  assert.equal(names.get('Quote'), 'Citation');
  assert.equal(styleDisplayName({ id: 'X', name: 'Mon style' }), 'Mon style');
  assert.match(cssFontStack('Aptos'), /^"Aptos", "Calibri"/);
  assert.equal(doc.finalSection.orientation, 'portrait');
  assert.equal(sectionsOf(richDocument()).length, 2);
  assert.equal(sectionsOf(richDocument())[1]?.section.orientation, 'landscape');
});

test('unites et securite des URL', () => {
  assert.equal(twipsToPt(240), 12);
  assert.equal(ptToTwips(12), 240);
  assert.equal(emuToPt(12700), 1);
  assert.equal(cmToPt(2.54), 72);
  assert.equal(parseLength('2.54cm'), 72);
  assert.equal(parseLength('16px'), 12);
  assert.equal(parseLength('1in'), 72);
  assert.equal(parseLength('abc'), undefined);
  assert.equal(sanitizeUrl('javascript:alert(1)'), undefined);
  assert.equal(sanitizeUrl(' JaVaScRiPt:alert(1)'), undefined);
  assert.equal(sanitizeUrl('java\tscript:alert(1)'), undefined);
  assert.equal(sanitizeUrl('vbscript:x'), undefined);
  assert.equal(sanitizeUrl('data:text/html,<script>'), undefined);
  assert.equal(sanitizeUrl('https://ok.example/a'), 'https://ok.example/a');
  assert.equal(sanitizeUrl('mailto:a@b.fr'), 'mailto:a@b.fr');
  assert.equal(sanitizeUrl('#ancre'), '#ancre');
});
