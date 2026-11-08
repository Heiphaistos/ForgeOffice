// Grammaire de base du francais, sans DOM : espaces et ponctuation, mots répétés, majuscule de phrase.
// Volontairement limité : aucun accord, aucune conjugaison (impossible sans dictionnaire) — seules les règles vérifiables par motif.
import type { Node as PMNode } from 'prosemirror-model';

export type GrammarRule = 'doubleSpace' | 'spaceBeforeComma' | 'noSpaceAfterComma' | 'doublePunctSpace' | 'repeatedWord' | 'sentenceCapital';

export interface GrammarIssue {
  rule: GrammarRule;
  /** Positions ProseMirror de la partie a remplacer. */
  from: number;
  to: number;
  message: string;
  /** Remplacement propose. */
  fix: string;
}

export const NBSP = ' ';
export const NNBSP = ' ';

const REPEATABLE = new Set(['nous', 'vous', 'très', 'bien', 'tout', 'tous', 'peu', 'fort', 'ha', 'hé', 'non', 'oui', 'plus', 'si', 'pas']);
const ABBREVIATIONS = /(?:^|\s)(?:M|Mme|Mlle|Dr|Pr|St|Ste|etc|cf|p|vol|n°|fig|av|apr|env|ex|éd|s|sq)\.$/i;

const MESSAGES: Readonly<Record<GrammarRule, string>> = {
  doubleSpace: 'Espace en trop',
  spaceBeforeComma: 'Pas d’espace avant une virgule ou un point',
  noSpaceAfterComma: 'Espace manquant après la virgule',
  doublePunctSpace: 'Espace insécable attendue avant ce signe de ponctuation',
  repeatedWord: 'Mot répété',
  sentenceCapital: 'Majuscule attendue en début de phrase',
};

/** Problemes d'un texte (positions relatives a `base` = position du premier caractere). */
export function checkText(text: string, base = 0): GrammarIssue[] {
  const out: GrammarIssue[] = [];
  const add = (rule: GrammarRule, a: number, b: number, fix: string): void => { out.push({ rule, from: base + a, to: base + b, message: MESSAGES[rule], fix }); };
  for (const m of text.matchAll(/ {2,}/g)) add('doubleSpace', m.index, m.index + m[0].length, ' ');
  for (const m of text.matchAll(/ +([,.])(?=\s|$|[)»"])/g)) add('spaceBeforeComma', m.index, m.index + m[0].length, m[1]!);
  for (const m of text.matchAll(/(\p{L}),(\p{L})/gu)) add('noSpaceAfterComma', m.index + 1, m.index + 2, ', ');
  // Ponctuation double : espace insecable avant ; : ! ? (apres un mot, hors adresses et heures).
  for (const m of text.matchAll(/(\p{L}) ([;:!?])(?=\s|$)/gu)) add('doublePunctSpace', m.index + 1, m.index + 2, m[2] === ':' ? NBSP : NNBSP);
  for (const m of text.matchAll(/(\p{L}{2,})\s+(\1)(?![\p{L}])/giu)) {
    const word = m[1]!;
    if (REPEATABLE.has(word.toLocaleLowerCase('fr'))) continue;
    add('repeatedWord', m.index + word.length, m.index + m[0].length, '');
  }
  for (const m of text.matchAll(/([.!?…])\s+(\p{Ll})/gu)) {
    const before = text.slice(0, m.index + 1);
    if (m[1] === '.' && ABBREVIATIONS.test(before)) continue;
    if (m[1] === '.' && /\d\.$/.test(before)) continue;
    const letterAt = m.index + m[0].length - 1;
    add('sentenceCapital', letterAt, letterAt + 1, m[2]!.toLocaleUpperCase('fr'));
  }
  return out.sort((a, b) => a.from - b.from);
}

/** Problemes de tout le document (un bloc de texte a la fois, objets en ligne = caractere neutre). */
export function checkDocument(doc: PMNode, limit = 200): GrammarIssue[] {
  const out: GrammarIssue[] = [];
  doc.descendants((node, pos) => {
    if (out.length >= limit) return false;
    if (!node.isTextblock) return true;
    let text = '';
    node.forEach((child) => { text += child.isText ? child.text ?? '' : '￼'; });
    out.push(...checkText(text, pos + 1));
    return false;
  });
  return out.slice(0, limit);
}
