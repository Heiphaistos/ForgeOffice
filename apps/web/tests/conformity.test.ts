// Logique pure du banc de conformite : enumeration des commandes, difference de snapshots, classification, rapports.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RibbonTab } from '@forgeoffice/ui';
import { enumerateCommands, sample, toInfo } from '../src/debug/enumerate.ts';
import { classify, defects, splitSnapshot, diffPaths, diffUi, isWorking, stable, tally, workingRate, type Observation, type Row, type UiLike } from './conformity/logic.ts';
import { moduleReport, summaryReport } from './conformity/report.ts';

const noop = (): void => undefined;

const TABS: RibbonTab[] = [
  {
    id: 'home', label: 'Accueil', groups: [
      {
        id: 'font', label: 'Police', controls: [
          { kind: 'toggle', id: 'bold', label: 'Gras', pressed: false, onToggle: noop },
          { kind: 'row', id: 'row', controls: [{ kind: 'button', id: 'grow', label: 'Agrandir', onClick: noop }] },
          { kind: 'menu', id: 'case', label: 'Casse', items: [
            { id: 'upper', label: 'MAJUSCULES', onClick: noop },
            { id: 'sep', kind: 'separator' },
            { id: 'more', label: 'Plus', items: [{ id: 'title', label: 'Titre', onClick: noop }, { id: 'broken', label: 'Sans action' }] },
          ] },
          { kind: 'gallery', id: 'styles', label: 'Styles', items: [{ id: 'h1', label: 'Titre 1' }, { id: 'h2', label: 'Titre 2' }], onSelect: noop, footer: [{ id: 'create', label: 'Creer', onClick: noop }] },
          { kind: 'color', id: 'color', label: 'Couleur', value: null, onChange: noop },
          { kind: 'combo', id: 'size', label: 'Taille', value: '11', options: Array.from({ length: 20 }, (_, i) => ({ value: String(i + 8) })), onChange: noop },
          { kind: 'custom', id: 'grid', label: 'Grille', render: () => null },
        ], launcher: { label: 'Police...', onClick: noop },
      },
    ],
  },
  { id: 'tableDesign', label: 'Tableau', hidden: true, contextual: { set: 'Outils de tableau', color: '#000' }, groups: [{ id: 'g', label: 'Styles', controls: [{ kind: 'button', id: 'b', label: 'Bordures', onClick: noop }] }] },
];

test('enumerate : liste plate, identifiants stables et chemins', () => {
  const list = enumerateCommands(TABS);
  const ids = list.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
  assert.ok(ids.includes('home.font.bold'));
  assert.ok(ids.includes('home.font.grow'), 'les controles d\'une rangee sont aplatis');
  assert.ok(ids.includes('home.font.case#upper'));
  assert.ok(ids.includes('home.font.case#more/title'), 'sous-menus imbriques');
  assert.ok(ids.includes('home.font.styles#h2'));
  assert.ok(ids.includes('home.font.styles#create'), 'pied de galerie');
  assert.ok(ids.includes('home.font.font:launcher'));
  assert.deepEqual(list.find((c) => c.id === 'home.font.case#more/title')?.path, ['Accueil', 'Police', 'Casse', 'Plus', 'Titre']);
  assert.equal(list.find((c) => c.id === 'home.font.case#upper')?.parent, 'home.font.case');
  assert.equal(list.find((c) => c.id === 'home.font.case#more/broken')?.noHandler, true);
  assert.equal(list.find((c) => c.id === 'tableDesign.g.b')?.tabHidden, true);
  assert.equal(list.find((c) => c.id === 'home.font.grid#pick')?.type, 'custom-item');
});

test('enumerate : couleurs, listes echantillonnees, bascule executee a l\'inverse', () => {
  const list = enumerateCommands(TABS, { colors: [['Rouge', '#FF0000']], maxOptions: 5 });
  assert.ok(list.some((c) => c.id === 'home.font.color#color:Rouge' && c.value === '#FF0000'));
  assert.ok(list.some((c) => c.id === 'home.font.color#auto'));
  assert.equal(list.filter((c) => c.type === 'combo-option').length, 5);
  let received: boolean | undefined;
  const tabs: RibbonTab[] = [{ id: 't', label: 'T', groups: [{ id: 'g', label: 'G', controls: [{ kind: 'toggle', id: 'x', label: 'X', pressed: true, onToggle: (v) => { received = v; } }] }] }];
  enumerateCommands(tabs)[0]?.run();
  assert.equal(received, false);
  assert.equal('run' in toInfo(list[0]!), false);
});

