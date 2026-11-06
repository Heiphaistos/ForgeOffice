// Services de l'application accessibles a tout composant du Tableur sans passer par App.tsx : ouvrir un dialogue par identifiant,
// ouvrir un menu contextuel d'un contexte du registre.
import { createContext, useContext, type ReactNode } from 'react';
import type { MenuItem } from '@forgeoffice/ui';
import { buildMenu, openDialog, type DialogId, type DialogMap, type DialogState, type MenuContextId, type MenuEnv, type MenuTarget } from './registry.ts';

/** Contextes dont l'environnement est celui de la grille (l'onglet de feuille a le sien, fourni par SheetTabs). */
export type GridMenuContext = Exclude<MenuContextId, 'sheetTab'>;

export interface ExcelServices {
  openDialog: <K extends DialogId>(id: K, props?: DialogMap[K]) => void;
  /** Ouvre le menu contextuel du contexte au point du clic droit (items construits par les fournisseurs enregistres). */
  openMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }, context: GridMenuContext, target?: MenuTarget) => void;
}

const NONE: ExcelServices = { openDialog: () => undefined, openMenu: () => undefined };
const Ctx = createContext<ExcelServices>(NONE);

export const useExcelServices = (): ExcelServices => useContext(Ctx);

/** Fabrique les services a partir du setter de dialogue, de l'ouverture de menu et de l'environnement des menus de la grille. */
export function makeServices(
  setDialog: (d: DialogState | null) => void,
  showMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuItem[]) => void,
  env: MenuEnv,
): ExcelServices {
  return {
    openDialog: (id, props) => openDialog(setDialog, id, props),
    openMenu: (e, context, target) => showMenu(e, buildMenu(context, env, target)),
  };
}

export function ExcelServicesProvider({ value, children }: { value: ExcelServices; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
