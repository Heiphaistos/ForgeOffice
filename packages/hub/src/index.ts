// Accueil de ForgeOffice : exporte { info, App } (contrat AppModule de @forgeoffice/core).
import { MODULES } from '@forgeoffice/core';
import { Hub } from './Hub.tsx';

export const info = MODULES.hub;
export const App = Hub;