test('sample : echantillon regulier avec bornes', () => {
  assert.deepEqual(sample([1, 2, 3], 5), [1, 2, 3]);
  const s = sample(Array.from({ length: 100 }, (_, i) => i), 4);
  assert.equal(s[0], 0);
  assert.equal(s.at(-1), 99);
  assert.equal(s.length, 4);
});

test('stable / diffPaths : insensibles a l\'ordre des cles, precis sur les ecarts', () => {
  assert.equal(stable({ b: 1, a: { d: 2, c: 3 } }), stable({ a: { c: 3, d: 2 }, b: 1 }));
  assert.deepEqual(diffPaths({ a: 1 }, { a: 1 }), []);
  assert.deepEqual(diffPaths({ a: [1, 2] }, { a: [1, 3] }), ['$.a[1]: 2 -> 3']);
  assert.ok(diffPaths({ a: [1] }, { a: [1, 2] })[0]?.includes('length 1->2'));
  assert.equal(diffPaths({ a: 1, b: 2, c: 3 }, { a: 9, b: 9, c: 9 }, 2).length, 2, 'limite respectee');
});

const ui = (patch: Partial<UiLike> = {}): UiLike => ({ dialogs: [], popups: [], toasts: [], pressed: {}, outside: { '@racine': '1', 'div.a[0]': 'x' }, tab: 'Accueil', platform: {}, ...patch });

test('diffUi : boite, menu, notification, bascule, region modifiee, plateforme', () => {
  assert.equal(diffUi(ui(), ui({ dialogs: ['Lien|texte'] })).dialogOpened, true);
  assert.equal(diffUi(ui(), ui({ popups: ['fo-menu|x'] })).popupOpened, true);
  assert.equal(diffUi(ui(), ui({ toasts: ['Fait'] })).toast, 'Fait');
  assert.deepEqual(diffUi(ui({ pressed: { bold: 'false' } }), ui({ pressed: { bold: 'true' } })).pressedChanged, ['bold']);
  const d = diffUi(ui({ outside: { a: '1', 'a>b': '1' } }), ui({ outside: { a: '2', 'a>b': '2' } }));
  assert.equal(d.outsideChanged, true);
  assert.deepEqual(d.regions, ['a>b'], 'seule la region la plus profonde est rapportee');
  assert.deepEqual(diffUi(ui(), ui({ platform: { impression: 1 } })).platform, ['impression']);
  assert.equal(diffUi(ui(), ui()).outsideChanged, false);
});

const obs = (patch: Partial<Observation> = {}): Observation => ({
  disabled: false, reached: true, errors: [], docChanged: false, ui: diffUi(ui(), ui()), ...patch,
});

test('classify : ordre de priorite des verdicts', () => {
  assert.equal(classify(obs({ docChanged: true })).verdict, 'EFFET_DOCUMENT');
  assert.equal(classify(obs({ ui: diffUi(ui(), ui({ dialogs: ['x'] })) })).verdict, 'EFFET_UI');
  assert.equal(classify(obs({ ui: diffUi(ui(), ui({ platform: { 'presse-papiers': 1 } })) })).verdict, 'EXIGE_PLATEFORME');
  assert.equal(classify(obs({ docChanged: true, ui: diffUi(ui(), ui({ platform: { telechargement: 1 } })) })).verdict, 'EFFET_DOCUMENT', 'effet reel et plateforme : effet');
  assert.equal(classify(obs({ errors: ['exception: boom'], docChanged: true })).verdict, 'ERREUR', 'une exception l\'emporte');
  assert.equal(classify(obs({ reached: false })).verdict, 'INACCESSIBLE');
  assert.equal(classify(obs({ untestable: true })).verdict, 'NON_TESTE');
  const none = classify(obs());
  assert.equal(none.verdict, 'AUCUN_EFFET');
  assert.equal(none.retry, true, 'a confirmer dans un autre contexte');
  assert.equal(classify(obs({ noHandler: true })).retry, false, 'element sans action : defaut statique, inutile de reessayer');
});

