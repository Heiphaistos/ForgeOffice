// Structure reelle (menus, barres) d'une suite imitee pour un module, ou null si le module n'a pas d'equivalent dans la suite.
import type { AppId } from '@forgeoffice/core';
import { LIBREOFFICE_DATA } from './libreoffice.generated.ts';
import { OPENOFFICE_DATA } from './openoffice.generated.ts';
import type { SuiteData, SuiteKind } from './types.ts';

type CopyApp = keyof typeof LIBREOFFICE_DATA;
const isCopyApp = (app: string | null): app is CopyApp => app === 'word' || app === 'excel' || app === 'powerpoint' || app === 'publisher';

export function suiteData(kind: SuiteKind, app: AppId | null): SuiteData | null {
  if (!isCopyApp(app)) return null;
  return (kind === 'libreoffice' ? LIBREOFFICE_DATA : OPENOFFICE_DATA)[app];
}
