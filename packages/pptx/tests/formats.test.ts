import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import JSZip from 'jszip';
import assert from 'node:assert/strict';
import {
  addAutoShape,
  addTable,
  addTextBox,
  setNotes,
  writeOdp,
  addPicture,
  addSlide,
  createBlankDeck,
  displayMedia,
  BUILTIN_TABLE_STYLES,
  builtinTableStyle,
  normalizeTableStyleId,
  notesText,
  openPresentation,
  PresentationError,
  PresentationPasswordError,
  readOdp,
  readPpt,
  readPptx,
  setSmartArtNodeText,
  slideText,
  textOfShape,
  writePptx,
  type Deck,
  type Picture,
  type TableShape,
} from '../src/index.ts';
import { autoShape, fixture, near } from './helpers.ts';

const texts = (deck: Deck): string[] => deck.slides.map(slideText);

test('slides.pptx (LibreOffice) : texte, image, notes', async () => {
  const deck = await readPptx(fixture('slides.pptx'));
  assert.ok(near(deck.size.width, 793.75) && near(deck.size.height, 446.5));
  assert.deepEqual(texts(deck), ['Corpus slide title\nFirst slide subtitle', 'Second slide heading\nContent line one\nContent line two']);
  assert.equal(notesText(deck.slides[0]!), 'Speaker note for the first slide');
  assert.equal(notesText(deck.slides[1]!), 'Speaker note for the second slide');
  const picture = deck.slides[1]!.shapes.find((s): s is Picture => s.kind === 'picture');
  assert.equal(deck.media[picture?.mediaId ?? '']?.extension, 'png');
  const heading = autoShape(deck.slides[1]!.shapes[0]);
  assert.equal(heading.text?.paragraphs[0]?.runs[0]?.props.bold, true);
  assert.equal(heading.text?.paragraphs[0]?.runs[0]?.props.size, 36);
  assert.deepEqual(heading.fill, { type: 'solid', color: { type: 'rgb', value: '729FCF' } });
});

test('fichiers ONLYOFFICE : dispositions, espaces reserves, aller-retour', async () => {
  for (const [name, layouts] of [['onlyoffice-lines.pptx', 9], ['onlyoffice-office.pptx', 11]] as const) {
    const deck = await readPptx(fixture(name));
    assert.deepEqual([deck.size.width, deck.size.height], [720, 405], name);
    assert.equal(deck.masters[0]?.layouts.length, layouts, name);
    assert.deepEqual(deck.slides[0]?.shapes.map((s) => s.placeholder?.type), ['ctrTitle', 'subTitle'], name);
    const back = await readPptx(await writePptx(deck));
    assert.equal(back.masters[0]?.layouts.length, layouts, name);
    assert.deepEqual(back.slides[0]?.shapes, deck.slides[0]?.shapes, name);
    assert.deepEqual(back.masters[0]?.theme.colors, deck.masters[0]?.theme.colors, name);
    assert.deepEqual(back.masters[0]?.theme.fonts, deck.masters[0]?.theme.fonts, name);
  }
});

test('.odp LibreOffice : pages, texte, image, notes', async () => {
  const basic = await readOdp(fixture('basic.odp'));
  assert.deepEqual(texts(basic), ['Basic ODP title\nBasic ODP subtitle']);
  const deck = await readOdp(fixture('slides.odp'));
  assert.ok(near(deck.size.width, 793.7) && near(deck.size.height, 446.46));
  assert.deepEqual(texts(deck), ['Corpus slide title\nFirst slide subtitle', 'Second slide heading\nContent line one\nContent line two']);
  assert.equal(notesText(deck.slides[1]!), 'Speaker note for the second slide');
  assert.equal(deck.slides[1]?.shapes.filter((s) => s.kind === 'picture').length, 1);
  // Conversion .odp -> .pptx : le texte survit.
  const converted = await readPptx(await writePptx(deck));
  assert.deepEqual(texts(converted), texts(deck));
  assert.equal(notesText(converted.slides[0]!), 'Speaker note for the first slide');
});

