// Validation de ce qu'exporte un paquet d'application (code sans DOM, teste).
import type { AppId, AppModule } from '@forgeoffice/core';

/** Retourne le module s'il exporte { info, App } conforme, sinon null (module pas encore ecrit). */
export function asAppModule(value: unknown, expected: AppId): AppModule | null {
  if (typeof value !== 'object' || value === null) return null;
  const { info, App } = value as { info?: unknown; App?: unknown };
  if (typeof info !== 'object' || info === null) return null;
  if ((info as { id?: unknown }).id !== expected) return null;
  if (typeof App !== 'function' && !(typeof App === 'object' && App !== null && '$$typeof' in App)) return null;
  return value as AppModule;
}

/** Lit ?app= dans l'adresse ; « demo » ouvre la demonstration du ruban. */
export function appFromSearch(search: string, isAppId: (v: string) => boolean): string {
  const raw = new URLSearchParams(search).get('app') ?? 'hub';
  if (raw === 'demo') return 'demo';
  return isAppId(raw) ? raw : 'hub';
}
