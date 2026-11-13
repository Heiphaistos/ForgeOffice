// Profil OnlyOffice : ordre et noms des onglets d'OnlyOffice Desktop Editors, aucun groupe du ruban perdu.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { RibbonGroup, RibbonTab } from '../src/ribbon-types.ts';
import { ONLYOFFICE_TABS, onlyOfficeTabs, ooTabOf } from '../src/logic/onlyofficeTabs.ts';

const docs = new URL('../../../docs/conformite/', import.meta.url);

/** Onglets permanents de chaque module (les autres entrees du banc de conformite sont des onglets contextuels : tableau, image, forme...). */
const PLAIN: Record<string, string[]> = {
  word: ['home', 'insert', 'draw', 'design', 'layout', 'references', 'mailings', 'review', 'view'],
  excel: ['home', 'insert', 'layout', 'formulas', 'data', 'review', 'view'],
  powerpoint: ['home', 'insert', 'draw', 'design', 'transitions', 'animations', 'review', 'view'],
  pdf: ['home', 'comment', 'edit', 'organize', 'protect', 'tools'],
  publisher: ['home', 'insert', 'design', 'mailings', 'review', 'view'],
  notes: ['home', 'edit', 'view', 'tools'],
};

/** Onglets et groupes d'un module d'apres le banc de conformite (identifiants `onglet.groupe.commande`). */
function tabsOf(app: string): RibbonTab[] {
  const data = JSON.parse(readFileSync(new URL(`${app}.json`, docs), 'utf8')) as { commandes: { id: string }[] };
  const order: string[] = [];
  const groups = new Map<string, string[]>();
  for (const c of data.commandes) {
    const [t, g] = c.id.split('.');
    if (!t || !g || !PLAIN[app]?.includes(t)) continue;
    if (!groups.has(t)) { groups.set(t, []); order.push(t); }
    if (!groups.get(t)!.includes(g)) groups.get(t)!.push(g);
  }
  return order.map((id) => ({ id, label: id, groups: groups.get(id)!.map((g): RibbonGroup => ({ id: g, label: g, controls: [] })) }));
}

const WANT: Record<string, string[]> = {
  word: ['Accueil', 'Insertion', 'Dessiner', 'Mise en page', 'Références', 'Collaboration', 'Protection', 'Affichage', 'Modules complémentaires', 'Outils IA'],
  excel: ['Accueil', 'Insertion', 'Dessiner', 'Mise en page', 'Formule', 'Données', 'Collaboration', 'Protection', 'Affichage', 'Modules complémentaires', 'Outils IA'],
  powerpoint: ['Accueil', 'Insertion', 'Dessiner', 'Conception', 'Transitions', 'Animation', 'Collaboration', 'Protection', 'Affichage', 'Modules complémentaires', 'Outils IA'],
  pdf: ['Accueil', 'Commentaire', 'Collaboration', 'Affichage', 'Modules complémentaires', 'Outils IA', 'Modifier', 'Organiser', 'Protection', 'Outils'],
  publisher: ['Accueil', 'Insertion', 'Création de page', 'Publipostage', 'Collaboration', 'Affichage'],
};

for (const [app, want] of Object.entries(WANT)) {
  test(`${app} : onglets dans l'ordre OnlyOffice`, () => {
    const out = onlyOfficeTabs(app as never, tabsOf(app));
    const got = out.filter((t) => !t.contextual).map((t) => t.label);
    // Les onglets du module sans equivalent OnlyOffice suivent, jamais ne precedent.
    assert.deepEqual(got.slice(0, want.length), want);
  });

  // Les modules decrits groupe par groupe (Texte, Tableur, Presentation, PDF) sont verifies commande par commande plus bas.
  test(`${app} : aucun groupe du ruban perdu ni duplique`, { skip: app !== 'publisher' }, () => {
    const src = tabsOf(app);
    const out = onlyOfficeTabs(app as never, src);
    const ids = (tabs: readonly RibbonTab[]): string[] => tabs.flatMap((t) => t.groups.map((g) => g.id)).sort();
    assert.deepEqual(ids(out), ids(src));
    const specs = ONLYOFFICE_TABS[app as keyof typeof ONLYOFFICE_TABS]!;
    const orphan = src.flatMap((t) => t.groups.map((g) => [t.id, g.id] as const)).filter(([t, g]) => !ooTabOf(specs, t, g));
    assert.deepEqual(orphan, [], 'groupes sans onglet OnlyOffice explicite');
  });
}

