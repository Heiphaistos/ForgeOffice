import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  createBlankDocument, decodeText, detectEncoding, detectFormat, documentToHtml, documentToMarkdown, DocxError, DocxPasswordError, encodeText,
  plainText, readDocument, readHtml, readMarkdown, readOdt, readRtf, readText, writeDocument, writeDocx, writeHtml,
  writeMarkdown, writeOdt, writeRtf, writeText, type Table, type WordDocument,
} from '../src/index.ts';
import { findInline, para, paragraphs, richDocument, run, textRun } from './helpers.ts';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const latin = (b: Uint8Array): string => new TextDecoder('latin1').decode(b);

// ------------------------------------------------------------------------------------------------- RTF

test('rtf : aller-retour (texte, mise en forme, listes, tableaux, liens, notes, proprietes)', () => {
  const source = richDocument();
  const bytes = writeRtf(source);
  assert.ok(latin(bytes).startsWith('{\\rtf1'));
  const { document: d, warnings } = readRtf(bytes);
  assert.deepEqual(warnings, []);
  assert.equal(d.properties.title, 'Rapport annuel');
  assert.equal(d.properties.creator, 'Momo');
  assert.equal(paragraphs(d.body)[0]?.styleId, 'Heading1');
  assert.equal(textRun(d.body, 'Gras')?.props.bold, true);
  assert.equal(textRun(d.body, 'italique')?.props.italic, true);
  assert.equal(textRun(d.body, 'souligné')?.props.underline, 'double');
  assert.equal(textRun(d.body, 'barré')?.props.strike, true);
  assert.equal(textRun(d.body, 'Arial14')?.props.font, 'Arial');
  assert.equal(textRun(d.body, 'Arial14')?.props.size, 14);
  assert.equal(textRun(d.body, 'rouge')?.props.color?.rgb, 'FF0000');
  assert.equal(textRun(d.body, 'surligné')?.props.highlight, 'yellow');
  assert.equal(textRun(d.body, 'exposant')?.props.vertAlign, 'superscript');
  const p = paragraphs(d.body)[1]?.props;
  assert.equal(p?.alignment, 'justify');
  assert.equal(p?.indentLeft, 36);
  assert.equal(p?.spacingAfter, 12);
  assert.ok(paragraphs(d.body).some((x) => x.props.numbering?.level === 1), 'liste a deux niveaux');
  assert.equal(findInline(d.body, 'hyperlink')[0]?.url, 'https://forge.example/doc?a=1&b=2');
  assert.equal(findInline(d.body, 'field').find((f) => f.code === 'PAGE')?.code, 'PAGE');
  assert.equal(findInline(d.body, 'footnoteRef').length, 1);
  assert.match(plainText(d, { includeNotes: true }), /Texte de la note/);
  const table = d.body.find((b): b is Table => b.type === 'table');
  assert.equal(table?.rows.length, 2);
  assert.equal(table?.rows[0]?.cells[0]?.props.gridSpan, 2);
  assert.equal(d.finalSection.orientation, 'landscape');
  assert.equal(plainText(d), plainText(source));
});

test('rtf : caracteres speciaux, Unicode et echappements', () => {
  const doc = createBlankDocument();
  doc.body = [para('Accolades {x} \\ barre, été € — 日本 😀')];
  const bytes = writeRtf(doc);
  assert.ok(bytes.every((b) => b < 128), 'RTF ecrit en ASCII 7 bits');
  assert.equal(plainText(readRtf(bytes).document), 'Accolades {x} \\ barre, été € — 日本 😀');
});

