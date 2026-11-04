import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, TextSelection, type Command } from 'prosemirror-state';
import { computeListLabels, createBlankDocument, paragraphText, writeDocx, readDocx, type Paragraph } from '@forgeoffice/docx';
import { createSchema } from '../src/editor/schema.ts';
import { applyStyle, changeCase, indent, setParagraph, setRunProp, transformCase, createTable, insertPageBreak } from '../src/editor/commands.ts';
import { documentStylesheet, ensureStyle, nearestHighlight, paragraphCss, runCss } from '../src/editor/css.ts';
import { documentFromPM, documentToPM, propsFromMarks } from '../src/editor/convert.ts';
import { resolveRevisions, revisionPositions, trackTransaction } from '../src/editor/track.ts';
import { addList, ensureList, isBullet, restartList } from '../src/features/lists.ts';
import { advancedStats, formatMinutes, syllables } from '../src/features/stats.ts';
import { fillBlocks, mergeAll, mergeField, mergeFieldName, parseCsv } from '../src/features/merge.ts';
import { compareBlocks, diff, tokenize } from '../src/features/compare.ts';
import { collectHeadings, tocBlocks } from '../src/features/toc.ts';
import { TEMPLATES, coverPage } from '../src/features/templates.ts';

const schema = createSchema();
const para = (text: string, styleId: string | null = null) => schema.nodes.paragraph!.create({ styleId }, text ? schema.text(text) : null);
const stateOf = (...ps: ReturnType<typeof para>[]) => EditorState.create({ doc: schema.nodes.doc!.create(null, ps) });
const run = (s: EditorState, cmd: Command): EditorState => {
  let next = s;
  assert.ok(cmd(s, (tr) => { next = s.apply(tr); }));
  return next;
};

test('CSS : caracteres, paragraphe, feuille de styles du document', () => {
  assert.equal(runCss({ bold: true, size: 14, color: { rgb: 'C00000' }, underline: 'double' }),
    'font-weight:700;font-size:14pt;color:#C00000;text-decoration-line:underline;text-decoration-style:double');
  assert.equal(runCss({ vertAlign: 'superscript' }), 'vertical-align:super;font-size:65%;line-height:0');
  assert.equal(paragraphCss({ alignment: 'center', spacingAfter: 8, lineSpacing: { rule: 'auto', value: 1.5 } }), 'text-align:center;padding-bottom:8pt;line-height:1.8');
  const css = documentStylesheet(createBlankDocument(), '.doc');
  assert.match(css, /\.doc p\[data-style="Heading1"\]\{[^}]*font-size:20pt/);
  assert.match(css, /--fo-doc-font-minor:"Aptos"/);
  assert.match(css, /\.doc table\[data-tstyle="TableGrid"\] td\{border-top/);
  assert.equal(nearestHighlight('#FFF200'), 'yellow');
  const doc = createBlankDocument();
  doc.styles.styles = doc.styles.styles.filter((s) => s.id !== 'Heading4');
  assert.equal(ensureStyle(doc, 'Heading4'), true);
  assert.equal(ensureStyle(doc, 'Heading4'), false);
});

test('commandes : gras, style, retrait, casse, saut de page', () => {
  let s = stateOf(para('bonjour le monde. voici.'));
  s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 1, 8)));
  s = run(s, setRunProp('bold', true));
  assert.deepEqual(propsFromMarks(s.doc.child(0).child(0).marks).props, { bold: true });
  s = run(s, applyStyle('Heading1', 'paragraph'));
  assert.equal(s.doc.child(0).attrs.styleId, 'Heading1');
  s = run(s, indent(1));
  assert.equal(s.doc.child(0).attrs.props.indentLeft, 35.4);
  s = run(s, indent(-1));
  assert.equal(s.doc.child(0).attrs.props.indentLeft, undefined);
  s = run(s, setParagraph({ props: { alignment: 'center' } }));
  assert.equal(s.doc.child(0).attrs.props.alignment, 'center');
  s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 1, s.doc.child(0).nodeSize - 1)));
  s = run(s, changeCase('sentence'));
  assert.equal(s.doc.child(0).textContent, 'Bonjour le monde. Voici.');
  assert.equal(transformCase('le petit-déjeuner', 'title'), 'Le Petit-Déjeuner');
  assert.equal(transformCase('AbC', 'toggle'), 'aBc');
  s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 8)));
  s = run(s, insertPageBreak);
  assert.equal(s.doc.childCount, 2);
  assert.equal(s.doc.child(0).lastChild?.attrs.data.kind, 'page');
  const t = createTable(schema, 2, 3);
  assert.equal(t.childCount, 2);
  assert.equal(t.child(0).childCount, 3);
});

test('listes : creation, reutilisation, redemarrage, numeros calcules', () => {
  const doc = createBlankDocument();
  const a = addList(doc, { kind: 'number', format: 'decimal', text: '%1.' });
  assert.equal(a.numId, 1);
  assert.equal(ensureList(a.doc, { kind: 'number', format: 'decimal', text: '%1.' }).numId, 1);
  const b = ensureList(a.doc, { kind: 'bullet', char: '●' });
  assert.equal(b.numId, 2);
  assert.ok(isBullet(b.doc, 2));
  const ps: Paragraph[] = [1, 2, 3].map(() => ({ type: 'paragraph', props: { numbering: { numId: 1, level: 0 } }, inlines: [] }));
  ps[1]!.props = { numbering: { numId: 1, level: 1 } };
  const labels = computeListLabels(b.doc, ps);
  assert.deepEqual(ps.map((p) => labels.get(p)), ['1.', 'a.', '2.']);
  const r = restartList(b.doc, 1, 5);
  const p2: Paragraph[] = [{ type: 'paragraph', props: { numbering: { numId: r.numId, level: 0 } }, inlines: [] }];
  assert.equal(computeListLabels(r.doc, p2).get(p2[0]!), '5.');
});

