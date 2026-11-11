// Menus « LibreOffice / OpenOffice » : les groupes du ruban redistribues dans les menus habituels de ces suites
// (Edition, Affichage, Insertion, Format...). Aucune commande n'est perdue : un groupe non liste va dans le dernier menu.
import type { AppId } from '@forgeoffice/core';
import type { MenuItem, RibbonTab } from '../ribbon-types.ts';
import { groupsToMenu } from './commands.ts';

/** `from` : « onglet » (tous ses groupes) ou « onglet.groupe ». Un groupe nomme l'emporte sur son onglet. */
export interface MenuSpec {
  id: string;
  label: string;
  from: readonly string[];
}

export interface BuiltMenu {
  id: string;
  label: string;
  items: MenuItem[];
}

export interface SuiteLayoutSpec {
  menus: readonly MenuSpec[];
  /** Barres d'outils de l'onglet principal : groupes (« onglet.groupe ») de chaque rangee, dans l'ordre. */
  toolbars: readonly (readonly string[])[];
}

const WRITER: SuiteLayoutSpec = {
  menus: [
    { id: 'edit', label: 'Édition', from: ['home.clipboard', 'home.editing', 'review.tracking', 'review.changes', 'review.compare'] },
    { id: 'view', label: 'Affichage', from: ['view', 'outline'] },
    { id: 'insert', label: 'Insertion', from: ['insert.pages', 'insert.illustrations', 'insert.links', 'insert.comments', 'insert.hf', 'insert.text', 'insert.symbols', 'draw', 'references'] },
    { id: 'format', label: 'Format', from: ['home.font', 'home.paragraph', 'layout', 'design', 'picture', 'shape'] },
    { id: 'styles', label: 'Styles', from: ['home.styles'] },
    { id: 'table', label: 'Tableau', from: ['insert.tables', 'tableDesign', 'tableLayout'] },
    { id: 'tools', label: 'Outils', from: ['review.proofing', 'review.language', 'review.protect', 'review.comments', 'mailings'] },
  ],
  toolbars: [
    ['home.clipboard', 'insert.tables', 'insert.illustrations', 'insert.links', 'insert.comments', 'insert.symbols', 'home.editing'],
    ['home.styles', 'home.font', 'home.paragraph'],
  ],
};

const CALC: SuiteLayoutSpec = {
  menus: [
    { id: 'edit', label: 'Édition', from: ['home.clipboard', 'home.editing'] },
    { id: 'view', label: 'Affichage', from: ['view'] },
    { id: 'insert', label: 'Insertion', from: ['insert', 'chartDesign'] },
    { id: 'format', label: 'Format', from: ['home.font', 'home.align', 'home.number', 'layout', 'tableDesign'] },
    { id: 'styles', label: 'Styles', from: ['home.styles'] },
    { id: 'sheet', label: 'Feuille', from: ['home.cells'] },
    { id: 'data', label: 'Données', from: ['data'] },
    { id: 'tools', label: 'Outils', from: ['formulas', 'review'] },
  ],
  toolbars: [['home.clipboard', 'home.editing', 'insert.tables', 'insert.illus', 'insert.charts', 'insert.links', 'insert.symbols'], ['home.styles', 'home.font', 'home.align', 'home.number', 'home.cells']],
};

const IMPRESS: SuiteLayoutSpec = {
  menus: [
    { id: 'edit', label: 'Édition', from: ['home.clipboard', 'home.editing'] },
    { id: 'view', label: 'Affichage', from: ['view', 'master'] },
    { id: 'insert', label: 'Insertion', from: ['insert', 'draw'] },
    { id: 'format', label: 'Format', from: ['home.font', 'home.paragraph', 'home.drawing', 'design', 'shapeFormat', 'pictureFormat', 'tableDesign', 'tableLayout', 'chartDesign'] },
    { id: 'slide', label: 'Diapositive', from: ['home.slides', 'transitions'] },
    { id: 'show', label: 'Diaporama', from: ['slideshow', 'animations'] },
    { id: 'tools', label: 'Outils', from: ['review'] },
  ],
  toolbars: [['home.clipboard', 'home.slides', 'insert.tables', 'insert.images', 'insert.illustrations', 'insert.text', 'home.editing'], ['home.font', 'home.paragraph', 'home.drawing']],
};

