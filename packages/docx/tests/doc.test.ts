import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectFormat, DocxError, plainText, readDoc, readDocument, type Block, type Table } from '../src/index.ts';
import { buildCfb, buildDoc, sprm, sprm16 } from './doc-builder.ts';
import { findInline, paragraphs, textRun } from './helpers.ts';

const at = (text: string, needle: string): { start: number; end: number } => {
  const start = text.indexOf(needle);
  assert.ok(start >= 0, needle);
  return { start, end: start + needle.length };
};

test('doc : texte, styles de titre, mise en forme des caracteres et des paragraphes', () => {
  const text = 'Titre du rapport\rTexte gras italique Arial rouge 14 souligné barré exposant\rCentré\r';
  const bytes = buildDoc({
    text,
    styles: [{ sti: 0, name: 'Normal' }, { sti: 1, name: 'heading 1' }, { sti: 0x0ffe, name: 'Mon style' }],
    fonts: ['Times New Roman', 'Arial'],
    runs: [
      { ...at(text, 'gras'), sprms: sprm(0x0835, 1) },
      { ...at(text, 'italique'), sprms: sprm(0x0836, 1) },
      { ...at(text, 'Arial'), sprms: sprm16(0x4a4f, 1) },
      { ...at(text, 'rouge'), sprms: sprm(0x2a42, 6) },
      { ...at(text, '14'), sprms: [...sprm16(0x4a43, 28), ...sprm(0x6870, 0x12, 0x34, 0x56, 0)] },
      { ...at(text, 'souligné'), sprms: sprm(0x2a3e, 3) },
      { ...at(text, 'barré'), sprms: sprm(0x0837, 1) },
      { ...at(text, 'exposant'), sprms: sprm(0x2a48, 1) },
    ],
    paras: {
      0: { istd: 1 },
      1: { istd: 2, sprms: [...sprm(0x2461, 3), ...sprm16(0x845e, 720), ...sprm16(0x8460, -360), ...sprm16(0xa413, 240), ...sprm16(0xa414, 120), ...sprm(0x6412, 0x68, 0x01, 1, 0), ...sprm(0x2406, 1)] },
      2: { sprms: sprm(0x2403, 1) },
    },
    summary: { title: 'Rapport 97', author: 'Jean Dupont', created: new Date('2020-05-06T07:08:09Z') },
  });
  assert.equal(detectFormat(bytes, 'ancien.doc'), 'doc');
  const { document: d, warnings } = readDoc(bytes);
  assert.ok(warnings.some((w) => w.code === 'doc-text-only'));
  assert.equal(plainText(d), 'Titre du rapport\nTexte gras italique Arial rouge 14 souligné barré exposant\nCentré');
  const ps = paragraphs(d.body);
  assert.equal(ps.length, 3);
  assert.equal(ps[0]?.styleId, 'Heading1');
  assert.equal(ps[1]?.styleId, 'Monstyle');
  assert.ok(d.styles.styles.some((s) => s.id === 'Monstyle' && s.name === 'Mon style' && s.custom));
  assert.equal(ps[1]?.props.alignment, 'justify');
  assert.equal(ps[1]?.props.indentLeft, 36);
  assert.equal(ps[1]?.props.indentFirstLine, -18);
  assert.equal(ps[1]?.props.spacingBefore, 12);
  assert.equal(ps[1]?.props.spacingAfter, 6);
  assert.deepEqual(ps[1]?.props.lineSpacing, { rule: 'auto', value: 1.5 });
  assert.equal(ps[1]?.props.keepNext, true);
  assert.equal(ps[2]?.props.alignment, 'center');
  assert.equal(textRun(d.body, 'gras')?.props.bold, true);
  assert.equal(textRun(d.body, 'gras')?.text, 'gras');
  assert.equal(textRun(d.body, 'italique')?.props.italic, true);
  assert.equal(textRun(d.body, 'Arial')?.props.font, 'Arial');
  assert.equal(textRun(d.body, 'rouge')?.props.color?.rgb, 'FF0000');
  assert.equal(textRun(d.body, '14')?.props.size, 14);
  assert.equal(textRun(d.body, '14')?.props.color?.rgb, '123456');
  assert.equal(textRun(d.body, 'souligné')?.props.underline, 'double');
  assert.equal(textRun(d.body, 'barré')?.props.strike, true);
  assert.equal(textRun(d.body, 'exposant')?.props.vertAlign, 'superscript');
  assert.deepEqual(textRun(d.body, 'Texte')?.props, {});
  assert.equal(d.properties.title, 'Rapport 97');
  assert.equal(d.properties.creator, 'Jean Dupont');
  assert.equal(d.properties.created, '2020-05-06T07:08:09Z');
});