test('rtf fixture : fichier ecrit a la main (Word)', () => {
  const rtf = String.raw`{\rtf1\ansi\ansicpg1252\deff0{\fonttbl{\f0\froman Times New Roman;}{\f1\fswiss Arial;}}{\colortbl;\red255\green0\blue0;}{\info{\title Essai RTF}{\author Jean}}
\pard\qc\b\f1\fs32 Titre\b0\par
\pard\ql\fs24 Texte \i italique\i0 , \cf1 rouge\cf0 , \ul souligne\ulnone , caf\'e9 ${String.fromCharCode(92)}u8364?\par
{\field{\*\fldinst HYPERLINK "javascript:alert(1)"}{\fldrslt lien piege}}\par
{\field{\*\fldinst HYPERLINK "https://ok.example"}{\fldrslt bon lien}}\par
\trowd\cellx2000\cellx4000\intbl A\cell B\cell\row
\pard Fin\page Apres\par}`;
  const { document: d, warnings } = readRtf(enc(rtf));
  assert.equal(d.properties.title, 'Essai RTF');
  assert.equal(d.properties.creator, 'Jean');
  const first = paragraphs(d.body)[0];
  assert.equal(first?.props.alignment, 'center');
  assert.equal(textRun(d.body, 'Titre')?.props.bold, true);
  assert.equal(textRun(d.body, 'Titre')?.props.size, 16);
  assert.equal(textRun(d.body, 'Titre')?.props.font, 'Arial');
  assert.equal(textRun(d.body, 'italique')?.props.italic, true);
  assert.equal(textRun(d.body, 'rouge')?.props.color?.rgb, 'FF0000');
  assert.equal(textRun(d.body, 'souligne')?.props.underline, 'single');
  assert.match(plainText(d), /café €/);
  const links = findInline(d.body, 'hyperlink');
  assert.equal(links[0]?.url, undefined, 'javascript: refuse');
  assert.equal(links[1]?.url, 'https://ok.example');
  assert.ok(warnings.some((w) => w.code === 'unsafe-link'));
  const table = d.body.find((b): b is Table => b.type === 'table');
  assert.equal(table?.rows[0]?.cells.length, 2);
  assert.deepEqual(table?.grid, [100, 100]);
  assert.equal(findInline(d.body, 'break').some((b) => b.kind === 'page'), true);
});

test('rtf : suivi des modifications et proprietes de formes ignorees', () => {
  const { document: d } = readRtf(writeRtf(richDocument()));
  assert.equal(textRun(d.body, 'ajouté')?.revision?.kind, 'insert');
  assert.equal(textRun(d.body, 'retiré')?.revision?.kind, 'delete');
  assert.ok(!plainText(d).includes('retiré'));
  const shape = readRtf(enc(String.raw`{\rtf1 Avant {\shp{\*\shpinst{\sp{\sn shapeType}{\sv 75}}{\sp{\sn fFlipH}{\sv 0}}}} Apres\par}`));
  assert.equal(plainText(shape.document), 'Avant  Apres');
});

test('rtf robustesse : groupes desequilibres et texte qui n’est pas du RTF', () => {
  const broken = readRtf(enc('{\\rtf1 {\\b gras non ferme \\par suite'));
  assert.ok(broken.warnings.some((w) => w.code === 'rtf-unbalanced'));
  assert.match(plainText(broken.document), /gras non ferme/);
  const notRtf = readRtf(enc('juste du texte'));
  assert.ok(notRtf.warnings.some((w) => w.code === 'rtf-not-rtf'));
  assert.doesNotThrow(() => readRtf(enc(`{\\rtf1${'{'.repeat(5000)}x${'}'.repeat(5000)}}`)));
  assert.doesNotThrow(() => readRtf(new Uint8Array(0)));
});

// ------------------------------------------------------------------------------------------------- ODT

test('odt : aller-retour (styles, mise en forme, listes, tableaux, notes, liens, images)', async () => {
  const source = richDocument();
  const bytes = await writeOdt(source);
  assert.equal(detectFormat(bytes), 'odt');
  const zip = await JSZip.loadAsync(bytes);
  assert.equal(await zip.file('mimetype')?.async('string'), 'application/vnd.oasis.opendocument.text');
  for (const part of ['content.xml', 'styles.xml', 'meta.xml', 'META-INF/manifest.xml']) assert.ok(zip.file(part), part);
  const { document: d } = await readOdt(bytes);
  assert.equal(d.properties.title, 'Rapport annuel');
  assert.equal(paragraphs(d.body)[0]?.styleId, 'Heading1');
  assert.equal(textRun(d.body, 'Gras')?.props.bold, true);
  assert.equal(textRun(d.body, 'italique')?.props.italic, true);
  assert.equal(textRun(d.body, 'Arial14')?.props.size, 14);
  assert.equal(textRun(d.body, 'rouge')?.props.color?.rgb, 'FF0000');
  assert.equal(paragraphs(d.body)[1]?.props.alignment, 'justify');
  assert.ok(paragraphs(d.body).some((p) => p.props.numbering), 'listes');
  assert.equal(findInline(d.body, 'hyperlink')[0]?.url, 'https://forge.example/doc?a=1&b=2');
  assert.equal(findInline(d.body, 'footnoteRef').length, 1);
  assert.equal(findInline(d.body, 'image').length >= 1, true);
  assert.equal(Object.keys(d.media).length >= 1, true);
  const table = d.body.find((b): b is Table => b.type === 'table');
  assert.equal(table?.rows.length, 2);
  assert.equal(plainText(d), plainText(source));
});

