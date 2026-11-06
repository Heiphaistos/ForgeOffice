import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { OpcPackage } from '@forgeoffice/opc';
import { canonicalStyleName, createBlankDocument, DocxError, findStyleId, headingLevelOfStyle, plainText, readDocx, writeDocx, type Paragraph, type ReadResult, type Table } from '../src/index.ts';
import { docxFixture, findInline, para, paragraphs, PNG, richDocument, run, textRun } from './helpers.ts';

const roundTrip = async (doc = richDocument()): Promise<ReadResult> => readDocx(await writeDocx(doc));

test('docx : parties obligatoires presentes et types de contenu corrects', async () => {
  const pkg = await OpcPackage.open(await writeDocx(richDocument()));
  for (const part of ['word/document.xml', 'word/styles.xml', 'word/settings.xml', 'word/fontTable.xml', 'word/webSettings.xml',
    'word/theme/theme1.xml', 'docProps/core.xml', 'docProps/app.xml', 'word/numbering.xml', 'word/footnotes.xml',
    'word/endnotes.xml', 'word/comments.xml', 'docProps/custom.xml']) {
    assert.ok(pkg.has(part), `partie manquante : ${part}`);
  }
  assert.equal(pkg.contentType('word/document.xml'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml');
  assert.equal(await pkg.relatedPart('', '/officeDocument'), 'word/document.xml');
  assert.ok(pkg.paths().some((p) => p.startsWith('word/media/')), 'image ecrite');
  const docXml = await pkg.readText('word/document.xml');
  assert.ok(docXml.startsWith('<?xml'), 'declaration XML');
  assert.ok(!/javascript:/i.test(docXml));
});

test('docx : document vierge Office 2024 (Aptos 11, interligne 1,08, 8 pt apres)', async () => {
  const blank = createBlankDocument();
  assert.equal(blank.styles.docDefaults.run.size, 11);
  assert.equal(blank.styles.docDefaults.run.fontTheme, 'minor');
  assert.equal(blank.theme.minorFont, 'Aptos');
  assert.deepEqual(blank.styles.docDefaults.paragraph.lineSpacing, { rule: 'auto', value: 1.08 });
  assert.equal(blank.styles.docDefaults.paragraph.spacingAfter, 8);
  const { document, warnings } = await roundTrip(blank);
  assert.deepEqual(warnings, []);
  assert.equal(document.styles.docDefaults.run.size, 11);
  assert.deepEqual(document.styles.docDefaults.paragraph.lineSpacing, { rule: 'auto', value: 1.08 });
  assert.equal(document.styles.docDefaults.paragraph.spacingAfter, 8);
  assert.equal(document.theme.minorFont, 'Aptos');
  assert.equal(document.theme.majorFont, 'Aptos Display');
  assert.ok(document.styles.styles.some((s) => s.id === 'Heading1'));
  assert.equal(document.finalSection.pageWidth, 595.3);
});

test('docx : aller-retour des proprietes, reglages, styles et numerotation', async () => {
  const { document: d, warnings } = await roundTrip();
  assert.deepEqual(warnings, []);
  assert.equal(d.properties.title, 'Rapport annuel');
  assert.equal(d.properties.creator, 'Momo');
  assert.equal(d.properties.subject, 'Bilan');
  assert.equal(d.properties.keywords, 'forge, office');
  assert.equal(d.properties.description, 'Résumé');
  assert.equal(d.properties.created, '2026-01-02T03:04:05Z');
  assert.equal(d.properties.company, 'Forge');
  assert.equal(d.properties.custom['Projet'], 'ForgeOffice');
  assert.equal(d.settings.trackRevisions, true);
  assert.equal(d.settings.evenAndOddHeaders, true);
  const mine = d.styles.styles.find((s) => s.id === 'MonStyle');
  assert.equal(mine?.name, 'Mon style');
  assert.equal(mine?.basedOn, 'Normal');
  assert.equal(mine?.run?.bold, true);
  assert.equal(mine?.run?.color?.rgb, '1F4E79');
  assert.equal(mine?.paragraph?.spacingBefore, 12);
  assert.equal(d.numbering.abstracts.length, 2);
  assert.equal(d.numbering.abstracts[0]?.levels[1]?.format, 'lowerLetter');
  assert.equal(d.numbering.abstracts[0]?.levels[0]?.text, '%1.');
  assert.equal(d.numbering.abstracts[1]?.levels[0]?.format, 'bullet');
  assert.equal(d.numbering.instances.find((i) => i.id === 3)?.overrides[0]?.startOverride, 5);
});

test('docx : aller-retour de la mise en forme des caracteres', async () => {
  const { document: d } = await roundTrip();
  const body = d.body;
  assert.equal(textRun(body, 'Gras')?.props.bold, true);
  assert.equal(textRun(body, 'italique')?.props.italic, true);
  assert.equal(textRun(body, 'souligné')?.props.underline, 'double');
  assert.equal(textRun(body, 'souligné')?.props.underlineColor, 'FF0000');
  assert.equal(textRun(body, 'barré')?.props.strike, true);
  assert.equal(textRun(body, 'double')?.props.doubleStrike, true);
  assert.equal(textRun(body, 'Majuscules')?.props.caps, true);
  assert.equal(textRun(body, 'Petites')?.props.smallCaps, true);
  assert.equal(textRun(body, 'Arial14')?.props.font, 'Arial');
  assert.equal(textRun(body, 'Arial14')?.props.size, 14);
  assert.equal(textRun(body, 'rouge')?.props.color?.rgb, 'FF0000');
  assert.equal(textRun(body, 'theme')?.props.color?.theme, 'accent1');
  assert.equal(textRun(body, 'surligné')?.props.highlight, 'yellow');
  assert.equal(textRun(body, 'exposant')?.props.vertAlign, 'superscript');
  assert.equal(textRun(body, 'indice')?.props.vertAlign, 'subscript');
  assert.equal(textRun(body, 'espacé')?.props.spacing, 1.5);
  assert.equal(textRun(body, 'english')?.props.lang, 'en-US');
  assert.equal(textRun(body, 'masqué')?.props.hidden, true);
  assert.equal(textRun(body, 'trame')?.props.shading?.fill, 'D9D9D9');
});

test('docx : aller-retour de la mise en forme des paragraphes et des listes', async () => {
  const { document: d } = await roundTrip();
  const ps = paragraphs(d.body);
  assert.equal(ps[0]?.styleId, 'Heading1');
  const p = ps[1]?.props;
  assert.equal(p?.alignment, 'justify');
  assert.equal(p?.indentLeft, 36);
  assert.equal(p?.indentRight, 18);
  assert.equal(p?.indentFirstLine, 18);
  assert.equal(p?.spacingBefore, 6);
  assert.equal(p?.spacingAfter, 12);
  assert.deepEqual(p?.lineSpacing, { rule: 'auto', value: 1.5 });
  assert.deepEqual(p?.tabs, [{ position: 144, align: 'right', leader: 'dot' }]);
  assert.equal(p?.borders?.bottom?.style, 'single');
  assert.equal(p?.borders?.bottom?.width, 1);
  assert.equal(p?.shading?.fill, 'F2F2F2');
  assert.equal(p?.keepNext, true);
  assert.equal(p?.keepLines, true);
  assert.equal(p?.widowControl, false);
  assert.equal(p?.outlineLevel, 2);
  assert.equal(ps[2]?.styleId, 'MonStyle');
  assert.deepEqual(ps[3]?.props.numbering, { numId: 1, level: 0 });
  assert.deepEqual(ps[4]?.props.numbering, { numId: 1, level: 1 });
  assert.deepEqual(ps[5]?.props.numbering, { numId: 2, level: 0 });
});

test('docx : liens, signets, champs, notes, symboles', async () => {
  const { document: d } = await roundTrip();
  const links = findInline(d.body, 'hyperlink');
  assert.equal(links[0]?.url, 'https://forge.example/doc?a=1&b=2');
  assert.equal(links[0]?.tooltip, 'Infobulle');
  assert.equal(links[1]?.anchor, 'Signet1');
  assert.equal(findInline(d.body, 'bookmarkStart')[0]?.name, 'Signet1');
  assert.equal(findInline(d.body, 'bookmarkEnd').length, 1);
  const field = findInline(d.body, 'field')[0];
  assert.equal(field?.code, 'PAGE');
  assert.match(field?.instruction ?? '', /PAGE/);
  assert.equal(findInline(d.body, 'symbol')[0]?.char, 'F04A');
  assert.equal(findInline(d.body, 'footnoteRef')[0]?.noteId, 1);
  assert.equal(findInline(d.body, 'endnoteRef')[0]?.noteId, 1);
  assert.ok(findInline(d.body, 'tab').length >= 1);
  assert.equal(findInline(d.body, 'break')[0]?.kind, 'line');
  const notes = d.footnotes.filter((n) => !n.special);
  assert.equal(notes.length, 1);
  assert.match(plainText({ ...d, body: notes[0]?.blocks ?? [] }), /Texte de la note/);
  assert.equal(findInline(notes[0]?.blocks ?? [], 'noteMark')[0]?.kind, 'footnote');
  assert.match(plainText({ ...d, body: d.endnotes.find((n) => !n.special)?.blocks ?? [] }), /Note de fin/);
});

test('docx : commentaires (fil, resolu) et suivi des modifications', async () => {
  const { document: d } = await roundTrip();
  assert.equal(d.comments.length, 2);
  const first = d.comments.find((c) => c.author === 'Alice');
  const reply = d.comments.find((c) => c.author === 'Bob');
  assert.equal(first?.initials, 'AL');
  assert.equal(first?.date, '2026-03-01T09:00:00Z');
  assert.equal(reply?.parentId, first?.id);
  assert.equal(reply?.done, true);
  // La reponse sans ancre est ancree avec son parent (sinon Word l'ignore).
  assert.deepEqual(findInline(d.body, 'commentStart').map((c) => c.commentId), [0, 1]);
  assert.deepEqual(findInline(d.body, 'commentRef').map((c) => c.commentId), [0, 1]);
  const ins = textRun(d.body, 'ajouté');
  const del = textRun(d.body, 'retiré');
  assert.equal(ins?.revision?.kind, 'insert');
  assert.equal(ins?.revision?.author, 'Alice');
  assert.equal(del?.revision?.kind, 'delete');
  assert.equal(del?.revision?.date, '2026-03-02T10:00:00Z');
  assert.ok(!plainText(d).includes('retiré'), 'texte supprime exclu du texte brut');
  assert.ok(plainText(d, { includeDeleted: true }).includes('retiré'));
});

test('docx : images en ligne et flottantes, equation', async () => {
  const { document: d } = await roundTrip();
  const images = findInline(d.body, 'image');
  assert.equal(images.length, 2);
  const [inline, floating] = images;
  assert.equal(inline?.alt, 'Logo Forge');
  assert.equal(inline?.width, 72);
  assert.equal(inline?.height, 36);
  assert.equal(inline?.floating, undefined);
  assert.deepEqual(d.media[inline?.mediaId ?? '']?.bytes, PNG);
  assert.equal(d.media[inline?.mediaId ?? '']?.contentType, 'image/png');
  assert.equal(floating?.floating?.wrap, 'square');
  assert.equal(floating?.floating?.horizontal.align, 'right');
  assert.equal(floating?.floating?.vertical.offset, 12);
  const eq = findInline(d.body, 'equation')[0];
  assert.equal(eq?.omml.name, 'm:oMath');
  assert.match(eq?.text ?? '', /x=2/);
});

test('docx : tableaux (fusions, en-tete, trame) et controle de contenu', async () => {
  const { document: d } = await roundTrip();
  const table = d.body.find((b): b is Table => b.type === 'table');
  assert.ok(table);
  assert.deepEqual(table.grid, [120, 120, 120]);
  assert.equal(table.props.alignment, 'center');
  assert.equal(table.props.layout, 'fixed');
  assert.deepEqual(table.props.width, { value: 100, type: 'pct' });
  assert.equal(table.rows[0]?.props.header, true);
  assert.equal(table.rows[0]?.props.cantSplit, true);
  assert.equal(table.rows[0]?.cells[0]?.props.gridSpan, 2);
  assert.equal(table.rows[0]?.cells[0]?.props.shading?.fill, 'DDEBF7');
  assert.equal(table.rows[0]?.cells[1]?.props.vMerge, 'restart');
  assert.equal(table.rows[1]?.cells[2]?.props.vMerge, 'continue');
  assert.equal(table.rows[1]?.cells[0]?.props.verticalAlign, 'center');
  assert.deepEqual(table.rows[1]?.props.height, { value: 20, rule: 'atLeast' });
  const control = d.body.find((b) => b.type === 'contentControl');
  assert.equal(control?.type === 'contentControl' ? control.props.alias : undefined, 'Nom');
  assert.equal(control?.type === 'contentControl' ? control.props.tag : undefined, 'champ');
});

test('docx : sections, en-tetes et pieds de page', async () => {
  const { document: d } = await roundTrip();
  const breakPara = paragraphs(d.body).find((p) => p.sectionBreak);
  assert.equal(breakPara?.sectionBreak?.orientation, 'portrait');
  const s = d.finalSection;
  assert.equal(s.orientation, 'landscape');
  assert.equal(s.pageWidth, 841.9);
  assert.equal(s.columns.count, 2);
  assert.equal(s.columns.separator, true);
  assert.equal(s.titlePage, true);
  assert.equal(s.pageNumbering?.start, 3);
  assert.equal(s.pageNumbering?.format, 'lowerRoman');
  const header = s.headers.default ? d.headersFooters[s.headers.default] : undefined;
  const first = s.headers.first ? d.headersFooters[s.headers.first] : undefined;
  const footer = s.footers.default ? d.headersFooters[s.footers.default] : undefined;
  assert.match(plainText({ ...d, body: header?.blocks ?? [] }), /En-tête courant/);
  assert.match(plainText({ ...d, body: first?.blocks ?? [] }), /première page/);
  assert.equal(footer?.kind, 'footer');
  assert.equal(findInline(footer?.blocks ?? [], 'field')[0]?.code, 'PAGE');
});

test('docx : ecriture -> lecture -> ecriture -> lecture stable (point fixe)', async () => {
  const once = await roundTrip();
  const twice = await roundTrip(once.document);
  assert.deepEqual(twice.document.body, once.document.body);
  assert.deepEqual(twice.document.footnotes, once.document.footnotes);
  assert.deepEqual(twice.document.comments, once.document.comments);
  assert.deepEqual(twice.document.finalSection, once.document.finalSection);
  assert.deepEqual(twice.document.numbering, once.document.numbering);
  assert.equal(plainText(twice.document), plainText(richDocument()));
});

test('docx : variantes docm / dotx et parties inconnues conservees', async () => {
  const doc = richDocument();
  const asTemplate = await readDocx(await writeDocx(doc, { kind: 'dotx' }));
  assert.equal(asTemplate.document.kind, 'dotx');
  const fixture = await docxFixture('<w:p><w:r><w:t>Avec XML perso</w:t></w:r></w:p>', {
    rels: '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml" Target="customXml/item1.xml"/>',
    parts: { 'customXml/item1.xml': '<racine><donnee>42</donnee></racine>' },
  });
  const read = await readDocx(fixture);
  assert.equal(read.document.preserved.length, 1);
  const again = await OpcPackage.open(await writeDocx(read.document));
  const custom = again.paths().find((p) => p.includes('customxml') || p.includes('customXml'));
  assert.ok(custom, 'partie customXml reecrite');
  assert.match(await again.readText(custom ?? ''), /<donnee>42<\/donnee>/);
});

test('docx fixture : XML ecrit a la main (styles de caracteres, champs complexes, sdt en ligne)', async () => {
  const bytes = await docxFixture([
    '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="120" w:line="360" w:lineRule="auto"/><w:ind w:left="720" w:hanging="360"/></w:pPr>',
    '<w:r><w:rPr><w:b/><w:i w:val="0"/><w:sz w:val="28"/><w:color w:val="00B050"/><w:u w:val="wave"/></w:rPr><w:t xml:space="preserve">Vert  </w:t></w:r>',
    '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>9</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>',
    '<w:fldSimple w:instr=" DATE \\@ &quot;dd/MM/yyyy&quot; "><w:r><w:t>01/01/2026</w:t></w:r></w:fldSimple>',
    '<w:sdt><w:sdtPr><w:alias w:val="Case"/><w14:checkbox xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w14:checked w14:val="1"/></w14:checkbox></w:sdtPr><w:sdtContent><w:r><w:t>☒</w:t></w:r></w:sdtContent></w:sdt>',
    '<w:r><w:br w:type="page"/></w:r><w:r><w:t>après</w:t></w:r></w:p>',
  ].join(''));
  const { document: d, warnings } = await readDocx(bytes);
  assert.deepEqual(warnings, []);
  const p = d.body[0] as Paragraph;
  assert.equal(p.props.alignment, 'center');
  assert.equal(p.props.spacingBefore, 12);
  assert.equal(p.props.spacingAfter, 6);
  assert.deepEqual(p.props.lineSpacing, { rule: 'auto', value: 1.5 });
  assert.equal(p.props.indentLeft, 36);
  assert.equal(p.props.indentFirstLine, -18);
  const vert = textRun(d.body, 'Vert');
  assert.equal(vert?.text, 'Vert  ', 'espaces conserves');
  assert.equal(vert?.props.bold, true);
  assert.equal(vert?.props.italic, false);
  assert.equal(vert?.props.size, 14);
  assert.equal(vert?.props.color?.rgb, '00B050');
  assert.equal(vert?.props.underline, 'wave');
  const fields = findInline(d.body, 'field');
  assert.deepEqual(fields.map((f) => f.code), ['NUMPAGES', 'DATE']);
  assert.equal(fields[0]?.result.length, 1);
  const control = findInline(d.body, 'inlineControl')[0];
  assert.equal(control?.props.kind, 'checkbox');
  assert.equal(control?.props.checked, true);
  assert.equal(findInline(d.body, 'break')[0]?.kind, 'page');
});

test('docx securite : lien javascript: refuse avec avertissement', async () => {
  const bytes = await docxFixture('<w:p><w:hyperlink r:id="rId5"><w:r><w:t>piege</w:t></w:r></w:hyperlink><w:hyperlink r:id="rId6"><w:r><w:t>ok</w:t></w:r></w:hyperlink></w:p>', {
    rels: [
      '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/>',
      '<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://ok.example" TargetMode="External"/>',
    ].join(''),
  });
  const { document: d, warnings } = await readDocx(bytes);
  const links = findInline(d.body, 'hyperlink');
  assert.equal(links[0]?.url, undefined);
  assert.equal(links[1]?.url, 'https://ok.example');
  assert.ok(warnings.some((w) => w.code === 'unsafe-link'));
  assert.equal(plainText(d), 'piegeok', 'le texte du lien refuse est conserve');
  const field = await readDocx(await docxFixture('<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> HYPERLINK "JaVa\tScRiPt:alert(1)" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>x</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>'));
  assert.ok(!JSON.stringify(field.document.body).toLowerCase().includes('"url":"java'), 'champ HYPERLINK dangereux sans URL');
});

test('docx robustesse : fichiers corrompus', async () => {
  await assert.rejects(readDocx(new TextEncoder().encode('ceci n’est pas un zip')), DocxError);
  await assert.rejects(readDocx(new Uint8Array(0)), DocxError);
  const zip = new JSZip();
  zip.file('autre.txt', 'rien');
  await assert.rejects(readDocx(await zip.generateAsync({ type: 'uint8array' })), DocxError, 'sans document principal');
  // document.xml tronque : texte recupere avec avertissement.
  const broken = await docxFixture('<w:p><w:r><w:t>Texte sauvé</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r></w:p>');
  const z = await JSZip.loadAsync(broken);
  const xml = await z.file('word/document.xml')?.async('string') ?? '';
  z.file('word/document.xml', xml.slice(0, xml.lastIndexOf('</w:body>') - 5));
  const repaired = await readDocx(await z.generateAsync({ type: 'uint8array' }));
  assert.ok(repaired.warnings.some((w) => w.code === 'main-repaired'));
  assert.match(plainText(repaired.document), /Texte sauvé/);
  // Partie de styles illisible : avertissement, document lu quand meme.
  const badStyles = await docxFixture('<w:p><w:r><w:t>Corps</w:t></w:r></w:p>', {
    rels: '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="word/styles.xml"/>',
    parts: { 'word/styles.xml': '<w:styles><w:style>' },
  });
  const styled = await readDocx(badStyles);
  assert.ok(styled.warnings.some((w) => w.code === 'part-unreadable'));
  assert.equal(plainText(styled.document), 'Corps');
  // Image referencee mais absente : pas de plantage.
  const missing = await docxFixture('<w:p><w:r><w:t>Img</w:t></w:r></w:p>', {
    rels: '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/absente.png"/>',
  });
  assert.equal(plainText((await readDocx(missing)).document), 'Img');
});

test('docx securite : bombe zip et limites', async () => {
  const zip = new JSZip();
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml', `<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>${'A'.repeat(8 * 1024 * 1024)}</w:t></w:r></w:p></w:body></w:document>`);
  const bomb = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  assert.ok(bomb.length < 100_000, 'archive tres compressee');
  await assert.rejects(readDocx(bomb, { packageLimits: { maxEntryBytes: 1024 * 1024 } }), DocxError);
  await assert.rejects(readDocx(bomb, { packageLimits: { maxTotalBytes: 1024 * 1024 } }), DocxError);
  await assert.rejects(readDocx(bomb, { limits: { maxInputBytes: 1000 } }), DocxError);
  const many = new JSZip();
  for (let i = 0; i < 50; i++) many.file(`f${i}.xml`, '<a/>');
  await assert.rejects(readDocx(await many.generateAsync({ type: 'uint8array' }), { packageLimits: { maxEntries: 10 } }), DocxError);
  const wide = await docxFixture('<w:p><w:r><w:t>1</w:t></w:r></w:p>'.repeat(50));
  const capped = await readDocx(wide, { limits: { maxBlocks: 10 } });
  assert.ok(capped.document.body.length <= 10);
  assert.ok(capped.warnings.some((w) => w.code === 'too-many-blocks'));
  const deep = await docxFixture(`${'<w:tbl><w:tr><w:tc>'.repeat(60)}<w:p/>${'</w:tc></w:tr></w:tbl>'.repeat(60)}<w:p/>`);
  const shallow = await readDocx(deep);
  assert.ok(shallow.warnings.some((w) => w.code === 'too-deep'));
});

test('docx : paragraphes vides et texte multiligne', async () => {
  const doc = createBlankDocument();
  doc.body = [para([]), para([run('a'), { type: 'break', kind: 'line' }, run('b')]), para('  espaces  ')];
  const { document: d } = await roundTrip(doc);
  assert.equal(d.body.length, 3);
  assert.equal(plainText(d), '\na\nb\n  espaces  ');
});

test('docx : plafond d\'entree par defaut 256 Mo', async () => {
  const { DEFAULT_READ_LIMITS } = await import('../src/security.ts');
  assert.equal(DEFAULT_READ_LIMITS.maxInputBytes, 256 * 1024 * 1024);
});

test('docx : filigrane et couleur de page ecrits en vrais elements OOXML puis relus', async () => {
  const doc = createBlankDocument();
  doc.body = [para('Corps')];
  doc.properties.custom = { 'ForgeOffice.Filigrane': 'CONFIDENTIEL|#FF0000|1', 'ForgeOffice.CouleurPage': '#FFF0E0', autre: 'x' };
  const bytes = await writeDocx(doc);
  const pkg = await OpcPackage.open(bytes);
  const main = await pkg.readText('word/document.xml');
  assert.match(main, /<w:background w:color="FFF0E0"\/><w:body>/);
  assert.match(await pkg.readText('word/settings.xml'), /<w:zoom[^>]*\/><w:displayBackgroundShape\/>/);
  const header = pkg.paths().find((p) => /^word\/header\d+\.xml$/.test(p));
  assert.ok(header, 'en-tete cree pour porter le filigrane');
  const xml = await pkg.readText(header);
  assert.match(xml, /id="PowerPlusWaterMarkObject\d+"/);
  assert.match(xml, /string="CONFIDENTIEL"/);
  assert.match(xml, /fillcolor="#FF0000"/);
  assert.match(xml, /rotation:315/);
  assert.ok(!(await pkg.readText('docProps/custom.xml')).includes('Filigrane'), 'plus de propriete personnalisee en double');
  const back = (await readDocx(bytes)).document;
  assert.equal(back.properties.custom['ForgeOffice.Filigrane'], 'CONFIDENTIEL|#FF0000|1');
  assert.equal(back.properties.custom['ForgeOffice.CouleurPage'], '#FFF0E0');
  assert.equal(back.properties.custom['autre'], 'x');
  // Reecriture : un seul filigrane par en-tete.
  const again = await OpcPackage.open(await writeDocx(back));
  const h2 = await again.readText(again.paths().find((p) => /^word\/header\d+\.xml$/.test(p)) ?? '');
  assert.equal(h2.split('PowerPlusWaterMarkObject').length - 1, 1);
});

test('styles de Word en francais (identifiants Titre1, Lgende...) : table nom canonique / niveau', async () => {
  const bytes = new Uint8Array(readFileSync(new URL('./fixtures/word-fr-styles.docx', import.meta.url)));
  const { document } = await readDocx(bytes);
  const byId = new Map(document.styles.styles.map((s) => [s.id, s]));
  for (let level = 1; level <= 9; level++) {
    const style = byId.get(`Titre${level}`);
    assert.ok(style, `Titre${level}`);
    assert.equal(headingLevelOfStyle(style), level);
    assert.equal(style.paragraph?.outlineLevel, level - 1);
  }
  assert.equal(findStyleId(document.styles, 'heading 2'), 'Titre2');
  assert.equal(findStyleId(document.styles, 'caption'), 'Lgende');
  assert.equal(findStyleId(document.styles, 'footer'), 'Pieddepage');
  assert.equal(findStyleId(document.styles, 'list paragraph'), 'Paragraphedeliste');
  assert.equal(canonicalStyleName({ id: 'Titre', name: 'Titre', custom: false }), 'title');
  assert.equal(canonicalStyleName({ id: 'Sous-titre', name: 'Sous-titre' }), 'subtitle');
  // Un style personnalise nomme « Titre 1 Car » n'est pas confondu avec un titre.
  assert.equal(headingLevelOfStyle({ id: 'Titre1Car', name: 'Titre 1 Car', custom: true }), 0);
  // Nom localise ecrit dans le fichier (autres logiciels) + identifiant localise sans nom.
  assert.equal(headingLevelOfStyle({ id: 'x', name: 'Titre 3' }), 3);
  assert.equal(headingLevelOfStyle({ id: 'Titre4', name: 'Titre4' }), 4);
  assert.equal(headingLevelOfStyle({ id: 'Heading5', name: 'heading 5' }), 5);
});