test('doc : tableaux (cellules, fin de ligne, largeurs TDefTable)', () => {
  const text = 'Avant\rA1\x07B1\x07\x07A2\x07B2\x07\x07Après\r';
  const cellPara = { sprms: sprm(0x2416, 1) };
  // TDefTable : cb, nombre de colonnes, bords en twips.
  const tdef = [0x08, 0xd6, 8, 0, 2, 0, 0, 0xd0, 0x07, 0xa0, 0x0f];
  const rowEnd = { sprms: [...sprm(0x2416, 1), ...sprm(0x2417, 1), ...tdef] };
  const { document: d } = readDoc(buildDoc({ text, paras: { 1: cellPara, 2: cellPara, 3: rowEnd, 4: cellPara, 5: cellPara, 6: rowEnd } }));
  assert.equal(d.body.length, 3);
  const table = d.body[1] as Table;
  assert.equal(table.type, 'table');
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0]?.cells.length, 2);
  assert.deepEqual(table.grid, [100, 100]);
  assert.equal(plainText(d), 'Avant\nA1\tB1\nA2\tB2\nAprès');
});

test('doc : champs (liens surs, javascript: refuse, PAGE), sauts et caracteres speciaux', () => {
  const text = 'Voir \x13 HYPERLINK "https://ok.example" \x14le site\x15 ou \x13 HYPERLINK "javascript:alert(1)" \x14piège\x15, page \x13 PAGE \x141\x15.\rA\tB\x0bC\x0cD\x1eE\x1fF G\r';
  const { document: d, warnings } = readDoc(buildDoc({ text }));
  const links = findInline(d.body, 'hyperlink');
  assert.equal(links.length, 2);
  assert.equal(links[0]?.url, 'https://ok.example');
  assert.equal(links[1]?.url, undefined);
  assert.ok(warnings.some((w) => w.code === 'unsafe-link'));
  const field = findInline(d.body, 'field')[0];
  assert.equal(field?.code, 'PAGE');
  assert.equal(plainText(d), 'Voir le site ou piège, page 1.\nA\tB\nC\fD‑E­F G');
  assert.equal(findInline(d.body, 'break').map((b) => b.kind).join(','), 'line,page');
});

test('doc : notes de bas de page, texte UTF-16 et tables de pieces mixtes', () => {
  const text = 'Texte\x02 avec note. 日本語 €\r';
  const { document: d } = readDoc(buildDoc({ text, unicode: true, footnotes: ['\x02 Contenu de la note\r'], footnoteRefs: [5] }));
  assert.equal(plainText(d), 'Texte avec note. 日本語 €');
  assert.equal(findInline(d.body, 'footnoteRef')[0]?.noteId, 1);
  assert.equal(d.footnotes.length, 1);
  assert.equal(findInline(d.footnotes[0]?.blocks ?? [], 'noteMark')[0]?.kind, 'footnote');
  assert.match(plainText(d, { includeNotes: true }), /Contenu de la note/);
  const mixed = 'Partie compressée € puis 日本 en UTF-16\r';
  const split = readDoc(buildDoc({ text: mixed, splitAt: 19, runs: [{ start: 15, end: 25, sprms: sprm(0x0835, 1) }] }));
  assert.equal(plainText(split.document), 'Partie compressée € puis 日本 en UTF-16');
  assert.equal(textRun(split.document.body, 'puis')?.props.bold, true);
});

