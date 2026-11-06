// Recherche (regex, casse, remplacement), liens surs, pieces jointes, calques, signets editables, lecture a voix haute.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFHexString, PDFName, PDFString, StandardFonts, degrees } from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { attachmentBytes, listAttachments, listLayers, pageLinks, setLayerVisible } from '../src/extras.ts';
import { linkLabel, safeUrl } from '../src/links.ts';
import { replaceIn, search, validPattern } from '../src/find.ts';
import { addBookmark, moveBookmark, removeBookmark, renameBookmark, setBookmarkPage, writeOutline, type Bookmark } from '../src/outlines.ts';
import { compressStructure } from '../src/compress.ts';
import { frenchVoice, speechText } from '../src/speech.ts';
import type { Item, TextBox } from '../src/model.ts';
import { buildContextMenu, type MenuActions, type MenuContext } from '../src/contextMenus.ts';
import { readFields, writeValues } from '../src/forms.ts';

const box = (str: string, x: number, y: number, w = 0.2): TextBox => ({ str, rect: { x, y, w, h: 0.02 }, size: 12 });
const open = (bytes: Uint8Array) => getDocument({ data: bytes.slice(), useWorkerFetch: false, verbosity: 0 });

async function sample(pages = 3): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) doc.addPage([600, 800]).drawText(`Page ${i + 1}`, { x: 60, y: 700, size: 20, font });
  return doc;
}

test('recherche : texte simple sans accents, casse respectee, expression reguliere', () => {
  const pages = [[box('Facture 2026-014 du 05/11/2026', 0, 0, 1)], [box('FACTURE 2026-015 Réglée', 0, 0, 1), box('facture annulée', 0, 0.1, 1)]];
  assert.equal(search(pages, 'facture').length, 3);
  assert.equal(search(pages, 'facture', { matchCase: true }).length, 1);
  assert.equal(search(pages, 'FACTURE', { matchCase: true }).length, 1);
  assert.equal(search(pages, 'reglee').length, 1, 'accents ignores en texte simple');
  assert.equal(search(pages, 'reglee', { matchCase: true }).length, 0, 'accents respectes avec la casse');
  const re = search(pages, String.raw`\d{4}-\d{3}`, { regex: true });
  assert.deepEqual(re.map((h) => [h.page, h.start, h.length]), [[0, 8, 8], [1, 8, 8]]);
  assert.equal(search(pages, String.raw`^facture`, { regex: true }).length, 3, 'ancre + insensible a la casse');
  assert.equal(search(pages, String.raw`^facture`, { regex: true, matchCase: true }).length, 1);
  assert.equal(search(pages, '(', { regex: true }).length, 0, 'motif invalide : aucun resultat');
  assert.equal(validPattern('(', { regex: true }), false);
  assert.equal(validPattern('(', {}), true, 'en texte simple, la parenthese est litterale');
  assert.equal(search([[box('prix (HT) 5', 0, 0, 1)]], '(HT)').length, 1);
  assert.equal(search([[box('aaa', 0, 0, 1)]], 'x*', { regex: true }).length, 0, 'correspondances vides ignorees');
});

test('remplacement dans le texte des annotations', () => {
  assert.equal(replaceIn('Facture 12 et facture 13', 'facture', 'Avoir'), 'Avoir 12 et Avoir 13');
  assert.equal(replaceIn('Facture 12 et facture 13', 'facture', 'Avoir', { matchCase: true }), 'Facture 12 et Avoir 13');
  assert.equal(replaceIn('Réglée le 5', 'reglee', 'Payée'), 'Payée le 5');
  assert.equal(replaceIn('N° 2026-014', String.raw`(\d{4})-(\d+)`, '$2/$1', { regex: true }), 'N° 014/2026');
  assert.equal(replaceIn('a.b', '.', '-'), 'a-b', 'le point est litteral en texte simple');
  assert.equal(replaceIn('abc', '(', 'x', { regex: true }), 'abc');
});

test('liens : seules les adresses sures s ouvrent', () => {
  assert.equal(safeUrl('https://exemple.fr/a?b=1'), 'https://exemple.fr/a?b=1');
  assert.equal(safeUrl('mailto:momo@exemple.fr'), 'mailto:momo@exemple.fr');
  for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,<script>', 'file:///C:/x', 'vbscript:x', '/relatif', '']) assert.equal(safeUrl(bad), null, bad);
  assert.equal(linkLabel('https://exemple.fr:8443/a'), 'exemple.fr:8443');
});

