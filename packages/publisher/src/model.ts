// Reglages propres a une publication (fichier publication.json du paquet .fopub) : type de composition, reperes,
// fonds perdus, pages en vis-a-vis, chainage des zones de texte, habillage, lettrines, imposition, publipostage.
// Positions et tailles en points. Le contenu des pages vit dans le Deck (@forgeoffice/pptx).

export type CompositionKind =
  | 'blank' | 'flyer' | 'poster' | 'businessCard' | 'businessCards10' | 'greetingCard' | 'invitation' | 'trifold'
  | 'newsletter' | 'menu' | 'certificate' | 'labels' | 'calendar' | 'banner';

export const COMPOSITION_KINDS: readonly CompositionKind[] = [
  'blank', 'flyer', 'poster', 'businessCard', 'businessCards10', 'greetingCard', 'invitation', 'trifold', 'newsletter', 'menu', 'certificate', 'labels', 'calendar', 'banner',
];

/** Habillage du texte autour d'un objet : aucun, carre, ajuste (contour), haut et bas. */
export type WrapMode = 'none' | 'square' | 'tight' | 'topBottom';
export const WRAP_MODES: readonly WrapMode[] = ['none', 'square', 'tight', 'topBottom'];

export interface Margins {
  top: number;
  bottom: number;
  /** Marge interieure (gauche sur une page de droite, droite sur une page de gauche en vis-a-vis). */
  inside: number;
  outside: number;
}

/** Emplacement d'une zone de texte : page (identifiant de diapositive) + forme. */
export interface BoxRef {
  page: number;
  shape: number;
}

/** Article : zones de texte chainees, le texte deborde de l'une dans la suivante. */
export interface Chain {
  id: string;
  boxes: BoxRef[];
  /** joins[i] : le premier paragraphe de la zone i+1 continue le dernier de la zone i. */
  joins: boolean[];
  /** empty[i] : la zone i n'a recu aucun texte (son paragraphe vide n'appartient pas a l'article). */
  empty: boolean[];
}

/** Imposition a l'impression : cartes ou etiquettes repetees sur une feuille, ou carte pliee (2 pages par feuille). */
export interface Imposition {
  kind: 'cards' | 'fold';
  sheet: { width: number; height: number };
  cols: number;
  rows: number;
  /** Ecart entre les copies et marge de la feuille. */
  gapX: number;
  gapY: number;
}

export interface MergeSource {
  name: string;
  fields: string[];
  records: string[][];
}

export interface PubSettings {
  version: 1;
  kind: CompositionKind;
  /** Fond perdu ajoute autour de chaque page a l'export pour l'imprimeur. */
  bleed: number;
  facing: boolean;
  margins: Margins;
  columns: { count: number; gap: number };
  rows: { count: number; gap: number };
  baseline: { spacing: number; offset: number };
  /** Reperes de regle (crees en tirant depuis les regles). */
  guides: { x: number[]; y: number[] };
  chains: Chain[];
  /** Habillage par forme (cle `page:forme`). */
  wraps: Record<string, WrapMode>;
  /** Lettrine par zone de texte (cle `page:forme`) : nombre de lignes. */
  dropCaps: Record<string, number>;
  imposition: Imposition | null;
  merge: MergeSource | null;
  colorScheme: string | null;
  fontScheme: string | null;
}

export const shapeKey = (page: number, shape: number): string => `${page}:${shape}`;

export function defaultSettings(kind: CompositionKind = 'blank', patch: Partial<PubSettings> = {}): PubSettings {
  return {
    version: 1,
    kind,
    bleed: 9,
    facing: false,
    margins: { top: 36, bottom: 36, inside: 36, outside: 36 },
    columns: { count: 1, gap: 14.4 },
    rows: { count: 1, gap: 14.4 },
    baseline: { spacing: 12, offset: 0 },
    guides: { x: [], y: [] },
    chains: [],
    wraps: {},
    dropCaps: {},
    imposition: null,
    merge: null,
    colorScheme: null,
    fontScheme: null,
    ...patch,
  };
}

// ---- Lecture defensive (publication.json est une donnee hostile) ----

const MAX_LIST = 10_000;
const MAX_PT = 56 * 72 * 4;

function num(value: unknown, fallback: number, min = -MAX_PT, max = MAX_PT): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

const int = (value: unknown, fallback: number, min: number, max: number): number => Math.round(num(value, fallback, min, max));

const obj = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value.slice(0, MAX_LIST) : []);

