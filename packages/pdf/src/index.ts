// Module PDF de ForgeOffice : exporte { info, App } (contrat AppModule de @forgeoffice/core).
import { MODULES } from '@forgeoffice/core';
import { PdfApp } from './PdfApp.tsx';

export const info = MODULES.pdf;
export const App = PdfApp;
