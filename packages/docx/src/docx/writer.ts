// Ecriture d'un fichier .docx / .docm / .dotx / .dotm ouvrable par Word (toutes les parties attendues).
import { el, PackageWriter } from '@forgeoffice/opc';
import type { Block, Note, Paragraph, WordDocument, WordFileKind } from '../model.ts';
import { statistics } from '../text.ts';
import { CONTENT_NS, CT, REL } from './ns.ts';
import { ContentWriter, PackageState, PartWriter } from './write-body.ts';
import {
  appXml, coreXml, customXml, fontTableXml, numberingXml, settingsXml, stylesXml, webSettingsXml,
} from './write-parts.ts';
import { themeXml } from './theme-xml.ts';
import { sectionXml } from './write-props.ts';

export interface WriteDocxOptions {
  /** Variante a produire (defaut : celle du document). Les macros ne sont gardees qu'en docm / dotm. */
  kind?: WordFileKind;
}

const MAIN_TYPES: Readonly<Record<WordFileKind, string>> = {
  docx: CT.document, docm: CT.documentMacro, dotx: CT.template, dotm: CT.templateMacro,
};

const separatorNote = (id: number, kind: 'separator' | 'continuationSeparator'): Note => ({
  id, special: kind, blocks: [{ type: 'paragraph', props: { spacingAfter: 0, lineSpacing: { rule: 'auto', value: 1 } }, inlines: [] }],
});

/** Paragraphes a identifier par w14:paraId (dernier paragraphe de chaque commentaire). */
function commentParaIds(doc: WordDocument): { ids: Map<Paragraph, string>; byComment: Map<number, string>; blocks: Map<number, Block[]> } {
  const ids = new Map<Paragraph, string>();
  const byComment = new Map<number, string>();
  const blocks = new Map<number, Block[]>();
  for (const comment of doc.comments) {
    const list: Block[] = comment.blocks.some((b) => b.type === 'paragraph') ? comment.blocks : [...comment.blocks, { type: 'paragraph', props: {}, inlines: [] }];
    blocks.set(comment.id, list);
    const paragraphs = list.filter((b): b is Paragraph => b.type === 'paragraph');
    const last = paragraphs[paragraphs.length - 1];
    if (!last) continue;
    const id = (0x10000000 + comment.id + 1).toString(16).toUpperCase().padStart(8, '0');
    ids.set(last, id);
    byComment.set(comment.id, id);
  }
  return { ids, byComment, blocks };
}

