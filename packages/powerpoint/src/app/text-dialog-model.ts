// Modele pur des boites Police et Paragraphe : proprietes du texte <-> valeurs du formulaire, patch minimal (champs modifies seulement).
import type { Effects, ParagraphProps, RunProps, Spacing } from '@forgeoffice/pptx';
import type { ParagraphPatch, RunPatch } from '../canvas/text.ts';
import { DEFAULT_TAB_PT } from '../canvas/render/tabs.ts';

export type TabAlign = 'l' | 'ctr' | 'r' | 'dec';

export const PT_PER_CM = 72 / 2.54;
const round = (v: number, digits = 2): number => Math.round(v * 10 ** digits) / 10 ** digits;
export const cmToPt = (cm: number): number => round(cm * PT_PER_CM);
export const ptToCm = (pt: number): number => round(pt / PT_PER_CM);

// ---- Paragraphe ----

export type SpecialIndent = 'none' | 'first' | 'hanging';
export type LineMode = 'multiple' | 'exact';

export interface ParagraphForm {
  align: NonNullable<ParagraphProps['align']>;
  /** Retrait avant le texte (cm). */
  beforeText: number;
  special: SpecialIndent;
  /** Valeur du retrait de premiere ligne / suspendu (cm). */
  specialBy: number;
  /** Espacement avant / apres (points). */
  spaceBefore: number;
  spaceAfter: number;
  lineMode: LineMode;
  /** Multiple (1 = simple) ou valeur exacte en points. */
  lineValue: number;
  /** Intervalle de tabulation par defaut (cm) et taquets personnalises (cm, croissants, alignes a gauche). */
  defaultTab: number;
  tabs: readonly number[];
  /** Alignement de chaque taquet (meme ordre que `tabs`) : gauche, centre, droite, decimal. */
  tabAligns: readonly TabAlign[];
}

const pts = (s: Spacing | undefined): number => (s?.type === 'pts' ? s.value : 0);

const sortedTabs = (p: ParagraphProps): NonNullable<ParagraphProps['tabs']> => [...(p.tabs ?? [])].sort((a, b) => a.position - b.position);

export function paragraphForm(p: ParagraphProps): ParagraphForm {
  const indent = p.indent ?? 0;
  const line = p.lineSpacing;
  return {
    align: p.align ?? 'l',
    beforeText: ptToCm(p.marginLeft ?? 0),
    special: indent < 0 ? 'hanging' : indent > 0 ? 'first' : 'none',
    specialBy: ptToCm(Math.abs(indent)),
    spaceBefore: pts(p.spaceBefore),
    spaceAfter: pts(p.spaceAfter),
    lineMode: line?.type === 'pts' ? 'exact' : 'multiple',
    lineValue: line ? (line.type === 'pts' ? line.value : round(line.value / 100)) : 1,
    defaultTab: ptToCm(p.defaultTabSize ?? DEFAULT_TAB_PT),
    tabs: sortedTabs(p).map((t) => ptToCm(t.position)),
    tabAligns: sortedTabs(p).map((t) => t.align),
  };
}

/** Patch ne contenant que les champs que l'utilisateur a changes (les espacements en % ne sont pas ecrases sans raison). */
export function paragraphPatch(form: ParagraphForm, initial: ParagraphForm): ParagraphPatch {
  const patch: ParagraphPatch = {};
  if (form.align !== initial.align) patch.align = form.align;
  if (form.beforeText !== initial.beforeText) patch.marginLeft = cmToPt(Math.max(0, form.beforeText));
  if (form.special !== initial.special || form.specialBy !== initial.specialBy) {
    const by = cmToPt(Math.max(0, form.specialBy));
    patch.indent = form.special === 'none' ? 0 : form.special === 'first' ? by : -by;
  }
  if (form.spaceBefore !== initial.spaceBefore) patch.spaceBefore = { type: 'pts', value: Math.max(0, form.spaceBefore) };
  if (form.spaceAfter !== initial.spaceAfter) patch.spaceAfter = { type: 'pts', value: Math.max(0, form.spaceAfter) };
  if (form.lineMode !== initial.lineMode || form.lineValue !== initial.lineValue) {
    patch.lineSpacing = form.lineMode === 'exact' ? { type: 'pts', value: Math.max(0.1, form.lineValue) } : { type: 'pct', value: Math.round(Math.max(0.1, form.lineValue) * 100) };
  }
  if (form.defaultTab !== initial.defaultTab) patch.defaultTabSize = cmToPt(Math.max(0.1, form.defaultTab));
  if (form.tabs.join() !== initial.tabs.join() || form.tabAligns.join() !== initial.tabAligns.join()) patch.tabs = form.tabs.length ? form.tabs.map((cm, i) => ({ position: cmToPt(cm), align: form.tabAligns[i] ?? 'l' })) : null;
  return patch;
}

