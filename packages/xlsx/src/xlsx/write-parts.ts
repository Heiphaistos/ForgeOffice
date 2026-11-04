// Ecriture des parties annexes : tableaux, notes (+ VML), commentaires modernes, personnes,
// proprietes du document, metadonnees des matrices dynamiques.
import { el, type XmlElement } from '@forgeoffice/opc';
import { cellName, rangeName } from '../address.ts';
import type { DocumentProperties, Note, Person, Table, ThreadedComment } from '../model.ts';
import { strings } from '../strings.ts';
import { toFileFormula } from './formula-names.ts';
import { NS_MAIN, NS_TC } from './ns.ts';
import { fontEl } from './style-xml.ts';
import { autoFilterEl, sortStateEl } from './write-sheet-rules.ts';
import { escAttr, escXml, textEl } from './xml-util.ts';

export function tableXml(table: Table, id: number): XmlElement {
  const totals = table.totalsRowCount > 0;
  const dataRef = { ...table.ref, r2: table.ref.r2 - (totals ? table.totalsRowCount : 0) };
  const kids: XmlElement[] = [];
  if (table.headerRowCount > 0) {
    kids.push(table.autoFilter ? autoFilterEl({ ...table.autoFilter, ref: dataRef }) : el('autoFilter', { ref: rangeName(dataRef) }));
  }
  if (table.sort) kids.push(sortStateEl(table.sort));
  kids.push(el('tableColumns', { count: table.columns.length }, table.columns.map((c, i) => el('tableColumn', {
    id: i + 1,
    name: c.name,
    totalsRowFunction: c.totalsRowFunction && c.totalsRowFunction !== 'none' ? c.totalsRowFunction : undefined,
    totalsRowLabel: c.totalsRowLabel,
    dataDxfId: c.dataDxfId,
  }, [
    ...(c.calculatedFormula !== undefined ? [el('calculatedColumnFormula', {}, [toFileFormula(c.calculatedFormula)])] : []),
    ...(c.totalsRowFormula !== undefined ? [el('totalsRowFormula', {}, [toFileFormula(c.totalsRowFormula)])] : []),
  ]))));
  if (table.style) {
    kids.push(el('tableStyleInfo', {
      name: table.style.name || undefined,
      showFirstColumn: table.style.showFirstColumn ? '1' : '0',
      showLastColumn: table.style.showLastColumn ? '1' : '0',
      showRowStripes: table.style.showRowStripes ? '1' : '0',
      showColumnStripes: table.style.showColumnStripes ? '1' : '0',
    }));
  }
  return el('table', {
    xmlns: NS_MAIN,
    id,
    name: table.name,
    displayName: table.displayName,
    ref: rangeName(table.ref),
    headerRowCount: table.headerRowCount === 1 ? undefined : table.headerRowCount,
    totalsRowCount: totals ? table.totalsRowCount : undefined,
    totalsRowShown: totals ? undefined : (table.totalsRowShown ? undefined : '0'),
    comment: table.comment,
  }, kids);
}

interface LegacyComment {
  ref: { row: number; col: number };
  author: string;
  note?: Note;
  placeholder?: string;
}

/** Notes + espaces reserves des commentaires modernes (exiges par Excel pour les afficher). */
export function legacyComments(notes: Note[], threads: ThreadedComment[]): LegacyComment[] {
  const list: LegacyComment[] = notes.map((note) => ({ ref: note.ref, author: note.author, note }));
  for (const thread of threads) {
    if (list.some((c) => c.ref.row === thread.ref.row && c.ref.col === thread.ref.col)) continue;
    const replies = thread.replies.map((r) => `\nReponse :    ${r.text}`).join('');
    list.push({ ref: thread.ref, author: `tc=${thread.id}`, placeholder: `${strings.threadedPlaceholder}\n\nCommentaire :\n    ${thread.text}${replies}` });
  }
  return list;
}

export function commentsXml(comments: LegacyComment[]): XmlElement {
  const authors: string[] = [];
  const authorId = (name: string): number => {
    let id = authors.indexOf(name);
    if (id < 0) {
      authors.push(name);
      id = authors.length - 1;
    }
    return id;
  };
  const list = comments.map((c) => {
    const note = c.note;
    const body = note?.rich?.length
      ? note.rich.map((run) => el('r', {}, [...(run.font ? [fontEl('rPr', run.font, true)] : []), textEl('t', run.text)]))
      : [textEl('t', note ? note.text : (c.placeholder ?? ''))];
    return el('comment', { ref: cellName(c.ref.row, c.ref.col), authorId: authorId(c.author), shapeId: 0 }, [el('text', {}, body)]);
  });
  return el('comments', { xmlns: NS_MAIN }, [
    el('authors', {}, authors.map((a) => el('author', {}, [a]))),
    el('commentList', {}, list),
  ]);
}

