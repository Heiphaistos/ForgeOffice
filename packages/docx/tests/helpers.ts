// Outils partages par les tests : document riche couvrant le modele, construction de paquets a la main.
import { el, PackageWriter, type XmlElement } from '@forgeoffice/opc';
import { createBlankDocument } from '../src/blank.ts';
import type { Block, Inline, Paragraph, ParagraphProps, RunProps, Table, WordDocument } from '../src/model.ts';

export const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

export const run = (text: string, props: RunProps = {}): Inline => ({ type: 'text', text, props });

export const para = (inlines: Inline[] | string, props: ParagraphProps = {}, styleId?: string): Paragraph => {
  const p: Paragraph = { type: 'paragraph', props, inlines: typeof inlines === 'string' ? [run(inlines)] : inlines };
  if (styleId) p.styleId = styleId;
  return p;
};

export const cell = (text: string, props: Table['rows'][number]['cells'][number]['props'] = {}): Table['rows'][number]['cells'][number] => ({ props, blocks: [para(text)] });

/** Paragraphes de premier niveau (tableaux exclus). */
export const paragraphs = (blocks: readonly Block[]): Paragraph[] => blocks.filter((b): b is Paragraph => b.type === 'paragraph');

/** Tous les elements en ligne d'un document, en profondeur (liens, champs, controles). */
export function allInlines(blocks: readonly Block[]): Inline[] {
  const out: Inline[] = [];
  const walk = (list: readonly Inline[]): void => {
    for (const inline of list) {
      out.push(inline);
      if (inline.type === 'hyperlink' || inline.type === 'inlineControl') walk(inline.inlines);
      if (inline.type === 'field') walk(inline.result);
    }
  };
  for (const block of blocks) {
    if (block.type === 'paragraph') walk(block.inlines);
    else if (block.type === 'table') for (const r of block.rows) for (const c of r.cells) out.push(...allInlines(c.blocks));
    else if (block.type === 'contentControl' || block.type === 'toc') out.push(...allInlines(block.blocks));
  }
  return out;
}

export const findInline = <T extends Inline['type']>(blocks: readonly Block[], type: T): (Inline & { type: T })[] =>
  allInlines(blocks).filter((i): i is Inline & { type: T } => i.type === type);

/** Premier texte contenant `needle`. */
export function textRun(blocks: readonly Block[], needle: string): Extract<Inline, { type: 'text' }> | undefined {
  return findInline(blocks, 'text').find((r) => r.text.includes(needle));
}