const DRAW: SuiteLayoutSpec = {
  menus: [
    { id: 'edit', label: 'Édition', from: ['home.clipboard', 'home.editing'] },
    { id: 'view', label: 'Affichage', from: ['view'] },
    { id: 'insert', label: 'Insertion', from: ['insert'] },
    { id: 'format', label: 'Format', from: ['home.font', 'home.paragraph', 'home.styles', 'home.objects', 'home.arrange', 'textFormat', 'pictureFormat', 'shapeFormat', 'table'] },
    { id: 'page', label: 'Page', from: ['design'] },
    { id: 'tools', label: 'Outils', from: ['review', 'mailings'] },
  ],
  toolbars: [['home.clipboard', 'home.objects', 'insert.tables', 'insert.illustrations', 'home.editing'], ['home.styles', 'home.font', 'home.paragraph', 'home.arrange']],
};

const NOTES: SuiteLayoutSpec = {
  menus: [
    { id: 'edit', label: 'Édition', from: ['home.clip', 'home.hist', 'home.find', 'edit'] },
    { id: 'view', label: 'Affichage', from: ['view'] },
    { id: 'format', label: 'Format', from: ['home.font', 'home.notes'] },
    { id: 'tools', label: 'Outils', from: ['tools', 'home.lang'] },
  ],
  toolbars: [['home.clip', 'home.hist', 'home.find'], ['home.font', 'home.notes', 'home.lang']],
};

const PDF: SuiteLayoutSpec = {
  menus: [
    { id: 'edit', label: 'Édition', from: ['edit'] },
    { id: 'view', label: 'Affichage', from: ['home'] },
    { id: 'comment', label: 'Commentaire', from: ['comment'] },
    { id: 'page', label: 'Page', from: ['organize'] },
    { id: 'tools', label: 'Outils', from: ['protect', 'tools'] },
  ],
  toolbars: [['home.tools', 'home.view', 'home.reading', 'home.nav']],
};

const CONVERT: SuiteLayoutSpec = {
  menus: [
    { id: 'edit', label: 'Fichiers', from: ['home.add'] },
    { id: 'view', label: 'Affichage', from: ['view'] },
    { id: 'convert', label: 'Conversion', from: ['home.target', 'home.options', 'home.run', 'home.results'] },
    { id: 'tools', label: 'Outils', from: ['pdf'] },
  ],
  toolbars: [['home.add', 'home.target', 'home.options', 'home.run', 'home.results']],
};

const BASE: SuiteLayoutSpec = {
  menus: [
    { id: 'edit', label: 'Édition', from: ['home.clip', 'home.sort', 'home.records', 'home.find'] },
    { id: 'view', label: 'Affichage', from: ['home.views', 'preview'] },
    { id: 'insert', label: 'Insertion', from: ['create'] },
    { id: 'format', label: 'Format', from: ['fields', 'tabletab'] },
    { id: 'tools', label: 'Outils', from: ['external', 'tools'] },
  ],
  toolbars: [['home.views', 'home.clip', 'home.sort', 'home.records', 'home.find']],
};

export const SUITE_SPECS: Partial<Record<AppId, SuiteLayoutSpec>> = {
  word: WRITER, excel: CALC, powerpoint: IMPRESS, publisher: DRAW, notes: NOTES, pdf: PDF, convert: CONVERT, access: BASE,
};

/** OpenOffice n'a ni menu « Styles » ni menu « Feuille » : leurs groupes rejoignent « Format » (rien n'est perdu). */
const OPENOFFICE_MERGE: Readonly<Record<string, string>> = { styles: 'format', sheet: 'format' };

