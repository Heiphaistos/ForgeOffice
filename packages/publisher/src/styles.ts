// Styles de texte nommes de la publication (caracteres + paragraphe), enregistres dans publication.json.
// Les couleurs sont limitees aux couleurs RVB et aux couleurs du modele : le reste (degrades, effets) n'est pas conserve.
import type { Color, ParagraphProps, RunProps, SchemeColorName, Spacing } from '@forgeoffice/pptx';
import type { RunPatch } from '@forgeoffice/powerpoint/canvas';

export interface NamedStyle {
  id: string;
  name: string;
  run: RunProps;
  para: ParagraphProps;
  /** Style de depart : ses proprietes s'appliquent d'abord, celles de ce style les completent. */
  basedOn?: string;
}

export const MAX_STYLES = 100;
const MAX_NAME = 60;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const finite = (v: unknown, min: number, max: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined);
const SCHEME: readonly string[] = ['bg1', 'tx1', 'bg2', 'tx2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink', 'dk1', 'lt1', 'dk2', 'lt2'];

function color(raw: unknown): Color | undefined {
  const o = obj(raw);
  if (o.type === 'rgb' && typeof o.value === 'string' && /^[0-9a-f]{6}$/i.test(o.value)) return { type: 'rgb', value: o.value.toUpperCase() };
  if (o.type === 'scheme' && typeof o.value === 'string' && SCHEME.includes(o.value)) return { type: 'scheme', value: o.value as SchemeColorName };
  return undefined;
}

function spacing(raw: unknown): Spacing | undefined {
  const o = obj(raw);
  const value = finite(o.value, 0, 100_000);
  return value !== undefined && (o.type === 'pct' || o.type === 'pts') ? { type: o.type, value } : undefined;
}

/** Proprietes de caracteres retenues dans un style (liste blanche). */
export function sanitizeRun(raw: unknown): RunProps {
  const o = obj(raw);
  const out: RunProps = {};
  if (typeof o.font === 'string' && o.font) out.font = o.font.slice(0, 100);
  const size = finite(o.size, 1, 4000);
  if (size !== undefined) out.size = size;
  if (typeof o.bold === 'boolean') out.bold = o.bold;
  if (typeof o.italic === 'boolean') out.italic = o.italic;
  if (typeof o.underline === 'string' && /^[A-Za-z]{1,20}$/.test(o.underline)) out.underline = o.underline;
  if (o.strike === 'noStrike' || o.strike === 'sngStrike' || o.strike === 'dblStrike') out.strike = o.strike;
  const c = color(o.color);
  if (c) out.color = c;
  const baseline = finite(o.baseline, -100, 100);
  if (baseline !== undefined) out.baseline = baseline;
  const gap = finite(o.spacing, -100, 1000);
  if (gap !== undefined) out.spacing = gap;
  if (o.caps === 'none' || o.caps === 'small' || o.caps === 'all') out.caps = o.caps;
  return out;
}

const ALIGNS = ['l', 'ctr', 'r', 'just', 'dist'] as const;

/** Proprietes de paragraphe retenues dans un style (liste blanche). */
export function sanitizePara(raw: unknown): ParagraphProps {
  const o = obj(raw);
  const out: ParagraphProps = {};
  const align = ALIGNS.find((a) => a === o.align);
  if (align) out.align = align;
  const left = finite(o.marginLeft, 0, 10_000);
  if (left !== undefined) out.marginLeft = left;
  const indent = finite(o.indent, -10_000, 10_000);
  if (indent !== undefined) out.indent = indent;
  for (const key of ['lineSpacing', 'spaceBefore', 'spaceAfter'] as const) {
    const s = spacing(o[key]);
    if (s) out[key] = s;
  }
  return out;
}

const slug = (name: string): string => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'style';

/** Identifiant libre derive du nom. */
export function freeId(name: string, styles: readonly NamedStyle[]): string {
  const base = slug(name);
  let id = base;
  for (let n = 2; styles.some((s) => s.id === id); n++) id = `${base}-${n}`;
  return id;
}

/** Styles lus depuis publication.json : entrees invalides ignorees, noms et identifiants uniques. */
export function parseStyles(value: unknown): NamedStyle[] {
  const out: NamedStyle[] = [];
  for (const item of (Array.isArray(value) ? value : []).slice(0, MAX_STYLES)) {
    const o = obj(item);
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, MAX_NAME) : '';
    if (!name || out.some((s) => s.name === name)) continue;
    const id = freeId(typeof o.id === 'string' && o.id ? o.id : name, out);
    out.push({ id, name, run: sanitizeRun(o.run), para: sanitizePara(o.para), ...(typeof o.basedOn === 'string' && o.basedOn ? { basedOn: o.basedOn.slice(0, 30) } : {}) });
  }
  // Un style de base inconnu ou une boucle est retire.
  return out.map((s) => {
    if (!s.basedOn) return s;
    const valid = s.basedOn !== s.id && out.some((x) => x.id === s.basedOn) && !chainOf(out, s).cyclic;
    if (valid) return s;
    const { basedOn: _unused, ...rest } = s;
    return rest;
  });
}