test('odt fixture et securite : contenu ecrit a la main, lien javascript: refuse, fichier abime', async () => {
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('content.xml', `<?xml version="1.0"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
<office:automatic-styles><style:style style:name="T1" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style></office:automatic-styles>
<office:body><office:text><text:h text:outline-level="2">Chapitre</text:h><text:p>Un <text:span text:style-name="T1">gras</text:span><text:s text:c="2"/>fin<text:tab/>x</text:p>
<text:p><text:a xlink:href="javascript:alert(1)">piege</text:a> <text:a xlink:href="https://ok.example">ok</text:a></text:p></office:text></office:body></office:document-content>`);
  const { document: d, warnings } = await readOdt(await zip.generateAsync({ type: 'uint8array' }));
  assert.equal(paragraphs(d.body)[0]?.styleId, 'Heading2');
  assert.equal(textRun(d.body, 'gras')?.props.bold, true);
  assert.match(plainText(d), /gras {2}fin\tx/);
  const links = findInline(d.body, 'hyperlink');
  assert.equal(links[0]?.url, undefined);
  assert.equal(links[1]?.url, 'https://ok.example');
  assert.ok(warnings.some((w) => w.code === 'unsafe-link'));
  await assert.rejects(readOdt(enc('pas un zip')), DocxError);
  const empty = new JSZip();
  empty.file('mimetype', 'application/vnd.oasis.opendocument.text');
  const noContent = await readOdt(await empty.generateAsync({ type: 'uint8array' }));
  assert.ok(noContent.warnings.some((w) => w.code === 'odt-no-content'));
});

// ------------------------------------------------------------------------------------------------- HTML

test('html : export autonome puis import (titres, mise en forme, tableaux, listes, liens, images)', () => {
  const source = richDocument();
  const html = documentToHtml(source);
  assert.match(html, /^<!DOCTYPE html>/i);
  assert.match(html, /<title>Rapport annuel<\/title>/);
  assert.match(html, /<h1[^>]*>Titre principal<\/h1>/);
  assert.match(html, /<table/);
  assert.match(html, /data:image\/png;base64,/);
  assert.ok(!/<script/i.test(html));
  const { document: d } = readHtml(writeHtml(source));
  assert.equal(d.properties.title, 'Rapport annuel');
  assert.equal(paragraphs(d.body)[0]?.styleId, 'Heading1');
  assert.equal(textRun(d.body, 'Gras')?.props.bold, true);
  assert.equal(textRun(d.body, 'italique')?.props.italic, true);
  assert.equal(textRun(d.body, 'rouge')?.props.color?.rgb, 'FF0000');
  assert.equal(findInline(d.body, 'hyperlink')[0]?.url, 'https://forge.example/doc?a=1&b=2');
  assert.ok(findInline(d.body, 'image').length >= 1);
  assert.ok(paragraphs(d.body).some((p) => p.props.numbering));
  assert.ok(d.body.some((b) => b.type === 'table'));
  assert.equal(paragraphs(d.body)[1]?.props.alignment, 'justify');
});

