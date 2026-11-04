// Tableur de ForgeOffice : exporte { info, App } (contrat AppModule de @forgeoffice/core).
import { MODULES } from '@forgeoffice/core';
import { ExcelApp } from './App.tsx';

export const info = MODULES.excel;
export const App = ExcelApp;
