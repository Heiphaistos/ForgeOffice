// Noms de sortie, ordre de la liste, choix des miniatures, fusion nommee (sans DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from '@cantoo/pdf-lib';
import { checkOutputName } from '../src/naming.ts';
import { MAX_THUMB_BYTES, moveById, moveItem, moveNear, thumbKind } from '../src/listing.ts';
import { addFiles, resultName, setOutName, setTarget, type IncomingFile } from '../src/queue.ts';
import { DEFAULT_PARAMS, runPdfTool } from '../src/pdf-batch.ts';

const file = (name: string, n = 5): IncomingFile => ({ name, bytes: new Uint8Array(n).fill(1) });

async function pdf(width: number, pages = 1): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage([width, 100]);
  return d.save();
}

test('nom de sortie : validation', () => {
  assert.deepEqual(checkOutputName('  Rapport final ', 'pdf'), { ok: true, stem: 'Rapport final' });
  assert.deepEqual(checkOutputName('Rapport.PDF', 'pdf'), { ok: true, stem: 'Rapport' }, 'extension du format retiree');
  assert.deepEqual(checkOutputName('v1.2', 'pdf'), { ok: true, stem: 'v1.2' });
  for (const bad of ['a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a|b', 'a\u0001b', '../x']) assert.equal(checkOutputName(bad, 'pdf').ok, false, bad);
  assert.deepEqual(checkOutputName('', 'pdf'), { ok: false, reason: 'empty' });
  assert.deepEqual(checkOutputName('.pdf', 'pdf'), { ok: false, reason: 'empty' });
  assert.deepEqual(checkOutputName('fin.', 'pdf'), { ok: false, reason: 'dot' });
  assert.deepEqual(checkOutputName('.cache', 'pdf'), { ok: false, reason: 'dot' });
  for (const r of ['CON', 'nul', 'Com1', 'lpt9', 'aux.old', 'PRN']) assert.deepEqual(checkOutputName(r, 'txt'), { ok: false, reason: 'reserved' }, r);
  assert.equal(checkOutputName('console', 'txt').ok, true);
  assert.deepEqual(checkOutputName('x'.repeat(121), 'txt'), { ok: false, reason: 'long' });
});

test('nom de sortie personnalise : extension forcee et dedoublonnage', () => {
  const { jobs } = addFiles([], [file('a.docx'), file('b.docx')], false);
  const [a, b] = jobs;
  assert.ok(a && b);
  assert.equal(resultName(jobs, a, 'odt'), 'a.odt', 'automatique par defaut');
  const named = setOutName(setOutName(jobs, a.id, 'Contrat'), b.id, 'Contrat');
  assert.equal(named[0]?.outName, 'Contrat');
  assert.equal(resultName(named, named[0]!, 'odt'), 'Contrat.odt');
  assert.equal(resultName(named, named[1]!, 'pdf'), 'Contrat.pdf', 'extension = format cible');
  const taken = named.map((j, i) => (i === 0 ? { ...j, outputs: [{ name: 'Contrat.odt', bytes: new Uint8Array(1) }] } : j));
  assert.equal(resultName(taken, taken[1]!, 'odt'), 'Contrat (2).odt', 'deux fichiers, meme nom choisi');
  assert.equal(resultName(setOutName(named, a.id, null), a, 'odt'), 'a.odt', 'null = nom automatique');
});

test('changer le nom remet le fichier en attente ; changer le format garde le nom', () => {
  const { jobs } = addFiles([], [file('a.docx')], false);
  const done = jobs.map((j) => ({ ...j, status: 'done' as const, outputs: [{ name: 'a.odt', bytes: new Uint8Array(1) }] }));
  const renamed = setOutName(done, done[0]!.id, 'Neuf');
  assert.equal(renamed[0]?.status, 'waiting');
  assert.equal(renamed[0]?.outputs.length, 0);
  assert.equal(setTarget(renamed, renamed[0]!.id, 'rtf')[0]?.outName, 'Neuf');
});

test('ordre de la liste : deplacements', () => {
  const l = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  const ids = (x: { id: string }[]): string => x.map((i) => i.id).join('');
  assert.equal(ids(moveItem(l, 0, 2)), 'bcad');
  assert.equal(ids(moveItem(l, 3, 0)), 'dabc');
  assert.equal(ids(moveItem(l, 1, 1)), 'abcd');
  assert.equal(ids(moveItem(l, 9, 0)), 'abcd');
  assert.equal(ids(moveById(l, 'c', -1)), 'acbd');
  assert.equal(ids(moveById(l, 'a', -1)), 'abcd', 'deja en tete');
  assert.equal(ids(moveById(l, 'd', 1)), 'abcd', 'deja en queue');
  assert.equal(ids(moveNear(l, 'a', 'c', false)), 'bacd', 'avant c');
  assert.equal(ids(moveNear(l, 'a', 'c', true)), 'bcad', 'apres c');
  assert.equal(ids(moveNear(l, 'd', 'a', false)), 'dabc');
  assert.equal(ids(moveNear(l, 'd', 'b', true)), 'abdc');
  assert.equal(ids(moveNear(l, 'b', 'b', true)), 'abcd');
  assert.equal(ids(l), 'abcd', 'liste d origine intacte');
});

test('miniatures : moteur choisi selon le type, la taille et le chemin', () => {
  assert.equal(thumbKind({ ext: 'png', size: 10, path: null }, false), 'image');
  assert.equal(thumbKind({ ext: 'png', size: 10, path: 'C:\\a.png' }, false), 'image');
  assert.equal(thumbKind({ ext: 'png', size: 10, path: 'C:\\a.png' }, true), 'native');
  assert.equal(thumbKind({ ext: 'png', size: 10, path: null }, true), 'image', 'natif seulement pour un fichier du disque');
  assert.equal(thumbKind({ ext: 'pdf', size: 10, path: 'C:\\a.pdf' }, true), 'pdf');
  assert.equal(thumbKind({ ext: 'docx', size: 10, path: null }, true), null, 'icone du format');
  assert.equal(thumbKind({ ext: 'png', size: MAX_THUMB_BYTES + 1, path: null }, false), null, 'trop gros');
});

test('fusion : ordre de la liste et nom choisi', async () => {
  const a = { name: 'a.pdf', bytes: await pdf(100) };
  const b = { name: 'b.pdf', bytes: await pdf(200, 3) };
  const [named] = await runPdfTool('merge', [a, b], { ...DEFAULT_PARAMS, mergeName: 'Dossier complet' }, null);
  assert.equal(named?.name, 'Dossier complet.pdf');
  const doc = await PDFDocument.load(named!.bytes);
  assert.equal(doc.getPageCount(), 4);
  assert.equal(doc.getPage(0).getWidth(), 100);
  const swapped = (await runPdfTool('merge', [b, a], DEFAULT_PARAMS, null))[0]!;
  assert.equal(swapped.name, 'fusion.pdf', 'nom par defaut');
  assert.equal((await PDFDocument.load(swapped.bytes)).getPage(0).getWidth(), 200, 'l ordre des fichiers fixe l ordre des pages');
  await assert.rejects(runPdfTool('merge', [a, b], { ...DEFAULT_PARAMS, mergeName: 'a/b' }, null));
});
