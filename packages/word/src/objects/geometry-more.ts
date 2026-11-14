// Formes supplementaires (noms DrawingML) decrites par des polygones calcules : polygones reguliers, etoiles, fleches, logigramme, signes mathematiques,
// et courbes approchees par des polygones (coeur, lune, vague...). Le moteur du Texte decoupe les formes avec un polygone, sans courbe de Bezier.
import type { Geometry } from './geometry.ts';

type P = readonly [number, number];
const fmt = (v: number): string => (Math.abs(v) < 0.05 ? '0' : `${Math.round(v * 10) / 10}%`);
const poly = (pts: readonly P[]): string => pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(',');
/** Liste plate « x, y, x, y... » vers des points. */
const ps = (...n: number[]): P[] => Array.from({ length: n.length >> 1 }, (_, i) => [n[2 * i]!, n[2 * i + 1]!] as P);
const circ = (n: number, a0 = -90): P[] => Array.from({ length: n }, (_, i) => { const a = ((a0 + (360 * i) / n) * Math.PI) / 180; return [50 + 50 * Math.cos(a), 50 + 50 * Math.sin(a)] as P; });
const star = (n: number, k: number): P[] => Array.from({ length: n * 2 }, (_, i) => { const a = ((-90 + (180 * i) / n) * Math.PI) / 180; const r = i % 2 ? 50 * k : 50; return [50 + r * Math.cos(a), 50 + r * Math.sin(a)] as P; });
const sample = (n: number, f: (t: number) => P): P[] => Array.from({ length: n }, (_, i) => f(i / (n - 1)));
const g = (id: string, label: string, group: Geometry['group'], pts: readonly P[]): Geometry => ({ id, label, group, polygon: poly(pts) });

const capsule: P[] = [...sample(10, (t) => [25 - 25 * Math.sin(t * Math.PI), 50 - 50 * Math.cos(t * Math.PI)] as P), ...sample(10, (t) => [75 + 25 * Math.sin(t * Math.PI), 50 + 50 * Math.cos(t * Math.PI)] as P)];
const heart = sample(40, (t) => {
  const a = t * 2 * Math.PI;
  return [50 + 16 * Math.sin(a) ** 3 * 3.05, 42 - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 3.1] as P;
});
const moon: P[] = [...sample(14, (t) => [90 - 80 * Math.sin(t * Math.PI), 100 * t] as P), ...sample(13, (t) => [90 - 45 * Math.sin((1 - t) * Math.PI), 100 * (1 - t)] as P)];
const wave = (amp: number, n: number): P[] => [...sample(24, (t) => [100 * t, 10 + amp * Math.sin(t * n * Math.PI)] as P), ...sample(24, (t) => [100 * (1 - t), 90 + amp * Math.sin((1 - t) * n * Math.PI)] as P)];
const flowDoc: P[] = [...ps(0, 0, 100, 0), ...sample(20, (t) => [100 * (1 - t), 85 + 12 * Math.sin(t * 2 * Math.PI)] as P)];
const teardrop: P[] = [...sample(24, (t) => { const a = ((45 + t * 270) * Math.PI) / 180; return [50 + 49 * Math.cos(a), 50 + 49 * Math.sin(a)] as P; }), [100, 0]];
const delay: P[] = [...ps(0, 0, 50, 0), ...sample(14, (t) => [50 + 50 * Math.sin(t * Math.PI), 50 - 50 * Math.cos(t * Math.PI)] as P), ...ps(50, 100, 0, 100)];
const display: P[] = [...ps(0, 50, 17, 0, 75, 0), ...sample(14, (t) => [75 + 25 * Math.sin(t * Math.PI), 50 - 50 * Math.cos(t * Math.PI)] as P), ...ps(75, 100, 17, 100)];
const wedgeEllipse: P[] = [...sample(30, (t) => { const a = ((120 + t * 300) * Math.PI) / 180; return [50 + 50 * Math.cos(a), 40 + 40 * Math.sin(a)] as P; }), ...ps(22, 100)];
const cloud: P[] = sample(48, (t) => { const a = t * 2 * Math.PI; const r = (1 + 0.16 * Math.sin(6 * a)) / 1.16; return [50 + 48 * r * Math.cos(a), 52 + 38 * r * Math.sin(a)] as P; });

