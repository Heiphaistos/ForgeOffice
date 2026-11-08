// Logique sans DOM du Convertisseur : table des formats, planification, file d'attente, pont natif, operations PDF.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import type { NativeBridge } from '@forgeoffice/core';
import {
  categoryOf, commonTargets, defaultTarget, desktopOnlyTargets, extensionOf, formatLabel, nativeSupports, outputName, planEngine, targetsFor,
} from '../src/formats.ts';
import { addFiles, nextWaiting, refreshTargets, resultName, setAllTargets, summarize, formatSize, MAX_FILE_BYTES } from '../src/queue.ts';
import { availability, decodeFrame, encodeFrame, input, outputTarget, runBytes, type Capabilities } from '../src/native.ts';
import {
  chunks, decrypt, encrypt, extract, fillTemplate, insertBlank, load, merge, parsePageRange, readMetadata, removePages, reorder, rotate, stampOrigin, stampPages,
  unlock, watermark, writeMetadata,
} from '../src/pdf-ops.ts';

const bytes = (n: number): Uint8Array => new Uint8Array(n).fill(1);

async function samplePdf(pages: number, label = 'Page'): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) doc.addPage([300 + i, 400]).drawText(`${label} ${i}`, { x: 20, y: 300, size: 18, font });
  return doc.save();
}

test('extension et categorie', () => {
  assert.equal(extensionOf('C:\\Docs\\Rapport.Final.DOCX'), 'docx');
  assert.equal(extensionOf('.bashrc'), '');
  assert.equal(categoryOf('xls'), 'tableur');
  assert.equal(categoryOf('svg'), 'image');
  assert.equal(categoryOf('flac'), 'audio');
});

test('table native = miroir de forge-convert prise_en_charge', () => {
  assert.ok(nativeSupports('docx', 'pdf'));
  assert.ok(nativeSupports('xlsx', 'json'));
  assert.ok(nativeSupports('svg', 'avif'));
  assert.ok(nativeSupports('7z', 'zip'));
  assert.ok(nativeSupports('m4a', 'flac'));
  assert.ok(!nativeSupports('svg', 'gif'));
  assert.ok(!nativeSupports('pptx', 'xlsx'));
  assert.ok(!nativeSupports('wav', 'mp3'));
});

test('planification : la suite TypeScript d abord, le natif pour le reste', () => {
  assert.equal(planEngine('docx', 'odt', true), 'texte', 'paquet Texte plus fidele que le pivot texte natif');
  assert.equal(planEngine('xls', 'xlsx', false), 'tableur');
  assert.equal(planEngine('odp', 'pptx', false), 'presentation');
  assert.equal(planEngine('docx', 'pdf', false), null, 'PDF depuis Word : bureau seulement');
  assert.equal(planEngine('docx', 'pdf', true), 'native');
  assert.equal(planEngine('png', 'webp', false), 'canvas');
  assert.equal(planEngine('png', 'webp', true), 'native', 'images : natif (formats et options)');
  assert.equal(planEngine('png', 'pdf', false), 'images-pdf');
  assert.equal(planEngine('pdf', 'png', true), 'pdf-images', 'rendu des pages par pdf.js partout');
  assert.equal(planEngine('pdf', 'txt', false), 'pdf-texte');
  assert.equal(planEngine('pdf', 'txt', true), 'native');
  assert.equal(planEngine('jpeg', 'jpg', true), null, 'meme format');
  assert.equal(planEngine('json', 'yaml', false), 'donnees', 'YAML/TOML/XML par la suite TypeScript');
});

test('formats proposes et format par defaut', () => {
  assert.deepEqual(targetsFor('docx', false), ['docm', 'dotx', 'dotm', 'odt', 'rtf', 'html', 'md', 'txt', 'xlsx', 'xlsm', 'xltx', 'xltm', 'ods', 'csv', 'tsv', 'pptx', 'pptm', 'ppsx', 'ppsm', 'potx', 'potm', 'odp']);
  assert.ok(targetsFor('docx', true).includes('pdf'));
  assert.ok(targetsFor('docx', true).includes('epub'));
  assert.deepEqual(desktopOnlyTargets('docx'), ['pdf', 'epub']);
  assert.equal(defaultTarget('docx', false), 'odt');
  assert.equal(defaultTarget('docx', true), 'pdf');
  assert.equal(defaultTarget('wav', false), null);
  assert.equal(defaultTarget('wav', true), 'flac');
  assert.ok(commonTargets(['docx', 'png'], false).includes('jpg'));
  assert.ok(commonTargets(['docx', 'png'], false).includes('odt'));
  assert.equal(formatLabel('pdf'), 'PDF (.pdf)');
});

test('noms de sortie dedoublonnes', () => {
  assert.equal(outputName('Rapport.docx', 'pdf', new Set()), 'Rapport.pdf');
  assert.equal(outputName('dossier/Rapport.docx', 'pdf', new Set(['rapport.pdf', 'rapport (2).pdf'])), 'Rapport (3).pdf');
  assert.equal(outputName('.docx', 'pdf', new Set()), '.docx.pdf');
});

