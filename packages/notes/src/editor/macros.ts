// Macros : enregistrement des frappes et deplacements (relatifs au curseur), rejeu N fois ou jusqu'a la fin du document.
import { Annotation, EditorSelection, EditorState, type Transaction, type TransactionSpec } from '@codemirror/state';

/** Marque les transactions produites par un rejeu (elles ne s'enregistrent pas elles-memes). */
export const macroReplay = Annotation.define<boolean>();

export type MacroStep =
  /** Remplace [from, to] (relatifs a la tete du curseur) par `ins` ; le curseur se place `caret` caracteres apres `from`. */
  | { t: 'edit'; from: number; to: number; ins: string; caret: number }
  /** Deplace le curseur : `col` est relatif (meme ligne) ou absolu (autre ligne) ; `sel` = longueur selectionnee (signee, meme ligne). */
  | { t: 'move'; lines: number; col: number; abs: boolean; sel: number };

/** Etape correspondant a une transaction utilisateur, ou null (rejeu, plusieurs curseurs, plusieurs changements, clic de souris). */
export function recordStep(tr: Transaction): MacroStep | null {
  if (tr.annotation(macroReplay) || tr.startState.selection.ranges.length > 1) return null;
  const before = tr.startState.selection.main;
  const after = tr.newSelection.main;
  if (tr.docChanged) {
    const found: { fromA: number; toA: number; fromB: number; ins: string }[] = [];
    tr.changes.iterChanges((fromA, toA, fromB, _toB, inserted) => void found.push({ fromA, toA, fromB, ins: inserted.toString() }));
    const c = found.length === 1 ? found[0] : undefined;
    if (!c || tr.newSelection.ranges.length > 1) return null;
    return { t: 'edit', from: c.fromA - before.head, to: c.toA - before.head, ins: c.ins, caret: after.head - c.fromB };
  }
  if (!tr.selection || tr.isUserEvent('select.pointer') || tr.newSelection.ranges.length > 1) return null;
  const doc = tr.startState.doc;
  const l0 = doc.lineAt(before.head);
  const l1 = doc.lineAt(after.head);
  if (l0.number === l1.number) {
    const sel = after.anchor - after.head;
    return after.head === before.head && sel === (before.anchor - before.head) ? null : { t: 'move', lines: 0, col: after.head - before.head, abs: false, sel };
  }
  return { t: 'move', lines: l1.number - l0.number, col: after.head - l1.from, abs: true, sel: 0 };
}

const clamp = (n: number, max: number): number => Math.max(0, Math.min(n, max));

/** Transaction d'une etape, appliquee a la position courante du curseur. */
export function stepSpec(state: EditorState, step: MacroStep): TransactionSpec {
  const head = state.selection.main.head;
  const max = state.doc.length;
  if (step.t === 'edit') {
    const from = clamp(head + step.from, max);
    const to = clamp(head + step.to, max);
    const length = max - (to - from) + step.ins.length;
    return { changes: { from, to: Math.max(from, to), insert: step.ins }, selection: { anchor: clamp(from + step.caret, length) }, annotations: macroReplay.of(true), userEvent: 'input.macro' };
  }
  const line = state.doc.lineAt(head);
  let pos: number;
  if (step.abs) {
    const target = state.doc.line(Math.max(1, Math.min(line.number + step.lines, state.doc.lines)));
    pos = target.from + Math.min(step.col, target.length);
  } else pos = clamp(head + step.col, max);
  const anchor = clamp(pos + step.sel, max);
  return { selection: EditorSelection.single(anchor, pos), annotations: macroReplay.of(true), scrollIntoView: true };
}

const MAX_RUNS = 100_000;

/**
 * Rejoue la macro : `times` fois, ou (`'end'`) tant que le curseur descend d'une ligne a chaque passage, comme « Executer jusqu'a la fin ».
 * Renvoie les transactions en chaine (la premiere part de `state`) : `view.dispatch(trs)` les applique d'un coup.
 */
export function runMacro(state: EditorState, steps: readonly MacroStep[], times: number | 'end'): Transaction[] {
  const out: Transaction[] = [];
  if (steps.length === 0) return out;
  const runs = times === 'end' ? MAX_RUNS : Math.max(0, Math.min(times, MAX_RUNS));
  let current = state;
  for (let i = 0; i < runs; i++) {
    const startLine = current.doc.lineAt(current.selection.main.head).number;
    for (const step of steps) {
      const tr = current.update(stepSpec(current, step));
      out.push(tr);
      current = tr.state;
    }
    // Fin : le passage vient de se faire sur la derniere ligne (le curseur ne descend plus).
    if (times === 'end' && current.doc.lineAt(current.selection.main.head).number <= startLine) break;
  }
  return out;
}

/** Etapes lues dans la session (valeurs inconnues ignorees). */
export function parseSteps(raw: unknown): MacroStep[] {
  if (!Array.isArray(raw)) return [];
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const out: MacroStep[] = [];
  for (const o of raw.slice(0, 5000) as Record<string, unknown>[]) {
    if (o?.t === 'edit' && typeof o.ins === 'string' && o.ins.length <= 100_000) out.push({ t: 'edit', from: num(o.from), to: num(o.to), ins: o.ins, caret: num(o.caret) });
    else if (o?.t === 'move') out.push({ t: 'move', lines: num(o.lines), col: num(o.col), abs: o.abs === true, sel: num(o.sel) });
  }
  return out;
}