test('.odp exporte par PowerPoint : rotation + miroir, tableau fusionne, lien, transition, masquee', async () => {
  const deck = await readOdp(fixture('powerpoint-export.odp'));
  assert.ok(near(deck.size.width, 960) && near(deck.size.height, 540));
  assert.equal(deck.slides.length, 3);
  const slide = deck.slides[1]!;
  assert.deepEqual(slide.shapes.slice(0, 2).map((s) => s.placeholder?.type), ['title', 'body']);
  const rotated = autoShape(slide.shapes[2]);
  assert.ok(near(rotated.xfrm?.x, 10) && near(rotated.xfrm?.y, 20) && near(rotated.xfrm?.width, 100) && near(rotated.xfrm?.height, 50));
  assert.equal(rotated.xfrm?.rotation, 30);
  assert.equal(rotated.xfrm?.flipH, true);
  assert.equal(textOfShape(rotated), 'Gras\vsuite\npuce\nimage');
  assert.equal(rotated.text?.paragraphs[0]?.runs[0]?.props.link?.url, 'https://exemple.fr');
  const table = slide.shapes.find((s): s is TableShape => s.kind === 'table');
  assert.ok(table);
  assert.equal(table.table.rows.length, 3);
  assert.equal(table.table.rows[0]?.cells[0]?.gridSpan, 2);
  assert.equal(table.table.rows[0]?.cells[0]?.rowSpan, 2);
  assert.equal(textOfShape(table), 'a\t\tc\n\t\tf\ng\th\ti');
  assert.deepEqual(slide.transition, { type: 'push', speed: 'slow', params: { dir: 'u' }, advanceAfter: 3000 });
  assert.equal(notesText(slide), 'Note 1\nNote 2');
  assert.equal(deck.slides[2]?.hidden, true);
  assert.equal(deck.slides[2]?.transition, undefined);
  assert.equal(slide.shapes.filter((s) => s.kind === 'connector').length, 1);
  assert.equal(slide.shapes.filter((s) => s.kind === 'group').length, 1);
});

test('.ppt 97-2003 (enregistre par PowerPoint) : texte, niveaux, positions, image, notes', () => {
  const deck = readPpt(fixture('legacy.ppt'));
  assert.deepEqual([deck.size.width, deck.size.height], [720, 540]);
  assert.equal(deck.slides.length, 3);
  assert.deepEqual(deck.slides.map((s) => s.layoutId), ['layout1', 'layout2', 'layout7']);
  const [s1, s2, s3] = deck.slides;
  assert.deepEqual(s1?.shapes.map((s) => s.placeholder?.type), ['ctrTitle', 'subTitle']);
  assert.equal(slideText(s1!), 'Titre ancien format\nSous-titre accentué');
  assert.ok(near(s1?.shapes[0]?.xfrm?.x, 90) && near(s1?.shapes[0]?.xfrm?.width, 540));
  const body = autoShape(s2?.shapes[1]);
  assert.equal(textOfShape(body), 'Point un\vmême paragraphe\nSous-point\nPoint deux');
  assert.deepEqual(body.text?.paragraphs.map((p) => p.props.level ?? 0), [0, 1, 0]);
  assert.equal(notesText(s2!), 'Notes du présentateur');
  assert.equal(slideText(s3!), 'Zone de texte libre');
  assert.equal(autoShape(s3?.shapes[0]).textBox, true);
  const picture = s3?.shapes[1];
  assert.equal(picture?.kind, 'picture');
  assert.deepEqual(picture?.xfrm, { x: 400, y: 200, width: 100, height: 100 });
  const media = deck.media[(picture as Picture).mediaId];
  assert.equal(media?.extension, 'png');
  assert.deepEqual([...(media?.bytes.subarray(0, 4) ?? [])], [0x89, 0x50, 0x4e, 0x47]);
});

test('.ppt -> .pptx : conversion relisible', async () => {
  const deck = readPpt(fixture('legacy.ppt'));
  const back = await readPptx(await writePptx(deck));
  assert.deepEqual(texts(back), texts(deck));
  assert.equal(notesText(back.slides[1]!), 'Notes du présentateur');
  assert.equal(back.format, 'pptx');
});

test('ouverture par signature et fichiers hostiles', async () => {
  assert.equal((await openPresentation(fixture('slides.pptx'))).slides.length, 2);
  assert.equal((await openPresentation(fixture('slides.odp'))).slides.length, 2);
  assert.equal((await openPresentation(fixture('legacy.ppt'))).slides.length, 3);
  await assert.rejects(openPresentation(new TextEncoder().encode('pas une presentation')), PresentationError);
  await assert.rejects(openPresentation(new Uint8Array()), PresentationError);
  const legacy = fixture('legacy.ppt');
  assert.throws(() => readPpt(legacy.slice(0, 1024)), PresentationError);
  assert.throws(() => readPpt(new Uint8Array(4096)), PresentationError);
  await assert.rejects(readPptx(fixture('slides.pptx').slice(0, 2000)));
});