/** Document couvrant l'essentiel du modele. */
export function richDocument(): WordDocument {
  const doc = createBlankDocument();
  Object.assign(doc.properties, {
    title: 'Rapport annuel', subject: 'Bilan', creator: 'Momo', keywords: 'forge, office', description: 'Résumé',
    created: '2026-01-02T03:04:05Z', modified: '2026-02-03T04:05:06Z', category: 'Interne', company: 'Forge',
  });
  doc.properties.custom = { Projet: 'ForgeOffice' };
  doc.settings.trackRevisions = true;
  doc.settings.evenAndOddHeaders = true;
  doc.styles.styles.push({ id: 'MonStyle', type: 'paragraph', name: 'Mon style', basedOn: 'Normal', custom: true, quickFormat: true, run: { color: { rgb: '1F4E79' }, bold: true }, paragraph: { spacingBefore: 12 } });
  doc.numbering = {
    abstracts: [
      { id: 0, multiLevelType: 'hybridMultilevel', levels: [
        { level: 0, format: 'decimal', text: '%1.', start: 1, alignment: 'left', suffix: 'tab', paragraph: { indentLeft: 36, indentFirstLine: -18 } },
        { level: 1, format: 'lowerLetter', text: '%2)', start: 1, alignment: 'left', suffix: 'tab' },
      ] },
      { id: 1, levels: [{ level: 0, format: 'bullet', text: '•', start: 1, alignment: 'left', suffix: 'tab', run: { font: 'Symbol' } }] },
    ],
    instances: [{ id: 1, abstractId: 0, overrides: [] }, { id: 2, abstractId: 1, overrides: [] }, { id: 3, abstractId: 0, overrides: [{ level: 0, startOverride: 5 }] }],
  };
  doc.media['image1.png'] = { id: 'image1.png', fileName: 'image1.png', contentType: 'image/png', bytes: PNG };
  const omml: XmlElement = el('m:oMath', {}, [el('m:r', {}, [el('m:t', {}, ['x=2'])])]);
  const landscape = { ...doc.finalSection, orientation: 'landscape' as const, pageWidth: 841.9, pageHeight: 595.3, breakType: 'nextPage' as const, headers: {}, footers: {} };
  doc.body = [
    para('Titre principal', {}, 'Heading1'),
    para([
      run('Gras ', { bold: true }), run('italique ', { italic: true }), run('souligné ', { underline: 'double', underlineColor: 'FF0000' }),
      run('barré ', { strike: true }), run('double ', { doubleStrike: true }), run('Majuscules ', { caps: true }), run('Petites ', { smallCaps: true }),
      run('Arial14 ', { font: 'Arial', size: 14 }), run('rouge ', { color: { rgb: 'FF0000' } }), run('theme ', { color: { rgb: '156082', theme: 'accent1' } }),
      run('surligné ', { highlight: 'yellow' }), run('exposant', { vertAlign: 'superscript' }), run('indice', { vertAlign: 'subscript' }),
      run(' espacé', { spacing: 1.5 }), run(' english', { lang: 'en-US' }), run(' masqué', { hidden: true }), run(' trame', { shading: { fill: 'D9D9D9', pattern: 'clear', color: 'auto' } }),
    ], {
      alignment: 'justify', indentLeft: 36, indentRight: 18, indentFirstLine: 18, spacingBefore: 6, spacingAfter: 12,
      lineSpacing: { rule: 'auto', value: 1.5 }, tabs: [{ position: 144, align: 'right', leader: 'dot' }],
      borders: { bottom: { style: 'single', width: 1, color: '000000', space: 1 } }, shading: { fill: 'F2F2F2', pattern: 'clear', color: 'auto' },
      keepNext: true, keepLines: true, widowControl: false, outlineLevel: 2,
    }),
    para('Style perso', {}, 'MonStyle'),
    para('Premier point', { numbering: { numId: 1, level: 0 } }),
    para('Sous point', { numbering: { numId: 1, level: 1 } }),
    para('Puce', { numbering: { numId: 2, level: 0 } }),
    para([
      { type: 'hyperlink', url: 'https://forge.example/doc?a=1&b=2', tooltip: 'Infobulle', inlines: [run('lien externe')] },
      run(' '),
      { type: 'hyperlink', anchor: 'Signet1', inlines: [run('lien interne')] },
      { type: 'bookmarkStart', id: 0, name: 'Signet1' }, run('cible'), { type: 'bookmarkEnd', id: 0 },
      { type: 'tab' }, { type: 'break', kind: 'line' },
      { type: 'field', instruction: 'PAGE \\* MERGEFORMAT', code: 'PAGE', result: [run('1')] },
      { type: 'symbol', font: 'Wingdings', char: 'F04A' },
      run('note'), { type: 'footnoteRef', noteId: 1 }, run(' fin'), { type: 'endnoteRef', noteId: 1 },
    ]),
    para([
      { type: 'commentStart', commentId: 0 }, run('commenté'), { type: 'commentEnd', commentId: 0 }, { type: 'commentRef', commentId: 0 },
      { type: 'text', text: ' ajouté', props: {}, revision: { kind: 'insert', id: 10, author: 'Alice', date: '2026-03-01T10:00:00Z' } },
      { type: 'text', text: ' retiré', props: {}, revision: { kind: 'delete', id: 11, author: 'Bob', date: '2026-03-02T10:00:00Z' } },
    ]),
    para([
      { type: 'image', mediaId: 'image1.png', width: 72, height: 36, alt: 'Logo Forge', title: 'Logo', name: 'Image 1' },
      { type: 'image', mediaId: 'image1.png', width: 100, height: 50, alt: 'Flottante', floating: {
        horizontal: { relativeTo: 'margin', align: 'right' }, vertical: { relativeTo: 'paragraph', offset: 12 }, wrap: 'square', wrapSide: 'bothSides',
        behindText: false, distance: { top: 0, right: 9, bottom: 0, left: 9 }, allowOverlap: true, zIndex: 2,
      } },
      { type: 'equation', omml, display: false, text: 'x=2' },
    ]),
    {
      type: 'table', styleId: 'TableGrid', props: { width: { value: 100, type: 'pct' }, alignment: 'center', layout: 'fixed' }, grid: [120, 120, 120],
      rows: [
        { props: { header: true, cantSplit: true }, cells: [cell('Entête fusionnée', { gridSpan: 2, shading: { fill: 'DDEBF7', pattern: 'clear', color: 'auto' } }), cell('C', { vMerge: 'restart' })] },
        { props: { height: { value: 20, rule: 'atLeast' } }, cells: [cell('A2', { verticalAlign: 'center' }), cell('B2'), cell('', { vMerge: 'continue' })] },
      ],
    },
    { type: 'contentControl', props: { kind: 'plainText', id: 7, tag: 'champ', alias: 'Nom' }, blocks: [para('Valeur du contrôle')] },
    { ...para('Fin de la section portrait'), sectionBreak: { ...landscape, orientation: 'portrait', pageWidth: 595.3, pageHeight: 841.9 } },
    para('Section paysage'),
  ];
  doc.finalSection = { ...landscape, columns: { count: 2, space: 36, equalWidth: true, separator: true }, titlePage: true, headers: { default: 'header1', first: 'header2' }, footers: { default: 'footer1' }, pageNumbering: { start: 3, format: 'lowerRoman' } };
  doc.headersFooters = {
    header1: { id: 'header1', kind: 'header', blocks: [para('En-tête courant')] },
    header2: { id: 'header2', kind: 'header', blocks: [para('En-tête première page')] },
    footer1: { id: 'footer1', kind: 'footer', blocks: [para([run('Page '), { type: 'field', instruction: 'PAGE', code: 'PAGE', result: [run('3')] }])] },
  };
  doc.footnotes = [{ id: 1, blocks: [para([{ type: 'noteMark', kind: 'footnote' }, run(' Texte de la note')])] }];
  doc.endnotes = [{ id: 1, blocks: [para([{ type: 'noteMark', kind: 'endnote' }, run(' Note de fin')])] }];
  doc.comments = [
    { id: 0, author: 'Alice', initials: 'AL', date: '2026-03-01T09:00:00Z', blocks: [para('Premier commentaire')] },
    { id: 1, author: 'Bob', initials: 'BO', date: '2026-03-01T09:30:00Z', blocks: [para('Réponse')], parentId: 0, done: true },
  ];
  return doc;
}

/** Paquet .docx ecrit a la main (fixture) : `body` est le contenu XML de w:body. */
export async function docxFixture(body: string, extra: { rels?: string; parts?: Record<string, string | Uint8Array> } = {}): Promise<Uint8Array> {
  const w = new PackageWriter();
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>${body}</w:body></w:document>`;
  w.addBytes('word/document.xml', new TextEncoder().encode(xml), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml');
  w.addRelationship('', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument', 'word/document.xml', false, 'rId1');
  for (const [path, content] of Object.entries(extra.parts ?? {})) {
    if (typeof content === 'string') w.addBytes(path, new TextEncoder().encode(content), 'application/xml');
    else w.addBytes(path, content);
  }
  if (extra.rels) {
    for (const m of extra.rels.matchAll(/<Relationship ([^>]*)\/>/g)) {
      const a = (n: string): string => m[1]?.match(new RegExp(`${n}="([^"]*)"`))?.[1] ?? '';
      w.addRelationship('word/document.xml', a('Type'), a('Target'), a('TargetMode') === 'External', a('Id'));
    }
  }
  return w.build();
}