const str = (value: unknown, max = 200): string => (typeof value === 'string' ? value.slice(0, max) : '');

function numbers(value: unknown): number[] {
  return list(value).filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).map((v) => num(v, 0));
}

function record<T>(value: unknown, keep: (v: unknown) => v is T): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(obj(value)).slice(0, MAX_LIST)) if (/^\d{1,9}:\d{1,9}$/.test(k) && keep(v)) out[k] = v;
  return out;
}

const isWrap = (v: unknown): v is WrapMode => typeof v === 'string' && (WRAP_MODES as readonly string[]).includes(v);
const isDropCap = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 2 && v <= 10;

function parseChain(value: unknown, index: number): Chain | null {
  const o = obj(value);
  const boxes = list(o.boxes)
    .map((b) => obj(b))
    .filter((b) => typeof b.page === 'number' && typeof b.shape === 'number')
    .map((b) => ({ page: int(b.page, 0, 0, 1e9), shape: int(b.shape, 0, 0, 1e9) }));
  if (boxes.length < 2) return null;
  const flags = (v: unknown, n: number): boolean[] => Array.from({ length: n }, (_, i) => list(v)[i] === true);
  return { id: str(o.id, 64) || `article${index + 1}`, boxes, joins: flags(o.joins, boxes.length - 1), empty: flags(o.empty, boxes.length) };
}

function parseImposition(value: unknown): Imposition | null {
  const o = obj(value);
  if (o.kind !== 'cards' && o.kind !== 'fold') return null;
  const sheet = obj(o.sheet);
  return {
    kind: o.kind,
    sheet: { width: num(sheet.width, 595, 72, MAX_PT), height: num(sheet.height, 842, 72, MAX_PT) },
    cols: int(o.cols, 1, 1, 20),
    rows: int(o.rows, 1, 1, 40),
    gapX: num(o.gapX, 0, 0, 200),
    gapY: num(o.gapY, 0, 0, 200),
  };
}

function parseMerge(value: unknown): MergeSource | null {
  const o = obj(value);
  const fields = list(o.fields).map((f) => str(f, 100)).filter(Boolean).slice(0, 200);
  if (!fields.length) return null;
  const records = list(o.records).slice(0, 5000).map((r) => list(r).slice(0, fields.length).map((c) => str(c, 2000)));
  return { name: str(o.name, 200), fields, records };
}

/** Reglages lus depuis publication.json : tout champ absent ou invalide prend sa valeur par defaut. */
export function parseSettings(text: string): PubSettings {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return defaultSettings();
  }
  const o = obj(raw);
  const base = defaultSettings();
  const margins = obj(o.margins);
  const columns = obj(o.columns);
  const rows = obj(o.rows);
  const baseline = obj(o.baseline);
  const guides = obj(o.guides);
  const kind = (COMPOSITION_KINDS as readonly unknown[]).includes(o.kind) ? (o.kind as CompositionKind) : 'blank';
  return {
    version: 1,
    kind,
    bleed: num(o.bleed, base.bleed, 0, 72),
    facing: o.facing === true,
    margins: {
      top: num(margins.top, base.margins.top, 0, MAX_PT),
      bottom: num(margins.bottom, base.margins.bottom, 0, MAX_PT),
      inside: num(margins.inside, base.margins.inside, 0, MAX_PT),
      outside: num(margins.outside, base.margins.outside, 0, MAX_PT),
    },
    columns: { count: int(columns.count, 1, 1, 24), gap: num(columns.gap, base.columns.gap, 0, 288) },
    rows: { count: int(rows.count, 1, 1, 24), gap: num(rows.gap, base.rows.gap, 0, 288) },
    baseline: { spacing: num(baseline.spacing, 12, 1, 288), offset: num(baseline.offset, 0, 0, 288) },
    guides: { x: numbers(guides.x).slice(0, 200), y: numbers(guides.y).slice(0, 200) },
    chains: list(o.chains).map(parseChain).filter((c): c is Chain => c !== null).slice(0, 500),
    wraps: record(o.wraps, isWrap),
    dropCaps: record(o.dropCaps, isDropCap),
    imposition: parseImposition(o.imposition),
    merge: parseMerge(o.merge),
    colorScheme: str(o.colorScheme, 64) || null,
    fontScheme: str(o.fontScheme, 64) || null,
  };
}

export function serializeSettings(settings: PubSettings): string {
  return JSON.stringify(settings, null, 2);
}