test('statistiques avancees', () => {
  const s = advancedStats('Le chat dort. Le chien aboie fort !\nUn autre paragraphe ici.');
  assert.equal(s.words, 11);
  assert.equal(s.sentences, 3);
  assert.equal(s.paragraphs, 2);
  assert.ok(s.readability > 50);
  assert.equal(s.topWords[0]![1], 1);
  assert.equal(syllables('maison'), 2);
  assert.equal(syllables('table'), 1);
  assert.equal(formatMinutes(0.5), '30 s');
  assert.equal(formatMinutes(3.5), '3 min 30 s');
});

test('publipostage : CSV, champs, fusion', () => {
  const csv = parseCsv('﻿Nom;Ville\n"Dupont; Jean";Paris\nMartin;"Lyon ""centre"""\n\n');
  assert.deepEqual(csv.headers, ['Nom', 'Ville']);
  assert.deepEqual(csv.rows, [['Dupont; Jean', 'Paris'], ['Martin', 'Lyon "centre"']]);
  assert.deepEqual(parseCsv('a,b\r\n1,2').rows, [['1', '2']]);
  const f = mergeField('Nom');
  assert.equal(mergeFieldName(f.instruction), 'Nom');
  const blocks: Paragraph[] = [{ type: 'paragraph', props: {}, inlines: [{ type: 'text', text: 'Bonjour ', props: {} }, f, mergeField('ville')] }];
  assert.equal(paragraphText(fillBlocks(blocks, csv, csv.rows[1]!)[0] as Paragraph), 'Bonjour MartinLyon "centre"');
  const all = mergeAll(blocks, csv);
  assert.equal(all.length, 2);
  assert.equal((all[1] as Paragraph).props.pageBreakBefore, true);
});

test('comparer : diff de mots et document avec revisions', () => {
  const ops = diff(tokenize('le chat noir'), tokenize('le gros chat'));
  assert.deepEqual(ops.map((o) => [o.kind, o.items.join('')]), [['equal', 'le '], ['insert', 'gros '], ['equal', 'chat'], ['delete', ' noir']]);
  const p = (text: string): Paragraph => ({ type: 'paragraph', props: {}, inlines: [{ type: 'text', text, props: {} }] });
  const out = compareBlocks([p('Un'), p('le chat noir'), p('Fin')], [p('Un'), p('le gros chat'), p('Ajout'), p('Fin')], 'Momo', '2026-11-04T00:00:00Z');
  assert.equal(out.length, 4);
  const changed = out[1] as Paragraph;
  assert.deepEqual(changed.inlines.map((i) => (i.type === 'text' ? [i.text, i.revision?.kind ?? ''] : [])), [['le ', ''], ['gros ', 'insert'], ['chat', ''], [' noir', 'delete']]);
  assert.equal((out[2] as Paragraph).markRevision?.kind, 'insert');
});

test('suivi des modifications : frappe, suppression, accepter, refuser', () => {
  let s = stateOf(para('abc def'));
  const o = { author: 'Momo', date: '2026-11-04T00:00:00Z' };
  const typed = trackTransaction(s, s.tr.insertText('X', 4), o)!;
  s = s.apply(typed);
  assert.equal(s.doc.textContent, 'abcX def');
  const del = trackTransaction(s, s.tr.delete(1, 3), o)!;
  s = s.apply(del);
  assert.equal(s.doc.textContent, 'abcX def');
  const revs = revisionPositions(s.doc);
  assert.deepEqual(revs.map((r) => [r.rev.kind, s.doc.textBetween(r.from, r.to)]), [['delete', 'ab'], ['insert', 'X']]);
  // Supprimer son propre ajout le retire vraiment.
  s = s.apply(trackTransaction(s, s.tr.delete(4, 5), o)!);
  assert.equal(s.doc.textContent, 'abc def');
  const accepted = s.apply(resolveRevisions(s, 'accept'));
  assert.equal(accepted.doc.textContent, 'c def');
  const rejected = s.apply(resolveRevisions(s, 'reject'));
  assert.equal(rejected.doc.textContent, 'abc def');
  assert.equal(revisionPositions(rejected.doc).length, 0);
  assert.equal(trackTransaction(s, s.tr.setMeta('x', 1), o), null);
});

test('titres, table des matieres, modeles, page de garde', async () => {
  const meta = createBlankDocument();
  const doc = schema.nodes.doc!.create(null, [para('Intro', 'Heading1'), para('texte'), para('Sous', 'Heading2'), para('Fin', 'Heading1')]);
  const hs = collectHeadings(doc, meta);
  assert.deepEqual(hs.map((h) => [h.level, h.text]), [[1, 'Intro'], [2, 'Sous'], [1, 'Fin']]);
  assert.deepEqual(collectHeadings(doc, meta, 1).map((h) => h.text), ['Intro', 'Fin']);
  const toc = tocBlocks(hs, (pos) => (pos > 10 ? 2 : 1), (_, i) => `_Toc${i}`, 'Table des matières');
  assert.equal(toc.length, 4);
  assert.equal(paragraphText(toc[2] as Paragraph), 'Sous\t2');
  for (const t of TEMPLATES) {
    const d = t.build();
    const pm = documentToPM(schema, d);
    pm.check();
    const bytes = await writeDocx(documentFromPM(pm, d));
    assert.ok((await readDocx(bytes)).document.body.length >= 1, t.id);
  }
  assert.equal(coverPage('T', 'S', 'A').length, 6);
});
