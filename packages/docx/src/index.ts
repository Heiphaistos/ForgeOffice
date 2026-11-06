// @forgeoffice/docx : modele de document Texte + lecture/ecriture .docx, .docm, .dotx, .rtf, .odt, .html, .md, .txt, .doc.
export * from './model.ts';
export * from './units.ts';
export * from './blank.ts';
export * from './text.ts';
export * from './resolve.ts';
export { canonicalStyleName, findStyleId, headingLevelOfStyle } from './style-names.ts';
export { sanitizeUrl, DEFAULT_READ_LIMITS, type ReadLimits } from './security.ts';
export { BUILTIN_STYLE_NAMES, FORMAT_LABELS } from './strings.ts';
export { readDocx, DocxError, looksLikeZip, type ReadDocxOptions } from './docx/reader.ts';
export { writeDocx, type WriteDocxOptions } from './docx/writer.ts';
export { WATERMARK_PROP, PAGE_COLOR_PROP } from './docx/watermark.ts';
export { readDoc, type ReadDocOptions } from './doc/read-doc.ts';
export { readRtf, type ReadRtfOptions } from './rtf/read-rtf.ts';
export { writeRtf } from './rtf/write-rtf.ts';
export { readOdt, type ReadOdtOptions } from './odt/read-odt.ts';
export { writeOdt } from './odt/write-odt.ts';
export { readHtml, type ReadHtmlOptions } from './html/read-html.ts';
export { documentToHtml, writeHtml } from './html/write-html.ts';
export { readMarkdown, type ReadMarkdownOptions } from './md/read-md.ts';
export { documentToMarkdown, writeMarkdown, type WriteMarkdownOptions } from './md/write-md.ts';
export {
  decodeText, detectEncoding, documentToText, encodeText, readText, writeText, type ReadTextOptions, type TextEncoding,
  type WriteTextOptions,
} from './txt.ts';
export {
  detectFormat, DocxPasswordError, readDocument, writeDocument, type DocumentFormat, type ReadDocumentOptions, type WritableFormat,
} from './formats.ts';
