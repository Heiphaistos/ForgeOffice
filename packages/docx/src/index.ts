// @forgeoffice/docx : modele de document Texte + lecture/ecriture .docx, .docm, .dotx, .rtf, .odt, .html, .md, .txt, .doc.
export * from './model.ts';
export * from './units.ts';
export * from './blank.ts';
export * from './text.ts';
export * from './resolve.ts';
export { sanitizeUrl, DEFAULT_READ_LIMITS, type ReadLimits } from './security.ts';
export { BUILTIN_STYLE_NAMES, FORMAT_LABELS } from './strings.ts';
export { readDocx, DocxError, looksLikeZip, type ReadDocxOptions } from './docx/reader.ts';
export { writeDocx, type WriteDocxOptions } from './docx/writer.ts';