/** Dessin VML des bulles de notes (format historique toujours exige par Excel). */
export function commentsVml(comments: LegacyComment[], sheetIndex: number): string {
  const block = sheetIndex + 1;
  const shapes = comments.map((c, i) => {
    const note = c.note;
    const width = ((note?.width ?? 144) * 72) / 96;
    const height = ((note?.height ?? 79) * 72) / 96;
    const visible = note?.visible === true;
    const { row, col } = c.ref;
    const anchor = `${col + 1}, 15, ${Math.max(0, row - 1)}, 10, ${col + 3}, 15, ${row + 3}, 4`;
    return `<v:shape id="_x0000_s${block * 1024 + i + 1}" type="#_x0000_t202" style="position:absolute;margin-left:59.25pt;margin-top:1.5pt;`
      + `width:${width.toFixed(2)}pt;height:${height.toFixed(2)}pt;z-index:${i + 1};visibility:${visible ? 'visible' : 'hidden'}" fillcolor="#ffffe1" o:insetmode="auto">`
      + '<v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/>'
      + '<v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox>'
      + `<x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>${anchor}</x:Anchor><x:AutoFill>False</x:AutoFill>`
      + `<x:Row>${row}</x:Row><x:Column>${col}</x:Column>${visible ? '<x:Visible/>' : ''}</x:ClientData></v:shape>`;
  });
  return '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">'
    + `<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="${block}"/></o:shapelayout>`
    + '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/>'
    + '<v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>'
    + `${shapes.join('')}</xml>`;
}

export function threadedXml(threads: ThreadedComment[]): XmlElement {
  const items: XmlElement[] = [];
  for (const thread of threads) {
    const ref = cellName(thread.ref.row, thread.ref.col);
    items.push(el('threadedComment', { ref, dT: thread.date, personId: thread.personId, id: thread.id, done: thread.done ? '1' : undefined }, [
      el('text', {}, [thread.text]),
    ]));
    for (const reply of thread.replies) {
      items.push(el('threadedComment', { ref, dT: reply.date, personId: reply.personId, id: reply.id, parentId: thread.id }, [
        el('text', {}, [reply.text]),
      ]));
    }
  }
  return el('ThreadedComments', { xmlns: NS_TC, 'xmlns:x': NS_MAIN }, items);
}

export function personsXml(persons: Person[]): XmlElement {
  return el('personList', { xmlns: NS_TC, 'xmlns:x': NS_MAIN }, persons.map((p) => el('person', {
    displayName: p.displayName,
    id: p.id,
    userId: p.userId,
    providerId: p.providerId ?? 'None',
  })));
}

export function coreXml(props: DocumentProperties): string {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const item = (tag: string, value: string | undefined): string => (value ? `<${tag}>${escXml(value)}</${tag}>` : '');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
    + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" '
    + 'xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    + item('dc:title', props.title) + item('dc:subject', props.subject) + item('dc:creator', props.creator)
    + item('cp:keywords', props.keywords) + item('dc:description', props.description) + item('cp:lastModifiedBy', props.lastModifiedBy)
    + item('cp:category', props.category) + item('cp:contentStatus', props.contentStatus)
    + `<dcterms:created xsi:type="dcterms:W3CDTF">${escXml(props.created ?? now)}</dcterms:created>`
    + `<dcterms:modified xsi:type="dcterms:W3CDTF">${escXml(props.modified ?? now)}</dcterms:modified>`
    + '</cp:coreProperties>';
}

export function appXml(props: DocumentProperties, sheetNames: string[]): string {
  const item = (tag: string, value: string | undefined): string => (value ? `<${tag}>${escXml(value)}</${tag}>` : '');
  const titles = sheetNames.map((n) => `<vt:lpstr>${escXml(n)}</vt:lpstr>`).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
    + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
    + `<Application>${escXml(props.application ?? 'ForgeOffice Tableur')}</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop>`
    + `<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Feuilles de calcul</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheetNames.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>`
    + `<TitlesOfParts><vt:vector size="${sheetNames.length}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts>`
    + item('Manager', props.manager) + item('Company', props.company)
    + '<LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged>'
    + `<AppVersion>${escXml(props.appVersion ?? '16.0300')}</AppVersion></Properties>`;
}

export function customXml(custom: Record<string, string | number | boolean>): string {
  const items = Object.entries(custom).map(([name, value], i) => {
    const typed = typeof value === 'boolean' ? `<vt:bool>${value}</vt:bool>`
      : typeof value === 'number' ? (Number.isInteger(value) && Math.abs(value) < 2 ** 31 ? `<vt:i4>${value}</vt:i4>` : `<vt:r8>${value}</vt:r8>`)
        : `<vt:lpwstr>${escXml(value)}</vt:lpwstr>`;
    return `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${i + 2}" name="${escAttr(name)}">${typed}</property>`;
  });
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
    + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
    + `${items.join('')}</Properties>`;
}

/** Metadonnees « XLDAPR » referencees par cm="1" sur les formules matricielles dynamiques. */
export const DYNAMIC_ARRAY_METADATA = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
  + `<metadata xmlns="${NS_MAIN}" xmlns:xda="http://schemas.microsoft.com/office/spreadsheetml/2017/dynamicarray">`
  + '<metadataTypes count="1"><metadataType name="XLDAPR" minSupportedVersion="120000" copy="1" pasteAll="1" pasteValues="1" merge="1" '
  + 'splitFirst="1" rowColShift="1" clearFormats="1" clearComments="1" assign="1" coerce="1" cellMeta="1"/></metadataTypes>'
  + '<futureMetadata name="XLDAPR" count="1"><bk><extLst><ext uri="{bdbb8cdc-fa1e-496e-a857-3c3f30c029c3}">'
  + '<xda:dynamicArrayProperties fDynamic="1" fCollapsed="0"/></ext></extLst></bk></futureMetadata>'
  + '<cellMetadata count="1"><bk><rc t="1" v="0"/></bk></cellMetadata></metadata>';