test('pptx chiffre par PowerPoint 365 (agile) : mot de passe demande, refuse, puis ouvert', async () => {
  const bytes = new Uint8Array(readFileSync(new URL('../../opc/tests/fixtures/powerpoint-agile.pptx', import.meta.url)));
  await assert.rejects(openPresentation(bytes), (e: unknown) => e instanceof PresentationPasswordError && e.reason === 'required');
  await assert.rejects(openPresentation(bytes, { password: 'faux' }), (e: unknown) => e instanceof PresentationPasswordError && e.reason === 'wrong');
  const deck = await openPresentation(bytes, { password: 'Forge2026!' });
  assert.equal(deck.slides.length, 1);
  assert.ok(deck.slides.some((s) => slideText(s).includes('Diapo chiffree')));
});

test('styles de tableau : GUID et noms identiques a ceux relevés dans PowerPoint 365 (COM, 74 styles)', () => {
  const recorded = readFileSync(new URL('./fixtures/powerpoint-table-styles.txt', import.meta.url), 'utf8').trim().split(/\r?\n/).map((l) => l.split('|'));
  assert.equal(recorded.length, BUILTIN_TABLE_STYLES.length);
  recorded.forEach(([applied, id, name], i) => {
    assert.equal(id, applied, 'PowerPoint accepte le GUID tel quel');
    assert.deepEqual([BUILTIN_TABLE_STYLES[i]?.id, BUILTIN_TABLE_STYLES[i]?.name], [id, name]);
  });
  assert.equal(normalizeTableStyleId('{9d7b26c5-4107-4fec-aedc-1716b250ee53}'), '{9D7B26C5-4107-4FEC-AEDC-1716B250A1EF}');
  assert.equal(normalizeTableStyleId('{21E4AEA4-8DFA-4A89-87EB-49C32662AFE8}'), '{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}');
  assert.equal(builtinTableStyle('{21e4aea4-8dfa-4a89-87eb-49c32662afe0}')?.name, 'Style moyen 2 - Accentuation 2');
});

test('EMF / WMF : rendu SVG de repli conserve a cote des octets (jamais ecrit), aller-retour pptx', async () => {
  const emf = new Uint8Array(readFileSync(new URL('../../opc/tests/fixtures/shapes.emf', import.meta.url)));
  const wmf = new Uint8Array(readFileSync(new URL('../../opc/tests/fixtures/shapes.wmf', import.meta.url)));
  const deck = createBlankDeck('widescreen');
  const slide = addSlide(deck, 'layout7');
  const pic = addPicture(deck, slide, emf, 'emf', { x: 10, y: 10, width: 200, height: 150 });
  addPicture(deck, slide, wmf, 'wmf', { x: 300, y: 10, width: 200, height: 150 });
  assert.equal(deck.media[pic.mediaId]?.preview?.contentType, 'image/svg+xml');
  const back = await readPptx(await writePptx(deck));
  const items = Object.values(back.media);
  assert.deepEqual(items.map((m) => m.extension).sort(), ['emf', 'wmf']);
  for (const item of items) {
    assert.ok(displayMedia(item)?.contentType === 'image/svg+xml', item.extension);
    assert.ok(new TextDecoder().decode(item.preview?.bytes).includes('<svg'));
  }
  assert.deepEqual(items.find((m) => m.extension === 'emf')?.bytes, emf);
});

test('SmartArt (fichier PowerPoint 365) : noeuds de texte lus, texte modifiable, repli mis a jour, aller-retour', async () => {
  const bytes = new Uint8Array(readFileSync(new URL('./fixtures/powerpoint-smartart.pptx', import.meta.url)));
  const deck = await readPptx(bytes);
  const art = deck.slides[0]?.shapes.find((s) => s.kind === 'smartart');
  assert.ok(art && art.kind === 'smartart');
  assert.deepEqual(art.nodes?.map((n) => n.text), ['Alpha', 'Bravo', 'Charlie', 'Alpha', 'Bravo']);
  assert.ok(art.nodes?.every((n) => n.parentId === undefined));
  assert.ok(slideText(deck.slides[0]!).includes('Charlie'), 'repli lisible');
  const target = art.nodes?.[2];
  assert.ok(target);
  assert.equal(setSmartArtNodeText(art, target.id, 'Zulu\nDeuxieme ligne'), true);
  assert.equal(setSmartArtNodeText(art, '{inconnu}', 'x'), false);
  assert.ok(slideText(deck.slides[0]!).includes('Zulu'), 'texte du repli mis a jour');
  const back = await readPptx(await writePptx(deck));
  const again = back.slides[0]?.shapes.find((s) => s.kind === 'smartart');
  assert.ok(again && again.kind === 'smartart');
  assert.deepEqual(again.nodes?.map((n) => n.text), ['Alpha', 'Bravo', 'Zulu\nDeuxieme ligne', 'Alpha', 'Bravo']);
});

