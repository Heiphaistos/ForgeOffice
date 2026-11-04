// Application Presentation (equivalent PowerPoint) : exporte { info, App } et l'editeur de page reutilisable (canvas).
import { MODULES } from '@forgeoffice/core';
import { PowerPointApp } from './app/App.tsx';

export const info = MODULES.powerpoint;
export const App = PowerPointApp;

export * as canvas from './canvas/index.ts';
