// Actions de l'application (fichiers, insertions, revision, publipostage...) appelees par le ruban, les raccourcis et les volets.
import { TextSelection, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Schema } from 'prosemirror-model';
import { MODULES, type NoticeKind, type Services } from '@forgeoffice/core';
import {
  decodeText, readDocument, sanitizeUrl, styleDisplayName, writeDocument, type Block, type Comment, type DocumentFormat, type Field,
  type HeaderFooter, type Inline, type MediaItem, type Note, type Paragraph, type Section, type WordDocument, type WritableFormat,
} from '@forgeoffice/docx';
import { T } from '../strings.ts';
import { blocksFromPM, blocksToPM, documentFromPM } from '../editor/convert.ts';
import { applyStyle as applyStyleCmd, createTable, insertBlocks, insertInline, insertPageBreak, selectedParagraphs, setList, setParagraph } from '../editor/commands.ts';
import { ensureStyle } from '../editor/css.ts';
import { searchKey } from '../editor/plugins.ts';
import { findMatches } from '../editor/find.ts';
import { resolveRevisions, revisionPositions } from '../editor/track.ts';
import { ensureList, restartList, type ListSpec } from '../features/lists.ts';
import { compareBlocks } from '../features/compare.ts';
import { fillBlocks, mergeAll, mergeField, mergeFieldName, parseCsv, type Csv } from '../features/merge.ts';
import { collectHeadings, tocAnchor, tocBlocks } from '../features/toc.ts';
import { coverPage, TEMPLATES } from '../features/templates.ts';
import type { Actions, DialogId, UiState } from './types.ts';

export interface DocInfo {
  name: string;
  path: string | null;
  format: DocumentFormat;
}

export interface Env {
  services: Services;
  schema: Schema;
  view(): EditorView | null;
  meta(): WordDocument;
  setMeta(m: WordDocument): void;
  ui(): UiState;
  setUi(patch: Partial<UiState>): void;
  info(): DocInfo;
  modified(): boolean;
  markSaved(info: DocInfo): void;
  load(doc: WordDocument, info: DocInfo): void;
  author(): string;
  csv(): Csv | null;
  setCsv(csv: Csv | null): void;
  pageOfPos(pos: number): number;
  extraMedia: Record<string, MediaItem>;
  openDialog(id: DialogId): void;
  notify(message: string, kind?: NoticeKind): void;
  setActiveComment(id: number | null): void;
  setPreview(p: { id: string; type: 'paragraph' | 'character' } | null): void;
  setPainter(p: { state: EditorState; sticky: boolean } | null): void;
  editHeaderFooter(kind: 'header' | 'footer', id: string): void;
  requestPrint(): void;
}

const WRITABLE: readonly WritableFormat[] = ['docx', 'docm', 'dotx', 'dotm', 'odt', 'rtf', 'html', 'md', 'txt'];
export const isWritable = (f: DocumentFormat): f is WritableFormat => (WRITABLE as readonly string[]).includes(f);
const MAX_IMAGE = 20 * 1024 * 1024;
const IMAGE_TYPES: Readonly<Record<string, string>> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };

export const baseName = (name: string): string => name.replace(/\.[^.]+$/, '');

/** Document complet pret a ecrire (corps edite + medias colles + proprietes a jour). */
export function fullDocument(env: Env): WordDocument {
  const meta = env.meta();
  const view = env.view();
  const doc = view ? documentFromPM(view.state.doc, meta) : meta;
  return {
    ...doc,
    media: { ...meta.media, ...env.extraMedia },
    properties: { ...doc.properties, modified: new Date().toISOString(), lastModifiedBy: env.author(), application: 'ForgeOffice Texte', created: doc.properties.created ?? new Date().toISOString(), creator: doc.properties.creator ?? env.author() },
  };
}

function field(code: string, text: string, instruction = code): Field {
  return { type: 'field', instruction: ` ${instruction} `, code, result: [{ type: 'text', text, props: {} }] };
}

/** Copie du document avec des styles integres ajoutes s'ils manquent (sans modifier l'original). */
function withStyles(meta: WordDocument, ids: readonly string[]): WordDocument {
  const next = { ...meta, styles: { ...meta.styles, styles: [...meta.styles.styles] } };
  for (const id of ids) ensureStyle(next, id);
  return next;
}

