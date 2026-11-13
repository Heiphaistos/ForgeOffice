// Disposition LibreOffice / OpenOffice active (attribut `data-layout` de <html>), suivie en direct avec le theme.
import { useSyncExternalStore } from 'react';

export type SuiteKind = 'libreoffice' | 'openoffice';

export function suiteKindNow(): SuiteKind | null {
  const l = document.documentElement.dataset.layout;
  return l === 'libreoffice' || l === 'openoffice' ? l : null;
}

function subscribe(cb: () => void): () => void {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-layout', 'data-theme'] });
  return () => mo.disconnect();
}

export function useSuiteKind(): SuiteKind | null {
  return useSyncExternalStore(subscribe, suiteKindNow, () => null);
}
