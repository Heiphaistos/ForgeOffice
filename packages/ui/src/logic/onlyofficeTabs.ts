// Onglets du profil OnlyOffice : les groupes du ruban redistribues dans l'ordre et sous les noms d'OnlyOffice Desktop Editors
// (Fichier, Accueil, Insertion, Dessin, Mise en page, References, Collaboration, Protection, Affichage...). Meme commandes, autre rangement :
// un groupe non liste garde son onglet d'origine (a la suite), rien n'est perdu.
import type { AppId } from '@forgeoffice/core';
import type { RibbonGroup, RibbonTab } from '../ribbon-types.ts';
import { buildGroups, indexControls, leftovers, type OoGroupSpec } from './onlyofficeLayout.ts';
import { EXCEL_LAYOUT, PDF_LAYOUT, POWERPOINT_LAYOUT } from './onlyofficeSheets.ts';
import { WORD_LAYOUT } from './onlyofficeWord.ts';

/** Description groupe par groupe (OnlyOffice 10.0) des onglets, par module ; absente = groupes du module, redistribues. */
const LAYOUTS: Partial<Record<AppId, Readonly<Record<string, readonly OoGroupSpec[]>>>> = { word: WORD_LAYOUT, excel: EXCEL_LAYOUT, powerpoint: POWERPOINT_LAYOUT, pdf: PDF_LAYOUT };

/** `from` : « onglet » (tous ses groupes) ou « onglet.groupe » (un groupe nomme l'emporte sur son onglet). */
export interface OoTabSpec {
  id: string;
  label: string;
  from: readonly string[];
}

const T = (id: string, label: string, ...from: string[]): OoTabSpec => ({ id, label, from: from.length ? from : [id] });

/** Ordre OnlyOffice (Document Editor, Spreadsheet Editor, Presentation Editor, PDF Editor) ; libelles de l'interface francaise d'OnlyOffice. */
export const ONLYOFFICE_TABS: Partial<Record<AppId, readonly OoTabSpec[]>> = {
  word: [
    T('home', 'Accueil'),
    T('insert', 'Insertion'),
    T('draw', 'Dessiner'),
    T('layout', 'Mise en page', 'layout', 'design'),
    T('references', 'Références'),
    T('review', 'Collaboration', 'review'),
    T('oo-protect', 'Protection', 'review.protect'),
    T('view', 'Affichage'),
    // Le publipostage est un module complementaire d'OnlyOffice : meme place ici.
    T('plugins', 'Modules complémentaires', 'mailings'),
    T('ai', 'Outils IA', 'ai'),
  ],
  excel: [
    T('home', 'Accueil'),
    T('insert', 'Insertion'),
    T('draw', 'Dessiner'),
    T('layout', 'Mise en page'),
    T('formulas', 'Formule'),
    T('data', 'Données'),
    T('review', 'Collaboration', 'review'),
    T('oo-protect', 'Protection', 'review.protect'),
    T('view', 'Affichage'),
    T('plugins', 'Modules complémentaires', 'plugins'),
    T('ai', 'Outils IA', 'ai'),
  ],
  powerpoint: [
    T('home', 'Accueil'),
    T('insert', 'Insertion'),
    T('draw', 'Dessiner'),
    T('design', 'Conception'),
    T('transitions', 'Transitions'),
    T('animations', 'Animation'),
    T('review', 'Collaboration', 'review'),
    T('oo-protect', 'Protection', 'review.protect'),
    // OnlyOffice n'a pas d'onglet Diaporama : ses commandes de presentation rejoignent Affichage.
    T('view', 'Affichage', 'view', 'slideshow'),
    T('plugins', 'Modules complémentaires', 'plugins'),
    T('ai', 'Outils IA', 'ai'),
  ],
  pdf: [
    T('home', 'Accueil'),
    T('comment', 'Commentaire'),
    T('review', 'Collaboration', 'review'),
    T('view', 'Affichage', 'view'),
    T('plugins', 'Modules complémentaires', 'plugins'),
    T('ai', 'Outils IA', 'ai'),
    // Fonctions de la suite sans equivalent OnlyOffice : onglets conserves a la suite.
    T('edit', 'Modifier'),
    T('organize', 'Organiser'),
    T('protect', 'Protection'),
    T('tools', 'Outils'),
  ],

  publisher: [
    T('home', 'Accueil'),
    T('insert', 'Insertion'),
    T('design', 'Création de page'),
    T('mailings', 'Publipostage'),
    T('review', 'Collaboration'),
    T('view', 'Affichage'),
  ],
};