export function suiteSpec(app: AppId | null, openOffice = false): SuiteLayoutSpec | null {
  const base = (app && SUITE_SPECS[app]) || null;
  if (!base || !openOffice) return base;
  const menus: MenuSpec[] = [];
  for (const m of base.menus) {
    const into = OPENOFFICE_MERGE[m.id];
    const target = into ? menus.find((x) => x.id === into) ?? base.menus.find((x) => x.id === into) : undefined;
    if (into && target) {
      const merged = menus.find((x) => x.id === into);
      if (merged) merged.from = [...merged.from, ...m.from];
      else menus.push({ ...m, id: into, label: target.label });
    } else menus.push({ ...m, from: [...m.from] });
  }
  return { menus, toolbars: base.toolbars };
}

/** Menu (identifiant) d'un groupe : l'entree « onglet.groupe » prime sur « onglet » ; sinon le dernier menu. */
export function menuOf(spec: SuiteLayoutSpec, tabId: string, groupId: string): string {
  const exact = spec.menus.find((m) => m.from.includes(`${tabId}.${groupId}`));
  if (exact) return exact.id;
  const byTab = spec.menus.find((m) => m.from.includes(tabId));
  return (byTab ?? spec.menus[spec.menus.length - 1])!.id;
}

/** Menus de la barre : un sous-menu par groupe (mots de la suite), tous les groupes des onglets visibles. */
export function buildMenus(spec: SuiteLayoutSpec, tabs: readonly RibbonTab[]): BuiltMenu[] {
  const visible = tabs.filter((t) => !t.hidden);
  return spec.menus.map((menu) => {
    const order = (tabId: string, groupId: string): number => {
      const exact = menu.from.indexOf(`${tabId}.${groupId}`);
      return exact >= 0 ? exact : menu.from.indexOf(tabId);
    };
    const parts: { tab: RibbonTab; group: string; rank: number }[] = [];
    for (const tab of visible) for (const g of tab.groups) if (menuOf(spec, tab.id, g.id) === menu.id) parts.push({ tab, group: g.id, rank: order(tab.id, g.id) });
    parts.sort((a, b) => (a.rank < 0 ? 999 : a.rank) - (b.rank < 0 ? 999 : b.rank));
    const items: MenuItem[] = [];
    for (const p of parts) items.push(...groupsToMenu(p.tab, [p.group]));
    // Deux groupes de meme nom dans un menu : l'onglet d'origine les distingue.
    const count = new Map<string, number>();
    for (const i of items) count.set(i.label ?? '', (count.get(i.label ?? '') ?? 0) + 1);
    const named = items.map((i): MenuItem => {
      if ((count.get(i.label ?? '') ?? 0) < 2) return i;
      const tab = visible.find((t) => i.id?.startsWith(`grp:${t.id}:`));
      return tab ? { ...i, label: `${i.label} (${tab.label})` } : i;
    });
    return { id: menu.id, label: menu.label, items: named };
  });
}

/** Groupes de l'onglet principal par rangee de barre d'outils ; les groupes non listes rejoignent la derniere rangee. */
export function toolbarRows(spec: SuiteLayoutSpec, tabs: readonly RibbonTab[]): { tab: RibbonTab; groups: RibbonTab['groups'] }[][] {
  const main = tabs.find((t) => !t.contextual && !t.hidden);
  const visible = tabs.filter((t) => !t.hidden);
  const find = (ref: string): { tab: RibbonTab; group: RibbonTab['groups'][number] } | null => {
    const [tabId, groupId] = ref.split('.');
    const tab = visible.find((t) => t.id === tabId);
    const group = tab?.groups.find((g) => g.id === groupId && !g.hidden);
    return tab && group ? { tab, group } : null;
  };
  const used = new Set<string>();
  const rows = spec.toolbars.map((refs) => {
    const out: { tab: RibbonTab; groups: RibbonTab['groups'] }[] = [];
    for (const ref of refs) {
      const hit = find(ref);
      if (!hit) continue;
      used.add(ref);
      out.push({ tab: hit.tab, groups: [hit.group] });
    }
    return out;
  });
  if (main) {
    const rest = main.groups.filter((g) => !g.hidden && !used.has(`${main.id}.${g.id}`));
    if (rest.length > 0) (rows[rows.length - 1] ?? (rows[rows.push([]) - 1])!).push({ tab: main, groups: rest });
  }
  return rows.filter((r) => r.length > 0);
}