/** Ecrit le document au format Word Open XML. */
export async function writeDocx(doc: WordDocument, options: WriteDocxOptions = {}): Promise<Uint8Array> {
  const kind = options.kind ?? doc.kind;
  const macros = kind === 'docm' || kind === 'dotm';
  const writer = new PackageWriter();
  const state = new PackageState(writer, doc);
  const main = 'word/document.xml';
  const preservedDoc = doc.preserved.filter((p) => p.source === 'document' && (macros || !p.rel.type.endsWith('/vbaProject')));
  const mainPart = new PartWriter(state, main, preservedDoc.map((p) => p.rel.id));
  writer.setDefault('bin', CT.vba);

  // Relations du paquet.
  writer.addRelationship('', REL.officeDocument, main, false, 'rId1');
  writer.addRelationship('', REL.coreProps, 'docProps/core.xml', false, 'rId2');
  writer.addRelationship('', REL.extendedProps, 'docProps/app.xml', false, 'rId3');
  const hasCustom = Object.keys(doc.properties.custom).length > 0;
  if (hasCustom) writer.addRelationship('', REL.customProps, 'docProps/custom.xml', false, 'rId4');
  let packageRel = 10;
  for (const p of doc.preserved.filter((x) => x.source === 'package')) {
    if (p.rel.part) state.storePart(p.rel.part);
    writer.addRelationship('', p.rel.type, p.rel.target, p.rel.external, `rId${packageRel++}`);
  }
  for (const p of preservedDoc) {
    if (p.rel.part) state.storePart(p.rel.part);
    writer.addRelationship(main, p.rel.type, p.rel.target, p.rel.external, p.rel.id);
  }

  // Parties structurelles du document principal.
  writer.addXml('word/styles.xml', stylesXml(doc.styles), CT.styles);
  mainPart.rel(REL.styles, 'word/styles.xml');
  writer.addXml('word/settings.xml', settingsXml(doc.settings, { footnotes: doc.footnotes.length > 0, endnotes: doc.endnotes.length > 0 }), CT.settings);
  mainPart.rel(REL.settings, 'word/settings.xml');
  writer.addXml('word/webSettings.xml', webSettingsXml(), CT.webSettings);
  mainPart.rel(REL.webSettings, 'word/webSettings.xml');
  writer.addXml('word/fontTable.xml', fontTableXml(doc), CT.fontTable);
  mainPart.rel(REL.fontTable, 'word/fontTable.xml');
  writer.addBytes('word/theme/theme1.xml', new TextEncoder().encode(themeXml(doc.theme)), CT.theme);
  mainPart.rel(REL.theme, 'word/theme/theme1.xml');
  if (doc.numbering.abstracts.length || doc.numbering.instances.length) {
    writer.addXml('word/numbering.xml', numberingXml(doc.numbering), CT.numbering);
    mainPart.rel(REL.numbering, 'word/numbering.xml');
  }

  // En-tetes et pieds de page.
  const headerRids = new Map<string, string>();
  let counters = { header: 0, footer: 0 };
  for (const hf of Object.values(doc.headersFooters)) {
    counters = { ...counters, [hf.kind]: counters[hf.kind] + 1 };
    const partPath = `word/${hf.kind}${counters[hf.kind]}.xml`;
    const content = new ContentWriter(new PartWriter(state, partPath));
    const blocks: Block[] = hf.blocks.length ? hf.blocks : [{ type: 'paragraph', props: {}, inlines: [] }];
    writer.addXml(partPath, el(hf.kind === 'header' ? 'w:hdr' : 'w:ftr', CONTENT_NS, content.blocks(blocks, 0)), hf.kind === 'header' ? CT.header : CT.footer);
    headerRids.set(hf.id, mainPart.rel(hf.kind === 'header' ? REL.header : REL.footer, partPath));
  }
  const refRid = (id: string): string | undefined => headerRids.get(id);

  // Notes de bas de page / de fin (separateurs Word ajoutes s'ils manquent).
  for (const [list, tag, partPath, type, rel] of [
    [doc.footnotes, 'w:footnote', 'word/footnotes.xml', CT.footnotes, REL.footnotes],
    [doc.endnotes, 'w:endnote', 'word/endnotes.xml', CT.endnotes, REL.endnotes],
  ] as const) {
    if (!list.length) continue;
    const notes = [...list];
    if (!notes.some((n) => n.special === 'separator')) notes.unshift(separatorNote(-1, 'separator'));
    if (!notes.some((n) => n.special === 'continuationSeparator')) notes.splice(1, 0, separatorNote(0, 'continuationSeparator'));
    const content = new ContentWriter(new PartWriter(state, partPath));
    const kids = notes.map((n) => {
      const blocks = content.blocks(n.blocks.length ? n.blocks : [{ type: 'paragraph', props: {}, inlines: [] }], 1);
      if (n.special === 'separator' || n.special === 'continuationSeparator') {
        const first = blocks[0];
        if (first && first.name === 'w:p' && !first.children.some((c) => typeof c !== 'string' && c.name === 'w:r')) {
          first.children.push(el('w:r', {}, [el(n.special === 'separator' ? 'w:separator' : 'w:continuationSeparator')]));
        }
      }
      return el(tag, { 'w:type': n.special, 'w:id': n.id }, blocks);
    });
    writer.addXml(partPath, el(tag === 'w:footnote' ? 'w:footnotes' : 'w:endnotes', CONTENT_NS, kids), type);
    mainPart.rel(rel, partPath);
  }

  // Commentaires et fils de discussion.
  if (doc.comments.length) {
    const { ids, byComment, blocks: commentBlocks } = commentParaIds(doc);
    const content = new ContentWriter(new PartWriter(state, 'word/comments.xml', [], ids));
    writer.addXml('word/comments.xml', el('w:comments', CONTENT_NS, doc.comments.map((c) => el('w:comment', {
      'w:id': c.id, 'w:author': c.author, 'w:date': c.date, 'w:initials': c.initials,
    }, content.blocks(commentBlocks.get(c.id) ?? c.blocks, 1)))), CT.comments);
    mainPart.rel(REL.comments, 'word/comments.xml');
    writer.addXml('word/commentsExtended.xml', el('w15:commentsEx', CONTENT_NS, doc.comments.map((c) => el('w15:commentEx', {
      'w15:paraId': byComment.get(c.id),
      'w15:paraIdParent': c.parentId !== undefined ? byComment.get(c.parentId) : undefined,
      'w15:done': c.done ? '1' : '0',
    }))), CT.commentsExtended);
    mainPart.rel(REL.commentsExtended, 'word/commentsExtended.xml');
  }

  // Corps.
  const body = new ContentWriter(mainPart);
  const bodyKids = body.blocks(doc.body.length ? doc.body : [{ type: 'paragraph', props: {}, inlines: [] }], 0, refRid);
  bodyKids.push(sectionXml(doc.finalSection, refRid));
  writer.addXml(main, el('w:document', CONTENT_NS, [el('w:body', {}, bodyKids)]), MAIN_TYPES[kind]);

  // Proprietes du document.
  const stats = statistics(doc);
  writer.addXml('docProps/core.xml', coreXml(doc.properties), CT.core);
  writer.addXml('docProps/app.xml', appXml(doc.properties, stats), CT.app);
  if (hasCustom) writer.addXml('docProps/custom.xml', customXml(doc.properties.custom), CT.custom);
  return writer.build();
}