test('html securite : script, evenements, javascript: et iframes elimines', () => {
  const hostile = `<html><head><title>T</title><script>alert(1)</script><style>p{color:red}</style></head><body>
<p onclick="alert(2)">Texte <a href="javascript:alert(3)">piege</a> <a href=" jAvAsCrIpT:alert(4)">piege2</a> <a href="https://ok.example">ok</a></p>
<iframe src="https://mal.example"></iframe><img src="javascript:alert(5)" alt="img"><object data="x"></object>
<p><b>gras</b> <i>it</i> <u>sou</u> <s>bar</s> <sup>2</sup> &amp; &lt;b&gt; &eacute;&#233;&#x20AC;</p>
<ul><li>un</li><li>deux<ol><li>a</li></ol></li></ul><h2>Section</h2><pre>code  brut</pre><blockquote>cite</blockquote></body></html>`;
  const { document: d, warnings } = readHtml(hostile);
  const text = plainText(d);
  assert.ok(!text.includes('alert'), 'aucun script dans le texte');
  const links = findInline(d.body, 'hyperlink');
  assert.ok(links.every((l) => !l.url || !/script/i.test(l.url)));
  assert.equal(links.find((l) => l.url)?.url, 'https://ok.example');
  assert.ok(warnings.some((w) => w.code === 'unsafe-link'));
  assert.ok(!JSON.stringify(d).includes('mal.example'));
  assert.equal(textRun(d.body, 'gras')?.props.bold, true);
  assert.equal(textRun(d.body, 'it')?.props.italic, true);
  assert.equal(textRun(d.body, 'sou')?.props.underline, 'single');
  assert.equal(textRun(d.body, 'bar')?.props.strike, true);
  assert.equal(findInline(d.body, 'text').find((r) => r.text === '2')?.props.vertAlign, 'superscript');
  assert.match(text, /& <b> éé€/);
  assert.equal(paragraphs(d.body).filter((p) => p.props.numbering).length, 3);
  assert.ok(paragraphs(d.body).some((p) => p.styleId === 'Heading2'));
  assert.match(text, /code {2}brut/);
  const exported = documentToHtml(d);
  assert.ok(!/javascript:/i.test(exported) && !/onclick/i.test(exported));
});

test('html robustesse : balises non fermees, imbrication extreme, entree vide', () => {
  assert.match(plainText(readHtml('<p>un<p>deux<div><b>trois').document), /un\ndeux\ntrois/);
  assert.doesNotThrow(() => readHtml(`${'<div>'.repeat(10000)}x`));
  assert.doesNotThrow(() => readHtml(''));
  const escaped = documentToHtml({ ...createBlankDocument(), body: [para('<script>alert(1)</script> & "q"')] });
  assert.ok(escaped.includes('&lt;script&gt;'));
});

// ------------------------------------------------------------------------------------------------- Markdown

test('markdown : import (titres, emphase, listes, liens, code, tableaux, citations)', () => {
  const md = [
    '# Titre', '', 'Texte **gras**, *italique*, ~~barré~~ et `code` avec [lien](https://ok.example "info").', '',
    '- un', '- deux', '  - deux a', '', '1. premier', '2. second', '', '> citation', '', '```js', 'const x = 1;', '```', '',
    '| A | B |', '|---|:-:|', '| 1 | 2 |', '', '---', '', 'Lien [piège](javascript:alert(1)) fin.', '', '![logo](data:text/html,<script>) image',
  ].join('\n');
  const { document: d, warnings } = readMarkdown(md);
  assert.equal(paragraphs(d.body)[0]?.styleId, 'Heading1');
  assert.equal(textRun(d.body, 'gras')?.props.bold, true);
  assert.equal(textRun(d.body, 'italique')?.props.italic, true);
  assert.equal(textRun(d.body, 'barré')?.props.strike, true);
  assert.equal(textRun(d.body, 'code')?.props.font, 'Consolas');
  const links = findInline(d.body, 'hyperlink');
  assert.equal(links[0]?.url, 'https://ok.example');
  assert.ok(links.slice(1).every((l) => !l.url), 'javascript: refuse');
  assert.ok(warnings.some((w) => w.code === 'unsafe-link'));
  assert.equal(paragraphs(d.body).filter((p) => p.props.numbering).length, 5);
  assert.ok(paragraphs(d.body).some((p) => p.props.numbering?.level === 1));
  assert.ok(paragraphs(d.body).some((p) => p.styleId === 'Quote'));
  assert.match(plainText(d), /const x = 1;/);
  const table = d.body.find((b): b is Table => b.type === 'table');
  assert.equal(table?.rows.length, 2);
  assert.equal(findInline(d.body, 'image').length, 0, 'image data: non image refusee');
});

