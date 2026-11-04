import { createBlankDocument, plainText } from '../src/index.ts';
import { writeOdt } from '../src/odt/write-odt.ts';
import { readOdt } from '../src/odt/read-odt.ts';
const doc = createBlankDocument();
doc.numbering = { abstracts: [{ id: 1, levels: [{ level: 0, format: 'decimal', text: '%1.', start: 1, alignment: 'left', suffix: 'tab' }, { level: 1, format: 'lowerLetter', text: '%2)', start: 1, alignment: 'left', suffix: 'tab' }] }], instances: [{ id: 1, abstractId: 1, overrides: [] }] };
doc.properties.title = 'Essai';
doc.body = [
  { type: 'paragraph', styleId: 'Heading1', props: {}, inlines: [{ type: 'text', text: 'Titre été', props: {} }] },
  { type: 'paragraph', props: { numbering: { numId: 1, level: 0 } }, inlines: [{ type: 'text', text: 'Un', props: { bold: true } }] },
  { type: 'paragraph', props: { numbering: { numId: 1, level: 1 } }, inlines: [{ type: 'text', text: 'Un a', props: {} }] },
  { type: 'paragraph', props: { alignment: 'center' }, inlines: [{ type: 'text', text: 'deux  espaces', props: { italic: true, color: { rgb: '00FF00' } } }, { type: 'footnoteRef', noteId: 1 }, { type: 'hyperlink', url: 'https://ex.fr', inlines: [{ type: 'text', text: 'lien', props: {} }] }] },
  { type: 'table', props: {}, grid: [100, 100], rows: [{ props: { header: true }, cells: [{ props: { gridSpan: 2 }, blocks: [{ type: 'paragraph', props: {}, inlines: [{ type: 'text', text: 'fusion', props: {} }] }] }] }, { props: {}, cells: [{ props: {}, blocks: [{ type: 'paragraph', props: {}, inlines: [{ type: 'text', text: 'A', props: {} }] }] }, { props: {}, blocks: [{ type: 'paragraph', props: {}, inlines: [{ type: 'text', text: 'B', props: {} }] }] }] }] },
];
doc.footnotes = [{ id: 1, blocks: [{ type: 'paragraph', props: {}, inlines: [{ type: 'noteMark', kind: 'footnote' }, { type: 'text', text: ' la note', props: {} }] }] }];
const bytes = await writeOdt(doc);
const back = await readOdt(bytes);
console.log(JSON.stringify(back.warnings), back.document.properties.title);
console.log(plainText(back.document));
console.log(JSON.stringify(back.document.body.map(b => b.type === 'paragraph' ? [b.styleId, b.props, b.inlines] : b), null, 0).slice(0, 2500));
console.log(JSON.stringify(back.document.footnotes));
