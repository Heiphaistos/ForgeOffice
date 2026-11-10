// Disposition effective d'un module, suivie en direct (changement fait dans une autre fenetre ou un autre onglet compris).
import { useCallback, useEffect, useState } from 'react';
import type { AppId, Settings } from '@forgeoffice/core';
import type { MenuItem } from './ribbon-types.ts';
import { S } from './strings.ts';
import { LAYOUT_FAMILY, LAYOUT_IDS, resolveLayout, setGlobalLayout, setModuleLayout, type LayoutFamily, type LayoutId } from './logic/layouts.ts';

const CHANNEL = 'fo-layout';
const EVENT = 'fo-layout-change';

function announce(): void {
  window.dispatchEvent(new Event(EVENT));
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage('changed');
    channel.close();
  } catch {
    // BroadcastChannel indisponible : seule la page courante est prevenue
  }
}

/** Ecrit la disposition (globale, ou propre a `app`) et previent toutes les pages ouvertes. */
export function chooseLayout(settings: Settings, layout: LayoutId | null, app?: AppId): void {
  if (app) setModuleLayout(settings, app, layout);
  else if (layout) setGlobalLayout(settings, layout);
  announce();
}

export function useLayout(settings: Settings | null | undefined, app: AppId | null): { layout: LayoutId; family: LayoutFamily } {
  const [layout, setLayout] = useState<LayoutId>(() => resolveLayout(settings, app));
  const refresh = useCallback(() => setLayout(resolveLayout(settings, app)), [settings, app]);
  useEffect(() => {
    refresh();
    window.addEventListener(EVENT, refresh);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = refresh;
    } catch {
      channel = null;
    }
    return () => {
      window.removeEventListener(EVENT, refresh);
      channel?.close();
    };
  }, [refresh]);
  useEffect(() => {
    document.documentElement.dataset.layout = layout;
  }, [layout]);
  return { layout, family: LAYOUT_FAMILY[layout] };
}

/** Sous-menu « Disposition » (liste de toutes les dispositions, la courante cochee) : disponible dans tous les modules. */
export function layoutMenuItem(settings: Settings | null | undefined, current: LayoutId, disabled = false): MenuItem {
  return {
    id: 'layout-menu',
    label: S.layouts.menu,
    icon: 'ribbon',
    disabled: disabled || !settings,
    items: LAYOUT_IDS.map((id): MenuItem => ({ id: `layout-${id}`, label: S.layouts.names[id], checked: id === current, onClick: () => settings && chooseLayout(settings, id) })),
  };
}
