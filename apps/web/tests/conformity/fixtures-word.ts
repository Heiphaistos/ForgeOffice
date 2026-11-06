// Document de test riche du module Texte : titres, paragraphes mis en forme, listes, tableau, image, lien, note, commentaire.
import { writeDocx, type Block, type Inline, type RunProps, type Paragraph } from '../../../../packages/docx/src/index.ts';
import { richDocument, para, run, cell } from '../../../../packages/docx/tests/helpers.ts';

const link = (text: string, url: string): Inline => ({ type: 'hyperlink', url, inlines: [run(text)] });

export async function wordFixture(): Promise<Uint8Array> {
  const doc = richDocument();
  const bold = (t: string): Inline => run(t, { bold: true } as RunProps);
  const body: Block[] = [
    para('Rapport de conformité ForgeOffice', {}, 'Heading1'),
    para('Bonjour le monde, ceci est un paragraphe de texte courant pour les essais de mise en forme.'),
    para([bold('Texte en gras '), run('puis italique ', { italic: true }), run('et rouge', { color: { rgb: 'FF0000' } })], { alignment: 'justify' }),
    para('Deuxième titre', {}, 'Heading2'),
    para('Premier point de liste', { numbering: { numId: 2, level: 0 } }),
    para('Deuxième point de liste', { numbering: { numId: 2, level: 0 } }),
    para('Premier numéro', { numbering: { numId: 1, level: 0 } }),
    para('Deuxième numéro', { numbering: { numId: 1, level: 0 } }),
    {
      type: 'table', styleId: 'TableGrid', props: { width: { value: 100, type: 'pct' }, layout: 'fixed' }, grid: [150, 150, 150],
      rows: [
        { props: { header: true }, cells: [cell('Nom', { gridSpan: 2 }), cell('Prix')] },
        { props: {}, cells: [cell('Pomme'), cell('3'), cell('1,20')] },
        { props: {}, cells: [cell('Poire'), cell('5'), cell('2,10')] },
      ],
    },
    para([{ type: 'image', mediaId: 'image1.png', width: 72, height: 36, alt: 'Logo Forge' }]),
    para([run('Voir '), link('le site', 'https://exemple.fr/page'), run(' pour plus de détails.')]),
    para([run('Phrase avec note'), { type: 'footnoteRef', noteId: 1 }, run(' et un '), { type: 'commentStart', commentId: 0 }, run('passage commenté'), { type: 'commentEnd', commentId: 0 }, { type: 'commentRef', commentId: 0 }, run('.')]),
    para([run('Texte suivi : '), { type: 'text', text: 'ajout suivi', props: {}, revision: { kind: 'insert', id: 10, author: 'Alice', date: '2026-03-01T10:00:00Z' } }, { type: 'text', text: ' retrait suivi', props: {}, revision: { kind: 'delete', id: 11, author: 'Bob', date: '2026-03-02T10:00:00Z' } }]),
    para('Dernier paragraphe du document de test.'),
  ] as Paragraph[] as Block[];
  doc.body = body;
  doc.settings.trackRevisions = false;
  doc.finalSection = { ...doc.finalSection, orientation: 'portrait', pageWidth: 595.3, pageHeight: 841.9, columns: { count: 1, space: 36, equalWidth: true }, titlePage: false, headers: {}, footers: {}, pageNumbering: undefined };
  doc.headersFooters = {};
  doc.endnotes = [];
  doc.comments = [{ id: 0, author: 'Alice', initials: 'AL', date: '2026-03-01T09:00:00Z', blocks: [para('Premier commentaire')] }];
  return writeDocx(doc);
}