test('Protection regroupe le chiffrement et la protection du document', () => {
  const out = onlyOfficeTabs('word', tabsWithControls('word'));
  const ids = out.find((t) => t.id === 'oo-protect')?.groups.flatMap((g) => g.controls.map((c) => c.id)) ?? [];
  assert.ok(ids.includes('protectpw') && ids.includes('restrict'), ids.join(','));
  assert.ok(!out.find((t) => t.id === 'review')?.groups.some((g) => g.controls.some((c) => c.id === 'restrict')));
});

test('modules sans equivalent OnlyOffice : onglets inchanges', () => {
  const tabs = tabsOf('notes');
  assert.equal(onlyOfficeTabs('notes', tabs), tabs);
});

// ---- Disposition groupe par groupe (OnlyOffice 10.0) : aucune commande perdue, tous les identifiants de la description existent.
import type { RibbonControl } from '../src/ribbon-types.ts';
import { buildGroups, indexControls, leftovers } from '../src/logic/onlyofficeLayout.ts';
import { EXCEL_LAYOUT, PDF_LAYOUT, POWERPOINT_LAYOUT } from '../src/logic/onlyofficeSheets.ts';
import { WORD_LAYOUT } from '../src/logic/onlyofficeWord.ts';

/** Onglets d'un module avec de vrais controles (identifiants du banc de conformite `onglet.groupe.commande`). */
function tabsWithControls(app: string): RibbonTab[] {
  const data = JSON.parse(readFileSync(new URL(`${app}.json`, docs), 'utf8')) as { commandes: { id: string }[] };
  const tabs = new Map<string, Map<string, Set<string>>>();
  for (const c of data.commandes) {
    const [t, g, cmd0] = c.id.split('.');
    const cmd = cmd0?.split('#')[0];
    if (!t || !g || !cmd || !PLAIN[app]?.includes(t)) continue;
    if (!tabs.has(t)) tabs.set(t, new Map());
    if (!tabs.get(t)!.has(g)) tabs.get(t)!.set(g, new Set());
    tabs.get(t)!.get(g)!.add(cmd);
  }
  return [...tabs].map(([id, gs]) => ({ id, label: id, groups: [...gs].map(([gid, cmds]): RibbonGroup => ({ id: gid, label: gid, controls: [...cmds].map((cid): RibbonControl => ({ kind: 'button', id: cid, label: cid, onClick: () => undefined })) })) }));
}

const LAYOUTS = { word: WORD_LAYOUT, excel: EXCEL_LAYOUT, powerpoint: POWERPOINT_LAYOUT, pdf: PDF_LAYOUT } as const;

for (const [app, layout] of Object.entries(LAYOUTS)) {
  test(`${app} : description OnlyOffice complete (identifiants existants, rien de perdu)`, () => {
    const tabs = tabsWithControls(app);
    const index = indexControls(tabs);
    const used = new Set<RibbonControl>();
    const missing: string[] = [];
    const walk = (s: unknown, tab: string): void => {
      if (Array.isArray(s)) return s.forEach((x) => walk(x, tab));
      const o = typeof s === 'string' ? { id: s } : (s as { id?: string; ph?: string });
      if (o.id && o.ph === undefined && !index.has(o.id)) missing.push(`${tab}:${o.id}`);
    };
    for (const [tab, groups] of Object.entries(layout)) for (const g of groups) g.slots.forEach((s) => walk(s, tab));
    assert.deepEqual(missing, [], `identifiants absents du ruban : ${missing.join(', ')}`);
    for (const [tab, groups] of Object.entries(layout)) buildGroups(groups, index, used, tab);
    // Toute commande d'un onglet decrit est soit placee, soit dans le groupe « Plus » de son onglet (verifie par leftovers sur l'ensemble des groupes d'origine).
    const all = tabs.flatMap((t) => t.groups);
    const kept = new Set<RibbonControl>(used);
    const more = leftovers(all, used, 'all');
    for (const c of more?.controls ?? []) kept.add(c);
    for (const g of all) for (const c of g.controls) assert.ok(kept.has(c) || [...kept].some((k) => k.id === c.id), `commande perdue : ${g.id}.${c.id}`);
  });
}