test('markdown : export puis reimport stable', () => {
  const source = richDocument();
  const md = documentToMarkdown(source);
  assert.match(md, /^# Titre principal/m);
  assert.match(md, /\*\*Gras ?\*\*/);
  assert.match(md, /\[lien externe\]\(https:\/\/forge\.example\/doc\?a=1&b=2/);
  assert.match(md, /^1\. Premier point/m);
  assert.match(md, /^\| /m);
  const again = readMarkdown(writeMarkdown(source)).document;
  assert.equal(paragraphs(again.body)[0]?.styleId, 'Heading1');
  assert.equal(textRun(again.body, 'Gras')?.props.bold, true);
  assert.ok(again.body.some((b) => b.type === 'table'));
  assert.equal(documentToMarkdown(again), documentToMarkdown(readMarkdown(documentToMarkdown(again)).document), 'point fixe');
  const tricky = createBlankDocument();
  tricky.body = [para('*pas* une _emphase_ # ni [lien](x)')];
  assert.equal(plainText(readMarkdown(documentToMarkdown(tricky)).document), '*pas* une _emphase_ # ni [lien](x)');
});

// ------------------------------------------------------------------------------------------------- Texte brut

test('txt : encodages UTF-8, UTF-8 BOM, UTF-16 LE/BE, Windows-1252', () => {
  const text = 'Ligne 1 été €\nLigne\t2';
  for (const encoding of ['utf-8', 'utf-8-bom', 'utf-16le', 'utf-16be', 'windows-1252'] as const) {
    const bytes = encodeText(text, encoding);
    assert.equal(detectEncoding(bytes), encoding, encoding);
    assert.equal(decodeText(bytes), text, encoding);
  }
  assert.equal(detectEncoding(new Uint8Array([0x63, 0x61, 0x66, 0xe9])), 'windows-1252');
  const { document: d, encoding } = readText(encodeText('a\r\nb\r\n\fc', 'utf-16le'));
  assert.equal(encoding, 'utf-16le');
  assert.equal(d.body.length, 3);
  assert.equal(findInline(d.body, 'break')[0]?.kind, 'page');
  assert.equal(findInline(d.body, 'tab').length, 0);
});

test('txt : export avec numeros de liste et tableaux, fins de ligne', () => {
  const source = richDocument();
  const out = new TextDecoder().decode(writeText(source, { newline: '\n' }));
  assert.match(out, /^1\.\tPremier point$/m);
  assert.match(out, /^a\)\tSous point$/m);
  assert.match(out, /^A2\tB2/m);
  const crlf = new TextDecoder().decode(writeText(source));
  assert.ok(crlf.includes('\r\n'));
  assert.equal(new TextDecoder().decode(writeText(source, { listLabels: false, newline: '\n' })).includes('1.\tPremier'), false);
});

// ------------------------------------------------------------------------------------------------- Detection / aiguillage

test('formats : detection par signature et extension, lecture et ecriture unifiees', async () => {
  const doc = richDocument();
  assert.equal(detectFormat(await writeDocx(doc), 'x.docx'), 'docx');
  assert.equal(detectFormat(await writeDocx(doc), 'x.dotx'), 'dotx');
  assert.equal(detectFormat(writeRtf(doc), 'x.doc'), 'rtf', 'RTF renomme en .doc');
  assert.equal(detectFormat(writeHtml(doc)), 'html');
  assert.equal(detectFormat(enc('# md'), 'notes.md'), 'md');
  assert.equal(detectFormat(enc('bonjour')), 'txt');
  assert.equal(detectFormat(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])), 'doc');
  for (const format of ['docx', 'docm', 'dotx', 'rtf', 'odt', 'html', 'md', 'txt'] as const) {
    const bytes = await writeDocument(doc, format);
    const back = await readDocument(bytes, `fichier.${format}`);
    assert.equal(back.format, format, format);
    assert.match(plainText(back.document), /Premier point/, format);
  }
  await assert.rejects(readDocument(enc('x'.repeat(100)), 'a.txt', { limits: { maxInputBytes: 10 } }), DocxError);
  const forced = await readDocument(enc('# Pas un titre'), 'a.md', { format: 'txt' });
  assert.equal(plainText(forced.document), '# Pas un titre');
});