test('file d attente : ajout, refus, formats, progression', () => {
  const { jobs, rejected } = addFiles([], [
    { name: 'a.docx', bytes: bytes(10) }, { name: 'b.wav', bytes: bytes(5) }, { name: 'vide.txt', bytes: new Uint8Array(0) },
  ], false);
  assert.equal(jobs.length, 2);
  assert.equal(rejected.length, 1);
  assert.equal(jobs[1]?.status, 'unsupported');
  assert.equal(nextWaiting(jobs)?.name, 'a.docx');
  const native = refreshTargets(jobs, true);
  assert.equal(native[1]?.status, 'waiting');
  assert.equal(native[1]?.target, 'flac');
  const all = setAllTargets(native, 'txt', true);
  assert.equal(all[0]?.target, 'txt');
  assert.equal(all[1]?.target, 'flac', 'audio ne sait pas aller en .txt');
  const s = summarize(all);
  assert.deepEqual([s.total, s.waiting, s.done], [2, 2, 0]);
  assert.equal(resultName([{ ...all[0]!, outputs: [{ name: 'a.txt', bytes: bytes(1) }] }, all[1]!], all[1]!, 'txt'), 'b.txt');
  assert.equal(formatSize(1536), '1,5 Ko');
  assert.ok(MAX_FILE_BYTES >= 512 * 1024 * 1024);
});

test('pont natif : trame aller-retour et marqueurs', async () => {
  const frame = encodeFrame({ a: 'é' }, Uint8Array.from([1, 2]));
  const back = decodeFrame(frame);
  assert.deepEqual(back.header, { a: 'é' });
  assert.deepEqual([...back.bytes], [1, 2]);
  let seen: unknown = null;
  const bridge: NativeBridge = {
    async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
      assert.equal(command, 'convert_run_bytes');
      seen = decodeFrame(args as unknown as Uint8Array).header;
      return encodeFrame({ resultat: { type: 'fichiers', fichiers: ['x.pdf', 'y.pdf'] }, fichiers: [{ nom: 'x.pdf', taille: 2 }, { nom: 'y.pdf', taille: 1 }] }, Uint8Array.from([7, 8, 9])).buffer as T;
    },
  };
  const res = await runBytes(bridge, { op: 'fusionner', entrees: [input(0), input(1)], sortie: outputTarget('x.pdf') }, [
    { name: 'a.pdf', bytes: Uint8Array.from([1]) }, { name: 'b.pdf', bytes: Uint8Array.from([2, 3]) },
  ]);
  assert.deepEqual(seen, {
    operation: { op: 'fusionner', entrees: ['@0', '@1'], sortie: { dossier: '@sortie', nom: 'x.pdf', ecraser: true } },
    entrees: [{ nom: 'a.pdf', taille: 1 }, { nom: 'b.pdf', taille: 2 }],
  });
  assert.deepEqual(res.files.map((f) => [f.name, [...f.bytes]]), [['x.pdf', [7, 8]], ['y.pdf', [9]]]);
  const caps: Capabilities = { version: '0.1.0', outils: {}, operations: [{ operation: 'ocr', disponible: false, outil: 'ocrmypdf', raison: 'Installez ocrmypdf.' }] };
  assert.deepEqual(availability(caps, 'ocr'), { ok: false, reason: 'Installez ocrmypdf.' });
  assert.equal(availability(null, 'ocr').ok, false);
});

test('selection de pages', () => {
  assert.deepEqual(parsePageRange('1-3, 5, 8-', 9), [0, 1, 2, 4, 7, 8]);
  assert.deepEqual(parsePageRange('-2;2', 4), [0, 1]);
  assert.throws(() => parsePageRange('0', 3), /hors limites/);
  assert.throws(() => parsePageRange('a', 3), /invalide/);
  assert.throws(() => parsePageRange(' ', 3), /Aucune/);
  assert.deepEqual(chunks(5, 2), [[0, 1], [2, 3], [4]]);
});

test('pdf-lib : fusion, extraction, ordre, suppression, insertion, rotation', async () => {
  const a = await samplePdf(3, 'A');
  const b = await samplePdf(2, 'B');
  const merged = await PDFDocument.load(await merge([a, b]));
  assert.equal(merged.getPageCount(), 5);
  const ex = await PDFDocument.load(await extract(a, [2, 0]));
  assert.deepEqual(ex.getPages().map((p) => p.getWidth()), [303, 301]);
  const re = await PDFDocument.load(await reorder(a, [2, 0, 1]));
  assert.deepEqual(re.getPages().map((p) => p.getWidth()), [303, 301, 302]);
  await assert.rejects(() => reorder(a, [0, 0, 1]));
  const rm = await PDFDocument.load(await removePages(a, [1]));
  assert.deepEqual(rm.getPages().map((p) => p.getWidth()), [301, 303]);
  await assert.rejects(() => removePages(a, [0, 1, 2]), /au moins une page/);
  const ins = await PDFDocument.load(await insertBlank(a, 1));
  assert.equal(ins.getPageCount(), 4);
  assert.equal(ins.getPage(1).getWidth(), 301);
  const rot = await PDFDocument.load(await rotate(await rotate(a, 90, [0]), 270, [0, 1]));
  assert.deepEqual(rot.getPages().map((p) => p.getRotation().angle), [0, 270, 0]);
});