const p = (inlines: Inline[], props: Paragraph['props'] = {}, styleId?: string): Paragraph => ({ type: 'paragraph', styleId, props, inlines });

export function createActions(env: Env): Actions {
  const { services, schema } = env;
  const view = (): EditorView | null => env.view();
  const run = (fn: (v: EditorView) => void): void => {
    const v = view();
    if (!v) return;
    fn(v);
    v.focus();
  };
  const today = (): string => new Date().toLocaleDateString('fr-FR');
  const textWidth = (): number => {
    const s = env.meta().finalSection;
    return s.pageWidth - s.margins.left - s.margins.right;
  };

  async function writeAs(format: WritableFormat, path: string | null, name: string): Promise<boolean> {
    try {
      const bytes = await writeDocument(fullDocument(env), format);
      const saved = await services.saveFile(bytes, name, [{ name: T.backstage.formatNames[format], extensions: [format] }], path);
      if (!saved) return false;
      if (format !== 'md' && format !== 'html' && format !== 'txt' || path === null) {
        env.markSaved({ name: saved.name, path: saved.path, format });
      }
      if (saved.path) await services.addRecent({ app: 'word', name: saved.name, path: saved.path });
      env.notify(T.app.saved(saved.name), 'success');
      return true;
    } catch (err) {
      env.notify(T.app.saveFailed(err instanceof Error ? err.message : String(err)), 'error');
      return false;
    }
  }

  const modifyMeta = (fn: (m: WordDocument) => WordDocument): void => env.setMeta(fn(env.meta()));

  function headerFooterId(kind: 'header' | 'footer'): string {
    const meta = env.meta();
    const refs = kind === 'header' ? meta.finalSection.headers : meta.finalSection.footers;
    if (refs.default && meta.headersFooters[refs.default]) return refs.default;
    let n = 1;
    while (meta.headersFooters[`fo-${kind}-${n}`]) n++;
    const id = `fo-${kind}-${n}`;
    const hf: HeaderFooter = { id, kind, blocks: [p([], {}, kind === 'header' ? 'Header' : 'Footer')] };
    const section = { ...meta.finalSection, [kind === 'header' ? 'headers' : 'footers']: { ...refs, default: id } };
    env.setMeta(withStyles({ ...meta, headersFooters: { ...meta.headersFooters, [id]: hf }, finalSection: section }, ['Header', 'Footer']));
    return id;
  }

  function setHeaderFooterBlocks(kind: 'header' | 'footer', blocks: Block[]): string {
    const id = headerFooterId(kind);
    modifyMeta((m) => ({ ...m, headersFooters: { ...m.headersFooters, [id]: { id, kind, blocks } } }));
    return id;
  }

  const fieldText = (code: string): string | null => {
    const meta = env.meta();
    switch (code) {
      case 'DATE': return today();
      case 'TIME': return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      case 'AUTHOR': return meta.properties.creator ?? env.author();
      case 'TITLE': return meta.properties.title ?? baseName(env.info().name);
      case 'FILENAME': return env.info().name;
      case 'NUMPAGES': return String(env.pageOfPos(view()?.state.doc.content.size ?? 0));
      default: return null;
    }
  };

  function tocContent(state: EditorState): { blocks: Block[]; bookmarks: { pos: number; name: string }[] } {
    const headings = collectHeadings(state.doc, env.meta(), 3);
    const bookmarks: { pos: number; name: string }[] = [];
    const anchors = headings.map((h, i) => {
      let existing: string | null = null;
      state.doc.nodeAt(h.pos)?.forEach((child) => {
        const d = child.attrs.data as Inline | undefined;
        if (child.type.name === 'atom' && d?.type === 'bookmarkStart' && d.name.startsWith('_Toc')) existing = d.name;
      });
      if (existing) return existing;
      const name = tocAnchor(i + Math.floor(Date.now() % 100000) * 10);
      bookmarks.push({ pos: h.pos, name });
      return name;
    });
    return { blocks: tocBlocks(headings, (pos) => env.pageOfPos(pos), (_, i) => anchors[i] ?? '', T.toc.title), bookmarks };
  }

  function writeToc(replace: boolean, quiet = false): void {
    run((v) => {
      let tocPos = -1;
      v.state.doc.forEach((n, pos) => { if (n.type.name === 'toc' && tocPos < 0) tocPos = pos; });
      if (replace && tocPos < 0) {
        env.notify(T.toc.empty, 'info');
        return;
      }
      const { blocks, bookmarks } = tocContent(v.state);
      const tr = v.state.tr;
      let maxId = 0;
      v.state.doc.descendants((n) => {
        const d = n.attrs.data as Inline | undefined;
        if (n.type.name === 'atom' && d?.type === 'bookmarkStart') maxId = Math.max(maxId, d.id);
        return true;
      });
      for (const b of [...bookmarks].reverse()) {
        const node = v.state.doc.nodeAt(b.pos);
        if (!node) continue;
        const id = ++maxId;
        tr.insert(b.pos + node.nodeSize - 1, schema.nodes.atom!.create({ data: { type: 'bookmarkEnd', id } }));
        tr.insert(b.pos + 1, schema.nodes.atom!.create({ data: { type: 'bookmarkStart', id, name: b.name } }));
      }
      const toc = schema.nodes.toc!.create({ instruction: 'TOC \\o "1-3" \\h \\z \\u' }, blocksToPM(schema, blocks));
      if (tocPos >= 0) {
        const at = tr.mapping.map(tocPos);
        tr.replaceWith(at, at + (tr.doc.nodeAt(at)?.nodeSize ?? 0), toc);
      } else {
        const $from = tr.selection.$from;
        tr.insert($from.depth ? $from.before(1) : 0, toc);
      }
      v.dispatch(tr);
      if (!quiet) env.notify(T.toc.updated, 'success');
      // Les numeros de page ne sont justes qu'apres la pagination du document qui contient la table.
      if (!replace) setTimeout(() => writeToc(true, true), 400);
    });
  }

  const act: Actions = {
    async save() {
      const info = env.info();
      if (!isWritable(info.format) || info.format === 'md' || info.format === 'txt' || info.format === 'html') return act.saveAs('docx');
      await writeAs(info.format, info.path, info.name);
    },
    async saveAs(format = 'docx', name?: string) {
      await writeAs(format, null, `${name ?? baseName(env.info().name)}.${format}`);
    },
    async open() {
      const file = await services.openFile([{ name: MODULES.word.name, extensions: MODULES.word.extensions }]);
      if (!file) return;
      if (env.modified()) {
        await services.openDocument(file);
        return;
      }
      try {
        const res = await readDocument(file.bytes, file.name);
        env.load(res.document, { name: file.name, path: file.path, format: res.format });
        if (file.path) await services.addRecent({ app: 'word', name: file.name, path: file.path });
      } catch (err) {
        env.notify(T.app.loadFailed(file.name, err instanceof Error ? err.message : String(err)), 'error');
      }
    },
    newDocument(id) {
      const tpl = TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]!;
      if (env.modified()) {
        services.settings.set('word.pendingTemplate', tpl.id);
        void services.openModule('word');
        return;
      }
      env.load(tpl.build(), { name: `${tpl.id === 'blank' ? T.app.untitled : tpl.label}.docx`, path: null, format: 'docx' });
    },
    print: () => env.requestPrint(),
    async exportFile(format) {
      await writeAs(format, null, `${baseName(env.info().name)}.${format}`);
    },
    close: () => services.close(),
    cut: () => run(() => document.execCommand('cut')),
    copy: () => run(() => document.execCommand('copy')),
    async paste(mode) {
      const v = view();
      if (!v) return;
      try {
        if (mode === 'text') v.pasteText(await navigator.clipboard.readText());
        else {
          const items = await navigator.clipboard.read();
          const html = items.find((i) => i.types.includes('text/html'));
          if (html) v.pasteHTML(await (await html.getType('text/html')).text());
          else v.pasteText(await navigator.clipboard.readText());
        }
        v.focus();
      } catch {
        env.notify(T.app.clipboardDenied, 'warning'); // permission refusee : Ctrl+V reste disponible
      }
    },
    formatPainter(sticky) {
      const v = view();
      if (v) env.setPainter({ state: v.state, sticky });
    },
    async insertImage() {
      const file = await services.openFile([{ name: T.cmd.pictures, extensions: Object.keys(IMAGE_TYPES) }]);
      if (!file) return;
      const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
      const type = IMAGE_TYPES[ext];
      if (!type) return env.notify(T.app.imageRefused, 'error');
      if (file.bytes.length > MAX_IMAGE) return env.notify(T.app.imageTooBig, 'error');
      const url = URL.createObjectURL(new Blob([file.bytes.slice().buffer], { type }));
      const img = new Image();
      img.src = url;
      try {
        await img.decode();
      } catch {
        URL.revokeObjectURL(url);
        return env.notify(T.app.imageRefused, 'error');
      }
      URL.revokeObjectURL(url);
      const id = `fo-img-${Date.now().toString(36)}`;
      env.extraMedia[id] = { id, fileName: `${id}.${ext === 'jpg' ? 'jpeg' : ext}`, contentType: type, bytes: file.bytes };
      const w = img.naturalWidth * 0.75;
      const h = img.naturalHeight * 0.75;
      const scale = Math.min(1, textWidth() / Math.max(1, w));
      run((v) => insertInline({ type: 'image', mediaId: id, width: w * scale, height: h * scale, name: file.name, alt: '' })(v.state, v.dispatch));
    },
    insertComment() {
      run((v) => {
        const meta = env.meta();
        const id = meta.comments.reduce((m, c) => Math.max(m, c.id), -1) + 1;
        const { from, to } = v.state.selection;
        const atom = (type: 'commentStart' | 'commentEnd' | 'commentRef') => schema.nodes.atom!.create({ data: { type, commentId: id } });
        const tr = v.state.tr.insert(to, [atom('commentEnd'), atom('commentRef')]).insert(from, atom('commentStart'));
        v.dispatch(tr);
        const comment: Comment = { id, author: env.author(), initials: env.author().slice(0, 2).toUpperCase(), date: new Date().toISOString(), blocks: [p([])] };
        env.setMeta({ ...meta, comments: [...meta.comments, comment] });
        env.setActiveComment(id);
        env.setUi({ pane: 'comments' });
      });
    },
    insertNote(kind) {
      run((v) => {
        const meta = withStyles(env.meta(), ['FootnoteText', 'EndnoteText', 'FootnoteReference', 'EndnoteReference']);
        const list = kind === 'footnote' ? meta.footnotes : meta.endnotes;
        const id = Math.max(0, ...list.map((n) => n.id)) + 1;
        const note: Note = { id, blocks: [p([{ type: 'noteMark', kind }, { type: 'text', text: ' ', props: {} }], {}, kind === 'footnote' ? 'FootnoteText' : 'EndnoteText')] };
        env.setMeta(kind === 'footnote' ? { ...meta, footnotes: [...meta.footnotes, note] } : { ...meta, endnotes: [...meta.endnotes, note] });
        insertInline({ type: kind === 'footnote' ? 'footnoteRef' : 'endnoteRef', noteId: id, props: { vertAlign: 'superscript' } })(v.state, v.dispatch);
        env.setUi({ pane: 'notes' });
      });
    },
    insertToc: () => writeToc(false),
    updateToc: () => writeToc(true),
    removeToc() {
      run((v) => {
        const tr = v.state.tr;
        const ranges: [number, number][] = [];
        v.state.doc.forEach((n, pos) => { if (n.type.name === 'toc') ranges.push([pos, pos + n.nodeSize]); });
        for (const [a, b] of ranges.reverse()) tr.delete(a, b);
        v.dispatch(tr);
      });
    },
    list(spec: ListSpec | null) {
      run((v) => {
        if (!spec) return void setList(0)(v.state, v.dispatch);
        const { doc, numId } = ensureList(env.meta(), spec);
        env.setMeta(doc);
        setList(numId)(v.state, v.dispatch);
      });
    },
    restartNumbering() {
      run((v) => {
        const cur = selectedParagraphs(v.state)[0];
        const num = (cur?.node.attrs.props as Paragraph['props'] | undefined)?.numbering;
        if (!cur || !num) return;
        const { doc, numId } = restartList(env.meta(), num.numId);
        env.setMeta(doc);
        const tr = v.state.tr;
        v.state.doc.descendants((n, pos) => {
          const pp = n.attrs.props as Paragraph['props'] | undefined;
          if (n.type.name === 'paragraph' && pos >= cur.pos && pp?.numbering?.numId === num.numId) tr.setNodeMarkup(pos, undefined, { ...n.attrs, props: { ...pp, numbering: { ...pp.numbering, numId } } });
          return n.type.name !== 'paragraph';
        });
        v.dispatch(tr);
      });
    },
    setSection(patch: Partial<Section>) {
      const meta = env.meta();
      if ('breakType' in patch && patch.breakType) {
        // Saut de section au curseur : le paragraphe courant termine la section, la suivante commence selon le type choisi.
        run((v) => {
          const tr = v.state.tr;
          const $from = v.state.selection.$from;
          if ($from.parent.type.name === 'paragraph') tr.split($from.pos);
          const at = tr.doc.resolve(tr.mapping.map($from.pos, -1));
          const para = at.parent;
          if (para.type.name === 'paragraph') tr.setNodeMarkup(at.before(), undefined, { ...para.attrs, sectionBreak: { ...meta.finalSection } });
          v.dispatch(tr);
        });
        env.setMeta({ ...meta, finalSection: { ...meta.finalSection, breakType: patch.breakType } });
        return;
      }
      env.setMeta({ ...meta, finalSection: { ...meta.finalSection, ...patch } });
      const v = view();
      if (!v) return;
      const tr = v.state.tr;
      v.state.doc.forEach((n, pos) => {
        const sb = n.attrs.sectionBreak as Section | null | undefined;
        if (sb) tr.setNodeMarkup(pos, undefined, { ...n.attrs, sectionBreak: { ...sb, ...patch } });
      });
      if (tr.docChanged) v.dispatch(tr);
    },
    insertCover() {
      run((v) => {
        const meta = env.meta();
        const blocks = coverPage(meta.properties.title || T.cover.title, meta.properties.subject || T.cover.subtitle, meta.properties.creator ?? env.author());
        insertBlocks(blocksToPM(schema, blocks), true)(v.state, v.dispatch);
      });
    },
    editHeaderFooter(kind, preset) {
      if (preset) {
        const style = kind === 'header' ? 'Header' : 'Footer';
        const title = env.meta().properties.title || baseName(env.info().name);
        const presets: Record<string, Block[]> = {
          blank: [p([], {}, style)],
          three: [p([{ type: 'tab' }, { type: 'tab' }], {}, style)],
          title: [p([{ type: 'text', text: title, props: {} }], { alignment: 'center' }, style)],
          date: [p([field('DATE', today(), 'DATE \\@ "dd/MM/yyyy"')], { alignment: 'right' }, style)],
        };
        const id = setHeaderFooterBlocks(kind, presets[preset] ?? presets.blank!);
        env.setUi({ view: 'print' });
        env.editHeaderFooter(kind, id);
        return;
      }
      env.setUi({ view: 'print' });
      env.editHeaderFooter(kind, headerFooterId(kind));
    },
    removeHeaderFooter(kind) {
      modifyMeta((m) => {
        const refs = kind === 'header' ? m.finalSection.headers : m.finalSection.footers;
        const hf = { ...m.headersFooters };
        for (const id of Object.values(refs)) if (id) delete hf[id];
        return { ...m, headersFooters: hf, finalSection: { ...m.finalSection, [kind === 'header' ? 'headers' : 'footers']: {} } };
      });
    },
    pageNumbers(where, align, ofTotal) {
      const inlines: Inline[] = ofTotal
        ? [{ type: 'text', text: T.headerFooter.pageLabel, props: {} }, field('PAGE', '1'), { type: 'text', text: T.headerFooter.of, props: {} }, field('NUMPAGES', '1')]
        : [field('PAGE', '1')];
      setHeaderFooterBlocks(where, [p(inlines, { alignment: align }, where === 'header' ? 'Header' : 'Footer')]);
      env.setUi({ view: 'print' });
    },
    insertField(code) {
      const text = fieldText(code) ?? (code === 'PAGE' ? '1' : '');
      run((v) => insertInline(field(code, text, code === 'DATE' ? 'DATE \\@ "dd/MM/yyyy"' : code))(v.state, v.dispatch));
    },
    updateFields() {
      run((v) => {
        const tr = v.state.tr;
        v.state.doc.descendants((n, pos) => {
          const d = n.attrs.data as Inline | undefined;
          if (n.type.name !== 'atom' || d?.type !== 'field') return true;
          const text = fieldText(d.code);
          if (text !== null) tr.setNodeMarkup(pos, undefined, { data: { ...d, result: [{ type: 'text', text, props: {} }] } });
          return false;
        });
        v.dispatch(tr);
      });
    },
    async loadCsv() {
      const file = await services.openFile([{ name: 'CSV', extensions: ['csv', 'tsv', 'txt'] }]);
      if (!file) return;
      const csv = parseCsv(decodeText(file.bytes));
      if (!csv.rows.length) return env.notify(T.dialogs.mergeNone, 'warning');
      env.setCsv(csv);
      env.notify(T.dialogs.mergeLoaded(csv.rows.length, csv.headers.length), 'success');
    },
    setMergeRecord(index) {
      const csv = env.csv();
      if (!csv) return;
      const i = Math.max(-1, Math.min(csv.rows.length - 1, index));
      env.setUi({ mergeRecord: i });
      run((v) => {
        const tr = v.state.tr.setMeta('addToHistory', false).setMeta('fo-notrack', true);
        v.state.doc.descendants((n, pos) => {
          const d = n.attrs.data as Inline | undefined;
          if (n.type.name !== 'atom' || d?.type !== 'field' || d.code !== 'MERGEFIELD') return true;
          const name = mergeFieldName(d.instruction) ?? '';
          const filled = i >= 0 ? fillBlocks([p([d])], csv, csv.rows[i]!)[0] : undefined;
          const result = filled?.type === 'paragraph' && filled.inlines[0]?.type === 'field' ? filled.inlines[0].result : mergeField(name).result;
          tr.setNodeMarkup(pos, undefined, { data: { ...d, result } });
          return false;
        });
        v.dispatch(tr);
      });
    },
    finishMerge() {
      const csv = env.csv();
      const v = view();
      if (!csv || !v) return;
      const doc = fullDocument(env);
      const merged = mergeAll(blocksFromPM(v.state.doc), csv);
      env.load({ ...doc, body: merged }, { name: `${baseName(env.info().name)} - fusion.docx`, path: null, format: 'docx' });
      env.notify(T.dialogs.mergeDone(csv.rows.length), 'success');
    },
    insertMergeField(name) {
      run((v) => insertInline(mergeField(name))(v.state, v.dispatch));
    },
    review(decision, all) {
      run((v) => {
        if (all) return v.dispatch(resolveRevisions(v.state, decision));
        const { from, to, empty } = v.state.selection;
        if (!empty) return v.dispatch(resolveRevisions(v.state, decision, from, to));
        const hit = revisionPositions(v.state.doc).find((r) => r.from <= from && r.to >= from);
        if (hit) v.dispatch(resolveRevisions(v.state, decision, hit.from, hit.to));
        act.gotoChange(1);
      });
    },
    gotoChange(dir) {
      run((v) => {
        const list = revisionPositions(v.state.doc);
        const cur = v.state.selection.from;
        const target = dir > 0 ? list.find((r) => r.from > cur) ?? list[0] : [...list].reverse().find((r) => r.to < cur) ?? list[list.length - 1];
        if (target) v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, target.from, target.to)).scrollIntoView());
      });
    },
    gotoComment(dir) {
      run((v) => {
        const starts: { pos: number; id: number }[] = [];
        v.state.doc.descendants((n, pos) => {
          const d = n.attrs.data as Inline | undefined;
          if (n.type.name === 'atom' && d?.type === 'commentStart') starts.push({ pos, id: d.commentId });
          return true;
        });
        const cur = v.state.selection.from;
        const t = dir > 0 ? starts.find((s) => s.pos > cur) ?? starts[0] : [...starts].reverse().find((s) => s.pos < cur - 1) ?? starts[starts.length - 1];
        if (!t) return;
        v.dispatch(v.state.tr.setSelection(TextSelection.near(v.state.doc.resolve(t.pos + 1))).scrollIntoView());
        env.setActiveComment(t.id);
        env.setUi({ pane: 'comments' });
      });
    },
    setTrack(on) {
      modifyMeta((m) => ({ ...m, settings: { ...m.settings, trackRevisions: on } }));
    },
    async compareWith() {
      const file = await services.openFile([{ name: MODULES.word.name, extensions: MODULES.word.extensions }]);
      const v = view();
      if (!file || !v) return;
      try {
        const other = (await readDocument(file.bytes, file.name)).document;
        const result = compareBlocks(other.body, blocksFromPM(v.state.doc), env.author());
        const tr = v.state.tr.replaceWith(0, v.state.doc.content.size, blocksToPM(schema, result)).setMeta('fo-notrack', true);
        v.dispatch(tr);
        env.setUi({ markup: 'all' });
        env.notify(T.dialogs.compareDone(revisionPositions(tr.doc).length), 'success');
      } catch (err) {
        env.notify(T.app.loadFailed(file.name, err instanceof Error ? err.message : String(err)), 'error');
      }
    },
    setPreviewStyle(id) {
      const style = id ? env.meta().styles.styles.find((s) => s.id === id) : undefined;
      env.setPreview(style && (style.type === 'paragraph' || style.type === 'character') ? { id: style.id, type: style.type } : null);
    },
    applyStyle(id) {
      env.setPreview(null);
      const meta = withStyles(env.meta(), [id]);
      if (meta.styles.styles.length !== env.meta().styles.styles.length) env.setMeta(meta);
      const style = meta.styles.styles.find((s) => s.id === id);
      run((v) => applyStyleCmd(id, style?.type === 'character' ? 'character' : 'paragraph')(v.state, v.dispatch));
    },
    createStyle(name) {
      const v = view();
      const meta = env.meta();
      if (!v || !name.trim()) return;
      if (meta.styles.styles.some((s) => styleDisplayName(s).toLowerCase() === name.trim().toLowerCase())) return env.notify(T.dialogs.styleExists, 'warning');
      const para = selectedParagraphs(v.state)[0]?.node;
      const id = `fo${name.replace(/[^A-Za-z0-9]/g, '') || 'Style'}${Date.now() % 10000}`;
      const marks = v.state.selection.$from.marks();
      const runProps: Record<string, unknown> = {};
      for (const m of marks) if (m.type.name.startsWith('rp_') && m.type.name !== 'rp_rest') runProps[m.type.name.slice(3)] = m.attrs.v;
      env.setMeta({
        ...meta,
        styles: { ...meta.styles, styles: [...meta.styles.styles, {
          id, type: 'paragraph', name: name.trim(), basedOn: (para?.attrs.styleId as string | null) ?? 'Normal', next: 'Normal', custom: true, quickFormat: true, uiPriority: 1,
          paragraph: { ...(para?.attrs.props as Paragraph['props'] | undefined) }, run: runProps,
        }] },
      });
      run((vv) => setParagraph({ styleId: id, props: () => ({}) })(vv.state, vv.dispatch));
    },
    insertTable(rows, cols) {
      run((v) => insertBlocks([createTable(schema, rows, cols, textWidth()), schema.nodes.paragraph!.create()])(v.state, v.dispatch));
    },
    insertBlankPage() {
      run((v) => {
        insertPageBreak(v.state, v.dispatch);
        insertPageBreak(v.state, v.dispatch);
      });
    },
    gotoPos(pos) {
      run((v) => {
        const at = Math.max(0, Math.min(pos, v.state.doc.content.size));
        v.dispatch(v.state.tr.setSelection(TextSelection.near(v.state.doc.resolve(at))).scrollIntoView());
        v.dom.ownerDocument.defaultView?.requestAnimationFrame(() => {
          const coords = v.coordsAtPos(v.state.selection.from);
          const scroller = v.dom.closest('.fo-word-canvas');
          if (scroller) scroller.scrollTop += coords.top - scroller.getBoundingClientRect().top - 120;
        });
      });
    },
    findText(text) {
      const v = view();
      if (!v) return;
      const matches = findMatches(v.state.doc, text);
      v.dispatch(v.state.tr.setMeta(searchKey, { matches, current: matches.length ? 0 : -1 }));
      if (matches[0]) act.gotoPos(matches[0].from);
    },
  };
  return act;
}

/** Lien sur la selection (Ctrl+K) : URL sure ou signet interne. */
export function linkMarkAttrs(address: string, tooltip: string): { url: string | null; anchor: string | null; tooltip: string | null } | null {
  const a = address.trim();
  if (a.startsWith('#')) return { url: null, anchor: a.slice(1), tooltip: tooltip || null };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(a) ? a : a.includes('@') && !a.includes('/') ? `mailto:${a}` : `https://${a}`;
  const url = sanitizeUrl(withScheme);
  return url && /^(https?|mailto|tel|ftp):/i.test(url) ? { url, anchor: null, tooltip: tooltip || null } : null;
}