test("etat d'interface : cle ui separee du modele, classee EFFET_UI", () => {
  const [doc, state] = splitSnapshot({ pages: [1], ui: { tool: 'rect' } });
  assert.deepEqual(doc, { pages: [1] });
  assert.deepEqual(state, { tool: 'rect' });
  assert.deepEqual(splitSnapshot(null), [null, undefined]);
  assert.equal(classify(obs({ stateChanged: true })).verdict, 'EFFET_UI');
  assert.equal(classify(obs({ stateChanged: true, docChanged: true })).verdict, 'EFFET_DOCUMENT');
});

test('classify : entree deja active = sans objet, hors defauts', () => {
  const c = classify(obs({ alreadyActive: true }));
  assert.equal(c.verdict, 'SANS_OBJET');
  assert.equal(c.retry, false);
  assert.equal(classify(obs({ alreadyActive: true, docChanged: true })).verdict, 'EFFET_DOCUMENT');
  const r: Row = { id: 'x', path: ['A', 'B', 'C'], label: 'C', type: 'menu-item', verdict: 'SANS_OBJET', detail: '', tab: 'a' };
  assert.equal(defects([r]).length, 0);
  assert.equal(workingRate([r]), 1, 'hors denominateur');
});

test('classify : desactivee attendue ou suspecte', () => {
  assert.equal(classify(obs({ disabled: true, expectDisabled: true })).retry, false);
  const s = classify(obs({ disabled: true }));
  assert.equal(s.verdict, 'DESACTIVEE');
  assert.equal(s.retry, true);
});

const row = (patch: Partial<Row>): Row => ({ id: 'a', path: ['Accueil', 'Police', 'X'], label: 'X', type: 'button', verdict: 'EFFET_DOCUMENT', detail: '', tab: 'home', ...patch });

test('agregats : fonctionnel = effet constate sans defaut, plateforme et desactivation attendue hors denominateur', () => {
  const rows = [
    row({}), row({ verdict: 'EFFET_UI' }), row({ verdict: 'AUCUN_EFFET' }), row({ verdict: 'ERREUR' }),
    row({ verdict: 'EXIGE_PLATEFORME' }), row({ verdict: 'NON_TESTE' }), row({ toggleBack: false }), row({ expectation: 'gras absent' }),
    row({ verdict: 'DESACTIVEE', detail: 'desactivee (attendu dans ce contexte)' }),
  ];
  assert.equal(tally(rows).EFFET_DOCUMENT, 3);
  assert.equal(isWorking(rows[6]!), false);
  assert.equal(isWorking(rows[7]!), false);
  assert.equal(isWorking(rows[4]!), true);
  assert.equal(workingRate(rows), 2 / 6);
  assert.equal(defects(rows).length, 4, 'AUCUN_EFFET, ERREUR, bascule, attente, mais pas la desactivation attendue ni NON_TESTE');
  assert.equal(workingRate([]), 1);
});

test('rapports : synthese par module et resume', () => {
  const rows = [row({}), row({ id: 'b', verdict: 'ERREUR', detail: 'exception: boom', capture: 'b.jpg', context: 'mot' })];
  const md = moduleReport('word', rows, { seconds: 12, mobile: false });
  assert.match(md, /Conformité : Texte/);
  assert.match(md, /Commandes testées : \*\*2\*\*/);
  assert.match(md, /ERREUR/);
  assert.match(md, /exception: boom/);
  assert.match(md, /captures\/word\/b\.jpg/);
  assert.match(md, /sélection « mot »/);
  const all = summaryReport({ word: { rows, seconds: 1 } }, false);
  assert.match(all, /\| Texte \| 2 \|/);
  assert.match(all, /50,0 %/);
});

test('canon : absent, false et conteneurs vides sont equivalents, une vraie difference reste', async () => {
  const { diffSemantic } = await import('./conformity/logic.ts');
  assert.deepEqual(diffSemantic({ a: { b: undefined }, c: [] }, { a: { b: false }, d: null, text: { paragraphs: [{ props: {}, runs: [] }] } }), []);
  assert.equal(diffSemantic({ bold: true }, { bold: false }).length, 1);
  assert.equal(diffSemantic({ n: 1 }, { n: 2 }).length, 1);
});