test('formats : document vide ecrit et relu dans tous les formats', async () => {
  const empty: WordDocument = createBlankDocument();
  empty.body = [para([])];
  for (const format of ['docx', 'rtf', 'odt', 'html', 'md', 'txt'] as const) {
    const back = await readDocument(await writeDocument(empty, format), `vide.${format}`);
    assert.equal(plainText(back.document).trim(), '', format);
    assert.ok(back.document.body.length >= 1, format);
  }
  const unicode = createBlankDocument();
  unicode.body = [para([run('Ünïcødé 😀 日本語 ‏עברית')])];
  for (const format of ['docx', 'rtf', 'odt', 'html', 'md', 'txt'] as const) {
    const back = await readDocument(await writeDocument(unicode, format), `u.${format}`);
    assert.equal(plainText(back.document), 'Ünïcødé 😀 日本語 ‏עברית', format);
  }
});

test('docx chiffre par Word 365 (agile) : mot de passe demande, refuse, puis ouvert', async () => {
  const bytes = new Uint8Array(readFileSync(new URL('../../opc/tests/fixtures/word-agile.docx', import.meta.url)));
  assert.equal(detectFormat(bytes, 'secret.docx'), 'docx');
  await assert.rejects(readDocument(bytes, 'secret.docx'), (e: unknown) => e instanceof DocxPasswordError && e.reason === 'required');
  await assert.rejects(readDocument(bytes, 'secret.docx', { password: 'faux' }), (e: unknown) => e instanceof DocxPasswordError && e.reason === 'wrong');
  const { document, format } = await readDocument(bytes, 'secret.docx', { password: 'Forge2026!' });
  assert.equal(format, 'docx');
  assert.ok(plainText(document).includes('Bonjour chiffr'));
});

test('rtf : commentaires (annotation de Word, reponse comprise) et dates en heure locale', () => {
  // Structure ecrite par Word 365 (SaveAs RTF), auteurs neutralises.
  const rtf = String.raw`{\rtf1\ansi\ansicpg1252\deff0{\fonttbl{\f0 Arial;}}{\info{\author Auteur}{\creatim\yr2026\mo11\dy4\hr23\min45}{\revtim\yr2026\mo11\dy5\hr0\min5\sec9}}\pard Avant {\*\atrfstart 198292971}{\*\atrfstart 1509241945}texte commente{\*\atrfend 198292971}{\*\atnid AL}{\*\atnauthor Alice}\chatn {\*\annotation{\*\atnref 198292971}{\*\atndate 1743463917}\pard\plain {\chatn }Mon commentaire}{\*\atrfend 1509241945}{\*\atnid BO}{\*\atnauthor Bob}\chatn {\*\annotation{\*\atnref 1509241945}{\*\atndate 1743463917}{\*\atnparent -1}\pard\plain {\chatn }Ma reponse} apres\par}`;
  const { document: d } = readRtf(enc(rtf));
  const local = (y: number, mo: number, da: number, h: number, mi: number, s = 0): string => new Date(y, mo - 1, da, h, mi, s).toISOString().replace('.000Z', 'Z');
  assert.equal(d.properties.created, local(2026, 11, 4, 23, 45));
  assert.equal(d.properties.modified, local(2026, 11, 5, 0, 5, 9));
  assert.equal(plainText(d), 'Avant texte commente apres');
  assert.equal(d.comments.length, 2);
  const [root, reply] = d.comments;
  assert.deepEqual([root?.author, root?.initials, plainText({ ...d, body: root?.blocks ?? [] })], ['Alice', 'AL', 'Mon commentaire']);
  assert.deepEqual([reply?.author, reply?.parentId, plainText({ ...d, body: reply?.blocks ?? [] })], ['Bob', root?.id, 'Ma reponse']);
  assert.equal(root?.date, local(2026, 11, 4, 23, 45));
  const kinds = findInline(d.body, 'commentStart').length + findInline(d.body, 'commentEnd').length + findInline(d.body, 'commentRef').length;
  assert.equal(kinds, 6);
  // Aller-retour par le redacteur RTF.
  const again = readRtf(writeRtf(d)).document;
  assert.deepEqual(again.comments.map((c) => [c.author, c.initials, c.parentId, c.date]), d.comments.map((c) => [c.author, c.initials, c.parentId, c.date]));
  assert.equal(again.properties.created, d.properties.created);
  assert.equal(plainText(again), 'Avant texte commente apres');
});