test('odp : ecriture basique puis relecture (texte mis en forme, formes, chemin libre, image, tableau, notes)', async () => {
  const deck = createBlankDeck('widescreen');
  deck.properties.title = 'Titre ODP';
  const slide = addSlide(deck, 'layout7');
  const box = addTextBox(slide, { x: 40, y: 30, width: 300, height: 60 }, 'Bonjour ODP', { bold: true, size: 28, color: { type: 'rgb', value: 'FF0000' } });
  assert.ok(box);
  const shape = addAutoShape(slide, 'ellipse', { x: 360, y: 30, width: 100, height: 100 });
  shape.fill = { type: 'solid', color: { type: 'rgb', value: '00AA00' } };
  const free = addAutoShape(slide, 'rect', { x: 40, y: 150, width: 120, height: 90 });
  free.geometry = { type: 'custom', paths: [{ width: 100, height: 100, commands: [{ cmd: 'moveTo', pt: { x: 0, y: 100 } }, { cmd: 'lineTo', pt: { x: 50, y: 0 } }, { cmd: 'cubicBezTo', pts: [{ x: 60, y: 20 }, { x: 90, y: 40 }, { x: 100, y: 100 }] }, { cmd: 'close' }] }] };
  addPicture(deck, slide, new Uint8Array(readFileSync(new URL('./fixtures/onlyoffice-lines.pptx', import.meta.url))).subarray(0, 8), 'png', { x: 200, y: 150, width: 50, height: 50 });
  addTable(slide, 2, 2, { x: 300, y: 150, width: 200, height: 60 }, [['a', 'b'], ['c', 'd']]);
  setNotes(slide, 'Note ODP');
  const bytes = await writeOdp(deck);
  assert.equal(new TextDecoder('latin1').decode(bytes.subarray(30, 38)), 'mimetype');
  const back = await readOdp(bytes);
  assert.equal(back.properties.title, 'Titre ODP');
  const s = back.slides[back.slides.length - 1];
  assert.ok(s);
  assert.ok(slideText(s).includes('Bonjour ODP') && slideText(s).includes('a\tb'));
  assert.equal(notesText(s), 'Note ODP');
  const text = s.shapes.find((x) => x.kind === 'shape' && x.text && textOfShape(x) === 'Bonjour ODP');
  assert.ok(text && text.kind === 'shape');
  assert.equal(text.text?.paragraphs[0]?.runs[0]?.type === 'text' && text.text.paragraphs[0].runs[0].props.bold, true);
  const geoms = s.shapes.filter((x) => x.kind === 'shape').map((x) => (x.kind === 'shape' ? x.geometry.type : ''));
  assert.ok(geoms.includes('custom'), 'chemin libre relu comme geometrie personnalisee');
});

