// Convertisseur de ForgeOffice : exporte { info, App } (contrat AppModule) et le pont vers forge-convert,
// les operations pdf-lib et le chargeur pdf.js, reutilises par le module PDF.
import { MODULES } from '@forgeoffice/core';
import { Convert } from './Convert.tsx';

export const info = MODULES.convert;
export const App = Convert;

export * from './native.ts';
export * as pdfOps from './pdf-ops.ts';
export { formatLabel, extensionOf } from './formats.ts';
export { openPdf, renderPage, canvasBytes, pageText } from './pdfjs.ts';
export type { PDFDocumentProxy, PDFPageProxy } from './pdfjs.ts';