test('doc : suivi des modifications, bascules de style et langue', () => {
  const text = 'garde supprimé ajouté anglais\r';
  const { document: d } = readDoc(buildDoc({
    text,
    runs: [
      { ...at(text, 'supprimé'), sprms: sprm(0x0800, 1) },
      { ...at(text, 'ajouté'), sprms: [...sprm(0x0801, 1), ...sprm(0x0835, 0x80)] },
      { ...at(text, 'anglais'), sprms: sprm16(0x486d, 1033) },
    ],
  }));
  assert.equal(textRun(d.body, 'supprimé')?.revision?.kind, 'delete');
  assert.equal(textRun(d.body, 'ajouté')?.revision?.kind, 'insert');
  assert.equal(textRun(d.body, 'ajouté')?.props.bold, undefined, 'bascule « comme le style » ignoree');
  assert.equal(textRun(d.body, 'anglais')?.props.lang, 'en-US');
  assert.ok(!plainText(d).includes('supprimé'));
});

test('doc : Word 6/95 et flux de table manquant -> texte brut avec avertissement', () => {
  const old = readDoc(buildDoc({ text: 'Ancien format\rDeuxième ligne\r', nFib: 0x65 }));
  assert.ok(old.warnings.some((w) => w.code === 'doc-no-pieces'));
  assert.equal(plainText(old.document), 'Ancien format\nDeuxième ligne');
  const noTable = readDoc(buildDoc({ text: 'Sans table\r', noTable: true }));
  assert.ok(noTable.warnings.some((w) => w.code === 'doc-no-pieces'));
  assert.equal(plainText(noTable.document), 'Sans table');
});

test('doc securite : chiffre, pas un CFB, CFB sans WordDocument, limites, fichiers abimes', async () => {
  assert.throws(() => readDoc(buildDoc({ text: 'secret\r', encrypted: true })), (e: unknown) => e instanceof DocxError && /mot de passe/.test(e.message));
  assert.throws(() => readDoc(new TextEncoder().encode('pas un doc du tout')), DocxError);
  assert.throws(() => readDoc(new Uint8Array(600)), DocxError);
  assert.throws(() => readDoc(buildCfb([['Autre', new Uint8Array(100)]])), DocxError);
  assert.throws(() => readDoc(buildCfb([['WordDocument', new Uint8Array(100)]])), DocxError, 'FIB invalide');
  assert.throws(() => readDoc(buildDoc({ text: 'x\r' }), { limits: { maxInputBytes: 100 } }), DocxError);
  const many = readDoc(buildDoc({ text: 'p\r'.repeat(40) }), { limits: { maxBlocks: 5 } });
  assert.ok(many.document.body.length <= 5);
  assert.ok(many.warnings.some((w) => w.code === 'too-many-blocks'));
  const viaDispatch = await readDocument(buildDoc({ text: 'Par aiguillage\r' }), 'x.doc');
  assert.equal(viaDispatch.format, 'doc');
  assert.equal(plainText(viaDispatch.document), 'Par aiguillage');
  // Corruption aleatoire : jamais d'autre exception que DocxError, jamais de boucle infinie.
  const good = buildDoc({ text: 'Texte \x13 PAGE \x141\x15 fin\rA\x07\x07\r', footnotes: ['\x02 n\r'], footnoteRefs: [2], styles: [{ sti: 1, name: 'h' }], fonts: ['Arial'], summary: { title: 't' } });
  let seed = 42;
  const random = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let round = 0; round < 300; round++) {
    const bad = good.slice();
    for (let k = 0; k < 20; k++) bad[Math.floor(random() * bad.length)] = Math.floor(random() * 256);
    const cut = round % 10 === 0 ? bad.subarray(0, Math.floor(random() * bad.length)) : bad;
    try {
      readDoc(cut);
    } catch (error) {
      assert.ok(error instanceof DocxError, `exception inattendue au tour ${round} : ${String(error)}`);
    }
  }
});

// ---- Vrai .doc enregistre par Word 365 (format Word 97-2003), auteurs neutralises ----

const realDoc = (): Uint8Array => new Uint8Array(readFileSync(new URL('./fixtures/word97-rich.doc', import.meta.url)));
const textOf = (blocks: readonly Block[]): string => paragraphs(blocks).map((p) => plainText({ ...readDoc(realDoc()).document, body: [p] })).join('\n');

