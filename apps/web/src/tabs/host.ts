// Pont entre la page hote et ses cadres d'onglets (meme origine : acces direct, aucun message a serialiser).
import type { OpenedFile, Services } from '@forgeoffice/core';

export interface TabHostApi {
  /** Services de l'onglet `id`. */
  tabServices(id: string): Services;
  /** Fichier confie a l'onglet `id` (lu une seule fois). */
  takeFile(id: string): OpenedFile | null;
  /** Copie des octets dans le contexte de la page hote. */
  hostBytes(bytes: Uint8Array): Uint8Array;
}

declare global {
  interface Window {
    __FO_HOST__?: TabHostApi;
  }
}

/** API de l'hote si cette page est un cadre d'onglet, sinon null. */
export function parentHost(): TabHostApi | null {
  try {
    if (window.parent === window) return null;
    return window.parent.__FO_HOST__ ?? null;
  } catch {
    return null; // parent d'une autre origine : pas un cadre de la suite
  }
}
