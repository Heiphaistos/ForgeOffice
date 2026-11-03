import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml, serializeXml, el, child, textOf, XmlError } from '../src/xml.ts';
import { OpcPackage, PackageWriter, normalizePartPath, resolveTarget, PackageError } from '../src/package.ts';

test('XML : analyse, entites, CDATA, espaces conserves, aller-retour', () => {
  const root = parseXml('<?xml version="1.0"?><w:p a="1 &amp; 2"><w:t xml:space="preserve"> a &lt;b&gt; &#233;&#x20AC;</w:t><!-- c --><x><![CDATA[<y>]]></x><z/></w:p>');
  assert.equal(root.name, 'w:p');
  assert.equal(root.attrs['a'], '1 & 2');
  assert.equal(textOf(child(root, 'w:t')), ' a <b> é€');
  assert.equal(textOf(child(root, 'x')), '<y>');
  const again = parseXml(serializeXml(root));
  assert.deepEqual(again, root);
});

test('XML : refuse DOCTYPE et balises mal fermees', () => {
  assert.throws(() => parseXml('<!DOCTYPE a [<!ENTITY x "y">]><a>&x;</a>'), XmlError);
  assert.throws(() => parseXml('<a><b></a>'), XmlError);
});

test('Chemins : normalisation et refus de sortie du paquet', () => {
  assert.equal(normalizePartPath('/word/../word/./document.xml'), 'word/document.xml');
  assert.equal(resolveTarget('word/document.xml', 'media/image1.png'), 'word/media/image1.png');
  assert.equal(resolveTarget('ppt/slides/slide1.xml', '../media/a.png'), 'ppt/media/a.png');
  assert.throws(() => normalizePartPath('../../etc/passwd'), PackageError);
});

test('Paquet : ecriture puis relecture avec relations et types', async () => {
  const w = new PackageWriter();
  w.addXml('word/document.xml', el('w:document', {}, [el('w:body', {}, ['texte'])]), 'application/test.main+xml');
  w.addBytes('word/media/image1.png', new Uint8Array([1, 2, 3]));
  w.addRelationship('', 'http://x/officeDocument', 'word/document.xml');
  w.addRelationship('word/document.xml', 'http://x/image', 'word/media/image1.png');
  w.addRelationship('word/document.xml', 'http://x/hyperlink', 'https://exemple.fr', true);
  const pkg = await OpcPackage.open(await w.build());
  const main = await pkg.relatedPart('', '/officeDocument');
  assert.equal(main, 'word/document.xml');
  assert.equal(pkg.contentType('word/document.xml'), 'application/test.main+xml');
  assert.equal(pkg.contentType('word/media/image1.png'), 'image/png');
  const rels = await pkg.relationships('word/document.xml');
  assert.equal(rels[0]?.target, 'word/media/image1.png');
  assert.equal(rels[1]?.external, true);
  assert.deepEqual([...(await pkg.readBytes('word/media/image1.png'))], [1, 2, 3]);
});

test('Paquet : limite de taille decompressee', async () => {
  const w = new PackageWriter();
  w.addBytes('gros.bin', new Uint8Array(200_000));
  const pkg = await OpcPackage.open(await w.build(), { maxEntries: 10, maxEntryBytes: 100_000, maxTotalBytes: 1_000_000 });
  await assert.rejects(pkg.readBytes('gros.bin'), PackageError);
});