export const MORE_GEOMETRIES: readonly Geometry[] = [
  g('snip1Rect', 'Rectangle à un coin coupé', 'basic', ps(0, 0, 83, 0, 100, 17, 100, 100, 0, 100)),
  g('snip2SameRect', 'Rectangle à deux coins coupés', 'basic', ps(17, 0, 83, 0, 100, 17, 100, 100, 0, 100, 0, 17)),
  g('snip2DiagRect', 'Rectangle à coins coupés en diagonale', 'basic', ps(0, 0, 83, 0, 100, 17, 100, 100, 17, 100, 0, 83)),
  g('round1Rect', 'Rectangle à un coin arrondi', 'basic', [...ps(0, 0), ...sample(8, (t) => [83 + 17 * Math.sin((t * Math.PI) / 2), 17 - 17 * Math.cos((t * Math.PI) / 2)] as P), ...ps(100, 100, 0, 100)]),
  g('rtTriangle', 'Triangle rectangle', 'basic', ps(0, 0, 100, 100, 0, 100)),
  g('parallelogram', 'Parallélogramme', 'basic', ps(25, 0, 100, 0, 75, 100, 0, 100)),
  g('trapezoid', 'Trapèze', 'basic', ps(25, 0, 75, 0, 100, 100, 0, 100)),
  g('heptagon', 'Heptagone', 'basic', circ(7)),
  g('octagon', 'Octogone', 'basic', circ(8, -67.5)),
  g('decagon', 'Décagone', 'basic', circ(10)),
  g('dodecagon', 'Dodécagone', 'basic', circ(12, -75)),
  g('plus', 'Croix', 'basic', ps(33, 0, 67, 0, 67, 33, 100, 33, 100, 67, 67, 67, 67, 100, 33, 100, 33, 67, 0, 67, 0, 33, 33, 33)),
  g('corner', 'Forme en L', 'basic', ps(0, 0, 50, 0, 50, 50, 100, 50, 100, 100, 0, 100)),
  g('diagStripe', 'Bande diagonale', 'basic', ps(0, 100, 0, 50, 50, 0, 100, 0)),
  g('halfFrame', 'Demi-cadre', 'basic', ps(0, 0, 100, 0, 67, 33, 33, 33, 33, 67, 0, 100)),
  g('chevron', 'Chevron', 'basic', ps(0, 0, 70, 0, 100, 50, 70, 100, 0, 100, 30, 50)),
  g('heart', 'Cœur', 'basic', heart),
  g('moon', 'Lune', 'basic', moon),
  g('lightningBolt', 'Éclair', 'basic', ps(38, 0, 62, 0, 50, 36, 80, 36, 22, 100, 40, 55, 18, 55)),
  g('teardrop', 'Goutte', 'basic', teardrop),
  g('cloud', 'Nuage', 'basic', cloud),
  g('plaque', 'Plaque', 'basic', ps(15, 0, 85, 0, 100, 15, 100, 85, 85, 100, 15, 100, 0, 85, 0, 15)),
  g('leftRightArrow', 'Flèche à deux sens', 'arrows', ps(0, 50, 22, 0, 22, 25, 78, 25, 78, 0, 100, 50, 78, 100, 78, 75, 22, 75, 22, 100)),
  g('upDownArrow', 'Flèche haut-bas', 'arrows', ps(50, 0, 100, 22, 75, 22, 75, 78, 100, 78, 50, 100, 0, 78, 25, 78, 25, 22, 0, 22)),
  g('quadArrow', 'Flèche à quatre pointes', 'arrows', ps(50, 0, 66, 18, 56, 18, 56, 44, 82, 44, 82, 34, 100, 50, 82, 66, 82, 56, 56, 56, 56, 82, 66, 82, 50, 100, 34, 82, 44, 82, 44, 56, 18, 56, 18, 66, 0, 50, 18, 34, 18, 44, 44, 44, 44, 18, 34, 18)),
  g('bentUpArrow', 'Flèche courbée vers le haut', 'arrows', ps(0, 60, 62, 60, 62, 25, 45, 25, 72, 0, 100, 25, 82, 25, 82, 80, 0, 80)),
  g('notchedRightArrow', 'Flèche à encoche', 'arrows', ps(0, 25, 62, 25, 62, 0, 100, 50, 62, 100, 62, 75, 0, 75, 14, 50)),
  g('homePlate', 'Pentagone (flèche)', 'arrows', ps(0, 0, 75, 0, 100, 50, 75, 100, 0, 100)),
  g('rightArrowCallout', 'Légende : flèche droite', 'callouts', ps(0, 0, 55, 0, 55, 25, 78, 25, 78, 0, 100, 50, 78, 100, 78, 75, 55, 75, 55, 100, 0, 100)),
  g('leftArrowCallout', 'Légende : flèche gauche', 'callouts', ps(45, 0, 100, 0, 100, 100, 45, 100, 45, 75, 22, 75, 22, 100, 0, 50, 22, 0, 22, 25, 45, 25)),
  g('upArrowCallout', 'Légende : flèche haut', 'callouts', ps(0, 45, 25, 45, 25, 22, 0, 22, 50, 0, 100, 22, 75, 22, 75, 45, 100, 45, 100, 100, 0, 100)),
  g('downArrowCallout', 'Légende : flèche bas', 'callouts', ps(0, 0, 100, 0, 100, 55, 75, 55, 75, 78, 100, 78, 50, 100, 0, 78, 25, 78, 25, 55, 0, 55)),
  g('wedgeEllipseCallout', 'Bulle ovale', 'callouts', wedgeEllipse),
  g('mathPlus', 'Plus', 'math', ps(23, 38, 38, 38, 38, 23, 62, 23, 62, 38, 77, 38, 77, 62, 62, 62, 62, 77, 38, 77, 38, 62, 23, 62)),
  g('mathMinus', 'Moins', 'math', ps(10, 35, 90, 35, 90, 65, 10, 65)),
  g('mathMultiply', 'Multiplier', 'math', ps(15, 31, 31, 15, 50, 38, 69, 15, 85, 31, 62, 50, 85, 69, 69, 85, 50, 62, 31, 85, 15, 69, 38, 50)),
  g('mathEqual', 'Égal', 'math', ps(10, 18, 90, 18, 90, 42, 10, 42)),
  g('flowChartProcess', 'Processus', 'flow', ps(0, 0, 100, 0, 100, 100, 0, 100)),
  g('flowChartAlternateProcess', 'Autre processus', 'flow', ps(10, 0, 90, 0, 100, 10, 100, 90, 90, 100, 10, 100, 0, 90, 0, 10)),
  g('flowChartDecision', 'Décision', 'flow', ps(50, 0, 100, 50, 50, 100, 0, 50)),
  g('flowChartInputOutput', 'Données', 'flow', ps(20, 0, 100, 0, 80, 100, 0, 100)),
  g('flowChartPreparation', 'Préparation', 'flow', ps(20, 0, 80, 0, 100, 50, 80, 100, 20, 100, 0, 50)),
  g('flowChartManualInput', 'Saisie manuelle', 'flow', ps(0, 20, 100, 0, 100, 100, 0, 100)),
  g('flowChartManualOperation', 'Opération manuelle', 'flow', ps(0, 0, 100, 0, 80, 100, 20, 100)),
  g('flowChartConnector', 'Connecteur', 'flow', circ(32)),
  g('flowChartOffpageConnector', 'Connecteur hors page', 'flow', ps(0, 0, 100, 0, 100, 80, 50, 100, 0, 80)),
  g('flowChartCollate', 'Interclasser', 'flow', ps(0, 0, 100, 0, 50, 50, 100, 100, 0, 100, 50, 50)),
  g('flowChartSort', 'Trier', 'flow', ps(50, 0, 100, 50, 50, 100, 0, 50)),
  g('flowChartExtract', 'Extraire', 'flow', ps(50, 0, 100, 100, 0, 100)),
  g('flowChartMerge', 'Fusionner', 'flow', ps(0, 0, 100, 0, 50, 100)),
  g('flowChartDelay', 'Délai', 'flow', delay),
  g('flowChartDisplay', 'Affichage', 'flow', display),
  g('flowChartPunchedCard', 'Carte perforée', 'flow', ps(20, 0, 100, 0, 100, 100, 0, 100, 0, 20)),
  g('flowChartDocument', 'Document', 'flow', flowDoc),
  g('flowChartTerminator', 'Terminateur', 'flow', capsule),
  ...[6, 7, 8, 10, 12, 16, 24, 32].map((n) => g(`star${n}`, `Étoile à ${n} branches`, 'stars', star(n, n <= 8 ? 0.6 : n <= 12 ? 0.72 : 0.85))),
  g('wave', 'Vague', 'stars', wave(8, 2)),
  g('doubleWave', 'Double vague', 'stars', wave(8, 4)),
];
