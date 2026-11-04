// Definitions de listes Word (puces, numeros, hierarchique) ajoutees au modele du document.
import type { AbstractNumbering, NumberFormat, NumberingLevel, WordDocument } from '@forgeoffice/docx';

export type ListSpec = { kind: 'bullet'; char: string } | { kind: 'number'; format: NumberFormat; text: string } | { kind: 'multilevel' };

const BULLET_CYCLE = ['•', '○', '▪'];
const NUMBER_CYCLE: NumberFormat[] = ['decimal', 'lowerLetter', 'lowerRoman'];

function level(i: number, spec: ListSpec): NumberingLevel {
  const indent = 36 + i * 36;
  const base = { level: i, start: 1, alignment: 'left' as const, suffix: 'tab' as const, paragraph: { indentLeft: indent, indentFirstLine: -18 } };
  if (spec.kind === 'bullet') {
    const char = i === 0 ? spec.char : BULLET_CYCLE[i % 3]!;
    return { ...base, format: 'bullet', text: char, run: { font: 'Segoe UI Symbol' } };
  }
  if (spec.kind === 'number') {
    const format = i === 0 ? spec.format : NUMBER_CYCLE[i % 3]!;
    return { ...base, format, text: i === 0 ? spec.text : `%${i + 1}.` };
  }
  // Hierarchique 1. / 1.1. / 1.1.1.
  const text = Array.from({ length: i + 1 }, (_, k) => `%${k + 1}`).join('.') + '.';
  return { ...base, format: 'decimal', text, paragraph: { indentLeft: 18 + i * 25, indentFirstLine: -(18 + i * 7) } };
}

/** Ajoute une liste (definition abstraite + instance) et renvoie le nouveau document et son numId. */
export function addList(doc: WordDocument, spec: ListSpec): { doc: WordDocument; numId: number } {
  const absId = doc.numbering.abstracts.reduce((m, a) => Math.max(m, a.id), -1) + 1;
  const numId = doc.numbering.instances.reduce((m, n) => Math.max(m, n.id), 0) + 1;
  const abstract: AbstractNumbering = {
    id: absId,
    multiLevelType: spec.kind === 'multilevel' ? 'multilevel' : 'hybridMultilevel',
    levels: Array.from({ length: 9 }, (_, i) => level(i, spec)),
  };
  return {
    numId,
    doc: {
      ...doc,
      numbering: {
        abstracts: [...doc.numbering.abstracts, abstract],
        instances: [...doc.numbering.instances, { id: numId, abstractId: absId, overrides: [] }],
      },
    },
  };
}

/** Liste existante du meme genre (pour continuer la numerotation au lieu d'en creer une nouvelle). */
export function findList(doc: WordDocument, spec: ListSpec): number | null {
  for (const inst of doc.numbering.instances) {
    const abs = doc.numbering.abstracts.find((a) => a.id === inst.abstractId);
    const l0 = abs?.levels.find((l) => l.level === 0);
    if (!l0 || inst.overrides.length) continue;
    if (spec.kind === 'bullet' && l0.format === 'bullet' && l0.text === spec.char) return inst.id;
    if (spec.kind === 'number' && l0.format === spec.format && l0.text === spec.text && abs?.multiLevelType !== 'multilevel') return inst.id;
    if (spec.kind === 'multilevel' && abs?.multiLevelType === 'multilevel' && l0.text === '%1.') return inst.id;
  }
  return null;
}

/** Liste existante ou nouvelle. */
export function ensureList(doc: WordDocument, spec: ListSpec): { doc: WordDocument; numId: number } {
  const found = findList(doc, spec);
  return found !== null ? { doc, numId: found } : addList(doc, spec);
}

/** Recommence la numerotation a 1 (nouvelle instance de la meme liste abstraite). */
export function restartList(doc: WordDocument, numId: number, start = 1): { doc: WordDocument; numId: number } {
  const inst = doc.numbering.instances.find((n) => n.id === numId);
  if (!inst) return { doc, numId };
  const id = doc.numbering.instances.reduce((m, n) => Math.max(m, n.id), 0) + 1;
  return {
    numId: id,
    doc: { ...doc, numbering: { ...doc.numbering, instances: [...doc.numbering.instances, { id, abstractId: inst.abstractId, overrides: [{ level: 0, startOverride: start }] }] } },
  };
}

/** Vrai si numId designe une liste a puces. */
export function isBullet(doc: WordDocument, numId: number): boolean {
  const inst = doc.numbering.instances.find((n) => n.id === numId);
  const abs = doc.numbering.abstracts.find((a) => a.id === inst?.abstractId);
  return abs?.levels.find((l) => l.level === 0)?.format === 'bullet';
}
