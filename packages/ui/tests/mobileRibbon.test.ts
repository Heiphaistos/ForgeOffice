import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeGroup, bandGroups, commandSections, countSchemaControls, flattenControls, launcherId, ribbonSchema, scrollEdges, snapOffsets } from '../src/logic/mobileRibbon.ts';
import { collectCommands } from '../src/logic/commands.ts';
import type { RibbonControl, RibbonTab } from '../src/ribbon-types.ts';

const noop = (): void => undefined;
const btn = (id: string, extra: Partial<RibbonControl> = {}): RibbonControl => ({ kind: 'button', id, label: id.toUpperCase(), onClick: noop, ...extra }) as RibbonControl;

const tab: RibbonTab = {
  id: 'home', label: 'Accueil',
  groups: [
    { id: 'g1', label: 'Presse-papiers', controls: [btn('cut'), { kind: 'separator', id: 's1' }, btn('hid', { hidden: true }), { kind: 'row', id: 'r', controls: [btn('b'), btn('i'), { kind: 'row', id: 'r2', controls: [btn('u')] }] }], launcher: { label: 'Police', onClick: noop } },
    { id: 'g2', label: 'Vide', controls: [{ kind: 'separator', id: 's2' }] },
    { id: 'g3', label: 'Masque', hidden: true, controls: [btn('x')] },
    { id: 'g4', label: 'Paragraphe', controls: [{ kind: 'combo', id: 'size', label: 'Taille', value: '11', options: [], onChange: noop }, { kind: 'menu', id: 'm', label: 'Menu', items: [{ id: 'mi', label: 'Item', onClick: noop }] }] },
  ],
};

test('flattenControls : lignes aplaties, separateurs et masques retires, ordre conserve', () => {
  assert.deepEqual(flattenControls(tab.groups[0]?.controls ?? []).map((c) => c.id), ['cut', 'b', 'i', 'u']);
});

test('bandGroups : groupes vides ou masques absents, lanceur conserve', () => {
  const g = bandGroups(tab);
  assert.deepEqual(g.map((x) => x.id), ['g1', 'g4']);
  assert.equal(g[0]?.launcher?.label, 'Police');
});

test('ribbonSchema : toutes les commandes y compris combo et lanceur, onglets masques exclus', () => {
  const s = ribbonSchema([tab, { id: 'h', label: 'H', hidden: true, groups: [] }]);
  assert.equal(s.length, 1);
  const ids = s[0]?.groups.flatMap((g) => g.controls.map((c) => c.id));
  assert.deepEqual(ids, ['cut', 'b', 'i', 'u', launcherId('g1'), 'size', 'm']);
  assert.equal(s[0] ? countSchemaControls(s[0]) : 0, 7);
});

test('snapOffsets et activeGroup : le groupe en tete suit le defilement', () => {
  const offs = snapOffsets([10, 210, 510], 10, 0);
  assert.deepEqual(offs, [0, 200, 500]);
  assert.equal(activeGroup(offs, 0), 0);
  assert.equal(activeGroup(offs, 190), 1);
  assert.equal(activeGroup(offs, 520), 2);
  assert.deepEqual(snapOffsets([-90, 110], 10, 100), [0, 200]);
});

test('scrollEdges : ombres et curseur', () => {
  assert.deepEqual(scrollEdges(0, 300, 300).more, { start: false, end: false });
  assert.deepEqual(scrollEdges(0, 300, 900).more, { start: false, end: true });
  assert.deepEqual(scrollEdges(300, 300, 900).more, { start: true, end: true });
  assert.deepEqual(scrollEdges(600, 300, 900).more, { start: true, end: false });
  const t = scrollEdges(600, 300, 900).thumb;
  assert.ok(Math.abs(t.width - 1 / 3) < 1e-9 && Math.abs(t.left + t.width - 1) < 1e-9);
});

test('commandSections : tout groupe par onglet > groupe, requete = resultats classes', () => {
  const cmds = collectCommands([tab]);
  const all = commandSections(cmds, '');
  assert.deepEqual(all.map((s) => s.title), ['Accueil > Presse-papiers', 'Accueil > Paragraphe']);
  assert.ok(all[0] && all[0].entries.some((e) => e.id === launcherId('g1')));
  const q = commandSections(cmds, 'item', 'Resultats');
  assert.equal(q.length, 1);
  assert.equal(q[0]?.entries[0]?.id, 'mi');
  assert.deepEqual(commandSections(cmds, 'zzzzqq'), []);
});

import { groupsToMenu } from '../src/logic/commands.ts';
test('groupsToMenu : un sous-menu par groupe, groupes filtres, commandes executables', () => {
  const m = groupsToMenu(tab);
  assert.deepEqual(m.map((x) => x.label), ['Presse-papiers', 'Paragraphe']);
  assert.equal(groupsToMenu(tab, ['g4']).length, 1);
  assert.ok((m[0]?.items?.length ?? 0) >= 4);
  assert.equal(typeof m[0]?.items?.[0]?.onClick, 'function');
});