test('doc reel : images, symboles Symbol / Wingdings, listes, styles herites', () => {
  const { document: d } = readDoc(realDoc());
  assert.equal(d.properties.creator, 'Auteur Test');
  const images = findInline(d.body, 'image');
  assert.equal(images.length, 1);
  const media = d.media[images[0]!.mediaId]!;
  assert.equal(media.contentType, 'image/png');
  assert.deepEqual([...media.bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.ok(images[0]!.width > 20 && images[0]!.width < 80, `largeur ${images[0]!.width}`);
  assert.match(plainText(d), /Alpha en Symbol: α et coche Wingdings: ✓/);
  // Listes : deux instances (puces, numeros) referencees par les paragraphes.
  const numbered = paragraphs(d.body).filter((p) => p.props.numbering);
  assert.equal(numbered.length, 4);
  const formatOf = (numId: number): string | undefined => {
    const instance = d.numbering.instances.find((i) => i.id === numId);
    return d.numbering.abstracts.find((a) => a.id === instance?.abstractId)?.levels[0]?.format;
  };
  assert.deepEqual(numbered.map((p) => formatOf(p.props.numbering!.numId)), ['decimal', 'decimal', 'bullet', 'bullet']);
  const bullet = d.numbering.abstracts.find((a) => a.levels[0]?.format === 'bullet');
  assert.equal(bullet?.levels[0]?.text, '•');
  // Style de titre redefini dans le fichier : Arial 20 gras rouge, niveau 1.
  const h1 = d.styles.styles.find((s) => s.id === 'Heading1')!;
  assert.deepEqual([h1.run?.font, h1.run?.size, h1.run?.bold, h1.run?.color?.rgb, h1.paragraph?.outlineLevel], ['Arial', 20, true, 'FF0000', 0]);
  assert.equal(paragraphs(d.body)[0]?.styleId, 'Heading1');
  assert.equal(d.footnotes.length, 1);
});

test('doc reel : sections, en-tetes et pieds, commentaires', () => {
  const { document: d } = readDoc(realDoc());
  const ended = paragraphs(d.body).filter((p) => p.sectionBreak);
  assert.equal(ended.length, 1);
  assert.equal(ended[0]!.sectionBreak!.orientation, 'portrait');
  assert.equal(ended[0]!.sectionBreak!.titlePage, true);
  assert.equal(d.finalSection.orientation, 'landscape');
  assert.ok(d.finalSection.pageWidth > d.finalSection.pageHeight);
  const first = ended[0]!.sectionBreak!;
  const text = (id: string | undefined): string => textOf(d.headersFooters[id ?? '']?.blocks ?? []);
  assert.equal(text(first.headers.default), 'Entete principal');
  assert.equal(text(first.headers.first), 'Entete premiere page');
  assert.equal(text(first.footers.default), 'Pied de page');
  // Commentaires : auteur, initiales, texte, zone commentee.
  assert.deepEqual(d.comments.map((c) => [c.author, c.initials, textOf(c.blocks)]), [['Alice', 'AL', 'Mon commentaire'], ['Bob', 'BO', 'Ma reponse']]);
  for (const kind of ['commentStart', 'commentEnd', 'commentRef'] as const) assert.equal(findInline(d.body, kind).length, 2, kind);
  // Le tout se reecrit en .docx ouvrable.
  assert.ok(findInline(d.body, 'commentRef').every((r) => d.comments.some((c) => c.id === r.commentId)));
});

test('doc reel : fichier corrompu au hasard (300 tirages) : seule DocxError peut sortir', () => {
  const original = realDoc();
  let seed = 12345;
  const next = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
  for (let i = 0; i < 300; i++) {
    const copy = original.slice();
    for (let k = 0; k < 1 + (next() % 20); k++) copy[next() % copy.length] = next() & 0xff;
    try {
      readDoc(copy);
    } catch (error) {
      assert.ok(error instanceof DocxError, `tirage ${i} : ${String(error)}`);
    }
  }
});
