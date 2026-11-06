// Fixtures de residus2.mjs : une presentation riche (texte, puces, formes, degrade, ombre, lueur, graphique, tableau, image).
// Usage : node apps/web/tests/e2e/residus2-prepare.ts <dossier de sortie>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { png } from './residus2-png.ts';
import * as P from '../../../../packages/pptx/src/index.ts';

const out = process.argv[2];
if (!out) throw new Error('dossier de sortie manquant');
mkdirSync(out, { recursive: true });

const deck = P.createBlankDeck('widescreen', { titleSlide: false });
const layout = deck.masters[0]?.layouts.find((l) => l.type === 'titleOnly') ?? deck.masters[0]?.layouts[0];
if (!layout) throw new Error('disposition');
const s1 = P.addSlide(deck, layout.id);
const title = s1.shapes[0];
if (title && title.kind === 'shape') title.text = { props: {}, paragraphs: P.paragraphsFromText('Bilan 2026 : résultats Été') };
const body = P.addTextBox(s1, { x: 60, y: 130, width: 420, height: 220 }, 'Premier point important\nSecond point avec α β π\nTroisième point', { size: 22 });
if (body.text) body.text.paragraphs.forEach((p) => { p.props = { bullet: { type: 'auto', scheme: 'arabicPeriod' }, marginLeft: 28, indent: -28 }; });
const card = P.addAutoShape(s1, 'roundRect', { x: 520, y: 130, width: 380, height: 120, rotation: -6 }, 'Carte');
card.fill = { type: 'gradient', kind: 'linear', angle: 20, stops: [{ position: 0, color: { type: 'rgb', value: 'C8102E' } }, { position: 100, color: { type: 'rgb', value: '1F4E9D' } }] };
card.text = { props: { anchor: 'ctr' }, paragraphs: [{ props: { align: 'ctr' }, runs: [{ type: 'text', text: 'Carte dégradée tournée', props: { size: 24, bold: true, color: { type: 'rgb', value: 'FFFFFF' } } }] }] };
const glow = P.addAutoShape(s1, 'ellipse', { x: 560, y: 280, width: 160, height: 90 }, 'Lueur');
glow.fill = { type: 'solid', color: { type: 'rgb', value: 'FFC000' } };
glow.effects = { glow: { radius: 12, color: { type: 'rgb', value: 'FFC000', mods: [{ name: 'alpha', val: 50000 }] } } };
const shadow = P.addAutoShape(s1, 'rect', { x: 760, y: 280, width: 140, height: 80 }, 'Ombre');
shadow.fill = { type: 'solid', color: { type: 'rgb', value: '2E7D32' } };
shadow.effects = { outerShadow: { color: { type: 'rgb', value: '000000', mods: [{ name: 'alpha', val: 40000 }] }, blur: 4, distance: 6, direction: 45 } };
P.addTable(s1, 3, 3, { x: 60, y: 380, width: 420, height: 110 }, [['Mois', 'Ventes', 'Marge'], ['Janvier', '120', '12 %'], ['Février', '135', '14 %']]);
P.addChart(s1, 'bar', ['T1', 'T2', 'T3'], [{ name: 'Ventes', values: [4, 6, 5] }, { name: 'Coûts', values: [3, 4, 4] }], { x: 520, y: 380, width: 380, height: 140 }, { title: 'Résultats' });
P.setNotes(s1, 'Penser à citer le bilan de l’année Été. Deuxième ligne de notes.');
const s2 = P.addSlide(deck, deck.masters[0]?.layouts[0]?.id ?? layout.id);
const pic = P.addPicture(deck, s2, png(240, 160, [250, 250, 250], [30, 110, 200]), 'png', { x: 80, y: 160, width: 360, height: 240 }, 'Disque bleu sur fond blanc');
void pic;
s2.background = { type: 'fill', fill: { type: 'solid', color: { type: 'rgb', value: 'FFF3C4' } } };
P.addTextBox(s2, { x: 80, y: 60, width: 500, height: 50 }, 'Seconde diapositive', { size: 28 });
writeFileSync(join(out, 'riche.pptx'), await P.writePptx(deck));
writeFileSync(join(out, 'disque.png'), png(240, 160, [250, 250, 250], [30, 110, 200]));
console.log('fixtures residus2 ok', out);