test('liens d une page pivotee : URL externe, page interne, javascript ignore', async () => {
  const doc = await sample(2);
  doc.getPage(0).setRotation(degrees(90));
  const ctx = doc.context;
  const link = (rect: number[], extra: Record<string, unknown>) => ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: rect, Border: [0, 0, 0], ...extra }));
  const refs = [
    link([60, 700, 260, 730], { A: { S: 'URI', URI: PDFString.of('https://exemple.fr/doc') } }),
    link([60, 600, 260, 630], { Dest: [doc.getPage(1).ref, 'Fit'] }),
    link([60, 500, 260, 530], { A: { S: 'URI', URI: PDFString.of('javascript:alert(1)') } }),
    link([60, 400, 260, 430], { A: { S: 'JavaScript', JS: PDFString.of('app.alert(1)') } }),
  ];
  for (const r of refs) doc.getPage(0).node.addAnnot(r);
  const task = open(await doc.save());
  try {
    const pdf = await task.promise;
    const links = await pageLinks(pdf, await pdf.getPage(1));
    assert.equal(links.length, 2);
    assert.equal(links[0]?.url, 'https://exemple.fr/doc');
    assert.equal(links[1]?.page, 1);
    // page tournee de 90 : le rectangle (x 60..260, y 700..730) devient une bande horizontale, pres du haut... du cote droit
    const r = links[0]!.rect;
    assert.ok(Math.abs(r.w - 30 / 800) < 1e-6 && Math.abs(r.h - 200 / 600) < 1e-6, JSON.stringify(r));
  } finally {
    await task.destroy();
  }
});

test('pieces jointes : liste et extraction', async () => {
  const doc = await sample(1);
  await doc.attach(new TextEncoder().encode('Bonjour, pièce jointe'), 'note.txt', { mimeType: 'text/plain', description: 'Une note' });
  const task = open(await doc.save());
  try {
    const pdf = await task.promise;
    const list = await listAttachments(pdf);
    assert.equal(list.length, 1);
    assert.equal(list[0]?.name, 'note.txt');
    assert.equal(list[0]?.description, 'Une note');
    assert.equal(new TextDecoder().decode(await attachmentBytes(pdf, list[0]!.id)), 'Bonjour, pièce jointe');
  } finally {
    await task.destroy();
  }
});

test('calques (OCG) : liste, visibilite initiale, bascule', async () => {
  const doc = await sample(1);
  const ctx = doc.context;
  const a = ctx.register(ctx.obj({ Type: 'OCG', Name: PDFHexString.fromText('Annotations') }));
  const b = ctx.register(ctx.obj({ Type: 'OCG', Name: PDFHexString.fromText('Filigrane') }));
  doc.catalog.set(PDFName.of('OCProperties'), ctx.obj({ OCGs: [a, b], D: { Order: [a, b], OFF: [b] } }));
  const task = open(await doc.save());
  try {
    const pdf = await task.promise;
    const config = await pdf.getOptionalContentConfig();
    const layers = await listLayers(config);
    assert.deepEqual(layers.map((l) => [l.name, l.visible]), [['Annotations', true], ['Filigrane', false]]);
    setLayerVisible(config, layers[1]!.id, true);
    assert.equal((await listLayers(config))[1]?.visible, true);
  } finally {
    await task.destroy();
  }
});

test('signets : ajout, renommage, deplacement, suppression, ecriture relue par pdf.js', async () => {
  let tree: Bookmark[] = [];
  tree = addBookmark(tree, [], 'Introduction', 0);
  tree = addBookmark(tree, [], 'Chapitre 1', 1);
  tree = addBookmark(tree, [1], 'Section 1.1', 2);
  tree = addBookmark(tree, [], 'Annexe', 2);
  tree = renameBookmark(tree, [1], 'Chapitre un');
  const moved = moveBookmark(tree, [2], -1);
  tree = moved.tree;
  assert.deepEqual(moved.path, [1]);
  assert.deepEqual(tree.map((b) => b.title), ['Introduction', 'Annexe', 'Chapitre un']);
  assert.deepEqual(moveBookmark(tree, [0], -1).path, [0], 'deja en haut : inchange');
  const written = await writeOutline(await (await sample()).save(), tree);
  const task = open(written);
  try {
    const pdf = await task.promise;
    const out = (await pdf.getOutline()) ?? [];
    assert.deepEqual(out.map((o) => o.title), ['Introduction', 'Annexe', 'Chapitre un']);
    assert.equal(out[2]?.items[0]?.title, 'Section 1.1');
    const dest = out[2]?.items[0]?.dest as unknown[];
    assert.equal(await pdf.getPageIndex(dest[0] as Parameters<typeof pdf.getPageIndex>[0]), 2);
  } finally {
    await task.destroy();
  }
  // suppression d'un parent avec ses enfants, puis arbre vide : plus de /Outlines
  const pruned = removeBookmark(tree, [2]);
  assert.deepEqual(pruned.map((b) => b.title), ['Introduction', 'Annexe']);
  const empty = await writeOutline(written, []);
  const t2 = open(empty);
  try {
    assert.equal(await (await t2.promise).getOutline(), null);
  } finally {
    await t2.destroy();
  }
});

test('lecture a voix haute : texte dans l ordre pdf.js et voix francaise', () => {
  const items = [{ str: 'Bonjour', hasEOL: false }, { str: 'monde', hasEOL: true }, { str: '', hasEOL: false }, { str: 'Deuxième ligne ', hasEOL: true }, { str: '  ', hasEOL: false }];
  assert.equal(speechText(items), 'Bonjour monde\nDeuxième ligne');
  assert.deepEqual(frenchVoice([{ lang: 'en-US' }, { lang: 'fr-CA' }, { lang: 'fr-FR' }]), { lang: 'fr-CA' });
  assert.equal(frenchVoice([{ lang: 'en-US' }]), null);
});

