// Choix des services : coquille Tauri (bureau, mobile) ou navigateur.
import { createWebServices, type Services } from '@forgeoffice/core';

export async function createServices(): Promise<Services> {
  if ('__TAURI_INTERNALS__' in window) {
    const { createTauriServices } = await import('./tauri.ts');
    return createTauriServices();
  }
  return createWebServices(__FO_VERSION__);
}
