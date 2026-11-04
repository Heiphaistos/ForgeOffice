// Valeurs effectives : heritage des styles (basedOn), valeurs par defaut, numeros de liste calcules.
import type {
  Block, NumberingLevel, Paragraph, ParagraphProps, RunProps, Style, TextRun, WordDocument,
} from './model.ts';
import { formatNumber } from './text.ts';

function chain(styles: readonly Style[], id: string | undefined): Style[] {
  const byId = new Map(styles.map((s) => [s.id, s]));
  const out: Style[] = [];
  const seen = new Set<string>();
  let current = id ? byId.get(id) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    out.unshift(current);
    current = current.basedOn ? byId.get(current.basedOn) : undefined;
  }
  return out;
}

/** Style de paragraphe par defaut (« Normal »). */
export function defaultStyleId(doc: WordDocument, type: Style['type']): string | undefined {
  return doc.styles.styles.find((s) => s.type === type && s.isDefault)?.id;
}

/** Proprietes de paragraphe effectives (docDefaults < chaine de styles < proprietes directes). */
export function effectiveParagraphProps(doc: WordDocument, paragraph: Pick<Paragraph, 'styleId' | 'props'>): ParagraphProps {
  const styleId = paragraph.styleId ?? defaultStyleId(doc, 'paragraph');
  let props: ParagraphProps = { ...doc.styles.docDefaults.paragraph };
  for (const style of chain(doc.styles.styles, styleId)) props = { ...props, ...style.paragraph };
  return { ...props, ...paragraph.props };
}

/** Proprietes de caracteres effectives d'un texte dans son paragraphe. */
export function effectiveRunProps(doc: WordDocument, paragraph: Pick<Paragraph, 'styleId'>, run: Pick<TextRun, 'styleId' | 'props'>): RunProps {
  const styleId = paragraph.styleId ?? defaultStyleId(doc, 'paragraph');
  let props: RunProps = { ...doc.styles.docDefaults.run };
  for (const style of chain(doc.styles.styles, styleId)) props = { ...props, ...style.run };
  for (const style of chain(doc.styles.styles, run.styleId)) props = { ...props, ...style.run };
  props = { ...props, ...run.props };
  if (props.fontTheme) props.font = props.fontTheme === 'major' ? doc.theme.majorFont : doc.theme.minorFont;
  return props;
}

/** Definition d'un niveau de liste (en tenant compte des redefinitions de l'instance). */
export function numberingLevel(doc: WordDocument, numId: number, level: number): NumberingLevel | undefined {
  const instance = doc.numbering.instances.find((n) => n.id === numId);
  if (!instance) return undefined;
  const override = instance.overrides.find((o) => o.level === level);
  if (override?.definition) return override.definition;
  const abstract = doc.numbering.abstracts.find((a) => a.id === instance.abstractId);
  return abstract?.levels.find((l) => l.level === level);
}

/** Vrai si la liste est une liste a puces. */
export function isBulletList(doc: WordDocument, numId: number, level = 0): boolean {
  return numberingLevel(doc, numId, level)?.format === 'bullet';
}

function* paragraphsOf(blocks: readonly Block[]): Generator<Paragraph> {
  for (const block of blocks) {
    if (block.type === 'paragraph') yield block;
    else if (block.type === 'table') for (const row of block.rows) for (const cell of row.cells) yield* paragraphsOf(cell.blocks);
    else if (block.type === 'contentControl' || block.type === 'toc') yield* paragraphsOf(block.blocks);
  }
}

/** Numeros de liste affiches (« 1. », « a) », « • ») pour chaque paragraphe de liste du corps. */
export function computeListLabels(doc: WordDocument, blocks: readonly Block[] = doc.body): Map<Paragraph, string> {
  const labels = new Map<Paragraph, string>();
  // Compteurs par liste abstraite (Word partage les compteurs entre instances d'une meme liste abstraite
  // sauf redemarrage explicite par startOverride).
  const counters = new Map<number, number[]>();
  const startedInstances = new Set<number>();
  for (const paragraph of paragraphsOf(blocks)) {
    const numbering = effectiveParagraphProps(doc, paragraph).numbering;
    if (!numbering || numbering.numId === 0) continue;
    const instance = doc.numbering.instances.find((n) => n.id === numbering.numId);
    if (!instance) continue;
    const level = Math.min(8, Math.max(0, numbering.level));
    const def = numberingLevel(doc, instance.id, level);
    if (!def) continue;
    let counts = counters.get(instance.abstractId);
    if (!counts) {
      counts = new Array<number>(9).fill(0);
      counters.set(instance.abstractId, counts);
    }
    if (!startedInstances.has(instance.id)) {
      startedInstances.add(instance.id);
      for (const o of instance.overrides) if (o.startOverride !== undefined) counts[o.level] = o.startOverride - 1;
    }
    const startOf = (lvl: number): number => numberingLevel(doc, instance.id, lvl)?.start ?? 1;
    counts[level] = (counts[level] ?? 0) === 0 && !instance.overrides.some((o) => o.level === level && o.startOverride !== undefined)
      ? startOf(level)
      : (counts[level] ?? 0) + 1;
    for (let deeper = level + 1; deeper < 9; deeper++) {
      const deeperDef = numberingLevel(doc, instance.id, deeper);
      const restartAfter = deeperDef?.restartAfter;
      if (restartAfter === 0) continue;
      if (restartAfter === undefined || restartAfter - 1 >= level) counts[deeper] = 0;
    }
    if (def.format === 'bullet') {
      labels.set(paragraph, def.text);
      continue;
    }
    const label = def.text.replace(/%([1-9])/g, (_, d: string) => {
      const lvl = Number(d) - 1;
      const lvlDef = numberingLevel(doc, instance.id, lvl);
      const value = counts[lvl] || startOf(lvl);
      return formatNumber(value, def.isLegal ? 'decimal' : (lvlDef?.format ?? 'decimal'));
    });
    labels.set(paragraph, label);
  }
  return labels;
}

/** Niveau de titre (1..9) d'un paragraphe d'apres son niveau hierarchique effectif, ou 0. */
export function headingLevel(doc: WordDocument, paragraph: Paragraph): number {
  const level = effectiveParagraphProps(doc, paragraph).outlineLevel;
  return level !== undefined && level >= 0 && level < 9 ? level + 1 : 0;
}
