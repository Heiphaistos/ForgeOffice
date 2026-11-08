import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cmToPt, fontForm, fontPatch, paragraphForm, paragraphPatch, ptToCm, withScript } from '../src/app/text-dialog-model.ts';
import type { ParagraphProps, RunProps } from '@forgeoffice/pptx';
import { applyParagraphProps, applyRunProps } from '../src/canvas/text.ts';

test('conversion cm <-> points', () => {
  assert.equal(cmToPt(2.54), 72);
  assert.equal(ptToCm(72), 2.54);
});

test('paragraphe : formulaire depuis les proprietes (suspendu, interligne exact)', () => {
  const f = paragraphForm({ marginLeft: 36, indent: -18, lineSpacing: { type: 'pts', value: 24 }, spaceBefore: { type: 'pts', value: 6 } });
  assert.deepEqual([f.special, f.beforeText, f.specialBy, f.lineMode, f.lineValue, f.spaceBefore], ['hanging', 1.27, 0.64, 'exact', 24, 6]);
  assert.equal(paragraphForm({ lineSpacing: { type: 'pct', value: 150 } }).lineValue, 1.5);
});

test('paragraphe : patch minimal, un espacement en % intact tant qu on n y touche pas', () => {
  const props: ParagraphProps = { spaceBefore: { type: 'pct', value: 20 }, marginLeft: 0 };
  const initial = paragraphForm(props);
  const form = { ...initial, special: 'first' as const, specialBy: 1.27, align: 'ctr' as const };
  const patch = paragraphPatch(form, initial);
  assert.deepEqual(patch, { align: 'ctr', indent: 36 });
  const body = { props: {}, paragraphs: [{ props, runs: [] }] };
  applyParagraphProps(body, { start: { p: 0, o: 0 }, end: { p: 0, o: 0 } }, patch);
  assert.deepEqual(body.paragraphs[0]?.props.spaceBefore, { type: 'pct', value: 20 });
  assert.equal(body.paragraphs[0]?.props.indent, 36);
});

test('paragraphe : suspendu negatif, interligne multiple en %', () => {
  const initial = paragraphForm({});
  const patch = paragraphPatch({ ...initial, special: 'hanging', specialBy: 2.54, lineValue: 1.15 }, initial);
  assert.equal(patch.indent, -72);
  assert.deepEqual(patch.lineSpacing, { type: 'pct', value: 115 });
});

test('police : exposant par defaut 30 %, indice 25 %, retrait en effacant', () => {
  const initial = fontForm({}, 'Aptos');
  const sup = withScript(initial, 'sup');
  assert.equal(fontPatch(sup, initial).baseline, 30);
  assert.equal(fontPatch(withScript(initial, 'sub'), initial).baseline, -25);
  assert.equal(fontPatch({ ...sup, offset: 40 }, sup).baseline, 40);
  const back = fontPatch(initial, sup);
  assert.equal(back.baseline, null);
});

test('police : barre double, petites majuscules, espacement appliques au texte', () => {
  const initial = fontForm({ bold: true, size: 20 }, 'Aptos');
  const form = { ...initial, strike: 'double' as const, caps: 'small' as const, spacing: 2, bold: false, underline: 'wavy', shadow: true };
  const patch = fontPatch(form, initial);
  assert.deepEqual(Object.keys(patch).sort(), ['bold', 'caps', 'effects', 'spacing', 'strike', 'underline']);
  const body = { props: {}, paragraphs: [{ props: {}, runs: [{ type: 'text' as const, text: 'Bonjour', props: { bold: true, size: 20 } }] }] };
  applyRunProps(body, { start: { p: 0, o: 0 }, end: { p: 0, o: 7 } }, patch);
  const run = body.paragraphs[0]?.runs[0];
  const props: RunProps = run?.type === 'text' ? run.props : {};
  assert.equal(props.strike, 'dblStrike');
  assert.equal(props.caps, 'small');
  assert.equal(props.bold, undefined);
  assert.equal(props.underline, 'wavy');
  assert.ok(props.effects?.outerShadow);
});

test('tabulations : taquets tries sans doublon, patch en points, retrait en vidant la liste', async () => {
  const { addTab } = await import('../src/app/text-dialog-model.ts');
  assert.deepEqual(addTab([2.54], 1), [1, 2.54]);
  assert.deepEqual(addTab([1], 1), [1]);
  const initial = paragraphForm({ tabs: [{ position: 72, align: 'l' }] });
  assert.deepEqual(initial.tabs, [2.54]);
  const patch = paragraphPatch({ ...initial, tabs: [2.54, 5.08], defaultTab: 1.27 }, initial);
  assert.deepEqual(patch.tabs, [{ position: 72, align: 'l' }, { position: 144, align: 'l' }]);
  assert.equal(patch.defaultTabSize, 36);
  assert.equal(paragraphPatch({ ...initial, tabs: [] }, initial).tabs, null);
});

test('intervalle CSS des tabulations : premier taquet, sinon intervalle par defaut', async () => {
  const { tabIntervalPt } = await import('../src/canvas/render/tabs.ts');
  assert.equal(tabIntervalPt({}), 72);
  assert.equal(tabIntervalPt({ defaultTabSize: 36 }), 36);
  assert.equal(tabIntervalPt({ tabs: [{ position: 144, align: 'l' }, { position: 100, align: 'l' }], defaultTabSize: 36 }), 100);
});

test('exports partages avec Publication : modeles et textes (ne pas renommer ni supprimer)', async () => {
  const model = await import('../src/app/text-dialog-model.ts');
  for (const name of ['cmToPt', 'ptToCm', 'paragraphForm', 'paragraphPatch', 'fontForm', 'fontPatch', 'withScript', 'previewStyle', 'addTab'] as const) assert.equal(typeof model[name], 'function', name);
  const geom = await import('../src/app/geom-dialog-model.ts');
  for (const name of ['geomForm', 'geomPatch', 'withWidth', 'withHeight', 'normalizeRotation'] as const) assert.equal(typeof geom[name], 'function', name);
  const { S3 } = await import('../src/app/strings-text.ts');
  for (const group of ['font', 'paragraph', 'geom', 'image', 'bullets', 'borders', 'table', 'textMenu'] as const) assert.ok(S3[group], group);
  assert.equal(S3.font.title, 'Police');
  assert.equal(S3.paragraph.title, 'Paragraphe');
});

test('taquets alignes : listes paralleles triees, patch avec les alignements', async () => {
  const { addTabAligned } = await import('../src/app/text-dialog-model.ts');
  const a = addTabAligned([], [], 8, 'r');
  const b = addTabAligned(a.tabs, a.tabAligns, 3, 'dec');
  assert.deepEqual([b.tabs, b.tabAligns], [[3, 8], ['dec', 'r']]);
  assert.deepEqual(addTabAligned(b.tabs, b.tabAligns, 3, 'l').tabAligns, ['dec', 'r']);
  const initial = paragraphForm({});
  const patch = paragraphPatch({ ...initial, tabs: b.tabs, tabAligns: b.tabAligns }, initial);
  assert.deepEqual(patch.tabs?.map((t) => t.align), ['dec', 'r']);
  const again = paragraphForm({ tabs: [{ position: 227, align: 'r' }, { position: 85, align: 'dec' }] });
  assert.deepEqual(again.tabAligns, ['dec', 'r']);
});
