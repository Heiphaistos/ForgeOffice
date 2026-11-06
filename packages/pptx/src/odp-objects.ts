// Objets incorpores d'une presentation OpenDocument : graphiques (draw:object -> sous-document chart) et medias (draw:plugin).
import { attr, child, children, descendants, normalizePartPath, textOf, type OpcPackage, type XmlElement } from '@forgeoffice/opc';
import { createChart, type ChartType, type SimpleSeries } from './chart.ts';
import type { ChartModel } from './chart.ts';
import { addMedia } from './edit.ts';
import type { Deck, MediaShape } from './model.ts';
import type { Transform } from './dml.ts';
import { extensionOf } from './xmlns.ts';

const CHART_TYPES: Readonly<Record<string, ChartType>> = {
  'chart:bar': 'bar', 'chart:line': 'line', 'chart:circle': 'pie', 'chart:ring': 'doughnut', 'chart:area': 'area',
  'chart:scatter': 'scatter', 'chart:radar': 'radar', 'chart:filled-radar': 'radar', 'chart:bubble': 'bubble',
};

const MAX_CELLS = 100_000;

function cellValue(cell: XmlElement): number | null {
  const raw = attr(cell, 'office:value');
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Graphique d'un sous-document ODF (content.xml : chart:chart + table:table des donnees locales). */
export function readOdfChart(root: XmlElement): ChartModel | undefined {
  const chart = [...descendants(root, 'chart:chart')][0];
  const table = [...descendants(root, 'table:table')][0];
  const type = CHART_TYPES[attr(chart, 'chart:class') ?? ''];
  if (!chart || !table || !type) return undefined;
  const rows = [...children(child(table, 'table:table-header-rows'), 'table:table-row'), ...children(table, 'table:table-row'), ...children(child(table, 'table:table-rows'), 'table:table-row')];
  const grid = rows.map((row) => children(row).filter((c) => c.name === 'table:table-cell' || c.name === 'table:covered-table-cell').slice(0, 256));
  if (grid.length < 2 || grid.length * (grid[0]?.length ?? 0) > MAX_CELLS) return undefined;
  const header = grid[0] ?? [];
  const body = grid.slice(1);
  const categories = body.map((r) => textOf(r[0]).trim());
  const series: SimpleSeries[] = header.slice(1).map((cell, i) => ({ name: textOf(cell).trim() || `Série ${i + 1}`, values: body.map((r) => (r[i + 1] ? cellValue(r[i + 1] as XmlElement) : null)) }));
  if (!series.length) return undefined;
  const title = textOf(child(chart, 'chart:title')).trim();
  return createChart(type, categories, series, title ? { title } : {});
}

/** Lit le graphique designe par `draw:object` (chemin relatif au paquet) ; undefined si absent ou illisible. */
export async function readOdpChart(pkg: OpcPackage, href: string | undefined): Promise<ChartModel | undefined> {
  if (!href || /^[a-z]+:/i.test(href)) return undefined;
  let path: string;
  try {
    path = `${normalizePartPath(href)}/content.xml`;
  } catch {
    return undefined;
  }
  if (!pkg.has(path)) return undefined;
  return readOdfChart(await pkg.readXml(path));
}

/** draw:plugin : video ou audio, incorpore (fichier du paquet) ou lie (URL externe non dangereuse ignoree). */
export async function readOdpMedia(pkg: OpcPackage, deck: Deck, node: XmlElement, xfrm: Transform, id: number, name: string): Promise<MediaShape | undefined> {
  const plugin = child(node, 'draw:plugin');
  const href = attr(plugin, 'xlink:href');
  const mime = attr(plugin, 'draw:mime-type') ?? '';
  if (!plugin || !href) return undefined;
  const ext = extensionOf(href);
  const audio = mime.startsWith('audio/') || /^(mp3|wav|ogg|oga|m4a|wma|flac)$/i.test(ext);
  const video = mime.startsWith('video/') || /^(mp4|webm|ogv|mov|avi|wmv|mkv|m4v)$/i.test(ext);
  if (!audio && !video) return undefined;
  const shape: MediaShape = { kind: 'media', id, name: name || `Media ${id - 1}`, xfrm, mediaType: audio ? 'audio' : 'video', geometry: { type: 'preset', preset: 'rect' } };
  if (/^[a-z]+:/i.test(href)) return undefined;
  let path: string;
  try {
    path = normalizePartPath(href);
  } catch {
    return undefined;
  }
  if (!pkg.has(path)) return undefined;
  shape.mediaId = addMedia(deck, await pkg.readBytes(path), ext || (audio ? 'mp3' : 'mp4'));
  return shape;
}