const MAX_DEPTH = 8;

/** Chaine d'heritage (du style de depart au style lui-meme) ; `cyclic` si elle revient sur un style deja vu. */
export function chainOf(styles: readonly NamedStyle[], style: NamedStyle): { chain: NamedStyle[]; cyclic: boolean } {
  const chain: NamedStyle[] = [style];
  const seen = new Set([style.id]);
  let cur = style;
  while (cur.basedOn && chain.length <= MAX_DEPTH) {
    const parent = styles.find((s) => s.id === cur.basedOn);
    if (!parent) break;
    if (seen.has(parent.id)) return { chain: chain.reverse(), cyclic: true };
    seen.add(parent.id);
    chain.push(parent);
    cur = parent;
  }
  return { chain: chain.reverse(), cyclic: false };
}

/** Style effectif : proprietes du style de depart completees puis remplacees par celles du style (heritage multi-niveaux). */
export function resolveStyle(styles: readonly NamedStyle[], style: NamedStyle): NamedStyle {
  const { chain } = chainOf(styles, style);
  return { ...style, run: Object.assign({}, ...chain.map((s) => s.run)) as RunProps, para: Object.assign({}, ...chain.map((s) => s.para)) as ParagraphProps };
}

/** Definit le style de depart (null = aucun) ; refuse un style inconnu, lui-meme ou une boucle. */
export function setBasedOn(styles: readonly NamedStyle[], id: string, basedOn: string | null): NamedStyle[] {
  const target = styles.find((s) => s.id === id);
  if (!target) return [...styles];
  if (basedOn !== null) {
    if (basedOn === id || !styles.some((s) => s.id === basedOn)) return [...styles];
    const candidate = styles.map((s) => (s.id === id ? { ...s, basedOn } : s));
    if (chainOf(candidate, candidate.find((s) => s.id === id) as NamedStyle).cyclic) return [...styles];
    return candidate;
  }
  return styles.map((s) => {
    if (s.id !== id) return s;
    const { basedOn: _unused, ...rest } = s;
    return rest;
  });
}

/** Ajoute les styles d'un autre fichier : un style de meme nom est remplace, les liens de base sont conserves entre styles importes. */
export function mergeStyles(existing: readonly NamedStyle[], incoming: readonly NamedStyle[]): NamedStyle[] {
  let out = [...existing];
  const idOf = new Map<string, string>();
  for (const s of incoming) {
    out = saveStyle(out, s.name, s.run, s.para);
    idOf.set(s.id, (out.find((x) => x.name === s.name) as NamedStyle).id);
  }
  for (const s of incoming) {
    const mine = idOf.get(s.id);
    const base = s.basedOn ? idOf.get(s.basedOn) : undefined;
    if (mine && base) out = setBasedOn(out, mine, base);
  }
  return out;
}

/** Nouveau style (ou mise a jour du style de meme nom) a partir de la mise en forme courante. */
export function saveStyle(styles: readonly NamedStyle[], name: string, run: RunProps, para: ParagraphProps): NamedStyle[] {
  const clean = name.trim().slice(0, MAX_NAME);
  if (!clean) return [...styles];
  const entry = { name: clean, run: sanitizeRun(run), para: sanitizePara(para) };
  const at = styles.findIndex((s) => s.name === clean);
  if (at >= 0) return styles.map((s, i) => (i === at ? { ...s, ...entry } : s));
  return styles.length >= MAX_STYLES ? [...styles] : [...styles, { id: freeId(clean, styles), ...entry }];
}

/** Renomme un style ; refuse un nom vide ou deja pris. */
export function renameStyle(styles: readonly NamedStyle[], id: string, name: string): NamedStyle[] {
  const clean = name.trim().slice(0, MAX_NAME);
  if (!clean || styles.some((s) => s.id !== id && s.name === clean)) return [...styles];
  return styles.map((s) => (s.id === id ? { ...s, name: clean } : s));
}

export const removeStyle = (styles: readonly NamedStyle[], id: string): NamedStyle[] => styles.filter((s) => s.id !== id);

/** Remplace la mise en forme d'un style par celle de la selection (nom conserve). */
export function updateStyle(styles: readonly NamedStyle[], id: string, run: RunProps, para: ParagraphProps): NamedStyle[] {
  return styles.map((s) => (s.id === id ? { ...s, run: sanitizeRun(run), para: sanitizePara(para) } : s));
}

/** Modifications a appliquer a un texte : les attributs absents du style sont remis a zero (gras, italique, majuscules, espacement). */
export function runPatchOf(style: NamedStyle): RunPatch {
  return { ...style.run, bold: style.run.bold ?? null, italic: style.run.italic ?? null, caps: style.run.caps ?? null, spacing: style.run.spacing ?? null };
}
