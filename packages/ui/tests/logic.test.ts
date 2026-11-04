import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fold, matchScore } from '../src/logic/text.ts';
import { assignKeytips, keytipMatch } from '../src/logic/keytips.ts';
import { fitGroups } from '../src/logic/fit.ts';
import { normalizeHex, shade, themeShades, readableOn, pushRecentColor, OFFICE_THEME_COLORS } from '../src/logic/color.ts';
import { clampZoom, sliderToZoom, zoomToSlider, stepZoom } from '../src/logic/zoom.ts';
import { filterFonts, parseFontSize, nextFontSize, uniqueFonts, pushRecentFont } from '../src/logic/fonts.ts';
import { collectCommands, searchCommands } from '../src/logic/commands.ts';
import type { RibbonTab } from '../src/ribbon-types.ts';

test('fold retire accents et casse', () => {
  assert.equal(fold('  Présentation  Été '), 'presentation ete');
});

test('matchScore exige tous les mots et favorise les prefixes', () => {
  assert.equal(matchScore('Gras', 'italique'), 0);
  assert.ok(matchScore('Gras', 'gr') > matchScore('Agrandir', 'gr'));
  assert.ok(matchScore('Insérer un tableau', 'inserer tab') > 0);
});

test('assignKeytips : uniques, imposees respectees, reserve evitee', () => {
  const tips = assignKeytips([{ label: 'Accueil', keytip: 'H' }, { label: 'Insertion' }, { label: 'Image' }, { label: 'Affichage' }], ['F']);
  assert.deepEqual(tips.slice(0, 2), ['H', 'I']);
  assert.equal(new Set(tips).size, tips.length);
  assert.ok(!tips.includes('F'));
  for (const t of tips) assert.ok(t.length >= 1 && t.length <= 2);
});

test('assignKeytips : bascule sur 2 lettres sans conflit de prefixe', () => {
  const labels = Array.from({ length: 40 }, (_, i) => ({ label: `Aa${i}` }));
  const tips = assignKeytips(labels);
  assert.equal(new Set(tips).size, 40);
  const singles = tips.filter((t) => t.length === 1);
  for (const t of tips.filter((x) => x.length === 2)) assert.ok(!singles.some((s) => t.startsWith(s)), t);
});

test('keytipMatch', () => {
  assert.deepEqual(keytipMatch('h', ['H', 'IA']), { state: 'match', index: 0 });
  assert.equal(keytipMatch('I', ['H', 'IA']).state, 'prefix');
  assert.equal(keytipMatch('Z', ['H', 'IA']).state, 'none');
});

test('fitGroups reduit de droite a gauche, niveau par niveau', () => {
  const widths = [[100, 80, 50, 30], [100, 80, 50, 30], [100, 80, 50, 30]];
  assert.deepEqual(fitGroups(widths, 400), [0, 0, 0]);
  assert.deepEqual(fitGroups(widths, 270), [0, 1, 1]);
  assert.deepEqual(fitGroups(widths, 200), [1, 2, 2]);
  assert.deepEqual(fitGroups(widths, 10), [3, 3, 3]);
});

test('fitGroups saute les niveaux sans gain', () => {
  assert.deepEqual(fitGroups([[100, 100, 100, 40], [60, 60, 60, 60]], 150), [3, 0]);
});

test('couleurs : hex, nuances Office, lisibilite, recentes', () => {
  assert.equal(normalizeHex('#abc'), '#AABBCC');
  assert.equal(normalizeHex('12zz45'), null);
  assert.equal(shade('#000000', 0.5), '#808080');
  assert.equal(shade('#FFFFFF', -0.5), '#808080');
  const white = OFFICE_THEME_COLORS[0];
  assert.ok(white);
  const shades = themeShades(white);
  assert.equal(shades.length, 5);
  assert.equal(shades[0]?.color, '#F2F2F2');
  assert.match(shades[0]?.label ?? '', /plus sombre 5/);
  assert.equal(readableOn('#FFFF00'), '#000000');
  assert.equal(readableOn('#185ABD'), '#FFFFFF');
  assert.deepEqual(pushRecentColor(['#FF0000', '#00FF00'], '#00ff00'), ['#00FF00', '#FF0000']);
});

