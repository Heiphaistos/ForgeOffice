// Info-touches (Alt) fidelees a Excel 365 en francais, relevees par UI Automation (docs/parite/EXCEL.md 1.0) :
// Fichier F, Accueil L, Insertion S, Mise en page P, Formules U, Donnees E accent aigu, Revision R, Affichage N, Aide U accent grave, Dites-nous Q.
// Les commandes sans entree ici gardent l'attribution automatique du ruban (lettre unique tiree du libelle).
import type { RibbonControl, RibbonGroup, RibbonTab } from '@forgeoffice/ui';

/** Info-touche de chaque onglet, par identifiant d'onglet. */
export const TAB_KEYTIPS: Readonly<Record<string, string>> = {
  home: 'L', insert: 'S', layout: 'P', formulas: 'U', data: 'É', review: 'R', view: 'N', help: 'Ù',
};

/** Info-touches releves sous un onglet (« Alt, S, V » = Tableau croise dynamique ; « Alt, N, N » = Normal), cle `onglet/commande`. */
export const CONTROL_KEYTIPS: Readonly<Record<string, string>> = {
  'insert/pivot': 'V',
  'view/normal': 'N',
};

const withControl = (tab: string, c: RibbonControl): RibbonControl => {
  if (c.kind === 'row') return { ...c, controls: c.controls.map((x) => withControl(tab, x)) };
  const keytip = CONTROL_KEYTIPS[`${tab}/${c.id}`];
  return keytip ? ({ ...c, keytip } as RibbonControl) : c;
};

const withGroup = (tab: string, g: RibbonGroup): RibbonGroup => ({ ...g, controls: g.controls.map((c) => withControl(tab, c)) });

/** Pose les info-touches d'Excel FR sur les onglets (et commandes connues) ; ne modifie pas les onglets recus. */
export function applyKeytips(tabs: readonly RibbonTab[]): RibbonTab[] {
  return tabs.map((t) => {
    const keytip = TAB_KEYTIPS[t.id] ?? t.keytip;
    return { ...t, ...(keytip ? { keytip } : {}), groups: t.groups.map((g) => withGroup(t.id, g)) };
  });
}
