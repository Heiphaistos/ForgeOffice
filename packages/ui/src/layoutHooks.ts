// Disposition effective d'un module, suivie en direct (changement fait dans une autre fenetre ou un autre onglet compris).
import { useCallback, useEffect, useState } from 'react';
import type { AppId, Settings } from '@forgeoffice/core';
import type { MenuItem } from './ribbon-types.ts';
import { S } from './strings.ts';
import { LAYOUT_FAMILY, LAYOUT_IDS, resolveLayout, setGlobalLayout, setModuleLayout, type LayoutFamily, type LayoutId } from './logic/layouts.ts';

const CHANNEL = 'fo-layout';
const EVENT = 'fo-layout-change';
/** Profil OnlyOffice : theme d'interface des Desktop Editors (« auto » suit le theme clair / sombre / contraste de la suite). */
export const OO_THEME_SETTING = 'ui.onlyoffice.theme';
export const OO_THEMES = ['auto', 'white', 'dark', 'classic-light', 'classic-dark', 'contrast-dark', 'gray'] as const;
export type OoTheme = (typeof OO_THEMES)[number];
const LEGACY_HEADER = 'ui.onlyoffice.header';
const ooTheme = (settings: Settings | null | undefined): OoTheme => {
  const v = settings?.get<unknown>(OO_THEME_SETTING, null);
  if (typeof v === 'string' && (OO_THEMES as readonly string[]).includes(v)) return v as OoTheme;
  // Ancien reglage « en-tete » : coloree = Classique clair, claire = Clair.
  const old = settings?.get<unknown>(LEGACY_HEADER, null);
  return old === 'colored' ? 'classic-light' : old === 'light' ? 'white' : 'auto';
};
/** Theme OnlyOffice effectif : le choix, ou celui qui correspond au theme de la suite. */
function resolveOoTheme(choice: OoTheme): Exclude<OoTheme, 'auto'> {
  if (choice !== 'auto') return choice;
  const t = document.documentElement.dataset.theme;
  return t === 'dark' ? 'dark' : t === 'contrast' ? 'contrast-dark' : 'white';
}

/** Theme OnlyOffice choisi (page Parametres avances du Fichier). */
export const getOoTheme = ooTheme;
export function setOoTheme(settings: Settings, theme: OoTheme): void {
  settings.set(OO_THEME_SETTING, theme);
  announce();
}

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
  const [ooChoice, setOoChoice] = useState<OoTheme>(() => ooTheme(settings));
  const refresh = useCallback(() => {
    setLayout(resolveLayout(settings, app));
    setOoChoice(ooTheme(settings));
  }, [settings, app]);
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
  useEffect(() => {
    const root = document.documentElement;
    const apply = (): void => {
      root.dataset.ooTheme = resolveOoTheme(ooChoice);
    };
    apply();
    // « auto » : le theme de la suite peut changer a tout moment.
    const mo = new MutationObserver(apply);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [ooChoice]);
  return { layout, family: LAYOUT_FAMILY[layout] };
}

/** Sous-menu « Disposition » (liste de toutes les dispositions, la courante cochee) : disponible dans tous les modules. */
export function layoutMenuItem(settings: Settings | null | undefined, current: LayoutId, disabled = false): MenuItem {
  const ooItems: MenuItem[] = current === 'onlyoffice' && settings
    ? [
        { id: 'oo-sep', kind: 'separator' },
        ...OO_THEMES.map((t): MenuItem => ({ id: `oo-theme-${t}`, label: `${S.layouts.oo.theme.menu} : ${S.layouts.oo.theme[t]}`, checked: ooTheme(settings) === t, onClick: () => { settings.set(OO_THEME_SETTING, t); announce(); } })),
      ]
    : [];
  return {
    id: 'layout-menu',
    label: S.layouts.menu,
    icon: 'ribbon',
    disabled: disabled || !settings,
    items: [...LAYOUT_IDS.map((id): MenuItem => ({ id: `layout-${id}`, label: S.layouts.names[id], checked: id === current, onClick: () => settings && chooseLayout(settings, id) })), ...ooItems],
  };
}