test('signet : changer la page de destination', () => {
  const tree = setBookmarkPage([{ title: 'A', page: 0, children: [{ title: 'B', page: 1, children: [] }] }], [0, 0], 2);
  assert.equal(tree[0]?.children[0]?.page, 2);
  assert.equal(tree[0]?.page, 0);
});

test('menus contextuels : le bon menu selon ce qui est sous le pointeur', () => {
  const calls: string[] = [];
  const act = new Proxy({ editable: true, pageCount: 3, hasFormValues: true }, { get: (t, k: string) => (k in t ? (t as Record<string, unknown>)[k] : (...a: unknown[]) => calls.push(`${k}:${a.map((x) => (typeof x === 'object' ? 'obj' : String(x))).join(',')}`)) }) as unknown as MenuActions;
  const base: MenuContext = { page: 1, point: { x: 0.2, y: 0.3 }, item: null, field: null, selection: '', selectionRects: [] };
  const labels = (items: { label?: string; kind?: string }[]): string[] => items.filter((i) => i.kind !== 'separator').map((i) => i.label ?? '');
  // fond de page
  const page = buildContextMenu(base, act);
  assert.deepEqual(labels(page).slice(0, 2), ['Ajouter une note ici', 'Ajouter une zone de texte ici']);
  page.find((i) => i.id === 'rr')?.onClick?.();
  page.find((i) => i.id === 'del')?.onClick?.();
  assert.deepEqual(calls, ['rotatePage:1,1', 'deletePage:1']);
  // texte selectionne : copie, trois marqueurs, recherche, voix
  const sel = buildContextMenu({ ...base, selection: 'facture', selectionRects: [{ x: 0, y: 0, w: 0.1, h: 0.02 }] }, act);
  assert.deepEqual(labels(sel), ['Copier', 'Surligner', 'Souligner', 'Barrer', 'Rechercher « facture »', 'Lire la sélection à voix haute']);
  sel.find((i) => i.id === 'underline')?.onClick?.();
  assert.equal(calls.at(-1), 'addMarkup:underline,obj,facture');
  assert.equal(buildContextMenu({ ...base, selection: 'x' }, act).find((i) => i.id === 'highlight')?.disabled, true, 'sans rectangle, pas de surlignage');
  // annotation : texte libre
  const free: Item = { ...base, id: 'f', author: 'a', at: 0, kind: 'freetext', rect: { x: 0, y: 0, w: 0.3, h: 0.05 }, text: 'Bonjour', size: 12, color: '#000000' };
  const fm = buildContextMenu({ ...base, item: free }, act);
  assert.deepEqual(labels(fm), ['Modifier le texte', 'Copier', 'Couleur', 'Taille', 'Supprimer']);
  const color = fm.find((i) => i.id === 'color')?.items?.[1];
  color?.onClick?.();
  assert.equal(calls.at(-1), 'changeItem:obj');
  // lecture seule : tout est grise
  const ro = new Proxy(act, { get: (t, k) => (k === 'editable' ? false : (t as unknown as Record<string, unknown>)[k as string]) }) as MenuActions;
  assert.ok(buildContextMenu({ ...base, item: free }, ro).filter((i) => i.kind !== 'separator' && i.id !== 'copy').every((i) => i.disabled));
  // champ : signature non signee -> Signer ; texte -> Effacer
  const sig = buildContextMenu({ ...base, field: { name: 'S', type: 'signature', signed: false, rect: { x: 0, y: 0, w: 1, h: 1 } } }, act);
  assert.equal(sig[0]?.label, 'Signer ici');
  assert.equal(buildContextMenu({ ...base, field: { name: 'N', type: 'texte', signed: false, rect: { x: 0, y: 0, w: 1, h: 1 } } }, act)[0]?.label, 'Effacer le champ');
});

test('formulaire : effacer un champ (liste, radio) avec une valeur vide', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  const form = doc.getForm();
  const dd = form.createDropdown('Ville');
  dd.addOptions(['Lyon', 'Paris']);
  dd.addToPage(page, { x: 20, y: 200, width: 100, height: 20 });
  const rg = form.createRadioGroup('C');
  rg.addOptionToPage('A', page, { x: 20, y: 150, width: 14, height: 14 });
  dd.select('Paris');
  rg.select('A');
  const d2 = await PDFDocument.load(await doc.save());
  writeValues(d2, { Ville: '', C: '' });
  const back = await readFields(await d2.save());
  assert.deepEqual(back.map((f) => f.value), ['', '']);
});

test('compression de repli : jamais plus gros, document toujours valide', async () => {
  const doc = await sample(12);
  const original = await doc.save({ useObjectStreams: false });
  const r = await compressStructure(original);
  assert.ok(r.after <= r.before && r.bytes.length === r.after);
  assert.equal((await PDFDocument.load(r.bytes)).getPageCount(), 12);
  assert.ok(r.after < r.before, 'les flux d objets reduisent un document de 12 pages');
  const again = await compressStructure(r.bytes);
  assert.ok(again.after <= r.after);
});