test('tampons : gabarit, position, numerotation, filigrane, metadonnees', async () => {
  assert.equal(fillTemplate('DOS-{page}/{total}', 7, 120, 4), 'DOS-0007/120');
  assert.deepEqual(stampOrigin('bas_droite', 50, 10, 600, 800, 20), { x: 530, y: 20 });
  assert.deepEqual(stampOrigin('haut_centre', 100, 10, 600, 800, 20), { x: 250, y: 770 });
  const a = await samplePdf(2);
  const numbered = await stampPages(a, { template: 'Page {page} sur {total} – €', position: 'bas_centre', size: 10, start: 1, digits: 0, margin: 20, color: { r: 0, g: 0, b: 0 } });
  assert.ok(numbered.length > a.length);
  const marked = await watermark(a, { text: 'CONFIDENTIEL ✓', size: 50, opacity: 0.2, angle: 45, color: { r: 0.5, g: 0.5, b: 0.5 } });
  assert.equal((await PDFDocument.load(marked)).getPageCount(), 2);
  const meta = await readMetadata(await writeMetadata(a, { title: 'Rapport', author: 'Momo', subject: 'Essai', keywords: 'a, b', creator: 'ForgeOffice', producer: 'ForgeOffice PDF' }));
  assert.equal(meta.title, 'Rapport');
  assert.equal(meta.author, 'Momo');
  assert.equal(meta.pages, 2);
});

test('chiffrement AES-256 sans moteur natif : pdf.js (lecteur independant) exige le mot de passe, dechiffrement et mauvais mot de passe', async () => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const a = await samplePdf(2, 'SECRETXYZ');
  const protectedBytes = await encrypt(a, { user: 'ouvre', owner: 'maitre', print: true, copy: false, edit: false, annot: true, forms: true });
  const raw = Buffer.from(protectedBytes).toString('latin1');
  assert.match(raw, /\/Encrypt/);
  assert.ok(!raw.includes('SECRETXYZ'));
  // Lecteur independant : sans mot de passe il refuse, avec le bon il lit les 2 pages.
  await assert.rejects(() => getDocument({ data: protectedBytes.slice(), verbosity: 0 }).promise, { name: 'PasswordException' });
  await assert.rejects(() => getDocument({ data: protectedBytes.slice(), password: 'faux', verbosity: 0 }).promise, { name: 'PasswordException' });
  const doc = await getDocument({ data: protectedBytes.slice(), password: 'ouvre', verbosity: 0 }).promise;
  assert.equal(doc.numPages, 2);
  assert.match((await (await doc.getPage(1)).getTextContent()).items.map((i) => ('str' in i ? i.str : '')).join(''), /SECRETXYZ/);
  await doc.loadingTask.destroy();
  // Edition : mauvais mot de passe refuse, bon mot de passe dechiffre et le PDF redevient lisible sans mot de passe.
  await assert.rejects(() => load(protectedBytes, 'faux'));
  const clear = await decrypt(protectedBytes, 'ouvre');
  const rawClear = Buffer.from(clear).toString('latin1');
  assert.ok(!rawClear.includes('/Encrypt') && !rawClear.includes('/Standard'));
  assert.equal((await PDFDocument.load(clear)).getPageCount(), 2);
  assert.equal(await (await getDocument({ data: clear.slice(), verbosity: 0 }).promise).numPages, 2);
});

test('unlock : PDF chiffre a mot de passe vide ou connu devient editable, faux mot de passe = null, PDF clair inchange', async () => {
  const a = await samplePdf(3, 'A');
  assert.equal(await unlock(a), a);
  const open = await encrypt(a, { user: '', owner: 'maitre', print: true, copy: false, edit: false, annot: true, forms: true });
  const clearOpen = await unlock(open);
  assert.ok(clearOpen);
  assert.deepEqual((await PDFDocument.load(await reorder(clearOpen, [2, 0, 1]))).getPages().map((p) => p.getWidth()), [303, 301, 302]);
  const locked = await encrypt(a, { user: 'u', owner: 'o', print: true, copy: true, edit: true, annot: true, forms: true });
  assert.equal(await unlock(locked, 'faux'), null);
  assert.equal((await PDFDocument.load((await unlock(locked, 'u')) ?? new Uint8Array())).getPageCount(), 3);
  assert.equal((await PDFDocument.load((await unlock(locked, 'o')) ?? new Uint8Array())).getPageCount(), 3); // mot de passe proprietaire
});