/** Ajoute un taquet aligne ; renvoie les deux listes paralleles (triees, sans doublon de position). */
export function addTabAligned(tabs: readonly number[], aligns: readonly TabAlign[], cm: number, align: TabAlign): { tabs: readonly number[]; tabAligns: readonly TabAlign[] } {
  const v = round(cm);
  if (v <= 0 || tabs.includes(v)) return { tabs, tabAligns: aligns };
  const entries = [...tabs.map((t, i) => ({ t, a: aligns[i] ?? 'l' })), { t: v, a: align }].sort((x, y) => x.t - y.t);
  return { tabs: entries.map((e) => e.t), tabAligns: entries.map((e) => e.a) };
}

/** Ajoute un taquet (cm) sans doublon, liste triee. */
export function addTab(tabs: readonly number[], cm: number): readonly number[] {
  const v = round(cm);
  return v > 0 && !tabs.includes(v) ? [...tabs, v].sort((a, b) => a - b) : tabs;
}

// ---- Police ----

export type StrikeMode = 'none' | 'single' | 'double';
export type ScriptMode = 'none' | 'sup' | 'sub';
export type CapsMode = NonNullable<RunProps['caps']>;

export interface FontForm {
  font: string;
  bold: boolean;
  italic: boolean;
  size: number;
  /** Valeur OOXML (none, sng, dbl, heavy, dotted, dash, wavy...). */
  underline: string;
  strike: StrikeMode;
  script: ScriptMode;
  /** Decalage de ligne de base en % (toujours positif ; le signe vient de `script`). */
  offset: number;
  caps: CapsMode;
  /** Espacement des caracteres en points (negatif = condense). */
  spacing: number;
  shadow: boolean;
}

export const DEFAULT_SUPERSCRIPT = 30;
export const DEFAULT_SUBSCRIPT = 25;

export function fontForm(run: RunProps, fallbackFont: string): FontForm {
  const base = run.baseline ?? 0;
  return {
    font: run.font ?? fallbackFont,
    bold: !!run.bold,
    italic: !!run.italic,
    size: run.size ?? 18,
    underline: run.underline ?? 'none',
    strike: run.strike === 'sngStrike' ? 'single' : run.strike === 'dblStrike' ? 'double' : 'none',
    script: base > 0 ? 'sup' : base < 0 ? 'sub' : 'none',
    offset: Math.abs(base) || DEFAULT_SUPERSCRIPT,
    caps: run.caps ?? 'none',
    spacing: run.spacing ?? 0,
    shadow: !!run.effects?.outerShadow,
  };
}

/** Choisir exposant/indice change le decalage par defaut (30 % / 25 %), comme PowerPoint. */
export function withScript(form: FontForm, script: ScriptMode): FontForm {
  return { ...form, script, offset: script === 'sub' ? DEFAULT_SUBSCRIPT : script === 'sup' ? DEFAULT_SUPERSCRIPT : form.offset };
}

const baselineOf = (f: FontForm): number => (f.script === 'sup' ? f.offset : f.script === 'sub' ? -f.offset : 0);

const textShadow = (): Effects => ({ outerShadow: { color: { type: 'rgb', value: '000000', mods: [{ name: 'alpha', val: 43000 }] }, blur: 3, distance: 1.5, direction: 45 } });

export function fontPatch(form: FontForm, initial: FontForm): RunPatch {
  const patch: RunPatch = {};
  if (form.font !== initial.font) patch.font = form.font || null;
  if (form.bold !== initial.bold) patch.bold = form.bold || null;
  if (form.italic !== initial.italic) patch.italic = form.italic || null;
  if (form.size !== initial.size) patch.size = form.size > 0 ? form.size : null;
  if (form.underline !== initial.underline) patch.underline = form.underline === 'none' ? null : form.underline;
  if (form.strike !== initial.strike) patch.strike = form.strike === 'single' ? 'sngStrike' : form.strike === 'double' ? 'dblStrike' : null;
  if (baselineOf(form) !== baselineOf(initial)) patch.baseline = baselineOf(form) || null;
  if (form.caps !== initial.caps) patch.caps = form.caps === 'none' ? null : form.caps;
  if (form.spacing !== initial.spacing) patch.spacing = form.spacing || null;
  if (form.shadow !== initial.shadow) patch.effects = form.shadow ? textShadow() : null;
  return patch;
}

/** Aperçu CSS minimal pour la zone d'exemple de la boite Police. */
export function previewStyle(form: FontForm): Record<string, string | number> {
  const deco = [form.underline !== 'none' ? 'underline' : '', form.strike !== 'none' ? 'line-through' : ''].filter(Boolean).join(' ');
  return {
    fontFamily: form.font,
    fontSize: `${Math.min(36, Math.max(8, form.size))}px`,
    fontWeight: form.bold ? 700 : 400,
    fontStyle: form.italic ? 'italic' : 'normal',
    textDecorationLine: deco || 'none',
    textTransform: form.caps === 'all' ? 'uppercase' : 'none',
    fontVariant: form.caps === 'small' ? 'small-caps' : 'normal',
    letterSpacing: `${form.spacing}px`,
    verticalAlign: form.script === 'sup' ? 'super' : form.script === 'sub' ? 'sub' : 'baseline',
  };
}