/** Onglet (identifiant du spec) qui recoit un groupe : « onglet.groupe » prime sur « onglet » ; null = non liste. */
export function ooTabOf(specs: readonly OoTabSpec[], tabId: string, groupId: string): string | null {
  const exact = specs.find((s) => s.from.includes(`${tabId}.${groupId}`));
  return (exact ?? specs.find((s) => s.from.includes(tabId)))?.id ?? null;
}

/** Presse-papiers OnlyOffice : colonnes [Copier, Coller] [Couper, Reproduire la mise en forme] (2 rangees). */
const CLIPBOARD_ORDER = ['copy', 'paste', 'cut', 'painter'];
function ooGroup(g: RibbonGroup): RibbonGroup {
  if (!/^clip(board)?$/.test(g.id)) return g;
  const rank = (id: string): number => { const i = CLIPBOARD_ORDER.indexOf(id); return i < 0 ? 99 : i; };
  return { ...g, controls: [...g.controls].sort((a, b) => rank(a.id) - rank(b.id)) };
}

/** Onglets OnlyOffice d'un module. Contextuels et onglets masques : inchanges ; groupes non listes : onglet d'origine, a la suite. */
export function onlyOfficeTabs(app: AppId | null, tabs: readonly RibbonTab[]): readonly RibbonTab[] {
  const specs = app ? ONLYOFFICE_TABS[app] : undefined;
  if (!specs) return tabs;
  const plain = tabs.filter((t) => !t.contextual && !t.hidden);
  const placed = new Map<string, RibbonGroup[]>(specs.map((s) => [s.id, []]));
  const leftover: RibbonTab[] = [];
  for (const tab of plain) {
    const own: RibbonGroup[] = [];
    for (const g of tab.groups) {
      const dest = ooTabOf(specs, tab.id, g.id);
      if (dest) placed.get(dest)?.push(g);
      else own.push(g);
    }
    if (own.length > 0) leftover.push({ ...tab, groups: own });
  }
  // Un onglet nomme garde l'ordre des groupes de son spec (« from »).
  const rank = (s: OoTabSpec, g: RibbonGroup, tabId: string): number => {
    const i = s.from.indexOf(`${tabId}.${g.id}`);
    return i >= 0 ? i : s.from.indexOf(tabId);
  };
  const layouts = app ? LAYOUTS[app] : undefined;
  const index = layouts ? indexControls(plain) : null;
  const used = new Set<import('../ribbon-types.ts').RibbonControl>();
  const built = new Map<string, RibbonGroup[]>();
  if (layouts && index) for (const s of specs) if (layouts[s.id]?.length) built.set(s.id, buildGroups(layouts[s.id]!, index, used, s.id));
  const out: RibbonTab[] = [];
  for (const s of specs) {
    const groups: RibbonGroup[] = [];
    for (const tab of plain) for (const g of tab.groups) if (placed.get(s.id)?.includes(g)) groups.push(g);
    groups.sort((a, b) => rank(s, a, plain.find((t) => t.groups.includes(a))?.id ?? '') - rank(s, b, plain.find((t) => t.groups.includes(b))?.id ?? ''));
    const keytip = plain.find((t) => t.id === s.id)?.keytip;
    const mine = built.get(s.id);
    if (mine) {
      const extra = leftovers(groups, used, s.id);
      // Presse-papiers present sur tous les onglets (OnlyOffice le garde a gauche de la barre d'outils).
      const clip = s.id === 'home' || !index ? null : (['copy', 'paste', 'cut', 'painter'].map((id) => index.get(id)).filter((c): c is import('../ribbon-types.ts').RibbonControl => Boolean(c)));
      const head: RibbonGroup[] = clip && clip.length ? [{ id: 'oo-clip', label: 'Presse-papiers', controls: clip }] : [];
      out.push({ id: s.id, label: s.label, groups: [...head, ...mine, ...(extra ? [extra] : [])], keytip });
      continue;
    }
    if (groups.length === 0) continue;
    out.push({ id: s.id, label: s.label, groups: groups.map(ooGroup), keytip });
  }
  return [...out, ...leftover, ...tabs.filter((t) => t.contextual)];
}
