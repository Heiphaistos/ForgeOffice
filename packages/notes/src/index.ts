// Bloc-notes de ForgeOffice (reecriture de WinNote) : exporte { info, App } (contrat AppModule de @forgeoffice/core).
import { MODULES } from '@forgeoffice/core';
import { NotesApp } from './NotesApp.tsx';

export const info = MODULES.notes;
export const App = NotesApp;