test('odp : geometries libres (enhanced-path, draw:path, draw:polygon), graphique et media', async () => {
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.presentation', { compression: 'STORE' });
  const ns = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:chart="urn:oasis:names:tc:opendocument:xmlns:chart:1.0"';
  zip.file('content.xml', `<?xml version="1.0"?><office:document-content ${ns}><office:body><office:presentation><draw:page draw:name="p1">
    <draw:custom-shape svg:x="1cm" svg:y="1cm" svg:width="4cm" svg:height="3cm"><draw:enhanced-geometry svg:viewBox="0 0 100 100" draw:type="non-primitive" draw:enhanced-path="M 0 100 L 50 0 C 60 20 90 40 100 100 Z N"/></draw:custom-shape>
    <draw:path svg:x="6cm" svg:y="1cm" svg:width="4cm" svg:height="3cm" svg:viewBox="0 0 100 100" svg:d="M0 0 L100 0 L50 100 Z"/>
    <draw:polygon svg:x="11cm" svg:y="1cm" svg:width="4cm" svg:height="3cm" svg:viewBox="0 0 10 10" draw:points="0,0 10,0 5,10"/>
    <draw:frame svg:x="1cm" svg:y="6cm" svg:width="8cm" svg:height="5cm"><draw:object xlink:href="./Object 1"/></draw:frame>
    <draw:frame svg:x="10cm" svg:y="6cm" svg:width="5cm" svg:height="4cm"><draw:plugin xlink:href="Media/clip.mp4" draw:mime-type="video/mp4"/></draw:frame>
  </draw:page></office:presentation></office:body></office:document-content>`);
  zip.file('Object 1/content.xml', `<?xml version="1.0"?><office:document-content ${ns}><office:body><office:chart><chart:chart chart:class="chart:bar"><chart:title><text:p>Ventes</text:p></chart:title><table:table table:name="local-table"><table:table-header-rows><table:table-row><table:table-cell/><table:table-cell office:value-type="string"><text:p>2025</text:p></table:table-cell></table:table-row></table:table-header-rows><table:table-rows><table:table-row><table:table-cell office:value-type="string"><text:p>T1</text:p></table:table-cell><table:table-cell office:value-type="float" office:value="12"><text:p>12</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell office:value-type="string"><text:p>T2</text:p></table:table-cell><table:table-cell office:value-type="float" office:value="30"><text:p>30</text:p></table:table-cell></table:table-row></table:table-rows></table:table></chart:chart></office:chart></office:body></office:document-content>`);
  zip.file('Media/clip.mp4', new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]));
  const deck = await readOdp(await zip.generateAsync({ type: 'uint8array' }));
  const shapes = deck.slides[0]?.shapes ?? [];
  const custom = shapes.filter((s) => s.kind === 'shape' && s.geometry.type === 'custom');
  assert.equal(custom.length, 3, 'trois geometries libres relues');
  const first = custom[0];
  assert.ok(first && first.kind === 'shape' && first.geometry.type === 'custom');
  assert.deepEqual(first.geometry.paths[0]?.commands.map((c) => c.cmd), ['moveTo', 'lineTo', 'cubicBezTo', 'close']);
  const chart = shapes.find((s) => s.kind === 'chart');
  assert.ok(chart && chart.kind === 'chart');
  assert.deepEqual(chart.chart.plots[0]?.series[0]?.values?.values, [12, 30]);
  const media = shapes.find((s) => s.kind === 'media');
  assert.ok(media && media.kind === 'media' && media.mediaType === 'video' && media.mediaId);
});

test('ppt reel (PowerPoint 365, format 97-2003) : mise en forme des caracteres et formes groupees au bon repere', () => {
  const deck = readPpt(new Uint8Array(readFileSync(new URL('./fixtures/powerpoint97-format.ppt', import.meta.url))));
  const shapes = deck.slides[0]?.shapes ?? [];
  const text = shapes.find((s) => s.kind === 'shape' && textOfShape(s).startsWith('Gras'));
  assert.ok(text && text.kind === 'shape');
  const runs = (text.text?.paragraphs[0]?.runs ?? []).flatMap((r) => (r.type === 'text' ? [r] : []));
  assert.equal(runs.map((r) => r.text).join(''), 'Gras rouge puis italique bleu et souligne');
  assert.deepEqual(runs.map((r) => [r.props.font, r.props.size]), [['Arial', 24], ['Arial', 24], ['Arial', 24], ['Arial', 24], ['Arial', 14]]);
  assert.equal(runs[0]?.props.bold, true);
  assert.deepEqual(runs[0]?.props.color, { type: 'rgb', value: 'FF0000' });
  assert.equal(runs[2]?.props.italic, true);
  assert.deepEqual(runs[2]?.props.color, { type: 'rgb', value: '0000FF' });
  assert.equal(runs[4]?.props.underline, 'sng');
  // Groupe : positions relevees dans PowerPoint (GroupItems.Left / Top) : (300,150) et (460,210), 120 x 60 pt.
  const cases = shapes.filter((s) => s.kind === 'shape' && /^Case/.test(textOfShape(s)));
  assert.deepEqual(cases.map((s) => [textOfShape(s), s.xfrm?.x, s.xfrm?.y, s.xfrm?.width, s.xfrm?.height]), [['Case A', 300, 150, 120, 60], ['Case B', 460, 210, 120, 60]]);
});