test('zoom : bornes, curseur non lineaire, pas de 10', () => {
  assert.equal(clampZoom(5), 10);
  assert.equal(clampZoom(900), 500);
  assert.equal(sliderToZoom(0.5), 100);
  assert.equal(sliderToZoom(0), 10);
  assert.equal(sliderToZoom(1), 500);
  assert.equal(zoomToSlider(100), 0.5);
  for (const z of [10, 37, 100, 260, 500]) assert.equal(sliderToZoom(zoomToSlider(z)), z);
  assert.equal(stepZoom(100, 1), 110);
  assert.equal(stepZoom(105, -1), 100);
  assert.equal(stepZoom(10, -1), 10);
});

test('polices : filtre, tailles', () => {
  assert.deepEqual(filterFonts(['Arial', 'Calibri', 'Segoe UI', 'Abadi'], 'ari'), ['Arial']);
  assert.deepEqual(filterFonts(['Cambria', 'Arial'], 'ia'), ['Cambria', 'Arial']);
  assert.equal(parseFontSize('10,5'), 10.5);
  assert.equal(parseFontSize('11.3'), 11.5);
  assert.equal(parseFontSize('0'), null);
  assert.equal(parseFontSize('abc'), null);
  assert.equal(nextFontSize(11, 1), 12);
  assert.equal(nextFontSize(72, 1), 80);
  assert.equal(nextFontSize(8, -1), 7);
  assert.deepEqual(uniqueFonts(['b', 'A', 'a ', 'B']), ['A', 'b']);
  assert.deepEqual(pushRecentFont(['Arial', 'Aptos'], 'aptos'), ['aptos', 'Arial']);
});

test('collectCommands + searchCommands', () => {
  const calls: string[] = [];
  const tabs: RibbonTab[] = [{
    id: 'home', label: 'Accueil', groups: [{
      id: 'font', label: 'Police', launcher: { label: 'Paramètres de police', onClick: () => calls.push('launch') },
      controls: [
        { kind: 'row', id: 'r', controls: [
          { kind: 'toggle', id: 'bold', label: 'Gras', pressed: false, onToggle: (p) => calls.push(`bold:${p}`), tooltip: { title: 'Gras', shortcut: 'Ctrl+G' } },
          { kind: 'button', id: 'italic', label: 'Italique', onClick: () => calls.push('italic') },
        ] },
        { kind: 'menu', id: 'case', label: 'Casse', items: [{ id: 'upper', label: 'MAJUSCULES', onClick: () => calls.push('upper') }, { id: 's', kind: 'separator' }] },
        { kind: 'gallery', id: 'styles', label: 'Styles', items: [{ id: 'h1', label: 'Titre 1' }], onSelect: (id) => calls.push(`style:${id}`) },
        { kind: 'button', id: 'hidden', label: 'Caché', hidden: true, onClick: () => calls.push('hidden') },
      ],
    }],
  }];
  const cmds = collectCommands(tabs);
  assert.deepEqual(cmds.map((c) => c.id).sort(), ['bold', 'font:launcher', 'italic', 'styles:h1', 'upper'].sort());
  const found = searchCommands(cmds, 'gras');
  assert.equal(found[0]?.id, 'bold');
  assert.equal(found[0]?.shortcut, 'Ctrl+G');
  found[0]?.run();
  searchCommands(cmds, 'titre')[0]?.run();
  searchCommands(cmds, 'majuscules')[0]?.run();
  assert.deepEqual(calls, ['bold:true', 'style:h1', 'upper']);
  assert.equal(searchCommands(cmds, 'police')[0]?.id, 'font:launcher');
  assert.deepEqual(searchCommands(cmds, 'zzz'), []);
});
